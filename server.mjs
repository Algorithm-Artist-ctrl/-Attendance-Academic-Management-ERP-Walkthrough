import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import handleAdminAuth from './api/admin-auth.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 10000);
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || dummyKey;
const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

const CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.onrender.com https://docs.google.com https://drive.google.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';";

// In-memory sliding-window rate limiter (10 requests per minute)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(key) {
  const now = Date.now();
  const windowData = rateLimitMap.get(key) || [];
  const recent = windowData.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  recent.push(now);
  rateLimitMap.set(key, recent);
  if (rateLimitMap.size > 500) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.every(ts => now - ts >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitMap.delete(k);
      }
    }
  }
  return true;
}

async function verifyExtractionAccess(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { authorized: false, status: 401, error: 'Authentication token required.' };
  }

  const { data: authUser, error: authUserErr } = await supabaseServer.auth.getUser(token);
  if (authUserErr || !authUser?.user) {
    return { authorized: false, status: 401, error: 'Invalid or expired session token.' };
  }

  const callerUserId = authUser.user.id;
  const { data: callerProfile, error: profileErr } = await supabaseServer
    .from('profiles')
    .select('id, full_name, role, status')
    .eq('id', callerUserId)
    .maybeSingle();

  if (profileErr || !callerProfile) {
    return { authorized: false, status: 403, error: 'User profile not found.' };
  }

  if (callerProfile.status && callerProfile.status !== 'ACTIVE') {
    return { authorized: false, status: 403, error: 'Account is not active.' };
  }

  const role = callerProfile.role;
  if (role !== 'super_admin' && role !== 'hod') {
    return { authorized: false, status: 403, error: 'Unauthorized: Only Super Administrators and HODs can extract timetables with AI.' };
  }

  return { authorized: true, user: authUser.user, profile: callerProfile };
}


// Gemini >= 3.6 Model Policy Enforcement
export function getGeminiModelVersion(modelName) {
  if (!modelName || typeof modelName !== 'string') return 0;
  const match = modelName.match(/gemini-(\d+(?:\.\d+)?)/i);
  if (!match) return 0;
  return parseFloat(match[1]);
}

export function isModelAllowed(modelName) {
  const version = getGeminiModelVersion(modelName);
  return version >= 3.6;
}

const rawPrimary = (process.env.GEMINI_MODEL_PRIMARY || process.env.GEMINI_MODEL || '').trim();
const rawFallback = (process.env.GEMINI_MODEL_FALLBACK || '').trim();

// Validate that configured models are strictly >= 3.6 (forbidden: 3.5, 2.5, 2.x, 1.x)
export const PRIMARY_MODEL = isModelAllowed(rawPrimary) ? rawPrimary : 'gemini-3.8-flash';
export const FALLBACK_MODEL = isModelAllowed(rawFallback) ? rawFallback : 'gemini-3.6-flash';
export const TERTIARY_MODEL = PRIMARY_MODEL === 'gemini-3.7-flash' ? 'gemini-3.8-flash' : 'gemini-3.7-flash';

// All verified stable Gemini >= 3.6 models in order of capability
const ALL_ALLOWED_STABLE_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'];

export const MODEL_CHAIN = Array.from(
  new Set([PRIMARY_MODEL, TERTIARY_MODEL, FALLBACK_MODEL, ...ALL_ALLOWED_STABLE_MODELS].filter(m => m && isModelAllowed(m)))
);

const prompt = `Extract the uploaded college timetable into JSON. Never invent institution-specific values. Read values from the PDF. Extract every visible timetable cell, including lunch/break/activity cells. Preserve exact start/end times. For merged labs spanning multiple periods, emit one entry per actual period. Blank cells produce no entry. Return ONLY JSON with institution_name, program_name, branch_name, academic_year, semester, section_name, effective_from, room_number, class_incharges, subject_mappings, faculty_mappings, schedule, overall_confidence, confidence_breakdown, warnings. Schedule days use MON,TUE,WED,THU,FRI,SAT. Each period contains period_number,start_time,end_time,subject_code,subject_name,faculty_code,faculty_name,room_number,lecture_type,is_break,confidence. Do not invent missing values.`;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
};

// In-memory SHA-256 extraction cache (TTL: 10 minutes, max 50 entries)
const extractionCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;

export function getCachedExtraction(hash) {
  const item = extractionCache.get(hash);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    extractionCache.delete(hash);
    return null;
  }
  return item.data;
}

export function setCachedExtraction(hash, data) {
  if (extractionCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = extractionCache.keys().next().value;
    if (oldestKey) extractionCache.delete(oldestKey);
  }
  extractionCache.set(hash, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearExtractionCache() {
  extractionCache.clear();
}

/**
 * Determine if an error is transient and eligible for retry/fallback
 */
export function isTransientError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (typeof status === 'number' && [429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  const msg = String(err.message || err).toLowerCase();
  // Check non-transient markers first
  if (
    msg.includes('400') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('404') ||
    msg.includes('invalid argument') ||
    msg.includes('api key not valid')
  ) {
    return false;
  }
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('resource_exhausted') ||
    msg.includes('exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('busy') ||
    msg.includes('deadline exceeded') ||
    msg.includes('temporarily') ||
    msg.includes('try again later') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function send(res, status, body, type = 'application/json; charset=utf-8', extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) throw new Error('Request payload exceeds maximum allowed size (10MB).');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}


/**
 * Executes AI timetable extraction with controlled retry, exponential backoff, and model fallback
 */
export async function extractWithRetryAndFallback(base64Data, customAiInstance = null) {
  if (!apiKey && !customAiInstance) {
    return {
      success: false,
      status: 503,
      code: 'AI_NOT_CONFIGURED',
      error: 'AI timetable extraction is not configured on the server. Please set GEMINI_API_KEY in the server environment.',
    };
  }

  const ai = customAiInstance || new GoogleGenAI({ apiKey });
  let lastError = null;

  for (let modelIdx = 0; modelIdx < MODEL_CHAIN.length; modelIdx++) {
    const model = MODEL_CHAIN[modelIdx];
    const maxRetries = 1; // 2 attempts per model (initial + 1 retry) to prevent prolonged hangs

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const reqId = crypto.randomUUID().slice(0, 8);
      const startTime = Date.now();
      try {
        console.log(`[AI Gateway] [${reqId}] Attempt ${attempt + 1}/${maxRetries + 1} using verified Gemini >= 3.6 model: ${model}`);

        // Set bounded timeout (30 seconds per attempt)
        const responsePromise = ai.models.generateContent({
          model,
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: base64Data } },
              { text: prompt }
            ]
          }],
          config: { responseMimeType: 'application/json', temperature: 0 }
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI request timeout exceeded (30s)')), 30000)
        );

        const response = await Promise.race([responsePromise, timeoutPromise]);
        const latencyMs = Date.now() - startTime;
        const rawText = (response?.text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

        if (!rawText) {
          throw new Error('Gemini returned empty timetable response.');
        }

        const parsed = JSON.parse(rawText);
        console.log(`[AI Gateway] [${reqId}] Success with model ${model} in ${latencyMs}ms`);
        return { success: true, data: parsed, model, latencyMs };
      } catch (err) {
        const latencyMs = Date.now() - startTime;
        lastError = err;
        const isTransient = isTransientError(err);
        console.warn(`[AI Gateway] [${reqId}] Attempt ${attempt + 1} failed with ${model} in ${latencyMs}ms. Transient: ${isTransient}. Reason: ${err.message}`);

        // Non-transient errors (like 404 Model Not Found) -> advance immediately to fallback model
        if (!isTransient) {
          if (String(err.message).includes('404') || String(err.message).toLowerCase().includes('not found')) {
            console.warn(`[AI Gateway] Model ${model} returned 404/not-found. Advancing to fallback model immediately.`);
            break;
          }
          return {
            success: false,
            status: 400,
            code: 'INVALID_REQUEST',
            error: 'Unable to process timetable PDF. Please check the document format or use CSV import.',
            details: 'The document format could not be parsed as a structured timetable.',
          };
        }

        // Transient error (503, 429, etc.): backoff if retries remain for this model
        if (attempt < maxRetries) {
          const waitTimeMs = (attempt + 1) * 1000;
          console.log(`[AI Gateway] Backing off for ${waitTimeMs}ms before retrying ${model}...`);
          await sleep(waitTimeMs);
        }
      }
    }
    console.warn(`[AI Gateway] Model ${model} exhausted all attempts. Trying next fallback model in chain...`);
  }

  // All models and retries exhausted
  return {
    success: false,
    status: 503,
    code: 'AI_PROVIDER_UNAVAILABLE',
    error: 'AI timetable extraction is temporarily unavailable. Your existing timetable has not been changed. Please retry or use CSV import.',
    details: 'All verified Gemini >= 3.6 model endpoints are temporarily experiencing high demand.',
  };
}

async function handleExtract(req, res) {
  const authCheck = await verifyExtractionAccess(req);
  if (!authCheck.authorized) {
    return send(res, authCheck.status || 401, {
      code: 'UNAUTHORIZED',
      error: authCheck.error || 'Authentication required to access timetable AI extraction.',
    });
  }

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const rateLimitKey = `${authCheck.user.id}-${clientIp}`;
  if (!checkRateLimit(rateLimitKey)) {
    return send(res, 429, {
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Rate limit exceeded for AI extraction (maximum 10 requests per minute). Please try again shortly.',
    });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return send(res, 400, { code: 'INVALID_BODY', error: err.message || 'Invalid JSON request payload.' });
  }


  if (typeof body?.data !== 'string' || !body.data.trim()) {
    return send(res, 400, { code: 'PDF_REQUIRED', error: 'PDF data is required.' });
  }

  // Quick PDF header sanity check
  const headerBuf = Buffer.from(body.data.slice(0, 32), 'base64');
  if (!headerBuf.toString('ascii').startsWith('%PDF-')) {
    return send(res, 400, { code: 'INVALID_PDF', error: 'Uploaded file is not a valid PDF document.' });
  }

  // Check SHA-256 cache to prevent duplicate AI calls on rapid re-attempts
  const hash = crypto.createHash('sha256').update(body.data).digest('hex');
  const cached = getCachedExtraction(hash);
  if (cached) {
    console.log(`[AI Gateway] Serving cached extraction for hash: ${hash.slice(0, 12)}...`);
    return send(res, 200, cached);
  }

  const result = await extractWithRetryAndFallback(body.data);

  if (!result.success) {
    return send(res, result.status || 503, {
      code: result.code || 'AI_EXTRACTION_FAILED',
      error: result.error || 'AI timetable extraction failed.',
    });
  }

  // Cache successful result
  setCachedExtraction(hash, result.data);

  return send(res, 200, result.data);
}

function handleHealth(req, res) {
  return send(res, 200, {
    status: 'ok',
    ai: {
      configured: Boolean(apiKey),
      primaryModel: PRIMARY_MODEL,
      fallbackModel: FALLBACK_MODEL,
      availableModels: MODEL_CHAIN,
      minRequiredVersion: '3.6',
    },
    serverTime: new Date().toISOString(),
  });
}

// In-memory compression cache for static assets to eliminate CPU latency and threadpool exhaustion
const staticCompressedCache = new Map();

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (pathname === '/') pathname = '/index.html';
  const requested = path.resolve(dist, `.${pathname}`);
  if (!requested.startsWith(dist + path.sep)) return send(res, 403, { error: 'Forbidden' });

  let file = requested;
  let isIndexHtml = false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(dist, 'index.html');
    isIndexHtml = true;
  }
  if (!fs.existsSync(file)) return send(res, 503, { error: 'Build output is missing.' });

  const ext = path.extname(file).toLowerCase();
  if (file.endsWith('index.html')) isIndexHtml = true;

  const headers = {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    ...SECURITY_HEADERS,
  };

  if (isIndexHtml) {
    headers['Cache-Control'] = 'no-cache, must-revalidate';
    headers['Content-Security-Policy'] = CSP_HEADER;
  } else if (pathname.startsWith('/assets/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'public, max-age=86400, stale-while-revalidate=604800';
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    return res.end();
  }

  const compressible = ext === '.html' || ext === '.js' || ext === '.mjs' || ext === '.css' || ext === '.json' || ext === '.svg' || ext === '.txt' || ext === '.xml';
  const acceptEncoding = req.headers['accept-encoding'] || '';

  const encoding = (compressible && acceptEncoding.includes('br')) ? 'br'
    : (compressible && acceptEncoding.includes('gzip')) ? 'gzip'
    : null;

  if (!encoding) {
    res.writeHead(200, headers);
    return fs.createReadStream(file).pipe(res);
  }

  // Fast path: In-memory cache hit (<0.1ms delivery)
  const cacheKey = `${file}:${encoding}`;
  const cached = staticCompressedCache.get(cacheKey);
  if (cached) {
    headers['Content-Encoding'] = encoding;
    headers['Content-Length'] = cached.length;
    res.writeHead(200, headers);
    return res.end(cached);
  }

  // Asynchronous compression with optimal Brotli Q4 (9ms vs 1002ms)
  fs.readFile(file, (readErr, fileBuf) => {
    if (readErr) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Error reading static file.');
    }

    if (encoding === 'br') {
      zlib.brotliCompress(fileBuf, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        },
      }, (compErr, compressedBuf) => {
        if (compErr || !compressedBuf) {
          res.writeHead(200, headers);
          return res.end(fileBuf);
        }
        staticCompressedCache.set(cacheKey, compressedBuf);
        headers['Content-Encoding'] = 'br';
        headers['Content-Length'] = compressedBuf.length;
        res.writeHead(200, headers);
        res.end(compressedBuf);
      });
    } else {
      zlib.gzip(fileBuf, (compErr, compressedBuf) => {
        if (compErr || !compressedBuf) {
          res.writeHead(200, headers);
          return res.end(fileBuf);
        }
        staticCompressedCache.set(cacheKey, compressedBuf);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = compressedBuf.length;
        res.writeHead(200, headers);
        res.end(compressedBuf);
      });
    }
  });
}

/**
 * Validates URLs against SSRF policies, restricting to Google Sheets and Drive domains
 */
export function validateUrlForCsv(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    return { valid: false, error: 'Invalid URL format.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'URL must begin with http:// or https://' };
  }
  const host = parsed.hostname.toLowerCase();
  const isAllowedHost = host === 'docs.google.com' || host === 'drive.google.com' || host.endsWith('.google.com');
  if (!isAllowedHost) {
    return {
      valid: false,
      error: 'Only Google Sheets (docs.google.com) and Google Drive (drive.google.com) URLs are permitted.',
    };
  }
  return { valid: true, parsedUrl: parsed, host };
}

/**
 * Classifies Google URL and constructs canonical CSV export or download URL
 */
export function processGoogleUrl(rawUrl) {
  const clean = rawUrl.trim();

  // Match Google Sheets
  const sheetMatch = clean.match(/https?:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9-_]+)/i);
  if (sheetMatch) {
    const spreadsheetId = sheetMatch[1];
    let gid = '';
    const gidMatch = clean.match(/[#?&]gid=([0-9]+)/i);
    if (gidMatch) gid = gidMatch[1];

    if (clean.includes('/export?format=csv') || clean.includes('/pub?output=csv') || clean.includes('/pub?format=csv')) {
      return { type: 'google_sheet', exportUrl: clean };
    }
    return {
      type: 'google_sheet',
      exportUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`
    };
  }

  // Match Google Drive file links
  const driveMatch = clean.match(/https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([a-zA-Z0-9-_]+)/i);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return {
      type: 'google_drive',
      fileId,
      exportUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
    };
  }

  return { type: 'unknown', exportUrl: clean };
}

/**
 * Safe server-side fetcher for Google Sheets CSV and Google Drive downloads
 */
export async function fetchCsvServer(rawUrl) {
  const val = validateUrlForCsv(rawUrl);
  if (!val.valid) {
    return { success: false, status: 400, code: 'INVALID_URL', error: val.error };
  }

  const processed = processGoogleUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(processed.exportUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VCTM-ERP-System/2.0 (Academic Timetable Engine)',
        'Accept': 'text/csv, text/plain, */*',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        status: 403,
        code: 'ACCESS_DENIED',
        error: 'Google Sheet or Drive file could not be accessed. Make sure sharing is set to "Anyone with the link can view".',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        status: 502,
        code: 'FETCH_FAILED',
        error: `HTTP ${response.status}: Failed to fetch document from Google servers.`,
      };
    }

    const text = await response.text();
    const trimmed = text.trim();

    // Check if HTML viewer was returned instead of CSV
    if (
      trimmed.startsWith('<!DOCTYPE html>') ||
      trimmed.includes('<html') ||
      trimmed.includes('accounts.google.com') ||
      trimmed.includes('ServiceLogin')
    ) {
      if (processed.type === 'google_drive') {
        return {
          success: false,
          status: 400,
          code: 'GOOGLE_DRIVE_LINK',
          error: 'This is a Google Drive file link, not a Google Sheet or CSV file. Please provide a Google Sheet link or a direct CSV file.',
        };
      }
      return {
        success: false,
        status: 403,
        code: 'ACCESS_DENIED',
        error: 'Google Sheet could not be accessed. Make sure permissions are set to "Anyone with the link can view", or publish it via File > Share > Publish to web as CSV.',
      };
    }

    if (!trimmed) {
      return {
        success: false,
        status: 400,
        code: 'EMPTY_CSV',
        error: 'The retrieved CSV content is empty.',
      };
    }

    return { success: true, csvText: text };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return {
        success: false,
        status: 504,
        code: 'TIMEOUT',
        error: 'Request to fetch Google Sheet timed out after 15 seconds.',
      };
    }
    return {
      success: false,
      status: 502,
      code: 'NETWORK_ERROR',
      error: `Network error while fetching Google document: ${err.message}`,
    };
  }
}

async function handleCsvPost(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return send(res, 400, { code: 'INVALID_BODY', error: 'Invalid JSON request payload.' });
  }

  if (typeof body?.url !== 'string' || !body.url.trim()) {
    return send(res, 400, { code: 'URL_REQUIRED', error: 'CSV URL is required.' });
  }

  const result = await fetchCsvServer(body.url);
  if (!result.success) {
    return send(res, result.status || 502, {
      code: result.code || 'CSV_FETCH_FAILED',
      error: result.error || 'Failed to retrieve CSV content.',
    });
  }

  return send(res, 200, { success: true, csvText: result.csvText });
}

async function handleCsvProxyGet(req, res, urlObj) {
  const targetUrl = urlObj.searchParams.get('url');
  if (!targetUrl) {
    return send(res, 400, { code: 'URL_REQUIRED', error: 'Query parameter "url" is required.' });
  }

  const result = await fetchCsvServer(targetUrl);
  if (!result.success) {
    return send(res, result.status || 502, {
      code: result.code || 'CSV_FETCH_FAILED',
      error: result.error || 'Failed to retrieve CSV content.',
    });
  }

  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(result.csvText);
}

export async function requestHandler(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    if (req.method === 'GET' && (pathname === '/api/timetable/health' || pathname === '/api/health')) {
      return handleHealth(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/timetable/extract') {
      return await handleExtract(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/timetable/csv') {
      return await handleCsvPost(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/proxy-sheet') {
      return await handleCsvProxyGet(req, res, urlObj);
    }
    if (pathname.startsWith('/api/auth/')) {
      return await handleAdminAuth(req, res);
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res);
    }
    return send(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Server error:', error);
    return send(res, 500, { error: error?.message || 'Internal server error.' });
  }
}

export const server = http.createServer(requestHandler);


// Start listener only when executed directly (not when imported in tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(port, '0.0.0.0', () => console.log(`VCTM ERP server listening on ${port}`));
}

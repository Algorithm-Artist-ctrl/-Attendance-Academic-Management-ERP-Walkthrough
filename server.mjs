import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 10000);
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

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

const rawPrimary = process.env.GEMINI_MODEL_PRIMARY || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const rawFallback = process.env.GEMINI_MODEL_FALLBACK || 'gemini-3.6-flash';

// Validate that configured models are strictly >= 3.6 (forbidden: 3.5, 2.5, 2.x, 1.x)
export const PRIMARY_MODEL = isModelAllowed(rawPrimary) ? rawPrimary : 'gemini-3.8-flash';
export const FALLBACK_MODEL = isModelAllowed(rawFallback) ? rawFallback : 'gemini-3.6-flash';
export const TERTIARY_MODEL = 'gemini-3.7-flash';

export const MODEL_CHAIN = Array.from(
  new Set([PRIMARY_MODEL, TERTIARY_MODEL, FALLBACK_MODEL].filter(m => m && isModelAllowed(m)))
);

const prompt = `Extract the uploaded college timetable into JSON. Never invent institution-specific values. Read values from the PDF. Extract every visible timetable cell, including lunch/break/activity cells. Preserve exact start/end times. For merged labs spanning multiple periods, emit one entry per actual period. Blank cells produce no entry. Return ONLY JSON with institution_name, program_name, branch_name, academic_year, semester, section_name, effective_from, room_number, class_incharges, subject_mappings, faculty_mappings, schedule, overall_confidence, confidence_breakdown, warnings. Schedule days use MON,TUE,WED,THU,FRI,SAT. Each period contains period_number,start_time,end_time,subject_code,subject_name,faculty_code,faculty_name,room_number,lecture_type,is_break,confidence. Do not invent missing values.`;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
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

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 25 * 1024 * 1024) throw new Error('Request is too large.');
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
    const maxRetries = 2; // Up to 3 attempts per model: initial, +1s backoff, +2s backoff

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
            details: err.message,
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
    console.warn(`[AI Gateway] Model ${model} exhausted all attempts. Trying next fallback model...`);
  }

  // All models and retries exhausted
  return {
    success: false,
    status: 503,
    code: 'AI_PROVIDER_UNAVAILABLE',
    error: 'AI timetable extraction is temporarily unavailable. Your existing timetable has not been changed. Please retry or use CSV import.',
    details: lastError?.message,
  };
}

async function handleExtract(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return send(res, 400, { code: 'INVALID_BODY', error: 'Invalid JSON request payload.' });
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

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (pathname === '/') pathname = '/index.html';
  const requested = path.resolve(dist, `.${pathname}`);
  if (!requested.startsWith(dist + path.sep)) return send(res, 403, { error: 'Forbidden' });

  let file = requested;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(dist, 'index.html');
  if (!fs.existsSync(file)) return send(res, 503, { error: 'Build output is missing.' });

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

export const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/api/timetable/health' || req.url === '/api/health')) {
      return handleHealth(req, res);
    }
    if (req.method === 'POST' && req.url === '/api/timetable/extract') {
      return await handleExtract(req, res);
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res);
    }
    return send(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Server error:', error);
    return send(res, 500, { error: error?.message || 'Internal server error.' });
  }
});

// Start listener only when executed directly (not when imported in tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(port, '0.0.0.0', () => console.log(`VCTM ERP server listening on ${port}`));
}

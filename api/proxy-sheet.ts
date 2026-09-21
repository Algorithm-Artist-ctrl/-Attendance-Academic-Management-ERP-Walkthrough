/**
 * Normalizes Google Sheet URLs into direct CSV export URLs
 */
function normalizeSheetUrl(rawUrl: string): string {
  const clean = rawUrl.trim();
  const match = clean.match(/https?:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9-_]+)/i);
  if (!match) return clean;

  const spreadsheetId = match[1];
  if (clean.includes('/pub?output=csv') || clean.includes('/pub?format=csv')) {
    return clean;
  }

  let gid: string | undefined;
  const gidHashMatch = clean.match(/#gid=([0-9]+)/i);
  const gidQueryMatch = clean.match(/[?&]gid=([0-9]+)/i);
  if (gidHashMatch) gid = gidHashMatch[1];
  else if (gidQueryMatch) gid = gidQueryMatch[1];

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

/**
 * SSRF security validation — strictly restricted to Google domains
 */
function validateSafePublicUrl(urlStr: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'URL must begin with http:// or https://' };
  }

  const host = parsed.hostname.toLowerCase();
  const isAllowedHost = host === 'docs.google.com' || host === 'drive.google.com' || host === 'spreadsheets.google.com' || host.endsWith('.google.com');

  if (!isAllowedHost) {
    return { valid: false, error: 'Only Google Sheets and Google Drive documents are permitted.' };
  }

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.corp')
  ) {
    return { valid: false, error: 'Access to internal or loopback addresses is restricted.' };
  }

  return { valid: true };
}

function getAllowedOrigin(req: any): string {
  const origin = req.headers?.origin || req.headers?.Origin || '';
  if (!origin) return '';
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.onrender.com') ||
      host.endsWith('.vctm.in')
    ) {
      return origin;
    }
  } catch {}
  return '';
}

/**
 * Serverless / Node Request Handler for Google Sheet & CSV Proxy
 */
export default async function handler(req: any, res: any) {
  const allowedOrigin = getAllowedOrigin(req);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Extract target URL from query parameters or body
  let targetUrl: string | undefined;
  if (req.query && req.query.url) {
    targetUrl = String(req.query.url);
  } else if (req.url && req.url.includes('url=')) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      targetUrl = parsedUrl.searchParams.get('url') || undefined;
    } catch {}
  }

  if (!targetUrl && req.body) {
    targetUrl = typeof req.body === 'string' ? JSON.parse(req.body).url : req.body.url;
  }

  if (!targetUrl || !targetUrl.trim()) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing required "url" parameter.' }));
    return;
  }

  const normalizedUrl = normalizeSheetUrl(targetUrl);
  const safety = validateSafePublicUrl(normalizedUrl);
  if (!safety.valid) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: safety.error }));
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VCTM-ERP-System/2.0 (Academic College Management; https://vctm.in)',
        'Accept': 'text/csv, text/plain, */*',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (response.status === 401 || response.status === 403) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Google Sheet is not publicly accessible. Please set sharing permissions to "Anyone with the link can view", or publish via File > Share > Publish to web as CSV.'
      }));
      return;
    }

    if (!response.ok) {
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Remote server responded with HTTP ${response.status} ${response.statusText}` }));
      return;
    }

    const text = await response.text();
    const trimmed = text.trim();

    // Detect Google accounts login HTML page
    if (
      trimmed.startsWith('<!DOCTYPE html>') ||
      trimmed.includes('<html') ||
      trimmed.includes('accounts.google.com') ||
      trimmed.includes('ServiceLogin')
    ) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Google Sheet is not publicly accessible. Please set sharing permissions to "Anyone with the link can view", or publish via File > Share > Publish to web as CSV.'
      }));
      return;
    }

    if (!trimmed) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'The retrieved CSV content is empty.' }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(text);
  } catch (err: any) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: `Failed to fetch CSV: ${err.name === 'AbortError' ? 'Request timed out after 15 seconds' : err.message}`
    }));
  }
}

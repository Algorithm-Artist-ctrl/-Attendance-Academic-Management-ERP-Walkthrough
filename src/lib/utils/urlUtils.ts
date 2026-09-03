/**
 * URL Utilities for Google Sheet synchronization, SSRF safety, and CSV fetching
 */

/**
 * Normalizes a Google Sheet URL into a direct CSV export URL.
 * Supports:
 * - Direct CSV links
 * - Standard edit URLs: https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
 * - Sharing URLs: https://docs.google.com/spreadsheets/d/{ID}/edit?usp=sharing
 * - Published web URLs: https://docs.google.com/spreadsheets/d/{ID}/pub?output=csv
 */
export function normalizeGoogleSheetUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) return '';

  // Check if it is a Google Sheets URL
  const googleSheetMatch = url.match(/https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (!googleSheetMatch) {
    return url;
  }

  const sheetId = googleSheetMatch[1];

  // Already a published or export CSV URL
  if (url.includes('/export?format=csv') || url.includes('/pub?output=csv')) {
    return url;
  }

  // Extract GID (sheet tab ID) from query or hash
  let gid = '';
  const gidHashMatch = url.match(/#gid=([0-9]+)/i);
  const gidQueryMatch = url.match(/[?&]gid=([0-9]+)/i);

  if (gidHashMatch) {
    gid = gidHashMatch[1];
  } else if (gidQueryMatch) {
    gid = gidQueryMatch[1];
  }

  // Construct direct CSV export URL
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  return exportUrl;
}

/**
 * Validates that a URL is a safe, public HTTP/HTTPS URL and not an internal network loopback (SSRF defense)
 */
export function validateSafePublicUrl(urlStr: string): { valid: boolean; error?: string } {
  const clean = urlStr.trim();
  if (!clean) {
    return { valid: false, error: 'URL cannot be empty.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'URL must begin with http:// or https://' };
  }

  const host = parsed.hostname.toLowerCase();

  // Forbidden local / internal hosts
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.corp')
  ) {
    return { valid: false, error: 'Access to internal or loopback network addresses is restricted for security.' };
  }

  // Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const octet1 = parseInt(ipv4Match[1], 10);
    const octet2 = parseInt(ipv4Match[2], 10);

    if (
      octet1 === 10 || // 10.0.0.0/8
      (octet1 === 172 && octet2 >= 16 && octet2 <= 31) || // 172.16.0.0/12
      (octet1 === 192 && octet2 === 168) || // 192.168.0.0/16
      (octet1 === 169 && octet2 === 254) // 169.254.0.0/16 (link-local & AWS/GCP metadata)
    ) {
      return { valid: false, error: 'Access to private or metadata IP ranges is restricted for security.' };
    }
  }

  return { valid: true };
}

/**
 * Fetches remote CSV text with automatic Google Sheets normalization, timeout control, and security validation.
 */
export async function fetchCSVContent(rawUrl: string, timeoutMs: number = 15000): Promise<string> {
  const normalizedUrl = normalizeGoogleSheetUrl(rawUrl);
  const safety = validateSafePublicUrl(normalizedUrl);
  if (!safety.valid) {
    throw new Error(safety.error || 'Invalid URL');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/csv, text/plain, application/json, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} — Failed to fetch CSV from source URL.`);
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('The retrieved CSV content is empty.');
    }

    return text;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Connection timed out while fetching CSV (limit: ${timeoutMs / 1000}s). Please verify the link is publicly accessible.`);
    }
    throw new Error(`Failed to fetch CSV: ${err.message}`);
  }
}

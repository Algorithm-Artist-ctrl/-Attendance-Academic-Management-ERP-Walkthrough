/**
 * URL Utilities for Google Sheet synchronization, SSRF safety, and CSV fetching
 */

export interface ParsedGoogleSheetInfo {
  isGoogleSheet: boolean;
  spreadsheetId?: string;
  gid?: string;
  exportCsvUrl?: string;
  gvizCsvUrl?: string;
}

/**
 * Robustly parses any Google Sheet sharing, edit, or publish URL into its components:
 * - spreadsheetId
 * - gid (sheet tab)
 * - canonical CSV export URL
 * - Google Visualization CSV URL
 */
export function parseGoogleSheetUrl(rawUrl: string): ParsedGoogleSheetInfo {
  const url = rawUrl.trim();
  if (!url) return { isGoogleSheet: false };

  // Match Google Sheets URL patterns:
  // - https://docs.google.com/spreadsheets/d/{ID}/...
  // - https://docs.google.com/spreadsheets/u/{N}/d/{ID}/...
  // - https://docs.google.com/spreadsheets/d/e/{ID}/...
  const match = url.match(/https?:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9-_]+)/i);
  if (!match) {
    return { isGoogleSheet: false };
  }

  const spreadsheetId = match[1];

  // Already a published web CSV URL (e.g. /pub?output=csv)
  if (url.includes('/pub?output=csv') || url.includes('/pub?format=csv')) {
    return {
      isGoogleSheet: true,
      spreadsheetId,
      exportCsvUrl: url,
      gvizCsvUrl: url,
    };
  }

  // Extract GID (tab ID) from hash (#gid=...) or query param (?gid=... or &gid=...)
  let gid: string | undefined;
  const gidHashMatch = url.match(/#gid=([0-9]+)/i);
  const gidQueryMatch = url.match(/[?&]gid=([0-9]+)/i);

  if (gidHashMatch) {
    gid = gidHashMatch[1];
  } else if (gidQueryMatch) {
    gid = gidQueryMatch[1];
  }

  // Construct direct CSV export URL
  const exportCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  // Construct Google Visualization API CSV endpoint
  const gvizCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;

  return {
    isGoogleSheet: true,
    spreadsheetId,
    gid,
    exportCsvUrl,
    gvizCsvUrl,
  };
}

/**
 * Normalizes a Google Sheet URL into a direct CSV export URL.
 */
export function normalizeGoogleSheetUrl(rawUrl: string): string {
  const parsed = parseGoogleSheetUrl(rawUrl);
  if (parsed.isGoogleSheet && parsed.exportCsvUrl) {
    return parsed.exportCsvUrl;
  }
  return rawUrl.trim();
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
 * Fetches remote CSV text with automatic Google Sheets normalization, timeout control,
 * internal serverless proxy routing to avoid CORS / 401 issues, and actionable error diagnostics.
 */
export async function fetchCSVContent(rawUrl: string, timeoutMs: number = 15000): Promise<string> {
  const cleanUrl = rawUrl.trim();
  if (!cleanUrl) {
    throw new Error('CSV URL cannot be empty.');
  }

  const parsedSheet = parseGoogleSheetUrl(cleanUrl);
  const primaryUrl = parsedSheet.isGoogleSheet ? (parsedSheet.exportCsvUrl || cleanUrl) : cleanUrl;

  const safety = validateSafePublicUrl(primaryUrl);
  if (!safety.valid) {
    throw new Error(safety.error || 'Invalid URL');
  }

  // 1. In browser environment: Route through internal backend proxy /api/proxy-sheet
  if (typeof window !== 'undefined') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const proxyUrl = `/api/proxy-sheet?url=${encodeURIComponent(cleanUrl)}`;
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/plain, text/csv, application/json, */*',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || contentType.includes('application/json')) {
        const errJson = await response.json().catch(() => null);
        if (errJson && errJson.error) {
          throw new Error(errJson.error);
        }
        throw new Error(`HTTP ${response.status}: Failed to fetch CSV via proxy`);
      }

      const text = await response.text();
      if (!text || text.trim().length === 0) {
        throw new Error('The retrieved CSV content is empty.');
      }
      return text;
    } catch (proxyErr: any) {
      // If explicit permissions error returned from proxy, rethrow immediately
      if (proxyErr.message && (
        proxyErr.message.includes('permissions are set to') ||
        proxyErr.message.includes('not publicly accessible')
      )) {
        throw proxyErr;
      }
      console.warn('Internal proxy attempt failed, trying fallback candidates:', proxyErr.message);
    }
  }

  // 2. Fallback / Server-side candidate URLs (Node scripts or direct fetch)
  const candidateUrls: string[] = [primaryUrl];
  if (parsedSheet.isGoogleSheet && parsedSheet.gvizCsvUrl && parsedSheet.gvizCsvUrl !== primaryUrl) {
    candidateUrls.push(parsedSheet.gvizCsvUrl);
  }

  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'VCTM-ERP-System/2.0',
          Accept: 'text/csv, text/plain, */*',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Google Sheet could not be accessed. Make sure the sheet permissions are set to "Anyone with the link can view", or publish it via File > Share > Publish to web as CSV.'
        );
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      const trimmed = text.trim();

      if (
        trimmed.startsWith('<!DOCTYPE html>') ||
        trimmed.includes('<html') ||
        trimmed.includes('accounts.google.com') ||
        trimmed.includes('ServiceLogin')
      ) {
        throw new Error(
          'Google Sheet could not be accessed. Make sure the sheet permissions are set to "Anyone with the link can view", or publish it via File > Share > Publish to web as CSV.'
        );
      }

      if (!trimmed) {
        throw new Error('The retrieved CSV content is empty.');
      }

      return text;
    } catch (err: any) {
      lastError = err;
      if (err.message && (err.message.includes('permissions are set to') || err.message.includes('not publicly accessible'))) {
        throw err;
      }
    }
  }

  if (parsedSheet.isGoogleSheet) {
    throw new Error(
      'Google Sheet could not be accessed. Make sure the sheet is published or accessible to the ERP.'
    );
  }

  throw new Error(`Failed to fetch CSV: ${lastError?.message || 'Network connection failed'}`);
}

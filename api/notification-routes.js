import { 
  dispatchNotificationEmails, 
  fetchNotificationsForDelivery,
  dispatchNotificationEmailsByReference,
  sweepPendingNotificationEmails 
} from './email-service.js';
import { createClient } from '@supabase/supabase-js';

const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || dummyKey;
const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAllowedOrigin(req) {
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

function sendResponse(res, status, body, req) {
  const origin = getAllowedOrigin(req);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('Request payload exceeds 1MB limit.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function authenticateRequest(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { authenticated: false, status: 401, error: 'Authentication token required.' };
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY.trim()) {
    return { authenticated: true, user: { id: '00000000-0000-0000-0000-000000000000', role: 'service_role' } };
  }

  const { data: authUser, error: authUserErr } = await supabaseServer.auth.getUser(token);
  if (authUserErr || !authUser?.user) {
    return { authenticated: false, status: 401, error: 'Invalid or expired session token.' };
  }

  return { authenticated: true, user: authUser.user };
}

export async function handleNotificationRoutes(req, res, urlObj) {
  const origin = getAllowedOrigin(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  const pathname = urlObj.pathname;

  // 1. Dispatch notification email(s) asynchronously
  if (req.method === 'POST' && pathname === '/api/notifications/dispatch-email') {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return sendResponse(res, auth.status || 401, { error: auth.error }, req);
    }

    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return sendResponse(res, 400, { error: 'Invalid JSON body: ' + err.message }, req);
    }

    // Check if dispatching by entity reference (e.g. leave_application, attendance_claim)
    if (body?.reference_type && body?.reference_id) {
      sendResponse(res, 202, {
        success: true,
        message: 'Reference-based email dispatch accepted for asynchronous processing.',
        reference_type: body.reference_type,
        reference_id: body.reference_id,
      }, req);

      setImmediate(async () => {
        try {
          const result = await dispatchNotificationEmailsByReference(body.reference_type, body.reference_id);
          console.log(`[Email Route] Dispatched emails by reference (${body.reference_type} ${body.reference_id}):`, result);
        } catch (err) {
          console.error('[Email Route Error]:', err?.message || err);
        }
      });
      return;
    }

    // Check if triggering pending sweep
    if (body?.pending_sweep) {
      sendResponse(res, 202, {
        success: true,
        message: 'Pending email sweep accepted for asynchronous processing.',
      }, req);

      setImmediate(async () => {
        try {
          const result = await sweepPendingNotificationEmails(50);
          console.log('[Email Route] Pending email sweep completed:', result);
        } catch (err) {
          console.error('[Email Route Error]:', err?.message || err);
        }
      });
      return;
    }

    const rawIds = Array.isArray(body?.notification_ids) 
      ? body.notification_ids 
      : (body?.notification_id ? [body.notification_id] : []);

    const validIds = rawIds.filter(id => typeof id === 'string' && UUID_REGEX.test(id.trim())).map(id => id.trim());

    if (validIds.length === 0) {
      return sendResponse(res, 400, { error: 'No valid notification IDs or references provided.' }, req);
    }

    const boundedIds = validIds.slice(0, 100);

    // Return 202 Accepted immediately to the client to guarantee ZERO latency overhead
    sendResponse(res, 202, {
      success: true,
      message: 'Notification email dispatch accepted for asynchronous processing.',
      count: boundedIds.length,
    }, req);

    // Execute email resolution and dispatch asynchronously in the background
    setImmediate(async () => {
      try {
        const result = await dispatchNotificationEmails(boundedIds);
        console.log(`[Email Route] Asynchronous dispatch completed for ${boundedIds.length} notifications:`, result);
      } catch (dispatchErr) {
        console.error('[Email Route Error]:', dispatchErr?.message || dispatchErr);
      }
    });

    return;
  }

  // 2. Query delivery status for a notification
  if (req.method === 'GET' && pathname === '/api/notifications/delivery-status') {
    const auth = await authenticateRequest(req);
    if (!auth.authenticated) {
      return sendResponse(res, auth.status || 401, { error: auth.error }, req);
    }

    const notifId = urlObj.searchParams.get('id');
    if (!notifId || !UUID_REGEX.test(notifId.trim())) {
      return sendResponse(res, 400, { error: 'Valid notification id query parameter required.' }, req);
    }

    const details = await fetchNotificationsForDelivery([notifId.trim()]);
    if (!details || details.length === 0) {
      return sendResponse(res, 404, { error: 'Notification not found.' }, req);
    }

    const row = details[0];
    return sendResponse(res, 200, {
      notification_id: row.notification_id || row.id,
      email_status: row.email_status || 'pending',
      recipient_role: row.recipient_role,
      recipient_name: row.recipient_name,
      can_send: row.can_send,
      skip_reason: row.skip_reason,
    }, req);
  }

  return sendResponse(res, 404, { error: 'Notification route not found.' }, req);
}

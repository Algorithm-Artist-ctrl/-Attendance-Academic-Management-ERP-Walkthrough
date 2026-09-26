import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import fs from 'node:fs';

// Auto-load .env in Node/development environments if process.env.DATABASE_URL is not already set
if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  try {
    for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {}
}

const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || dummyKey;

const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const supabaseRpc = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pgPool = null;
export function getPgPool() {
  if (pgPool) return pgPool;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const { Pool } = pg;
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
    pgPool.on('error', (err) => {
      console.warn('[Email DB Pool] Warning:', err?.message || err);
    });
    return pgPool;
  } catch (err) {
    console.warn('[Email DB Pool] pg initialization notice:', err?.message || err);
    return null;
  }
}

/**
 * Clean sanitization of text to prevent HTML injection in emails
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Dynamic subject generator based on notification type and title
 */
export function getSubjectForNotification(notificationType, rawTitle) {
  const typeMap = {
    LEAVE_APPLICATION_SUBMITTED: 'New Leave Application',
    LEAVE_FORWARDED_HOD: 'Leave Application Forwarded',
    LEAVE_APPROVED: 'Leave Application Approved',
    LEAVE_REJECTED: 'Leave Application Rejected',
    NOTICE: 'New Notice',
    ATTENDANCE_CLAIM: 'Correction Request',
    ATTENDANCE_UPDATE: 'Attendance Update',
    NEW_MESSAGE: 'New Direct Message',
    TIMETABLE_UPDATE: 'Timetable Update',
    ACCOUNT_UPDATE: 'Account Update',
  };

  const prefix = typeMap[(notificationType || '').toUpperCase()];
  const cleanTitle = (rawTitle || '')
    .replace(/^VCTM ERP\s*[-—:]\s*/i, '')
    .trim();

  if (prefix) {
    if (cleanTitle && !cleanTitle.toLowerCase().includes(prefix.toLowerCase())) {
      return `VCTM ERP — ${prefix}: ${cleanTitle}`;
    }
    return `VCTM ERP — ${cleanTitle || prefix}`;
  }

  return `VCTM ERP — ${cleanTitle || 'Notification'}`;
}

/**
 * Format notification email payload
 * Strictly Information Only - includes [Open VCTM ERP] link to https://vctmerp.in
 * NO action buttons that bypass the ERP
 */
export function buildNotificationEmail({
  recipientName,
  recipientRole,
  title,
  message,
  notificationType,
}) {
  const cleanName = (recipientName || '').trim();
  const isGenericName = !cleanName || cleanName.toLowerCase().includes('staff') || cleanName.toLowerCase().includes('member');
  const cleanTitle = (title || 'Notification').trim();
  const cleanMessage = (message || 'You have received a new notification in VCTM ERP.').trim();

  const subject = getSubjectForNotification(notificationType, cleanTitle);

  let htmlGreeting = 'Hello,';
  let textGreeting = 'Hello,';
  if (!isGenericName) {
    htmlGreeting = `Hello <strong>${escapeHtml(cleanName)}</strong>,`;
    textGreeting = `Hello ${cleanName},`;
  } else if (recipientRole) {
    const roleMap = {
      faculty: 'Faculty Member',
      hod: 'Head of Department',
      super_admin: 'Administrator',
    };
    const roleLabel = roleMap[recipientRole.toLowerCase()] || 'Campus Member';
    htmlGreeting = `Dear <strong>${escapeHtml(roleLabel)}</strong>,`;
    textGreeting = `Dear ${roleLabel},`;
  } else {
    htmlGreeting = 'Dear <strong>Campus Member</strong>,';
    textGreeting = 'Dear Campus Member,';
  }

  const text = `${textGreeting}

You have received a new notification in VCTM ERP.

--------------------------------------------------
${cleanTitle}
--------------------------------------------------
${cleanMessage}
--------------------------------------------------

Please open VCTM ERP to view the complete details and take any required action:
https://vctmerp.in

This is an automated notification from VCTM ERP. Please do not reply directly to this email.
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Institutional Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 28px; border-bottom: 3px solid #2563eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">
                      VCTM ERP
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                      Vivekananda College of Technology & Management, Aligarh
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notification Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
                ${htmlGreeting}
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
                You have received a new notification in VCTM ERP.
              </p>

              <!-- Notification Card -->
              <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
                  ${escapeHtml(cleanTitle)}
                </div>
                <div style="font-size: 14px; color: #334155; white-space: pre-wrap; word-break: break-word; line-height: 1.6;">
                  ${escapeHtml(cleanMessage)}
                </div>
              </div>

              <!-- Information-Only Notice -->
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #475569; text-align: center;">
                Please open VCTM ERP to view complete details and take any required action.
              </p>

              <!-- Open VCTM ERP Button -->
              <div style="margin: 20px 0 28px 0; text-align: center;">
                <a href="https://vctmerp.in" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 6px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                  Open VCTM ERP
                </a>
              </div>

              <p style="margin: 0; font-size: 12px; color: #94a3b8; font-style: italic; text-align: center;">
                This is an automated notification from VCTM ERP. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

          <!-- Institutional Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                &copy; 2026 Vivekananda College of Technology & Management, Aligarh. All Rights Reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Resolve notifications and candidate recipients from DB
 */
export async function fetchNotificationsForDelivery(notificationIds) {
  if (!notificationIds || notificationIds.length === 0) return [];

  // Try PostgreSQL pooler first (fastest, direct, supports SECURITY DEFINER logic)
  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT * FROM public.get_notifications_for_email_delivery($1::uuid[])`,
        [notificationIds]
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
    } catch (dbErr) {
      console.warn('[Email Service] get_notifications_for_email_delivery RPC query notice:', dbErr.message);
      // Fallback: direct SELECT from notifications + profiles + faculty (STUDENTS STRICTLY EXCLUDED)
      try {
        const fallbackRes = await pool.query(
          `SELECT 
            n.id AS notification_id,
            n.recipient_user_id,
            n.recipient_student_id,
            n.recipient_faculty_id,
            CASE 
              WHEN n.recipient_student_id IS NOT NULL OR LOWER(COALESCE(n.recipient_role, '')) = 'student' OR p.role = 'student' THEN 'student'
              ELSE COALESCE(p.role::text, n.recipient_role, 'faculty')
            END AS recipient_role,
            CASE 
              WHEN n.recipient_student_id IS NOT NULL OR LOWER(COALESCE(n.recipient_role, '')) = 'student' OR p.role = 'student' THEN NULL
              ELSE COALESCE(p.email, f.email, u.email)
            END AS recipient_email,
            CASE 
              WHEN n.recipient_student_id IS NOT NULL OR LOWER(COALESCE(n.recipient_role, '')) = 'student' OR p.role = 'student' THEN 'Student Member'
              ELSE COALESCE(p.full_name, f.full_name, 'VCTM Staff Member')
            END AS recipient_name,
            n.type AS notification_type,
            n.title AS notification_title,
            n.message AS notification_message,
            n.reference_type,
            n.reference_id,
            COALESCE(n.email_status, 'pending') AS email_status,
            CASE 
              WHEN n.email_status = 'sent' THEN false
              WHEN n.recipient_student_id IS NOT NULL OR LOWER(COALESCE(n.recipient_role, '')) = 'student' OR p.role = 'student' THEN false
              WHEN n.recipient_user_id IS NULL AND n.recipient_faculty_id IS NULL THEN false
              WHEN COALESCE(p.email, f.email, u.email) IS NULL THEN false
              ELSE true
            END AS can_send,
            CASE 
              WHEN n.email_status = 'sent' THEN 'ALREADY_SENT'
              WHEN n.recipient_student_id IS NOT NULL OR LOWER(COALESCE(n.recipient_role, '')) = 'student' OR p.role = 'student' THEN 'STUDENT_EMAIL_OUT_OF_SCOPE'
              WHEN n.recipient_user_id IS NULL AND n.recipient_faculty_id IS NULL THEN 'NO_INDIVIDUAL_RECIPIENT_SCOPED'
              WHEN COALESCE(p.email, f.email, u.email) IS NULL THEN 'NO_VALID_REGISTERED_EMAIL'
              ELSE NULL
            END AS skip_reason
          FROM public.notifications n
          LEFT JOIN auth.users u ON u.id = n.recipient_user_id
          LEFT JOIN public.profiles p ON (p.id = n.recipient_user_id OR (n.recipient_faculty_id IS NOT NULL AND p.faculty_id = n.recipient_faculty_id))
          LEFT JOIN public.faculty f ON (f.id = n.recipient_faculty_id OR (n.recipient_user_id IS NOT NULL AND f.auth_user_id = n.recipient_user_id))
          WHERE n.id = ANY($1::uuid[])`,
          [notificationIds]
        );
        return fallbackRes.rows;
      } catch (fbErr) {
        console.warn('[Email Service] Fallback direct query notice:', fbErr.message);
      }
    }
  }

  // Fallback to Supabase RPC
  try {
    const { data, error } = await supabaseRpc.rpc('get_notifications_for_email_delivery', {
      p_notification_ids: notificationIds,
    });
    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (rpcErr) {
    console.warn('[Email Service] Supabase RPC notice:', rpcErr.message);
  }

  return [];
}

/**
 * Record delivery status atomically
 */
export async function recordDelivery({
  notificationId,
  status,
  resendEmailId = null,
  errorMessage = null,
  recipientEmail = null,
  recipientName = null,
  recipientRole = null,
}) {
  if (!notificationId) return;

  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query(
        `SELECT public.record_notification_email_delivery(
          $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text
        )`,
        [
          notificationId,
          status,
          resendEmailId,
          errorMessage,
          recipientEmail,
          recipientName,
          recipientRole,
        ]
      );
      return;
    } catch (dbErr) {
      console.warn('[Email Service] record_notification_email_delivery RPC error:', dbErr.message);
      // Fallback direct update
      try {
        await pool.query(
          `UPDATE public.notifications 
           SET email_status = $1, email_sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE email_sent_at END, email_error = $2
           WHERE id = $3::uuid`,
          [status, errorMessage, notificationId]
        );
      } catch {}
    }
  }

  // Fallback to Supabase RPC
  try {
    await supabaseRpc.rpc('record_notification_email_delivery', {
      p_notification_id: notificationId,
      p_status: status,
      p_resend_email_id: resendEmailId,
      p_error_message: errorMessage,
      p_recipient_email: recipientEmail,
      p_recipient_name: recipientName,
      p_recipient_role: recipientRole,
    });
  } catch (rpcErr) {
    console.warn('[Email Service] Supabase record delivery error:', rpcErr.message);
  }
}

/**
 * Send an email via Resend API
 * Safe, server-side only. Does NOT expose secret key.
 */
export async function sendEmailViaResend({
  to,
  subject,
  html,
  text,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      code: 'NO_API_KEY',
      error: 'RESEND_API_KEY environment variable is not configured.',
    };
  }

  const primaryFromEmail = (process.env.RESEND_FROM_EMAIL || 'VCTM ERP <team@vctmerp.in>').trim();

  // Timeout guard (10 seconds)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    let response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: primaryFromEmail,
        to: [to.trim()],
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    });

    let data = await response.json().catch(() => ({}));

    // If unverified domain error and no explicit RESEND_FROM_EMAIL was configured, retry once with onboarding@resend.dev
    if (!response.ok && response.status === 403 && !process.env.RESEND_FROM_EMAIL && primaryFromEmail !== 'VCTM ERP <onboarding@resend.dev>') {
      console.warn(`[Email Service] Sender ${primaryFromEmail} unverified in Resend, attempting fallback to onboarding@resend.dev...`);
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'VCTM ERP <onboarding@resend.dev>',
          to: [to.trim()],
          subject,
          html,
          text,
        }),
      });
      data = await response.json().catch(() => ({}));
    }

    clearTimeout(timer);

    if (!response.ok) {
      const errMsg = data?.message || `HTTP ${response.status}: Failed to send email via Resend.`;
      return {
        success: false,
        status: response.status,
        code: data?.name || 'RESEND_ERROR',
        error: errMsg,
      };
    }

    return {
      success: true,
      id: data?.id,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      code: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      error: err.name === 'AbortError' ? 'Resend request timed out after 10s.' : err.message,
    };
  }
}

/**
 * Main Asynchronous Email Notification Dispatcher
 * Strictly Recipient-Scoped & Idempotent
 */
export async function dispatchNotificationEmails(notificationIds, options = {}) {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  // Deduplicate notification IDs in incoming batch
  const uniqueIds = Array.from(new Set(notificationIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const candidates = await fetchNotificationsForDelivery(uniqueIds);

    for (const notif of candidates) {
      const notifId = notif.notification_id || notif.id;
      const canSend = Boolean(notif.can_send);
      const recipientEmail = (notif.recipient_email || '').trim();
      const recipientName = notif.recipient_name || 'Campus Member';
      const recipientRole = notif.recipient_role || 'user';

      if (!canSend || !recipientEmail) {
        skipped++;
        const skipReason = notif.skip_reason || 'INELIGIBLE_FOR_EMAIL';
        console.log(`[Email Dispatcher] Skipped notification ${notifId}: ${skipReason}`);
        await recordDelivery({
          notificationId: notifId,
          status: 'skipped',
          errorMessage: skipReason,
          recipientEmail: recipientEmail || 'none',
          recipientName,
          recipientRole,
        });
        continue;
      }

      // Check if Resend is configured
      if (!process.env.RESEND_API_KEY) {
        skipped++;
        console.log(`[Email Dispatcher] Skipped notification ${notifId} to ${recipientEmail}: RESEND_API_KEY not configured.`);
        await recordDelivery({
          notificationId: notifId,
          status: 'skipped',
          errorMessage: 'RESEND_API_KEY_NOT_CONFIGURED',
          recipientEmail,
          recipientName,
          recipientRole,
        });
        continue;
      }

      // Build strictly scoped message
      const { subject, html, text } = buildNotificationEmail({
        recipientName,
        recipientRole,
        title: notif.notification_title || notif.title,
        message: notif.notification_message || notif.message,
        notificationType: notif.notification_type || notif.type,
      });

      // Send to exact recipient ONLY
      const sendResult = await sendEmailViaResend({
        to: recipientEmail,
        subject,
        html,
        text,
      });

      if (sendResult.success) {
        sent++;
        console.log(`[Email Dispatcher] ✅ Email delivered to ${recipientEmail} for notification ${notifId} (Resend ID: ${sendResult.id})`);
        await recordDelivery({
          notificationId: notifId,
          status: 'sent',
          resendEmailId: sendResult.id,
          recipientEmail,
          recipientName,
          recipientRole,
        });
      } else {
        failed++;
        console.warn(`[Email Dispatcher] ⚠️ Failed to send email to ${recipientEmail} for notification ${notifId}: ${sendResult.error}`);
        await recordDelivery({
          notificationId: notifId,
          status: 'failed',
          errorMessage: sendResult.error,
          recipientEmail,
          recipientName,
          recipientRole,
        });
      }
    }
  } catch (err) {
    console.error('[Email Dispatcher Error]:', err?.message || err);
  }

  return { processed: uniqueIds.length, sent, skipped, failed };
}

/**
 * Dispatch pending notification emails by entity reference
 * (e.g., leave_application, attendance_claim, notice, etc.)
 */
export async function dispatchNotificationEmailsByReference(referenceType, referenceId) {
  if (!referenceType || !referenceId) return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  const pool = getPgPool();
  if (!pool) return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  try {
    const res = await pool.query(
      `SELECT id FROM public.notifications 
       WHERE reference_type = $1 AND reference_id = $2 
         AND email_status = 'pending' 
         AND (recipient_role IS NULL OR LOWER(recipient_role) != 'student') 
         AND recipient_student_id IS NULL 
       LIMIT 20;`,
      [referenceType, referenceId]
    );
    const ids = res.rows.map(r => r.id);
    if (ids.length > 0) {
      return await dispatchNotificationEmails(ids);
    }
  } catch (err) {
    console.warn('[Email Service] Query by reference notice:', err?.message || err);
  }
  return { processed: 0, sent: 0, skipped: 0, failed: 0 };
}

/**
 * Sweep any pending notification emails from database
 */
export async function sweepPendingNotificationEmails(limit = 25) {
  const pool = getPgPool();
  if (!pool) return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  try {
    const res = await pool.query(
      `SELECT id FROM public.notifications 
       WHERE email_status = 'pending' 
         AND (recipient_role IS NULL OR LOWER(recipient_role) != 'student') 
         AND recipient_student_id IS NULL 
       ORDER BY created_at ASC 
       LIMIT $1;`,
      [limit]
    );
    const ids = res.rows.map(r => r.id);
    if (ids.length > 0) {
      console.log(`[Email Dispatcher] Found ${ids.length} pending notification emails, dispatching...`);
      return await dispatchNotificationEmails(ids);
    }
  } catch (err) {
    console.warn('[Email Service] Sweep pending error:', err?.message || err);
  }
  return { processed: 0, sent: 0, skipped: 0, failed: 0 };
}

/**
 * Real-time PostgreSQL LISTEN/NOTIFY Background Listener
 * Auto-subscribes to p_notification_created channel.
 * Batches incoming notifications with 300ms debounce and dispatches them asynchronously.
 */
let isListenerActive = false;
let listenerClient = null;
const pendingQueue = new Set();
let debounceTimer = null;

export function initEmailNotificationListener() {
  if (isListenerActive) return;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Email Listener] DATABASE_URL not present, background LISTEN skipped.');
    return;
  }

  isListenerActive = true;

  function flushQueue() {
    if (pendingQueue.size === 0) return;
    const ids = Array.from(pendingQueue);
    pendingQueue.clear();
    dispatchNotificationEmails(ids).catch(err => {
      console.warn('[Email Listener] Batch dispatch notice:', err?.message || err);
    });
  }

  async function startListening() {
    try {
      const { Client } = pg;
      listenerClient = new Client({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      });

      await listenerClient.connect();
      await listenerClient.query('LISTEN p_notification_created');

      listenerClient.on('notification', (msg) => {
        if (msg.channel === 'p_notification_created' && msg.payload) {
          pendingQueue.add(msg.payload.trim());
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(flushQueue, 300);
        }
      });

      listenerClient.on('error', (err) => {
        console.warn('[Email Listener] Connection notice, reconnecting in 5s:', err?.message || err);
        try { listenerClient.end(); } catch {}
        listenerClient = null;
        setTimeout(startListening, 5000);
      });

      listenerClient.on('end', () => {
        listenerClient = null;
        setTimeout(startListening, 5000);
      });

      console.log('[Email Listener] ✅ Connected to PostgreSQL LISTEN p_notification_created');

      // Initial sweep for any pending emails after connecting
      setTimeout(() => {
        sweepPendingNotificationEmails(25).catch(() => {});
      }, 2000);

    } catch (err) {
      console.warn('[Email Listener] Initial connect notice, retrying in 5s:', err?.message || err);
      listenerClient = null;
      setTimeout(startListening, 5000);
    }
  }

  startListening();

  // Periodic backup sweep every 60 seconds to ensure 100% reliability
  setInterval(() => {
    sweepPendingNotificationEmails(25).catch(() => {});
  }, 60000);
}


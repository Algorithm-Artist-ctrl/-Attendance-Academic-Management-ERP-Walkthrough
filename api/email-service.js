import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

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
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = pg;
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
    pgPool.on('error', (err) => {
      console.warn('[Email DB Pool] Warning:', err?.message || err);
    });
  } catch (err) {
    console.warn('[Email DB Pool] pg initialization notice:', err?.message || err);
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
 * Format notification email payload
 * Strictly Information Only - NO action buttons
 */
export function buildNotificationEmail({
  recipientName,
  recipientRole,
  title,
  message,
  notificationType,
}) {
  const cleanName = recipientName || 'Campus Member';
  const cleanTitle = title || 'Notification';
  const cleanMessage = message || 'You have received a new notification.';

  const subject = `VCTM ERP - ${cleanTitle}`;

  const text = `Hello ${cleanName},

You have a new notification in VCTM ERP.

${cleanTitle}

${cleanMessage}

Please open VCTM ERP to view the complete details and take any required action.

This is an automated notification. Please do not reply.
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
                Hello <strong>${escapeHtml(cleanName)}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
                You have a new notification in VCTM ERP.
              </p>

              <!-- Notification Card -->
              <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; border-radius: 6px; padding: 16px 18px; margin-bottom: 24px;">
                <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 6px;">
                  ${escapeHtml(cleanTitle)}
                </div>
                <div style="font-size: 14px; color: #334155; white-space: pre-wrap; word-break: break-word;">
                  ${escapeHtml(cleanMessage)}
                </div>
              </div>

              <!-- Information-Only Notice -->
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #475569;">
                Please open VCTM ERP to view the complete details and take any required action.
              </p>

              <p style="margin: 0; font-size: 12px; color: #94a3b8; font-style: italic;">
                This is an automated notification. Please do not reply.
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
  if (pgPool) {
    try {
      const res = await pgPool.query(
        `SELECT * FROM public.get_notifications_for_email_delivery($1::uuid[])`,
        [notificationIds]
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
    } catch (dbErr) {
      console.warn('[Email Service] get_notifications_for_email_delivery RPC query notice:', dbErr.message);
      // Fallback: direct SELECT from notifications + profiles + faculty + students
      try {
        const fallbackRes = await pgPool.query(
          `SELECT 
            n.id AS notification_id,
            n.recipient_user_id,
            n.recipient_student_id,
            n.recipient_faculty_id,
            COALESCE(p.role::text, n.recipient_role) AS recipient_role,
            COALESCE(p.email, f.email, s.email) AS recipient_email,
            COALESCE(p.full_name, f.full_name, s.full_name, 'Campus Member') AS recipient_name,
            n.type AS notification_type,
            n.title AS notification_title,
            n.message AS notification_message,
            n.reference_type,
            n.reference_id,
            COALESCE(n.email_status, 'pending') AS email_status,
            CASE 
              WHEN n.email_status = 'sent' THEN false
              WHEN n.recipient_user_id IS NULL AND n.recipient_student_id IS NULL AND n.recipient_faculty_id IS NULL THEN false
              WHEN COALESCE(p.email, f.email, s.email) IS NULL THEN false
              ELSE true
            END AS can_send,
            CASE 
              WHEN n.email_status = 'sent' THEN 'ALREADY_SENT'
              WHEN n.recipient_user_id IS NULL AND n.recipient_student_id IS NULL AND n.recipient_faculty_id IS NULL THEN 'NO_INDIVIDUAL_RECIPIENT_SCOPED'
              WHEN COALESCE(p.email, f.email, s.email) IS NULL THEN 'NO_VALID_REGISTERED_EMAIL'
              ELSE NULL
            END AS skip_reason
          FROM public.notifications n
          LEFT JOIN public.profiles p ON (p.id = n.recipient_user_id OR (n.recipient_faculty_id IS NOT NULL AND p.faculty_id = n.recipient_faculty_id) OR (n.recipient_student_id IS NOT NULL AND p.student_id = n.recipient_student_id))
          LEFT JOIN public.faculty f ON (f.id = n.recipient_faculty_id OR (n.recipient_user_id IS NOT NULL AND f.auth_user_id = n.recipient_user_id))
          LEFT JOIN public.students s ON (s.id = n.recipient_student_id OR (n.recipient_user_id IS NOT NULL AND s.auth_user_id = n.recipient_user_id))
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

  if (pgPool) {
    try {
      await pgPool.query(
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
        await pgPool.query(
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

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'VCTM ERP <onboarding@resend.dev>';

  // Timeout guard (10 seconds)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to.trim()],
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await response.json().catch(() => ({}));

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

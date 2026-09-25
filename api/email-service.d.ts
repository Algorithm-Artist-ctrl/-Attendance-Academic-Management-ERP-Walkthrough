export interface NotificationEmailPayload {
  recipientName: string;
  recipientRole?: string;
  title: string;
  message: string;
  notificationType?: string;
}

export interface FormattedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface NotificationDeliveryCandidate {
  notification_id: string;
  recipient_user_id?: string | null;
  recipient_student_id?: string | null;
  recipient_faculty_id?: string | null;
  recipient_role?: string | null;
  recipient_email?: string | null;
  recipient_name?: string | null;
  notification_type: string;
  notification_title: string;
  notification_message: string;
  reference_type?: string | null;
  reference_id?: string | null;
  email_status: 'pending' | 'sent' | 'failed' | 'skipped';
  can_send: boolean;
  skip_reason?: string | null;
}

export interface DeliveryRecordParams {
  notificationId: string;
  status: 'sent' | 'failed' | 'skipped';
  resendEmailId?: string | null;
  errorMessage?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  recipientRole?: string | null;
}

export interface DispatchSummary {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export function buildNotificationEmail(params: NotificationEmailPayload): FormattedEmail;
export function fetchNotificationsForDelivery(notificationIds: string[]): Promise<NotificationDeliveryCandidate[]>;
export function recordDelivery(params: DeliveryRecordParams): Promise<void>;
export function sendEmailViaResend(params: { to: string; subject: string; html: string; text: string }): Promise<{ success: boolean; id?: string; code?: string; error?: string }>;
export function dispatchNotificationEmails(notificationIds: string[], options?: Record<string, any>): Promise<DispatchSummary>;

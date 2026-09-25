-- ==============================================================================
-- Migration 053: Role-Based + Recipient-Scoped Email Notification Delivery
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Enhance public.notifications with email delivery tracking columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'email_status'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN email_status TEXT NOT NULL DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'email_sent_at'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN email_sent_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'email_recipient'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN email_recipient TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'email_error'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN email_error TEXT;
    END IF;
END $$;

-- Enforce valid email status values
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notifications_email_status;
ALTER TABLE public.notifications ADD CONSTRAINT chk_notifications_email_status 
    CHECK (email_status IN ('pending', 'sent', 'failed', 'skipped'));

-- Index for pending email dispatch
CREATE INDEX IF NOT EXISTS idx_notifications_email_pending 
    ON public.notifications(email_status, created_at DESC) 
    WHERE email_status = 'pending';

-- 2. Dedicated Idempotency & Audit Table: notification_email_deliveries
CREATE TABLE IF NOT EXISTS public.notification_email_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID UNIQUE NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    recipient_faculty_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    recipient_role TEXT,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    notification_title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    resend_email_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_deliveries_notification_id 
    ON public.notification_email_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_recipient_email 
    ON public.notification_email_deliveries(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_status 
    ON public.notification_email_deliveries(status);

-- 3. Row Level Security & Data API Grants
ALTER TABLE public.notification_email_deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.notification_email_deliveries TO authenticated;
GRANT ALL ON public.notification_email_deliveries TO service_role;

DROP POLICY IF EXISTS "notif_deliveries_select" ON public.notification_email_deliveries;
CREATE POLICY "notif_deliveries_select" ON public.notification_email_deliveries FOR SELECT TO authenticated
    USING (
        recipient_user_id = auth.uid()
        OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
        OR (recipient_faculty_id IS NOT NULL AND recipient_faculty_id = public.current_user_faculty_id())
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "notif_deliveries_insert" ON public.notification_email_deliveries;
CREATE POLICY "notif_deliveries_insert" ON public.notification_email_deliveries FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role, 'student'::user_role)
        OR auth.role() = 'service_role'
    );

-- 4. Atomic Recipient Resolution & Pre-Flight Check RPC
CREATE OR REPLACE FUNCTION public.get_notifications_for_email_delivery(p_notification_ids UUID[])
RETURNS TABLE (
    notification_id UUID,
    recipient_user_id UUID,
    recipient_student_id UUID,
    recipient_faculty_id UUID,
    recipient_role TEXT,
    recipient_email TEXT,
    recipient_name TEXT,
    notification_type TEXT,
    notification_title TEXT,
    notification_message TEXT,
    reference_type TEXT,
    reference_id UUID,
    email_status TEXT,
    can_send BOOLEAN,
    skip_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH raw_notifs AS (
        SELECT 
            n.id AS r_notif_id,
            n.recipient_user_id AS r_user_id,
            n.recipient_student_id AS r_student_id,
            n.recipient_faculty_id AS r_faculty_id,
            n.recipient_role AS r_role,
            n.type AS r_type,
            n.title AS r_title,
            n.message AS r_message,
            n.reference_type AS r_ref_type,
            n.reference_id AS r_ref_id,
            n.email_status AS r_email_status
        FROM public.notifications n
        WHERE n.id = ANY(p_notification_ids)
    ),
    resolved AS (
        SELECT 
            rn.r_notif_id,
            rn.r_user_id,
            rn.r_student_id,
            rn.r_faculty_id,
            rn.r_type,
            rn.r_title,
            rn.r_message,
            rn.r_ref_type,
            rn.r_ref_id,
            rn.r_email_status,
            -- Resolved Role
            COALESCE(
                p.role::text,
                CASE 
                    WHEN rn.r_student_id IS NOT NULL THEN 'student'
                    WHEN rn.r_faculty_id IS NOT NULL THEN 'faculty'
                    ELSE rn.r_role
                END
            ) AS final_role,
            -- Resolved Email (strictly scoped from official profile, faculty, or student record)
            COALESCE(
                p.email,
                f.email,
                s.email,
                u.email
            ) AS final_email,
            -- Resolved Name
            COALESCE(
                p.full_name,
                f.full_name,
                s.full_name,
                'VCTM Campus Member'
            ) AS final_name
        FROM raw_notifs rn
        LEFT JOIN auth.users u ON u.id = rn.r_user_id
        LEFT JOIN public.profiles p ON (p.id = rn.r_user_id OR (rn.r_faculty_id IS NOT NULL AND p.faculty_id = rn.r_faculty_id) OR (rn.r_student_id IS NOT NULL AND p.student_id = rn.r_student_id))
        LEFT JOIN public.faculty f ON (f.id = rn.r_faculty_id OR (rn.r_user_id IS NOT NULL AND f.auth_user_id = rn.r_user_id))
        LEFT JOIN public.students s ON (s.id = rn.r_student_id OR (rn.r_user_id IS NOT NULL AND s.auth_user_id = rn.r_user_id))
    )
    SELECT 
        res.r_notif_id AS notification_id,
        res.r_user_id AS recipient_user_id,
        res.r_student_id AS recipient_student_id,
        res.r_faculty_id AS recipient_faculty_id,
        res.final_role AS recipient_role,
        res.final_email AS recipient_email,
        res.final_name AS recipient_name,
        res.r_type AS notification_type,
        res.r_title AS notification_title,
        res.r_message AS notification_message,
        res.r_ref_type AS reference_type,
        res.r_ref_id AS reference_id,
        res.r_email_status AS email_status,
        -- can_send conditions:
        -- 1. Not already sent
        -- 2. Must be individually scoped (at least one recipient ID specified)
        -- 3. Must have a valid registered email
        CASE 
            WHEN res.r_email_status = 'sent' THEN false
            WHEN EXISTS (SELECT 1 FROM public.notification_email_deliveries ned WHERE ned.notification_id = res.r_notif_id AND ned.status = 'sent') THEN false
            WHEN res.r_user_id IS NULL AND res.r_student_id IS NULL AND res.r_faculty_id IS NULL THEN false
            WHEN res.final_email IS NULL OR TRIM(res.final_email) = '' OR res.final_email NOT LIKE '%@%.%' THEN false
            ELSE true
        END AS can_send,
        -- skip_reason
        CASE 
            WHEN res.r_email_status = 'sent' THEN 'ALREADY_SENT'
            WHEN EXISTS (SELECT 1 FROM public.notification_email_deliveries ned WHERE ned.notification_id = res.r_notif_id AND ned.status = 'sent') THEN 'ALREADY_SENT'
            WHEN res.r_user_id IS NULL AND res.r_student_id IS NULL AND res.r_faculty_id IS NULL THEN 'NO_INDIVIDUAL_RECIPIENT_SCOPED'
            WHEN res.final_email IS NULL OR TRIM(res.final_email) = '' OR res.final_email NOT LIKE '%@%.%' THEN 'NO_VALID_REGISTERED_EMAIL'
            ELSE NULL
        END AS skip_reason
    FROM resolved res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_notifications_for_email_delivery(UUID[]) TO authenticated, service_role;

-- 5. Atomic Delivery Record RPC
CREATE OR REPLACE FUNCTION public.record_notification_email_delivery(
    p_notification_id UUID,
    p_status TEXT,
    p_resend_email_id TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_recipient_email TEXT DEFAULT NULL,
    p_recipient_name TEXT DEFAULT NULL,
    p_recipient_role TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notif RECORD;
BEGIN
    SELECT * INTO v_notif FROM public.notifications WHERE id = p_notification_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Update parent notification record
    UPDATE public.notifications
    SET 
        email_status = p_status,
        email_sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE email_sent_at END,
        email_recipient = COALESCE(p_recipient_email, email_recipient),
        email_error = p_error_message,
        updated_at = now()
    WHERE id = p_notification_id;

    -- Insert or update idempotent delivery audit row
    INSERT INTO public.notification_email_deliveries (
        notification_id,
        recipient_user_id,
        recipient_student_id,
        recipient_faculty_id,
        recipient_role,
        recipient_email,
        recipient_name,
        notification_type,
        notification_title,
        status,
        resend_email_id,
        error_message,
        sent_at,
        created_at
    ) VALUES (
        p_notification_id,
        v_notif.recipient_user_id,
        v_notif.recipient_student_id,
        v_notif.recipient_faculty_id,
        p_recipient_role,
        COALESCE(p_recipient_email, 'unknown@vctm.in'),
        COALESCE(p_recipient_name, 'Campus Member'),
        v_notif.type,
        v_notif.title,
        p_status,
        p_resend_email_id,
        p_error_message,
        CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
        now()
    )
    ON CONFLICT (notification_id) DO UPDATE
    SET
        status = EXCLUDED.status,
        resend_email_id = COALESCE(EXCLUDED.resend_email_id, public.notification_email_deliveries.resend_email_id),
        error_message = EXCLUDED.error_message,
        sent_at = COALESCE(EXCLUDED.sent_at, public.notification_email_deliveries.sent_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_notification_email_delivery(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

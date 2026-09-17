-- ==============================================================================
-- Migration 019: Student Notifications & Supabase Realtime Engine
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'MARKS_PUBLISHED',
        'MARKS_UPDATED',
        'ASSIGNMENT_POSTED',
        'ASSIGNMENT_UPDATED',
        'ATTENDANCE_CLAIM',
        'ATTENDANCE_UPDATE',
        'TIMETABLE_UPDATE',
        'GENERAL'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for High Performance Queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user_id ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_student_id ON public.notifications(recipient_student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(recipient_user_id, is_read) WHERE is_read = false;

-- 3. Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.notifications;';
    END LOOP;
END $$;

-- A. SELECT: Students/users view their own notifications. Super Admin & HOD have oversight.
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
    USING (
        recipient_user_id = auth.uid()
        OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    );

-- B. UPDATE: Users can mark their own notifications as read.
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
    USING (
        recipient_user_id = auth.uid()
        OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        recipient_user_id = auth.uid()
        OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    );

-- C. INSERT: Faculty, HOD, Super Admin, or service_role can create notifications for students.
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
        OR auth.role() = 'service_role'
    );

-- D. DELETE: Users can delete their own notifications; Super Admin can purge if needed.
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated
    USING (
        recipient_user_id = auth.uid()
        OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    );

-- 4. Add to Supabase Realtime Publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

-- 5. Helper RPC Functions
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true, updated_at = now()
    WHERE id = p_notification_id
      AND (
          recipient_user_id = auth.uid()
          OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
          OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
          OR auth.role() = 'service_role'
      );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true, updated_at = now()
    WHERE is_read = false
      AND (
          recipient_user_id = auth.uid()
          OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
          OR auth.role() = 'service_role'
      );
END;
$$;

-- 6. Ensure Sessional Marks Unique Constraint for Upserts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_sessional_marks_sub_sec_stud_type'
    ) THEN
        ALTER TABLE public.sessional_marks 
        ADD CONSTRAINT uq_sessional_marks_sub_sec_stud_type 
        UNIQUE (subject_id, section_id, student_id, sessional_type);
    END IF;
END $$;


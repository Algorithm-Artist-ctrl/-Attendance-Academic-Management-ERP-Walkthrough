-- ==============================================================================
-- Migration 020: Performance Indexes & Realtime Notification System Enhancement
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Enhance notifications table schema
DO $$
BEGIN
    -- Add recipient_role if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'recipient_role'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN recipient_role TEXT;
    END IF;

    -- Add read_at if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read_at'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN read_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Relax or expand type check constraint to support all academic notifications
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'MARKS_PUBLISHED',
    'MARKS_UPDATED',
    'ASSIGNMENT_POSTED',
    'ASSIGNMENT_UPDATED',
    'QUIZ_POSTED',
    'QUIZ_GRADED',
    'ATTENDANCE_CLAIM',
    'ATTENDANCE_UPDATE',
    'TIMETABLE_UPDATE',
    'NOTICE',
    'ACCOUNT_UPDATE',
    'GENERAL'
));

-- 3. Additional Performance Indexes on notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON public.notifications(recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON public.notifications(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread_student ON public.notifications(recipient_student_id, is_read) WHERE is_read = false;

-- 4. Hot Query Path Indexes for Core ERP Tables

-- Assignments Table
CREATE INDEX IF NOT EXISTS idx_assignments_section_id ON public.assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_assignments_faculty_id ON public.assignments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject_id ON public.assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON public.assignments(created_at DESC);

-- Attendance Sessions Table
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_faculty ON public.attendance_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_subject ON public.attendance_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_session_date ON public.attendance_sessions(session_date DESC);

-- Attendance Records Table
CREATE INDEX IF NOT EXISTS idx_attendance_records_created_at ON public.attendance_records(created_at DESC);

-- Sessional Marks Table
CREATE INDEX IF NOT EXISTS idx_sessional_marks_student_id ON public.sessional_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_sessional_marks_subject_id ON public.sessional_marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessional_marks_section_id ON public.sessional_marks(section_id);
CREATE INDEX IF NOT EXISTS idx_sessional_marks_assessment_id ON public.sessional_marks(sessional_assessment_id);

-- Timetable Entries Table
CREATE INDEX IF NOT EXISTS idx_timetable_subject ON public.timetable_entries(subject_id);

-- 5. Updated Notification Helper RPCs
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true, 
        read_at = COALESCE(read_at, now()), 
        updated_at = now()
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
    SET is_read = true, 
        read_at = COALESCE(read_at, now()), 
        updated_at = now()
    WHERE is_read = false
      AND (
          recipient_user_id = auth.uid()
          OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
          OR auth.role() = 'service_role'
      );
END;
$$;

-- Allow students to insert notifications for faculty/admin (e.g. attendance claims)
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role, 'student'::user_role)
        OR auth.role() = 'service_role'
    );

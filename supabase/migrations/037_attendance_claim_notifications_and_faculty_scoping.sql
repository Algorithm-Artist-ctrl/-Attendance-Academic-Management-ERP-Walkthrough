-- ==============================================================================
-- Migration 037: Attendance Claim Real-Time Notifications & Faculty Scoping
-- Vivekananda College of Technology & Management (VCTM) ERP
-- Fixes faculty notification delivery, student status updates, and RLS scoping
-- ==============================================================================

-- 1. Enhance notifications table schema for Faculty recipient
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'recipient_faculty_id'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN recipient_faculty_id UUID REFERENCES public.faculty(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_faculty ON public.notifications(recipient_faculty_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread_faculty ON public.notifications(recipient_faculty_id, is_read) WHERE is_read = false;

-- 2. Update notifications_select RLS Policy
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
    USING (
        recipient_user_id = auth.uid()
        OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
        OR (recipient_faculty_id IS NOT NULL AND recipient_faculty_id = public.current_user_faculty_id())
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    );

-- 3. Trigger Function: Automatically Notify Assigned Faculty when Student Claims Attendance
CREATE OR REPLACE FUNCTION public.trg_fn_notify_faculty_on_attendance_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_student RECORD;
    v_subject RECORD;
    v_section RECORD;
    v_faculty RECORD;
    v_time_slot TEXT;
    v_date_str TEXT;
BEGIN
    -- Resolve underlying attendance record and session
    SELECT * INTO v_session
    FROM public.attendance_sessions
    WHERE id = (
        SELECT attendance_session_id 
        FROM public.attendance_records 
        WHERE id = NEW.attendance_record_id
    );

    IF NOT FOUND OR v_session.faculty_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch student details
    SELECT full_name, roll_number INTO v_student
    FROM public.students
    WHERE id = NEW.student_id;

    -- Fetch subject and section
    SELECT subject_name, subject_code INTO v_subject
    FROM public.subjects
    WHERE id = v_session.subject_id;

    SELECT name INTO v_section
    FROM public.sections
    WHERE id = v_session.section_id;

    -- Fetch faculty auth_user_id
    SELECT id, auth_user_id INTO v_faculty
    FROM public.faculty
    WHERE id = v_session.faculty_id;

    -- Format time and date
    v_date_str := to_char(v_session.session_date, 'DD Mon YYYY');
    v_time_slot := COALESCE(
        to_char(v_session.start_time, 'HH24:MI') || '–' || to_char(v_session.end_time, 'HH24:MI'),
        'Scheduled Class'
    );

    -- Insert notification for assigned faculty
    INSERT INTO public.notifications (
        recipient_user_id,
        recipient_faculty_id,
        recipient_role,
        type,
        title,
        message,
        reference_type,
        reference_id,
        is_read
    ) VALUES (
        v_faculty.auth_user_id,
        v_faculty.id,
        'faculty',
        'ATTENDANCE_CLAIM',
        'New Attendance Correction Request',
        format('%s • %s' || chr(10) || '%s • Section %s' || chr(10) || '%s • %s' || chr(10) || 'Reason: %s',
            COALESCE(v_student.full_name, 'Student'),
            COALESCE(v_student.roll_number, 'Roll N/A'),
            COALESCE(v_subject.subject_name, 'Subject'),
            COALESCE(v_section.name, 'A'),
            v_date_str,
            v_time_slot,
            COALESCE(NEW.reason, 'Attendance discrepancy')
        ),
        'attendance_correction',
        NEW.id,
        false
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_faculty_on_claim ON public.attendance_corrections;
CREATE TRIGGER trg_notify_faculty_on_claim
    AFTER INSERT ON public.attendance_corrections
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_notify_faculty_on_attendance_claim();


-- 4. Trigger Function: Automatically Notify Student on Claim Approval or Rejection
CREATE OR REPLACE FUNCTION public.trg_fn_notify_student_on_correction_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student RECORD;
    v_session RECORD;
    v_subject RECORD;
    v_title TEXT;
    v_msg TEXT;
BEGIN
    IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
        SELECT id, auth_user_id, full_name INTO v_student
        FROM public.students
        WHERE id = NEW.student_id;

        SELECT * INTO v_session
        FROM public.attendance_sessions
        WHERE id = (
            SELECT attendance_session_id 
            FROM public.attendance_records 
            WHERE id = NEW.attendance_record_id
        );

        SELECT subject_name INTO v_subject
        FROM public.subjects
        WHERE id = v_session.subject_id;

        IF NEW.status = 'approved' THEN
            v_title := 'Attendance Claim Approved';
            v_msg := format('Your attendance claim for %s (%s) has been approved. Status updated to Present.', 
                COALESCE(v_subject.subject_name, 'your lecture'),
                to_char(v_session.session_date, 'DD Mon YYYY')
            );
        ELSE
            v_title := 'Attendance Claim Rejected';
            v_msg := format('Your attendance claim for %s (%s) was reviewed and rejected. Absence confirmed.%s',
                COALESCE(v_subject.subject_name, 'your lecture'),
                to_char(v_session.session_date, 'DD Mon YYYY'),
                CASE WHEN NEW.review_remarks IS NOT NULL AND NEW.review_remarks != '' 
                     THEN ' Remarks: ' || NEW.review_remarks 
                     ELSE '' 
                END
            );
        END IF;

        INSERT INTO public.notifications (
            recipient_user_id,
            recipient_student_id,
            recipient_role,
            type,
            title,
            message,
            reference_type,
            reference_id,
            is_read
        ) VALUES (
            v_student.auth_user_id,
            v_student.id,
            'student',
            'ATTENDANCE_CLAIM',
            v_title,
            v_msg,
            'attendance_correction',
            NEW.id,
            false
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_on_review ON public.attendance_corrections;
CREATE TRIGGER trg_notify_student_on_review
    AFTER UPDATE OF status ON public.attendance_corrections
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_notify_student_on_correction_review();


-- 5. Strict attendance_corrections RLS Scoping
DROP POLICY IF EXISTS "attendance_corrections_read" ON public.attendance_corrections;
CREATE POLICY "attendance_corrections_read" ON public.attendance_corrections FOR SELECT TO authenticated
    USING (
        student_id = public.current_user_student_id()
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR (
            public.current_user_role() = 'faculty'::user_role
            AND (
                reviewed_by = public.current_user_faculty_id()
                OR EXISTS (
                    SELECT 1 
                    FROM public.attendance_records ar
                    JOIN public.attendance_sessions s ON s.id = ar.attendance_session_id
                    WHERE ar.id = attendance_corrections.attendance_record_id
                      AND (
                          s.faculty_id = public.current_user_faculty_id()
                          OR public.is_assigned_faculty(public.current_user_faculty_id(), s.section_id, s.subject_id)
                          OR EXISTS (
                              SELECT 1 FROM public.sections sec
                              WHERE sec.id = s.section_id 
                                AND sec.class_coordinator_id = public.current_user_faculty_id()
                          )
                          OR EXISTS (
                              SELECT 1 FROM public.class_coordinator_assignments cca
                              WHERE cca.section_id = s.section_id 
                                AND cca.faculty_id = public.current_user_faculty_id()
                                AND cca.active = true
                          )
                      )
                )
            )
        )
        OR auth.role() = 'service_role'
    );

-- 6. Helper RPC to Mark Notification as Read for Faculty
CREATE OR REPLACE FUNCTION public.mark_faculty_notification_as_read(p_notification_id UUID, p_faculty_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true, read_at = now(), updated_at = now()
    WHERE id = p_notification_id
      AND (
          recipient_faculty_id = p_faculty_id
          OR recipient_user_id = auth.uid()
          OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
          OR auth.role() = 'service_role'
      );
END;
$$;

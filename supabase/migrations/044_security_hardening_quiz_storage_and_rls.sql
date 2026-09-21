-- ==============================================================================
-- Migration 044: Security Hardening - Quiz Results, Marks History & Submission Integrity
-- Vivekananda College of Technology & Management (VCTM) ERP
-- Addresses:
-- 1. Quiz results write tightening: Students cannot write or self-grade quiz results.
-- 2. Marks history audit trail lockdown: Remove public/anon wildcard policies.
-- 3. Assignment submissions integrity triggers: Prevent student grade tampering.
-- ==============================================================================

-- 1. Tighten quiz_results Write Policy (Faculty, HOD, Super Admin & Service Role Only)
DROP POLICY IF EXISTS "quiz_results_write" ON public.quiz_results;

CREATE POLICY "quiz_results_write" ON public.quiz_results
    FOR ALL TO authenticated
    USING (
        (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role]))
        OR (auth.role() = 'service_role'::text)
    )
    WITH CHECK (
        (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role]))
        OR (auth.role() = 'service_role'::text)
    );

-- 2. Purge Insecure Policies on marks_history & Lock Down Audit Trail
DROP POLICY IF EXISTS "Allow delete on marks_history" ON public.marks_history;
DROP POLICY IF EXISTS "Allow update on marks_history" ON public.marks_history;
DROP POLICY IF EXISTS "Allow insert on marks_history" ON public.marks_history;
DROP POLICY IF EXISTS "Allow select on marks_history" ON public.marks_history;
DROP POLICY IF EXISTS "allow_all_marks_history" ON public.marks_history;
DROP POLICY IF EXISTS "marks_history_read" ON public.marks_history;
DROP POLICY IF EXISTS "marks_history_insert" ON public.marks_history;
DROP POLICY IF EXISTS "marks_history_delete" ON public.marks_history;

-- Read policy: Staff can view all audit marks; students can ONLY view their own records
CREATE POLICY "marks_history_read" ON public.marks_history
    FOR SELECT TO authenticated
    USING (
        (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role]))
        OR (student_id = current_user_student_id())
        OR (auth.role() = 'service_role'::text)
    );

-- Insert policy: Only staff and service_role can append marks history records
CREATE POLICY "marks_history_insert" ON public.marks_history
    FOR INSERT TO authenticated
    WITH CHECK (
        (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role]))
        OR (auth.role() = 'service_role'::text)
    );

-- Delete policy: Only super_admin or service_role can purge historical audit rows
CREATE POLICY "marks_history_delete" ON public.marks_history
    FOR DELETE TO authenticated
    USING (
        (current_user_role() = 'super_admin'::user_role)
        OR (auth.role() = 'service_role'::text)
    );

-- 3. Assignment Submissions Integrity Trigger (Anti-Grade Tampering)
CREATE OR REPLACE FUNCTION public.prevent_student_submission_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    v_caller_role := public.current_user_role();

    IF v_caller_role = 'student'::public.user_role THEN
        -- Prevent student from reassigning ownership
        IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
            RAISE EXCEPTION 'SECURITY ERROR: Students cannot change student_id on submissions.';
        END IF;
        IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id THEN
            RAISE EXCEPTION 'SECURITY ERROR: Students cannot change assignment_id on submissions.';
        END IF;

        -- Prevent student from self-grading, setting marks, or tampering with grading fields
        IF NEW.marks_obtained IS DISTINCT FROM OLD.marks_obtained THEN
            RAISE EXCEPTION 'SECURITY ERROR: Students are strictly forbidden from altering marks_obtained.';
        END IF;
        IF NEW.graded_by IS DISTINCT FROM OLD.graded_by THEN
            RAISE EXCEPTION 'SECURITY ERROR: Students are strictly forbidden from altering graded_by.';
        END IF;
        IF NEW.graded_at IS DISTINCT FROM OLD.graded_at THEN
            RAISE EXCEPTION 'SECURITY ERROR: Students are strictly forbidden from altering graded_at.';
        END IF;
        IF NEW.feedback IS DISTINCT FROM OLD.feedback THEN
            RAISE EXCEPTION 'SECURITY ERROR: Students are strictly forbidden from altering feedback.';
        END IF;
        IF NEW.status = 'graded' AND (OLD.status IS DISTINCT FROM 'graded') THEN
            RAISE EXCEPTION 'SECURITY ERROR: Students cannot mark submissions as graded.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_submission_tampering ON public.assignment_submissions;
CREATE TRIGGER trg_prevent_student_submission_tampering
    BEFORE UPDATE ON public.assignment_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_student_submission_tampering();

-- Prevent deletion of graded submissions by students
CREATE OR REPLACE FUNCTION public.prevent_graded_submission_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN OLD;
    END IF;

    v_caller_role := public.current_user_role();

    IF v_caller_role = 'student'::public.user_role AND (OLD.marks_obtained IS NOT NULL OR OLD.status = 'graded') THEN
        RAISE EXCEPTION 'SECURITY ERROR: Graded submissions cannot be deleted by students.';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_graded_submission_deletion ON public.assignment_submissions;
CREATE TRIGGER trg_prevent_graded_submission_deletion
    BEFORE DELETE ON public.assignment_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_graded_submission_deletion();

-- ==============================================================================
-- Migration 046: Sessional Marks Absent/Exempted Support & Permanent Delete System
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. ADD ATTENDANCE / EVALUATION STATUS TO SESSIONAL MARKS
DO $$
BEGIN
    -- Add attendance_status column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessional_marks' AND column_name = 'attendance_status'
    ) THEN
        ALTER TABLE public.sessional_marks
        ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'NOT_ENTERED';
    END IF;
END $$;

-- Drop existing constraints on sessional_marks if they conflict
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.sessional_marks'::regclass
          AND contype = 'c'
          AND conname IN ('chk_sessional_marks_attendance_status', 'chk_sessional_marks_score_consistency')
    ) LOOP
        EXECUTE 'ALTER TABLE public.sessional_marks DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Allow marks_obtained to be NULL for absent/exempted/not entered students
ALTER TABLE public.sessional_marks
ALTER COLUMN marks_obtained DROP NOT NULL;

-- Backfill existing rows
UPDATE public.sessional_marks
SET attendance_status = CASE
    WHEN marks_obtained IS NOT NULL THEN 'PRESENT'
    ELSE 'NOT_ENTERED'
END;

-- Add check constraint for valid attendance statuses
ALTER TABLE public.sessional_marks
ADD CONSTRAINT chk_sessional_marks_attendance_status
CHECK (attendance_status IN ('NOT_ENTERED', 'PRESENT', 'ABSENT', 'EXEMPTED'));

-- Add consistency check constraint: PRESENT requires non-null marks; ABSENT/EXEMPTED/NOT_ENTERED requires null marks
ALTER TABLE public.sessional_marks
ADD CONSTRAINT chk_sessional_marks_score_consistency
CHECK (
    (attendance_status = 'PRESENT' AND marks_obtained IS NOT NULL)
    OR
    (attendance_status IN ('ABSENT', 'EXEMPTED', 'NOT_ENTERED') AND marks_obtained IS NULL)
);

-- Performance Index for assessment status queries
CREATE INDEX IF NOT EXISTS idx_sessional_marks_assessment_att_status
ON public.sessional_marks(sessional_assessment_id, attendance_status);

-- 2. UPDATE MARKS PUBLICATION RPC TO FORMAT ABSENT / EXEMPTED NOTIFICATIONS
CREATE OR REPLACE FUNCTION public.publish_sessional_assessment(p_assessment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assessment RECORD;
  v_subject_name TEXT := 'Course Subject';
BEGIN
  SELECT * INTO v_assessment FROM public.sessional_assessments WHERE id = p_assessment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment not found with id %', p_assessment_id;
  END IF;

  -- Update assessment to published
  UPDATE public.sessional_assessments
  SET status = 'published', updated_at = now()
  WHERE id = p_assessment_id;

  -- Update all child marks to published
  UPDATE public.sessional_marks
  SET status = 'published', updated_at = now()
  WHERE sessional_assessment_id = p_assessment_id;

  -- Get subject name for notification
  SELECT subject_name INTO v_subject_name FROM public.subjects WHERE id = v_assessment.subject_id;
  IF v_subject_name IS NULL THEN
    v_subject_name := 'Course Subject';
  END IF;

  -- Insert notifications for students with proper absent/exempted handling
  INSERT INTO public.notifications (
    recipient_user_id,
    recipient_student_id,
    recipient_role,
    type,
    title,
    message,
    reference_type,
    reference_id,
    is_read,
    created_at,
    updated_at
  )
  SELECT
    s.auth_user_id,
    sm.student_id,
    'student',
    'MARKS_PUBLISHED',
    'Marks Published: ' || v_assessment.title,
    v_subject_name || ' — ' || v_assessment.title || ': ' ||
      CASE
        WHEN sm.attendance_status = 'ABSENT' THEN 'ABSENT'
        WHEN sm.attendance_status = 'EXEMPTED' THEN 'EXEMPTED'
        WHEN sm.marks_obtained IS NOT NULL THEN (sm.marks_obtained::TEXT || '/' || v_assessment.max_marks::TEXT)
        ELSE 'Evaluated'
      END,
    'sessional_mark',
    sm.id,
    false,
    now(),
    now()
  FROM public.sessional_marks sm
  JOIN public.students s ON s.id = sm.student_id
  WHERE sm.sessional_assessment_id = p_assessment_id;

  RETURN jsonb_build_object(
    'success', true,
    'assessment_id', p_assessment_id,
    'status', 'published'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_sessional_assessment(UUID) TO authenticated, anon;

-- 3. PERMANENT DELETE SAFETY TRIGGER UPDATE
-- Allow service_role or Super Admin permanent deletion of archived accounts
CREATE OR REPLACE FUNCTION public.prevent_destructive_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoked via service_role or Super Admin deleting an inactive/archived account, permit the deletion
  IF auth.role() = 'service_role' THEN
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME = 'students' THEN
    IF OLD.status != 'ACTIVE' AND OLD.active = false AND public.current_user_role() = 'super_admin'::user_role THEN
      RETURN OLD;
    END IF;
    IF EXISTS (SELECT 1 FROM public.attendance_records WHERE student_id = OLD.id) OR
       EXISTS (SELECT 1 FROM public.sessional_marks WHERE student_id = OLD.id) THEN
      RAISE EXCEPTION 'Destructive hard deletion blocked: Student % has historical attendance or assessment records. Please use archive_account or permanent delete workflow.', OLD.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'faculty' THEN
    IF OLD.status != 'ACTIVE' AND OLD.active = false AND public.current_user_role() = 'super_admin'::user_role THEN
      RETURN OLD;
    END IF;
    IF EXISTS (SELECT 1 FROM public.attendance_sessions WHERE faculty_id = OLD.id) OR
       EXISTS (SELECT 1 FROM public.sessional_assessments WHERE faculty_id = OLD.id) THEN
      RAISE EXCEPTION 'Destructive hard deletion blocked: Faculty % has historical attendance or assessment records. Please use archive_account or permanent delete workflow.', OLD.id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ATOMIC RPC TO PERMANENTLY DELETE ARCHIVED ACCOUNT
CREATE OR REPLACE FUNCTION public.permanent_delete_archived_account(
  p_target_id UUID,
  p_entity_type TEXT, -- 'student' | 'faculty'
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_role user_role;
  v_actor_id UUID;
  v_actor_name TEXT := 'Super Admin';
  v_target_user_id UUID;
  v_target_status TEXT;
  v_target_active BOOLEAN;
  v_target_name TEXT := 'Unknown';
  v_target_identifier TEXT := '—';
  v_target_email TEXT := NULL;
  v_dept_name TEXT := 'General';
  v_deleted_counts JSONB := '{}'::JSONB;

  -- Dependency counters
  v_att_records_count INT := 0;
  v_att_sessions_count INT := 0;
  v_marks_count INT := 0;
  v_assessments_count INT := 0;
  v_quizzes_count INT := 0;
  v_quiz_results_count INT := 0;
  v_assignments_count INT := 0;
  v_submissions_count INT := 0;
  v_messages_count INT := 0;
  v_notifs_count INT := 0;
BEGIN
  -- 1. Caller Authorization Check (Super Admin or service_role only)
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF auth.uid() IS NOT NULL AND v_caller_role != 'super_admin' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator can permanently delete accounts';
  END IF;

  v_actor_id := COALESCE(p_actor_id, auth.uid());
  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_name IS NULL THEN
    v_actor_name := 'Super Admin';
  END IF;

  -- 2. Entity Validation
  IF p_entity_type = 'student' THEN
    SELECT s.auth_user_id, s.status, s.active, s.full_name, s.roll_number, s.email, d.name
    INTO v_target_user_id, v_target_status, v_target_active, v_target_name, v_target_identifier, v_target_email, v_dept_name
    FROM public.students s
    LEFT JOIN public.departments d ON d.id = s.department_id
    WHERE s.id = p_target_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student not found with ID: %', p_target_id;
    END IF;

    -- Safeguard: Cannot delete ACTIVE account
    IF v_target_status = 'ACTIVE' OR v_target_active = true THEN
      RAISE EXCEPTION 'Account is active. Active accounts must be archived before they can be permanently deleted.';
    END IF;

    -- Safeguard: Cannot delete self
    IF v_target_user_id IS NOT NULL AND v_target_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Self-deletion blocked: You cannot permanently delete your own account.';
    END IF;

    -- Count dependencies before cascade
    SELECT COUNT(*) INTO v_att_records_count FROM public.attendance_records WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_marks_count FROM public.sessional_marks WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_quiz_results_count FROM public.quiz_results WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_submissions_count FROM public.assignment_submissions WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_history_count FROM public.student_academic_history WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_leaves_count FROM public.leave_applications WHERE student_id = p_target_id;

    IF v_target_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_messages_count FROM public.messages WHERE sender_id = v_target_user_id OR recipient_id = v_target_user_id OR student_id = p_target_id;
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications WHERE recipient_user_id = v_target_user_id OR recipient_student_id = p_target_id;
    ELSE
      SELECT COUNT(*) INTO v_messages_count FROM public.messages WHERE student_id = p_target_id;
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications WHERE recipient_student_id = p_target_id;
    END IF;

    -- Delete student dependencies in proper foreign-key order
    DELETE FROM public.attendance_corrections WHERE student_id = p_target_id;
    DELETE FROM public.attendance_records WHERE student_id = p_target_id;
    DELETE FROM public.marks_history WHERE student_id = p_target_id;
    DELETE FROM public.sessional_marks WHERE student_id = p_target_id;
    DELETE FROM public.quiz_results WHERE student_id = p_target_id;
    DELETE FROM public.assignment_submissions WHERE student_id = p_target_id;
    DELETE FROM public.leave_approval_audit_logs WHERE actor_student_id = p_target_id OR application_id IN (SELECT id FROM public.leave_applications WHERE student_id = p_target_id);
    DELETE FROM public.leave_applications WHERE student_id = p_target_id;
    DELETE FROM public.student_academic_history WHERE student_id = p_target_id;
    DELETE FROM public.conversations WHERE student_id = p_target_id;
    DELETE FROM public.account_lifecycle WHERE entity_id = p_target_id OR (v_target_user_id IS NOT NULL AND user_id = v_target_user_id);

    IF v_target_user_id IS NOT NULL THEN
      DELETE FROM public.group_member_read_state WHERE user_id = v_target_user_id;
      DELETE FROM public.group_messages WHERE sender_id = v_target_user_id;
      DELETE FROM public.messages WHERE sender_id = v_target_user_id OR recipient_id = v_target_user_id OR student_id = p_target_id;
      DELETE FROM public.notifications WHERE recipient_user_id = v_target_user_id OR recipient_student_id = p_target_id;
    ELSE
      DELETE FROM public.messages WHERE student_id = p_target_id;
      DELETE FROM public.notifications WHERE recipient_student_id = p_target_id;
    END IF;

    -- Delete profile if linked
    IF v_target_user_id IS NOT NULL THEN
      DELETE FROM public.profiles WHERE id = v_target_user_id OR student_id = p_target_id;
    ELSE
      UPDATE public.profiles SET student_id = NULL WHERE student_id = p_target_id;
    END IF;

    -- Delete student record
    DELETE FROM public.students WHERE id = p_target_id;

  ELSIF p_entity_type = 'faculty' THEN
    SELECT f.auth_user_id, f.status, f.active, f.full_name, f.employee_code, f.email, d.name
    INTO v_target_user_id, v_target_status, v_target_active, v_target_name, v_target_identifier, v_target_email, v_dept_name
    FROM public.faculty f
    LEFT JOIN public.departments d ON d.id = f.department_id
    WHERE f.id = p_target_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Faculty not found with ID: %', p_target_id;
    END IF;

    -- Safeguard: Cannot delete ACTIVE account
    IF v_target_status = 'ACTIVE' OR v_target_active = true THEN
      RAISE EXCEPTION 'Account is active. Active accounts must be archived before they can be permanently deleted.';
    END IF;

    -- Safeguard: Cannot delete self
    IF v_target_user_id IS NOT NULL AND v_target_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Self-deletion blocked: You cannot permanently delete your own account.';
    END IF;

    -- Count dependencies
    SELECT COUNT(*) INTO v_att_sessions_count FROM public.attendance_sessions WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_assessments_count FROM public.sessional_assessments WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_quizzes_count FROM public.quizzes WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_assignments_count FROM public.assignments WHERE faculty_id = p_target_id;
    IF v_target_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_messages_count FROM public.messages WHERE sender_id = v_target_user_id OR recipient_id = v_target_user_id OR faculty_id = p_target_id;
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications WHERE recipient_user_id = v_target_user_id OR recipient_faculty_id = p_target_id;
    ELSE
      SELECT COUNT(*) INTO v_messages_count FROM public.messages WHERE faculty_id = p_target_id;
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications WHERE recipient_faculty_id = p_target_id;
    END IF;

    -- Nullify references in non-cascade tables
    UPDATE public.departments SET hod_faculty_id = NULL WHERE hod_faculty_id = p_target_id;
    UPDATE public.sections SET class_coordinator_id = NULL WHERE class_coordinator_id = p_target_id;
    UPDATE public.students SET mentor_faculty_id = NULL WHERE mentor_faculty_id = p_target_id;
    UPDATE public.attendance_corrections SET reviewed_by = NULL WHERE reviewed_by = p_target_id;
    UPDATE public.attendance_records SET marked_by = NULL WHERE marked_by = p_target_id;
    UPDATE public.sessional_marks SET faculty_id = NULL WHERE faculty_id = p_target_id;
    UPDATE public.quiz_results SET graded_by = NULL WHERE graded_by = p_target_id;
    UPDATE public.assignment_submissions SET graded_by = NULL WHERE graded_by = p_target_id;
    UPDATE public.leave_applications SET coordinator_id = NULL, coordinator_approved_by = NULL WHERE coordinator_id = p_target_id OR coordinator_approved_by = p_target_id;
    UPDATE public.leave_applications SET hod_id = NULL, hod_approved_by = NULL WHERE hod_id = p_target_id OR hod_approved_by = p_target_id;
    UPDATE public.leave_applications SET rejected_by = NULL WHERE rejected_by = p_target_id;
    UPDATE public.leave_approval_audit_logs SET actor_faculty_id = NULL WHERE actor_faculty_id = p_target_id;
    UPDATE public.message_groups SET created_by_faculty_id = NULL WHERE created_by_faculty_id = p_target_id;
    UPDATE public.timetable_entries SET faculty_id = NULL WHERE faculty_id = p_target_id;

    -- Delete faculty assignments and owned collections
    DELETE FROM public.class_coordinator_assignments WHERE faculty_id = p_target_id;
    DELETE FROM public.faculty_subject_assignments WHERE faculty_id = p_target_id;
    DELETE FROM public.attendance_records WHERE attendance_session_id IN (SELECT id FROM public.attendance_sessions WHERE faculty_id = p_target_id);
    DELETE FROM public.attendance_sessions WHERE faculty_id = p_target_id;
    DELETE FROM public.sessional_marks WHERE sessional_assessment_id IN (SELECT id FROM public.sessional_assessments WHERE faculty_id = p_target_id);
    DELETE FROM public.sessional_assessments WHERE faculty_id = p_target_id;
    DELETE FROM public.quiz_results WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE faculty_id = p_target_id);
    DELETE FROM public.quizzes WHERE faculty_id = p_target_id;
    DELETE FROM public.assignment_submissions WHERE assignment_id IN (SELECT id FROM public.assignments WHERE faculty_id = p_target_id);
    DELETE FROM public.assignments WHERE faculty_id = p_target_id;
    DELETE FROM public.conversations WHERE faculty_id = p_target_id;
    DELETE FROM public.account_lifecycle WHERE entity_id = p_target_id OR (v_target_user_id IS NOT NULL AND user_id = v_target_user_id);

    IF v_target_user_id IS NOT NULL THEN
      DELETE FROM public.group_member_read_state WHERE user_id = v_target_user_id;
      DELETE FROM public.group_messages WHERE sender_id = v_target_user_id;
      DELETE FROM public.messages WHERE sender_id = v_target_user_id OR recipient_id = v_target_user_id OR faculty_id = p_target_id;
      DELETE FROM public.notifications WHERE recipient_user_id = v_target_user_id OR recipient_faculty_id = p_target_id;
    ELSE
      DELETE FROM public.messages WHERE faculty_id = p_target_id;
      DELETE FROM public.notifications WHERE recipient_faculty_id = p_target_id;
    END IF;

    -- Delete profile if linked
    IF v_target_user_id IS NOT NULL THEN
      DELETE FROM public.profiles WHERE id = v_target_user_id OR faculty_id = p_target_id;
    ELSE
      UPDATE public.profiles SET faculty_id = NULL WHERE faculty_id = p_target_id;
    END IF;

    -- Delete faculty record
    DELETE FROM public.faculty WHERE id = p_target_id;

  ELSE
    RAISE EXCEPTION 'Invalid entity type: %. Must be student or faculty', p_entity_type;
  END IF;

  v_deleted_counts := jsonb_build_object(
    'attendance_records', v_att_records_count,
    'attendance_sessions', v_att_sessions_count,
    'marks', v_marks_count,
    'assessments', v_assessments_count,
    'quizzes', v_quizzes_count,
    'quiz_results', v_quiz_results_count,
    'assignments', v_assignments_count,
    'submissions', v_submissions_count,
    'messages', v_messages_count,
    'notifications', v_notifs_count
  );

  -- 3. Audit Log Entry
  INSERT INTO public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_name,
    'super_admin',
    'PERMANENT_DELETE',
    p_entity_type,
    p_target_id,
    jsonb_build_object(
      'name', v_target_name,
      'identifier', v_target_identifier,
      'email', v_target_email,
      'status', v_target_status,
      'department', v_dept_name,
      'auth_user_id', v_target_user_id
    ),
    jsonb_build_object(
      'action', 'PERMANENT_DELETE',
      'purged_records', v_deleted_counts,
      'performed_by', v_actor_name
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'entity_id', p_target_id,
    'entity_type', p_entity_type,
    'target_name', v_target_name,
    'target_identifier', v_target_identifier,
    'auth_user_id', v_target_user_id,
    'purged_records', v_deleted_counts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.permanent_delete_archived_account(UUID, TEXT, UUID) TO authenticated, anon;

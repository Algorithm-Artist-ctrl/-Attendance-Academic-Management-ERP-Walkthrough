-- ==============================================================================
-- Migration 047: Fix Permanent Delete Cascade Schema & Activate 1st Year Structure
-- Resolves column "sender_id" does not exist error by aligning with real schema
-- Activates 1st Year and Semesters 1 & 2 for Super Admin academic management
-- ==============================================================================

-- 1. Ensure enrollment_number exists on public.students with unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'enrollment_number'
  ) THEN
    ALTER TABLE public.students ADD COLUMN enrollment_number VARCHAR(100);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_enrollment_number_unique 
ON public.students(enrollment_number) 
WHERE enrollment_number IS NOT NULL;

-- 2. Reactivate 1st Year Academic Year & Semesters for active programs (e.g. B.Tech CSE)
UPDATE public.academic_years 
SET active = true 
WHERE year_number = 1;

UPDATE public.semesters 
SET active = true 
WHERE semester_number IN (1, 2);

-- 3. Replace public.permanent_delete_archived_account with correct schema columns
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
  v_history_count INT := 0;
  v_leaves_count INT := 0;
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

  -- 2. Entity Validation & Deletion
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

    -- Count dependencies before cascade using authoritative schema columns
    SELECT COUNT(*) INTO v_att_records_count FROM public.attendance_records WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_marks_count FROM public.sessional_marks WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_quiz_results_count FROM public.quiz_results WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_submissions_count FROM public.assignment_submissions WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_history_count FROM public.student_academic_history WHERE student_id = p_target_id;
    SELECT COUNT(*) INTO v_leaves_count FROM public.leave_applications WHERE student_id = p_target_id;

    IF v_target_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_messages_count FROM public.messages 
      WHERE sender_user_id = v_target_user_id OR receiver_user_id = v_target_user_id OR student_id = p_target_id;
      
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications 
      WHERE recipient_user_id = v_target_user_id OR recipient_student_id = p_target_id;
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
      DELETE FROM public.group_messages WHERE sender_user_id = v_target_user_id;
      DELETE FROM public.messages WHERE sender_user_id = v_target_user_id OR receiver_user_id = v_target_user_id OR student_id = p_target_id;
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

    -- Count dependencies using authoritative schema columns
    SELECT COUNT(*) INTO v_att_sessions_count FROM public.attendance_sessions WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_assessments_count FROM public.sessional_assessments WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_quizzes_count FROM public.quizzes WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_assignments_count FROM public.assignments WHERE faculty_id = p_target_id;
    
    IF v_target_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_messages_count FROM public.messages 
      WHERE sender_user_id = v_target_user_id OR receiver_user_id = v_target_user_id OR faculty_id = p_target_id;
      
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications 
      WHERE recipient_user_id = v_target_user_id OR recipient_faculty_id = p_target_id;
    ELSE
      SELECT COUNT(*) INTO v_messages_count FROM public.messages WHERE faculty_id = p_target_id;
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications WHERE recipient_faculty_id = p_target_id;
    END IF;

    -- Nullify references in non-cascade tables to preserve institutional and student history
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
      DELETE FROM public.group_messages WHERE sender_user_id = v_target_user_id;
      DELETE FROM public.messages WHERE sender_user_id = v_target_user_id OR receiver_user_id = v_target_user_id OR faculty_id = p_target_id;
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
    'target_auth_user_id', v_target_user_id,
    'purged_records', v_deleted_counts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.permanent_delete_archived_account(UUID, TEXT, UUID) TO authenticated, anon;

-- 5. Update prevent_student_academic_manipulation to allow service_role and backend executions
CREATE OR REPLACE FUNCTION public.prevent_student_academic_manipulation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
BEGIN
    -- Allow service_role key operations, direct database/superuser connections, and backend jobs unconditionally
    IF auth.role() = 'service_role' OR auth.uid() IS NULL OR current_user IN ('postgres', 'supabase_admin') THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    SELECT role INTO v_caller_role 
    FROM public.profiles 
    WHERE id = auth.uid();

    -- Super admins and HODs are allowed to manage academic records
    IF v_caller_role IN ('super_admin'::user_role, 'hod'::user_role) THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- Non-privileged users (e.g. students) CANNOT delete student records
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Unauthorized: Students cannot delete student records.';
    END IF;

    -- Non-privileged users CANNOT modify academic columns
    IF TG_OP = 'UPDATE' THEN
        IF NEW.roll_number IS DISTINCT FROM OLD.roll_number THEN
            RAISE EXCEPTION 'Unauthorized: Roll number cannot be modified.';
        END IF;
        IF NEW.enrollment_number IS DISTINCT FROM OLD.enrollment_number THEN
            RAISE EXCEPTION 'Unauthorized: Enrollment number cannot be modified.';
        END IF;
        IF NEW.section_id IS DISTINCT FROM OLD.section_id THEN
            RAISE EXCEPTION 'Unauthorized: Section assignment cannot be modified.';
        END IF;
        IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
            RAISE EXCEPTION 'Unauthorized: Department cannot be modified.';
        END IF;
        IF NEW.academic_year_id IS DISTINCT FROM OLD.academic_year_id THEN
            RAISE EXCEPTION 'Unauthorized: Academic year cannot be modified.';
        END IF;
        IF NEW.semester_id IS DISTINCT FROM OLD.semester_id THEN
            RAISE EXCEPTION 'Unauthorized: Semester cannot be modified.';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Unauthorized: Student status cannot be modified.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 6. Update prevent_profile_role_escalation to allow service_role and backend executions
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
BEGIN
    -- Allow service_role key operations, direct database/superuser connections, and backend jobs unconditionally
    IF auth.role() = 'service_role' OR auth.uid() IS NULL OR current_user IN ('postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    -- Query caller's existing DB role directly
    SELECT role INTO v_caller_role 
    FROM public.profiles 
    WHERE id = auth.uid();

    -- Super admins are allowed to modify all fields
    IF v_caller_role = 'super_admin'::user_role THEN
        RETURN NEW;
    END IF;

    -- Non-super-admins CANNOT modify role
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Administrators can modify user roles.';
    END IF;

    -- Non-super-admins CANNOT modify status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Administrators can modify account status.';
    END IF;

    -- Non-super-admins CANNOT modify department
    IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
        RAISE EXCEPTION 'Unauthorized: Department assignment cannot be modified.';
    END IF;

    -- Non-super-admins CANNOT modify student link
    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
        RAISE EXCEPTION 'Unauthorized: Student link cannot be modified.';
    END IF;

    -- Non-super-admins CANNOT modify faculty link
    IF NEW.faculty_id IS DISTINCT FROM OLD.faculty_id THEN
        RAISE EXCEPTION 'Unauthorized: Faculty link cannot be modified.';
    END IF;

    RETURN NEW;
END;
$$;

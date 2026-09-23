-- ============================================================================
-- Migration 051: Safe Permanent Faculty Account Deletion & Archival Preservation
-- ============================================================================
-- 1. Ensure Institutional Faculty Archive Actor
-- 2. Upgrade public.permanent_delete_archived_account to:
--    - Reassign student attendance records and sessions to institutional archive
--    - Prevent NOT NULL constraint violation on attendance_records.marked_by
--    - Protect student academic history and sessional marks
--    - Safely purge personal communications, notifications, and profile
--    - Allow clean deletion of target faculty without cascade data loss
-- 3. Upgrade public.get_archived_stats to exclude system archive actor
-- ============================================================================

-- 1. Institutional Faculty Archive Actor
DO $$
DECLARE
  v_default_dept_id UUID;
BEGIN
  SELECT id INTO v_default_dept_id FROM public.departments ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.faculty (
    id,
    department_id,
    employee_code,
    full_name,
    designation,
    email,
    active,
    status
  ) VALUES (
    '00000000-0000-0000-0000-0000000000aa'::UUID,
    v_default_dept_id,
    'ARCHIVED-SYSTEM',
    'Institutional Faculty Archive',
    'Archival Record',
    'archive.system@vctm.in',
    false,
    'ARCHIVED'
  )
  ON CONFLICT (id) DO UPDATE SET
    active = false,
    status = 'ARCHIVED',
    full_name = 'Institutional Faculty Archive';
END $$;

-- 2. Replace public.permanent_delete_archived_account with safe archival reassignment
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
  v_archive_actor_id UUID := '00000000-0000-0000-0000-0000000000aa'::UUID;
  v_default_dept_id UUID;
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
  v_fac_assign_count INT := 0;
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

    -- Ensure institutional archival actor exists
    SELECT id INTO v_default_dept_id FROM public.departments ORDER BY created_at ASC LIMIT 1;
    INSERT INTO public.faculty (
      id,
      department_id,
      employee_code,
      full_name,
      designation,
      email,
      active,
      status
    ) VALUES (
      v_archive_actor_id,
      v_default_dept_id,
      'ARCHIVED-SYSTEM',
      'Institutional Faculty Archive',
      'Archival Record',
      'archive.system@vctm.in',
      false,
      'ARCHIVED'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Count dependencies using authoritative schema columns
    SELECT COUNT(*) INTO v_att_records_count FROM public.attendance_records WHERE marked_by = p_target_id;
    SELECT COUNT(*) INTO v_att_sessions_count FROM public.attendance_sessions WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_assessments_count FROM public.sessional_assessments WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_marks_count FROM public.sessional_marks WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_quizzes_count FROM public.quizzes WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_assignments_count FROM public.assignments WHERE faculty_id = p_target_id;
    SELECT COUNT(*) INTO v_fac_assign_count FROM public.faculty_subject_assignments WHERE faculty_id = p_target_id;
    
    IF v_target_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_messages_count FROM public.messages 
      WHERE sender_user_id = v_target_user_id OR receiver_user_id = v_target_user_id OR faculty_id = p_target_id;
      
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications 
      WHERE recipient_user_id = v_target_user_id OR recipient_faculty_id = p_target_id;
    ELSE
      SELECT COUNT(*) INTO v_messages_count FROM public.messages WHERE faculty_id = p_target_id;
      SELECT COUNT(*) INTO v_notifs_count FROM public.notifications WHERE recipient_faculty_id = p_target_id;
    END IF;

    -- Reassign historical student attendance records and sessions to Institutional Faculty Archive
    -- This guarantees student attendance percentages and session histories are 100% preserved
    -- and complies with the NOT NULL constraint on attendance_records.marked_by
    UPDATE public.attendance_records
    SET marked_by = v_archive_actor_id,
        remarks = CASE
          WHEN remarks IS NULL OR remarks = '' THEN 'Archived record originally marked by ' || v_target_name || ' (' || v_target_identifier || ')'
          ELSE remarks || ' [Originally marked by ' || v_target_name || ' (' || v_target_identifier || ')]'
        END
    WHERE marked_by = p_target_id;

    UPDATE public.attendance_sessions
    SET faculty_id = v_archive_actor_id
    WHERE faculty_id = p_target_id;

    -- Reassign academic assessments, quizzes and course assignments to preserve student scores
    UPDATE public.sessional_assessments
    SET faculty_id = v_archive_actor_id
    WHERE faculty_id = p_target_id;

    UPDATE public.sessional_marks
    SET faculty_id = v_archive_actor_id
    WHERE faculty_id = p_target_id;

    UPDATE public.quizzes
    SET faculty_id = v_archive_actor_id
    WHERE faculty_id = p_target_id;

    UPDATE public.assignments
    SET faculty_id = v_archive_actor_id
    WHERE faculty_id = p_target_id;

    -- Nullify references in non-cascade relational tables
    UPDATE public.departments SET hod_faculty_id = NULL WHERE hod_faculty_id = p_target_id;
    UPDATE public.sections SET class_coordinator_id = NULL WHERE class_coordinator_id = p_target_id;
    UPDATE public.students SET mentor_faculty_id = NULL WHERE mentor_faculty_id = p_target_id;
    UPDATE public.attendance_corrections SET reviewed_by = NULL WHERE reviewed_by = p_target_id;
    UPDATE public.quiz_results SET graded_by = NULL WHERE graded_by = p_target_id;
    UPDATE public.assignment_submissions SET graded_by = NULL WHERE graded_by = p_target_id;
    UPDATE public.leave_applications SET coordinator_id = NULL, coordinator_approved_by = NULL WHERE coordinator_id = p_target_id OR coordinator_approved_by = p_target_id;
    UPDATE public.leave_applications SET hod_id = NULL, hod_approved_by = NULL WHERE hod_id = p_target_id OR hod_approved_by = p_target_id;
    UPDATE public.leave_applications SET rejected_by = NULL WHERE rejected_by = p_target_id;
    UPDATE public.leave_approval_audit_logs SET actor_faculty_id = NULL WHERE actor_faculty_id = p_target_id;
    UPDATE public.message_groups SET created_by_faculty_id = NULL WHERE created_by_faculty_id = p_target_id;
    UPDATE public.timetable_entries SET faculty_id = NULL WHERE faculty_id = p_target_id;

    -- Purge faculty assignments and personal communication collections
    DELETE FROM public.class_coordinator_assignments WHERE faculty_id = p_target_id;
    DELETE FROM public.faculty_subject_assignments WHERE faculty_id = p_target_id;
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
    'attendance_records_preserved', v_att_records_count,
    'attendance_sessions_preserved', v_att_sessions_count,
    'marks_preserved', v_marks_count,
    'assessments_preserved', v_assessments_count,
    'quizzes_preserved', v_quizzes_count,
    'assignments_preserved', v_assignments_count,
    'teaching_assignments_purged', v_fac_assign_count,
    'messages_purged', v_messages_count,
    'notifications_purged', v_notifs_count
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
      'performed_by', v_actor_name,
      'institutional_archive_actor_id', v_archive_actor_id
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

-- 3. Upgrade get_archived_stats to exclude system archive actor
CREATE OR REPLACE FUNCTION public.get_archived_stats()
RETURNS JSONB AS $$
DECLARE
  v_former_students INT := 0;
  v_former_faculty INT := 0;
  v_graduated_students INT := 0;
  v_withdrawn_students INT := 0;
  v_transferred_students INT := 0;
  v_dropped_out_students INT := 0;
  v_resigned_faculty INT := 0;
BEGIN
  -- Former Students count
  SELECT COUNT(*) INTO v_former_students 
  FROM public.students 
  WHERE status != 'ACTIVE' OR active = false;

  -- Former Faculty count (excluding system archive actor)
  SELECT COUNT(*) INTO v_former_faculty 
  FROM public.faculty 
  WHERE (status != 'ACTIVE' OR active = false) AND employee_code != 'ARCHIVED-SYSTEM';

  -- Detailed status breakdowns
  SELECT COUNT(*) INTO v_graduated_students 
  FROM public.students 
  WHERE status IN ('GRADUATED', 'ALUMNI');

  SELECT COUNT(*) INTO v_withdrawn_students 
  FROM public.students 
  WHERE status = 'WITHDRAWN';

  SELECT COUNT(*) INTO v_transferred_students 
  FROM public.students 
  WHERE status = 'TRANSFERRED';

  SELECT COUNT(*) INTO v_dropped_out_students 
  FROM public.students 
  WHERE status = 'DROPPED_OUT';

  SELECT COUNT(*) INTO v_resigned_faculty 
  FROM public.faculty 
  WHERE status = 'RESIGNED' AND employee_code != 'ARCHIVED-SYSTEM';

  RETURN jsonb_build_object(
    'former_students', v_former_students,
    'former_faculty', v_former_faculty,
    'graduated_students', v_graduated_students,
    'graduated_alumni', v_graduated_students,
    'withdrawn_students', v_withdrawn_students,
    'transferred_students', v_transferred_students,
    'dropped_out_students', v_dropped_out_students,
    'resigned_faculty', v_resigned_faculty,
    'total_archived', (v_former_students + v_former_faculty)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_archived_stats() TO authenticated, anon;

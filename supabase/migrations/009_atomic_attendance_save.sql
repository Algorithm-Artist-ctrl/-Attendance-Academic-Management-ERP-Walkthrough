-- ==============================================================================
-- Migration 009: Atomic Attendance Save RPC & Transactional Validation
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.save_attendance_session(
    p_timetable_entry_id UUID,
    p_faculty_id UUID,
    p_section_id UUID,
    p_subject_id UUID,
    p_session_date DATE,
    p_start_time TIME DEFAULT '09:00:00'::TIME,
    p_end_time TIME DEFAULT '09:50:00'::TIME,
    p_records JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_caller_role public.user_role;
    v_caller_faculty_id UUID;
    v_caller_dept_id UUID;
    v_tt_entry RECORD;
    v_active_student_ids UUID[];
    v_expected_count INT;
    v_payload_student_count INT;
    v_session_id UUID;
    v_rec RECORD;
    v_rec_student_id UUID;
    v_rec_status TEXT;
    v_actual_record_count INT;
    v_present_count INT;
    v_absent_count INT;
    v_actor_name TEXT;
BEGIN
    -- 1. VALIDATE AUTHENTICATED USER
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthenticated request. Active Supabase session required.';
    END IF;

    -- Resolve caller role
    IF auth.role() = 'service_role' THEN
        v_caller_role := 'super_admin'::public.user_role;
    ELSE
        v_caller_role := public.current_user_role();
        IF v_caller_role IS NULL THEN
            SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_user_id;
        END IF;
    END IF;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User profile has no assigned institutional role.';
    END IF;

    IF v_caller_role = 'student'::public.user_role THEN
        RAISE EXCEPTION 'Unauthorized: Students are strictly forbidden from recording attendance.';
    END IF;

    -- 2. VALIDATE FACULTY AUTHORIZATION
    IF v_caller_role = 'faculty'::public.user_role THEN
        v_caller_faculty_id := public.current_user_faculty_id();
        IF v_caller_faculty_id IS NULL THEN
            SELECT faculty_id INTO v_caller_faculty_id FROM public.profiles WHERE id = v_user_id;
        END IF;
        IF v_caller_faculty_id IS NULL AND EXISTS (SELECT 1 FROM public.faculty WHERE id = v_user_id) THEN
            v_caller_faculty_id := v_user_id;
        END IF;

        IF v_caller_faculty_id IS NULL OR v_caller_faculty_id != p_faculty_id THEN
            RAISE EXCEPTION 'You are not authorized to record attendance for this class.';
        END IF;
    ELSIF v_caller_role = 'hod'::public.user_role THEN
        v_caller_dept_id := public.current_user_department_id();
        IF v_caller_dept_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.faculty WHERE id = p_faculty_id AND department_id = v_caller_dept_id
            ) AND NOT EXISTS (
                SELECT 1 FROM public.sections sec
                JOIN public.semesters sem ON sem.id = sec.semester_id
                JOIN public.academic_years ay ON ay.id = sem.academic_year_id
                JOIN public.programs p ON p.id = ay.program_id
                WHERE sec.id = p_section_id AND p.department_id = v_caller_dept_id
            ) THEN
                RAISE EXCEPTION 'You are not authorized to record attendance outside your department.';
            END IF;
        END IF;
    END IF;

    -- 3. VALIDATE TIMETABLE ENTRY (If provided)
    IF p_timetable_entry_id IS NOT NULL THEN
        SELECT * INTO v_tt_entry
        FROM public.timetable_entries
        WHERE id = p_timetable_entry_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Specified timetable entry does not exist: %', p_timetable_entry_id;
        END IF;

        IF v_tt_entry.active IS FALSE THEN
            RAISE EXCEPTION 'Cannot record attendance for an archived or inactive timetable entry: %', p_timetable_entry_id;
        END IF;

        IF v_tt_entry.section_id != p_section_id THEN
            RAISE EXCEPTION 'Timetable entry section mismatch. Expected % but got %.', v_tt_entry.section_id, p_section_id;
        END IF;

        IF v_tt_entry.subject_id IS NOT NULL AND v_tt_entry.subject_id != p_subject_id THEN
            RAISE EXCEPTION 'Timetable entry subject mismatch. Expected % but got %.', v_tt_entry.subject_id, p_subject_id;
        END IF;

        IF v_caller_role = 'faculty'::public.user_role AND v_tt_entry.faculty_id IS NOT NULL AND v_tt_entry.faculty_id != p_faculty_id THEN
            RAISE EXCEPTION 'You are not authorized to record attendance for this class.';
        END IF;

        p_start_time := COALESCE(p_start_time, v_tt_entry.start_time);
        p_end_time := COALESCE(p_end_time, v_tt_entry.end_time);
    END IF;

    -- 4. VALIDATE SECTION AND SUBJECT
    IF NOT EXISTS (SELECT 1 FROM public.sections WHERE id = p_section_id AND active = true) THEN
        RAISE EXCEPTION 'Specified class section does not exist or is inactive: %', p_section_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id AND active = true) THEN
        RAISE EXCEPTION 'Specified academic subject does not exist or is inactive: %', p_subject_id;
    END IF;

    -- 5. VALIDATE DATE (No future dates allowed in IST)
    IF p_session_date > (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE THEN
        RAISE EXCEPTION 'Invalid attendance date: %. Attendance cannot be recorded for future dates.', p_session_date;
    END IF;

    -- 6. VALIDATE ENROLLED ACTIVE STUDENTS
    SELECT array_agg(id) INTO v_active_student_ids
    FROM public.students
    WHERE section_id = p_section_id AND active = true;

    v_expected_count := COALESCE(array_length(v_active_student_ids, 1), 0);
    IF v_expected_count = 0 THEN
        RAISE EXCEPTION 'No active students enrolled in section %.', p_section_id;
    END IF;

    -- Validate each record in payload
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_rec_student_id := COALESCE((v_rec.value->>'student_id')::UUID, (v_rec.value->>'studentId')::UUID);
        v_rec_status := v_rec.value->>'status';

        IF v_rec_student_id IS NULL THEN
            RAISE EXCEPTION 'Malformed attendance payload: Missing student ID.';
        END IF;

        IF v_rec_status IS NULL OR v_rec_status NOT IN ('Present', 'Absent') THEN
            RAISE EXCEPTION 'Invalid attendance status "%" for student %. Only "Present" or "Absent" are permitted.', v_rec_status, v_rec_student_id;
        END IF;

        IF NOT (v_rec_student_id = ANY(v_active_student_ids)) THEN
            RAISE EXCEPTION 'Student % is not an active student in section %.', v_rec_student_id, p_section_id;
        END IF;
    END LOOP;

    -- Ensure exact count of unique students in payload
    SELECT COUNT(DISTINCT COALESCE((rec->>'student_id')::UUID, (rec->>'studentId')::UUID))
    INTO v_payload_student_count
    FROM jsonb_array_elements(p_records) AS rec;

    IF v_payload_student_count != v_expected_count THEN
        RAISE EXCEPTION 'Incomplete attendance submission: Section % has % active students, but payload contains % distinct students.', 
            p_section_id, v_expected_count, v_payload_student_count;
    END IF;

    -- 7. CREATE OR UPDATE ATTENDANCE SESSION
    SELECT id INTO v_session_id
    FROM public.attendance_sessions
    WHERE session_date = p_session_date
      AND section_id = p_section_id
      AND subject_id = p_subject_id
      AND (
        (p_timetable_entry_id IS NOT NULL AND timetable_entry_id = p_timetable_entry_id)
        OR (p_timetable_entry_id IS NULL AND (faculty_id = p_faculty_id OR start_time = p_start_time))
      )
    LIMIT 1;

    IF v_session_id IS NOT NULL THEN
        UPDATE public.attendance_sessions
        SET timetable_entry_id = COALESCE(p_timetable_entry_id, timetable_entry_id),
            faculty_id = p_faculty_id,
            start_time = COALESCE(p_start_time, start_time),
            end_time = COALESCE(p_end_time, end_time),
            status = 'completed',
            marked_at = NOW(),
            updated_at = NOW()
        WHERE id = v_session_id;
    ELSE
        INSERT INTO public.attendance_sessions (
            timetable_entry_id,
            faculty_id,
            section_id,
            subject_id,
            session_date,
            start_time,
            end_time,
            status,
            marked_at,
            created_at,
            updated_at
        ) VALUES (
            p_timetable_entry_id,
            p_faculty_id,
            p_section_id,
            p_subject_id,
            p_session_date,
            COALESCE(p_start_time, '09:00:00'::TIME),
            COALESCE(p_end_time, '09:50:00'::TIME),
            'completed',
            NOW(),
            NOW(),
            NOW()
        ) RETURNING id INTO v_session_id;
    END IF;

    -- 8. UPSERT ATTENDANCE RECORDS (NO UNSAFE DELETE)
    INSERT INTO public.attendance_records (
        attendance_session_id,
        student_id,
        status,
        marked_by,
        marked_at,
        remarks,
        updated_at
    )
    SELECT
        v_session_id,
        COALESCE((rec->>'student_id')::UUID, (rec->>'studentId')::UUID),
        (rec->>'status')::public.attendance_status,
        p_faculty_id,
        NOW(),
        rec->>'remarks',
        NOW()
    FROM jsonb_array_elements(p_records) AS rec
    ON CONFLICT (attendance_session_id, student_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        marked_by = EXCLUDED.marked_by,
        marked_at = EXCLUDED.marked_at,
        remarks = EXCLUDED.remarks,
        updated_at = NOW();

    -- 9. VERIFY RECORD COUNT AND STATS
    SELECT COUNT(*) INTO v_actual_record_count
    FROM public.attendance_records
    WHERE attendance_session_id = v_session_id;

    IF v_actual_record_count != v_expected_count THEN
        RAISE EXCEPTION 'Attendance verification failed: Expected % records in database, but stored %.', v_expected_count, v_actual_record_count;
    END IF;

    SELECT 
        COUNT(*) FILTER (WHERE status = 'Present'::public.attendance_status),
        COUNT(*) FILTER (WHERE status = 'Absent'::public.attendance_status)
    INTO v_present_count, v_absent_count
    FROM public.attendance_records
    WHERE attendance_session_id = v_session_id;

    -- 10. WRITE AUDIT LOG
    SELECT COALESCE(full_name, 'Faculty Member') INTO v_actor_name
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_actor_name IS NULL THEN
        SELECT COALESCE(full_name, 'Faculty Member') INTO v_actor_name
        FROM public.faculty
        WHERE id = p_faculty_id;
    END IF;

    INSERT INTO public.audit_logs (
        actor_id,
        actor_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        new_values,
        created_at
    ) VALUES (
        COALESCE(v_user_id, p_faculty_id),
        COALESCE(v_actor_name, 'Faculty Member'),
        COALESCE(v_caller_role::TEXT, 'faculty'),
        'ATTENDANCE_RECORDED',
        'attendance_sessions',
        v_session_id,
        jsonb_build_object(
            'sessionDate', p_session_date,
            'sectionId', p_section_id,
            'subjectId', p_subject_id,
            'timetableEntryId', p_timetable_entry_id,
            'totalRecords', v_actual_record_count,
            'presentCount', v_present_count,
            'absentCount', v_absent_count
        ),
        NOW()
    );

    -- 11. RETURN TRANSACTION RESULT
    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'record_count', v_actual_record_count,
        'present_count', v_present_count,
        'absent_count', v_absent_count
    );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.save_attendance_session TO authenticated, service_role;

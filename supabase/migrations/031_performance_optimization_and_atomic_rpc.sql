-- ==============================================================================
-- Migration 031: Performance Composite Indexes & Fast Atomic Attendance RPC
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. HOT PERFORMANCE COMPOSITE INDEXES
CREATE INDEX IF NOT EXISTS idx_sessional_assessments_sec_sub 
    ON public.sessional_assessments(section_id, subject_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_sec_date 
    ON public.attendance_sessions(section_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_section_active 
    ON public.assignments(section_id, active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quizzes_section_active 
    ON public.quizzes(section_id, active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created 
    ON public.group_messages(group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
    ON public.messages(conversation_id, created_at DESC);

-- 2. UPGRADED ATOMIC ATTENDANCE RPC (SINGLE ROUND TRIP EXECUTION)
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
    v_total_enrolled_count INT;
    v_session_id UUID;
    v_rec RECORD;
    v_rec_student_id UUID;
    v_rec_status TEXT;
    v_rec_remarks TEXT;
    v_actual_record_count INT;
    v_present_count INT;
    v_absent_count INT;
    v_actor_name TEXT;
    v_session_json JSONB;
    v_records_json JSONB;
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
            SELECT profiles.role INTO v_caller_role FROM public.profiles WHERE id = v_user_id;
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
            SELECT profiles.faculty_id INTO v_caller_faculty_id FROM public.profiles WHERE id = v_user_id;
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

    -- 6. VALIDATE ACTIVE STUDENTS IN SECTION
    SELECT array_agg(id) INTO v_active_student_ids
    FROM public.students
    WHERE section_id = p_section_id AND active = true;

    v_total_enrolled_count := COALESCE(array_length(v_active_student_ids, 1), 0);
    IF v_total_enrolled_count = 0 THEN
        RAISE EXCEPTION 'No active students enrolled in section %.', p_section_id;
    END IF;

    -- 7. RESOLVE OR CREATE ATTENDANCE SESSION (PREVENT DUPLICATES)
    SELECT id INTO v_session_id
    FROM public.attendance_sessions
    WHERE session_date = p_session_date
      AND section_id = p_section_id
      AND subject_id = p_subject_id
      AND (
        (p_timetable_entry_id IS NOT NULL AND timetable_entry_id = p_timetable_entry_id)
        OR (start_time IS NOT DISTINCT FROM p_start_time)
      )
    ORDER BY (timetable_entry_id = p_timetable_entry_id) DESC, created_at DESC
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

    -- 8. PROCESS STUDENT RECORDS (UPSERT PRESENT/ABSENT, REMOVE UNMARKED)
    FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_rec_student_id := COALESCE((v_rec.value->>'student_id')::UUID, (v_rec.value->>'studentId')::UUID);
        v_rec_status := v_rec.value->>'status';
        v_rec_remarks := v_rec.value->>'remarks';

        IF v_rec_student_id IS NULL THEN
            RAISE EXCEPTION 'Malformed attendance payload: Missing student ID.';
        END IF;

        IF NOT (v_rec_student_id = ANY(v_active_student_ids)) THEN
            RAISE EXCEPTION 'Student % is not an active student in section %.', v_rec_student_id, p_section_id;
        END IF;

        IF v_rec_status IN ('Present', 'Absent') THEN
            INSERT INTO public.attendance_records (
                attendance_session_id,
                student_id,
                status,
                marked_by,
                marked_at,
                remarks,
                updated_at
            ) VALUES (
                v_session_id,
                v_rec_student_id,
                v_rec_status::public.attendance_status,
                p_faculty_id,
                NOW(),
                v_rec_remarks,
                NOW()
            )
            ON CONFLICT (attendance_session_id, student_id)
            DO UPDATE SET
                status = EXCLUDED.status,
                marked_by = EXCLUDED.marked_by,
                marked_at = EXCLUDED.marked_at,
                remarks = EXCLUDED.remarks,
                updated_at = NOW();
        ELSIF v_rec_status = 'Unmarked' THEN
            DELETE FROM public.attendance_records
            WHERE attendance_session_id = v_session_id
              AND student_id = v_rec_student_id;
        ELSE
            RAISE EXCEPTION 'Invalid attendance status "%" for student %. Only "Present", "Absent", or "Unmarked" are permitted.', 
                v_rec_status, v_rec_student_id;
        END IF;
    END LOOP;

    -- 9. DERIVE ACCURATE LIVE COUNTS FROM DATABASE
    SELECT 
        COUNT(*) FILTER (WHERE status = 'Present'::public.attendance_status),
        COUNT(*) FILTER (WHERE status = 'Absent'::public.attendance_status),
        COUNT(*)
    INTO v_present_count, v_absent_count, v_actual_record_count
    FROM public.attendance_records
    WHERE attendance_session_id = v_session_id;

    -- 10. WRITE AUDIT LOG
    SELECT COALESCE(profiles.full_name, 'Faculty Member') INTO v_actor_name
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
            'presentCount', v_present_count,
            'absentCount', v_absent_count,
            'totalEnrolled', v_total_enrolled_count,
            'recordCount', v_actual_record_count
        ),
        NOW()
    );

    -- 11. FETCH THE PERSISTED SESSION & RECORDS FOR DIRECT ATOMIC RETURN
    SELECT to_jsonb(s) INTO v_session_json
    FROM public.attendance_sessions s
    WHERE s.id = v_session_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_records_json
    FROM public.attendance_records r
    WHERE r.attendance_session_id = v_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'session', v_session_json,
        'records', v_records_json,
        'present_count', v_present_count,
        'absent_count', v_absent_count,
        'unmarked_count', (v_total_enrolled_count - v_present_count - v_absent_count),
        'total_enrolled', v_total_enrolled_count,
        'record_count', v_actual_record_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_attendance_session TO authenticated, service_role;

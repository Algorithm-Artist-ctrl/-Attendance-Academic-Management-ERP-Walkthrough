-- ==============================================================================
-- Migration 010: Student Attendance Claim Window Enforcement & Atomic Protection
-- Vivekananda College of Technology & Management (VCTM) ERP
-- Allowed Student Claim Window: 09:00:00 AM -> 03:40:00 PM IST (Asia/Kolkata)
-- ==============================================================================

-- 1. Create partial unique index to prevent duplicate pending/approved claims
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_corrections_pending_active
ON public.attendance_corrections (attendance_record_id, student_id)
WHERE status IN ('pending', 'approved');

-- 2. Create authoritative, atomic claim_attendance RPC function
CREATE OR REPLACE FUNCTION public.claim_attendance(
    p_timetable_entry_id UUID,
    p_student_id UUID,
    p_reason TEXT,
    p_requested_status public.attendance_status DEFAULT 'Present'::public.attendance_status,
    p_simulated_time TIME DEFAULT NULL,
    p_simulated_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_service_role BOOLEAN;
    v_caller_role public.user_role;
    v_now_ist TIMESTAMP;
    v_now_time TIME;
    v_today_date DATE;
    v_today_dow TEXT;
    v_student RECORD;
    v_tt_entry RECORD;
    v_session_id UUID;
    v_record_id UUID;
    v_correction_id UUID;
    v_existing_claim RECORD;
    v_existing_record RECORD;
BEGIN
    -- 1. Resolve Server Time in Asia/Kolkata (IST)
    v_now_ist := (NOW() AT TIME ZONE 'Asia/Kolkata');
    v_is_service_role := (auth.role() = 'service_role' OR session_user = 'postgres');

    -- Only service_role in automated test harness can simulate clock boundaries
    IF v_is_service_role AND p_simulated_time IS NOT NULL THEN
        v_now_time := p_simulated_time;
    ELSE
        v_now_time := v_now_ist::TIME;
    END IF;

    IF v_is_service_role AND p_simulated_date IS NOT NULL THEN
        v_today_date := p_simulated_date;
    ELSE
        v_today_date := v_now_ist::DATE;
    END IF;

    -- Map day of week (MON, TUE, WED, THU, FRI, SAT, SUN)
    v_today_dow := UPPER(TO_CHAR(v_today_date, 'Dy'));

    -- 2. Enforce Daily Claim Time Window: 09:00:00 AM -> 03:40:00 PM IST
    IF v_now_time < '09:00:00'::TIME THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ATTENDANCE_CLAIM_NOT_OPEN',
            'message', 'Attendance claim window has not opened yet. Claims are accepted only between 09:00 AM and 03:40 PM IST.',
            'current_time_ist', to_char(v_now_time, 'HH24:MI:SS'),
            'allowed_window', '09:00:00 - 15:40:00'
        );
    END IF;

    IF v_now_time >= '15:40:00'::TIME THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ATTENDANCE_CLAIM_WINDOW_CLOSED',
            'message', 'Attendance claim window closed at 03:40 PM. Claims are strictly forbidden after 03:40 PM IST.',
            'current_time_ist', to_char(v_now_time, 'HH24:MI:SS'),
            'allowed_window', '09:00:00 - 15:40:00'
        );
    END IF;

    -- 3. Validate Authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND NOT v_is_service_role THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Unauthenticated request. Active Supabase session required.'
        );
    END IF;

    -- 4. Validate Student Profile
    SELECT * INTO v_student
    FROM public.students
    WHERE id = p_student_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'STUDENT_NOT_FOUND',
            'message', 'Student record not found.'
        );
    END IF;

    -- Authorization: Student can only submit claim for themselves
    IF NOT v_is_service_role THEN
        v_caller_role := public.current_user_role();
        IF v_caller_role = 'student'::public.user_role THEN
            IF v_student.id != v_user_id AND v_student.user_id != v_user_id THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = v_user_id AND (student_id = v_student.id OR id = v_student.id)
                ) THEN
                    RETURN jsonb_build_object(
                        'success', false,
                        'code', 'UNAUTHORIZED_STUDENT',
                        'message', 'Unauthorized: You cannot claim attendance on behalf of another student.'
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    -- 5. Validate Timetable Entry
    SELECT * INTO v_tt_entry
    FROM public.timetable_entries
    WHERE id = p_timetable_entry_id AND active = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'TIMETABLE_ENTRY_NOT_FOUND',
            'message', 'Active timetable entry not found.'
        );
    END IF;

    -- 6. Disallow Non-Instructional Slots (Lunch, Sports, No-Subject)
    IF v_tt_entry.lecture_type IN ('Lunch'::public.lecture_type, 'Sports'::public.lecture_type) 
       OR v_tt_entry.subject_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ATTENDANCE_NOT_APPLICABLE',
            'message', 'Attendance claim is not applicable for lunch, break, or non-instructional slots.'
        );
    END IF;

    -- 7. Day of Week Verification: Must be scheduled for Today
    IF v_tt_entry.day_of_week::text != v_today_dow THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CLAIM_DAY_MISMATCH',
            'message', format('This class is scheduled for %s, not today (%s). Attendance claims are only permitted for today.', v_tt_entry.day_of_week, v_today_dow)
        );
    END IF;

    -- 8. Validate Student Section Alignment
    IF v_student.section_id != v_tt_entry.section_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'SECTION_MISMATCH',
            'message', 'Student does not belong to the enrolled section for this timetable lecture.'
        );
    END IF;

    -- 9. Find or Create Attendance Session for Today
    SELECT id INTO v_session_id
    FROM public.attendance_sessions
    WHERE session_date = v_today_date
      AND (
        timetable_entry_id = v_tt_entry.id 
        OR (section_id = v_tt_entry.section_id AND subject_id = v_tt_entry.subject_id AND start_time = v_tt_entry.start_time)
      )
    LIMIT 1;

    IF v_session_id IS NULL THEN
        INSERT INTO public.attendance_sessions (
            timetable_entry_id,
            faculty_id,
            section_id,
            subject_id,
            session_date,
            start_time,
            end_time,
            status
        ) VALUES (
            v_tt_entry.id,
            v_tt_entry.faculty_id,
            v_tt_entry.section_id,
            v_tt_entry.subject_id,
            v_today_date,
            v_tt_entry.start_time,
            v_tt_entry.end_time,
            'pending'
        ) RETURNING id INTO v_session_id;
    END IF;

    -- 10. Check Existing Attendance Record
    SELECT * INTO v_existing_record
    FROM public.attendance_records
    WHERE attendance_session_id = v_session_id
      AND student_id = v_student.id;

    IF FOUND THEN
        v_record_id := v_existing_record.id;
        IF v_existing_record.status = 'Present'::public.attendance_status THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ATTENDANCE_ALREADY_PRESENT',
                'message', 'Attendance for this lecture is already marked Present in the database.',
                'record_id', v_record_id,
                'status', 'Present'
            );
        END IF;
    ELSE
        -- Create unrecorded record with Absent status so claim can be reviewed
        INSERT INTO public.attendance_records (
            attendance_session_id,
            student_id,
            status,
            marked_by,
            remarks
        ) VALUES (
            v_session_id,
            v_student.id,
            'Absent'::public.attendance_status,
            v_tt_entry.faculty_id,
            'Attendance claim initiated by student'
        ) RETURNING id INTO v_record_id;
    END IF;

    -- 11. Check Existing Claim (Duplicate Protection)
    SELECT * INTO v_existing_claim
    FROM public.attendance_corrections
    WHERE attendance_record_id = v_record_id
      AND student_id = v_student.id
      AND status IN ('pending', 'approved');

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CLAIM_ALREADY_SUBMITTED',
            'message', format('An attendance claim has already been submitted for this lecture (Status: %s).', UPPER(v_existing_claim.status::TEXT)),
            'claim_id', v_existing_claim.id,
            'claim_status', v_existing_claim.status
        );
    END IF;

    -- 12. Insert Attendance Claim into attendance_corrections
    INSERT INTO public.attendance_corrections (
        attendance_record_id,
        student_id,
        requested_status,
        reason,
        status
    ) VALUES (
        v_record_id,
        v_student.id,
        p_requested_status,
        TRIM(p_reason),
        'pending'::public.correction_status
    ) RETURNING id INTO v_correction_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', 'CLAIM_SUBMITTED',
        'message', 'Attendance claim submitted successfully. It has been routed to the assigned faculty member.',
        'claim_id', v_correction_id,
        'session_id', v_session_id,
        'record_id', v_record_id
    );
END;
$$;

-- 3. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.claim_attendance TO authenticated, service_role;

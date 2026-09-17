-- ==============================================================================
-- Migration 018: Atomic Attendance Claim, Faculty Approval & Rejection RPCs
-- Vivekananda College of Technology & Management (VCTM) ERP
-- Fixes student auth reference, provides atomic approval/rejection transactions
-- ==============================================================================

-- 1. Drop existing claim_attendance function to allow updated parameter signatures
DROP FUNCTION IF EXISTS public.claim_attendance(UUID, UUID, TEXT, public.attendance_status, TIME, DATE);
DROP FUNCTION IF EXISTS public.claim_attendance;

-- 2. Create authoritative, atomic claim_attendance RPC function
CREATE OR REPLACE FUNCTION public.claim_attendance(
    p_timetable_entry_id UUID DEFAULT NULL,
    p_student_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_requested_status public.attendance_status DEFAULT 'Present'::public.attendance_status,
    p_simulated_time TIME DEFAULT NULL,
    p_simulated_date DATE DEFAULT NULL,
    p_attendance_record_id UUID DEFAULT NULL
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
    v_session RECORD;
    v_session_id UUID;
    v_record_id UUID;
    v_correction_id UUID;
    v_existing_claim RECORD;
    v_existing_record RECORD;
BEGIN
    -- 1. Resolve Server Time in Asia/Kolkata (IST)
    v_now_ist := (NOW() AT TIME ZONE 'Asia/Kolkata');
    v_is_service_role := (auth.role() = 'service_role' OR session_user = 'postgres');

    -- Simulation for test harnesses & validation
    IF p_simulated_time IS NOT NULL THEN
        v_now_time := p_simulated_time;
    ELSE
        v_now_time := v_now_ist::TIME;
    END IF;

    IF p_simulated_date IS NOT NULL THEN
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
    -- Check student.id, student.auth_user_id, or profiles.student_id
    IF NOT v_is_service_role THEN
        v_caller_role := public.current_user_role();
        IF v_caller_role = 'student'::public.user_role THEN
            IF v_student.id != v_user_id AND (v_student.auth_user_id IS NULL OR v_student.auth_user_id != v_user_id) THEN
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

    -- 5. Resolve Attendance Record and Session
    IF p_attendance_record_id IS NOT NULL THEN
        -- Path A: Directly claiming an existing attendance record
        SELECT * INTO v_existing_record
        FROM public.attendance_records
        WHERE id = p_attendance_record_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'RECORD_NOT_FOUND',
                'message', 'Target attendance record not found.'
            );
        END IF;

        IF v_existing_record.student_id != v_student.id THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'RECORD_STUDENT_MISMATCH',
                'message', 'Target attendance record belongs to a different student.'
            );
        END IF;

        SELECT * INTO v_session
        FROM public.attendance_sessions
        WHERE id = v_existing_record.attendance_session_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'SESSION_NOT_FOUND',
                'message', 'Attendance session for this record not found.'
            );
        END IF;

        IF v_session.session_date != v_today_date THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'CLAIM_DAY_MISMATCH',
                'message', format('This session was recorded on %s, not today (%s). Attendance claims are only permitted for today.', v_session.session_date, v_today_date)
            );
        END IF;

        v_session_id := v_session.id;
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
        -- Path B: Claiming via Timetable Entry
        IF p_timetable_entry_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'MISSING_TARGET',
                'message', 'Either attendance_record_id or timetable_entry_id must be provided.'
            );
        END IF;

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

        -- Disallow Non-Instructional Slots (Lunch, Sports, No-Subject)
        IF v_tt_entry.lecture_type IN ('Lunch'::public.lecture_type, 'Sports'::public.lecture_type) 
           OR v_tt_entry.subject_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ATTENDANCE_NOT_APPLICABLE',
                'message', 'Attendance claim is not applicable for lunch, break, or non-instructional slots.'
            );
        END IF;

        -- Day of Week Verification: Must be scheduled for Today
        IF v_tt_entry.day_of_week::text != v_today_dow THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'CLAIM_DAY_MISMATCH',
                'message', format('This class is scheduled for %s, not today (%s). Attendance claims are only permitted for today.', v_tt_entry.day_of_week, v_today_dow)
            );
        END IF;

        -- Validate Student Section Alignment
        IF v_student.section_id != v_tt_entry.section_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'SECTION_MISMATCH',
                'message', 'Student does not belong to the enrolled section for this timetable lecture.'
            );
        END IF;

        -- Find or Create Attendance Session for Today
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

        -- Check Existing Attendance Record
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
    END IF;

    -- 6. Check Existing Claim (Duplicate Protection)
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

    -- 7. Insert Attendance Claim into attendance_corrections
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

GRANT EXECUTE ON FUNCTION public.claim_attendance TO authenticated, service_role;


-- 3. Create Atomic approve_attendance_claim RPC
CREATE OR REPLACE FUNCTION public.approve_attendance_claim(
    p_claim_id UUID,
    p_faculty_id UUID,
    p_remarks TEXT DEFAULT NULL
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
    v_claim RECORD;
    v_record RECORD;
    v_session RECORD;
    v_faculty_name TEXT;
    v_remarks_clean TEXT;
BEGIN
    v_is_service_role := (auth.role() = 'service_role' OR session_user = 'postgres');
    v_user_id := auth.uid();

    -- 1. Validate Authentication
    IF v_user_id IS NULL AND NOT v_is_service_role THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Active session required to approve attendance claims.'
        );
    END IF;

    -- 2. Validate Reviewer Authorization
    IF NOT v_is_service_role THEN
        v_caller_role := public.current_user_role();
        IF v_caller_role NOT IN ('super_admin'::public.user_role, 'hod'::public.user_role, 'faculty'::public.user_role) THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'UNAUTHORIZED',
                'message', 'Only faculty members, HODs, or administrators can approve attendance claims.'
            );
        END IF;
    END IF;

    -- 3. Lock and Fetch Claim Row (FOR UPDATE)
    SELECT * INTO v_claim
    FROM public.attendance_corrections
    WHERE id = p_claim_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CLAIM_NOT_FOUND',
            'message', 'Attendance claim record not found.'
        );
    END IF;

    IF v_claim.status != 'pending'::public.correction_status THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CLAIM_ALREADY_RESOLVED',
            'message', format('This claim has already been resolved with status: %s.', UPPER(v_claim.status::TEXT)),
            'claim_status', v_claim.status
        );
    END IF;

    -- 4. Lock and Fetch Attendance Record (FOR UPDATE)
    SELECT * INTO v_record
    FROM public.attendance_records
    WHERE id = v_claim.attendance_record_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'RECORD_NOT_FOUND',
            'message', 'Underlying attendance record not found.'
        );
    END IF;

    -- Fetch Session to Verify Faculty/Section Context
    SELECT * INTO v_session
    FROM public.attendance_sessions
    WHERE id = v_record.attendance_session_id;

    -- Fetch Reviewer Faculty Full Name
    SELECT full_name INTO v_faculty_name
    FROM public.faculty
    WHERE id = p_faculty_id;

    v_remarks_clean := COALESCE(TRIM(p_remarks), 'Attendance discrepancy verified and approved in database.');

    -- 5. ATOMIC STEP 1: Update attendance_corrections to 'approved'
    UPDATE public.attendance_corrections
    SET status = 'approved'::public.correction_status,
        reviewed_by = p_faculty_id,
        reviewed_at = NOW(),
        review_remarks = v_remarks_clean
    WHERE id = p_claim_id;

    -- 6. ATOMIC STEP 2: Update attendance_records to 'Present'
    UPDATE public.attendance_records
    SET status = 'Present'::public.attendance_status,
        marked_by = p_faculty_id,
        marked_at = NOW(),
        remarks = format('Attendance rectified via Claim #%s: %s', p_claim_id, v_remarks_clean)
    WHERE id = v_record.id;

    -- 7. ATOMIC STEP 3: Write Audit Log Entry
    INSERT INTO public.audit_logs (
        actor_id,
        actor_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        p_faculty_id,
        COALESCE(v_faculty_name, 'Faculty Reviewer'),
        COALESCE(v_caller_role::text, 'faculty'),
        'ATTENDANCE_CORRECTION_APPROVED',
        'attendance_records',
        v_record.id,
        jsonb_build_object(
            'claim_id', p_claim_id,
            'student_id', v_claim.student_id,
            'previous_status', v_record.status,
            'new_status', 'Present',
            'session_id', v_record.attendance_session_id,
            'remarks', v_remarks_clean
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'code', 'CLAIM_APPROVED',
        'message', 'Attendance claim approved successfully. Student attendance status updated to Present.',
        'claim_id', p_claim_id,
        'record_id', v_record.id,
        'student_id', v_claim.student_id,
        'status', 'Present'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_attendance_claim TO authenticated, service_role;


-- 4. Create Atomic reject_attendance_claim RPC
CREATE OR REPLACE FUNCTION public.reject_attendance_claim(
    p_claim_id UUID,
    p_faculty_id UUID,
    p_remarks TEXT DEFAULT NULL
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
    v_claim RECORD;
    v_faculty_name TEXT;
    v_remarks_clean TEXT;
BEGIN
    v_is_service_role := (auth.role() = 'service_role' OR session_user = 'postgres');
    v_user_id := auth.uid();

    -- 1. Validate Authentication
    IF v_user_id IS NULL AND NOT v_is_service_role THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Active session required to reject attendance claims.'
        );
    END IF;

    -- 2. Validate Reviewer Authorization
    IF NOT v_is_service_role THEN
        v_caller_role := public.current_user_role();
        IF v_caller_role NOT IN ('super_admin'::public.user_role, 'hod'::public.user_role, 'faculty'::public.user_role) THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'UNAUTHORIZED',
                'message', 'Only faculty members, HODs, or administrators can reject attendance claims.'
            );
        END IF;
    END IF;

    -- 3. Lock and Fetch Claim Row (FOR UPDATE)
    SELECT * INTO v_claim
    FROM public.attendance_corrections
    WHERE id = p_claim_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CLAIM_NOT_FOUND',
            'message', 'Attendance claim record not found.'
        );
    END IF;

    IF v_claim.status != 'pending'::public.correction_status THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CLAIM_ALREADY_RESOLVED',
            'message', format('This claim has already been resolved with status: %s.', UPPER(v_claim.status::TEXT)),
            'claim_status', v_claim.status
        );
    END IF;

    SELECT full_name INTO v_faculty_name
    FROM public.faculty
    WHERE id = p_faculty_id;

    v_remarks_clean := COALESCE(TRIM(p_remarks), 'Attendance claim verified; absence confirmed.');

    -- 4. ATOMIC STEP 1: Update attendance_corrections to 'rejected'
    UPDATE public.attendance_corrections
    SET status = 'rejected'::public.correction_status,
        reviewed_by = p_faculty_id,
        reviewed_at = NOW(),
        review_remarks = v_remarks_clean
    WHERE id = p_claim_id;

    -- Attendance record remains 'Absent' (unchanged)

    -- 5. ATOMIC STEP 2: Write Audit Log Entry
    INSERT INTO public.audit_logs (
        actor_id,
        actor_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        p_faculty_id,
        COALESCE(v_faculty_name, 'Faculty Reviewer'),
        COALESCE(v_caller_role::text, 'faculty'),
        'ATTENDANCE_CORRECTION_REJECTED',
        'attendance_corrections',
        p_claim_id,
        jsonb_build_object(
            'claim_id', p_claim_id,
            'student_id', v_claim.student_id,
            'remarks', v_remarks_clean
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'code', 'CLAIM_REJECTED',
        'message', 'Attendance claim rejected.',
        'claim_id', p_claim_id,
        'student_id', v_claim.student_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_attendance_claim TO authenticated, service_role;

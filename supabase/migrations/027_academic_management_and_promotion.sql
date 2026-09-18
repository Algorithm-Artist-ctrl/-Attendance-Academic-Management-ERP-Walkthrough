-- ============================================================================
-- VCTM ERP: MIGRATION 027
-- ACADEMIC MANAGEMENT, SECTION SAFEGUARDS & BULK STUDENT PROMOTION SYSTEM
-- ============================================================================

-- 1. UPDATE STATUS CHECK CONSTRAINT ON STUDENTS TABLE
-- Allows 'GRADUATED' and 'ALUMNI' in addition to existing statuses
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.students'::regclass 
          AND contype = 'c' 
          AND pg_get_constraintdef(oid) LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.students DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.students 
ADD CONSTRAINT chk_students_status 
CHECK (status IN ('ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED', 'GRADUATED', 'ALUMNI'));

-- 2. CREATE PROMOTION BATCHES TABLE
CREATE TABLE IF NOT EXISTS public.promotion_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number SERIAL UNIQUE,
    source_academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    target_academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    source_academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
    target_academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
    total_students INTEGER NOT NULL DEFAULT 0,
    promoted_count INTEGER NOT NULL DEFAULT 0,
    held_count INTEGER NOT NULL DEFAULT 0,
    graduated_count INTEGER NOT NULL DEFAULT 0,
    excluded_count INTEGER NOT NULL DEFAULT 0,
    performed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_by_name TEXT NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_batches_created ON public.promotion_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_batches_src_tgt ON public.promotion_batches(source_academic_year_id, target_academic_year_id);

-- 3. CREATE STUDENT ACADEMIC HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.student_academic_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
    section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    promotion_action TEXT NOT NULL DEFAULT 'INITIAL_ENROLLMENT', -- INITIAL_ENROLLMENT, PROMOTED, HELD_BACK, REASSIGNED_SECTION, GRADUATED
    promotion_batch_id UUID REFERENCES public.promotion_batches(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_academic_history_student ON public.student_academic_history(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_academic_history_batch ON public.student_academic_history(promotion_batch_id);
CREATE INDEX IF NOT EXISTS idx_student_academic_history_sec ON public.student_academic_history(section_id);

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.promotion_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_academic_history ENABLE ROW LEVEL SECURITY;

-- Read policies: Authenticated users can view academic history & batches
DROP POLICY IF EXISTS "Authenticated users can view promotion batches" ON public.promotion_batches;
CREATE POLICY "Authenticated users can view promotion batches"
ON public.promotion_batches FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view student academic history" ON public.student_academic_history;
CREATE POLICY "Authenticated users can view student academic history"
ON public.student_academic_history FOR SELECT
TO authenticated
USING (true);

-- Insert/Update policies: Admins can modify
DROP POLICY IF EXISTS "Admins can manage promotion batches" ON public.promotion_batches;
CREATE POLICY "Admins can manage promotion batches"
ON public.promotion_batches FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role IN ('super_admin', 'hod')
    )
);

DROP POLICY IF EXISTS "Admins can manage student academic history" ON public.student_academic_history;
CREATE POLICY "Admins can manage student academic history"
ON public.student_academic_history FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role IN ('super_admin', 'hod')
    )
);

-- 5. RPC: CHECK SECTION REFERENCES (SAFEGUARD FOR SECTION DELETION/ARCHIVING)
CREATE OR REPLACE FUNCTION public.check_section_references(p_section_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_student_count INTEGER := 0;
    v_attendance_count INTEGER := 0;
    v_timetable_count INTEGER := 0;
    v_assignment_count INTEGER := 0;
    v_leave_count INTEGER := 0;
    v_message_count INTEGER := 0;
    v_can_hard_delete BOOLEAN := false;
BEGIN
    SELECT COUNT(*) INTO v_student_count FROM public.students WHERE section_id = p_section_id;
    SELECT COUNT(*) INTO v_attendance_count FROM public.attendance_sessions WHERE section_id = p_section_id;
    SELECT COUNT(*) INTO v_timetable_count FROM public.timetable_entries WHERE section_id = p_section_id;
    SELECT COUNT(*) INTO v_assignment_count FROM public.faculty_subject_assignments WHERE section_id = p_section_id;
    
    BEGIN
        SELECT COUNT(*) INTO v_leave_count FROM public.leave_applications WHERE section_id = p_section_id;
    EXCEPTION WHEN OTHERS THEN
        v_leave_count := 0;
    END;

    BEGIN
        SELECT COUNT(*) INTO v_message_count FROM public.message_groups WHERE section_id = p_section_id;
    EXCEPTION WHEN OTHERS THEN
        v_message_count := 0;
    END;

    IF (v_student_count = 0 AND v_attendance_count = 0 AND v_timetable_count = 0 AND v_assignment_count = 0 AND v_leave_count = 0 AND v_message_count = 0) THEN
        v_can_hard_delete := true;
    ELSE
        v_can_hard_delete := false;
    END IF;

    RETURN jsonb_build_object(
        'section_id', p_section_id,
        'student_count', v_student_count,
        'attendance_count', v_attendance_count,
        'timetable_count', v_timetable_count,
        'assignment_count', v_assignment_count,
        'leave_count', v_leave_count,
        'message_count', v_message_count,
        'total_references', (v_student_count + v_attendance_count + v_timetable_count + v_assignment_count + v_leave_count + v_message_count),
        'can_hard_delete', v_can_hard_delete
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_section_references(UUID) TO authenticated, anon, service_role;

-- 6. RPC: ATOMIC BULK STUDENT PROMOTION
CREATE OR REPLACE FUNCTION public.promote_students_bulk(
    p_payload JSONB,
    p_admin_id UUID,
    p_admin_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_batch_id UUID;
    v_src_year_id UUID;
    v_tgt_year_id UUID;
    v_src_sess_id UUID;
    v_tgt_sess_id UUID;
    v_default_tgt_sem_id UUID;
    v_notes TEXT;
    
    v_students_array JSONB;
    v_student_item JSONB;
    v_total_students INTEGER := 0;
    v_promoted_count INTEGER := 0;
    v_held_count INTEGER := 0;
    v_graduated_count INTEGER := 0;
    v_excluded_count INTEGER := 0;
    
    v_student_id UUID;
    v_action TEXT;
    v_tgt_sec_id UUID;
    v_t_year_id UUID;
    v_t_sem_id UUID;
    
    v_curr_sess UUID;
    v_curr_year UUID;
    v_curr_sem UUID;
    v_curr_sec UUID;
    v_curr_status TEXT;
    v_remarks TEXT;
BEGIN
    -- Authorization check: Ensure admin ID or active admin profile exists
    IF p_admin_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = p_admin_id 
              AND role IN ('super_admin', 'hod')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Only Super Admin and HOD can execute academic promotions.';
        END IF;
    END IF;

    -- Extract payload headers
    v_src_year_id := NULLIF(p_payload->>'source_academic_year_id', '')::UUID;
    v_tgt_year_id := NULLIF(p_payload->>'target_academic_year_id', '')::UUID;
    v_src_sess_id := NULLIF(p_payload->>'source_academic_session_id', '')::UUID;
    v_tgt_sess_id := NULLIF(p_payload->>'target_academic_session_id', '')::UUID;
    v_default_tgt_sem_id := NULLIF(p_payload->>'target_semester_id', '')::UUID;
    v_notes := COALESCE(p_payload->>'notes', 'Bulk Academic Promotion');
    v_students_array := p_payload->'students';

    IF v_students_array IS NULL OR jsonb_array_length(v_students_array) = 0 THEN
        RAISE EXCEPTION 'No student records provided for promotion.';
    END IF;

    v_total_students := jsonb_array_length(v_students_array);

    -- 1. Create promotion batch audit entry
    INSERT INTO public.promotion_batches (
        id,
        source_academic_year_id,
        target_academic_year_id,
        source_academic_session_id,
        target_academic_session_id,
        total_students,
        promoted_count,
        held_count,
        graduated_count,
        excluded_count,
        performed_by_user_id,
        performed_by_name,
        notes,
        metadata
    ) VALUES (
        gen_random_uuid(),
        v_src_year_id,
        v_tgt_year_id,
        v_src_sess_id,
        v_tgt_sess_id,
        v_total_students,
        0,
        0,
        0,
        0,
        p_admin_id,
        COALESCE(p_admin_name, 'Super Admin'),
        v_notes,
        p_payload
    ) RETURNING id INTO v_batch_id;

    -- 2. Process each student record inside the atomic transaction
    FOR i IN 0..(v_total_students - 1) LOOP
        v_student_item := v_students_array->i;
        v_student_id := (v_student_item->>'student_id')::UUID;
        v_action := UPPER(COALESCE(v_student_item->>'action', 'PROMOTE'));
        v_remarks := v_student_item->>'remarks';

        -- Fetch existing student placement
        SELECT 
            academic_session_id, 
            academic_year_id, 
            semester_id, 
            section_id, 
            status 
        INTO 
            v_curr_sess, 
            v_curr_year, 
            v_curr_sem, 
            v_curr_sec, 
            v_curr_status 
        FROM public.students 
        WHERE id = v_student_id;

        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        -- Ensure student's historical baseline exists before promotion
        IF NOT EXISTS (
            SELECT 1 FROM public.student_academic_history 
            WHERE student_id = v_student_id 
              AND academic_year_id = v_curr_year 
              AND semester_id = v_curr_sem 
              AND section_id = v_curr_sec
        ) THEN
            INSERT INTO public.student_academic_history (
                student_id,
                academic_session_id,
                academic_year_id,
                semester_id,
                section_id,
                status,
                promotion_action,
                remarks,
                created_at
            ) VALUES (
                v_student_id,
                v_curr_sess,
                v_curr_year,
                v_curr_sem,
                v_curr_sec,
                v_curr_status,
                'INITIAL_ENROLLMENT',
                'Historical baseline record established prior to batch ' || v_batch_id::text,
                now() - interval '1 second'
            );
        END IF;

        -- Process according to specified action
        IF v_action = 'EXCLUDE' THEN
            v_excluded_count := v_excluded_count + 1;

        ELSIF v_action = 'HOLD' THEN
            -- Record retention/hold back in academic history
            INSERT INTO public.student_academic_history (
                student_id,
                academic_session_id,
                academic_year_id,
                semester_id,
                section_id,
                status,
                promotion_action,
                promotion_batch_id,
                remarks
            ) VALUES (
                v_student_id,
                COALESCE(v_tgt_sess_id, v_curr_sess),
                v_curr_year,
                v_curr_sem,
                v_curr_sec,
                v_curr_status,
                'HELD_BACK',
                v_batch_id,
                COALESCE(v_remarks, 'Held back in current academic year/semester')
            );

            -- Update session if transition advances academic session
            IF v_tgt_sess_id IS NOT NULL AND v_tgt_sess_id <> v_curr_sess THEN
                UPDATE public.students 
                SET academic_session_id = v_tgt_sess_id
                WHERE id = v_student_id;
            END IF;

            v_held_count := v_held_count + 1;

        ELSIF v_action = 'GRADUATE' THEN
            -- Student completes course and graduates. Preserve all history!
            UPDATE public.students 
            SET status = 'GRADUATED'
            WHERE id = v_student_id;

            INSERT INTO public.student_academic_history (
                student_id,
                academic_session_id,
                academic_year_id,
                semester_id,
                section_id,
                status,
                promotion_action,
                promotion_batch_id,
                remarks
            ) VALUES (
                v_student_id,
                COALESCE(v_tgt_sess_id, v_curr_sess),
                v_curr_year,
                v_curr_sem,
                v_curr_sec,
                'GRADUATED',
                'GRADUATED',
                v_batch_id,
                COALESCE(v_remarks, 'Graduated from academic program')
            );

            v_graduated_count := v_graduated_count + 1;

        ELSIF v_action IN ('PROMOTE', 'REASSIGN') THEN
            -- Destination fields
            v_t_year_id := COALESCE(NULLIF(v_student_item->>'target_academic_year_id', '')::UUID, v_tgt_year_id);
            v_t_sem_id := COALESCE(NULLIF(v_student_item->>'target_semester_id', '')::UUID, v_default_tgt_sem_id);
            v_tgt_sec_id := NULLIF(v_student_item->>'target_section_id', '')::UUID;

            IF v_tgt_sec_id IS NULL THEN
                RAISE EXCEPTION 'Target section missing for student % in batch promotion.', v_student_id;
            END IF;

            -- Auto-resolve target semester from section if omitted
            IF v_t_sem_id IS NULL THEN
                SELECT semester_id INTO v_t_sem_id FROM public.sections WHERE id = v_tgt_sec_id;
            END IF;

            -- Auto-resolve target year from semester if omitted
            IF v_t_year_id IS NULL AND v_t_sem_id IS NOT NULL THEN
                SELECT academic_year_id INTO v_t_year_id FROM public.semesters WHERE id = v_t_sem_id;
            END IF;

            -- Perform transactional student promotion (preserving student.id, roll_number, etc.)
            UPDATE public.students 
            SET 
                academic_year_id = COALESCE(v_t_year_id, academic_year_id),
                semester_id = COALESCE(v_t_sem_id, semester_id),
                section_id = v_tgt_sec_id,
                academic_session_id = COALESCE(v_tgt_sess_id, academic_session_id)
            WHERE id = v_student_id;

            -- Record forward academic transition in history
            INSERT INTO public.student_academic_history (
                student_id,
                academic_session_id,
                academic_year_id,
                semester_id,
                section_id,
                status,
                promotion_action,
                promotion_batch_id,
                remarks
            ) VALUES (
                v_student_id,
                COALESCE(v_tgt_sess_id, v_curr_sess),
                v_t_year_id,
                v_t_sem_id,
                v_tgt_sec_id,
                'ACTIVE',
                CASE WHEN v_action = 'REASSIGN' THEN 'REASSIGNED_SECTION' ELSE 'PROMOTED' END,
                v_batch_id,
                COALESCE(v_remarks, 'Promoted to next academic cohort')
            );

            v_promoted_count := v_promoted_count + 1;
        END IF;
    END LOOP;

    -- 3. Update summary counts on the promotion batch
    UPDATE public.promotion_batches 
    SET 
        total_students = v_total_students,
        promoted_count = v_promoted_count,
        held_count = v_held_count,
        graduated_count = v_graduated_count,
        excluded_count = v_excluded_count
    WHERE id = v_batch_id;

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'total_students', v_total_students,
        'promoted_count', v_promoted_count,
        'held_count', v_held_count,
        'graduated_count', v_graduated_count,
        'excluded_count', v_excluded_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_students_bulk(JSONB, UUID, TEXT) TO authenticated, anon, service_role;

-- 7. NOTIFY SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';

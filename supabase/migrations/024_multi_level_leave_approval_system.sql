-- ==============================================================================
-- Migration 024: Production Multi-Level Leave Application Approval Workflow
-- Vivekananda College of Technology & Management (VCTM) ERP
-- Hierarchy: Student -> Class Coordinator -> HOD -> Student
-- ==============================================================================

-- 1. Extend notifications type constraint to support leave notifications
DO $$
BEGIN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
        type = ANY (ARRAY[
            'MARKS_PUBLISHED'::text, 
            'MARKS_UPDATED'::text, 
            'ASSIGNMENT_POSTED'::text, 
            'ASSIGNMENT_UPDATED'::text, 
            'QUIZ_POSTED'::text, 
            'QUIZ_GRADED'::text, 
            'ATTENDANCE_CLAIM'::text, 
            'ATTENDANCE_UPDATE'::text, 
            'TIMETABLE_UPDATE'::text, 
            'NOTICE'::text, 
            'ACCOUNT_UPDATE'::text, 
            'NEW_MESSAGE'::text, 
            'ISSUE_STATUS_UPDATE'::text,
            'LEAVE_APPLICATION_SUBMITTED'::text,
            'LEAVE_FORWARDED_HOD'::text,
            'LEAVE_APPROVED'::text,
            'LEAVE_REJECTED'::text,
            'GENERAL'::text
        ])
    );
END $$;

-- 2. Ensure all active sections have designated Class Coordinators in place
DO $$
DECLARE
    v_session_id UUID;
    v_jitendra_id UUID;
    v_abhishek_id UUID;
    v_gagandeep_id UUID;
    v_alok_id UUID;
    v_sec_3a UUID;
    v_sec_3b UUID;
    v_sec_3c UUID;
    v_sec_4a UUID;
BEGIN
    SELECT id INTO v_session_id FROM public.academic_sessions WHERE is_current = true LIMIT 1;
    IF v_session_id IS NULL THEN
        SELECT id INTO v_session_id FROM public.academic_sessions ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Resolve faculty IDs
    SELECT id INTO v_jitendra_id FROM public.faculty WHERE employee_code = 'FAC_MRJI_9835' OR full_name ILIKE '%Jitendra Singh%' LIMIT 1;
    SELECT id INTO v_abhishek_id FROM public.faculty WHERE employee_code = 'FAC_DRAB_7147' OR full_name ILIKE '%Abhishek Garg%' LIMIT 1;
    SELECT id INTO v_gagandeep_id FROM public.faculty WHERE employee_code = 'FAC-CSE-008' OR full_name ILIKE '%Gagandeep Singh%' LIMIT 1;
    SELECT id INTO v_alok_id FROM public.faculty WHERE employee_code = 'FAC-CSE-004' OR full_name ILIKE '%Alok Gupta%' LIMIT 1;

    -- 3rd Year Sections
    SELECT s.id INTO v_sec_3a 
    FROM public.sections s 
    JOIN public.semesters sem ON sem.id = s.semester_id 
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id 
    WHERE ay.year_number = 3 AND s.name = 'A' LIMIT 1;

    SELECT s.id INTO v_sec_3b 
    FROM public.sections s 
    JOIN public.semesters sem ON sem.id = s.semester_id 
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id 
    WHERE ay.year_number = 3 AND s.name = 'B' LIMIT 1;

    SELECT s.id INTO v_sec_3c 
    FROM public.sections s 
    JOIN public.semesters sem ON sem.id = s.semester_id 
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id 
    WHERE ay.year_number = 3 AND s.name = 'C' LIMIT 1;

    -- 4th Year Section
    SELECT s.id INTO v_sec_4a 
    FROM public.sections s 
    JOIN public.semesters sem ON sem.id = s.semester_id 
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id 
    WHERE ay.year_number = 4 AND s.name = 'A' LIMIT 1;

    -- Update sections table & coordinator assignments
    IF v_sec_3a IS NOT NULL AND v_jitendra_id IS NOT NULL THEN
        UPDATE public.sections SET class_coordinator_id = v_jitendra_id WHERE id = v_sec_3a;
        INSERT INTO public.class_coordinator_assignments (faculty_id, section_id, academic_session_id, active)
        VALUES (v_jitendra_id, v_sec_3a, v_session_id, true)
        ON CONFLICT (section_id, academic_session_id) 
        DO UPDATE SET faculty_id = v_jitendra_id, active = true, updated_at = now();
    END IF;

    IF v_sec_3b IS NOT NULL AND v_abhishek_id IS NOT NULL THEN
        UPDATE public.sections SET class_coordinator_id = v_abhishek_id WHERE id = v_sec_3b;
        INSERT INTO public.class_coordinator_assignments (faculty_id, section_id, academic_session_id, active)
        VALUES (v_abhishek_id, v_sec_3b, v_session_id, true)
        ON CONFLICT (section_id, academic_session_id) 
        DO UPDATE SET faculty_id = v_abhishek_id, active = true, updated_at = now();
    END IF;

    IF v_sec_3c IS NOT NULL AND v_gagandeep_id IS NOT NULL THEN
        UPDATE public.sections SET class_coordinator_id = v_gagandeep_id WHERE id = v_sec_3c;
        INSERT INTO public.class_coordinator_assignments (faculty_id, section_id, academic_session_id, active)
        VALUES (v_gagandeep_id, v_sec_3c, v_session_id, true)
        ON CONFLICT (section_id, academic_session_id) 
        DO UPDATE SET faculty_id = v_gagandeep_id, active = true, updated_at = now();
    END IF;

    IF v_sec_4a IS NOT NULL AND v_alok_id IS NOT NULL THEN
        UPDATE public.sections SET class_coordinator_id = v_alok_id WHERE id = v_sec_4a;
        INSERT INTO public.class_coordinator_assignments (faculty_id, section_id, academic_session_id, active)
        VALUES (v_alok_id, v_sec_4a, v_session_id, true)
        ON CONFLICT (section_id, academic_session_id) 
        DO UPDATE SET faculty_id = v_alok_id, active = true, updated_at = now();
    END IF;
END $$;

-- 3. Create Sequence for Leave Application Number
CREATE SEQUENCE IF NOT EXISTS leave_application_num_seq START 1001;

-- 4. Create leave_applications table
CREATE TABLE IF NOT EXISTS public.leave_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(30) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
    coordinator_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    hod_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    leave_type VARCHAR(50) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    number_of_days NUMERIC(4,1) NOT NULL,
    reason TEXT NOT NULL,
    attachment_url TEXT,
    attachment_name TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_COORDINATOR',
    
    -- Coordinator Approval Details
    coordinator_approved_by UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    coordinator_approved_at TIMESTAMPTZ,
    coordinator_remarks TEXT,

    -- HOD Approval Details
    hod_approved_by UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    hod_approved_at TIMESTAMPTZ,
    hod_remarks TEXT,

    -- Rejection Details
    rejected_by UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    rejected_by_role VARCHAR(20),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Security & Verification
    verification_code VARCHAR(60) UNIQUE NOT NULL,
    approved_pdf_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_leave_status CHECK (
        status IN (
            'PENDING_COORDINATOR',
            'PENDING_HOD',
            'APPROVED',
            'REJECTED_BY_COORDINATOR',
            'REJECTED_BY_HOD'
        )
    ),
    CONSTRAINT chk_leave_dates CHECK (to_date >= from_date),
    CONSTRAINT chk_leave_days CHECK (number_of_days > 0)
);

-- 5. Create leave_approval_audit_logs table
CREATE TABLE IF NOT EXISTS public.leave_approval_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.leave_applications(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_faculty_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    actor_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_leave_student_id ON public.leave_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_coordinator_id ON public.leave_applications(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_leave_hod_id ON public.leave_applications(hod_id);
CREATE INDEX IF NOT EXISTS idx_leave_section_id ON public.leave_applications(section_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON public.leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_leave_created_at ON public.leave_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_audit_app_id ON public.leave_approval_audit_logs(application_id);

-- 7. Enable RLS
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_approval_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "leave_applications_select_policy" ON public.leave_applications;
DROP POLICY IF EXISTS "leave_applications_insert_policy" ON public.leave_applications;
DROP POLICY IF EXISTS "leave_applications_update_policy" ON public.leave_applications;
DROP POLICY IF EXISTS "leave_audit_select_policy" ON public.leave_approval_audit_logs;

-- Helper to check if current user is class coordinator for a section
CREATE OR REPLACE FUNCTION public.is_class_coordinator_for_section(p_section_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.sections sec
        LEFT JOIN public.faculty f ON f.id = sec.class_coordinator_id
        LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
        WHERE sec.id = p_section_id 
          AND (p.id = auth.uid() OR f.auth_user_id = auth.uid() OR f.id = auth.uid())
    ) OR EXISTS (
        SELECT 1 
        FROM public.class_coordinator_assignments cca
        LEFT JOIN public.faculty f ON f.id = cca.faculty_id
        LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
        WHERE cca.section_id = p_section_id 
          AND cca.active = true
          AND (p.id = auth.uid() OR f.auth_user_id = auth.uid() OR f.id = auth.uid())
    );
$$;

-- RLS: SELECT policy
CREATE POLICY "leave_applications_select_policy" ON public.leave_applications
    FOR SELECT TO authenticated
    USING (
        -- 1. Student views own applications
        student_id IN (
            SELECT s.id FROM public.students s
            LEFT JOIN public.profiles p ON (p.student_id = s.id OR p.id = s.auth_user_id)
            WHERE p.id = auth.uid() OR s.auth_user_id = auth.uid() OR s.id = auth.uid()
        )
        -- 2. Class Coordinator views applications for their section
        OR public.is_class_coordinator_for_section(section_id)
        -- 3. HOD views applications for their department
        OR department_id IN (
            SELECT d.id FROM public.departments d
            LEFT JOIN public.faculty f ON f.id = d.hod_faculty_id
            LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
            WHERE p.id = auth.uid() OR f.auth_user_id = auth.uid() OR f.id = auth.uid()
        )
        -- 4. Super admin / HOD role
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    );

-- RLS: INSERT / UPDATE restricted (only allowed via security definer RPC functions)
CREATE POLICY "leave_applications_insert_policy" ON public.leave_applications
    FOR INSERT TO authenticated
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "leave_applications_update_policy" ON public.leave_applications
    FOR UPDATE TO authenticated
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- RLS for audit logs
CREATE POLICY "leave_audit_select_policy" ON public.leave_approval_audit_logs
    FOR SELECT TO authenticated
    USING (
        application_id IN (SELECT id FROM public.leave_applications)
        OR auth.role() = 'service_role'
    );

-- 8. Add to Supabase Realtime
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = 'leave_applications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_applications;
        END IF;
    END IF;
END $$;

ALTER TABLE public.leave_applications REPLICA IDENTITY FULL;

-- ==============================================================================
-- 9. SECURITY DEFINER RPC: submit_leave_application
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_leave_application(
    p_leave_type VARCHAR,
    p_from_date DATE,
    p_to_date DATE,
    p_number_of_days NUMERIC,
    p_reason TEXT,
    p_attachment_url TEXT DEFAULT NULL,
    p_attachment_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_student RECORD;
    v_coordinator_id UUID;
    v_coordinator_user_id UUID;
    v_coordinator_name TEXT;
    v_hod_id UUID;
    v_hod_user_id UUID;
    v_hod_name TEXT;
    v_app_num VARCHAR(30);
    v_verif_code VARCHAR(60);
    v_new_leave public.leave_applications;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit leave application.';
    END IF;

    -- Resolve student
    SELECT s.*, d.name as dept_name, d.hod_faculty_id
    INTO v_student
    FROM public.students s
    JOIN public.departments d ON d.id = s.department_id
    LEFT JOIN public.profiles p ON (p.student_id = s.id OR p.id = s.auth_user_id)
    WHERE p.id = v_user_id OR s.auth_user_id = v_user_id OR s.id = v_user_id
    LIMIT 1;

    IF v_student.id IS NULL THEN
        RAISE EXCEPTION 'Active student profile not found for authenticated user.';
    END IF;

    -- Validate input dates
    IF p_from_date IS NULL OR p_to_date IS NULL THEN
        RAISE EXCEPTION 'From date and to date are required.';
    END IF;
    IF p_to_date < p_from_date THEN
        RAISE EXCEPTION 'To date cannot be earlier than from date.';
    END IF;
    IF p_number_of_days <= 0 THEN
        RAISE EXCEPTION 'Number of days must be greater than zero.';
    END IF;
    IF trim(p_reason) IS NULL OR length(trim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'Please provide a clear reason for your leave application.';
    END IF;

    -- Resolve Class Coordinator
    SELECT cca.faculty_id INTO v_coordinator_id
    FROM public.class_coordinator_assignments cca
    WHERE cca.section_id = v_student.section_id AND cca.active = true
    LIMIT 1;

    IF v_coordinator_id IS NULL THEN
        SELECT sec.class_coordinator_id INTO v_coordinator_id
        FROM public.sections sec
        WHERE sec.id = v_student.section_id;
    END IF;

    -- Resolve HOD
    v_hod_id := v_student.hod_faculty_id;
    IF v_hod_id IS NULL THEN
        SELECT hod_faculty_id INTO v_hod_id FROM public.departments WHERE id = v_student.department_id;
    END IF;

    -- Generate Application Number (e.g., LV-2026-1001)
    v_app_num := 'LV-2026-' || nextval('leave_application_num_seq')::text;
    v_verif_code := 'VCTM-LV-2026-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Insert Leave Application
    INSERT INTO public.leave_applications (
        application_number,
        student_id,
        department_id,
        academic_year_id,
        section_id,
        coordinator_id,
        hod_id,
        leave_type,
        from_date,
        to_date,
        number_of_days,
        reason,
        attachment_url,
        attachment_name,
        status,
        verification_code,
        created_at,
        updated_at
    ) VALUES (
        v_app_num,
        v_student.id,
        v_student.department_id,
        v_student.academic_year_id,
        v_student.section_id,
        v_coordinator_id,
        v_hod_id,
        p_leave_type,
        p_from_date,
        p_to_date,
        p_number_of_days,
        trim(p_reason),
        p_attachment_url,
        p_attachment_name,
        'PENDING_COORDINATOR',
        v_verif_code,
        now(),
        now()
    ) RETURNING * INTO v_new_leave;

    -- Insert Audit Log
    INSERT INTO public.leave_approval_audit_logs (
        application_id,
        actor_user_id,
        actor_student_id,
        actor_role,
        action,
        old_status,
        new_status,
        remarks,
        created_at
    ) VALUES (
        v_new_leave.id,
        v_user_id,
        v_student.id,
        'student',
        'SUBMITTED',
        NULL,
        'PENDING_COORDINATOR',
        'Application submitted by student',
        now()
    );

    -- Notify Class Coordinator (ONLY coordinator, NOT HOD yet!)
    IF v_coordinator_id IS NOT NULL THEN
        SELECT COALESCE(p.id, f.auth_user_id), f.full_name INTO v_coordinator_user_id, v_coordinator_name
        FROM public.faculty f
        LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
        WHERE f.id = v_coordinator_id
        LIMIT 1;

        IF v_coordinator_user_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                recipient_user_id,
                recipient_role,
                type,
                title,
                message,
                reference_type,
                reference_id,
                is_read,
                created_at,
                updated_at
            ) VALUES (
                v_coordinator_user_id,
                'faculty',
                'LEAVE_APPLICATION_SUBMITTED',
                'New Leave Application',
                'New leave application from ' || v_student.full_name || ' (' || COALESCE(v_student.roll_number, '') || ') for ' || p_number_of_days::text || ' day(s).',
                'leave_application',
                v_new_leave.id,
                false,
                now(),
                now()
            );
        END IF;
    END IF;

    RETURN to_jsonb(v_new_leave);
END;
$$;

-- ==============================================================================
-- 10. SECURITY DEFINER RPC: coordinator_review_leave
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.coordinator_review_leave(
    p_application_id UUID,
    p_action VARCHAR, -- 'APPROVE' or 'REJECT'
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_role user_role;
    v_faculty_id UUID;
    v_faculty_name TEXT;
    v_app RECORD;
    v_student RECORD;
    v_hod RECORD;
    v_hod_user_id UUID;
    v_student_user_id UUID;
    v_updated_leave public.leave_applications;
    v_is_authorized BOOLEAN := false;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Fetch current user profile & faculty
    SELECT p.role, f.id, f.full_name INTO v_user_role, v_faculty_id, v_faculty_name
    FROM public.profiles p
    LEFT JOIN public.faculty f ON (f.id = p.faculty_id OR f.auth_user_id = p.id)
    WHERE p.id = v_user_id
    LIMIT 1;

    IF v_faculty_id IS NULL THEN
        SELECT id, full_name INTO v_faculty_id, v_faculty_name 
        FROM public.faculty 
        WHERE auth_user_id = v_user_id OR id = v_user_id 
        LIMIT 1;
    END IF;

    -- Fetch leave application with row lock to prevent race conditions
    SELECT * INTO v_app 
    FROM public.leave_applications 
    WHERE id = p_application_id 
    FOR UPDATE;

    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Leave application not found.';
    END IF;

    -- State machine enforcement: Must be in PENDING_COORDINATOR
    IF v_app.status != 'PENDING_COORDINATOR' THEN
        RAISE EXCEPTION 'Application is not in PENDING_COORDINATOR state (current state: %).', v_app.status;
    END IF;

    -- Authorization check: Must be the designated coordinator for this section, or HOD / Super Admin
    IF v_user_role IN ('super_admin', 'hod') THEN
        v_is_authorized := true;
    ELSIF v_faculty_id IS NOT NULL THEN
        -- Check if coordinator of this section
        IF v_app.coordinator_id = v_faculty_id 
           OR public.is_class_coordinator_for_section(v_app.section_id) THEN
            v_is_authorized := true;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: You are not designated as the Class Coordinator for this section.';
    END IF;

    -- Validate action
    IF upper(p_action) NOT IN ('APPROVE', 'REJECT') THEN
        RAISE EXCEPTION 'Invalid review action. Must be APPROVE or REJECT.';
    END IF;

    -- Fetch student info
    SELECT s.*, COALESCE(p.id, s.auth_user_id) as student_user_id INTO v_student
    FROM public.students s
    LEFT JOIN public.profiles p ON (p.student_id = s.id OR p.id = s.auth_user_id)
    WHERE s.id = v_app.student_id
    LIMIT 1;
    v_student_user_id := v_student.student_user_id;

    -- Execute APPROVE or REJECT
    IF upper(p_action) = 'APPROVE' THEN
        UPDATE public.leave_applications
        SET status = 'PENDING_HOD',
            coordinator_approved_by = COALESCE(v_faculty_id, v_app.coordinator_id),
            coordinator_approved_at = now(),
            coordinator_remarks = p_remarks,
            updated_at = now()
        WHERE id = p_application_id
        RETURNING * INTO v_updated_leave;

        -- Audit Log
        INSERT INTO public.leave_approval_audit_logs (
            application_id,
            actor_user_id,
            actor_faculty_id,
            actor_role,
            action,
            old_status,
            new_status,
            remarks,
            created_at
        ) VALUES (
            p_application_id,
            v_user_id,
            v_faculty_id,
            'coordinator',
            'COORDINATOR_APPROVED',
            'PENDING_COORDINATOR',
            'PENDING_HOD',
            COALESCE(p_remarks, 'Approved by Class Coordinator and forwarded to HOD'),
            now()
        );

        -- Notify HOD
        SELECT COALESCE(p.id, f.auth_user_id) as hod_user_id INTO v_hod_user_id
        FROM public.departments d
        JOIN public.faculty f ON f.id = d.hod_faculty_id
        LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
        WHERE d.id = v_app.department_id
        LIMIT 1;

        IF v_hod_user_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                recipient_user_id,
                recipient_role,
                type,
                title,
                message,
                reference_type,
                reference_id,
                is_read,
                created_at,
                updated_at
            ) VALUES (
                v_hod_user_id,
                'hod',
                'LEAVE_FORWARDED_HOD',
                'Leave Awaiting HOD Approval',
                'Leave application for ' || v_student.full_name || ' (' || COALESCE(v_student.roll_number, '') || ') approved by Class Coordinator and awaiting your approval.',
                'leave_application',
                p_application_id,
                false,
                now(),
                now()
            );
        END IF;

        -- Notify Student: Forwarded to HOD
        IF v_student_user_id IS NOT NULL THEN
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
            ) VALUES (
                v_student_user_id,
                v_student.id,
                'student',
                'LEAVE_FORWARDED_HOD',
                'Leave Forwarded to HOD',
                'Your leave application has been approved by the Class Coordinator and forwarded to the HOD.',
                'leave_application',
                p_application_id,
                false,
                now(),
                now()
            );
        END IF;

    ELSE -- REJECT
        IF trim(p_remarks) IS NULL OR length(trim(p_remarks)) < 2 THEN
            RAISE EXCEPTION 'A rejection reason is required when rejecting a leave application.';
        END IF;

        UPDATE public.leave_applications
        SET status = 'REJECTED_BY_COORDINATOR',
            rejected_by = COALESCE(v_faculty_id, v_app.coordinator_id),
            rejected_by_role = 'coordinator',
            rejected_at = now(),
            rejection_reason = trim(p_remarks),
            updated_at = now()
        WHERE id = p_application_id
        RETURNING * INTO v_updated_leave;

        -- Audit Log
        INSERT INTO public.leave_approval_audit_logs (
            application_id,
            actor_user_id,
            actor_faculty_id,
            actor_role,
            action,
            old_status,
            new_status,
            remarks,
            created_at
        ) VALUES (
            p_application_id,
            v_user_id,
            v_faculty_id,
            'coordinator',
            'COORDINATOR_REJECTED',
            'PENDING_COORDINATOR',
            'REJECTED_BY_COORDINATOR',
            trim(p_remarks),
            now()
        );

        -- Notify Student of rejection (Do NOT notify HOD)
        IF v_student_user_id IS NOT NULL THEN
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
            ) VALUES (
                v_student_user_id,
                v_student.id,
                'student',
                'LEAVE_REJECTED',
                'Leave Application Rejected',
                'Your leave application has been rejected by the Class Coordinator. Reason: ' || trim(p_remarks),
                'leave_application',
                p_application_id,
                false,
                now(),
                now()
            );
        END IF;
    END IF;

    RETURN to_jsonb(v_updated_leave);
END;
$$;

-- ==============================================================================
-- 11. SECURITY DEFINER RPC: hod_review_leave
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.hod_review_leave(
    p_application_id UUID,
    p_action VARCHAR, -- 'APPROVE' or 'REJECT'
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_role user_role;
    v_faculty_id UUID;
    v_faculty_name TEXT;
    v_app RECORD;
    v_student RECORD;
    v_student_user_id UUID;
    v_updated_leave public.leave_applications;
    v_is_authorized BOOLEAN := false;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Fetch current user profile & faculty
    SELECT p.role, f.id, f.full_name INTO v_user_role, v_faculty_id, v_faculty_name
    FROM public.profiles p
    LEFT JOIN public.faculty f ON (f.id = p.faculty_id OR f.auth_user_id = p.id)
    WHERE p.id = v_user_id
    LIMIT 1;

    IF v_faculty_id IS NULL THEN
        SELECT id, full_name INTO v_faculty_id, v_faculty_name 
        FROM public.faculty 
        WHERE auth_user_id = v_user_id OR id = v_user_id 
        LIMIT 1;
    END IF;

    -- Fetch leave application with row lock
    SELECT * INTO v_app 
    FROM public.leave_applications 
    WHERE id = p_application_id 
    FOR UPDATE;

    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Leave application not found.';
    END IF;

    -- State machine enforcement: Must be in PENDING_HOD
    IF v_app.status = 'PENDING_COORDINATOR' THEN
        RAISE EXCEPTION 'Cannot review: Leave application must be approved by the Class Coordinator first.';
    ELSIF v_app.status != 'PENDING_HOD' THEN
        RAISE EXCEPTION 'Application is not in PENDING_HOD state (current state: %).', v_app.status;
    END IF;

    -- Authorization check: Must be the department HOD or Super Admin
    IF v_user_role = 'super_admin' THEN
        v_is_authorized := true;
    ELSIF v_user_role = 'hod' THEN
        v_is_authorized := true;
    ELSIF v_faculty_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.departments 
            WHERE id = v_app.department_id AND hod_faculty_id = v_faculty_id
        ) THEN
            v_is_authorized := true;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: Only the Head of Department (HOD) can approve at this stage.';
    END IF;

    -- Validate action
    IF upper(p_action) NOT IN ('APPROVE', 'REJECT') THEN
        RAISE EXCEPTION 'Invalid review action. Must be APPROVE or REJECT.';
    END IF;

    -- Fetch student info
    SELECT s.*, COALESCE(p.id, s.auth_user_id) as student_user_id INTO v_student
    FROM public.students s
    LEFT JOIN public.profiles p ON (p.student_id = s.id OR p.id = s.auth_user_id)
    WHERE s.id = v_app.student_id
    LIMIT 1;
    v_student_user_id := v_student.student_user_id;

    -- Execute APPROVE or REJECT
    IF upper(p_action) = 'APPROVE' THEN
        UPDATE public.leave_applications
        SET status = 'APPROVED',
            hod_approved_by = COALESCE(v_faculty_id, v_app.hod_id),
            hod_approved_at = now(),
            hod_remarks = p_remarks,
            updated_at = now()
        WHERE id = p_application_id
        RETURNING * INTO v_updated_leave;

        -- Audit Log
        INSERT INTO public.leave_approval_audit_logs (
            application_id,
            actor_user_id,
            actor_faculty_id,
            actor_role,
            action,
            old_status,
            new_status,
            remarks,
            created_at
        ) VALUES (
            p_application_id,
            v_user_id,
            v_faculty_id,
            'hod',
            'HOD_APPROVED',
            'PENDING_HOD',
            'APPROVED',
            COALESCE(p_remarks, 'Final approval granted by Head of Department'),
            now()
        );

        -- Notify Student: Final Approval
        IF v_student_user_id IS NOT NULL THEN
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
            ) VALUES (
                v_student_user_id,
                v_student.id,
                'student',
                'LEAVE_APPROVED',
                'Leave Application Approved ✓',
                'Your leave application (' || v_app.application_number || ') has been approved by the HOD. Official Leave Certificate is now available for download.',
                'leave_application',
                p_application_id,
                false,
                now(),
                now()
            );
        END IF;

    ELSE -- REJECT
        IF trim(p_remarks) IS NULL OR length(trim(p_remarks)) < 2 THEN
            RAISE EXCEPTION 'A rejection reason is required when rejecting a leave application.';
        END IF;

        UPDATE public.leave_applications
        SET status = 'REJECTED_BY_HOD',
            rejected_by = COALESCE(v_faculty_id, v_app.hod_id),
            rejected_by_role = 'hod',
            rejected_at = now(),
            rejection_reason = trim(p_remarks),
            updated_at = now()
        WHERE id = p_application_id
        RETURNING * INTO v_updated_leave;

        -- Audit Log
        INSERT INTO public.leave_approval_audit_logs (
            application_id,
            actor_user_id,
            actor_faculty_id,
            actor_role,
            action,
            old_status,
            new_status,
            remarks,
            created_at
        ) VALUES (
            p_application_id,
            v_user_id,
            v_faculty_id,
            'hod',
            'HOD_REJECTED',
            'PENDING_HOD',
            'REJECTED_BY_HOD',
            trim(p_remarks),
            now()
        );

        -- Notify Student of rejection
        IF v_student_user_id IS NOT NULL THEN
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
            ) VALUES (
                v_student_user_id,
                v_student.id,
                'student',
                'LEAVE_REJECTED',
                'Leave Application Rejected by HOD',
                'Your leave application has been rejected by the Head of Department. Reason: ' || trim(p_remarks),
                'leave_application',
                p_application_id,
                false,
                now(),
                now()
            );
        END IF;
    END IF;

    RETURN to_jsonb(v_updated_leave);
END;
$$;

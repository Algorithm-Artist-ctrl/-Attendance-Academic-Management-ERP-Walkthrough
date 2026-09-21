-- ==============================================================================
-- Migration 043: Comprehensive Security Hardening
-- Vivekananda College of Technology & Management (VCTM) ERP
-- Addresses: SEC-02 (Role Escalation), SEC-05 (Student Manipulation),
--            SEC-06 (HOD Leave Scoping), and Active Account Status Enforcement
-- ==============================================================================

-- 1. Tighten User Helper Functions to Enforce ACTIVE Status
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT role FROM public.profiles 
    WHERE id = auth.uid() 
      AND (status IS NULL OR status = 'ACTIVE') 
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_faculty_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT faculty_id FROM public.profiles 
    WHERE id = auth.uid() 
      AND (status IS NULL OR status = 'ACTIVE') 
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_student_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT student_id FROM public.profiles 
    WHERE id = auth.uid() 
      AND (status IS NULL OR status = 'ACTIVE') 
    LIMIT 1;
$$;

-- 2. Restrict profiles RLS & Prevent Role/Status Self-Escalation
-- 2A. Restrict SELECT to authenticated users (prevent anonymous scraping)
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles 
    FOR SELECT TO authenticated 
    USING (true);

-- 2B. Prevent Self-Escalation Trigger on public.profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
BEGIN
    -- Allow service_role key operations unconditionally
    IF auth.role() = 'service_role' THEN
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

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 3. Prevent Student Academic Manipulation & Unauthorized Deletion
CREATE OR REPLACE FUNCTION public.prevent_student_academic_manipulation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
BEGIN
    IF auth.role() = 'service_role' THEN
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

DROP TRIGGER IF EXISTS trg_prevent_student_academic_manipulation ON public.students;
CREATE TRIGGER trg_prevent_student_academic_manipulation
    BEFORE UPDATE OR DELETE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_student_academic_manipulation();

-- 4. Harden Attendance Sessions Write Policy (Scoped to Assigned Faculty)
DROP POLICY IF EXISTS "attendance_sessions_write" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_write" ON public.attendance_sessions FOR ALL TO authenticated
    USING (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR (public.current_user_role() = 'faculty'::user_role AND faculty_id = public.current_user_faculty_id())
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR (public.current_user_role() = 'faculty'::user_role AND faculty_id = public.current_user_faculty_id())
        OR auth.role() = 'service_role'
    );

-- 5. Harden Leave Applications Visibility (HODs only see forwarded/actionable leaves)
DROP POLICY IF EXISTS "leave_applications_select_policy" ON public.leave_applications;
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
        -- 3. HOD views applications for their department ONLY once forwarded by coordinator (or direct HOD approval)
        OR (
            (
                department_id IN (
                    SELECT d.id FROM public.departments d
                    LEFT JOIN public.faculty f ON f.id = d.hod_faculty_id
                    LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
                    WHERE p.id = auth.uid() OR f.auth_user_id = auth.uid() OR f.id = auth.uid()
                )
                OR public.current_user_role() = 'hod'::user_role
            )
            AND status != 'PENDING_COORDINATOR'
        )
        -- 4. Super admin & Service role have unrestricted oversight
        OR public.current_user_role() = 'super_admin'::user_role
        OR auth.role() = 'service_role'
    );

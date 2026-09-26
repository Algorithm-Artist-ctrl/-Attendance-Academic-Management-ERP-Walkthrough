-- ==============================================================================
-- Migration 055: Secure Class Coordinator Atomic RPCs, Authorization & Uniqueness
-- ==============================================================================

-- 1. Ensure Partial Unique Index for Section Active Coordinator
-- Guarantees at database level that a section can never have multiple active coordinators
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_class_coordinator_per_section 
ON public.class_coordinator_assignments (section_id) 
WHERE active = true;

-- 2. Enhanced Atomic RPC: assign_class_coordinator_atomic
-- Enforces HOD/super_admin authorization, row-level locking, conflict deactivation, and section synchronization
CREATE OR REPLACE FUNCTION public.assign_class_coordinator_atomic(
    p_faculty_id UUID,
    p_section_id UUID,
    p_academic_session_id UUID DEFAULT NULL,
    p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_session_id UUID := p_academic_session_id;
    v_year_id UUID;
    v_existing_id UUID;
    v_prev_faculty_id UUID;
    v_prev_faculty_name TEXT;
    v_new_faculty_name TEXT;
    v_sec_name TEXT;
BEGIN
    -- Authorization check: Caller must be super_admin, hod, or service_role
    v_caller_role := COALESCE(public.current_user_role()::text, '');
    IF auth.role() != 'service_role' AND v_caller_role NOT IN ('super_admin', 'hod') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin and HOD can manage Class Coordinator roles.';
    END IF;

    IF p_faculty_id IS NULL THEN
        RAISE EXCEPTION 'Faculty ID is required to assign a Class Coordinator.';
    END IF;

    IF p_section_id IS NULL THEN
        RAISE EXCEPTION 'Section ID is required to assign a Class Coordinator.';
    END IF;

    -- Concurrency Protection: Lock the section row for update to serialize concurrent assignments
    PERFORM 1 FROM public.sections WHERE id = p_section_id FOR UPDATE;

    -- Resolve current academic session if not provided
    IF v_session_id IS NULL THEN
        SELECT id INTO v_session_id 
        FROM public.academic_sessions 
        WHERE is_current = true 
        LIMIT 1;
    END IF;

    -- Resolve academic_year_id and section name
    SELECT sem.academic_year_id, sec.name INTO v_year_id, v_sec_name
    FROM public.sections sec
    LEFT JOIN public.semesters sem ON sem.id = sec.semester_id
    WHERE sec.id = p_section_id;

    -- Check if another faculty member is currently active coordinator for this section
    SELECT faculty_id INTO v_prev_faculty_id
    FROM public.class_coordinator_assignments
    WHERE section_id = p_section_id
      AND active = true
      AND faculty_id != p_faculty_id
    LIMIT 1;

    -- Also check section.class_coordinator_id pointer
    IF v_prev_faculty_id IS NULL THEN
        SELECT class_coordinator_id INTO v_prev_faculty_id
        FROM public.sections
        WHERE id = p_section_id
          AND class_coordinator_id IS NOT NULL
          AND class_coordinator_id != p_faculty_id;
    END IF;

    IF v_prev_faculty_id IS NOT NULL THEN
        SELECT full_name INTO v_prev_faculty_name FROM public.faculty WHERE id = v_prev_faculty_id;
        -- Safely deactivate previous coordinator for this section
        UPDATE public.class_coordinator_assignments
        SET active = false,
            updated_at = NOW()
        WHERE section_id = p_section_id
          AND active = true
          AND faculty_id != p_faculty_id;
    END IF;

    -- Check if assignment record already exists for this faculty and section
    SELECT id INTO v_existing_id
    FROM public.class_coordinator_assignments
    WHERE faculty_id = p_faculty_id
      AND section_id = p_section_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.class_coordinator_assignments
        SET active = true,
            academic_session_id = COALESCE(v_session_id, academic_session_id),
            academic_year_id = COALESCE(v_year_id, academic_year_id),
            assigned_by = COALESCE(p_assigned_by, auth.uid(), assigned_by),
            updated_at = NOW()
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO public.class_coordinator_assignments (
            faculty_id,
            section_id,
            academic_session_id,
            academic_year_id,
            assigned_by,
            active,
            created_at,
            updated_at
        ) VALUES (
            p_faculty_id,
            p_section_id,
            v_session_id,
            v_year_id,
            COALESCE(p_assigned_by, auth.uid()),
            true,
            NOW(),
            NOW()
        );
    END IF;

    -- Update sections table class_coordinator_id pointer
    UPDATE public.sections
    SET class_coordinator_id = p_faculty_id,
        updated_at = NOW()
    WHERE id = p_section_id;

    SELECT full_name INTO v_new_faculty_name FROM public.faculty WHERE id = p_faculty_id;

    RETURN jsonb_build_object(
        'success', true,
        'section_id', p_section_id,
        'faculty_id', p_faculty_id,
        'faculty_name', v_new_faculty_name,
        'section_name', v_sec_name,
        'replaced_faculty_id', v_prev_faculty_id,
        'replaced_faculty_name', v_prev_faculty_name
    );
END;
$$;

-- 3. Enhanced Atomic RPC: remove_class_coordinator_atomic
-- Enforces HOD/super_admin authorization, row-level locking, and thorough deactivation
CREATE OR REPLACE FUNCTION public.remove_class_coordinator_atomic(
    p_faculty_id UUID,
    p_section_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_updated_cca_count INT := 0;
    v_updated_sec_count INT := 0;
BEGIN
    -- Authorization check: Caller must be super_admin, hod, or service_role
    v_caller_role := COALESCE(public.current_user_role()::text, '');
    IF auth.role() != 'service_role' AND v_caller_role NOT IN ('super_admin', 'hod') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin and HOD can manage Class Coordinator roles.';
    END IF;

    IF p_section_id IS NULL THEN
        RAISE EXCEPTION 'Section ID is required to remove class coordinator';
    END IF;

    -- Concurrency Protection: Lock the section row for update
    PERFORM 1 FROM public.sections WHERE id = p_section_id FOR UPDATE;

    -- Deactivate assignment in class_coordinator_assignments
    UPDATE public.class_coordinator_assignments
    SET active = false,
        updated_at = NOW()
    WHERE section_id = p_section_id
      AND (faculty_id = p_faculty_id OR p_faculty_id IS NULL)
      AND active = true;

    GET DIAGNOSTICS v_updated_cca_count = ROW_COUNT;

    -- Clear pointer on sections table
    UPDATE public.sections
    SET class_coordinator_id = NULL,
        updated_at = NOW()
    WHERE id = p_section_id
      AND (class_coordinator_id = p_faculty_id OR p_faculty_id IS NULL);

    GET DIAGNOSTICS v_updated_sec_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'faculty_id', p_faculty_id,
        'section_id', p_section_id,
        'deactivated_assignments', v_updated_cca_count,
        'cleared_sections', v_updated_sec_count
    );
END;
$$;

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.assign_class_coordinator_atomic(UUID, UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_class_coordinator_atomic(UUID, UUID) TO authenticated, service_role;

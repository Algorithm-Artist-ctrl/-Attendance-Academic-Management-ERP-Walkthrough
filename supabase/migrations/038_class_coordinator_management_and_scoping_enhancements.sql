-- ==============================================================================
-- Migration 038: Class Coordinator Management & Scoping Enhancements
-- ==============================================================================

-- 1. Enhance public.class_coordinator_assignments with academic_year_id and assigned_by
ALTER TABLE public.class_coordinator_assignments 
  ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;

ALTER TABLE public.class_coordinator_assignments 
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Backfill academic_year_id from sections -> semesters -> academic_years
UPDATE public.class_coordinator_assignments cca
SET academic_year_id = sem.academic_year_id
FROM public.sections sec
JOIN public.semesters sem ON sem.id = sec.semester_id
WHERE cca.section_id = sec.id 
  AND cca.academic_year_id IS NULL;

-- 3. Replace unconditional unique constraint with partial unique index (where active = true)
-- This allows historical inactive records while preventing multiple active coordinators for the same section & session
ALTER TABLE public.class_coordinator_assignments 
  DROP CONSTRAINT IF EXISTS uq_coordinator_section_session;

DROP INDEX IF EXISTS public.uq_active_coordinator_section_session;

CREATE UNIQUE INDEX uq_active_coordinator_section_session 
  ON public.class_coordinator_assignments (section_id, academic_session_id) 
  WHERE (active = true);

-- Performance index on faculty_id and active
CREATE INDEX IF NOT EXISTS idx_cca_faculty_active 
  ON public.class_coordinator_assignments (faculty_id, active);

CREATE INDEX IF NOT EXISTS idx_cca_section_active 
  ON public.class_coordinator_assignments (section_id, active);

-- 4. Atomic RPC: assign_class_coordinator_atomic
CREATE OR REPLACE FUNCTION public.assign_class_coordinator_atomic(
    p_faculty_id UUID,
    p_section_id UUID,
    p_academic_session_id UUID DEFAULT NULL,
    p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session_id UUID := p_academic_session_id;
    v_year_id UUID;
    v_existing_id UUID;
    v_prev_faculty_id UUID;
    v_prev_faculty_name TEXT;
    v_new_faculty_name TEXT;
    v_sec_name TEXT;
BEGIN
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
    JOIN public.semesters sem ON sem.id = sec.semester_id
    WHERE sec.id = p_section_id;

    -- Check if another faculty is currently active coordinator for this section & session
    SELECT faculty_id INTO v_prev_faculty_id
    FROM public.class_coordinator_assignments
    WHERE section_id = p_section_id
      AND (academic_session_id = v_session_id OR (v_session_id IS NULL AND academic_session_id IS NULL))
      AND active = true
      AND faculty_id != p_faculty_id
    LIMIT 1;

    IF v_prev_faculty_id IS NOT NULL THEN
        SELECT full_name INTO v_prev_faculty_name FROM public.faculty WHERE id = v_prev_faculty_id;
        -- Deactivate previous coordinator
        UPDATE public.class_coordinator_assignments
        SET active = false,
            updated_at = NOW()
        WHERE section_id = p_section_id
          AND (academic_session_id = v_session_id OR (v_session_id IS NULL AND academic_session_id IS NULL))
          AND active = true
          AND faculty_id != p_faculty_id;
    END IF;

    -- Check if assignment already exists for this faculty, section, and session
    SELECT id INTO v_existing_id
    FROM public.class_coordinator_assignments
    WHERE faculty_id = p_faculty_id
      AND section_id = p_section_id
      AND (academic_session_id = v_session_id OR (v_session_id IS NULL AND academic_session_id IS NULL))
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.class_coordinator_assignments
        SET active = true,
            academic_year_id = COALESCE(v_year_id, academic_year_id),
            assigned_by = COALESCE(p_assigned_by, assigned_by),
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
            p_assigned_by,
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

-- 5. Atomic RPC: remove_class_coordinator_atomic
CREATE OR REPLACE FUNCTION public.remove_class_coordinator_atomic(
    p_faculty_id UUID,
    p_section_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Deactivate assignment in class_coordinator_assignments
    UPDATE public.class_coordinator_assignments
    SET active = false,
        updated_at = NOW()
    WHERE faculty_id = p_faculty_id
      AND section_id = p_section_id
      AND active = true;

    -- If this faculty is still the pointer on sections table, clear it
    UPDATE public.sections
    SET class_coordinator_id = NULL,
        updated_at = NOW()
    WHERE id = p_section_id
      AND class_coordinator_id = p_faculty_id;

    RETURN jsonb_build_object(
        'success', true,
        'faculty_id', p_faculty_id,
        'section_id', p_section_id
    );
END;
$$;

-- 6. Refine RLS policy on public.attendance_corrections for strict teaching responsibility
DROP POLICY IF EXISTS "attendance_corrections_read" ON public.attendance_corrections;

CREATE POLICY "attendance_corrections_read" ON public.attendance_corrections
  FOR SELECT TO authenticated
  USING (
    student_id = current_user_student_id()
    OR current_user_role() IN ('super_admin', 'hod')
    OR (
      current_user_role() = 'faculty'
      AND (
        reviewed_by = current_user_faculty_id()
        OR EXISTS (
          SELECT 1 FROM public.attendance_records ar
          JOIN public.attendance_sessions s ON s.id = ar.attendance_session_id
          WHERE ar.id = attendance_corrections.attendance_record_id
            AND (
              s.faculty_id = current_user_faculty_id()
              OR is_assigned_faculty(current_user_faculty_id(), s.section_id, s.subject_id)
            )
        )
      )
    )
    OR auth.role() = 'service_role'
  );

-- Grant execute permissions on RPCs
GRANT EXECUTE ON FUNCTION public.assign_class_coordinator_atomic(UUID, UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_class_coordinator_atomic(UUID, UUID) TO authenticated, service_role;

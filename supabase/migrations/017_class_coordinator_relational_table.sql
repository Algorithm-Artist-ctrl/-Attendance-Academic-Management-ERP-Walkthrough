-- ==============================================================================
-- Migration 017: Class Coordinator Relational Table & Performance Indexes
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Create class_coordinator_assignments table
CREATE TABLE IF NOT EXISTS public.class_coordinator_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_coordinator_section_session UNIQUE (section_id, academic_session_id)
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cca_faculty_id ON public.class_coordinator_assignments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_cca_section_id ON public.class_coordinator_assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_cca_session_id ON public.class_coordinator_assignments(academic_session_id);
CREATE INDEX IF NOT EXISTS idx_cca_active ON public.class_coordinator_assignments(active);

CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(active);
CREATE INDEX IF NOT EXISTS idx_fsa_section_id ON public.faculty_subject_assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_fsa_faculty_active ON public.faculty_subject_assignments(faculty_id, active);
CREATE INDEX IF NOT EXISTS idx_tt_faculty_active ON public.timetable_entries(faculty_id, active);
CREATE INDEX IF NOT EXISTS idx_sections_coordinator ON public.sections(class_coordinator_id);

-- 3. Enable RLS
ALTER TABLE public.class_coordinator_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_coordinator_assignments_read" ON public.class_coordinator_assignments;
CREATE POLICY "class_coordinator_assignments_read" ON public.class_coordinator_assignments
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "class_coordinator_assignments_manage" ON public.class_coordinator_assignments;
CREATE POLICY "class_coordinator_assignments_manage" ON public.class_coordinator_assignments
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role');

-- 4. Enable Supabase Realtime for coordinator table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'class_coordinator_assignments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_coordinator_assignments;
    END IF;
END $$;

-- 5. Data Correction & Initial Population
DO $$
DECLARE
    v_session_id UUID;
    v_hemlata_id UUID;
    v_imran_id UUID;
    v_sec_2a UUID;
    v_sec_2b UUID;
    v_sec_1b UUID;
BEGIN
    -- Current session
    SELECT id INTO v_session_id FROM public.academic_sessions WHERE is_current = true LIMIT 1;

    -- Faculty IDs
    SELECT id INTO v_hemlata_id FROM public.faculty WHERE employee_code = 'FAC-CSE-002' OR full_name ILIKE '%Hemlata%' LIMIT 1;
    SELECT id INTO v_imran_id FROM public.faculty WHERE employee_code = 'FAC-CSE-003' OR full_name ILIKE '%Imran Raza Khan%' LIMIT 1;

    -- 2nd Year Section IDs
    SELECT s.id INTO v_sec_2a 
    FROM public.sections s 
    JOIN public.semesters sem ON sem.id = s.semester_id 
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id 
    WHERE ay.year_number = 2 AND s.name = 'A' LIMIT 1;

    SELECT s.id INTO v_sec_2b 
    FROM public.sections s 
    JOIN public.semesters sem ON sem.id = s.semester_id 
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id 
    WHERE ay.year_number = 2 AND s.name = 'B' LIMIT 1;

    -- 1st Year Section B (should be cleared)
    SELECT s.id INTO v_sec_1b 
    FROM public.sections s 
    JOIN public.semesters sem ON sem.id = s.semester_id 
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id 
    WHERE ay.year_number = 1 AND s.name = 'B' LIMIT 1;

    -- Fix legacy sections.class_coordinator_id
    IF v_sec_2a IS NOT NULL AND v_hemlata_id IS NOT NULL THEN
        UPDATE public.sections SET class_coordinator_id = v_hemlata_id WHERE id = v_sec_2a;
    END IF;

    IF v_sec_2b IS NOT NULL AND v_imran_id IS NOT NULL THEN
        UPDATE public.sections SET class_coordinator_id = v_imran_id WHERE id = v_sec_2b;
    END IF;

    IF v_sec_1b IS NOT NULL THEN
        UPDATE public.sections SET class_coordinator_id = NULL WHERE id = v_sec_1b;
    END IF;

    -- Seed class_coordinator_assignments
    IF v_sec_2a IS NOT NULL AND v_hemlata_id IS NOT NULL THEN
        INSERT INTO public.class_coordinator_assignments (faculty_id, section_id, academic_session_id, active)
        VALUES (v_hemlata_id, v_sec_2a, v_session_id, true)
        ON CONFLICT (section_id, academic_session_id) 
        DO UPDATE SET faculty_id = v_hemlata_id, active = true, updated_at = now();
    END IF;

    IF v_sec_2b IS NOT NULL AND v_imran_id IS NOT NULL THEN
        INSERT INTO public.class_coordinator_assignments (faculty_id, section_id, academic_session_id, active)
        VALUES (v_imran_id, v_sec_2b, v_session_id, true)
        ON CONFLICT (section_id, academic_session_id) 
        DO UPDATE SET faculty_id = v_imran_id, active = true, updated_at = now();
    END IF;

    RAISE NOTICE 'Migration 017: Coordinator relations successfully established for 2nd Year Sec A (Hemlata) and Sec B (Imran).';
END $$;

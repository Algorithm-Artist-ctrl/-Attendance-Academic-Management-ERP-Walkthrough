-- VCTM Attendance & Academic Management ERP
-- Migration 003: Multi-Year Academic Structure & Admin Identity
-- Seeds Years 1, 3, 4 with semesters and sections; updates Super Admin profile

DO $$
DECLARE
    v_prog_id UUID;
    v_dept_id UUID;
    v_session_id UUID;
    v_year_1_id UUID;
    v_year_2_id UUID;
    v_year_3_id UUID;
    v_year_4_id UUID;
    v_sem_1_id UUID;
    v_sem_3_id UUID;
    v_sem_5_id UUID;
    v_sem_7_id UUID;
BEGIN
    -- Resolve existing program and department
    SELECT id INTO v_prog_id FROM public.programs WHERE code = 'BTECH-CSE' LIMIT 1;
    SELECT id INTO v_dept_id FROM public.departments WHERE code = 'CSE' LIMIT 1;
    SELECT id INTO v_session_id FROM public.academic_sessions WHERE is_current = true LIMIT 1;

    IF v_prog_id IS NULL THEN
        RAISE EXCEPTION 'B.Tech CSE program not found — run migration 002 first';
    END IF;

    -- ============================================================
    -- 1. Seed Academic Years (1st, 3rd, 4th — 2nd already exists)
    -- ============================================================
    INSERT INTO public.academic_years (id, program_id, year_number, name, active)
    VALUES (gen_random_uuid(), v_prog_id, 1, '1st Year', true)
    ON CONFLICT (program_id, year_number) DO UPDATE SET name = EXCLUDED.name, active = true
    RETURNING id INTO v_year_1_id;

    -- Get existing 2nd Year ID
    SELECT id INTO v_year_2_id FROM public.academic_years
    WHERE program_id = v_prog_id AND year_number = 2;

    INSERT INTO public.academic_years (id, program_id, year_number, name, active)
    VALUES (gen_random_uuid(), v_prog_id, 3, '3rd Year', true)
    ON CONFLICT (program_id, year_number) DO UPDATE SET name = EXCLUDED.name, active = true
    RETURNING id INTO v_year_3_id;

    INSERT INTO public.academic_years (id, program_id, year_number, name, active)
    VALUES (gen_random_uuid(), v_prog_id, 4, '4th Year', true)
    ON CONFLICT (program_id, year_number) DO UPDATE SET name = EXCLUDED.name, active = true
    RETURNING id INTO v_year_4_id;

    -- ============================================================
    -- 2. Seed Odd Semesters for each year
    --    Year 1 → Sem 1, Year 2 → Sem 3 (exists), Year 3 → Sem 5, Year 4 → Sem 7
    -- ============================================================
    INSERT INTO public.semesters (id, academic_year_id, semester_number, name, active)
    VALUES (gen_random_uuid(), v_year_1_id, 1, '1st Semester (Odd Semester 2026-2027)', true)
    ON CONFLICT (academic_year_id, semester_number) DO UPDATE SET name = EXCLUDED.name, active = true
    RETURNING id INTO v_sem_1_id;

    -- Get existing 3rd Semester ID
    SELECT id INTO v_sem_3_id FROM public.semesters
    WHERE academic_year_id = v_year_2_id AND semester_number = 3;

    INSERT INTO public.semesters (id, academic_year_id, semester_number, name, active)
    VALUES (gen_random_uuid(), v_year_3_id, 5, '5th Semester (Odd Semester 2026-2027)', true)
    ON CONFLICT (academic_year_id, semester_number) DO UPDATE SET name = EXCLUDED.name, active = true
    RETURNING id INTO v_sem_5_id;

    INSERT INTO public.semesters (id, academic_year_id, semester_number, name, active)
    VALUES (gen_random_uuid(), v_year_4_id, 7, '7th Semester (Odd Semester 2026-2027)', true)
    ON CONFLICT (academic_year_id, semester_number) DO UPDATE SET name = EXCLUDED.name, active = true
    RETURNING id INTO v_sem_7_id;

    -- ============================================================
    -- 3. Seed Sections A & B for each new semester
    --    (Year 2 / Sem 3 sections already exist)
    -- ============================================================

    -- Year 1, Sem 1 sections
    INSERT INTO public.sections (id, semester_id, name, room_number, active)
    VALUES
        (gen_random_uuid(), v_sem_1_id, 'A', 'TBD', true),
        (gen_random_uuid(), v_sem_1_id, 'B', 'TBD', true)
    ON CONFLICT (semester_id, name) DO NOTHING;

    -- Year 3, Sem 5 sections
    INSERT INTO public.sections (id, semester_id, name, room_number, active)
    VALUES
        (gen_random_uuid(), v_sem_5_id, 'A', 'TBD', true),
        (gen_random_uuid(), v_sem_5_id, 'B', 'TBD', true)
    ON CONFLICT (semester_id, name) DO NOTHING;

    -- Year 4, Sem 7 sections
    INSERT INTO public.sections (id, semester_id, name, room_number, active)
    VALUES
        (gen_random_uuid(), v_sem_7_id, 'A', 'TBD', true),
        (gen_random_uuid(), v_sem_7_id, 'B', 'TBD', true)
    ON CONFLICT (semester_id, name) DO NOTHING;

    -- ============================================================
    -- 4. Update Super Admin profile to Tarun Kushwah
    -- ============================================================
    UPDATE public.profiles
    SET full_name = 'Tarun Kushwah'
    WHERE role = 'super_admin';

    -- Insert if no super_admin profile exists
    IF NOT FOUND THEN
        INSERT INTO public.profiles (id, email, role, full_name)
        VALUES (gen_random_uuid(), 'admin@vctm.in', 'super_admin', 'Tarun Kushwah');
    END IF;

    -- ============================================================
    -- Summary
    -- ============================================================
    RAISE NOTICE '=== Multi-Year Structure Seeded ===';
    RAISE NOTICE 'Year 1 (ID: %): Sem 1 (ID: %)', v_year_1_id, v_sem_1_id;
    RAISE NOTICE 'Year 2 (ID: %): Sem 3 (ID: %) [existing]', v_year_2_id, v_sem_3_id;
    RAISE NOTICE 'Year 3 (ID: %): Sem 5 (ID: %)', v_year_3_id, v_sem_5_id;
    RAISE NOTICE 'Year 4 (ID: %): Sem 7 (ID: %)', v_year_4_id, v_sem_7_id;
    RAISE NOTICE 'Total sections: %', (SELECT count(*) FROM public.sections WHERE active = true);
    RAISE NOTICE 'Super Admin profile updated to Tarun Kushwah';
END $$;

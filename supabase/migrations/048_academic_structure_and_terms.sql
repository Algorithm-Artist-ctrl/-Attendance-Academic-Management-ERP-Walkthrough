-- ======================================================================
-- Migration 048: Academic Structure, Semester/Term Management,
--                Department & HOD Controls, and Relational Safeguards
-- ======================================================================

-- 1. ENRICH SEMESTERS TABLE WITH SESSION, TERM TYPE & DATES
ALTER TABLE public.semesters 
ADD COLUMN IF NOT EXISTS academic_session_id uuid REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS term_type text CHECK (term_type IN ('ODD', 'EVEN')),
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('ACTIVE', 'UPCOMING', 'CLOSED')) DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT false;

-- Add index on session and status
CREATE INDEX IF NOT EXISTS idx_semesters_session_current ON public.semesters(academic_session_id, is_current);
CREATE INDEX IF NOT EXISTS idx_semesters_term_type ON public.semesters(term_type);

-- 2. LINK EXISTING SEMESTERS TO CURRENT ACADEMIC SESSION (2026-2027)
DO $$
DECLARE
  v_session_id uuid;
  v_btech_id uuid;
  v_yr1_id uuid;
  v_yr2_id uuid;
  v_yr3_id uuid;
  v_yr4_id uuid;
BEGIN
  -- Resolve active session
  SELECT id INTO v_session_id FROM public.academic_sessions WHERE is_current = true LIMIT 1;
  IF v_session_id IS NULL THEN
    SELECT id INTO v_session_id FROM public.academic_sessions LIMIT 1;
  END IF;

  -- Resolve B.Tech program
  SELECT id INTO v_btech_id FROM public.programs WHERE code = 'BTECH-CSE' LIMIT 1;
  IF v_btech_id IS NULL THEN
    SELECT id INTO v_btech_id FROM public.programs LIMIT 1;
  END IF;

  -- Resolve academic years for B.Tech
  SELECT id INTO v_yr1_id FROM public.academic_years WHERE program_id = v_btech_id AND year_number = 1 LIMIT 1;
  SELECT id INTO v_yr2_id FROM public.academic_years WHERE program_id = v_btech_id AND year_number = 2 LIMIT 1;
  SELECT id INTO v_yr3_id FROM public.academic_years WHERE program_id = v_btech_id AND year_number = 3 LIMIT 1;
  SELECT id INTO v_yr4_id FROM public.academic_years WHERE program_id = v_btech_id AND year_number = 4 LIMIT 1;

  -- Update existing odd semesters
  UPDATE public.semesters
  SET 
    academic_session_id = v_session_id,
    term_type = 'ODD',
    start_date = '2026-08-01',
    end_date = '2026-12-31',
    status = 'ACTIVE',
    is_current = true
  WHERE semester_number IN (1, 3, 5, 7);

  -- Insert even semesters if they don't exist
  -- Semester 2 (1st Year)
  IF v_yr1_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.semesters WHERE academic_year_id = v_yr1_id AND semester_number = 2) THEN
    INSERT INTO public.semesters (academic_year_id, semester_number, name, active, academic_session_id, term_type, start_date, end_date, status, is_current)
    VALUES (v_yr1_id, 2, '2nd Semester (Even Semester 2026-2027)', true, v_session_id, 'EVEN', '2027-01-15', '2027-06-30', 'UPCOMING', false);
  END IF;

  -- Semester 4 (2nd Year)
  IF v_yr2_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.semesters WHERE academic_year_id = v_yr2_id AND semester_number = 4) THEN
    INSERT INTO public.semesters (academic_year_id, semester_number, name, active, academic_session_id, term_type, start_date, end_date, status, is_current)
    VALUES (v_yr2_id, 4, '4th Semester (Even Semester 2026-2027)', true, v_session_id, 'EVEN', '2027-01-15', '2027-06-30', 'UPCOMING', false);
  END IF;

  -- Semester 6 (3rd Year)
  IF v_yr3_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.semesters WHERE academic_year_id = v_yr3_id AND semester_number = 6) THEN
    INSERT INTO public.semesters (academic_year_id, semester_number, name, active, academic_session_id, term_type, start_date, end_date, status, is_current)
    VALUES (v_yr3_id, 6, '6th Semester (Even Semester 2026-2027)', true, v_session_id, 'EVEN', '2027-01-15', '2027-06-30', 'UPCOMING', false);
  END IF;

  -- Semester 8 (4th Year)
  IF v_yr4_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.semesters WHERE academic_year_id = v_yr4_id AND semester_number = 8) THEN
    INSERT INTO public.semesters (academic_year_id, semester_number, name, active, academic_session_id, term_type, start_date, end_date, status, is_current)
    VALUES (v_yr4_id, 8, '8th Semester (Even Semester 2026-2027)', true, v_session_id, 'EVEN', '2027-01-15', '2027-06-30', 'UPCOMING', false);
  END IF;

END $$;

-- 3. ENSURE MCA PROGRAM DURATION IS DYNAMIC AND REALISTIC (2 YEARS FOR MASTER'S)
UPDATE public.programs
SET duration_years = 2, updated_at = now()
WHERE code = 'MCA' AND duration_years = 4;

-- 4. RPC: SET CURRENT ACADEMIC TERM ATOMICALLY
CREATE OR REPLACE FUNCTION public.set_current_academic_term(
  p_session_id uuid,
  p_term_type text,
  p_semester_number int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count int := 0;
BEGIN
  IF p_term_type NOT IN ('ODD', 'EVEN') THEN
    RAISE EXCEPTION 'Invalid term type: %. Must be ODD or EVEN.', p_term_type;
  END IF;

  -- Set non-matching semesters to not current
  UPDATE public.semesters
  SET 
    is_current = false,
    status = CASE WHEN status = 'ACTIVE' THEN 'UPCOMING' ELSE status END
  WHERE academic_session_id = p_session_id 
    AND term_type != p_term_type;

  -- Set matching semesters to current and active
  IF p_semester_number IS NOT NULL THEN
    UPDATE public.semesters
    SET 
      is_current = true,
      status = 'ACTIVE'
    WHERE academic_session_id = p_session_id 
      AND semester_number = p_semester_number;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  ELSE
    UPDATE public.semesters
    SET 
      is_current = true,
      status = 'ACTIVE'
    WHERE academic_session_id = p_session_id 
      AND term_type = p_term_type;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'term_type', p_term_type,
    'semesters_updated', v_updated_count
  );
END;
$$;

-- 5. RPC: CHECK DEPARTMENT DEPENDENCIES
CREATE OR REPLACE FUNCTION public.check_department_dependencies(p_department_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_count int := 0;
  v_faculty_count int := 0;
  v_student_count int := 0;
  v_subject_count int := 0;
  v_section_count int := 0;
  v_timetable_count int := 0;
  v_total int := 0;
BEGIN
  SELECT count(*) INTO v_program_count FROM public.programs WHERE department_id = p_department_id;
  SELECT count(*) INTO v_faculty_count FROM public.faculty WHERE department_id = p_department_id;
  SELECT count(*) INTO v_student_count FROM public.students WHERE department_id = p_department_id;
  SELECT count(*) INTO v_subject_count FROM public.subjects WHERE department_id = p_department_id;

  -- Sections under department's programs
  SELECT count(*) INTO v_section_count 
  FROM public.sections sec
  JOIN public.semesters sem ON sec.semester_id = sem.id
  JOIN public.academic_years ay ON sem.academic_year_id = ay.id
  JOIN public.programs p ON ay.program_id = p.id
  WHERE p.department_id = p_department_id;

  -- Timetable entries
  SELECT count(*) INTO v_timetable_count
  FROM public.timetable_entries te
  JOIN public.subjects s ON te.subject_id = s.id
  WHERE s.department_id = p_department_id;

  v_total := v_program_count + v_faculty_count + v_student_count + v_subject_count + v_section_count + v_timetable_count;

  RETURN jsonb_build_object(
    'department_id', p_department_id,
    'program_count', v_program_count,
    'faculty_count', v_faculty_count,
    'student_count', v_student_count,
    'subject_count', v_subject_count,
    'section_count', v_section_count,
    'timetable_count', v_timetable_count,
    'total_references', v_total,
    'can_hard_delete', (v_total = 0)
  );
END;
$$;

-- 6. RPC: ASSIGN DEPARTMENT HOD WITH PROFILE SYNCHRONIZATION
CREATE OR REPLACE FUNCTION public.assign_department_hod(
  p_department_id uuid,
  p_faculty_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_hod_id uuid;
  v_dept_name text;
  v_fac_name text;
  v_fac_auth_id uuid;
  v_old_fac_auth_id uuid;
BEGIN
  -- Validate department
  SELECT name, hod_faculty_id INTO v_dept_name, v_old_hod_id
  FROM public.departments WHERE id = p_department_id;

  IF v_dept_name IS NULL THEN
    RAISE EXCEPTION 'Department not found.';
  END IF;

  -- Validate faculty
  SELECT full_name, auth_user_id INTO v_fac_name, v_fac_auth_id
  FROM public.faculty WHERE id = p_faculty_id AND status = 'ACTIVE';

  IF v_fac_name IS NULL THEN
    RAISE EXCEPTION 'Faculty not found or not active.';
  END IF;

  -- Update department
  UPDATE public.departments
  SET hod_faculty_id = p_faculty_id, updated_at = now()
  WHERE id = p_department_id;

  -- Update new HOD profile to 'hod'
  IF v_fac_auth_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'hod', department_id = p_department_id
    WHERE id = v_fac_auth_id AND role = 'faculty';
  END IF;

  -- If old HOD exists and is different, check if they head any other department
  IF v_old_hod_id IS NOT NULL AND v_old_hod_id != p_faculty_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.departments WHERE hod_faculty_id = v_old_hod_id AND id != p_department_id) THEN
      SELECT auth_user_id INTO v_old_fac_auth_id FROM public.faculty WHERE id = v_old_hod_id;
      IF v_old_fac_auth_id IS NOT NULL THEN
        UPDATE public.profiles
        SET role = 'faculty'
        WHERE id = v_old_fac_auth_id AND role = 'hod';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'department_id', p_department_id,
    'department_name', v_dept_name,
    'new_hod_faculty_id', p_faculty_id,
    'new_hod_name', v_fac_name,
    'old_hod_faculty_id', v_old_hod_id
  );
END;
$$;

-- 7. RPC: REMOVE DEPARTMENT HOD SAFELY
CREATE OR REPLACE FUNCTION public.remove_department_hod(p_department_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_hod_id uuid;
  v_dept_name text;
  v_old_fac_auth_id uuid;
BEGIN
  SELECT name, hod_faculty_id INTO v_dept_name, v_old_hod_id
  FROM public.departments WHERE id = p_department_id;

  IF v_dept_name IS NULL THEN
    RAISE EXCEPTION 'Department not found.';
  END IF;

  IF v_old_hod_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Department has no appointed HOD.');
  END IF;

  -- Clear department HOD
  UPDATE public.departments
  SET hod_faculty_id = NULL, updated_at = now()
  WHERE id = p_department_id;

  -- Check if old HOD heads any other department
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE hod_faculty_id = v_old_hod_id) THEN
    SELECT auth_user_id INTO v_old_fac_auth_id FROM public.faculty WHERE id = v_old_hod_id;
    IF v_old_fac_auth_id IS NOT NULL THEN
      UPDATE public.profiles
      SET role = 'faculty'
      WHERE id = v_old_fac_auth_id AND role = 'hod';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'department_id', p_department_id,
    'department_name', v_dept_name,
    'removed_hod_faculty_id', v_old_hod_id
  );
END;
$$;

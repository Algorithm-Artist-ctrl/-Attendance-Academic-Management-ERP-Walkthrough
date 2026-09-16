-- Migration 014: Faculty Relational Assignments, Hierarchy Foreign Keys & Safe Deletion Functions

-- 1. Enhance faculty_subject_assignments with direct hierarchy foreign keys
ALTER TABLE public.faculty_subject_assignments 
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id),
ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id),
ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES public.academic_years(id),
ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id);

-- 2. Backfill existing assignments with hierarchy IDs
UPDATE public.faculty_subject_assignments fsa
SET 
  semester_id = sec.semester_id,
  academic_year_id = sem.academic_year_id,
  program_id = ay.program_id,
  department_id = p.department_id
FROM public.sections sec
JOIN public.semesters sem ON sem.id = sec.semester_id
JOIN public.academic_years ay ON ay.id = sem.academic_year_id
JOIN public.programs p ON p.id = ay.program_id
WHERE fsa.section_id = sec.id
  AND (fsa.semester_id IS NULL OR fsa.academic_year_id IS NULL);

-- 3. Create helper function for checking faculty historical data before deletion
CREATE OR REPLACE FUNCTION public.check_faculty_historical_records(target_faculty_id uuid)
RETURNS TABLE (
  has_attendance boolean,
  has_timetable boolean,
  has_assignments boolean,
  attendance_count bigint,
  timetable_count bigint,
  assignment_count bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (EXISTS (SELECT 1 FROM public.attendance_sessions WHERE faculty_id = target_faculty_id)) AS has_attendance,
    (EXISTS (SELECT 1 FROM public.timetable_entries WHERE faculty_id = target_faculty_id)) AS has_timetable,
    (EXISTS (SELECT 1 FROM public.faculty_subject_assignments WHERE faculty_id = target_faculty_id AND active = true)) AS has_assignments,
    (SELECT COUNT(*) FROM public.attendance_sessions WHERE faculty_id = target_faculty_id) AS attendance_count,
    (SELECT COUNT(*) FROM public.timetable_entries WHERE faculty_id = target_faculty_id) AS timetable_count,
    (SELECT COUNT(*) FROM public.faculty_subject_assignments WHERE faculty_id = target_faculty_id AND active = true) AS assignment_count;
END;
$$;

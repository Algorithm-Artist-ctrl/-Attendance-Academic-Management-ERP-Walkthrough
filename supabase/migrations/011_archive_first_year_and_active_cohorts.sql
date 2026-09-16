-- VCTM Attendance & Academic Management ERP
-- Migration 011: Archive 1st Year & Restrict Active Structure to 2nd, 3rd, 4th Year
-- Preserves relational integrity and historical records by setting active = false

-- 1. Archive 1st Year Academic Year record
UPDATE public.academic_years 
SET active = false, updated_at = NOW() 
WHERE year_number = 1;

-- 2. Archive 1st Year Semesters (1st & 2nd Semester if linked to year_number 1)
UPDATE public.semesters 
SET active = false, updated_at = NOW() 
WHERE academic_year_id IN (
    SELECT id FROM public.academic_years WHERE year_number = 1
) OR semester_number = 1;

-- 3. Archive 1st Year Sections (Sections linked to 1st Year Semesters)
UPDATE public.sections 
SET active = false, updated_at = NOW() 
WHERE semester_id IN (
    SELECT id FROM public.semesters 
    WHERE academic_year_id IN (SELECT id FROM public.academic_years WHERE year_number = 1)
       OR semester_number = 1
);

-- 4. Archive 1st Year Students
UPDATE public.students 
SET active = false, updated_at = NOW() 
WHERE academic_year_id IN (
    SELECT id FROM public.academic_years WHERE year_number = 1
);

-- 5. Audit Log
INSERT INTO public.audit_logs (
    action,
    actor_name,
    actor_role,
    entity_type,
    entity_id,
    new_values
) 
SELECT 
    'ARCHIVE_ACADEMIC_YEAR_1ST_YEAR',
    'System Migration',
    'super_admin',
    'academic_years',
    id,
    jsonb_build_object(
        'reason', '1st Year removed from active academic structure as per institutional directive',
        'year_number', year_number,
        'name', name,
        'archived_at', NOW()
    )
FROM public.academic_years 
WHERE year_number = 1;

-- ==============================================================================
-- Migration 028: Performance Composite Indexes & Query Optimization
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Faculty Attendance Session Query Optimization (Faculty Dashboard & Attendance History)
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_faculty_date 
ON public.attendance_sessions(faculty_id, session_date DESC);

-- 2. Attendance Records Session Status Tally (Present/Absent counts per session)
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_status 
ON public.attendance_records(attendance_session_id, status);

-- 3. Student Roll Number Fast Resolution (Sub-second Login & Identifier Search)
CREATE INDEX IF NOT EXISTS idx_students_roll_number_lookup 
ON public.students(roll_number);

-- 4. Faculty Employee Code Fast Resolution (Sub-second Login & Identifier Search)
CREATE INDEX IF NOT EXISTS idx_faculty_employee_code_lookup 
ON public.faculty(employee_code);

-- 5. Active Student Section Roster (Take Attendance Roster & Section Management)
CREATE INDEX IF NOT EXISTS idx_students_section_active 
ON public.students(section_id, active);

-- 6. Sessional Assessment Student Lookup (Sessional Marks Entry & Grade Reports)
CREATE INDEX IF NOT EXISTS idx_sessional_marks_assessment_student 
ON public.sessional_marks(sessional_assessment_id, student_id);

-- 7. Recent Attendance Corrections Optimization
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_created 
ON public.attendance_corrections(created_at DESC);

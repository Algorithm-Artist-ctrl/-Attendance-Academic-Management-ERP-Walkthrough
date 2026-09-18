-- ==============================================================================
-- Migration 025: Performance Composite Indexes & Query Optimization
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. High-frequency notification queries: recipient_user_id + is_read + created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created 
ON public.notifications(recipient_user_id, is_read, created_at DESC);

-- 2. Student notification lookup by student ID
CREATE INDEX IF NOT EXISTS idx_notifications_student_unread_created 
ON public.notifications(recipient_student_id, is_read, created_at DESC);

-- 3. Sessional marks composite lookup for student grade reports
CREATE INDEX IF NOT EXISTS idx_sessional_marks_student_sub_sec 
ON public.sessional_marks(student_id, subject_id, section_id);

-- 4. Timetable active entries lookup by section and faculty
CREATE INDEX IF NOT EXISTS idx_timetable_section_faculty_active 
ON public.timetable_entries(section_id, faculty_id, active);

-- 5. Attendance records student session lookup
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_session 
ON public.attendance_records(student_id, attendance_session_id);

-- 6. Attendance sessions composite lookup by section, date, and faculty
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_sec_date_fac 
ON public.attendance_sessions(section_id, session_date DESC, faculty_id);

-- 7. Ensure notification table REPLICA IDENTITY FULL for granular Realtime payload filters
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

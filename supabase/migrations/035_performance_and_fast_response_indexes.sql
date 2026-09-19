-- ==============================================================================
-- Migration 035: Performance & Fast Response Composite Indexes
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Active Section Student Roster Index (Sub-millisecond Take Attendance & Marks Roster)
CREATE INDEX IF NOT EXISTS idx_students_section_active_status 
ON public.students(section_id, active, status) 
INCLUDE (id, roll_number, full_name);

-- 2. Student Authentication User ID Fast Lookup
CREATE INDEX IF NOT EXISTS idx_students_auth_user_id 
ON public.students(auth_user_id) 
WHERE auth_user_id IS NOT NULL;

-- 3. Faculty Authentication User ID Fast Lookup
CREATE INDEX IF NOT EXISTS idx_faculty_auth_user_id 
ON public.faculty(auth_user_id) 
WHERE auth_user_id IS NOT NULL;

-- 4. Attendance Records Fast Session & Student Reconciliation
CREATE INDEX IF NOT EXISTS idx_attendance_records_sess_stud 
ON public.attendance_records(attendance_session_id, student_id, status);

-- 5. Attendance Sessions Fast Section Date Lookup (Eliminates full table scans)
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_sec_date_faculty 
ON public.attendance_sessions(section_id, session_date DESC, faculty_id);

-- 6. Sessional Marks Assessment & Status Filter (Sub-second Published/Draft resolution)
CREATE INDEX IF NOT EXISTS idx_sessional_marks_assessment_status 
ON public.sessional_marks(sessional_assessment_id, status) 
INCLUDE (student_id, marks_obtained);

-- 7. Group Messages Fast Timeline Scroll (Sub-10ms active thread rendering)
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created_desc 
ON public.group_messages(group_id, created_at DESC) 
INCLUDE (id, sender_user_id, message);

-- 8. Direct Messages Fast Conversation Timeline
CREATE INDEX IF NOT EXISTS idx_messages_conv_created_desc 
ON public.messages(conversation_id, created_at DESC) 
INCLUDE (id, sender_user_id, read_at);

-- 9. Notifications Unread Filter Index
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user_read 
ON public.notifications(recipient_user_id, is_read, created_at DESC);

-- 10. Student Leave Applications Status & Section Filter
CREATE INDEX IF NOT EXISTS idx_leave_applications_student_status 
ON public.leave_applications(student_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_applications_section_status 
ON public.leave_applications(section_id, status, created_at DESC);

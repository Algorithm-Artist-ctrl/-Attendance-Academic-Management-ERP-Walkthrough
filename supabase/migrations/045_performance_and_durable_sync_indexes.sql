-- Migration 045: Performance & Durable Sync Indexes for VCTM ERP
-- Optimizes high-throughput attendance, marks, and message idempotency lookups

-- 1. Fast lookup for attendance sessions by faculty and date
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_fac_date 
ON public.attendance_sessions (faculty_id, session_date DESC);

-- 2. Fast lookup for attendance sessions by section, subject, and date
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_sec_sub_date 
ON public.attendance_sessions (section_id, subject_id, session_date DESC);

-- 3. Composite index for attendance record roster lookup & updates
CREATE INDEX IF NOT EXISTS idx_attendance_records_sess_student 
ON public.attendance_records (attendance_session_id, student_id);

-- 4. Fast student portal personal attendance timeline
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_recent 
ON public.attendance_records (student_id, created_at DESC);

-- 5. Sub-millisecond idempotency index for group message outbox deduplication
CREATE INDEX IF NOT EXISTS idx_group_messages_idempotency 
ON public.group_messages (client_message_id, sender_user_id) 
WHERE client_message_id IS NOT NULL;

-- 6. Student sessional marks scorecard composite lookup
CREATE INDEX IF NOT EXISTS idx_sessional_marks_student_assessment 
ON public.sessional_marks (student_id, sessional_assessment_id);

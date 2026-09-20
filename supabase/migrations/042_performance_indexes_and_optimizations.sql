-- Migration 042: High-Performance Composite and Partial Indexes for VCTM ERP
-- Optimizes query latency for assessments, notices, notifications, timetable, and messaging

-- 1. Quizzes: Fast filtering by section, subject, and active status
CREATE INDEX IF NOT EXISTS idx_quizzes_sec_subj_active 
ON public.quizzes (section_id, subject_id, active, created_at DESC) 
WHERE deleted_at IS NULL;

-- 2. Assignments: Fast filtering by section, subject, and active status
CREATE INDEX IF NOT EXISTS idx_assignments_sec_subj_active 
ON public.assignments (section_id, subject_id, active, created_at DESC) 
WHERE deleted_at IS NULL;

-- 3. Sessional Assessments: Fast lookup by section and subject
CREATE INDEX IF NOT EXISTS idx_sessional_assessments_sec_subj_act 
ON public.sessional_assessments (section_id, subject_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

-- 4. Sessional Marks: Fast roster extraction for assessment grading
CREATE INDEX IF NOT EXISTS idx_sessional_marks_assessment_roster 
ON public.sessional_marks (sessional_assessment_id, student_id, marks_obtained);

-- 5. Notifications: Fast Bell Icon and Unread Counter
CREATE INDEX IF NOT EXISTS idx_notifications_bell_unread 
ON public.notifications (recipient_user_id, is_read, created_at DESC);

-- 6. Notices: Public Feed with Pinned Priority
CREATE INDEX IF NOT EXISTS idx_notices_feed 
ON public.notices (is_pinned DESC, created_at DESC) 
WHERE (deleted_at IS NULL AND status != 'DELETED');

-- 7. Group Messages: Fast Chronological Stream
CREATE INDEX IF NOT EXISTS idx_group_messages_active_stream 
ON public.group_messages (group_id, created_at ASC) 
WHERE is_deleted = false;

-- 8. Timetable: Rapid Section & Faculty Slot Resolution
CREATE INDEX IF NOT EXISTS idx_timetable_sec_act 
ON public.timetable_entries (section_id, active, period_number);

CREATE INDEX IF NOT EXISTS idx_timetable_fac_act 
ON public.timetable_entries (faculty_id, active, period_number);

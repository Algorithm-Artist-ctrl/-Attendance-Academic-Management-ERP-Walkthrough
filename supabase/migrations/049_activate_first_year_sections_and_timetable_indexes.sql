-- Migration 049: Activate First Year Sections and Create Timetable Optimization Indexes
-- Ensures 1st Year sections are active so they participate in academic workflows
-- Adds composite indexes on timetable_entries to prevent query latency and lock contention

-- 1. Activate 1st Year Sections (B.Tech 1st Year Section A and Section B)
UPDATE public.sections
SET active = true,
    updated_at = NOW()
WHERE id IN (
  '5f7d4a1c-4069-4dac-8998-a7b11bd3cc2f', -- Section A (1st Year)
  '669d601d-8535-42f8-99cb-1196eebd897b'  -- Section B (1st Year)
);

-- Also ensure any section associated with active semesters is active by default
UPDATE public.sections s
SET active = true,
    updated_at = NOW()
FROM public.semesters sem
WHERE s.semester_id = sem.id
  AND sem.active = true
  AND s.active = false
  AND s.name IN ('A', 'B');

-- 2. Performance Composite Indexes for Timetable Queries & Conflict Checks
CREATE INDEX IF NOT EXISTS idx_timetable_entries_section_active_period
  ON public.timetable_entries(section_id, active, period_number);

CREATE INDEX IF NOT EXISTS idx_timetable_entries_conflict_check
  ON public.timetable_entries(day_of_week, period_number, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_timetable_entries_faculty_active
  ON public.timetable_entries(faculty_id, day_of_week, period_number)
  WHERE active = true;

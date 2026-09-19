-- ======================================================================
-- Migration 032: Strict Student Marks Publication Security & RLS
-- Vivekananda College of Technology & Management, Aligarh (College Code: 340)
-- 
-- Fixes:
-- 1. Adds explicit status ('draft' | 'published') to sessional_marks table
-- 2. Sets sessional_assessments default status to 'draft'
-- 3. Resets unreleased assessments and marks to 'draft'
-- 4. Hardens RLS so students can ONLY read published assessments & marks
-- 5. Enables realtime publication on sessional_assessments and sessional_marks
-- ======================================================================

-- 1. Add status column to sessional_marks if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessional_marks' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.sessional_marks 
        ADD COLUMN status text NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'published'));
    END IF;
END $$;

-- 2. Set default status on sessional_assessments to 'draft'
ALTER TABLE public.sessional_assessments 
ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Reset existing unreleased assessments & marks to 'draft'
-- This prevents unpublished continuous assessments from leaking into student dashboard
UPDATE public.sessional_assessments 
SET status = 'draft', updated_at = NOW();

UPDATE public.sessional_marks 
SET status = 'draft', updated_at = NOW();

-- 4. Performance Indexes for publication status queries
CREATE INDEX IF NOT EXISTS idx_sessional_marks_student_status 
ON public.sessional_marks(student_id, status);

CREATE INDEX IF NOT EXISTS idx_sessional_marks_assessment_status 
ON public.sessional_marks(sessional_assessment_id, status);

CREATE INDEX IF NOT EXISTS idx_sessional_assessments_sec_status 
ON public.sessional_assessments(section_id, status);

-- 5. Hardened RLS Policies on sessional_assessments
DROP POLICY IF EXISTS "sessional_assessments_read" ON public.sessional_assessments;

CREATE POLICY "sessional_assessments_read" ON public.sessional_assessments 
FOR SELECT TO authenticated
USING (
    public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
    OR status IN ('published', 'completed')
    OR auth.role() = 'service_role'
);

-- 6. Hardened RLS Policies on sessional_marks
DROP POLICY IF EXISTS "sessional_marks_read" ON public.sessional_marks;

CREATE POLICY "sessional_marks_read" ON public.sessional_marks 
FOR SELECT TO authenticated
USING (
    public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
    OR (
        student_id = public.current_user_student_id()
        AND status = 'published'
        AND EXISTS (
            SELECT 1 FROM public.sessional_assessments sa
            WHERE sa.id = sessional_marks.sessional_assessment_id
            AND sa.status IN ('published', 'completed')
        )
    )
    OR auth.role() = 'service_role'
);

-- 7. Realtime Publication configuration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'sessional_marks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sessional_marks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'sessional_assessments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sessional_assessments;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Publication addition skipped or already present: %', SQLERRM;
END $$;

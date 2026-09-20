-- ============================================================================
-- VCTM ERP: MIGRATION 036 — ASSESSMENT & QUIZ UNIQUENESS AND INTEGRITY
-- Enforces canonical uniqueness for assessments and quizzes by subject & section
-- ============================================================================

-- 1. Create unique indexes to prevent future duplicate quizzes or sessionals
-- (Case-insensitive title uniqueness per subject and section)
DO $$
BEGIN
    -- Quizzes uniqueness index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'quizzes' 
        AND indexname = 'idx_quizzes_subject_section_title_unique'
    ) THEN
        -- Clean any duplicate rows before creating unique index
        DELETE FROM public.quizzes q1
        WHERE q1.id IN (
            SELECT q_inner.id
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY subject_id, section_id, lower(trim(title))
                           ORDER BY 
                               (CASE WHEN status = 'published' THEN 0 ELSE 1 END),
                               created_at ASC
                       ) as rn
                FROM public.quizzes
            ) q_inner
            WHERE q_inner.rn > 1
        );

        CREATE UNIQUE INDEX idx_quizzes_subject_section_title_unique 
            ON public.quizzes(subject_id, section_id, lower(trim(title)));
    END IF;

    -- Sessional Assessments uniqueness index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'sessional_assessments' 
        AND indexname = 'idx_sessional_assessments_subject_section_title_unique'
    ) THEN
        DELETE FROM public.sessional_assessments s1
        WHERE s1.id IN (
            SELECT s_inner.id
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY subject_id, section_id, lower(trim(title))
                           ORDER BY 
                               (CASE WHEN status = 'published' THEN 0 ELSE 1 END),
                               created_at ASC
                       ) as rn
                FROM public.sessional_assessments
            ) s_inner
            WHERE s_inner.rn > 1
        );

        CREATE UNIQUE INDEX idx_sessional_assessments_subject_section_title_unique 
            ON public.sessional_assessments(subject_id, section_id, lower(trim(title)));
    END IF;
END $$;

-- Migration 041: Production Notices, Marks Persistence & Strict Scoping
-- Eliminates audit_logs hack for notices, introduces dedicated notices table,
-- atomic publication and notification engine, marks persistence & soft-delete.

-- ============================================================================
-- 1. DEDICATED NOTICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Academic',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  author TEXT NOT NULL,
  created_by UUID,
  created_by_role TEXT,
  target_audience TEXT NOT NULL DEFAULT 'ALL',
  target_section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  target_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  target_role TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_notices_status_created ON public.notices(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_target_audience ON public.notices(target_audience);
CREATE INDEX IF NOT EXISTS idx_notices_target_section ON public.notices(target_section_id);
CREATE INDEX IF NOT EXISTS idx_notices_target_department ON public.notices(target_department_id);
CREATE INDEX IF NOT EXISTS idx_notices_deleted_at ON public.notices(deleted_at);

-- Replica Identity for complete payload in Realtime
ALTER TABLE public.notices REPLICA IDENTITY FULL;

-- Enable RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Notices
DROP POLICY IF EXISTS notices_read ON public.notices;
CREATE POLICY notices_read ON public.notices
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND status != 'DELETED'
  );

DROP POLICY IF EXISTS notices_manage ON public.notices;
CREATE POLICY notices_manage ON public.notices
  FOR ALL TO authenticated
  USING (
    ((current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role])) OR (auth.role() = 'service_role'::text))
  )
  WITH CHECK (
    ((current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role])) OR (auth.role() = 'service_role'::text))
  );

-- Ensure notices table is published in supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
  END IF;
END $$;

-- ============================================================================
-- 2. SOFT DELETE & DATA INTEGRITY COLUMNS ON QUIZZES, ASSIGNMENTS & ASSESSMENTS
-- ============================================================================
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.sessional_assessments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_quizzes_deleted_at ON public.quizzes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_assignments_deleted_at ON public.assignments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sessional_assessments_deleted_at ON public.sessional_assessments(deleted_at);

ALTER TABLE public.quizzes REPLICA IDENTITY FULL;
ALTER TABLE public.assignments REPLICA IDENTITY FULL;
ALTER TABLE public.sessional_assessments REPLICA IDENTITY FULL;
ALTER TABLE public.sessional_marks REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============================================================================
-- 3. ATOMIC STORED PROCEDURE: publish_notice
-- ============================================================================
CREATE OR REPLACE FUNCTION public.publish_notice(
  p_title TEXT,
  p_content TEXT,
  p_category TEXT DEFAULT 'Academic',
  p_priority TEXT DEFAULT 'NORMAL',
  p_author TEXT DEFAULT 'Academic Administration',
  p_created_by UUID DEFAULT NULL,
  p_created_by_role TEXT DEFAULT NULL,
  p_target_audience TEXT DEFAULT 'ALL',
  p_target_section_id UUID DEFAULT NULL,
  p_target_department_id UUID DEFAULT NULL,
  p_target_role TEXT DEFAULT NULL,
  p_is_pinned BOOLEAN DEFAULT false,
  p_attachment_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notice RECORD;
  v_notif_count INT := 0;
  v_normalized_audience TEXT := UPPER(TRIM(p_target_audience));
BEGIN
  -- Insert into public.notices
  INSERT INTO public.notices (
    title,
    content,
    category,
    priority,
    author,
    created_by,
    created_by_role,
    target_audience,
    target_section_id,
    target_department_id,
    target_role,
    is_pinned,
    attachment_url,
    status,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    TRIM(p_title),
    TRIM(p_content),
    COALESCE(p_category, 'Academic'),
    COALESCE(p_priority, 'NORMAL'),
    COALESCE(TRIM(p_author), 'Academic Administration'),
    p_created_by,
    p_created_by_role,
    COALESCE(p_target_audience, 'ALL'),
    p_target_section_id,
    p_target_department_id,
    p_target_role,
    COALESCE(p_is_pinned, false),
    p_attachment_url,
    'PUBLISHED',
    p_expires_at,
    now(),
    now()
  )
  RETURNING * INTO v_notice;

  -- Generate recipient notifications in bulk
  IF p_target_section_id IS NOT NULL OR v_normalized_audience LIKE 'SECTION%' THEN
    IF p_target_section_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_user_id,
        recipient_student_id,
        recipient_role,
        type,
        title,
        message,
        reference_type,
        reference_id,
        is_read,
        created_at,
        updated_at
      )
      SELECT 
        s.auth_user_id,
        s.id,
        'student',
        'NOTICE',
        v_notice.title,
        LEFT(v_notice.content, 180),
        'notice',
        v_notice.id,
        false,
        now(),
        now()
      FROM public.students s
      WHERE s.active = true AND s.section_id = p_target_section_id;
    END IF;

  ELSIF p_target_department_id IS NOT NULL OR v_normalized_audience LIKE 'DEPARTMENT%' THEN
    IF p_target_department_id IS NOT NULL THEN
      -- Department students
      IF p_target_role IS NULL OR LOWER(p_target_role) != 'faculty' THEN
        INSERT INTO public.notifications (
          recipient_user_id,
          recipient_student_id,
          recipient_role,
          type,
          title,
          message,
          reference_type,
          reference_id,
          is_read,
          created_at,
          updated_at
        )
        SELECT 
          s.auth_user_id,
          s.id,
          'student',
          'NOTICE',
          v_notice.title,
          LEFT(v_notice.content, 180),
          'notice',
          v_notice.id,
          false,
          now(),
          now()
        FROM public.students s
        WHERE s.active = true AND s.department_id = p_target_department_id;
      END IF;

      -- Department faculty
      IF p_target_role IS NULL OR LOWER(p_target_role) != 'student' THEN
        INSERT INTO public.notifications (
          recipient_user_id,
          recipient_faculty_id,
          recipient_role,
          type,
          title,
          message,
          reference_type,
          reference_id,
          is_read,
          created_at,
          updated_at
        )
        SELECT 
          f.auth_user_id,
          f.id,
          'faculty',
          'NOTICE',
          v_notice.title,
          LEFT(v_notice.content, 180),
          'notice',
          v_notice.id,
          false,
          now(),
          now()
        FROM public.faculty f
        WHERE f.active = true AND f.department_id = p_target_department_id;
      END IF;
    END IF;

  ELSIF v_normalized_audience = 'FACULTY' OR (p_target_role IS NOT NULL AND LOWER(p_target_role) = 'faculty') THEN
    INSERT INTO public.notifications (
      recipient_user_id,
      recipient_faculty_id,
      recipient_role,
      type,
      title,
      message,
      reference_type,
      reference_id,
      is_read,
      created_at,
      updated_at
    )
    SELECT 
      f.auth_user_id,
      f.id,
      'faculty',
      'NOTICE',
      v_notice.title,
      LEFT(v_notice.content, 180),
      'notice',
      v_notice.id,
      false,
      now(),
      now()
    FROM public.faculty f
    WHERE f.active = true;

  ELSIF v_normalized_audience = 'STUDENTS' OR (p_target_role IS NOT NULL AND LOWER(p_target_role) = 'student') THEN
    INSERT INTO public.notifications (
      recipient_user_id,
      recipient_student_id,
      recipient_role,
      type,
      title,
      message,
      reference_type,
      reference_id,
      is_read,
      created_at,
      updated_at
    )
    SELECT 
      s.auth_user_id,
      s.id,
      'student',
      'NOTICE',
      v_notice.title,
      LEFT(v_notice.content, 180),
      'notice',
      v_notice.id,
      false,
      now(),
      now()
    FROM public.students s
    WHERE s.active = true;

  ELSE
    -- All active students
    INSERT INTO public.notifications (
      recipient_user_id,
      recipient_student_id,
      recipient_role,
      type,
      title,
      message,
      reference_type,
      reference_id,
      is_read,
      created_at,
      updated_at
    )
    SELECT 
      s.auth_user_id,
      s.id,
      'student',
      'NOTICE',
      v_notice.title,
      LEFT(v_notice.content, 180),
      'notice',
      v_notice.id,
      false,
      now(),
      now()
    FROM public.students s
    WHERE s.active = true;

    -- All active faculty
    INSERT INTO public.notifications (
      recipient_user_id,
      recipient_faculty_id,
      recipient_role,
      type,
      title,
      message,
      reference_type,
      reference_id,
      is_read,
      created_at,
      updated_at
    )
    SELECT 
      f.auth_user_id,
      f.id,
      'faculty',
      'NOTICE',
      v_notice.title,
      LEFT(v_notice.content, 180),
      'notice',
      v_notice.id,
      false,
      now(),
      now()
    FROM public.faculty f
    WHERE f.active = true;
  END IF;

  RETURN to_jsonb(v_notice);
END;
$$;

-- ============================================================================
-- 4. ATOMIC STORED PROCEDURE: delete_notice
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_notice(p_notice_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notices
  SET status = 'DELETED', deleted_at = now(), updated_at = now()
  WHERE id = p_notice_id;

  -- Clean up unread notifications associated with this deleted notice
  DELETE FROM public.notifications 
  WHERE reference_type = 'notice' AND reference_id = p_notice_id AND is_read = false;

  RETURN true;
END;
$$;

-- ============================================================================
-- 5. ATOMIC STORED PROCEDURE: publish_assessment_marks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.publish_assessment_marks(
  p_assessment_id UUID,
  p_faculty_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assessment RECORD;
  v_subject_name TEXT := 'Course Subject';
BEGIN
  SELECT * INTO v_assessment FROM public.sessional_assessments WHERE id = p_assessment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment not found with id %', p_assessment_id;
  END IF;

  -- Update assessment to published
  UPDATE public.sessional_assessments
  SET status = 'published', updated_at = now()
  WHERE id = p_assessment_id;

  -- Update all child marks to published
  UPDATE public.sessional_marks
  SET status = 'published', updated_at = now()
  WHERE sessional_assessment_id = p_assessment_id;

  -- Get subject name for notification
  SELECT subject_name INTO v_subject_name FROM public.subjects WHERE id = v_assessment.subject_id;
  IF v_subject_name IS NULL THEN
    v_subject_name := 'Course Subject';
  END IF;

  -- Insert notifications for students
  INSERT INTO public.notifications (
    recipient_user_id,
    recipient_student_id,
    recipient_role,
    type,
    title,
    message,
    reference_type,
    reference_id,
    is_read,
    created_at,
    updated_at
  )
  SELECT 
    s.auth_user_id,
    sm.student_id,
    'student',
    'MARKS_PUBLISHED',
    'Marks Published: ' || v_assessment.title,
    v_subject_name || ' — ' || v_assessment.title || ': ' || sm.marks_obtained || '/' || v_assessment.max_marks,
    'sessional_mark',
    sm.id,
    false,
    now(),
    now()
  FROM public.sessional_marks sm
  JOIN public.students s ON s.id = sm.student_id
  WHERE sm.sessional_assessment_id = p_assessment_id;

  RETURN jsonb_build_object(
    'success', true,
    'assessment_id', p_assessment_id,
    'status', 'published'
  );
END;
$$;

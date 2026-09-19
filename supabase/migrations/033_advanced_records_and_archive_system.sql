-- ==============================================================================
-- Migration 033: Advanced Institutional Records & Archive System
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. EXPAND ACCOUNT STATUS CHECK CONSTRAINTS
-- Allows full institutional lifecycle statuses across profiles, faculty, and students
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Profiles table status constraint
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
          AND contype = 'c' 
          AND pg_get_constraintdef(oid) LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;

    -- Faculty table status constraint
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.faculty'::regclass 
          AND contype = 'c' 
          AND pg_get_constraintdef(oid) LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.faculty DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;

    -- Students table status constraint
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.students'::regclass 
          AND contype = 'c' 
          AND pg_get_constraintdef(oid) LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.students DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.profiles 
ADD CONSTRAINT chk_profiles_status 
CHECK (status IN (
  'ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED', 
  'WITHDRAWN', 'TRANSFERRED', 'DROPPED_OUT', 'GRADUATED', 
  'RESIGNED', 'RETIRED', 'TERMINATED', 'ON_LEAVE', 'ALUMNI'
));

ALTER TABLE public.faculty 
ADD CONSTRAINT chk_faculty_status 
CHECK (status IN (
  'ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED', 
  'WITHDRAWN', 'TRANSFERRED', 'DROPPED_OUT', 'GRADUATED', 
  'RESIGNED', 'RETIRED', 'TERMINATED', 'ON_LEAVE', 'ALUMNI'
));

ALTER TABLE public.students 
ADD CONSTRAINT chk_students_status 
CHECK (status IN (
  'ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED', 
  'WITHDRAWN', 'TRANSFERRED', 'DROPPED_OUT', 'GRADUATED', 
  'RESIGNED', 'RETIRED', 'TERMINATED', 'ON_LEAVE', 'ALUMNI'
));

-- 2. ADD LIFECYCLE COLUMNS TO PROFILES, FACULTY, AND STUDENTS
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS exit_date DATE,
ADD COLUMN IF NOT EXISTS exit_reason TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.faculty
ADD COLUMN IF NOT EXISTS exit_date DATE,
ADD COLUMN IF NOT EXISTS exit_reason TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS exit_date DATE,
ADD COLUMN IF NOT EXISTS exit_reason TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id);

-- Indexes for archived queries
CREATE INDEX IF NOT EXISTS idx_students_status_active ON public.students(status, active);
CREATE INDEX IF NOT EXISTS idx_faculty_status_active ON public.faculty(status, active);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_students_exit_date ON public.students(exit_date);
CREATE INDEX IF NOT EXISTS idx_faculty_exit_date ON public.faculty(exit_date);

-- 3. CREATE ACCOUNT LIFECYCLE TABLE
CREATE TABLE IF NOT EXISTS public.account_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'faculty', 'profile')),
  entity_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  effective_date DATE DEFAULT CURRENT_DATE,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_account_lifecycle_entity ON public.account_lifecycle(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_account_lifecycle_user ON public.account_lifecycle(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lifecycle_created ON public.account_lifecycle(created_at DESC);

-- Enable RLS on account_lifecycle
ALTER TABLE public.account_lifecycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_lifecycle_read_policy" ON public.account_lifecycle;
DROP POLICY IF EXISTS "super_admin_read_account_lifecycle" ON public.account_lifecycle;
CREATE POLICY "super_admin_read_account_lifecycle"
ON public.account_lifecycle FOR SELECT
TO authenticated
USING (
  (public.current_user_role() = 'super_admin'::user_role)
  OR (auth.role() = 'service_role')
);

DROP POLICY IF EXISTS "account_lifecycle_insert_policy" ON public.account_lifecycle;
DROP POLICY IF EXISTS "super_admin_insert_account_lifecycle" ON public.account_lifecycle;
CREATE POLICY "super_admin_insert_account_lifecycle"
ON public.account_lifecycle FOR INSERT
TO authenticated
WITH CHECK (
  (public.current_user_role() = 'super_admin'::user_role)
  OR (auth.role() = 'service_role')
);

-- 4. KERNEL LEVEL ROLE SECURITY: current_user_role()
-- Re-affirm that only accounts with status = 'ACTIVE' resolve a valid role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles 
  WHERE id = auth.uid() AND status = 'ACTIVE' 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. ATOMIC RPC TO ARCHIVE ACCOUNT
CREATE OR REPLACE FUNCTION public.archive_account(
  p_target_id UUID,
  p_entity_type TEXT, -- 'student' | 'faculty'
  p_exit_status TEXT, -- 'WITHDRAWN' | 'TRANSFERRED' | 'DROPPED_OUT' | 'GRADUATED' | 'RESIGNED' | 'ARCHIVED'
  p_exit_date DATE DEFAULT CURRENT_DATE,
  p_reason TEXT DEFAULT 'Institutional archive',
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_role user_role;
  v_actor_id UUID;
  v_actor_name TEXT;
  v_target_user_id UUID;
  v_old_status TEXT := 'ACTIVE';
  v_target_name TEXT := 'Unknown';
  v_target_email TEXT;
BEGIN
  -- Caller authorization check
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF auth.uid() IS NOT NULL AND v_caller_role != 'super_admin' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator can archive accounts';
  END IF;

  v_actor_id := COALESCE(p_actor_id, auth.uid());
  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_name IS NULL THEN
    v_actor_name := 'Super Admin';
  END IF;

  IF p_exit_status NOT IN ('WITHDRAWN', 'TRANSFERRED', 'DROPPED_OUT', 'GRADUATED', 'RESIGNED', 'RETIRED', 'TERMINATED', 'ON_LEAVE', 'ALUMNI', 'ARCHIVED', 'BLOCKED', 'SUSPENDED') THEN
    RAISE EXCEPTION 'Invalid exit status: %', p_exit_status;
  END IF;

  IF p_entity_type = 'student' THEN
    SELECT auth_user_id, status, full_name, email 
    INTO v_target_user_id, v_old_status, v_target_name, v_target_email
    FROM public.students 
    WHERE id = p_target_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student not found with ID: %', p_target_id;
    END IF;

    -- Update student table
    UPDATE public.students
    SET status = p_exit_status,
        active = false,
        exit_date = p_exit_date,
        exit_reason = p_reason,
        archived_at = now(),
        archived_by = v_actor_id,
        updated_at = now()
    WHERE id = p_target_id;

    -- Update profiles table if linked
    IF v_target_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET status = p_exit_status,
          exit_date = p_exit_date,
          exit_reason = p_reason,
          archived_at = now(),
          archived_by = v_actor_id,
          updated_at = now()
      WHERE id = v_target_user_id;
    END IF;

  ELSIF p_entity_type = 'faculty' THEN
    SELECT auth_user_id, status, full_name, email 
    INTO v_target_user_id, v_old_status, v_target_name, v_target_email
    FROM public.faculty 
    WHERE id = p_target_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Faculty not found with ID: %', p_target_id;
    END IF;

    -- Update faculty table
    UPDATE public.faculty
    SET status = p_exit_status,
        active = false,
        exit_date = p_exit_date,
        exit_reason = p_reason,
        archived_at = now(),
        archived_by = v_actor_id,
        updated_at = now()
    WHERE id = p_target_id;

    -- Deactivate current assignments
    UPDATE public.faculty_subject_assignments
    SET active = false, updated_at = now()
    WHERE faculty_id = p_target_id;

    -- Update profiles table if linked
    IF v_target_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET status = p_exit_status,
          exit_date = p_exit_date,
          exit_reason = p_reason,
          archived_at = now(),
          archived_by = v_actor_id,
          updated_at = now()
      WHERE id = v_target_user_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid entity type: %. Must be student or faculty', p_entity_type;
  END IF;

  -- Revoke Auth sessions and ban login
  IF v_target_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET banned_until = '2099-12-31 23:59:59+00'::timestamptz 
    WHERE id = v_target_user_id;

    DELETE FROM auth.sessions WHERE user_id = v_target_user_id;
  END IF;

  -- Insert account lifecycle record
  INSERT INTO public.account_lifecycle (
    user_id,
    entity_type,
    entity_id,
    old_status,
    new_status,
    reason,
    effective_date,
    performed_by,
    metadata
  ) VALUES (
    v_target_user_id,
    p_entity_type,
    p_target_id,
    v_old_status,
    p_exit_status,
    p_reason,
    p_exit_date,
    v_actor_id,
    jsonb_build_object(
      'target_name', v_target_name,
      'target_email', v_target_email,
      'exit_status', p_exit_status,
      'actor_name', v_actor_name
    )
  );

  -- Insert into public.audit_logs
  INSERT INTO public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_name,
    'super_admin',
    'ACCOUNT_ARCHIVED',
    p_entity_type,
    p_target_id,
    jsonb_build_object('status', v_old_status, 'active', true),
    jsonb_build_object(
      'status', p_exit_status, 
      'active', false, 
      'exit_date', p_exit_date, 
      'reason', p_reason,
      'name', v_target_name
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'entity_id', p_target_id,
    'entity_type', p_entity_type,
    'old_status', v_old_status,
    'new_status', p_exit_status,
    'target_name', v_target_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.archive_account(UUID, TEXT, TEXT, DATE, TEXT, UUID) TO authenticated, anon;

-- 6. ATOMIC RPC TO RESTORE ACCOUNT
CREATE OR REPLACE FUNCTION public.restore_account(
  p_target_id UUID,
  p_entity_type TEXT, -- 'student' | 'faculty'
  p_actor_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Account restored to active directory by Super Admin'
)
RETURNS JSONB AS $$
DECLARE
  v_caller_role user_role;
  v_actor_id UUID;
  v_actor_name TEXT;
  v_target_user_id UUID;
  v_old_status TEXT;
  v_target_name TEXT := 'Unknown';
  v_target_email TEXT;
BEGIN
  -- Caller authorization check
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF auth.uid() IS NOT NULL AND v_caller_role != 'super_admin' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator can restore accounts';
  END IF;

  v_actor_id := COALESCE(p_actor_id, auth.uid());
  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_name IS NULL THEN
    v_actor_name := 'Super Admin';
  END IF;

  IF p_entity_type = 'student' THEN
    SELECT auth_user_id, status, full_name, email 
    INTO v_target_user_id, v_old_status, v_target_name, v_target_email
    FROM public.students 
    WHERE id = p_target_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student not found with ID: %', p_target_id;
    END IF;

    -- Restore student
    UPDATE public.students
    SET status = 'ACTIVE',
        active = true,
        exit_date = NULL,
        exit_reason = NULL,
        archived_at = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE id = p_target_id;

    -- Restore profile
    IF v_target_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET status = 'ACTIVE',
          exit_date = NULL,
          exit_reason = NULL,
          archived_at = NULL,
          archived_by = NULL,
          updated_at = now()
      WHERE id = v_target_user_id;
    END IF;

  ELSIF p_entity_type = 'faculty' THEN
    SELECT auth_user_id, status, full_name, email 
    INTO v_target_user_id, v_old_status, v_target_name, v_target_email
    FROM public.faculty 
    WHERE id = p_target_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Faculty not found with ID: %', p_target_id;
    END IF;

    -- Restore faculty
    UPDATE public.faculty
    SET status = 'ACTIVE',
        active = true,
        exit_date = NULL,
        exit_reason = NULL,
        archived_at = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE id = p_target_id;

    -- Restore profile
    IF v_target_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET status = 'ACTIVE',
          exit_date = NULL,
          exit_reason = NULL,
          archived_at = NULL,
          archived_by = NULL,
          updated_at = now()
      WHERE id = v_target_user_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid entity type: %. Must be student or faculty', p_entity_type;
  END IF;

  -- Unban Auth user
  IF v_target_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET banned_until = NULL 
    WHERE id = v_target_user_id;
  END IF;

  -- Insert account lifecycle record
  INSERT INTO public.account_lifecycle (
    user_id,
    entity_type,
    entity_id,
    old_status,
    new_status,
    reason,
    effective_date,
    performed_by,
    metadata
  ) VALUES (
    v_target_user_id,
    p_entity_type,
    p_target_id,
    v_old_status,
    'ACTIVE',
    p_reason,
    CURRENT_DATE,
    v_actor_id,
    jsonb_build_object(
      'target_name', v_target_name,
      'target_email', v_target_email,
      'actor_name', v_actor_name,
      'restored_at', now()
    )
  );

  -- Insert into public.audit_logs
  INSERT INTO public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_name,
    'super_admin',
    'ACCOUNT_RESTORED',
    p_entity_type,
    p_target_id,
    jsonb_build_object('status', v_old_status, 'active', false),
    jsonb_build_object('status', 'ACTIVE', 'active', true, 'reason', p_reason, 'name', v_target_name),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'entity_id', p_target_id,
    'entity_type', p_entity_type,
    'old_status', v_old_status,
    'new_status', 'ACTIVE',
    'target_name', v_target_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.restore_account(UUID, TEXT, UUID, TEXT) TO authenticated, anon;

-- 7. REAL-TIME AGGREGATE STATS RPC
CREATE OR REPLACE FUNCTION public.get_archived_stats()
RETURNS JSONB AS $$
DECLARE
  v_former_students INT := 0;
  v_former_faculty INT := 0;
  v_graduated_students INT := 0;
  v_withdrawn_students INT := 0;
  v_transferred_students INT := 0;
  v_dropped_out_students INT := 0;
  v_resigned_faculty INT := 0;
BEGIN
  -- Former Students count (any non-ACTIVE status or active = false)
  SELECT COUNT(*) INTO v_former_students 
  FROM public.students 
  WHERE status != 'ACTIVE' OR active = false;

  -- Former Faculty count
  SELECT COUNT(*) INTO v_former_faculty 
  FROM public.faculty 
  WHERE status != 'ACTIVE' OR active = false;

  -- Detailed status breakdowns
  SELECT COUNT(*) INTO v_graduated_students 
  FROM public.students 
  WHERE status IN ('GRADUATED', 'ALUMNI');

  SELECT COUNT(*) INTO v_withdrawn_students 
  FROM public.students 
  WHERE status = 'WITHDRAWN';

  SELECT COUNT(*) INTO v_transferred_students 
  FROM public.students 
  WHERE status = 'TRANSFERRED';

  SELECT COUNT(*) INTO v_dropped_out_students 
  FROM public.students 
  WHERE status = 'DROPPED_OUT';

  SELECT COUNT(*) INTO v_resigned_faculty 
  FROM public.faculty 
  WHERE status = 'RESIGNED';

  RETURN jsonb_build_object(
    'former_students', v_former_students,
    'former_faculty', v_former_faculty,
    'graduated_students', v_graduated_students,
    'graduated_alumni', v_graduated_students,
    'withdrawn_students', v_withdrawn_students,
    'transferred_students', v_transferred_students,
    'dropped_out_students', v_dropped_out_students,
    'resigned_faculty', v_resigned_faculty,
    'total_archived', (v_former_students + v_former_faculty)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_archived_stats() TO authenticated, anon;

-- 8. ENROLL IN REALTIME PUBLICATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'account_lifecycle'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.account_lifecycle;
  END IF;
END $$;

-- 9. DESTRUCTIVE HARD DELETE PREVENTION TRIGGERS
CREATE OR REPLACE FUNCTION public.prevent_destructive_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'students' THEN
    IF EXISTS (SELECT 1 FROM public.attendance_records WHERE student_id = OLD.id) OR
       EXISTS (SELECT 1 FROM public.sessional_marks WHERE student_id = OLD.id) THEN
      RAISE EXCEPTION 'Destructive hard deletion blocked: Student % has historical attendance or assessment records. Please use archive_account instead.', OLD.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'faculty' THEN
    IF EXISTS (SELECT 1 FROM public.attendance_sessions WHERE faculty_id = OLD.id) OR
       EXISTS (SELECT 1 FROM public.sessional_assessments WHERE faculty_id = OLD.id) THEN
      RAISE EXCEPTION 'Destructive hard deletion blocked: Faculty % has historical attendance or assessment records. Please use archive_account instead.', OLD.id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_students ON public.students;
CREATE TRIGGER trg_prevent_hard_delete_students
BEFORE DELETE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.prevent_destructive_hard_delete();

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_faculty ON public.faculty;
CREATE TRIGGER trg_prevent_hard_delete_faculty
BEFORE DELETE ON public.faculty
FOR EACH ROW
EXECUTE FUNCTION public.prevent_destructive_hard_delete();


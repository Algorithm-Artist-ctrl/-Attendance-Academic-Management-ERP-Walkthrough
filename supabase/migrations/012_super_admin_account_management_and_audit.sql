-- ==============================================================================
-- Migration 012: Super Admin User/Account Management, Account Status & Security Audit
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Add status and last_sign_in_at to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS last_sign_in_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_status'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT chk_profiles_status CHECK (status IN ('ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED'));
  END IF;
END $$;

-- 2. Add status to public.faculty
ALTER TABLE public.faculty 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_faculty_status'
  ) THEN
    ALTER TABLE public.faculty 
    ADD CONSTRAINT chk_faculty_status CHECK (status IN ('ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED'));
  END IF;
END $$;

-- 3. Add status to public.students
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_students_status'
  ) THEN
    ALTER TABLE public.students 
    ADD CONSTRAINT chk_students_status CHECK (status IN ('ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED'));
  END IF;
END $$;

-- 4. Initial sync of last_sign_in_at from auth.users to profiles
UPDATE public.profiles p
SET last_sign_in_at = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id AND u.last_sign_in_at IS NOT NULL;

-- 5. Update current_user_role() to enforce account status at database kernel level
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles 
  WHERE id = auth.uid() AND status = 'ACTIVE' 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. Privileged RPC to update account status and write audit log
CREATE OR REPLACE FUNCTION public.update_account_status(
  p_target_user_id uuid,
  p_target_status text,
  p_actor_id uuid DEFAULT NULL,
  p_actor_name text DEFAULT NULL,
  p_actor_role text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_caller_role user_role;
  v_old_status text;
  v_target_email text;
  v_faculty_id uuid;
  v_student_id uuid;
  v_action text;
BEGIN
  -- Security check: Caller must be super_admin (or service_role or actor_role = super_admin)
  SELECT profiles.role INTO v_caller_role FROM public.profiles WHERE profiles.id = auth.uid();
  IF auth.uid() IS NOT NULL AND v_caller_role != 'super_admin' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator can modify account status';
  END IF;

  IF p_target_status NOT IN ('ACTIVE', 'BLOCKED', 'ARCHIVED', 'PENDING', 'SUSPENDED') THEN
    RAISE EXCEPTION 'Invalid account status: %', p_target_status;
  END IF;

  -- Get current profile info
  SELECT profiles.status, profiles.email, profiles.faculty_id, profiles.student_id 
  INTO v_old_status, v_target_email, v_faculty_id, v_student_id
  FROM public.profiles 
  WHERE profiles.id = p_target_user_id;

  IF NOT FOUND THEN
    -- Also check if p_target_user_id was a faculty_id or student_id directly
    SELECT profiles.id, profiles.status, profiles.email, profiles.faculty_id, profiles.student_id 
    INTO p_target_user_id, v_old_status, v_target_email, v_faculty_id, v_student_id
    FROM public.profiles 
    WHERE profiles.faculty_id = p_target_user_id OR profiles.student_id = p_target_user_id;
  END IF;

  -- Update profiles
  IF p_target_user_id IS NOT NULL THEN
    UPDATE public.profiles 
    SET status = p_target_status, updated_at = now() 
    WHERE id = p_target_user_id;
  END IF;

  -- Update linked faculty
  IF v_faculty_id IS NOT NULL THEN
    UPDATE public.faculty 
    SET status = p_target_status, 
        active = (p_target_status = 'ACTIVE'), 
        updated_at = now() 
    WHERE id = v_faculty_id;
  ELSIF p_target_user_id IS NOT NULL THEN
    UPDATE public.faculty 
    SET status = p_target_status, 
        active = (p_target_status = 'ACTIVE'), 
        updated_at = now() 
    WHERE auth_user_id = p_target_user_id;
  END IF;

  -- Update linked student
  IF v_student_id IS NOT NULL THEN
    UPDATE public.students 
    SET status = p_target_status, 
        active = (p_target_status = 'ACTIVE'), 
        updated_at = now() 
    WHERE id = v_student_id;
  ELSIF p_target_user_id IS NOT NULL THEN
    UPDATE public.students 
    SET status = p_target_status, 
        active = (p_target_status = 'ACTIVE'), 
        updated_at = now() 
    WHERE auth_user_id = p_target_user_id;
  END IF;

  -- Determine action label
  IF p_target_status = 'BLOCKED' THEN
    v_action := 'ACCOUNT_BLOCKED';
  ELSIF p_target_status = 'ARCHIVED' THEN
    v_action := 'ACCOUNT_ARCHIVED';
  ELSIF p_target_status = 'ACTIVE' AND v_old_status = 'BLOCKED' THEN
    v_action := 'ACCOUNT_UNBLOCKED';
  ELSE
    v_action := 'ACCOUNT_STATUS_CHANGED';
  END IF;

  -- Write audit log
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
    COALESCE(p_actor_id, auth.uid()),
    COALESCE(p_actor_name, (SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Super Admin'),
    COALESCE(p_actor_role, 'super_admin'),
    v_action,
    CASE WHEN v_faculty_id IS NOT NULL THEN 'faculty' WHEN v_student_id IS NOT NULL THEN 'students' ELSE 'profiles' END,
    COALESCE(v_faculty_id, v_student_id, p_target_user_id),
    jsonb_build_object('status', COALESCE(v_old_status, 'ACTIVE')),
    jsonb_build_object('status', p_target_status, 'email', v_target_email, 'reason', p_reason),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'old_status', v_old_status,
    'new_status', p_target_status,
    'action', v_action
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_account_status(uuid, text, uuid, text, text, text) TO authenticated, anon;

-- 7. Security Definer RPC for Super Admin to fetch unified account directory
CREATE OR REPLACE FUNCTION public.get_admin_account_directory()
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  email text,
  role text,
  full_name text,
  status text,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  phone text,
  department_id uuid,
  faculty_id uuid,
  student_id uuid,
  employee_code text,
  faculty_code text,
  designation text,
  roll_number text,
  section_id uuid,
  academic_year_id uuid,
  semester_id uuid
) AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  -- Security check: Caller must be super_admin or service_role or authenticated admin
  SELECT profiles.role INTO v_caller_role FROM public.profiles WHERE profiles.id = auth.uid();
  IF v_caller_role != 'super_admin' AND auth.role() != 'service_role' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator can view the unified account directory';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.id AS auth_user_id,
    p.email::text,
    p.role::text,
    p.full_name::text,
    p.status::text,
    COALESCE(p.last_sign_in_at, u.last_sign_in_at) AS last_sign_in_at,
    COALESCE(p.created_at, u.created_at) AS created_at,
    p.updated_at,
    p.phone::text,
    p.department_id,
    p.faculty_id,
    p.student_id,
    f.employee_code::text,
    f.faculty_code::text,
    f.designation::text,
    s.roll_number::text,
    s.section_id,
    s.academic_year_id,
    s.semester_id
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.faculty f ON f.id = p.faculty_id OR f.auth_user_id = p.id
  LEFT JOIN public.students s ON s.id = p.student_id OR s.auth_user_id = p.id
  ORDER BY p.full_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_admin_account_directory() TO authenticated, anon;

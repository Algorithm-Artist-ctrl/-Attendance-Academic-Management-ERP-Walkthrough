-- ==============================================================================
-- Migration 050: Reconcile Faculty Auth Identities & Robust Credential Updates
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Prune legacy unlinked orphan profiles squatting faculty email addresses
-- (specifically accounts that have no faculty records, no student records, and are not super admins)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT p.id, p.email 
    FROM public.profiles p
    LEFT JOIN public.faculty f ON f.auth_user_id = p.id OR f.id = p.faculty_id
    LEFT JOIN public.students s ON s.auth_user_id = p.id OR s.id = p.student_id
    WHERE p.role = 'faculty'
      AND p.faculty_id IS NULL
      AND f.id IS NULL
      AND s.id IS NULL
      AND (p.email IN ('abhishek.cse@vctm.in', 'jitendra.cse@vctm.in') OR p.email LIKE 'fac_test_%')
  ) LOOP
    RAISE NOTICE 'Pruning orphan profile and auth user: % (%)', r.id, r.email;
    DELETE FROM auth.identities WHERE user_id = r.id;
    DELETE FROM public.profiles WHERE id = r.id;
    DELETE FROM auth.users WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Synchronize Dr. Abhishek Garg to canonical email abhishek.cse@vctm.in
DO $$
DECLARE
  v_abhishek_fac_id UUID := 'd515287a-d613-49d6-a163-691dc6cfa74a';
  v_abhishek_auth_id UUID := '001c21ea-d116-4ba0-9d30-058b3c53315c';
  v_target_email TEXT := 'abhishek.cse@vctm.in';
BEGIN
  -- Verify if faculty exists
  IF EXISTS (SELECT 1 FROM public.faculty WHERE id = v_abhishek_fac_id) THEN
    -- Ensure any existing conflict on auth.users with different id is cleared
    DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = v_target_email AND id != v_abhishek_auth_id);
    DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE LOWER(email) = v_target_email AND id != v_abhishek_auth_id);
    DELETE FROM auth.users WHERE LOWER(email) = v_target_email AND id != v_abhishek_auth_id;

    -- Update auth.users
    UPDATE auth.users
    SET email = v_target_email,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_abhishek_auth_id;

    -- Update auth.identities
    UPDATE auth.identities
    SET identity_data = jsonb_set(
          jsonb_set(identity_data, '{email}', to_jsonb(v_target_email)),
          '{email_verified}', 'true'::jsonb
        ),
        updated_at = NOW()
    WHERE user_id = v_abhishek_auth_id;

    -- Update public.profiles
    UPDATE public.profiles
    SET email = v_target_email,
        faculty_id = v_abhishek_fac_id,
        updated_at = NOW()
    WHERE id = v_abhishek_auth_id;

    -- Update public.faculty
    UPDATE public.faculty
    SET email = v_target_email,
        auth_user_id = v_abhishek_auth_id,
        updated_at = NOW()
    WHERE id = v_abhishek_fac_id;

    RAISE NOTICE 'Dr. Abhishek Garg successfully synchronized to %', v_target_email;
  END IF;
END $$;

-- 3. Synchronize Mr. Jitendra Singh to canonical email jitendra.cse@vctm.in if appropriate
DO $$
DECLARE
  v_jitendra_fac_id UUID := '01b716c8-f329-4f9f-a7e6-ce2f575a1167';
  v_jitendra_auth_id UUID := '0d1f1678-1cc2-4eff-905e-e01fb25c541b';
BEGIN
  -- Reconcile profile link
  IF EXISTS (SELECT 1 FROM public.faculty WHERE id = v_jitendra_fac_id) THEN
    UPDATE public.profiles
    SET faculty_id = v_jitendra_fac_id
    WHERE id = v_jitendra_auth_id;

    UPDATE public.faculty
    SET auth_user_id = v_jitendra_auth_id
    WHERE id = v_jitendra_fac_id;
  END IF;
END $$;

-- 4. Ensure all faculty rows and profiles are cross-linked
UPDATE public.profiles p
SET faculty_id = f.id
FROM public.faculty f
WHERE (f.auth_user_id = p.id OR (p.role = 'faculty' AND LOWER(f.email) = LOWER(p.email)))
  AND p.faculty_id IS DISTINCT FROM f.id;

UPDATE public.faculty f
SET auth_user_id = p.id
FROM public.profiles p
WHERE (p.id = f.auth_user_id OR (p.role = 'faculty' AND LOWER(p.email) = LOWER(f.email)))
  AND f.auth_user_id IS DISTINCT FROM p.id;

-- 5. Enhanced admin_update_account_credentials function
CREATE OR REPLACE FUNCTION public.admin_update_account_credentials(
  p_target_user_id UUID,
  p_new_email TEXT DEFAULT NULL,
  p_new_password TEXT DEFAULT NULL,
  p_is_default_password BOOLEAN DEFAULT FALSE,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL,
  p_actor_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role user_role;
  v_target_auth_user_id UUID;
  v_old_email TEXT;
  v_clean_email TEXT;
  v_clean_pass TEXT;
  v_role user_role;
  v_full_name TEXT;
  v_faculty_id UUID;
  v_student_id UUID;
  v_orphan_user_id UUID;
  v_email_updated BOOLEAN := FALSE;
  v_password_updated BOOLEAN := FALSE;
BEGIN
  -- 1. Security check: Caller must be super_admin or service_role
  SELECT profiles.role INTO v_caller_role FROM public.profiles WHERE profiles.id = auth.uid();
  IF auth.uid() IS NOT NULL AND v_caller_role != 'super_admin' AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator can modify account credentials';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user ID is required';
  END IF;

  -- 2. Resolve Target User Profile & Metadata
  SELECT 
    p.id, 
    p.email, 
    p.role, 
    p.full_name, 
    p.faculty_id, 
    p.student_id
  INTO 
    v_target_auth_user_id, 
    v_old_email, 
    v_role, 
    v_full_name, 
    v_faculty_id, 
    v_student_id
  FROM public.profiles p 
  WHERE p.id = p_target_user_id;

  -- If not matched by profiles.id, inspect faculty
  IF v_target_auth_user_id IS NULL THEN
    SELECT f.id, f.auth_user_id, f.email, f.full_name
    INTO v_faculty_id, v_target_auth_user_id, v_old_email, v_full_name
    FROM public.faculty f
    WHERE f.id = p_target_user_id OR f.auth_user_id = p_target_user_id
    LIMIT 1;

    IF v_faculty_id IS NOT NULL THEN
      v_role := 'faculty';
    END IF;
  END IF;

  -- If not matched, inspect students
  IF v_target_auth_user_id IS NULL THEN
    SELECT s.id, s.auth_user_id, s.email, s.full_name
    INTO v_student_id, v_target_auth_user_id, v_old_email, v_full_name
    FROM public.students s
    WHERE s.id = p_target_user_id OR s.auth_user_id = p_target_user_id
    LIMIT 1;

    IF v_student_id IS NOT NULL THEN
      v_role := 'student';
    END IF;
  END IF;

  -- If still null, check directly in auth.users
  IF v_target_auth_user_id IS NULL THEN
    SELECT u.id, u.email
    INTO v_target_auth_user_id, v_old_email
    FROM auth.users u
    WHERE u.id = p_target_user_id
    LIMIT 1;
  END IF;

  -- Cross-check linked faculty or student if not already found
  IF v_target_auth_user_id IS NOT NULL THEN
    IF v_faculty_id IS NULL THEN
      SELECT f.id, f.email INTO v_faculty_id, v_old_email
      FROM public.faculty f
      WHERE f.auth_user_id = v_target_auth_user_id OR (v_old_email IS NOT NULL AND LOWER(f.email) = LOWER(v_old_email))
      LIMIT 1;
    END IF;

    IF v_student_id IS NULL THEN
      SELECT s.id, s.email INTO v_student_id, v_old_email
      FROM public.students s
      WHERE s.auth_user_id = v_target_auth_user_id OR (v_old_email IS NOT NULL AND LOWER(s.email) = LOWER(v_old_email))
      LIMIT 1;
    END IF;
  ELSE
    v_target_auth_user_id := p_target_user_id;
  END IF;

  -- Ensure target exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_target_auth_user_id) THEN
    -- If no password was provided, we cannot create an account without explicit password provisioning
    IF p_new_password IS NULL OR TRIM(p_new_password) = '' THEN
      RAISE EXCEPTION 'Target user ID % does not exist in auth.users. Cannot update credentials without explicit password provisioning.', v_target_auth_user_id;
    END IF;

    -- If explicit password was provided, create user with THAT exact password
    v_clean_pass := TRIM(p_new_password);
    IF length(v_clean_pass) < 6 THEN
      RAISE EXCEPTION 'Password must be at least 6 characters in length.';
    END IF;

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      is_sso_user,
      is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_target_auth_user_id,
      'authenticated',
      'authenticated',
      COALESCE(LOWER(TRIM(p_new_email)), LOWER(TRIM(v_old_email))),
      crypt(v_clean_pass, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', COALESCE(v_full_name, 'User')),
      NOW(),
      NOW(),
      '', '', '', '', false, false
    );

    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_target_auth_user_id::text,
      v_target_auth_user_id,
      jsonb_build_object('sub', v_target_auth_user_id::text, 'email', COALESCE(LOWER(TRIM(p_new_email)), LOWER(TRIM(v_old_email))), 'email_verified', true),
      'email',
      NULL,
      NOW(),
      NOW()
    ) ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();

    v_password_updated := TRUE;
  END IF;

  -- 3. Handle Email Update
  IF p_new_email IS NOT NULL AND TRIM(p_new_email) != '' THEN
    v_clean_email := LOWER(TRIM(p_new_email));

    IF v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email format: "%"', v_clean_email;
    END IF;

    IF v_clean_email != LOWER(TRIM(COALESCE(v_old_email, ''))) THEN
      -- Automated orphan account resolution:
      -- If the email is held by an unlinked ghost user (no active faculty, no active student, no super_admin)
      SELECT u.id INTO v_orphan_user_id
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      LEFT JOIN public.faculty f ON f.auth_user_id = u.id OR f.id = p.faculty_id
      LEFT JOIN public.students s ON s.auth_user_id = u.id OR s.id = p.student_id
      WHERE LOWER(u.email) = v_clean_email 
        AND u.id != v_target_auth_user_id
        AND (p.role IS NULL OR p.role NOT IN ('super_admin'))
        AND f.id IS NULL 
        AND s.id IS NULL
      LIMIT 1;

      IF v_orphan_user_id IS NOT NULL THEN
        RAISE NOTICE 'Pruning conflicting unlinked orphan user % for email %', v_orphan_user_id, v_clean_email;
        DELETE FROM auth.identities WHERE user_id = v_orphan_user_id;
        DELETE FROM public.profiles WHERE id = v_orphan_user_id;
        DELETE FROM auth.users WHERE id = v_orphan_user_id;
      END IF;

      -- Uniqueness checks across active system entities
      IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email AND id != v_target_auth_user_id) THEN
        RAISE EXCEPTION 'Email "%" is already registered to another active user.', v_clean_email;
      END IF;

      IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = v_clean_email AND id != v_target_auth_user_id) THEN
        RAISE EXCEPTION 'Email "%" is already in use by another profile.', v_clean_email;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.students 
        WHERE LOWER(email) = v_clean_email 
          AND auth_user_id != v_target_auth_user_id 
          AND (v_student_id IS NULL OR id != v_student_id)
      ) THEN
        RAISE EXCEPTION 'Email "%" is already in use by another student.', v_clean_email;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.faculty 
        WHERE LOWER(email) = v_clean_email 
          AND auth_user_id != v_target_auth_user_id 
          AND (v_faculty_id IS NULL OR id != v_faculty_id)
      ) THEN
        RAISE EXCEPTION 'Email "%" is already in use by another faculty member.', v_clean_email;
      END IF;

      -- Update auth.users
      UPDATE auth.users
      SET email = v_clean_email,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
          updated_at = NOW()
      WHERE id = v_target_auth_user_id;

      -- Update auth.identities
      UPDATE auth.identities
      SET identity_data = jsonb_set(
            jsonb_set(identity_data, '{email}', to_jsonb(v_clean_email)),
            '{email_verified}', 'true'::jsonb
          ),
          updated_at = NOW()
      WHERE user_id = v_target_auth_user_id;

      -- Update public.profiles
      UPDATE public.profiles
      SET email = v_clean_email,
          faculty_id = COALESCE(faculty_id, v_faculty_id),
          student_id = COALESCE(student_id, v_student_id),
          updated_at = NOW()
      WHERE id = v_target_auth_user_id;

      -- Update public.students if applicable
      IF v_student_id IS NOT NULL THEN
        UPDATE public.students
        SET email = v_clean_email,
            auth_user_id = v_target_auth_user_id,
            updated_at = NOW()
        WHERE id = v_student_id OR auth_user_id = v_target_auth_user_id;
      END IF;

      -- Update public.faculty if applicable
      IF v_faculty_id IS NOT NULL THEN
        UPDATE public.faculty
        SET email = v_clean_email,
            auth_user_id = v_target_auth_user_id,
            updated_at = NOW()
        WHERE id = v_faculty_id OR auth_user_id = v_target_auth_user_id;
      END IF;

      -- Audit Log for email change
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
        p_actor_id,
        COALESCE(p_actor_name, 'Super Admin'),
        COALESCE(p_actor_role, 'super_admin'),
        'UPDATE_OFFICIAL_EMAIL',
        'auth_user',
        v_target_auth_user_id,
        jsonb_build_object('email', v_old_email),
        jsonb_build_object('email', v_clean_email, 'faculty_id', v_faculty_id, 'student_id', v_student_id),
        NOW()
      );

      v_email_updated := TRUE;
    END IF;
  END IF;

  -- 4. Handle Password Update
  IF p_new_password IS NOT NULL AND TRIM(p_new_password) != '' THEN
    v_clean_pass := TRIM(p_new_password);
    IF length(v_clean_pass) < 6 THEN
      RAISE EXCEPTION 'Password must be at least 6 characters in length.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(v_clean_pass, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = v_target_auth_user_id;

    UPDATE public.profiles
    SET force_password_change = p_is_default_password,
        updated_at = NOW()
    WHERE id = v_target_auth_user_id;

    -- Audit Log for password update (NEVER record the raw password)
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
      p_actor_id,
      COALESCE(p_actor_name, 'Super Admin'),
      COALESCE(p_actor_role, 'super_admin'),
      CASE WHEN p_is_default_password THEN 'RESET_TO_DEFAULT_PASSWORD' ELSE 'SET_CUSTOM_PASSWORD' END,
      'auth_user',
      v_target_auth_user_id,
      jsonb_build_object('password_modified', true),
      jsonb_build_object('is_default_password', p_is_default_password),
      NOW()
    );

    v_password_updated := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_target_auth_user_id,
    'faculty_id', v_faculty_id,
    'student_id', v_student_id,
    'email', COALESCE(v_clean_email, v_old_email),
    'email_updated', v_email_updated,
    'password_updated', v_password_updated,
    'is_default_password', p_is_default_password
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_account_credentials(UUID, TEXT, TEXT, BOOLEAN, UUID, TEXT, TEXT) TO authenticated, anon;

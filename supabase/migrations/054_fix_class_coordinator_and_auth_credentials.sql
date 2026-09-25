-- ==============================================================================
-- Migration 054: Fix Class Coordinator Persistence & Real Auth Credential Updates
-- ==============================================================================

-- 1. Atomic RPC: remove_class_coordinator_atomic
-- Thoroughly deactivates class_coordinator_assignments AND clears sections.class_coordinator_id
CREATE OR REPLACE FUNCTION public.remove_class_coordinator_atomic(
    p_faculty_id UUID,
    p_section_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated_cca_count INT := 0;
    v_updated_sec_count INT := 0;
BEGIN
    IF p_section_id IS NULL THEN
        RAISE EXCEPTION 'Section ID is required to remove class coordinator';
    END IF;

    -- Deactivate assignment in class_coordinator_assignments
    UPDATE public.class_coordinator_assignments
    SET active = false,
        updated_at = NOW()
    WHERE section_id = p_section_id
      AND (faculty_id = p_faculty_id OR p_faculty_id IS NULL)
      AND active = true;

    GET DIAGNOSTICS v_updated_cca_count = ROW_COUNT;

    -- Clear pointer on sections table
    UPDATE public.sections
    SET class_coordinator_id = NULL,
        updated_at = NOW()
    WHERE id = p_section_id
      AND (class_coordinator_id = p_faculty_id OR p_faculty_id IS NULL);

    GET DIAGNOSTICS v_updated_sec_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'faculty_id', p_faculty_id,
        'section_id', p_section_id,
        'deactivated_assignments', v_updated_cca_count,
        'cleared_sections', v_updated_sec_count
    );
END;
$$;

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.remove_class_coordinator_atomic(UUID, UUID) TO authenticated, service_role;

-- 2. Enhanced admin_update_account_credentials
-- Atomically synchronizes Supabase Auth, profiles, faculty, and students
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
SET search_path = public, pg_temp
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
  v_default_password TEXT;
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
  -- Check 2A: Directly from public.profiles
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

  -- Check 2B: Inspect public.faculty if not resolved by profiles.id
  IF v_target_auth_user_id IS NULL THEN
    SELECT f.id, f.auth_user_id, f.email, f.full_name
    INTO v_faculty_id, v_target_auth_user_id, v_old_email, v_full_name
    FROM public.faculty f
    WHERE f.id = p_target_user_id OR f.auth_user_id = p_target_user_id
    LIMIT 1;

    IF v_faculty_id IS NOT NULL THEN
      v_role := 'faculty';
      -- If f.auth_user_id is NULL, check if a profile or auth user exists with matching email
      IF v_target_auth_user_id IS NULL AND v_old_email IS NOT NULL THEN
        SELECT p.id INTO v_target_auth_user_id FROM public.profiles p WHERE LOWER(p.email) = LOWER(v_old_email) LIMIT 1;
        IF v_target_auth_user_id IS NULL THEN
          SELECT u.id INTO v_target_auth_user_id FROM auth.users u WHERE LOWER(u.email) = LOWER(v_old_email) LIMIT 1;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Check 2C: Inspect public.students if not resolved
  IF v_target_auth_user_id IS NULL THEN
    SELECT s.id, s.auth_user_id, s.email, s.full_name
    INTO v_student_id, v_target_auth_user_id, v_old_email, v_full_name
    FROM public.students s
    WHERE s.id = p_target_user_id OR s.auth_user_id = p_target_user_id
    LIMIT 1;

    IF v_student_id IS NOT NULL THEN
      v_role := 'student';
      -- If s.auth_user_id is NULL, check if a profile or auth user exists with matching email
      IF v_target_auth_user_id IS NULL AND v_old_email IS NOT NULL THEN
        SELECT p.id INTO v_target_auth_user_id FROM public.profiles p WHERE LOWER(p.email) = LOWER(v_old_email) LIMIT 1;
        IF v_target_auth_user_id IS NULL THEN
          SELECT u.id INTO v_target_auth_user_id FROM auth.users u WHERE LOWER(u.email) = LOWER(v_old_email) LIMIT 1;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Check 2D: Check directly in auth.users
  IF v_target_auth_user_id IS NULL THEN
    SELECT u.id, u.email
    INTO v_target_auth_user_id, v_old_email
    FROM auth.users u
    WHERE u.id = p_target_user_id
    LIMIT 1;
  END IF;

  -- Cross-link faculty/student if target_auth_user_id was found
  IF v_target_auth_user_id IS NOT NULL THEN
    IF v_faculty_id IS NULL THEN
      SELECT f.id, f.email INTO v_faculty_id, v_old_email
      FROM public.faculty f
      WHERE f.auth_user_id = v_target_auth_user_id OR (v_old_email IS NOT NULL AND LOWER(f.email) = LOWER(v_old_email))
      LIMIT 1;
      IF v_faculty_id IS NOT NULL THEN v_role := 'faculty'; END IF;
    END IF;

    IF v_student_id IS NULL THEN
      SELECT s.id, s.email INTO v_student_id, v_old_email
      FROM public.students s
      WHERE s.auth_user_id = v_target_auth_user_id OR (v_old_email IS NOT NULL AND LOWER(s.email) = LOWER(v_old_email))
      LIMIT 1;
      IF v_student_id IS NOT NULL THEN v_role := 'student'; END IF;
    END IF;
  ELSE
    v_target_auth_user_id := p_target_user_id;
  END IF;

  -- Ensure target exists in auth.users or provision if missing
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_target_auth_user_id) THEN
    -- If no password was provided, use role default
    IF p_new_password IS NOT NULL AND TRIM(p_new_password) != '' THEN
      v_clean_pass := TRIM(p_new_password);
    ELSE
      v_clean_pass := CASE WHEN v_role = 'faculty' THEN 'faculty@123' ELSE 'student123' END;
    END IF;

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

    -- Ensure profile exists
    INSERT INTO public.profiles (
      id, email, role, full_name, faculty_id, student_id, created_at, updated_at
    ) VALUES (
      v_target_auth_user_id,
      COALESCE(LOWER(TRIM(p_new_email)), LOWER(TRIM(v_old_email))),
      COALESCE(v_role, 'student'),
      COALESCE(v_full_name, 'User'),
      v_faculty_id,
      v_student_id,
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      faculty_id = COALESCE(profiles.faculty_id, EXCLUDED.faculty_id),
      student_id = COALESCE(profiles.student_id, EXCLUDED.student_id),
      updated_at = NOW();

    IF v_faculty_id IS NOT NULL THEN
      UPDATE public.faculty SET auth_user_id = v_target_auth_user_id WHERE id = v_faculty_id;
    END IF;

    IF v_student_id IS NOT NULL THEN
      UPDATE public.students SET auth_user_id = v_target_auth_user_id WHERE id = v_student_id;
    END IF;

    v_password_updated := TRUE;
  END IF;

  -- 3. Handle Email Update
  IF p_new_email IS NOT NULL AND TRIM(p_new_email) != '' THEN
    v_clean_email := LOWER(TRIM(p_new_email));

    IF v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email format: "%"', v_clean_email;
    END IF;

    IF v_clean_email != LOWER(TRIM(COALESCE(v_old_email, ''))) THEN
      -- Automated orphan account resolution
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
          AND (auth_user_id IS DISTINCT FROM v_target_auth_user_id)
          AND (v_student_id IS NULL OR id != v_student_id)
      ) THEN
        RAISE EXCEPTION 'Email "%" is already in use by another student.', v_clean_email;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.faculty 
        WHERE LOWER(email) = v_clean_email 
          AND (auth_user_id IS DISTINCT FROM v_target_auth_user_id)
          AND (v_faculty_id IS NULL OR id != v_faculty_id)
      ) THEN
        RAISE EXCEPTION 'Email "%" is already in use by another faculty member.', v_clean_email;
      END IF;

      -- Update auth.users
      UPDATE auth.users
      SET email = v_clean_email,
          raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{email}', to_jsonb(v_clean_email)),
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
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_target_auth_user_id;

    -- Audit Log for password update
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

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.admin_update_account_credentials(UUID, TEXT, TEXT, BOOLEAN, UUID, TEXT, TEXT) TO authenticated, service_role;

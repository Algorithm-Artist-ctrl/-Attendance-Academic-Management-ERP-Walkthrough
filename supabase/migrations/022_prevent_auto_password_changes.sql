-- ==============================================================================
-- Migration 022: Prevent Automatic Password Changes & Safeguard Credentials
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Redefine admin_update_account_credentials with zero default password fallback
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

  -- If not matched by profiles.id, inspect students and faculty
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

  -- If still null, check directly in auth.users
  IF v_target_auth_user_id IS NULL THEN
    SELECT u.id, u.email
    INTO v_target_auth_user_id, v_old_email
    FROM auth.users u
    WHERE u.id = p_target_user_id
    LIMIT 1;
  END IF;

  IF v_target_auth_user_id IS NULL THEN
    v_target_auth_user_id := p_target_user_id;
  END IF;

  -- Ensure target exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_target_auth_user_id) THEN
    -- If no password was provided, WE CANNOT CREATE AN ACCOUNT WITH A DEFAULT PASSWORD!
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
      -- Uniqueness checks across system
      IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email AND id != v_target_auth_user_id) THEN
        RAISE EXCEPTION 'Email "%" is already registered to another user.', v_clean_email;
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
          updated_at = NOW()
      WHERE id = v_target_auth_user_id;

      -- Update public.students
      UPDATE public.students
      SET email = v_clean_email,
          updated_at = NOW()
      WHERE auth_user_id = v_target_auth_user_id OR (v_student_id IS NOT NULL AND id = v_student_id);

      -- Update public.faculty
      UPDATE public.faculty
      SET email = v_clean_email,
          updated_at = NOW()
      WHERE auth_user_id = v_target_auth_user_id OR (v_faculty_id IS NOT NULL AND id = v_faculty_id);

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
        COALESCE(p_actor_id, auth.uid()),
        COALESCE(p_actor_name, 'Super Admin'),
        COALESCE(p_actor_role, 'super_admin'),
        'EMAIL_CHANGED',
        CASE 
          WHEN v_faculty_id IS NOT NULL OR v_role = 'faculty' THEN 'faculty'
          WHEN v_student_id IS NOT NULL OR v_role = 'student' THEN 'students'
          ELSE 'user_account'
        END,
        COALESCE(v_student_id, v_faculty_id, v_target_auth_user_id),
        jsonb_build_object('email', v_old_email),
        jsonb_build_object('email', v_clean_email),
        NOW()
      );

      v_email_updated := TRUE;
    END IF;
  END IF;

  -- 4. Handle Password Update ONLY IF EXPLICITLY PROVIDED AND NON-EMPTY
  IF p_new_password IS NOT NULL AND TRIM(p_new_password) != '' THEN
    v_clean_pass := TRIM(p_new_password);

    IF length(v_clean_pass) < 6 THEN
      RAISE EXCEPTION 'Password must be at least 6 characters in length.';
    END IF;

    -- Update auth.users with crypted password
    UPDATE auth.users
    SET encrypted_password = crypt(v_clean_pass, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_target_auth_user_id;

    -- Audit Log for password change (STRICT: NEVER STORE PLAINTEXT PASSWORD!)
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
      COALESCE(p_actor_name, 'Super Admin'),
      COALESCE(p_actor_role, 'super_admin'),
      CASE WHEN p_is_default_password THEN 'DEFAULT_PASSWORD_SET' ELSE 'PASSWORD_CHANGED' END,
      CASE 
        WHEN v_faculty_id IS NOT NULL OR v_role = 'faculty' THEN 'faculty'
        WHEN v_student_id IS NOT NULL OR v_role = 'student' THEN 'students'
        ELSE 'user_account'
      END,
      COALESCE(v_student_id, v_faculty_id, v_target_auth_user_id),
      jsonb_build_object('email', COALESCE(v_clean_email, v_old_email)),
      jsonb_build_object('is_default_password', p_is_default_password, 'updated_at', NOW()),
      NOW()
    );

    v_password_updated := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_target_auth_user_id,
    'email', COALESCE(v_clean_email, v_old_email),
    'email_updated', v_email_updated,
    'password_updated', v_password_updated,
    'is_default_password', p_is_default_password
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_account_credentials(UUID, TEXT, TEXT, BOOLEAN, UUID, TEXT, TEXT) TO authenticated, anon;


-- 2. Redefine reconcile_all_accounts to ensure zero password overwrites
CREATE OR REPLACE FUNCTION public.reconcile_all_accounts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role user_role;
  v_rec RECORD;
  v_auth_id UUID;
  v_clean_email TEXT;
  v_reconciled_students INT := 0;
  v_reconciled_faculty INT := 0;
BEGIN
  -- Security check
  SELECT profiles.role INTO v_caller_role FROM public.profiles WHERE profiles.id = auth.uid();
  IF auth.uid() IS NOT NULL AND v_caller_role NOT IN ('super_admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator can trigger system-wide account reconciliation';
  END IF;

  -- 2A. Reconcile Faculty
  FOR v_rec IN 
    SELECT f.* 
    FROM public.faculty f
    WHERE f.active = true
      AND (f.auth_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = f.auth_user_id))
  LOOP
    v_clean_email := LOWER(TRIM(v_rec.email));
    IF v_clean_email IS NULL OR v_clean_email = '' THEN
      v_clean_email := LOWER(COALESCE(v_rec.faculty_code, v_rec.employee_code)) || '@faculty.vctm.in';
    END IF;

    -- Check if auth user exists by email FIRST
    SELECT id INTO v_auth_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;

    -- Only create auth user if it truly does not exist in auth.users
    IF v_auth_id IS NULL THEN
      v_auth_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new,
        is_sso_user, is_anonymous
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
        v_clean_email, crypt('faculty@123', gen_salt('bf')), NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('employee_code', v_rec.employee_code, 'full_name', v_rec.full_name),
        NOW(), NOW(), '', '', '', '', false, false
      );

      INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_auth_id::text, v_auth_id,
        jsonb_build_object('sub', v_auth_id::text, 'email', v_clean_email),
        'email', NOW(), NOW()
      )
      ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();
    END IF;
    -- NOTE: If v_auth_id was found, existing password was NOT modified!

    UPDATE public.faculty 
    SET auth_user_id = v_auth_id, email = v_clean_email, updated_at = NOW() 
    WHERE id = v_rec.id;

    INSERT INTO public.profiles (
      id, email, role, full_name, department_id, faculty_id, phone, status, created_at, updated_at
    ) VALUES (
      v_auth_id, v_clean_email, 
      CASE WHEN LOWER(v_rec.designation) LIKE '%hod%' OR v_rec.faculty_code = 'WSM' THEN 'hod'::user_role ELSE 'faculty'::user_role END,
      v_rec.full_name, v_rec.department_id, v_rec.id, v_rec.phone, 'ACTIVE', NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      faculty_id = EXCLUDED.faculty_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      status = 'ACTIVE',
      updated_at = NOW();

    v_reconciled_faculty := v_reconciled_faculty + 1;
  END LOOP;

  -- 2B. Reconcile Students
  FOR v_rec IN 
    SELECT s.* 
    FROM public.students s
    WHERE s.active = true
      AND (s.auth_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.auth_user_id))
  LOOP
    v_clean_email := LOWER(TRIM(COALESCE(v_rec.email, '')));
    IF v_clean_email = '' THEN
      v_clean_email := LOWER(v_rec.roll_number) || '@student.vctm.in';
    END IF;

    SELECT id INTO v_auth_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;

    IF v_auth_id IS NULL THEN
      v_auth_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new,
        is_sso_user, is_anonymous
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
        v_clean_email, crypt('student123', gen_salt('bf')), NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('roll_number', v_rec.roll_number, 'full_name', v_rec.full_name),
        NOW(), NOW(), '', '', '', '', false, false
      );

      INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_auth_id::text, v_auth_id,
        jsonb_build_object('sub', v_auth_id::text, 'email', v_clean_email),
        'email', NOW(), NOW()
      )
      ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();
    END IF;
    -- NOTE: If v_auth_id was found, existing password was NOT modified!

    UPDATE public.students 
    SET auth_user_id = v_auth_id, email = v_clean_email, updated_at = NOW() 
    WHERE id = v_rec.id;

    INSERT INTO public.profiles (
      id, email, role, full_name, department_id, student_id, phone, status, created_at, updated_at
    ) VALUES (
      v_auth_id, v_clean_email, 'student'::user_role,
      v_rec.full_name, v_rec.department_id, v_rec.id, v_rec.phone, 'ACTIVE', NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      student_id = EXCLUDED.student_id,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      status = 'ACTIVE',
      updated_at = NOW();

    v_reconciled_students := v_reconciled_students + 1;
  END LOOP;

  -- Audit log
  INSERT INTO public.audit_logs (
    actor_id, actor_name, actor_role, action, entity_type, entity_id, new_values, created_at
  ) VALUES (
    auth.uid(), 'Super Admin', 'super_admin', 'SYSTEM_ACCOUNTS_RECONCILED', 'system',
    '99999999-9999-4999-9999-999999999999',
    jsonb_build_object('reconciled_students', v_reconciled_students, 'reconciled_faculty', v_reconciled_faculty),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'reconciled_students', v_reconciled_students,
    'reconciled_faculty', v_reconciled_faculty
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_all_accounts TO authenticated, anon;

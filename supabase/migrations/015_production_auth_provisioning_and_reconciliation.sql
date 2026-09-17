-- ==============================================================================
-- Migration 015: Production Auth Provisioning, Reconciliation & Multi-Year Timetable
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. AKTU Semester 7 Curriculum & Subjects
INSERT INTO public.subjects (id, program_id, department_id, semester_id, subject_code, subject_name, lecture_type, credits, active)
VALUES
    ('97b0a112-28a1-4389-9831-a2bc0a701001', 'c71b3983-9ff8-43e1-a9a0-b778676bf186', 'fe5bc365-7a68-4290-b05e-acfa274f748a', 'a6815eb1-4be1-4c8c-af17-6fb3dbf436ed', 'BCS701', 'DISTRIBUTED SYSTEMS', 'Theory', 4.0, true),
    ('97b0a112-28a1-4389-9831-a2bc0a701002', 'c71b3983-9ff8-43e1-a9a0-b778676bf186', 'fe5bc365-7a68-4290-b05e-acfa274f748a', 'a6815eb1-4be1-4c8c-af17-6fb3dbf436ed', 'BCS071', 'CLOUD COMPUTING', 'Theory', 3.0, true),
    ('97b0a112-28a1-4389-9831-a2bc0a701003', 'c71b3983-9ff8-43e1-a9a0-b778676bf186', 'fe5bc365-7a68-4290-b05e-acfa274f748a', 'a6815eb1-4be1-4c8c-af17-6fb3dbf436ed', 'BOE074', 'RENEWABLE ENERGY RESOURCES', 'Theory', 3.0, true),
    ('97b0a112-28a1-4389-9831-a2bc0a701004', 'c71b3983-9ff8-43e1-a9a0-b778676bf186', 'fe5bc365-7a68-4290-b05e-acfa274f748a', 'a6815eb1-4be1-4c8c-af17-6fb3dbf436ed', 'BCS751', 'DISTRIBUTED SYSTEMS LAB', 'Practical', 1.0, true),
    ('97b0a112-28a1-4389-9831-a2bc0a701005', 'c71b3983-9ff8-43e1-a9a0-b778676bf186', 'fe5bc365-7a68-4290-b05e-acfa274f748a', 'a6815eb1-4be1-4c8c-af17-6fb3dbf436ed', 'BCS753', 'MAJOR PROJECT PHASE-I', 'Project', 4.0, true),
    ('97b0a112-28a1-4389-9831-a2bc0a701006', 'c71b3983-9ff8-43e1-a9a0-b778676bf186', 'fe5bc365-7a68-4290-b05e-acfa274f748a', 'a6815eb1-4be1-4c8c-af17-6fb3dbf436ed', 'BCS754', 'INDUSTRIAL TRAINING ASSESSMENT', 'Project', 2.0, true)
ON CONFLICT (subject_code, semester_id) DO UPDATE 
SET active = true, updated_at = NOW();

-- 2. Stored Procedure: Atomic Student Account & Auth Provisioning
CREATE OR REPLACE FUNCTION public.provision_student_account(
  p_roll_number TEXT,
  p_full_name TEXT,
  p_section_id UUID,
  p_admission_type admission_type DEFAULT 'Regular',
  p_email TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_mentor_faculty_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role user_role;
  v_sec RECORD;
  v_sem RECORD;
  v_ay RECORD;
  v_prog RECORD;
  v_session_id UUID;
  v_inst_id UUID;
  v_clean_email TEXT;
  v_clean_roll TEXT;
  v_clean_pass TEXT;
  v_auth_user_id UUID;
  v_student_id UUID;
BEGIN
  -- Security check: Caller must be super_admin, hod, or service_role
  SELECT profiles.role INTO v_caller_role FROM public.profiles WHERE profiles.id = auth.uid();
  IF auth.uid() IS NOT NULL AND v_caller_role NOT IN ('super_admin', 'hod') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator or HOD can provision student accounts';
  END IF;

  v_clean_roll := UPPER(TRIM(p_roll_number));
  IF v_clean_roll IS NULL OR v_clean_roll = '' THEN
    RAISE EXCEPTION 'Roll number is required';
  END IF;

  -- Resolve Section & Hierarchy
  SELECT * INTO v_sec FROM public.sections WHERE id = p_section_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Section not found: %', p_section_id;
  END IF;

  SELECT * INTO v_sem FROM public.semesters WHERE id = v_sec.semester_id;
  SELECT * INTO v_ay FROM public.academic_years WHERE id = v_sem.academic_year_id;
  SELECT * INTO v_prog FROM public.programs WHERE id = v_ay.program_id;

  SELECT id INTO v_session_id FROM public.academic_sessions WHERE is_current = true LIMIT 1;
  IF v_session_id IS NULL THEN
    v_session_id := 'a358fe68-d746-4242-9f36-2c715cd9526e';
  END IF;

  SELECT id INTO v_inst_id FROM public.institutions LIMIT 1;
  IF v_inst_id IS NULL THEN
    v_inst_id := '22398afa-8679-4d2c-87fc-312152a276e2';
  END IF;

  -- Official email and password convention
  IF p_email IS NOT NULL AND TRIM(p_email) != '' THEN
    v_clean_email := LOWER(TRIM(p_email));
  ELSE
    v_clean_email := LOWER(v_clean_roll) || '@student.vctm.in';
  END IF;

  IF p_password IS NOT NULL AND TRIM(p_password) != '' THEN
    v_clean_pass := TRIM(p_password);
  ELSE
    v_clean_pass := 'student123';
  END IF;

  -- Check if auth user already exists by email
  SELECT id INTO v_auth_user_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    v_auth_user_id := gen_random_uuid();

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
      v_auth_user_id,
      'authenticated',
      'authenticated',
      v_clean_email,
      crypt(v_clean_pass, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('roll_number', v_clean_roll, 'full_name', UPPER(TRIM(p_full_name))),
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      false,
      false
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
      v_auth_user_id::text,
      v_auth_user_id,
      jsonb_build_object('sub', v_auth_user_id::text, 'email', v_clean_email),
      'email',
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();
  END IF;

  -- Insert or Update public.students
  SELECT id INTO v_student_id FROM public.students WHERE roll_number = v_clean_roll LIMIT 1;

  IF v_student_id IS NULL THEN
    v_student_id := gen_random_uuid();
    INSERT INTO public.students (
      id,
      auth_user_id,
      institution_id,
      department_id,
      program_id,
      academic_session_id,
      academic_year_id,
      semester_id,
      section_id,
      roll_number,
      full_name,
      admission_type,
      mentor_faculty_id,
      email,
      phone,
      active,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_student_id,
      v_auth_user_id,
      v_inst_id,
      v_prog.department_id,
      v_prog.id,
      v_session_id,
      v_ay.id,
      v_sem.id,
      v_sec.id,
      v_clean_roll,
      UPPER(TRIM(p_full_name)),
      p_admission_type,
      p_mentor_faculty_id,
      v_clean_email,
      p_phone,
      true,
      'ACTIVE',
      NOW(),
      NOW()
    );
  ELSE
    UPDATE public.students SET
      auth_user_id = v_auth_user_id,
      email = v_clean_email,
      full_name = UPPER(TRIM(p_full_name)),
      section_id = v_sec.id,
      semester_id = v_sem.id,
      academic_year_id = v_ay.id,
      department_id = v_prog.department_id,
      program_id = v_prog.id,
      admission_type = p_admission_type,
      mentor_faculty_id = p_mentor_faculty_id,
      phone = COALESCE(p_phone, phone),
      active = true,
      status = 'ACTIVE',
      updated_at = NOW()
    WHERE id = v_student_id;
  END IF;

  -- Upsert public.profiles with student_id link
  INSERT INTO public.profiles (
    id,
    email,
    role,
    full_name,
    department_id,
    student_id,
    faculty_id,
    phone,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_auth_user_id,
    v_clean_email,
    'student'::user_role,
    UPPER(TRIM(p_full_name)),
    v_prog.department_id,
    v_student_id,
    NULL,
    p_phone,
    'ACTIVE',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    student_id = EXCLUDED.student_id,
    role = 'student'::user_role,
    department_id = EXCLUDED.department_id,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    status = 'ACTIVE',
    updated_at = NOW();

  -- Audit Log
  INSERT INTO public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    new_values,
    created_at
  ) VALUES (
    auth.uid(),
    COALESCE(p_actor_name, 'Super Admin'),
    COALESCE(v_caller_role::text, 'super_admin'),
    'STUDENT_ACCOUNT_PROVISIONED',
    'students',
    v_student_id,
    jsonb_build_object(
      'roll_number', v_clean_roll,
      'auth_user_id', v_auth_user_id,
      'email', v_clean_email,
      'section_id', v_sec.id,
      'semester_id', v_sem.id,
      'academic_year_id', v_ay.id
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'auth_user_id', v_auth_user_id,
    'email', v_clean_email,
    'roll_number', v_clean_roll,
    'full_name', UPPER(TRIM(p_full_name))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_student_account TO authenticated, anon;


-- 3. Stored Procedure: Atomic Faculty Account & Auth Provisioning
CREATE OR REPLACE FUNCTION public.provision_faculty_account(
  p_employee_code TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_department_id UUID,
  p_designation TEXT DEFAULT 'Assistant Professor',
  p_faculty_code TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_assignments JSONB DEFAULT '[]'::jsonb,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role user_role;
  v_clean_emp_code TEXT;
  v_clean_fac_code TEXT;
  v_clean_email TEXT;
  v_clean_pass TEXT;
  v_auth_user_id UUID;
  v_faculty_id UUID;
  v_is_hod BOOLEAN;
  v_role user_role;
  v_asgn JSONB;
  v_session_id UUID;
BEGIN
  -- Security check
  SELECT profiles.role INTO v_caller_role FROM public.profiles WHERE profiles.id = auth.uid();
  IF auth.uid() IS NOT NULL AND v_caller_role NOT IN ('super_admin', 'hod') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Administrator or HOD can provision faculty accounts';
  END IF;

  v_clean_emp_code := UPPER(TRIM(p_employee_code));
  v_clean_fac_code := UPPER(TRIM(COALESCE(p_faculty_code, '')));
  v_clean_email := LOWER(TRIM(p_email));
  
  IF v_clean_emp_code = '' OR v_clean_email = '' OR TRIM(p_full_name) = '' THEN
    RAISE EXCEPTION 'Employee code, official email, and full name are required';
  END IF;

  IF p_password IS NOT NULL AND TRIM(p_password) != '' THEN
    v_clean_pass := TRIM(p_password);
  ELSE
    v_clean_pass := 'faculty@123';
  END IF;

  v_is_hod := LOWER(p_designation) LIKE '%hod%' OR v_clean_fac_code = 'WSM';
  v_role := CASE WHEN v_is_hod THEN 'hod'::user_role ELSE 'faculty'::user_role END;

  SELECT id INTO v_session_id FROM public.academic_sessions WHERE is_current = true LIMIT 1;
  IF v_session_id IS NULL THEN
    v_session_id := 'a358fe68-d746-4242-9f36-2c715cd9526e';
  END IF;

  -- Check if auth user already exists
  SELECT id INTO v_auth_user_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    v_auth_user_id := gen_random_uuid();

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
      v_auth_user_id,
      'authenticated',
      'authenticated',
      v_clean_email,
      crypt(v_clean_pass, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('employee_code', v_clean_emp_code, 'full_name', TRIM(p_full_name)),
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      false,
      false
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
      v_auth_user_id::text,
      v_auth_user_id,
      jsonb_build_object('sub', v_auth_user_id::text, 'email', v_clean_email),
      'email',
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();
  END IF;

  -- Insert or Update public.faculty
  SELECT id INTO v_faculty_id FROM public.faculty WHERE employee_code = v_clean_emp_code OR LOWER(email) = v_clean_email LIMIT 1;

  IF v_faculty_id IS NULL THEN
    v_faculty_id := gen_random_uuid();
    INSERT INTO public.faculty (
      id,
      auth_user_id,
      department_id,
      employee_code,
      faculty_code,
      full_name,
      designation,
      email,
      phone,
      active,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_faculty_id,
      v_auth_user_id,
      p_department_id,
      v_clean_emp_code,
      NULLIF(v_clean_fac_code, ''),
      TRIM(p_full_name),
      TRIM(p_designation),
      v_clean_email,
      p_phone,
      true,
      'ACTIVE',
      NOW(),
      NOW()
    );
  ELSE
    UPDATE public.faculty SET
      auth_user_id = v_auth_user_id,
      email = v_clean_email,
      full_name = TRIM(p_full_name),
      department_id = p_department_id,
      designation = TRIM(p_designation),
      faculty_code = COALESCE(NULLIF(v_clean_fac_code, ''), faculty_code),
      phone = COALESCE(p_phone, phone),
      active = true,
      status = 'ACTIVE',
      updated_at = NOW()
    WHERE id = v_faculty_id;
  END IF;

  -- Upsert public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    role,
    full_name,
    department_id,
    student_id,
    faculty_id,
    phone,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_auth_user_id,
    v_clean_email,
    v_role,
    TRIM(p_full_name),
    p_department_id,
    NULL,
    v_faculty_id,
    p_phone,
    'ACTIVE',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    faculty_id = EXCLUDED.faculty_id,
    role = v_role,
    department_id = EXCLUDED.department_id,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    status = 'ACTIVE',
    updated_at = NOW();

  -- Insert Assignments
  IF p_assignments IS NOT NULL AND jsonb_array_length(p_assignments) > 0 THEN
    FOR v_asgn IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
      INSERT INTO public.faculty_subject_assignments (
        faculty_id,
        subject_id,
        section_id,
        academic_session_id,
        active,
        created_at,
        updated_at
      ) VALUES (
        v_faculty_id,
        (v_asgn->>'subject_id')::UUID,
        (v_asgn->>'section_id')::UUID,
        v_session_id,
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (faculty_id, subject_id, section_id, academic_session_id)
      DO UPDATE SET active = true, updated_at = NOW();
    END LOOP;
  END IF;

  -- Audit Log
  INSERT INTO public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    new_values,
    created_at
  ) VALUES (
    auth.uid(),
    COALESCE(p_actor_name, 'Super Admin'),
    COALESCE(v_caller_role::text, 'super_admin'),
    'FACULTY_ACCOUNT_PROVISIONED',
    'faculty',
    v_faculty_id,
    jsonb_build_object(
      'employee_code', v_clean_emp_code,
      'auth_user_id', v_auth_user_id,
      'email', v_clean_email,
      'assignment_count', COALESCE(jsonb_array_length(p_assignments), 0)
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'faculty_id', v_faculty_id,
    'auth_user_id', v_auth_user_id,
    'email', v_clean_email,
    'employee_code', v_clean_emp_code,
    'full_name', TRIM(p_full_name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_faculty_account TO authenticated, anon;


-- 4. Stored Procedure: Idempotent Batch Reconciliation for All Existing Records
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

  -- 4A. Reconcile Faculty
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

  -- 4B. Reconcile Students
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


-- 5. Timetable Construction for 3rd Year Section B & 4th Year Section A
DO $$
DECLARE
  v_session_id UUID := 'a358fe68-d746-4242-9f36-2c715cd9526e';
  v_sec_3b UUID := '648a9246-601d-40a1-b43d-2b1a1a89ea32'; -- 3rd Year Sec B
  v_sec_4a UUID := '7b80ad81-10be-403a-a3a2-26ff7079b4df'; -- 4th Year Sec A
  v_sec_4b UUID := '7eff4f33-f602-499f-92a2-d1e83f474373'; -- 4th Year Sec B

  -- Faculty
  v_fac_hem UUID;
  v_fac_irk UUID;
  v_fac_dag UUID;
  v_fac_as UUID;
  v_fac_sa UUID;
  v_fac_js UUID;
  v_fac_mjs UUID;
  v_fac_wsm UUID;
  v_fac_alg UUID;

  -- Subjects 3rd Year (Sem 5)
  v_sub_bcs501 UUID;
  v_sub_bcs502 UUID;
  v_sub_bcs503 UUID;
  v_sub_bcs052 UUID;
  v_sub_bcs055 UUID;
  v_sub_bnc501 UUID;
  v_sub_bcs551 UUID;
  v_sub_bcs552 UUID;
  v_sub_bcs553 UUID;
  v_sub_bcs554 UUID;

  -- Subjects 4th Year (Sem 7)
  v_sub_bcs701 UUID;
  v_sub_bcs071 UUID;
  v_sub_boe074 UUID;
  v_sub_bcs751 UUID;
  v_sub_bcs753 UUID;
  v_sub_bcs754 UUID;

  v_days day_of_week_enum[] := ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']::day_of_week_enum[];
  v_day day_of_week_enum;
  v_times_start TIME[] := ARRAY['09:00:00'::TIME, '09:50:00'::TIME, '10:40:00'::TIME, '11:30:00'::TIME, '12:20:00'::TIME, '13:10:00'::TIME, '14:00:00'::TIME, '14:50:00'::TIME];
  v_times_end TIME[] := ARRAY['09:50:00'::TIME, '10:40:00'::TIME, '11:30:00'::TIME, '12:20:00'::TIME, '13:10:00'::TIME, '14:00:00'::TIME, '14:50:00'::TIME, '15:40:00'::TIME];
  v_p INT;
BEGIN
  -- Resolve Faculty
  SELECT id INTO v_fac_hem FROM public.faculty WHERE faculty_code = 'HEM' LIMIT 1;
  SELECT id INTO v_fac_irk FROM public.faculty WHERE faculty_code = 'IRK' LIMIT 1;
  SELECT id INTO v_fac_dag FROM public.faculty WHERE faculty_code = 'DAG' LIMIT 1;
  SELECT id INTO v_fac_as FROM public.faculty WHERE faculty_code = 'AS' LIMIT 1;
  SELECT id INTO v_fac_sa FROM public.faculty WHERE faculty_code = 'SA' LIMIT 1;
  SELECT id INTO v_fac_js FROM public.faculty WHERE faculty_code = 'JS' LIMIT 1;
  SELECT id INTO v_fac_mjs FROM public.faculty WHERE faculty_code = 'MJS' LIMIT 1;
  SELECT id INTO v_fac_wsm FROM public.faculty WHERE faculty_code = 'WSM' LIMIT 1;
  SELECT id INTO v_fac_alg FROM public.faculty WHERE faculty_code = 'ALG' LIMIT 1;

  -- Resolve Sem 5 Subjects
  SELECT id INTO v_sub_bcs501 FROM public.subjects WHERE subject_code = 'BCS501' LIMIT 1;
  SELECT id INTO v_sub_bcs502 FROM public.subjects WHERE subject_code = 'BCS502' LIMIT 1;
  SELECT id INTO v_sub_bcs503 FROM public.subjects WHERE subject_code = 'BCS503' LIMIT 1;
  SELECT id INTO v_sub_bcs052 FROM public.subjects WHERE subject_code = 'BCS052' LIMIT 1;
  SELECT id INTO v_sub_bcs055 FROM public.subjects WHERE subject_code = 'BCS055' LIMIT 1;
  SELECT id INTO v_sub_bnc501 FROM public.subjects WHERE subject_code = 'BNC501' LIMIT 1;
  SELECT id INTO v_sub_bcs551 FROM public.subjects WHERE subject_code = 'BCS551' LIMIT 1;
  SELECT id INTO v_sub_bcs552 FROM public.subjects WHERE subject_code = 'BCS552' LIMIT 1;
  SELECT id INTO v_sub_bcs553 FROM public.subjects WHERE subject_code = 'BCS553' LIMIT 1;
  SELECT id INTO v_sub_bcs554 FROM public.subjects WHERE subject_code = 'BCS554' LIMIT 1;

  -- Resolve Sem 7 Subjects
  SELECT id INTO v_sub_bcs701 FROM public.subjects WHERE subject_code = 'BCS701' LIMIT 1;
  SELECT id INTO v_sub_bcs071 FROM public.subjects WHERE subject_code = 'BCS071' LIMIT 1;
  SELECT id INTO v_sub_boe074 FROM public.subjects WHERE subject_code = 'BOE074' LIMIT 1;
  SELECT id INTO v_sub_bcs751 FROM public.subjects WHERE subject_code = 'BCS751' LIMIT 1;
  SELECT id INTO v_sub_bcs753 FROM public.subjects WHERE subject_code = 'BCS753' LIMIT 1;
  SELECT id INTO v_sub_bcs754 FROM public.subjects WHERE subject_code = 'BCS754' LIMIT 1;

  -- Clear existing entries for 3B, 4A, 4B to build full authoritative 48 weekly slots
  DELETE FROM public.timetable_entries WHERE section_id IN (v_sec_3b, v_sec_4a, v_sec_4b);

  -- 5A. Insert 48 slots for 3rd Year Section B
  FOREACH v_day IN ARRAY v_days
  LOOP
    FOR v_p IN 1..8
    LOOP
      IF v_p = 5 THEN
        -- Lunch Break
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_3b, NULL, NULL, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Refectory / Break', 'Lunch', true);
      ELSIF v_p = 1 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_3b, v_sub_bcs502, v_fac_as, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-302', 'Theory', true);
      ELSIF v_p = 2 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_3b, v_sub_bcs501, v_fac_irk, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-302', 'Theory', true);
      ELSIF v_p = 3 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_3b, v_sub_bcs503, v_fac_dag, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-302', 'Theory', true);
      ELSIF v_p = 4 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_3b, v_sub_bcs052, v_fac_hem, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-302', 'Theory', true);
      ELSIF v_p = 6 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_3b, v_sub_bnc501, v_fac_sa, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-302', 'Theory', true);
      ELSIF v_p = 7 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_3b, v_sub_bcs055, v_fac_mjs, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-302', 'Theory', true);
      ELSE
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_3b, v_sub_bcs552, v_fac_as, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'WD Lab', 'Practical', true);
      END IF;
    END LOOP;
  END LOOP;

  -- 5B. Insert 48 slots for 4th Year Section A
  FOREACH v_day IN ARRAY v_days
  LOOP
    FOR v_p IN 1..8
    LOOP
      IF v_p = 5 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4a, NULL, NULL, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Refectory / Break', 'Lunch', true);
      ELSIF v_p = 1 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4a, v_sub_bcs701, v_fac_wsm, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-401', 'Theory', true);
      ELSIF v_p = 2 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4a, v_sub_bcs071, v_fac_alg, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-401', 'Theory', true);
      ELSIF v_p = 3 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4a, v_sub_boe074, v_fac_js, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-401', 'Theory', true);
      ELSIF v_p = 4 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4a, v_sub_bcs751, v_fac_wsm, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'DS Lab', 'Practical', true);
      ELSIF v_p = 6 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4a, v_sub_bcs701, v_fac_wsm, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-401', 'Theory', true);
      ELSIF v_p = 7 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4a, v_sub_bcs071, v_fac_alg, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-401', 'Theory', true);
      ELSE
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4a, v_sub_bcs753, v_fac_wsm, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-401', 'Project', true);
      END IF;
    END LOOP;
  END LOOP;

  -- 5C. Insert 48 slots for 4th Year Section B
  FOREACH v_day IN ARRAY v_days
  LOOP
    FOR v_p IN 1..8
    LOOP
      IF v_p = 5 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4b, NULL, NULL, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Refectory / Break', 'Lunch', true);
      ELSIF v_p = 1 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4b, v_sub_boe074, v_fac_js, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-402', 'Theory', true);
      ELSIF v_p = 2 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4b, v_sub_bcs701, v_fac_wsm, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-402', 'Theory', true);
      ELSIF v_p = 3 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4b, v_sub_bcs071, v_fac_alg, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-402', 'Theory', true);
      ELSIF v_p = 4 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4b, v_sub_bcs751, v_fac_wsm, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'DS Lab', 'Practical', true);
      ELSIF v_p = 6 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4b, v_sub_boe074, v_fac_js, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-402', 'Theory', true);
      ELSIF v_p = 7 THEN
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4b, v_sub_bcs071, v_fac_alg, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-402', 'Theory', true);
      ELSE
        INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active)
        VALUES (v_sec_4b, v_sub_bcs754, v_fac_alg, v_day, v_p, v_times_start[v_p], v_times_end[v_p], 'Room A-402', 'Project', true);
      END IF;
    END LOOP;
  END LOOP;

  -- 5D. Synchronize faculty_subject_assignments
  INSERT INTO public.faculty_subject_assignments (faculty_id, subject_id, section_id, academic_session_id, active, created_at, updated_at)
  SELECT DISTINCT faculty_id, subject_id, section_id, v_session_id, true, NOW(), NOW()
  FROM public.timetable_entries
  WHERE section_id IN (v_sec_3b, v_sec_4a, v_sec_4b) AND faculty_id IS NOT NULL AND subject_id IS NOT NULL
  ON CONFLICT (faculty_id, subject_id, section_id, academic_session_id)
  DO UPDATE SET active = true, updated_at = NOW();

END $$;

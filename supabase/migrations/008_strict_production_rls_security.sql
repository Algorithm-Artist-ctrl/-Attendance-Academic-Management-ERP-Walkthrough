-- ==============================================================================
-- Migration 008: Strict Production RLS Security, RPC Authorization & 3rd Year Section A
-- Vivekananda College of Technology & Management (VCTM) ERP
-- ==============================================================================

-- 1. Ensure Helper Functions for Current User Identity & Role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_department_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT department_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_faculty_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT faculty_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_student_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT student_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
        auth.uid()
    );
$$;

-- 2. Clean Up All Permissive Old RLS Policies from Public Tables
DO $$
DECLARE
    r RECORD;
    t TEXT;
    target_tables TEXT[] := ARRAY[
        'institutions', 'departments', 'programs', 'academic_sessions', 'academic_years',
        'semesters', 'sections', 'subjects', 'classrooms', 'faculty', 'faculty_subject_assignments',
        'students', 'timetable_entries', 'timetable_versions', 'timetable_imports',
        'attendance_sessions', 'attendance_records', 'attendance_corrections',
        'sessional_assessments', 'sessional_marks', 'quizzes', 'quiz_results',
        'course_assignments', 'assignments', 'assignment_submissions', 'audit_logs', 'profiles'
    ];
BEGIN
    FOREACH t IN ARRAY target_tables
    LOOP
        -- Check if table exists in public schema
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY;';
            FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
            LOOP
                EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || quote_ident(t) || ';';
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- 3. Define Strict Production RLS Policies

-- --- A. INSTITUTIONAL STRUCTURE (Read: All, Write: Super Admin Only) ---
DO $$
DECLARE
    t TEXT;
    struct_tables TEXT[] := ARRAY['institutions', 'departments', 'programs', 'academic_sessions', 'academic_years', 'semesters', 'classrooms'];
BEGIN
    FOREACH t IN ARRAY struct_tables
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE 'CREATE POLICY "' || t || '_read" ON public.' || quote_ident(t) || ' FOR SELECT TO public USING (true);';
            EXECUTE 'CREATE POLICY "' || t || '_admin_all" ON public.' || quote_ident(t) || ' FOR ALL TO authenticated USING (public.current_user_role() = ''super_admin''::user_role OR auth.role() = ''service_role'') WITH CHECK (public.current_user_role() = ''super_admin''::user_role OR auth.role() = ''service_role'');';
        END IF;
    END LOOP;
END $$;

-- --- B. SECTIONS & SUBJECTS (Read: All, Manage: Super Admin + HOD) ---
CREATE POLICY "sections_read" ON public.sections FOR SELECT TO public USING (true);
CREATE POLICY "sections_manage" ON public.sections FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role');

CREATE POLICY "subjects_read" ON public.subjects FOR SELECT TO public USING (true);
CREATE POLICY "subjects_manage" ON public.subjects FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role');

-- --- C. FACULTY & ASSIGNMENTS ---
CREATE POLICY "faculty_read" ON public.faculty FOR SELECT TO public USING (true);
CREATE POLICY "faculty_manage" ON public.faculty FOR ALL TO authenticated
    USING (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) 
        OR (public.current_user_role() = 'faculty'::user_role AND id = public.current_user_faculty_id())
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) 
        OR (public.current_user_role() = 'faculty'::user_role AND id = public.current_user_faculty_id())
        OR auth.role() = 'service_role'
    );

CREATE POLICY "assignments_read" ON public.faculty_subject_assignments FOR SELECT TO public USING (true);
CREATE POLICY "assignments_manage" ON public.faculty_subject_assignments FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role');

-- --- D. STUDENTS (Read: All authenticated + Anon for lookup, Manage: Super Admin + HOD, Student self-update) ---
CREATE POLICY "students_read" ON public.students FOR SELECT TO public USING (true);
CREATE POLICY "students_manage" ON public.students FOR ALL TO authenticated
    USING (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) 
        OR (public.current_user_role() = 'student'::user_role AND id = public.current_user_student_id())
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) 
        OR (public.current_user_role() = 'student'::user_role AND id = public.current_user_student_id())
        OR auth.role() = 'service_role'
    );

-- --- E. TIMETABLE (Read: Public, Write: Super Admin & HOD Only — STRICTLY BLOCKED FOR STUDENTS) ---
CREATE POLICY "timetable_entries_read" ON public.timetable_entries FOR SELECT TO public USING (true);
CREATE POLICY "timetable_entries_manage" ON public.timetable_entries FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role');

CREATE POLICY "timetable_versions_read" ON public.timetable_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "timetable_versions_manage" ON public.timetable_versions FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role');

CREATE POLICY "timetable_imports_manage" ON public.timetable_imports FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role');

-- --- F. ATTENDANCE SESSIONS & RECORDS (Read: Authenticated, Write: Faculty, HOD, Super Admin — BLOCKED FOR STUDENTS) ---
CREATE POLICY "attendance_sessions_read" ON public.attendance_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_sessions_write" ON public.attendance_sessions FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role');

CREATE POLICY "attendance_records_read" ON public.attendance_records FOR SELECT TO authenticated
    USING (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
        OR student_id = public.current_user_student_id()
        OR auth.role() = 'service_role'
    );
CREATE POLICY "attendance_records_write" ON public.attendance_records FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role');

CREATE POLICY "attendance_corrections_read" ON public.attendance_corrections FOR SELECT TO authenticated
    USING (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
        OR student_id = public.current_user_student_id()
        OR auth.role() = 'service_role'
    );
CREATE POLICY "attendance_corrections_insert" ON public.attendance_corrections FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
        OR student_id = public.current_user_student_id()
        OR auth.role() = 'service_role'
    );
CREATE POLICY "attendance_corrections_update" ON public.attendance_corrections FOR UPDATE TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role');

-- --- G. SESSIONAL ASSESSMENTS & MARKS (Read: Authorized, Write: Faculty/HOD/Admin — STRICTLY BLOCKED FOR STUDENTS) ---
CREATE POLICY "sessional_assessments_read" ON public.sessional_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessional_assessments_manage" ON public.sessional_assessments FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role');

CREATE POLICY "sessional_marks_read" ON public.sessional_marks FOR SELECT TO authenticated
    USING (
        public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
        OR student_id = public.current_user_student_id()
        OR auth.role() = 'service_role'
    );
CREATE POLICY "sessional_marks_manage" ON public.sessional_marks FOR ALL TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role')
    WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role');

-- --- H. QUIZZES & ASSIGNMENTS ---
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quizzes') THEN
        CREATE POLICY "quizzes_read" ON public.quizzes FOR SELECT TO authenticated USING (true);
        CREATE POLICY "quizzes_manage" ON public.quizzes FOR ALL TO authenticated
            USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role')
            WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quiz_results') THEN
        CREATE POLICY "quiz_results_read" ON public.quiz_results FOR SELECT TO authenticated
            USING (
                public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
                OR student_id = public.current_user_student_id()
                OR auth.role() = 'service_role'
            );
        CREATE POLICY "quiz_results_write" ON public.quiz_results FOR ALL TO authenticated
            USING (
                public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
                OR student_id = public.current_user_student_id()
                OR auth.role() = 'service_role'
            )
            WITH CHECK (
                public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
                OR student_id = public.current_user_student_id()
                OR auth.role() = 'service_role'
            );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'course_assignments') THEN
        CREATE POLICY "course_assignments_read" ON public.course_assignments FOR SELECT TO authenticated USING (true);
        CREATE POLICY "course_assignments_manage" ON public.course_assignments FOR ALL TO authenticated
            USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role')
            WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'assignments') THEN
        CREATE POLICY "assignments_table_read" ON public.assignments FOR SELECT TO authenticated USING (true);
        CREATE POLICY "assignments_table_manage" ON public.assignments FOR ALL TO authenticated
            USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role')
            WITH CHECK (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role) OR auth.role() = 'service_role');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'assignment_submissions') THEN
        CREATE POLICY "assignment_submissions_read" ON public.assignment_submissions FOR SELECT TO authenticated
            USING (
                public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
                OR student_id = public.current_user_student_id()
                OR auth.role() = 'service_role'
            );
        CREATE POLICY "assignment_submissions_write" ON public.assignment_submissions FOR ALL TO authenticated
            USING (
                public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
                OR student_id = public.current_user_student_id()
                OR auth.role() = 'service_role'
            )
            WITH CHECK (
                public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role, 'faculty'::user_role)
                OR student_id = public.current_user_student_id()
                OR auth.role() = 'service_role'
            );
    END IF;
END $$;

-- --- I. PROFILES & AUDIT LOGS ---
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "profiles_manage" ON public.profiles FOR ALL TO authenticated
    USING (
        public.current_user_role() = 'super_admin'::user_role
        OR id = auth.uid()
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        public.current_user_role() = 'super_admin'::user_role
        OR id = auth.uid()
        OR auth.role() = 'service_role'
    );

CREATE POLICY "audit_logs_read" ON public.audit_logs FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role) OR auth.role() = 'service_role');
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (true);

-- 4. Harden delete_section_timetable RPC with Role Security
CREATE OR REPLACE FUNCTION public.delete_section_timetable(
    p_section_id UUID,
    p_deleted_by TEXT DEFAULT 'HOD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INT := 0;
    v_sec_name TEXT;
    v_caller_role user_role;
BEGIN
    -- Authorize caller
    IF auth.role() <> 'service_role' THEN
        v_caller_role := public.current_user_role();
        IF v_caller_role NOT IN ('super_admin'::user_role, 'hod'::user_role) THEN
            RAISE EXCEPTION 'Unauthorized: Only Super Admin or HOD can delete section timetables.';
        END IF;
    END IF;

    SELECT name INTO v_sec_name FROM public.sections WHERE id = p_section_id;
    IF v_sec_name IS NULL THEN
        RAISE EXCEPTION 'Section % does not exist.', p_section_id;
    END IF;

    -- Count existing entries
    SELECT COUNT(*) INTO v_deleted_count
    FROM public.timetable_entries
    WHERE section_id = p_section_id;

    -- Delete all entries for this section
    DELETE FROM public.timetable_entries
    WHERE section_id = p_section_id;

    -- Mark active versions as archived
    UPDATE public.timetable_versions
    SET status = 'archived', updated_at = NOW()
    WHERE section_id = p_section_id AND status = 'active';

    -- Deactivate all faculty subject assignments associated with this cleared section
    UPDATE public.faculty_subject_assignments
    SET active = false, updated_at = NOW()
    WHERE section_id = p_section_id;

    -- Audit log
    INSERT INTO public.audit_logs (
        action,
        actor_name,
        actor_role,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        'TIMETABLE_SECTION_DELETED',
        COALESCE(p_deleted_by, 'HOD'),
        'hod',
        'sections',
        p_section_id,
        jsonb_build_object(
            'section_id', p_section_id,
            'section_name', v_sec_name,
            'deleted_entries_count', v_deleted_count
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'section_id', p_section_id,
        'deleted_count', v_deleted_count
    );
END;
$$;

-- 5. Harden replace_section_timetable RPC with Role Security
CREATE OR REPLACE FUNCTION public.replace_section_timetable(
    p_department_id UUID,
    p_section_id UUID,
    p_entries JSONB,
    p_effective_from DATE DEFAULT CURRENT_DATE,
    p_source_type TEXT DEFAULT 'CSV_FILE_UPLOAD',
    p_source_url TEXT DEFAULT NULL,
    p_approved_by TEXT DEFAULT 'HOD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_version_id UUID;
    v_next_version INT := 1;
    v_slot_count INT := 0;
    v_entry JSONB;
    v_pair RECORD;
    v_default_classroom_id UUID;
    v_default_room TEXT := 'Room A-101';
    v_session_id UUID;
    v_caller_role user_role;
BEGIN
    -- Authorize caller
    IF auth.role() <> 'service_role' THEN
        v_caller_role := public.current_user_role();
        IF v_caller_role NOT IN ('super_admin'::user_role, 'hod'::user_role) THEN
            RAISE EXCEPTION 'Unauthorized: Only Super Admin or HOD can publish timetables.';
        END IF;
    END IF;

    -- Verify section exists
    IF NOT EXISTS (SELECT 1 FROM public.sections WHERE id = p_section_id) THEN
        RAISE EXCEPTION 'Section % does not exist.', p_section_id;
    END IF;

    -- Resolve default room and classroom_id for fallback
    SELECT room_number, classroom_id INTO v_default_room, v_default_classroom_id 
    FROM public.sections WHERE id = p_section_id;
    IF v_default_room IS NULL OR v_default_room = '' THEN
        v_default_room := 'Room A-101';
    END IF;

    -- Resolve current academic session
    SELECT id INTO v_session_id 
    FROM public.academic_sessions 
    WHERE is_current = true 
    LIMIT 1;

    -- Determine next version number for this section
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.timetable_versions
    WHERE section_id = p_section_id;

    -- Archive existing active versions
    UPDATE public.timetable_versions
    SET status = 'archived', updated_at = NOW()
    WHERE section_id = p_section_id AND status = 'active';

    -- Insert new active version snapshot
    INSERT INTO public.timetable_versions (
        id,
        department_id,
        section_id,
        version_number,
        effective_from,
        status,
        approved_by,
        approved_at,
        changes_summary,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        p_department_id,
        p_section_id,
        v_next_version,
        p_effective_from,
        'active',
        COALESCE(p_approved_by, 'HOD / Central Administrator'),
        NOW(),
        jsonb_build_object(
            'action', p_source_type,
            'source_type', p_source_type,
            'source_url', p_source_url,
            'total_slots', jsonb_array_length(p_entries),
            'effective_from', p_effective_from,
            'snapshot', p_entries
        ),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_version_id;

    -- Atomically delete old entries for this section
    DELETE FROM public.timetable_entries
    WHERE section_id = p_section_id;

    -- Insert entries
    IF jsonb_array_length(p_entries) > 0 THEN
        FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
        LOOP
            INSERT INTO public.timetable_entries (
                section_id,
                subject_id,
                faculty_id,
                day_of_week,
                period_number,
                start_time,
                end_time,
                room_number,
                lecture_type,
                classroom_id,
                active,
                created_at,
                updated_at
            ) VALUES (
                p_section_id,
                NULLIF(v_entry->>'subject_id', '')::UUID,
                NULLIF(v_entry->>'faculty_id', '')::UUID,
                (v_entry->>'day_of_week')::day_of_week_enum,
                (v_entry->>'period_number')::INT,
                (v_entry->>'start_time')::TIME,
                (v_entry->>'end_time')::TIME,
                COALESCE(v_entry->>'room_number', v_default_room),
                COALESCE((v_entry->>'lecture_type')::lecture_type, 'Theory'::lecture_type),
                COALESCE(
                  NULLIF(v_entry->>'classroom_id', '')::UUID,
                  (SELECT c.id FROM public.classrooms c WHERE c.room_number = COALESCE(v_entry->>'room_number', v_default_room) LIMIT 1),
                  v_default_classroom_id
                ),
                true,
                NOW(),
                NOW()
            );
            v_slot_count := v_slot_count + 1;
        END LOOP;
    END IF;

    -- Synchronize faculty_subject_assignments only for non-null pairs
    IF v_session_id IS NOT NULL AND jsonb_array_length(p_entries) > 0 THEN
        FOR v_pair IN 
            SELECT DISTINCT 
                NULLIF(elem->>'faculty_id', '')::UUID AS f_id,
                NULLIF(elem->>'subject_id', '')::UUID AS s_id
            FROM jsonb_array_elements(p_entries) elem
            WHERE NULLIF(elem->>'faculty_id', '') IS NOT NULL
              AND NULLIF(elem->>'subject_id', '') IS NOT NULL
        LOOP
            INSERT INTO public.faculty_subject_assignments (
                faculty_id,
                subject_id,
                section_id,
                academic_session_id,
                active
            ) VALUES (
                v_pair.f_id,
                v_pair.s_id,
                p_section_id,
                v_session_id,
                true
            )
            ON CONFLICT (faculty_id, subject_id, section_id, academic_session_id)
            DO UPDATE SET active = true, updated_at = NOW();
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'version_id', v_version_id,
        'version_number', v_next_version,
        'period_count', v_slot_count
    );
END;
$$;

-- 6. Provision Missing Section A for 3rd Year (5th Semester)
INSERT INTO public.sections (id, semester_id, name, room_number, active)
SELECT 
    'e982c5f1-3312-4c6f-a49b-71b55928d11c'::uuid,
    'f8341cca-7602-441d-b02b-316212e6b805'::uuid,
    'A',
    'Room A-301',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.sections 
    WHERE semester_id = 'f8341cca-7602-441d-b02b-316212e6b805' AND name = 'A'
);

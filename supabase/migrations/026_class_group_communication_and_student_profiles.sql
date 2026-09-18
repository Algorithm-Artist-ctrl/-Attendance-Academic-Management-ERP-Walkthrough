-- ============================================================================
-- VCTM ERP: MIGRATION 026
-- CLASS / SUBJECT GROUP COMMUNICATION & SECURE STUDENT PROFILE VIEW
-- ============================================================================

-- 1. ADD EXTENDED PROFILE COLUMNS TO STUDENTS TABLE (IF NOT EXISTS)
DO $$
BEGIN
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS father_name TEXT;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS father_contact_number TEXT;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_name TEXT;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_contact_number TEXT;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blood_group TEXT;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address TEXT;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. MESSAGE GROUPS TABLE (CLASS / SUBJECT COMBINATION)
CREATE TABLE IF NOT EXISTS public.message_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    created_by_faculty_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    allow_student_replies BOOLEAN NOT NULL DEFAULT false,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_class_group_combination UNIQUE (academic_year_id, section_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_message_groups_sec_sub ON public.message_groups(section_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_message_groups_year_sec ON public.message_groups(academic_year_id, section_id);
CREATE INDEX IF NOT EXISTS idx_message_groups_last_msg ON public.message_groups(last_message_at DESC);

-- 3. GROUP MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.message_groups(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('faculty', 'student', 'hod', 'super_admin')),
    sender_name TEXT NOT NULL,
    sender_avatar_url TEXT,
    title TEXT,
    message TEXT NOT NULL,
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created ON public.group_messages(group_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON public.group_messages(sender_user_id);

-- 4. GROUP MEMBER READ STATE (PER-USER READ TRACKING)
CREATE TABLE IF NOT EXISTS public.group_member_read_state (
    group_id UUID NOT NULL REFERENCES public.message_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_member_read_state_user ON public.group_member_read_state(user_id, group_id);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.message_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_member_read_state ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR MESSAGE GROUPS
DROP POLICY IF EXISTS "message_groups_select_policy" ON public.message_groups;
CREATE POLICY "message_groups_select_policy" ON public.message_groups
    FOR SELECT
    TO authenticated
    USING (
        -- Super Admin and HOD can see all groups in institution/department
        (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
        -- Faculty can see groups for sections and subjects they are assigned to
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.faculty_subject_assignments fsa ON fsa.faculty_id = p.faculty_id
            WHERE p.id = auth.uid()
              AND fsa.section_id = message_groups.section_id
              AND fsa.subject_id = message_groups.subject_id
              AND fsa.active = true
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.timetable_entries te ON te.faculty_id = p.faculty_id
            WHERE p.id = auth.uid()
              AND te.section_id = message_groups.section_id
              AND te.subject_id = message_groups.subject_id
              AND te.active = true
        )
        -- Students can see groups for their enrolled section and academic year
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.students s ON (s.id = p.student_id OR s.auth_user_id = auth.uid())
            WHERE (p.id = auth.uid() OR s.auth_user_id = auth.uid())
              AND s.section_id = message_groups.section_id
              AND s.academic_year_id = message_groups.academic_year_id
              AND s.active = true
        )
    );

DROP POLICY IF EXISTS "message_groups_insert_policy" ON public.message_groups;
CREATE POLICY "message_groups_insert_policy" ON public.message_groups
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.faculty_subject_assignments fsa ON fsa.faculty_id = p.faculty_id
            WHERE p.id = auth.uid()
              AND fsa.section_id = message_groups.section_id
              AND fsa.subject_id = message_groups.subject_id
              AND fsa.active = true
        )
    );

DROP POLICY IF EXISTS "message_groups_update_policy" ON public.message_groups;
CREATE POLICY "message_groups_update_policy" ON public.message_groups
    FOR UPDATE
    TO authenticated
    USING (
        (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.faculty_id = message_groups.created_by_faculty_id
        )
    );

-- 7. RLS POLICIES FOR GROUP MESSAGES
DROP POLICY IF EXISTS "group_messages_select_policy" ON public.group_messages;
CREATE POLICY "group_messages_select_policy" ON public.group_messages
    FOR SELECT
    TO authenticated
    USING (
        (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
        -- User must have access to parent message group
        OR EXISTS (
            SELECT 1 FROM public.message_groups mg
            WHERE mg.id = group_messages.group_id
              AND (
                  EXISTS (
                      SELECT 1 FROM public.profiles p
                      JOIN public.faculty_subject_assignments fsa ON fsa.faculty_id = p.faculty_id
                      WHERE p.id = auth.uid()
                        AND fsa.section_id = mg.section_id
                        AND fsa.subject_id = mg.subject_id
                        AND fsa.active = true
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.profiles p
                      JOIN public.timetable_entries te ON te.faculty_id = p.faculty_id
                      WHERE p.id = auth.uid()
                        AND te.section_id = mg.section_id
                        AND te.subject_id = mg.subject_id
                        AND te.active = true
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.profiles p
                      JOIN public.students s ON (s.id = p.student_id OR s.auth_user_id = auth.uid())
                      WHERE (p.id = auth.uid() OR s.auth_user_id = auth.uid())
                        AND s.section_id = mg.section_id
                        AND s.academic_year_id = mg.academic_year_id
                        AND s.active = true
                  )
              )
        )
    );

DROP POLICY IF EXISTS "group_messages_insert_policy" ON public.group_messages;
CREATE POLICY "group_messages_insert_policy" ON public.group_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_user_id = auth.uid()
        OR (auth.role() = 'service_role')
    );

-- 8. RLS POLICIES FOR GROUP MEMBER READ STATE
DROP POLICY IF EXISTS "group_member_read_state_all_policy" ON public.group_member_read_state;
CREATE POLICY "group_member_read_state_all_policy" ON public.group_member_read_state
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    )
    WITH CHECK (
        user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

-- 9. REPLICA IDENTITY & REALTIME PUBLICATION
ALTER TABLE public.message_groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_member_read_state REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'message_groups'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_groups;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'group_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'group_member_read_state'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_member_read_state;
    END IF;
END $$;

-- 10. SEED INITIAL MESSAGE GROUPS FROM EXISTING ACTIVE FACULTY SUBJECT ASSIGNMENTS
INSERT INTO public.message_groups (
    department_id,
    academic_year_id,
    section_id,
    subject_id,
    created_by_faculty_id,
    allow_student_replies,
    last_message_at,
    created_at,
    updated_at
)
SELECT DISTINCT ON (sem.academic_year_id, fsa.section_id, fsa.subject_id)
    COALESCE(fsa.department_id, sub.department_id),
    sem.academic_year_id,
    fsa.section_id,
    fsa.subject_id,
    fsa.faculty_id,
    false,
    now(),
    now(),
    now()
FROM public.faculty_subject_assignments fsa
JOIN public.subjects sub ON sub.id = fsa.subject_id
JOIN public.sections sec ON sec.id = fsa.section_id
JOIN public.semesters sem ON sem.id = sec.semester_id
WHERE fsa.active = true
ON CONFLICT (academic_year_id, section_id, subject_id) DO NOTHING;

-- 11. STORED PROCEDURE: send_group_message (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.send_group_message(
    p_academic_year_id UUID,
    p_section_id UUID,
    p_subject_id UUID,
    p_message TEXT,
    p_title TEXT DEFAULT NULL,
    p_attachment_url TEXT DEFAULT NULL,
    p_attachment_name TEXT DEFAULT NULL,
    p_attachment_type TEXT DEFAULT NULL,
    p_attachment_size INTEGER DEFAULT NULL,
    p_allow_student_replies BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT;
    v_faculty_id UUID;
    v_student_id UUID;
    v_group RECORD;
    v_dept_id UUID;
    v_new_msg RECORD;
    v_sender_name TEXT;
    v_sender_avatar TEXT;
    v_is_authorized BOOLEAN := false;
    v_subject RECORD;
    v_section RECORD;
    v_year RECORD;
    v_student_count INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_message IS NULL OR trim(p_message) = '' THEN
        RAISE EXCEPTION 'Message text cannot be empty.';
    END IF;

    -- Lookup user profile
    SELECT role::TEXT, full_name, avatar_url, faculty_id, student_id 
    INTO v_user_role, v_sender_name, v_sender_avatar, v_faculty_id, v_student_id
    FROM public.profiles 
    WHERE id = v_user_id;

    -- Lookup section and subject
    SELECT * INTO v_section FROM public.sections WHERE id = p_section_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Section not found: %', p_section_id;
    END IF;

    SELECT * INTO v_subject FROM public.subjects WHERE id = p_subject_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subject not found: %', p_subject_id;
    END IF;

    SELECT * INTO v_year FROM public.academic_years WHERE id = p_academic_year_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic Year not found: %', p_academic_year_id;
    END IF;

    v_dept_id := v_subject.department_id;

    -- STRICT AUTHORIZATION VALIDATION
    IF v_user_role = 'faculty' OR (v_faculty_id IS NOT NULL AND v_user_role NOT IN ('super_admin', 'hod')) THEN
        -- Verify faculty is actively assigned to this subject and section
        SELECT (
            EXISTS (
                SELECT 1 FROM public.faculty_subject_assignments fsa
                WHERE fsa.faculty_id = v_faculty_id
                  AND fsa.subject_id = p_subject_id
                  AND fsa.section_id = p_section_id
                  AND fsa.active = true
            )
            OR EXISTS (
                SELECT 1 FROM public.timetable_entries te
                WHERE te.faculty_id = v_faculty_id
                  AND te.subject_id = p_subject_id
                  AND te.section_id = p_section_id
                  AND te.active = true
            )
        ) INTO v_is_authorized;

        IF NOT v_is_authorized THEN
            RAISE EXCEPTION 'Authorization Error: You are not assigned to teach % in Section % (Year %).', 
                v_subject.subject_name, v_section.name, v_year.year_number;
        END IF;

    ELSIF v_user_role = 'student' OR (v_student_id IS NOT NULL AND v_user_role NOT IN ('super_admin', 'hod')) THEN
        -- Lookup student record
        DECLARE
            v_stu RECORD;
        BEGIN
            SELECT * INTO v_stu FROM public.students WHERE id = v_student_id OR auth_user_id = v_user_id LIMIT 1;
            IF v_stu IS NULL THEN
                RAISE EXCEPTION 'Student record not found.';
            END IF;

            -- Check enrollment in this section and year
            IF v_stu.section_id != p_section_id OR v_stu.academic_year_id != p_academic_year_id THEN
                RAISE EXCEPTION 'Authorization Error: You are not enrolled in Section % (Year %).', 
                    v_section.name, v_year.year_number;
            END IF;
            v_sender_name := v_stu.full_name;
        END;

    ELSIF v_user_role IN ('super_admin', 'hod') THEN
        v_is_authorized := true;
    ELSE
        RAISE EXCEPTION 'Unauthorized role: %', v_user_role;
    END IF;

    -- Lookup or auto-create canonical message group
    SELECT * INTO v_group 
    FROM public.message_groups
    WHERE academic_year_id = p_academic_year_id
      AND section_id = p_section_id
      AND subject_id = p_subject_id;

    IF NOT FOUND THEN
        -- Only Faculty, HOD, Super Admin can instantiate a new group
        IF v_user_role = 'student' THEN
            RAISE EXCEPTION 'Class group does not exist yet. Please wait for faculty to initialize it.';
        END IF;

        INSERT INTO public.message_groups (
            department_id,
            academic_year_id,
            section_id,
            subject_id,
            created_by_faculty_id,
            allow_student_replies,
            last_message_at,
            last_message_preview,
            created_at,
            updated_at
        ) VALUES (
            v_dept_id,
            p_academic_year_id,
            p_section_id,
            p_subject_id,
            v_faculty_id,
            COALESCE(p_allow_student_replies, false),
            now(),
            substring(trim(p_message) from 1 for 120),
            now(),
            now()
        ) RETURNING * INTO v_group;
    ELSE
        -- If student is sending, check if student replies are permitted
        IF v_user_role = 'student' AND NOT v_group.allow_student_replies THEN
            RAISE EXCEPTION 'Replies are disabled for this announcement group.';
        END IF;

        -- Update group settings if faculty/admin updated student replies toggle
        IF p_allow_student_replies IS NOT NULL AND v_user_role IN ('faculty', 'hod', 'super_admin') THEN
            UPDATE public.message_groups
            SET allow_student_replies = p_allow_student_replies,
                last_message_at = now(),
                last_message_preview = substring(trim(p_message) from 1 for 120),
                updated_at = now()
            WHERE id = v_group.id
            RETURNING * INTO v_group;
        ELSE
            UPDATE public.message_groups
            SET last_message_at = now(),
                last_message_preview = substring(trim(p_message) from 1 for 120),
                updated_at = now()
            WHERE id = v_group.id
            RETURNING * INTO v_group;
        END IF;
    END IF;

    -- INSERT GROUP MESSAGE
    INSERT INTO public.group_messages (
        group_id,
        sender_user_id,
        sender_role,
        sender_name,
        sender_avatar_url,
        title,
        message,
        attachment_url,
        attachment_name,
        attachment_type,
        attachment_size,
        created_at
    ) VALUES (
        v_group.id,
        v_user_id,
        v_user_role,
        COALESCE(v_sender_name, 'Faculty Member'),
        v_sender_avatar,
        NULLIF(trim(p_title), ''),
        trim(p_message),
        p_attachment_url,
        p_attachment_name,
        p_attachment_type,
        p_attachment_size,
        now()
    ) RETURNING * INTO v_new_msg;

    -- Update sender's read state to now()
    INSERT INTO public.group_member_read_state (
        group_id,
        user_id,
        last_read_at,
        updated_at
    ) VALUES (
        v_group.id,
        v_user_id,
        now(),
        now()
    )
    ON CONFLICT (group_id, user_id) 
    DO UPDATE SET last_read_at = now(), updated_at = now();

    -- DISPATCH IN-APP NOTIFICATIONS TO ALL ACTIVE ENROLLED STUDENTS IN SECTION
    -- Excludes sender (e.g. if student replied or faculty)
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
        COALESCE(p.id, s.auth_user_id) AS recipient_user_id,
        s.id AS recipient_student_id,
        'student' AS recipient_role,
        'NEW_MESSAGE' AS type,
        v_subject.subject_name || ' (' || v_section.name || '): ' || COALESCE(NULLIF(trim(p_title), ''), 'New Announcement') AS title,
        substring(trim(p_message) from 1 for 120) AS message,
        'group_message' AS reference_type,
        v_group.id AS reference_id,
        false AS is_read,
        now() AS created_at,
        now() AS updated_at
    FROM public.students s
    LEFT JOIN public.profiles p ON (p.student_id = s.id OR p.id = s.auth_user_id)
    WHERE s.section_id = v_group.section_id
      AND s.academic_year_id = v_group.academic_year_id
      AND s.active = true
      AND (COALESCE(p.id, s.auth_user_id) IS NOT NULL AND COALESCE(p.id, s.auth_user_id) != v_user_id);

    GET DIAGNOSTICS v_student_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'message_id', v_new_msg.id,
        'group_id', v_group.id,
        'notified_count', v_student_count,
        'created_at', v_new_msg.created_at
    );
END;
$$;

-- 12. STORED PROCEDURE: mark_group_as_read (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.mark_group_as_read(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Update user's last_read_at in group_member_read_state
    INSERT INTO public.group_member_read_state (
        group_id,
        user_id,
        last_read_at,
        updated_at
    ) VALUES (
        p_group_id,
        v_user_id,
        now(),
        now()
    )
    ON CONFLICT (group_id, user_id) 
    DO UPDATE SET last_read_at = now(), updated_at = now();

    -- Mark notifications for this group as read for this user
    UPDATE public.notifications
    SET is_read = true, updated_at = now()
    WHERE recipient_user_id = v_user_id
      AND reference_type = 'group_message'
      AND reference_id = p_group_id
      AND is_read = false;

    RETURN jsonb_build_object('success', true, 'group_id', p_group_id);
END;
$$;

-- 13. STORED PROCEDURE: get_group_members (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_group_members(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_group RECORD;
    v_user_role TEXT;
    v_faculty_id UUID;
    v_student_id UUID;
    v_is_authorized BOOLEAN := false;
    v_members JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_group FROM public.message_groups WHERE id = p_group_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Group not found.';
    END IF;

    SELECT role::TEXT, faculty_id, student_id INTO v_user_role, v_faculty_id, v_student_id 
    FROM public.profiles 
    WHERE id = v_user_id;

    -- Validate authorization to view group members
    IF v_user_role IN ('super_admin', 'hod') THEN
        v_is_authorized := true;
    ELSIF v_user_role = 'faculty' OR v_faculty_id IS NOT NULL THEN
        SELECT (
            EXISTS (
                SELECT 1 FROM public.faculty_subject_assignments fsa
                WHERE fsa.faculty_id = v_faculty_id
                  AND fsa.subject_id = v_group.subject_id
                  AND fsa.section_id = v_group.section_id
                  AND fsa.active = true
            )
            OR EXISTS (
                SELECT 1 FROM public.timetable_entries te
                WHERE te.faculty_id = v_faculty_id
                  AND te.subject_id = v_group.subject_id
                  AND te.section_id = v_group.section_id
                  AND te.active = true
            )
        ) INTO v_is_authorized;
    ELSIF v_user_role = 'student' OR v_student_id IS NOT NULL THEN
        SELECT (
            EXISTS (
                SELECT 1 FROM public.students s
                WHERE (s.id = v_student_id OR s.auth_user_id = v_user_id)
                  AND s.section_id = v_group.section_id
                  AND s.academic_year_id = v_group.academic_year_id
                  AND s.active = true
            )
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized to view members of this class group.';
    END IF;

    -- Query students enrolled in this section and academic year
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'roll_number', s.roll_number,
            'full_name', s.full_name,
            'email', CASE WHEN v_user_role IN ('faculty', 'hod', 'super_admin') THEN s.email ELSE NULL END,
            'phone', CASE WHEN v_user_role IN ('faculty', 'hod', 'super_admin') THEN s.phone ELSE NULL END,
            'admission_type', s.admission_type,
            'status', COALESCE(s.status, 'active'),
            'active', s.active,
            'section_name', sec.name,
            'year_number', ay.year_number
        ) ORDER BY s.roll_number ASC
    ) INTO v_members
    FROM public.students s
    JOIN public.sections sec ON sec.id = s.section_id
    JOIN public.academic_years ay ON ay.id = s.academic_year_id
    WHERE s.section_id = v_group.section_id
      AND s.academic_year_id = v_group.academic_year_id
      AND s.active = true;

    RETURN COALESCE(v_members, '[]'::jsonb);
END;
$$;

-- 14. STORED PROCEDURE: get_student_profile (SECURITY DEFINER WITH STRICT PRIVACY MATRIX)
CREATE OR REPLACE FUNCTION public.get_student_profile(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT;
    v_faculty_id UUID;
    v_caller_student_id UUID;
    v_student RECORD;
    v_sec RECORD;
    v_dept RECORD;
    v_year RECORD;
    v_prog RECORD;
    v_sem RECORD;
    v_mentor RECORD;
    v_coordinator RECORD;
    v_is_authorized BOOLEAN := false;
    v_total_sessions INTEGER := 0;
    v_attended_sessions INTEGER := 0;
    v_attendance_pct NUMERIC := 0.0;
    v_enrolled_subjects JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Lookup target student
    SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found: %', p_student_id;
    END IF;

    -- Lookup caller profile
    SELECT role::TEXT, faculty_id, student_id 
    INTO v_user_role, v_faculty_id, v_caller_student_id
    FROM public.profiles 
    WHERE id = v_user_id;

    -- -------------------------------------------------------------
    -- PRIVACY AUTHORIZATION MATRIX
    -- -------------------------------------------------------------
    IF v_user_role = 'super_admin' THEN
        v_is_authorized := true;

    ELSIF v_user_role = 'hod' THEN
        -- HOD is authorized if student belongs to their department
        SELECT EXISTS (
            SELECT 1 FROM public.departments d
            LEFT JOIN public.profiles p ON p.id = v_user_id
            WHERE d.id = v_student.department_id 
              AND (d.hod_faculty_id = v_faculty_id OR p.department_id = d.id)
        ) INTO v_is_authorized;

        IF NOT v_is_authorized THEN
            RAISE EXCEPTION 'Unauthorized: Student belongs to a different department.';
        END IF;

    ELSIF v_user_role = 'faculty' OR v_faculty_id IS NOT NULL THEN
        -- Faculty is authorized ONLY IF:
        -- 1. Teaches this student's section (via faculty_subject_assignments or timetable_entries)
        -- 2. Is Section Coordinator for this student's section
        -- 3. Is assigned mentor for this student
        SELECT (
            EXISTS (
                SELECT 1 FROM public.faculty_subject_assignments fsa
                WHERE fsa.faculty_id = v_faculty_id
                  AND fsa.section_id = v_student.section_id
                  AND fsa.active = true
            )
            OR EXISTS (
                SELECT 1 FROM public.timetable_entries te
                WHERE te.faculty_id = v_faculty_id
                  AND te.section_id = v_student.section_id
                  AND te.active = true
            )
            OR EXISTS (
                SELECT 1 FROM public.class_coordinator_assignments cca
                WHERE cca.faculty_id = v_faculty_id
                  AND cca.section_id = v_student.section_id
                  AND cca.active = true
            )
            OR EXISTS (
                SELECT 1 FROM public.sections sec
                WHERE sec.id = v_student.section_id
                  AND sec.class_coordinator_id = v_faculty_id
            )
            OR (v_student.mentor_faculty_id = v_faculty_id)
        ) INTO v_is_authorized;

        IF NOT v_is_authorized THEN
            RAISE EXCEPTION 'Unauthorized: You are not assigned to teach, coordinate, or mentor this student.';
        END IF;

    ELSIF v_user_role = 'student' OR v_caller_student_id IS NOT NULL THEN
        -- Students can ONLY view their OWN profile. Browsing peers is strictly forbidden.
        IF v_student.id = v_caller_student_id OR v_student.auth_user_id = v_user_id THEN
            v_is_authorized := true;
        ELSE
            RAISE EXCEPTION 'Unauthorized: Students are not permitted to view peer profiles.';
        END IF;

    ELSE
        RAISE EXCEPTION 'Access Denied: Unrecognized role %.', v_user_role;
    END IF;

    -- Lookup relational entities
    SELECT * INTO v_sec FROM public.sections WHERE id = v_student.section_id;
    SELECT * INTO v_dept FROM public.departments WHERE id = v_student.department_id;
    SELECT * INTO v_year FROM public.academic_years WHERE id = v_student.academic_year_id;
    SELECT * INTO v_prog FROM public.programs WHERE id = v_student.program_id;
    SELECT * INTO v_sem FROM public.semesters WHERE id = v_student.semester_id;
    SELECT * INTO v_mentor FROM public.faculty WHERE id = v_student.mentor_faculty_id;
    SELECT f.* INTO v_coordinator FROM public.faculty f WHERE f.id = v_sec.class_coordinator_id;

    -- Calculate attendance statistics
    SELECT count(*) INTO v_total_sessions
    FROM public.attendance_records ar
    WHERE ar.student_id = v_student.id;

    SELECT count(*) INTO v_attended_sessions
    FROM public.attendance_records ar
    WHERE ar.student_id = v_student.id AND ar.status::TEXT ILIKE 'present';

    IF v_total_sessions > 0 THEN
        v_attendance_pct := ROUND((v_attended_sessions::NUMERIC / v_total_sessions::NUMERIC) * 100, 1);
    ELSE
        v_attendance_pct := 0.0;
    END IF;

    -- Get enrolled subjects
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', sub.id,
            'subject_name', sub.subject_name,
            'subject_code', sub.subject_code,
            'faculty_name', f.full_name
        )
    ) INTO v_enrolled_subjects
    FROM public.faculty_subject_assignments fsa
    JOIN public.subjects sub ON sub.id = fsa.subject_id
    LEFT JOIN public.faculty f ON f.id = fsa.faculty_id
    WHERE fsa.section_id = v_student.section_id
      AND fsa.active = true;

    -- BUILD AUTHORIZED STUDENT PROFILE OBJECT
    RETURN jsonb_build_object(
        'id', v_student.id,
        'roll_number', v_student.roll_number,
        'admission_number', v_student.roll_number,
        'full_name', v_student.full_name,
        'admission_type', v_student.admission_type,
        'status', COALESCE(v_student.status, 'active'),
        'active', v_student.active,
        -- Sensitive contact info (only exposed to authorized faculty/HOD/admin or student self)
        'phone', v_student.phone,
        'email', v_student.email,
        'father_name', v_student.father_name,
        'father_contact_number', v_student.father_contact_number,
        'mother_name', v_student.mother_name,
        'mother_contact_number', v_student.mother_contact_number,
        'blood_group', v_student.blood_group,
        'address', v_student.address,
        -- Academic relations
        'department_name', COALESCE(v_dept.name, 'Department of Engineering'),
        'department_code', v_dept.code,
        'program_name', COALESCE(v_prog.name, 'B.Tech'),
        'year_number', COALESCE(v_year.year_number, 1),
        'year_name', v_year.name,
        'section_name', COALESCE(v_sec.name, 'A'),
        'room_number', v_sec.room_number,
        'semester_number', v_sem.semester_number,
        'mentor_name', v_mentor.full_name,
        'coordinator_name', v_coordinator.full_name,
        -- Academic Metrics
        'attendance_percentage', v_attendance_pct,
        'total_sessions', v_total_sessions,
        'attended_sessions', v_attended_sessions,
        'subjects', COALESCE(v_enrolled_subjects, '[]'::jsonb),
        'created_at', v_student.created_at
    );
END;
$$;

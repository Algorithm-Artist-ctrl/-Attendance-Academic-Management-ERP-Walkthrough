-- ============================================================================
-- VCTM ERP: MIGRATION 034
-- ADVANCED FACULTY COMMUNICATION CENTER
-- AUTOMATIC CLASS GROUPS, STRICT SUBJECT ISOLATION, LIVE REALTIME & ROSTER
-- ============================================================================

-- 1. FUNCTION & TRIGGERS: AUTOMATIC CLASS GROUP GENERATION
CREATE OR REPLACE FUNCTION public.auto_sync_message_group_from_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year_id UUID;
    v_dept_id UUID;
BEGIN
    IF NEW.active = true AND NEW.section_id IS NOT NULL AND NEW.subject_id IS NOT NULL THEN
        -- Resolve academic year from section's semester
        SELECT sem.academic_year_id INTO v_year_id
        FROM public.sections sec
        JOIN public.semesters sem ON sem.id = sec.semester_id
        WHERE sec.id = NEW.section_id;

        -- Resolve department
        SELECT department_id INTO v_dept_id
        FROM public.subjects
        WHERE id = NEW.subject_id;

        IF v_year_id IS NOT NULL AND v_dept_id IS NOT NULL THEN
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
            ) VALUES (
                v_dept_id,
                v_year_id,
                NEW.section_id,
                NEW.subject_id,
                NEW.faculty_id,
                false,
                now(),
                now(),
                now()
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_sync_message_group_assignment ON public.faculty_subject_assignments;
CREATE TRIGGER trg_auto_sync_message_group_assignment
    AFTER INSERT OR UPDATE ON public.faculty_subject_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_message_group_from_assignment();


CREATE OR REPLACE FUNCTION public.auto_sync_message_group_from_timetable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year_id UUID;
    v_dept_id UUID;
BEGIN
    IF NEW.active = true AND NEW.section_id IS NOT NULL AND NEW.subject_id IS NOT NULL THEN
        -- Resolve academic year from section's semester
        SELECT sem.academic_year_id INTO v_year_id
        FROM public.sections sec
        JOIN public.semesters sem ON sem.id = sec.semester_id
        WHERE sec.id = NEW.section_id;

        -- Resolve department
        SELECT department_id INTO v_dept_id
        FROM public.subjects
        WHERE id = NEW.subject_id;

        IF v_year_id IS NOT NULL AND v_dept_id IS NOT NULL THEN
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
            ) VALUES (
                v_dept_id,
                v_year_id,
                NEW.section_id,
                NEW.subject_id,
                NEW.faculty_id,
                false,
                now(),
                now(),
                now()
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_sync_message_group_timetable ON public.timetable_entries;
CREATE TRIGGER trg_auto_sync_message_group_timetable
    AFTER INSERT OR UPDATE ON public.timetable_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_message_group_from_timetable();


-- 2. STORED PROCEDURE: ensure_academic_message_groups (BATCH SYNC & BACKFILL)
CREATE OR REPLACE FUNCTION public.ensure_academic_message_groups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inserted_count INTEGER := 0;
BEGIN
    -- 1. Sync from active faculty subject assignments
    WITH new_groups AS (
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
        ON CONFLICT DO NOTHING
        RETURNING id
    )
    SELECT count(*) INTO v_inserted_count FROM new_groups;

    -- 2. Sync from active timetable entries
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
    SELECT DISTINCT ON (sem.academic_year_id, te.section_id, te.subject_id)
        sub.department_id,
        sem.academic_year_id,
        te.section_id,
        te.subject_id,
        te.faculty_id,
        false,
        now(),
        now(),
        now()
    FROM public.timetable_entries te
    JOIN public.subjects sub ON sub.id = te.subject_id
    JOIN public.sections sec ON sec.id = te.section_id
    JOIN public.semesters sem ON sem.id = sec.semester_id
    WHERE te.active = true AND te.subject_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'groups_created', v_inserted_count,
        'total_groups', (SELECT count(*) FROM public.message_groups)
    );
END;
$$;


-- 3. HARDENED ROW-LEVEL SECURITY FOR MESSAGE GROUPS (STRICT SUBJECT ISOLATION)
DROP POLICY IF EXISTS "message_groups_select_policy" ON public.message_groups;
CREATE POLICY "message_groups_select_policy" ON public.message_groups
    FOR SELECT
    TO authenticated
    USING (
        -- Service role can see all
        (auth.role() = 'service_role')
        -- Super Admin and HOD can see institution / department groups
        OR (current_user_role() = 'super_admin'::user_role)
        OR ((current_user_role() = 'hod'::user_role) AND (department_id = (SELECT p.department_id FROM public.profiles p WHERE p.id = auth.uid())))
        -- Faculty can only see groups for subjects and sections they are assigned to
        OR (
            EXISTS (
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
            -- Class coordinator can ONLY access general section announcements (subject_id IS NULL)
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                JOIN public.sections sec ON sec.class_coordinator_id = p.faculty_id
                WHERE p.id = auth.uid()
                  AND sec.id = message_groups.section_id
                  AND message_groups.subject_id IS NULL
            )
        )
        -- Students can only see groups for their enrolled section and academic year
        OR (
            EXISTS (
                SELECT 1 FROM public.students s
                WHERE ((s.auth_user_id = auth.uid()) OR (s.id = (SELECT p.student_id FROM public.profiles p WHERE p.id = auth.uid())))
                  AND s.section_id = message_groups.section_id
                  AND s.academic_year_id = message_groups.academic_year_id
                  AND s.active = true
                  AND (s.status = 'ACTIVE' OR s.status IS NULL)
            )
        )
    );


-- 4. HARDENED ROW-LEVEL SECURITY FOR GROUP MESSAGES
DROP POLICY IF EXISTS "group_messages_select_policy" ON public.group_messages;
CREATE POLICY "group_messages_select_policy" ON public.group_messages
    FOR SELECT
    TO authenticated
    USING (
        (auth.role() = 'service_role')
        OR (current_user_role() = 'super_admin'::user_role)
        OR ((current_user_role() = 'hod'::user_role) AND EXISTS (
            SELECT 1 FROM public.message_groups mg
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE mg.id = group_messages.group_id AND mg.department_id = p.department_id
        ))
        -- Scoped to parent message group permissions
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
                      JOIN public.sections sec ON sec.class_coordinator_id = p.faculty_id
                      WHERE p.id = auth.uid()
                        AND sec.id = mg.section_id
                        AND mg.subject_id IS NULL
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.students s
                      WHERE ((s.auth_user_id = auth.uid()) OR (s.id = (SELECT p.student_id FROM public.profiles p WHERE p.id = auth.uid())))
                        AND s.section_id = mg.section_id
                        AND s.academic_year_id = mg.academic_year_id
                        AND s.active = true
                        AND (s.status = 'ACTIVE' OR s.status IS NULL)
                  )
              )
        )
    );


-- 5. UPDATED STORED PROCEDURE: get_group_members (EXCLUDE ARCHIVED / DEPARTED STUDENTS)
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
                  AND (v_group.subject_id IS NULL OR fsa.subject_id = v_group.subject_id)
                  AND fsa.section_id = v_group.section_id
                  AND fsa.active = true
            )
            OR EXISTS (
                SELECT 1 FROM public.timetable_entries te
                WHERE te.faculty_id = v_faculty_id
                  AND (v_group.subject_id IS NULL OR te.subject_id = v_group.subject_id)
                  AND te.section_id = v_group.section_id
                  AND te.active = true
            )
            OR EXISTS (
                SELECT 1 FROM public.sections sec
                WHERE sec.class_coordinator_id = v_faculty_id
                  AND sec.id = v_group.section_id
                  AND v_group.subject_id IS NULL
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
                  AND (s.status = 'ACTIVE' OR s.status IS NULL)
            )
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized to view members of this class group.';
    END IF;

    -- Query students enrolled in this section and academic year
    -- Strictly excluding departed / archived / withdrawn students
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'roll_number', s.roll_number,
            'full_name', s.full_name,
            'email', CASE WHEN v_user_role IN ('faculty', 'hod', 'super_admin') THEN s.email ELSE NULL END,
            'phone', CASE WHEN v_user_role IN ('faculty', 'hod', 'super_admin') THEN s.phone ELSE NULL END,
            'admission_type', s.admission_type,
            'status', COALESCE(s.status, 'ACTIVE'),
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
      AND s.active = true
      AND (s.status = 'ACTIVE' OR s.status IS NULL);

    RETURN COALESCE(v_members, '[]'::jsonb);
END;
$$;


-- 6. ENSURE REPLICA IDENTITY & REALTIME PUBLICATION
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


-- 7. UPDATED STORED PROCEDURE: send_group_message (SUPPORTS BOTH SUBJECT GROUPS & SECTION ANNOUNCEMENTS)
CREATE OR REPLACE FUNCTION public.send_group_message(
    p_academic_year_id UUID,
    p_section_id UUID,
    p_subject_id UUID DEFAULT NULL,
    p_message TEXT DEFAULT '',
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
    v_notification_title TEXT;
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

    -- Lookup section and year
    SELECT * INTO v_section FROM public.sections WHERE id = p_section_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Section not found: %', p_section_id;
    END IF;

    SELECT * INTO v_year FROM public.academic_years WHERE id = p_academic_year_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic Year not found: %', p_academic_year_id;
    END IF;

    -- Lookup subject if specified
    IF p_subject_id IS NOT NULL THEN
        SELECT * INTO v_subject FROM public.subjects WHERE id = p_subject_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Subject not found: %', p_subject_id;
        END IF;
        v_dept_id := v_subject.department_id;
    ELSE
        -- Default department from section's semester or department
        SELECT sem.academic_year_id INTO v_dept_id
        FROM public.sections sec
        JOIN public.semesters sem ON sem.id = sec.semester_id
        WHERE sec.id = p_section_id;
        IF v_dept_id IS NULL THEN
            SELECT id INTO v_dept_id FROM public.departments LIMIT 1;
        END IF;
    END IF;

    -- STRICT AUTHORIZATION VALIDATION
    IF v_user_role = 'faculty' OR (v_faculty_id IS NOT NULL AND v_user_role NOT IN ('super_admin', 'hod')) THEN
        IF p_subject_id IS NOT NULL THEN
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
        ELSE
            -- Section-wide announcement: must be coordinator or teach in section
            SELECT (
                EXISTS (
                    SELECT 1 FROM public.sections sec
                    WHERE sec.id = p_section_id AND sec.class_coordinator_id = v_faculty_id
                )
                OR EXISTS (
                    SELECT 1 FROM public.faculty_subject_assignments fsa
                    WHERE fsa.faculty_id = v_faculty_id AND fsa.section_id = p_section_id AND fsa.active = true
                )
                OR EXISTS (
                    SELECT 1 FROM public.timetable_entries te
                    WHERE te.faculty_id = v_faculty_id AND te.section_id = p_section_id AND te.active = true
                )
            ) INTO v_is_authorized;

            IF NOT v_is_authorized THEN
                RAISE EXCEPTION 'Authorization Error: You are not authorized to broadcast to Section % (Year %).', 
                    v_section.name, v_year.year_number;
            END IF;
        END IF;

    ELSIF v_user_role = 'student' OR (v_student_id IS NOT NULL AND v_user_role NOT IN ('super_admin', 'hod')) THEN
        DECLARE
            v_stu RECORD;
        BEGIN
            SELECT * INTO v_stu FROM public.students WHERE id = v_student_id OR auth_user_id = v_user_id LIMIT 1;
            IF v_stu IS NULL THEN
                RAISE EXCEPTION 'Student record not found.';
            END IF;

            IF v_stu.section_id != p_section_id OR v_stu.academic_year_id != p_academic_year_id THEN
                RAISE EXCEPTION 'Authorization Error: You are not enrolled in Section % (Year %).', 
                    v_section.name, v_year.year_number;
            END IF;
            v_sender_name := v_stu.full_name;
            v_is_authorized := true;
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
      AND (
          (p_subject_id IS NOT NULL AND subject_id = p_subject_id)
          OR (p_subject_id IS NULL AND subject_id IS NULL)
      );

    IF NOT FOUND THEN
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
        IF v_user_role = 'student' AND NOT v_group.allow_student_replies THEN
            RAISE EXCEPTION 'Replies are disabled for this announcement group.';
        END IF;

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

    -- Title for student notifications
    IF p_subject_id IS NOT NULL THEN
        v_notification_title := v_subject.subject_name || ' (' || v_section.name || '): ' || COALESCE(NULLIF(trim(p_title), ''), 'New Announcement');
    ELSE
        v_notification_title := 'Section ' || v_section.name || ': ' || COALESCE(NULLIF(trim(p_title), ''), 'New Announcement');
    END IF;

    -- Dispatch in-app notifications
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
        v_notification_title AS title,
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
      AND (s.status = 'ACTIVE' OR s.status IS NULL)
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


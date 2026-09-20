-- ============================================================================
-- VCTM ERP: MIGRATION 040
-- STABILIZE GROUP MESSAGES, REAL-TIME ARCHITECTURE & CHAT CONTROLS
-- ============================================================================

-- 1. ADD EXTENDED COLUMNS TO GROUP_MESSAGES TABLE
DO $$
BEGIN
    ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
    ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
    ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS deleted_by_users UUID[] DEFAULT '{}';
    ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL;
    ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS client_message_id TEXT;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2. ADD CLEARED_AT TO GROUP_MEMBER_READ_STATE TABLE
DO $$
BEGIN
    ALTER TABLE public.group_member_read_state ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 3. CREATE PERFORMANCE & SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_group_messages_is_deleted ON public.group_messages(is_deleted);
CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to ON public.group_messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_deleted_by ON public.group_messages USING GIN (deleted_by_users);
CREATE INDEX IF NOT EXISTS idx_group_messages_client_id ON public.group_messages(client_message_id);
CREATE INDEX IF NOT EXISTS idx_group_member_read_state_cleared ON public.group_member_read_state(group_id, user_id, cleared_at);

-- 4. CONFIGURE REALTIME PUBLICATION & REPLICA IDENTITY
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_member_read_state REPLICA IDENTITY FULL;

DO $$
BEGIN
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

-- 5. UPDATE RLS POLICIES FOR GROUP_MESSAGES
-- Allow update for message author, or HOD / Super Admin moderators
DROP POLICY IF EXISTS group_messages_update_policy ON public.group_messages;
CREATE POLICY group_messages_update_policy ON public.group_messages
    FOR UPDATE
    TO authenticated
    USING (
        sender_user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    )
    WITH CHECK (
        sender_user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

-- 6. RPC FUNCTION: edit_group_message
CREATE OR REPLACE FUNCTION public.edit_group_message(
    p_message_id UUID,
    p_new_content TEXT,
    p_new_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_msg RECORD;
    v_clean_content TEXT := trim(COALESCE(p_new_content, ''));
    v_clean_title TEXT := trim(COALESCE(p_new_title, ''));
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF v_clean_content = '' THEN
        RAISE EXCEPTION 'Message content cannot be empty.';
    END IF;

    SELECT * INTO v_msg FROM public.group_messages WHERE id = p_message_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Group message not found: %', p_message_id;
    END IF;

    IF v_msg.sender_user_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only edit your own messages.';
    END IF;

    IF v_msg.is_deleted THEN
        RAISE EXCEPTION 'Cannot edit a deleted message.';
    END IF;

    UPDATE public.group_messages
    SET message = v_clean_content,
        title = CASE WHEN v_clean_title != '' THEN v_clean_title ELSE title END,
        edited_at = now()
    WHERE id = p_message_id
    RETURNING * INTO v_msg;

    -- Update group last message preview if it was the latest
    UPDATE public.message_groups
    SET last_message_preview = substring(v_clean_content from 1 for 120),
        updated_at = now()
    WHERE id = v_msg.group_id
      AND last_message_at <= v_msg.created_at;

    RETURN to_jsonb(v_msg);
END;
$$;

-- 7. RPC FUNCTION: delete_group_message (SOFT DELETE)
CREATE OR REPLACE FUNCTION public.delete_group_message(
    p_message_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT;
    v_msg RECORD;
    v_group RECORD;
    v_is_authorized BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_msg FROM public.group_messages WHERE id = p_message_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Group message not found: %', p_message_id;
    END IF;

    SELECT role::TEXT INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- Authorization check: author OR super_admin / hod OR class coordinator
    IF v_msg.sender_user_id = v_user_id THEN
        v_is_authorized := true;
    ELSIF v_user_role IN ('super_admin', 'hod') THEN
        v_is_authorized := true;
    ELSE
        SELECT * INTO v_group FROM public.message_groups WHERE id = v_msg.group_id;
        IF FOUND THEN
            -- Check if user is the assigned faculty or coordinator
            IF EXISTS (
                SELECT 1 FROM public.sections sec
                JOIN public.profiles p ON p.faculty_id = sec.class_coordinator_id
                WHERE sec.id = v_group.section_id AND p.id = v_user_id
            ) THEN
                v_is_authorized := true;
            END IF;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to delete this message.';
    END IF;

    IF v_msg.is_deleted THEN
        RETURN to_jsonb(v_msg);
    END IF;

    UPDATE public.group_messages
    SET message = 'Message deleted',
        title = NULL,
        is_deleted = true,
        deleted_at = now(),
        attachment_url = NULL,
        attachment_name = NULL,
        attachment_type = NULL,
        attachment_size = NULL
    WHERE id = p_message_id
    RETURNING * INTO v_msg;

    -- Update group last message preview if it was the latest
    UPDATE public.message_groups
    SET last_message_preview = 'Message deleted',
        updated_at = now()
    WHERE id = v_msg.group_id
      AND last_message_at <= v_msg.created_at;

    RETURN to_jsonb(v_msg);
END;
$$;

-- 8. RPC FUNCTION: clear_group_chat_for_me
CREATE OR REPLACE FUNCTION public.clear_group_chat_for_me(
    p_group_id UUID
)
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

    INSERT INTO public.group_member_read_state (
        group_id,
        user_id,
        last_read_at,
        cleared_at,
        updated_at
    ) VALUES (
        p_group_id,
        v_user_id,
        now(),
        now(),
        now()
    )
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET 
        last_read_at = now(),
        cleared_at = now(),
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true, 
        'group_id', p_group_id, 
        'cleared_at', now()
    );
END;
$$;

-- 9. RPC FUNCTION: delete_group_message_for_me
CREATE OR REPLACE FUNCTION public.delete_group_message_for_me(
    p_message_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_msg RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_msg FROM public.group_messages WHERE id = p_message_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;

    UPDATE public.group_messages
    SET deleted_by_users = array_append(COALESCE(deleted_by_users, '{}'), v_user_id)
    WHERE id = p_message_id
      AND NOT (v_user_id = ANY(COALESCE(deleted_by_users, '{}')));

    RETURN jsonb_build_object('success', true, 'message_id', p_message_id);
END;
$$;

-- 10. UPDATE send_group_message RPC TO ACCEPT OPTIONAL p_reply_to_message_id & p_client_message_id
CREATE OR REPLACE FUNCTION public.send_group_message(
    p_academic_year_id uuid, 
    p_section_id uuid, 
    p_subject_id uuid DEFAULT NULL, 
    p_message text DEFAULT NULL, 
    p_title text DEFAULT NULL::text, 
    p_attachment_url text DEFAULT NULL::text, 
    p_attachment_name text DEFAULT NULL::text, 
    p_attachment_type text DEFAULT NULL::text, 
    p_attachment_size integer DEFAULT NULL::integer, 
    p_allow_student_replies boolean DEFAULT NULL::boolean,
    p_reply_to_message_id uuid DEFAULT NULL::uuid,
    p_client_message_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
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
    v_prog_id UUID;
    v_notification_title TEXT;
    v_reply_msg RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_message IS NULL OR trim(p_message) = '' THEN
        RAISE EXCEPTION 'Message text cannot be empty.';
    END IF;

    -- Idempotency check: if client_message_id already exists, return existing message
    IF p_client_message_id IS NOT NULL AND trim(p_client_message_id) != '' THEN
        SELECT * INTO v_new_msg FROM public.group_messages 
        WHERE client_message_id = trim(p_client_message_id) AND sender_user_id = v_user_id;
        IF FOUND THEN
            RETURN to_jsonb(v_new_msg);
        END IF;
    END IF;

    -- Lookup user profile
    SELECT role::TEXT, full_name, avatar_url, faculty_id, student_id 
    INTO v_user_role, v_sender_name, v_sender_avatar, v_faculty_id, v_student_id
    FROM public.profiles 
    WHERE id = v_user_id;

    -- Lookup section
    SELECT * INTO v_section FROM public.sections WHERE id = p_section_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Section not found: %', p_section_id;
    END IF;

    -- Lookup year
    SELECT * INTO v_year FROM public.academic_years WHERE id = p_academic_year_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic Year not found: %', p_academic_year_id;
    END IF;

    -- Lookup subject (if provided)
    IF p_subject_id IS NOT NULL THEN
        SELECT * INTO v_subject FROM public.subjects WHERE id = p_subject_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Subject not found: %', p_subject_id;
        END IF;
        v_dept_id := v_subject.department_id;
    ELSE
        -- Resolve department from academic year -> program
        SELECT program_id INTO v_prog_id FROM public.academic_years WHERE id = p_academic_year_id;
        SELECT department_id INTO v_dept_id FROM public.programs WHERE id = v_prog_id;
        IF v_dept_id IS NULL THEN
            SELECT department_id INTO v_dept_id FROM public.departments LIMIT 1;
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
                OR (v_section.class_coordinator_id = v_faculty_id)
            ) INTO v_is_authorized;

            IF NOT v_is_authorized THEN
                RAISE EXCEPTION 'Authorization Error: You are not assigned to teach % in Section % (Year %).', 
                    v_subject.subject_name, v_section.name, v_year.name;
            END IF;
        ELSE
            SELECT (
                EXISTS (
                    SELECT 1 FROM public.faculty_subject_assignments fsa
                    WHERE fsa.faculty_id = v_faculty_id
                      AND fsa.section_id = p_section_id
                      AND fsa.active = true
                )
                OR EXISTS (
                    SELECT 1 FROM public.timetable_entries te
                    WHERE te.faculty_id = v_faculty_id
                      AND te.section_id = p_section_id
                      AND te.active = true
                )
                OR (v_section.class_coordinator_id = v_faculty_id)
            ) INTO v_is_authorized;

            IF NOT v_is_authorized THEN
                RAISE EXCEPTION 'Authorization Error: You are not assigned to teach any subject or coordinate Section % (Year %).', 
                    v_section.name, v_year.name;
            END IF;
        END IF;
    ELSIF v_user_role = 'student' THEN
        SELECT (
            EXISTS (
                SELECT 1 FROM public.students s
                WHERE (s.id = v_student_id OR s.auth_user_id = v_user_id)
                  AND s.section_id = p_section_id
                  AND s.academic_year_id = p_academic_year_id
                  AND s.active = true
            )
        ) INTO v_is_authorized;

        IF NOT v_is_authorized THEN
            RAISE EXCEPTION 'You can only post messages to announcement groups of your enrolled class.';
        END IF;
    ELSIF v_user_role IN ('super_admin', 'hod') THEN
        v_is_authorized := true;
    END IF;

    -- FIND OR CREATE MESSAGE GROUP
    IF p_subject_id IS NOT NULL THEN
        SELECT * INTO v_group
        FROM public.message_groups
        WHERE academic_year_id = p_academic_year_id
          AND section_id = p_section_id
          AND subject_id = p_subject_id;
    ELSE
        SELECT * INTO v_group
        FROM public.message_groups
        WHERE academic_year_id = p_academic_year_id
          AND section_id = p_section_id
          AND subject_id IS NULL;
    END IF;

    IF v_group.id IS NULL THEN
        IF v_user_role = 'student' THEN
            RAISE EXCEPTION 'Students cannot create new message groups.';
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

    -- Validate parent reply message if supplied
    IF p_reply_to_message_id IS NOT NULL THEN
        SELECT * INTO v_reply_msg FROM public.group_messages
        WHERE id = p_reply_to_message_id AND group_id = v_group.id;
        IF NOT FOUND THEN
            p_reply_to_message_id := NULL;
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
        reply_to_message_id,
        client_message_id,
        created_at
    ) VALUES (
        v_group.id,
        v_user_id,
        v_user_role,
        COALESCE(v_sender_name, 'User'),
        v_sender_avatar,
        NULLIF(trim(p_title), ''),
        trim(p_message),
        p_attachment_url,
        p_attachment_name,
        p_attachment_type,
        p_attachment_size,
        p_reply_to_message_id,
        NULLIF(trim(p_client_message_id), ''),
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

    -- PREPARE NOTIFICATION TITLE
    IF p_subject_id IS NOT NULL THEN
        v_notification_title := v_subject.subject_name || ' (' || v_section.name || '): ' || COALESCE(NULLIF(trim(p_title), ''), 'New Announcement');
    ELSE
        v_notification_title := 'Section ' || v_section.name || ': ' || COALESCE(NULLIF(trim(p_title), ''), 'Class Announcement');
    END IF;

    -- CREATE IN-APP NOTIFICATIONS FOR ENROLLED STUDENTS
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
        'NEW_MESSAGE',
        v_notification_title,
        substring(trim(p_message) from 1 for 100),
        'message_group',
        v_group.id,
        false,
        now(),
        now()
    FROM public.students s
    WHERE s.section_id = p_section_id
      AND s.academic_year_id = p_academic_year_id
      AND s.active = true
      AND s.auth_user_id IS NOT NULL
      AND s.auth_user_id != v_user_id;

    RETURN to_jsonb(v_new_msg);
END;
$function$;

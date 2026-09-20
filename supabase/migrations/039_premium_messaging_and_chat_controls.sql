-- ============================================================================
-- VCTM ERP: MIGRATION 039
-- PREMIUM REAL-TIME MESSAGING, CHAT CONTROLS & PER-USER RETENTION SYSTEM
-- ============================================================================

-- 1. ADD EXTENDED COLUMNS TO MESSAGES TABLE
DO $$
BEGIN
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_unsent BOOLEAN DEFAULT false;
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS unsent_at TIMESTAMPTZ;
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_by_users UUID[] DEFAULT '{}';
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_by ON public.messages USING GIN (deleted_by_users);

-- 2. CREATE CONVERSATION_USER_SETTINGS TABLE (PER-USER CLEAR & UNREAD STATUS)
CREATE TABLE IF NOT EXISTS public.conversation_user_settings (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cleared_at TIMESTAMPTZ,
    marked_unread BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_user_settings_user ON public.conversation_user_settings(user_id, conversation_id);

-- 3. ENABLE RLS AND POLICIES FOR CONVERSATION_USER_SETTINGS
ALTER TABLE public.conversation_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_user_settings_all" ON public.conversation_user_settings;
CREATE POLICY "conversation_user_settings_all" ON public.conversation_user_settings
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR auth.role() = 'service_role')
    WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

-- 4. ENABLE REALTIME PUBLICATION FOR CONVERSATION_USER_SETTINGS
ALTER TABLE public.conversation_user_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_user_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_user_settings;
    END IF;
END $$;

-- 5. UPDATE RLS POLICY FOR MESSAGES TO PERMIT SENDER EDIT/UNSEND & BOTH PARTICIPANTS DELETE-FOR-ME
DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;
CREATE POLICY "messages_update_policy" ON public.messages
    FOR UPDATE
    TO authenticated
    USING (
        sender_user_id = auth.uid()
        OR receiver_user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    )
    WITH CHECK (
        sender_user_id = auth.uid()
        OR receiver_user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

-- 6. RPC FUNCTION: edit_message
CREATE OR REPLACE FUNCTION public.edit_message(
    p_message_id UUID,
    p_new_content TEXT
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
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF v_clean_content = '' THEN
        RAISE EXCEPTION 'Message content cannot be empty.';
    END IF;

    SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;

    IF v_msg.sender_user_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only edit your own messages.';
    END IF;

    IF v_msg.is_unsent THEN
        RAISE EXCEPTION 'Cannot edit an unsent message.';
    END IF;

    UPDATE public.messages
    SET message = v_clean_content,
        edited_at = now()
    WHERE id = p_message_id
    RETURNING * INTO v_msg;

    -- Update conversation preview if it's the latest message
    UPDATE public.conversations
    SET last_message_preview = substring(v_clean_content from 1 for 120),
        updated_at = now()
    WHERE id = v_msg.conversation_id
      AND last_message_at <= v_msg.created_at;

    RETURN to_jsonb(v_msg);
END;
$$;

-- 7. RPC FUNCTION: unsend_message
CREATE OR REPLACE FUNCTION public.unsend_message(
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

    SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;

    IF v_msg.sender_user_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only unsend your own messages.';
    END IF;

    IF v_msg.is_unsent THEN
        RETURN to_jsonb(v_msg);
    END IF;

    UPDATE public.messages
    SET message = 'Message unsent',
        is_unsent = true,
        unsent_at = now(),
        attachment_url = NULL,
        attachment_name = NULL,
        attachment_type = NULL,
        attachment_size = NULL
    WHERE id = p_message_id
    RETURNING * INTO v_msg;

    -- Update conversation preview if it's the latest message
    UPDATE public.conversations
    SET last_message_preview = 'Message unsent',
        updated_at = now()
    WHERE id = v_msg.conversation_id
      AND last_message_at <= v_msg.created_at;

    RETURN to_jsonb(v_msg);
END;
$$;

-- 8. RPC FUNCTION: delete_message_for_me
CREATE OR REPLACE FUNCTION public.delete_message_for_me(
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

    SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;

    IF v_msg.sender_user_id != v_user_id AND v_msg.receiver_user_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: You are not a participant in this conversation.';
    END IF;

    UPDATE public.messages
    SET deleted_by_users = array_append(COALESCE(deleted_by_users, '{}'), v_user_id)
    WHERE id = p_message_id
      AND NOT (v_user_id = ANY(COALESCE(deleted_by_users, '{}')));

    RETURN jsonb_build_object('success', true, 'message_id', p_message_id);
END;
$$;

-- 9. RPC FUNCTION: clear_conversation_for_me
CREATE OR REPLACE FUNCTION public.clear_conversation_for_me(
    p_conversation_id UUID
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

    -- Upsert conversation_user_settings with cleared_at
    INSERT INTO public.conversation_user_settings (
        conversation_id,
        user_id,
        cleared_at,
        marked_unread,
        updated_at
    ) VALUES (
        p_conversation_id,
        v_user_id,
        now(),
        false,
        now()
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET 
        cleared_at = now(),
        marked_unread = false,
        updated_at = now();

    -- Mark received messages as read
    UPDATE public.messages
    SET read_at = now()
    WHERE conversation_id = p_conversation_id
      AND receiver_user_id = v_user_id
      AND read_at IS NULL;

    -- Mark associated notifications as read
    UPDATE public.notifications
    SET is_read = true,
        read_at = now(),
        updated_at = now()
    WHERE recipient_user_id = v_user_id
      AND reference_type = 'conversation'
      AND reference_id = p_conversation_id
      AND is_read = false;

    RETURN jsonb_build_object('success', true, 'conversation_id', p_conversation_id, 'cleared_at', now());
END;
$$;

-- 10. RPC FUNCTION: mark_conversation_unread
CREATE OR REPLACE FUNCTION public.mark_conversation_unread(
    p_conversation_id UUID
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

    INSERT INTO public.conversation_user_settings (
        conversation_id,
        user_id,
        marked_unread,
        updated_at
    ) VALUES (
        p_conversation_id,
        v_user_id,
        true,
        now()
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET 
        marked_unread = true,
        updated_at = now();

    RETURN jsonb_build_object('success', true, 'conversation_id', p_conversation_id, 'marked_unread', true);
END;
$$;

-- 11. UPDATE send_message RPC TO ACCEPT OPTIONAL p_reply_to_message_id
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_message TEXT,
    p_attachment_url TEXT DEFAULT NULL,
    p_attachment_name TEXT DEFAULT NULL,
    p_attachment_type TEXT DEFAULT NULL,
    p_attachment_size INTEGER DEFAULT NULL,
    p_reply_to_message_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT;
    v_conv RECORD;
    v_receiver_user_id UUID;
    v_student RECORD;
    v_faculty RECORD;
    v_sender_role TEXT;
    v_new_msg RECORD;
    v_sender_name TEXT;
    v_subject_name TEXT;
    v_reply_msg RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_message IS NULL OR trim(p_message) = '' THEN
        RAISE EXCEPTION 'Message content cannot be empty.';
    END IF;

    -- Lookup conversation
    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    SELECT role::TEXT INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- Lookup student and faculty records
    SELECT s.*, COALESCE(u.id, s.auth_user_id) as user_auth_id INTO v_student
    FROM public.students s
    LEFT JOIN public.profiles u ON (u.student_id = s.id OR u.id = s.auth_user_id)
    WHERE s.id = v_conv.student_id
    LIMIT 1;

    SELECT f.*, COALESCE(u.id, f.auth_user_id) as user_auth_id INTO v_faculty
    FROM public.faculty f
    LEFT JOIN public.profiles u ON (u.faculty_id = f.id OR u.id = f.auth_user_id)
    WHERE f.id = v_conv.faculty_id
    LIMIT 1;

    -- Determine sender role and receiver user ID
    IF v_student.user_auth_id = v_user_id OR v_student.id = v_user_id THEN
        v_sender_role := 'student';
        v_receiver_user_id := v_faculty.user_auth_id;
        v_sender_name := v_student.full_name;
    ELSIF v_faculty.user_auth_id = v_user_id THEN
        v_sender_role := 'faculty';
        v_receiver_user_id := v_student.user_auth_id;
        v_sender_name := v_faculty.full_name;
    ELSIF v_user_role IN ('super_admin', 'hod') THEN
        v_sender_role := v_user_role;
        v_receiver_user_id := v_student.user_auth_id;
        SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = v_user_id;
    ELSE
        RAISE EXCEPTION 'You are not authorized to send messages in this conversation.';
    END IF;

    -- If replying to message, verify parent message exists in same conversation
    IF p_reply_to_message_id IS NOT NULL THEN
        SELECT * INTO v_reply_msg FROM public.messages 
        WHERE id = p_reply_to_message_id AND conversation_id = p_conversation_id;
        IF NOT FOUND THEN
            p_reply_to_message_id := NULL;
        END IF;
    END IF;

    -- Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_user_id,
        receiver_user_id,
        student_id,
        faculty_id,
        subject_id,
        sender_role,
        message,
        attachment_url,
        attachment_name,
        attachment_type,
        attachment_size,
        reply_to_message_id,
        created_at
    ) VALUES (
        p_conversation_id,
        v_user_id,
        v_receiver_user_id,
        v_conv.student_id,
        v_conv.faculty_id,
        v_conv.subject_id,
        v_sender_role,
        trim(p_message),
        p_attachment_url,
        p_attachment_name,
        p_attachment_type,
        p_attachment_size,
        p_reply_to_message_id,
        now()
    ) RETURNING * INTO v_new_msg;

    -- Update conversation last_message_at and preview
    UPDATE public.conversations
    SET last_message_at = now(),
        last_message_preview = substring(trim(p_message) from 1 for 120),
        status = CASE 
            WHEN v_sender_role IN ('faculty', 'hod', 'super_admin') AND status = 'OPEN' THEN 'IN_PROGRESS' 
            ELSE status 
        END,
        updated_at = now()
    WHERE id = p_conversation_id;

    -- Reset sender's marked_unread in conversation_user_settings
    INSERT INTO public.conversation_user_settings (
        conversation_id,
        user_id,
        marked_unread,
        updated_at
    ) VALUES (
        p_conversation_id,
        v_user_id,
        false,
        now()
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET marked_unread = false, updated_at = now();

    -- Lookup subject name for notification
    IF v_conv.subject_id IS NOT NULL THEN
        SELECT subject_name INTO v_subject_name FROM public.subjects WHERE id = v_conv.subject_id;
    END IF;

    -- Create notification for receiver
    IF v_receiver_user_id IS NOT NULL THEN
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
        ) VALUES (
            v_receiver_user_id,
            CASE WHEN v_sender_role = 'faculty' THEN v_conv.student_id ELSE NULL END,
            CASE WHEN v_sender_role = 'student' THEN 'faculty' ELSE 'student' END,
            'NEW_MESSAGE',
            'New message from ' || COALESCE(v_sender_name, 'User'),
            COALESCE(v_subject_name, 'Discussion') || ': ' || substring(trim(p_message) from 1 for 80),
            'conversation',
            p_conversation_id,
            false,
            now(),
            now()
        );
    END IF;

    RETURN to_jsonb(v_new_msg);
END;
$$;

-- 12. UPDATE mark_conversation_read RPC
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
    p_conversation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Mark received messages in conversation as read
    UPDATE public.messages
    SET read_at = now()
    WHERE conversation_id = p_conversation_id
      AND receiver_user_id = v_user_id
      AND read_at IS NULL;

    -- Reset per-user marked_unread setting
    INSERT INTO public.conversation_user_settings (
        conversation_id,
        user_id,
        marked_unread,
        updated_at
    ) VALUES (
        p_conversation_id,
        v_user_id,
        false,
        now()
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET marked_unread = false, updated_at = now();

    -- Mark corresponding notifications as read
    UPDATE public.notifications
    SET is_read = true,
        read_at = now(),
        updated_at = now()
    WHERE recipient_user_id = v_user_id
      AND reference_type = 'conversation'
      AND reference_id = p_conversation_id
      AND is_read = false;
END;
$$;

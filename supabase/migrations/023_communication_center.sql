-- ============================================================================
-- VCTM ERP: COMMUNICATION CENTER / REAL-TIME MESSAGE BOX MIGRATION
-- ============================================================================

-- 0. EXPAND NOTIFICATIONS TYPE CHECK CONSTRAINT TO INCLUDE NEW MESSAGE TYPES
DO $$
BEGIN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'MARKS_PUBLISHED',
        'MARKS_UPDATED',
        'ASSIGNMENT_POSTED',
        'ASSIGNMENT_UPDATED',
        'QUIZ_POSTED',
        'QUIZ_GRADED',
        'ATTENDANCE_CLAIM',
        'ATTENDANCE_UPDATE',
        'TIMETABLE_UPDATE',
        'NOTICE',
        'ACCOUNT_UPDATE',
        'NEW_MESSAGE',
        'ISSUE_STATUS_UPDATE',
        'GENERAL'
    ));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 1. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'General' CHECK (category IN ('General', 'Attendance', 'Timetable', 'Assignment', 'Subject', 'Class', 'Other')),
    subject_topic TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_student_faculty_subject UNIQUE (student_id, faculty_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_student ON public.conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_conversations_faculty ON public.conversations(faculty_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);

-- 2. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'faculty', 'hod', 'super_admin')),
    message TEXT NOT NULL,
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_size INTEGER,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages(receiver_user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR CONVERSATIONS
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
CREATE POLICY "conversations_select_policy" ON public.conversations
    FOR SELECT
    TO authenticated
    USING (
        student_id = (SELECT p.student_id FROM public.profiles p WHERE p.id = auth.uid())
        OR faculty_id = (SELECT p.faculty_id FROM public.profiles p WHERE p.id = auth.uid())
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
CREATE POLICY "conversations_insert_policy" ON public.conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        student_id = (SELECT p.student_id FROM public.profiles p WHERE p.id = auth.uid())
        OR faculty_id = (SELECT p.faculty_id FROM public.profiles p WHERE p.id = auth.uid())
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;
CREATE POLICY "conversations_update_policy" ON public.conversations
    FOR UPDATE
    TO authenticated
    USING (
        student_id = (SELECT p.student_id FROM public.profiles p WHERE p.id = auth.uid())
        OR faculty_id = (SELECT p.faculty_id FROM public.profiles p WHERE p.id = auth.uid())
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

-- 5. RLS POLICIES FOR MESSAGES
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
CREATE POLICY "messages_select_policy" ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        sender_user_id = auth.uid()
        OR receiver_user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
CREATE POLICY "messages_insert_policy" ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;
CREATE POLICY "messages_update_policy" ON public.messages
    FOR UPDATE
    TO authenticated
    USING (
        receiver_user_id = auth.uid()
        OR (current_user_role() = ANY (ARRAY['super_admin'::user_role, 'hod'::user_role]))
        OR (auth.role() = 'service_role')
    );

-- 6. REPLICA IDENTITY & REALTIME PUBLICATION
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- 7. FUNCTION: get_or_create_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
    p_faculty_id UUID,
    p_subject_id UUID,
    p_category TEXT DEFAULT 'General',
    p_topic TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role TEXT;
    v_student RECORD;
    v_faculty RECORD;
    v_subject RECORD;
    v_conversation RECORD;
    v_is_assigned BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_user_id;

    -- If caller is student:
    IF v_role = 'student' OR v_role IS NULL THEN
        SELECT s.* INTO v_student 
        FROM public.students s 
        LEFT JOIN public.profiles p ON p.student_id = s.id
        WHERE s.auth_user_id = v_user_id OR p.id = v_user_id OR s.id = v_user_id
        LIMIT 1;

        IF v_student IS NULL THEN
            RAISE EXCEPTION 'Student record not found for active user.';
        END IF;

        -- Verify faculty exists
        SELECT f.* INTO v_faculty FROM public.faculty f WHERE f.id = p_faculty_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Faculty not found.';
        END IF;

        -- Verify subject exists
        SELECT sub.* INTO v_subject FROM public.subjects sub WHERE sub.id = p_subject_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Subject not found.';
        END IF;

        -- Check assignment: faculty must teach this section/subject in faculty_subject_assignments or timetable_entries
        SELECT (
            EXISTS (
                SELECT 1 FROM public.faculty_subject_assignments fsa
                WHERE fsa.section_id = v_student.section_id
                  AND fsa.subject_id = p_subject_id
                  AND fsa.faculty_id = p_faculty_id
                  AND fsa.active = true
            )
            OR EXISTS (
                SELECT 1 FROM public.timetable_entries te
                WHERE te.section_id = v_student.section_id
                  AND te.subject_id = p_subject_id
                  AND te.faculty_id = p_faculty_id
                  AND te.active = true
            )
        ) INTO v_is_assigned;

        IF NOT v_is_assigned AND v_role NOT IN ('super_admin', 'hod') THEN
            RAISE EXCEPTION 'You can only message faculty who are assigned to teach your section for this subject.';
        END IF;

        -- Find or create conversation
        SELECT * INTO v_conversation
        FROM public.conversations
        WHERE student_id = v_student.id
          AND faculty_id = p_faculty_id
          AND subject_id = p_subject_id;

        IF FOUND THEN
            RETURN to_jsonb(v_conversation);
        END IF;

        INSERT INTO public.conversations (
            student_id,
            faculty_id,
            subject_id,
            section_id,
            academic_year_id,
            category,
            subject_topic,
            status,
            last_message_at,
            created_at,
            updated_at
        ) VALUES (
            v_student.id,
            p_faculty_id,
            p_subject_id,
            v_student.section_id,
            v_student.academic_year_id,
            COALESCE(p_category, 'General'),
            p_topic,
            'OPEN',
            now(),
            now(),
            now()
        ) RETURNING * INTO v_conversation;

        RETURN to_jsonb(v_conversation);

    ELSE
        RAISE EXCEPTION 'Only students can initiate new conversations using this function.';
    END IF;
END;
$$;

-- 8. FUNCTION: send_message
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_message TEXT,
    p_attachment_url TEXT DEFAULT NULL,
    p_attachment_name TEXT DEFAULT NULL,
    p_attachment_type TEXT DEFAULT NULL,
    p_attachment_size INTEGER DEFAULT NULL
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
        now()
    ) RETURNING * INTO v_new_msg;

    -- Update conversation last_message_at and preview
    -- If faculty is replying to an OPEN issue, automatically advance status to IN_PROGRESS
    UPDATE public.conversations
    SET last_message_at = now(),
        last_message_preview = substring(trim(p_message) from 1 for 120),
        status = CASE 
            WHEN v_sender_role IN ('faculty', 'hod', 'super_admin') AND status = 'OPEN' THEN 'IN_PROGRESS' 
            ELSE status 
        END,
        updated_at = now()
    WHERE id = p_conversation_id;

    -- Lookup subject name for notification
    SELECT subject_name INTO v_subject_name FROM public.subjects WHERE id = v_conv.subject_id;

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
            COALESCE(v_subject_name, 'Class') || ': ' || substring(trim(p_message) from 1 for 80),
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

-- 9. FUNCTION: mark_conversation_read
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

-- 10. FUNCTION: update_conversation_status
CREATE OR REPLACE FUNCTION public.update_conversation_status(
    p_conversation_id UUID,
    p_status TEXT
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
    v_faculty RECORD;
    v_subject_name TEXT;
    v_student_user_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF p_status NOT IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') THEN
        RAISE EXCEPTION 'Invalid status: %', p_status;
    END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found.';
    END IF;

    SELECT role::TEXT INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    -- Verify authorization: must be the assigned faculty, HOD, or Super Admin
    SELECT f.* INTO v_faculty
    FROM public.faculty f
    JOIN public.profiles p ON (p.faculty_id = f.id OR f.auth_user_id = p.id)
    WHERE p.id = v_user_id AND f.id = v_conv.faculty_id;

    IF v_faculty IS NULL AND v_user_role NOT IN ('super_admin', 'hod') THEN
        RAISE EXCEPTION 'Only the assigned faculty or administrator can update issue status.';
    END IF;

    UPDATE public.conversations
    SET status = p_status,
        updated_at = now()
    WHERE id = p_conversation_id
    RETURNING * INTO v_conv;

    -- Notify student of status change
    SELECT COALESCE(p.id, s.auth_user_id) INTO v_student_user_id 
    FROM public.students s
    LEFT JOIN public.profiles p ON p.student_id = s.id
    WHERE s.id = v_conv.student_id
    LIMIT 1;

    SELECT subject_name INTO v_subject_name 
    FROM public.subjects 
    WHERE id = v_conv.subject_id;

    IF v_student_user_id IS NOT NULL THEN
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
            v_student_user_id,
            v_conv.student_id,
            'student',
            'ISSUE_STATUS_UPDATE',
            'Issue Status: ' || p_status,
            'Status for ' || COALESCE(v_subject_name, 'Class') || ' was changed to ' || p_status || '.',
            'conversation',
            p_conversation_id,
            false,
            now(),
            now()
        );
    END IF;

    RETURN to_jsonb(v_conv);
END;
$$;

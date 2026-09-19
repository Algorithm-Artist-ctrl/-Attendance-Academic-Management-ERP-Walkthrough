-- ============================================================================
-- VCTM ERP: Communication Center, Group Messaging & Direct Message Scoping Fix
-- ============================================================================

-- 1. MAKE subject_id NULLABLE IN message_groups, conversations, messages
ALTER TABLE public.message_groups ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN subject_id DROP NOT NULL;

-- 2. UPDATE UNIQUE CONSTRAINTS ON message_groups
ALTER TABLE public.message_groups DROP CONSTRAINT IF EXISTS unique_class_group_combination;

DROP INDEX IF EXISTS public.unique_section_group_without_subject;
CREATE UNIQUE INDEX unique_section_group_without_subject 
ON public.message_groups (academic_year_id, section_id) 
WHERE subject_id IS NULL;

DROP INDEX IF EXISTS public.unique_class_group_with_subject;
CREATE UNIQUE INDEX unique_class_group_with_subject 
ON public.message_groups (academic_year_id, section_id, subject_id) 
WHERE subject_id IS NOT NULL;

-- 3. UPDATE UNIQUE CONSTRAINTS ON conversations
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS unique_student_faculty_subject;

DROP INDEX IF EXISTS public.unique_conversation_with_subject;
CREATE UNIQUE INDEX unique_conversation_with_subject 
ON public.conversations (student_id, faculty_id, subject_id) 
WHERE subject_id IS NOT NULL;

DROP INDEX IF EXISTS public.unique_conversation_without_subject;
CREATE UNIQUE INDEX unique_conversation_without_subject 
ON public.conversations (student_id, faculty_id) 
WHERE subject_id IS NULL;

-- 4. UPDATE send_group_message RPC
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
    p_allow_student_replies boolean DEFAULT NULL::boolean
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
            -- Verify faculty is assigned to this subject and section OR is coordinator
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
            -- Entire section announcement: faculty must teach ANY subject in section OR be coordinator
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
        -- Verify student belongs to this section and year
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
        -- Only faculty, hod or super_admin can create a group
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

    -- PREPARE NOTIFICATION TITLE
    IF p_subject_id IS NOT NULL THEN
        v_notification_title := v_subject.subject_name || ' (' || v_section.name || '): ' || COALESCE(NULLIF(trim(p_title), ''), 'New Announcement');
    ELSE
        v_notification_title := 'Section ' || v_section.name || ': ' || COALESCE(NULLIF(trim(p_title), ''), 'Class Announcement');
    END IF;

    -- DISPATCH IN-APP NOTIFICATIONS TO ALL ACTIVE ENROLLED STUDENTS IN SECTION
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
$function$;

-- 5. UPDATE get_or_create_conversation RPC
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
    p_faculty_id uuid DEFAULT NULL, 
    p_subject_id uuid DEFAULT NULL, 
    p_category text DEFAULT 'General'::text, 
    p_topic text DEFAULT NULL::text,
    p_student_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_role TEXT;
    v_student RECORD;
    v_faculty RECORD;
    v_subject RECORD;
    v_conversation RECORD;
    v_is_assigned BOOLEAN := false;
    v_target_faculty_id UUID;
    v_target_student_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT role::TEXT INTO v_role FROM public.profiles WHERE id = v_user_id;

    -- Lookup subject if provided
    IF p_subject_id IS NOT NULL THEN
        SELECT sub.* INTO v_subject FROM public.subjects sub WHERE sub.id = p_subject_id;
    END IF;

    -- Case 1: Caller is Student
    IF v_role = 'student' OR (v_role IS NULL AND p_student_id IS NULL) THEN
        SELECT s.* INTO v_student 
        FROM public.students s 
        LEFT JOIN public.profiles p ON p.student_id = s.id
        WHERE s.auth_user_id = v_user_id OR p.id = v_user_id OR s.id = v_user_id
        LIMIT 1;

        IF v_student IS NULL THEN
            RAISE EXCEPTION 'Student record not found for active user.';
        END IF;

        IF p_faculty_id IS NULL THEN
            RAISE EXCEPTION 'Faculty ID is required for student-initiated conversations.';
        END IF;

        SELECT f.* INTO v_faculty FROM public.faculty f WHERE f.id = p_faculty_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Faculty not found.';
        END IF;

        v_target_faculty_id := p_faculty_id;
        v_target_student_id := v_student.id;

        -- Verify faculty assignment if subject specified or verify faculty teaches section
        IF p_subject_id IS NOT NULL THEN
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
                OR EXISTS (
                    SELECT 1 FROM public.sections sec
                    WHERE sec.id = v_student.section_id
                      AND sec.class_coordinator_id = p_faculty_id
                )
            ) INTO v_is_assigned;
        ELSE
            SELECT (
                EXISTS (
                    SELECT 1 FROM public.faculty_subject_assignments fsa
                    WHERE fsa.section_id = v_student.section_id
                      AND fsa.faculty_id = p_faculty_id
                      AND fsa.active = true
                )
                OR EXISTS (
                    SELECT 1 FROM public.timetable_entries te
                    WHERE te.section_id = v_student.section_id
                      AND te.faculty_id = p_faculty_id
                      AND te.active = true
                )
                OR EXISTS (
                    SELECT 1 FROM public.sections sec
                    WHERE sec.id = v_student.section_id
                      AND sec.class_coordinator_id = p_faculty_id
                )
            ) INTO v_is_assigned;
        END IF;

        IF NOT v_is_assigned AND v_role NOT IN ('super_admin', 'hod') THEN
            RAISE EXCEPTION 'You can only message faculty who are assigned to teach your section.';
        END IF;

    -- Case 2: Caller is Faculty, HOD, or Super Admin
    ELSE
        IF p_student_id IS NULL THEN
            RAISE EXCEPTION 'Student ID is required when initiating a conversation with a student.';
        END IF;

        SELECT s.* INTO v_student FROM public.students s WHERE s.id = p_student_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student not found: %', p_student_id;
        END IF;

        IF p_faculty_id IS NOT NULL THEN
            SELECT f.* INTO v_faculty FROM public.faculty f WHERE f.id = p_faculty_id;
        ELSE
            SELECT f.* INTO v_faculty 
            FROM public.faculty f 
            LEFT JOIN public.profiles p ON p.faculty_id = f.id
            WHERE f.auth_user_id = v_user_id OR p.id = v_user_id OR f.id = v_user_id
            LIMIT 1;
        END IF;

        IF v_faculty IS NULL THEN
            RAISE EXCEPTION 'Faculty profile not found for active user.';
        END IF;

        v_target_faculty_id := v_faculty.id;
        v_target_student_id := v_student.id;

        -- Verify assignment if regular faculty
        IF v_role NOT IN ('super_admin', 'hod') THEN
            IF p_subject_id IS NOT NULL THEN
                SELECT (
                    EXISTS (
                        SELECT 1 FROM public.faculty_subject_assignments fsa
                        WHERE fsa.section_id = v_student.section_id
                          AND fsa.subject_id = p_subject_id
                          AND fsa.faculty_id = v_faculty.id
                          AND fsa.active = true
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.timetable_entries te
                        WHERE te.section_id = v_student.section_id
                          AND te.subject_id = p_subject_id
                          AND te.faculty_id = v_faculty.id
                          AND te.active = true
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.sections sec
                        WHERE sec.id = v_student.section_id
                          AND sec.class_coordinator_id = v_faculty.id
                    )
                ) INTO v_is_assigned;
            ELSE
                SELECT (
                    EXISTS (
                        SELECT 1 FROM public.faculty_subject_assignments fsa
                        WHERE fsa.section_id = v_student.section_id
                          AND fsa.faculty_id = v_faculty.id
                          AND fsa.active = true
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.timetable_entries te
                        WHERE te.section_id = v_student.section_id
                          AND te.faculty_id = v_faculty.id
                          AND te.active = true
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.sections sec
                        WHERE sec.id = v_student.section_id
                          AND sec.class_coordinator_id = v_faculty.id
                    )
                ) INTO v_is_assigned;
            END IF;

            IF NOT v_is_assigned THEN
                RAISE EXCEPTION 'Authorization Error: You are not assigned to teach student % or coordinate their section.', 
                    v_student.full_name;
            END IF;
        END IF;
    END IF;

    -- Find existing conversation
    IF p_subject_id IS NOT NULL THEN
        SELECT * INTO v_conversation
        FROM public.conversations
        WHERE student_id = v_target_student_id
          AND faculty_id = v_target_faculty_id
          AND (subject_id = p_subject_id OR subject_id IS NULL)
        ORDER BY (subject_id IS NOT NULL) DESC, last_message_at DESC
        LIMIT 1;
    ELSE
        SELECT * INTO v_conversation
        FROM public.conversations
        WHERE student_id = v_target_student_id
          AND faculty_id = v_target_faculty_id
        ORDER BY last_message_at DESC
        LIMIT 1;
    END IF;

    IF v_conversation.id IS NOT NULL THEN
        RETURN to_jsonb(v_conversation);
    END IF;

    -- Create new conversation
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
        v_target_student_id,
        v_target_faculty_id,
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
END;
$function$;

-- 6. UPDATE RLS POLICIES FOR message_groups AND group_messages
DROP POLICY IF EXISTS message_groups_select_policy ON public.message_groups;
CREATE POLICY message_groups_select_policy ON public.message_groups
FOR SELECT USING (
    (auth.role() = 'service_role')
    OR (current_user_role() = 'super_admin'::user_role)
    OR (current_user_role() = 'hod'::user_role AND message_groups.department_id = (SELECT p.department_id FROM profiles p WHERE p.id = auth.uid()))
    OR (EXISTS (
        SELECT 1 FROM profiles p
        JOIN faculty_subject_assignments fsa ON fsa.faculty_id = p.faculty_id
        WHERE p.id = auth.uid()
          AND fsa.section_id = message_groups.section_id
          AND (message_groups.subject_id IS NULL OR fsa.subject_id = message_groups.subject_id)
          AND fsa.active = true
    ))
    OR (EXISTS (
        SELECT 1 FROM profiles p
        JOIN timetable_entries te ON te.faculty_id = p.faculty_id
        WHERE p.id = auth.uid()
          AND te.section_id = message_groups.section_id
          AND (message_groups.subject_id IS NULL OR te.subject_id = message_groups.subject_id)
          AND te.active = true
    ))
    OR (EXISTS (
        SELECT 1 FROM profiles p
        JOIN sections sec ON sec.class_coordinator_id = p.faculty_id
        WHERE p.id = auth.uid()
          AND sec.id = message_groups.section_id
    ))
    OR (EXISTS (
        SELECT 1 FROM students s
        WHERE (s.auth_user_id = auth.uid() OR s.id = (SELECT p.student_id FROM profiles p WHERE p.id = auth.uid()))
          AND s.section_id = message_groups.section_id
          AND s.academic_year_id = message_groups.academic_year_id
          AND s.active = true
    ))
);

DROP POLICY IF EXISTS message_groups_insert_policy ON public.message_groups;
CREATE POLICY message_groups_insert_policy ON public.message_groups
FOR INSERT WITH CHECK (
    (auth.role() = 'service_role')
    OR (current_user_role() = 'super_admin'::user_role)
    OR (current_user_role() = 'hod'::user_role AND message_groups.department_id = (SELECT p.department_id FROM profiles p WHERE p.id = auth.uid()))
    OR (EXISTS (
        SELECT 1 FROM profiles p
        JOIN faculty_subject_assignments fsa ON fsa.faculty_id = p.faculty_id
        WHERE p.id = auth.uid()
          AND fsa.section_id = message_groups.section_id
          AND (message_groups.subject_id IS NULL OR fsa.subject_id = message_groups.subject_id)
          AND fsa.active = true
    ))
    OR (EXISTS (
        SELECT 1 FROM profiles p
        JOIN timetable_entries te ON te.faculty_id = p.faculty_id
        WHERE p.id = auth.uid()
          AND te.section_id = message_groups.section_id
          AND (message_groups.subject_id IS NULL OR te.subject_id = message_groups.subject_id)
          AND te.active = true
    ))
    OR (EXISTS (
        SELECT 1 FROM profiles p
        JOIN sections sec ON sec.class_coordinator_id = p.faculty_id
        WHERE p.id = auth.uid()
          AND sec.id = message_groups.section_id
    ))
);

DROP POLICY IF EXISTS group_messages_select_policy ON public.group_messages;
CREATE POLICY group_messages_select_policy ON public.group_messages
FOR SELECT USING (
    (auth.role() = 'service_role')
    OR (current_user_role() = 'super_admin'::user_role)
    OR (current_user_role() = 'hod'::user_role AND EXISTS (
        SELECT 1 FROM message_groups mg 
        WHERE mg.id = group_messages.group_id 
          AND mg.department_id = (SELECT p.department_id FROM profiles p WHERE p.id = auth.uid())
    ))
    OR (EXISTS (
        SELECT 1 FROM message_groups mg
        WHERE mg.id = group_messages.group_id
          AND (
            (EXISTS (
                SELECT 1 FROM profiles p
                JOIN faculty_subject_assignments fsa ON fsa.faculty_id = p.faculty_id
                WHERE p.id = auth.uid()
                  AND fsa.section_id = mg.section_id
                  AND (mg.subject_id IS NULL OR fsa.subject_id = mg.subject_id)
                  AND fsa.active = true
            ))
            OR (EXISTS (
                SELECT 1 FROM profiles p
                JOIN timetable_entries te ON te.faculty_id = p.faculty_id
                WHERE p.id = auth.uid()
                  AND te.section_id = mg.section_id
                  AND (mg.subject_id IS NULL OR te.subject_id = mg.subject_id)
                  AND te.active = true
            ))
            OR (EXISTS (
                SELECT 1 FROM profiles p
                JOIN sections sec ON sec.class_coordinator_id = p.faculty_id
                WHERE p.id = auth.uid()
                  AND sec.id = mg.section_id
            ))
            OR (EXISTS (
                SELECT 1 FROM students s
                WHERE (s.auth_user_id = auth.uid() OR s.id = (SELECT p.student_id FROM profiles p WHERE p.id = auth.uid()))
                  AND s.section_id = mg.section_id
                  AND s.academic_year_id = mg.academic_year_id
                  AND s.active = true
            ))
          )
    ))
);

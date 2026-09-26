-- ==============================================================================
-- Migration 056: Complete VCTM ERP Notification & Email Event Pipeline
-- Features:
-- 1. Fix RLS & RPCs on public.notifications (support recipient_faculty_id for reads/updates)
-- 2. PostgreSQL LISTEN/NOTIFY trigger for real-time background email dispatch
-- 3. Coordinator Assignment & Removal notifications
-- 4. Student in-app notifications enabled, Student emails strictly excluded
-- ==============================================================================

-- 1. Update RLS policies on public.notifications to support recipient_faculty_id for update
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
    USING (
        recipient_user_id = auth.uid()
        OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
        OR (recipient_faculty_id IS NOT NULL AND recipient_faculty_id = public.current_user_faculty_id())
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        recipient_user_id = auth.uid()
        OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
        OR (recipient_faculty_id IS NOT NULL AND recipient_faculty_id = public.current_user_faculty_id())
        OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
        OR auth.role() = 'service_role'
    );

-- 2. Update mark_notification_as_read RPC
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true, 
        read_at = COALESCE(read_at, now()), 
        updated_at = now()
    WHERE id = p_notification_id
      AND (
          recipient_user_id = auth.uid()
          OR (recipient_student_id IS NOT NULL AND recipient_student_id = public.current_user_student_id())
          OR (recipient_faculty_id IS NOT NULL AND recipient_faculty_id = public.current_user_faculty_id())
          OR public.current_user_role() IN ('super_admin'::user_role, 'hod'::user_role)
          OR auth.role() = 'service_role'
      );
END;
$$;

-- 3. Update mark_all_notifications_as_read RPC
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_sid UUID := public.current_user_student_id();
    v_fid UUID := public.current_user_faculty_id();
    v_role user_role := public.current_user_role();
BEGIN
    UPDATE public.notifications
    SET is_read = true, 
        read_at = COALESCE(read_at, now()), 
        updated_at = now()
    WHERE is_read = false
      AND (
          (v_uid IS NOT NULL AND recipient_user_id = v_uid)
          OR (v_sid IS NOT NULL AND recipient_student_id = v_sid)
          OR (v_fid IS NOT NULL AND recipient_faculty_id = v_fid)
          OR (v_role = 'super_admin')
          OR auth.role() = 'service_role'
      );
END;
$$;

-- 4. Real-time PostgreSQL LISTEN/NOTIFY Trigger for Pending Email Notifications
-- Pushes notification ID directly to the Node.js server background listener
CREATE OR REPLACE FUNCTION public.trig_notify_pending_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only dispatch for non-students with pending status
    IF NEW.email_status = 'pending' 
       AND (NEW.recipient_role IS NULL OR LOWER(NEW.recipient_role) != 'student') 
       AND NEW.recipient_student_id IS NULL THEN
        PERFORM pg_notify('p_notification_created', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_pending_email ON public.notifications;
CREATE TRIGGER tr_notify_pending_email
AFTER INSERT OR UPDATE OF email_status
ON public.notifications
FOR EACH ROW
WHEN (NEW.email_status = 'pending')
EXECUTE FUNCTION public.trig_notify_pending_email();

-- 5. Update assign_class_coordinator_atomic to create notification records for assigned and replaced faculty
CREATE OR REPLACE FUNCTION public.assign_class_coordinator_atomic(
    p_faculty_id UUID,
    p_section_id UUID,
    p_academic_session_id UUID DEFAULT NULL,
    p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_session_id UUID := p_academic_session_id;
    v_year_id UUID;
    v_existing_id UUID;
    v_prev_faculty_id UUID;
    v_prev_faculty_name TEXT;
    v_prev_faculty_auth_id UUID;
    v_new_faculty_name TEXT;
    v_new_faculty_auth_id UUID;
    v_sec_name TEXT;
    v_yr_name TEXT;
BEGIN
    -- Authorization check: Caller must be super_admin, hod, or service_role
    v_caller_role := COALESCE(public.current_user_role()::text, '');
    IF current_user != 'postgres' AND auth.role() != 'service_role' AND v_caller_role NOT IN ('super_admin', 'hod') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin and HOD can manage Class Coordinator roles.';
    END IF;

    IF p_faculty_id IS NULL THEN
        RAISE EXCEPTION 'Faculty ID is required to assign a Class Coordinator.';
    END IF;

    IF p_section_id IS NULL THEN
        RAISE EXCEPTION 'Section ID is required to assign a Class Coordinator.';
    END IF;

    -- Concurrency Protection: Lock the section row for update to serialize concurrent assignments
    PERFORM 1 FROM public.sections WHERE id = p_section_id FOR UPDATE;

    -- Resolve current academic session if not provided
    IF v_session_id IS NULL THEN
        SELECT id INTO v_session_id 
        FROM public.academic_sessions 
        WHERE is_current = true 
        LIMIT 1;
    END IF;

    -- Resolve academic_year_id and section name
    SELECT sem.academic_year_id, sec.name, ay.name 
    INTO v_year_id, v_sec_name, v_yr_name
    FROM public.sections sec
    JOIN public.semesters sem ON sem.id = sec.semester_id
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id
    WHERE sec.id = p_section_id;

    -- Identify existing active coordinator for this section (if any)
    SELECT cca.id, cca.faculty_id, f.full_name, COALESCE(p.id, f.auth_user_id)
    INTO v_existing_id, v_prev_faculty_id, v_prev_faculty_name, v_prev_faculty_auth_id
    FROM public.class_coordinator_assignments cca
    JOIN public.faculty f ON f.id = cca.faculty_id
    LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
    WHERE cca.section_id = p_section_id 
      AND cca.active = true
    LIMIT 1;

    -- If another faculty was coordinator, deactivate their assignment and notify them
    IF v_prev_faculty_id IS NOT NULL AND v_prev_faculty_id != p_faculty_id THEN
        UPDATE public.class_coordinator_assignments
        SET active = false,
            updated_at = NOW()
        WHERE id = v_existing_id;

        -- Create notification for replaced faculty
        INSERT INTO public.notifications (
            recipient_user_id,
            recipient_faculty_id,
            recipient_role,
            type,
            title,
            message,
            reference_type,
            reference_id,
            email_status,
            is_read,
            created_at,
            updated_at
        ) VALUES (
            v_prev_faculty_auth_id,
            v_prev_faculty_id,
            'faculty',
            'ACCOUNT_UPDATE',
            'Class Coordinator Role Reassigned',
            'Your Class Coordinator role for ' || COALESCE(v_yr_name, 'Academic Year') || ' Section ' || COALESCE(v_sec_name, '') || ' has been reassigned.',
            'section',
            p_section_id,
            'pending',
            false,
            NOW(),
            NOW()
        );
    END IF;

    -- Check if record already exists for the new faculty on this section
    SELECT id INTO v_existing_id
    FROM public.class_coordinator_assignments
    WHERE section_id = p_section_id 
      AND faculty_id = p_faculty_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.class_coordinator_assignments
        SET active = true,
            academic_session_id = COALESCE(v_session_id, academic_session_id),
            academic_year_id = COALESCE(v_year_id, academic_year_id),
            assigned_by = COALESCE(p_assigned_by, auth.uid(), assigned_by),
            updated_at = NOW()
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO public.class_coordinator_assignments (
            faculty_id,
            section_id,
            academic_session_id,
            academic_year_id,
            assigned_by,
            active,
            created_at,
            updated_at
        ) VALUES (
            p_faculty_id,
            p_section_id,
            v_session_id,
            v_year_id,
            COALESCE(p_assigned_by, auth.uid()),
            true,
            NOW(),
            NOW()
        );
    END IF;

    -- Update sections table class_coordinator_id pointer
    UPDATE public.sections
    SET class_coordinator_id = p_faculty_id,
        updated_at = NOW()
    WHERE id = p_section_id;

    -- Resolve new faculty details
    SELECT f.full_name, COALESCE(p.id, f.auth_user_id) 
    INTO v_new_faculty_name, v_new_faculty_auth_id
    FROM public.faculty f
    LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
    WHERE f.id = p_faculty_id;

    -- Create notification for newly assigned faculty
    INSERT INTO public.notifications (
        recipient_user_id,
        recipient_faculty_id,
        recipient_role,
        type,
        title,
        message,
        reference_type,
        reference_id,
        email_status,
        is_read,
        created_at,
        updated_at
    ) VALUES (
        v_new_faculty_auth_id,
        p_faculty_id,
        'faculty',
        'ACCOUNT_UPDATE',
        'Class Coordinator Role Assigned',
        'You have been assigned as the Class Coordinator for ' || COALESCE(v_yr_name, 'Academic Year') || ' Section ' || COALESCE(v_sec_name, '') || '.',
        'section',
        p_section_id,
        'pending',
        false,
        NOW(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'section_id', p_section_id,
        'faculty_id', p_faculty_id,
        'faculty_name', v_new_faculty_name,
        'section_name', v_sec_name,
        'replaced_faculty_id', v_prev_faculty_id,
        'replaced_faculty_name', v_prev_faculty_name
    );
END;
$$;

-- 6. Update remove_class_coordinator_atomic to create notification record for removed faculty
CREATE OR REPLACE FUNCTION public.remove_class_coordinator_atomic(
    p_faculty_id UUID,
    p_section_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_updated_cca_count INT := 0;
    v_updated_sec_count INT := 0;
    v_fac_name TEXT;
    v_fac_auth_id UUID;
    v_sec_name TEXT;
    v_yr_name TEXT;
BEGIN
    -- Authorization check: Caller must be super_admin, hod, or service_role
    v_caller_role := COALESCE(public.current_user_role()::text, '');
    IF current_user != 'postgres' AND auth.role() != 'service_role' AND v_caller_role NOT IN ('super_admin', 'hod') THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin and HOD can manage Class Coordinator roles.';
    END IF;

    IF p_section_id IS NULL THEN
        RAISE EXCEPTION 'Section ID is required to remove class coordinator';
    END IF;

    -- Concurrency Protection: Lock the section row for update
    PERFORM 1 FROM public.sections WHERE id = p_section_id FOR UPDATE;

    -- Resolve section and year name
    SELECT sec.name, ay.name 
    INTO v_sec_name, v_yr_name
    FROM public.sections sec
    JOIN public.semesters sem ON sem.id = sec.semester_id
    JOIN public.academic_years ay ON ay.id = sem.academic_year_id
    WHERE sec.id = p_section_id;

    -- Deactivate assignment in class_coordinator_assignments
    IF p_faculty_id IS NOT NULL THEN
        UPDATE public.class_coordinator_assignments
        SET active = false,
            updated_at = NOW()
        WHERE section_id = p_section_id 
          AND faculty_id = p_faculty_id
          AND active = true;
        GET DIAGNOSTICS v_updated_cca_count = ROW_COUNT;

        -- Resolve faculty auth user ID
        SELECT f.full_name, COALESCE(p.id, f.auth_user_id) 
        INTO v_fac_name, v_fac_auth_id
        FROM public.faculty f
        LEFT JOIN public.profiles p ON (p.faculty_id = f.id OR p.id = f.auth_user_id)
        WHERE f.id = p_faculty_id;

        -- Create notification for removed faculty
        IF v_updated_cca_count > 0 THEN
            INSERT INTO public.notifications (
                recipient_user_id,
                recipient_faculty_id,
                recipient_role,
                type,
                title,
                message,
                reference_type,
                reference_id,
                email_status,
                is_read,
                created_at,
                updated_at
            ) VALUES (
                v_fac_auth_id,
                p_faculty_id,
                'faculty',
                'ACCOUNT_UPDATE',
                'Class Coordinator Role Removed',
                'You are no longer assigned as Class Coordinator for ' || COALESCE(v_yr_name, 'Academic Year') || ' Section ' || COALESCE(v_sec_name, '') || '.',
                'section',
                p_section_id,
                'pending',
                false,
                NOW(),
                NOW()
            );
        END IF;
    ELSE
        UPDATE public.class_coordinator_assignments
        SET active = false,
            updated_at = NOW()
        WHERE section_id = p_section_id 
          AND active = true;
        GET DIAGNOSTICS v_updated_cca_count = ROW_COUNT;
    END IF;

    -- Clear section class_coordinator_id pointer
    IF p_faculty_id IS NOT NULL THEN
        UPDATE public.sections
        SET class_coordinator_id = NULL,
            updated_at = NOW()
        WHERE id = p_section_id 
          AND class_coordinator_id = p_faculty_id;
        GET DIAGNOSTICS v_updated_sec_count = ROW_COUNT;
    ELSE
        UPDATE public.sections
        SET class_coordinator_id = NULL,
            updated_at = NOW()
        WHERE id = p_section_id;
        GET DIAGNOSTICS v_updated_sec_count = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'section_id', p_section_id,
        'faculty_id', p_faculty_id,
        'deactivated_assignments', v_updated_cca_count,
        'cleared_sections', v_updated_sec_count
    );
END;
$$;

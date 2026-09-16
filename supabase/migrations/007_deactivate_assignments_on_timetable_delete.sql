-- Migration 007: Deactivate faculty subject assignments on timetable deletion
-- Ensures atomic cleanup of assigned faculty teaching loads when HOD deletes a section timetable

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
BEGIN
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

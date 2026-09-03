-- VCTM Attendance & Academic Management ERP
-- Migration 004: Atomic Timetable Replacement RPC, Optimization Indexes & Student Sync Enhancements

-- 1. Optimized Database Indexes
CREATE INDEX IF NOT EXISTS idx_timetable_entries_section ON public.timetable_entries(section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_fac_day ON public.timetable_entries(faculty_id, day_of_week, period_number);
CREATE INDEX IF NOT EXISTS idx_students_roll_lower ON public.students(LOWER(roll_number));
CREATE INDEX IF NOT EXISTS idx_students_section ON public.students(section_id);
CREATE INDEX IF NOT EXISTS idx_sections_semester ON public.sections(semester_id);
CREATE INDEX IF NOT EXISTS idx_faculty_sub_assign_lookup ON public.faculty_subject_assignments(faculty_id, subject_id, section_id);

-- 2. Atomic Section Timetable Replacement Function
CREATE OR REPLACE FUNCTION public.replace_section_timetable(
    p_section_id UUID,
    p_department_id UUID,
    p_approved_by TEXT,
    p_effective_from DATE,
    p_source_type TEXT,
    p_source_url TEXT,
    p_entries JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_version INT := 1;
    v_version_id UUID;
    v_slot_count INT := 0;
    v_entry JSONB;
    v_session_id UUID;
    v_pair RECORD;
BEGIN
    -- Check that section exists
    IF NOT EXISTS (SELECT 1 FROM public.sections WHERE id = p_section_id) THEN
        RAISE EXCEPTION 'Target section % does not exist.', p_section_id;
    END IF;

    -- Resolve current academic session
    SELECT id INTO v_session_id 
    FROM public.academic_sessions 
    WHERE is_current = true 
    LIMIT 1;

    -- Calculate next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.timetable_versions
    WHERE section_id = p_section_id;

    -- Mark previous active versions for this section as superseded
    UPDATE public.timetable_versions
    SET status = 'superseded', updated_at = NOW()
    WHERE section_id = p_section_id AND status = 'active';

    -- Create new active version with complete recoverable snapshot
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

    -- Atomically remove all previous timetable entries strictly for this section
    DELETE FROM public.timetable_entries
    WHERE section_id = p_section_id;

    -- Insert new entries from JSONB array
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
                active,
                created_at,
                updated_at
            ) VALUES (
                p_section_id,
                (v_entry->>'subject_id')::UUID,
                (v_entry->>'faculty_id')::UUID,
                (v_entry->>'day_of_week')::day_of_week_enum,
                (v_entry->>'period_number')::INT,
                (v_entry->>'start_time')::TIME,
                (v_entry->>'end_time')::TIME,
                COALESCE(v_entry->>'room_number', 'Room A-007'),
                COALESCE((v_entry->>'lecture_type')::lecture_type, 'Theory'::lecture_type),
                true,
                NOW(),
                NOW()
            );
            v_slot_count := v_slot_count + 1;
        END LOOP;
    END IF;

    -- Synchronize faculty_subject_assignments for all distinct pairs in the new timetable
    IF v_session_id IS NOT NULL AND jsonb_array_length(p_entries) > 0 THEN
        FOR v_pair IN 
            SELECT DISTINCT 
                (elem->>'faculty_id')::UUID AS f_id,
                (elem->>'subject_id')::UUID AS s_id
            FROM jsonb_array_elements(p_entries) elem
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

    -- Audit log
    INSERT INTO public.audit_logs (
        action,
        actor_name,
        actor_role,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        'TIMETABLE_REPLACED_ATOMIC',
        COALESCE(p_approved_by, 'HOD / Administrator'),
        'hod',
        'timetable_versions',
        v_version_id,
        jsonb_build_object(
            'section_id', p_section_id,
            'version_number', v_next_version,
            'slots_synchronized', v_slot_count,
            'source_type', p_source_type,
            'source_url', p_source_url
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'version_id', v_version_id,
        'version_number', v_next_version,
        'period_count', v_slot_count
    );
END;
$$;


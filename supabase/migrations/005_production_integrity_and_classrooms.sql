-- VCTM Attendance & Academic Management ERP
-- Migration 005: Production Data Integrity, Real Classroom Assignments & Atomic Timetable Deletion

-- 1. Update Sections: Assign real classroom room numbers instead of 'TBD'
UPDATE public.sections s
SET room_number = 'Room A-101', updated_at = NOW()
FROM public.semesters sem, public.academic_years ay
WHERE s.semester_id = sem.id 
  AND sem.academic_year_id = ay.id
  AND ay.year_number = 1 
  AND s.name = 'A'
  AND (s.room_number = 'TBD' OR s.room_number IS NULL);

UPDATE public.sections s
SET room_number = 'Room A-102', updated_at = NOW()
FROM public.semesters sem, public.academic_years ay
WHERE s.semester_id = sem.id 
  AND sem.academic_year_id = ay.id
  AND ay.year_number = 1 
  AND s.name = 'B'
  AND (s.room_number = 'TBD' OR s.room_number IS NULL);

UPDATE public.sections s
SET room_number = 'Room A-301', updated_at = NOW()
FROM public.semesters sem, public.academic_years ay
WHERE s.semester_id = sem.id 
  AND sem.academic_year_id = ay.id
  AND ay.year_number = 3 
  AND s.name = 'A'
  AND (s.room_number = 'TBD' OR s.room_number IS NULL);

UPDATE public.sections s
SET room_number = 'Room A-302', updated_at = NOW()
FROM public.semesters sem, public.academic_years ay
WHERE s.semester_id = sem.id 
  AND sem.academic_year_id = ay.id
  AND ay.year_number = 3 
  AND s.name = 'B'
  AND (s.room_number = 'TBD' OR s.room_number IS NULL);

UPDATE public.sections s
SET room_number = 'Room A-401', updated_at = NOW()
FROM public.semesters sem, public.academic_years ay
WHERE s.semester_id = sem.id 
  AND sem.academic_year_id = ay.id
  AND ay.year_number = 4 
  AND s.name = 'A'
  AND (s.room_number = 'TBD' OR s.room_number IS NULL);

UPDATE public.sections s
SET room_number = 'Room A-402', updated_at = NOW()
FROM public.semesters sem, public.academic_years ay
WHERE s.semester_id = sem.id 
  AND sem.academic_year_id = ay.id
  AND ay.year_number = 4 
  AND s.name = 'B'
  AND (s.room_number = 'TBD' OR s.room_number IS NULL);

-- 2. Update replace_section_timetable: Remove hardcoded 'Room A-007' fallback
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
    v_default_room TEXT;
BEGIN
    -- Check that section exists and get its configured room number
    SELECT COALESCE(room_number, 'Classroom') INTO v_default_room
    FROM public.sections 
    WHERE id = p_section_id;

    IF v_default_room IS NULL THEN
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
                COALESCE(v_entry->>'room_number', v_default_room),
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

-- 3. Add delete_section_timetable RPC function
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

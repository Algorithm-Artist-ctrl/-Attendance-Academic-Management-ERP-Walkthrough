-- Migration 006: Classrooms Entity, Relational Section-Classroom Mapping, Lunch/Other Lecture Types, and replace_section_timetable update

CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number VARCHAR(50) NOT NULL UNIQUE,
    building VARCHAR(100) DEFAULT 'Main Academic Block',
    floor VARCHAR(50) DEFAULT 'Ground Floor',
    capacity INT DEFAULT 60,
    room_type VARCHAR(50) DEFAULT 'Classroom',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read classrooms" ON public.classrooms;
CREATE POLICY "Allow public read classrooms" ON public.classrooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all actions on classrooms" ON public.classrooms;
CREATE POLICY "Allow all actions on classrooms" ON public.classrooms FOR ALL USING (true);

-- Seed standard institutional classrooms and laboratories
INSERT INTO public.classrooms (room_number, building, floor, capacity, room_type)
VALUES
    ('A007', 'Main Academic Block', 'Ground Floor', 70, 'Classroom'),
    ('A006', 'Main Academic Block', 'Ground Floor', 70, 'Classroom'),
    ('Room A-101', 'Main Academic Block', '1st Floor', 60, 'Classroom'),
    ('Room A-102', 'Main Academic Block', '1st Floor', 60, 'Classroom'),
    ('Room A-301', 'Main Academic Block', '3rd Floor', 60, 'Classroom'),
    ('Room A-302', 'Main Academic Block', '3rd Floor', 60, 'Classroom'),
    ('Room A-303', 'Main Academic Block', '3rd Floor', 60, 'Classroom'),
    ('Room A-401', 'Main Academic Block', '4th Floor', 60, 'Classroom'),
    ('Room A-402', 'Main Academic Block', '4th Floor', 60, 'Classroom'),
    ('DS Lab', 'Computer Labs Block', '2nd Floor', 40, 'Lab'),
    ('COA Lab', 'Computer Labs Block', '2nd Floor', 40, 'Lab'),
    ('WD Lab', 'Computer Labs Block', '2nd Floor', 40, 'Lab'),
    ('Sports Ground', 'Campus Grounds', 'Ground', 100, 'Sports')
ON CONFLICT (room_number) DO UPDATE
SET updated_at = NOW();

-- Add classroom_id reference to sections
DO 62012 BEGIN
    ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END 62012;

-- Link existing sections to their classrooms based on room_number
UPDATE public.sections s
SET classroom_id = c.id
FROM public.classrooms c
WHERE s.room_number = c.room_number;

-- Add classroom_id reference to timetable_entries
DO 62012 BEGIN
    ALTER TABLE public.timetable_entries ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END 62012;

-- Link existing timetable_entries to classrooms
UPDATE public.timetable_entries t
SET classroom_id = c.id
FROM public.classrooms c
WHERE t.room_number = c.room_number;

-- Add Lunch and Other to lecture_type enum
DO 62012 BEGIN
    ALTER TYPE lecture_type ADD VALUE IF NOT EXISTS 'Lunch';
EXCEPTION
    WHEN duplicate_object THEN null;
END 62012;

DO 62012 BEGIN
    ALTER TYPE lecture_type ADD VALUE IF NOT EXISTS 'Other';
EXCEPTION
    WHEN duplicate_object THEN null;
END 62012;

-- Allow nullable subject_id and faculty_id in timetable_entries for non-instructional slots (e.g. Lunch Break, Sports)
ALTER TABLE public.timetable_entries ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE public.timetable_entries ALTER COLUMN faculty_id DROP NOT NULL;
ALTER TABLE public.faculty_subject_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update replace_section_timetable
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
AS 62012
DECLARE
    v_next_version INT := 1;
    v_version_id UUID;
    v_slot_count INT := 0;
    v_entry JSONB;
    v_session_id UUID;
    v_pair RECORD;
    v_default_room TEXT;
    v_default_classroom_id UUID;
BEGIN
    SELECT COALESCE(room_number, 'A007'), classroom_id 
    INTO v_default_room, v_default_classroom_id
    FROM public.sections 
    WHERE id = p_section_id;

    IF v_default_room IS NULL THEN
        v_default_room := 'A007';
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

    -- Create new active version
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

    -- Atomically delete old entries for this section
    DELETE FROM public.timetable_entries
    WHERE section_id = p_section_id;

    -- Insert entries
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
                classroom_id,
                active,
                created_at,
                updated_at
            ) VALUES (
                p_section_id,
                NULLIF(v_entry->>'subject_id', '')::UUID,
                NULLIF(v_entry->>'faculty_id', '')::UUID,
                (v_entry->>'day_of_week')::day_of_week_enum,
                (v_entry->>'period_number')::INT,
                (v_entry->>'start_time')::TIME,
                (v_entry->>'end_time')::TIME,
                COALESCE(v_entry->>'room_number', v_default_room),
                COALESCE((v_entry->>'lecture_type')::lecture_type, 'Theory'::lecture_type),
                COALESCE(
                  NULLIF(v_entry->>'classroom_id', '')::UUID,
                  (SELECT c.id FROM public.classrooms c WHERE c.room_number = COALESCE(v_entry->>'room_number', v_default_room) LIMIT 1),
                  v_default_classroom_id
                ),
                true,
                NOW(),
                NOW()
            );
            v_slot_count := v_slot_count + 1;
        END LOOP;
    END IF;

    -- Synchronize faculty_subject_assignments only for non-null pairs
    IF v_session_id IS NOT NULL AND jsonb_array_length(p_entries) > 0 THEN
        FOR v_pair IN 
            SELECT DISTINCT 
                NULLIF(elem->>'faculty_id', '')::UUID AS f_id,
                NULLIF(elem->>'subject_id', '')::UUID AS s_id
            FROM jsonb_array_elements(p_entries) elem
            WHERE NULLIF(elem->>'faculty_id', '') IS NOT NULL
              AND NULLIF(elem->>'subject_id', '') IS NOT NULL
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

    RETURN jsonb_build_object(
        'success', true,
        'version_id', v_version_id,
        'version_number', v_next_version,
        'period_count', v_slot_count
    );
END;
62012;

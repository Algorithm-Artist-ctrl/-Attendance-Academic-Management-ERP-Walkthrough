-- VCTM Attendance & Academic Management ERP
-- Migration 002: Complete VCTM B.Tech CSE 2nd Year (2026-2027) Seed Data

DO $$ 
DECLARE
    v_inst_id UUID;
    v_dept_id UUID;
    v_prog_id UUID;
    v_session_id UUID;
    v_year_id UUID;
    v_sem_id UUID;
    v_sec_a_id UUID;
    v_sec_b_id UUID;
    
    -- Faculty IDs
    v_fac_wasim UUID := gen_random_uuid();
    v_fac_hemlata UUID := gen_random_uuid();
    v_fac_imran UUID := gen_random_uuid();
    v_fac_alok UUID := gen_random_uuid();
    v_fac_kuldeep UUID := gen_random_uuid();
    v_fac_naseem UUID := gen_random_uuid();
    v_fac_shivani UUID := gen_random_uuid();
    v_fac_gagandeep UUID := gen_random_uuid();
    v_fac_faizan UUID := gen_random_uuid();
    v_fac_praveen UUID := gen_random_uuid();
    v_fac_abhishek UUID := gen_random_uuid();
    
    -- Subject IDs
    v_sub_maths UUID := gen_random_uuid();
    v_sub_uhv UUID := gen_random_uuid();
    v_sub_ds UUID := gen_random_uuid();
    v_sub_coa UUID := gen_random_uuid();
    v_sub_dstl UUID := gen_random_uuid();
    v_sub_dslab UUID := gen_random_uuid();
    v_sub_coalab UUID := gen_random_uuid();
    v_sub_wdws UUID := gen_random_uuid();
    v_sub_cs UUID := gen_random_uuid();
    v_sub_project UUID := gen_random_uuid();
    
BEGIN
    -- 1. Insert Institution
    INSERT INTO public.institutions (id, name, code, address, website, active)
    VALUES (
        gen_random_uuid(),
        'Vivekananda College of Technology & Management, Aligarh',
        '340',
        'Mathura Bypass Road, Near Khair Road Crossing, Aligarh, Uttar Pradesh 202001',
        'https://vctm.in/',
        true
    )
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_inst_id;

    -- 2. Insert CSE Department
    INSERT INTO public.departments (id, institution_id, name, code, active)
    VALUES (
        gen_random_uuid(),
        v_inst_id,
        'Computer Science & Engineering',
        'CSE',
        true
    )
    ON CONFLICT (institution_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_dept_id;

    -- 3. Insert Faculty Members
    INSERT INTO public.faculty (id, department_id, employee_code, faculty_code, full_name, designation, email, phone, active)
    VALUES
        (v_fac_wasim, v_dept_id, 'FAC-CSE-001', 'WSM', 'Mr. Wasim', 'Associate Professor & HOD', 'wasim.cse@vctm.in', '9876543210', true),
        (v_fac_hemlata, v_dept_id, 'FAC-CSE-002', 'HEM', 'Ms. Hemlata Chaudhary', 'Assistant Professor & Coordinator (Sec A)', 'hemlata.cse@vctm.in', '9876543211', true),
        (v_fac_imran, v_dept_id, 'FAC-CSE-003', 'IRK', 'Mr. Imran Raza Khan', 'Assistant Professor & Coordinator (Sec B)', 'imran.cse@vctm.in', '9876543212', true),
        (v_fac_alok, v_dept_id, 'FAC-CSE-004', 'ALG', 'Mr. Alok Gupta', 'Assistant Professor', 'alok.cse@vctm.in', '9876543213', true),
        (v_fac_kuldeep, v_dept_id, 'FAC-CSE-005', 'KK', 'Mr. Kuldeep Kumar', 'Assistant Professor', 'kuldeep.cse@vctm.in', '9876543214', true),
        (v_fac_naseem, v_dept_id, 'FAC-CSE-006', 'NAK', 'Dr. Naseem Ahamad Khan', 'Associate Professor', 'naseem.math@vctm.in', '9876543215', true),
        (v_fac_shivani, v_dept_id, 'FAC-CSE-007', 'SHS', 'Ms. Shivani Sarswat', 'Assistant Professor', 'shivani.ash@vctm.in', '9876543216', true),
        (v_fac_gagandeep, v_dept_id, 'FAC-CSE-008', 'GDS', 'Mr. Gagandep Singh', 'Assistant Professor', 'gagandeep.cse@vctm.in', '9876543217', true),
        (v_fac_faizan, v_dept_id, 'FAC-CSE-009', 'FZN', 'Dr. Faizan Nasir', 'Assistant Professor', 'faizan.cse@vctm.in', '9876543218', true),
        (v_fac_praveen, v_dept_id, 'FAC-CSE-010', 'PRS', 'Mr. Praveen Sharma', 'Assistant Professor', 'praveen.cse@vctm.in', '9876543219', true),
        (v_fac_abhishek, v_dept_id, 'FAC-CSE-011', 'ABG', 'Dr. Abhishek Garg', 'Associate Professor', 'abhishek.cse@vctm.in', '9876543220', true)
    ON CONFLICT (employee_code) DO UPDATE SET full_name = EXCLUDED.full_name, faculty_code = EXCLUDED.faculty_code;

    -- Update Department HOD
    UPDATE public.departments SET hod_faculty_id = v_fac_wasim WHERE id = v_dept_id;

    -- 4. Insert Program (B.Tech)
    INSERT INTO public.programs (id, department_id, name, code, duration_years, active)
    VALUES (
        gen_random_uuid(),
        v_dept_id,
        'B.Tech in Computer Science & Engineering',
        'BTECH-CSE',
        4,
        true
    )
    ON CONFLICT (department_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_prog_id;

    -- 5. Insert Academic Session (2026-2027)
    INSERT INTO public.academic_sessions (id, name, start_date, end_date, is_current, active)
    VALUES (
        gen_random_uuid(),
        '2026-2027',
        '2026-08-01',
        '2027-06-30',
        true,
        true
    )
    ON CONFLICT (name) DO UPDATE SET is_current = EXCLUDED.is_current
    RETURNING id INTO v_session_id;

    -- 6. Insert Academic Year (2nd Year)
    INSERT INTO public.academic_years (id, program_id, year_number, name, active)
    VALUES (
        gen_random_uuid(),
        v_prog_id,
        2,
        '2nd Year',
        true
    )
    ON CONFLICT (program_id, year_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_year_id;

    -- 7. Insert Semester (3rd Semester / Odd Semester)
    INSERT INTO public.semesters (id, academic_year_id, semester_number, name, active)
    VALUES (
        gen_random_uuid(),
        v_year_id,
        3,
        '3rd Semester (Odd Semester 2026-2027)',
        true
    )
    ON CONFLICT (academic_year_id, semester_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sem_id;

    -- 8. Insert Sections (Section A & Section B)
    INSERT INTO public.sections (id, semester_id, name, room_number, class_coordinator_id, active)
    VALUES 
        (gen_random_uuid(), v_sem_id, 'A', 'Room No. A 007', v_fac_hemlata, true),
        (gen_random_uuid(), v_sem_id, 'B', 'Room No. A 006', v_fac_imran, true)
    ON CONFLICT (semester_id, name) DO UPDATE SET room_number = EXCLUDED.room_number, class_coordinator_id = EXCLUDED.class_coordinator_id;

    SELECT id INTO v_sec_a_id FROM public.sections WHERE semester_id = v_sem_id AND name = 'A';
    SELECT id INTO v_sec_b_id FROM public.sections WHERE semester_id = v_sem_id AND name = 'B';

    -- 9. Insert Subjects
    INSERT INTO public.subjects (id, program_id, department_id, semester_id, subject_code, subject_name, lecture_type, credits, active)
    VALUES
        (v_sub_maths, v_prog_id, v_dept_id, v_sem_id, 'BAS303', 'Mathematics IV (Maths 4)', 'Theory', 4.0, true),
        (v_sub_uhv, v_prog_id, v_dept_id, v_sem_id, 'BVE301', 'Universal Human Value (UHV)', 'Theory', 3.0, true),
        (v_sub_ds, v_prog_id, v_dept_id, v_sem_id, 'BCS301', 'Data Structure (DS)', 'Theory', 4.0, true),
        (v_sub_coa, v_prog_id, v_dept_id, v_sem_id, 'BCS302', 'Computer Organization & Architecture (COA)', 'Theory', 4.0, true),
        (v_sub_dstl, v_prog_id, v_dept_id, v_sem_id, 'BCS303', 'Discrete Structure & Theory of Logic (DSTL)', 'Theory', 4.0, true),
        (v_sub_dslab, v_prog_id, v_dept_id, v_sem_id, 'BCS351', 'Data Structure Lab (DS LAB)', 'Practical', 1.0, true),
        (v_sub_coalab, v_prog_id, v_dept_id, v_sem_id, 'BCS352', 'Computer Organization & Architecture Lab (COA LAB)', 'Practical', 1.0, true),
        (v_sub_wdws, v_prog_id, v_dept_id, v_sem_id, 'BCS353', 'Web Designing Workshop (WD WS)', 'Workshop', 1.0, true),
        (v_sub_cs, v_prog_id, v_dept_id, v_sem_id, 'BCC301', 'Cyber Security (CS)', 'Theory', 2.0, true),
        (v_sub_project, v_prog_id, v_dept_id, v_sem_id, 'BCC351', 'Internship Assessment / Mini Project', 'Project', 2.0, true)
    ON CONFLICT (subject_code, semester_id) DO UPDATE SET subject_name = EXCLUDED.subject_name;

    -- Fetch actual Subject IDs
    SELECT id INTO v_sub_maths FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BAS303';
    SELECT id INTO v_sub_uhv FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BVE301';
    SELECT id INTO v_sub_ds FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BCS301';
    SELECT id INTO v_sub_coa FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BCS302';
    SELECT id INTO v_sub_dstl FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BCS303';
    SELECT id INTO v_sub_dslab FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BCS351';
    SELECT id INTO v_sub_coalab FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BCS352';
    SELECT id INTO v_sub_wdws FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BCS353';
    SELECT id INTO v_sub_cs FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BCC301';
    SELECT id INTO v_sub_project FROM public.subjects WHERE semester_id = v_sem_id AND subject_code = 'BCC351';

    -- 10. Faculty Subject Assignments
    -- Section A Assignments
    INSERT INTO public.faculty_subject_assignments (faculty_id, subject_id, section_id, academic_session_id, active)
    VALUES
        (v_fac_naseem, v_sub_maths, v_sec_a_id, v_session_id, true),
        (v_fac_shivani, v_sub_uhv, v_sec_a_id, v_session_id, true),
        (v_fac_alok, v_sub_ds, v_sec_a_id, v_session_id, true),
        (v_fac_kuldeep, v_sub_coa, v_sec_a_id, v_session_id, true),
        (v_fac_hemlata, v_sub_dstl, v_sec_a_id, v_session_id, true),
        (v_fac_alok, v_sub_dslab, v_sec_a_id, v_session_id, true),
        (v_fac_alok, v_sub_coalab, v_sec_a_id, v_session_id, true),
        (v_fac_gagandeep, v_sub_wdws, v_sec_a_id, v_session_id, true),
        (v_fac_gagandeep, v_sub_cs, v_sec_a_id, v_session_id, true),
        (v_fac_faizan, v_sub_project, v_sec_a_id, v_session_id, true)
    ON CONFLICT DO NOTHING;

    -- Section B Assignments
    INSERT INTO public.faculty_subject_assignments (faculty_id, subject_id, section_id, academic_session_id, active)
    VALUES
        (v_fac_naseem, v_sub_maths, v_sec_b_id, v_session_id, true),
        (v_fac_shivani, v_sub_uhv, v_sec_b_id, v_session_id, true),
        (v_fac_hemlata, v_sub_ds, v_sec_b_id, v_session_id, true),
        (v_fac_kuldeep, v_sub_coa, v_sec_b_id, v_session_id, true),
        (v_fac_imran, v_sub_dstl, v_sec_b_id, v_session_id, true),
        (v_fac_hemlata, v_sub_dslab, v_sec_b_id, v_session_id, true),
        (v_fac_hemlata, v_sub_coalab, v_sec_b_id, v_session_id, true),
        (v_fac_gagandeep, v_sub_wdws, v_sec_b_id, v_session_id, true),
        (v_fac_praveen, v_sub_cs, v_sec_b_id, v_session_id, true),
        (v_fac_praveen, v_sub_project, v_sec_b_id, v_session_id, true)
    ON CONFLICT DO NOTHING;

    -- 11. Section A Timetable Entries (Room A 007)
    -- MON
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_a_id, v_sub_coa, v_fac_kuldeep, 'MON', 1, '09:00', '09:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_maths, v_fac_naseem, 'MON', 2, '09:50', '10:40', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_dstl, v_fac_hemlata, 'MON', 3, '10:40', '11:30', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_ds, v_fac_alok, 'MON', 4, '11:30', '12:20', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_uhv, v_fac_shivani, 'MON', 6, '13:10', '14:00', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_cs, v_fac_gagandeep, 'MON', 7, '14:00', '14:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_project, v_fac_faizan, 'MON', 8, '14:50', '15:40', 'Room A 007', 'Project')
    ON CONFLICT DO NOTHING;

    -- TUE
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_a_id, v_sub_coa, v_fac_kuldeep, 'TUE', 1, '09:00', '09:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_maths, v_fac_naseem, 'TUE', 2, '09:50', '10:40', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_dstl, v_fac_hemlata, 'TUE', 3, '10:40', '11:30', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_ds, v_fac_alok, 'TUE', 4, '11:30', '12:20', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_uhv, v_fac_shivani, 'TUE', 6, '13:10', '14:00', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_cs, v_fac_gagandeep, 'TUE', 7, '14:00', '14:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_project, v_fac_faizan, 'TUE', 8, '14:50', '15:40', 'Room A 007', 'Project')
    ON CONFLICT DO NOTHING;

    -- WED
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_a_id, v_sub_coa, v_fac_kuldeep, 'WED', 1, '09:00', '09:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_maths, v_fac_naseem, 'WED', 2, '09:50', '10:40', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_dstl, v_fac_hemlata, 'WED', 3, '10:40', '11:30', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_ds, v_fac_alok, 'WED', 4, '11:30', '12:20', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_uhv, v_fac_shivani, 'WED', 6, '13:10', '14:00', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_dslab, v_fac_alok, 'WED', 7, '14:00', '14:50', 'DS Lab', 'Practical'),
        (v_sec_a_id, v_sub_dslab, v_fac_alok, 'WED', 8, '14:50', '15:40', 'DS Lab', 'Practical')
    ON CONFLICT DO NOTHING;

    -- THU
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_a_id, v_sub_coa, v_fac_kuldeep, 'THU', 1, '09:00', '09:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_maths, v_fac_naseem, 'THU', 2, '09:50', '10:40', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_dstl, v_fac_hemlata, 'THU', 3, '10:40', '11:30', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_ds, v_fac_alok, 'THU', 4, '11:30', '12:20', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_uhv, v_fac_shivani, 'THU', 6, '13:10', '14:00', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_maths, v_fac_naseem, 'THU', 7, '14:00', '14:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_cs, v_fac_gagandeep, 'THU', 8, '14:50', '15:40', 'Room A 007', 'Theory')
    ON CONFLICT DO NOTHING;

    -- FRI
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_a_id, v_sub_coa, v_fac_kuldeep, 'FRI', 1, '09:00', '09:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_maths, v_fac_naseem, 'FRI', 2, '09:50', '10:40', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_dstl, v_fac_hemlata, 'FRI', 3, '10:40', '11:30', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_ds, v_fac_alok, 'FRI', 4, '11:30', '12:20', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_cs, v_fac_gagandeep, 'FRI', 6, '13:10', '14:00', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_wdws, v_fac_gagandeep, 'FRI', 7, '14:00', '14:50', 'Web Lab', 'Workshop'),
        (v_sec_a_id, v_sub_wdws, v_fac_gagandeep, 'FRI', 8, '14:50', '15:40', 'Web Lab', 'Workshop')
    ON CONFLICT DO NOTHING;

    -- SAT
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_a_id, v_sub_coa, v_fac_kuldeep, 'SAT', 1, '09:00', '09:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_maths, v_fac_naseem, 'SAT', 2, '09:50', '10:40', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_dstl, v_fac_hemlata, 'SAT', 3, '10:40', '11:30', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_ds, v_fac_alok, 'SAT', 4, '11:30', '12:20', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_coalab, v_fac_alok, 'SAT', 6, '13:10', '14:00', 'COA Lab', 'Practical'),
        (v_sec_a_id, v_sub_cs, v_fac_gagandeep, 'SAT', 7, '14:00', '14:50', 'Room A 007', 'Theory'),
        (v_sec_a_id, v_sub_project, v_fac_faizan, 'SAT', 8, '14:50', '15:40', 'Ground', 'Sports')
    ON CONFLICT DO NOTHING;

    -- 12. Section B Timetable Entries (Room A 006)
    -- MON
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_b_id, v_sub_ds, v_fac_hemlata, 'MON', 1, '09:00', '09:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_coa, v_fac_kuldeep, 'MON', 2, '09:50', '10:40', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_maths, v_fac_naseem, 'MON', 3, '10:40', '11:30', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_dstl, v_fac_imran, 'MON', 4, '11:30', '12:20', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_cs, v_fac_praveen, 'MON', 6, '13:10', '14:00', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_uhv, v_fac_shivani, 'MON', 7, '14:00', '14:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_wdws, v_fac_gagandeep, 'MON', 8, '14:50', '15:40', 'Web Lab', 'Workshop')
    ON CONFLICT DO NOTHING;

    -- TUE
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_b_id, v_sub_ds, v_fac_hemlata, 'TUE', 1, '09:00', '09:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_coa, v_fac_kuldeep, 'TUE', 2, '09:50', '10:40', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_maths, v_fac_naseem, 'TUE', 3, '10:40', '11:30', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_dstl, v_fac_imran, 'TUE', 4, '11:30', '12:20', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_cs, v_fac_praveen, 'TUE', 6, '13:10', '14:00', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_uhv, v_fac_shivani, 'TUE', 7, '14:00', '14:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_wdws, v_fac_gagandeep, 'TUE', 8, '14:50', '15:40', 'Web Lab', 'Workshop')
    ON CONFLICT DO NOTHING;

    -- WED
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_b_id, v_sub_ds, v_fac_hemlata, 'WED', 1, '09:00', '09:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_coa, v_fac_kuldeep, 'WED', 2, '09:50', '10:40', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_maths, v_fac_naseem, 'WED', 3, '10:40', '11:30', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_dstl, v_fac_imran, 'WED', 4, '11:30', '12:20', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_cs, v_fac_praveen, 'WED', 6, '13:10', '14:00', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_uhv, v_fac_shivani, 'WED', 7, '14:00', '14:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_maths, v_fac_naseem, 'WED', 8, '14:50', '15:40', 'Room A 006', 'Theory')
    ON CONFLICT DO NOTHING;

    -- THU
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_b_id, v_sub_ds, v_fac_hemlata, 'THU', 1, '09:00', '09:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_coa, v_fac_kuldeep, 'THU', 2, '09:50', '10:40', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_maths, v_fac_naseem, 'THU', 3, '10:40', '11:30', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_dstl, v_fac_imran, 'THU', 4, '11:30', '12:20', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_cs, v_fac_praveen, 'THU', 6, '13:10', '14:00', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_dslab, v_fac_hemlata, 'THU', 7, '14:00', '14:50', 'DS Lab', 'Practical'),
        (v_sec_b_id, v_sub_dslab, v_fac_hemlata, 'THU', 8, '14:50', '15:40', 'DS Lab', 'Practical')
    ON CONFLICT DO NOTHING;

    -- FRI
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_b_id, v_sub_ds, v_fac_hemlata, 'FRI', 1, '09:00', '09:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_coa, v_fac_kuldeep, 'FRI', 2, '09:50', '10:40', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_maths, v_fac_naseem, 'FRI', 3, '10:40', '11:30', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_dstl, v_fac_imran, 'FRI', 4, '11:30', '12:20', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_uhv, v_fac_shivani, 'FRI', 6, '13:10', '14:00', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_coalab, v_fac_hemlata, 'FRI', 7, '14:00', '14:50', 'COA Lab', 'Practical'),
        (v_sec_b_id, v_sub_coalab, v_fac_hemlata, 'FRI', 8, '14:50', '15:40', 'COA Lab', 'Practical')
    ON CONFLICT DO NOTHING;

    -- SAT
    INSERT INTO public.timetable_entries (section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type)
    VALUES
        (v_sec_b_id, v_sub_ds, v_fac_hemlata, 'SAT', 1, '09:00', '09:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_coa, v_fac_kuldeep, 'SAT', 2, '09:50', '10:40', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_maths, v_fac_naseem, 'SAT', 3, '10:40', '11:30', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_project, v_fac_praveen, 'SAT', 4, '11:30', '12:20', 'Room A 006', 'Project'),
        (v_sec_b_id, v_sub_cs, v_fac_praveen, 'SAT', 6, '13:10', '14:00', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_dstl, v_fac_imran, 'SAT', 7, '14:00', '14:50', 'Room A 006', 'Theory'),
        (v_sec_b_id, v_sub_project, v_fac_praveen, 'SAT', 8, '14:50', '15:40', 'Ground', 'Sports')
    ON CONFLICT DO NOTHING;

    -- 13. Section A Students (53 Students)
    -- Group 1: Mentor Ms. Hemlata Chaudhary
    INSERT INTO public.students (institution_id, department_id, program_id, academic_session_id, academic_year_id, semester_id, section_id, roll_number, full_name, admission_type, mentor_faculty_id) VALUES
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2403400100021', 'HIMANSHU', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2403400100035', 'MUNTAKHAB ALI ZAIDI', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2403400100040', 'PRANSHU KUMAR', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2403400100047', 'SHAZEB', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100001', 'ADITYA KISHOR SARASWAT', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100003', 'AKSHAY KUMAR', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100004', 'ALMAZ ZAKIR', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100005', 'AMAN RAJ SINGH', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100006', 'ARFIA TASNEEM', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100007', 'ARPIT', 'Regular', v_fac_hemlata),
    
    -- Group 2: Mentor Mr. Alok Gupta
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100009', 'AVNISH KAUSHIK', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100010', 'BHARAT RAJPOOT', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100011', 'BHAVYA SHARMA', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100012', 'BHOOMIKA VASHISHTHA', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100014', 'DIVYANSHU CHAUDHARY', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100015', 'EVAD', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100016', 'HANIA RAHIM', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100017', 'HARDIK VASHISHTHA', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100018', 'HASSAN AHMAD KHAN', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100019', 'KAYARA SINGH JADAUN', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100020', 'KHAGESH KUMAR SHARMA', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100021', 'KOMAL', 'Regular', v_fac_alok),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100022', 'LAVI SHARMA', 'Regular', v_fac_alok),

    -- Group 3: Mentor Mr. Imran Raza Khan
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100023', 'MADHAV VASHISHTHA', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100024', 'MANISH KUMAR', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100025', 'MANU SARSWAT', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100026', 'MAYANK SINGH', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100027', 'MOHAMMAD ADEEM', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100028', 'MOHAMMAD USMAN GHANI', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100029', 'MOHAMMED AHMED IQBAL', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100030', 'MOHD AARIZ ATEEQ', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100031', 'MOHD AFNAN', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100032', 'MOHD ANAS', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100034', 'MOHD ARSALAN', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100035', 'MOHD DANIYAL KHAN', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100036', 'MOHD OWAIS', 'Regular', v_fac_imran),

    -- Group 4: Mentor Dr. Abhishek Garg
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100037', 'MOHD SADIQUE', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100038', 'NAVEEN KUMAR', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100039', 'PAURVI SHARMA', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100040', 'PRINCE', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100041', 'PRIYA THAKUR', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100042', 'PRIYANKA', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100043', 'PRIYANKA THAKUR', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100044', 'SAGAR KUMAR', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100045', 'SAMEER KUMAR', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100046', 'SATYAM SINGH', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100047', 'SHADAB KHAN', 'Regular', v_fac_abhishek),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2503400100048', 'SHAILENDRA KUMAR SINGH', 'Regular', v_fac_abhishek),

    -- Group 5: Lateral Entry, Mentor Dr. Faizan Nasir
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2603400109001', 'AHMAD SHEERZ', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2603400109002', 'AMAN SARSWAT', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2603400109003', 'DEEKSHA KUSHWAHA', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2603400109004', 'FARDEEN', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_a_id, '2603400109005', 'GAURAV KUMAR', 'Lateral Entry', v_fac_faizan)
    ON CONFLICT (roll_number) DO UPDATE SET full_name = EXCLUDED.full_name, mentor_faculty_id = EXCLUDED.mentor_faculty_id;

    -- 14. Section B Students (53 Students)
    -- Group 1: Mentor Mr. Kuldeep Kumar
    INSERT INTO public.students (institution_id, department_id, program_id, academic_session_id, academic_year_id, semester_id, section_id, roll_number, full_name, admission_type, mentor_faculty_id) VALUES
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2403400130012', 'LUBHNESH KUMAR', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100049', 'SHAYAN HASAN', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100050', 'SHIV KUMAR', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100051', 'SHIVAM KUMAR', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100052', 'SHOAIB', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100053', 'SHRADDHA JADON', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100054', 'SHRUTI VASHISHTH', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100055', 'SOHAIL KHAN', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100056', 'SUMANT SINGH', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100057', 'TARUN KUSHWAH', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100058', 'UJJWAL MALHOTRA', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100060', 'VAISHNAVI GAUTAM', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100061', 'VANDANA KUMARI', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100062', 'VEEKESH SINGH', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100063', 'VEER SINGH', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100064', 'VINAY KUMAR', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100065', 'YASH GUPTA', 'Regular', v_fac_kuldeep),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400100066', 'YOGESHWARI', 'Regular', v_fac_kuldeep),

    -- Group 2: Mentor Mr. Praveen Sharma
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130001', 'AIMAN JAVED', 'Regular', v_fac_praveen),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130003', 'DHANANJAY SAHU', 'Regular', v_fac_praveen),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130004', 'MD SHAHEER AFSAR', 'Regular', v_fac_praveen),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130005', 'MOHAMMAD ZAID KHAN', 'Regular', v_fac_praveen),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130006', 'MOHD DANIYAL ABBAS ZAIDI', 'Regular', v_fac_praveen),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130008', 'NANDANI RAO', 'Regular', v_fac_praveen),

    -- Group 3: Mentor Ms. Hemlata Chaudhary
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130009', 'PAWAN KUMAR', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130010', 'PRIYANKA RAJ', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130011', 'RAJAT SINGH', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130012', 'SADHANA KUMARI', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130013', 'SAMAD', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130014', 'SANIYA ISHRAT', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130015', 'SHIKHER CHANDEL', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130016', 'SHIVAM SHARMA', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130017', 'SHUBHAM KUMAR', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130018', 'SHYAM SINGH', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130019', 'SUBHAN SADIQ', 'Regular', v_fac_hemlata),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130020', 'SUMIT PRATAP SINGH', 'Regular', v_fac_hemlata),

    -- Group 4: Mentor Mr. Imran Raza Khan
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130021', 'TAIYABA YUSUF', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130022', 'TANYA SAXENA', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130023', 'VINEET KUMAR', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130024', 'VIVEK KUMAR', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130025', 'YASH KUMAR', 'Regular', v_fac_imran),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2503400130026', 'ZAID FAROOQ', 'Regular', v_fac_imran),

    -- Group 5: Lateral Entry, Mentor Dr. Faizan Nasir
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139001', 'MUHAMMAD AMAAN KHAN', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139002', 'ASHISH KUMAR', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139003', 'BHAVANA GAUTAM', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139004', 'BHUMI SINGH', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139005', 'KARTIK GAUR', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139006', 'LAXMI SINGH', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139007', 'SAMBHAV VARSHNEY', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139008', 'SURAJ BHAN RAJPUT', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139009', 'TARUN PRATAP', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139010', 'UVAID', 'Lateral Entry', v_fac_faizan),
    (v_inst_id, v_dept_id, v_prog_id, v_session_id, v_year_id, v_sem_id, v_sec_b_id, '2603400139011', 'VIKRANT SINGH', 'Lateral Entry', v_fac_faizan)
    ON CONFLICT (roll_number) DO UPDATE SET full_name = EXCLUDED.full_name, mentor_faculty_id = EXCLUDED.mentor_faculty_id;

    RAISE NOTICE 'VCTM B.Tech CSE Odd Semester 2026-2027 seed data successfully populated!';
END $$;

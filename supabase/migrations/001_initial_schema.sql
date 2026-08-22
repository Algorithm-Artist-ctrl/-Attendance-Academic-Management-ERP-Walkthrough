-- VCTM Attendance & Academic Management ERP
-- Migration 001: Initial Schema & RLS Policies
-- Designed for complete multi-department, multi-course scalability

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================================
-- 1. CUSTOM TYPES & ENUMS
-- ========================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'hod', 'faculty', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lecture_type AS ENUM ('Theory', 'Practical', 'Workshop', 'Tutorial', 'Project', 'Sports');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admission_type AS ENUM ('Regular', 'Lateral Entry');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('Present', 'Absent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE correction_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE day_of_week_enum AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================================
-- 2. ACADEMIC STRUCTURE TABLES
-- ========================================================

-- Institutions (VCTM College Code 340)
CREATE TABLE IF NOT EXISTS public.institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    website VARCHAR(255) DEFAULT 'https://vctm.in/',
    logo_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments (CSE, Electrical, Mechanical, ECE, MBA, etc.)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    hod_faculty_id UUID, -- References faculty(id) added via FK later
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_dept_institution_code UNIQUE (institution_id, code)
);

-- Programs / Courses (B.Tech, M.Tech, MBA, MCA, Diploma, etc.)
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    duration_years INT NOT NULL DEFAULT 4,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_program_dept_code UNIQUE (department_id, code)
);

-- Academic Sessions (e.g. 2026-2027)
CREATE TABLE IF NOT EXISTS public.academic_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Academic Years (1st Year, 2nd Year, 3rd Year, 4th Year)
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    year_number INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_year_program_number UNIQUE (program_id, year_number)
);

-- Semesters (1st to 8th Semester)
CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_number INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_semester_year_number UNIQUE (academic_year_id, semester_number)
);

-- Faculty Directory
CREATE TABLE IF NOT EXISTS public.faculty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- linked to Supabase auth.users if account exists
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    faculty_code VARCHAR(20), -- Timetable short code (HEM, IRK, ALG, KK, etc.)
    full_name VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL DEFAULT 'Assistant Professor',
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Foreign Key for HOD back to departments
ALTER TABLE public.departments
    ADD CONSTRAINT fk_dept_hod FOREIGN KEY (hod_faculty_id) REFERENCES public.faculty(id) ON DELETE SET NULL;

-- Sections (Section A, Section B, etc.)
CREATE TABLE IF NOT EXISTS public.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    room_number VARCHAR(50),
    class_coordinator_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_section_semester_name UNIQUE (semester_id, name)
);

-- Subjects Directory
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    subject_code VARCHAR(50) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    lecture_type lecture_type NOT NULL DEFAULT 'Theory',
    credits NUMERIC(3,1) NOT NULL DEFAULT 4.0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_subject_code_sem UNIQUE (subject_code, semester_id)
);

-- Faculty-Subject Assignments
CREATE TABLE IF NOT EXISTS public.faculty_subject_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_faculty_subject_section_session UNIQUE (faculty_id, subject_id, section_id, academic_session_id)
);

-- Students Directory
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- linked to Supabase auth.users
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    roll_number VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    admission_type admission_type NOT NULL DEFAULT 'Regular',
    mentor_faculty_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timetable Entries
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
    day_of_week day_of_week_enum NOT NULL,
    period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 8),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_number VARCHAR(50) NOT NULL,
    lecture_type lecture_type NOT NULL DEFAULT 'Theory',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_timetable_section_day_period UNIQUE (section_id, day_of_week, period_number)
);

-- ========================================================
-- 3. ATTENDANCE & CORRECTION TABLES
-- ========================================================

-- Attendance Sessions
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_entry_id UUID REFERENCES public.timetable_entries(id) ON DELETE SET NULL,
    faculty_id UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_attendance_session_unique UNIQUE (section_id, subject_id, faculty_id, session_date, timetable_entry_id)
);

-- Attendance Records
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status attendance_status NOT NULL,
    marked_by UUID NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_session_student UNIQUE (attendance_session_id, student_id)
);

-- Attendance Corrections
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    requested_status attendance_status NOT NULL,
    reason TEXT NOT NULL,
    status correction_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- 4. PROFILES & AUDIT LOGS
-- ========================================================

-- User Profiles (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY, -- Matches auth.users.id
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(20),
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    faculty_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID, -- References profiles(id)
    actor_name VARCHAR(255),
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- 5. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_students_roll ON public.students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_section ON public.students(section_id);
CREATE INDEX IF NOT EXISTS idx_students_dept ON public.students(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_emp_code ON public.faculty(employee_code);
CREATE INDEX IF NOT EXISTS idx_faculty_dept ON public.faculty(department_id);
CREATE INDEX IF NOT EXISTS idx_timetable_section_day ON public.timetable_entries(section_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_faculty ON public.timetable_entries(faculty_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON public.attendance_sessions(session_date, section_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON public.attendance_records(student_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON public.attendance_records(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_corrections_student ON public.attendance_corrections(student_id, status);
CREATE INDEX IF NOT EXISTS idx_corrections_record ON public.attendance_corrections(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ========================================================
-- 6. SECURITY HELPER FUNCTIONS
-- ========================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_faculty_id()
RETURNS UUID AS $$
    SELECT faculty_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_student_id()
RETURNS UUID AS $$
    SELECT student_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_department_id()
RETURNS UUID AS $$
    SELECT department_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if a faculty is assigned to a subject and section
CREATE OR REPLACE FUNCTION public.is_assigned_faculty(p_faculty_id UUID, p_section_id UUID, p_subject_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.faculty_subject_assignments
        WHERE faculty_id = p_faculty_id
          AND section_id = p_section_id
          AND subject_id = p_subject_id
          AND active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Trigger function for attendance correction approval
CREATE OR REPLACE FUNCTION public.handle_correction_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Update the actual attendance record
        UPDATE public.attendance_records
        SET status = NEW.requested_status,
            updated_at = NOW(),
            remarks = COALESCE(remarks || ' | ', '') || 'Corrected on ' || to_char(NOW(), 'YYYY-MM-DD HH24:MI') || ' by faculty'
        WHERE id = NEW.attendance_record_id;

        -- Create an audit record
        INSERT INTO public.audit_logs (
            actor_id,
            action,
            entity_type,
            entity_id,
            old_values,
            new_values
        ) VALUES (
            auth.uid(),
            'CORRECTION_APPROVED',
            'attendance_records',
            NEW.attendance_record_id,
            jsonb_build_object('previous_status', OLD.requested_status, 'record_id', NEW.attendance_record_id),
            jsonb_build_object('new_status', NEW.requested_status, 'reviewed_by', NEW.reviewed_by, 'remarks', NEW.review_remarks)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_correction_approval ON public.attendance_corrections;
CREATE TRIGGER trg_correction_approval
    AFTER UPDATE OF status ON public.attendance_corrections
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
    EXECUTE FUNCTION public.handle_correction_approval();

-- ========================================================
-- 7. ROW-LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- Enable RLS on all tables
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Users can view own profile or admins view all"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id
        OR public.current_user_role() IN ('super_admin', 'hod')
    );

CREATE POLICY "Users can update own basic profile info"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Super admin can insert and delete profiles"
    ON public.profiles FOR ALL
    USING (public.current_user_role() = 'super_admin');

-- 2. Academic Master Data (Institutions, Depts, Programs, Sessions, Years, Semesters, Sections, Subjects)
-- Public / Authenticated read access, Super Admin / HOD write access
CREATE POLICY "Authenticated users can read institutions"
    ON public.institutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage institutions"
    ON public.institutions FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can read departments"
    ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage departments"
    ON public.departments FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can read programs"
    ON public.programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage programs"
    ON public.programs FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can read sessions"
    ON public.academic_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage sessions"
    ON public.academic_sessions FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can read academic years"
    ON public.academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage academic years"
    ON public.academic_years FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can read semesters"
    ON public.semesters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage semesters"
    ON public.semesters FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can read sections"
    ON public.sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage sections"
    ON public.sections FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can read subjects"
    ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage subjects"
    ON public.subjects FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

-- 3. Faculty Policies
CREATE POLICY "Authenticated users can view faculty list"
    ON public.faculty FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin and HOD can manage faculty"
    ON public.faculty FOR ALL TO authenticated
    USING (
        public.current_user_role() = 'super_admin'
        OR (public.current_user_role() = 'hod' AND department_id = public.current_user_department_id())
    );

-- 4. Faculty Subject Assignments
CREATE POLICY "Authenticated users can view faculty assignments"
    ON public.faculty_subject_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage faculty assignments"
    ON public.faculty_subject_assignments FOR ALL TO authenticated
    USING (public.current_user_role() = 'super_admin');

-- 5. Students Policies
CREATE POLICY "Students view own profile, faculty/hod/admin view students"
    ON public.students FOR SELECT TO authenticated
    USING (
        public.current_user_role() = 'super_admin'
        OR (public.current_user_role() = 'hod' AND department_id = public.current_user_department_id())
        OR (public.current_user_role() = 'faculty')
        OR (public.current_user_role() = 'student' AND id = public.current_user_student_id())
    );

CREATE POLICY "Super admin and HOD can manage students"
    ON public.students FOR ALL TO authenticated
    USING (
        public.current_user_role() = 'super_admin'
        OR (public.current_user_role() = 'hod' AND department_id = public.current_user_department_id())
    );

-- 6. Timetable Policies
CREATE POLICY "Authenticated users can view timetable"
    ON public.timetable_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin and HOD can manage timetable"
    ON public.timetable_entries FOR ALL TO authenticated
    USING (
        public.current_user_role() = 'super_admin'
        OR public.current_user_role() = 'hod'
    );

-- 7. Attendance Sessions Policies
CREATE POLICY "Users can view attendance sessions"
    ON public.attendance_sessions FOR SELECT TO authenticated
    USING (
        public.current_user_role() IN ('super_admin', 'hod', 'faculty')
        OR (public.current_user_role() = 'student' AND section_id IN (
            SELECT section_id FROM public.students WHERE id = public.current_user_student_id()
        ))
    );

CREATE POLICY "Assigned faculty can create attendance sessions"
    ON public.attendance_sessions FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = 'super_admin'
        OR (
            public.current_user_role() = 'faculty' 
            AND faculty_id = public.current_user_faculty_id()
            AND public.is_assigned_faculty(faculty_id, section_id, subject_id)
        )
    );

CREATE POLICY "Faculty can update own attendance sessions"
    ON public.attendance_sessions FOR UPDATE TO authenticated
    USING (
        public.current_user_role() = 'super_admin'
        OR (public.current_user_role() = 'faculty' AND faculty_id = public.current_user_faculty_id())
    );

-- 8. Attendance Records Policies
CREATE POLICY "Students can view only their own attendance records"
    ON public.attendance_records FOR SELECT TO authenticated
    USING (
        public.current_user_role() IN ('super_admin', 'hod')
        OR (public.current_user_role() = 'faculty')
        OR (public.current_user_role() = 'student' AND student_id = public.current_user_student_id())
    );

CREATE POLICY "Assigned faculty can insert attendance records"
    ON public.attendance_records FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = 'super_admin'
        OR (public.current_user_role() = 'faculty' AND marked_by = public.current_user_faculty_id())
    );

CREATE POLICY "Assigned faculty or admin can update attendance records"
    ON public.attendance_records FOR UPDATE TO authenticated
    USING (
        public.current_user_role() = 'super_admin'
        OR (public.current_user_role() = 'faculty' AND marked_by = public.current_user_faculty_id())
    );

-- 9. Attendance Corrections Policies
CREATE POLICY "Students can view own requests, faculty/hod/admin view relevant"
    ON public.attendance_corrections FOR SELECT TO authenticated
    USING (
        public.current_user_role() IN ('super_admin', 'hod')
        OR (public.current_user_role() = 'faculty')
        OR (public.current_user_role() = 'student' AND student_id = public.current_user_student_id())
    );

CREATE POLICY "Students can insert own correction requests"
    ON public.attendance_corrections FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = 'student' 
        AND student_id = public.current_user_student_id()
    );

CREATE POLICY "Faculty and admin can update correction requests (review)"
    ON public.attendance_corrections FOR UPDATE TO authenticated
    USING (
        public.current_user_role() IN ('super_admin', 'faculty', 'hod')
    );

-- 10. Audit Logs Policies
CREATE POLICY "Admins and HODs can view audit logs"
    ON public.audit_logs FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('super_admin', 'hod'));

CREATE POLICY "System and authorized users can insert audit logs"
    ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (true);

export type UserRole = 'super_admin' | 'hod' | 'faculty' | 'student';

export type LectureType = 'Theory' | 'Practical' | 'Workshop' | 'Tutorial' | 'Project' | 'Sports';

export type AdmissionType = 'Regular' | 'Lateral Entry';

export type AttendanceStatus = 'Present' | 'Absent';

export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface Institution {
  id: string;
  name: string;
  code: string;
  address: string;
  website: string;
  logo_url?: string;
  active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  institution_id: string;
  name: string;
  code: string;
  hod_faculty_id?: string;
  active: boolean;
  created_at: string;
  hod?: Faculty;
}

export interface Program {
  id: string;
  department_id: string;
  name: string;
  code: string;
  duration_years: number;
  active: boolean;
  created_at: string;
}

export interface AcademicSession {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  active: boolean;
}

export interface AcademicYear {
  id: string;
  program_id: string;
  year_number: number;
  name: string;
  active: boolean;
}

export interface Semester {
  id: string;
  academic_year_id: string;
  semester_number: number;
  name: string;
  active: boolean;
}

export interface Section {
  id: string;
  semester_id: string;
  name: string;
  room_number: string;
  class_coordinator_id?: string;
  active: boolean;
  class_coordinator?: Faculty;
}

export interface Subject {
  id: string;
  program_id: string;
  department_id: string;
  semester_id: string;
  subject_code: string;
  subject_name: string;
  lecture_type: LectureType;
  credits: number;
  active: boolean;
}

export interface Faculty {
  id: string;
  auth_user_id?: string;
  department_id: string;
  employee_code: string;
  faculty_code?: string;
  full_name: string;
  designation: string;
  email: string;
  phone?: string;
  active: boolean;
  department?: Department;
}

export interface FacultySubjectAssignment {
  id: string;
  faculty_id: string;
  subject_id: string;
  section_id: string;
  academic_session_id: string;
  active: boolean;
  faculty?: Faculty;
  subject?: Subject;
  section?: Section;
}

export interface Student {
  id: string;
  auth_user_id?: string;
  institution_id: string;
  department_id: string;
  program_id: string;
  academic_session_id: string;
  academic_year_id: string;
  semester_id: string;
  section_id: string;
  roll_number: string;
  full_name: string;
  admission_type: AdmissionType;
  mentor_faculty_id?: string;
  email?: string;
  phone?: string;
  active: boolean;
  created_at: string;
  section?: Section;
  mentor?: Faculty;
  department?: Department;
}

export interface TimetableEntry {
  id: string;
  section_id: string;
  subject_id: string;
  faculty_id: string;
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  room_number: string;
  lecture_type: LectureType;
  active: boolean;
  subject?: Subject;
  faculty?: Faculty;
  section?: Section;
}

export interface AttendanceSession {
  id: string;
  timetable_entry_id?: string;
  faculty_id: string;
  section_id: string;
  subject_id: string;
  session_date: string;
  start_time?: string;
  end_time?: string;
  status: 'completed' | 'cancelled';
  marked_at: string;
  created_at: string;
  faculty?: Faculty;
  subject?: Subject;
  section?: Section;
}

export interface AttendanceRecord {
  id: string;
  attendance_session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_by: string;
  marked_at: string;
  remarks?: string;
  student?: Student;
  session?: AttendanceSession;
}

export interface AttendanceCorrection {
  id: string;
  attendance_record_id: string;
  student_id: string;
  requested_status: AttendanceStatus;
  reason: string;
  status: CorrectionStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_remarks?: string;
  created_at: string;
  student?: Student;
  record?: AttendanceRecord;
  reviewer?: Faculty;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  department_id?: string;
  student_id?: string;
  faculty_id?: string;
  student?: Student;
  faculty?: Faculty;
}

export interface TimetableVersion {
  id: string;
  department_id: string;
  section_id: string;
  version_number: number;
  effective_from: string;
  status: 'draft' | 'active' | 'archived';
  uploaded_by?: string;
  approved_by?: string;
  approved_at?: string;
  source_file_url?: string;
  changes_summary?: Record<string, any>;
  created_at: string;
  updated_at: string;
  section?: Section;
  department?: Department;
}

export interface TimetableImport {
  id: string;
  file_name: string;
  file_url?: string;
  department_id?: string;
  section_id?: string;
  status: 'uploaded' | 'processing' | 'parsed' | 'needs_review' | 'approved' | 'rejected' | 'failed';
  extracted_data?: Record<string, any>;
  validation_report?: Record<string, any>;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}


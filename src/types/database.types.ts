export type UserRole = 'super_admin' | 'hod' | 'faculty' | 'student';

export type AccountStatus = 
  | 'ACTIVE' 
  | 'BLOCKED' 
  | 'ARCHIVED' 
  | 'PENDING' 
  | 'SUSPENDED' 
  | 'WITHDRAWN' 
  | 'TRANSFERRED' 
  | 'DROPPED_OUT' 
  | 'GRADUATED' 
  | 'RESIGNED' 
  | 'RETIRED'
  | 'TERMINATED'
  | 'ON_LEAVE' 
  | 'ALUMNI';

export type LectureType = 'Theory' | 'Practical' | 'Workshop' | 'Tutorial' | 'Project' | 'Sports' | 'Lunch' | 'Other' | 'Break';

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

export interface Classroom {
  id: string;
  room_number: string;
  building?: string;
  floor?: string;
  capacity?: number;
  room_type?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Section {
  id: string;
  semester_id: string;
  name: string;
  room_number: string;
  classroom_id?: string;
  class_coordinator_id?: string;
  active: boolean;
  class_coordinator?: Faculty;
  classroom?: Classroom;
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
  status?: AccountStatus;
  exit_date?: string | null;
  exit_reason?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  department?: Department;
}

export interface FacultySubjectAssignment {
  id: string;
  faculty_id: string;
  subject_id: string;
  section_id: string;
  academic_session_id: string;
  department_id?: string;
  program_id?: string;
  academic_year_id?: string;
  semester_id?: string;
  active: boolean;
  faculty?: Faculty;
  subject?: Subject;
  section?: Section;
  semester?: Semester;
  academic_year?: AcademicYear;
  created_at?: string;
  updated_at?: string;
}

export interface ClassCoordinatorAssignment {
  id: string;
  faculty_id: string;
  section_id: string;
  academic_session_id?: string;
  academic_year_id?: string;
  assigned_by?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  faculty?: Faculty;
  section?: Section;
  academic_session?: AcademicSession;
  academic_year?: AcademicYear;
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
  enrollment_number?: string;
  admission_number?: string;
  full_name: string;
  admission_type: AdmissionType;
  mentor_faculty_id?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  active: boolean;
  status?: AccountStatus;
  exit_date?: string | null;
  exit_reason?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  created_at: string;
  section?: Section;
  mentor?: Faculty;
  department?: Department;
}

export interface TimetableEntry {
  id: string;
  section_id: string;
  subject_id?: string | null;
  faculty_id?: string | null;
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  room_number: string;
  classroom_id?: string | null;
  lecture_type: LectureType;
  active: boolean;
  is_break?: boolean;
  subject?: Subject;
  faculty?: Faculty;
  section?: Section;
  classroom?: Classroom;
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
  status?: 'completed' | 'cancelled' | 'pending';
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
  created_at?: string;
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
  record?: AttendanceRecord & {
    session?: AttendanceSession & {
      subject?: Subject;
      section?: Section;
      faculty?: Faculty;
    };
  };
  reviewer?: Faculty;
}

export interface StudentAttendanceHistoryRecord {
  recordId: string;
  sessionId: string;
  sessionDate: string;
  startTime?: string;
  endTime?: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  sectionId: string;
  sectionName: string;
  status: 'Present' | 'Absent' | 'Not Marked' | 'Cancelled';
  rawStatus: AttendanceStatus | 'Not Marked';
  remarks?: string;
  claimStatus?: CorrectionStatus;
  claimId?: string;
  claimReason?: string;
  claimRemarks?: string;
}

export interface StudentAttendanceHistorySummary {
  studentId: string;
  rollNumber: string;
  fullName: string;
  sectionName: string;
  yearName: string;
  totalLectures: number;
  presentCount: number;
  absentCount: number;
  notMarkedCount: number;
  cancelledCount: number;
  eligibleConducted: number;
  attendancePercentage: number | null;
  records: StudentAttendanceHistoryRecord[];
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
  status?: AccountStatus;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  new_email?: string | null;
  pending_email?: string | null;
  exit_date?: string | null;
  exit_reason?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
}

export interface AdminAccountDirectoryEntry {
  user_id: string;
  email: string;
  role: UserRole;
  full_name: string;
  status: AccountStatus;
  last_sign_in_at: string | null;
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  employee_code?: string | null;
  designation?: string | null;
  roll_number?: string | null;
  year_number?: number | null;
  academic_year_name?: string | null;
  section_name?: string | null;
  section_id?: string | null;
  exit_date?: string | null;
  exit_reason?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  created_at: string;
}

export interface AccountLifecycleEntry {
  id: string;
  user_id?: string | null;
  entity_type: 'student' | 'faculty' | 'profile';
  entity_id: string;
  old_status?: string | null;
  previous_status?: string | null;
  new_status: AccountStatus;
  reason?: string | null;
  effective_date: string;
  performed_by?: string | null;
  performer?: { full_name: string; role: string };
  created_at: string;
  metadata?: Record<string, any>;
}

export interface ArchivedStats {
  former_students: number;
  former_faculty: number;
  graduated_students: number;
  graduated_alumni?: number;
  withdrawn_students: number;
  transferred_students: number;
  dropped_out_students: number;
  resigned_faculty: number;
  departures_this_year?: number;
  total_archived: number;
}

export interface ArchivedRecordItem {
  id: string;
  auth_user_id?: string | null;
  name: string;
  role: 'student' | 'faculty';
  identifier: string; // roll_number or employee_code
  registration_number?: string;
  department_id?: string;
  department_name?: string;
  department_code?: string;
  program_name?: string;
  year_name?: string;
  section_name?: string;
  designation?: string;
  email?: string;
  phone?: string;
  status: AccountStatus;
  last_active_date?: string | null;
  exit_date?: string | null;
  exit_reason?: string | null;
  archived_at?: string | null;
  archived_by_id?: string | null;
  archived_by_name?: string;
  created_at: string;
}

export interface StudentFullHistoricalRecord {
  student: Student;
  profile?: UserProfile | null;
  academic_history: any[];
  attendance: {
    total_conducted: number;
    total_attended: number;
    percentage: number;
    subject_wise: Array<{
      subject_id: string;
      subject_name: string;
      subject_code: string;
      conducted: number;
      attended: number;
      percentage: number;
    }>;
    recent_sessions: any[];
  };
  marks: {
    sessional_assessments: any[];
    quizzes: any[];
    assignments: any[];
  };
  leaves: any[];
  timetable: any[];
  lifecycle_history: AccountLifecycleEntry[];
  audit_logs: AuditLog[];
}

export interface FacultyFullHistoricalRecord {
  faculty: Faculty;
  profile?: UserProfile | null;
  subject_assignments: any[];
  class_coordinator_assignments: any[];
  attendance_sessions: {
    total_conducted: number;
    recent_sessions: any[];
    subject_wise: Array<{
      subject_id: string;
      subject_name: string;
      subject_code: string;
      session_count: number;
    }>;
  };
  assessments_created: any[];
  assessments_managed: any[];
  timetable_entries: any[];
  timetable: any[];
  leaves: any[];
  lifecycle_history: AccountLifecycleEntry[];
  audit_logs: AuditLog[];
}

export interface TimetableVersion {
  id: string;
  department_id: string;
  section_id: string;
  version_number: number;
  effective_from: string;
  status: 'draft' | 'under_review' | 'published' | 'active' | 'superseded' | 'archived' | 'rejected';
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

export type SubmissionType = 'google_form' | 'file_upload' | 'both';
export type SubmissionStatus = 'not_started' | 'submitted' | 'late_submission' | 'reviewed' | 'graded' | 'returned';
export type SessionalType = 'Sessional 1' | 'Sessional 2' | 'Sessional 3' | 'Sessional 4' | 'Pre-University Test' | 'Final Sessional' | 'Assignment Marks' | 'Internal Assessment' | string;

export interface SessionalAssessment {
  id: string;
  faculty_id?: string;
  subject_id: string;
  section_id: string;
  academic_session_id?: string;
  semester_id?: string;
  title: string; // e.g. "Sessional 1", "Sessional 2", "Sessional 3", "Sessional 4", "PUT", etc.
  max_marks: number;
  exam_date: string;
  description?: string;
  status: 'draft' | 'published' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  subject?: Subject;
  faculty?: Faculty;
  section?: Section;
}

export interface Assignment {
  id: string;
  faculty_id: string;
  subject_id: string;
  section_id: string;
  academic_session_id?: string;
  title: string;
  description?: string;
  submission_type: SubmissionType;
  google_form_url?: string;
  attachment_url?: string;
  max_marks: number;
  assigned_date: string;
  due_date: string;
  allow_late_submission: boolean;
  status?: 'draft' | 'published' | 'completed' | 'archived';
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  subject?: Subject;
  faculty?: Faculty;
  section?: Section;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_type: SubmissionType;
  content?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  google_form_submitted?: boolean;
  submitted_at: string;
  status: SubmissionStatus;
  marks_obtained?: number;
  feedback?: string;
  graded_by?: string;
  graded_at?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  assignment?: Assignment;
  grader?: Faculty;
}

export interface Quiz {
  id: string;
  faculty_id: string;
  subject_id: string;
  section_id: string;
  academic_session_id?: string;
  title: string;
  description?: string;
  google_form_url: string;
  max_marks: number;
  quiz_date: string;
  start_time: string;
  end_time: string;
  instructions?: string;
  status?: 'draft' | 'published' | 'completed' | 'archived';
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  subject?: Subject;
  faculty?: Faculty;
  section?: Section;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: 'NORMAL' | 'URGENT' | 'HIGH';
  author: string;
  created_by?: string;
  created_by_role?: string;
  target_audience: string;
  target_section_id?: string | null;
  target_department_id?: string | null;
  target_role?: string | null;
  is_pinned: boolean;
  attachment_url?: string;
  status: 'PUBLISHED' | 'ARCHIVED' | 'DELETED';
  expires_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface QuizResult {
  id: string;
  quiz_id: string;
  student_id: string;
  marks_obtained: number;
  graded_by?: string;
  graded_at?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  quiz?: Quiz;
  grader?: Faculty;
}

export type AssessmentAttendanceStatus = 'NOT_ENTERED' | 'PRESENT' | 'ABSENT' | 'EXEMPTED';

export interface SessionalMark {
  id: string;
  sessional_assessment_id?: string;
  faculty_id?: string;
  subject_id: string;
  section_id: string;
  student_id: string;
  academic_session_id?: string;
  sessional_type?: SessionalType;
  max_marks?: number;
  marks_obtained: number | null;
  remarks?: string;
  status?: 'draft' | 'published';
  attendance_status?: AssessmentAttendanceStatus;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  subject?: Subject;
  faculty?: Faculty;
  section?: Section;
  sessional_assessment?: SessionalAssessment;
}

export interface MarksHistory {
  id: string;
  entity_type: 'sessional' | 'quiz' | 'assignment';
  entity_id: string;
  student_id: string;
  subject_id: string;
  old_marks?: number;
  new_marks: number;
  updated_by: string;
  updated_at: string;
  reason?: string;
  student?: Student;
  subject?: Subject;
}

export interface FacultyDashboardPayload {
  faculty: Faculty;
  assignments: FacultySubjectAssignment[];
  coordinatorAssignments: ClassCoordinatorAssignment[];
  timetable: TimetableEntry[];
  sections: Array<{
    sec: Section;
    sem?: Semester;
    year?: AcademicYear;
    yearName: string;
    yearNumber: number;
    cleanSecName: string;
    cleanRoom: string;
    studentCount: number;
    subjectsInSec: Subject[];
  }>;
  subjects: Subject[];
  todaySchedule: TimetableEntry[];
  todayClassesCount: number;
  weeklyLoad: number;
  assignedSectionsCount: number;
  assignedSubjectsCount: number;
  pendingCorrectionsCount: number;
  pendingCorrections: AttendanceCorrection[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords?: AttendanceRecord[];
}

export type NotificationType =
  | 'MARKS_PUBLISHED'
  | 'MARKS_UPDATED'
  | 'ASSIGNMENT_POSTED'
  | 'ASSIGNMENT_UPDATED'
  | 'QUIZ_POSTED'
  | 'QUIZ_GRADED'
  | 'ATTENDANCE_CLAIM'
  | 'ATTENDANCE_UPDATE'
  | 'TIMETABLE_UPDATE'
  | 'NOTICE'
  | 'ACCOUNT_UPDATE'
  | 'NEW_MESSAGE'
  | 'ISSUE_STATUS_UPDATE'
  | 'LEAVE_APPLICATION_SUBMITTED'
  | 'LEAVE_FORWARDED_HOD'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'GENERAL';

export interface StudentNotification {
  id: string;
  recipient_user_id?: string;
  recipient_student_id?: string;
  recipient_faculty_id?: string;
  user_id?: string;
  student_id?: string;
  recipient_role?: string;
  type: NotificationType;
  title: string;
  message: string;
  reference_type?: string;
  referenceId?: string;
  reference_id?: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ConversationCategory =
  | 'General'
  | 'Attendance'
  | 'Timetable'
  | 'Assignment'
  | 'Subject'
  | 'Class'
  | 'Other';

export type ConversationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface Conversation {
  id: string;
  student_id: string;
  faculty_id: string;
  subject_id?: string | null;
  section_id: string;
  academic_year_id: string;
  category: ConversationCategory;
  subject_topic?: string | null;
  status: ConversationStatus;
  last_message_at: string;
  last_message_preview?: string | null;
  created_at: string;
  updated_at: string;
  // Joins / expanded relations
  student?: Student;
  faculty?: Faculty;
  subject?: Subject | null;
  section?: Section;
  academic_year?: AcademicYear;
  unread_count?: number;
  marked_unread?: boolean;
}

export interface ConversationUserSettings {
  conversation_id: string;
  user_id: string;
  cleared_at?: string | null;
  marked_unread: boolean;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  student_id: string;
  faculty_id: string;
  subject_id?: string | null;
  sender_role: 'student' | 'faculty' | 'hod' | 'super_admin';
  message: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  read_at?: string | null;
  created_at: string;
  sender_name?: string;
  // Migration 039 Premium Chat Features
  edited_at?: string | null;
  is_unsent?: boolean;
  unsent_at?: string | null;
  deleted_by_users?: string[];
  reply_to_message_id?: string | null;
  reply_to?: {
    id: string;
    message: string;
    sender_user_id: string;
    sender_role?: string;
    sender_name?: string;
    is_unsent?: boolean;
    edited_at?: string | null;
    student?: { id: string; full_name: string; roll_number?: string } | null;
    faculty?: { id: string; full_name: string; faculty_code?: string } | null;
  } | null;
  student?: { id: string; full_name: string; roll_number?: string } | null;
  faculty?: { id: string; full_name: string; faculty_code?: string } | null;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface EligibleFacultyForStudent {
  faculty_id: string;
  faculty_name: string;
  faculty_email?: string;
  faculty_designation?: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  section_id: string;
  section_name: string;
  academic_year_id: string;
  year_name?: string;
}

export interface EligibleStudentForFaculty {
  student_id: string;
  student_name: string;
  roll_number?: string;
  admission_number?: string;
  section_id: string;
  section_name: string;
  subject_id?: string;
  subject_name?: string;
  subject_code?: string;
  academic_year_id: string;
  year_name?: string;
  subjects?: Array<{ id: string; name: string; code: string }>;
}

export type LeaveStatus = 
  | 'PENDING_COORDINATOR'
  | 'PENDING_HOD'
  | 'APPROVED'
  | 'REJECTED_BY_COORDINATOR'
  | 'REJECTED_BY_HOD';

export type LeaveType = 
  | 'Medical Leave'
  | 'Duty Leave (OD)'
  | 'Casual Leave'
  | 'Semester Break'
  | 'Other';

export interface LeaveApplication {
  id: string;
  application_number: string;
  student_id: string;
  department_id: string;
  academic_year_id: string;
  section_id: string;
  coordinator_id?: string | null;
  hod_id?: string | null;
  leave_type: LeaveType | string;
  from_date: string;
  to_date: string;
  number_of_days: number;
  reason: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  status: LeaveStatus;
  
  // Coordinator Approval Details
  coordinator_approved_by?: string | null;
  coordinator_approved_at?: string | null;
  coordinator_remarks?: string | null;

  // HOD Approval Details
  hod_approved_by?: string | null;
  hod_approved_at?: string | null;
  hod_remarks?: string | null;

  // Rejection Details
  rejected_by?: string | null;
  rejected_by_role?: 'coordinator' | 'hod' | string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;

  // Verification & Security
  verification_code: string;
  approved_pdf_url?: string | null;

  created_at: string;
  updated_at: string;

  // Expanded relations / joins
  student?: Student;
  department?: Department;
  academic_year?: AcademicYear;
  section?: Section;
  coordinator?: Faculty;
  hod?: Faculty;
  coordinator_approver?: Faculty;
  hod_approver?: Faculty;
  rejecter?: Faculty;
}

export interface LeaveApprovalAuditLog {
  id: string;
  application_id: string;
  actor_user_id?: string | null;
  actor_faculty_id?: string | null;
  actor_student_id?: string | null;
  actor_role: string;
  action: 'SUBMITTED' | 'COORDINATOR_APPROVED' | 'COORDINATOR_REJECTED' | 'HOD_APPROVED' | 'HOD_REJECTED' | string;
  old_status?: LeaveStatus | string | null;
  new_status: LeaveStatus | string;
  remarks?: string | null;
  created_at: string;
  actor_name?: string;
}

// ============================================================================
// CLASS / SUBJECT GROUP COMMUNICATION & STUDENT PROFILE TYPES
// ============================================================================

export interface MessageGroup {
  id: string;
  department_id: string;
  academic_year_id: string;
  section_id: string;
  subject_id?: string | null;
  created_by_faculty_id?: string | null;
  allow_student_replies: boolean;
  last_message_at: string;
  last_message_preview?: string | null;
  created_at: string;
  updated_at: string;
  // Relational joins
  subject?: Subject | null;
  section?: Section;
  academic_year?: AcademicYear;
  department?: Department;
  faculty?: Faculty;
  members_count?: number;
  unread_count?: number;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_user_id: string;
  sender_role: 'faculty' | 'student' | 'hod' | 'super_admin';
  sender_name: string;
  sender_avatar_url?: string | null;
  title?: string | null;
  message: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  created_at: string;
  edited_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by_users?: string[];
  reply_to_message_id?: string | null;
  reply_to?: {
    id: string;
    message: string;
    sender_name: string;
    sender_role: string;
    title?: string | null;
    is_deleted?: boolean;
  } | null;
  delivery_status?: 'sending' | 'sent' | 'failed';
  error?: string | null;
  client_message_id?: string | null;
}

export interface GroupMember {
  id: string;
  roll_number: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  admission_type: string;
  status: string;
  active: boolean;
  section_name?: string;
  year_number?: number;
}

export interface DetailedStudentProfile {
  id: string;
  roll_number: string;
  admission_number?: string | null;
  full_name: string;
  admission_type: string;
  status: string;
  active: boolean;
  phone?: string | null;
  email?: string | null;
  father_name?: string | null;
  father_contact_number?: string | null;
  mother_name?: string | null;
  mother_contact_number?: string | null;
  blood_group?: string | null;
  address?: string | null;
  department_name: string;
  department_code?: string;
  program_name: string;
  year_number: number;
  year_name: string;
  section_name: string;
  room_number?: string;
  semester_number?: number;
  mentor_name?: string | null;
  coordinator_name?: string | null;
  attendance_percentage: number;
  total_sessions: number;
  attended_sessions: number;
  subjects?: Array<{
    id: string;
    subject_name: string;
    subject_code: string;
    faculty_name?: string;
  }>;
  created_at: string;
}

export interface PromotionBatch {
  id: string;
  batch_number: number;
  source_academic_year_id?: string | null;
  target_academic_year_id?: string | null;
  source_academic_session_id?: string | null;
  target_academic_session_id?: string | null;
  total_students: number;
  promoted_count: number;
  held_count: number;
  graduated_count: number;
  excluded_count: number;
  performed_by_user_id?: string | null;
  performed_by_name: string;
  notes?: string | null;
  metadata?: any;
  created_at: string;
  source_year?: AcademicYear;
  target_year?: AcademicYear;
  source_session?: AcademicSession;
  target_session?: AcademicSession;
}

export type AcademicPromotionAction = 'INITIAL_ENROLLMENT' | 'PROMOTED' | 'HELD_BACK' | 'REASSIGNED_SECTION' | 'GRADUATED';

export interface StudentAcademicHistory {
  id: string;
  student_id: string;
  academic_session_id?: string | null;
  academic_year_id?: string | null;
  semester_id?: string | null;
  section_id?: string | null;
  status: string;
  promotion_action: AcademicPromotionAction;
  promotion_batch_id?: string | null;
  remarks?: string | null;
  created_at: string;
  academic_session?: AcademicSession;
  academic_year?: AcademicYear;
  semester?: Semester;
  section?: Section;
  student?: Student;
}

export interface SectionReferenceCheckResult {
  section_id: string;
  student_count: number;
  attendance_count: number;
  timetable_count: number;
  assignment_count: number;
  leave_count: number;
  message_count: number;
  total_references: number;
  can_hard_delete: boolean;
}

export type StudentPromotionActionType = 'PROMOTE' | 'HOLD' | 'GRADUATE' | 'EXCLUDE' | 'REASSIGN';

export interface BulkPromotionStudentItem {
  student_id: string;
  action: StudentPromotionActionType;
  target_section_id?: string | null;
  target_semester_id?: string | null;
  target_academic_year_id?: string | null;
  remarks?: string | null;
}

export interface BulkPromotionPayload {
  source_academic_year_id?: string | null;
  target_academic_year_id?: string | null;
  source_academic_session_id?: string | null;
  target_academic_session_id?: string | null;
  target_semester_id?: string | null;
  notes?: string | null;
  students: BulkPromotionStudentItem[];
}

export interface BulkPromotionResult {
  success: boolean;
  batch_id: string;
  total_students: number;
  promoted_count: number;
  held_count: number;
  graduated_count: number;
  excluded_count: number;
}

export interface StudentAcademicContext {
  studentId: string;
  student: Student | null;
  academicYear: AcademicYear | null;
  academicYearId: string;
  academicYearName: string;
  academicYearNumber: number;
  semester: Semester | null;
  semesterId: string;
  semesterName: string;
  semesterNumber: number;
  program: Program | null;
  programId: string;
  programName: string;
  department: Department | null;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  section: Section | null;
  sectionId: string;
  sectionName: string;
  cleanSectionName: string;
  sectionCode: string;
  roomNumber: string;
  formattedSectionLabel: string;
  academicSession: AcademicSession | null;
  academicSessionId: string;
  academicSessionName: string;
  mentorFaculty: Faculty | null;
  classCoordinator: Faculty | null;
}

export interface HODDepartmentContext {
  department: Department | null;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  hodFaculty: Faculty | null;
  departmentFaculty: Faculty[];
  activeFacultyCount: number;
  assignedFacultyCount: number;
  workloadPercentage: number;
  departmentStudents: Student[];
  studentCount: number;
  sections: Section[];
  subjects: Subject[];
}

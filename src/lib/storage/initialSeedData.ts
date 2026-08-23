import { 
  Institution, 
  Department, 
  Program, 
  AcademicSession, 
  AcademicYear, 
  Semester, 
  Section, 
  Subject, 
  Faculty, 
  FacultySubjectAssignment, 
  Student, 
  TimetableEntry, 
  AttendanceSession, 
  AttendanceRecord, 
  AttendanceCorrection, 
  AuditLog, 
  UserProfile 
} from '../../types/database.types';

// Deterministic IDs for cross-referencing - Exactly matching Supabase Cloud Database UUIDs
export const INST_ID = '22398afa-8679-4d2c-87fc-312152a276e2';
export const DEPT_CSE_ID = 'fe5bc365-7a68-4290-b05e-acfa274f748a';
export const PROG_BTECH_CSE_ID = 'c71b3983-9ff8-43e1-a9a0-b778676bf186';
export const SESSION_2026_2027_ID = 'a358fe68-d746-4242-9f36-2c715cd9526e';
export const YEAR_2ND_ID = 'ecdc0ed0-e0b7-4ebc-9db5-1db612317334';
export const SEM_3RD_ID = '8ef97eaa-8868-4b17-8ff9-c9d3cfb9160d';
export const SEC_A_ID = 'fc93a413-c18d-4e72-9624-146767bc286b';
export const SEC_B_ID = '233957c0-4fef-42c6-8285-40ebf73ea6b7';

// Faculty IDs
export const FAC_WASIM_ID = 'd97b0c91-91bd-4414-9c9a-315139e752c3';
export const FAC_HEMLATA_ID = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';
export const FAC_IMRAN_ID = '727a6e43-a3c6-4b3b-849d-e644bf539eda';
export const FAC_ALOK_ID = 'ae02a640-0e39-47e7-b1aa-636efc09aaf6';
export const FAC_KULDEEP_ID = 'd35d339f-508d-40d5-8279-cf068120b0c5';
export const FAC_NASEEM_ID = '671511f2-73dc-4609-b49b-a5cd375a7cef';
export const FAC_SHIVANI_ID = 'c899db6d-5949-4e0d-84c4-8f5c4f7866c7';
export const FAC_GAGANDEEP_ID = '422de2c6-d008-4d22-8b3a-37353ee4af17';
export const FAC_FAIZAN_ID = '3613c185-4b74-4b9c-8030-195c2e9089b7';
export const FAC_PRAVEEN_ID = '6cdcdacd-8ff1-46e7-9b81-c13d74dabfc9';
export const FAC_ABHISHEK_ID = '508c1a21-11a7-4d36-8902-66a843be0aaf';

// Subject IDs
export const SUB_MATHS4_ID = '1d720a3b-9902-45fc-9cbe-111431f4485a';
export const SUB_UHV_ID = '1e718772-8aa5-49f5-9899-484b751ec1f2';
export const SUB_DS_ID = '223a68cf-ebf7-445f-abe2-99afaea99933';
export const SUB_COA_ID = '6dedd926-0155-4f4a-9d04-dd868e9ad674';
export const SUB_DSTL_ID = '616b013d-a42c-481c-8b43-39ba733b548b';
export const SUB_DSLAB_ID = 'acb2fe93-f903-42c2-a4a2-24872b16f28e';
export const SUB_COALAB_ID = 'be34ca80-e9ef-43fe-97c4-01f6c14b39ca';
export const SUB_WDWS_ID = 'e1271166-5d69-4c9a-8657-910bf88f5a85';
export const SUB_CS_ID = '65a65d0c-8eda-41e2-98f3-8ee6382948bf';
export const SUB_PROJECT_ID = '562a70d4-e3e7-44f3-a51f-9304a835d074';

export const INITIAL_INSTITUTION: Institution = {
  id: INST_ID,
  name: 'Vivekananda College of Technology & Management, Aligarh',
  code: '340',
  address: 'Mathura Bypass Road, Near Khair Road Crossing, Aligarh, Uttar Pradesh 202001',
  website: 'https://vctm.in/',
  logo_url: '/vctm-logo.png',
  active: true,
  created_at: '2026-08-01T00:00:00Z',
};

export const INITIAL_DEPARTMENTS: Department[] = [
  {
    id: DEPT_CSE_ID,
    institution_id: INST_ID,
    name: 'Computer Science & Engineering',
    code: 'CSE',
    hod_faculty_id: FAC_WASIM_ID,
    active: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'dept-ee-02',
    institution_id: INST_ID,
    name: 'Electrical Engineering',
    code: 'EE',
    active: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'dept-me-03',
    institution_id: INST_ID,
    name: 'Mechanical Engineering',
    code: 'ME',
    active: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'dept-mba-04',
    institution_id: INST_ID,
    name: 'Management Studies (MBA)',
    code: 'MBA',
    active: true,
    created_at: '2026-08-01T00:00:00Z',
  }
];

export const INITIAL_PROGRAMS: Program[] = [
  {
    id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    name: 'B.Tech in Computer Science & Engineering',
    code: 'BTECH-CSE',
    duration_years: 4,
    active: true,
    created_at: '2026-08-01T00:00:00Z',
  }
];

export const INITIAL_SESSIONS: AcademicSession[] = [
  {
    id: SESSION_2026_2027_ID,
    name: '2026-2027',
    start_date: '2026-08-01',
    end_date: '2027-06-30',
    is_current: true,
    active: true,
  }
];

export const INITIAL_YEARS: AcademicYear[] = [
  { id: 'year-1st-btech-01', program_id: PROG_BTECH_CSE_ID, year_number: 1, name: '1st Year', active: true },
  { id: YEAR_2ND_ID, program_id: PROG_BTECH_CSE_ID, year_number: 2, name: '2nd Year', active: true },
  { id: 'year-3rd-btech-01', program_id: PROG_BTECH_CSE_ID, year_number: 3, name: '3rd Year', active: true },
  { id: 'year-4th-btech-01', program_id: PROG_BTECH_CSE_ID, year_number: 4, name: '4th Year', active: true },
];

export const INITIAL_SEMESTERS: Semester[] = [
  { id: SEM_3RD_ID, academic_year_id: YEAR_2ND_ID, semester_number: 3, name: '3rd Semester (Odd Semester 2026-2027)', active: true },
  { id: 'sem-4th-even-01', academic_year_id: YEAR_2ND_ID, semester_number: 4, name: '4th Semester (Even Semester 2026-2027)', active: true },
];

export const INITIAL_SECTIONS: Section[] = [
  {
    id: SEC_A_ID,
    semester_id: SEM_3RD_ID,
    name: 'A',
    room_number: 'Room No. A 007',
    class_coordinator_id: FAC_HEMLATA_ID,
    active: true,
  },
  {
    id: SEC_B_ID,
    semester_id: SEM_3RD_ID,
    name: 'B',
    room_number: 'Room No. A 006',
    class_coordinator_id: FAC_IMRAN_ID,
    active: true,
  }
];

export const INITIAL_FACULTY: Faculty[] = [
  {
    id: FAC_WASIM_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-001',
    faculty_code: 'WSM',
    full_name: 'Mr. Wasim',
    designation: 'Associate Professor & HOD',
    email: 'wasim.cse@vctm.in',
    phone: '9876543210',
    active: true,
  },
  {
    id: FAC_HEMLATA_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-002',
    faculty_code: 'HEM',
    full_name: 'Ms. Hemlata Chaudhary',
    designation: 'Assistant Professor & Coordinator (Sec A)',
    email: 'hemlata.cse@vctm.in',
    phone: '9876543211',
    active: true,
  },
  {
    id: FAC_IMRAN_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-003',
    faculty_code: 'IRK',
    full_name: 'Mr. Imran Raza Khan',
    designation: 'Assistant Professor & Coordinator (Sec B)',
    email: 'imran.cse@vctm.in',
    phone: '9876543212',
    active: true,
  },
  {
    id: FAC_ALOK_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-004',
    faculty_code: 'ALG',
    full_name: 'Mr. Alok Gupta',
    designation: 'Assistant Professor',
    email: 'alok.cse@vctm.in',
    phone: '9876543213',
    active: true,
  },
  {
    id: FAC_KULDEEP_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-005',
    faculty_code: 'KK',
    full_name: 'Mr. Kuldeep Kumar',
    designation: 'Assistant Professor',
    email: 'kuldeep.cse@vctm.in',
    phone: '9876543214',
    active: true,
  },
  {
    id: FAC_NASEEM_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-006',
    faculty_code: 'NAK',
    full_name: 'Dr. Naseem Ahamad Khan',
    designation: 'Associate Professor (Mathematics)',
    email: 'naseem.math@vctm.in',
    phone: '9876543215',
    active: true,
  },
  {
    id: FAC_SHIVANI_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-007',
    faculty_code: 'SHS',
    full_name: 'Ms. Shivani Sarswat',
    designation: 'Assistant Professor',
    email: 'shivani.ash@vctm.in',
    phone: '9876543216',
    active: true,
  },
  {
    id: FAC_GAGANDEEP_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-008',
    faculty_code: 'GDS',
    full_name: 'Mr. Gagandep Singh',
    designation: 'Assistant Professor',
    email: 'gagandeep.cse@vctm.in',
    phone: '9876543217',
    active: true,
  },
  {
    id: FAC_FAIZAN_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-009',
    faculty_code: 'FZN',
    full_name: 'Dr. Faizan Nasir',
    designation: 'Assistant Professor',
    email: 'faizan.cse@vctm.in',
    phone: '9876543218',
    active: true,
  },
  {
    id: FAC_PRAVEEN_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-010',
    faculty_code: 'PRS',
    full_name: 'Mr. Praveen Sharma',
    designation: 'Assistant Professor',
    email: 'praveen.cse@vctm.in',
    phone: '9876543219',
    active: true,
  },
  {
    id: FAC_ABHISHEK_ID,
    department_id: DEPT_CSE_ID,
    employee_code: 'FAC-CSE-011',
    faculty_code: 'ABG',
    full_name: 'Dr. Abhishek Garg',
    designation: 'Associate Professor',
    email: 'abhishek.cse@vctm.in',
    phone: '9876543220',
    active: true,
  }
];

export const INITIAL_SUBJECTS: Subject[] = [
  {
    id: SUB_MATHS4_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BAS303',
    subject_name: 'Mathematics IV (Maths 4)',
    lecture_type: 'Theory',
    credits: 4.0,
    active: true,
  },
  {
    id: SUB_UHV_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BVE301',
    subject_name: 'Universal Human Value (UHV)',
    lecture_type: 'Theory',
    credits: 3.0,
    active: true,
  },
  {
    id: SUB_DS_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BCS301',
    subject_name: 'Data Structure (DS)',
    lecture_type: 'Theory',
    credits: 4.0,
    active: true,
  },
  {
    id: SUB_COA_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BCS302',
    subject_name: 'Computer Organization & Architecture (COA)',
    lecture_type: 'Theory',
    credits: 4.0,
    active: true,
  },
  {
    id: SUB_DSTL_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BCS303',
    subject_name: 'Discrete Structure & Theory of Logic (DSTL)',
    lecture_type: 'Theory',
    credits: 4.0,
    active: true,
  },
  {
    id: SUB_DSLAB_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BCS351',
    subject_name: 'Data Structure Lab (DS LAB)',
    lecture_type: 'Practical',
    credits: 1.0,
    active: true,
  },
  {
    id: SUB_COALAB_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BCS352',
    subject_name: 'Computer Organization & Architecture Lab (COA LAB)',
    lecture_type: 'Practical',
    credits: 1.0,
    active: true,
  },
  {
    id: SUB_WDWS_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BCS353',
    subject_name: 'Web Designing Workshop (WD WS)',
    lecture_type: 'Workshop',
    credits: 1.0,
    active: true,
  },
  {
    id: SUB_CS_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BCC301',
    subject_name: 'Cyber Security (CS)',
    lecture_type: 'Theory',
    credits: 2.0,
    active: true,
  },
  {
    id: SUB_PROJECT_ID,
    program_id: PROG_BTECH_CSE_ID,
    department_id: DEPT_CSE_ID,
    semester_id: SEM_3RD_ID,
    subject_code: 'BCC351',
    subject_name: 'Internship Assessment / Mini Project',
    lecture_type: 'Project',
    credits: 2.0,
    active: true,
  }
];

export const INITIAL_ASSIGNMENTS: FacultySubjectAssignment[] = [
  // Section A Assignments
  { id: 'fsa-a-1', faculty_id: FAC_NASEEM_ID, subject_id: SUB_MATHS4_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-2', faculty_id: FAC_SHIVANI_ID, subject_id: SUB_UHV_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-3', faculty_id: FAC_ALOK_ID, subject_id: SUB_DS_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-4', faculty_id: FAC_KULDEEP_ID, subject_id: SUB_COA_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-5', faculty_id: FAC_HEMLATA_ID, subject_id: SUB_DSTL_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-6', faculty_id: FAC_ALOK_ID, subject_id: SUB_DSLAB_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-7', faculty_id: FAC_ALOK_ID, subject_id: SUB_COALAB_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-8', faculty_id: FAC_GAGANDEEP_ID, subject_id: SUB_WDWS_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-9', faculty_id: FAC_GAGANDEEP_ID, subject_id: SUB_CS_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-a-10', faculty_id: FAC_FAIZAN_ID, subject_id: SUB_PROJECT_ID, section_id: SEC_A_ID, academic_session_id: SESSION_2026_2027_ID, active: true },

  // Section B Assignments
  { id: 'fsa-b-1', faculty_id: FAC_NASEEM_ID, subject_id: SUB_MATHS4_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-2', faculty_id: FAC_SHIVANI_ID, subject_id: SUB_UHV_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-3', faculty_id: FAC_HEMLATA_ID, subject_id: SUB_DS_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-4', faculty_id: FAC_KULDEEP_ID, subject_id: SUB_COA_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-5', faculty_id: FAC_IMRAN_ID, subject_id: SUB_DSTL_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-6', faculty_id: FAC_HEMLATA_ID, subject_id: SUB_DSLAB_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-7', faculty_id: FAC_HEMLATA_ID, subject_id: SUB_COALAB_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-8', faculty_id: FAC_GAGANDEEP_ID, subject_id: SUB_WDWS_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-9', faculty_id: FAC_PRAVEEN_ID, subject_id: SUB_CS_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true },
  { id: 'fsa-b-10', faculty_id: FAC_PRAVEEN_ID, subject_id: SUB_PROJECT_ID, section_id: SEC_B_ID, academic_session_id: SESSION_2026_2027_ID, active: true }
];

// Helper to generate full timetable
const days: Array<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'> = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const INITIAL_TIMETABLE: TimetableEntry[] = [
  // Section A Timetable Entries (Room A 007)
  // MON
  { id: 'tt-a-mon-1', section_id: SEC_A_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'MON', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-mon-2', section_id: SEC_A_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'MON', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-mon-3', section_id: SEC_A_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'MON', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-mon-4', section_id: SEC_A_ID, subject_id: SUB_DS_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'MON', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-mon-6', section_id: SEC_A_ID, subject_id: SUB_UHV_ID, faculty_id: FAC_SHIVANI_ID, day_of_week: 'MON', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-mon-7', section_id: SEC_A_ID, subject_id: SUB_CS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'MON', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-mon-8', section_id: SEC_A_ID, subject_id: SUB_PROJECT_ID, faculty_id: FAC_FAIZAN_ID, day_of_week: 'MON', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Room A 007', lecture_type: 'Project', active: true },

  // TUE
  { id: 'tt-a-tue-1', section_id: SEC_A_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'TUE', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-tue-2', section_id: SEC_A_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'TUE', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-tue-3', section_id: SEC_A_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'TUE', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-tue-4', section_id: SEC_A_ID, subject_id: SUB_DS_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'TUE', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-tue-6', section_id: SEC_A_ID, subject_id: SUB_UHV_ID, faculty_id: FAC_SHIVANI_ID, day_of_week: 'TUE', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-tue-7', section_id: SEC_A_ID, subject_id: SUB_CS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'TUE', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-tue-8', section_id: SEC_A_ID, subject_id: SUB_PROJECT_ID, faculty_id: FAC_FAIZAN_ID, day_of_week: 'TUE', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Room A 007', lecture_type: 'Project', active: true },

  // WED
  { id: 'tt-a-wed-1', section_id: SEC_A_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'WED', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-wed-2', section_id: SEC_A_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'WED', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-wed-3', section_id: SEC_A_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'WED', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-wed-4', section_id: SEC_A_ID, subject_id: SUB_DS_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'WED', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-wed-6', section_id: SEC_A_ID, subject_id: SUB_UHV_ID, faculty_id: FAC_SHIVANI_ID, day_of_week: 'WED', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-wed-7', section_id: SEC_A_ID, subject_id: SUB_DSLAB_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'WED', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'DS Lab', lecture_type: 'Practical', active: true },
  { id: 'tt-a-wed-8', section_id: SEC_A_ID, subject_id: SUB_DSLAB_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'WED', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'DS Lab', lecture_type: 'Practical', active: true },

  // THU
  { id: 'tt-a-thu-1', section_id: SEC_A_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'THU', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-thu-2', section_id: SEC_A_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'THU', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-thu-3', section_id: SEC_A_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'THU', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-thu-4', section_id: SEC_A_ID, subject_id: SUB_DS_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'THU', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-thu-6', section_id: SEC_A_ID, subject_id: SUB_UHV_ID, faculty_id: FAC_SHIVANI_ID, day_of_week: 'THU', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-thu-7', section_id: SEC_A_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'THU', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-thu-8', section_id: SEC_A_ID, subject_id: SUB_CS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'THU', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Room A 007', lecture_type: 'Theory', active: true },

  // FRI
  { id: 'tt-a-fri-1', section_id: SEC_A_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'FRI', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-fri-2', section_id: SEC_A_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'FRI', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-fri-3', section_id: SEC_A_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'FRI', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-fri-4', section_id: SEC_A_ID, subject_id: SUB_DS_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'FRI', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-fri-6', section_id: SEC_A_ID, subject_id: SUB_CS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'FRI', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-fri-7', section_id: SEC_A_ID, subject_id: SUB_WDWS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'FRI', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Web Lab', lecture_type: 'Workshop', active: true },
  { id: 'tt-a-fri-8', section_id: SEC_A_ID, subject_id: SUB_WDWS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'FRI', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Web Lab', lecture_type: 'Workshop', active: true },

  // SAT
  { id: 'tt-a-sat-1', section_id: SEC_A_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'SAT', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-sat-2', section_id: SEC_A_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'SAT', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-sat-3', section_id: SEC_A_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'SAT', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-sat-4', section_id: SEC_A_ID, subject_id: SUB_DS_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'SAT', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-sat-6', section_id: SEC_A_ID, subject_id: SUB_COALAB_ID, faculty_id: FAC_ALOK_ID, day_of_week: 'SAT', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'COA Lab', lecture_type: 'Practical', active: true },
  { id: 'tt-a-sat-7', section_id: SEC_A_ID, subject_id: SUB_CS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'SAT', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Room A 007', lecture_type: 'Theory', active: true },
  { id: 'tt-a-sat-8', section_id: SEC_A_ID, subject_id: SUB_PROJECT_ID, faculty_id: FAC_FAIZAN_ID, day_of_week: 'SAT', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Ground', lecture_type: 'Sports', active: true },

  // Section B Timetable Entries (Room A 006)
  // MON
  { id: 'tt-b-mon-1', section_id: SEC_B_ID, subject_id: SUB_DS_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'MON', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-mon-2', section_id: SEC_B_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'MON', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-mon-3', section_id: SEC_B_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'MON', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-mon-4', section_id: SEC_B_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_IMRAN_ID, day_of_week: 'MON', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-mon-6', section_id: SEC_B_ID, subject_id: SUB_CS_ID, faculty_id: FAC_PRAVEEN_ID, day_of_week: 'MON', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-mon-7', section_id: SEC_B_ID, subject_id: SUB_UHV_ID, faculty_id: FAC_SHIVANI_ID, day_of_week: 'MON', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-mon-8', section_id: SEC_B_ID, subject_id: SUB_WDWS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'MON', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Web Lab', lecture_type: 'Workshop', active: true },

  // TUE
  { id: 'tt-b-tue-1', section_id: SEC_B_ID, subject_id: SUB_DS_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'TUE', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-tue-2', section_id: SEC_B_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'TUE', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-tue-3', section_id: SEC_B_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'TUE', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-tue-4', section_id: SEC_B_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_IMRAN_ID, day_of_week: 'TUE', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-tue-6', section_id: SEC_B_ID, subject_id: SUB_CS_ID, faculty_id: FAC_PRAVEEN_ID, day_of_week: 'TUE', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-tue-7', section_id: SEC_B_ID, subject_id: SUB_UHV_ID, faculty_id: FAC_SHIVANI_ID, day_of_week: 'TUE', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-tue-8', section_id: SEC_B_ID, subject_id: SUB_WDWS_ID, faculty_id: FAC_GAGANDEEP_ID, day_of_week: 'TUE', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Web Lab', lecture_type: 'Workshop', active: true },

  // WED
  { id: 'tt-b-wed-1', section_id: SEC_B_ID, subject_id: SUB_DS_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'WED', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-wed-2', section_id: SEC_B_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'WED', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-wed-3', section_id: SEC_B_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'WED', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-wed-4', section_id: SEC_B_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_IMRAN_ID, day_of_week: 'WED', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-wed-6', section_id: SEC_B_ID, subject_id: SUB_CS_ID, faculty_id: FAC_PRAVEEN_ID, day_of_week: 'WED', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-wed-7', section_id: SEC_B_ID, subject_id: SUB_UHV_ID, faculty_id: FAC_SHIVANI_ID, day_of_week: 'WED', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-wed-8', section_id: SEC_B_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'WED', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Room A 006', lecture_type: 'Theory', active: true },

  // THU
  { id: 'tt-b-thu-1', section_id: SEC_B_ID, subject_id: SUB_DS_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'THU', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-thu-2', section_id: SEC_B_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'THU', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-thu-3', section_id: SEC_B_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'THU', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-thu-4', section_id: SEC_B_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_IMRAN_ID, day_of_week: 'THU', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-thu-6', section_id: SEC_B_ID, subject_id: SUB_CS_ID, faculty_id: FAC_PRAVEEN_ID, day_of_week: 'THU', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-thu-7', section_id: SEC_B_ID, subject_id: SUB_DSLAB_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'THU', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'DS Lab', lecture_type: 'Practical', active: true },
  { id: 'tt-b-thu-8', section_id: SEC_B_ID, subject_id: SUB_DSLAB_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'THU', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'DS Lab', lecture_type: 'Practical', active: true },

  // FRI
  { id: 'tt-b-fri-1', section_id: SEC_B_ID, subject_id: SUB_DS_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'FRI', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-fri-2', section_id: SEC_B_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'FRI', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-fri-3', section_id: SEC_B_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'FRI', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-fri-4', section_id: SEC_B_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_IMRAN_ID, day_of_week: 'FRI', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-fri-6', section_id: SEC_B_ID, subject_id: SUB_UHV_ID, faculty_id: FAC_SHIVANI_ID, day_of_week: 'FRI', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-fri-7', section_id: SEC_B_ID, subject_id: SUB_COALAB_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'FRI', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'COA Lab', lecture_type: 'Practical', active: true },
  { id: 'tt-b-fri-8', section_id: SEC_B_ID, subject_id: SUB_COALAB_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'FRI', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'COA Lab', lecture_type: 'Practical', active: true },

  // SAT
  { id: 'tt-b-sat-1', section_id: SEC_B_ID, subject_id: SUB_DS_ID, faculty_id: FAC_HEMLATA_ID, day_of_week: 'SAT', period_number: 1, start_time: '09:00', end_time: '09:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-sat-2', section_id: SEC_B_ID, subject_id: SUB_COA_ID, faculty_id: FAC_KULDEEP_ID, day_of_week: 'SAT', period_number: 2, start_time: '09:50', end_time: '10:40', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-sat-3', section_id: SEC_B_ID, subject_id: SUB_MATHS4_ID, faculty_id: FAC_NASEEM_ID, day_of_week: 'SAT', period_number: 3, start_time: '10:40', end_time: '11:30', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-sat-4', section_id: SEC_B_ID, subject_id: SUB_PROJECT_ID, faculty_id: FAC_PRAVEEN_ID, day_of_week: 'SAT', period_number: 4, start_time: '11:30', end_time: '12:20', room_number: 'Room A 006', lecture_type: 'Project', active: true },
  { id: 'tt-b-sat-6', section_id: SEC_B_ID, subject_id: SUB_CS_ID, faculty_id: FAC_PRAVEEN_ID, day_of_week: 'SAT', period_number: 6, start_time: '13:10', end_time: '14:00', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-sat-7', section_id: SEC_B_ID, subject_id: SUB_DSTL_ID, faculty_id: FAC_IMRAN_ID, day_of_week: 'SAT', period_number: 7, start_time: '14:00', end_time: '14:50', room_number: 'Room A 006', lecture_type: 'Theory', active: true },
  { id: 'tt-b-sat-8', section_id: SEC_B_ID, subject_id: SUB_PROJECT_ID, faculty_id: FAC_PRAVEEN_ID, day_of_week: 'SAT', period_number: 8, start_time: '14:50', end_time: '15:40', room_number: 'Ground', lecture_type: 'Sports', active: true },
];

export const INITIAL_STUDENTS_SEC_A: Student[] = [
  // Hemlata Chaudhary group
  { id: 'stud-a-01', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2403400100021', full_name: 'HIMANSHU', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-02', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2403400100035', full_name: 'MUNTAKHAB ALI ZAIDI', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-03', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2403400100040', full_name: 'PRANSHU KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-04', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2403400100047', full_name: 'SHAZEB', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-05', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100001', full_name: 'ADITYA KISHOR SARASWAT', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-06', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100003', full_name: 'AKSHAY KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-07', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100004', full_name: 'ALMAZ ZAKIR', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-08', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100005', full_name: 'AMAN RAJ SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-09', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100006', full_name: 'ARFIA TASNEEM', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-10', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100007', full_name: 'ARPIT', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },

  // Alok Gupta group
  { id: 'stud-a-11', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100009', full_name: 'AVNISH KAUSHIK', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-12', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100010', full_name: 'BHARAT RAJPOOT', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-13', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100011', full_name: 'BHAVYA SHARMA', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-14', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100012', full_name: 'BHOOMIKA VASHISHTHA', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-15', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100014', full_name: 'DIVYANSHU CHAUDHARY', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-16', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100015', full_name: 'EVAD', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-17', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100016', full_name: 'HANIA RAHIM', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-18', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100017', full_name: 'HARDIK VASHISHTHA', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-19', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100018', full_name: 'HASSAN AHMAD KHAN', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-20', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100019', full_name: 'KAYARA SINGH JADAUN', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-21', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100020', full_name: 'KHAGESH KUMAR SHARMA', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-22', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100021', full_name: 'KOMAL', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-23', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100022', full_name: 'LAVI SHARMA', admission_type: 'Regular', mentor_faculty_id: FAC_ALOK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },

  // Imran Raza Khan group
  { id: 'stud-a-24', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100023', full_name: 'MADHAV VASHISHTHA', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-25', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100024', full_name: 'MANISH KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-26', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100025', full_name: 'MANU SARSWAT', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-27', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100026', full_name: 'MAYANK SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-28', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100027', full_name: 'MOHAMMAD ADEEM', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-29', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100028', full_name: 'MOHAMMAD USMAN GHANI', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-30', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100029', full_name: 'MOHAMMED AHMED IQBAL', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-31', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100030', full_name: 'MOHD AARIZ ATEEQ', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-32', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100031', full_name: 'MOHD AFNAN', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-33', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100032', full_name: 'MOHD ANAS', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-34', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100034', full_name: 'MOHD ARSALAN', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-35', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100035', full_name: 'MOHD DANIYAL KHAN', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-36', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100036', full_name: 'MOHD OWAIS', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },

  // Abhishek Garg group
  { id: 'stud-a-37', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100037', full_name: 'MOHD SADIQUE', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-38', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100038', full_name: 'NAVEEN KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-39', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100039', full_name: 'PAURVI SHARMA', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-40', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100040', full_name: 'PRINCE', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-41', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100041', full_name: 'PRIYA THAKUR', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-42', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100042', full_name: 'PRIYANKA', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-43', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100043', full_name: 'PRIYANKA THAKUR', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-44', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100044', full_name: 'SAGAR KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-45', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100045', full_name: 'SAMEER KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-46', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100046', full_name: 'SATYAM SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-47', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100047', full_name: 'SHADAB KHAN', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-48', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2503400100048', full_name: 'SHAILENDRA KUMAR SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_ABHISHEK_ID, active: true, created_at: '2026-08-01T00:00:00Z' },

  // Lateral Entry group
  { id: 'stud-a-49', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2603400109001', full_name: 'AHMAD SHEERZ', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-50', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2603400109002', full_name: 'AMAN SARSWAT', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-51', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2603400109003', full_name: 'DEEKSHA KUSHWAHA', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-52', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2603400109004', full_name: 'FARDEEN', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-a-53', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_A_ID, roll_number: '2603400109005', full_name: 'GAURAV KUMAR', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' }
];

export const INITIAL_STUDENTS_SEC_B: Student[] = [
  // Kuldeep Kumar group
  { id: 'stud-b-01', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2403400130012', full_name: 'LUBHNESH KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-02', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100049', full_name: 'SHAYAN HASAN', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-03', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100050', full_name: 'SHIV KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-04', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100051', full_name: 'SHIVAM KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-05', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100052', full_name: 'SHOAIB', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-06', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100053', full_name: 'SHRADDHA JADON', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-07', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100054', full_name: 'SHRUTI VASHISHTH', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-08', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100055', full_name: 'SOHAIL KHAN', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-09', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100056', full_name: 'SUMANT SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-10', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100057', full_name: 'TARUN KUSHWAH', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-11', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100058', full_name: 'UJJWAL MALHOTRA', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-12', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100060', full_name: 'VAISHNAVI GAUTAM', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-13', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100061', full_name: 'VANDANA KUMARI', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-14', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100062', full_name: 'VEEKESH SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-15', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100063', full_name: 'VEER SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-16', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100064', full_name: 'VINAY KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-17', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100065', full_name: 'YASH GUPTA', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-18', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400100066', full_name: 'YOGESHWARI', admission_type: 'Regular', mentor_faculty_id: FAC_KULDEEP_ID, active: true, created_at: '2026-08-01T00:00:00Z' },

  // Praveen Sharma group
  { id: 'stud-b-19', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130001', full_name: 'AIMAN JAVED', admission_type: 'Regular', mentor_faculty_id: FAC_PRAVEEN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-20', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130003', full_name: 'DHANANJAY SAHU', admission_type: 'Regular', mentor_faculty_id: FAC_PRAVEEN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-21', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130004', full_name: 'MD SHAHEER AFSAR', admission_type: 'Regular', mentor_faculty_id: FAC_PRAVEEN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-22', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130005', full_name: 'MOHAMMAD ZAID KHAN', admission_type: 'Regular', mentor_faculty_id: FAC_PRAVEEN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-23', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130006', full_name: 'MOHD DANIYAL ABBAS ZAIDI', admission_type: 'Regular', mentor_faculty_id: FAC_PRAVEEN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-24', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130008', full_name: 'NANDANI RAO', admission_type: 'Regular', mentor_faculty_id: FAC_PRAVEEN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },

  // Hemlata Chaudhary group
  { id: 'stud-b-25', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130009', full_name: 'PAWAN KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-26', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130010', full_name: 'PRIYANKA RAJ', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-27', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130011', full_name: 'RAJAT SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-28', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130012', full_name: 'SADHANA KUMARI', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-29', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130013', full_name: 'SAMAD', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-30', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130014', full_name: 'SANIYA ISHRAT', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-31', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130015', full_name: 'SHIKHER CHANDEL', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-32', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130016', full_name: 'SHIVAM SHARMA', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-33', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130017', full_name: 'SHUBHAM KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-34', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130018', full_name: 'SHYAM SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-35', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130019', full_name: 'SUBHAN SADIQ', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-36', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130020', full_name: 'SUMIT PRATAP SINGH', admission_type: 'Regular', mentor_faculty_id: FAC_HEMLATA_ID, active: true, created_at: '2026-08-01T00:00:00Z' },

  // Imran Raza Khan group
  { id: 'stud-b-37', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130021', full_name: 'TAIYABA YUSUF', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-38', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130022', full_name: 'TANYA SAXENA', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-39', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130023', full_name: 'VINEET KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-40', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130024', full_name: 'VIVEK KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-41', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130025', full_name: 'YASH KUMAR', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-42', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2503400130026', full_name: 'ZAID FAROOQ', admission_type: 'Regular', mentor_faculty_id: FAC_IMRAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },

  // Lateral Entry group
  { id: 'stud-b-43', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139001', full_name: 'MUHAMMAD AMAAN KHAN', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-44', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139002', full_name: 'ASHISH KUMAR', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-45', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139003', full_name: 'BHAVANA GAUTAM', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-46', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139004', full_name: 'BHUMI SINGH', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-47', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139005', full_name: 'KARTIK GAUR', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-48', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139006', full_name: 'LAXMI SINGH', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-49', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139007', full_name: 'SAMBHAV VARSHNEY', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-50', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139008', full_name: 'SURAJ BHAN RAJPUT', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-51', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139009', full_name: 'TARUN PRATAP', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-52', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139010', full_name: 'UVAID', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'stud-b-53', institution_id: INST_ID, department_id: DEPT_CSE_ID, program_id: PROG_BTECH_CSE_ID, academic_session_id: SESSION_2026_2027_ID, academic_year_id: YEAR_2ND_ID, semester_id: SEM_3RD_ID, section_id: SEC_B_ID, roll_number: '2603400139011', full_name: 'VIKRANT SINGH', admission_type: 'Lateral Entry', mentor_faculty_id: FAC_FAIZAN_ID, active: true, created_at: '2026-08-01T00:00:00Z' }
];

export const ALL_INITIAL_STUDENTS: Student[] = [...INITIAL_STUDENTS_SEC_A, ...INITIAL_STUDENTS_SEC_B];

// Generate User Profiles for all roles
export const INITIAL_USER_PROFILES: UserProfile[] = [
  // Super Admin
  {
    id: 'user-admin-01',
    email: 'admin@vctm.in',
    role: 'super_admin',
    full_name: 'VCTM Central Administrator',
    phone: '9876543200',
  },
  // HOD
  {
    id: 'user-hod-wasim',
    email: 'wasim.cse@vctm.in',
    role: 'hod',
    full_name: 'Mr. Wasim',
    department_id: DEPT_CSE_ID,
    faculty_id: FAC_WASIM_ID,
  },
  // Faculty members
  ...INITIAL_FACULTY.map(f => ({
    id: `user-${f.id}`,
    email: f.email,
    role: (f.id === FAC_WASIM_ID ? 'hod' : 'faculty') as 'hod' | 'faculty',
    full_name: f.full_name,
    department_id: DEPT_CSE_ID,
    faculty_id: f.id,
    phone: f.phone,
  })),
  // All Students
  ...ALL_INITIAL_STUDENTS.map(s => ({
    id: `user-${s.id}`,
    email: `${s.roll_number}@student.vctm.in`,
    role: 'student' as const,
    full_name: s.full_name,
    department_id: DEPT_CSE_ID,
    student_id: s.id,
  }))
];

// Initial Realistic Historical Attendance Data for Past Days (Aug 20, 21, 22)
export const INITIAL_ATTENDANCE_SESSIONS: AttendanceSession[] = [
  {
    id: 'att-session-01',
    timetable_entry_id: 'tt-a-mon-1',
    faculty_id: FAC_KULDEEP_ID,
    section_id: SEC_A_ID,
    subject_id: SUB_COA_ID,
    session_date: '2026-08-20',
    start_time: '09:00',
    end_time: '09:50',
    status: 'completed',
    marked_at: '2026-08-20T09:48:00Z',
    created_at: '2026-08-20T09:48:00Z',
  },
  {
    id: 'att-session-02',
    timetable_entry_id: 'tt-a-mon-2',
    faculty_id: FAC_NASEEM_ID,
    section_id: SEC_A_ID,
    subject_id: SUB_MATHS4_ID,
    session_date: '2026-08-20',
    start_time: '09:50',
    end_time: '10:40',
    status: 'completed',
    marked_at: '2026-08-20T10:35:00Z',
    created_at: '2026-08-20T10:35:00Z',
  },
  {
    id: 'att-session-03',
    timetable_entry_id: 'tt-a-mon-3',
    faculty_id: FAC_HEMLATA_ID,
    section_id: SEC_A_ID,
    subject_id: SUB_DSTL_ID,
    session_date: '2026-08-20',
    start_time: '10:40',
    end_time: '11:30',
    status: 'completed',
    marked_at: '2026-08-20T11:28:00Z',
    created_at: '2026-08-20T11:28:00Z',
  },
  {
    id: 'att-session-04',
    timetable_entry_id: 'tt-a-mon-4',
    faculty_id: FAC_ALOK_ID,
    section_id: SEC_A_ID,
    subject_id: SUB_DS_ID,
    session_date: '2026-08-20',
    start_time: '11:30',
    end_time: '12:20',
    status: 'completed',
    marked_at: '2026-08-20T12:15:00Z',
    created_at: '2026-08-20T12:15:00Z',
  },
  {
    id: 'att-session-05',
    timetable_entry_id: 'tt-a-mon-6',
    faculty_id: FAC_SHIVANI_ID,
    section_id: SEC_A_ID,
    subject_id: SUB_UHV_ID,
    session_date: '2026-08-20',
    start_time: '13:10',
    end_time: '14:00',
    status: 'completed',
    marked_at: '2026-08-20T13:55:00Z',
    created_at: '2026-08-20T13:55:00Z',
  },
  // Section B Sessions
  {
    id: 'att-session-06',
    timetable_entry_id: 'tt-b-mon-1',
    faculty_id: FAC_HEMLATA_ID,
    section_id: SEC_B_ID,
    subject_id: SUB_DS_ID,
    session_date: '2026-08-20',
    start_time: '09:00',
    end_time: '09:50',
    status: 'completed',
    marked_at: '2026-08-20T09:46:00Z',
    created_at: '2026-08-20T09:46:00Z',
  },
  {
    id: 'att-session-07',
    timetable_entry_id: 'tt-b-mon-2',
    faculty_id: FAC_KULDEEP_ID,
    section_id: SEC_B_ID,
    subject_id: SUB_COA_ID,
    session_date: '2026-08-20',
    start_time: '09:50',
    end_time: '10:40',
    status: 'completed',
    marked_at: '2026-08-20T10:36:00Z',
    created_at: '2026-08-20T10:36:00Z',
  }
];

// Generate attendance records for initial sessions (most present, few absent to allow test correction)
export const INITIAL_ATTENDANCE_RECORDS: AttendanceRecord[] = [];

INITIAL_ATTENDANCE_SESSIONS.forEach(session => {
  const students = session.section_id === SEC_A_ID ? INITIAL_STUDENTS_SEC_A : INITIAL_STUDENTS_SEC_B;
  students.forEach((stud, idx) => {
    // Make 2-3 students absent for realistic data
    const isAbsent = (idx % 14 === 3);
    INITIAL_ATTENDANCE_RECORDS.push({
      id: `att-rec-${session.id}-${stud.id}`,
      attendance_session_id: session.id,
      student_id: stud.id,
      status: isAbsent ? 'Absent' : 'Present',
      marked_by: session.faculty_id,
      marked_at: session.marked_at,
      remarks: isAbsent ? 'Uninformed absent' : undefined,
    });
  });
});

export const INITIAL_CORRECTIONS: AttendanceCorrection[] = [
  {
    id: 'corr-001',
    attendance_record_id: `att-rec-att-session-03-${INITIAL_STUDENTS_SEC_A[3].id}`, // SHAZEB
    student_id: INITIAL_STUDENTS_SEC_A[3].id,
    requested_status: 'Present',
    reason: 'I was present in the lecture but my response was missed due to connectivity / roll call speed.',
    status: 'pending',
    created_at: '2026-08-20T14:30:00Z',
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-001',
    actor_id: 'user-admin-01',
    actor_name: 'VCTM Central Administrator',
    actor_role: 'super_admin',
    action: 'SYSTEM_INITIALIZATION',
    entity_type: 'system',
    entity_id: undefined,
    new_values: { message: 'Initialized VCTM College Attendance ERP 2026-2027' },
    created_at: '2026-08-20T08:00:00Z',
  },
  {
    id: 'audit-002',
    actor_id: `user-${FAC_KULDEEP_ID}`,
    actor_name: 'Mr. Kuldeep Kumar',
    actor_role: 'faculty',
    action: 'ATTENDANCE_MARKED',
    entity_type: 'attendance_sessions',
    entity_id: 'att-session-01',
    new_values: { section: 'A', subject: 'BCS302', date: '2026-08-20', present_count: 50, absent_count: 3 },
    created_at: '2026-08-20T09:48:00Z',
  }
];

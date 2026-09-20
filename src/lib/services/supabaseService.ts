import { supabase } from '../supabase/supabaseClient';
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
  AttendanceStatus,
  DayOfWeek,
  LectureType,
  TimetableVersion,
  Assignment,
  AssignmentSubmission,
  Quiz,
  QuizResult,
  SessionalMark,
  MarksHistory,
  SessionalType,
  SessionalAssessment,
  UserProfile,
  UserRole,
  Classroom,
  AdmissionType,
  AccountStatus,
  AdminAccountDirectoryEntry,
  ClassCoordinatorAssignment,
  FacultyDashboardPayload,
  StudentAttendanceHistoryRecord,
  StudentAttendanceHistorySummary,
  StudentNotification,
  NotificationType,
  Conversation,
  ConversationCategory,
  ConversationStatus,
  Message,
  EligibleFacultyForStudent,
  EligibleStudentForFaculty,
  LeaveApplication,
  LeaveApprovalAuditLog,
  LeaveStatus,
  LeaveType,
  MessageGroup,
  GroupMessage,
  GroupMember,
  DetailedStudentProfile,
  PromotionBatch,
  StudentAcademicHistory,
  SectionReferenceCheckResult,
  BulkPromotionPayload,
  BulkPromotionResult,
  ArchivedRecordItem,
  ArchivedStats,
  StudentFullHistoricalRecord,
  FacultyFullHistoricalRecord,
  AccountLifecycleEntry,
} from '../../types/database.types';
import { getCollegeToday, getISTTodayDate, getISTDayOfWeek } from '../utils/dateUtils';
import { erpStorage } from '../storage/erpStorage';

interface StaticSetupCache {
  timestamp: number;
  data: {
    institutions: Institution[];
    departments: Department[];
    programs: Program[];
    sessions: AcademicSession[];
    years: AcademicYear[];
    semesters: Semester[];
  };
}

export interface FullERPData {
  institutions: Institution[];
  departments: Department[];
  programs: Program[];
  sessions: AcademicSession[];
  years: AcademicYear[];
  semesters: Semester[];
  classrooms: Classroom[];
  sections: Section[];
  subjects: Subject[];
  faculty: Faculty[];
  assignments: FacultySubjectAssignment[];
  students: Student[];
  timetable: TimetableEntry[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  auditLogs: AuditLog[];
  timetableVersions: TimetableVersion[];
  courseAssignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  quizzes: Quiz[];
  quizResults: QuizResult[];
  sessionalMarks: SessionalMark[];
  marksHistory: MarksHistory[];
  sessionalAssessments: SessionalAssessment[];
}

let _staticCache: StaticSetupCache | null = null;
let _masterCache: { timestamp: number; data: any } | null = null;
const STATIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute memory cache for static institutional structure only
let _inFlightFetchAll: Promise<FullERPData | null> | null = null;
const _inFlightScopedData = new Map<string, Promise<FullERPData | null>>();
const _inFlightEnsureQuizzes = new Map<string, Promise<Quiz[]>>();
const _inFlightEnsureSessionals = new Map<string, Promise<SessionalAssessment[]>>();

export const supabaseService = {
  // Clear in-memory static cache when structural entities change
  invalidateMasterCache() {
    _staticCache = null;
    _masterCache = null;
    _inFlightFetchAll = null;
    _inFlightScopedData.clear();
    _inFlightEnsureQuizzes.clear();
    _inFlightEnsureSessionals.clear();
  },

  // 1A. Fetch Static Academic Master Entities (Institutions, Depts, Programs, Sessions, Years, Semesters)
  async fetchStaticSetup(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && _staticCache && (now - _staticCache.timestamp) < STATIC_CACHE_TTL_MS) {
      return _staticCache.data;
    }

    try {
      const [
        { data: institutions },
        { data: departments },
        { data: programs },
        { data: sessions },
        { data: years },
        { data: semesters },
      ] = await Promise.all([
        supabase.from('institutions').select('*'),
        supabase.from('departments').select('*'),
        supabase.from('programs').select('*'),
        supabase.from('academic_sessions').select('*'),
        supabase.from('academic_years').select('*').eq('active', true).neq('year_number', 1).order('year_number'),
        supabase.from('semesters').select('*').eq('active', true).order('semester_number'),
      ]);

      const staticResult = {
        institutions: (institutions as Institution[]) || [],
        departments: (departments as Department[]) || [],
        programs: (programs as Program[]) || [],
        sessions: (sessions as AcademicSession[]) || [],
        years: ((years as AcademicYear[]) || []).filter(y => y.active && y.year_number !== 1),
        semesters: ((semesters as Semester[]) || []).filter(s => s.active),
      };

      _staticCache = {
        timestamp: now,
        data: staticResult,
      };

      return staticResult;
    } catch (err) {
      console.error('Error fetching static setup from Supabase:', err);
      if (_staticCache) return _staticCache.data;
      return null;
    }
  },

  // 1B. Fetch Dynamic Structural Academic Entities (Sections, Subjects, Faculty, Assignments, Classrooms) - FAST & LIGHTWEIGHT
  async fetchAcademicEntities() {
    try {
      const [
        { data: sections },
        { data: subjects },
        { data: faculty },
        { data: assignments },
        { data: classroomsList },
      ] = await Promise.all([
        supabase.from('sections').select('*').eq('active', true).order('name', { ascending: true }),
        supabase.from('subjects').select('*').eq('active', true).order('subject_code', { ascending: true }),
        supabase.from('faculty').select('*').order('full_name', { ascending: true }),
        supabase.from('faculty_subject_assignments').select('*').eq('active', true),
        supabase.from('classrooms').select('*').eq('active', true).order('room_number', { ascending: true }),
      ]);

      return {
        sections: (sections as Section[]) || [],
        subjects: (subjects as Subject[]) || [],
        faculty: (faculty as Faculty[]) || [],
        assignments: (assignments as FacultySubjectAssignment[]) || [],
        students: [] as Student[],
        profiles: [] as UserProfile[],
        classrooms: (classroomsList as Classroom[]) || [],
      };
    } catch (err) {
      console.error('Error fetching dynamic academic entities from Supabase:', err);
      return null;
    }
  },

  async fetchClassrooms(): Promise<Classroom[]> {
    const { data, error } = await supabase.from('classrooms').select('*').order('room_number', { ascending: true });
    if (error) {
      console.error('Error fetching classrooms:', error.message);
      return [];
    }
    return (data as Classroom[]) || [];
  },

  // Backward-compatible fetchMasterData combining static setup + dynamic academic entities
  async fetchMasterData(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && _masterCache && (now - _masterCache.timestamp) < STATIC_CACHE_TTL_MS) {
      return _masterCache.data;
    }

    const [staticSetup, academicEntities] = await Promise.all([
      this.fetchStaticSetup(forceRefresh),
      this.fetchAcademicEntities(),
    ]);

    if (!staticSetup || !academicEntities) return null;

    const result = {
      ...staticSetup,
      ...academicEntities,
    };
    _masterCache = { timestamp: now, data: result };
    return result;
  },

  // 1C. Granular Table Fetchers for Target Realtime Invalidation (< 50ms)
  async fetchStudents(activeOnly = false): Promise<Student[]> {
    let q = supabase.from('students').select('*').order('roll_number', { ascending: true });
    if (activeOnly) {
      q = q.eq('active', true).or('status.is.null,status.eq.ACTIVE');
    }
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching students:', error.message);
      return [];
    }
    return (data as Student[]) || [];
  },

  async fetchFaculty(activeOnly = false): Promise<Faculty[]> {
    let q = supabase.from('faculty').select('*').order('full_name', { ascending: true });
    if (activeOnly) {
      q = q.eq('active', true).or('status.is.null,status.eq.ACTIVE');
    }
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching faculty:', error.message);
      return [];
    }
    return (data as Faculty[]) || [];
  },

  async fetchSections(activeOnly = false): Promise<Section[]> {
    let q = supabase.from('sections').select('*').order('name', { ascending: true });
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching sections:', error.message);
      return [];
    }
    return (data as Section[]) || [];
  },

  async fetchSubjects(activeOnly = false): Promise<Subject[]> {
    let q = supabase.from('subjects').select('*').order('subject_code', { ascending: true });
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching subjects:', error.message);
      return [];
    }
    return (data as Subject[]) || [];
  },

  async fetchAssignments(activeOnly = true): Promise<FacultySubjectAssignment[]> {
    let q = supabase.from('faculty_subject_assignments').select('*');
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching assignments:', error.message);
      return [];
    }
    return (data as FacultySubjectAssignment[]) || [];
  },

  async fetchTimetable(sectionId?: string): Promise<TimetableEntry[]> {
    let q = supabase.from('timetable_entries').select('*').eq('active', true).order('period_number', { ascending: true });
    if (sectionId) q = q.eq('section_id', sectionId);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching timetable:', error.message);
      return [];
    }
    return (data as TimetableEntry[]) || [];
  },

  // Authoritative Timetable Query (Single Source of Truth)
  async getPublishedTimetable(filter?: {
    academicSessionId?: string;
    sectionId?: string;
    facultyId?: string;
    dayOfWeek?: DayOfWeek;
    subjectId?: string;
    activeOnly?: boolean;
  }): Promise<TimetableEntry[]> {
    let q = supabase.from('timetable_entries').select('*');
    if (filter?.activeOnly !== false) {
      q = q.eq('active', true);
    }
    if (filter?.sectionId) {
      q = q.eq('section_id', filter.sectionId);
    }
    if (filter?.facultyId) {
      q = q.eq('faculty_id', filter.facultyId);
    }
    if (filter?.dayOfWeek) {
      q = q.eq('day_of_week', filter.dayOfWeek);
    }
    if (filter?.subjectId) {
      q = q.eq('subject_id', filter.subjectId);
    }
    q = q.order('period_number', { ascending: true });

    const { data, error } = await q;
    if (error) {
      console.error('Error in getPublishedTimetable:', error.message);
      return [];
    }

    const daysOrder: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const entries = (data as TimetableEntry[]) || [];
    return entries.sort((a, b) => {
      const dA = daysOrder.indexOf(a.day_of_week);
      const dB = daysOrder.indexOf(b.day_of_week);
      if (dA !== dB) return dA - dB;
      return a.period_number - b.period_number;
    });
  },

  async fetchAllAttendanceRecords(limit = 5000): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, attendance_session_id, student_id, status, remarks, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching paginated attendance records:', error.message);
      return [];
    }
    return (data as unknown as AttendanceRecord[]) || [];
  },

  async fetchAllAttendanceSessions(limit = 500): Promise<AttendanceSession[]> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('id, section_id, subject_id, faculty_id, session_date, start_time, end_time, timetable_entry_id, status, marked_at, created_at, updated_at')
      .order('session_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching paginated attendance sessions:', error.message);
      return [];
    }
    return (data as unknown as AttendanceSession[]) || [];
  },

  async fetchSessionAttendanceRecords(sessionId: string): Promise<AttendanceRecord[]> {
    if (!sessionId) return [];
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('attendance_session_id', sessionId);
    if (error) {
      console.error(`Error fetching records for session ${sessionId}:`, error.message);
      return [];
    }
    return (data as AttendanceRecord[]) || [];
  },

  async fetchAttendance(): Promise<{ attendanceSessions: AttendanceSession[]; attendanceRecords: AttendanceRecord[] }> {
    const [attendanceSessions, attendanceRecords] = await Promise.all([
      this.fetchAllAttendanceSessions(),
      this.fetchAllAttendanceRecords(),
    ]);
    return {
      attendanceSessions,
      attendanceRecords,
    };
  },

  async fetchCorrections(limit = 200): Promise<AttendanceCorrection[]> {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .select(`
        *,
        student:students(*),
        record:attendance_records(
          *,
          session:attendance_sessions(
            *,
            subject:subjects(*),
            section:sections(*),
            faculty:faculty(*)
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Error fetching corrections:', error.message);
      return [];
    }
    return (data as AttendanceCorrection[]) || [];
  },

  async fetchAssessments() {
    const [
      { data: courseAssignments },
      { data: assignmentSubmissions },
      { data: quizzes },
      { data: quizResults },
      { data: sessionalMarks },
      { data: marksHistory },
      { data: sessionalAssessments },
    ] = await Promise.all([
      supabase.from('assignments').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }).limit(300),
      supabase.from('quizzes').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('quiz_results').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('sessional_marks').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('marks_history').select('*').order('updated_at', { ascending: false }).limit(200),
      supabase.from('sessional_assessments').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    return {
      courseAssignments: (courseAssignments as Assignment[]) || [],
      assignmentSubmissions: (assignmentSubmissions as AssignmentSubmission[]) || [],
      quizzes: (quizzes as Quiz[]) || [],
      quizResults: (quizResults as QuizResult[]) || [],
      sessionalMarks: (sessionalMarks as SessionalMark[]) || [],
      marksHistory: (marksHistory as MarksHistory[]) || [],
      sessionalAssessments: (sessionalAssessments as SessionalAssessment[]) || [],
    };
  },

  // 1D. Fetch Dynamic Operational Data (Timetable, Attendance, Assessments, Audit) - LIGHTWEIGHT DASHBOARD SLICE
  async fetchOperationalData() {
    try {
      const [
        { data: timetable },
        attendanceSessions,
        attendanceRecords,
        corrections,
        { data: auditLogs },
        { data: timetableVersions },
        { data: assignmentsList },
        { data: submissionsList },
        { data: quizzesList },
        { data: quizResultsList },
        { data: sessionalMarksList },
        { data: marksHistoryList },
        { data: sessionalAssessmentsList },
      ] = await Promise.all([
        supabase.from('timetable_entries').select('id, section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active, created_at, updated_at').eq('active', true).order('period_number', { ascending: true }),
        this.fetchAllAttendanceSessions(50),
        this.fetchAllAttendanceRecords(200),
        this.fetchCorrections(50),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(25),
        supabase.from('timetable_versions').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('assignments').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }).limit(50),
        supabase.from('quizzes').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('quiz_results').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('sessional_marks').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('marks_history').select('*').order('updated_at', { ascending: false }).limit(30),
        supabase.from('sessional_assessments').select('*').order('created_at', { ascending: false }).limit(30),
      ]);

      return {
        timetable: (timetable as unknown as TimetableEntry[]) || [],
        attendanceSessions: (attendanceSessions as unknown as AttendanceSession[]) || [],
        attendanceRecords: (attendanceRecords as unknown as AttendanceRecord[]) || [],
        corrections: (corrections as AttendanceCorrection[]) || [],
        auditLogs: (auditLogs as AuditLog[]) || [],
        timetableVersions: (timetableVersions as TimetableVersion[]) || [],
        courseAssignments: (assignmentsList as Assignment[]) || [],
        assignmentSubmissions: (submissionsList as AssignmentSubmission[]) || [],
        quizzes: (quizzesList as Quiz[]) || [],
        quizResults: (quizResultsList as QuizResult[]) || [],
        sessionalMarks: (sessionalMarksList as SessionalMark[]) || [],
        marksHistory: (marksHistoryList as MarksHistory[]) || [],
        sessionalAssessments: (sessionalAssessmentsList as SessionalAssessment[]) || [],
      };
    } catch (err) {
      console.error('Error fetching operational data from Supabase:', err);
      return null;
    }
  },

  // 1E. Scoped Student Attendance Query (Only student's records & section sessions)
  async fetchStudentAttendance(studentId: string, sectionId?: string) {
    try {
      const [recordsRes, sessionsRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id, attendance_session_id, student_id, status, remarks, created_at, updated_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(300),
        sectionId
          ? supabase
              .from('attendance_sessions')
              .select('id, section_id, subject_id, faculty_id, session_date, start_time, end_time, timetable_entry_id, created_at, updated_at')
              .eq('section_id', sectionId)
              .order('session_date', { ascending: false })
              .limit(100)
          : supabase
              .from('attendance_sessions')
              .select('id, section_id, subject_id, faculty_id, session_date, start_time, end_time, timetable_entry_id, created_at, updated_at')
              .order('session_date', { ascending: false })
              .limit(100),
      ]);

      return {
        attendanceRecords: (recordsRes.data as unknown as AttendanceRecord[]) || [],
        attendanceSessions: (sessionsRes.data as unknown as AttendanceSession[]) || [],
      };
    } catch (err) {
      console.error('Error fetching scoped student attendance:', err);
      return { attendanceRecords: [], attendanceSessions: [] };
    }
  },

  // 1F. Scoped Student Academic Records (Assignments, Submissions, Quizzes, Sessional Marks)
  async fetchStudentAcademicRecords(studentId: string, sectionId?: string) {
    try {
      const [
        { data: assignmentsList },
        { data: submissionsList },
        { data: quizzesList },
        { data: quizResultsList },
        { data: sessionalMarksList },
        { data: sessionalAssessmentsList },
      ] = await Promise.all([
        sectionId
          ? supabase.from('assignments').select('*').eq('section_id', sectionId).eq('active', true).order('created_at', { ascending: false }).limit(50)
          : supabase.from('assignments').select('*').eq('active', true).order('created_at', { ascending: false }).limit(50),
        supabase.from('assignment_submissions').select('*').eq('student_id', studentId).order('submitted_at', { ascending: false }).limit(100),
        sectionId
          ? supabase.from('quizzes').select('*').eq('section_id', sectionId).eq('active', true).order('created_at', { ascending: false }).limit(50)
          : supabase.from('quizzes').select('*').eq('active', true).order('created_at', { ascending: false }).limit(50),
        supabase.from('quiz_results').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(100),
        supabase.from('sessional_marks').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(100),
        sectionId
          ? supabase.from('sessional_assessments').select('*').eq('section_id', sectionId).order('created_at', { ascending: false }).limit(50)
          : supabase.from('sessional_assessments').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      return {
        courseAssignments: (assignmentsList as Assignment[]) || [],
        assignmentSubmissions: (submissionsList as AssignmentSubmission[]) || [],
        quizzes: (quizzesList as Quiz[]) || [],
        quizResults: (quizResultsList as QuizResult[]) || [],
        sessionalMarks: (sessionalMarksList as SessionalMark[]) || [],
        sessionalAssessments: (sessionalAssessmentsList as SessionalAssessment[]) || [],
      };
    } catch (err) {
      console.error('Error fetching scoped student academic records:', err);
      return {
        courseAssignments: [],
        assignmentSubmissions: [],
        quizzes: [],
        quizResults: [],
        sessionalMarks: [],
        sessionalAssessments: [],
      };
    }
  },

  // 1F-2. Scoped Faculty Academic Records (Only faculty's assignments, submissions, quizzes, marks)
  async fetchFacultyAcademicRecords(facultyId: string) {
    try {
      const [
        assignmentsRes,
        quizzesRes,
        assessmentsRes,
        sessionalMarksRes,
      ] = await Promise.all([
        supabase.from('assignments').select('*').eq('faculty_id', facultyId).order('created_at', { ascending: false }).limit(100),
        supabase.from('quizzes').select('*').eq('faculty_id', facultyId).order('created_at', { ascending: false }).limit(100),
        supabase.from('sessional_assessments').select('*').eq('faculty_id', facultyId).order('created_at', { ascending: false }).limit(100),
        supabase.from('sessional_marks').select('*').eq('faculty_id', facultyId).order('created_at', { ascending: false }).limit(500),
      ]);

      const assignmentIds = (assignmentsRes.data || []).map(a => a.id);
      const quizIds = (quizzesRes.data || []).map(q => q.id);

      const [submissionsRes, quizResultsRes] = await Promise.all([
        assignmentIds.length > 0
          ? supabase.from('assignment_submissions').select('*').in('assignment_id', assignmentIds).limit(300)
          : Promise.resolve({ data: [] }),
        quizIds.length > 0
          ? supabase.from('quiz_results').select('*').in('quiz_id', quizIds).limit(300)
          : Promise.resolve({ data: [] }),
      ]);

      return {
        courseAssignments: (assignmentsRes.data as Assignment[]) || [],
        assignmentSubmissions: (submissionsRes.data as AssignmentSubmission[]) || [],
        quizzes: (quizzesRes.data as Quiz[]) || [],
        quizResults: (quizResultsRes.data as QuizResult[]) || [],
        sessionalMarks: (sessionalMarksRes.data as SessionalMark[]) || [],
        sessionalAssessments: (assessmentsRes.data as SessionalAssessment[]) || [],
        marksHistory: [],
      };
    } catch (err) {
      console.error('Error in fetchFacultyAcademicRecords:', err);
      return {
        courseAssignments: [],
        assignmentSubmissions: [],
        quizzes: [],
        quizResults: [],
        sessionalMarks: [],
        sessionalAssessments: [],
        marksHistory: [],
      };
    }
  },

  // 1G. Role-Scoped Fast ERP Data Loader (P0/P1 Priority Pipeline with In-Flight Deduplication)
  async fetchScopedData(params: {
    role?: UserRole | null;
    studentId?: string;
    sectionId?: string;
    facultyId?: string;
    departmentId?: string;
    forceRefreshMaster?: boolean;
  }): Promise<FullERPData | null> {
    const dedupKey = `${params.role || 'anon'}_${params.studentId || ''}_${params.facultyId || ''}_${params.sectionId || ''}_${params.forceRefreshMaster ? '1' : '0'}`;
    const existing = _inFlightScopedData.get(dedupKey);
    if (existing) {
      return existing;
    }

    const fetchPromise = (async (): Promise<FullERPData | null> => {
      try {
        // 1. Master Structure (Cached in-memory / localStorage, sub-millisecond if fresh)
        const masterData = await this.fetchMasterData(params.forceRefreshMaster || false);
        if (!masterData) return null;

        // 2. Role-Scoped Operational Slice
        if (params.role === 'student' && params.studentId) {
          const [studentAtt, studentAcad, { data: timetable }, correctionsRes, { data: sectionStudents }] = await Promise.all([
            this.fetchStudentAttendance(params.studentId, params.sectionId),
            this.fetchStudentAcademicRecords(params.studentId, params.sectionId),
            params.sectionId
              ? supabase.from('timetable_entries').select('id, section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active, created_at, updated_at').eq('section_id', params.sectionId).eq('active', true).order('period_number', { ascending: true })
              : supabase.from('timetable_entries').select('id, section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active, created_at, updated_at').eq('active', true).order('period_number', { ascending: true }),
            supabase.from('attendance_corrections').select('*').eq('student_id', params.studentId).order('created_at', { ascending: false }).limit(20),
            params.sectionId
              ? supabase.from('students').select('*').eq('section_id', params.sectionId).eq('active', true).or('status.eq.ACTIVE,status.is.null').order('roll_number', { ascending: true })
              : supabase.from('students').select('*').eq('id', params.studentId),
          ]);

          return {
            ...masterData,
            students: (sectionStudents as Student[]) || [],
            timetable: (timetable as unknown as TimetableEntry[]) || [],
            attendanceSessions: studentAtt.attendanceSessions,
            attendanceRecords: studentAtt.attendanceRecords,
            corrections: (correctionsRes.data as AttendanceCorrection[]) || [],
            auditLogs: [],
            timetableVersions: [],
            courseAssignments: studentAcad.courseAssignments,
            assignmentSubmissions: studentAcad.assignmentSubmissions,
            quizzes: studentAcad.quizzes,
            quizResults: studentAcad.quizResults,
            sessionalMarks: studentAcad.sessionalMarks,
            marksHistory: [],
            sessionalAssessments: studentAcad.sessionalAssessments,
          };
        }

        if (params.role === 'faculty' && params.facultyId) {
          const [
            { data: timetable },
            sessionsRes,
            correctionsRes,
            { data: assignmentsList },
            { data: quizzesList },
            { data: assessmentsList },
          ] = await Promise.all([
            supabase.from('timetable_entries').select('id, section_id, subject_id, faculty_id, day_of_week, period_number, start_time, end_time, room_number, lecture_type, active, created_at, updated_at').eq('faculty_id', params.facultyId).eq('active', true).order('period_number', { ascending: true }),
            supabase.from('attendance_sessions').select('id, section_id, subject_id, faculty_id, session_date, start_time, end_time, timetable_entry_id, created_at, updated_at').eq('faculty_id', params.facultyId).order('session_date', { ascending: false }).limit(100),
            this.fetchCorrections(50),
            supabase.from('assignments').select('*').eq('faculty_id', params.facultyId).order('created_at', { ascending: false }).limit(50),
            supabase.from('quizzes').select('*').eq('faculty_id', params.facultyId).order('created_at', { ascending: false }).limit(50),
            supabase.from('sessional_assessments').select('*').eq('faculty_id', params.facultyId).order('created_at', { ascending: false }).limit(50),
          ]);

          // Fetch students strictly in sections assigned to this faculty
          const sectionIds = Array.from(new Set([
            ...(assignmentsList || []).map((a: any) => a.section_id),
            ...(timetable || []).map((t: any) => t.section_id),
          ])).filter(Boolean);

          const { data: facultyStudents } = sectionIds.length > 0
            ? await supabase.from('students').select('*').in('section_id', sectionIds).eq('active', true).or('status.eq.ACTIVE,status.is.null').order('roll_number', { ascending: true })
            : { data: [] };

          return {
            ...masterData,
            students: (facultyStudents as Student[]) || [],
            timetable: (timetable as unknown as TimetableEntry[]) || [],
            attendanceSessions: (sessionsRes.data as unknown as AttendanceSession[]) || [],
            attendanceRecords: [],
            corrections: correctionsRes,
            auditLogs: [],
            timetableVersions: [],
            courseAssignments: (assignmentsList as Assignment[]) || [],
            assignmentSubmissions: [],
            quizzes: (quizzesList as Quiz[]) || [],
            quizResults: [],
            sessionalMarks: [],
            marksHistory: [],
            sessionalAssessments: (assessmentsList as SessionalAssessment[]) || [],
          };
        }

        // Default for Admin or initial load before auth resolves: delegate to fetchOperationalData
        const [operationalData, allStudents] = await Promise.all([
          this.fetchOperationalData(),
          this.fetchStudents(true),
        ]);
        if (!operationalData) return null;

        return {
          ...masterData,
          students: allStudents,
          ...operationalData,
        };
      } catch (err) {
        console.error('Error in fetchScopedData:', err);
        return this.fetchAllData(params.forceRefreshMaster);
      } finally {
        _inFlightScopedData.delete(dedupKey);
      }
    })();

    _inFlightScopedData.set(dedupKey, fetchPromise);
    return fetchPromise;
  },

  // 1H. Fetch All Master & Operational Data (Composed in parallel with Promise deduplication)
  fetchAllData(forceRefreshMaster = false): Promise<FullERPData | null> {
    if (_inFlightFetchAll) {
      return _inFlightFetchAll;
    }

    const fetchPromise = (async () => {
      try {
        const [staticSetup, academicEntities, operationalData, allStudents] = await Promise.all([
          this.fetchStaticSetup(forceRefreshMaster),
          this.fetchAcademicEntities(),
          this.fetchOperationalData(),
          this.fetchStudents(true),
        ]);

        if (!staticSetup || !academicEntities || !operationalData) {
          return null;
        }

        return {
          ...staticSetup,
          ...academicEntities,
          students: allStudents,
          ...operationalData,
        };
      } catch (err) {
        console.error('Error fetching combined data from Supabase:', err);
        return null;
      } finally {
        _inFlightFetchAll = null;
      }
    })();

    _inFlightFetchAll = fetchPromise;
    return fetchPromise;
  },

  // 2. Save Live Attendance Session & Student Records (Fast Single-Round-Trip Atomic Supabase Flow)
  async saveAttendance(params: {
    timetableEntryId?: string;
    facultyId: string;
    sectionId: string;
    subjectId: string;
    sessionDate: string;
    startTime?: string;
    endTime?: string;
    studentRecords: Array<{
      studentId: string;
      status: AttendanceStatus | 'Unmarked';
      remarks?: string;
    }>;
  }) {
    console.log('ATTENDANCE_SAVE_START', {
      sectionId: params.sectionId,
      subjectId: params.subjectId,
      sessionDate: params.sessionDate,
      timetableEntryId: params.timetableEntryId,
      recordCount: params.studentRecords?.length
    });

    // 1. Fast Synchronous Validations
    const today = getISTTodayDate();
    if (params.sessionDate > today) {
      console.error('ATTENDANCE_SAVE_FAILED', `Invalid date: ${params.sessionDate}`);
      throw new Error(`Invalid attendance date: ${params.sessionDate}. Attendance cannot be recorded for future dates.`);
    }

    if (!params.sectionId || !params.subjectId || !params.facultyId) {
      console.error('ATTENDANCE_SAVE_FAILED', 'Missing required class parameters');
      throw new Error('Missing section, subject, or faculty information.');
    }

    if (!params.studentRecords || params.studentRecords.length === 0) {
      console.error('ATTENDANCE_SAVE_FAILED', 'No student records provided');
      throw new Error('Cannot submit empty attendance roster.');
    }

    for (const sr of params.studentRecords) {
      if (!sr.studentId || (sr.status !== 'Present' && sr.status !== 'Absent' && sr.status !== 'Unmarked')) {
        console.error('ATTENDANCE_SAVE_FAILED', `Invalid status for student ${sr.studentId}: ${sr.status}`);
        throw new Error(`Invalid status for student ${sr.studentId}: ${sr.status}. Status must be Present, Absent, or Unmarked.`);
      }
    }

    // 2. Atomic PostgreSQL RPC Save (Handles authorization, student verification, session upsert, record upsert in 1 transaction)
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('save_attendance_session', {
      p_timetable_entry_id: params.timetableEntryId || null,
      p_faculty_id: params.facultyId,
      p_section_id: params.sectionId,
      p_subject_id: params.subjectId,
      p_session_date: params.sessionDate,
      p_start_time: (params.startTime || '09:00:00').length === 5 ? `${params.startTime}:00` : (params.startTime || '09:00:00'),
      p_end_time: (params.endTime || '09:50:00').length === 5 ? `${params.endTime}:00` : (params.endTime || '09:50:00'),
      p_records: params.studentRecords.map(sr => ({
        student_id: sr.studentId,
        status: sr.status,
        remarks: sr.remarks || null,
      })),
    });

    if (rpcErr || !rpcRes?.session_id) {
      console.error('ATTENDANCE_SAVE_FAILED', rpcErr || 'No session returned from RPC');
      throw new Error(rpcErr?.message || 'Database error: Failed to record attendance.');
    }

    const sessionId = rpcRes.session_id;

    // Direct return of session and records from RPC payload (0 secondary round trips)
    let sessionData = rpcRes.session as AttendanceSession | undefined;
    let recordsData = rpcRes.records as AttendanceRecord[] | undefined;

    // Fallback if legacy response without embedded json
    if (!sessionData || !recordsData) {
      const [sessVerify, recsVerify] = await Promise.all([
        supabase.from('attendance_sessions').select('*').eq('id', sessionId).single(),
        supabase.from('attendance_records').select('*').eq('attendance_session_id', sessionId),
      ]);
      sessionData = sessVerify.data as AttendanceSession;
      recordsData = (recsVerify.data as AttendanceRecord[]) || [];
    }

    // 3. Broadcast Realtime Attendance Update
    try {
      const channel = supabase.channel('vctm-erp-realtime-channel');
      await channel.send({
        type: 'broadcast',
        event: 'attendance_updated',
        payload: {
          session_id: sessionId,
          section_id: params.sectionId,
          subject_id: params.subjectId,
          session_date: params.sessionDate,
          timestamp: new Date().toISOString(),
        }
      });
    } catch {}

    return { 
      session: sessionData, 
      records: recordsData,
      stats: rpcRes
    };
  },

  // 3. Delete Attendance Session (Authorized HOD/Admin/Faculty)
  async deleteAttendanceSession(sessionId: string) {
    if (!sessionId) throw new Error('Session ID is required to delete attendance.');

    // 1. Delete associated corrections if any
    const { data: recs } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('attendance_session_id', sessionId);

    if (recs && recs.length > 0) {
      const recIds = recs.map(r => r.id);
      await supabase
        .from('attendance_corrections')
        .delete()
        .in('attendance_record_id', recIds);
    }

    // 2. Delete child attendance records
    const { error: recErr } = await supabase
      .from('attendance_records')
      .delete()
      .eq('attendance_session_id', sessionId);
    if (recErr) throw recErr;

    // 3. Delete session
    const { error: sessErr } = await supabase
      .from('attendance_sessions')
      .delete()
      .eq('id', sessionId);
    if (sessErr) throw sessErr;

    // 4. Broadcast Realtime event (do not invalidate master static setup cache)
    try {
      const channel = supabase.channel('vctm-erp-realtime-channel');
      await channel.send({
        type: 'broadcast',
        event: 'attendance_updated',
        payload: {
          session_id: sessionId,
          action: 'deleted',
          timestamp: new Date().toISOString(),
        }
      });
    } catch {}

    return { success: true, deletedSessionId: sessionId };
  },

  // 3. Ensure Attendance Session & Record (for unrecorded lecture claims)
  async ensureAttendanceSessionAndRecord(params: {
    timetableEntryId: string;
    sessionDate: string;
    subjectId: string;
    facultyId: string;
    sectionId: string;
    studentId: string;
    status: AttendanceStatus;
  }): Promise<{ sessionId: string; recordId: string }> {
    // 1. Check if session exists in Supabase
    let { data: session } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('section_id', params.sectionId)
      .eq('subject_id', params.subjectId)
      .eq('session_date', params.sessionDate)
      .maybeSingle();

    if (!session) {
      const { data: newSession, error: sErr } = await supabase
        .from('attendance_sessions')
        .insert({
          timetable_entry_id: params.timetableEntryId,
          faculty_id: params.facultyId,
          section_id: params.sectionId,
          subject_id: params.subjectId,
          session_date: params.sessionDate,
          start_time: '09:00:00',
          end_time: '09:50:00',
          status: 'pending',
        })
        .select('id')
        .single();

      if (sErr || !newSession) {
        throw new Error(`Failed to create attendance session: ${sErr?.message}`);
      }
      session = newSession;
    }

    // 2. Check if student record exists
    let { data: record } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('attendance_session_id', session.id)
      .eq('student_id', params.studentId)
      .maybeSingle();

    if (!record) {
      const { data: newRec, error: rErr } = await supabase
        .from('attendance_records')
        .insert({
          attendance_session_id: session.id,
          student_id: params.studentId,
          status: params.status || 'Absent',
          marked_by: params.facultyId,
          remarks: 'Claim initiated for unrecorded lecture',
        })
        .select('id')
        .single();

      if (rErr || !newRec) {
        throw new Error(`Failed to create attendance record: ${rErr?.message}`);
      }
      record = newRec;
    }

    return { sessionId: session.id, recordId: record.id };
  },

  // 3B. Authoritative Student Attendance Claim via RPC (Enforces 09:00 AM - 03:40 PM IST Window Server-Side)
  async claimAttendance(params: {
    timetableEntryId?: string;
    attendanceRecordId?: string;
    studentId: string;
    reason: string;
    requestedStatus?: AttendanceStatus;
    simulatedTime?: string;
    simulatedDate?: string;
  }): Promise<{
    success: boolean;
    code: string;
    message: string;
    id?: string;
    claimId?: string;
    sessionId?: string;
    recordId?: string;
  }> {
    const { data, error } = await supabase.rpc('claim_attendance', {
      p_timetable_entry_id: params.timetableEntryId || null,
      p_student_id: params.studentId,
      p_reason: params.reason,
      p_requested_status: params.requestedStatus || 'Present',
      p_simulated_time: params.simulatedTime || null,
      p_simulated_date: params.simulatedDate || null,
      p_attendance_record_id: params.attendanceRecordId || null,
    });

    if (error) {
      throw new Error(error.message || 'Failed to submit attendance claim to server.');
    }

    const res = data as any;
    if (!res || !res.success) {
      const errMessage = res?.message || 'Attendance claim was rejected by institutional policy.';
      const err = new Error(errMessage) as any;
      err.code = res?.code || 'ATTENDANCE_CLAIM_REJECTED';
      throw err;
    }

    // Dual-layer notification dispatch: Ensure assigned faculty member is notified
    try {
      if (res?.session_id) {
        const { data: sess } = await supabase
          .from('attendance_sessions')
          .select('faculty_id, section:sections(name), subject:subjects(subject_name)')
          .eq('id', res.session_id)
          .maybeSingle();

        if (sess?.faculty_id) {
          const { data: fac } = await supabase.from('faculty').select('auth_user_id').eq('id', sess.faculty_id).maybeSingle();
          const { data: st } = await supabase.from('students').select('full_name, roll_number').eq('id', params.studentId).maybeSingle();
          
          // Check if notification already created by database trigger to avoid duplicate
          const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('reference_id', res.claim_id)
            .eq('recipient_faculty_id', sess.faculty_id)
            .maybeSingle();

          if (!existingNotif) {
            await supabase.from('notifications').insert([{
              recipient_user_id: fac?.auth_user_id || null,
              recipient_faculty_id: sess.faculty_id,
              recipient_role: 'faculty',
              type: 'ATTENDANCE_CLAIM' as NotificationType,
              title: 'New Attendance Correction Request',
              message: `${st?.full_name || 'Student'} (${st?.roll_number || 'Roll N/A'}) submitted an attendance claim for ${(sess.subject as any)?.subject_name || 'Class'}. Reason: ${params.reason}`,
              reference_type: 'attendance_correction',
              reference_id: res.claim_id,
              is_read: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }]);
          }
        }
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for claimAttendance:', notifErr);
    }

    return {
      success: true,
      code: res.code,
      message: res.message,
      id: res.claim_id,
      claimId: res.claim_id,
      sessionId: res.session_id,
      recordId: res.record_id,
    };
  },

  // 4A. Atomic Approve Attendance Claim RPC
  async approveAttendanceClaim(params: {
    claimId: string;
    facultyId: string;
    remarks?: string;
  }): Promise<{
    success: boolean;
    code: string;
    message: string;
    claimId: string;
    recordId: string;
    studentId: string;
    status: string;
  }> {
    const { data, error } = await supabase.rpc('approve_attendance_claim', {
      p_claim_id: params.claimId,
      p_faculty_id: params.facultyId,
      p_remarks: params.remarks || null,
    });

    if (error) {
      throw new Error(error.message || 'Failed to approve attendance claim.');
    }

    const res = data as any;
    if (!res || !res.success) {
      const err = new Error(res?.message || 'Approval rejected.') as any;
      err.code = res?.code || 'CLAIM_APPROVAL_FAILED';
      throw err;
    }

    // Notify student of claim approval
    try {
      if (res?.studentId) {
        const { data: st } = await supabase.from('students').select('auth_user_id').eq('id', res.studentId).maybeSingle();
        await supabase.from('notifications').insert([{
          recipient_user_id: st?.auth_user_id || null,
          recipient_student_id: res.studentId,
          recipient_role: 'student',
          type: 'ATTENDANCE_CLAIM' as NotificationType,
          title: 'Attendance Claim Approved',
          message: `Your attendance claim was approved by faculty. Marked as Present.${params.remarks ? ` Remarks: ${params.remarks}` : ''}`,
          reference_type: 'attendance_claim',
          reference_id: params.claimId,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for claim approval:', notifErr);
    }

    return res;
  },

  // 4B. Atomic Reject Attendance Claim RPC
  async rejectAttendanceClaim(params: {
    claimId: string;
    facultyId: string;
    remarks?: string;
  }): Promise<{
    success: boolean;
    code: string;
    message: string;
    claimId: string;
    studentId: string;
  }> {
    const { data, error } = await supabase.rpc('reject_attendance_claim', {
      p_claim_id: params.claimId,
      p_faculty_id: params.facultyId,
      p_remarks: params.remarks || null,
    });

    if (error) {
      throw new Error(error.message || 'Failed to reject attendance claim.');
    }

    const res = data as any;
    if (!res || !res.success) {
      const err = new Error(res?.message || 'Rejection failed.') as any;
      err.code = res?.code || 'CLAIM_REJECTION_FAILED';
      throw err;
    }

    // Notify student of claim rejection
    try {
      if (res?.studentId) {
        const { data: st } = await supabase.from('students').select('auth_user_id').eq('id', res.studentId).maybeSingle();
        await supabase.from('notifications').insert([{
          recipient_user_id: st?.auth_user_id || null,
          recipient_student_id: res.studentId,
          recipient_role: 'student',
          type: 'ATTENDANCE_CLAIM' as NotificationType,
          title: 'Attendance Claim Rejected',
          message: `Your attendance claim was reviewed and rejected.${params.remarks ? ` Reason: ${params.remarks}` : ''}`,
          reference_type: 'attendance_claim',
          reference_id: params.claimId,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for claim rejection:', notifErr);
    }

    return res;
  },

  // 4C. Review Correction Request (Unified wrapper calling atomic RPCs)
  async reviewCorrection(params: {
    correctionId: string;
    status: 'approved' | 'rejected';
    reviewerFacultyId: string;
    reviewRemarks?: string;
  }): Promise<AttendanceCorrection> {
    if (params.status === 'approved') {
      await this.approveAttendanceClaim({
        claimId: params.correctionId,
        facultyId: params.reviewerFacultyId,
        remarks: params.reviewRemarks,
      });
    } else {
      await this.rejectAttendanceClaim({
        claimId: params.correctionId,
        facultyId: params.reviewerFacultyId,
        remarks: params.reviewRemarks,
      });
    }

    const { data } = await supabase
      .from('attendance_corrections')
      .select('*, student:students(*), record:attendance_records(*, session:attendance_sessions(*, subject:subjects(*), section:sections(*), faculty:faculty(*)))')
      .eq('id', params.correctionId)
      .maybeSingle();

    return data as AttendanceCorrection;
  },

  // 4D. Submit Correction Request (Direct fallback)
  async submitCorrection(params: {
    attendanceRecordId: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }) {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .insert({
        attendance_record_id: params.attendanceRecordId,
        student_id: params.studentId,
        requested_status: params.requestedStatus,
        reason: params.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit correction request: ${error.message}`);
    }

    // Notify assigned faculty
    try {
      const { data: rec } = await supabase
        .from('attendance_records')
        .select('attendance_session_id, session:attendance_sessions(faculty_id, section_id, subject_id, subject:subjects(subject_name))')
        .eq('id', params.attendanceRecordId)
        .maybeSingle();

      const facId = (rec?.session as any)?.faculty_id;
      const subName = (rec?.session as any)?.subject?.subject_name || 'Class';
      if (facId) {
        const { data: fac } = await supabase.from('faculty').select('auth_user_id').eq('id', facId).maybeSingle();
        if (fac?.auth_user_id) {
          await supabase.from('notifications').insert([{
            recipient_user_id: fac.auth_user_id,
            recipient_role: 'faculty',
            type: 'ATTENDANCE_CLAIM' as NotificationType,
            title: 'New Attendance Claim Submitted',
            message: `A student has submitted an attendance claim for ${subName}. Reason: ${params.reason}`,
            reference_type: 'attendance_correction',
            reference_id: data.id,
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
        }
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for correction request:', notifErr);
    }

    return data as AttendanceCorrection;
  },

  // 4E. Fetch Relational Claims for Faculty / HOD
  async fetchFacultyClaims(): Promise<AttendanceCorrection[]> {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .select('*, student:students(*), record:attendance_records(*, session:attendance_sessions(*, subject:subjects(*), section:sections(*), faculty:faculty(*)))')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching relational claims:', error.message);
      return [];
    }
    return (data as AttendanceCorrection[]) || [];
  },

  // 4F. Fetch Complete Student Attendance History & Performance Summary
  async fetchStudentAttendanceHistory(params: {
    studentId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StudentAttendanceHistorySummary | null> {
    const { data: student, error: studErr } = await supabase
      .from('students')
      .select(`
        id,
        roll_number,
        full_name,
        section_id,
        academic_year_id,
        section:sections(id, name),
        academic_year:academic_years(id, name, year_number)
      `)
      .eq('id', params.studentId)
      .maybeSingle();

    if (studErr || !student) {
      console.error('Student not found for attendance history:', studErr?.message);
      return null;
    }

    const { data: rawRecords, error: recErr } = await supabase
      .from('attendance_records')
      .select(`
        id,
        status,
        remarks,
        created_at,
        marked_at,
        attendance_session_id,
        session:attendance_sessions(
          id,
          session_date,
          start_time,
          end_time,
          status,
          subject_id,
          faculty_id,
          section_id,
          subject:subjects(id, subject_code, subject_name),
          faculty:faculty(id, full_name, faculty_code)
        )
      `)
      .eq('student_id', params.studentId);

    if (recErr) {
      console.error('Failed to query student attendance records:', recErr.message);
      return null;
    }

    const { data: rawCorrections } = await supabase
      .from('attendance_corrections')
      .select('*')
      .eq('student_id', params.studentId);

    const correctionMap = new Map((rawCorrections || []).map(c => [c.attendance_record_id, c]));
    const recordsList: StudentAttendanceHistoryRecord[] = [];
    const collegeToday = getCollegeToday();

    // Strict future-date validation & parameter sanitization
    const effectiveStartDate = params.startDate;
    let effectiveEndDate = params.endDate;

    // If startDate is in future, no valid attendance records can exist
    if (effectiveStartDate && effectiveStartDate > collegeToday) {
      return {
        studentId: student.id,
        rollNumber: student.roll_number,
        fullName: student.full_name,
        sectionName: (student as any).section?.name || '',
        yearName: (student as any).academic_year?.name || '',
        totalLectures: 0,
        presentCount: 0,
        absentCount: 0,
        notMarkedCount: 0,
        cancelledCount: 0,
        eligibleConducted: 0,
        attendancePercentage: null,
        records: [],
      };
    }

    // Clamp endDate to collegeToday so future attendance is never queried or returned
    if (!effectiveEndDate || effectiveEndDate > collegeToday) {
      effectiveEndDate = collegeToday;
    }

    (rawRecords || []).forEach((r: any) => {
      const session = r.session;
      if (!session) return;

      // STRICT PROTECTION: Never process or display any attendance session beyond today's date
      if (session.session_date > collegeToday) return;

      if (effectiveStartDate && session.session_date < effectiveStartDate) return;
      if (effectiveEndDate && session.session_date > effectiveEndDate) return;

      const claim = correctionMap.get(r.id);
      const displayStatus: 'Present' | 'Absent' | 'Not Marked' | 'Cancelled' = 
        session.status === 'cancelled'
          ? 'Cancelled'
          : (r.status === 'Present' ? 'Present' : 'Absent');

      recordsList.push({
        recordId: r.id,
        sessionId: session.id,
        sessionDate: session.session_date,
        startTime: session.start_time ? session.start_time.substring(0, 5) : undefined,
        endTime: session.end_time ? session.end_time.substring(0, 5) : undefined,
        subjectId: session.subject_id,
        subjectCode: session.subject?.subject_code || '',
        subjectName: session.subject?.subject_name || 'Academic Subject',
        facultyId: session.faculty_id,
        facultyName: session.faculty?.full_name || 'Assigned Faculty',
        sectionId: session.section_id,
        sectionName: (student as any).section?.name || '',
        status: displayStatus,
        rawStatus: r.status,
        remarks: r.remarks,
        claimStatus: claim?.status,
        claimId: claim?.id,
        claimReason: claim?.reason,
        claimRemarks: claim?.review_remarks,
      });
    });

    recordsList.sort((a, b) => {
      const dComp = b.sessionDate.localeCompare(a.sessionDate);
      if (dComp !== 0) return dComp;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });

    const presentCount = recordsList.filter(r => r.status === 'Present').length;
    const absentCount = recordsList.filter(r => r.status === 'Absent').length;
    const notMarkedCount = recordsList.filter(r => r.status === 'Not Marked').length;
    const cancelledCount = recordsList.filter(r => r.status === 'Cancelled').length;
    const eligibleConducted = presentCount + absentCount;
    const attendancePercentage = eligibleConducted > 0 
      ? Math.round((presentCount / eligibleConducted) * 100) 
      : null;

    return {
      studentId: student.id,
      rollNumber: student.roll_number,
      fullName: student.full_name,
      sectionName: (student as any).section?.name || '',
      yearName: (student as any).academic_year?.name || '',
      totalLectures: recordsList.length,
      presentCount,
      absentCount,
      notMarkedCount,
      cancelledCount,
      eligibleConducted,
      attendancePercentage,
      records: recordsList,
    };
  },


  // 5. Admin CRUD Operations with Supabase Profile Sync
  async addStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) {
    if (!student.section_id) {
      throw new Error('Target Section is required to add a student.');
    }

    // 1. Verify section and academic hierarchy consistency directly from database
    const { data: sec, error: secErr } = await supabase
      .from('sections')
      .select('id, semester_id, semester:semesters(id, academic_year_id, academic_year:academic_years(id, program_id, program:programs(id, department_id)))')
      .eq('id', student.section_id)
      .single();

    if (secErr || !sec) {
      throw new Error('Selected Section does not exist in the database.');
    }

    const semester = (sec as any).semester;
    const academicYear = semester?.academic_year;
    const program = academicYear?.program;

    // Validate that student's semester and year match the section's actual hierarchy
    if (student.semester_id && student.semester_id !== sec.semester_id) {
      throw new Error('Relational mismatch: Semester does not match the selected Section.');
    }
    if (student.academic_year_id && academicYear?.id && student.academic_year_id !== academicYear.id) {
      throw new Error('Relational mismatch: Academic Year does not match the selected Section.');
    }

    let sessionId = student.academic_session_id;
    if (!sessionId) {
      const { data: currentSession } = await supabase
        .from('academic_sessions')
        .select('id')
        .eq('is_current', true)
        .maybeSingle();
      sessionId = currentSession?.id || 'a358fe68-d746-4242-9f36-2c715cd9526e';
    }

    let instId = student.institution_id;
    if (!instId) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('id')
        .limit(1)
        .maybeSingle();
      instId = inst?.id || '22398afa-8679-4d2c-87fc-312152a276e2';
    }

    const cleanRoll = student.roll_number.trim().toUpperCase();
    const targetEmail = student.email?.trim().toLowerCase() || `${cleanRoll.toLowerCase()}@student.vctm.in`;

    // Atomically provision Auth User, Identity, Student Record, and Profile via SECURITY DEFINER procedure
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('provision_student_account', {
      p_roll_number: cleanRoll,
      p_full_name: student.full_name.trim().toUpperCase(),
      p_section_id: sec.id,
      p_admission_type: student.admission_type || 'Regular',
      p_email: targetEmail,
      p_password: 'student123',
      p_phone: student.phone || null,
      p_mentor_faculty_id: student.mentor_faculty_id || null,
      p_actor_name: 'Super Admin',
    });

    if (!rpcErr && rpcRes?.student_id) {
      const { data: createdStudent } = await supabase
        .from('students')
        .select('*')
        .eq('id', rpcRes.student_id)
        .single();

      this.invalidateMasterCache();
      return (createdStudent || {
        id: rpcRes.student_id,
        auth_user_id: rpcRes.auth_user_id,
        roll_number: cleanRoll,
        full_name: student.full_name,
        section_id: sec.id,
        email: targetEmail,
      }) as Student;
    }

    // Direct fallback insertion
    console.warn('RPC provision_student_account failed, applying direct insert:', rpcErr?.message);
    const payload = {
      ...student,
      roll_number: cleanRoll,
      email: targetEmail,
      institution_id: instId,
      academic_session_id: sessionId,
      mentor_faculty_id: student.mentor_faculty_id ? student.mentor_faculty_id : null,
      section_id: sec.id,
      semester_id: sec.semester_id,
      academic_year_id: academicYear?.id || student.academic_year_id,
      program_id: program?.id || student.program_id,
      department_id: program?.department_id || student.department_id,
    };

    const { data, error } = await supabase.from('students').insert(payload).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Student;
  },

  async updateStudent(id: string, updates: Partial<Student>) {
    const { data, error } = await supabase.from('students').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    const updated = data as Student;

    // Update profile if relevant
    try {
      await supabase.from('profiles').update({
        full_name: updated.full_name,
        email: updated.email || `${updated.roll_number}@vctm.in`,
        phone: updated.phone,
        department_id: updated.department_id,
      }).eq('id', id);
    } catch {}

    this.invalidateMasterCache();
    return updated;
  },

  async fetchStudentsBySection(sectionId: string, activeOnly = false): Promise<Student[]> {
    let q = supabase
      .from('students')
      .select('*, mentor:faculty(id, full_name, faculty_code)')
      .eq('section_id', sectionId)
      .order('roll_number', { ascending: true });
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching students by section:', error.message);
      return [];
    }
    return (data as Student[]) || [];
  },

  async transferStudentSection(params: {
    studentId: string;
    newSectionId: string;
    transferredBy?: string;
  }): Promise<{ success: boolean; student: Student }> {
    const { studentId, newSectionId, transferredBy = 'Administrator' } = params;

    // 1. Fetch current student
    const { data: currentStudent, error: studErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();
    if (studErr || !currentStudent) {
      throw new Error(`Student not found: ${studErr?.message || 'Unknown'}`);
    }

    // 2. Fetch new section metadata
    const { data: targetSection, error: secErr } = await supabase
      .from('sections')
      .select('*, semester:semesters(*, academic_year:academic_years(*))')
      .eq('id', newSectionId)
      .single();
    if (secErr || !targetSection) {
      throw new Error(`Target section not found: ${secErr?.message || 'Unknown'}`);
    }

    const previousSectionId = currentStudent.section_id;

    // 3. Update student's section (and matching semester/year if applicable)
    const updates: Partial<Student> = {
      section_id: newSectionId,
      semester_id: targetSection.semester_id || currentStudent.semester_id,
      academic_year_id: targetSection.semester?.academic_year_id || currentStudent.academic_year_id,
    };

    const { data: updatedData, error: updateErr } = await supabase
      .from('students')
      .update(updates)
      .eq('id', studentId)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Failed to transfer student section: ${updateErr.message}`);
    }

    // 4. Audit Log
    try {
      await supabase.from('audit_logs').insert([{
        action: 'STUDENT_SECTION_TRANSFERRED',
        actor_name: transferredBy,
        actor_role: 'admin',
        entity_type: 'students',
        entity_id: studentId,
        old_values: { section_id: previousSectionId },
        new_values: { section_id: newSectionId, student_name: currentStudent.full_name, roll_number: currentStudent.roll_number }
      }]);
    } catch (auditErr) {
      console.warn('Transfer audit log error:', auditErr);
    }

    this.invalidateMasterCache();
    return { success: true, student: updatedData as Student };
  },

  async batchImportSectionStudents(params: {
    sectionId: string;
    students: Array<{
      roll_number: string;
      full_name: string;
      email?: string;
      phone?: string;
      admission_type?: AdmissionType;
      mentor_faculty_id?: string;
    }>;
    importedBy?: string;
  }): Promise<{ added: number; updated: number; skipped: number; errors: string[] }> {
    const { sectionId, students: studentList, importedBy = 'Administrator' } = params;
    const errors: string[] = [];
    let added = 0;
    let updated = 0;
    let skipped = 0;

    // 1. Resolve section & academic hierarchy
    const { data: sec, error: secErr } = await supabase
      .from('sections')
      .select('*, semester:semesters(*, academic_year:academic_years(*, program:programs(*)))')
      .eq('id', sectionId)
      .single();

    if (secErr || !sec) {
      throw new Error(`Target section not found: ${secErr?.message || 'Unknown'}`);
    }

    const semester = sec.semester;
    const academicYear = semester?.academic_year;
    const academicYearId = semester?.academic_year_id || academicYear?.id;
    const program = academicYear?.program;
    const programId = academicYear?.program_id || program?.id;
    const departmentId = program?.department_id;

    if (!academicYearId || !sec.semester_id) {
      throw new Error(`Cannot resolve academic year or semester for section ${sectionId}`);
    }

    // Get current active session
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .maybeSingle();
    const sessionId = session?.id || '';

    // Fetch existing students to check duplicates
    const { data: existingStudents } = await supabase
      .from('students')
      .select('id, roll_number, email, section_id');

    const rollMap = new Map((existingStudents || []).map(s => [s.roll_number.toLowerCase().trim(), s]));
    const emailMap = new Map((existingStudents || []).filter(s => s.email).map(s => [s.email!.toLowerCase().trim(), s]));

    for (const item of studentList) {
      const cleanRoll = item.roll_number.trim();
      const cleanName = item.full_name.trim();
      const cleanEmail = item.email?.trim() || `${cleanRoll}@vctm.in`;
      const cleanPhone = item.phone?.trim() || null;
      const admissionType: AdmissionType = item.admission_type || 'Regular';

      if (!cleanRoll || !cleanName) {
        skipped++;
        errors.push(`Row skipped: Roll number and Full Name are required.`);
        continue;
      }

      const existingByRoll = rollMap.get(cleanRoll.toLowerCase());

      if (existingByRoll) {
        // Update existing student with section_id and details
        const { error: updErr } = await supabase
          .from('students')
          .update({
            full_name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            admission_type: admissionType,
            section_id: sectionId,
            semester_id: sec.semester_id,
            academic_year_id: academicYearId,
            active: true,
          })
          .eq('id', existingByRoll.id);

        if (updErr) {
          errors.push(`Error updating ${cleanRoll}: ${updErr.message}`);
          skipped++;
        } else {
          updated++;
          // Update profile
          try {
            await supabase.from('profiles').update({
              full_name: cleanName,
              email: cleanEmail,
              phone: cleanPhone,
            }).eq('id', existingByRoll.id);
          } catch {}
        }
      } else {
        // Insert new student strictly scoped to this section
        const newStudentId = crypto.randomUUID();
        const { error: insErr } = await supabase
          .from('students')
          .insert({
            id: newStudentId,
            institution_id: sec.institution_id || '22398afa-8679-4d2c-87fc-312152a276e2',
            department_id: departmentId,
            program_id: programId,
            academic_session_id: sessionId || null,
            academic_year_id: academicYearId,
            semester_id: sec.semester_id,
            section_id: sectionId,
            roll_number: cleanRoll,
            full_name: cleanName,
            admission_type: admissionType,
            email: cleanEmail,
            phone: cleanPhone,
            mentor_faculty_id: item.mentor_faculty_id || null,
            active: true,
          });

        if (insErr) {
          errors.push(`Error inserting ${cleanRoll}: ${insErr.message}`);
          skipped++;
        } else {
          added++;
          rollMap.set(cleanRoll.toLowerCase(), { id: newStudentId, roll_number: cleanRoll, email: cleanEmail, section_id: sectionId } as any);
          // Create profile
          try {
            await supabase.from('profiles').upsert({
              id: newStudentId,
              email: cleanEmail,
              full_name: cleanName,
              role: 'student',
              department_id: departmentId,
              student_id: newStudentId,
              faculty_id: null,
              phone: cleanPhone,
            }, { onConflict: 'id' });
          } catch {}
        }
      }
    }

    try {
      await supabase.from('audit_logs').insert([{
        action: 'SECTION_STUDENTS_BATCH_IMPORTED',
        actor_name: importedBy,
        actor_role: 'admin',
        entity_type: 'sections',
        entity_id: sectionId,
        new_values: { section_id: sectionId, added, updated, skipped, errorsCount: errors.length }
      }]);
    } catch {}

    this.invalidateMasterCache();
    return { added, updated, skipped, errors };
  },

  async deleteStudent(id: string, reason = 'Student soft-archived to preserve institutional records') {
    // Check if student has historical attendance or marks records
    const [attCheck, marksCheck] = await Promise.all([
      supabase.from('attendance_records').select('id', { count: 'exact', head: true }).eq('student_id', id),
      supabase.from('sessional_marks').select('id', { count: 'exact', head: true }).eq('student_id', id),
    ]);

    const hasHistory = (attCheck.count || 0) > 0 || (marksCheck.count || 0) > 0;
    if (hasHistory) {
      await this.archiveAccount({
        targetId: id,
        entityType: 'student',
        exitStatus: 'ARCHIVED',
        reason,
      });
      return true;
    }

    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw new Error(error.message);
    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch {}
    this.invalidateMasterCache();
    return true;
  },

  async addFaculty(fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('faculty').insert(fac).select().single();
    if (error) throw new Error(error.message);
    const createdFaculty = data as Faculty;

    // Automatically create Supabase profile for this faculty
    const isHOD = createdFaculty.designation.toLowerCase().includes('hod');
    try {
      await supabase.from('profiles').upsert({
        id: createdFaculty.id,
        email: createdFaculty.email || `${(createdFaculty.faculty_code || 'faculty').toLowerCase()}@vctm.in`,
        full_name: createdFaculty.full_name,
        role: isHOD ? 'hod' : 'faculty',
        department_id: createdFaculty.department_id,
        student_id: null,
        faculty_id: createdFaculty.id,
        phone: createdFaculty.phone
      }, { onConflict: 'id' });
    } catch (profErr) {
      console.warn('Profile auto-creation warning:', profErr);
    }

    this.invalidateMasterCache();
    return createdFaculty;
  },

  async updateFaculty(id: string, updates: Partial<Faculty>) {
    const { data, error } = await supabase.from('faculty').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    const updated = data as Faculty;

    try {
      const isHOD = updated.designation.toLowerCase().includes('hod');
      await supabase.from('profiles').update({
        full_name: updated.full_name,
        email: updated.email,
        phone: updated.phone,
        department_id: updated.department_id,
        role: isHOD ? 'hod' : 'faculty'
      }).or(`id.eq.${id},faculty_id.eq.${id}`);
    } catch {}

    this.invalidateMasterCache();
    return updated;
  },

  async updateFacultyCredentials(facultyId: string, email: string) {
    const cleanEmail = email.trim().toLowerCase();
    
    // Atomically synchronize Supabase Auth identity, profiles, and faculty records via adminUpdateAccountCredentials
    // without touching password
    const res = await this.adminUpdateAccountCredentials({
      targetUserId: facultyId,
      email: cleanEmail,
      actorName: 'Faculty Credential Manager',
      actorRole: 'super_admin',
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to update faculty credentials');
    }

    const { data: facData, error: facErr } = await supabase
      .from('faculty')
      .select('*')
      .eq('id', facultyId)
      .single();

    if (facErr) throw new Error(facErr.message);

    this.invalidateMasterCache();
    return facData as Faculty;
  },

  async createFacultyWithAssignments(params: {
    faculty: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>;
    assignments: Array<{
      academic_year_id: string;
      semester_id: string;
      section_id: string;
      subject_id: string;
    }>;
    coordinatorAssignments?: Array<{
      section_id: string;
      academic_year_id?: string;
    }>;
    actorName?: string;
  }): Promise<{ faculty: Faculty; assignments: FacultySubjectAssignment[] }> {
    const { faculty: facData, assignments: assignList, coordinatorAssignments = [], actorName = 'Administrator' } = params;

    // 1. Validate employee code uniqueness
    const { data: existingCode } = await supabase
      .from('faculty')
      .select('id, full_name')
      .ilike('employee_code', facData.employee_code.trim())
      .maybeSingle();
    if (existingCode) {
      throw new Error(`Employee Code "${facData.employee_code}" is already assigned to "${existingCode.full_name}".`);
    }

    // 2. Validate email uniqueness
    const { data: existingEmail } = await supabase
      .from('faculty')
      .select('id, full_name')
      .ilike('email', facData.email.trim())
      .maybeSingle();
    if (existingEmail) {
      throw new Error(`Official Email "${facData.email}" is already in use by "${existingEmail.full_name}".`);
    }

    // 3. Atomically Provision Faculty Account, Supabase Auth User, Profile & Assignments via RPC
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('provision_faculty_account', {
      p_employee_code: facData.employee_code.trim().toUpperCase(),
      p_full_name: facData.full_name.trim(),
      p_email: facData.email.trim().toLowerCase(),
      p_department_id: facData.department_id,
      p_designation: facData.designation.trim(),
      p_faculty_code: facData.faculty_code?.trim().toUpperCase() || null,
      p_password: 'faculty@123',
      p_phone: facData.phone?.trim() || null,
      p_assignments: assignList || [],
      p_actor_name: actorName,
    });

    if (!rpcErr && rpcRes?.faculty_id) {
      // Assign class coordinator roles if requested
      if (coordinatorAssignments.length > 0) {
        for (const coord of coordinatorAssignments) {
          await this.assignClassCoordinator(rpcRes.faculty_id, coord.section_id);
        }
      }

      const { data: createdFac } = await supabase
        .from('faculty')
        .select('*')
        .eq('id', rpcRes.faculty_id)
        .single();

      const { data: assignments } = await supabase
        .from('faculty_subject_assignments')
        .select('*')
        .eq('faculty_id', rpcRes.faculty_id);

      this.invalidateMasterCache();
      return { faculty: createdFac as Faculty, assignments: (assignments as FacultySubjectAssignment[]) || [] };
    }

    if (rpcErr) {
      console.warn('RPC provision_faculty_account failed, using direct insert fallback:', rpcErr.message);
    }

    // Direct fallback insertion
    const newFacultyId = crypto.randomUUID();
    const { data: createdFac, error: facErr } = await supabase
      .from('faculty')
      .insert({
        id: newFacultyId,
        department_id: facData.department_id,
        employee_code: facData.employee_code.trim().toUpperCase(),
        faculty_code: facData.faculty_code?.trim().toUpperCase() || null,
        full_name: facData.full_name.trim(),
        designation: facData.designation.trim(),
        email: facData.email.trim().toLowerCase(),
        phone: facData.phone?.trim() || null,
        active: true,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (facErr || !createdFac) {
      throw new Error(`Failed to create faculty member: ${facErr?.message || 'Unknown error'}`);
    }

    // 4. Create Profile
    const isHOD = createdFac.designation.toLowerCase().includes('hod');
    try {
      await supabase.from('profiles').upsert({
        id: createdFac.id,
        email: createdFac.email,
        full_name: createdFac.full_name,
        role: isHOD ? 'hod' : 'faculty',
        department_id: createdFac.department_id,
        faculty_id: createdFac.id,
        phone: createdFac.phone,
        status: 'ACTIVE',
      }, { onConflict: 'id' });
    } catch (profErr) {
      console.warn('Profile creation warning:', profErr);
    }

    // 5. Get current active session
    const { data: currentSession } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .maybeSingle();
    const sessionId = currentSession?.id || 'a358fe68-d746-4242-9f36-2c715cd9526e';

    // 6. Create relational assignments
    const createdAssignments: FacultySubjectAssignment[] = [];
    if (assignList && assignList.length > 0) {
      for (const item of assignList) {
        const { data: yearData } = await supabase
          .from('academic_years')
          .select('program_id, program:programs(department_id)')
          .eq('id', item.academic_year_id)
          .maybeSingle();

        const programId = yearData?.program_id || null;
        const deptId = (yearData?.program as any)?.department_id || createdFac.department_id;

        const assignPayload = {
          id: crypto.randomUUID(),
          faculty_id: createdFac.id,
          subject_id: item.subject_id,
          section_id: item.section_id,
          academic_session_id: sessionId,
          department_id: deptId,
          program_id: programId,
          academic_year_id: item.academic_year_id,
          semester_id: item.semester_id,
          active: true,
        };

        const { data: insAssign, error: assignErr } = await supabase
          .from('faculty_subject_assignments')
          .insert(assignPayload)
          .select()
          .single();

        if (assignErr) {
          console.error('Failed to create assignment:', assignErr.message);
        } else if (insAssign) {
          createdAssignments.push(insAssign as FacultySubjectAssignment);
        }
      }
    }

    // Assign coordinator roles if requested in fallback
    if (coordinatorAssignments.length > 0) {
      for (const coord of coordinatorAssignments) {
        await this.assignClassCoordinator(createdFac.id, coord.section_id);
      }
    }

    // 7. Audit log
    try {
      await supabase.from('audit_logs').insert({
        action: 'FACULTY_CREATED',
        actor_name: actorName,
        actor_role: 'admin',
        entity_type: 'faculty',
        entity_id: createdFac.id,
        new_values: {
          full_name: createdFac.full_name,
          employee_code: createdFac.employee_code,
          email: createdFac.email,
          assignments_count: createdAssignments.length,
        },
      });
    } catch {}

    this.invalidateMasterCache();
    return { faculty: createdFac as Faculty, assignments: createdAssignments };
  },

  async reconcileAuthAccounts(): Promise<{ success: boolean; reconciled_students: number; reconciled_faculty: number }> {
    const { data, error } = await supabase.rpc('reconcile_all_accounts');
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as any;
  },

  async updateFacultyWithAssignments(params: {
    facultyId: string;
    updates: Partial<Faculty>;
    assignments?: Array<{
      academic_year_id: string;
      semester_id: string;
      section_id: string;
      subject_id: string;
    }>;
    coordinatorAssignments?: Array<{
      section_id: string;
      academic_year_id?: string;
    }>;
    actorName?: string;
  }): Promise<{ faculty: Faculty; assignments: FacultySubjectAssignment[] }> {
    const { facultyId, updates, assignments: newAssignments, coordinatorAssignments, actorName = 'Administrator' } = params;

    // 1. Update faculty
    const { data: updatedFac, error: facErr } = await supabase
      .from('faculty')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', facultyId)
      .select()
      .single();

    if (facErr || !updatedFac) {
      throw new Error(`Failed to update faculty: ${facErr?.message || 'Unknown error'}`);
    }

    // 2. Update profile
    try {
      const isHOD = updatedFac.designation.toLowerCase().includes('hod');
      await supabase.from('profiles').update({
        full_name: updatedFac.full_name,
        email: updatedFac.email,
        phone: updatedFac.phone,
        department_id: updatedFac.department_id,
        role: isHOD ? 'hod' : 'faculty',
        updated_at: new Date().toISOString(),
      }).or(`id.eq.${facultyId},faculty_id.eq.${facultyId}`);
    } catch {}

    // 3. Reconcile assignments if provided
    let finalAssignments: FacultySubjectAssignment[] = [];
    if (newAssignments !== undefined) {
      const { data: existingAssignments } = await supabase
        .from('faculty_subject_assignments')
        .select('*')
        .eq('faculty_id', facultyId);

      const existingList = existingAssignments || [];

      // Find assignments to deactivate/delete
      for (const ex of existingList) {
        const stillPresent = newAssignments.some(
          na => na.section_id === ex.section_id && na.subject_id === ex.subject_id
        );
        if (!stillPresent && ex.active) {
          await supabase
            .from('faculty_subject_assignments')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', ex.id);
        }
      }

      // Find assignments to insert or reactivate
      const { data: currentSession } = await supabase
        .from('academic_sessions')
        .select('id')
        .eq('is_current', true)
        .maybeSingle();
      const sessionId = currentSession?.id || 'a358fe68-d746-4242-9f36-2c715cd9526e';

      for (const na of newAssignments) {
        const existingMatch = existingList.find(
          ex => ex.section_id === na.section_id && ex.subject_id === na.subject_id
        );

        if (existingMatch) {
          if (!existingMatch.active) {
            await supabase
              .from('faculty_subject_assignments')
              .update({ active: true, updated_at: new Date().toISOString() })
              .eq('id', existingMatch.id);
          }
        } else {
          const { data: yearData } = await supabase
            .from('academic_years')
            .select('program_id, program:programs(department_id)')
            .eq('id', na.academic_year_id)
            .maybeSingle();

          const programId = yearData?.program_id || null;
          const deptId = (yearData?.program as any)?.department_id || updatedFac.department_id;

          await supabase
            .from('faculty_subject_assignments')
            .insert({
              id: crypto.randomUUID(),
              faculty_id: facultyId,
              subject_id: na.subject_id,
              section_id: na.section_id,
              academic_session_id: sessionId,
              department_id: deptId,
              program_id: programId,
              academic_year_id: na.academic_year_id,
              semester_id: na.semester_id,
              active: true,
            });
        }
      }

      const { data: refetched } = await supabase
        .from('faculty_subject_assignments')
        .select('*')
        .eq('faculty_id', facultyId)
        .eq('active', true);
      finalAssignments = (refetched as FacultySubjectAssignment[]) || [];
    }

    // 4. Reconcile class coordinator assignments if provided
    if (coordinatorAssignments !== undefined) {
      const existingCoords = await this.fetchClassCoordinatorAssignments(facultyId);
      const newSecIds = new Set(coordinatorAssignments.map(c => c.section_id));

      // Remove coordinator assignments no longer present
      for (const ex of existingCoords) {
        if (!newSecIds.has(ex.section_id)) {
          await this.removeClassCoordinator(facultyId, ex.section_id);
        }
      }

      // Add/ensure coordinator assignments
      for (const coord of coordinatorAssignments) {
        await this.assignClassCoordinator(facultyId, coord.section_id);
      }
    }

    // 5. Audit log
    try {
      await supabase.from('audit_logs').insert({
        action: 'FACULTY_UPDATED',
        actor_name: actorName,
        actor_role: 'admin',
        entity_type: 'faculty',
        entity_id: facultyId,
        new_values: {
          full_name: updatedFac.full_name,
          employee_code: updatedFac.employee_code,
          active_assignments: finalAssignments.length,
        },
      });
    } catch {}

    this.invalidateMasterCache();
    return { faculty: updatedFac as Faculty, assignments: finalAssignments };
  },

  async setFacultyStatus(facultyId: string, status: 'ACTIVE' | 'BLOCKED', reason?: string, actorName = 'Administrator') {
    const isActive = status === 'ACTIVE';

    const { data: fac, error: facErr } = await supabase
      .from('faculty')
      .update({
        status,
        active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', facultyId)
      .select()
      .single();

    if (facErr) throw new Error(facErr.message);

    await supabase
      .from('profiles')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${facultyId},faculty_id.eq.${facultyId}`);

    if (!isActive) {
      await supabase
        .from('faculty_subject_assignments')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('faculty_id', facultyId);
    } else {
      await supabase
        .from('faculty_subject_assignments')
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq('faculty_id', facultyId);
    }

    try {
      await supabase.from('audit_logs').insert({
        action: isActive ? 'FACULTY_UNBLOCKED' : 'FACULTY_BLOCKED',
        actor_name: actorName,
        actor_role: 'admin',
        entity_type: 'faculty',
        entity_id: facultyId,
        new_values: { status, reason: reason || 'Status updated by administrator' },
      });
    } catch {}

    this.invalidateMasterCache();
    return fac as Faculty;
  },

  async checkFacultyHistoricalRecords(facultyId: string): Promise<{
    hasHistoricalData: boolean;
    attendanceCount: number;
    timetableCount: number;
    assignmentCount: number;
  }> {
    const [
      { count: attCount },
      { count: ttCount },
      { count: assignCount }
    ] = await Promise.all([
      supabase.from('attendance_sessions').select('*', { count: 'exact', head: true }).eq('faculty_id', facultyId),
      supabase.from('timetable_entries').select('*', { count: 'exact', head: true }).eq('faculty_id', facultyId),
      supabase.from('faculty_subject_assignments').select('*', { count: 'exact', head: true }).eq('faculty_id', facultyId)
    ]);

    const attendanceCount = attCount || 0;
    const timetableCount = ttCount || 0;
    const assignmentCount = assignCount || 0;
    const hasHistoricalData = attendanceCount > 0 || timetableCount > 0;

    return {
      hasHistoricalData,
      attendanceCount,
      timetableCount,
      assignmentCount,
    };
  },

  async safeDeleteFaculty(facultyId: string, actorName = 'Administrator'): Promise<{
    archived: boolean;
    deleted: boolean;
    message: string;
  }> {
    const check = await this.checkFacultyHistoricalRecords(facultyId);

    if (check.hasHistoricalData) {
      await this.archiveAccount({
        targetId: facultyId,
        entityType: 'faculty',
        exitStatus: 'RESIGNED',
        reason: 'Archived due to historical attendance/timetable records to preserve official college history',
      });

      this.invalidateMasterCache();
      return {
        archived: true,
        deleted: false,
        message: `Faculty member has ${check.attendanceCount} attendance sessions and ${check.timetableCount} timetable entries. Account has been safely ARCHIVED and login disabled to preserve official college records.`,
      };
    }

    await supabase.from('faculty_subject_assignments').delete().eq('faculty_id', facultyId);
    await supabase.from('profiles').delete().or(`id.eq.${facultyId},faculty_id.eq.${facultyId}`);
    const { error } = await supabase.from('faculty').delete().eq('id', facultyId);
    if (error) throw new Error(error.message);

    try {
      await supabase.from('audit_logs').insert({
        action: 'FACULTY_DELETED',
        actor_name: actorName,
        actor_role: 'admin',
        entity_type: 'faculty',
        entity_id: facultyId,
        new_values: { reason: 'Clean deletion (no historical records)' },
      });
    } catch {}

    this.invalidateMasterCache();
    return {
      archived: false,
      deleted: true,
      message: 'Faculty member and allocations successfully deleted from database.',
    };
  },

  async deleteFaculty(id: string) {
    const res = await this.safeDeleteFaculty(id);
    return res.deleted || res.archived;
  },

  // 6. Live Notices backed by Supabase
  async fetchNotices() {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'NOTICE_PUBLISHED')
        .eq('entity_type', 'notice')
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []).map(row => {
        const details = row.new_values || {};
        return {
          id: row.id,
          title: details.title || 'Official Circular',
          category: details.category || 'Academic',
          date: details.date || row.created_at?.split('T')[0],
          author: details.author || row.actor_name || 'Administration',
          isPinned: !!details.isPinned,
          content: details.content || '',
          attachment: details.attachment,
          targetAudience: details.targetAudience || 'ALL',
          targetSectionId: details.targetSectionId || null,
          targetDepartmentId: details.targetDepartmentId || null,
          targetProgramId: details.targetProgramId || null,
          targetYearId: details.targetYearId || null,
          targetSemesterId: details.targetSemesterId || null,
          targetRole: details.targetRole || null,
          createdAt: row.created_at
        };
      });
    } catch (err) {
      console.error('Error fetching live notices:', err);
      return [];
    }
  },

  async publishNotice(notice: {
    title: string;
    category: string;
    author: string;
    content: string;
    isPinned?: boolean;
    attachment?: string;
    targetAudience?: string;
    targetSectionId?: string | null;
    targetDepartmentId?: string | null;
    targetProgramId?: string | null;
    targetYearId?: string | null;
    targetSemesterId?: string | null;
    targetRole?: string | null;
    actorId?: string;
    actorName?: string;
  }) {
    const { data, error } = await supabase.from('audit_logs').insert({
      actor_id: notice.actorId || null,
      actor_name: notice.actorName || notice.author,
      actor_role: 'admin',
      action: 'NOTICE_PUBLISHED',
      entity_type: 'notice',
      entity_id: null,
      new_values: {
        title: notice.title,
        category: notice.category,
        author: notice.author,
        content: notice.content,
        isPinned: notice.isPinned || false,
        attachment: notice.attachment,
        targetAudience: notice.targetAudience || 'ALL',
        targetSectionId: notice.targetSectionId || null,
        targetDepartmentId: notice.targetDepartmentId || null,
        targetProgramId: notice.targetProgramId || null,
        targetYearId: notice.targetYearId || null,
        targetSemesterId: notice.targetSemesterId || null,
        targetRole: notice.targetRole || null,
        date: getISTTodayDate()
      }
    }).select().single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteNotice(noticeId: string) {
    const { error } = await supabase.from('audit_logs').delete().eq('id', noticeId);
    if (error) throw new Error(error.message);
    return true;
  },

  async addSubject(sub: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('subjects').insert(sub).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Subject;
  },

  async updateSubject(id: string, updates: Partial<Subject>) {
    const { data, error } = await supabase.from('subjects').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Subject;
  },

  async deleteSubject(id: string) {
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async addDepartment(dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('departments').insert(dept).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Department;
  },

  async updateDepartment(id: string, updates: Partial<Department>) {
    const { data, error } = await supabase.from('departments').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Department;
  },

  async deleteDepartment(id: string) {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async addProgram(prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('programs').insert(prog).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Program;
  },

  async updateProgram(id: string, updates: Partial<Program>) {
    const { data, error } = await supabase.from('programs').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Program;
  },

  async deleteProgram(id: string) {
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async addSection(sec: Omit<Section, 'id' | 'created_at' | 'updated_at'>) {
    // Check if matching section already exists (case-insensitive name within same semester)
    const { data: existing } = await supabase
      .from('sections')
      .select('*')
      .eq('semester_id', sec.semester_id)
      .ilike('name', sec.name.trim())
      .maybeSingle();

    if (existing) {
      if (!existing.active) {
        // Reactivate archived section
        const { data: reactivated, error } = await supabase
          .from('sections')
          .update({ 
            active: true, 
            room_number: sec.room_number || existing.room_number,
            classroom_id: sec.classroom_id || existing.classroom_id,
            class_coordinator_id: sec.class_coordinator_id || existing.class_coordinator_id
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        this.invalidateMasterCache();
        return reactivated as Section;
      }
      return existing as Section;
    }

    const { data, error } = await supabase.from('sections').insert({
      ...sec,
      name: sec.name.trim().toUpperCase(),
      active: sec.active !== false,
    }).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Section;
  },

  async updateSection(id: string, updates: Partial<Section>) {
    const { data, error } = await supabase.from('sections').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Section;
  },

  async archiveSection(id: string) {
    const { data, error } = await supabase.from('sections').update({ active: false }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Section;
  },

  async restoreSection(id: string) {
    const { data, error } = await supabase.from('sections').update({ active: true }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Section;
  },

  async checkSectionReferences(sectionId: string): Promise<SectionReferenceCheckResult> {
    try {
      const { data, error } = await supabase.rpc('check_section_references', { p_section_id: sectionId });
      if (!error && data) {
        return data as SectionReferenceCheckResult;
      }
    } catch (e) {
      console.warn('check_section_references RPC error, falling back to direct check:', e);
    }

    // Direct fallback
    const [{ count: studentCount }, { count: timetableCount }, { count: attendanceCount }, { count: assignmentCount }] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('section_id', sectionId),
      supabase.from('timetable_entries').select('id', { count: 'exact', head: true }).eq('section_id', sectionId),
      supabase.from('attendance_sessions').select('id', { count: 'exact', head: true }).eq('section_id', sectionId),
      supabase.from('faculty_subject_assignments').select('id', { count: 'exact', head: true }).eq('section_id', sectionId),
    ]);

    const sc = studentCount || 0;
    const tc = timetableCount || 0;
    const ac = attendanceCount || 0;
    const fsa = assignmentCount || 0;
    const total = sc + tc + ac + fsa;

    return {
      section_id: sectionId,
      student_count: sc,
      attendance_count: ac,
      timetable_count: tc,
      assignment_count: fsa,
      leave_count: 0,
      message_count: 0,
      total_references: total,
      can_hard_delete: total === 0,
    };
  },

  async deleteSection(id: string) {
    // Check if section has associated historical records
    const check = await this.checkSectionReferences(id);

    let isArchived = false;
    // If historical data exists, soft-archive by setting active = false to safeguard relational integrity
    if (!check.can_hard_delete || check.total_references > 0) {
      const { error } = await supabase.from('sections').update({ active: false }).eq('id', id);
      if (error) throw new Error(error.message);
      isArchived = true;
    } else {
      const { error } = await supabase.from('sections').delete().eq('id', id);
      if (error) {
        // Fallback to soft-archive if any foreign key constraint blocks deletion
        const { error: archiveErr } = await supabase.from('sections').update({ active: false }).eq('id', id);
        if (archiveErr) throw new Error(archiveErr.message);
        isArchived = true;
      }
    }
    this.invalidateMasterCache();
    return { success: true, archived: isArchived };
  },

  // ── Bulk Student Promotion & Academic Lifecycle Transitions ──
  async promoteStudentsBulk(payload: BulkPromotionPayload, adminId?: string, adminName?: string): Promise<BulkPromotionResult> {
    const { data, error } = await supabase.rpc('promote_students_bulk', {
      p_payload: payload,
      p_admin_id: adminId || null,
      p_admin_name: adminName || 'Super Admin'
    });
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as BulkPromotionResult;
  },

  async fetchPromotionBatches(): Promise<PromotionBatch[]> {
    const { data, error } = await supabase
      .from('promotion_batches')
      .select(`
        *,
        source_year:source_academic_year_id(id, name, year_number),
        target_year:target_academic_year_id(id, name, year_number),
        source_session:source_academic_session_id(id, name),
        target_session:target_academic_session_id(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []) as PromotionBatch[];
  },

  async fetchStudentAcademicHistory(studentId?: string): Promise<StudentAcademicHistory[]> {
    let query = supabase
      .from('student_academic_history')
      .select(`
        *,
        academic_session:academic_session_id(id, name),
        academic_year:academic_year_id(id, name, year_number),
        semester:semester_id(id, name, semester_number),
        section:section_id(id, name, room_number),
        student:student_id(id, roll_number, full_name, email, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as StudentAcademicHistory[];
  },

  // ── Academic Year CRUD ──
  async addAcademicYear(year: Omit<AcademicYear, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('academic_years').insert(year).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as AcademicYear;
  },

  async updateAcademicYear(id: string, updates: Partial<AcademicYear>) {
    const { data, error } = await supabase.from('academic_years').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as AcademicYear;
  },

  async deleteAcademicYear(id: string) {
    const { error } = await supabase.from('academic_years').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  // ── Semester CRUD ──
  async addSemester(sem: Omit<Semester, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('semesters').insert(sem).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Semester;
  },

  async updateSemester(id: string, updates: Partial<Semester>) {
    const { data, error } = await supabase.from('semesters').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as Semester;
  },

  async deleteSemester(id: string) {
    const { error } = await supabase.from('semesters').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  // ── Dynamic Session Resolver ──
  async getCurrentSessionId(): Promise<string> {
    const { data } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .maybeSingle();
    return data?.id || '';
  },

  async addAssignment(assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('faculty_subject_assignments').insert(assign).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as FacultySubjectAssignment;
  },

  async deleteAssignment(id: string) {
    const { error } = await supabase.from('faculty_subject_assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  async updateFacultyAssignment(id: string, updates: Partial<FacultySubjectAssignment>) {
    const { data, error } = await supabase.from('faculty_subject_assignments').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return data as FacultySubjectAssignment;
  },

  async addTimetableEntry(entry: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('timetable_entries').insert(entry).select().single();
    if (error) throw new Error(error.message);
    return data as TimetableEntry;
  },

  async updateTimetableEntry(id: string, updates: Partial<TimetableEntry>) {
    const { data, error } = await supabase.from('timetable_entries').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as TimetableEntry;
  },

  async deleteTimetableEntry(id: string) {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
    this.invalidateMasterCache();
    return true;
  },

  /**
   * Search existing faculty by employee_code, email, or normalized name within department.
   * If not found, insert a new record in public.faculty with auth_user_id = null (NO auth account).
   */
  async findOrCreateFaculty(params: {
    fullName: string;
    facultyCode?: string;
    employeeCode?: string;
    designation?: string;
    email?: string;
    phone?: string;
    departmentId: string;
  }): Promise<Faculty> {
    const cleanName = params.fullName.trim();
    const cleanEmpCode = params.employeeCode?.trim();
    const cleanEmail = params.email?.trim().toLowerCase();

    // 1. Search by employee_code if supplied
    if (cleanEmpCode) {
      const { data: matchCode } = await supabase
        .from('faculty')
        .select('*')
        .eq('employee_code', cleanEmpCode)
        .maybeSingle();
      if (matchCode) return matchCode as Faculty;
    }

    // 2. Search by email if supplied
    if (cleanEmail) {
      const { data: matchEmail } = await supabase
        .from('faculty')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();
      if (matchEmail) return matchEmail as Faculty;
    }

    // 3. Search by normalized name within same department
    const { data: matchName } = await supabase
      .from('faculty')
      .select('*')
      .ilike('full_name', cleanName)
      .eq('department_id', params.departmentId)
      .maybeSingle();
    if (matchName) return matchName as Faculty;

    // 4. Create new faculty record (with auth_user_id = null; NO auth account created)
    const empCode = cleanEmpCode || `FAC_${cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}_${Date.now().toString().slice(-4)}`;
    const facCode = params.facultyCode?.trim().toUpperCase() || cleanName.split(' ').map(w => w[0]).join('').slice(0, 4).toUpperCase();
    const email = cleanEmail || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@faculty.vctm.in`;

    const { data: created, error } = await supabase
      .from('faculty')
      .insert([{
        full_name: cleanName,
        department_id: params.departmentId,
        employee_code: empCode,
        faculty_code: facCode,
        designation: params.designation?.trim() || 'Assistant Professor',
        email,
        phone: params.phone?.trim() || null,
        active: true,
        auth_user_id: null
      }])
      .select()
      .single();

    if (error) {
      const { data: existing } = await supabase
        .from('faculty')
        .select('*')
        .or(`employee_code.eq.${empCode},email.eq.${email}`)
        .maybeSingle();
      if (existing) return existing as Faculty;
      throw new Error(`Failed to create faculty: ${error.message}`);
    }

    this.invalidateMasterCache();
    return created as Faculty;
  },

  /**
   * Search existing subject by subject_code within semester.
   * If not found, insert a new record in public.subjects.
   */
  async findOrCreateSubject(params: {
    subjectName: string;
    subjectCode: string;
    departmentId: string;
    semesterId: string;
    programId?: string;
    lectureType?: LectureType;
    credits?: number;
  }): Promise<Subject> {
    const cleanName = params.subjectName.trim();
    const cleanCode = params.subjectCode.trim().toUpperCase();

    // 1. Search by subject_code within semester
    const { data: matchCode } = await supabase
      .from('subjects')
      .select('*')
      .ilike('subject_code', cleanCode)
      .eq('semester_id', params.semesterId)
      .maybeSingle();
    if (matchCode) return matchCode as Subject;

    // 2. Resolve program_id if not supplied
    let progId = params.programId;
    if (!progId) {
      const { data: sem } = await supabase
        .from('semesters')
        .select('academic_years(program_id)')
        .eq('id', params.semesterId)
        .maybeSingle();
      progId = (sem as any)?.academic_years?.program_id;
    }
    if (!progId) {
      const { data: prog } = await supabase
        .from('programs')
        .select('id')
        .eq('department_id', params.departmentId)
        .limit(1)
        .maybeSingle();
      progId = prog?.id || '';
    }

    const { data: created, error } = await supabase
      .from('subjects')
      .insert([{
        subject_name: cleanName,
        subject_code: cleanCode,
        department_id: params.departmentId,
        semester_id: params.semesterId,
        program_id: progId,
        lecture_type: params.lectureType || 'Theory',
        credits: params.credits || 4.0,
        active: true
      }])
      .select()
      .single();

    if (error) {
      const { data: existing } = await supabase
        .from('subjects')
        .select('*')
        .eq('subject_code', cleanCode)
        .eq('semester_id', params.semesterId)
        .maybeSingle();
      if (existing) return existing as Subject;
      throw new Error(`Failed to create subject: ${error.message}`);
    }

    this.invalidateMasterCache();
    return created as Subject;
  },

  /**
   * Search existing classroom by room_number.
   * If not found, insert a new record in public.classrooms.
   */
  async findOrCreateClassroom(params: {
    roomNumber: string;
    building?: string;
    roomType?: string;
    capacity?: number;
  }): Promise<Classroom> {
    const cleanRoom = params.roomNumber.trim();

    // 1. Search existing by room_number
    const { data: matchRoom } = await supabase
      .from('classrooms')
      .select('*')
      .ilike('room_number', cleanRoom)
      .maybeSingle();
    if (matchRoom) return matchRoom as Classroom;

    // 2. Insert new classroom
    const { data: created, error } = await supabase
      .from('classrooms')
      .insert([{
        room_number: cleanRoom,
        building: params.building || 'Main Academic Block',
        floor: 'Ground Floor',
        room_type: params.roomType || 'Classroom',
        capacity: params.capacity || 60,
        active: true
      }])
      .select()
      .single();

    if (error) {
      const { data: existing } = await supabase
        .from('classrooms')
        .select('*')
        .ilike('room_number', cleanRoom)
        .maybeSingle();
      if (existing) return existing as Classroom;
      throw new Error(`Failed to create classroom: ${error.message}`);
    }

    this.invalidateMasterCache();
    return created as Classroom;
  },

  /**
   * Authoritative saving of a single timetable slot into Supabase with automatic assignment sync
   */
  async saveSingleTimetableSlot(params: {
    slotId?: string;
    sectionId: string;
    dayOfWeek: DayOfWeek;
    periodNumber: number;
    startTime: string;
    endTime: string;
    subjectId?: string | null;
    facultyId?: string | null;
    classroomId?: string | null;
    roomNumber?: string;
    lectureType?: LectureType;
    updatedBy?: string;
  }): Promise<{ success: boolean; entry: TimetableEntry }> {
    const payload = {
      section_id: params.sectionId,
      day_of_week: params.dayOfWeek,
      period_number: params.periodNumber,
      start_time: params.startTime,
      end_time: params.endTime,
      subject_id: params.subjectId || null,
      faculty_id: params.facultyId || null,
      classroom_id: params.classroomId || null,
      room_number: params.roomNumber || 'Room',
      lecture_type: params.lectureType || 'Theory',
      active: true,
      updated_at: new Date().toISOString()
    };

    // Query prior state to handle assignment deactivation if faculty changes or unassigns
    let priorFacultyId: string | null = null;
    let priorSubjectId: string | null = null;

    if (params.slotId) {
      const { data: existing } = await supabase
        .from('timetable_entries')
        .select('faculty_id, subject_id')
        .eq('id', params.slotId)
        .maybeSingle();
      if (existing) {
        priorFacultyId = existing.faculty_id;
        priorSubjectId = existing.subject_id;
      }
    } else {
      const { data: existing } = await supabase
        .from('timetable_entries')
        .select('faculty_id, subject_id')
        .eq('section_id', params.sectionId)
        .eq('day_of_week', params.dayOfWeek)
        .eq('period_number', params.periodNumber)
        .maybeSingle();
      if (existing) {
        priorFacultyId = existing.faculty_id;
        priorSubjectId = existing.subject_id;
      }
    }

    let savedEntry: TimetableEntry;

    if (params.slotId) {
      const { data, error } = await supabase
        .from('timetable_entries')
        .update(payload)
        .eq('id', params.slotId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      savedEntry = data as TimetableEntry;
    } else {
      const { data, error } = await supabase
        .from('timetable_entries')
        .upsert([payload], { onConflict: 'section_id,day_of_week,period_number' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      savedEntry = data as TimetableEntry;
    }

    // 1. Sync faculty_subject_assignments if instructional facultyId is present
    if (params.facultyId && params.subjectId) {
      try {
        const { data: currentSessionData } = await supabase
          .from('academic_sessions')
          .select('id')
          .eq('is_current', true)
          .maybeSingle();
        const currentSessionId = currentSessionData?.id;

        if (currentSessionId) {
          const { data: existingAssignment } = await supabase
            .from('faculty_subject_assignments')
            .select('id, active')
            .eq('faculty_id', params.facultyId)
            .eq('subject_id', params.subjectId)
            .eq('section_id', params.sectionId)
            .maybeSingle();

          if (!existingAssignment) {
            await supabase.from('faculty_subject_assignments').insert([{
              faculty_id: params.facultyId,
              subject_id: params.subjectId,
              section_id: params.sectionId,
              academic_session_id: currentSessionId,
              active: true
            }]);
          } else if (!existingAssignment.active) {
            await supabase
              .from('faculty_subject_assignments')
              .update({ active: true, updated_at: new Date().toISOString() })
              .eq('id', existingAssignment.id);
          }
        }
      } catch (err) {
        console.warn('Syncing assignment warning:', err);
      }
    }

    // 2. Deactivate prior assignment if this faculty no longer teaches any slots for this section and subject
    if (priorFacultyId && priorSubjectId && (priorFacultyId !== params.facultyId || priorSubjectId !== params.subjectId)) {
      try {
        const { data: remainingSlots } = await supabase
          .from('timetable_entries')
          .select('id')
          .eq('section_id', params.sectionId)
          .eq('subject_id', priorSubjectId)
          .eq('faculty_id', priorFacultyId)
          .eq('active', true);

        if (!remainingSlots || remainingSlots.length === 0) {
          await supabase
            .from('faculty_subject_assignments')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('faculty_id', priorFacultyId)
            .eq('subject_id', priorSubjectId)
            .eq('section_id', params.sectionId);
        }
      } catch (err) {
        console.warn('Deactivating prior assignment warning:', err);
      }
    }

    this.invalidateMasterCache();
    return { success: true, entry: savedEntry };
  },

  /**
   * Atomically delete all timetable entries for a section, archive previous versions, and broadcast realtime update
   */
  async deleteSectionTimetable(
    paramsOrSectionId: { sectionId: string; deletedBy?: string } | string,
    deletedByParam?: string
  ): Promise<{ success: boolean; deletedCount: number }> {
    const sectionId = typeof paramsOrSectionId === 'string' ? paramsOrSectionId : paramsOrSectionId.sectionId;
    const deletedBy = (typeof paramsOrSectionId === 'string' ? deletedByParam : paramsOrSectionId.deletedBy) || 'HOD';

    // 1. Try PostgreSQL RPC first
    try {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('delete_section_timetable', {
        p_section_id: sectionId,
        p_deleted_by: deletedBy,
      });

      if (!rpcErr && rpcResult && rpcResult.success) {
        // Deactivate faculty subject assignments associated with this cleared section
        try {
          await supabase
            .from('faculty_subject_assignments')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('section_id', sectionId);
        } catch (asgnErr) {
          console.warn('Deactivating section assignments warning:', asgnErr);
        }

        this.invalidateMasterCache();
        try {
          const channel = supabase.channel('vctm-erp-realtime-channel');
          await channel.send({
            type: 'broadcast',
            event: 'timetable_updated',
            payload: {
              section_id: sectionId,
              period_count: 0,
              action: 'DELETED',
              timestamp: new Date().toISOString(),
            }
          });
        } catch {}

        return { success: true, deletedCount: rpcResult.deleted_count || 0 };
      }
    } catch (rpcEx) {
      console.warn('RPC delete_section_timetable fallback to client:', rpcEx);
    }

    // 2. Client fallback
    const { count: existingCount } = await supabase
      .from('timetable_entries')
      .select('id', { count: 'exact' })
      .eq('section_id', sectionId);

    const { error: delErr } = await supabase
      .from('timetable_entries')
      .delete()
      .eq('section_id', sectionId);

    if (delErr) {
      throw new Error(`Failed to delete section timetable: ${delErr.message}`);
    }

    await supabase
      .from('timetable_versions')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('section_id', sectionId)
      .eq('status', 'active');

    // Deactivate faculty subject assignments associated with this cleared section
    try {
      await supabase
        .from('faculty_subject_assignments')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('section_id', sectionId);
    } catch (asgnErr) {
      console.warn('Deactivating section assignments warning:', asgnErr);
    }

    await supabase.from('audit_logs').insert([{
      action: 'TIMETABLE_SECTION_DELETED',
      actor_name: deletedBy,
      actor_role: 'hod',
      entity_type: 'sections',
      entity_id: sectionId,
      new_values: {
        section_id: sectionId,
        deleted_entries_count: existingCount || 0,
      }
    }]);

    this.invalidateMasterCache();

    try {
      const channel = supabase.channel('vctm-erp-realtime-channel');
      await channel.send({
        type: 'broadcast',
        event: 'timetable_updated',
        payload: {
          section_id: sectionId,
          period_count: 0,
          action: 'DELETED',
          timestamp: new Date().toISOString(),
        }
      });
    } catch {}

    return { success: true, deletedCount: existingCount || 0 };
  },

  async saveSectionTimetable(
    paramsOrSectionId: {
      sectionId: string;
      entries: Array<{
        subject_id?: string | null;
        faculty_id?: string | null;
        classroom_id?: string | null;
        day_of_week: DayOfWeek;
        period_number: number;
        start_time: string;
        end_time: string;
        room_number?: string;
        lecture_type?: LectureType;
        active?: boolean;
      }>;
      publishedBy?: string;
      effectiveDate?: string;
      sourceType?: 'CSV_URL' | 'CSV_UPLOAD' | 'MANUAL_EDIT' | 'AI_INGESTION' | 'ROLLBACK_RESTORE' | 'GOOGLE_SHEET_CSV_SYNC' | 'CSV_FILE_UPLOAD' | string;
      sourceUrl?: string;
    } | string,
    entriesParam?: Array<any>,
    publishedByParam?: string
  ): Promise<{ success: boolean; count: number; version?: TimetableVersion }> {
    const params = typeof paramsOrSectionId === 'string'
      ? {
          sectionId: paramsOrSectionId,
          entries: entriesParam || [],
          publishedBy: publishedByParam || 'HOD / Super Administrator',
          effectiveDate: undefined as string | undefined,
          sourceType: undefined as string | undefined,
          sourceUrl: undefined as string | undefined,
        }
      : paramsOrSectionId;

    if (!params.sectionId) {
      throw new Error('Target Section ID is required to save timetable.');
    }

    // 1. Fetch section details from Supabase
    const { data: sectionData, error: secErr } = await supabase
      .from('sections')
      .select('*, semester:semesters(*, academic_year:academic_years(*, program:programs(*, department:departments(*))))')
      .eq('id', params.sectionId)
      .single();

    if (secErr || !sectionData) {
      throw new Error(`Section not found: ${secErr?.message || params.sectionId}`);
    }

    const deptId = sectionData.semester?.academic_year?.program?.department_id || sectionData.department_id;
    const defaultRoom = sectionData.room_number || `Room ${sectionData.name}`;
    const effectiveFrom = params.effectiveDate || getISTTodayDate();
    const publishedBy = params.publishedBy || 'HOD / Super Administrator';
    const actionType = params.sourceType || 'MANUAL_HOD_SECTION_SAVE';

    // 2. Fetch latest version number to increment
    const { data: existingVersions } = await supabase
      .from('timetable_versions')
      .select('version_number')
      .eq('section_id', params.sectionId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = (existingVersions && existingVersions.length > 0)
      ? (existingVersions[0].version_number + 1)
      : 1;

    // 3. Mark old versions as superseded
    await supabase
      .from('timetable_versions')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('section_id', params.sectionId)
      .eq('status', 'active');

    const normalizeLectureType = (lt?: string): LectureType => {
      if (!lt) return 'Theory';
      const lower = lt.toLowerCase();
      if (lower === 'practical' || lower === 'lab') return 'Practical';
      if (lower === 'tutorial') return 'Tutorial';
      if (lower === 'workshop') return 'Workshop';
      if (lower === 'project') return 'Project';
      if (lower === 'sports') return 'Sports';
      if (lower === 'lunch' || lower === 'break') return 'Lunch';
      if (lower === 'other') return 'Other';
      return 'Theory';
    };

    // 4. Format new rows with default rooms & active status
    const rowsToInsert = params.entries.map(e => ({
      section_id: params.sectionId,
      subject_id: e.subject_id || null,
      faculty_id: e.faculty_id || null,
      day_of_week: e.day_of_week,
      period_number: e.period_number,
      start_time: e.start_time || '09:00',
      end_time: e.end_time || '09:50',
      room_number: e.room_number || defaultRoom,
      lecture_type: normalizeLectureType(e.lecture_type),
      active: true,
    }));

    // Attempt Atomic RPC replacement in PostgreSQL transaction first
    try {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('replace_section_timetable', {
        p_section_id: params.sectionId,
        p_department_id: deptId,
        p_approved_by: publishedBy,
        p_effective_from: effectiveFrom,
        p_source_type: actionType,
        p_source_url: params.sourceUrl || null,
        p_entries: rowsToInsert,
      });

      if (!rpcErr && rpcResult && rpcResult.success) {
        // Fetch created version
        const { data: createdVer } = await supabase
          .from('timetable_versions')
          .select('*')
          .eq('id', rpcResult.version_id)
          .maybeSingle();

        this.invalidateMasterCache();

        // Broadcast Realtime Update
        try {
          const channel = supabase.channel('vctm-erp-realtime-channel');
          await channel.send({
            type: 'broadcast',
            event: 'timetable_updated',
            payload: {
              section_id: params.sectionId,
              section_name: sectionData.name,
              new_timetable_version: rpcResult.version_number,
              source_type: actionType,
              timestamp: new Date().toISOString(),
            }
          });
        } catch {}

        // Notify enrolled students in target section
        try {
          const { data: secStudents } = await supabase
            .from('students')
            .select('id, auth_user_id')
            .eq('section_id', params.sectionId)
            .eq('active', true);

          if (secStudents && secStudents.length > 0) {
            const notifs = secStudents.map(st => ({
              recipient_user_id: st.auth_user_id || null,
              recipient_student_id: st.id,
              recipient_role: 'student',
              type: 'TIMETABLE_UPDATE' as NotificationType,
              title: 'Timetable Published',
              message: `Official timetable for Section ${sectionData?.name || ''} has been updated (Version ${rpcResult.version_number}).`,
              reference_type: 'timetable',
              reference_id: params.sectionId,
              is_read: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));
            await supabase.from('notifications').insert(notifs);
          }
        } catch (notifErr) {
          console.warn('Notice: Background notification dispatch for timetable:', notifErr);
        }

        return {
          success: true,
          count: rpcResult.period_count,
          version: createdVer || undefined,
        };
      }
    } catch (rpcEx) {
      console.warn('RPC replace_section_timetable fallback to client transaction:', rpcEx);
    }

    // 5. Create new active TimetableVersion storing full period snapshot (Fallback)
    const { data: createdVersion } = await supabase
      .from('timetable_versions')
      .insert([{
        department_id: deptId,
        section_id: params.sectionId,
        version_number: nextVersionNumber,
        effective_from: effectiveFrom,
        status: 'active',
        approved_by: publishedBy,
        approved_at: new Date().toISOString(),
        changes_summary: {
          action: actionType,
          source_type: actionType,
          source_url: params.sourceUrl || null,
          total_slots: rowsToInsert.length,
          effective_from: effectiveFrom,
          room: defaultRoom,
          snapshot: rowsToInsert,
        }
      }])
      .select('*')
      .single();

    // 6. Delete ALL previous timetable entries strictly for this section (Atomic replacement)
    const { error: delErr } = await supabase
      .from('timetable_entries')
      .delete()
      .eq('section_id', params.sectionId);

    if (delErr) {
      throw new Error(`Failed to clear previous section timetable: ${delErr.message}`);
    }

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('timetable_entries')
        .insert(rowsToInsert)
        .select('*');

      if (insertErr) {
        throw new Error(`Failed to insert timetable records: ${insertErr.message}`);
      }
    }

    // 7. Verify Actual Database Write (Source of truth check)
    const { count: verifiedCount, error: verifyErr } = await supabase
      .from('timetable_entries')
      .select('id', { count: 'exact' })
      .eq('section_id', params.sectionId)
      .eq('active', true);

    if (verifyErr || (rowsToInsert.length > 0 && verifiedCount !== rowsToInsert.length)) {
      throw new Error(`Database verification failed: Expected ${rowsToInsert.length} active entries in Supabase, found ${verifiedCount || 0}.`);
    }

    // 8. Synchronize faculty_subject_assignments
    const distinctPairs = new Map<string, { facultyId: string; subjectId: string }>();
    for (const row of rowsToInsert) {
      if (!row.faculty_id || !row.subject_id) continue;
      const pairKey = `${row.faculty_id}-${row.subject_id}`;
      if (!distinctPairs.has(pairKey)) {
        distinctPairs.set(pairKey, { facultyId: row.faculty_id, subjectId: row.subject_id });
      }
    }

    const { data: currentSessionData } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .maybeSingle();
    const currentSessionId = currentSessionData?.id || '';

    // Deactivate assignments for this section that are no longer in the published timetable
    const { data: existingSectionAssignments } = await supabase
      .from('faculty_subject_assignments')
      .select('id, faculty_id, subject_id')
      .eq('section_id', params.sectionId)
      .eq('active', true);

    if (existingSectionAssignments) {
      for (const curr of existingSectionAssignments) {
        const pairKey = `${curr.faculty_id}-${curr.subject_id}`;
        if (!distinctPairs.has(pairKey)) {
          await supabase
            .from('faculty_subject_assignments')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', curr.id);
        }
      }
    }

    for (const pair of distinctPairs.values()) {
      const { data: existingAssignment } = await supabase
        .from('faculty_subject_assignments')
        .select('id, active')
        .eq('faculty_id', pair.facultyId)
        .eq('subject_id', pair.subjectId)
        .eq('section_id', params.sectionId)
        .maybeSingle();

      if (!existingAssignment) {
        await supabase.from('faculty_subject_assignments').insert([{
          faculty_id: pair.facultyId,
          subject_id: pair.subjectId,
          section_id: params.sectionId,
          academic_session_id: currentSessionId,
          active: true,
        }]);
      } else if (!existingAssignment.active) {
        await supabase
          .from('faculty_subject_assignments')
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq('id', existingAssignment.id);
      }
    }

    // 9. Invalidate Master Cache
    this.invalidateMasterCache();

    // 10. Record Audit Log in Supabase
    await supabase.from('audit_logs').insert([{
      action: 'TIMETABLE_SECTION_REPLACED_AND_PUBLISHED',
      actor_name: publishedBy,
      actor_role: 'hod',
      entity_type: 'timetable_version',
      entity_id: createdVersion?.id || params.sectionId,
      new_values: {
        section_id: params.sectionId,
        section_name: sectionData.name,
        version: nextVersionNumber,
        source_type: actionType,
        source_url: params.sourceUrl || null,
        effective_from: effectiveFrom,
        slots_count: rowsToInsert.length,
      }
    }]);

    // 11. Create Official Circular / Notice for affected students & faculty
    await this.publishNotice({
      title: `Official Timetable Updated — Section ${sectionData.name} (W.E.F. ${effectiveFrom})`,
      category: 'Academic',
      author: publishedBy,
      content: `The official academic timetable for Section ${sectionData.name} has been published by HOD (${actionType}, Version ${nextVersionNumber}, Effective ${effectiveFrom}, Room: ${defaultRoom}). Total ${rowsToInsert.length} periods active. All students and assigned faculty are requested to follow this schedule.`,
      isPinned: true,
      targetAudience: `Section ${sectionData.name}`,
      targetSectionId: params.sectionId,
      targetDepartmentId: deptId || null,
      targetProgramId: sectionData.semester?.academic_year?.program_id || null,
      targetSemesterId: sectionData.semester_id || null,
    });

    // 12. Broadcast Realtime Timetable Update Event
    try {
      const channel = supabase.channel('vctm-erp-realtime-channel');
      await channel.send({
        type: 'broadcast',
        event: 'timetable_updated',
        payload: {
          section_id: params.sectionId,
          section_name: sectionData.name,
          new_timetable_version: nextVersionNumber,
          source_type: actionType,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (realtimeErr) {
      console.warn('Realtime broadcast notice skipped:', realtimeErr);
    }

    return {
      success: true,
      count: verifiedCount || 0,
      version: createdVersion as TimetableVersion,
    };
  },

  /**
   * Rollback / Restore a section's timetable to a previous version snapshot atomically
   */
  async rollbackToVersion(params: {
    versionId: string;
    restoredBy?: string;
  }): Promise<{ success: boolean; count: number; version?: TimetableVersion }> {
    const { data: targetVersion, error: verErr } = await supabase
      .from('timetable_versions')
      .select('*')
      .eq('id', params.versionId)
      .single();

    if (verErr || !targetVersion) {
      throw new Error(`Target timetable version not found: ${verErr?.message || params.versionId}`);
    }

    const sectionId = targetVersion.section_id;
    if (!sectionId) {
      throw new Error('Target version does not contain a valid section association.');
    }

    const snapshot = targetVersion.changes_summary?.snapshot;
    if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) {
      throw new Error(`Version ${targetVersion.version_number} does not contain a recoverable period snapshot.`);
    }

    const actorName = params.restoredBy || 'HOD / Administrator';

    return await this.saveSectionTimetable({
      sectionId,
      entries: snapshot.map((s: any) => ({
        subject_id: s.subject_id,
        faculty_id: s.faculty_id,
        day_of_week: s.day_of_week,
        period_number: s.period_number,
        start_time: s.start_time,
        end_time: s.end_time,
        room_number: s.room_number,
        lecture_type: s.lecture_type,
        active: true,
      })),
      publishedBy: `${actorName} (Rollback to v${targetVersion.version_number})`,
      effectiveDate: targetVersion.effective_from || getISTTodayDate(),
      sourceType: 'ROLLBACK_RESTORE',
    });
  },

  /**
   * Reconcile and synchronize faculty_subject_assignments with active published timetable entries.
   * Deactivates orphan / obsolete assignments and ensures all active timetable pairs are recorded.
   */
  async syncFacultySubjectAssignmentsWithTimetable(): Promise<{ deactivated: number; activatedOrInserted: number }> {
    // 1. Get all active timetable teaching entries
    const { data: activeTtEntries } = await supabase
      .from('timetable_entries')
      .select('faculty_id, subject_id, section_id')
      .eq('active', true);

    const validPairs = new Set<string>();
    const activeSectionIds = new Set<string>();

    (activeTtEntries || []).forEach(t => {
      if (t.faculty_id && t.subject_id && t.section_id) {
        validPairs.add(`${t.faculty_id}-${t.subject_id}-${t.section_id}`);
        activeSectionIds.add(t.section_id);
      }
    });

    // 2. Fetch current assignments
    const { data: allAssignments } = await supabase
      .from('faculty_subject_assignments')
      .select('id, faculty_id, subject_id, section_id, active');

    let deactivated = 0;
    let activatedOrInserted = 0;

    const existingMap = new Map<string, any>();
    (allAssignments || []).forEach(a => {
      const key = `${a.faculty_id}-${a.subject_id}-${a.section_id}`;
      existingMap.set(key, a);
      // If assignment is active but pair is not in any published timetable
      if (a.active && !validPairs.has(key)) {
        deactivated++;
      }
    });

    // Deactivate orphan assignments
    for (const a of (allAssignments || [])) {
      const key = `${a.faculty_id}-${a.subject_id}-${a.section_id}`;
      if (a.active && !validPairs.has(key)) {
        await supabase
          .from('faculty_subject_assignments')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', a.id);
      }
    }

    // Get current academic session
    const { data: currentSessionData } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('is_current', true)
      .maybeSingle();
    const currentSessionId = currentSessionData?.id || '';

    // Ensure all published pairs exist and are active
    for (const pairKey of validPairs) {
      const [facId, subId, secId] = pairKey.split('-');
      const existing = existingMap.get(pairKey);
      if (!existing) {
        await supabase.from('faculty_subject_assignments').insert([{
          faculty_id: facId,
          subject_id: subId,
          section_id: secId,
          academic_session_id: currentSessionId,
          active: true,
        }]);
        activatedOrInserted++;
      } else if (!existing.active) {
        await supabase
          .from('faculty_subject_assignments')
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        activatedOrInserted++;
      }
    }

    this.invalidateMasterCache();
    return { deactivated, activatedOrInserted };
  },

  /**
   * Check for genuine cross-section faculty scheduling conflicts without blocking timetable updates
   */
  async checkFacultyCrossSectionConflicts(params: {
    sectionId: string;
    entries: Array<{ faculty_id: string; day_of_week: DayOfWeek; period_number: number; start_time?: string; end_time?: string; subject_id?: string; lecture_type?: string }>;
  }): Promise<Array<{ facultyName: string; day: DayOfWeek; period: number; otherSectionName: string; otherSubjectCode?: string; timeRange?: string }>> {
    const isNonInstructional = (type?: string) => ['Lunch', 'Sports', 'Other'].includes(type || '');
    const validEntries = params.entries.filter(e => e.faculty_id && !isNonInstructional(e.lecture_type));
    const facultyIds = Array.from(new Set(validEntries.map(e => e.faculty_id).filter(Boolean)));
    if (facultyIds.length === 0) return [];

    const { data: otherEntries, error } = await supabase
      .from('timetable_entries')
      .select('faculty_id, day_of_week, period_number, start_time, end_time, section_id, lecture_type, sections(id, name, semester_id, semesters(semester_number, academic_year_id, academic_years(name))), subjects(subject_code), faculty(full_name)')
      .in('faculty_id', facultyIds)
      .neq('section_id', params.sectionId)
      .eq('active', true);

    if (error || !otherEntries || otherEntries.length === 0) return [];

    const conflicts: Array<{ facultyName: string; day: DayOfWeek; period: number; otherSectionName: string; otherSubjectCode?: string; timeRange?: string }> = [];

    const toMins = (t?: string) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    for (const e of validEntries) {
      const match = otherEntries.find((o: any) => {
        if (isNonInstructional(o.lecture_type)) return false;
        if (o.faculty_id !== e.faculty_id || o.day_of_week !== e.day_of_week) return false;
        if (e.start_time && e.end_time && o.start_time && o.end_time) {
          const sA = toMins(e.start_time);
          const eA = toMins(e.end_time);
          const sB = toMins(o.start_time);
          const eB = toMins(o.end_time);
          if (eA > sA && eB > sB) {
            return sA < eB && sB < eA;
          }
        }
        return o.period_number === e.period_number;
      });

      if (match) {
        const facName = (match as any).faculty?.full_name || 'Faculty Member';
        const secObj = (match as any).sections;
        const semObj = secObj?.semesters;
        const yrObj = semObj?.academic_years;
        const yrName = yrObj?.name;
        const secName = yrName ? `${yrName} Section ${secObj?.name || ''}` : `Section ${secObj?.name || 'Other Section'}`;
        const subCode = (match as any).subjects?.subject_code;
        const timeRange = (match as any).start_time && (match as any).end_time ? `${(match as any).start_time}–${(match as any).end_time}` : undefined;

        conflicts.push({
          facultyName: facName,
          day: e.day_of_week,
          period: e.period_number,
          otherSectionName: secName,
          otherSubjectCode: subCode,
          timeRange,
        });
      }
    }

    return conflicts;
  },

  // ==========================================
  // ASSIGNMENTS MODULE
  // ==========================================
  async createAssignment(assignment: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('assignments').insert(assignment).select().single();
    if (error) throw new Error(error.message);

    // Audit Log
    await supabase.from('audit_logs').insert({
      action: 'ASSIGNMENT_CREATED',
      actor_name: 'Faculty',
      actor_role: 'faculty',
      entity_type: 'assignment',
      entity_id: data.id,
      new_values: { title: assignment.title, max_marks: assignment.max_marks, due_date: assignment.due_date }
    });

    // Notify students in the target section
    try {
      if (assignment.section_id) {
        const { data: sectionStudents } = await supabase
          .from('students')
          .select('id, auth_user_id')
          .eq('section_id', assignment.section_id)
          .eq('active', true);

        if (sectionStudents && sectionStudents.length > 0) {
          let subjectName = 'Course Subject';
          if (assignment.subject_id) {
            const { data: sub } = await supabase
              .from('subjects')
              .select('subject_name')
              .eq('id', assignment.subject_id)
              .maybeSingle();
            if (sub?.subject_name) subjectName = sub.subject_name;
          }

          const dueDateStr = assignment.due_date ? new Date(assignment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Pending';

          const notifRows = sectionStudents.map(st => ({
            recipient_user_id: st.auth_user_id || null,
            recipient_student_id: st.id,
            type: 'ASSIGNMENT_POSTED' as NotificationType,
            title: 'New Assignment Posted',
            message: `${subjectName}: ${assignment.title} (Due: ${dueDateStr})`,
            reference_type: 'assignment',
            reference_id: data.id,
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          await supabase.from('notifications').insert(notifRows);
        }
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for assignment:', notifErr);
    }

    return data as Assignment;
  },

  async updateAssignment(id: string, updates: Partial<Assignment>) {
    const { data, error } = await supabase.from('assignments').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);

    try {
      if (data && data.section_id && (updates.title || updates.due_date || updates.max_marks)) {
        const { data: sectionStudents } = await supabase
          .from('students')
          .select('id, auth_user_id')
          .eq('section_id', data.section_id)
          .eq('active', true);

        if (sectionStudents && sectionStudents.length > 0) {
          let subjectName = 'Course Subject';
          if (data.subject_id) {
            const { data: sub } = await supabase
              .from('subjects')
              .select('subject_name')
              .eq('id', data.subject_id)
              .maybeSingle();
            if (sub?.subject_name) subjectName = sub.subject_name;
          }

          const dueDateStr = data.due_date ? new Date(data.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Updated';

          const notifRows = sectionStudents.map(st => ({
            recipient_user_id: st.auth_user_id || null,
            recipient_student_id: st.id,
            type: 'ASSIGNMENT_UPDATED' as NotificationType,
            title: 'Assignment Updated',
            message: `${subjectName}: ${data.title} was updated (Due: ${dueDateStr})`,
            reference_type: 'assignment',
            reference_id: data.id,
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          await supabase.from('notifications').insert(notifRows);
        }
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for assignment update:', notifErr);
    }

    return data as Assignment;
  },

  async deleteCourseAssignment(id: string) {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async submitAssignment(submission: {
    assignmentId: string;
    studentId: string;
    submissionType: string;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    googleFormSubmitted?: boolean;
  }) {
    // 1. Fetch assignment to check due date
    const { data: assignment, error: assignErr } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', submission.assignmentId)
      .single();

    if (assignErr || !assignment) throw new Error('Assignment not found');

    const now = new Date();
    const dueDate = new Date(assignment.due_date);
    const isLate = now > dueDate;

    if (isLate && !assignment.allow_late_submission) {
      throw new Error(`Submission deadline passed (${dueDate.toLocaleString()}). Late submissions are not accepted.`);
    }

    const status = isLate ? 'late_submission' : 'submitted';

    const { data, error } = await supabase
      .from('assignment_submissions')
      .upsert({
        assignment_id: submission.assignmentId,
        student_id: submission.studentId,
        submission_type: submission.submissionType,
        file_path: submission.filePath,
        file_name: submission.fileName,
        file_size: submission.fileSize,
        mime_type: submission.mimeType,
        google_form_submitted: submission.googleFormSubmitted || false,
        submitted_at: new Date().toISOString(),
        status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Audit Log
    await supabase.from('audit_logs').insert({
      action: 'ASSIGNMENT_SUBMITTED',
      actor_name: 'Student',
      actor_role: 'student',
      entity_type: 'assignment_submission',
      entity_id: data.id,
      new_values: { assignment_id: submission.assignmentId, isLate, fileName: submission.fileName }
    });

    return data as AssignmentSubmission;
  },

  async gradeAssignmentSubmission(params: {
    submissionId: string;
    marksObtained: number;
    feedback?: string;
    facultyId: string;
  }) {
    if (params.marksObtained < 0) {
      throw new Error('Marks obtained cannot be negative.');
    }

    const { data: currentSub } = await supabase
      .from('assignment_submissions')
      .select('*, assignment:assignments(*)')
      .eq('id', params.submissionId)
      .single();

    if (!currentSub) throw new Error('Submission record not found.');
    const maxMarks = currentSub.assignment?.max_marks || 100;

    if (params.marksObtained > maxMarks) {
      throw new Error(`Marks obtained (${params.marksObtained}) exceeds maximum marks (${maxMarks}).`);
    }

    const oldMarks = currentSub.marks_obtained;

    const { data, error } = await supabase
      .from('assignment_submissions')
      .update({
        marks_obtained: params.marksObtained,
        feedback: params.feedback,
        status: 'graded',
        graded_by: params.facultyId,
        graded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.submissionId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Record in marks_history
    await supabase.from('marks_history').insert({
      entity_type: 'assignment',
      entity_id: currentSub.assignment_id,
      student_id: currentSub.student_id,
      subject_id: currentSub.assignment?.subject_id,
      old_marks: oldMarks,
      new_marks: params.marksObtained,
      updated_by: params.facultyId,
      reason: params.feedback || 'Assignment Graded'
    });

    return data as AssignmentSubmission;
  },

  // ==========================================
  // QUIZZES MODULE
  // ==========================================
  async createQuiz(quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at'>) {
    const cleanTitle = (quiz.title || '').trim();
    if (!cleanTitle) {
      throw new Error('Quiz title is required.');
    }

    // Check if an identical quiz already exists for this subject & section
    if (quiz.subject_id && quiz.section_id) {
      const { data: existing } = await supabase
        .from('quizzes')
        .select('*')
        .eq('subject_id', quiz.subject_id)
        .eq('section_id', quiz.section_id)
        .ilike('title', cleanTitle)
        .maybeSingle();

      if (existing) {
        return existing as Quiz;
      }
    }

    let formUrl = (quiz.google_form_url || '').trim();
    if (!formUrl) {
      formUrl = 'https://vctm.in/quizzes';
    } else if (!formUrl.startsWith('http')) {
      formUrl = `https://${formUrl}`;
    }

    const payload = {
      ...quiz,
      title: cleanTitle,
      google_form_url: formUrl,
      start_time: quiz.start_time || new Date().toISOString(),
      end_time: quiz.end_time || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data, error } = await supabase.from('quizzes').insert(payload).select().single();
    if (error) {
      // If error is unique constraint violation, fetch and return existing
      if (error.code === '23505' || error.message?.includes('unique')) {
        const { data: existingAfterConflict } = await supabase
          .from('quizzes')
          .select('*')
          .eq('subject_id', quiz.subject_id)
          .eq('section_id', quiz.section_id)
          .ilike('title', cleanTitle)
          .maybeSingle();
        if (existingAfterConflict) return existingAfterConflict as Quiz;
      }
      throw new Error(error.message);
    }

    // Audit Log
    await supabase.from('audit_logs').insert({
      action: 'QUIZ_CREATED',
      actor_name: 'Faculty',
      actor_role: 'faculty',
      entity_type: 'quiz',
      entity_id: data.id,
      new_values: { title: quiz.title, max_marks: quiz.max_marks, url: quiz.google_form_url }
    });

    // Notify enrolled students in target section
    try {
      if (data && quiz.section_id) {
        const { data: secStudents } = await supabase
          .from('students')
          .select('id, auth_user_id')
          .eq('section_id', quiz.section_id)
          .eq('active', true);

        if (secStudents && secStudents.length > 0) {
          let subName = 'Course Subject';
          if (quiz.subject_id) {
            const { data: sub } = await supabase.from('subjects').select('subject_name').eq('id', quiz.subject_id).maybeSingle();
            if (sub?.subject_name) subName = sub.subject_name;
          }
          const notifs = secStudents.map(st => ({
            recipient_user_id: st.auth_user_id || null,
            recipient_student_id: st.id,
            recipient_role: 'student',
            type: 'QUIZ_POSTED' as NotificationType,
            title: 'New Quiz Posted',
            message: `${subName}: ${quiz.title} (Max Marks: ${quiz.max_marks})`,
            reference_type: 'quiz',
            reference_id: data.id,
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for quiz:', notifErr);
    }

    return data as Quiz;
  },

  async updateQuiz(id: string, updates: Partial<Quiz>) {
    const { data, error } = await supabase.from('quizzes').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Quiz;
  },

  async deleteQuiz(id: string) {
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async saveQuizMarks(params: {
    quizId: string;
    facultyId: string;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
    isPublished?: boolean;
  }) {
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', params.quizId).single();
    if (!quiz) throw new Error('Quiz not found.');

    const targetStatus = params.isPublished !== undefined
      ? (params.isPublished ? 'published' : 'draft')
      : (quiz.status || 'draft');

    if (params.isPublished !== undefined) {
      await supabase
        .from('quizzes')
        .update({
          status: targetStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.quizId);
    }

    // Resolve valid faculty ID for foreign key integrity
    let validFacultyId = params.facultyId;
    if (validFacultyId) {
      const { data: fac } = await supabase.from('faculty').select('id').eq('id', validFacultyId).maybeSingle();
      if (!fac) {
        const { data: facByAuth } = await supabase.from('faculty').select('id').eq('auth_user_id', validFacultyId).maybeSingle();
        if (facByAuth) {
          validFacultyId = facByAuth.id;
        } else {
          const { data: defaultFac } = await supabase.from('faculty').select('id').limit(1).maybeSingle();
          if (defaultFac) validFacultyId = defaultFac.id;
        }
      }
    }

    const rows = params.studentMarks.map(sm => {
      if (sm.marksObtained < 0 || sm.marksObtained > quiz.max_marks) {
        throw new Error(`Invalid marks for student: ${sm.marksObtained}. Must be between 0 and ${quiz.max_marks}.`);
      }
      return {
        quiz_id: params.quizId,
        student_id: sm.studentId,
        marks_obtained: sm.marksObtained,
        graded_by: validFacultyId,
        graded_at: new Date().toISOString(),
        remarks: sm.remarks,
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('quiz_results')
      .upsert(rows, { onConflict: 'quiz_id,student_id' })
      .select();

    if (error) throw new Error(error.message);

    // Record audit logs
    for (const sm of params.studentMarks) {
      await supabase.from('marks_history').insert({
        entity_type: 'quiz',
        entity_id: params.quizId,
        student_id: sm.studentId,
        subject_id: quiz.subject_id,
        new_marks: sm.marksObtained,
        updated_by: validFacultyId,
        reason: targetStatus === 'published' ? 'Quiz Marks Published' : 'Quiz Marks Recorded (Draft)'
      });
    }

    // Notify students of evaluated quiz marks ONLY if published
    try {
      const shouldNotify = targetStatus === 'published';
      if (shouldNotify) {
        const studentIds = params.studentMarks.map(sm => sm.studentId);
        const { data: stData } = await supabase.from('students').select('id, auth_user_id').in('id', studentIds);
        const stMap = new Map((stData || []).map(s => [s.id, s.auth_user_id]));

        let subName = 'Quiz';
        if (quiz.subject_id) {
          const { data: s } = await supabase.from('subjects').select('subject_name').eq('id', quiz.subject_id).maybeSingle();
          if (s?.subject_name) subName = s.subject_name;
        }

        const notifs = params.studentMarks.map(sm => ({
          recipient_user_id: stMap.get(sm.studentId) || null,
          recipient_student_id: sm.studentId,
          recipient_role: 'student',
          type: 'QUIZ_GRADED' as NotificationType,
          title: 'Quiz Evaluated',
          message: `${subName} — ${quiz.title}: ${sm.marksObtained}/${quiz.max_marks}`,
          reference_type: 'quiz',
          reference_id: params.quizId,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        if (notifs.length > 0) {
          await supabase.from('notifications').insert(notifs);
        }
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for quiz marks:', notifErr);
    }

    return data as QuizResult[];
  },

  // ==========================================
  // SESSIONAL ASSESSMENTS & DYNAMIC MARKS MODULE
  // ==========================================
  async createSessionalAssessment(assessment: Omit<SessionalAssessment, 'id' | 'created_at' | 'updated_at'>) {
    if (assessment.max_marks <= 0) {
      throw new Error('Maximum marks must be greater than 0.');
    }
    const cleanTitle = (assessment.title || '').trim();
    if (!cleanTitle) {
      throw new Error('Sessional title is required.');
    }

    // Check if an identical sessional assessment already exists for this subject & section
    if (assessment.subject_id && assessment.section_id) {
      const { data: existing } = await supabase
        .from('sessional_assessments')
        .select('*')
        .eq('subject_id', assessment.subject_id)
        .eq('section_id', assessment.section_id)
        .ilike('title', cleanTitle)
        .maybeSingle();

      if (existing) {
        return existing as SessionalAssessment;
      }
    }

    // Resolve auth_user_id for sessional_assessments.faculty_id (references auth.users.id)
    let authFacultyId = assessment.faculty_id;
    if (authFacultyId) {
      const { data: fac } = await supabase.from('faculty').select('auth_user_id').eq('id', authFacultyId).maybeSingle();
      if (fac?.auth_user_id) {
        authFacultyId = fac.auth_user_id;
      }
    }
    if (!authFacultyId) {
      const { data: currentAuth } = await supabase.auth.getUser();
      authFacultyId = currentAuth?.user?.id || assessment.faculty_id;
    }

    const { data, error } = await supabase
      .from('sessional_assessments')
      .insert({
        ...assessment,
        title: cleanTitle,
        faculty_id: authFacultyId,
        status: assessment.status || 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message?.includes('unique')) {
        const { data: existingAfterConflict } = await supabase
          .from('sessional_assessments')
          .select('*')
          .eq('subject_id', assessment.subject_id)
          .eq('section_id', assessment.section_id)
          .ilike('title', cleanTitle)
          .maybeSingle();
        if (existingAfterConflict) return existingAfterConflict as SessionalAssessment;
      }
      throw new Error(error.message);
    }

    await supabase.from('audit_logs').insert({
      action: 'SESSIONAL_ASSESSMENT_CREATED',
      actor_id: assessment.faculty_id || null,
      target_type: 'sessional_assessments',
      target_id: data.id,
      details: { title: assessment.title, maxMarks: assessment.max_marks, subjectId: assessment.subject_id },
      reason: assessment.status === 'published' ? 'Dynamic Sessional Assessment Published' : 'Dynamic Sessional Assessment Created (Draft)'
    });

    return data as SessionalAssessment;
  },

  async updateSessionalAssessment(id: string, updates: Partial<SessionalAssessment>) {
    const { data, error } = await supabase
      .from('sessional_assessments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // If assessment publication status was modified, cascade to all linked student marks
    if (updates.status) {
      const markStatus = (updates.status === 'published' || updates.status === 'completed') ? 'published' : 'draft';
      await supabase
        .from('sessional_marks')
        .update({
          status: markStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('sessional_assessment_id', id);
    }

    return data as SessionalAssessment;
  },

  async deleteSessionalAssessment(id: string) {
    const { error } = await supabase.from('sessional_assessments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async ensureDefaultSessionalAssessments(params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
    semesterId?: string;
  }): Promise<SessionalAssessment[]> {
    const key = `${params.subjectId}::${params.sectionId}`;
    if (_inFlightEnsureSessionals.has(key)) {
      return _inFlightEnsureSessionals.get(key)!;
    }

    const promise = (async () => {
      try {
        const { data: existing, error } = await supabase
          .from('sessional_assessments')
          .select('*')
          .eq('subject_id', params.subjectId)
          .eq('section_id', params.sectionId);

        if (error) {
          console.warn('Error checking existing sessional assessments:', error.message);
          return [];
        }

        const currentList = (existing as SessionalAssessment[]) || [];
        const existingByTitle = new Map<string, SessionalAssessment>();
        for (const a of currentList) {
          const tKey = (a.title || '').trim().toLowerCase();
          if (!existingByTitle.has(tKey)) {
            existingByTitle.set(tKey, a);
          }
        }

        const toCreate: Array<{ title: string; max_marks: number }> = [];
        if (!existingByTitle.has('sessional 1')) {
          toCreate.push({ title: 'Sessional 1', max_marks: 20 });
        }
        if (!existingByTitle.has('sessional 2')) {
          toCreate.push({ title: 'Sessional 2', max_marks: 30 });
        } else {
          const s2 = existingByTitle.get('sessional 2');
          if (s2 && s2.max_marks === 20) {
            try {
              await this.updateSessionalAssessment(s2.id, { max_marks: 30 });
              s2.max_marks = 30;
            } catch (err) {
              console.warn('Failed to auto-upgrade Sessional 2 max marks to 30:', err);
            }
          }
        }
        if (!existingByTitle.has('sessional 3')) {
          toCreate.push({ title: 'Sessional 3', max_marks: 20 });
        }

        for (const item of toCreate) {
          try {
            const created = await this.createSessionalAssessment({
              title: item.title,
              subject_id: params.subjectId,
              section_id: params.sectionId,
              faculty_id: params.facultyId,
              semester_id: params.semesterId,
              max_marks: item.max_marks,
              exam_date: new Date().toISOString().split('T')[0],
              status: 'draft',
            });
            existingByTitle.set(item.title.toLowerCase(), created);
          } catch (err) {
            console.warn(`Failed to auto-create default assessment ${item.title}:`, err);
          }
        }

        return Array.from(existingByTitle.values());
      } finally {
        _inFlightEnsureSessionals.delete(key);
      }
    })();

    _inFlightEnsureSessionals.set(key, promise);
    return promise;
  },

  async ensureDefaultQuizzes(params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
  }): Promise<Quiz[]> {
    const key = `${params.subjectId}::${params.sectionId}`;
    if (_inFlightEnsureQuizzes.has(key)) {
      return _inFlightEnsureQuizzes.get(key)!;
    }

    const promise = (async () => {
      try {
        const { data: existing, error } = await supabase
          .from('quizzes')
          .select('*')
          .eq('subject_id', params.subjectId)
          .eq('section_id', params.sectionId);

        if (error) {
          console.warn('Error checking existing quizzes:', error.message);
          return [];
        }

        const currentList = (existing as Quiz[]) || [];
        const existingByTitle = new Map<string, Quiz>();
        for (const q of currentList) {
          const tKey = (q.title || '').trim().toLowerCase();
          if (!existingByTitle.has(tKey)) {
            existingByTitle.set(tKey, q);
          }
        }

        const toCreate: Array<{ title: string; max_marks: number }> = [];
        for (let i = 1; i <= 5; i++) {
          const qTitle = `Quiz ${i}`;
          if (!existingByTitle.has(qTitle.toLowerCase())) {
            toCreate.push({ title: qTitle, max_marks: 20 });
          }
        }

        for (const item of toCreate) {
          try {
            const now = new Date();
            const created = await this.createQuiz({
              faculty_id: params.facultyId,
              subject_id: params.subjectId,
              section_id: params.sectionId,
              title: item.title,
              max_marks: item.max_marks,
              quiz_date: now.toISOString().split('T')[0],
              start_time: now.toISOString(),
              end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              google_form_url: 'https://vctm.in/quizzes',
              status: 'draft',
              active: true
            });
            existingByTitle.set(item.title.toLowerCase(), created);
          } catch (err) {
            console.warn(`Failed to auto-create quiz ${item.title}:`, err);
          }
        }

        return Array.from(existingByTitle.values());
      } finally {
        _inFlightEnsureQuizzes.delete(key);
      }
    })();

    _inFlightEnsureQuizzes.set(key, promise);
    return promise;
  },

  async ensureDefaultAssessments(params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
    semesterId?: string;
  }): Promise<{ sessionals: SessionalAssessment[]; quizzes: Quiz[] }> {
    const [sessionals, quizzes] = await Promise.all([
      this.ensureDefaultSessionalAssessments(params),
      this.ensureDefaultQuizzes({
        subjectId: params.subjectId,
        sectionId: params.sectionId,
        facultyId: params.facultyId
      })
    ]);
    return { sessionals, quizzes };
  },

  async saveSessionalMarks(params: {
    sessionalAssessmentId?: string;
    subjectId?: string;
    sectionId?: string;
    sessionalType?: string;
    maxMarks?: number;
    facultyId: string;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }>;
    isPublished?: boolean;
  }): Promise<SessionalMark[]> {
    if (params.sessionalAssessmentId && (!params.subjectId || !params.sectionId || params.maxMarks === undefined)) {
      const { data: sa } = await supabase.from('sessional_assessments').select('*').eq('id', params.sessionalAssessmentId).single();
      if (sa) {
        params.subjectId = params.subjectId || sa.subject_id;
        params.sectionId = params.sectionId || sa.section_id;
        params.maxMarks = params.maxMarks ?? sa.max_marks;
        params.sessionalType = params.sessionalType || sa.title;
      }
    }

    if (params.maxMarks === undefined || params.maxMarks <= 0) {
      throw new Error('Maximum marks must be defined and greater than 0.');
    }

    // Resolve target publication status
    let targetStatus: 'draft' | 'published';
    if (params.isPublished !== undefined) {
      targetStatus = params.isPublished ? 'published' : 'draft';
    } else if (params.sessionalAssessmentId) {
      const { data: currentSa } = await supabase
        .from('sessional_assessments')
        .select('status')
        .eq('id', params.sessionalAssessmentId)
        .maybeSingle();
      targetStatus = (currentSa?.status === 'published' || currentSa?.status === 'completed') ? 'published' : 'draft';
    } else {
      targetStatus = 'draft';
    }

    // If isPublished is specified, update the sessional assessment status and align existing marks
    if (params.sessionalAssessmentId && params.isPublished !== undefined) {
      await supabase
        .from('sessional_assessments')
        .update({
          status: params.isPublished ? 'published' : 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.sessionalAssessmentId);

      await supabase
        .from('sessional_marks')
        .update({
          status: params.isPublished ? 'published' : 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('sessional_assessment_id', params.sessionalAssessmentId);
    }

    // Resolve valid faculty ID for foreign key integrity
    let validFacultyId = params.facultyId;
    if (validFacultyId) {
      const { data: fac } = await supabase
        .from('faculty')
        .select('id, auth_user_id')
        .eq('id', validFacultyId)
        .maybeSingle();
      if (!fac) {
        const { data: facByAuth } = await supabase
          .from('faculty')
          .select('id')
          .eq('auth_user_id', validFacultyId)
          .maybeSingle();
        if (facByAuth) {
          validFacultyId = facByAuth.id;
        } else {
          const { data: defaultFac } = await supabase.from('faculty').select('id').limit(1).maybeSingle();
          if (defaultFac) validFacultyId = defaultFac.id;
        }
      }
    }

    // Resolve auth user ID for updated_by (references auth.users.id)
    const { data: currentAuth } = await supabase.auth.getUser();
    let authUpdaterId = currentAuth?.user?.id || null;
    if (!authUpdaterId && params.facultyId) {
      const { data: fac } = await supabase.from('faculty').select('auth_user_id').eq('id', params.facultyId).maybeSingle();
      if (fac?.auth_user_id) authUpdaterId = fac.auth_user_id;
    }

    const rows = params.studentMarks.map(sm => {
      if (sm.marksObtained < 0 || sm.marksObtained > params.maxMarks!) {
        throw new Error(`Marks ${sm.marksObtained} exceeds valid range (0 - ${params.maxMarks}).`);
      }
      return {
        sessional_assessment_id: params.sessionalAssessmentId || null,
        faculty_id: validFacultyId,
        subject_id: params.subjectId,
        section_id: params.sectionId,
        student_id: sm.studentId,
        sessional_type: params.sessionalType || 'Sessional',
        max_marks: params.maxMarks,
        marks_obtained: sm.marksObtained,
        remarks: sm.remarks,
        status: targetStatus,
        updated_by: authUpdaterId,
        updated_at: new Date().toISOString(),
      };
    });

    // Upsert using assessment ID conflict if available, else subject/section/student/type
    let upsertResult;
    if (params.sessionalAssessmentId) {
      upsertResult = await supabase
        .from('sessional_marks')
        .upsert(rows, { onConflict: 'sessional_assessment_id,student_id' })
        .select();
    } else {
      upsertResult = await supabase
        .from('sessional_marks')
        .upsert(rows, { onConflict: 'subject_id,section_id,student_id,sessional_type' })
        .select();
    }

    if (upsertResult.error) throw new Error(upsertResult.error.message);

    // Record in marks_history audit table
    for (const sm of params.studentMarks) {
      if (sm.oldMarks !== sm.marksObtained) {
        await supabase.from('marks_history').insert({
          entity_type: 'sessional',
          entity_id: params.sessionalAssessmentId || params.subjectId,
          student_id: sm.studentId,
          subject_id: params.subjectId,
          old_marks: sm.oldMarks,
          new_marks: sm.marksObtained,
          updated_by: validFacultyId,
          reason: `${params.sessionalType || 'Sessional'} Marks Updated`
        });
      }
    }

    // Trigger Real-time notifications ONLY when marks are actually published
    try {
      const shouldNotify = targetStatus === 'published';

      if (shouldNotify) {
        let subjectName = 'Course Subject';
        if (params.subjectId) {
          const { data: subData } = await supabase.from('subjects').select('subject_name').eq('id', params.subjectId).maybeSingle();
          if (subData?.subject_name) subjectName = subData.subject_name;
        }

        // Batch fetch all student auth user IDs in a single query (N+1 query elimination)
        const studentIds = params.studentMarks.map(sm => sm.studentId);
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, auth_user_id')
          .in('id', studentIds);

        const studentMap = new Map((studentsData || []).map(s => [s.id, s.auth_user_id]));

        const notifRows: any[] = params.studentMarks.map(sm => {
          const isUpdate = sm.oldMarks !== undefined && sm.oldMarks !== null;
          return {
            recipient_user_id: studentMap.get(sm.studentId) || null,
            recipient_student_id: sm.studentId,
            recipient_role: 'student',
            type: (isUpdate ? 'MARKS_UPDATED' : 'MARKS_PUBLISHED') as NotificationType,
            title: isUpdate ? 'Marks Updated' : 'New Marks Published',
            message: `${subjectName} — ${params.sessionalType || 'Sessional'}: ${sm.marksObtained}/${params.maxMarks}`,
            reference_type: 'sessional_mark',
            reference_id: params.sessionalAssessmentId || null,
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        if (notifRows.length > 0) {
          await supabase.from('notifications').insert(notifRows);
        }
      }
    } catch (notifErr) {
      console.warn('Notice: Background notification dispatch for marks:', notifErr);
    }

    return upsertResult.data as SessionalMark[];
  },

  async fetchSectionStudents(sectionId: string, activeOnly = false): Promise<Student[]> {
    return this.fetchStudentsBySection(sectionId, activeOnly);
  },

  async fetchMarksHistory(params?: {
    entityId?: string;
    entityType?: 'sessional' | 'quiz' | 'assignment';
    studentId?: string;
    subjectId?: string;
  }): Promise<MarksHistory[]> {
    let query = supabase
      .from('marks_history')
      .select('*, student:students(id, roll_number, full_name), subject:subjects(id, subject_name, subject_code)')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (params?.entityId) query = query.eq('entity_id', params.entityId);
    if (params?.entityType) query = query.eq('entity_type', params.entityType);
    if (params?.studentId) query = query.eq('student_id', params.studentId);
    if (params?.subjectId) query = query.eq('subject_id', params.subjectId);

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching marks history:', error.message);
      return [];
    }
    return (data as MarksHistory[]) || [];
  },

  // ==========================================
  // REAL-TIME SERVER-SIDE COUNT HELPERS
  // ==========================================
  async getStudentCount(filters?: { departmentId?: string; yearId?: string; sectionId?: string; activeOnly?: boolean }): Promise<number> {
    let query = supabase.from('students').select('id', { count: 'exact', head: true });
    if (filters?.activeOnly !== false) query = query.eq('active', true);
    if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
    if (filters?.yearId) query = query.eq('academic_year_id', filters.yearId);
    if (filters?.sectionId) query = query.eq('section_id', filters.sectionId);
    const { count, error } = await query;
    if (error) {
      console.warn('Error fetching student count:', error.message);
      return 0;
    }
    return count || 0;
  },

  async getFacultyCount(filters?: { departmentId?: string; activeOnly?: boolean }): Promise<number> {
    let query = supabase.from('faculty').select('id', { count: 'exact', head: true });
    if (filters?.activeOnly !== false) query = query.eq('active', true);
    if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
    const { count, error } = await query;
    if (error) {
      console.warn('Error fetching faculty count:', error.message);
      return 0;
    }
    return count || 0;
  },

  async getTimetableCount(filters?: { sectionId?: string; dayOfWeek?: DayOfWeek; activeOnly?: boolean }): Promise<number> {
    let query = supabase.from('timetable_entries').select('id', { count: 'exact', head: true });
    if (filters?.activeOnly !== false) query = query.eq('active', true);
    if (filters?.sectionId) query = query.eq('section_id', filters.sectionId);
    if (filters?.dayOfWeek) query = query.eq('day_of_week', filters.dayOfWeek);
    const { count, error } = await query;
    if (error) {
      console.warn('Error fetching timetable count:', error.message);
      return 0;
    }
    return count || 0;
  },

  async getInstitutionKPIs() {
    const [studentsRes, facultyRes, deptsRes, subjectsRes, sectionsRes, timetableRes] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('faculty').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('departments').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('sections').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('timetable_entries').select('id', { count: 'exact', head: true }).eq('active', true),
    ]);
    return {
      totalStudents: studentsRes.count || 0,
      totalFaculty: facultyRes.count || 0,
      totalDepartments: deptsRes.count || 0,
      totalSubjects: subjectsRes.count || 0,
      totalSections: sectionsRes.count || 0,
      totalTimetableEntries: timetableRes.count || 0,
    };
  },

  // 12. Super Admin Account Directory & Management
  async fetchAdminAccounts(): Promise<AdminAccountDirectoryEntry[]> {
    try {
      const currentUser = erpStorage.getCurrentSessionUser();
      // Strictly restrict RPC to super_admin to prevent 400 Bad Request / permission errors for non-admins
      if (!currentUser || currentUser.role !== 'super_admin') {
        return [];
      }

      const { data, error } = await supabase.rpc('get_admin_account_directory');
      if (error) {
        console.warn('RPC get_admin_account_directory failed, falling back to manual join:', error.message);
        const [profilesRes, facultyRes, studentsRes, deptsRes, sectionsRes, yearsRes] = await Promise.all([
          supabase.from('profiles').select('*').order('full_name', { ascending: true }),
          supabase.from('faculty').select('*'),
          supabase.from('students').select('*'),
          supabase.from('departments').select('*'),
          supabase.from('sections').select('*'),
          supabase.from('academic_years').select('*'),
        ]);

        const facultyMap = new Map((facultyRes.data || []).map(f => [f.auth_user_id || f.id, f]));
        const studentMap = new Map((studentsRes.data || []).map(s => [s.auth_user_id || s.id, s]));
        const deptMap = new Map((deptsRes.data || []).map(d => [d.id, d]));
        const sectionMap = new Map((sectionsRes.data || []).map(s => [s.id, s]));
        const yearMap = new Map((yearsRes.data || []).map(y => [y.id, y]));

        return (profilesRes.data || []).map(p => {
          const fac = facultyMap.get(p.id) || (p.faculty_id ? (facultyRes.data || []).find(f => f.id === p.faculty_id) : undefined);
          const stu = studentMap.get(p.id) || (p.student_id ? (studentsRes.data || []).find(s => s.id === p.student_id) : undefined);
          const dept = fac?.department_id ? deptMap.get(fac.department_id) : (stu?.department_id ? deptMap.get(stu.department_id) : undefined);
          const sec = stu?.section_id ? sectionMap.get(stu.section_id) : undefined;
          const yr = stu?.academic_year_id ? yearMap.get(stu.academic_year_id) : undefined;

          return {
            user_id: p.id,
            email: p.email,
            role: p.role,
            full_name: p.full_name,
            status: (p.status || 'ACTIVE') as AccountStatus,
            last_sign_in_at: p.last_sign_in_at || null,
            department_id: dept?.id || null,
            department_name: dept?.name || null,
            department_code: dept?.code || null,
            employee_code: fac?.employee_code || fac?.faculty_code || null,
            designation: fac?.designation || null,
            roll_number: stu?.roll_number || null,
            year_number: yr?.year_number || null,
            academic_year_name: yr?.name || null,
            section_name: sec?.name || null,
            section_id: sec?.id || null,
            created_at: p.created_at || new Date().toISOString(),
          };
        });
      }

      return ((data as any[]) || []).map(r => ({
        ...r,
        user_id: r.auth_user_id || r.id,
      })) as AdminAccountDirectoryEntry[];
    } catch (err) {
      console.error('Error in fetchAdminAccounts:', err);
      return [];
    }
  },

  async updateAccountStatus(
    targetUserId: string,
    targetStatus: AccountStatus,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('update_account_status', {
        p_target_user_id: targetUserId,
        p_target_status: targetStatus,
        p_actor_id: actorId || null,
        p_actor_name: actorName || 'Super Admin',
        p_actor_role: actorRole || 'super_admin',
        p_reason: reason || null,
      });

      if (error) {
        console.warn('RPC update_account_status returned error, using fallback updates:', error.message);
        const isActive = targetStatus === 'ACTIVE';
        await Promise.all([
          supabase.from('profiles').update({ status: targetStatus }).eq('id', targetUserId),
          supabase.from('faculty').update({ status: targetStatus, active: isActive }).eq('auth_user_id', targetUserId),
          supabase.from('students').update({ status: targetStatus, active: isActive }).eq('auth_user_id', targetUserId),
        ]);

        const actionName = targetStatus === 'BLOCKED' ? 'ACCOUNT_BLOCKED' : targetStatus === 'ARCHIVED' ? 'ACCOUNT_ARCHIVED' : 'ACCOUNT_UNBLOCKED';
        await supabase.from('audit_logs').insert([{
          actor_id: actorId || null,
          actor_name: actorName || 'Super Admin',
          actor_role: actorRole || 'super_admin',
          action: actionName,
          entity_type: 'USER_ACCOUNT',
          entity_id: targetUserId,
          new_values: { status: targetStatus, reason: reason || null },
          created_at: new Date().toISOString(),
        }]);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error updating account status:', err);
      return { success: false, error: err?.message || 'Failed to update account status' };
    }
  },

  async requestPasswordReset(
    email: string,
    targetUserId?: string,
    actorName?: string,
    actorRole?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // STRICT SECURITY POLICY: Students cannot reset passwords directly or receive email reset links.
      if (cleanEmail.includes('@student.')) {
        return {
          success: false,
          error: 'For security reasons, students cannot reset their password directly. Please contact your Super Admin / College Administrator to reset your account password.'
        };
      }

      if (targetUserId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, student_id')
          .eq('id', targetUserId)
          .maybeSingle();

        if (prof && (prof.role === 'student' || prof.student_id)) {
          return {
            success: false,
            error: 'For security reasons, students cannot reset their password directly. Please contact your Super Admin / College Administrator to reset your account password.'
          };
        }
      }

      const { data: student } = await supabase
        .from('students')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (student) {
        return {
          success: false,
          error: 'For security reasons, students cannot reset their password directly. Please contact your Super Admin / College Administrator to reset your account password.'
        };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
      });

      // Record audit log for password reset request (never store or log any passwords)
      await supabase.from('audit_logs').insert([{
        actor_name: actorName || 'Super Admin',
        actor_role: actorRole || 'super_admin',
        action: 'PASSWORD_RESET_REQUESTED',
        entity_type: 'USER_ACCOUNT',
        entity_id: targetUserId || null,
        new_values: { email: cleanEmail, requested_at: new Date().toISOString() },
        created_at: new Date().toISOString(),
      }]);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error requesting password reset:', err);
      return { success: false, error: err?.message || 'Failed to send password reset instructions' };
    }
  },

  async adminUpdateAccountCredentials(params: {
    targetUserId: string;
    email?: string;
    password?: string;
    isDefaultPassword?: boolean;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const {
      targetUserId,
      email,
      password,
      isDefaultPassword = false,
      actorId,
      actorName = 'Super Admin',
      actorRole = 'super_admin',
    } = params;

    try {
      // 1. Try server-side endpoint first (/api/auth/update-credentials)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      let apiSuccess = false;
      let apiResult: any = null;

      if (token) {
        try {
          const response = await fetch('/api/auth/update-credentials', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              target_user_id: targetUserId,
              email: email?.trim() || undefined,
              password: password?.trim() || undefined,
              is_default_password: Boolean(isDefaultPassword),
            }),
          });

          if (response.ok) {
            const json = await response.json();
            if (json.success) {
              apiSuccess = true;
              apiResult = json.data;
            } else {
              return { success: false, error: json.error || 'Failed to update credentials via API.' };
            }
          }
        } catch (apiFetchErr) {
          // If fetch fails (e.g. non-browser test runner or network error), fallback to direct RPC
          console.warn('Endpoint /api/auth/update-credentials not reachable, falling back to direct RPC:', apiFetchErr);
        }
      }

      // 2. Direct RPC fallback using authenticated Super Admin session
      if (!apiSuccess) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_update_account_credentials', {
          p_target_user_id: targetUserId,
          p_new_email: email?.trim() ? email.trim().toLowerCase() : null,
          p_new_password: password?.trim() ? password.trim() : null,
          p_is_default_password: Boolean(isDefaultPassword),
          p_actor_id: actorId || null,
          p_actor_name: actorName,
          p_actor_role: actorRole,
        });

        if (rpcErr) {
          return { success: false, error: rpcErr.message };
        }
        apiResult = rpcData;
      }

      this.invalidateMasterCache();
      return { success: true, data: apiResult };
    } catch (err: any) {
      console.error('Error updating account credentials:', err);
      return { success: false, error: err?.message || 'Failed to update account credentials.' };
    }
  },

  async recordAuditLog(entry: {
    actor_id?: string;
    actor_name?: string;
    actor_role?: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    old_values?: Record<string, any>;
    new_values?: Record<string, any>;
    created_at?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('audit_logs').insert([{
        ...entry,
        created_at: entry.created_at || new Date().toISOString(),
      }]);
      if (error) {
        console.warn('Could not record audit log:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.warn('Exception recording audit log:', err);
      return { success: false, error: err?.message };
    }
  },

  // 13. Class Coordinator Relational Management (Migration 017 & 038)
  async fetchClassCoordinatorAssignments(facultyId?: string): Promise<ClassCoordinatorAssignment[]> {
    try {
      let q = supabase
        .from('class_coordinator_assignments')
        .select(`
          id,
          faculty_id,
          section_id,
          academic_session_id,
          academic_year_id,
          assigned_by,
          active,
          created_at,
          updated_at,
          faculty:faculty(*),
          section:sections(
            id,
            name,
            room_number,
            active,
            semester:semesters(
              id,
              name,
              semester_number,
              academic_year:academic_years(
                id,
                name,
                year_number
              )
            )
          ),
          academic_session:academic_sessions(*),
          academic_year:academic_years(*)
        `)
        .eq('active', true);

      if (facultyId) {
        q = q.eq('faculty_id', facultyId);
      }

      const { data, error } = await q;
      if (error) {
        console.warn('Error fetching from class_coordinator_assignments, falling back to sections:', error.message);
        let secQ = supabase
          .from('sections')
          .select(`
            id,
            name,
            room_number,
            class_coordinator_id,
            active,
            class_coordinator:faculty(*),
            semester:semesters(
              id,
              name,
              semester_number,
              academic_year:academic_years(
                id,
                name,
                year_number
              )
            )
          `)
          .eq('active', true);

        if (facultyId) {
          secQ = secQ.eq('class_coordinator_id', facultyId);
        } else {
          secQ = secQ.not('class_coordinator_id', 'is', null);
        }

        const { data: secData } = await secQ;
        return (secData || []).map((sec: any) => ({
          id: `legacy-${sec.id}`,
          faculty_id: sec.class_coordinator_id,
          section_id: sec.id,
          active: true,
          faculty: sec.class_coordinator,
          section: sec,
          academic_year: sec.semester?.academic_year,
          academic_year_id: sec.semester?.academic_year?.id,
        }));
      }

      return (data as any[]) || [];
    } catch (err) {
      console.error('Error in fetchClassCoordinatorAssignments:', err);
      return [];
    }
  },

  async assignClassCoordinator(
    facultyId: string, 
    sectionId: string, 
    sessionId?: string,
    assignedBy?: string
  ): Promise<{ success: boolean; error?: string; replacedFacultyId?: string; replacedFacultyName?: string }> {
    try {
      let effectiveSessionId = sessionId;
      if (!effectiveSessionId) {
        const { data: session } = await supabase.from('academic_sessions').select('id').eq('is_current', true).maybeSingle();
        effectiveSessionId = session?.id;
      }

      // Try Atomic RPC first (Migration 038)
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('assign_class_coordinator_atomic', {
        p_faculty_id: facultyId,
        p_section_id: sectionId,
        p_academic_session_id: effectiveSessionId || null,
        p_assigned_by: assignedBy || null,
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        this.invalidateMasterCache();
        return { 
          success: true, 
          replacedFacultyId: rpcRes.replaced_faculty_id,
          replacedFacultyName: rpcRes.replaced_faculty_name
        };
      }

      if (rpcErr) {
        console.warn('assign_class_coordinator_atomic RPC fallback:', rpcErr.message);
      }

      // Fallback Direct Mutation
      // Deactivate any existing active coordinator for this section and session if different faculty
      await supabase
        .from('class_coordinator_assignments')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('section_id', sectionId)
        .eq('academic_session_id', effectiveSessionId || '')
        .eq('active', true)
        .neq('faculty_id', facultyId);

      const { error: ccaErr } = await supabase
        .from('class_coordinator_assignments')
        .upsert({
          faculty_id: facultyId,
          section_id: sectionId,
          academic_session_id: effectiveSessionId || null,
          assigned_by: assignedBy || null,
          active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'section_id,academic_session_id'
        });

      if (ccaErr) {
        console.error('Failed to assign in class_coordinator_assignments:', ccaErr.message);
        return { success: false, error: ccaErr.message };
      }

      await supabase
        .from('sections')
        .update({ class_coordinator_id: facultyId, updated_at: new Date().toISOString() })
        .eq('id', sectionId);

      this.invalidateMasterCache();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to assign class coordinator.' };
    }
  },

  async removeClassCoordinator(facultyId: string, sectionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try Atomic RPC first (Migration 038)
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('remove_class_coordinator_atomic', {
        p_faculty_id: facultyId,
        p_section_id: sectionId,
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        this.invalidateMasterCache();
        return { success: true };
      }

      if (rpcErr) {
        console.warn('remove_class_coordinator_atomic RPC fallback:', rpcErr.message);
      }

      // Fallback Direct Mutation
      const { error } = await supabase
        .from('class_coordinator_assignments')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('faculty_id', facultyId)
        .eq('section_id', sectionId);

      if (error) {
        console.error('Failed to remove class coordinator assignment:', error.message);
        return { success: false, error: error.message };
      }

      await supabase
        .from('sections')
        .update({ class_coordinator_id: null, updated_at: new Date().toISOString() })
        .eq('id', sectionId)
        .eq('class_coordinator_id', facultyId);

      this.invalidateMasterCache();
      return { success: true };
    } catch (err: any) {
      console.error('Error removing class coordinator:', err);
      return { success: false, error: err?.message || 'Failed to remove class coordinator.' };
    }
  },

  // 14. Scoped Fast Faculty Dashboard Query (Parallel, <100ms, Single Source of Truth)
  async fetchFacultyDashboardData(facultyId: string): Promise<FacultyDashboardPayload | null> {
    try {
      if (!facultyId) return null;

      const todayDay = getISTDayOfWeek();

      // Parallel Step 1: Core faculty identity, assignments, timetable, and coordinators
      const [
        facultyRes,
        assignmentsRes,
        coordRes,
        timetableRes,
        correctionsRes
      ] = await Promise.all([
        supabase.from('faculty').select('*').eq('id', facultyId).maybeSingle(),
        supabase.from('faculty_subject_assignments').select('*, section:sections(*), subject:subjects(*), academic_year:academic_years(*)').eq('faculty_id', facultyId).eq('active', true),
        this.fetchClassCoordinatorAssignments(facultyId),
        supabase.from('timetable_entries').select('*, section:sections(*), subject:subjects(*), classroom:classrooms(*)').eq('faculty_id', facultyId).eq('active', true).order('period_number', { ascending: true }),
        supabase
          .from('attendance_corrections')
          .select(`
            *,
            student:students(*),
            record:attendance_records(
              *,
              session:attendance_sessions(
                *,
                subject:subjects(*),
                section:sections(*),
                faculty:faculty(*)
              )
            )
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      ]);

      const facultyMember = facultyRes.data;
      if (!facultyMember) return null;

      if (facultyMember.department_id) {
        const { data: deptData } = await supabase.from('departments').select('*').eq('id', facultyMember.department_id).maybeSingle();
        (facultyMember as any).department = deptData;
      }

      const rawAssignments = (assignmentsRes.data || []) as FacultySubjectAssignment[];
      const coordAssignments = coordRes;
      const rawTimetable = (timetableRes.data || []) as TimetableEntry[];
      const rawCorrections = (correctionsRes.data || []) as AttendanceCorrection[];

      // Scope pending corrections strictly to this faculty member's teaching responsibility (session faculty or assigned subject & section)
      const pendingCorrections = rawCorrections.filter(c => {
        const session = (c as any).record?.session;
        if (!session) return false;
        if (session.faculty_id === facultyId) return true;
        const isAssigned = rawAssignments.some(
          a => a.section_id === session.section_id && a.subject_id === session.subject_id
        );
        if (isAssigned) return true;
        return false;
      });

      // Filter out break entries and entries without subject
      const facultyTimetable = rawTimetable.filter(t => !t.is_break && t.subject_id);

      // Collect distinct section IDs (teaching + coordinator)
      const sectionIdSet = new Set<string>();
      facultyTimetable.forEach(t => { if (t.section_id) sectionIdSet.add(t.section_id); });
      rawAssignments.forEach(a => { if (a.section_id) sectionIdSet.add(a.section_id); });
      coordAssignments.forEach(c => { if (c.section_id) sectionIdSet.add(c.section_id); });
      const distinctSectionIds = Array.from(sectionIdSet);

      // Parallel Step 2: Hydrate full section hierarchies, student counts, and weekly attendance sessions
      const [sectionsRes, studentCountsRes, attendanceSessionsRes] = await Promise.all([
        distinctSectionIds.length > 0
          ? supabase
              .from('sections')
              .select(`
                id,
                name,
                room_number,
                active,
                semester_id,
                semester:semesters(
                  id,
                  name,
                  semester_number,
                  academic_year:academic_years(
                    id,
                    name,
                    year_number
                  )
                )
              `)
              .in('id', distinctSectionIds)
              .eq('active', true)
          : Promise.resolve({ data: [] }),
        distinctSectionIds.length > 0
          ? supabase
              .from('students')
              .select('section_id')
              .in('section_id', distinctSectionIds)
              .eq('active', true)
          : Promise.resolve({ data: [] }),
        supabase
          .from('attendance_sessions')
          .select('*')
          .eq('faculty_id', facultyId)
          .order('session_date', { ascending: false })
          .limit(100)
      ]);

      const rawSections = (sectionsRes.data || []) as any[];
      const rawStudents = (studentCountsRes.data || []) as any[];
      const attendanceSessions = (attendanceSessionsRes.data || []) as AttendanceSession[];

      // Build section student counts map
      const studentCountMap = new Map<string, number>();
      rawStudents.forEach(s => {
        if (s.section_id) {
          studentCountMap.set(s.section_id, (studentCountMap.get(s.section_id) || 0) + 1);
        }
      });

      // Filter sections: strictly exclude 1st Year (year_number === 1)
      const enrichedSections = rawSections
        .map(sec => {
          const sem = sec.semester;
          const yr = sem?.academic_year;
          if (yr?.year_number === 1) return null;

          const cleanSecName = (sec.name || '').replace(/^section\s*/i, '').trim();
          const rawRoom = sec.room_number || '';
          const cleanRoom = rawRoom ? rawRoom.replace(/^Room\s*(No\.?\s*)?/i, '').trim() : 'Room TBD';

          // Subjects taught in this section by this faculty
          const fromTtSubs = facultyTimetable.filter(t => t.section_id === sec.id).map(t => (t as any).subject).filter(Boolean);
          const fromAsgnSubs = rawAssignments.filter(a => a.section_id === sec.id).map(a => a.subject).filter(Boolean);
          const subMap = new Map<string, Subject>();
          [...fromTtSubs, ...fromAsgnSubs].forEach((s: any) => {
            if (s && s.id) subMap.set(s.id, s);
          });

          return {
            sec: {
              id: sec.id,
              name: sec.name,
              room_number: sec.room_number,
              semester_id: sec.semester_id,
              active: sec.active,
            } as Section,
            sem,
            year: yr,
            yearName: yr?.name || 'Academic Year',
            yearNumber: yr?.year_number || 0,
            cleanSecName,
            cleanRoom: cleanRoom || 'Room TBD',
            studentCount: studentCountMap.get(sec.id) || 0,
            subjectsInSec: Array.from(subMap.values()),
          };
        })
        .filter(Boolean) as Array<{
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

      // Extract all distinct subjects for this faculty
      const subjectMap = new Map<string, Subject>();
      facultyTimetable.forEach(t => {
        const sub = (t as any).subject;
        if (sub && sub.id) subjectMap.set(sub.id, sub);
      });
      rawAssignments.forEach(a => {
        if (a.subject && a.subject.id) subjectMap.set(a.subject.id, a.subject);
      });
      const allSubjects = Array.from(subjectMap.values());

      // Today's schedule sorted by period
      const todaySchedule = todayDay === 'SUN'
        ? []
        : facultyTimetable
            .filter(t => t.day_of_week === todayDay)
            .sort((a, b) => a.period_number - b.period_number);

      return {
        faculty: facultyMember,
        assignments: rawAssignments,
        coordinatorAssignments: coordAssignments.filter(c => {
          const yrNum = (c.section as any)?.semester?.academic_year?.year_number;
          return yrNum !== 1;
        }),
        timetable: facultyTimetable,
        sections: enrichedSections,
        subjects: allSubjects,
        todaySchedule,
        todayClassesCount: todaySchedule.length,
        weeklyLoad: facultyTimetable.length,
        assignedSectionsCount: enrichedSections.length,
        assignedSubjectsCount: allSubjects.length,
        pendingCorrectionsCount: pendingCorrections.length,
        pendingCorrections,
        attendanceSessions
      };
    } catch (err) {
      console.error('Error in fetchFacultyDashboardData:', err);
      return null;
    }
  },

  // ==========================================
  // REAL-TIME NOTIFICATIONS ENGINE
  // ==========================================
  async fetchStudentNotifications(studentId?: string, userId?: string, userRole?: string, facultyId?: string): Promise<StudentNotification[]> {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const conditions: string[] = [];
      if (userId) conditions.push(`recipient_user_id.eq.${userId}`);
      if (studentId) conditions.push(`recipient_student_id.eq.${studentId}`);
      if (facultyId) conditions.push(`recipient_faculty_id.eq.${facultyId}`);
      if (userRole) conditions.push(`recipient_role.eq.${userRole}`);

      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Notice: Error fetching notifications:', error.message);
        return [];
      }
      return (data || []) as StudentNotification[];
    } catch (err) {
      console.warn('Notice: Exception fetching notifications:', err);
      return [];
    }
  },

  async markNotificationAsRead(notificationId: string, facultyId?: string): Promise<void> {
    try {
      if (facultyId) {
        await supabase.rpc('mark_faculty_notification_as_read', {
          p_notification_id: notificationId,
          p_faculty_id: facultyId
        });
      }
      const { error } = await supabase.rpc('mark_notification_as_read', {
        p_notification_id: notificationId,
      });
      if (error) {
        // Fallback to direct update if RPC fails
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', notificationId);
      }
    } catch (err) {
      console.warn('Notice: Error marking notification read:', err);
    }
  },

  async markAllNotificationsAsRead(userId?: string, studentId?: string, userRole?: string, facultyId?: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_as_read');
      if (error && (userId || studentId || userRole || facultyId)) {
        // Fallback to direct update
        let query = supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('is_read', false);

        const conditions: string[] = [];
        if (userId) conditions.push(`recipient_user_id.eq.${userId}`);
        if (studentId) conditions.push(`recipient_student_id.eq.${studentId}`);
        if (facultyId) conditions.push(`recipient_faculty_id.eq.${facultyId}`);
        if (userRole) conditions.push(`recipient_role.eq.${userRole}`);

        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
        }
        await query;
      }
    } catch (err) {
      console.warn('Notice: Error marking all notifications read:', err);
    }
  },

  async createNotifications(notifications: Partial<StudentNotification>[]): Promise<void> {
    if (!notifications || notifications.length === 0) return;
    try {
      const cleanRows = notifications.map(n => ({
        recipient_user_id: n.recipient_user_id || null,
        recipient_student_id: n.recipient_student_id || null,
        recipient_role: n.recipient_role || null,
        type: n.type || 'GENERAL',
        title: n.title,
        message: n.message,
        reference_type: n.reference_type || null,
        reference_id: n.reference_id || null,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('notifications').insert(cleanRows);
    } catch (err) {
      console.warn('Notice: Error inserting notifications:', err);
    }
  },

  // ==========================================
  // REAL-TIME COMMUNICATION CENTER (MESSAGES)
  // ==========================================

  async fetchUserConversations(
    userId: string, 
    role: string,
    profileContext?: { studentId?: string | null; facultyId?: string | null }
  ): Promise<Conversation[]> {
    try {
      let studentId: string | null = profileContext?.studentId || null;
      let facultyId: string | null = profileContext?.facultyId || null;

      if (!studentId && !facultyId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, student_id, faculty_id')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          studentId = profile.student_id || null;
          facultyId = profile.faculty_id || null;
        }

        if (!studentId && role === 'student') {
          const { data: stu } = await supabase
            .from('students')
            .select('id')
            .eq('auth_user_id', userId)
            .maybeSingle();
          if (stu) studentId = stu.id;
        }

        if (!facultyId && role === 'faculty') {
          const { data: fac } = await supabase
            .from('faculty')
            .select('id')
            .eq('auth_user_id', userId)
            .maybeSingle();
          if (fac) facultyId = fac.id;
        }
      }

      let query = supabase
        .from('conversations')
        .select(`
          *,
          student:students(id, full_name, roll_number, section_id, email),
          faculty:faculty(id, full_name, email, designation),
          subject:subjects(id, subject_name, subject_code),
          section:sections(id, name),
          academic_year:academic_years(id, year_number, name)
        `)
        .order('last_message_at', { ascending: false });

      if (role === 'student' && studentId) {
        query = query.eq('student_id', studentId);
      } else if (role === 'faculty' && facultyId) {
        query = query.eq('faculty_id', facultyId);
      } else if (role === 'student' && !studentId) {
        return [];
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching conversations:', error);
        return [];
      }

      const conversations = (data || []) as Conversation[];
      if (conversations.length > 0) {
        const convIds = conversations.map(c => c.id);
        
        // Fetch unread messages count for this user
        const { data: unreadMsgs } = await supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .eq('receiver_user_id', userId)
          .is('read_at', null);

        // Fetch per-user conversation settings (marked_unread, cleared_at)
        const { data: userSettings } = await supabase
          .from('conversation_user_settings')
          .select('*')
          .in('conversation_id', convIds)
          .eq('user_id', userId);

        const settingsMap: Record<string, { marked_unread: boolean; cleared_at?: string | null }> = {};
        if (userSettings) {
          userSettings.forEach((s: any) => {
            settingsMap[s.conversation_id] = {
              marked_unread: Boolean(s.marked_unread),
              cleared_at: s.cleared_at || null,
            };
          });
        }

        const counts: Record<string, number> = {};
        if (unreadMsgs) {
          unreadMsgs.forEach(m => {
            counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
          });
        }

        conversations.forEach(c => {
          const setting = settingsMap[c.id];
          const unreadCount = counts[c.id] || 0;
          c.marked_unread = setting?.marked_unread || false;
          c.unread_count = c.marked_unread ? Math.max(unreadCount, 1) : unreadCount;
        });
      }

      return conversations;
    } catch (err) {
      console.error('Exception in fetchUserConversations:', err);
      return [];
    }
  },

  async fetchConversationMessages(conversationId: string, currentUserId?: string, limit: number = 200): Promise<Message[]> {
    try {
      // Check if user cleared this conversation
      let clearedAt: string | null = null;
      if (currentUserId) {
        const { data: settings } = await supabase
          .from('conversation_user_settings')
          .select('cleared_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (settings && settings.cleared_at) {
          clearedAt = settings.cleared_at;
        }
      }

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          student:student_id(id, full_name, roll_number),
          faculty:faculty_id(id, full_name, faculty_code),
          reply_to:messages!reply_to_message_id(
            id,
            message,
            sender_user_id,
            sender_role,
            is_unsent,
            edited_at,
            student:student_id(id, full_name, roll_number),
            faculty:faculty_id(id, full_name, faculty_code)
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      let messages = ((data || []) as any[]).map(m => {
        let senderName = m.sender_name || '';
        if (!senderName) {
          if (m.sender_role === 'student' && m.student?.full_name) {
            senderName = m.student.full_name;
          } else if ((m.sender_role === 'faculty' || m.sender_role === 'hod') && m.faculty?.full_name) {
            senderName = m.faculty.full_name;
          } else if (m.sender_role === 'super_admin') {
            senderName = 'Administrator';
          }
        }

        let replyTo = m.reply_to;
        if (replyTo) {
          let replySenderName = replyTo.sender_name || '';
          if (!replySenderName) {
            if (replyTo.sender_role === 'student' && replyTo.student?.full_name) {
              replySenderName = replyTo.student.full_name;
            } else if ((replyTo.sender_role === 'faculty' || replyTo.sender_role === 'hod') && replyTo.faculty?.full_name) {
              replySenderName = replyTo.faculty.full_name;
            } else if (replyTo.sender_role === 'super_admin') {
              replySenderName = 'Administrator';
            }
          }
          replyTo = {
            ...replyTo,
            sender_name: replySenderName || undefined,
          };
        }

        return {
          ...m,
          sender_name: senderName || undefined,
          reply_to: replyTo,
        } as Message;
      });

      // Secondary pass: if any message has reply_to_message_id but reply_to is still null,
      // resolve it directly from the conversation messages map
      const msgMap = new Map<string, any>(messages.map(m => [m.id, m]));
      messages = messages.map(m => {
        if (!m.reply_to && m.reply_to_message_id && msgMap.has(m.reply_to_message_id)) {
          const parent = msgMap.get(m.reply_to_message_id);
          return {
            ...m,
            reply_to: {
              id: parent.id,
              message: parent.message,
              sender_user_id: parent.sender_user_id,
              sender_role: parent.sender_role,
              sender_name: parent.sender_name,
              is_unsent: parent.is_unsent,
              edited_at: parent.edited_at,
              student: parent.student,
              faculty: parent.faculty,
            }
          };
        }
        return m;
      });

      // Filter out messages deleted for this user
      if (currentUserId) {
        messages = messages.filter(m => {
          if (m.deleted_by_users && Array.isArray(m.deleted_by_users) && m.deleted_by_users.includes(currentUserId)) {
            return false;
          }
          if (clearedAt && new Date(m.created_at) <= new Date(clearedAt)) {
            return false;
          }
          return true;
        });
      }

      return messages;
    } catch (err) {
      console.error('Exception in fetchConversationMessages:', err);
      return [];
    }
  },

  async getOrCreateConversation(params: {
    facultyId?: string;
    studentId?: string;
    subjectId?: string | null;
    category?: ConversationCategory;
    topic?: string;
  }): Promise<{ data: Conversation | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        p_faculty_id: params.facultyId || null,
        p_subject_id: params.subjectId || null,
        p_category: params.category || 'General',
        p_topic: params.topic || null,
        p_student_id: params.studentId || null,
      });

      if (error) {
        return { data: null, error };
      }

      if (data && data.id) {
        const { data: fullConv, error: fetchErr } = await supabase
          .from('conversations')
          .select(`
            *,
            student:students(id, full_name, roll_number, section_id, email),
            faculty:faculty(id, full_name, email, designation),
            subject:subjects(id, subject_name, subject_code),
            section:sections(id, name),
            academic_year:academic_years(id, year_number, name)
          `)
          .eq('id', data.id)
          .single();

        return { data: (fullConv || data) as Conversation, error: fetchErr };
      }

      return { data: data as Conversation, error: null };
    } catch (err: any) {
      console.error('Exception in getOrCreateConversation:', err);
      return { data: null, error: err };
    }
  },

  async sendMessage(params: {
    conversationId: string;
    message: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
    replyToMessageId?: string | null;
  }): Promise<{ data: Message | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('send_message', {
        p_conversation_id: params.conversationId,
        p_message: params.message,
        p_attachment_url: params.attachmentUrl || null,
        p_attachment_name: params.attachmentName || null,
        p_attachment_type: params.attachmentType || null,
        p_attachment_size: params.attachmentSize || null,
        p_reply_to_message_id: params.replyToMessageId || null,
      });

      if (error) {
        return { data: null, error };
      }

      return { data: data as Message, error: null };
    } catch (err: any) {
      console.error('Exception in sendMessage:', err);
      return { data: null, error: err };
    }
  },

  async editMessage(messageId: string, newContent: string): Promise<{ data: Message | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('edit_message', {
        p_message_id: messageId,
        p_new_content: newContent,
      });

      if (error) {
        console.error('Error in editMessage:', error);
        return { data: null, error };
      }

      return { data: data as Message, error: null };
    } catch (err: any) {
      console.error('Exception in editMessage:', err);
      return { data: null, error: err };
    }
  },

  async unsendMessage(messageId: string): Promise<{ data: Message | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('unsend_message', {
        p_message_id: messageId,
      });

      if (error) {
        console.error('Error in unsendMessage:', error);
        return { data: null, error };
      }

      return { data: data as Message, error: null };
    } catch (err: any) {
      console.error('Exception in unsendMessage:', err);
      return { data: null, error: err };
    }
  },

  async deleteMessageForMe(messageId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { data, error } = await supabase.rpc('delete_message_for_me', {
        p_message_id: messageId,
      });

      if (error) {
        console.error('Error in deleteMessageForMe:', error);
        return { success: false, error };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Exception in deleteMessageForMe:', err);
      return { success: false, error: err };
    }
  },

  async clearConversationForMe(conversationId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { data, error } = await supabase.rpc('clear_conversation_for_me', {
        p_conversation_id: conversationId,
      });

      if (error) {
        console.error('Error in clearConversationForMe:', error);
        return { success: false, error };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Exception in clearConversationForMe:', err);
      return { success: false, error: err };
    }
  },

  async markConversationUnread(conversationId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { data, error } = await supabase.rpc('mark_conversation_unread', {
        p_conversation_id: conversationId,
      });

      if (error) {
        console.error('Error in markConversationUnread:', error);
        return { success: false, error };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Exception in markConversationUnread:', err);
      return { success: false, error: err };
    }
  },

  async markConversationRead(conversationId: string): Promise<void> {
    try {
      await supabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
      });
    } catch (err) {
      console.warn('Error marking conversation read:', err);
    }
  },

  async updateConversationStatus(
    conversationId: string,
    status: ConversationStatus
  ): Promise<{ data: Conversation | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('update_conversation_status', {
        p_conversation_id: conversationId,
        p_status: status,
      });

      if (error) {
        return { data: null, error };
      }

      return { data: data as Conversation, error: null };
    } catch (err: any) {
      console.error('Exception in updateConversationStatus:', err);
      return { data: null, error: err };
    }
  },

  async fetchEligibleFacultyForStudent(studentId: string): Promise<EligibleFacultyForStudent[]> {
    try {
      const { data: student, error: stuErr } = await supabase
        .from('students')
        .select('id, section_id, academic_year_id, sections:section_id(id, name), academic_years:academic_year_id(id, year_number, name)')
        .eq('id', studentId)
        .single();

      if (stuErr || !student || !student.section_id) {
        return [];
      }

      const sectionId = student.section_id;
      const sectionName = (student.sections as any)?.name || 'Section';
      const academicYearId = student.academic_year_id;
      const yearName = (student.academic_years as any)?.name || '';

      const { data: fsaData, error: fsaErr } = await supabase
        .from('faculty_subject_assignments')
        .select(`
          faculty_id,
          subject_id,
          faculty:faculty(id, full_name, email, designation),
          subject:subjects(id, subject_name, subject_code)
        `)
        .eq('section_id', sectionId)
        .eq('active', true);

      const { data: ttData, error: ttErr } = await supabase
        .from('timetable_entries')
        .select(`
          faculty_id,
          subject_id,
          faculty:faculty(id, full_name, email, designation),
          subject:subjects(id, subject_name, subject_code)
        `)
        .eq('section_id', sectionId)
        .eq('active', true);

      const map = new Map<string, EligibleFacultyForStudent>();

      const addEntry = (fac: any, sub: any) => {
        if (!fac || !sub || !fac.id || !sub.id) return;
        const key = `${fac.id}_${sub.id}`;
        if (!map.has(key)) {
          map.set(key, {
            faculty_id: fac.id,
            faculty_name: fac.full_name,
            faculty_email: fac.email,
            faculty_designation: fac.designation,
            subject_id: sub.id,
            subject_name: sub.subject_name,
            subject_code: sub.subject_code,
            section_id: sectionId,
            section_name: sectionName,
            academic_year_id: academicYearId,
            year_name: yearName,
          });
        }
      };

      if (!fsaErr && fsaData) {
        fsaData.forEach((row: any) => addEntry(row.faculty, row.subject));
      }
      if (!ttErr && ttData) {
        ttData.forEach((row: any) => addEntry(row.faculty, row.subject));
      }

      return Array.from(map.values()).sort((a, b) => a.faculty_name.localeCompare(b.faculty_name));
    } catch (err) {
      console.error('Error fetching eligible faculty for student:', err);
      return [];
    }
  },

  async fetchEligibleStudentsForFaculty(facultyId: string): Promise<EligibleStudentForFaculty[]> {
    try {
      const { data: fsaData } = await supabase
        .from('faculty_subject_assignments')
        .select('section_id, subject_id, section:sections(id, name, semester_id, semesters:semester_id(academic_year_id, academic_years:academic_year_id(id, name))), subject:subjects(id, subject_name, subject_code)')
        .eq('faculty_id', facultyId)
        .eq('active', true);

      const { data: ttData } = await supabase
        .from('timetable_entries')
        .select('section_id, subject_id, section:sections(id, name, semester_id, semesters:semester_id(academic_year_id, academic_years:academic_year_id(id, name))), subject:subjects(id, subject_name, subject_code)')
        .eq('faculty_id', facultyId)
        .eq('active', true);

      const { data: coordData } = await supabase
        .from('sections')
        .select('id, name, semester_id, semesters:semester_id(academic_year_id, academic_years:academic_year_id(id, name))')
        .eq('class_coordinator_id', facultyId);

      const sectionSubjectPairs = new Map<string, { sectionId: string; sectionName: string; subjectId: string; subjectName: string; subjectCode: string; academicYearId: string; yearName: string }>();

      const registerPair = (item: any) => {
        if (!item?.section_id || !item?.subject_id) return;
        const key = `${item.section_id}_${item.subject_id}`;
        if (!sectionSubjectPairs.has(key)) {
          const sec = item.section;
          const sub = item.subject;
          const year = sec?.semesters?.academic_years;
          sectionSubjectPairs.set(key, {
            sectionId: item.section_id,
            sectionName: sec?.name || 'Section',
            subjectId: item.subject_id,
            subjectName: sub?.subject_name || 'Subject',
            subjectCode: sub?.subject_code || '',
            academicYearId: year?.id || '',
            yearName: year?.name || '',
          });
        }
      };

      if (fsaData) fsaData.forEach(registerPair);
      if (ttData) ttData.forEach(registerPair);

      const coordSectionMap = new Map<string, { sectionName: string; academicYearId: string; yearName: string }>();
      (coordData || []).forEach((cs: any) => {
        const sem = Array.isArray(cs.semesters) ? cs.semesters[0] : cs.semesters;
        const year = Array.isArray(sem?.academic_years) ? sem.academic_years[0] : sem?.academic_years;
        coordSectionMap.set(cs.id, {
          sectionName: cs.name || 'Section',
          academicYearId: year?.id || '',
          yearName: year?.name || '',
        });
      });

      const pairs = Array.from(sectionSubjectPairs.values());
      const sectionIds = Array.from(new Set([...pairs.map(p => p.sectionId), ...Array.from(coordSectionMap.keys())]));
      if (sectionIds.length === 0) return [];

      const { data: students, error: stuErr } = await supabase
        .from('students')
        .select('id, full_name, roll_number, section_id, academic_year_id')
        .in('section_id', sectionIds)
        .eq('active', true)
        .order('full_name', { ascending: true });

      if (stuErr || !students) return [];

      const results: EligibleStudentForFaculty[] = [];

      for (const stu of students) {
        const matchingPairs = pairs.filter(p => p.sectionId === stu.section_id);
        const coordInfo = coordSectionMap.get(stu.section_id);
        const firstPair = matchingPairs[0];

        const studentSubjects = matchingPairs.map(p => ({
          id: p.subjectId,
          name: p.subjectName,
          code: p.subjectCode,
        }));

        results.push({
          student_id: stu.id,
          student_name: stu.full_name,
          roll_number: stu.roll_number,
          admission_number: stu.roll_number,
          section_id: stu.section_id,
          section_name: firstPair?.sectionName || coordInfo?.sectionName || 'Section',
          subject_id: firstPair?.subjectId || '',
          subject_name: firstPair?.subjectName || '',
          subject_code: firstPair?.subjectCode || '',
          academic_year_id: stu.academic_year_id || firstPair?.academicYearId || coordInfo?.academicYearId || '',
          year_name: firstPair?.yearName || coordInfo?.yearName || '',
          subjects: studentSubjects,
        });
      }

      return results;
    } catch (err) {
      console.error('Error fetching eligible students for faculty:', err);
      return [];
    }
  },

  // ============================================================================
  // LEAVE APPLICATION WORKFLOW METHODS
  // ============================================================================

  async fetchStudentLeaveApplications(studentId?: string): Promise<LeaveApplication[]> {
    try {
      let q = supabase
        .from('leave_applications')
        .select(`
          *,
          student:students(id, full_name, roll_number, email, phone, section_id),
          department:departments(id, name, code),
          academic_year:academic_years(id, year_number, name),
          section:sections(id, name),
          coordinator:coordinator_id(id, full_name, designation, email),
          hod:hod_id(id, full_name, designation, email),
          coordinator_approver:coordinator_approved_by(id, full_name, designation),
          hod_approver:hod_approved_by(id, full_name, designation),
          rejecter:rejected_by(id, full_name, designation)
        `)
        .order('created_at', { ascending: false });

      if (studentId) {
        q = q.eq('student_id', studentId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LeaveApplication[];
    } catch (err) {
      console.error('Error fetching student leave applications:', err);
      return [];
    }
  },

  async fetchCoordinatorLeaveApplications(facultyId?: string): Promise<LeaveApplication[]> {
    try {
      let q = supabase
        .from('leave_applications')
        .select(`
          *,
          student:students(id, full_name, roll_number, email, phone, section_id),
          department:departments(id, name, code),
          academic_year:academic_years(id, year_number, name),
          section:sections(id, name),
          coordinator:coordinator_id(id, full_name, designation, email),
          hod:hod_id(id, full_name, designation, email),
          coordinator_approver:coordinator_approved_by(id, full_name, designation),
          hod_approver:hod_approved_by(id, full_name, designation),
          rejecter:rejected_by(id, full_name, designation)
        `)
        .order('created_at', { ascending: false });

      if (facultyId) {
        // Find coordinated sections
        const { data: cca } = await supabase
          .from('class_coordinator_assignments')
          .select('section_id')
          .eq('faculty_id', facultyId)
          .eq('active', true);

        const { data: sec } = await supabase
          .from('sections')
          .select('id')
          .eq('class_coordinator_id', facultyId);

        const secIds = Array.from(new Set([
          ...(cca || []).map(c => c.section_id),
          ...(sec || []).map(s => s.id)
        ])).filter(Boolean);

        if (secIds.length > 0) {
          q = q.or(`coordinator_id.eq.${facultyId},section_id.in.(${secIds.join(',')})`);
        } else {
          q = q.eq('coordinator_id', facultyId);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LeaveApplication[];
    } catch (err) {
      console.error('Error fetching coordinator leave applications:', err);
      return [];
    }
  },

  async fetchHODLeaveApplications(departmentId?: string): Promise<LeaveApplication[]> {
    try {
      let q = supabase
        .from('leave_applications')
        .select(`
          *,
          student:students(id, full_name, roll_number, email, phone, section_id),
          department:departments(id, name, code),
          academic_year:academic_years(id, year_number, name),
          section:sections(id, name),
          coordinator:coordinator_id(id, full_name, designation, email),
          hod:hod_id(id, full_name, designation, email),
          coordinator_approver:coordinator_approved_by(id, full_name, designation),
          hod_approver:hod_approved_by(id, full_name, designation),
          rejecter:rejected_by(id, full_name, designation)
        `)
        .order('created_at', { ascending: false });

      if (departmentId) {
        q = q.eq('department_id', departmentId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LeaveApplication[];
    } catch (err) {
      console.error('Error fetching HOD leave applications:', err);
      return [];
    }
  },

  async submitLeaveApplication(params: {
    leaveType: string;
    fromDate: string;
    toDate: string;
    numberOfDays: number;
    reason: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
  }): Promise<{ success: boolean; data?: LeaveApplication; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('submit_leave_application', {
        p_leave_type: params.leaveType,
        p_from_date: params.fromDate,
        p_to_date: params.toDate,
        p_number_of_days: params.numberOfDays,
        p_reason: params.reason,
        p_attachment_url: params.attachmentUrl || null,
        p_attachment_name: params.attachmentName || null
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as LeaveApplication };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to submit leave application' };
    }
  },

  async coordinatorReviewLeave(params: {
    applicationId: string;
    action: 'APPROVE' | 'REJECT';
    remarks?: string;
  }): Promise<{ success: boolean; data?: LeaveApplication; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('coordinator_review_leave', {
        p_application_id: params.applicationId,
        p_action: params.action,
        p_remarks: params.remarks || null
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as LeaveApplication };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to review leave application' };
    }
  },

  async hodReviewLeave(params: {
    applicationId: string;
    action: 'APPROVE' | 'REJECT';
    remarks?: string;
  }): Promise<{ success: boolean; data?: LeaveApplication; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('hod_review_leave', {
        p_application_id: params.applicationId,
        p_action: params.action,
        p_remarks: params.remarks || null
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as LeaveApplication };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to review leave application' };
    }
  },

  async fetchLeaveAuditLogs(applicationId: string): Promise<LeaveApprovalAuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('leave_approval_audit_logs')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as LeaveApprovalAuditLog[];
    } catch (err) {
      console.error('Error fetching leave audit logs:', err);
      return [];
    }
  },

  async resolveStudentCoordinatorAndHOD(studentId: string): Promise<{
    coordinator?: { id: string; name: string; designation?: string; email?: string } | null;
    hod?: { id: string; name: string; designation?: string; email?: string } | null;
    sectionName?: string;
    yearName?: string;
    departmentName?: string;
  }> {
    try {
      const { data: student } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          section_id,
          department_id,
          academic_year_id,
          section:sections(id, name, class_coordinator_id, class_coordinator:class_coordinator_id(id, full_name, designation, email)),
          department:departments(id, name, hod_faculty_id, hod:hod_faculty_id(id, full_name, designation, email)),
          academic_year:academic_years(id, year_number, name)
        `)
        .eq('id', studentId)
        .maybeSingle();

      if (!student) return {};

      // Check CCA table for coordinator
      let coord = (student.section as any)?.class_coordinator;
      if (!coord && student.section_id) {
        const { data: cca } = await supabase
          .from('class_coordinator_assignments')
          .select('faculty:faculty(id, full_name, designation, email)')
          .eq('section_id', student.section_id)
          .eq('active', true)
          .maybeSingle();

        if (cca?.faculty) {
          coord = cca.faculty;
        }
      }

      const hod = (student.department as any)?.hod;

      return {
        coordinator: coord ? {
          id: coord.id,
          name: coord.full_name,
          designation: coord.designation,
          email: coord.email
        } : null,
        hod: hod ? {
          id: hod.id,
          name: hod.full_name,
          designation: hod.designation,
          email: hod.email
        } : null,
        sectionName: (student.section as any)?.name,
        yearName: (student.academic_year as any)?.name,
        departmentName: (student.department as any)?.name
      };
    } catch (err) {
      console.error('Error resolving student coordinator and HOD:', err);
      return {};
    }
  },

  // ============================================================================
  // CLASS / SUBJECT GROUP COMMUNICATION METHODS
  // ============================================================================

  async syncAcademicMessageGroups(): Promise<void> {
    try {
      await supabase.rpc('ensure_academic_message_groups');
    } catch (err) {
      console.warn('Could not run ensure_academic_message_groups RPC:', err);
    }
  },

  async fetchUserMessageGroups(
    userId: string, 
    role: string,
    profileContext?: {
      facultyId?: string | null;
      studentSectionId?: string | null;
      studentYearId?: string | null;
      departmentId?: string | null;
    }
  ): Promise<MessageGroup[]> {
    try {
      let facultyId: string | null = profileContext?.facultyId || null;
      let studentSectionId: string | null = profileContext?.studentSectionId || null;
      let studentYearId: string | null = profileContext?.studentYearId || null;
      let departmentId: string | null = profileContext?.departmentId || null;

      if (!facultyId && !studentSectionId && !departmentId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, student_id, faculty_id, department_id')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          facultyId = profile.faculty_id || null;
          departmentId = profile.department_id || null;
        }

        if (role === 'faculty' && !facultyId) {
          const { data: fac } = await supabase
            .from('faculty')
            .select('id')
            .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
            .maybeSingle();
          if (fac) facultyId = fac.id;
        }

        if (role === 'student') {
          const { data: stu } = await supabase
            .from('students')
            .select('id, section_id, academic_year_id')
            .or(`auth_user_id.eq.${userId},id.eq.${profile?.student_id || '00000000-0000-0000-0000-000000000000'}`)
            .limit(1)
            .maybeSingle();
          if (stu) {
            studentSectionId = stu.section_id;
            studentYearId = stu.academic_year_id;
          }
        }
      }

      // Base query for groups
      let query = supabase
        .from('message_groups')
        .select(`
          *,
          subject:subjects(id, subject_name, subject_code),
          section:sections(id, name, room_number),
          academic_year:academic_years(id, year_number, name),
          department:departments(id, name, code)
        `)
        .order('last_message_at', { ascending: false });

      if (role === 'student') {
        if (!studentSectionId || !studentYearId) return [];
        query = query.eq('section_id', studentSectionId).eq('academic_year_id', studentYearId);
      } else if (role === 'hod' && departmentId) {
        query = query.eq('department_id', departmentId);
      }

      const { data: groups, error } = await query;
      if (error || !groups) {
        console.error('Error fetching message groups:', error);
        return [];
      }

      let filteredGroups = groups as MessageGroup[];

      // For faculty, refine by assigned combinations and section-wide announcements
      if (role === 'faculty' && facultyId) {
        const { data: fsaList } = await supabase
          .from('faculty_subject_assignments')
          .select('section_id, subject_id')
          .eq('faculty_id', facultyId)
          .eq('active', true);

        const { data: teList } = await supabase
          .from('timetable_entries')
          .select('section_id, subject_id')
          .eq('faculty_id', facultyId)
          .eq('active', true);

        const { data: coordData } = await supabase
          .from('sections')
          .select('id')
          .eq('class_coordinator_id', facultyId);

        const validPairs = new Set<string>();
        const assignedSectionIds = new Set<string>();

        (fsaList || []).forEach(f => {
          validPairs.add(`${f.section_id}_${f.subject_id}`);
          assignedSectionIds.add(f.section_id);
        });
        (teList || []).forEach(t => {
          if (t.section_id && t.subject_id) {
            validPairs.add(`${t.section_id}_${t.subject_id}`);
            assignedSectionIds.add(t.section_id);
          }
        });
        (coordData || []).forEach(c => assignedSectionIds.add(c.id));

        filteredGroups = filteredGroups.filter(g => {
          if (g.subject_id) {
            return validPairs.has(`${g.section_id}_${g.subject_id}`);
          }
          // Section-wide announcement: accessible if faculty teaches in section or is coordinator
          return assignedSectionIds.has(g.section_id);
        });
      }

      if (filteredGroups.length === 0) return [];

      const groupIds = filteredGroups.map(g => g.id);
      const relevantSectionIds = Array.from(new Set(filteredGroups.map(g => g.section_id)));

      // Fetch member counts (distinct active students per section & year)
      const { data: studentCounts } = await supabase
        .from('students')
        .select('id, section_id, academic_year_id')
        .in('section_id', relevantSectionIds)
        .eq('active', true)
        .or('status.eq.ACTIVE,status.is.null');

      const countMap: Record<string, number> = {};
      const seenStudents = new Set<string>();
      (studentCounts || []).forEach(s => {
        if (!seenStudents.has(s.id)) {
          seenStudents.add(s.id);
          const key = `${s.section_id}_${s.academic_year_id}`;
          countMap[key] = (countMap[key] || 0) + 1;
        }
      });

      // Fetch user's read state for these groups
      const { data: readStates } = await supabase
        .from('group_member_read_state')
        .select('group_id, last_read_at')
        .eq('user_id', userId)
        .in('group_id', groupIds);

      const readMap: Record<string, string> = {};
      (readStates || []).forEach(r => {
        readMap[r.group_id] = r.last_read_at;
      });

      // Fetch unread message counts
      const { data: allMessages } = await supabase
        .from('group_messages')
        .select('id, group_id, created_at, sender_user_id')
        .in('group_id', groupIds)
        .neq('sender_user_id', userId);

      const unreadCountMap: Record<string, number> = {};
      (allMessages || []).forEach(m => {
        const lastRead = readMap[m.group_id] ? new Date(readMap[m.group_id]).getTime() : 0;
        const msgTime = new Date(m.created_at).getTime();
        if (msgTime > lastRead) {
          unreadCountMap[m.group_id] = (unreadCountMap[m.group_id] || 0) + 1;
        }
      });

      // Fetch faculty assigned for each group (to display assigned faculty name to students)
      const { data: fsaAssignments } = await supabase
        .from('faculty_subject_assignments')
        .select('section_id, subject_id, faculty:faculty(id, full_name, designation, email)')
        .in('section_id', relevantSectionIds)
        .eq('active', true);

      const facultyMap: Record<string, any> = {};
      (fsaAssignments || []).forEach((f: any) => {
        const key = `${f.section_id}_${f.subject_id}`;
        if (f.faculty && !facultyMap[key]) {
          facultyMap[key] = f.faculty;
        }
      });

      return filteredGroups.map(g => {
        const countKey = `${g.section_id}_${g.academic_year_id}`;
        const facKey = `${g.section_id}_${g.subject_id}`;
        const subName = (g.subject as any)?.subject_name || (g.subject as any)?.name || '';
        const subCode = (g.subject as any)?.subject_code || (g.subject as any)?.code || '';
        const displayName = subName 
          ? `${subName} • Sec ${g.section?.name || ''}`
          : `Class Announcement • Sec ${g.section?.name || ''}`;

        return {
          ...g,
          name: displayName,
          subject: g.subject ? {
            id: g.subject.id,
            name: subName,
            subject_name: subName,
            code: subCode,
            subject_code: subCode
          } as any : undefined,
          members_count: countMap[countKey] || 0,
          unread_count: unreadCountMap[g.id] || 0,
          faculty: facultyMap[facKey] || g.faculty
        };
      });
    } catch (err) {
      console.error('Exception in fetchUserMessageGroups:', err);
      return [];
    }
  },

  async fetchGroupMessages(groupId: string, limit: number = 100): Promise<GroupMessage[]> {
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching group messages:', error);
        return [];
      }

      return (data || []) as GroupMessage[];
    } catch (err) {
      console.error('Exception in fetchGroupMessages:', err);
      return [];
    }
  },

  async sendGroupMessage(params: {
    academicYearId: string;
    sectionId: string;
    subjectId?: string | null;
    message: string;
    title?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
    allowStudentReplies?: boolean;
  }): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      const { data, error } = await supabase.rpc('send_group_message', {
        p_academic_year_id: params.academicYearId,
        p_section_id: params.sectionId,
        p_subject_id: params.subjectId || null,
        p_message: params.message,
        p_title: params.title || null,
        p_attachment_url: params.attachmentUrl || null,
        p_attachment_name: params.attachmentName || null,
        p_attachment_type: params.attachmentType || null,
        p_attachment_size: params.attachmentSize || null,
        p_allow_student_replies: params.allowStudentReplies !== undefined ? params.allowStudentReplies : null,
      });

      if (error) {
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Exception in sendGroupMessage:', err);
      return { success: false, error: err };
    }
  },

  async markGroupAsRead(groupId: string): Promise<void> {
    try {
      await supabase.rpc('mark_group_as_read', { p_group_id: groupId });
    } catch (err) {
      console.error('Error in markGroupAsRead:', err);
    }
  },

  async fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      const { data, error } = await supabase.rpc('get_group_members', { p_group_id: groupId });
      if (error) {
        console.error('Error in fetchGroupMembers:', error);
        return [];
      }
      return (data || []) as GroupMember[];
    } catch (err) {
      console.error('Exception in fetchGroupMembers:', err);
      return [];
    }
  },

  async fetchStudentProfile(studentId: string): Promise<{ data: DetailedStudentProfile | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('get_student_profile', { p_student_id: studentId });
      if (error) {
        return { data: null, error };
      }
      return { data: data as DetailedStudentProfile, error: null };
    } catch (err) {
      console.error('Exception in fetchStudentProfile:', err);
      return { data: null, error: err };
    }
  },

  // ============================================================================
  // INSTITUTIONAL RECORDS & ARCHIVE SYSTEM METHODS
  // ============================================================================

  async archiveAccount(params: {
    targetId: string;
    entityType: 'student' | 'faculty';
    exitStatus: AccountStatus;
    exitDate?: string;
    reason?: string;
    actorId?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('archive_account', {
        p_target_id: params.targetId,
        p_entity_type: params.entityType,
        p_exit_status: params.exitStatus,
        p_exit_date: params.exitDate || getISTTodayDate(),
        p_reason: params.reason || 'Archived by Super Admin',
        p_actor_id: params.actorId || undefined,
      });

      if (error) throw new Error(error.message);
      this.invalidateMasterCache();
      return { success: true, data };
    } catch (err: any) {
      console.error('Error in archiveAccount:', err);
      return { success: false, error: err.message || 'Failed to archive account.' };
    }
  },

  async restoreAccount(params: {
    targetId: string;
    entityType: 'student' | 'faculty';
    actorId?: string;
    reason?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('restore_account', {
        p_target_id: params.targetId,
        p_entity_type: params.entityType,
        p_actor_id: params.actorId || undefined,
        p_reason: params.reason || 'Restored by Super Admin',
      });

      if (error) throw new Error(error.message);
      this.invalidateMasterCache();
      return { success: true, data };
    } catch (err: any) {
      console.error('Error in restoreAccount:', err);
      return { success: false, error: err.message || 'Failed to restore account.' };
    }
  },

  async fetchArchivedStats(): Promise<ArchivedStats> {
    try {
      const { data, error } = await supabase.rpc('get_archived_stats');
      if (error) throw error;
      return (data || {
        former_students: 0,
        former_faculty: 0,
        graduated_students: 0,
        withdrawn_students: 0,
        transferred_students: 0,
        dropped_out_students: 0,
        resigned_faculty: 0,
        total_archived: 0,
      }) as ArchivedStats;
    } catch (err) {
      console.error('Error fetching archived stats:', err);
      return {
        former_students: 0,
        former_faculty: 0,
        graduated_students: 0,
        withdrawn_students: 0,
        transferred_students: 0,
        dropped_out_students: 0,
        resigned_faculty: 0,
        total_archived: 0,
      };
    }
  },

  async fetchArchivedRecords(): Promise<ArchivedRecordItem[]> {
    try {
      const [studentsRes, facultyRes, profilesRes, deptsRes, progsRes, yearsRes, sectionsRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .or('status.neq.ACTIVE,active.eq.false')
          .order('roll_number', { ascending: true }),
        supabase
          .from('faculty')
          .select('*')
          .or('status.neq.ACTIVE,active.eq.false')
          .order('full_name', { ascending: true }),
        supabase.from('profiles').select('id, full_name, email, last_sign_in_at'),
        supabase.from('departments').select('id, name, code'),
        supabase.from('programs').select('id, name, code'),
        supabase.from('academic_years').select('id, name, year_number'),
        supabase.from('sections').select('id, name'),
      ]);

      const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const deptsMap = new Map((deptsRes.data || []).map(d => [d.id, d]));
      const progsMap = new Map((progsRes.data || []).map(p => [p.id, p]));
      const yearsMap = new Map((yearsRes.data || []).map(y => [y.id, y]));
      const sectionsMap = new Map((sectionsRes.data || []).map(s => [s.id, s]));

      const studentItems: ArchivedRecordItem[] = (studentsRes.data || []).map(s => {
        const prof = s.auth_user_id ? profilesMap.get(s.auth_user_id) : profilesMap.get(s.id);
        const archiverProf = s.archived_by ? profilesMap.get(s.archived_by) : null;
        const dept = deptsMap.get(s.department_id);
        const prog = progsMap.get(s.program_id);
        const yr = yearsMap.get(s.academic_year_id);
        const sec = sectionsMap.get(s.section_id);

        return {
          id: s.id,
          auth_user_id: s.auth_user_id,
          name: s.full_name,
          role: 'student' as const,
          identifier: s.roll_number,
          registration_number: s.admission_number || s.roll_number,
          department_id: s.department_id,
          department_name: dept?.name || 'Department of Engineering',
          department_code: dept?.code || 'ENG',
          program_name: prog?.name || 'B.Tech',
          year_name: yr?.name || (yr?.year_number ? `${yr.year_number} Year` : '—'),
          section_name: sec?.name || '—',
          email: s.email || prof?.email,
          phone: s.phone,
          status: (s.status as AccountStatus) || 'ARCHIVED',
          last_active_date: prof?.last_sign_in_at || null,
          exit_date: s.exit_date || (s.archived_at ? s.archived_at.split('T')[0] : null),
          exit_reason: s.exit_reason || null,
          archived_at: s.archived_at || null,
          archived_by_id: s.archived_by || null,
          archived_by_name: archiverProf?.full_name || 'Super Admin',
          created_at: s.created_at,
        };
      });

      const facultyItems: ArchivedRecordItem[] = (facultyRes.data || []).map(f => {
        const prof = f.auth_user_id ? profilesMap.get(f.auth_user_id) : profilesMap.get(f.id);
        const archiverProf = f.archived_by ? profilesMap.get(f.archived_by) : null;
        const dept = deptsMap.get(f.department_id);

        return {
          id: f.id,
          auth_user_id: f.auth_user_id,
          name: f.full_name,
          role: 'faculty' as const,
          identifier: f.employee_code,
          department_id: f.department_id,
          department_name: dept?.name || 'Department of Engineering',
          department_code: dept?.code || 'ENG',
          designation: f.designation,
          email: f.email || prof?.email,
          phone: f.phone,
          status: (f.status as AccountStatus) || 'RESIGNED',
          last_active_date: prof?.last_sign_in_at || null,
          exit_date: f.exit_date || (f.archived_at ? f.archived_at.split('T')[0] : null),
          exit_reason: f.exit_reason || null,
          archived_at: f.archived_at || null,
          archived_by_id: f.archived_by || null,
          archived_by_name: archiverProf?.full_name || 'Super Admin',
          created_at: f.created_at || new Date().toISOString(),
        };
      });

      return [...studentItems, ...facultyItems];
    } catch (err) {
      console.error('Error in fetchArchivedRecords:', err);
      return [];
    }
  },

  async fetchStudentHistoricalRecord(studentId: string): Promise<StudentFullHistoricalRecord | null> {
    try {
      const { data: student, error: stErr } = await supabase
        .from('students')
        .select('*, department:departments(*), program:programs(*), section:sections(*)')
        .eq('id', studentId)
        .single();

      if (stErr || !student) {
        console.error('Error fetching student historical record:', stErr);
        return null;
      }

      const [
        profileRes,
        academicHistoryRes,
        attendanceRecordsRes,
        sessionalMarksRes,
        leavesRes,
        timetableRes,
        lifecycleRes,
        auditLogsRes
      ] = await Promise.all([
        student.auth_user_id
          ? supabase.from('profiles').select('*').eq('id', student.auth_user_id).maybeSingle()
          : supabase.from('profiles').select('*').eq('id', student.id).maybeSingle(),
        supabase.from('student_academic_history').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
        supabase
          .from('attendance_records')
          .select('*, session:attendance_sessions(*, subject:subjects(*))')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('sessional_marks')
          .select('*, assessment:sessional_assessments(*, subject:subjects(*))')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('leave_applications')
          .select('*')
          .or(`student_id.eq.${studentId},user_id.eq.${student.auth_user_id || studentId}`)
          .order('created_at', { ascending: false }),
        student.section_id
          ? supabase.from('timetable_entries').select('*, subject:subjects(*), faculty:faculty(*)').eq('section_id', student.section_id).order('period_number', { ascending: true })
          : Promise.resolve({ data: [] }),
        supabase
          .from('account_lifecycle')
          .select('*, performer:profiles(full_name, role)')
          .eq('entity_id', studentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('audit_logs')
          .select('*')
          .or(`entity_id.eq.${studentId},actor_id.eq.${student.auth_user_id || studentId}`)
          .order('created_at', { ascending: false }),
      ]);

      // Calculate attendance aggregations
      const attRecords = attendanceRecordsRes.data || [];
      const totalAttended = attRecords.filter((r: any) => r.status === 'Present').length;
      const totalConducted = attRecords.length;
      const pct = totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 0;

      // Subject-wise attendance calculation
      const subjectMap = new Map<string, { subject_name: string; subject_code: string; conducted: number; attended: number }>();
      for (const r of attRecords) {
        const sub = (r as any).session?.subject;
        const subId = sub?.id || 'unknown';
        if (!subjectMap.has(subId)) {
          subjectMap.set(subId, {
            subject_name: sub?.subject_name || 'Academic Subject',
            subject_code: sub?.subject_code || 'SUB',
            conducted: 0,
            attended: 0,
          });
        }
        const item = subjectMap.get(subId)!;
        item.conducted++;
        if (r.status === 'Present') item.attended++;
      }

      const subjectWise = Array.from(subjectMap.entries()).map(([subId, item]) => ({
        subject_id: subId,
        subject_name: item.subject_name,
        subject_code: item.subject_code,
        conducted: item.conducted,
        attended: item.attended,
        percentage: item.conducted > 0 ? Math.round((item.attended / item.conducted) * 100) : 0,
      }));

      return {
        student: student as Student,
        profile: profileRes.data as UserProfile | null,
        academic_history: academicHistoryRes.data || [],
        attendance: {
          total_conducted: totalConducted,
          total_attended: totalAttended,
          percentage: pct,
          subject_wise: subjectWise,
          recent_sessions: attRecords.slice(0, 30),
        },
        marks: {
          sessional_assessments: sessionalMarksRes.data || [],
          quizzes: [],
          assignments: [],
        },
        leaves: leavesRes.data || [],
        timetable: timetableRes.data || [],
        lifecycle_history: (lifecycleRes.data || []) as AccountLifecycleEntry[],
        audit_logs: (auditLogsRes.data || []) as AuditLog[],
      };
    } catch (err) {
      console.error('Error fetching student historical record:', err);
      return null;
    }
  },

  async fetchFacultyHistoricalRecord(facultyId: string): Promise<FacultyFullHistoricalRecord | null> {
    try {
      const { data: faculty, error: facErr } = await supabase
        .from('faculty')
        .select('*, department:departments(*)')
        .eq('id', facultyId)
        .single();

      if (facErr || !faculty) {
        console.error('Error fetching faculty historical record:', facErr);
        return null;
      }

      const [
        profileRes,
        subjectAssignmentsRes,
        coordinatorRes,
        attendanceSessionsRes,
        assessmentsRes,
        timetableRes,
        leavesRes,
        lifecycleRes,
        auditLogsRes
      ] = await Promise.all([
        faculty.auth_user_id
          ? supabase.from('profiles').select('*').eq('id', faculty.auth_user_id).maybeSingle()
          : supabase.from('profiles').select('*').eq('id', faculty.id).maybeSingle(),
        supabase
          .from('faculty_subject_assignments')
          .select('*, subject:subjects(*), section:sections(*), session:academic_sessions(*)')
          .eq('faculty_id', facultyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('class_coordinator_assignments')
          .select('*, section:sections(*)')
          .eq('faculty_id', facultyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('attendance_sessions')
          .select('*, subject:subjects(*), section:sections(*)')
          .eq('faculty_id', facultyId)
          .order('session_date', { ascending: false }),
        supabase
          .from('sessional_assessments')
          .select('*, subject:subjects(*), section:sections(*)')
          .eq('faculty_id', facultyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('timetable_entries')
          .select('*, subject:subjects(*), section:sections(*)')
          .eq('faculty_id', facultyId)
          .order('day_of_week', { ascending: true }),
        supabase
          .from('leave_applications')
          .select('*')
          .or(`user_id.eq.${faculty.auth_user_id || facultyId},faculty_id.eq.${facultyId}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('account_lifecycle')
          .select('*, performer:profiles(full_name, role)')
          .eq('entity_id', facultyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('audit_logs')
          .select('*')
          .or(`entity_id.eq.${facultyId},actor_id.eq.${faculty.auth_user_id || facultyId}`)
          .order('created_at', { ascending: false }),
      ]);

      const attSessions = attendanceSessionsRes.data || [];
      const subMap = new Map<string, { subject_name: string; subject_code: string; count: number }>();
      for (const s of attSessions) {
        const sub = s.subject;
        const subId = sub?.id || 'unknown';
        if (!subMap.has(subId)) {
          subMap.set(subId, {
            subject_name: sub?.subject_name || 'Subject',
            subject_code: sub?.subject_code || 'SUB',
            count: 0,
          });
        }
        subMap.get(subId)!.count++;
      }

      const subjectWise = Array.from(subMap.entries()).map(([subId, item]) => ({
        subject_id: subId,
        subject_name: item.subject_name,
        subject_code: item.subject_code,
        session_count: item.count,
      }));

      return {
        faculty: faculty as Faculty,
        profile: profileRes.data as UserProfile | null,
        subject_assignments: subjectAssignmentsRes.data || [],
        class_coordinator_assignments: coordinatorRes.data || [],
        attendance_sessions: {
          total_conducted: attSessions.length,
          recent_sessions: attSessions.slice(0, 30),
          subject_wise: subjectWise,
        },
        assessments_created: assessmentsRes.data || [],
        assessments_managed: assessmentsRes.data || [],
        timetable_entries: timetableRes.data || [],
        timetable: timetableRes.data || [],
        leaves: leavesRes.data || [],
        lifecycle_history: (lifecycleRes.data || []) as AccountLifecycleEntry[],
        audit_logs: (auditLogsRes.data || []) as AuditLog[],
      };
    } catch (err) {
      console.error('Error fetching faculty historical record:', err);
      return null;
    }
  }
};




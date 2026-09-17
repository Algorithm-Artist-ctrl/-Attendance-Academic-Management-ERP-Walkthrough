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
  Classroom,
  AdmissionType,
  AccountStatus,
  AdminAccountDirectoryEntry,
  ClassCoordinatorAssignment,
  FacultyDashboardPayload
} from '../../types/database.types';
import { getISTTodayDate, getISTDayOfWeek } from '../utils/dateUtils';
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

export const supabaseService = {
  // Clear in-memory static cache when structural entities change
  invalidateMasterCache() {
    _staticCache = null;
    _masterCache = null;
    _inFlightFetchAll = null;
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

  // 1B. Fetch Dynamic Academic Entities (Sections, Subjects, Faculty, Assignments, Students, Profiles) - ALWAYS FRESH
  async fetchAcademicEntities() {
    try {
      const [
        { data: sections },
        { data: subjects },
        { data: faculty },
        { data: assignments },
        { data: students },
        { data: profilesList },
        { data: classroomsList },
      ] = await Promise.all([
        supabase.from('sections').select('*').eq('active', true).order('name', { ascending: true }),
        supabase.from('subjects').select('*').eq('active', true).order('subject_code', { ascending: true }),
        supabase.from('faculty').select('*').order('full_name', { ascending: true }),
        supabase.from('faculty_subject_assignments').select('*').eq('active', true),
        supabase.from('students').select('*').order('roll_number', { ascending: true }),
        supabase.from('profiles').select('*'),
        supabase.from('classrooms').select('*').eq('active', true).order('room_number', { ascending: true }),
      ]);

      return {
        sections: (sections as Section[]) || [],
        subjects: (subjects as Subject[]) || [],
        faculty: (faculty as Faculty[]) || [],
        assignments: (assignments as FacultySubjectAssignment[]) || [],
        students: (students as Student[]) || [],
        profiles: (profilesList as UserProfile[]) || [],
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
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching students:', error.message);
      return [];
    }
    return (data as Student[]) || [];
  },

  async fetchFaculty(activeOnly = false): Promise<Faculty[]> {
    let q = supabase.from('faculty').select('*').order('full_name', { ascending: true });
    if (activeOnly) q = q.eq('active', true);
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

  async fetchAttendance(): Promise<{ attendanceSessions: AttendanceSession[]; attendanceRecords: AttendanceRecord[] }> {
    const [sessRes, recRes] = await Promise.all([
      supabase.from('attendance_sessions').select('*').order('session_date', { ascending: false }),
      supabase.from('attendance_records').select('*'),
    ]);
    return {
      attendanceSessions: (sessRes.data as AttendanceSession[]) || [],
      attendanceRecords: (recRes.data as AttendanceRecord[]) || [],
    };
  },

  async fetchCorrections(): Promise<AttendanceCorrection[]> {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .select('*')
      .order('created_at', { ascending: false });
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
      supabase.from('assignments').select('*').order('created_at', { ascending: false }),
      supabase.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }),
      supabase.from('quizzes').select('*').order('created_at', { ascending: false }),
      supabase.from('quiz_results').select('*').order('created_at', { ascending: false }),
      supabase.from('sessional_marks').select('*').order('created_at', { ascending: false }),
      supabase.from('marks_history').select('*').order('updated_at', { ascending: false }),
      supabase.from('sessional_assessments').select('*').order('created_at', { ascending: false }),
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

  // 1D. Fetch Dynamic Operational Data (Timetable, Attendance, Assessments, Audit)
  async fetchOperationalData() {
    try {
      const [
        { data: timetable },
        { data: attendanceSessions },
        { data: attendanceRecords },
        { data: corrections },
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
        supabase.from('timetable_entries').select('*').eq('active', true).order('period_number', { ascending: true }),
        supabase.from('attendance_sessions').select('*').order('session_date', { ascending: false }),
        supabase.from('attendance_records').select('*'),
        supabase.from('attendance_corrections').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('timetable_versions').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('assignments').select('*').order('created_at', { ascending: false }),
        supabase.from('assignment_submissions').select('*').order('submitted_at', { ascending: false }),
        supabase.from('quizzes').select('*').order('created_at', { ascending: false }),
        supabase.from('quiz_results').select('*').order('created_at', { ascending: false }),
        supabase.from('sessional_marks').select('*').order('created_at', { ascending: false }),
        supabase.from('marks_history').select('*').order('updated_at', { ascending: false }),
        supabase.from('sessional_assessments').select('*').order('created_at', { ascending: false }),
      ]);

      return {
        timetable: (timetable as TimetableEntry[]) || [],
        attendanceSessions: (attendanceSessions as AttendanceSession[]) || [],
        attendanceRecords: (attendanceRecords as AttendanceRecord[]) || [],
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

  // 1E. Fetch All Master & Operational Data (Composed in parallel with Promise deduplication)
  async fetchAllData(forceRefreshMaster = false): Promise<FullERPData | null> {
    if (!forceRefreshMaster && _inFlightFetchAll) {
      return _inFlightFetchAll;
    }

    const fetchPromise = (async () => {
      try {
        const [staticSetup, academicEntities, operationalData] = await Promise.all([
          this.fetchStaticSetup(forceRefreshMaster),
          this.fetchAcademicEntities(),
          this.fetchOperationalData(),
        ]);

        if (!staticSetup || !academicEntities || !operationalData) {
          return null;
        }

        return {
          ...staticSetup,
          ...academicEntities,
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

  // 2. Save Live Attendance Session & Student Records (Authoritative Atomic Supabase Flow)
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

    // 1. Validation: Prevent future attendance dates
    const today = getISTTodayDate();
    if (params.sessionDate > today) {
      console.error('ATTENDANCE_SAVE_FAILED', `Invalid date: ${params.sessionDate}`);
      throw new Error(`Invalid attendance date: ${params.sessionDate}. Attendance cannot be recorded for future dates.`);
    }

    if (!params.sectionId || !params.subjectId || !params.facultyId) {
      console.error('ATTENDANCE_SAVE_FAILED', 'Missing required class parameters');
      throw new Error('Missing section, subject, or faculty information.');
    }

    // Verify target faculty account is active and not blocked
    const { data: facStatusCheck } = await supabase
      .from('faculty')
      .select('id, status, active')
      .eq('id', params.facultyId)
      .maybeSingle();

    if (facStatusCheck && (facStatusCheck.status === 'BLOCKED' || facStatusCheck.active === false)) {
      console.error('ATTENDANCE_SAVE_FAILED', `Faculty ${params.facultyId} account is blocked or inactive`);
      throw new Error('Unauthorized: Faculty account is blocked or inactive. Attendance marking is disabled.');
    }

    if (!params.studentRecords || params.studentRecords.length === 0) {
      console.error('ATTENDANCE_SAVE_FAILED', 'No student records provided');
      throw new Error('Cannot submit empty attendance roster.');
    }

    // Check for any invalid status
    for (const sr of params.studentRecords) {
      if (!sr.studentId || (sr.status !== 'Present' && sr.status !== 'Absent' && sr.status !== 'Unmarked')) {
        console.error('ATTENDANCE_SAVE_FAILED', `Invalid status for student ${sr.studentId}: ${sr.status}`);
        throw new Error(`Invalid status for student ${sr.studentId}: ${sr.status}. Status must be Present, Absent, or Unmarked.`);
      }
    }

    // 2. Auth Resolution & Authorization Validation
    const { data: authUserRes } = await supabase.auth.getUser();
    const callerUser = authUserRes?.user;

    if (callerUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, faculty_id, department_id')
        .eq('id', callerUser.id)
        .maybeSingle();

      if (profile?.role === 'student') {
        console.error('ATTENDANCE_SAVE_FAILED', 'Student attempted to record attendance');
        throw new Error('Unauthorized: Students cannot record or modify attendance.');
      }

      if (profile?.role === 'faculty') {
        const callerFacultyId = profile.faculty_id || callerUser.id;
        if (callerFacultyId && callerFacultyId !== params.facultyId) {
          console.error('ATTENDANCE_SAVE_FAILED', `Caller faculty ${callerFacultyId} does not match requested ${params.facultyId}`);
          throw new Error('You are not authorized to record attendance for this class.');
        }

        // Verify faculty is assigned to this section and subject via assignments or timetable
        const { data: directAssign } = await supabase
          .from('faculty_subject_assignments')
          .select('id')
          .eq('faculty_id', params.facultyId)
          .eq('section_id', params.sectionId)
          .eq('subject_id', params.subjectId)
          .eq('active', true)
          .maybeSingle();

        const { data: ttSlot } = await supabase
          .from('timetable_entries')
          .select('id')
          .eq('faculty_id', params.facultyId)
          .eq('section_id', params.sectionId)
          .eq('subject_id', params.subjectId)
          .eq('active', true)
          .maybeSingle();

        if (!directAssign && !ttSlot) {
          console.error('ATTENDANCE_SAVE_FAILED', `Faculty ${params.facultyId} not assigned to section ${params.sectionId} and subject ${params.subjectId}`);
          throw new Error('You are not authorized or assigned to mark attendance for this subject and section.');
        }
      }
    }
    console.log('ATTENDANCE_AUTH_VALIDATED', { callerId: callerUser?.id, facultyId: params.facultyId });

    // 3. Timetable Entry Validation (if provided)
    if (params.timetableEntryId) {
      const { data: ttEntry, error: ttErr } = await supabase
        .from('timetable_entries')
        .select('id, section_id, subject_id, faculty_id, active, start_time, end_time')
        .eq('id', params.timetableEntryId)
        .maybeSingle();

      if (ttErr || !ttEntry) {
        console.error('ATTENDANCE_SAVE_FAILED', `Timetable entry not found: ${params.timetableEntryId}`);
        throw new Error(`Specified timetable entry not found: ${params.timetableEntryId}`);
      }

      if (ttEntry.active === false) {
        console.error('ATTENDANCE_SAVE_FAILED', `Timetable entry is archived/inactive: ${params.timetableEntryId}`);
        throw new Error('Cannot record attendance for an archived or inactive timetable entry.');
      }

      if (ttEntry.section_id !== params.sectionId) {
        console.error('ATTENDANCE_SAVE_FAILED', `Section mismatch: tt ${ttEntry.section_id} vs param ${params.sectionId}`);
        throw new Error('Timetable entry section mismatch with selected class.');
      }

      if (ttEntry.subject_id && ttEntry.subject_id !== params.subjectId) {
        console.error('ATTENDANCE_SAVE_FAILED', `Subject mismatch: tt ${ttEntry.subject_id} vs param ${params.subjectId}`);
        throw new Error('Timetable entry subject mismatch with selected class.');
      }

      console.log('ATTENDANCE_TIMETABLE_VALIDATED', { timetableEntryId: params.timetableEntryId });
    }

    // 4. Student Roster Validation against live database
    const { data: liveStudents, error: studentsErr } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', params.sectionId)
      .eq('active', true);

    if (studentsErr || !liveStudents || liveStudents.length === 0) {
      console.error('ATTENDANCE_SAVE_FAILED', `Failed to load active students for section ${params.sectionId}`);
      throw new Error(`Failed to load active student roster for section ${params.sectionId}.`);
    }

    const liveStudentIds = new Set(liveStudents.map(s => s.id));
    for (const sr of params.studentRecords) {
      if (!liveStudentIds.has(sr.studentId)) {
        console.error('ATTENDANCE_SAVE_FAILED', `Student ${sr.studentId} not enrolled in section ${params.sectionId}`);
        throw new Error(`Student ${sr.studentId} is not an active student enrolled in this section.`);
      }
    }

    // 5. Atomic PostgreSQL RPC Save
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
    console.log('ATTENDANCE_SESSION_CREATED_OR_UPDATED', { sessionId });
    console.log('ATTENDANCE_RECORDS_UPSERTED', { recordCount: rpcRes.record_count });

    // 6. Verify Persisted Rows from Live Supabase
    const [sessVerify, recsVerify] = await Promise.all([
      supabase.from('attendance_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('attendance_records').select('*').eq('attendance_session_id', sessionId),
    ]);

    if (sessVerify.error || !sessVerify.data || recsVerify.error || !recsVerify.data || recsVerify.data.length !== rpcRes.record_count) {
      console.error('ATTENDANCE_SAVE_FAILED', 'Database verification mismatch after save');
      throw new Error('Database verification mismatch: Saved records could not be verified in live Supabase.');
    }

    console.log('ATTENDANCE_SAVE_VERIFIED', {
      sessionId,
      recordsVerified: recsVerify.data.length,
      presentCount: rpcRes.present_count,
      absentCount: rpcRes.absent_count,
    });

    // 7. Broadcast Realtime Attendance Update
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

    this.invalidateMasterCache();

    return { 
      session: sessVerify.data as AttendanceSession, 
      records: recsVerify.data as AttendanceRecord[],
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

    // 4. Invalidate cache and broadcast Realtime event
    this.invalidateMasterCache();
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
    timetableEntryId: string;
    studentId: string;
    reason: string;
    requestedStatus?: AttendanceStatus;
    simulatedTime?: string;
    simulatedDate?: string;
  }): Promise<{
    success: boolean;
    code: string;
    message: string;
    claimId?: string;
    sessionId?: string;
    recordId?: string;
  }> {
    const { data, error } = await supabase.rpc('claim_attendance', {
      p_timetable_entry_id: params.timetableEntryId,
      p_student_id: params.studentId,
      p_reason: params.reason,
      p_requested_status: params.requestedStatus || 'Present',
      p_simulated_time: params.simulatedTime || null,
      p_simulated_date: params.simulatedDate || null,
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

    return {
      success: true,
      code: res.code,
      message: res.message,
      claimId: res.claim_id,
      sessionId: res.session_id,
      recordId: res.record_id,
    };
  },

  // 4. Submit Correction Request (General fallback)
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

    return data as AttendanceCorrection;
  },

  // 4. Review Correction Request (Approve / Reject)
  async reviewCorrection(params: {
    correctionId: string;
    status: 'approved' | 'rejected';
    reviewerFacultyId: string;
    reviewRemarks?: string;
  }) {
    const { data: updatedCorrection, error: corrErr } = await supabase
      .from('attendance_corrections')
      .update({
        status: params.status,
        reviewed_by: params.reviewerFacultyId,
        reviewed_at: new Date().toISOString(),
        review_remarks: params.reviewRemarks || null,
      })
      .eq('id', params.correctionId)
      .select()
      .single();

    if (corrErr || !updatedCorrection) {
      throw new Error(`Failed to update correction: ${corrErr?.message}`);
    }

    // Fetch reviewer faculty full name for audit fidelity
    const { data: reviewerInfo } = await supabase
      .from('faculty')
      .select('full_name')
      .eq('id', params.reviewerFacultyId)
      .single();

    // If approved, update the actual attendance record in database
    if (params.status === 'approved' && updatedCorrection.attendance_record_id) {
      await supabase
        .from('attendance_records')
        .update({
          status: updatedCorrection.requested_status,
          marked_by: params.reviewerFacultyId,
          marked_at: new Date().toISOString(),
          remarks: `Corrected via Request #${params.correctionId}`,
        })
        .eq('id', updatedCorrection.attendance_record_id);

      // Audit Log for Approval
      await supabase.from('audit_logs').insert({
        actor_id: params.reviewerFacultyId,
        actor_name: reviewerInfo?.full_name || 'Faculty Member',
        actor_role: 'faculty',
        action: 'ATTENDANCE_CORRECTION_APPROVED',
        entity_type: 'attendance_records',
        entity_id: updatedCorrection.attendance_record_id,
        new_values: {
          correctionId: params.correctionId,
          newStatus: updatedCorrection.requested_status,
          remarks: params.reviewRemarks,
        },
      });
    } else if (params.status === 'rejected') {
      // Audit Log for Rejection
      await supabase.from('audit_logs').insert({
        actor_id: params.reviewerFacultyId,
        actor_name: reviewerInfo?.full_name || 'Faculty Member',
        actor_role: 'faculty',
        action: 'ATTENDANCE_CORRECTION_REJECTED',
        entity_type: 'attendance_corrections',
        entity_id: params.correctionId,
        new_values: {
          correctionId: params.correctionId,
          rejectionRemarks: params.reviewRemarks,
        },
      });
    }

    return updatedCorrection as AttendanceCorrection;
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

  async deleteStudent(id: string) {
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
    
    // 1. Update faculty table
    const { data: facData, error: facErr } = await supabase
      .from('faculty')
      .update({ email: cleanEmail, updated_at: new Date().toISOString() })
      .eq('id', facultyId)
      .select()
      .single();
    if (facErr) throw new Error(facErr.message);

    // 2. Update profiles table
    await supabase
      .from('profiles')
      .update({ email: cleanEmail, updated_at: new Date().toISOString() })
      .or(`id.eq.${facultyId},faculty_id.eq.${facultyId}`);

    // 3. Audit log
    await supabase.from('audit_logs').insert({
      action: 'FACULTY_CREDENTIALS_UPDATED',
      actor_name: facData.full_name,
      actor_role: 'faculty',
      entity_type: 'faculty',
      entity_id: facultyId,
      new_values: { email: cleanEmail }
    });

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
    actorName?: string;
  }): Promise<{ faculty: Faculty; assignments: FacultySubjectAssignment[] }> {
    const { faculty: facData, assignments: assignList, actorName = 'Administrator' } = params;

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
    actorName?: string;
  }): Promise<{ faculty: Faculty; assignments: FacultySubjectAssignment[] }> {
    const { facultyId, updates, assignments: newAssignments, actorName = 'Administrator' } = params;

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

    // 4. Audit log
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
      await this.setFacultyStatus(facultyId, 'BLOCKED', 'Archived due to historical attendance/timetable records', actorName);
      
      await supabase.from('faculty').update({ status: 'ARCHIVED', active: false }).eq('id', facultyId);
      await supabase.from('profiles').update({ status: 'ARCHIVED' }).or(`id.eq.${facultyId},faculty_id.eq.${facultyId}`);

      try {
        await supabase.from('audit_logs').insert({
          action: 'FACULTY_ARCHIVED',
          actor_name: actorName,
          actor_role: 'admin',
          entity_type: 'faculty',
          entity_id: facultyId,
          new_values: {
            reason: 'Archived to preserve historical records',
            attendance_sessions: check.attendanceCount,
            timetable_entries: check.timetableCount,
          },
        });
      } catch {}

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

  async deleteSection(id: string) {
    // Check if section has associated historical records
    const [{ count: studentCount }, { count: timetableCount }, { count: attendanceCount }] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('section_id', id),
      supabase.from('timetable_entries').select('id', { count: 'exact', head: true }).eq('section_id', id),
      supabase.from('attendance_sessions').select('id', { count: 'exact', head: true }).eq('section_id', id),
    ]);

    let isArchived = false;
    // If historical data exists, soft-archive by setting active = false to safeguard relational integrity
    if ((studentCount || 0) > 0 || (timetableCount || 0) > 0 || (attendanceCount || 0) > 0) {
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

    // Sync faculty_subject_assignments if instructional
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
    entries: Array<{ faculty_id: string; day_of_week: DayOfWeek; period_number: number; start_time?: string; end_time?: string; subject_id?: string }>;
  }): Promise<Array<{ facultyName: string; day: DayOfWeek; period: number; otherSectionName: string; otherSubjectCode?: string; timeRange?: string }>> {
    const facultyIds = Array.from(new Set(params.entries.map(e => e.faculty_id).filter(Boolean)));
    if (facultyIds.length === 0) return [];

    const { data: otherEntries, error } = await supabase
      .from('timetable_entries')
      .select('faculty_id, day_of_week, period_number, start_time, end_time, section_id, sections(name), subjects(subject_code), faculty(full_name)')
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

    for (const e of params.entries) {
      const match = otherEntries.find((o: any) => {
        if (o.faculty_id !== e.faculty_id || o.day_of_week !== e.day_of_week) return false;
        if (e.start_time && e.end_time && o.start_time && o.end_time) {
          const sA = toMins(e.start_time);
          const eA = toMins(e.end_time);
          const sB = toMins(o.start_time);
          const eB = toMins(o.end_time);
          if (eA > sA && eB > sB) {
            return sA < eB && eA > sB;
          }
        }
        return o.period_number === e.period_number;
      });

      if (match) {
        const facName = (match as any).faculty?.full_name || 'Faculty Member';
        const secName = (match as any).sections?.name || 'Other Section';
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

    return data as Assignment;
  },

  async updateAssignment(id: string, updates: Partial<Assignment>) {
    const { data, error } = await supabase.from('assignments').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
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
    if (!quiz.google_form_url.startsWith('http')) {
      throw new Error('Please enter a valid Google Forms URL (starting with https://)');
    }

    const payload = {
      ...quiz,
      start_time: quiz.start_time || new Date().toISOString(),
      end_time: quiz.end_time || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data, error } = await supabase.from('quizzes').insert(payload).select().single();
    if (error) throw new Error(error.message);

    // Audit Log
    await supabase.from('audit_logs').insert({
      action: 'QUIZ_CREATED',
      actor_name: 'Faculty',
      actor_role: 'faculty',
      entity_type: 'quiz',
      entity_id: data.id,
      new_values: { title: quiz.title, max_marks: quiz.max_marks, url: quiz.google_form_url }
    });

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
  }) {
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', params.quizId).single();
    if (!quiz) throw new Error('Quiz not found.');

    const rows = params.studentMarks.map(sm => {
      if (sm.marksObtained < 0 || sm.marksObtained > quiz.max_marks) {
        throw new Error(`Invalid marks for student: ${sm.marksObtained}. Must be between 0 and ${quiz.max_marks}.`);
      }
      return {
        quiz_id: params.quizId,
        student_id: sm.studentId,
        marks_obtained: sm.marksObtained,
        graded_by: params.facultyId,
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
        updated_by: params.facultyId,
        reason: 'Quiz Marks Recorded'
      });
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
    if (!assessment.title?.trim()) {
      throw new Error('Sessional title is required.');
    }

    const { data, error } = await supabase
      .from('sessional_assessments')
      .insert({
        ...assessment,
        status: assessment.status || 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase.from('audit_logs').insert({
      action: 'SESSIONAL_ASSESSMENT_CREATED',
      actor_id: assessment.faculty_id || null,
      target_type: 'sessional_assessments',
      target_id: data.id,
      details: { title: assessment.title, maxMarks: assessment.max_marks, subjectId: assessment.subject_id },
      reason: 'Dynamic Sessional Assessment Published'
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
    return data as SessionalAssessment;
  },

  async deleteSessionalAssessment(id: string) {
    const { error } = await supabase.from('sessional_assessments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async saveSessionalMarks(params: {
    sessionalAssessmentId?: string;
    subjectId?: string;
    sectionId?: string;
    sessionalType?: string;
    maxMarks?: number;
    facultyId: string;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }>;
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

    const rows = params.studentMarks.map(sm => {
      if (sm.marksObtained < 0 || sm.marksObtained > params.maxMarks!) {
        throw new Error(`Marks ${sm.marksObtained} exceeds valid range (0 - ${params.maxMarks}).`);
      }
      return {
        sessional_assessment_id: params.sessionalAssessmentId || null,
        faculty_id: params.facultyId,
        subject_id: params.subjectId,
        section_id: params.sectionId,
        student_id: sm.studentId,
        sessional_type: params.sessionalType || 'Sessional',
        max_marks: params.maxMarks,
        marks_obtained: sm.marksObtained,
        remarks: sm.remarks,
        updated_by: params.facultyId,
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
          updated_by: params.facultyId,
          reason: `${params.sessionalType || 'Sessional'} Marks Updated`
        });
      }
    }

    return upsertResult.data as SessionalMark[];
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
      });

      // Record audit log for password reset request (never store or log any passwords)
      await supabase.from('audit_logs').insert([{
        actor_name: actorName || 'Super Admin',
        actor_role: actorRole || 'super_admin',
        action: 'PASSWORD_RESET_REQUESTED',
        entity_type: 'USER_ACCOUNT',
        entity_id: targetUserId || null,
        new_values: { email, requested_at: new Date().toISOString() },
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

  // 13. Class Coordinator Relational Management (Migration 017)
  async fetchClassCoordinatorAssignments(facultyId?: string): Promise<ClassCoordinatorAssignment[]> {
    try {
      let q = supabase
        .from('class_coordinator_assignments')
        .select(`
          id,
          faculty_id,
          section_id,
          academic_session_id,
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
          academic_session:academic_sessions(*)
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
        }));
      }

      return (data as any[]) || [];
    } catch (err) {
      console.error('Error in fetchClassCoordinatorAssignments:', err);
      return [];
    }
  },

  async assignClassCoordinator(facultyId: string, sectionId: string, sessionId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      let effectiveSessionId = sessionId;
      if (!effectiveSessionId) {
        const { data: session } = await supabase.from('academic_sessions').select('id').eq('is_current', true).maybeSingle();
        effectiveSessionId = session?.id;
      }

      const { error: ccaErr } = await supabase
        .from('class_coordinator_assignments')
        .upsert({
          faculty_id: facultyId,
          section_id: sectionId,
          academic_session_id: effectiveSessionId || null,
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
        .update({ class_coordinator_id: facultyId })
        .eq('id', sectionId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to assign class coordinator.' };
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
        supabase.from('attendance_corrections').select('*, student:students(*)').eq('status', 'pending')
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
      const pendingCorrections = (correctionsRes.data || []) as AttendanceCorrection[];

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
  }
};


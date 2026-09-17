import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  Classroom,
  AdmissionType,
  AccountStatus,
  AdminAccountDirectoryEntry
} from '../types/database.types';
import {
  StudentOverallAttendance,
  TodayLectureItem,
  TimetableConflict,
  SubjectAttendanceStat,
  StudentSubjectAcademicReport,
  TimetableQueryFilter
} from '../types/academic.types';
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { erpStorage } from '../lib/storage/erpStorage';
import { 
  getISTTodayDate, 
  getISTDayOfWeek, 
  isClaimWindowOpen, 
  getClaimWindowStatus 
} from '../lib/utils/dateUtils';

export interface TodayAttendanceLecture {
  timetableEntryId: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  facultyCode?: string;
  roomNumber: string;
  lectureType: string;
  sectionId: string;
  sectionName: string;
  sessionDate: string;
  status: 'Present' | 'Absent' | 'Not Recorded';
  attendanceRecordId?: string;
  attendanceSessionId?: string;
  claimId?: string;
  claimStatus?: 'pending' | 'approved' | 'rejected';
  claimReason?: string;
  claimReviewRemarks?: string;
}

export interface DateWiseAttendanceSummary {
  dateStr: string;
  dayOfWeek: DayOfWeek;
  lectures: TodayAttendanceLecture[];
  totalLectures: number;
  presentCount: number;
  absentCount: number;
  notRecordedCount: number;
}

interface AcademicContextType {
  institution: Institution;
  departments: Department[];
  programs: Program[];
  sessions: AcademicSession[];
  years: AcademicYear[];
  semesters: Semester[];
  sections: Section[];
  classrooms: Classroom[];
  subjects: Subject[];
  faculty: Faculty[];
  assignments: FacultySubjectAssignment[];
  students: Student[];
  timetable: TimetableEntry[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  auditLogs: AuditLog[];
  courseAssignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  quizzes: Quiz[];
  quizResults: QuizResult[];
  sessionalAssessments: SessionalAssessment[];
  sessionalMarks: SessionalMark[];
  marksHistory: MarksHistory[];
  adminAccounts: AdminAccountDirectoryEntry[];
  isLoading: boolean;
  claimWindowDays: number;
  setClaimWindowDays: (days: number) => void;
  refreshData: (forceRefreshMaster?: boolean) => Promise<void>;
  refreshAdminAccounts: () => Promise<void>;
  updateAccountStatus: (userId: string, status: AccountStatus, reason?: string) => Promise<{ success: boolean; error?: string }>;
  updateAccountCredentials: (
    targetUserId: string,
    options: {
      email?: string;
      password?: string;
      isDefaultPassword?: boolean;
    }
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  requestPasswordReset: (email: string, targetUserId?: string) => Promise<{ success: boolean; error?: string }>;

  // Real Database Actions
  createAssignment: (data: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>) => Promise<Assignment>;
  updateAssignment: (id: string, updates: Partial<Assignment>) => Promise<Assignment>;
  deleteCourseAssignment: (id: string) => Promise<boolean>;
  submitAssignment: (submission: {
    assignmentId: string;
    studentId: string;
    submissionType: string;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    googleFormSubmitted?: boolean;
  }) => Promise<AssignmentSubmission>;
  gradeAssignmentSubmission: (params: {
    submissionId: string;
    marksObtained: number;
    feedback?: string;
    facultyId: string;
  }) => Promise<AssignmentSubmission>;
  createQuiz: (quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at'>) => Promise<Quiz>;
  updateQuiz: (id: string, updates: Partial<Quiz>) => Promise<Quiz>;
  deleteQuiz: (id: string) => Promise<boolean>;
  saveQuizMarks: (params: {
    quizId: string;
    facultyId: string;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
  }) => Promise<QuizResult[]>;
  createSessionalAssessment: (data: Omit<SessionalAssessment, 'id' | 'created_at' | 'updated_at'>) => Promise<SessionalAssessment>;
  updateSessionalAssessment: (id: string, updates: Partial<SessionalAssessment>) => Promise<SessionalAssessment>;
  deleteSessionalAssessment: (id: string) => Promise<boolean>;
  saveSessionalMarks: (params: {
    sessionalAssessmentId?: string;
    facultyId: string;
    subjectId: string;
    sectionId: string;
    sessionalType?: string;
    maxMarks: number;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }>;
  }) => Promise<SessionalMark[]>;
  getStudentAcademicScorecard: (studentId: string) => StudentSubjectAcademicReport[];
  addDepartment: (dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => Promise<Department>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<boolean>;
  addProgram: (prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) => Promise<Program>;
  updateProgram: (id: string, updates: Partial<Program>) => Promise<Program>;
  deleteProgram: (id: string) => Promise<boolean>;
  addSection: (sec: Omit<Section, 'id' | 'created_at' | 'updated_at'>) => Promise<Section>;
  updateSection: (id: string, updates: Partial<Section>) => Promise<Section>;
  deleteSection: (id: string) => Promise<{ success: boolean; archived: boolean } | boolean>;
  addAcademicYear: (year: Omit<AcademicYear, 'id' | 'created_at' | 'updated_at'>) => Promise<AcademicYear>;
  updateAcademicYear: (id: string, updates: Partial<AcademicYear>) => Promise<AcademicYear>;
  deleteAcademicYear: (id: string) => Promise<boolean>;
  addSemester: (sem: Omit<Semester, 'id' | 'created_at' | 'updated_at'>) => Promise<Semester>;
  updateSemester: (id: string, updates: Partial<Semester>) => Promise<Semester>;
  deleteSemester: (id: string) => Promise<boolean>;
  addFaculty: (fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) => Promise<Faculty>;
  createFacultyWithAssignments: (params: {
    faculty: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>;
    assignments: Array<{
      academic_year_id: string;
      semester_id: string;
      section_id: string;
      subject_id: string;
    }>;
    actorName?: string;
  }) => Promise<{ faculty: Faculty; assignments: FacultySubjectAssignment[] }>;
  updateFaculty: (id: string, updates: Partial<Faculty>) => Promise<Faculty>;
  updateFacultyWithAssignments: (params: {
    facultyId: string;
    updates: Partial<Faculty>;
    assignments?: Array<{
      academic_year_id: string;
      semester_id: string;
      section_id: string;
      subject_id: string;
    }>;
    actorName?: string;
  }) => Promise<{ faculty: Faculty; assignments: FacultySubjectAssignment[] }>;
  setFacultyStatus: (facultyId: string, status: 'ACTIVE' | 'BLOCKED', reason?: string, actorName?: string) => Promise<Faculty>;
  checkFacultyHistoricalRecords: (facultyId: string) => Promise<{
    hasHistoricalData: boolean;
    attendanceCount: number;
    timetableCount: number;
    assignmentCount: number;
  }>;
  safeDeleteFaculty: (facultyId: string, actorName?: string) => Promise<{
    archived: boolean;
    deleted: boolean;
    message: string;
  }>;
  deleteFaculty: (id: string) => Promise<boolean>;
  addSubject: (sub: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) => Promise<Subject>;
  updateSubject: (id: string, updates: Partial<Subject>) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<boolean>;
  addAssignment: (assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) => Promise<FacultySubjectAssignment>;
  updateFacultyAssignment: (id: string, updates: Partial<FacultySubjectAssignment>) => Promise<FacultySubjectAssignment>;
  deleteAssignment: (id: string) => Promise<boolean>;
  addStudent: (student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => Promise<Student>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<Student>;
  deleteStudent: (id: string) => Promise<boolean>;
  transferStudentSection: (params: {
    studentId: string;
    newSectionId: string;
    transferredBy?: string;
  }) => Promise<{ success: boolean; student: Student }>;
  batchImportSectionStudents: (params: {
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
  }) => Promise<{ added: number; updated: number; skipped: number; errors: string[] }>;
  addTimetableEntry: (entry: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<TimetableEntry>;
  updateTimetableEntry: (id: string, updates: Partial<TimetableEntry>) => Promise<TimetableEntry>;
  deleteTimetableEntry: (id: string) => Promise<boolean>;
  deleteSectionTimetable: (sectionId: string, deletedBy?: string) => Promise<boolean>;
  findOrCreateFaculty: (params: {
    fullName: string;
    facultyCode?: string;
    employeeCode?: string;
    designation?: string;
    email?: string;
    phone?: string;
    departmentId: string;
  }) => Promise<Faculty>;
  findOrCreateSubject: (params: {
    subjectName: string;
    subjectCode: string;
    departmentId: string;
    semesterId: string;
    programId?: string;
    lectureType?: LectureType;
    credits?: number;
  }) => Promise<Subject>;
  findOrCreateClassroom: (params: {
    roomNumber: string;
    building?: string;
    roomType?: string;
    capacity?: number;
  }) => Promise<Classroom>;
  saveSingleTimetableSlot: (params: {
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
  }) => Promise<{ success: boolean; entry: TimetableEntry }>;
  saveSectionTimetable: (params: {
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
  }) => Promise<{ success: boolean; count: number; version?: TimetableVersion }>;
  rollbackToVersion: (params: {
    versionId: string;
    restoredBy?: string;
  }) => Promise<{ success: boolean; count: number; version?: TimetableVersion }>;
  checkTimetableConflict: (entry: Omit<TimetableEntry, 'id'>, excludeId?: string) => TimetableConflict | null;
  saveAttendance: (params: {
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
  }) => Promise<{ session: AttendanceSession; records: AttendanceRecord[] }>;
  deleteAttendanceSession: (sessionId: string) => Promise<{ success: boolean; deletedSessionId?: string }>;
  submitCorrectionRequest: (params: {
    attendanceRecordId?: string;
    timetableEntryId?: string;
    sessionDate?: string;
    subjectId?: string;
    facultyId?: string;
    sectionId?: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }) => Promise<AttendanceCorrection>;
  reviewCorrectionRequest: (params: {
    correctionId: string;
    status: 'approved' | 'rejected';
    reviewerFacultyId: string;
    reviewRemarks?: string;
  }) => Promise<AttendanceCorrection>;
  canSubmitClaim: (params: {
    attendanceRecordId?: string;
    sessionDate: string;
    lectureType?: string;
    isBreak?: boolean;
    timetableEntryId?: string;
  }) => { canSubmit: boolean; message?: string; existingClaim?: AttendanceCorrection; code?: string };
  getStudentAttendance: (studentId: string) => StudentOverallAttendance & {
    notRecordedCount: number;
    pendingClaimsCount: number;
  };
  getPublishedTimetable: (filter?: TimetableQueryFilter) => TimetableEntry[];
  getStudentTimetable: (studentId: string) => TimetableEntry[];
  getFacultyTimetable: (facultyId: string, dayOfWeek?: DayOfWeek) => TimetableEntry[];
  getTodayLecturesForStudent: (studentId: string, customDateStr?: string) => TodayAttendanceLecture[];
  getDateLecturesForStudent: (studentId: string, dateStr: string) => DateWiseAttendanceSummary;
  getFacultyCorrectionRequests: (facultyId: string) => AttendanceCorrection[];
  getTodaySchedule: (params: {
    dayOfWeek: DayOfWeek;
    sectionId?: string;
    facultyId?: string;
    studentId?: string;
    dateStr: string;
  }) => TodayLectureItem[];
  refreshStudents: () => Promise<void>;
  refreshTimetable: (sectionId?: string) => Promise<void>;
  refreshAttendance: () => Promise<void>;
  refreshCorrections: () => Promise<void>;
  refreshFaculty: () => Promise<void>;
  refreshSections: () => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshAssignments: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  resetToInitialSeed: () => void;
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined);

export const AcademicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [claimWindowDays, setClaimWindowDays] = useState<number>(7);

  // State populated from Supabase
  const [institution, setInstitution] = useState<Institution>(() => erpStorage.getInstitution());
  const [departments, setDepartments] = useState<Department[]>(() => erpStorage.getDepartments());
  const [programs, setPrograms] = useState<Program[]>(() => erpStorage.getPrograms());
  const [sessions, setSessions] = useState<AcademicSession[]>(() => erpStorage.getSessions());
  const [years, setYears] = useState<AcademicYear[]>(() => erpStorage.getYears());
  const [semesters, setSemesters] = useState<Semester[]>(() => erpStorage.getSemesters());
  const [sections, setSections] = useState<Section[]>(() => erpStorage.getSections());
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>(() => erpStorage.getSubjects());
  const [faculty, setFaculty] = useState<Faculty[]>(() => erpStorage.getFaculty());
  const [assignments, setAssignments] = useState<FacultySubjectAssignment[]>(() => erpStorage.getAssignments());
  const [students, setStudents] = useState<Student[]>(() => erpStorage.getStudents());
  const [timetable, setTimetable] = useState<TimetableEntry[]>(() => erpStorage.getTimetable());
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>(() => erpStorage.getCorrections());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => erpStorage.getAuditLogs());
  const [courseAssignments, setCourseAssignments] = useState<Assignment[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [sessionalAssessments, setSessionalAssessments] = useState<SessionalAssessment[]>([]);
  const [sessionalMarks, setSessionalMarks] = useState<SessionalMark[]>([]);
  const [marksHistory, setMarksHistory] = useState<MarksHistory[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccountDirectoryEntry[]>([]);

  // Stable refs for cross-table joins to eliminate stale closures in granular callbacks
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const facultyRef = useRef(faculty);
  facultyRef.current = faculty;
  const subjectsRef = useRef(subjects);
  subjectsRef.current = subjects;
  const departmentsRef = useRef(departments);
  departmentsRef.current = departments;
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const attendanceSessionsRef = useRef(attendanceSessions);
  attendanceSessionsRef.current = attendanceSessions;
  const attendanceRecordsRef = useRef(attendanceRecords);
  attendanceRecordsRef.current = attendanceRecords;
  const courseAssignmentsRef = useRef(courseAssignments);
  courseAssignmentsRef.current = courseAssignments;
  const sessionalAssessmentsRef = useRef(sessionalAssessments);
  sessionalAssessmentsRef.current = sessionalAssessments;
  const semestersRef = useRef(semesters);
  semestersRef.current = semesters;
  const yearsRef = useRef(years);
  yearsRef.current = years;

  // Function to load and enrich latest records from Supabase
  const loadDataFromSupabase = useCallback(async (forceRefreshMaster = false) => {
    try {
      const data = await supabaseService.fetchAllData(forceRefreshMaster);
      if (data) {
        const loadedInst = data.institutions[0] || erpStorage.getInstitution();
        const loadedDepts = data.departments || [];
        const loadedProgs = data.programs || [];
        const loadedSessions = data.sessions || [];
        const loadedYears = (data.years || []).filter(y => y.active && y.year_number !== 1);
        const loadedSemesters = (data.semesters || []).filter(s => s.active && loadedYears.some(y => y.id === s.academic_year_id));
        const loadedSections = (data.sections || []).filter(sec => sec.active && loadedSemesters.some(sem => sem.id === sec.semester_id));
        const loadedClassrooms = ((data as any).classrooms || []).filter((c: any) => c.active !== false);
        setClassrooms(loadedClassrooms);
        const loadedSubjects = (data.subjects || []).filter(s => s.active !== false);
        const loadedFaculty = (data.faculty || []).filter(f => f.active !== false);
        const loadedAssignments = (data.assignments || []).filter(a => a.active !== false);
        const loadedStudents = (data.students || []).filter(s => s.active && loadedYears.some(y => y.id === s.academic_year_id));
        const rawTimetable = (data.timetable || []).filter(t => t.active !== false);

        // Enriched Timetable entries with joined references
        const enrichedTimetable: TimetableEntry[] = rawTimetable.map(t => ({
          ...t,
          subject: loadedSubjects.find(s => s.id === t.subject_id),
          faculty: loadedFaculty.find(f => f.id === t.faculty_id),
          section: loadedSections.find(sec => sec.id === t.section_id),
        }));

        // Enriched Students with authoritative section join
        const enrichedStudents: Student[] = loadedStudents.map(s => {
          const matchedSection = loadedSections.find(sec => sec.id === s.section_id);
          return {
            ...s,
            section: matchedSection,
            section_id: matchedSection?.id || s.section_id,
            mentor: loadedFaculty.find(f => f.id === s.mentor_faculty_id),
            department: loadedDepts.find(d => d.id === s.department_id),
          };
        });

        // Sync erpStorage with latest Supabase Cloud records
        erpStorage.syncFromSupabase({
          institutions: loadedInst ? [loadedInst] : [],
          departments: loadedDepts,
          programs: loadedProgs,
          sessions: loadedSessions,
          years: loadedYears,
          semesters: loadedSemesters,
          sections: loadedSections,
          subjects: loadedSubjects,
          faculty: loadedFaculty,
          assignments: loadedAssignments,
          students: enrichedStudents,
          timetable: enrichedTimetable,
          attendanceSessions: data.attendanceSessions,
          attendanceRecords: data.attendanceRecords,
          corrections: data.corrections,
          auditLogs: data.auditLogs,
          timetableVersions: data.timetableVersions,
        });

        // Enriched Assignments
        const enrichedAssignments: FacultySubjectAssignment[] = loadedAssignments.map(a => {
          const sec = loadedSections.find(s => s.id === a.section_id);
          const sem = loadedSemesters.find(s => s.id === (a.semester_id || sec?.semester_id));
          const yr = loadedYears.find(y => y.id === (a.academic_year_id || sem?.academic_year_id));
          return {
            ...a,
            faculty: loadedFaculty.find(f => f.id === a.faculty_id),
            subject: loadedSubjects.find(s => s.id === a.subject_id),
            section: sec,
            semester: sem,
            academic_year: yr,
            semester_id: a.semester_id || sem?.id,
            academic_year_id: a.academic_year_id || yr?.id,
          };
        });

        // Enriched Attendance Sessions
        const enrichedSessions: AttendanceSession[] = data.attendanceSessions.map(sess => ({
          ...sess,
          faculty: loadedFaculty.find(f => f.id === sess.faculty_id),
          subject: loadedSubjects.find(s => s.id === sess.subject_id),
          section: loadedSections.find(sec => sec.id === sess.section_id),
        }));

        // Enriched Attendance Records
        const enrichedRecords: AttendanceRecord[] = data.attendanceRecords.map(rec => ({
          ...rec,
          student: enrichedStudents.find(s => s.id === rec.student_id),
          session: enrichedSessions.find(sess => sess.id === rec.attendance_session_id),
        }));

        // Enriched Corrections
        const enrichedCorrections: AttendanceCorrection[] = data.corrections.map(c => {
          const rec = enrichedRecords.find(r => r.id === c.attendance_record_id);
          const matchedSession = rec?.session || enrichedSessions.find(s => s.id === rec?.attendance_session_id);
          const matchedStudent = enrichedStudents.find(s => s.id === c.student_id);
          const matchedReviewer = loadedFaculty.find(f => f.id === c.reviewed_by);
          return {
            ...c,
            record: rec,
            session: matchedSession,
            student: matchedStudent,
            reviewer: matchedReviewer,
          };
        });

        // Enriched Course Assignments
        const rawCourseAssignments = data.courseAssignments || [];
        const enrichedCourseAssignments: Assignment[] = rawCourseAssignments.map(a => ({
          ...a,
          subject: loadedSubjects.find(s => s.id === a.subject_id),
          faculty: loadedFaculty.find(f => f.id === a.faculty_id),
          section: loadedSections.find(sec => sec.id === a.section_id),
        }));

        // Enriched Submissions
        const rawSubmissions = data.assignmentSubmissions || [];
        const enrichedSubmissions: AssignmentSubmission[] = rawSubmissions.map(sub => ({
          ...sub,
          student: enrichedStudents.find(s => s.id === sub.student_id),
          assignment: enrichedCourseAssignments.find(a => a.id === sub.assignment_id),
          grader: loadedFaculty.find(f => f.id === sub.graded_by),
        }));

        // Enriched Quizzes
        const rawQuizzes = data.quizzes || [];
        const enrichedQuizzes: Quiz[] = rawQuizzes.map(q => ({
          ...q,
          subject: loadedSubjects.find(s => s.id === q.subject_id),
          faculty: loadedFaculty.find(f => f.id === q.faculty_id),
          section: loadedSections.find(sec => sec.id === q.section_id),
        }));

        // Enriched Quiz Results
        const rawQuizResults = data.quizResults || [];
        const enrichedQuizResults: QuizResult[] = rawQuizResults.map(qr => ({
          ...qr,
          student: enrichedStudents.find(s => s.id === qr.student_id),
          quiz: enrichedQuizzes.find(q => q.id === qr.quiz_id),
          grader: loadedFaculty.find(f => f.id === qr.graded_by),
        }));

        // Enriched Sessional Assessments
        const rawAssessments = data.sessionalAssessments || [];
        const enrichedAssessments: SessionalAssessment[] = rawAssessments.map(sa => ({
          ...sa,
          subject: loadedSubjects.find(s => s.id === sa.subject_id),
          faculty: loadedFaculty.find(f => f.id === sa.faculty_id),
          section: loadedSections.find(sec => sec.id === sa.section_id),
        }));

        // Enriched Sessional Marks
        const rawSessional = data.sessionalMarks || [];
        const enrichedSessionalMarks: SessionalMark[] = rawSessional.map(sm => ({
          ...sm,
          student: enrichedStudents.find(s => s.id === sm.student_id),
          subject: loadedSubjects.find(s => s.id === sm.subject_id),
          faculty: loadedFaculty.find(f => f.id === sm.faculty_id),
          section: loadedSections.find(sec => sec.id === sm.section_id),
          sessional_assessment: enrichedAssessments.find(a => a.id === sm.sessional_assessment_id),
        }));

        // Enriched Marks History
        const rawMarksHistory = data.marksHistory || [];
        const enrichedMarksHistory: MarksHistory[] = rawMarksHistory.map(mh => ({
          ...mh,
          student: enrichedStudents.find(s => s.id === mh.student_id),
          subject: loadedSubjects.find(s => s.id === mh.subject_id),
        }));

        setInstitution(loadedInst);
        setDepartments(loadedDepts);
        setPrograms(loadedProgs);
        setSessions(loadedSessions);
        setYears(loadedYears);
        setSemesters(loadedSemesters);
        setSections(loadedSections);
        setSubjects(loadedSubjects);
        setFaculty(loadedFaculty);
        setAssignments(enrichedAssignments);
        setStudents(enrichedStudents);
        setTimetable(enrichedTimetable);
        setAttendanceSessions(enrichedSessions);
        setAttendanceRecords(enrichedRecords);
        setCorrections(enrichedCorrections);
        setAuditLogs(data.auditLogs);
        setCourseAssignments(enrichedCourseAssignments);
        setAssignmentSubmissions(enrichedSubmissions);
        setQuizzes(enrichedQuizzes);
        setQuizResults(enrichedQuizResults);
        setSessionalAssessments(enrichedAssessments);
        setSessionalMarks(enrichedSessionalMarks);
        setMarksHistory(enrichedMarksHistory);

        // Fetch unified Admin Account Directory only for super_admin
        const currentSession = erpStorage.getCurrentSessionUser();
        if (currentSession?.role === 'super_admin') {
          supabaseService.fetchAdminAccounts().then(accs => setAdminAccounts(accs)).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to sync from Supabase, using local cache:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Granular Entity Refreshers for Targeted UI Updates Without Full-App Reload
  const refreshStudents = useCallback(async () => {
    try {
      const rawStudents = await supabaseService.fetchStudents();
      const curSections = sectionsRef.current;
      const curFaculty = facultyRef.current;
      const curDepts = departmentsRef.current;
      const enrichedStudents: Student[] = rawStudents.map(s => {
        const matchedSection = curSections.find(sec => sec.id === s.section_id);
        return {
          ...s,
          section: matchedSection,
          section_id: matchedSection?.id || s.section_id,
          mentor: curFaculty.find(f => f.id === s.mentor_faculty_id),
          department: curDepts.find(d => d.id === s.department_id),
        };
      });
      setStudents(enrichedStudents);
      erpStorage.setStudents(enrichedStudents);
    } catch (err) {
      console.error('Failed to refresh students:', err);
    }
  }, []);

  const refreshTimetable = useCallback(async (sectionId?: string) => {
    try {
      const rawEntries = await supabaseService.fetchTimetable(sectionId);
      const curSubjects = subjectsRef.current;
      const curFaculty = facultyRef.current;
      const curSections = sectionsRef.current;

      const enriched: TimetableEntry[] = rawEntries.map(t => ({
        ...t,
        subject: curSubjects.find(s => s.id === t.subject_id),
        faculty: curFaculty.find(f => f.id === t.faculty_id),
        section: curSections.find(sec => sec.id === t.section_id),
      }));

      if (sectionId) {
        setTimetable(prev => {
          const others = prev.filter(t => t.section_id !== sectionId);
          const merged = [...others, ...enriched];
          erpStorage.setTimetable(merged);
          return merged;
        });
      } else {
        setTimetable(enriched);
        erpStorage.setTimetable(enriched);
      }
    } catch (err) {
      console.error('Failed to refresh timetable:', err);
    }
  }, []);

  const refreshAttendance = useCallback(async () => {
    try {
      const { attendanceSessions: rawSessions, attendanceRecords: rawRecords } = await supabaseService.fetchAttendance();
      const curFaculty = facultyRef.current;
      const curSubjects = subjectsRef.current;
      const curSections = sectionsRef.current;
      const curStudents = studentsRef.current;

      const enrichedSessions: AttendanceSession[] = rawSessions.map(sess => ({
        ...sess,
        faculty: curFaculty.find(f => f.id === sess.faculty_id),
        subject: curSubjects.find(s => s.id === sess.subject_id),
        section: curSections.find(sec => sec.id === sess.section_id),
      }));

      const enrichedRecords: AttendanceRecord[] = rawRecords.map(rec => ({
        ...rec,
        student: curStudents.find(s => s.id === rec.student_id),
        session: enrichedSessions.find(sess => sess.id === rec.attendance_session_id),
      }));

      setAttendanceSessions(enrichedSessions);
      setAttendanceRecords(enrichedRecords);
      erpStorage.setAttendanceSessions(enrichedSessions);
      erpStorage.setAttendanceRecords(enrichedRecords);
    } catch (err) {
      console.error('Failed to refresh attendance:', err);
    }
  }, []);

  const refreshCorrections = useCallback(async () => {
    try {
      const rawCorrections = await supabaseService.fetchCorrections();
      const curRecords = attendanceRecordsRef.current;
      const curSessions = attendanceSessionsRef.current;
      const curStudents = studentsRef.current;
      const curFaculty = facultyRef.current;

      const enrichedCorrections: AttendanceCorrection[] = rawCorrections.map(c => {
        const rec = curRecords.find(r => r.id === c.attendance_record_id);
        const matchedSession = rec?.session || curSessions.find(s => s.id === rec?.attendance_session_id);
        const matchedStudent = curStudents.find(s => s.id === c.student_id);
        const matchedReviewer = curFaculty.find(f => f.id === c.reviewed_by);
        return {
          ...c,
          record: rec,
          session: matchedSession,
          student: matchedStudent,
          reviewer: matchedReviewer,
        };
      });

      setCorrections(enrichedCorrections);
      erpStorage.setCorrections(enrichedCorrections);
    } catch (err) {
      console.error('Failed to refresh corrections:', err);
    }
  }, []);

  const refreshFaculty = useCallback(async () => {
    try {
      const loadedFaculty = await supabaseService.fetchFaculty();
      setFaculty(loadedFaculty);
      erpStorage.setFaculty(loadedFaculty);
    } catch (err) {
      console.error('Failed to refresh faculty:', err);
    }
  }, []);

  const refreshSections = useCallback(async () => {
    try {
      const loadedSections = await supabaseService.fetchSections();
      setSections(loadedSections);
      erpStorage.setSections(loadedSections);
    } catch (err) {
      console.error('Failed to refresh sections:', err);
    }
  }, []);

  const refreshSubjects = useCallback(async () => {
    try {
      const loadedSubjects = await supabaseService.fetchSubjects();
      setSubjects(loadedSubjects);
      erpStorage.setSubjects(loadedSubjects);
    } catch (err) {
      console.error('Failed to refresh subjects:', err);
    }
  }, []);

  const refreshAssignments = useCallback(async () => {
    try {
      const rawAssignments = await supabaseService.fetchAssignments(true);
      const curFaculty = facultyRef.current;
      const curSubjects = subjectsRef.current;
      const curSections = sectionsRef.current;
      const curSemesters = semestersRef.current;
      const curYears = yearsRef.current;

      const enrichedAssignments: FacultySubjectAssignment[] = (rawAssignments || [])
        .filter(a => a.active !== false)
        .map(a => {
          const sec = curSections.find(s => s.id === a.section_id);
          const sem = curSemesters.find(s => s.id === (a.semester_id || sec?.semester_id));
          const yr = curYears.find(y => y.id === (a.academic_year_id || sem?.academic_year_id));
          return {
            ...a,
            faculty: curFaculty.find(f => f.id === a.faculty_id),
            subject: curSubjects.find(s => s.id === a.subject_id),
            section: sec,
            semester: sem,
            academic_year: yr,
            semester_id: a.semester_id || sem?.id,
            academic_year_id: a.academic_year_id || yr?.id,
          };
        });

      setAssignments(enrichedAssignments);
      erpStorage.setAssignments(enrichedAssignments);
    } catch (err) {
      console.error('Failed to refresh assignments:', err);
    }
  }, []);

  const refreshAssessments = useCallback(async () => {
    try {
      const data = await supabaseService.fetchAssessments();
      const curSubjects = subjectsRef.current;
      const curFaculty = facultyRef.current;
      const curSections = sectionsRef.current;
      const curStudents = studentsRef.current;

      const enrichedCourseAssignments: Assignment[] = data.courseAssignments.map(a => ({
        ...a,
        subject: curSubjects.find(s => s.id === a.subject_id),
        faculty: curFaculty.find(f => f.id === a.faculty_id),
        section: curSections.find(sec => sec.id === a.section_id),
      }));

      const enrichedSubmissions: AssignmentSubmission[] = data.assignmentSubmissions.map(sub => ({
        ...sub,
        student: curStudents.find(s => s.id === sub.student_id),
        assignment: enrichedCourseAssignments.find(a => a.id === sub.assignment_id),
        grader: curFaculty.find(f => f.id === sub.graded_by),
      }));

      const enrichedQuizzes: Quiz[] = data.quizzes.map(q => ({
        ...q,
        subject: curSubjects.find(s => s.id === q.subject_id),
        faculty: curFaculty.find(f => f.id === q.faculty_id),
        section: curSections.find(sec => sec.id === q.section_id),
      }));

      const enrichedQuizResults: QuizResult[] = data.quizResults.map(qr => ({
        ...qr,
        student: curStudents.find(s => s.id === qr.student_id),
        quiz: enrichedQuizzes.find(q => q.id === qr.quiz_id),
        grader: curFaculty.find(f => f.id === qr.graded_by),
      }));

      const enrichedAssessments: SessionalAssessment[] = data.sessionalAssessments.map(sa => ({
        ...sa,
        subject: curSubjects.find(s => s.id === sa.subject_id),
        faculty: curFaculty.find(f => f.id === sa.faculty_id),
        section: curSections.find(sec => sec.id === sa.section_id),
      }));

      const enrichedSessionalMarks: SessionalMark[] = data.sessionalMarks.map(sm => ({
        ...sm,
        student: curStudents.find(s => s.id === sm.student_id),
        subject: curSubjects.find(s => s.id === sm.subject_id),
        faculty: curFaculty.find(f => f.id === sm.faculty_id),
        section: curSections.find(sec => sec.id === sm.section_id),
        sessional_assessment: enrichedAssessments.find(a => a.id === sm.sessional_assessment_id),
      }));

      const enrichedMarksHistory: MarksHistory[] = data.marksHistory.map(mh => ({
        ...mh,
        student: curStudents.find(s => s.id === mh.student_id),
        subject: curSubjects.find(s => s.id === mh.subject_id),
      }));

      setCourseAssignments(enrichedCourseAssignments);
      setAssignmentSubmissions(enrichedSubmissions);
      setQuizzes(enrichedQuizzes);
      setQuizResults(enrichedQuizResults);
      setSessionalAssessments(enrichedAssessments);
      setSessionalMarks(enrichedSessionalMarks);
      setMarksHistory(enrichedMarksHistory);
    } catch (err) {
      console.error('Failed to refresh assessments:', err);
    }
  }, []);

  // Table-specific debouncing to prevent event storms while remaining responsive
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  const debounceTableSync = useCallback((table: string, callback: () => void, delay = 80) => {
    if (debounceTimersRef.current[table]) {
      clearTimeout(debounceTimersRef.current[table]);
    }
    debounceTimersRef.current[table] = setTimeout(() => {
      callback();
    }, delay);
  }, []);

  // Initial load
  useEffect(() => {
    loadDataFromSupabase(true);
  }, [loadDataFromSupabase]);

  // Realtime Supabase Channel Subscription with granular event handlers
  useEffect(() => {
    const channel = supabase
      .channel('vctm-erp-realtime-channel')
      .on('broadcast', { event: 'timetable_updated' }, (payload: any) => {
        const secId = payload?.payload?.section_id;
        const action = payload?.payload?.action;
        if (action === 'DELETED' && secId) {
          setTimetable(prev => {
            const rem = prev.filter(t => t.section_id !== secId);
            erpStorage.setTimetable(rem);
            return rem;
          });
          setAssignments(prev => {
            const rem = prev.filter(a => a.section_id !== secId);
            erpStorage.setAssignments(rem);
            return rem;
          });
        }
        refreshTimetable(secId);
        if (action === 'DELETED') {
          refreshAssignments();
        }
      })
      .on('broadcast', { event: 'attendance_updated' }, () => {
        refreshAttendance();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        debounceTableSync('students', () => refreshStudents());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_entries' }, (payload: any) => {
        const secId = payload?.new?.section_id || payload?.old?.section_id;
        debounceTableSync('timetable_entries', () => refreshTimetable(secId));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
        debounceTableSync('attendance', () => refreshAttendance());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
        debounceTableSync('attendance', () => refreshAttendance());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_corrections' }, () => {
        debounceTableSync('attendance_corrections', () => refreshCorrections());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty' }, () => {
        debounceTableSync('faculty', () => refreshFaculty());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, () => {
        debounceTableSync('sections', () => refreshSections());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, () => {
        debounceTableSync('subjects', () => refreshSubjects());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty_subject_assignments' }, () => {
        debounceTableSync('faculty_subject_assignments', () => refreshAssignments());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        debounceTableSync('assessments', () => refreshAssessments());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions' }, () => {
        debounceTableSync('assessments', () => refreshAssessments());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
        debounceTableSync('assessments', () => refreshAssessments());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_results' }, () => {
        debounceTableSync('assessments', () => refreshAssessments());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessional_assessments' }, () => {
        debounceTableSync('assessments', () => refreshAssessments());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessional_marks' }, () => {
        debounceTableSync('assessments', () => refreshAssessments());
      })
      .subscribe();

    return () => {
      Object.values(debounceTimersRef.current).forEach(t => clearTimeout(t));
      supabase.removeChannel(channel);
    };
  }, [debounceTableSync, refreshStudents, refreshTimetable, refreshAttendance, refreshCorrections, refreshFaculty, refreshSections, refreshSubjects, refreshAssignments, refreshAssessments]);

  const refreshData = async (forceRefreshMaster = false) => {
    await loadDataFromSupabase(forceRefreshMaster);
  };

  // 1. Take / Save Attendance
  const saveAttendance = async (params: {
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
  }) => {
    const result = await supabaseService.saveAttendance(params);
    await refreshAttendance();
    return result;
  };

  const deleteAttendanceSession = async (sessionId: string) => {
    const result = await supabaseService.deleteAttendanceSession(sessionId);
    await refreshAttendance();
    return result;
  };

  // 2. Submit Attendance Correction / Claim Request
  const submitCorrectionRequest = async (params: {
    attendanceRecordId?: string;
    timetableEntryId?: string;
    sessionDate?: string;
    subjectId?: string;
    facultyId?: string;
    sectionId?: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }) => {
    // 1. Authoritative path: If timetableEntryId is present, execute server-side claimAttendance RPC
    if (params.timetableEntryId) {
      const claimRes = await supabaseService.claimAttendance({
        timetableEntryId: params.timetableEntryId,
        studentId: params.studentId,
        reason: params.reason,
        requestedStatus: params.requestedStatus,
      });

      erpStorage.submitCorrectionRequest({
        attendanceRecordId: claimRes.recordId || params.attendanceRecordId || '',
        studentId: params.studentId,
        requestedStatus: params.requestedStatus,
        reason: params.reason,
      });

      await Promise.all([refreshCorrections(), refreshAttendance()]);
      return {
        id: claimRes.claimId || '',
        attendance_record_id: claimRes.recordId || '',
        student_id: params.studentId,
        requested_status: params.requestedStatus,
        reason: params.reason,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as AttendanceCorrection;
    }

    // 2. Fallback path if attendanceRecordId is provided directly
    let recId = params.attendanceRecordId;

    if (!recId) {
      throw new Error('Unable to resolve attendance record for this claim.');
    }

    // Validate duplicate
    const existing = corrections.find(
      c => c.attendance_record_id === recId &&
           (c.status === 'pending' || c.status === 'approved')
    );
    if (existing) {
      throw new Error(`A claim for this lecture has already been submitted (Status: ${existing.status.toUpperCase()}).`);
    }

    const res = await supabaseService.submitCorrection({
      attendanceRecordId: recId,
      studentId: params.studentId,
      requestedStatus: params.requestedStatus,
      reason: params.reason,
    });
    erpStorage.submitCorrectionRequest({
      attendanceRecordId: recId,
      studentId: params.studentId,
      requestedStatus: params.requestedStatus,
      reason: params.reason,
    });
    await Promise.all([refreshCorrections(), refreshAttendance()]);
    return res;
  };

  // 3. Review Correction Request (Approve / Reject)
  const reviewCorrectionRequest = async (params: {
    correctionId: string;
    status: 'approved' | 'rejected';
    reviewerFacultyId: string;
    reviewRemarks?: string;
  }) => {
    const res = await supabaseService.reviewCorrection(params);
    erpStorage.reviewCorrectionRequest(params);
    await refreshCorrections();
    await refreshAttendance();
    return res;
  };

  // 4. Validate whether student can submit a claim (Strict 09:00 AM - 03:40 PM IST Window)
  const canSubmitClaim = (params: {
    attendanceRecordId?: string;
    sessionDate: string;
    lectureType?: string;
    isBreak?: boolean;
    timetableEntryId?: string;
  }): { canSubmit: boolean; message?: string; existingClaim?: AttendanceCorrection; code?: string } => {
    // Check non-instructional slots (Lunch/Break)
    if (params.isBreak || params.lectureType === 'Lunch' || params.lectureType === 'Break') {
      return {
        canSubmit: false,
        code: 'ATTENDANCE_NOT_APPLICABLE',
        message: 'Attendance claim is not applicable for lunch or break periods.',
      };
    }

    // Date check: Student claim is strictly permitted for TODAY only
    const today = getISTTodayDate();
    if (params.sessionDate !== today) {
      if (params.sessionDate < today) {
        return {
          canSubmit: false,
          code: 'CLAIM_DATE_PAST',
          message: 'Attendance claims are closed for past dates. You may view your attendance history only.',
        };
      }
      return {
        canSubmit: false,
        code: 'CLAIM_DATE_FUTURE',
        message: 'Attendance claim is not available for future dates.',
      };
    }

    // Time window check (09:00:00 AM - 03:40:00 PM IST)
    const windowStatus = getClaimWindowStatus();
    if (windowStatus === 'BEFORE_WINDOW') {
      return {
        canSubmit: false,
        code: 'ATTENDANCE_CLAIM_NOT_OPEN',
        message: 'Attendance claim window opens at 09:00 AM. Claims are accepted between 09:00 AM and 03:40 PM IST.',
      };
    }
    if (windowStatus === 'CLOSED') {
      return {
        canSubmit: false,
        code: 'ATTENDANCE_CLAIM_WINDOW_CLOSED',
        message: 'Attendance claim window closed at 03:40 PM. New claims cannot be submitted today.',
      };
    }

    // Duplicate claim check
    if (params.attendanceRecordId) {
      const existing = corrections.find(
        c => c.attendance_record_id === params.attendanceRecordId &&
             (c.status === 'pending' || c.status === 'approved')
      );
      if (existing) {
        return {
          canSubmit: false,
          code: 'CLAIM_ALREADY_SUBMITTED',
          message: `Claim already submitted (Status: ${existing.status.toUpperCase()}).`,
          existingClaim: existing,
        };
      }
    }

    return { canSubmit: true };
  };

  // 5. Admin Master Data Operations
  const addDepartment = async (dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addDepartment(dept);
    erpStorage.addDepartment(dept);
    await refreshData();
    return res;
  };

  const updateDepartment = async (id: string, updates: Partial<Department>) => {
    const res = await supabaseService.updateDepartment(id, updates);
    erpStorage.updateDepartment(id, updates);
    await refreshData();
    return res;
  };

  const deleteDepartment = async (id: string) => {
    const res = await supabaseService.deleteDepartment(id);
    erpStorage.deleteDepartment(id);
    await refreshData();
    return res;
  };

  const addProgram = async (prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addProgram(prog);
    erpStorage.addProgram(prog);
    await refreshData();
    return res;
  };

  const updateProgram = async (id: string, updates: Partial<Program>) => {
    const res = await supabaseService.updateProgram(id, updates);
    erpStorage.updateProgram(id, updates);
    await refreshData();
    return res;
  };

  const deleteProgram = async (id: string) => {
    const res = await supabaseService.deleteProgram(id);
    erpStorage.deleteProgram(id);
    await refreshData();
    return res;
  };

  const addSection = async (sec: Omit<Section, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addSection(sec);
    erpStorage.addSection(sec);
    await refreshSections();
    return res;
  };

  const updateSection = async (id: string, updates: Partial<Section>) => {
    const res = await supabaseService.updateSection(id, updates);
    erpStorage.updateSection(id, updates);
    await refreshSections();
    return res;
  };

  const deleteSection = async (id: string) => {
    const res = await supabaseService.deleteSection(id);
    erpStorage.deleteSection(id);
    await refreshSections();
    return res;
  };

  const addAcademicYear = async (year: Omit<AcademicYear, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addAcademicYear(year);
    await refreshData(true);
    return res;
  };

  const updateAcademicYear = async (id: string, updates: Partial<AcademicYear>) => {
    const res = await supabaseService.updateAcademicYear(id, updates);
    await refreshData(true);
    return res;
  };

  const deleteAcademicYear = async (id: string) => {
    const res = await supabaseService.deleteAcademicYear(id);
    await refreshData(true);
    return res;
  };

  const addSemester = async (sem: Omit<Semester, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addSemester(sem);
    await refreshData(true);
    return res;
  };

  const updateSemester = async (id: string, updates: Partial<Semester>) => {
    const res = await supabaseService.updateSemester(id, updates);
    await refreshData(true);
    return res;
  };

  const deleteSemester = async (id: string) => {
    const res = await supabaseService.deleteSemester(id);
    await refreshData(true);
    return res;
  };

  const addFaculty = async (fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addFaculty(fac);
    await refreshFaculty();
    return res;
  };

  const createFacultyWithAssignments = async (params: {
    faculty: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>;
    assignments: Array<{
      academic_year_id: string;
      semester_id: string;
      section_id: string;
      subject_id: string;
    }>;
    actorName?: string;
  }) => {
    const res = await supabaseService.createFacultyWithAssignments(params);
    await Promise.all([refreshFaculty(), refreshAssignments()]);
    return res;
  };

  const updateFaculty = async (id: string, updates: Partial<Faculty>) => {
    const res = await supabaseService.updateFaculty(id, updates);
    await refreshFaculty();
    return res;
  };

  const updateFacultyWithAssignments = async (params: {
    facultyId: string;
    updates: Partial<Faculty>;
    assignments?: Array<{
      academic_year_id: string;
      semester_id: string;
      section_id: string;
      subject_id: string;
    }>;
    actorName?: string;
  }) => {
    const res = await supabaseService.updateFacultyWithAssignments(params);
    await Promise.all([refreshFaculty(), refreshAssignments()]);
    return res;
  };

  const setFacultyStatus = async (facultyId: string, status: 'ACTIVE' | 'BLOCKED', reason?: string, actorName?: string) => {
    const res = await supabaseService.setFacultyStatus(facultyId, status, reason, actorName);
    await Promise.all([refreshFaculty(), refreshAssignments()]);
    return res;
  };

  const checkFacultyHistoricalRecords = async (facultyId: string) => {
    return await supabaseService.checkFacultyHistoricalRecords(facultyId);
  };

  const safeDeleteFaculty = async (facultyId: string, actorName?: string) => {
    const res = await supabaseService.safeDeleteFaculty(facultyId, actorName);
    await Promise.all([refreshFaculty(), refreshAssignments(), refreshTimetable()]);
    return res;
  };

  const deleteFaculty = async (id: string) => {
    const res = await supabaseService.deleteFaculty(id);
    await Promise.all([refreshFaculty(), refreshAssignments(), refreshTimetable()]);
    return res;
  };

  const addSubject = async (sub: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addSubject(sub);
    erpStorage.addSubject(sub);
    await refreshSubjects();
    return res;
  };

  const updateSubject = async (id: string, updates: Partial<Subject>) => {
    const res = await supabaseService.updateSubject(id, updates);
    erpStorage.updateSubject(id, updates);
    await refreshSubjects();
    return res;
  };

  const deleteSubject = async (id: string) => {
    const res = await supabaseService.deleteSubject(id);
    erpStorage.deleteSubject(id);
    await refreshSubjects();
    return res;
  };

  const addAssignment = async (assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) => {
    const res = await supabaseService.addAssignment(assign);
    erpStorage.addAssignment(assign);
    await refreshAssignments();
    return res;
  };

  const updateFacultyAssignment = async (id: string, updates: Partial<FacultySubjectAssignment>) => {
    const res = await supabaseService.updateFacultyAssignment(id, updates);
    erpStorage.updateAssignment(id, updates);
    await refreshAssignments();
    return res;
  };

  const deleteAssignment = async (id: string) => {
    const res = await supabaseService.deleteAssignment(id);
    erpStorage.deleteAssignment(id);
    await refreshAssignments();
    return res;
  };

  const addStudent = async (studentData: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addStudent(studentData);
    await refreshStudents();
    await refreshData(true);
    return res;
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    const res = await supabaseService.updateStudent(id, updates);
    erpStorage.updateStudent(id, updates);
    await refreshStudents();
    await refreshData(true);
    return res;
  };

  const deleteStudent = async (id: string) => {
    const res = await supabaseService.deleteStudent(id);
    erpStorage.deleteStudent(id);
    await refreshStudents();
    return res;
  };

  const transferStudentSection = async (params: {
    studentId: string;
    newSectionId: string;
    transferredBy?: string;
  }) => {
    const res = await supabaseService.transferStudentSection(params);
    await refreshStudents();
    return res;
  };

  const batchImportSectionStudents = async (params: {
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
  }) => {
    const res = await supabaseService.batchImportSectionStudents(params);
    await refreshStudents();
    return res;
  };

  const addTimetableEntry = async (entry: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at'>) => {
    const conflict = checkTimetableConflict(entry);
    if (conflict) {
      throw new Error(conflict.message);
    }
    const res = await supabaseService.addTimetableEntry(entry);
    erpStorage.addTimetableEntry(entry);
    await refreshTimetable();
    return res;
  };

  const updateTimetableEntry = async (id: string, updates: Partial<TimetableEntry>) => {
    const res = await supabaseService.updateTimetableEntry(id, updates);
    erpStorage.updateTimetableEntry(id, updates);
    await refreshTimetable();
    return res;
  };

  const deleteTimetableEntry = async (id: string) => {
    const res = await supabaseService.deleteTimetableEntry(id);
    erpStorage.deleteTimetableEntry(id);
    await refreshTimetable();
    return res;
  };

  const saveSectionTimetable = async (params: {
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
  }) => {
    const res = await supabaseService.saveSectionTimetable(params);
    await refreshTimetable(params.sectionId);
    return res;
  };

  const rollbackToVersion = async (params: {
    versionId: string;
    restoredBy?: string;
  }) => {
    const res = await supabaseService.rollbackToVersion(params);
    await refreshTimetable();
    return res;
  };

  const deleteSectionTimetable = async (sectionId: string, deletedBy?: string) => {
    const res = await supabaseService.deleteSectionTimetable({ sectionId, deletedBy });
    setTimetable(prev => {
      const remaining = prev.filter(t => t.section_id !== sectionId);
      erpStorage.setTimetable(remaining);
      return remaining;
    });
    setAssignments(prev => {
      const updated = prev.filter(a => a.section_id !== sectionId);
      erpStorage.setAssignments(updated);
      return updated;
    });
    await refreshTimetable(sectionId);
    await refreshAssignments();
    return res.success;
  };

  const findOrCreateFaculty = async (params: {
    fullName: string;
    facultyCode?: string;
    employeeCode?: string;
    designation?: string;
    email?: string;
    phone?: string;
    departmentId: string;
  }) => {
    const res = await supabaseService.findOrCreateFaculty(params);
    setFaculty(prev => {
      const exists = prev.some(f => f.id === res.id);
      return exists ? prev.map(f => f.id === res.id ? res : f) : [...prev, res];
    });
    return res;
  };

  const findOrCreateSubject = async (params: {
    subjectName: string;
    subjectCode: string;
    departmentId: string;
    semesterId: string;
    programId?: string;
    lectureType?: LectureType;
    credits?: number;
  }) => {
    const res = await supabaseService.findOrCreateSubject(params);
    setSubjects(prev => {
      const exists = prev.some(s => s.id === res.id);
      return exists ? prev.map(s => s.id === res.id ? res : s) : [...prev, res];
    });
    return res;
  };

  const findOrCreateClassroom = async (params: {
    roomNumber: string;
    building?: string;
    roomType?: string;
    capacity?: number;
  }) => {
    const res = await supabaseService.findOrCreateClassroom(params);
    setClassrooms(prev => {
      const exists = prev.some(c => c.id === res.id);
      return exists ? prev.map(c => c.id === res.id ? res : c) : [...prev, res];
    });
    return res;
  };

  const saveSingleTimetableSlot = async (params: {
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
  }) => {
    const res = await supabaseService.saveSingleTimetableSlot(params);
    setTimetable(prev => {
      const filtered = prev.filter(t => 
        t.id !== res.entry.id && 
        !(t.section_id === params.sectionId && t.day_of_week === params.dayOfWeek && t.period_number === params.periodNumber)
      );
      const enriched: TimetableEntry = {
        ...res.entry,
        subject: subjects.find(s => s.id === res.entry.subject_id),
        faculty: faculty.find(f => f.id === res.entry.faculty_id),
        section: sections.find(sec => sec.id === res.entry.section_id),
      };
      const updated = [...filtered, enriched];
      erpStorage.setTimetable(updated);
      return updated;
    });
    await refreshTimetable(params.sectionId);
    await refreshAssignments();
    return res;
  };

  // 6. Timetable Conflict Engine
  const checkTimetableConflict = (entry: Omit<TimetableEntry, 'id'>, excludeId?: string): TimetableConflict | null => {
    const activeEntries = timetable.filter(t => {
      if (!t.active) return false;
      if (excludeId && t.id === excludeId) return false;
      // Exclude the same slot being edited
      if (entry.section_id && t.section_id === entry.section_id && t.day_of_week === entry.day_of_week && t.period_number === entry.period_number) {
        return false;
      }
      return true;
    });

    const toMins = (t?: string) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const hasTimeOverlap = (e1: { start_time?: string; end_time?: string; period_number: number }, e2: { start_time?: string; end_time?: string; period_number: number }) => {
      if (e1.start_time && e1.end_time && e2.start_time && e2.end_time) {
        const sA = toMins(e1.start_time);
        const eA = toMins(e1.end_time);
        const sB = toMins(e2.start_time);
        const eB = toMins(e2.end_time);
        if (eA > sA && eB > sB) {
          return sA < eB && sB < eA;
        }
      }
      return e1.period_number === e2.period_number;
    };

    // Rule 0: Invalid Time Check
    if (entry.start_time && entry.end_time && toMins(entry.end_time) <= toMins(entry.start_time)) {
      return {
        type: 'invalid_time',
        severity: 'blocking',
        message: `Invalid slot timing: End time (${entry.end_time}) must be later than start time (${entry.start_time}).`,
      };
    }

    // Rule 1: Same Section Intra-Slot Collision
    if (entry.section_id) {
      const sameSecConflict = activeEntries.find(
        t => t.section_id === entry.section_id &&
             t.day_of_week === entry.day_of_week &&
             hasTimeOverlap(entry, t)
      );
      if (sameSecConflict) {
        const sec = sections.find(s => s.id === entry.section_id);
        const sub = subjects.find(s => s.id === sameSecConflict.subject_id);
        return {
          type: 'same_section',
          severity: 'blocking',
          message: `Same-section collision: Section ${sec?.name || ''} already has ${sub?.subject_code || 'a lecture'} scheduled on ${entry.day_of_week} Period ${entry.period_number} (${sameSecConflict.start_time || ''}–${sameSecConflict.end_time || ''}).`,
          conflictingEntry: sameSecConflict
        };
      }
    }

    // Rule 2: Faculty Double-Booking
    const facultyConflict = activeEntries.find(
      t => t.faculty_id === entry.faculty_id &&
           t.day_of_week === entry.day_of_week &&
           hasTimeOverlap(entry, t)
    );

    if (facultyConflict) {
      const fac = faculty.find(f => f.id === entry.faculty_id);
      const conflictSec = sections.find(s => s.id === facultyConflict.section_id);
      return {
        type: 'faculty',
        severity: 'blocking',
        message: `Faculty conflict: ${fac?.full_name || 'Faculty'} is already scheduled to teach Section ${conflictSec?.name || 'Unknown'} during Period ${entry.period_number} on ${entry.day_of_week} (${facultyConflict.start_time || ''}–${facultyConflict.end_time || ''}).`,
        conflictingEntry: facultyConflict
      };
    }

    // Rule 3: Room Collision
    if (entry.room_number) {
      const roomConflict = activeEntries.find(
        t => t.room_number &&
             t.room_number.toLowerCase().trim() === entry.room_number.toLowerCase().trim() &&
             t.day_of_week === entry.day_of_week &&
             hasTimeOverlap(entry, t)
      );

      if (roomConflict) {
        const conflictSec = sections.find(s => s.id === roomConflict.section_id);
        return {
          type: 'room',
          severity: 'blocking',
          message: `Room collision: ${entry.room_number} is already occupied by Section ${conflictSec?.name || 'Unknown'} during Period ${entry.period_number} on ${entry.day_of_week} (${roomConflict.start_time || ''}–${roomConflict.end_time || ''}).`,
          conflictingEntry: roomConflict
        };
      }
    }

    return null;
  };

  // 7. Calculate Student Overall Attendance strictly based on Supabase database
  const getStudentAttendance = (studentId: string): StudentOverallAttendance & {
    notRecordedCount: number;
    pendingClaimsCount: number;
  } => {
    const student = students.find(s => s.id === studentId);
    const studSectionId = student?.section_id;
    const studSection = sections.find(s => s.id === studSectionId);

    // All registered attendance records for this student
    const studentRecords = attendanceRecords.filter(r => r.student_id === studentId);

    // Target subjects for THIS student's section or assignments
    const sectionSubjectIds = new Set([
      ...assignments.filter(a => a.section_id === studSectionId && a.active !== false).map(a => a.subject_id),
      ...timetable.filter(t => t.section_id === studSectionId && t.active).map(t => t.subject_id)
    ]);

    const targetSubjects = subjects.filter(s => {
      if (!s.active) return false;
      if (sectionSubjectIds.size > 0) {
        return sectionSubjectIds.has(s.id);
      }
      if (student?.semester_id && s.semester_id) {
        return s.semester_id === student.semester_id;
      }
      if (student?.program_id && s.program_id) {
        return s.program_id === student.program_id;
      }
      return false;
    });

    const subjectStats: SubjectAttendanceStat[] = targetSubjects.map(sub => {
      // Find the specific assignment for THIS student's section
      const assignment = assignments.find(
        a => a.subject_id === sub.id && a.section_id === studSectionId
      ) || assignments.find(a => a.subject_id === sub.id);

      const assignedFac = faculty.find(f => f.id === assignment?.faculty_id) ||
                          faculty.find(f => timetable.some(t => t.subject_id === sub.id && t.section_id === studSectionId && t.faculty_id === f.id));

      // Student's individual actual attendance records for this subject
      const subRecords = studentRecords.filter(r => {
        const sess = attendanceSessions.find(s => s.id === r.attendance_session_id);
        return sess && sess.subject_id === sub.id && (studSectionId ? sess.section_id === studSectionId : true);
      });

      const attended = subRecords.filter(r => r.status === 'Present').length;
      const absent = subRecords.filter(r => r.status === 'Absent').length;
      const totalConducted = attended + absent;
      const percentage = totalConducted > 0 ? Math.round((attended / totalConducted) * 100) : null;

      return {
        subjectId: sub.id,
        subjectCode: sub.subject_code,
        subjectName: sub.subject_name,
        lectureType: sub.lecture_type,
        facultyName: assignedFac?.full_name || 'Faculty Member',
        totalConducted,
        attended,
        percentage,
        credits: sub.credits,
      };
    });

    const totalLectures = subjectStats.reduce((acc, curr) => acc + curr.totalConducted, 0);
    const presentLectures = subjectStats.reduce((acc, curr) => acc + curr.attended, 0);
    const overallPercentage = totalLectures > 0 ? Math.round((presentLectures / totalLectures) * 100) : null;

    // Student claims count
    const studentClaims = corrections.filter(c => c.student_id === studentId);
    const pendingClaimsCount = studentClaims.filter(c => c.status === 'pending').length;

    // Not recorded count for today
    const todayLectures = getTodayLecturesForStudent(studentId);
    const notRecordedCount = todayLectures.filter(l => l.status === 'Not Recorded').length;

    return {
      studentId,
      rollNumber: student?.roll_number || '—',
      fullName: student?.full_name || 'Student',
      sectionName: studSection?.name || '',
      totalLectures,
      presentLectures,
      percentage: overallPercentage,
      isDefaulter: totalLectures > 0 && overallPercentage !== null && overallPercentage < 75,
      subjectStats,
      notRecordedCount,
      pendingClaimsCount,
    };
  };

  // 8. Authoritative Master Timetable Query (Single Source of Truth for HOD, Faculty, Student, Attendance)
  const getPublishedTimetable = useCallback((filter?: TimetableQueryFilter): TimetableEntry[] => {
    let result = timetable;

    if (filter?.activeOnly !== false) {
      result = result.filter(t => t.active !== false);
    }

    if (filter?.sectionId) {
      result = result.filter(t => t.section_id === filter.sectionId || t.section?.id === filter.sectionId);
    }

    if (filter?.facultyId) {
      result = result.filter(t => t.faculty_id === filter.facultyId || t.faculty?.id === filter.facultyId);
    }

    if (filter?.dayOfWeek) {
      result = result.filter(t => t.day_of_week === filter.dayOfWeek);
    }

    if (filter?.subjectId) {
      result = result.filter(t => t.subject_id === filter.subjectId || t.subject?.id === filter.subjectId);
    }

    const daysOrder: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return [...result].sort((a, b) => {
      const dA = daysOrder.indexOf(a.day_of_week);
      const dB = daysOrder.indexOf(b.day_of_week);
      if (dA !== dB) return dA - dB;
      return a.period_number - b.period_number;
    });
  }, [timetable]);

  const getStudentTimetable = useCallback((studentId: string): TimetableEntry[] => {
    let student = students.find(s => s.id === studentId || s.roll_number === studentId);
    if (!student) {
      const sessionUser = erpStorage.getCurrentSessionUser();
      if (sessionUser?.student?.id === studentId || sessionUser?.student?.roll_number === studentId || sessionUser?.id === studentId) {
        student = sessionUser.student;
      }
    }
    const sectionId = student?.section_id || student?.section?.id || erpStorage.getCurrentSessionUser()?.student?.section_id;
    if (!sectionId) return [];

    return getPublishedTimetable({ sectionId });
  }, [students, getPublishedTimetable]);

  const getFacultyTimetable = useCallback((facultyId: string, dayOfWeek?: DayOfWeek): TimetableEntry[] => {
    if (!facultyId) return [];
    return getPublishedTimetable({ facultyId, dayOfWeek });
  }, [getPublishedTimetable]);

  // 9. Get Today's Live Attendance Lectures for Student (Consumes Same Authoritative Timetable)
  const getTodayLecturesForStudent = (studentId: string, customDateStr?: string): TodayAttendanceLecture[] => {
    let student = students.find(s => s.id === studentId || s.roll_number === studentId);
    if (!student) {
      const sessionUser = erpStorage.getCurrentSessionUser();
      if (sessionUser?.student?.id === studentId || sessionUser?.student?.roll_number === studentId || sessionUser?.id === studentId) {
        student = sessionUser.student;
      }
    }
    const sectionId = student?.section_id || student?.section?.id || erpStorage.getCurrentSessionUser()?.student?.section_id;
    if (!sectionId) return [];

    const defaultDateStr = getISTTodayDate();
    const targetDateStr = customDateStr || defaultDateStr;
    const dayOfWeek: DayOfWeek = getISTDayOfWeek(targetDateStr);

    if (dayOfWeek === 'SUN') return [];

    const allStudentEntries = getStudentTimetable(studentId);
    const sectionEntries = allStudentEntries.filter(t => t.day_of_week === dayOfWeek);

    return sectionEntries.map(entry => {
      const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
      const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;
      const sec = sections.find(s => s.id === entry.section_id) || entry.section;

      // Check if session was conducted on this date
      const session = attendanceSessions.find(
        s => s.session_date === targetDateStr &&
             (s.timetable_entry_id === entry.id ||
              (s.section_id === entry.section_id &&
               s.subject_id === entry.subject_id &&
               (s.start_time?.substring(0, 5) === entry.start_time?.substring(0, 5) || !s.start_time)))
      );

      let status: 'Present' | 'Absent' | 'Not Recorded' = 'Not Recorded';
      let recordId: string | undefined = undefined;
      let claimId: string | undefined = undefined;
      let claimStatus: 'pending' | 'approved' | 'rejected' | undefined = undefined;
      let claimReason: string | undefined = undefined;
      let claimReviewRemarks: string | undefined = undefined;

      if (session) {
        const rec = attendanceRecords.find(
          r => r.attendance_session_id === session.id && r.student_id === studentId
        );
        if (rec) {
          status = rec.status;
          recordId = rec.id;

          // Check if there is an attendance claim
          const claim = corrections.find(c => c.attendance_record_id === rec.id);
          if (claim) {
            claimId = claim.id;
            claimStatus = claim.status;
            claimReason = claim.reason;
            claimReviewRemarks = claim.review_remarks;
          }
        }
      }

      return {
        timetableEntryId: entry.id,
        dayOfWeek: entry.day_of_week,
        periodNumber: entry.period_number,
        startTime: entry.start_time?.substring(0, 5) || '09:00',
        endTime: entry.end_time?.substring(0, 5) || '09:50',
        subjectId: entry.subject_id || '',
        subjectCode: sub?.subject_code || '',
        subjectName: sub?.subject_name || (entry.lecture_type === 'Lunch' ? 'Lunch Break' : ''),
        facultyId: entry.faculty_id || '',
        facultyName: fac?.full_name || '',
        facultyCode: fac?.faculty_code || fac?.employee_code,
        roomNumber: entry.room_number || sec?.room_number || '',
        lectureType: entry.lecture_type || 'Theory',
        sectionId: entry.section_id,
        sectionName: sec?.name || '',
        sessionDate: targetDateStr,
        status,
        attendanceRecordId: recordId,
        attendanceSessionId: session?.id,
        claimId,
        claimStatus,
        claimReason,
        claimReviewRemarks,
      };
    });
  };

  // 9. Get Date-wise Historical Lectures for Student
  const getDateLecturesForStudent = (studentId: string, dateStr: string): DateWiseAttendanceSummary => {
    const dayOfWeek: DayOfWeek = getISTDayOfWeek(dateStr);

    const lectures = getTodayLecturesForStudent(studentId, dateStr);
    const presentCount = lectures.filter(l => l.status === 'Present').length;
    const absentCount = lectures.filter(l => l.status === 'Absent').length;
    const notRecordedCount = lectures.filter(l => l.status === 'Not Recorded').length;

    return {
      dateStr,
      dayOfWeek,
      lectures,
      totalLectures: lectures.length,
      presentCount,
      absentCount,
      notRecordedCount,
    };
  };

  // 10. Filter Attendance Claims strictly for the assigned faculty
  const getFacultyCorrectionRequests = (facultyId: string): AttendanceCorrection[] => {
    const myAssignments = assignments.filter(a => a.faculty_id === facultyId);

    return corrections.filter(c => {
      // If already reviewed by this faculty
      if (c.reviewed_by === facultyId) return true;

      const rec = c.record || attendanceRecords.find(r => r.id === c.attendance_record_id);
      const sess = rec?.session || attendanceSessions.find(s => s.id === rec?.attendance_session_id);

      if (!sess) return false;

      // Match 1: Faculty conducted this session
      if (sess.faculty_id === facultyId) return true;

      // Match 2: Faculty is assigned to this subject & section
      const isAssigned = myAssignments.some(
        a => a.subject_id === sess.subject_id && a.section_id === sess.section_id
      );
      return isAssigned;
    });
  };

  // 11. Legacy getTodaySchedule adapter
  const getTodaySchedule = (params: {
    dayOfWeek: DayOfWeek;
    sectionId?: string;
    facultyId?: string;
    studentId?: string;
    dateStr: string;
  }): TodayLectureItem[] => {
    let entries = timetable.filter(t => t.day_of_week === params.dayOfWeek && t.active);

    if (params.sectionId) {
      entries = entries.filter(t => t.section_id === params.sectionId);
    } else if (params.facultyId) {
      entries = entries.filter(t => t.faculty_id === params.facultyId);
    }

    entries.sort((a, b) => a.period_number - b.period_number);

    return entries.map(entry => {
      const sub = subjects.find(s => s.id === entry.subject_id);
      const fac = faculty.find(f => f.id === entry.faculty_id);
      const sec = sections.find(s => s.id === entry.section_id);

      const session = attendanceSessions.find(
        s => s.session_date === params.dateStr &&
             (s.timetable_entry_id === entry.id ||
              (s.section_id === entry.section_id &&
               s.subject_id === entry.subject_id &&
               (s.start_time?.substring(0, 5) === entry.start_time?.substring(0, 5) || !s.start_time)))
      );

      let studentStatus: AttendanceStatus | 'Not Recorded' = 'Not Recorded';
      if (session && params.studentId) {
        const rec = attendanceRecords.find(
          r => r.attendance_session_id === session.id && r.student_id === params.studentId
        );
        if (rec) studentStatus = rec.status;
      }

      return {
        timetableEntryId: entry.id,
        dayOfWeek: entry.day_of_week,
        periodNumber: entry.period_number,
        startTime: entry.start_time,
        endTime: entry.end_time,
        subjectCode: sub?.subject_code || '',
        subjectName: sub?.subject_name || 'Subject',
        facultyName: fac?.full_name || 'Faculty',
        facultyCode: fac?.faculty_code || fac?.employee_code,
        roomNumber: entry.room_number,
        lectureType: entry.lecture_type,
        sectionName: sec?.name || '',
        sectionId: entry.section_id,
        attendanceTaken: !!session,
        attendanceSessionId: session?.id,
        studentStatus,
      };
    });
  };

  // ========================================================
  // ASSESSMENT MODULE ACTION HANDLERS
  // ========================================================
  const createAssignment = async (data: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.createAssignment(data);
    await refreshAssessments();
    return res;
  };

  const updateAssignment = async (id: string, updates: Partial<Assignment>) => {
    const res = await supabaseService.updateAssignment(id, updates);
    await refreshAssessments();
    return res;
  };

  const deleteCourseAssignment = async (id: string) => {
    const res = await supabaseService.deleteCourseAssignment(id);
    await refreshAssessments();
    return res;
  };

  const submitAssignment = async (submission: {
    assignmentId: string;
    studentId: string;
    submissionType: string;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    googleFormSubmitted?: boolean;
  }) => {
    const res = await supabaseService.submitAssignment(submission);
    await refreshAssessments();
    return res;
  };

  const gradeAssignmentSubmission = async (params: {
    submissionId: string;
    marksObtained: number;
    feedback?: string;
    facultyId: string;
  }) => {
    const res = await supabaseService.gradeAssignmentSubmission(params);
    await refreshAssessments();
    return res;
  };

  const createQuiz = async (quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.createQuiz(quiz);
    await refreshAssessments();
    return res;
  };

  const updateQuiz = async (id: string, updates: Partial<Quiz>) => {
    const res = await supabaseService.updateQuiz(id, updates);
    await refreshAssessments();
    return res;
  };

  const deleteQuiz = async (id: string) => {
    const res = await supabaseService.deleteQuiz(id);
    await refreshAssessments();
    return res;
  };

  const saveQuizMarks = async (params: {
    quizId: string;
    facultyId: string;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
  }) => {
    const res = await supabaseService.saveQuizMarks(params);
    await refreshAssessments();
    return res;
  };

  const createSessionalAssessment = async (data: Omit<SessionalAssessment, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.createSessionalAssessment(data);
    await refreshAssessments();
    return res;
  };

  const updateSessionalAssessment = async (id: string, updates: Partial<SessionalAssessment>) => {
    const res = await supabaseService.updateSessionalAssessment(id, updates);
    await refreshAssessments();
    return res;
  };

  const deleteSessionalAssessment = async (id: string) => {
    const res = await supabaseService.deleteSessionalAssessment(id);
    await refreshAssessments();
    return res;
  };

  const saveSessionalMarks = async (params: {
    sessionalAssessmentId?: string;
    facultyId: string;
    subjectId: string;
    sectionId: string;
    sessionalType?: string;
    maxMarks: number;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }>;
  }) => {
    const res = await supabaseService.saveSessionalMarks(params);
    await refreshAssessments();
    return res;
  };

  const getStudentAcademicScorecard = (studentId: string): StudentSubjectAcademicReport[] => {
    const student = students.find(s => s.id === studentId);
    if (!student) return [];

    const studentAtt = getStudentAttendance(studentId);
    const result: StudentSubjectAcademicReport[] = [];

    for (const stat of studentAtt.subjectStats) {
      // Dynamic Sessional Assessments for student's section & subject
      const subAssessments = sessionalAssessments.filter(
        sa => sa.subject_id === stat.subjectId && (!sa.section_id || sa.section_id === student.section_id)
      );

      // Deduplicate assessments by title to prevent duplicate rows
      const seenTitles = new Set<string>();
      const uniqueAssessments = subAssessments.filter(sa => {
        const key = sa.title.toLowerCase().trim();
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });

      const dynamicSessionals = uniqueAssessments.map(sa => {
        const sm = sessionalMarks.find(m => m.sessional_assessment_id === sa.id && m.student_id === studentId);
        return {
          assessmentId: sa.id,
          title: sa.title,
          maxMarks: sa.max_marks,
          obtainedMarks: sm ? sm.marks_obtained : undefined,
          examDate: sa.exam_date,
        };
      });

      // Legacy sessional entries (if any were entered directly by type)
      const subSessional = sessionalMarks.filter(sm => sm.student_id === studentId && sm.subject_id === stat.subjectId);
      const s1 = subSessional.find(s => s.sessional_type === 'Sessional 1');
      const s2 = subSessional.find(s => s.sessional_type === 'Sessional 2');
      const put = subSessional.find(s => s.sessional_type === 'Pre-University Test');
      const fin = subSessional.find(s => s.sessional_type === 'Final Sessional');

      // Match dynamic sessionals for standard 3 components
      const s1Dyn = dynamicSessionals.find(s => s.title.toLowerCase() === 'sessional 1');
      const s2Dyn = dynamicSessionals.find(s => s.title.toLowerCase() === 'sessional 2');
      const putDyn = dynamicSessionals.find(s => 
        s.title.toLowerCase() === 'pre-university test' || 
        s.title.toLowerCase() === 'put' || 
        s.title.toLowerCase().includes('pre-university') ||
        s.title.toLowerCase().includes('pre university')
      );

      const sessional1Val = s1Dyn 
        ? { obtained: s1Dyn.obtainedMarks, max: s1Dyn.maxMarks }
        : (s1 ? { obtained: s1.marks_obtained, max: s1.max_marks || 30 } : undefined);

      const sessional2Val = s2Dyn 
        ? { obtained: s2Dyn.obtainedMarks, max: s2Dyn.maxMarks }
        : (s2 ? { obtained: s2.marks_obtained, max: s2.max_marks || 30 } : undefined);

      const putVal = putDyn 
        ? { obtained: putDyn.obtainedMarks, max: putDyn.maxMarks }
        : (put ? { obtained: put.marks_obtained, max: put.max_marks || 100 } : undefined);

      const otherSessionals = dynamicSessionals.filter(s => 
        s !== s1Dyn && s !== s2Dyn && s !== putDyn
      );

      const subQuizzes = quizzes.filter(q => q.subject_id === stat.subjectId && q.section_id === student.section_id);
      const quizMarksList = subQuizzes.map(q => {
        const qr = quizResults.find(r => r.quiz_id === q.id && r.student_id === studentId);
        return {
          quizId: q.id,
          title: q.title,
          maxMarks: q.max_marks,
          obtainedMarks: qr?.marks_obtained,
          quizDate: q.quiz_date,
        };
      });

      const subAssignments = courseAssignments.filter(a => a.subject_id === stat.subjectId && a.section_id === student.section_id);
      const assignmentMarksList = subAssignments.map(a => {
        const sub = assignmentSubmissions.find(s => s.assignment_id === a.id && s.student_id === studentId);
        return {
          assignmentId: a.id,
          title: a.title,
          maxMarks: a.max_marks,
          obtainedMarks: sub?.marks_obtained,
          status: sub ? sub.status : 'not_started',
          dueDate: a.due_date,
        };
      });

      let totalScore = 0;
      let maxScore = 0;

      // Add scores from dynamic sessionals
      for (const ds of dynamicSessionals) {
        if (ds.obtainedMarks !== undefined) {
          totalScore += ds.obtainedMarks;
          maxScore += ds.maxMarks;
        }
      }

      // Add legacy sessional scores if dynamic list is empty
      if (dynamicSessionals.length === 0) {
        if (s1) { totalScore += s1.marks_obtained; maxScore += s1.max_marks || 30; }
        if (s2) { totalScore += s2.marks_obtained; maxScore += s2.max_marks || 30; }
        if (put) { totalScore += put.marks_obtained; maxScore += put.max_marks || 100; }
      }

      for (const q of quizMarksList) {
        if (q.obtainedMarks !== undefined) {
          totalScore += q.obtainedMarks;
          maxScore += q.maxMarks;
        }
      }
      for (const a of assignmentMarksList) {
        if (a.obtainedMarks !== undefined) {
          totalScore += a.obtainedMarks;
          maxScore += a.maxMarks;
        }
      }

      result.push({
        subjectId: stat.subjectId,
        subjectCode: stat.subjectCode,
        subjectName: stat.subjectName,
        facultyName: stat.facultyName,
        attendancePercentage: stat.percentage,
        sessionalMarks: {
          sessional1: sessional1Val,
          sessional2: sessional2Val,
          put: putVal,
          final: fin ? { obtained: fin.marks_obtained, max: fin.max_marks || 30 } : undefined,
          otherSessionals,
          sessionals: dynamicSessionals,
        },
        quizMarks: quizMarksList,
        assignmentMarks: assignmentMarksList,
        totalInternalScore: totalScore,
        maxInternalScore: maxScore,
      });
    }

    return result;
  };

  const refreshAdminAccounts = useCallback(async () => {
    try {
      const accounts = await supabaseService.fetchAdminAccounts();
      setAdminAccounts(accounts);
    } catch (err) {
      console.error('Error refreshing admin accounts:', err);
    }
  }, []);

  const updateAccountStatus = useCallback(async (
    userId: string,
    status: AccountStatus,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const actor = erpStorage.getCurrentSessionUser();
    const res = await supabaseService.updateAccountStatus(
      userId,
      status,
      actor?.id,
      actor?.full_name,
      actor?.role,
      reason
    );
    if (res.success) {
      await Promise.all([
        refreshAdminAccounts(),
        supabaseService.fetchStudents(false).then(s => setStudents(s)),
        supabaseService.fetchFaculty(false).then(f => setFaculty(f)),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50).then(resp => {
          if (resp.data) setAuditLogs(resp.data as AuditLog[]);
        })
      ]);
    }
    return res;
  }, [refreshAdminAccounts]);

  const updateAccountCredentials = useCallback(async (
    targetUserId: string,
    options: {
      email?: string;
      password?: string;
      isDefaultPassword?: boolean;
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    const actor = erpStorage.getCurrentSessionUser();
    const res = await supabaseService.adminUpdateAccountCredentials({
      targetUserId,
      email: options.email,
      password: options.password,
      isDefaultPassword: options.isDefaultPassword,
      actorId: actor?.id,
      actorName: actor?.full_name || 'Super Admin',
      actorRole: actor?.role || 'super_admin',
    });

    if (res.success) {
      await Promise.all([
        refreshAdminAccounts(),
        supabaseService.fetchStudents(false).then(s => setStudents(s)),
        supabaseService.fetchFaculty(false).then(f => setFaculty(f)),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50).then(resp => {
          if (resp.data) setAuditLogs(resp.data as AuditLog[]);
        }),
      ]);
    }
    return res;
  }, [refreshAdminAccounts]);

  const requestPasswordReset = useCallback(async (
    email: string,
    targetUserId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const actor = erpStorage.getCurrentSessionUser();
    const res = await supabaseService.requestPasswordReset(
      email,
      targetUserId,
      actor?.full_name,
      actor?.role
    );
    if (res.success) {
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50).then(resp => {
        if (resp.data) setAuditLogs(resp.data as AuditLog[]);
      });
    }
    return res;
  }, []);

  const resetToInitialSeed = () => {
    erpStorage.init(true);
    refreshData();
  };

  return (
    <AcademicContext.Provider
      value={{
        institution,
        departments,
        programs,
        sessions,
        years,
        semesters,
        sections,
        classrooms,
        subjects,
        faculty,
        assignments,
        students,
        timetable,
        attendanceSessions,
        attendanceRecords,
        corrections,
        auditLogs,
        courseAssignments,
        assignmentSubmissions,
        quizzes,
        quizResults,
        sessionalAssessments,
        sessionalMarks,
        marksHistory,
        adminAccounts,
        isLoading,
        claimWindowDays,
        setClaimWindowDays,
        refreshData,
        refreshStudents,
        refreshTimetable,
        refreshAttendance,
        refreshCorrections,
        refreshFaculty,
        refreshSections,
        refreshSubjects,
        refreshAssignments,
        refreshAssessments,
        refreshAdminAccounts,
        updateAccountStatus,
        updateAccountCredentials,
        requestPasswordReset,
        createAssignment,
        updateAssignment,
        deleteCourseAssignment,
        submitAssignment,
        gradeAssignmentSubmission,
        createQuiz,
        updateQuiz,
        deleteQuiz,
        saveQuizMarks,
        createSessionalAssessment,
        updateSessionalAssessment,
        deleteSessionalAssessment,
        saveSessionalMarks,
        getStudentAcademicScorecard,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        addProgram,
        updateProgram,
        deleteProgram,
        addSection,
        updateSection,
        deleteSection,
        addAcademicYear,
        updateAcademicYear,
        deleteAcademicYear,
        addSemester,
        updateSemester,
        deleteSemester,
        addFaculty,
        createFacultyWithAssignments,
        updateFaculty,
        updateFacultyWithAssignments,
        setFacultyStatus,
        checkFacultyHistoricalRecords,
        safeDeleteFaculty,
        deleteFaculty,
        addSubject,
        updateSubject,
        deleteSubject,
        addAssignment,
        updateFacultyAssignment,
        deleteAssignment,
        addStudent,
        updateStudent,
        deleteStudent,
        transferStudentSection,
        batchImportSectionStudents,
        addTimetableEntry,
        updateTimetableEntry,
        deleteTimetableEntry,
        deleteSectionTimetable,
        findOrCreateFaculty,
        findOrCreateSubject,
        findOrCreateClassroom,
        saveSingleTimetableSlot,
        saveSectionTimetable,
        rollbackToVersion,
        checkTimetableConflict,
        saveAttendance,
        deleteAttendanceSession,
        submitCorrectionRequest,
        reviewCorrectionRequest,
        canSubmitClaim,
        getStudentAttendance,
        getPublishedTimetable,
        getFacultyTimetable,
        getStudentTimetable,
        getTodayLecturesForStudent,
        getDateLecturesForStudent,
        getFacultyCorrectionRequests,
        getTodaySchedule,
        resetToInitialSeed,
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
};

export const useAcademic = () => {
  const context = useContext(AcademicContext);
  if (!context) {
    throw new Error('useAcademic must be used within an AcademicProvider');
  }
  return context;
};

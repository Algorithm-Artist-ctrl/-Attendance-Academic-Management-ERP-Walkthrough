import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  Assignment,
  AssignmentSubmission,
  Quiz,
  QuizResult,
  SessionalMark,
  MarksHistory,
  SessionalType
} from '../types/database.types';
import {
  StudentOverallAttendance,
  TodayLectureItem,
  TimetableConflict,
  SubjectAttendanceStat,
  StudentSubjectAcademicReport
} from '../types/academic.types';
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
import { erpStorage } from '../lib/storage/erpStorage';
import { getISTTodayDate, getISTDayOfWeek } from '../lib/utils/dateUtils';

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
  sessionalMarks: SessionalMark[];
  marksHistory: MarksHistory[];
  isLoading: boolean;
  claimWindowDays: number;
  setClaimWindowDays: (days: number) => void;
  refreshData: () => Promise<void>;

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
  saveSessionalMarks: (params: {
    facultyId: string;
    subjectId: string;
    sectionId: string;
    sessionalType: SessionalType;
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
  deleteSection: (id: string) => Promise<boolean>;
  addFaculty: (fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) => Promise<Faculty>;
  updateFaculty: (id: string, updates: Partial<Faculty>) => Promise<Faculty>;
  deleteFaculty: (id: string) => Promise<boolean>;
  addSubject: (sub: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) => Promise<Subject>;
  updateSubject: (id: string, updates: Partial<Subject>) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<boolean>;
  addAssignment: (assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) => Promise<FacultySubjectAssignment>;
  deleteAssignment: (id: string) => Promise<boolean>;
  addStudent: (student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => Promise<Student>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<Student>;
  deleteStudent: (id: string) => Promise<boolean>;
  addTimetableEntry: (entry: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<TimetableEntry>;
  updateTimetableEntry: (id: string, updates: Partial<TimetableEntry>) => Promise<TimetableEntry>;
  deleteTimetableEntry: (id: string) => Promise<boolean>;
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
      status: AttendanceStatus;
      remarks?: string;
    }>;
  }) => Promise<{ session: AttendanceSession; records: AttendanceRecord[] }>;
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
  }) => { canSubmit: boolean; message?: string; existingClaim?: AttendanceCorrection };
  getStudentAttendance: (studentId: string) => StudentOverallAttendance & {
    notRecordedCount: number;
    pendingClaimsCount: number;
  };
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
  const [subjects, setSubjects] = useState<Subject[]>(() => erpStorage.getSubjects());
  const [faculty, setFaculty] = useState<Faculty[]>(() => erpStorage.getFaculty());
  const [assignments, setAssignments] = useState<FacultySubjectAssignment[]>(() => erpStorage.getAssignments());
  const [students, setStudents] = useState<Student[]>(() => erpStorage.getStudents());
  const [timetable, setTimetable] = useState<TimetableEntry[]>(() => erpStorage.getTimetable());
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>(() => erpStorage.getAttendanceSessions());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => erpStorage.getAttendanceRecords());
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>(() => erpStorage.getCorrections());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => erpStorage.getAuditLogs());
  const [courseAssignments, setCourseAssignments] = useState<Assignment[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [sessionalMarks, setSessionalMarks] = useState<SessionalMark[]>([]);
  const [marksHistory, setMarksHistory] = useState<MarksHistory[]>([]);

  // Function to load and enrich latest records from Supabase
  const loadDataFromSupabase = useCallback(async () => {
    try {
      const data = await supabaseService.fetchAllData();
      if (data) {
        const loadedInst = data.institutions[0] || erpStorage.getInstitution();
        const loadedDepts = data.departments || [];
        const loadedProgs = data.programs || [];
        const loadedSessions = data.sessions || [];
        const loadedYears = data.years || [];
        const loadedSemesters = data.semesters || [];
        const loadedSections = data.sections || [];
        const loadedSubjects = data.subjects || [];
        const loadedFaculty = data.faculty || [];
        const loadedAssignments = data.assignments || [];
        const loadedStudents = data.students || [];
        const rawTimetable = data.timetable || [];

        // Enriched Timetable entries with joined references
        const enrichedTimetable: TimetableEntry[] = rawTimetable.map(t => ({
          ...t,
          subject: loadedSubjects.find(s => s.id === t.subject_id),
          faculty: loadedFaculty.find(f => f.id === t.faculty_id),
          section: loadedSections.find(sec => sec.id === t.section_id),
        }));

        // Enriched Students with authoritative section join
        const enrichedStudents: Student[] = loadedStudents.map(s => {
          const matchedSection = loadedSections.find(sec => sec.id === s.section_id) ||
                                 loadedSections.find(sec => sec.name === (s.section as any)?.name);
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
        const enrichedAssignments: FacultySubjectAssignment[] = loadedAssignments.map(a => ({
          ...a,
          faculty: loadedFaculty.find(f => f.id === a.faculty_id),
          subject: loadedSubjects.find(s => s.id === a.subject_id),
          section: loadedSections.find(sec => sec.id === a.section_id),
        }));

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
          const sess = rec?.session || enrichedSessions.find(s => s.id === rec?.attendance_session_id);
          return {
            ...c,
            student: enrichedStudents.find(s => s.id === c.student_id),
            record: rec,
            reviewer: loadedFaculty.find(f => f.id === c.reviewed_by),
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

        // Enriched Sessional Marks
        const rawSessional = data.sessionalMarks || [];
        const enrichedSessionalMarks: SessionalMark[] = rawSessional.map(sm => ({
          ...sm,
          student: enrichedStudents.find(s => s.id === sm.student_id),
          subject: loadedSubjects.find(s => s.id === sm.subject_id),
          faculty: loadedFaculty.find(f => f.id === sm.faculty_id),
          section: loadedSections.find(sec => sec.id === sm.section_id),
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
        setSessionalMarks(enrichedSessionalMarks);
        setMarksHistory(enrichedMarksHistory);
      }
    } catch (err) {
      console.error('Failed to sync from Supabase, using local cache:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDataFromSupabase();
  }, [loadDataFromSupabase]);

  // Realtime Supabase Channel Subscription
  useEffect(() => {
    const channel = supabase
      .channel('vctm-erp-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('⚡ Realtime database mutation received:', payload.table, payload.eventType);
          loadDataFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDataFromSupabase]);

  const refreshData = async () => {
    await loadDataFromSupabase();
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
      status: AttendanceStatus;
      remarks?: string;
    }>;
  }) => {
    const result = await supabaseService.saveAttendance(params);
    erpStorage.saveAttendanceSession(params);
    await refreshData();
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
    let recId = params.attendanceRecordId;

    if (!recId && params.timetableEntryId && params.sessionDate && params.subjectId && params.facultyId && params.sectionId) {
      const sessionRes = await supabaseService.ensureAttendanceSessionAndRecord({
        timetableEntryId: params.timetableEntryId,
        sessionDate: params.sessionDate,
        subjectId: params.subjectId,
        facultyId: params.facultyId,
        sectionId: params.sectionId,
        studentId: params.studentId,
        status: 'Absent',
      });
      recId = sessionRes.recordId;
    }

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
    await refreshData();
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
    await refreshData();
    return res;
  };

  // 4. Validate whether student can submit a claim
  const canSubmitClaim = (params: {
    attendanceRecordId?: string;
    sessionDate: string;
  }): { canSubmit: boolean; message?: string; existingClaim?: AttendanceCorrection } => {
    if (params.attendanceRecordId) {
      const existing = corrections.find(
        c => c.attendance_record_id === params.attendanceRecordId &&
             (c.status === 'pending' || c.status === 'approved')
      );
      if (existing) {
        return {
          canSubmit: false,
          message: `Claim already submitted (Status: ${existing.status.toUpperCase()}).`,
          existingClaim: existing,
        };
      }
    }

    // Check time window
    const sessionTime = new Date(params.sessionDate).getTime();
    const nowTime = new Date().getTime();
    const diffDays = Math.floor((nowTime - sessionTime) / (1000 * 60 * 60 * 24));
    if (diffDays > claimWindowDays) {
      return {
        canSubmit: false,
        message: `Attendance claim period has expired (Limit: ${claimWindowDays} days).`,
      };
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
    await refreshData();
    return res;
  };

  const updateSection = async (id: string, updates: Partial<Section>) => {
    const res = await supabaseService.updateSection(id, updates);
    erpStorage.updateSection(id, updates);
    await refreshData();
    return res;
  };

  const deleteSection = async (id: string) => {
    const res = await supabaseService.deleteSection(id);
    erpStorage.deleteSection(id);
    await refreshData();
    return res;
  };

  const addFaculty = async (fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addFaculty(fac);
    erpStorage.addFaculty(fac);
    await refreshData();
    return res;
  };

  const updateFaculty = async (id: string, updates: Partial<Faculty>) => {
    const res = await supabaseService.updateFaculty(id, updates);
    erpStorage.updateFaculty(id, updates);
    await refreshData();
    return res;
  };

  const deleteFaculty = async (id: string) => {
    const res = await supabaseService.deleteFaculty(id);
    erpStorage.deleteFaculty(id);
    await refreshData();
    return res;
  };

  const addSubject = async (sub: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addSubject(sub);
    erpStorage.addSubject(sub);
    await refreshData();
    return res;
  };

  const updateSubject = async (id: string, updates: Partial<Subject>) => {
    const res = await supabaseService.updateSubject(id, updates);
    erpStorage.updateSubject(id, updates);
    await refreshData();
    return res;
  };

  const deleteSubject = async (id: string) => {
    const res = await supabaseService.deleteSubject(id);
    erpStorage.deleteSubject(id);
    await refreshData();
    return res;
  };

  const addAssignment = async (assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) => {
    const res = await supabaseService.addAssignment(assign);
    erpStorage.addAssignment(assign);
    await refreshData();
    return res;
  };

  const deleteAssignment = async (id: string) => {
    const res = await supabaseService.deleteAssignment(id);
    erpStorage.deleteAssignment(id);
    await refreshData();
    return res;
  };

  const addStudent = async (studentData: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addStudent(studentData);
    erpStorage.addStudent(studentData);
    await refreshData();
    return res;
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    const res = await supabaseService.updateStudent(id, updates);
    erpStorage.updateStudent(id, updates);
    await refreshData();
    return res;
  };

  const deleteStudent = async (id: string) => {
    const res = await supabaseService.deleteStudent(id);
    erpStorage.deleteStudent(id);
    await refreshData();
    return res;
  };

  const addTimetableEntry = async (entry: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at'>) => {
    const conflict = checkTimetableConflict(entry);
    if (conflict) {
      throw new Error(conflict.message);
    }
    const res = await supabaseService.addTimetableEntry(entry);
    erpStorage.addTimetableEntry(entry);
    await refreshData();
    return res;
  };

  const updateTimetableEntry = async (id: string, updates: Partial<TimetableEntry>) => {
    const res = await supabaseService.updateTimetableEntry(id, updates);
    erpStorage.updateTimetableEntry(id, updates);
    await refreshData();
    return res;
  };

  const deleteTimetableEntry = async (id: string) => {
    const res = await supabaseService.deleteTimetableEntry(id);
    erpStorage.deleteTimetableEntry(id);
    await refreshData();
    return res;
  };

  // 6. Timetable Conflict Engine
  const checkTimetableConflict = (entry: Omit<TimetableEntry, 'id'>, excludeId?: string): TimetableConflict | null => {
    const activeEntries = timetable.filter(t => t.active && t.id !== excludeId);

    // Rule 1: Faculty Double-Booking
    const facultyConflict = activeEntries.find(
      t => t.faculty_id === entry.faculty_id &&
           t.day_of_week === entry.day_of_week &&
           t.period_number === entry.period_number
    );

    if (facultyConflict) {
      const fac = faculty.find(f => f.id === entry.faculty_id);
      const conflictSec = sections.find(s => s.id === facultyConflict.section_id);
      return {
        type: 'faculty',
        message: `Faculty conflict: ${fac?.full_name || 'Faculty'} is already scheduled to teach Section ${conflictSec?.name || 'Unknown'} during Period ${entry.period_number} on ${entry.day_of_week}.`,
        conflictingEntry: facultyConflict
      };
    }

    // Rule 2: Room Collision
    const roomConflict = activeEntries.find(
      t => t.room_number.toLowerCase().trim() === entry.room_number.toLowerCase().trim() &&
           t.day_of_week === entry.day_of_week &&
           t.period_number === entry.period_number
    );

    if (roomConflict) {
      const conflictSec = sections.find(s => s.id === roomConflict.section_id);
      return {
        type: 'room',
        message: `Room collision: ${entry.room_number} is already occupied by Section ${conflictSec?.name || 'Unknown'} during Period ${entry.period_number} on ${entry.day_of_week}.`,
        conflictingEntry: roomConflict
      };
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

    const targetSubjects = subjects.filter(s => s.active && (sectionSubjectIds.size === 0 || sectionSubjectIds.has(s.id)));

    const subjectStats: SubjectAttendanceStat[] = targetSubjects.map(sub => {
      // Find the specific assignment for THIS student's section
      const assignment = assignments.find(
        a => a.subject_id === sub.id && a.section_id === studSectionId
      ) || assignments.find(a => a.subject_id === sub.id);

      const assignedFac = faculty.find(f => f.id === assignment?.faculty_id) ||
                          faculty.find(f => timetable.some(t => t.subject_id === sub.id && t.section_id === studSectionId && t.faculty_id === f.id));

      // Sessions conducted for this subject and this student's section
      const subSessions = attendanceSessions.filter(
        sess => sess.subject_id === sub.id && (studSectionId ? sess.section_id === studSectionId : true)
      );

      // Student's individual records for this subject
      const subRecords = studentRecords.filter(r => {
        const sess = attendanceSessions.find(s => s.id === r.attendance_session_id);
        return sess && sess.subject_id === sub.id && (studSectionId ? sess.section_id === studSectionId : true);
      });

      const totalConducted = subSessions.length;
      const attended = subRecords.filter(r => r.status === 'Present').length;
      const percentage = totalConducted > 0 ? Math.round((attended / totalConducted) * 100) : 0;

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
    const overallPercentage = totalLectures > 0 ? Math.round((presentLectures / totalLectures) * 100) : 0;

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
      sectionName: studSection?.name || 'A',
      totalLectures,
      presentLectures,
      percentage: overallPercentage,
      isDefaulter: totalLectures > 0 && overallPercentage < 75,
      subjectStats,
      notRecordedCount,
      pendingClaimsCount,
    };
  };

  // 8. Get Today's Live Attendance Lectures for Student
  const getTodayLecturesForStudent = (studentId: string, customDateStr?: string): TodayAttendanceLecture[] => {
    const student = students.find(s => s.id === studentId);
    if (!student) return [];

    const defaultDateStr = getISTTodayDate();
    const targetDateStr = customDateStr || defaultDateStr;
    const dayOfWeek: DayOfWeek = getISTDayOfWeek(targetDateStr);

    const sectionEntries = dayOfWeek === 'SUN' 
      ? [] 
      : timetable
          .filter(t => t.section_id === student.section_id && t.day_of_week === dayOfWeek && t.active)
          .sort((a, b) => a.period_number - b.period_number);

    return sectionEntries.map(entry => {
      const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
      const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;
      const sec = sections.find(s => s.id === entry.section_id) || entry.section;

      // Check if session was conducted on this date
      const session = attendanceSessions.find(
        s => s.section_id === entry.section_id &&
             s.subject_id === entry.subject_id &&
             s.session_date === targetDateStr
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
        subjectId: entry.subject_id,
        subjectCode: sub?.subject_code || '',
        subjectName: sub?.subject_name || 'Subject',
        facultyId: entry.faculty_id,
        facultyName: fac?.full_name || 'Faculty Member',
        facultyCode: fac?.faculty_code || fac?.employee_code,
        roomNumber: entry.room_number || sec?.room_number || 'Room A-007',
        lectureType: entry.lecture_type || 'Theory',
        sectionId: entry.section_id,
        sectionName: sec?.name || 'A',
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
        s => s.section_id === entry.section_id &&
             s.subject_id === entry.subject_id &&
             s.session_date === params.dateStr
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
        sectionName: sec?.name || 'A',
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
    await refreshData();
    return res;
  };

  const updateAssignment = async (id: string, updates: Partial<Assignment>) => {
    const res = await supabaseService.updateAssignment(id, updates);
    await refreshData();
    return res;
  };

  const deleteCourseAssignment = async (id: string) => {
    const res = await supabaseService.deleteCourseAssignment(id);
    await refreshData();
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
    await refreshData();
    return res;
  };

  const gradeAssignmentSubmission = async (params: {
    submissionId: string;
    marksObtained: number;
    feedback?: string;
    facultyId: string;
  }) => {
    const res = await supabaseService.gradeAssignmentSubmission(params);
    await refreshData();
    return res;
  };

  const createQuiz = async (quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.createQuiz(quiz);
    await refreshData();
    return res;
  };

  const updateQuiz = async (id: string, updates: Partial<Quiz>) => {
    const res = await supabaseService.updateQuiz(id, updates);
    await refreshData();
    return res;
  };

  const deleteQuiz = async (id: string) => {
    const res = await supabaseService.deleteQuiz(id);
    await refreshData();
    return res;
  };

  const saveQuizMarks = async (params: {
    quizId: string;
    facultyId: string;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
  }) => {
    const res = await supabaseService.saveQuizMarks(params);
    await refreshData();
    return res;
  };

  const saveSessionalMarks = async (params: {
    facultyId: string;
    subjectId: string;
    sectionId: string;
    sessionalType: SessionalType;
    maxMarks: number;
    studentMarks: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }>;
  }) => {
    const res = await supabaseService.saveSessionalMarks(params);
    await refreshData();
    return res;
  };

  const getStudentAcademicScorecard = (studentId: string): StudentSubjectAcademicReport[] => {
    const student = students.find(s => s.id === studentId);
    if (!student) return [];

    const studentAtt = getStudentAttendance(studentId);
    const result: StudentSubjectAcademicReport[] = [];

    for (const stat of studentAtt.subjectStats) {
      const subSessional = sessionalMarks.filter(sm => sm.student_id === studentId && sm.subject_id === stat.subjectId);
      const s1 = subSessional.find(s => s.sessional_type === 'Sessional 1');
      const s2 = subSessional.find(s => s.sessional_type === 'Sessional 2');
      const put = subSessional.find(s => s.sessional_type === 'Pre-University Test');
      const fin = subSessional.find(s => s.sessional_type === 'Final Sessional');

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
          status: sub ? sub.status : 'not_submitted',
          dueDate: a.due_date,
        };
      });

      let totalScore = 0;
      let maxScore = 0;

      if (s1) { totalScore += s1.marks_obtained; maxScore += s1.max_marks; }
      if (s2) { totalScore += s2.marks_obtained; maxScore += s2.max_marks; }
      if (put) { totalScore += put.marks_obtained; maxScore += put.max_marks; }
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
          sessional1: s1 ? { obtained: s1.marks_obtained, max: s1.max_marks } : undefined,
          sessional2: s2 ? { obtained: s2.marks_obtained, max: s2.max_marks } : undefined,
          put: put ? { obtained: put.marks_obtained, max: put.max_marks } : undefined,
          final: fin ? { obtained: fin.marks_obtained, max: fin.max_marks } : undefined,
        },
        quizMarks: quizMarksList,
        assignmentMarks: assignmentMarksList,
        totalInternalScore: totalScore,
        maxInternalScore: maxScore,
      });
    }

    return result;
  };

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
        sessionalMarks,
        marksHistory,
        isLoading,
        claimWindowDays,
        setClaimWindowDays,
        refreshData,
        createAssignment,
        updateAssignment,
        deleteCourseAssignment,
        submitAssignment,
        gradeAssignmentSubmission,
        createQuiz,
        updateQuiz,
        deleteQuiz,
        saveQuizMarks,
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
        addFaculty,
        updateFaculty,
        deleteFaculty,
        addSubject,
        updateSubject,
        deleteSubject,
        addAssignment,
        deleteAssignment,
        addStudent,
        updateStudent,
        deleteStudent,
        addTimetableEntry,
        updateTimetableEntry,
        deleteTimetableEntry,
        checkTimetableConflict,
        saveAttendance,
        submitCorrectionRequest,
        reviewCorrectionRequest,
        canSubmitClaim,
        getStudentAttendance,
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

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  AssessmentAttendanceStatus,
  MarksHistory,
  SessionalType,
  SessionalAssessment,
  Classroom,
  AdmissionType,
  AccountStatus,
  AdminAccountDirectoryEntry,
  ClassCoordinatorAssignment,
  StudentNotification,
  Conversation,
  ConversationCategory,
  ConversationStatus,
  Message,
  EligibleFacultyForStudent,
  EligibleStudentForFaculty,
  MessageGroup,
  GroupMessage,
  GroupMember,
  DetailedStudentProfile,
  SectionReferenceCheckResult,
  LeaveApplication,
  ArchivedRecordItem,
  ArchivedStats,
  StudentFullHistoricalRecord,
  FacultyFullHistoricalRecord,
  StudentAcademicContext,
  HODDepartmentContext,
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
import { useAuth } from './AuthContext';
import { 
  getCollegeToday,
  getISTTodayDate, 
  getISTDayOfWeek, 
  isClaimWindowOpen, 
  getClaimWindowStatus,
  isClassCompleted,
  normalizeDateToIST
} from '../lib/utils/dateUtils';
import {
  FacultyTeachingScope,
  FacultyResolvedAssignment,
  resolveFacultyTeachingScope,
  getAssignedSectionsForYear,
  getAssignedSubjectsForSection,
  cleanSectionName,
  cleanRoomNumber,
} from '../lib/utils/facultyAssignmentResolver';

export type AttendanceSummaryStatus = 
  | 'NO_RECORDS'
  | 'PARTIALLY_MARKED'
  | 'FULLY_MARKED'
  | 'RECORDED'
  | 'LOADING'
  | 'SYNCING'
  | 'NETWORK_ERROR'
  | 'DATA_ERROR';

export interface AttendanceSummary {
  sessionId?: string;
  total: number;
  present: number;
  absent: number;
  unmarked: number;
  marked: number;
  progress: number;
  status: AttendanceSummaryStatus;
  statusLabel: string;
}

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
  classCoordinatorAssignments: ClassCoordinatorAssignment[];
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
  notifications: StudentNotification[];
  unreadNotificationCount: number;
  conversations: Conversation[];
  unreadMessagesCount: number;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  messageGroups: MessageGroup[];
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  refreshMessageGroups: () => Promise<void>;
  leaveApplications: LeaveApplication[];
  refreshLeaveApplications: (forcedStudentId?: string, forcedFacultyId?: string) => Promise<LeaveApplication[]>;
  sendGroupMessage: (params: {
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
    replyToMessageId?: string | null;
    clientMessageId?: string | null;
  }) => Promise<{ success: boolean; data?: any; error?: any }>;
  editGroupMessage: (messageId: string, newContent: string, newTitle?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteGroupMessage: (messageId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  clearGroupChatForMe: (groupId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteMessageGroup: (groupId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteGroupMessageForMe: (messageId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  markGroupRead: (groupId: string) => Promise<void>;
  fetchGroupMembers: (groupId: string) => Promise<GroupMember[]>;
  fetchStudentProfile: (studentId: string) => Promise<{ data: DetailedStudentProfile | null; error: any }>;
  sendMessage: (params: {
    conversationId: string;
    message: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
    replyToMessageId?: string | null;
  }) => Promise<{ data: Message | null; error: any }>;
  editDirectMessage: (messageId: string, newContent: string) => Promise<{ data: Message | null; error: any }>;
  unsendDirectMessage: (messageId: string) => Promise<{ data: Message | null; error: any }>;
  deleteMessageForMe: (messageId: string) => Promise<{ success: boolean; error?: any }>;
  clearConversationForMe: (conversationId: string) => Promise<{ success: boolean; error?: any }>;
  deleteConversation: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: any }>;
  markConversationUnread: (conversationId: string) => Promise<{ success: boolean; error?: any }>;
  getOrCreateConversation: (params: {
    facultyId?: string;
    studentId?: string;
    subjectId?: string | null;
    category?: ConversationCategory;
    topic?: string;
  }) => Promise<{ data: Conversation | null; error: any }>;
  markConversationRead: (conversationId: string) => Promise<void>;
  updateConversationStatus: (
    conversationId: string,
    status: ConversationStatus
  ) => Promise<{ data: Conversation | null; error: any }>;
  fetchEligibleFacultyForStudent: (studentId: string) => Promise<EligibleFacultyForStudent[]>;
  fetchEligibleStudentsForFaculty: (facultyId: string) => Promise<EligibleStudentForFaculty[]>;
  getCachedConversationMessages: (conversationId: string) => Message[] | undefined;
  setCachedConversationMessages: (conversationId: string, messages: Message[]) => void;
  getCachedGroupMessages: (groupId: string) => GroupMessage[] | undefined;
  setCachedGroupMessages: (groupId: string, messages: GroupMessage[]) => void;
  activeToast: {
    id: string;
    title: string;
    message: string;
    type: string;
    referenceType?: string;
    referenceId?: string;
  } | null;
  dismissToast: () => void;
  isOnline: boolean;
  isLoading: boolean;
  claimWindowDays: number;
  setClaimWindowDays: (days: number) => void;
  refreshData: (forceRefreshMaster?: boolean) => Promise<void>;
  refreshAdminAccounts: () => Promise<void>;
  refreshNotifications: (studentId?: string, userId?: string) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  getFacultyCoordinatorAssignments: (facultyId: string) => ClassCoordinatorAssignment[];
  refreshCoordinatorAssignments: (facultyId?: string) => Promise<ClassCoordinatorAssignment[]>;
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
    isPublished?: boolean;
  }) => Promise<QuizResult[]>;
  createSessionalAssessment: (data: Omit<SessionalAssessment, 'id' | 'created_at' | 'updated_at'>) => Promise<SessionalAssessment>;
  updateSessionalAssessment: (id: string, updates: Partial<SessionalAssessment>) => Promise<SessionalAssessment>;
  deleteSessionalAssessment: (id: string) => Promise<boolean>;
  ensureDefaultSessionalAssessments: (params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
    semesterId?: string;
  }) => Promise<SessionalAssessment[]>;
  ensureDefaultQuizzes: (params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
  }) => Promise<Quiz[]>;
  ensureDefaultAssessments: (params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
    semesterId?: string;
  }) => Promise<{ sessionals: SessionalAssessment[]; quizzes: Quiz[] }>;
  saveSessionalMarks: (params: {
    sessionalAssessmentId?: string;
    facultyId: string;
    subjectId: string;
    sectionId: string;
    sessionalType?: string;
    maxMarks: number;
    studentMarks: Array<{
      studentId: string;
      marksObtained: number | null;
      remarks?: string;
      oldMarks?: number | null;
      attendanceStatus?: AssessmentAttendanceStatus;
    }>;
    isPublished?: boolean;
  }) => Promise<SessionalMark[]>;
  publishAssessment: (assessmentId: string, facultyId?: string) => Promise<any>;
  fetchAssessmentMarks: (assessmentId: string, kind?: 'sessional' | 'quiz' | 'assignment', forceFresh?: boolean) => Promise<any[]>;
  publishNotice: (notice: any) => Promise<any>;
  deleteNotice: (id: string) => Promise<boolean>;
  archiveNotice: (id: string) => Promise<boolean>;
  getStudentAcademicScorecard: (studentId: string) => StudentSubjectAcademicReport[];
  addDepartment: (dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => Promise<Department>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<{ deleted: boolean; deactivated: boolean; message: string } | boolean>;
  checkDepartmentReferences: (deptId: string) => Promise<{
    can_hard_delete: boolean;
    reason?: string;
    references: {
      programs: number;
      faculty: number;
      students: number;
      subjects: number;
      sections: number;
      timetables: number;
    };
  }>;
  changeDepartmentHod: (deptId: string, newFacultyId: string) => Promise<Department>;
  removeDepartmentHod: (deptId: string) => Promise<Department>;
  setCurrentAcademicTerm: (sessionId: string, termType: 'ODD' | 'EVEN', semesterNumber?: number) => Promise<{
    success: boolean;
    session_id: string;
    term_type: string;
    activated_semesters: number[];
    all_semesters_active: boolean;
  }>;
  updateSemesterDates: (semesterId: string, startDate?: string | null, endDate?: string | null) => Promise<Semester>;
  addProgram: (prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) => Promise<Program>;
  updateProgram: (id: string, updates: Partial<Program>) => Promise<Program>;
  deleteProgram: (id: string) => Promise<boolean>;
  addSection: (sec: Omit<Section, 'id' | 'created_at' | 'updated_at'>) => Promise<Section>;
  updateSection: (id: string, updates: Partial<Section>) => Promise<Section>;
  deleteSection: (id: string) => Promise<{ success: boolean; archived: boolean } | boolean>;
  archiveSection: (id: string) => Promise<Section>;
  restoreSection: (id: string) => Promise<Section>;
  checkSectionReferences: (id: string) => Promise<SectionReferenceCheckResult>;
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
    coordinatorAssignments?: Array<{
      section_id: string;
      academic_year_id?: string;
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
    coordinatorAssignments?: Array<{
      section_id: string;
      academic_year_id?: string;
    }>;
    actorName?: string;
  }) => Promise<{ faculty: Faculty; assignments: FacultySubjectAssignment[] }>;
  assignCoordinator: (facultyId: string, sectionId: string, sessionId?: string, assignedBy?: string) => Promise<{ success: boolean; error?: string; replacedFacultyId?: string; replacedFacultyName?: string }>;
  removeCoordinator: (facultyId: string, sectionId: string) => Promise<{ success: boolean; error?: string }>;
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
  getAttendanceSummary: (lookup: string | {
    sessionId?: string;
    timetableEntryId?: string;
    sessionDate?: string;
    sectionId?: string;
    subjectId?: string;
    startTime?: string;
  }) => AttendanceSummary;
  ensureSessionAttendanceLoaded: (sessionId: string) => Promise<AttendanceRecord[]>;
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
    startTime?: string;
    endTime?: string;
  }) => { canSubmit: boolean; message?: string; existingClaim?: AttendanceCorrection; code?: string };
  getStudentAttendance: (studentId: string) => StudentOverallAttendance & {
    notRecordedCount: number;
    pendingClaimsCount: number;
  };
  getPublishedTimetable: (filter?: TimetableQueryFilter) => TimetableEntry[];
  getStudentTimetable: (studentId: string) => TimetableEntry[];
  getFacultyTimetable: (facultyId: string, dayOfWeek?: DayOfWeek) => TimetableEntry[];
  getFacultyTeachingScope: (facultyId: string, isSuperAdminOrHOD?: boolean) => FacultyTeachingScope;
  getFacultyTeachingAssignments: (facultyId: string) => FacultyResolvedAssignment[];
  getStudentAcademicContext: (studentId: string) => StudentAcademicContext;
  getHODDepartmentContext: (hodId: string) => HODDepartmentContext;
  getAssignedSectionsForYear: (assignments: FacultyResolvedAssignment[], yearId?: string) => Section[];
  getAssignedSubjectsForSection: (assignments: FacultyResolvedAssignment[], sectionId?: string, yearId?: string) => Subject[];
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
  refreshStudents: (sectionId?: string) => Promise<void>;
  refreshTimetable: (sectionId?: string) => Promise<void>;
  refreshAttendance: () => Promise<void>;
  refreshCorrections: () => Promise<void>;
  refreshFaculty: () => Promise<void>;
  refreshSections: () => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshAssignments: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  resetToInitialSeed: () => void;
  archiveAccount: (params: {
    targetId: string;
    entityType: 'student' | 'faculty';
    exitStatus: AccountStatus;
    exitDate?: string;
    reason?: string;
  }) => Promise<{ success: boolean; data?: any; error?: string }>;
  restoreAccount: (params: {
    targetId: string;
    entityType: 'student' | 'faculty';
    reason?: string;
  }) => Promise<{ success: boolean; data?: any; error?: string }>;
  fetchArchivedStats: () => Promise<ArchivedStats>;
  fetchArchivedRecords: () => Promise<ArchivedRecordItem[]>;
  fetchStudentHistoricalRecord: (studentId: string) => Promise<StudentFullHistoricalRecord | null>;
  fetchFacultyHistoricalRecord: (facultyId: string) => Promise<FacultyFullHistoricalRecord | null>;
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined);

function deduplicateQuizzes(list: Quiz[]): Quiz[] {
  const map = new Map<string, Quiz>();
  for (const q of list) {
    const key = `${q.subject_id}_${q.section_id}_${(q.title || '').trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, q);
    } else {
      const existing = map.get(key)!;
      if (existing.status !== 'published' && q.status === 'published') {
        map.set(key, q);
      }
    }
  }
  return Array.from(map.values());
}

function deduplicateSessionals(list: SessionalAssessment[]): SessionalAssessment[] {
  const map = new Map<string, SessionalAssessment>();
  for (const sa of list) {
    const key = `${sa.subject_id}_${sa.section_id}_${(sa.title || '').trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, sa);
    } else {
      const existing = map.get(key)!;
      if (existing.status !== 'published' && (sa.status === 'published' || sa.status === 'completed')) {
        map.set(key, sa);
      }
    }
  }
  return Array.from(map.values());
}

export const AcademicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, isLoading: authLoading, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(() => {
    return !(erpStorage.getStudents().length > 0 || erpStorage.getTimetable().length > 0);
  });
  const inFlightLoadDataRef = useRef<Promise<void> | null>(null);
  const [claimWindowDays, setClaimWindowDays] = useState<number>(7);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

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
  const [classCoordinatorAssignments, setClassCoordinatorAssignments] = useState<ClassCoordinatorAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>(() => erpStorage.getStudents());
  const [timetable, setTimetable] = useState<TimetableEntry[]>(() => erpStorage.getTimetable());
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>(() => erpStorage.getAttendanceSessions());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => erpStorage.getAttendanceRecords());
  const attendanceLoadErrorRef = useRef<string | null>(null);
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
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const unreadNotificationCount = notifications.filter(n => !n.is_read).length;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const [activeConversationId, _setActiveConversationIdState] = useState<string | null>(null);
  const setActiveConversationId = useCallback((id: string | null) => {
    if (activeConversationIdRef.current === id) return;
    activeConversationIdRef.current = id;
    _setActiveConversationIdState(id);
  }, []);

  const [messageGroups, setMessageGroups] = useState<MessageGroup[]>([]);
  const activeGroupIdRef = useRef<string | null>(null);
  const [activeGroupId, _setActiveGroupIdState] = useState<string | null>(null);
  const setActiveGroupId = useCallback((id: string | null) => {
    if (activeGroupIdRef.current === id) return;
    activeGroupIdRef.current = id;
    _setActiveGroupIdState(id);
  }, []);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Client-Side In-Memory Message Caches (Instant switching without network delay or blur)
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
  const groupMessagesCacheRef = useRef<Map<string, GroupMessage[]>>(new Map());

  const getCachedConversationMessages = useCallback((conversationId: string): Message[] | undefined => {
    return messagesCacheRef.current.get(conversationId);
  }, []);

  const setCachedConversationMessages = useCallback((conversationId: string, messages: Message[]) => {
    messagesCacheRef.current.set(conversationId, messages);
  }, []);

  const getCachedGroupMessages = useCallback((groupId: string): GroupMessage[] | undefined => {
    return groupMessagesCacheRef.current.get(groupId);
  }, []);

  const setCachedGroupMessages = useCallback((groupId: string, messages: GroupMessage[]) => {
    groupMessagesCacheRef.current.set(groupId, messages);
  }, []);

  const unreadMessagesCount = 
    conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0) +
    messageGroups.reduce((acc, g) => acc + (g.unread_count || 0), 0);

  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);

  const [activeToast, setActiveToast] = useState<{
    id: string;
    title: string;
    message: string;
    type: string;
    referenceType?: string;
    referenceId?: string;
  } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  // Auto-dismiss notification toast after 7 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [activeToast]);

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
  const lastFullLoadRef = useRef<number>(0);
  // Self-save timestamp tracking to suppress local echo refetches from Supabase realtime
  const lastAttendanceSaveTimeRef = useRef<number>(0);
  const lastMarksSaveTimeRef = useRef<number>(0);

  // Function to load and enrich latest records from Supabase (Role-Scoped Fast Pipeline with In-Flight Deduplication)
  const loadDataFromSupabase = useCallback(async (forceRefreshMaster = false) => {
    if (inFlightLoadDataRef.current && !forceRefreshMaster) {
      return inFlightLoadDataRef.current;
    }
    const currentAuthUser = user || erpStorage.getCurrentSessionUser();
    const currentRole = role || currentAuthUser?.role;
    if (!currentRole) {
      setIsLoading(false);
      return;
    }

    const task = (async () => {
      try {
        lastFullLoadRef.current = Date.now();
        attendanceLoadErrorRef.current = null;
        const studentId = currentAuthUser?.student_id || currentAuthUser?.student?.id;
        const sectionId = currentAuthUser?.student?.section_id || (currentAuthUser as any)?.section_id;
        const facultyId = currentAuthUser?.faculty_id || currentAuthUser?.faculty?.id || currentAuthUser?.id;
        const departmentId = currentAuthUser?.department_id || currentAuthUser?.faculty?.department_id;

        const data = await supabaseService.fetchScopedData({
          role: currentRole,
          studentId: currentRole === 'student' ? studentId : undefined,
          sectionId: currentRole === 'student' ? sectionId : undefined,
          facultyId: (currentRole === 'faculty' || currentRole === 'hod') ? facultyId : undefined,
          departmentId,
          forceRefreshMaster,
        });
      if (data) {
        const loadedInst = data.institutions[0] || erpStorage.getInstitution();
        const loadedDepts = data.departments || [];
        const loadedProgs = data.programs || [];
        const loadedSessions = data.sessions || [];
        const loadedYears = (data.years || []).filter(y => y.active);
        const loadedSemesters = (data.semesters || []).filter(s => s.active && loadedYears.some(y => y.id === s.academic_year_id));
        const loadedSections = (data.sections || []).filter(sec => sec.active && loadedSemesters.some(sem => sem.id === sec.semester_id));
        const loadedClassrooms = ((data as any).classrooms || []).filter((c: any) => c.active !== false);
        setClassrooms(loadedClassrooms);
        const loadedSubjects = (data.subjects || []).filter(s => s.active !== false);
        const loadedFaculty = (data.faculty || []).filter(f => f.active !== false && (!f.status || f.status === 'ACTIVE'));
        const loadedAssignments = (data.assignments || []).filter(a => a.active !== false);
        const loadedStudents = (data.students || []).filter(s => s.active && (!s.status || s.status === 'ACTIVE') && loadedYears.some(y => y.id === s.academic_year_id));
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
        const enrichedSessions: AttendanceSession[] = (data.attendanceSessions || []).map(sess => ({
          ...sess,
          faculty: loadedFaculty.find(f => f.id === sess.faculty_id),
          subject: loadedSubjects.find(s => s.id === sess.subject_id),
          section: loadedSections.find(sec => sec.id === sess.section_id),
        }));

        // Enriched Attendance Records
        const enrichedRecords: AttendanceRecord[] = (data.attendanceRecords || []).map(rec => ({
          ...rec,
          student: enrichedStudents.find(s => s.id === rec.student_id),
          session: enrichedSessions.find(sess => sess.id === rec.attendance_session_id),
        }));

        // Enriched Corrections
        const enrichedCorrections: AttendanceCorrection[] = (data.corrections || []).map(c => {
          const rec = (c as any).record || enrichedRecords.find(r => r.id === c.attendance_record_id);
          const matchedSession = rec?.session || (c as any).session || enrichedSessions.find(s => s.id === rec?.attendance_session_id);
          const matchedStudent = (c as any).student || enrichedStudents.find(s => s.id === c.student_id);
          const matchedReviewer = (c as any).reviewer || loadedFaculty.find(f => f.id === c.reviewed_by);
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
        setQuizzes(deduplicateQuizzes(enrichedQuizzes));
        setQuizResults(enrichedQuizResults);
        setSessionalAssessments(deduplicateSessionals(enrichedAssessments));
        setSessionalMarks(enrichedSessionalMarks);
        setMarksHistory(enrichedMarksHistory);

        // Fetch Class Coordinator Assignments (Section-Specific)
        try {
          const rawCoordAssignments = await supabaseService.fetchClassCoordinatorAssignments();
          setClassCoordinatorAssignments(rawCoordAssignments);
        } catch (coordErr) {
          console.warn('Could not load class coordinator assignments:', coordErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to sync from Supabase, using local cache:', err);
      attendanceLoadErrorRef.current = err?.message || 'Failed to sync data from Supabase';
    } finally {
      inFlightLoadDataRef.current = null;
      setIsLoading(false);
    }
  })();
  inFlightLoadDataRef.current = task;
  return task;
}, [user?.id, role]);

  // Granular Entity Refreshers for Targeted UI Updates Without Full-App Reload
  const refreshStudents = useCallback(async (targetSectionId?: string) => {
    try {
      const curSections = sectionsRef.current;
      const curFaculty = facultyRef.current;
      const curDepts = departmentsRef.current;

      if (targetSectionId) {
        const rawSectionStudents = await supabaseService.fetchStudentsBySection(targetSectionId);
        const enriched: Student[] = rawSectionStudents.map(s => {
          const matchedSection = curSections.find(sec => sec.id === s.section_id);
          return {
            ...s,
            section: matchedSection,
            section_id: matchedSection?.id || s.section_id,
            mentor: curFaculty.find(f => f.id === s.mentor_faculty_id),
            department: curDepts.find(d => d.id === s.department_id),
          };
        });
        setStudents(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          enriched.forEach(e => existingMap.set(e.id, e));
          const merged = Array.from(existingMap.values());
          erpStorage.setStudents(merged);
          return merged;
        });
        return;
      }

      const rawStudents = await supabaseService.fetchStudents();
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

      // Deduplicate enriched entries by ID to prevent any duplicate slot cards
      const seenIds = new Set<string>();
      const dedupedEnriched: TimetableEntry[] = [];
      for (const entry of enriched) {
        if (!seenIds.has(entry.id)) {
          seenIds.add(entry.id);
          dedupedEnriched.push(entry);
        }
      }

      if (sectionId) {
        setTimetable(prev => {
          const others = prev.filter(t => t.section_id !== sectionId);
          const idSet = new Set(others.map(o => o.id));
          const newEntries = dedupedEnriched.filter(e => !idSet.has(e.id));
          const merged = [...others, ...newEntries];
          erpStorage.setTimetable(merged);
          return merged;
        });
      } else {
        setTimetable(dedupedEnriched);
        erpStorage.setTimetable(dedupedEnriched);
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
        const rec = (c as any).record || curRecords.find(r => r.id === c.attendance_record_id);
        const matchedSession = rec?.session || (c as any).session || curSessions.find(s => s.id === rec?.attendance_session_id);
        const matchedStudent = (c as any).student || curStudents.find(s => s.id === c.student_id);
        const matchedReviewer = (c as any).reviewer || curFaculty.find(f => f.id === c.reviewed_by);
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

  const refreshAcademicStructure = useCallback(async () => {
    try {
      const staticSetup = await supabaseService.fetchStaticSetup();
      if (staticSetup) {
        if (staticSetup.departments) setDepartments(staticSetup.departments);
        if (staticSetup.programs) setPrograms(staticSetup.programs);
        if (staticSetup.sessions) setSessions(staticSetup.sessions);
        if (staticSetup.years) {
          const loadedYears = (staticSetup.years || []).filter(y => y.active);
          setYears(loadedYears);
          erpStorage.setYears(loadedYears);
        }
        if (staticSetup.semesters) {
          const loadedSemesters = (staticSetup.semesters || []).filter(s => s.active);
          setSemesters(loadedSemesters);
          erpStorage.setSemesters(loadedSemesters);
        }
      }
    } catch (err) {
      console.error('Failed to refresh academic structure:', err);
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
      const activeUser = erpStorage.getCurrentSessionUser() || user;
      const currentRole = role || activeUser?.role;
      const studentId = activeUser?.student_id || activeUser?.student?.id;
      const sectionId = activeUser?.student?.section_id || (activeUser as any)?.section_id;
      const facultyId = activeUser?.faculty_id || activeUser?.faculty?.id || activeUser?.id;

      let data: any;
      if (currentRole === 'student') {
        if (studentId) {
          data = await supabaseService.fetchStudentAcademicRecords(studentId, sectionId);
        } else {
          data = { courseAssignments: [], assignmentSubmissions: [], quizzes: [], quizResults: [], sessionalMarks: [], sessionalAssessments: [] };
        }
      } else if ((currentRole === 'faculty' || currentRole === 'hod') && facultyId) {
        data = await supabaseService.fetchFacultyAcademicRecords(facultyId);
      } else if (currentRole === 'super_admin') {
        data = await supabaseService.fetchAssessments();
      } else {
        data = { courseAssignments: [], assignmentSubmissions: [], quizzes: [], quizResults: [], sessionalMarks: [], sessionalAssessments: [] };
      }

      const curSubjects = subjectsRef.current;
      const curFaculty = facultyRef.current;
      const curSections = sectionsRef.current;
      const curStudents = studentsRef.current;

      const enrichedCourseAssignments: Assignment[] = (data.courseAssignments || []).map((a: any) => ({
        ...a,
        subject: curSubjects.find(s => s.id === a.subject_id),
        faculty: curFaculty.find(f => f.id === a.faculty_id),
        section: curSections.find(sec => sec.id === a.section_id),
      }));

      const enrichedSubmissions: AssignmentSubmission[] = (data.assignmentSubmissions || []).map((sub: any) => ({
        ...sub,
        student: curStudents.find(s => s.id === sub.student_id),
        assignment: enrichedCourseAssignments.find(a => a.id === sub.assignment_id),
        grader: curFaculty.find(f => f.id === sub.graded_by),
      }));

      const enrichedQuizzes: Quiz[] = (data.quizzes || []).map((q: any) => ({
        ...q,
        subject: curSubjects.find(s => s.id === q.subject_id),
        faculty: curFaculty.find(f => f.id === q.faculty_id),
        section: curSections.find(sec => sec.id === q.section_id),
      }));

      const enrichedQuizResults: QuizResult[] = (data.quizResults || []).map((qr: any) => ({
        ...qr,
        student: curStudents.find(s => s.id === qr.student_id),
        quiz: enrichedQuizzes.find(q => q.id === qr.quiz_id),
        grader: curFaculty.find(f => f.id === qr.graded_by),
      }));

      const enrichedAssessments: SessionalAssessment[] = (data.sessionalAssessments || []).map((sa: any) => ({
        ...sa,
        subject: curSubjects.find(s => s.id === sa.subject_id),
        faculty: curFaculty.find(f => f.id === sa.faculty_id),
        section: curSections.find(sec => sec.id === sa.section_id),
      }));

      const enrichedSessionalMarks: SessionalMark[] = (data.sessionalMarks || []).map((sm: any) => ({
        ...sm,
        student: curStudents.find(s => s.id === sm.student_id),
        subject: curSubjects.find(s => s.id === sm.subject_id),
        faculty: curFaculty.find(f => f.id === sm.faculty_id),
        section: curSections.find(sec => sec.id === sm.section_id),
        sessional_assessment: enrichedAssessments.find(a => a.id === sm.sessional_assessment_id),
      }));

      const enrichedMarksHistory: MarksHistory[] = (data.marksHistory || []).map((mh: any) => ({
        ...mh,
        student: curStudents.find(s => s.id === mh.student_id),
        subject: curSubjects.find(s => s.id === mh.subject_id),
      }));

      setCourseAssignments(enrichedCourseAssignments.filter(a => a.active !== false && !a.deleted_at));
      setAssignmentSubmissions(enrichedSubmissions);
      setQuizzes(deduplicateQuizzes(enrichedQuizzes).filter(q => q.active !== false && !q.deleted_at));
      setQuizResults(enrichedQuizResults);
      setSessionalAssessments(deduplicateSessionals(enrichedAssessments).filter(sa => sa.status !== 'archived' && !sa.deleted_at));
      setSessionalMarks(prev => {
        if (!enrichedSessionalMarks || enrichedSessionalMarks.length === 0) return prev;
        const incomingMap = new Map(enrichedSessionalMarks.map(m => [m.id || `${m.sessional_assessment_id}_${m.student_id}`, m]));
        const merged = prev.map(m => incomingMap.get(m.id || `${m.sessional_assessment_id}_${m.student_id}`) || m);
        for (const [key, val] of incomingMap.entries()) {
          if (!merged.some(m => (m.id && m.id === val.id) || (`${m.sessional_assessment_id}_${m.student_id}` === key))) {
            merged.push(val);
          }
        }
        return merged;
      });
      setMarksHistory(enrichedMarksHistory);
    } catch (err) {
      console.error('Failed to refresh assessments:', err);
    }
  }, [user?.id, role]);

  const refreshCoordinatorAssignments = useCallback(async (facultyId?: string) => {
    try {
      const raw = await supabaseService.fetchClassCoordinatorAssignments(facultyId);
      if (facultyId) {
        setClassCoordinatorAssignments(prev => [
          ...prev.filter(c => c.faculty_id !== facultyId),
          ...raw,
        ]);
      } else {
        setClassCoordinatorAssignments(raw);
      }
      return raw;
    } catch (err) {
      console.error('Failed to refresh coordinator assignments:', err);
      return [];
    }
  }, []);

  const getFacultyCoordinatorAssignments = useCallback((facultyId: string) => {
    if (!facultyId) return [];
    return classCoordinatorAssignments.filter(c => c.faculty_id === facultyId && c.active);
  }, [classCoordinatorAssignments]);

  const refreshNotifications = useCallback(async (studentId?: string, userId?: string, facultyId?: string) => {
    try {
      const activeUser = erpStorage.getCurrentSessionUser() || user;
      const stId = studentId || activeUser?.student_id || activeUser?.student?.id;
      const uId = userId || activeUser?.id;
      const facId = facultyId || activeUser?.faculty_id || activeUser?.faculty?.id;
      const role = activeUser?.role;
      if (stId || uId || facId || role) {
        const notifs = await supabaseService.fetchStudentNotifications(stId || '', uId, role, facId);
        setNotifications(notifs);
      }
    } catch (err) {
      console.warn('Notice: Error refreshing notifications:', err);
    }
  }, [user]);

  const refreshConversations = useCallback(async () => {
    try {
      const activeUser = erpStorage.getCurrentSessionUser() || user;
      if (!activeUser?.id) return;
      const studentId = activeUser.student_id || activeUser.student?.id;
      const facultyId = activeUser.faculty_id || activeUser.faculty?.id;
      const convs = await supabaseService.fetchUserConversations(
        activeUser.id, 
        activeUser.role || '',
        { studentId, facultyId }
      );
      setConversations(convs);
    } catch (err) {
      console.warn('Notice: Error refreshing conversations:', err);
    }
  }, [user]);

  const isRefreshingMessageGroupsRef = useRef(false);
  const refreshMessageGroups = useCallback(async () => {
    if (isRefreshingMessageGroupsRef.current) return;
    isRefreshingMessageGroupsRef.current = true;
    try {
      const activeUser = erpStorage.getCurrentSessionUser() || user;
      if (!activeUser?.id) return;
      const facultyId = activeUser.faculty_id || activeUser.faculty?.id;
      const studentSectionId = activeUser.student?.section_id || (activeUser as any)?.section_id;
      const studentYearId = activeUser.student?.academic_year_id || (activeUser as any)?.academic_year_id;
      const departmentId = activeUser.department_id || activeUser.faculty?.department_id;
      const groups = await supabaseService.fetchUserMessageGroups(
        activeUser.id, 
        activeUser.role || '',
        { facultyId, studentSectionId, studentYearId, departmentId }
      );
      setMessageGroups(prev => {
        if (
          prev.length === groups.length &&
          prev.every((p, i) =>
            p.id === groups[i]?.id &&
            p.unread_count === groups[i]?.unread_count &&
            p.members_count === groups[i]?.members_count &&
            p.last_message_at === groups[i]?.last_message_at &&
            p.last_message_preview === groups[i]?.last_message_preview
          )
        ) {
          return prev;
        }
        return groups;
      });
    } catch (err) {
      console.warn('Notice: Error refreshing message groups:', err);
    } finally {
      isRefreshingMessageGroupsRef.current = false;
    }
  }, [user]);

  const refreshLeaveApplications = useCallback(async (forcedStudentId?: string, forcedFacultyId?: string): Promise<LeaveApplication[]> => {
    try {
      const activeUser = erpStorage.getCurrentSessionUser() || user;
      const role = activeUser?.role;
      const studId = forcedStudentId || activeUser?.student_id || activeUser?.student?.id || (role === 'student' ? activeUser?.id : undefined);
      const facId = forcedFacultyId || activeUser?.faculty_id || activeUser?.faculty?.id || (role === 'faculty' ? activeUser?.id : undefined);
      const deptId = activeUser?.department_id || activeUser?.faculty?.department_id;

      let apps: LeaveApplication[] = [];
      if (role === 'student' && studId) {
        apps = await supabaseService.fetchStudentLeaveApplications(studId);
      } else if (role === 'faculty') {
        apps = await supabaseService.fetchCoordinatorLeaveApplications(facId);
      } else if (role === 'hod') {
        apps = await supabaseService.fetchHODLeaveApplications(deptId || undefined);
      } else if (role === 'super_admin') {
        apps = await supabaseService.fetchHODLeaveApplications();
      } else if (studId) {
        apps = await supabaseService.fetchStudentLeaveApplications(studId);
      }
      setLeaveApplications(apps);
      return apps;
    } catch (err) {
      console.warn('Notice: Error refreshing leave applications:', err);
      return [];
    }
  }, [user]);

  // Network online/offline listener with automatic reconnection and refresh
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      loadDataFromSupabase(false);
      refreshNotifications();
      refreshLeaveApplications();
      // Stagger communication tables so core ERP loads first
      setTimeout(() => {
        const activeUser = erpStorage.getCurrentSessionUser() || user;
        const currentRole = role || activeUser?.role;
        if (currentRole === 'super_admin') return;
        refreshConversations();
        refreshMessageGroups();
      }, 2000);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadDataFromSupabase, refreshNotifications, refreshConversations, refreshMessageGroups, refreshLeaveApplications]);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    await supabaseService.markNotificationAsRead(notificationId);
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    const activeUser = erpStorage.getCurrentSessionUser();
    await supabaseService.markAllNotificationsAsRead(activeUser?.id, activeUser?.student_id || activeUser?.student?.id);
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

  // Initial load & automatic refresh on auth state changes (strictly authenticated)
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    loadDataFromSupabase(false);
    let deferTimer: NodeJS.Timeout | null = null;
    let idleTimer: NodeJS.Timeout | null = null;

    // Fast lightweight notifications and leave badge after primary load
    deferTimer = setTimeout(() => {
      refreshNotifications();
      refreshLeaveApplications();
    }, 400);

    // Idle deferred communication hydration for unread count badges (zero initial render contention)
    idleTimer = setTimeout(() => {
      const activeUser = erpStorage.getCurrentSessionUser() || user;
      const currentRole = role || activeUser?.role;
      if (currentRole === 'super_admin') return;

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          refreshConversations();
          refreshMessageGroups();
        }, { timeout: 3000 });
      } else {
        refreshConversations();
        refreshMessageGroups();
      }
    }, 2500);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (Date.now() - lastFullLoadRef.current > 5000) {
          loadDataFromSupabase(false);
        }
        if (deferTimer) clearTimeout(deferTimer);
        deferTimer = setTimeout(() => {
          refreshNotifications();
          refreshLeaveApplications();
        }, 400);
      } else if (event === 'SIGNED_OUT') {
        setAttendanceSessions([]);
        setAttendanceRecords([]);
        setCorrections([]);
        setAdminAccounts([]);
        setNotifications([]);
        setConversations([]);
        setMessageGroups([]);
        setLeaveApplications([]);
        setIsLoading(false);
      }
    });

    return () => {
      if (deferTimer) clearTimeout(deferTimer);
      if (idleTimer) clearTimeout(idleTimer);
      subscription.unsubscribe();
    };
  }, [authLoading, isAuthenticated, loadDataFromSupabase, refreshNotifications, refreshConversations, refreshMessageGroups, refreshLeaveApplications]);

  // Stable ref for realtime event handlers to eliminate channel resubscription churn
  const realtimeHandlersRef = useRef({
    refreshStudents,
    refreshTimetable,
    refreshAttendance,
    refreshCorrections,
    refreshFaculty,
    refreshSections,
    refreshSubjects,
    refreshAcademicStructure,
    refreshAssignments,
    refreshAssessments,
    refreshCoordinatorAssignments,
    refreshNotifications,
    refreshConversations,
    refreshMessageGroups,
    refreshLeaveApplications,
  });

  useEffect(() => {
    realtimeHandlersRef.current = {
      refreshStudents,
      refreshTimetable,
      refreshAttendance,
      refreshCorrections,
      refreshFaculty,
      refreshSections,
      refreshSubjects,
      refreshAcademicStructure,
      refreshAssignments,
      refreshAssessments,
      refreshCoordinatorAssignments,
      refreshNotifications,
      refreshConversations,
      refreshMessageGroups,
      refreshLeaveApplications,
    };
  });

  // Realtime Supabase Channel Subscription with role-scoped event handlers and idempotency protection
  useEffect(() => {
    if (!isAuthenticated) return;

    const activeUserId = user?.id || erpStorage.getCurrentSessionUser()?.id;
    const activeRole = role || erpStorage.getCurrentSessionUser()?.role;
    if (!activeUserId) return;

    const activeStudentId = user?.student_id || user?.student?.id || erpStorage.getCurrentSessionUser()?.student_id;
    const activeFacultyId = user?.faculty_id || user?.faculty?.id || erpStorage.getCurrentSessionUser()?.faculty_id;
    const activeSectionId = user?.student?.section_id || erpStorage.getCurrentSessionUser()?.student?.section_id;

    const channelName = 'vctm-erp-realtime-channel';

    let builder = supabase
      .channel(channelName)
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
        realtimeHandlersRef.current.refreshTimetable(secId);
        if (action === 'DELETED') {
          realtimeHandlersRef.current.refreshAssignments();
        }
      })
      .on('broadcast', { event: 'attendance_updated' }, () => {
        realtimeHandlersRef.current.refreshAttendance();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
        const newNotif = payload?.new as StudentNotification;
        if (newNotif && newNotif.id) {
          if (seenNotificationIdsRef.current.has(newNotif.id)) return;
          seenNotificationIdsRef.current.add(newNotif.id);

          const curUserId = user?.id || erpStorage.getCurrentSessionUser()?.id;
          const curStudentId = user?.student_id || user?.student?.id || erpStorage.getCurrentSessionUser()?.student_id;
          const curFacultyId = user?.faculty_id || user?.faculty?.id || erpStorage.getCurrentSessionUser()?.faculty_id;
          const curRole = role || erpStorage.getCurrentSessionUser()?.role;

          const targetStudId = newNotif.recipient_student_id || newNotif.student_id;
          const targetUserId = newNotif.recipient_user_id || newNotif.user_id;
          const targetFacId = (newNotif as any).recipient_faculty_id;
          const isTargetUser = 
            (targetStudId && targetStudId === curStudentId) ||
            (targetUserId && targetUserId === curUserId) ||
            (targetFacId && targetFacId === curFacultyId) ||
            (newNotif.recipient_role && curRole && newNotif.recipient_role.toUpperCase() === curRole.toUpperCase()) ||
            (!targetStudId && !targetUserId && !targetFacId && !newNotif.recipient_role);

          if (isTargetUser) {
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });

            const isViewingThisConversation = 
              newNotif.reference_type === 'conversation' && 
              newNotif.reference_id && 
              newNotif.reference_id === activeConversationIdRef.current;

            const isViewingThisGroup = 
              newNotif.reference_type === 'group_message' && 
              newNotif.reference_id && 
              newNotif.reference_id === activeGroupIdRef.current;

            if (!isViewingThisConversation && !isViewingThisGroup) {
              setActiveToast({
                id: newNotif.id,
                title: newNotif.title,
                message: newNotif.message,
                type: newNotif.type,
                referenceType: newNotif.reference_type,
                referenceId: newNotif.reference_id,
              });
            }
          }
        }
        debounceTableSync('notifications', () => realtimeHandlersRef.current.refreshNotifications());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload: any) => {
        const updated = payload?.new as StudentNotification;
        if (updated) {
          setNotifications(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload: any) => {
        if (payload?.eventType === 'DELETE' && payload?.old?.id) {
          const deletedId = payload.old.id;
          setConversations(prev => prev.filter(c => c.id !== deletedId));
          return;
        }
        debounceTableSync('conversations', () => realtimeHandlersRef.current.refreshConversations());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
        const newMsg = payload?.new as Message;
        if (newMsg && newMsg.conversation_id) {
          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === newMsg.conversation_id);
            if (idx === -1) {
              debounceTableSync('messages', () => realtimeHandlersRef.current.refreshConversations());
              return prev;
            }
            const target = prev[idx];
            const isForActiveThread = activeConversationIdRef.current === newMsg.conversation_id;
            const isIncoming = newMsg.sender_user_id !== (userRef.current?.id || '');
            const updated: Conversation = {
              ...target,
              last_message_preview: newMsg.is_unsent ? 'Message unsent' : newMsg.message,
              last_message_at: newMsg.created_at || target.last_message_at,
              unread_count: (isIncoming && !isForActiveThread) ? (target.unread_count || 0) + 1 : (target.unread_count || 0),
            };
            const rest = prev.filter(c => c.id !== newMsg.conversation_id);
            return [updated, ...rest];
          });
          realtimeHandlersRef.current.refreshNotifications();
        } else {
          debounceTableSync('messages', () => {
            realtimeHandlersRef.current.refreshConversations();
            realtimeHandlersRef.current.refreshNotifications();
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages' }, (payload: any) => {
        const newGroupMsg = payload?.new as GroupMessage;
        if (newGroupMsg && newGroupMsg.group_id) {
          setMessageGroups(prev => {
            const idx = prev.findIndex(g => g.id === newGroupMsg.group_id);
            if (idx === -1) {
              debounceTableSync('group_messages', () => realtimeHandlersRef.current.refreshMessageGroups());
              return prev;
            }
            const target = prev[idx];
            const isForActiveGroup = activeGroupIdRef.current === newGroupMsg.group_id;
            const isIncoming = newGroupMsg.sender_user_id !== (userRef.current?.id || '');
            const updated: MessageGroup = {
              ...target,
              last_message_preview: newGroupMsg.message,
              last_message_at: newGroupMsg.created_at || target.last_message_at,
              unread_count: (isIncoming && !isForActiveGroup) ? (target.unread_count || 0) + 1 : (target.unread_count || 0),
            };
            const rest = prev.filter(g => g.id !== newGroupMsg.group_id);
            return [updated, ...rest];
          });
        } else {
          debounceTableSync('group_messages', () => {
            realtimeHandlersRef.current.refreshMessageGroups();
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_groups' }, (payload: any) => {
        if (payload?.eventType === 'DELETE' && payload?.old?.id) {
          const deletedId = payload.old.id;
          setMessageGroups(prev => prev.filter(g => g.id !== deletedId));
          groupMessagesCacheRef.current.delete(deletedId);
          return;
        }
        debounceTableSync('message_groups', () => realtimeHandlersRef.current.refreshMessageGroups());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_applications' }, () => {
        debounceTableSync('leave_applications', () => {
          realtimeHandlersRef.current.refreshLeaveApplications();
          realtimeHandlersRef.current.refreshNotifications();
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, (payload: any) => {
        if (payload?.eventType === 'INSERT' && payload?.new?.id) {
          const newDept = payload.new as Department;
          setDepartments(prev => prev.some(d => d.id === newDept.id) ? prev : [...prev, newDept]);
        } else if (payload?.eventType === 'UPDATE' && payload?.new?.id) {
          const updDept = payload.new as Department;
          setDepartments(prev => prev.map(d => d.id === updDept.id ? updDept : d));
        } else if (payload?.eventType === 'DELETE' && payload?.old?.id) {
          setDepartments(prev => prev.filter(d => d.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'semesters' }, (payload: any) => {
        if (payload?.eventType === 'UPDATE' && payload?.new?.id) {
          const updSem = payload.new as Semester;
          setSemesters(prev => prev.map(s => s.id === updSem.id ? { ...s, ...updSem } : s));
        }
      });

    // Role-specific granular table subscriptions
    if (activeRole === 'student') {
      builder = builder
        .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_entries' }, (payload: any) => {
          const secId = payload?.new?.section_id || payload?.old?.section_id;
          if (!activeSectionId || secId === activeSectionId) {
            debounceTableSync('timetable_entries', () => realtimeHandlersRef.current.refreshTimetable(secId));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload: any) => {
          const studId = payload?.new?.student_id || payload?.old?.student_id;
          if (!activeStudentId || studId === activeStudentId) {
            debounceTableSync('attendance', () => {
              realtimeHandlersRef.current.refreshAttendance();
              realtimeHandlersRef.current.refreshCorrections();
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessional_assessments' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.status === 'archived') {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setSessionalAssessments(prev => prev.filter(sa => sa.id !== delId));
          }
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessional_marks' }, (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const delId = payload?.old?.id;
            const delAssId = payload?.old?.sessional_assessment_id;
            const delStudId = payload?.old?.student_id;
            setSessionalMarks(prev => prev.filter(m => {
              if (delId && m.id === delId) return false;
              if (delAssId && delStudId && m.sessional_assessment_id === delAssId && m.student_id === delStudId) return false;
              return true;
            }));
            return;
          }

          const incoming = payload?.new as SessionalMark;
          if (!incoming?.id && !(incoming?.sessional_assessment_id && incoming?.student_id)) return;

          setSessionalMarks(prev => {
            const matchId = incoming.id;
            const matchAssId = incoming.sessional_assessment_id;
            const matchStudId = incoming.student_id;
            const existingIdx = prev.findIndex(m => 
              (matchId && m.id === matchId) ||
              (matchAssId && matchStudId && m.sessional_assessment_id === matchAssId && m.student_id === matchStudId)
            );

            if (existingIdx >= 0) {
              const existing = prev[existingIdx];
              if (existing.updated_at && incoming.updated_at && new Date(existing.updated_at).getTime() > new Date(incoming.updated_at).getTime()) {
                return prev;
              }
              const updated = [...prev];
              updated[existingIdx] = { ...existing, ...incoming };
              return updated;
            } else {
              return [incoming, ...prev];
            }
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.active === false) {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setCourseAssignments(prev => prev.filter(a => a.id !== delId));
          }
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions' }, (payload: any) => {
          const studId = payload?.new?.student_id || payload?.old?.student_id;
          if (!activeStudentId || studId === activeStudentId) {
            debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.active === false) {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setQuizzes(prev => prev.filter(q => q.id !== delId));
          }
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_results' }, (payload: any) => {
          const studId = payload?.new?.student_id || payload?.old?.student_id;
          if (!activeStudentId || studId === activeStudentId) {
            debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
          debounceTableSync('notifications', () => realtimeHandlersRef.current.refreshNotifications());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_corrections' }, () => {
          debounceTableSync('attendance_corrections', () => {
            realtimeHandlersRef.current.refreshCorrections();
            realtimeHandlersRef.current.refreshAttendance();
          });
        });
    } else if (activeRole === 'faculty') {
      builder = builder
        .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_entries' }, (payload: any) => {
          const facId = payload?.new?.faculty_id || payload?.old?.faculty_id;
          const secId = payload?.new?.section_id || payload?.old?.section_id;
          if (!activeFacultyId || facId === activeFacultyId) {
            debounceTableSync('timetable_entries', () => realtimeHandlersRef.current.refreshTimetable(secId));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
          if (Date.now() - lastAttendanceSaveTimeRef.current >= 4000) {
            debounceTableSync('attendance', () => realtimeHandlersRef.current.refreshAttendance());
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
          if (Date.now() - lastAttendanceSaveTimeRef.current >= 4000) {
            debounceTableSync('attendance', () => {
              realtimeHandlersRef.current.refreshAttendance();
              realtimeHandlersRef.current.refreshCorrections();
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_corrections' }, () => {
          debounceTableSync('attendance_corrections', () => {
            realtimeHandlersRef.current.refreshCorrections();
            realtimeHandlersRef.current.refreshAttendance();
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessional_assessments' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.status === 'archived') {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setSessionalAssessments(prev => prev.filter(sa => sa.id !== delId));
          }
          if (Date.now() - lastMarksSaveTimeRef.current >= 4000) {
            debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessional_marks' }, (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const delId = payload?.old?.id;
            const delAssId = payload?.old?.sessional_assessment_id;
            const delStudId = payload?.old?.student_id;
            setSessionalMarks(prev => prev.filter(m => {
              if (delId && m.id === delId) return false;
              if (delAssId && delStudId && m.sessional_assessment_id === delAssId && m.student_id === delStudId) return false;
              return true;
            }));
            return;
          }

          const incoming = payload?.new as SessionalMark;
          if (!incoming?.id && !(incoming?.sessional_assessment_id && incoming?.student_id)) return;

          setSessionalMarks(prev => {
            const matchId = incoming.id;
            const matchAssId = incoming.sessional_assessment_id;
            const matchStudId = incoming.student_id;
            const existingIdx = prev.findIndex(m => 
              (matchId && m.id === matchId) ||
              (matchAssId && matchStudId && m.sessional_assessment_id === matchAssId && m.student_id === matchStudId)
            );

            if (existingIdx >= 0) {
              const existing = prev[existingIdx];
              if (existing.updated_at && incoming.updated_at && new Date(existing.updated_at).getTime() > new Date(incoming.updated_at).getTime()) {
                return prev;
              }
              const updated = [...prev];
              updated[existingIdx] = { ...existing, ...incoming };
              return updated;
            } else {
              return [incoming, ...prev];
            }
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.active === false) {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setCourseAssignments(prev => prev.filter(a => a.id !== delId));
          }
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions' }, () => {
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.active === false) {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setQuizzes(prev => prev.filter(q => q.id !== delId));
          }
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_results' }, () => {
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
          debounceTableSync('notifications', () => realtimeHandlersRef.current.refreshNotifications());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) {
              setStudents(prev => {
                const next = prev.filter(s => s.id !== delId);
                erpStorage.setStudents(next);
                return next;
              });
            }
          } else if (payload.eventType === 'UPDATE' && payload?.new?.id) {
            setStudents(prev => {
              const next = prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s);
              erpStorage.setStudents(next);
              return next;
            });
          } else {
            debounceTableSync('students', () => realtimeHandlersRef.current.refreshStudents());
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty_subject_assignments' }, () => {
          debounceTableSync('faculty_subject_assignments', () => realtimeHandlersRef.current.refreshAssignments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, () => {
          debounceTableSync('sections', () => realtimeHandlersRef.current.refreshSections());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, () => {
          debounceTableSync('academic_years', () => realtimeHandlersRef.current.refreshAcademicStructure());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'semesters' }, () => {
          debounceTableSync('semesters', () => realtimeHandlersRef.current.refreshAcademicStructure());
        });
    } else {
      // HOD and Super Admin have oversight across academic and administrative entities
      builder = builder
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) {
              setStudents(prev => {
                const next = prev.filter(s => s.id !== delId);
                erpStorage.setStudents(next);
                return next;
              });
            }
          } else if (payload.eventType === 'UPDATE' && payload?.new?.id) {
            setStudents(prev => {
              const next = prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s);
              erpStorage.setStudents(next);
              return next;
            });
          } else {
            debounceTableSync('students', () => realtimeHandlersRef.current.refreshStudents());
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_entries' }, (payload: any) => {
          const secId = payload?.new?.section_id || payload?.old?.section_id;
          debounceTableSync('timetable_entries', () => realtimeHandlersRef.current.refreshTimetable(secId));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
          if (Date.now() - lastAttendanceSaveTimeRef.current >= 4000) {
            debounceTableSync('attendance', () => realtimeHandlersRef.current.refreshAttendance());
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
          if (Date.now() - lastAttendanceSaveTimeRef.current >= 4000) {
            debounceTableSync('attendance', () => {
              realtimeHandlersRef.current.refreshAttendance();
              realtimeHandlersRef.current.refreshCorrections();
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_corrections' }, () => {
          debounceTableSync('attendance_corrections', () => {
            realtimeHandlersRef.current.refreshCorrections();
            realtimeHandlersRef.current.refreshAttendance();
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty' }, () => {
          debounceTableSync('faculty', () => realtimeHandlersRef.current.refreshFaculty());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, () => {
          debounceTableSync('sections', () => {
            realtimeHandlersRef.current.refreshSections();
            realtimeHandlersRef.current.refreshCoordinatorAssignments();
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, () => {
          debounceTableSync('subjects', () => realtimeHandlersRef.current.refreshSubjects());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_years' }, () => {
          debounceTableSync('academic_years', () => realtimeHandlersRef.current.refreshAcademicStructure());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'semesters' }, () => {
          debounceTableSync('semesters', () => realtimeHandlersRef.current.refreshAcademicStructure());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty_subject_assignments' }, () => {
          debounceTableSync('faculty_subject_assignments', () => realtimeHandlersRef.current.refreshAssignments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.active === false) {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setCourseAssignments(prev => prev.filter(a => a.id !== delId));
          }
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions' }, () => {
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.active === false) {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setQuizzes(prev => prev.filter(q => q.id !== delId));
          }
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_results' }, () => {
          debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessional_assessments' }, (payload: any) => {
          if (payload.eventType === 'DELETE' || payload?.new?.deleted_at || payload?.new?.status === 'archived') {
            const delId = payload?.old?.id || payload?.new?.id;
            if (delId) setSessionalAssessments(prev => prev.filter(sa => sa.id !== delId));
          }
          if (Date.now() - lastMarksSaveTimeRef.current >= 4000) {
            debounceTableSync('assessments', () => realtimeHandlersRef.current.refreshAssessments());
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessional_marks' }, (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const delId = payload?.old?.id;
            const delAssId = payload?.old?.sessional_assessment_id;
            const delStudId = payload?.old?.student_id;
            setSessionalMarks(prev => prev.filter(m => {
              if (delId && m.id === delId) return false;
              if (delAssId && delStudId && m.sessional_assessment_id === delAssId && m.student_id === delStudId) return false;
              return true;
            }));
            return;
          }

          const incoming = payload?.new as SessionalMark;
          if (!incoming?.id && !(incoming?.sessional_assessment_id && incoming?.student_id)) return;

          setSessionalMarks(prev => {
            const matchId = incoming.id;
            const matchAssId = incoming.sessional_assessment_id;
            const matchStudId = incoming.student_id;
            const existingIdx = prev.findIndex(m => 
              (matchId && m.id === matchId) ||
              (matchAssId && matchStudId && m.sessional_assessment_id === matchAssId && m.student_id === matchStudId)
            );

            if (existingIdx >= 0) {
              const existing = prev[existingIdx];
              if (existing.updated_at && incoming.updated_at && new Date(existing.updated_at).getTime() > new Date(incoming.updated_at).getTime()) {
                return prev;
              }
              const updated = [...prev];
              updated[existingIdx] = { ...existing, ...incoming };
              return updated;
            } else {
              return [incoming, ...prev];
            }
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
          debounceTableSync('notifications', () => realtimeHandlersRef.current.refreshNotifications());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'class_coordinator_assignments' }, () => {
          debounceTableSync('class_coordinator_assignments', () => realtimeHandlersRef.current.refreshCoordinatorAssignments());
        });
    }

    const channel = builder.subscribe();

    return () => {
      Object.values(debounceTimersRef.current).forEach(t => clearTimeout(t));
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, role, debounceTableSync]);

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
    lastAttendanceSaveTimeRef.current = Date.now();

    // Immediately enrich and upsert saved session and records into local state
    if (result?.session && result?.records) {
      const curFaculty = facultyRef.current;
      const curSubjects = subjectsRef.current;
      const curSections = sectionsRef.current;
      const curStudents = studentsRef.current;

      const enrichedSession: AttendanceSession = {
        ...result.session,
        faculty: curFaculty.find(f => f.id === result.session.faculty_id),
        subject: curSubjects.find(s => s.id === result.session.subject_id),
        section: curSections.find(sec => sec.id === result.session.section_id),
      };

      const enrichedNewRecords: AttendanceRecord[] = result.records.map(rec => ({
        ...rec,
        student: curStudents.find(s => s.id === rec.student_id),
        session: enrichedSession,
      }));

      // Upsert session in local state & erpStorage
      setAttendanceSessions(prev => {
        const filtered = prev.filter(s => s.id !== enrichedSession.id);
        const next = [enrichedSession, ...filtered];
        erpStorage.setAttendanceSessions(next);
        return next;
      });

      // Upsert records in local state & erpStorage (replacing any existing records for this session)
      setAttendanceRecords(prev => {
        const filtered = prev.filter(r => r.attendance_session_id !== enrichedSession.id);
        const next = [...enrichedNewRecords, ...filtered];
        erpStorage.setAttendanceRecords(next);
        return next;
      });
    }

    return result;
  };

  const deleteAttendanceSession = async (sessionId: string) => {
    const result = await supabaseService.deleteAttendanceSession(sessionId);
    setAttendanceSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      erpStorage.setAttendanceSessions(next);
      return next;
    });
    setAttendanceRecords(prev => {
      const next = prev.filter(r => r.attendance_session_id !== sessionId);
      erpStorage.setAttendanceRecords(next);
      return next;
    });
    return result;
  };

  const pendingSessionLoadsRef = useRef<Set<string>>(new Set());

  const ensureSessionAttendanceLoaded = useCallback(async (sessionId: string): Promise<AttendanceRecord[]> => {
    if (!sessionId) return [];

    const existing = attendanceRecordsRef.current.filter(r => r.attendance_session_id === sessionId);
    if (existing.length > 0) {
      return existing;
    }

    if (pendingSessionLoadsRef.current.has(sessionId)) {
      return [];
    }
    pendingSessionLoadsRef.current.add(sessionId);

    try {
      const directRecords = await supabaseService.fetchSessionAttendanceRecords(sessionId);
      if (!directRecords || directRecords.length === 0) {
        return [];
      }

      const curStudents = studentsRef.current;
      const curSessions = attendanceSessionsRef.current;
      const matchedSession = curSessions.find(s => s.id === sessionId);

      const enriched: AttendanceRecord[] = directRecords.map(rec => ({
        ...rec,
        student: curStudents.find(s => s.id === rec.student_id),
        session: matchedSession || rec.session,
      }));

      setAttendanceRecords(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const toAdd = enriched.filter(r => !existingIds.has(r.id));
        if (toAdd.length === 0) return prev;
        const next = [...toAdd, ...prev];
        erpStorage.setAttendanceRecords(next);
        return next;
      });

      return enriched;
    } catch (err) {
      console.warn(`Failed to load attendance records for session ${sessionId}:`, err);
      return [];
    } finally {
      pendingSessionLoadsRef.current.delete(sessionId);
    }
  }, []);

  const getAttendanceSummary = useCallback((lookup: string | {
    sessionId?: string;
    timetableEntryId?: string;
    sessionDate?: string;
    sectionId?: string;
    subjectId?: string;
    startTime?: string;
  }): AttendanceSummary => {
    let session: AttendanceSession | undefined;

    const lookupDateStr = typeof lookup !== 'string' ? normalizeDateToIST(lookup.sessionDate) : '';

    if (typeof lookup === 'string') {
      session = attendanceSessions.find(s => s.id === lookup);
    } else {
      if (lookup.sessionId) {
        session = attendanceSessions.find(s => s.id === lookup.sessionId);
      }
      if (!session) {
        // Find all candidates matching date and lecture criteria
        const matchingSessions = attendanceSessions.filter(s => {
          const sDate = normalizeDateToIST(s.session_date);
          const matchesDate = !lookupDateStr || sDate === lookupDateStr;
          if (!matchesDate) return false;

          // 1. Direct timetable entry ID match
          if (lookup.timetableEntryId && s.timetable_entry_id === lookup.timetableEntryId) {
            return true;
          }

          // 2. Section + Subject + StartTime match
          if (lookup.sectionId && lookup.subjectId && s.section_id === lookup.sectionId && s.subject_id === lookup.subjectId) {
            const sStart = s.start_time?.substring(0, 5);
            const lStart = lookup.startTime?.substring(0, 5);
            if (!lStart || !sStart || sStart === lStart) {
              return true;
            }
          }

          // 3. Fallback: Section + StartTime match
          if (lookup.sectionId && lookup.startTime && s.section_id === lookup.sectionId) {
            const sStart = s.start_time?.substring(0, 5);
            const lStart = lookup.startTime?.substring(0, 5);
            if (sStart && lStart && sStart === lStart) {
              return true;
            }
          }

          return false;
        });

        if (matchingSessions.length > 0) {
          // Rank candidates:
          // 1. Prefer exact timetable_entry_id match
          // 2. Prefer status === 'completed' or marked_at present
          // 3. Prefer session with records in attendanceRecords
          // 4. Prefer latest created_at
          matchingSessions.sort((a, b) => {
            if (lookup.timetableEntryId) {
              const aTt = a.timetable_entry_id === lookup.timetableEntryId ? 1 : 0;
              const bTt = b.timetable_entry_id === lookup.timetableEntryId ? 1 : 0;
              if (aTt !== bTt) return bTt - aTt;
            }

            const aCompleted = a.status === 'completed' || a.marked_at ? 1 : 0;
            const bCompleted = b.status === 'completed' || b.marked_at ? 1 : 0;
            if (aCompleted !== bCompleted) return bCompleted - aCompleted;

            const aRecs = attendanceRecords.some(r => r.attendance_session_id === a.id) ? 1 : 0;
            const bRecs = attendanceRecords.some(r => r.attendance_session_id === b.id) ? 1 : 0;
            if (aRecs !== bRecs) return bRecs - aRecs;

            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
          });

          session = matchingSessions[0];
        }
      }
    }

    const sectionId = session?.section_id || 
      (typeof lookup !== 'string' ? lookup.sectionId : undefined) ||
      (typeof lookup !== 'string' && lookup.timetableEntryId ? timetable.find(t => t.id === lookup.timetableEntryId)?.section_id : undefined);

    const sectionStudents = sectionId
      ? students.filter(s => s.section_id === sectionId && s.active)
      : [];
    const uniqueStudentIds = Array.from(new Set(sectionStudents.map(s => s.id)));
    const total = uniqueStudentIds.length;

    if (!session) {
      // Check if data is currently loading from server
      if (isLoading && attendanceSessions.length === 0) {
        return {
          sessionId: undefined,
          total,
          present: 0,
          absent: 0,
          unmarked: total,
          marked: 0,
          progress: 0,
          status: 'LOADING',
          statusLabel: 'Verifying Attendance...',
        };
      }

      if (attendanceLoadErrorRef.current) {
        return {
          sessionId: undefined,
          total,
          present: 0,
          absent: 0,
          unmarked: total,
          marked: 0,
          progress: 0,
          status: 'NETWORK_ERROR',
          statusLabel: 'Unable to verify attendance',
        };
      }

      return {
        sessionId: undefined,
        total,
        present: 0,
        absent: 0,
        unmarked: total,
        marked: 0,
        progress: 0,
        status: 'NO_RECORDS',
        statusLabel: 'Not Recorded',
      };
    }

    const sessionRecords = attendanceRecords.filter(r => r.attendance_session_id === session.id);

    const studentStatusMap = new Map<string, string>();
    for (const r of sessionRecords) {
      if (uniqueStudentIds.length === 0 || uniqueStudentIds.includes(r.student_id)) {
        studentStatusMap.set(r.student_id, r.status);
      }
    }

    let present = 0;
    let absent = 0;
    studentStatusMap.forEach(status => {
      if (status === 'Present') present++;
      else if (status === 'Absent') absent++;
    });

    const marked = present + absent;
    const effectiveTotal = total > 0 ? total : marked;
    const unmarked = Math.max(0, effectiveTotal - marked);
    const progress = effectiveTotal > 0 ? Math.round((marked / effectiveTotal) * 100) : 0;

    let status: AttendanceSummaryStatus = 'NO_RECORDS';
    let statusLabel = 'Not Recorded';

    if (marked > 0) {
      if (marked >= effectiveTotal) {
        status = 'FULLY_MARKED';
        statusLabel = `Marked (${effectiveTotal}/${effectiveTotal})`;
      } else {
        status = 'PARTIALLY_MARKED';
        statusLabel = `Marked (${marked}/${effectiveTotal})`;
      }
    } else {
      // Marked is 0 in local state: check if session exists & was completed in database
      const isSessionCompletedInDb = session.status === 'completed' || (session.status !== 'pending' && Boolean(session.marked_at));
      if (isSessionCompletedInDb) {
        status = 'RECORDED';
        statusLabel = '✓ Marked';
        // Auto-hydrate child records in background if not already loading
        ensureSessionAttendanceLoaded(session.id);
      } else if (isLoading) {
        status = 'LOADING';
        statusLabel = 'Verifying Attendance...';
      } else {
        status = 'NO_RECORDS';
        statusLabel = 'Not Recorded';
      }
    }

    return {
      sessionId: session.id,
      total: effectiveTotal,
      present,
      absent,
      unmarked,
      marked,
      progress,
      status,
      statusLabel,
    };
  }, [attendanceSessions, attendanceRecords, students, timetable, isLoading, ensureSessionAttendanceLoaded]);

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
    // Execute authoritative server-side claimAttendance RPC
    const claimRes = await supabaseService.claimAttendance({
      timetableEntryId: params.timetableEntryId,
      attendanceRecordId: params.attendanceRecordId,
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

    const newCorrection: AttendanceCorrection = {
      id: claimRes.claimId || '',
      attendance_record_id: claimRes.recordId || params.attendanceRecordId || '',
      student_id: params.studentId,
      requested_status: params.requestedStatus,
      reason: params.reason,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
    };

    setCorrections(prev => [newCorrection, ...prev.filter(c => c.id !== newCorrection.id)]);
    refreshNotifications();
    refreshCorrections();
    return newCorrection;
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

    // Optimistically update local corrections state
    setCorrections(prev => prev.map(c => {
      if (c.id === params.correctionId) {
        return {
          ...c,
          status: params.status,
          reviewed_by: params.reviewerFacultyId,
          reviewed_at: new Date().toISOString(),
          review_remarks: params.reviewRemarks,
        };
      }
      return c;
    }));

    // If approved, optimistically flip attendance record to Present immediately
    if (params.status === 'approved' && res?.attendance_record_id) {
      setAttendanceRecords(prev => prev.map(r => {
        if (r.id === res.attendance_record_id) {
          return {
            ...r,
            status: 'Present',
            marked_by: params.reviewerFacultyId,
            marked_at: new Date().toISOString(),
          };
        }
        return r;
      }));
    }

    refreshNotifications();
    refreshCorrections();
    refreshAttendance();

    return res;
  };

  // 4. Validate whether student can submit a claim (Strict 09:00 AM - 03:40 PM IST Window & Class Completed)
  const canSubmitClaim = (params: {
    attendanceRecordId?: string;
    sessionDate: string;
    lectureType?: string;
    isBreak?: boolean;
    timetableEntryId?: string;
    startTime?: string;
    endTime?: string;
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

    // Class Completion Check: Attendance cannot be claimed for ongoing or future classes!
    let effectiveEndTime = params.endTime;
    let effectiveStartTime = params.startTime;
    if (!effectiveEndTime && params.timetableEntryId) {
      const entry = timetable.find((t: TimetableEntry) => t.id === params.timetableEntryId);
      if (entry) {
        effectiveEndTime = entry.end_time?.substring(0, 5) || entry.end_time;
        effectiveStartTime = entry.start_time?.substring(0, 5) || entry.start_time;
      }
    }
    if (effectiveEndTime) {
      const classDone = isClassCompleted({
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        sessionDate: params.sessionDate,
      });
      if (!classDone) {
        return {
          canSubmit: false,
          code: 'CLASS_NOT_ENDED',
          message: `Attendance claim is not permitted while class is ongoing or scheduled for the future. Class ends at ${effectiveEndTime}.`,
        };
      }
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
  const checkDepartmentReferences = async (deptId: string) => {
    return await supabaseService.checkDepartmentReferences(deptId);
  };

  const changeDepartmentHod = async (deptId: string, newFacultyId: string) => {
    const res = await supabaseService.changeDepartmentHod(deptId, newFacultyId);
    setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, hod_faculty_id: newFacultyId } : d));
    erpStorage.updateDepartment(deptId, { hod_faculty_id: newFacultyId });
    return res;
  };

  const removeDepartmentHod = async (deptId: string) => {
    const res = await supabaseService.removeDepartmentHod(deptId);
    setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, hod_faculty_id: undefined } : d));
    erpStorage.updateDepartment(deptId, { hod_faculty_id: undefined });
    return res;
  };

  const addDepartment = async (dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addDepartment(dept);
    setDepartments(prev => [...prev.filter(d => d.id !== res.id), res]);
    erpStorage.addDepartment(res);
    return res;
  };

  const updateDepartment = async (id: string, updates: Partial<Department>) => {
    const res = await supabaseService.updateDepartment(id, updates);
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, ...res } : d));
    erpStorage.updateDepartment(id, updates);
    return res;
  };

  const deleteDepartment = async (id: string) => {
    const res = await supabaseService.deleteDepartment(id);
    if (res.deleted) {
      setDepartments(prev => prev.filter(d => d.id !== id));
      erpStorage.deleteDepartment(id);
    } else if (res.deactivated) {
      setDepartments(prev => prev.map(d => d.id === id ? { ...d, active: false } : d));
      erpStorage.updateDepartment(id, { active: false });
    }
    return res;
  };

  const addProgram = async (prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addProgram(prog);
    setPrograms(prev => [...prev.filter(p => p.id !== res.id), res]);
    erpStorage.addProgram(res);
    return res;
  };

  const updateProgram = async (id: string, updates: Partial<Program>) => {
    const res = await supabaseService.updateProgram(id, updates);
    setPrograms(prev => prev.map(p => p.id === id ? { ...p, ...res } : p));
    erpStorage.updateProgram(id, updates);
    return res;
  };

  const deleteProgram = async (id: string) => {
    const res = await supabaseService.deleteProgram(id);
    setPrograms(prev => prev.filter(p => p.id !== id));
    erpStorage.deleteProgram(id);
    return res;
  };

  const setCurrentAcademicTerm = async (sessionId: string, termType: 'ODD' | 'EVEN', semesterNumber?: number) => {
    const res = await supabaseService.setCurrentAcademicTerm(sessionId, termType, semesterNumber);
    if (res.activated_semesters) {
      setSemesters(prev => prev.map(s => {
        const isActive = res.all_semesters_active
          ? (semesterNumber ? s.semester_number === semesterNumber : s.term_type === termType)
          : res.activated_semesters.includes(s.semester_number);
        return {
          ...s,
          status: isActive ? 'ACTIVE' : 'UPCOMING',
          is_current: isActive,
        };
      }));
    }
    return res;
  };

  const updateSemesterDates = async (semesterId: string, startDate?: string | null, endDate?: string | null) => {
    const res = await supabaseService.updateSemesterDates(semesterId, startDate, endDate);
    setSemesters(prev => prev.map(s => s.id === semesterId ? { ...s, ...res } : s));
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

  const archiveSection = async (id: string) => {
    const res = await supabaseService.archiveSection(id);
    await refreshSections();
    return res;
  };

  const restoreSection = async (id: string) => {
    const res = await supabaseService.restoreSection(id);
    await refreshSections();
    return res;
  };

  const checkSectionReferences = async (id: string) => {
    return await supabaseService.checkSectionReferences(id);
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
    coordinatorAssignments?: Array<{
      section_id: string;
      academic_year_id?: string;
    }>;
    actorName?: string;
  }) => {
    const res = await supabaseService.createFacultyWithAssignments(params);
    await Promise.all([refreshFaculty(), refreshAssignments(), refreshCoordinatorAssignments()]);
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
    coordinatorAssignments?: Array<{
      section_id: string;
      academic_year_id?: string;
    }>;
    actorName?: string;
  }) => {
    const res = await supabaseService.updateFacultyWithAssignments(params);
    await Promise.all([refreshFaculty(), refreshAssignments(), refreshCoordinatorAssignments(), refreshSections()]);
    return res;
  };

  const assignCoordinator = async (facultyId: string, sectionId: string, sessionId?: string, assignedBy?: string) => {
    const res = await supabaseService.assignClassCoordinator(facultyId, sectionId, sessionId, assignedBy);
    await Promise.all([refreshCoordinatorAssignments(), refreshSections()]);
    return res;
  };

  const removeCoordinator = async (facultyId: string, sectionId: string) => {
    const res = await supabaseService.removeClassCoordinator(facultyId, sectionId);
    await Promise.all([refreshCoordinatorAssignments(), refreshSections()]);
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
    const isNonInstructional = (type?: string, period?: number) => {
      if (period === 5) return true;
      if (!type) return false;
      const t = type.toLowerCase().trim();
      return t === 'lunch' || t.includes('lunch') || t.includes('break') || t.includes('sport') || t.includes('recess') || t.includes('other');
    };

    const isCommonArea = (room?: string) => {
      if (!room) return true;
      const r = room.toLowerCase().trim();
      return (
        r === '' ||
        r === 'tbd' ||
        r === 'room' ||
        r.includes('refectory') ||
        r.includes('break') ||
        r.includes('cafeteria') ||
        r.includes('dining') ||
        r.includes('canteen') ||
        r.includes('ground') ||
        r.includes('sports')
      );
    };

    const formatSectionLabel = (secId?: string) => {
      if (!secId) return 'Another Section';
      const sec = sections.find(s => s.id === secId);
      if (!sec) return 'Another Section';
      const sem = semesters.find(sm => sm.id === sec.semester_id);
      const yr = years.find(y => y.id === sem?.academic_year_id);
      const yrPrefix = yr?.name || (sem?.semester_number ? `${Math.ceil(sem.semester_number / 2)}th Year` : '');
      const semSuffix = sem?.semester_number ? ` (Sem ${sem.semester_number})` : '';
      return yrPrefix ? `${yrPrefix} Section ${sec.name}${semSuffix}` : `Section ${sec.name}${semSuffix}`;
    };

    // Filter active entries: strictly exclude current slot by ID and slot coordinates
    const activeEntries = timetable.filter(t => {
      if (!t.active) return false;
      // Exclude exact slot ID being edited
      if (excludeId && t.id === excludeId) return false;
      // Exclude the same slot being edited by coordinates
      if (
        entry.section_id &&
        t.section_id === entry.section_id &&
        t.day_of_week === entry.day_of_week &&
        t.period_number === entry.period_number
      ) {
        return false;
      }
      return true;
    });

    const toMins = (t?: string) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const hasTimeOverlap = (
      e1: { start_time?: string; end_time?: string; period_number: number },
      e2: { start_time?: string; end_time?: string; period_number: number }
    ) => {
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

    // Rule 1: Same Section Intra-Slot Collision (Multiple classes scheduled in the same section at the same time)
    if (entry.section_id) {
      const sameSecConflict = activeEntries.find(
        t => t.section_id === entry.section_id &&
             t.day_of_week === entry.day_of_week &&
             hasTimeOverlap(entry, t)
      );
      if (sameSecConflict) {
        const sub = subjects.find(s => s.id === sameSecConflict.subject_id);
        return {
          type: 'same_section',
          severity: 'blocking',
          message: `Same-section collision: ${formatSectionLabel(entry.section_id)} already has ${sub?.subject_code || 'a lecture'} scheduled on ${entry.day_of_week} Period ${sameSecConflict.period_number} (${sameSecConflict.start_time || ''}–${sameSecConflict.end_time || ''}).`,
          conflictingEntry: sameSecConflict
        };
      }
    }

    // Rule 2: Faculty Double-Booking across sections (Strictly skipped for non-instructional slots e.g. Lunch Break, Sports, Other, Period 5)
    if (entry.faculty_id && !isNonInstructional(entry.lecture_type, entry.period_number)) {
      const facultyConflict = activeEntries.find(
        t => t.section_id !== entry.section_id &&
             !isNonInstructional(t.lecture_type, t.period_number) &&
             t.faculty_id === entry.faculty_id &&
             t.day_of_week === entry.day_of_week &&
             hasTimeOverlap(entry, t)
      );

      if (facultyConflict) {
        const fac = faculty.find(f => f.id === entry.faculty_id);
        return {
          type: 'faculty',
          severity: 'blocking',
          message: `Faculty conflict: ${fac?.full_name || 'Faculty'} is already scheduled to teach ${formatSectionLabel(facultyConflict.section_id)} during Period ${facultyConflict.period_number} on ${entry.day_of_week} (${facultyConflict.start_time || ''}–${facultyConflict.end_time || ''}).`,
          conflictingEntry: facultyConflict
        };
      }
    }

    // Rule 3: Room Collision across sections
    // Strictly requires:
    // 1. Entry is instructional (NOT Lunch, NOT Period 5, NOT Sports, NOT Other)
    // 2. Room is a specific classroom (NOT common dining/refectory/break spaces)
    // 3. Belonging to ANOTHER section (t.section_id !== entry.section_id)
    if (
      entry.room_number &&
      !isNonInstructional(entry.lecture_type, entry.period_number) &&
      !isCommonArea(entry.room_number)
    ) {
      const roomConflict = activeEntries.find(
        t => t.section_id !== entry.section_id &&
             !isNonInstructional(t.lecture_type, t.period_number) &&
             t.room_number &&
             !isCommonArea(t.room_number) &&
             t.room_number.toLowerCase().trim() === entry.room_number.toLowerCase().trim() &&
             t.day_of_week === entry.day_of_week &&
             hasTimeOverlap(entry, t)
      );

      if (roomConflict) {
        return {
          type: 'room',
          severity: 'blocking',
          message: `Room collision: Room ${entry.room_number} is already occupied by ${formatSectionLabel(roomConflict.section_id)} during Period ${roomConflict.period_number} on ${entry.day_of_week} (${roomConflict.start_time || ''}–${roomConflict.end_time || ''}).`,
          conflictingEntry: roomConflict
        };
      }
    }

    return null;
  };

  // 7. Authoritative Master Timetable Query (Single Source of Truth for HOD, Faculty, Student, Attendance)
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

  const getFacultyTeachingScope = useCallback((facultyId: string, isSuperAdminOrHOD?: boolean): FacultyTeachingScope => {
    return resolveFacultyTeachingScope(facultyId, {
      timetable,
      facultySubjectAssignments: assignments,
      sections,
      subjects,
      semesters,
      years,
      faculty,
      isSuperAdminOrHOD,
    });
  }, [timetable, assignments, sections, subjects, semesters, years, faculty]);

  const getFacultyTeachingAssignments = useCallback((facultyId: string): FacultyResolvedAssignment[] => {
    if (!facultyId) return [];
    const scope = getFacultyTeachingScope(facultyId);
    return scope.allAssignments || [];
  }, [getFacultyTeachingScope]);

  const getStudentAcademicContext = useCallback((studentId: string): StudentAcademicContext => {
    let stud = students.find(s => s.id === studentId || s.roll_number === studentId);
    if (!stud) {
      const sessionUser = erpStorage.getCurrentSessionUser();
      if (sessionUser?.student?.id === studentId || sessionUser?.student?.roll_number === studentId || sessionUser?.id === studentId) {
        stud = sessionUser.student;
      }
    }

    const sec = stud?.section_id ? (sections.find(s => s.id === stud.section_id) || stud?.section || null) : null;
    const sem = semesters.find(s => s.id === (stud?.semester_id || sec?.semester_id)) || null;

    let yr = years.find(y => y.id === (stud?.academic_year_id || sem?.academic_year_id)) || null;
    if (!yr && sem?.semester_number) {
      const deducedYearNum = Math.ceil(sem.semester_number / 2);
      yr = years.find(y => y.year_number === deducedYearNum) || null;
    }

    const prog = programs.find(p => p.id === stud?.program_id) || programs[0] || null;
    const dept = departments.find(d => d.id === stud?.department_id) || (prog ? departments.find(d => d.id === prog.department_id) : null) || departments[0] || null;
    const sess = sessions.find(s => s.id === stud?.academic_session_id) || sessions.find(s => s.is_current) || sessions[0] || null;

    let room = sec?.room_number ? cleanRoomNumber(sec.room_number) : '';
    if (!room || room === 'Room TBD') {
      const entryWithRoom = timetable.find(t => t.section_id === sec?.id && t.room_number);
      if (entryWithRoom?.room_number) {
        room = cleanRoomNumber(entryWithRoom.room_number);
      }
    }
    const cleanSec = cleanSectionName(sec?.name);

    let formattedSectionLabel = 'Section Assigned';
    if (cleanSec) {
      if (room && room !== 'Room TBD') {
        formattedSectionLabel = `Section ${cleanSec} (${room})`;
      } else {
        formattedSectionLabel = `Section ${cleanSec}`;
      }
    }

    let classCoordFaculty: Faculty | null = null;
    if (sec?.id) {
      const activeCoordAssign = (classCoordinatorAssignments || []).find(
        cca => cca.active && cca.section_id === sec.id
      );
      const coordId = activeCoordAssign?.faculty_id || sec.class_coordinator_id;
      if (coordId) {
        classCoordFaculty = faculty.find(f => f.id === coordId) || (activeCoordAssign?.faculty as any) || null;
      }
    }

    const mentorFac = faculty.find(f => f.id === stud?.mentor_faculty_id) || null;

    return {
      studentId: stud?.id || studentId,
      student: stud || null,
      academicYear: yr,
      academicYearId: yr?.id || '',
      academicYearName: yr?.name || 'Academic Year',
      academicYearNumber: yr?.year_number || 0,
      semester: sem,
      semesterId: sem?.id || '',
      semesterName: sem?.name || 'Semester',
      semesterNumber: sem?.semester_number || 0,
      program: prog,
      programId: prog?.id || '',
      programName: prog?.name || 'B.Tech',
      department: dept,
      departmentId: dept?.id || '',
      departmentName: dept?.name || 'Computer Science & Engineering',
      departmentCode: dept?.code || 'CSE',
      section: sec,
      sectionId: sec?.id || '',
      sectionName: sec?.name || '',
      cleanSectionName: cleanSec,
      sectionCode: `SEC-${cleanSec}`,
      roomNumber: room || 'Room TBD',
      formattedSectionLabel,
      academicSession: sess,
      academicSessionId: sess?.id || '',
      academicSessionName: sess?.name || 'Academic Session',
      mentorFaculty: mentorFac,
      classCoordinator: classCoordFaculty,
    };
  }, [students, sections, semesters, years, programs, departments, sessions, timetable, faculty, classCoordinatorAssignments]);

  const getHODDepartmentContext = useCallback((hodId: string): HODDepartmentContext => {
    const userFac = faculty.find(f => f.id === hodId || f.auth_user_id === hodId);
    const dept = departments.find(
      d => d.hod_faculty_id === hodId ||
           d.hod_faculty_id === userFac?.id ||
           d.id === userFac?.department_id
    ) || departments[0] || null;

    const deptFaculty = faculty.filter(f => f.department_id === dept?.id && f.active !== false);

    const assignedFacultyIds = new Set([
      ...assignments.filter(a => a.active !== false).map(a => a.faculty_id),
      ...timetable.filter(t => t.active !== false).map(t => t.faculty_id)
    ]);
    const assignedDeptFaculty = deptFaculty.filter(f => assignedFacultyIds.has(f.id));
    const workloadPercentage = deptFaculty.length > 0 
      ? Math.round((assignedDeptFaculty.length / deptFaculty.length) * 100) 
      : 0;

    const deptStudents = students.filter(s => s.active !== false && (!dept?.id || s.department_id === dept.id));
    const deptSections = sections.filter(sec => sec.active !== false);
    const deptSubjects = subjects.filter(sub => sub.active !== false && (!dept?.id || sub.department_id === dept.id));

    return {
      department: dept,
      departmentId: dept?.id || '',
      departmentName: dept?.name || 'Computer Science & Engineering',
      departmentCode: dept?.code || 'CSE',
      hodFaculty: userFac || (dept?.hod_faculty_id ? faculty.find(f => f.id === dept.hod_faculty_id) || null : null),
      departmentFaculty: deptFaculty,
      activeFacultyCount: deptFaculty.length,
      assignedFacultyCount: assignedDeptFaculty.length,
      workloadPercentage,
      departmentStudents: deptStudents,
      studentCount: deptStudents.length,
      sections: deptSections,
      subjects: deptSubjects,
    };
  }, [faculty, departments, assignments, timetable, students, sections, subjects]);

  const getAssignedSectionsForYearContext = useCallback((facultyAssignments: FacultyResolvedAssignment[], yearId?: string): Section[] => {
    return getAssignedSectionsForYear(facultyAssignments, sections, yearId);
  }, [sections]);

  const getAssignedSubjectsForSectionContext = useCallback((facultyAssignments: FacultyResolvedAssignment[], sectionId?: string, yearId?: string): Subject[] => {
    return getAssignedSubjectsForSection(facultyAssignments, subjects, sectionId, yearId);
  }, [subjects]);

  // 8. Get Today's Live Attendance Lectures for Student (Consumes Same Authoritative Timetable)
  const getTodayLecturesForStudent = useCallback((studentId: string, customDateStr?: string): TodayAttendanceLecture[] => {
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
  }, [students, getStudentTimetable, subjects, faculty, sections, attendanceSessions, attendanceRecords, corrections]);

  // 9. Calculate Student Overall Attendance strictly based on Supabase database (Optimized O(1) Map Lookups)
  const getStudentAttendance = useCallback((studentId: string): StudentOverallAttendance & {
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

    const collegeToday = getCollegeToday();

    // Fast O(1) session lookup map
    const sessionMap = new Map<string, AttendanceSession>();
    for (const s of attendanceSessions) {
      sessionMap.set(s.id, s);
    }

    // Pre-group student records by subject_id in a single pass O(N)
    const recordsBySubject = new Map<string, { attended: number; absent: number }>();
    for (const r of studentRecords) {
      const sess = sessionMap.get(r.attendance_session_id);
      if (!sess) continue;
      if (sess.session_date > collegeToday) continue;
      if (studSectionId && sess.section_id !== studSectionId) continue;

      let stat = recordsBySubject.get(sess.subject_id);
      if (!stat) {
        stat = { attended: 0, absent: 0 };
        recordsBySubject.set(sess.subject_id, stat);
      }
      if (r.status === 'Present') stat.attended++;
      else if (r.status === 'Absent') stat.absent++;
    }

    // Fast faculty lookup map
    const facultyMap = new Map<string, any>();
    for (const f of faculty) {
      facultyMap.set(f.id, f);
    }

    const subjectStats: SubjectAttendanceStat[] = targetSubjects.map(sub => {
      // Find the specific assignment for THIS student's section
      const assignment = studSectionId ? assignments.find(
        a => a.subject_id === sub.id && a.section_id === studSectionId && a.active
      ) : undefined;

      let assignedFac = assignment?.faculty_id ? facultyMap.get(assignment.faculty_id) : undefined;
      if (!assignedFac && studSectionId) {
        const tMatch = timetable.find(t => t.subject_id === sub.id && t.section_id === studSectionId && t.faculty_id);
        if (tMatch?.faculty_id) {
          assignedFac = facultyMap.get(tMatch.faculty_id);
        }
      }

      const stat = recordsBySubject.get(sub.id) || { attended: 0, absent: 0 };
      const attended = stat.attended;
      const absent = stat.absent;
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
    let pendingClaimsCount = 0;
    for (const c of corrections) {
      if (c.student_id === studentId && c.status === 'pending') {
        pendingClaimsCount++;
      }
    }

    // Not recorded count for today
    const todayLectures = getTodayLecturesForStudent(studentId);
    let notRecordedCount = 0;
    for (const l of todayLectures) {
      if (l.status === 'Not Recorded') notRecordedCount++;
    }

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
  }, [students, sections, attendanceRecords, assignments, timetable, subjects, faculty, attendanceSessions, corrections, getTodayLecturesForStudent]);

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
    const myAssignments = assignments.filter(a => a.faculty_id === facultyId && a.active);

    return corrections.filter(c => {
      // If already reviewed by this faculty
      if (c.reviewed_by === facultyId) return true;

      const rec = (c as any).record || attendanceRecords.find(r => r.id === c.attendance_record_id);
      const sess = rec?.session || (c as any).session || attendanceSessions.find(s => s.id === rec?.attendance_session_id);

      if (!sess) return false;

      // Match 1: Faculty conducted this session
      if (sess.faculty_id === facultyId) return true;

      // Match 2: Faculty is assigned to this subject & section
      const isAssigned = myAssignments.some(
        a => a.subject_id === sess.subject_id && a.section_id === sess.section_id
      );
      if (isAssigned) return true;

      return false;
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
    setQuizzes(prev => {
      const exists = prev.some(q => 
        q.id === res.id || (
          q.subject_id === res.subject_id &&
          q.section_id === res.section_id &&
          (q.title || '').trim().toLowerCase() === (res.title || '').trim().toLowerCase()
        )
      );
      return exists ? prev.map(q => q.id === res.id ? res : q) : deduplicateQuizzes([res, ...prev]);
    });
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
    isPublished?: boolean;
  }) => {
    const res = await supabaseService.saveQuizMarks(params);
    if (res && res.length > 0) {
      setQuizResults(prev => {
        const updatedStudentIds = new Set(params.studentMarks.map(sm => sm.studentId));
        const filtered = prev.filter(
          qr => !(qr.quiz_id === params.quizId && updatedStudentIds.has(qr.student_id))
        );
        return [...(res as QuizResult[]), ...filtered];
      });
    }
    if (params.isPublished !== undefined) {
      const nextStatus = params.isPublished ? 'published' : 'draft';
      setQuizzes(prev => prev.map(q => q.id === params.quizId ? { ...q, status: nextStatus } : q));
    }
    await refreshAssessments();
    return res;
  };

  const createSessionalAssessment = async (data: Omit<SessionalAssessment, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.createSessionalAssessment(data);
    setSessionalAssessments(prev => {
      const exists = prev.some(sa => 
        sa.id === res.id || (
          sa.subject_id === res.subject_id &&
          sa.section_id === res.section_id &&
          (sa.title || '').trim().toLowerCase() === (data.title || '').trim().toLowerCase()
        )
      );
      return exists ? prev.map(sa => sa.id === res.id ? res : sa) : deduplicateSessionals([res, ...prev]);
    });
    await refreshAssessments();
    return res;
  };

  const updateSessionalAssessment = async (id: string, updates: Partial<SessionalAssessment>) => {
    const res = await supabaseService.updateSessionalAssessment(id, updates);
    if (updates.status) {
      const markStatus: 'draft' | 'published' = (updates.status === 'published' || updates.status === 'completed') ? 'published' : 'draft';
      setSessionalMarks(prev =>
        prev.map(m =>
          m.sessional_assessment_id === id
            ? { ...m, status: markStatus }
            : m
        )
      );
    }
    await refreshAssessments();
    return res;
  };

  const deleteSessionalAssessment = async (id: string) => {
    const res = await supabaseService.deleteSessionalAssessment(id);
    await refreshAssessments();
    return res;
  };

  const ensureDefaultQuizzes = useCallback(async (params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
  }) => {
    const res = await supabaseService.ensureDefaultQuizzes(params);
    setQuizzes(prev => deduplicateQuizzes([...prev, ...res]));
    return res;
  }, []);

  const ensureDefaultAssessments = useCallback(async (params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
    semesterId?: string;
  }) => {
    const { sessionals, quizzes: ensuredQuizzes } = await supabaseService.ensureDefaultAssessments(params);
    setSessionalAssessments(prev => deduplicateSessionals([...prev, ...sessionals]));
    setQuizzes(prev => deduplicateQuizzes([...prev, ...ensuredQuizzes]));
    return { sessionals, quizzes: ensuredQuizzes };
  }, []);

  const ensureDefaultSessionalAssessments = useCallback(async (params: {
    subjectId: string;
    sectionId: string;
    facultyId: string;
    semesterId?: string;
  }) => {
    const res = await supabaseService.ensureDefaultSessionalAssessments(params);
    setSessionalAssessments(prev => deduplicateSessionals([...prev, ...res]));
    return res;
  }, []);

  const saveSessionalMarks = async (params: {
    sessionalAssessmentId?: string;
    facultyId: string;
    subjectId: string;
    sectionId: string;
    sessionalType?: string;
    maxMarks: number;
    studentMarks: Array<{
      studentId: string;
      marksObtained: number | null;
      remarks?: string;
      oldMarks?: number | null;
      attendanceStatus?: AssessmentAttendanceStatus;
    }>;
    isPublished?: boolean;
  }) => {
    const res = await supabaseService.saveSessionalMarks(params);
    lastMarksSaveTimeRef.current = Date.now();

    if (res && res.length > 0) {
      setSessionalMarks(prev => {
        const updatedStudentIds = new Set(params.studentMarks.map(sm => sm.studentId));
        const filtered = prev.filter(
          m => !(m.sessional_assessment_id === params.sessionalAssessmentId && updatedStudentIds.has(m.student_id))
        );
        return [...res, ...filtered];
      });
    }
    if (params.sessionalAssessmentId && params.isPublished !== undefined) {
      const nextStatus: 'draft' | 'published' = params.isPublished ? 'published' : 'draft';
      setSessionalAssessments(prev =>
        prev.map(sa =>
          sa.id === params.sessionalAssessmentId
            ? { ...sa, status: nextStatus }
            : sa
        )
      );
      setSessionalMarks(prev =>
        prev.map(m =>
          m.sessional_assessment_id === params.sessionalAssessmentId
            ? { ...m, status: nextStatus }
            : m
        )
      );
    }
    return res;
  };

  const getStudentAcademicScorecard = useCallback((studentId: string): StudentSubjectAcademicReport[] => {
    const student = students.find(s => s.id === studentId);
    if (!student) return [];

    const studentAtt = getStudentAttendance(studentId);
    const result: StudentSubjectAcademicReport[] = [];

    for (const stat of studentAtt.subjectStats) {
      // Dynamic Sessional Assessments for student's section & subject that are strictly published or completed
      const subAssessments = sessionalAssessments.filter(
        sa => sa.subject_id === stat.subjectId && 
              (!sa.section_id || sa.section_id === student.section_id || sessionalMarks.some(m => m.sessional_assessment_id === sa.id && m.student_id === studentId)) &&
              (sa.status === 'published' || sa.status === 'completed') &&
              !sa.deleted_at
      );

      // Deduplicate assessments by title to prevent duplicate rows
      const seenTitles = new Set<string>();
      const uniqueAssessments = subAssessments.filter(sa => {
        const key = (sa.title || '').toLowerCase().trim();
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });

      const dynamicSessionals = uniqueAssessments.map(sa => {
        const sm = sessionalMarks.find(m => m.sessional_assessment_id === sa.id && m.student_id === studentId);
        // Only include marks if explicitly published (or when assessment is published and status not explicitly draft)
        const isMarkPublished = sm?.status === 'published' || (sm?.status === undefined && (sa.status === 'published' || sa.status === 'completed'));
        const attStatus: AssessmentAttendanceStatus = sm?.attendance_status || (sm?.marks_obtained !== null && sm?.marks_obtained !== undefined ? 'PRESENT' : 'NOT_ENTERED');
        const hasScore = sm !== undefined && isMarkPublished && sm.status !== 'draft' && sm.marks_obtained !== undefined && sm.marks_obtained !== null && attStatus === 'PRESENT';
        return {
          assessmentId: sa.id,
          title: sa.title,
          maxMarks: sa.max_marks,
          obtainedMarks: hasScore ? Number(sm.marks_obtained) : undefined,
          attendanceStatus: isMarkPublished && sm ? attStatus : undefined,
          examDate: sa.exam_date || '',
        };
      });

      // Legacy sessional entries (ONLY for true legacy rows where sessional_assessment_id IS NULL and status is explicitly published)
      const subSessional = sessionalMarks.filter(
        sm => sm.student_id === studentId && sm.subject_id === stat.subjectId && !sm.sessional_assessment_id && sm.status === 'published'
      );
      for (const sm of subSessional) {
        const alreadyInDynamic = dynamicSessionals.some(
          ds => ds.title.toLowerCase() === sm.sessional_type?.toLowerCase()
        );
        const legacyAttStatus: AssessmentAttendanceStatus = sm.attendance_status || (sm.marks_obtained !== null && sm.marks_obtained !== undefined ? 'PRESENT' : 'NOT_ENTERED');
        if (!alreadyInDynamic && ((sm.marks_obtained !== undefined && sm.marks_obtained !== null) || legacyAttStatus === 'ABSENT' || legacyAttStatus === 'EXEMPTED')) {
          dynamicSessionals.push({
            assessmentId: sm.id,
            title: sm.sessional_type || 'Sessional Assessment',
            maxMarks: sm.max_marks || 30,
            obtainedMarks: sm.marks_obtained !== null && sm.marks_obtained !== undefined && legacyAttStatus === 'PRESENT' ? Number(sm.marks_obtained) : undefined,
            attendanceStatus: legacyAttStatus,
            examDate: sm.created_at || '',
          });
        }
      }

      // CRITICAL MARKS RULE: Visible sessionals MUST have actual published/entered marks OR published evaluation status (ABSENT / EXEMPTED)
      // Genuine 0 marks (marks_obtained === 0) are valid published marks and are strictly preserved!
      const visibleSessionals = dynamicSessionals.filter(s => 
        (s.obtainedMarks !== undefined && s.obtainedMarks !== null) ||
        (s.attendanceStatus === 'ABSENT' || s.attendanceStatus === 'EXEMPTED')
      );

      const s1Dyn = visibleSessionals.find(s => s.title.toLowerCase() === 'sessional 1' || s.title.toLowerCase().startsWith('sessional 1'));
      const s2Dyn = visibleSessionals.find(s => s.title.toLowerCase() === 'sessional 2' || s.title.toLowerCase().startsWith('sessional 2'));
      const putDyn = visibleSessionals.find(s => 
        s.title.toLowerCase() === 'pre-university test' || 
        s.title.toLowerCase() === 'put' || 
        s.title.toLowerCase().includes('pre-university') ||
        s.title.toLowerCase().includes('pre university')
      );

      const s1 = subSessional.find(s => s.sessional_type === 'Sessional 1');
      const s2 = subSessional.find(s => s.sessional_type === 'Sessional 2');
      const put = subSessional.find(s => s.sessional_type === 'Pre-University Test');
      const fin = subSessional.find(s => s.sessional_type === 'Final Sessional');

      const sessional1Val = (s1Dyn && (s1Dyn.obtainedMarks !== undefined || s1Dyn.attendanceStatus === 'ABSENT' || s1Dyn.attendanceStatus === 'EXEMPTED'))
        ? { obtained: s1Dyn.obtainedMarks, max: s1Dyn.maxMarks, attendanceStatus: s1Dyn.attendanceStatus }
        : (s1 && ((s1.marks_obtained !== undefined && s1.marks_obtained !== null) || s1.attendance_status === 'ABSENT' || s1.attendance_status === 'EXEMPTED')
          ? { obtained: s1.marks_obtained !== null && s1.marks_obtained !== undefined ? Number(s1.marks_obtained) : undefined, max: s1.max_marks || 30, attendanceStatus: s1.attendance_status }
          : undefined);

      const sessional2Val = (s2Dyn && (s2Dyn.obtainedMarks !== undefined || s2Dyn.attendanceStatus === 'ABSENT' || s2Dyn.attendanceStatus === 'EXEMPTED'))
        ? { obtained: s2Dyn.obtainedMarks, max: s2Dyn.maxMarks, attendanceStatus: s2Dyn.attendanceStatus }
        : (s2 && ((s2.marks_obtained !== undefined && s2.marks_obtained !== null) || s2.attendance_status === 'ABSENT' || s2.attendance_status === 'EXEMPTED')
          ? { obtained: s2.marks_obtained !== null && s2.marks_obtained !== undefined ? Number(s2.marks_obtained) : undefined, max: s2.max_marks || 30, attendanceStatus: s2.attendance_status }
          : undefined);

      const putVal = (putDyn && (putDyn.obtainedMarks !== undefined || putDyn.attendanceStatus === 'ABSENT' || putDyn.attendanceStatus === 'EXEMPTED'))
        ? { obtained: putDyn.obtainedMarks, max: putDyn.maxMarks, attendanceStatus: putDyn.attendanceStatus }
        : (put && ((put.marks_obtained !== undefined && put.marks_obtained !== null) || put.attendance_status === 'ABSENT' || put.attendance_status === 'EXEMPTED')
          ? { obtained: put.marks_obtained !== null && put.marks_obtained !== undefined ? Number(put.marks_obtained) : undefined, max: put.max_marks || 100, attendanceStatus: put.attendance_status }
          : undefined);

      const otherSessionals = visibleSessionals.filter(s => 
        s !== s1Dyn && s !== s2Dyn && s !== putDyn
      );

      // Quizzes: only include quizzes where quiz is published/completed AND student has entered marks
      const subQuizzes = quizzes.filter(
        q => q.subject_id === stat.subjectId && 
             q.section_id === student.section_id && 
             q.active &&
             !q.deleted_at &&
             (q.status === 'published' || q.status === 'completed')
      );
      const quizMarksList: Array<{ quizId: string; title: string; maxMarks: number; obtainedMarks?: number; quizDate: string }> = [];
      for (const q of subQuizzes) {
        const qr = quizResults.find(r => r.quiz_id === q.id && r.student_id === studentId);
        if (qr && qr.marks_obtained !== undefined && qr.marks_obtained !== null) {
          quizMarksList.push({
            quizId: q.id,
            title: q.title,
            maxMarks: q.max_marks,
            obtainedMarks: Number(qr.marks_obtained),
            quizDate: q.quiz_date || '',
          });
        }
      }

      // Assignments: only include assignments where student submission is actively graded with marks by faculty
      const subAssignments = courseAssignments.filter(
        a => a.subject_id === stat.subjectId && 
             a.section_id === student.section_id && 
             a.active &&
             !a.deleted_at
      );
      const assignmentMarksList: Array<{ assignmentId: string; title: string; maxMarks: number; obtainedMarks?: number; status: string; dueDate: string }> = [];
      for (const a of subAssignments) {
        const sub = assignmentSubmissions.find(s => s.assignment_id === a.id && s.student_id === studentId);
        if (sub && sub.status === 'graded' && sub.marks_obtained !== undefined && sub.marks_obtained !== null) {
          assignmentMarksList.push({
            assignmentId: a.id,
            title: a.title,
            maxMarks: a.max_marks,
            obtainedMarks: Number(sub.marks_obtained),
            status: sub.status,
            dueDate: a.due_date || '',
          });
        }
      }

      // Check whether faculty has ACTUALLY published marks for this subject
      const hasPublishedSessional = visibleSessionals.length > 0;
      const hasPublishedQuiz = quizMarksList.length > 0;
      const hasPublishedAssignment = assignmentMarksList.length > 0;
      const hasPublishedMarks = hasPublishedSessional || hasPublishedQuiz || hasPublishedAssignment;

      // CRITICAL RULE: If faculty has NOT entered/published marks for this subject:
      // That subject MUST NOT appear in the Student Dashboard's Marks/Sessional section.
      // Under NO circumstances should it appear with "Marks not published yet", "0 / 20" (unless genuine 0 was published), or empty cards.
      if (!hasPublishedMarks) {
        continue;
      }

      let totalScore = 0;
      let maxScore = 0;

      // Add scores ONLY from assessments that have actual entered marks (supporting genuine 0 marks) or ABSENT evaluation
      for (const ds of visibleSessionals) {
        if (ds.obtainedMarks !== undefined && ds.obtainedMarks !== null) {
          totalScore += ds.obtainedMarks;
          maxScore += ds.maxMarks;
        } else if (ds.attendanceStatus === 'ABSENT') {
          maxScore += ds.maxMarks;
        }
      }

      for (const q of quizMarksList) {
        if (q.obtainedMarks !== undefined && q.obtainedMarks !== null) {
          totalScore += q.obtainedMarks;
          maxScore += q.maxMarks;
        }
      }

      for (const a of assignmentMarksList) {
        if (a.obtainedMarks !== undefined && a.obtainedMarks !== null) {
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
          final: (fin && fin.marks_obtained !== undefined && fin.marks_obtained !== null) ? { obtained: Number(fin.marks_obtained), max: fin.max_marks || 30 } : undefined,
          otherSessionals,
          sessionals: visibleSessionals,
        },
        quizMarks: quizMarksList,
        assignmentMarks: assignmentMarksList,
        totalInternalScore: totalScore,
        maxInternalScore: maxScore,
      });
    }

    return result;
  }, [students, getStudentAttendance, sessionalAssessments, sessionalMarks, quizzes, quizResults, courseAssignments, assignmentSubmissions]);

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
      if (options.email) {
        const clean = options.email.trim().toLowerCase();
        setFaculty(prev => prev.map(f => 
          (f.auth_user_id === targetUserId || f.id === targetUserId) 
            ? { ...f, email: clean } 
            : f
        ));
        setStudents(prev => prev.map(s => 
          (s.auth_user_id === targetUserId || s.id === targetUserId) 
            ? { ...s, email: clean } 
            : s
        ));
      }
      await Promise.all([
        refreshAdminAccounts(),
        refreshFaculty(),
        refreshStudents(),
      ]);
    }
    return res;
  }, [refreshAdminAccounts, refreshFaculty, refreshStudents]);

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

  const sendMessage = useCallback(async (params: {
    conversationId: string;
    message: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
    replyToMessageId?: string | null;
  }) => {
    const res = await supabaseService.sendMessage(params);
    if (!res.error && res.data) {
      setConversations(prev => {
        const found = prev.find(c => c.id === params.conversationId);
        if (!found) return prev;
        const updated: Conversation = {
          ...found,
          last_message_preview: params.message,
          last_message_at: res.data?.created_at || new Date().toISOString(),
          unread_count: 0,
          marked_unread: false,
        };
        const rest = prev.filter(c => c.id !== params.conversationId);
        return [updated, ...rest];
      });
    }
    return res;
  }, []);

  const editDirectMessage = useCallback(async (messageId: string, newContent: string) => {
    const res = await supabaseService.editMessage(messageId, newContent);
    if (!res.error && res.data) {
      setConversations(prev => {
        const convId = res.data?.conversation_id;
        if (!convId) return prev;
        return prev.map(c => c.id === convId ? { ...c, last_message_preview: newContent } : c);
      });
    }
    return res;
  }, []);

  const unsendDirectMessage = useCallback(async (messageId: string) => {
    const res = await supabaseService.unsendMessage(messageId);
    if (!res.error && res.data) {
      setConversations(prev => {
        const convId = res.data?.conversation_id;
        if (!convId) return prev;
        return prev.map(c => c.id === convId ? { ...c, last_message_preview: 'Message unsent' } : c);
      });
    }
    return res;
  }, []);

  const deleteMessageForMe = useCallback(async (messageId: string) => {
    const res = await supabaseService.deleteMessageForMe(messageId);
    return res;
  }, []);

  const clearConversationForMe = useCallback(async (conversationId: string) => {
    const res = await supabaseService.clearConversationForMe(conversationId);
    if (res.success) {
      await refreshConversations();
      refreshNotifications();
    }
    return res;
  }, [refreshConversations, refreshNotifications]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    const res = await supabaseService.deleteConversation(conversationId);
    if (!res.success) {
      await refreshConversations();
    }
    return res;
  }, [refreshConversations]);

  const markConversationUnread = useCallback(async (conversationId: string) => {
    const res = await supabaseService.markConversationUnread(conversationId);
    if (res.success) {
      setConversations(prev =>
        prev.map(c => (c.id === conversationId ? { ...c, marked_unread: true, unread_count: Math.max(c.unread_count || 0, 1) } : c))
      );
    }
    return res;
  }, []);

  const getOrCreateConversation = useCallback(async (params: {
    facultyId?: string;
    studentId?: string;
    subjectId?: string | null;
    category?: ConversationCategory;
    topic?: string;
  }) => {
    const res = await supabaseService.getOrCreateConversation(params);
    if (res.data) {
      await refreshConversations();
    }
    return res;
  }, [refreshConversations]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    let hadUnread = false;
    setConversations(prev => {
      const target = prev.find(c => c.id === conversationId);
      if (!target || !target.unread_count) return prev;
      hadUnread = true;
      return prev.map(c => (c.id === conversationId ? { ...c, unread_count: 0 } : c));
    });

    if (hadUnread) {
      try {
        await supabaseService.markConversationRead(conversationId);
      } catch (err) {
        console.warn('Notice: Failed to mark conversation read:', err);
      }
    }
  }, []);

  const updateConversationStatus = useCallback(async (
    conversationId: string,
    status: ConversationStatus
  ) => {
    const res = await supabaseService.updateConversationStatus(conversationId, status);
    if (res.data) {
      setConversations(prev =>
        prev.map(c => (c.id === conversationId ? { ...c, status } : c))
      );
    }
    return res;
  }, []);

  const fetchEligibleFacultyForStudent = useCallback(async (studentId: string) => {
    return await supabaseService.fetchEligibleFacultyForStudent(studentId);
  }, []);

  const fetchEligibleStudentsForFaculty = useCallback(async (facultyId: string) => {
    return await supabaseService.fetchEligibleStudentsForFaculty(facultyId);
  }, []);

  const sendGroupMessage = useCallback(async (params: {
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
    replyToMessageId?: string | null;
    clientMessageId?: string | null;
  }) => {
    const res = await supabaseService.sendGroupMessage(params);
    if (res.success && res.data) {
      setMessageGroups(prev => {
        const found = prev.find(g => g.id === res.data?.group_id);
        if (!found) return prev;
        const updated: MessageGroup = {
          ...found,
          last_message_preview: params.message,
          last_message_at: res.data?.created_at || new Date().toISOString(),
          unread_count: 0,
        };
        const rest = prev.filter(g => g.id !== res.data?.group_id);
        return [updated, ...rest];
      });
    }
    return res;
  }, []);

  const editGroupMessage = useCallback(async (messageId: string, newContent: string, newTitle?: string) => {
    const res = await supabaseService.editGroupMessage(messageId, newContent, newTitle);
    if (res.success && res.data) {
      const updated = res.data;
      if (updated.group_id) {
        const cached = groupMessagesCacheRef.current.get(updated.group_id);
        if (cached) {
          groupMessagesCacheRef.current.set(
            updated.group_id,
            cached.map(m => m.id === messageId ? { ...m, ...updated } : m)
          );
        }
      }
    }
    return res;
  }, []);

  const deleteGroupMessage = useCallback(async (messageId: string) => {
    const res = await supabaseService.deleteGroupMessage(messageId);
    if (res.success && res.data) {
      const updated = res.data;
      if (updated.group_id) {
        const cached = groupMessagesCacheRef.current.get(updated.group_id);
        if (cached) {
          groupMessagesCacheRef.current.set(
            updated.group_id,
            cached.map(m => m.id === messageId ? { ...m, ...updated, is_deleted: true, message: 'Message deleted' } : m)
          );
        }
      }
    }
    return res;
  }, []);

  const clearGroupChatForMe = useCallback(async (groupId: string) => {
    const res = await supabaseService.clearGroupChatForMe(groupId);
    if (res.success) {
      groupMessagesCacheRef.current.set(groupId, []);
    }
    return res;
  }, []);

  const deleteMessageGroup = useCallback(async (groupId: string) => {
    setMessageGroups(prev => prev.filter(g => g.id !== groupId));
    groupMessagesCacheRef.current.delete(groupId);
    const res = await supabaseService.deleteMessageGroup(groupId);
    if (!res.success) {
      await refreshMessageGroups();
    }
    return res;
  }, [refreshMessageGroups]);

  const deleteGroupMessageForMe = useCallback(async (messageId: string) => {
    return await supabaseService.deleteGroupMessageForMe(messageId);
  }, []);

  const markGroupRead = useCallback(async (groupId: string) => {
    if (!groupId) return;
    let hadUnread = false;
    setMessageGroups(prev => {
      const target = prev.find(g => g.id === groupId);
      if (!target || !target.unread_count) return prev;
      hadUnread = true;
      return prev.map(g => (g.id === groupId ? { ...g, unread_count: 0 } : g));
    });

    if (hadUnread) {
      try {
        await supabaseService.markGroupAsRead(groupId);
      } catch (err) {
        console.warn('Notice: Failed to mark group read:', err);
      }
    }
  }, []);

  const fetchGroupMembers = useCallback(async (groupId: string) => {
    return await supabaseService.fetchGroupMembers(groupId);
  }, []);

  const fetchStudentProfile = useCallback(async (studentId: string) => {
    return await supabaseService.fetchStudentProfile(studentId);
  }, []);

  const archiveAccount = useCallback(async (params: {
    targetId: string;
    entityType: 'student' | 'faculty';
    exitStatus: AccountStatus;
    exitDate?: string;
    reason?: string;
  }) => {
    const actor = user || erpStorage.getCurrentSessionUser();
    const res = await supabaseService.archiveAccount({
      ...params,
      actorId: actor?.id,
    });
    if (res.success) {
      await Promise.all([
        refreshAdminAccounts(),
        refreshStudents(),
        refreshFaculty(),
        loadDataFromSupabase(true),
      ]);
    }
    return res;
  }, [user, refreshAdminAccounts, refreshStudents, refreshFaculty, loadDataFromSupabase]);

  const restoreAccount = useCallback(async (params: {
    targetId: string;
    entityType: 'student' | 'faculty';
    reason?: string;
  }) => {
    const actor = user || erpStorage.getCurrentSessionUser();
    const res = await supabaseService.restoreAccount({
      ...params,
      actorId: actor?.id,
    });
    if (res.success) {
      await Promise.all([
        refreshAdminAccounts(),
        refreshStudents(),
        refreshFaculty(),
        loadDataFromSupabase(true),
      ]);
    }
    return res;
  }, [user, refreshAdminAccounts, refreshStudents, refreshFaculty, loadDataFromSupabase]);

  const fetchArchivedStats = useCallback(async () => {
    return await supabaseService.fetchArchivedStats();
  }, []);

  const fetchArchivedRecords = useCallback(async () => {
    return await supabaseService.fetchArchivedRecords();
  }, []);

  const fetchStudentHistoricalRecord = useCallback(async (studentId: string) => {
    return await supabaseService.fetchStudentHistoricalRecord(studentId);
  }, []);

  const fetchFacultyHistoricalRecord = useCallback(async (facultyId: string) => {
    return await supabaseService.fetchFacultyHistoricalRecord(facultyId);
  }, []);

  const resetToInitialSeed = useCallback(() => {
    erpStorage.init(true);
    refreshData();
  }, [refreshData]);

  const publishAssessment = useCallback(async (assessmentId: string, facultyId?: string) => {
    const res = await supabaseService.publishAssessment(assessmentId, facultyId);
    setSessionalAssessments(prev => prev.map(sa => sa.id === assessmentId ? { ...sa, status: 'published' } : sa));
    setSessionalMarks(prev => prev.map(m => m.sessional_assessment_id === assessmentId ? { ...m, status: 'published' } : m));
    await refreshAssessments();
    return res;
  }, [refreshAssessments]);

  const fetchAssessmentMarks = useCallback(async (assessmentId: string, kind: 'sessional' | 'quiz' | 'assignment' = 'sessional', forceFresh = false) => {
    const res = await supabaseService.fetchAssessmentMarks(assessmentId, kind, forceFresh);
    if (kind === 'sessional' && res && res.length > 0) {
      setSessionalMarks(prev => {
        const incomingMap = new Map(res.map((r: any) => [r.id || `${r.sessional_assessment_id}_${r.student_id}`, r]));
        const filtered = prev.filter(m => !incomingMap.has(m.id) && !incomingMap.has(`${m.sessional_assessment_id}_${m.student_id}`));
        return [...(res as SessionalMark[]), ...filtered];
      });
    } else if (kind === 'quiz' && res && res.length > 0) {
      setQuizResults(prev => {
        const incomingIds = new Set(res.map((r: any) => r.id));
        const filtered = prev.filter(r => !incomingIds.has(r.id));
        return [...(res as QuizResult[]), ...filtered];
      });
    }
    return res;
  }, []);

  const publishNotice = useCallback(async (notice: any) => {
    const res = await supabaseService.publishNotice(notice);
    await refreshNotifications();
    return res;
  }, [refreshNotifications]);

  const deleteNotice = useCallback(async (id: string) => {
    const res = await supabaseService.deleteNotice(id);
    await refreshNotifications();
    return res;
  }, [refreshNotifications]);

  const archiveNotice = useCallback(async (id: string) => {
    const res = await supabaseService.archiveNotice(id);
    await refreshNotifications();
    return res;
  }, [refreshNotifications]);

  const contextValue = useMemo(() => ({
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
    classCoordinatorAssignments,
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
    notifications,
    unreadNotificationCount,
    conversations,
    unreadMessagesCount,
    activeConversationId,
    setActiveConversationId,
    refreshConversations,
    messageGroups,
    activeGroupId,
    setActiveGroupId,
    refreshMessageGroups,
    leaveApplications,
    refreshLeaveApplications,
    sendGroupMessage,
    editGroupMessage,
    deleteGroupMessage,
    clearGroupChatForMe,
    deleteMessageGroup,
    deleteGroupMessageForMe,
    markGroupRead,
    fetchGroupMembers,
    fetchStudentProfile,
    sendMessage,
    editDirectMessage,
    unsendDirectMessage,
    deleteMessageForMe,
    clearConversationForMe,
    deleteConversation,
    markConversationUnread,
    getOrCreateConversation,
    markConversationRead,
    updateConversationStatus,
    fetchEligibleFacultyForStudent,
    fetchEligibleStudentsForFaculty,
    getCachedConversationMessages,
    setCachedConversationMessages,
    getCachedGroupMessages,
    setCachedGroupMessages,
    activeToast,
    dismissToast,
    isOnline,
    isLoading,
    claimWindowDays,
    setClaimWindowDays,
    refreshData,
    refreshAdminAccounts,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshStudents,
    refreshTimetable,
    refreshAttendance,
    refreshCorrections,
    refreshFaculty,
    refreshSections,
    refreshSubjects,
    refreshAssignments,
    refreshAssessments,
    getFacultyCoordinatorAssignments,
    refreshCoordinatorAssignments,
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
    ensureDefaultSessionalAssessments,
    ensureDefaultQuizzes,
    ensureDefaultAssessments,
    saveSessionalMarks,
    publishAssessment,
    fetchAssessmentMarks,
    publishNotice,
    deleteNotice,
    archiveNotice,
    getStudentAcademicScorecard,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    checkDepartmentReferences,
    changeDepartmentHod,
    removeDepartmentHod,
    setCurrentAcademicTerm,
    updateSemesterDates,
    addProgram,
    updateProgram,
    deleteProgram,
    addSection,
    updateSection,
    deleteSection,
    archiveSection,
    restoreSection,
    checkSectionReferences,
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
    assignCoordinator,
    removeCoordinator,
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
    getAttendanceSummary,
    ensureSessionAttendanceLoaded,
    submitCorrectionRequest,
    reviewCorrectionRequest,
    canSubmitClaim,
    getStudentAttendance,
    getPublishedTimetable,
    getFacultyTimetable,
    getFacultyTeachingScope,
    getFacultyTeachingAssignments,
    getStudentAcademicContext,
    getHODDepartmentContext,
    getAssignedSectionsForYear: getAssignedSectionsForYearContext,
    getAssignedSubjectsForSection: getAssignedSubjectsForSectionContext,
    getStudentTimetable,
    getTodayLecturesForStudent,
    getDateLecturesForStudent,
    getFacultyCorrectionRequests,
    getTodaySchedule,
    resetToInitialSeed,
    archiveAccount,
    restoreAccount,
    fetchArchivedStats,
    fetchArchivedRecords,
    fetchStudentHistoricalRecord,
    fetchFacultyHistoricalRecord,
  }), [
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
    classCoordinatorAssignments,
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
    notifications,
    unreadNotificationCount,
    conversations,
    unreadMessagesCount,
    activeConversationId,
    messageGroups,
    activeGroupId,
    leaveApplications,
    activeToast,
    isOnline,
    isLoading,
    claimWindowDays,
    refreshData,
    refreshAdminAccounts,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshStudents,
    refreshTimetable,
    refreshAttendance,
    refreshCorrections,
    refreshFaculty,
    refreshSections,
    refreshSubjects,
    refreshAssignments,
    refreshAssessments,
    getFacultyCoordinatorAssignments,
    refreshCoordinatorAssignments,
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
    ensureDefaultSessionalAssessments,
    ensureDefaultQuizzes,
    ensureDefaultAssessments,
    saveSessionalMarks,
    publishAssessment,
    fetchAssessmentMarks,
    publishNotice,
    deleteNotice,
    archiveNotice,
    getStudentAcademicScorecard,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    checkDepartmentReferences,
    changeDepartmentHod,
    removeDepartmentHod,
    setCurrentAcademicTerm,
    updateSemesterDates,
    addProgram,
    updateProgram,
    deleteProgram,
    addSection,
    updateSection,
    deleteSection,
    archiveSection,
    restoreSection,
    checkSectionReferences,
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
    assignCoordinator,
    removeCoordinator,
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
    getAttendanceSummary,
    ensureSessionAttendanceLoaded,
    submitCorrectionRequest,
    reviewCorrectionRequest,
    canSubmitClaim,
    getStudentAttendance,
    getPublishedTimetable,
    getFacultyTimetable,
    getFacultyTeachingScope,
    getFacultyTeachingAssignments,
    getStudentAcademicContext,
    getHODDepartmentContext,
    getAssignedSectionsForYearContext,
    getAssignedSubjectsForSectionContext,
    getStudentTimetable,
    getTodayLecturesForStudent,
    getDateLecturesForStudent,
    getFacultyCorrectionRequests,
    getTodaySchedule,
    resetToInitialSeed,
    sendGroupMessage,
    editGroupMessage,
    deleteGroupMessage,
    clearGroupChatForMe,
    deleteMessageGroup,
    deleteGroupMessageForMe,
    markGroupRead,
    fetchGroupMembers,
    fetchStudentProfile,
    sendMessage,
    editDirectMessage,
    unsendDirectMessage,
    deleteMessageForMe,
    clearConversationForMe,
    deleteConversation,
    markConversationUnread,
    getOrCreateConversation,
    markConversationRead,
    updateConversationStatus,
    fetchEligibleFacultyForStudent,
    fetchEligibleStudentsForFaculty,
    getCachedConversationMessages,
    setCachedConversationMessages,
    getCachedGroupMessages,
    setCachedGroupMessages,
    dismissToast,
    refreshConversations,
    refreshMessageGroups,
    refreshLeaveApplications,
    archiveAccount,
    restoreAccount,
    fetchArchivedStats,
    fetchArchivedRecords,
    fetchStudentHistoricalRecord,
    fetchFacultyHistoricalRecord,
  ]);

  return (
    <AcademicContext.Provider value={contextValue}>
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

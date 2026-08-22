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
  DayOfWeek
} from '../types/database.types';
import {
  StudentOverallAttendance,
  TodayLectureItem,
  TimetableConflict
} from '../types/academic.types';
import { erpStorage } from '../lib/storage/erpStorage';

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
  refreshData: () => void;

  // Actions
  addDepartment: (dept: Omit<Department, 'id' | 'created_at'>) => Department;
  addProgram: (prog: Omit<Program, 'id' | 'created_at'>) => Program;
  addSection: (sec: Omit<Section, 'id'>) => Section;
  addFaculty: (fac: Omit<Faculty, 'id'>) => Faculty;
  addSubject: (sub: Omit<Subject, 'id'>) => Subject;
  addAssignment: (assign: Omit<FacultySubjectAssignment, 'id'>) => FacultySubjectAssignment;
  addStudent: (student: Omit<Student, 'id' | 'created_at'>) => Student;
  updateStudent: (id: string, updates: Partial<Student>) => Student;
  addTimetableEntry: (entry: Omit<TimetableEntry, 'id'>) => TimetableEntry;
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
  }) => { session: AttendanceSession; records: AttendanceRecord[] };
  submitCorrectionRequest: (params: {
    attendanceRecordId: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }) => AttendanceCorrection;
  reviewCorrectionRequest: (params: {
    correctionId: string;
    status: 'approved' | 'rejected';
    reviewerFacultyId: string;
    reviewRemarks?: string;
  }) => AttendanceCorrection;
  getStudentAttendance: (studentId: string) => StudentOverallAttendance;
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
  const [dataVersion, setDataVersion] = useState(0);

  const refreshData = useCallback(() => {
    setDataVersion(v => v + 1);
  }, []);

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

  useEffect(() => {
    setInstitution(erpStorage.getInstitution());
    setDepartments(erpStorage.getDepartments());
    setPrograms(erpStorage.getPrograms());
    setSessions(erpStorage.getSessions());
    setYears(erpStorage.getYears());
    setSemesters(erpStorage.getSemesters());
    setSections(erpStorage.getSections());
    setSubjects(erpStorage.getSubjects());
    setFaculty(erpStorage.getFaculty());
    setAssignments(erpStorage.getAssignments());
    setStudents(erpStorage.getStudents());
    setTimetable(erpStorage.getTimetable());
    setAttendanceSessions(erpStorage.getAttendanceSessions());
    setAttendanceRecords(erpStorage.getAttendanceRecords());
    setCorrections(erpStorage.getCorrections());
    setAuditLogs(erpStorage.getAuditLogs());
  }, [dataVersion]);

  const addDepartment = (dept: Omit<Department, 'id' | 'created_at'>) => {
    const res = erpStorage.addDepartment(dept);
    refreshData();
    return res;
  };

  const addProgram = (prog: Omit<Program, 'id' | 'created_at'>) => {
    const res = erpStorage.addProgram(prog);
    refreshData();
    return res;
  };

  const addSection = (sec: Omit<Section, 'id'>) => {
    const res = erpStorage.addSection(sec);
    refreshData();
    return res;
  };

  const addFaculty = (fac: Omit<Faculty, 'id'>) => {
    const res = erpStorage.addFaculty(fac);
    refreshData();
    return res;
  };

  const addSubject = (sub: Omit<Subject, 'id'>) => {
    const res = erpStorage.addSubject(sub);
    refreshData();
    return res;
  };

  const addAssignment = (assign: Omit<FacultySubjectAssignment, 'id'>) => {
    const res = erpStorage.addAssignment(assign);
    refreshData();
    return res;
  };

  const addStudent = (student: Omit<Student, 'id' | 'created_at'>) => {
    const res = erpStorage.addStudent(student);
    refreshData();
    return res;
  };

  const updateStudent = (id: string, updates: Partial<Student>) => {
    const res = erpStorage.updateStudent(id, updates);
    refreshData();
    return res;
  };

  const addTimetableEntry = (entry: Omit<TimetableEntry, 'id'>) => {
    const res = erpStorage.addTimetableEntry(entry);
    refreshData();
    return res;
  };

  const checkTimetableConflict = (entry: Omit<TimetableEntry, 'id'>, excludeId?: string) => {
    return erpStorage.checkTimetableConflict(entry, excludeId);
  };

  const saveAttendance = (params: {
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
    const res = erpStorage.saveAttendanceSession(params);
    refreshData();
    return res;
  };

  const submitCorrectionRequest = (params: {
    attendanceRecordId: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }) => {
    const res = erpStorage.submitCorrectionRequest(params);
    refreshData();
    return res;
  };

  const reviewCorrectionRequest = (params: {
    correctionId: string;
    status: 'approved' | 'rejected';
    reviewerFacultyId: string;
    reviewRemarks?: string;
  }) => {
    const res = erpStorage.reviewCorrectionRequest(params);
    refreshData();
    return res;
  };

  const getStudentAttendance = (studentId: string) => {
    return erpStorage.calculateStudentAttendance(studentId);
  };

  const getTodaySchedule = (params: {
    dayOfWeek: DayOfWeek;
    sectionId?: string;
    facultyId?: string;
    studentId?: string;
    dateStr: string;
  }) => {
    return erpStorage.getTodaySchedule(params);
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
        refreshData,
        addDepartment,
        addProgram,
        addSection,
        addFaculty,
        addSubject,
        addAssignment,
        addStudent,
        updateStudent,
        addTimetableEntry,
        checkTimetableConflict,
        saveAttendance,
        submitCorrectionRequest,
        reviewCorrectionRequest,
        getStudentAttendance,
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

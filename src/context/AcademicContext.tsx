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
  TimetableConflict,
  SubjectAttendanceStat
} from '../types/academic.types';
import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';
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
  isLoading: boolean;
  refreshData: () => Promise<void>;

  // Real Database Actions
  addDepartment: (dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => Promise<Department>;
  addProgram: (prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) => Promise<Program>;
  addSection: (sec: Omit<Section, 'id' | 'created_at' | 'updated_at'>) => Promise<Section>;
  addFaculty: (fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) => Promise<Faculty>;
  addSubject: (sub: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) => Promise<Subject>;
  addAssignment: (assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) => Promise<FacultySubjectAssignment>;
  addStudent: (student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => Promise<Student>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<Student>;
  addTimetableEntry: (entry: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<TimetableEntry>;
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
    attendanceRecordId: string;
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
  const [isLoading, setIsLoading] = useState(true);

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

  // Function to load latest records from Supabase
  const loadDataFromSupabase = useCallback(async () => {
    try {
      const data = await supabaseService.fetchAllData();
      if (data) {
        if (data.institutions.length > 0) setInstitution(data.institutions[0]);
        if (data.departments.length > 0) setDepartments(data.departments);
        if (data.programs.length > 0) setPrograms(data.programs);
        if (data.sessions.length > 0) setSessions(data.sessions);
        if (data.years.length > 0) setYears(data.years);
        if (data.semesters.length > 0) setSemesters(data.semesters);
        if (data.sections.length > 0) setSections(data.sections);
        if (data.subjects.length > 0) setSubjects(data.subjects);
        if (data.faculty.length > 0) setFaculty(data.faculty);
        if (data.assignments.length > 0) setAssignments(data.assignments);
        if (data.students.length > 0) setStudents(data.students);
        if (data.timetable.length > 0) setTimetable(data.timetable);
        setAttendanceSessions(data.attendanceSessions);
        setAttendanceRecords(data.attendanceRecords);
        setCorrections(data.corrections);
        setAuditLogs(data.auditLogs);
      }
    } catch (err) {
      console.error('Failed to sync from Supabase, relying on local cache:', err);
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
          console.log('⚡ Realtime database mutation received from Supabase:', payload.table, payload.eventType);
          loadDataFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDataFromSupabase]);

  // Manual refresh
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
    // Save to Supabase
    const result = await supabaseService.saveAttendance(params);
    
    // Also update local cache
    erpStorage.saveAttendanceSession(params);
    await refreshData();

    return result;
  };

  // 2. Submit Attendance Correction Request
  const submitCorrectionRequest = async (params: {
    attendanceRecordId: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }) => {
    const res = await supabaseService.submitCorrection(params);
    erpStorage.submitCorrectionRequest(params);
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

  // 4. Admin CRUD Operations
  const addDepartment = async (dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addDepartment(dept);
    erpStorage.addDepartment(dept);
    await refreshData();
    return res;
  };

  const addProgram = async (prog: Omit<Program, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addProgram(prog);
    erpStorage.addProgram(prog);
    await refreshData();
    return res;
  };

  const addSection = async (sec: Omit<Section, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addSection(sec);
    erpStorage.addSection(sec);
    await refreshData();
    return res;
  };

  const addFaculty = async (fac: Omit<Faculty, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addFaculty(fac);
    erpStorage.addFaculty(fac);
    await refreshData();
    return res;
  };

  const addSubject = async (sub: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await supabaseService.addSubject(sub);
    erpStorage.addSubject(sub);
    await refreshData();
    return res;
  };

  const addAssignment = async (assign: Omit<FacultySubjectAssignment, 'id' | 'created_at'>) => {
    const res = await supabaseService.addAssignment(assign);
    erpStorage.addAssignment(assign);
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

  // 5. Timetable Conflict Engine
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

  // 6. Calculate Student Attendance from Real Database Records
  const getStudentAttendance = (studentId: string): StudentOverallAttendance => {
    const student = students.find(s => s.id === studentId);
    const studSection = sections.find(s => s.id === student?.section_id);

    // Get all records for this student
    const studentRecords = attendanceRecords.filter(r => r.student_id === studentId);

    // Group by subject
    const subjectStats: SubjectAttendanceStat[] = subjects.map(sub => {
      const subSessions = attendanceSessions.filter(
        sess => sess.subject_id === sub.id && (student?.section_id ? sess.section_id === student.section_id : true)
      );

      const subRecords = studentRecords.filter(r => {
        const sess = attendanceSessions.find(s => s.id === r.attendance_session_id);
        return sess && sess.subject_id === sub.id;
      });

      const totalConducted = subSessions.length;
      const attended = subRecords.filter(r => r.status === 'Present').length;
      const percentage = totalConducted > 0 ? Math.round((attended / totalConducted) * 100) : 100;

      const assignment = assignments.find(a => a.subject_id === sub.id && (student?.section_id ? a.section_id === student.section_id : true));
      const assignedFac = faculty.find(f => f.id === assignment?.faculty_id) || faculty[0];

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
    const overallPercentage = totalLectures > 0 ? Math.round((presentLectures / totalLectures) * 100) : 100;

    return {
      studentId,
      rollNumber: student?.roll_number || '2503400100057',
      fullName: student?.full_name || 'Student',
      sectionName: studSection?.name || 'A',
      totalLectures,
      presentLectures,
      percentage: overallPercentage,
      isDefaulter: overallPercentage < 75,
      subjectStats,
    };
  };

  // 7. Get Today's Schedule
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
        isLoading,
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

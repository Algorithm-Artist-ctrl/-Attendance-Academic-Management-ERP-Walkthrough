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
  UserProfile,
  AttendanceStatus,
  DayOfWeek
} from '../../types/database.types';

import {
  StudentOverallAttendance,
  SubjectAttendanceStat,
  TodayLectureItem,
  TimetableConflict
} from '../../types/academic.types';

import {
  INITIAL_INSTITUTION,
  INITIAL_DEPARTMENTS,
  INITIAL_PROGRAMS,
  INITIAL_SESSIONS,
  INITIAL_YEARS,
  INITIAL_SEMESTERS,
  INITIAL_SECTIONS,
  INITIAL_FACULTY,
  INITIAL_SUBJECTS,
  INITIAL_ASSIGNMENTS,
  INITIAL_TIMETABLE,
  ALL_INITIAL_STUDENTS,
  INITIAL_USER_PROFILES,
  INITIAL_ATTENDANCE_SESSIONS,
  INITIAL_ATTENDANCE_RECORDS,
  INITIAL_CORRECTIONS,
  INITIAL_AUDIT_LOGS,
} from './initialSeedData';

const STORAGE_KEYS = {
  INSTITUTION: 'vctm_erp_institution',
  DEPARTMENTS: 'vctm_erp_departments',
  PROGRAMS: 'vctm_erp_programs',
  SESSIONS: 'vctm_erp_sessions',
  YEARS: 'vctm_erp_years',
  SEMESTERS: 'vctm_erp_semesters',
  SECTIONS: 'vctm_erp_sections',
  FACULTY: 'vctm_erp_faculty',
  SUBJECTS: 'vctm_erp_subjects',
  ASSIGNMENTS: 'vctm_erp_assignments',
  TIMETABLE: 'vctm_erp_timetable',
  STUDENTS: 'vctm_erp_students',
  PROFILES: 'vctm_erp_profiles',
  ATT_SESSIONS: 'vctm_erp_att_sessions',
  ATT_RECORDS: 'vctm_erp_att_records',
  CORRECTIONS: 'vctm_erp_corrections',
  AUDIT_LOGS: 'vctm_erp_audit_logs',
  SESSION_USER: 'vctm_erp_session_user',
};

const memoryStore: Record<string, string> = {};

// Safe JSON loader with fallback
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(key);
      if (!item) return fallback;
      return JSON.parse(item) as T;
    }
    const memItem = memoryStore[key];
    if (!memItem) return fallback;
    return JSON.parse(memItem) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    const json = JSON.stringify(data);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, json);
    }
    memoryStore[key] = json;
  } catch (err) {
    console.error(`Error saving to storage for key ${key}:`, err);
  }
}

class ERPStorageService {
  // Initialize storage with seed data if empty
  constructor() {
    this.init();
  }

  public init(forceReset = false) {
    const existing = loadFromStorage(STORAGE_KEYS.INSTITUTION, null);
    if (forceReset || !existing) {
      saveToStorage(STORAGE_KEYS.INSTITUTION, INITIAL_INSTITUTION);
      saveToStorage(STORAGE_KEYS.DEPARTMENTS, INITIAL_DEPARTMENTS);
      saveToStorage(STORAGE_KEYS.PROGRAMS, INITIAL_PROGRAMS);
      saveToStorage(STORAGE_KEYS.SESSIONS, INITIAL_SESSIONS);
      saveToStorage(STORAGE_KEYS.YEARS, INITIAL_YEARS);
      saveToStorage(STORAGE_KEYS.SEMESTERS, INITIAL_SEMESTERS);
      saveToStorage(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS);
      saveToStorage(STORAGE_KEYS.FACULTY, INITIAL_FACULTY);
      saveToStorage(STORAGE_KEYS.SUBJECTS, INITIAL_SUBJECTS);
      saveToStorage(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
      saveToStorage(STORAGE_KEYS.TIMETABLE, INITIAL_TIMETABLE);
      saveToStorage(STORAGE_KEYS.STUDENTS, ALL_INITIAL_STUDENTS);
      saveToStorage(STORAGE_KEYS.PROFILES, INITIAL_USER_PROFILES);
      saveToStorage(STORAGE_KEYS.ATT_SESSIONS, INITIAL_ATTENDANCE_SESSIONS);
      saveToStorage(STORAGE_KEYS.ATT_RECORDS, INITIAL_ATTENDANCE_RECORDS);
      saveToStorage(STORAGE_KEYS.CORRECTIONS, INITIAL_CORRECTIONS);
      saveToStorage(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    }
  }

  // Master Data Getters
  public getInstitution(): Institution {
    return loadFromStorage(STORAGE_KEYS.INSTITUTION, INITIAL_INSTITUTION);
  }

  public getDepartments(): Department[] {
    const depts = loadFromStorage<Department[]>(STORAGE_KEYS.DEPARTMENTS, INITIAL_DEPARTMENTS);
    const faculty = this.getFaculty();
    return depts.map(d => ({
      ...d,
      hod: faculty.find(f => f.id === d.hod_faculty_id)
    }));
  }

  public addDepartment(dept: Omit<Department, 'id' | 'created_at'>): Department {
    const depts = this.getDepartments();
    const newDept: Department = {
      ...dept,
      id: `dept-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    depts.push(newDept);
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, depts);
    this.addAuditLog('DEPARTMENT_CREATED', 'departments', newDept.id, undefined, newDept);
    return newDept;
  }

  public getPrograms(): Program[] {
    return loadFromStorage(STORAGE_KEYS.PROGRAMS, INITIAL_PROGRAMS);
  }

  public addProgram(prog: Omit<Program, 'id' | 'created_at'>): Program {
    const programs = this.getPrograms();
    const newProg: Program = {
      ...prog,
      id: `prog-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    programs.push(newProg);
    saveToStorage(STORAGE_KEYS.PROGRAMS, programs);
    this.addAuditLog('PROGRAM_CREATED', 'programs', newProg.id, undefined, newProg);
    return newProg;
  }

  public getSessions(): AcademicSession[] {
    return loadFromStorage(STORAGE_KEYS.SESSIONS, INITIAL_SESSIONS);
  }

  public getYears(): AcademicYear[] {
    return loadFromStorage(STORAGE_KEYS.YEARS, INITIAL_YEARS);
  }

  public getSemesters(): Semester[] {
    return loadFromStorage(STORAGE_KEYS.SEMESTERS, INITIAL_SEMESTERS);
  }

  public getSections(): Section[] {
    const sections = loadFromStorage<Section[]>(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS);
    const faculty = this.getFaculty();
    return sections.map(s => ({
      ...s,
      class_coordinator: faculty.find(f => f.id === s.class_coordinator_id)
    }));
  }

  public addSection(sec: Omit<Section, 'id'>): Section {
    const sections = this.getSections();
    const newSec: Section = {
      ...sec,
      id: `sec-${Date.now()}`,
    };
    sections.push(newSec);
    saveToStorage(STORAGE_KEYS.SECTIONS, sections);
    this.addAuditLog('SECTION_CREATED', 'sections', newSec.id, undefined, newSec);
    return newSec;
  }

  public getFaculty(): Faculty[] {
    const facList = loadFromStorage<Faculty[]>(STORAGE_KEYS.FACULTY, INITIAL_FACULTY);
    const depts = loadFromStorage<Department[]>(STORAGE_KEYS.DEPARTMENTS, INITIAL_DEPARTMENTS);
    return facList.map(f => ({
      ...f,
      department: depts.find(d => d.id === f.department_id)
    }));
  }

  public addFaculty(fac: Omit<Faculty, 'id'>): Faculty {
    const list = this.getFaculty();
    const newFac: Faculty = {
      ...fac,
      id: `fac-${Date.now()}`,
    };
    list.push(newFac);
    saveToStorage(STORAGE_KEYS.FACULTY, list);

    // Also create a profile
    const profiles = this.getProfiles();
    profiles.push({
      id: `user-${newFac.id}`,
      email: newFac.email,
      role: 'faculty',
      full_name: newFac.full_name,
      department_id: newFac.department_id,
      faculty_id: newFac.id,
      phone: newFac.phone,
    });
    saveToStorage(STORAGE_KEYS.PROFILES, profiles);

    this.addAuditLog('FACULTY_CREATED', 'faculty', newFac.id, undefined, newFac);
    return newFac;
  }

  public getSubjects(): Subject[] {
    return loadFromStorage(STORAGE_KEYS.SUBJECTS, INITIAL_SUBJECTS);
  }

  public addSubject(sub: Omit<Subject, 'id'>): Subject {
    const list = this.getSubjects();
    const newSub: Subject = {
      ...sub,
      id: `sub-${Date.now()}`,
    };
    list.push(newSub);
    saveToStorage(STORAGE_KEYS.SUBJECTS, list);
    this.addAuditLog('SUBJECT_CREATED', 'subjects', newSub.id, undefined, newSub);
    return newSub;
  }

  public getAssignments(): FacultySubjectAssignment[] {
    const assignments = loadFromStorage<FacultySubjectAssignment[]>(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
    const faculty = this.getFaculty();
    const subjects = this.getSubjects();
    const sections = this.getSections();
    return assignments.map(a => ({
      ...a,
      faculty: faculty.find(f => f.id === a.faculty_id),
      subject: subjects.find(s => s.id === a.subject_id),
      section: sections.find(sec => sec.id === a.section_id)
    }));
  }

  public addAssignment(assignment: Omit<FacultySubjectAssignment, 'id'>): FacultySubjectAssignment {
    const list = this.getAssignments();
    const newAssign: FacultySubjectAssignment = {
      ...assignment,
      id: `fsa-${Date.now()}`,
    };
    list.push(newAssign);
    saveToStorage(STORAGE_KEYS.ASSIGNMENTS, list);
    this.addAuditLog('FACULTY_ASSIGNMENT_CREATED', 'faculty_subject_assignments', newAssign.id, undefined, newAssign);
    return newAssign;
  }

  public getStudents(): Student[] {
    const students = loadFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, ALL_INITIAL_STUDENTS);
    const sections = this.getSections();
    const faculty = this.getFaculty();
    const depts = this.getDepartments();

    return students.map(s => ({
      ...s,
      section: sections.find(sec => sec.id === s.section_id),
      mentor: faculty.find(f => f.id === s.mentor_faculty_id),
      department: depts.find(d => d.id === s.department_id)
    }));
  }

  public addStudent(student: Omit<Student, 'id' | 'created_at'>): Student {
    const students = this.getStudents();
    // Check duplicate roll number
    if (students.some(s => s.roll_number.toLowerCase() === student.roll_number.toLowerCase())) {
      throw new Error(`Student with Roll Number ${student.roll_number} already exists!`);
    }

    const newStudent: Student = {
      ...student,
      id: `stud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    students.push(newStudent);
    saveToStorage(STORAGE_KEYS.STUDENTS, students);

    // Also create profile
    const profiles = this.getProfiles();
    profiles.push({
      id: `user-${newStudent.id}`,
      email: `${newStudent.roll_number}@student.vctm.in`,
      role: 'student',
      full_name: newStudent.full_name,
      department_id: newStudent.department_id,
      student_id: newStudent.id,
    });
    saveToStorage(STORAGE_KEYS.PROFILES, profiles);

    this.addAuditLog('STUDENT_CREATED', 'students', newStudent.id, undefined, newStudent);
    return newStudent;
  }

  public updateStudent(id: string, updates: Partial<Student>): Student {
    const students = this.getStudents();
    const idx = students.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Student not found');

    const old = students[idx];
    const updated = { ...old, ...updates };
    students[idx] = updated;
    saveToStorage(STORAGE_KEYS.STUDENTS, students);
    this.addAuditLog('STUDENT_UPDATED', 'students', id, old, updated);
    return updated;
  }

  public getTimetable(): TimetableEntry[] {
    const entries = loadFromStorage<TimetableEntry[]>(STORAGE_KEYS.TIMETABLE, INITIAL_TIMETABLE);
    const subjects = this.getSubjects();
    const faculty = this.getFaculty();
    const sections = this.getSections();

    return entries.map(e => ({
      ...e,
      subject: subjects.find(s => s.id === e.subject_id),
      faculty: faculty.find(f => f.id === e.faculty_id),
      section: sections.find(sec => sec.id === e.section_id)
    }));
  }

  // Conflict detection for timetable entries
  public checkTimetableConflict(entry: Omit<TimetableEntry, 'id'>, excludeId?: string): TimetableConflict | null {
    const entries = this.getTimetable().filter(e => e.id !== excludeId && e.active);

    // 1. Faculty Conflict: same faculty at same day & period
    const facultyConflict = entries.find(
      e => e.faculty_id === entry.faculty_id &&
           e.day_of_week === entry.day_of_week &&
           e.period_number === entry.period_number
    );
    if (facultyConflict) {
      return {
        type: 'faculty',
        message: `Faculty conflict: ${facultyConflict.faculty?.full_name || 'Faculty'} is already scheduled for Section ${facultyConflict.section?.name || ''} in Period ${entry.period_number} on ${entry.day_of_week}.`,
        conflictingEntry: facultyConflict
      };
    }

    // 2. Room Conflict: same room at same day & period
    const roomConflict = entries.find(
      e => e.room_number.toLowerCase() === entry.room_number.toLowerCase() &&
           e.day_of_week === entry.day_of_week &&
           e.period_number === entry.period_number
    );
    if (roomConflict) {
      return {
        type: 'room',
        message: `Room conflict: ${entry.room_number} is already booked for Section ${roomConflict.section?.name || ''} in Period ${entry.period_number} on ${entry.day_of_week}.`,
        conflictingEntry: roomConflict
      };
    }

    // 3. Section Conflict: same section at same day & period
    const sectionConflict = entries.find(
      e => e.section_id === entry.section_id &&
           e.day_of_week === entry.day_of_week &&
           e.period_number === entry.period_number
    );
    if (sectionConflict) {
      return {
        type: 'section',
        message: `Section conflict: Section ${sectionConflict.section?.name || ''} already has ${sectionConflict.subject?.subject_name || 'a lecture'} scheduled in Period ${entry.period_number} on ${entry.day_of_week}.`,
        conflictingEntry: sectionConflict
      };
    }

    return null;
  }

  public addTimetableEntry(entry: Omit<TimetableEntry, 'id'>): TimetableEntry {
    const conflict = this.checkTimetableConflict(entry);
    if (conflict) {
      throw new Error(conflict.message);
    }

    const entries = this.getTimetable();
    const newEntry: TimetableEntry = {
      ...entry,
      id: `tt-${Date.now()}`,
    };
    entries.push(newEntry);
    saveToStorage(STORAGE_KEYS.TIMETABLE, entries);
    this.addAuditLog('TIMETABLE_ENTRY_CREATED', 'timetable_entries', newEntry.id, undefined, newEntry);
    return newEntry;
  }

  public getProfiles(): UserProfile[] {
    const profiles = loadFromStorage<UserProfile[]>(STORAGE_KEYS.PROFILES, INITIAL_USER_PROFILES);
    const faculty = this.getFaculty();
    const students = this.getStudents();

    return profiles.map(p => ({
      ...p,
      faculty: faculty.find(f => f.id === p.faculty_id),
      student: students.find(s => s.id === p.student_id),
    }));
  }

  // Attendance Management
  public getAttendanceSessions(): AttendanceSession[] {
    const sessions = loadFromStorage<AttendanceSession[]>(STORAGE_KEYS.ATT_SESSIONS, INITIAL_ATTENDANCE_SESSIONS);
    const faculty = this.getFaculty();
    const subjects = this.getSubjects();
    const sections = this.getSections();

    return sessions.map(s => ({
      ...s,
      faculty: faculty.find(f => f.id === s.faculty_id),
      subject: subjects.find(sub => sub.id === s.subject_id),
      section: sections.find(sec => sec.id === s.section_id)
    }));
  }

  public getAttendanceRecords(): AttendanceRecord[] {
    const records = loadFromStorage<AttendanceRecord[]>(STORAGE_KEYS.ATT_RECORDS, INITIAL_ATTENDANCE_RECORDS);
    const students = this.getStudents();
    const sessions = this.getAttendanceSessions();

    return records.map(r => ({
      ...r,
      student: students.find(s => s.id === r.student_id),
      session: sessions.find(sess => sess.id === r.attendance_session_id)
    }));
  }

  // Take / Save Attendance
  public saveAttendanceSession(params: {
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
  }): { session: AttendanceSession; records: AttendanceRecord[] } {
    const sessions = this.getAttendanceSessions();
    const records = this.getAttendanceRecords();

    // Check if session already exists for this exact slot
    let existingSession = sessions.find(
      s => s.section_id === params.sectionId &&
           s.subject_id === params.subjectId &&
           s.session_date === params.sessionDate &&
           (s.timetable_entry_id === params.timetableEntryId || (!s.timetable_entry_id && !params.timetableEntryId))
    );

    const now = new Date().toISOString();
    let sessionId = existingSession ? existingSession.id : `att-sess-${Date.now()}`;

    if (existingSession) {
      existingSession.status = 'completed';
      existingSession.marked_at = now;
      saveToStorage(STORAGE_KEYS.ATT_SESSIONS, sessions);
    } else {
      const newSession: AttendanceSession = {
        id: sessionId,
        timetable_entry_id: params.timetableEntryId,
        faculty_id: params.facultyId,
        section_id: params.sectionId,
        subject_id: params.subjectId,
        session_date: params.sessionDate,
        start_time: params.startTime,
        end_time: params.endTime,
        status: 'completed',
        marked_at: now,
        created_at: now,
      };
      sessions.push(newSession);
      saveToStorage(STORAGE_KEYS.ATT_SESSIONS, sessions);
      existingSession = newSession;
    }

    // Upsert student attendance records
    const savedRecords: AttendanceRecord[] = [];
    params.studentRecords.forEach(sr => {
      const existingRecordIdx = records.findIndex(
        r => r.attendance_session_id === sessionId && r.student_id === sr.studentId
      );

      if (existingRecordIdx >= 0) {
        records[existingRecordIdx] = {
          ...records[existingRecordIdx],
          status: sr.status,
          marked_by: params.facultyId,
          marked_at: now,
          remarks: sr.remarks,
        };
        savedRecords.push(records[existingRecordIdx]);
      } else {
        const newRecord: AttendanceRecord = {
          id: `att-rec-${sessionId}-${sr.studentId}`,
          attendance_session_id: sessionId,
          student_id: sr.studentId,
          status: sr.status,
          marked_by: params.facultyId,
          marked_at: now,
          remarks: sr.remarks,
        };
        records.push(newRecord);
        savedRecords.push(newRecord);
      }
    });

    saveToStorage(STORAGE_KEYS.ATT_RECORDS, records);

    const presentCount = params.studentRecords.filter(r => r.status === 'Present').length;
    const absentCount = params.studentRecords.filter(r => r.status === 'Absent').length;

    this.addAuditLog(
      'ATTENDANCE_MARKED',
      'attendance_sessions',
      sessionId,
      undefined,
      {
        sectionId: params.sectionId,
        subjectId: params.subjectId,
        date: params.sessionDate,
        present: presentCount,
        absent: absentCount
      }
    );

    return { session: existingSession, records: savedRecords };
  }

  // Attendance Corrections
  public getCorrections(): AttendanceCorrection[] {
    const corrections = loadFromStorage<AttendanceCorrection[]>(STORAGE_KEYS.CORRECTIONS, INITIAL_CORRECTIONS);
    const students = this.getStudents();
    const records = this.getAttendanceRecords();
    const faculty = this.getFaculty();

    return corrections.map(c => ({
      ...c,
      student: students.find(s => s.id === c.student_id),
      record: records.find(r => r.id === c.attendance_record_id),
      reviewer: faculty.find(f => f.id === c.reviewed_by)
    }));
  }

  public submitCorrectionRequest(params: {
    attendanceRecordId: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  }): AttendanceCorrection {
    const corrections = this.getCorrections();

    // Check if pending request already exists for this record
    const existing = corrections.find(
      c => c.attendance_record_id === params.attendanceRecordId && c.status === 'pending'
    );
    if (existing) {
      throw new Error('A correction request for this lecture is already pending review.');
    }

    const newCorrection: AttendanceCorrection = {
      id: `corr-${Date.now()}`,
      attendance_record_id: params.attendanceRecordId,
      student_id: params.studentId,
      requested_status: params.requestedStatus,
      reason: params.reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    corrections.unshift(newCorrection);
    saveToStorage(STORAGE_KEYS.CORRECTIONS, corrections);

    this.addAuditLog('CORRECTION_REQUESTED', 'attendance_corrections', newCorrection.id, undefined, newCorrection);
    return newCorrection;
  }

  public reviewCorrectionRequest(params: {
    correctionId: string;
    status: 'approved' | 'rejected';
    reviewerFacultyId: string;
    reviewRemarks?: string;
  }): AttendanceCorrection {
    const corrections = this.getCorrections();
    const idx = corrections.findIndex(c => c.id === params.correctionId);
    if (idx === -1) throw new Error('Correction request not found');

    const correction = corrections[idx];
    if (correction.status !== 'pending') {
      throw new Error('This correction request has already been reviewed.');
    }

    const now = new Date().toISOString();
    correction.status = params.status;
    correction.reviewed_by = params.reviewerFacultyId;
    correction.reviewed_at = now;
    correction.review_remarks = params.reviewRemarks;

    // If approved, update actual attendance record
    if (params.status === 'approved') {
      const records = this.getAttendanceRecords();
      const recordIdx = records.findIndex(r => r.id === correction.attendance_record_id);
      if (recordIdx >= 0) {
        const oldStatus = records[recordIdx].status;
        records[recordIdx].status = correction.requested_status;
        records[recordIdx].remarks = (records[recordIdx].remarks ? `${records[recordIdx].remarks} | ` : '') +
          `Correction approved on ${now.substring(0, 10)} (${params.reviewRemarks || 'Verified'})`;
        records[recordIdx].marked_at = now;
        saveToStorage(STORAGE_KEYS.ATT_RECORDS, records);

        this.addAuditLog('CORRECTION_APPROVED', 'attendance_records', records[recordIdx].id, { status: oldStatus }, { status: correction.requested_status, remarks: params.reviewRemarks });
      }
    } else {
      this.addAuditLog('CORRECTION_REJECTED', 'attendance_corrections', correction.id, undefined, { reason: params.reviewRemarks });
    }

    saveToStorage(STORAGE_KEYS.CORRECTIONS, corrections);
    return correction;
  }

  // Real-time Academic Statistics Calculations
  public calculateStudentAttendance(studentId: string): StudentOverallAttendance {
    const student = this.getStudents().find(s => s.id === studentId);
    if (!student) throw new Error('Student not found');

    const subjects = this.getSubjects().filter(s => s.semester_id === student.semester_id && s.active);
    const sessions = this.getAttendanceSessions().filter(s => s.section_id === student.section_id && s.status === 'completed');
    const records = this.getAttendanceRecords().filter(r => r.student_id === studentId);

    let totalConducted = 0;
    let totalAttended = 0;

    const subjectStats: SubjectAttendanceStat[] = subjects.map(sub => {
      const subSessions = sessions.filter(s => s.subject_id === sub.id);
      const subSessionIds = new Set(subSessions.map(s => s.id));
      const subRecords = records.filter(r => subSessionIds.has(r.attendance_session_id));

      const attended = subRecords.filter(r => r.status === 'Present').length;
      const conducted = subSessions.length;
      const percentage = conducted > 0 ? Math.round((attended / conducted) * 100 * 10) / 10 : 100;

      totalConducted += conducted;
      totalAttended += attended;

      // Find faculty for this subject in student's section
      const assignment = this.getAssignments().find(a => a.subject_id === sub.id && a.section_id === student.section_id);

      return {
        subjectId: sub.id,
        subjectCode: sub.subject_code,
        subjectName: sub.subject_name,
        lectureType: sub.lecture_type,
        facultyName: assignment?.faculty?.full_name || 'Faculty',
        totalConducted: conducted,
        attended: attended,
        percentage: percentage,
        credits: Number(sub.credits),
      };
    });

    const overallPercentage = totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100 * 10) / 10 : 100;

    return {
      studentId: student.id,
      rollNumber: student.roll_number,
      fullName: student.full_name,
      sectionName: student.section?.name || 'A',
      totalLectures: totalConducted,
      presentLectures: totalAttended,
      percentage: overallPercentage,
      isDefaulter: overallPercentage < 75 && totalConducted >= 5, // Alert below 75%
      subjectStats: subjectStats,
    };
  }

  // Get Today's schedule for a section or faculty
  public getTodaySchedule(params: {
    dayOfWeek: DayOfWeek;
    sectionId?: string;
    facultyId?: string;
    studentId?: string;
    dateStr: string; // 'YYYY-MM-DD'
  }): TodayLectureItem[] {
    const timetable = this.getTimetable().filter(t => t.day_of_week === params.dayOfWeek && t.active);
    const sessions = this.getAttendanceSessions().filter(s => s.session_date === params.dateStr);
    const records = params.studentId ? this.getAttendanceRecords().filter(r => r.student_id === params.studentId) : [];

    let filtered = timetable;
    if (params.sectionId) {
      filtered = filtered.filter(t => t.section_id === params.sectionId);
    }
    if (params.facultyId) {
      filtered = filtered.filter(t => t.faculty_id === params.facultyId);
    }

    // Sort by period number
    filtered.sort((a, b) => a.period_number - b.period_number);

    return filtered.map(t => {
      const session = sessions.find(s => s.timetable_entry_id === t.id || (s.section_id === t.section_id && s.subject_id === t.subject_id));
      const studentRec = session ? records.find(r => r.attendance_session_id === session.id) : undefined;

      return {
        timetableEntryId: t.id,
        dayOfWeek: t.day_of_week,
        periodNumber: t.period_number,
        startTime: t.start_time,
        endTime: t.end_time,
        subjectCode: t.subject?.subject_code || '',
        subjectName: t.subject?.subject_name || '',
        facultyName: t.faculty?.full_name || '',
        facultyCode: t.faculty?.faculty_code,
        roomNumber: t.room_number,
        lectureType: t.lecture_type,
        sectionName: t.section?.name || '',
        sectionId: t.section_id,
        attendanceTaken: Boolean(session && session.status === 'completed'),
        attendanceSessionId: session?.id,
        studentStatus: session ? (studentRec?.status || 'Absent') : 'Not Recorded',
      };
    });
  }

  // Audit Logs
  public getAuditLogs(): AuditLog[] {
    return loadFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public addAuditLog(
    action: string,
    entityType: string,
    entityId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): void {
    const logs = this.getAuditLogs();
    const currentUser = this.getCurrentSessionUser();

    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: currentUser?.id,
      actor_name: currentUser?.full_name || 'System',
      actor_role: currentUser?.role || 'system',
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      created_at: new Date().toISOString(),
    };

    logs.unshift(newLog);
    // Keep max 500 audit logs in local storage
    if (logs.length > 500) logs.pop();
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // Session User
  public getCurrentSessionUser(): UserProfile | null {
    return loadFromStorage<UserProfile | null>(STORAGE_KEYS.SESSION_USER, null);
  }

  public setCurrentSessionUser(user: UserProfile | null): void {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.SESSION_USER);
    } else {
      saveToStorage(STORAGE_KEYS.SESSION_USER, user);
    }
  }
}

export const erpStorage = new ERPStorageService();

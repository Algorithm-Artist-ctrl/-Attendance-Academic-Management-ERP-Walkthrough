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
  DayOfWeek,
  TimetableVersion
} from '../../types/database.types';

import {
  StudentOverallAttendance,
  SubjectAttendanceStat,
  TodayLectureItem,
  TimetableConflict
} from '../../types/academic.types';

const DEFAULT_INSTITUTION: Institution = {
  id: '22398afa-8679-4d2c-87fc-312152a276e2',
  name: 'Vivekananda College of Technology & Management, Aligarh',
  code: '340',
  address: 'Mathura Bypass Road, Near Khair Road Crossing, Aligarh, Uttar Pradesh 202001',
  website: 'https://vctm.in/',
  logo_url: '/vctm-logo.png',
  active: true,
  created_at: '2026-08-01T00:00:00Z',
};

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
  constructor() {
    this.init();
  }

  public init(forceReset = false) {
    const existing = loadFromStorage(STORAGE_KEYS.INSTITUTION, null);
    if (forceReset || !existing) {
      saveToStorage(STORAGE_KEYS.INSTITUTION, DEFAULT_INSTITUTION);
      saveToStorage(STORAGE_KEYS.DEPARTMENTS, []);
      saveToStorage(STORAGE_KEYS.PROGRAMS, []);
      saveToStorage(STORAGE_KEYS.SESSIONS, []);
      saveToStorage(STORAGE_KEYS.YEARS, []);
      saveToStorage(STORAGE_KEYS.SEMESTERS, []);
      saveToStorage(STORAGE_KEYS.SECTIONS, []);
      saveToStorage(STORAGE_KEYS.FACULTY, []);
      saveToStorage(STORAGE_KEYS.SUBJECTS, []);
      saveToStorage(STORAGE_KEYS.ASSIGNMENTS, []);
      saveToStorage(STORAGE_KEYS.TIMETABLE, []);
      saveToStorage(STORAGE_KEYS.STUDENTS, []);
      saveToStorage(STORAGE_KEYS.PROFILES, []);
      saveToStorage(STORAGE_KEYS.ATT_SESSIONS, []);
      saveToStorage(STORAGE_KEYS.ATT_RECORDS, []);
      saveToStorage(STORAGE_KEYS.CORRECTIONS, []);
      saveToStorage(STORAGE_KEYS.AUDIT_LOGS, []);
    }
  }

  public syncFromSupabase(data: {
    institutions: Institution[];
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
    timetableVersions?: TimetableVersion[];
  }) {
    saveToStorage(STORAGE_KEYS.INSTITUTION, data.institutions[0] || DEFAULT_INSTITUTION);
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, data.departments || []);
    saveToStorage(STORAGE_KEYS.PROGRAMS, data.programs || []);
    saveToStorage(STORAGE_KEYS.SESSIONS, data.sessions || []);
    saveToStorage(STORAGE_KEYS.YEARS, data.years || []);
    saveToStorage(STORAGE_KEYS.SEMESTERS, data.semesters || []);
    saveToStorage(STORAGE_KEYS.SECTIONS, data.sections || []);
    saveToStorage(STORAGE_KEYS.FACULTY, data.faculty || []);
    saveToStorage(STORAGE_KEYS.SUBJECTS, data.subjects || []);
    saveToStorage(STORAGE_KEYS.ASSIGNMENTS, data.assignments || []);
    saveToStorage(STORAGE_KEYS.STUDENTS, data.students || []);
    saveToStorage(STORAGE_KEYS.TIMETABLE, data.timetable || []);
    saveToStorage(STORAGE_KEYS.ATT_SESSIONS, data.attendanceSessions || []);
    saveToStorage(STORAGE_KEYS.ATT_RECORDS, data.attendanceRecords || []);
    saveToStorage(STORAGE_KEYS.CORRECTIONS, data.corrections || []);
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, data.auditLogs || []);
  }

  // Master Data Getters
  public getInstitution(): Institution {
    return loadFromStorage(STORAGE_KEYS.INSTITUTION, DEFAULT_INSTITUTION);
  }

  public getDepartments(): Department[] {
    const depts = loadFromStorage<Department[]>(STORAGE_KEYS.DEPARTMENTS, []);
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

  public updateDepartment(id: string, updates: Partial<Department>): Department {
    const depts = this.getDepartments();
    const idx = depts.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('Department not found');
    const old = depts[idx];
    const updated = { ...old, ...updates };
    depts[idx] = updated;
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, depts);
    this.addAuditLog('DEPARTMENT_UPDATED', 'departments', id, old, updated);
    return updated;
  }

  public deleteDepartment(id: string): boolean {
    const depts = this.getDepartments().filter(d => d.id !== id);
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, depts);
    this.addAuditLog('DEPARTMENT_DELETED', 'departments', id);
    return true;
  }

  public getPrograms(): Program[] {
    return loadFromStorage<Program[]>(STORAGE_KEYS.PROGRAMS, []);
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

  public updateProgram(id: string, updates: Partial<Program>): Program {
    const programs = this.getPrograms();
    const idx = programs.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Program not found');
    const old = programs[idx];
    const updated = { ...old, ...updates };
    programs[idx] = updated;
    saveToStorage(STORAGE_KEYS.PROGRAMS, programs);
    this.addAuditLog('PROGRAM_UPDATED', 'programs', id, old, updated);
    return updated;
  }

  public deleteProgram(id: string): boolean {
    const programs = this.getPrograms().filter(p => p.id !== id);
    saveToStorage(STORAGE_KEYS.PROGRAMS, programs);
    this.addAuditLog('PROGRAM_DELETED', 'programs', id);
    return true;
  }

  public getSessions(): AcademicSession[] {
    return loadFromStorage<AcademicSession[]>(STORAGE_KEYS.SESSIONS, []);
  }

  public getYears(): AcademicYear[] {
    return loadFromStorage<AcademicYear[]>(STORAGE_KEYS.YEARS, []);
  }

  public getSemesters(): Semester[] {
    return loadFromStorage<Semester[]>(STORAGE_KEYS.SEMESTERS, []);
  }

  public getSections(): Section[] {
    const sections = loadFromStorage<Section[]>(STORAGE_KEYS.SECTIONS, []);
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

  public updateSection(id: string, updates: Partial<Section>): Section {
    const sections = this.getSections();
    const idx = sections.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Section not found');
    const old = sections[idx];
    const updated = { ...old, ...updates };
    sections[idx] = updated;
    saveToStorage(STORAGE_KEYS.SECTIONS, sections);
    this.addAuditLog('SECTION_UPDATED', 'sections', id, old, updated);
    return updated;
  }

  public deleteSection(id: string): boolean {
    const sections = this.getSections().filter(s => s.id !== id);
    saveToStorage(STORAGE_KEYS.SECTIONS, sections);
    this.addAuditLog('SECTION_DELETED', 'sections', id);
    return true;
  }

  public getFaculty(): Faculty[] {
    const facList = loadFromStorage<Faculty[]>(STORAGE_KEYS.FACULTY, []);
    const depts = loadFromStorage<Department[]>(STORAGE_KEYS.DEPARTMENTS, []);
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

  public updateFaculty(id: string, updates: Partial<Faculty>): Faculty {
    const faculty = this.getFaculty();
    const idx = faculty.findIndex(f => f.id === id);
    if (idx === -1) throw new Error('Faculty not found');
    const old = faculty[idx];
    const updated = { ...old, ...updates };
    faculty[idx] = updated;
    saveToStorage(STORAGE_KEYS.FACULTY, faculty);
    this.addAuditLog('FACULTY_UPDATED', 'faculty', id, old, updated);
    return updated;
  }

  public deleteFaculty(id: string): boolean {
    const faculty = this.getFaculty().filter(f => f.id !== id);
    saveToStorage(STORAGE_KEYS.FACULTY, faculty);
    this.addAuditLog('FACULTY_DELETED', 'faculty', id);
    return true;
  }

  public getSubjects(): Subject[] {
    return loadFromStorage<Subject[]>(STORAGE_KEYS.SUBJECTS, []);
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

  public updateSubject(id: string, updates: Partial<Subject>): Subject {
    const subjects = this.getSubjects();
    const idx = subjects.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Subject not found');
    const old = subjects[idx];
    const updated = { ...old, ...updates };
    subjects[idx] = updated;
    saveToStorage(STORAGE_KEYS.SUBJECTS, subjects);
    this.addAuditLog('SUBJECT_UPDATED', 'subjects', id, old, updated);
    return updated;
  }

  public deleteSubject(id: string): boolean {
    const subjects = this.getSubjects().filter(s => s.id !== id);
    saveToStorage(STORAGE_KEYS.SUBJECTS, subjects);
    this.addAuditLog('SUBJECT_DELETED', 'subjects', id);
    return true;
  }

  public getAssignments(): FacultySubjectAssignment[] {
    const assignments = loadFromStorage<FacultySubjectAssignment[]>(STORAGE_KEYS.ASSIGNMENTS, []);
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

  public deleteAssignment(id: string): boolean {
    const assignments = this.getAssignments().filter(a => a.id !== id);
    saveToStorage(STORAGE_KEYS.ASSIGNMENTS, assignments);
    this.addAuditLog('FACULTY_ASSIGNMENT_DELETED', 'faculty_subject_assignments', id);
    return true;
  }

  public getStudents(): Student[] {
    const students = loadFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, []);
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

  public deleteStudent(id: string): boolean {
    const students = this.getStudents().filter(s => s.id !== id);
    saveToStorage(STORAGE_KEYS.STUDENTS, students);
    this.addAuditLog('STUDENT_DELETED', 'students', id);
    return true;
  }

  public getTimetable(): TimetableEntry[] {
    const entries = loadFromStorage<TimetableEntry[]>(STORAGE_KEYS.TIMETABLE, []);
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

  public updateTimetableEntry(id: string, updates: Partial<TimetableEntry>): TimetableEntry {
    const entries = this.getTimetable();
    const idx = entries.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Timetable entry not found');
    const old = entries[idx];
    const updated = { ...old, ...updates };
    entries[idx] = updated;
    saveToStorage(STORAGE_KEYS.TIMETABLE, entries);
    this.addAuditLog('TIMETABLE_ENTRY_UPDATED', 'timetable_entries', id, old, updated);
    return updated;
  }

  public deleteTimetableEntry(id: string): boolean {
    const entries = this.getTimetable().filter(t => t.id !== id);
    saveToStorage(STORAGE_KEYS.TIMETABLE, entries);
    this.addAuditLog('TIMETABLE_ENTRY_DELETED', 'timetable_entries', id);
    return true;
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
    const rawProfiles = loadFromStorage<UserProfile[]>(STORAGE_KEYS.PROFILES, []);
    const faculty = this.getFaculty();
    const students = this.getStudents();

    const profileMap = new Map<string, UserProfile>();

    // 1. Add raw stored profiles (admin, etc.)
    rawProfiles.forEach(p => {
      profileMap.set(p.id, {
        ...p,
        faculty: faculty.find(f => f.id === p.faculty_id),
        student: students.find(s => s.id === p.student_id),
      });
    });

    // 2. Ensure every faculty member has a UserProfile
    faculty.forEach(f => {
      const existingKey = `user-${f.id}`;
      if (!profileMap.has(existingKey)) {
        const isHod = f.designation.toLowerCase().includes('hod');
        profileMap.set(existingKey, {
          id: existingKey,
          email: f.email,
          role: isHod ? 'hod' : 'faculty',
          full_name: f.full_name,
          faculty_id: f.id,
          department_id: f.department_id,
          phone: f.phone,
          faculty: f,
        });
      }
    });

    // 3. Ensure EVERY student has a UserProfile
    students.forEach(s => {
      const existingKey = `user-${s.id}`;
      if (!profileMap.has(existingKey)) {
        profileMap.set(existingKey, {
          id: existingKey,
          email: s.email || `${s.roll_number}@student.vctm.in`,
          role: 'student',
          full_name: s.full_name,
          student_id: s.id,
          department_id: s.department_id,
          phone: s.phone,
          student: s,
        });
      }
    });

    return Array.from(profileMap.values());
  }

  // Attendance Management
  public getAttendanceSessions(): AttendanceSession[] {
    const sessions = loadFromStorage<AttendanceSession[]>(STORAGE_KEYS.ATT_SESSIONS, []);
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
    const records = loadFromStorage<AttendanceRecord[]>(STORAGE_KEYS.ATT_RECORDS, []);
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
    const corrections = loadFromStorage<AttendanceCorrection[]>(STORAGE_KEYS.CORRECTIONS, []);
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
    return loadFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, [])
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

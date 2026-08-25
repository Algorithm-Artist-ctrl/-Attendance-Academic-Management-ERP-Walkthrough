import { useMemo } from 'react';
import { useAcademic, TodayAttendanceLecture } from '../context/AcademicContext';
import { useAuth } from '../context/AuthContext';
import { 
  Student, 
  Faculty, 
  TimetableEntry, 
  Subject, 
  Section, 
  AttendanceRecord,
  Quiz,
  Assignment,
  SessionalMark,
  SessionalAssessment
} from '../types/database.types';
import { TodayLectureItem } from '../types/academic.types';
import { getISTTodayDate, getISTDayOfWeek } from '../lib/utils/dateUtils';

/**
 * High-performance hook for Student Portal data
 * Authoritative, section-aware, and memoized to prevent redundant renders
 */
export function useStudent(overrideStudentId?: string) {
  const { user } = useAuth();
  const academic = useAcademic();

  const studentId = overrideStudentId || user?.student?.id || user?.id;

  const student = useMemo<Student | undefined>(() => {
    if (!studentId) return undefined;
    return academic.students.find(s => s.id === studentId);
  }, [academic.students, studentId]);

  const section = useMemo<Section | undefined>(() => {
    if (!student) return undefined;
    return academic.sections.find(sec => sec.id === student.section_id);
  }, [academic.sections, student]);

  const activeTimetable = useMemo<TimetableEntry[]>(() => {
    if (!student?.section_id) return [];
    return academic.timetable.filter(t => t.section_id === student.section_id && t.active);
  }, [academic.timetable, student?.section_id]);

  const todayLectures = useMemo<TodayAttendanceLecture[]>(() => {
    if (!studentId) return [];
    const todayStr = getISTTodayDate();
    return academic.getTodayLecturesForStudent(studentId, todayStr);
  }, [academic, studentId]);

  const attendanceRecords = useMemo<AttendanceRecord[]>(() => {
    if (!studentId) return [];
    return academic.attendanceRecords.filter(r => r.student_id === studentId);
  }, [academic.attendanceRecords, studentId]);

  const enrolledSubjects = useMemo<Subject[]>(() => {
    if (!student) return [];
    return academic.subjects.filter(
      s => s.department_id === student.department_id || s.program_id === student.program_id
    );
  }, [academic.subjects, student]);

  return {
    student,
    section,
    enrolledSubjects,
    activeTimetable,
    todayLectures,
    attendanceRecords,
    isLoading: academic.isLoading,
  };
}

/**
 * High-performance hook for Faculty & Coordinator data
 * Scoped strictly to faculty's workload and authorized sections
 */
export function useFaculty(overrideFacultyId?: string) {
  const { user } = useAuth();
  const academic = useAcademic();

  const facultyId = overrideFacultyId || user?.faculty?.id || user?.id;

  const faculty = useMemo<Faculty | undefined>(() => {
    if (!facultyId) return undefined;
    return academic.faculty.find(f => f.id === facultyId);
  }, [academic.faculty, facultyId]);

  const assignments = useMemo(() => {
    if (!facultyId) return [];
    return academic.assignments.filter(a => a.faculty_id === facultyId);
  }, [academic.assignments, facultyId]);

  const assignedSubjects = useMemo<Subject[]>(() => {
    if (!facultyId) return [];
    const subjectIds = new Set(assignments.map(a => a.subject_id));
    return academic.subjects.filter(s => subjectIds.has(s.id));
  }, [academic.subjects, assignments, facultyId]);

  const assignedSections = useMemo<Section[]>(() => {
    if (!facultyId) return [];
    const sectionIds = new Set(assignments.map(a => a.section_id));
    return academic.sections.filter(sec => sectionIds.has(sec.id));
  }, [academic.sections, assignments, facultyId]);

  const activeTimetable = useMemo<TimetableEntry[]>(() => {
    if (!facultyId) return [];
    return academic.timetable.filter(t => t.faculty_id === facultyId && t.active);
  }, [academic.timetable, facultyId]);

  const todayLectures = useMemo<TodayLectureItem[]>(() => {
    if (!facultyId) return [];
    const todayStr = getISTTodayDate();
    const dayOfWeek = getISTDayOfWeek();
    return academic.getTodaySchedule({ dayOfWeek, facultyId, dateStr: todayStr });
  }, [academic, facultyId]);

  const coordinatedSection = useMemo<Section | undefined>(() => {
    if (!facultyId) return undefined;
    return academic.sections.find(sec => sec.class_coordinator_id === facultyId);
  }, [academic.sections, facultyId]);

  return {
    faculty,
    assignments,
    assignedSubjects,
    assignedSections,
    activeTimetable,
    todayLectures,
    isCoordinator: Boolean(coordinatedSection),
    coordinatedSection,
    isLoading: academic.isLoading,
  };
}

/**
 * High-performance hook for Section Timetable
 */
export function useTimetable(targetSectionId?: string) {
  const academic = useAcademic();

  const sectionTimetable = useMemo<TimetableEntry[]>(() => {
    if (!targetSectionId) return academic.timetable.filter(t => t.active);
    return academic.timetable.filter(t => t.section_id === targetSectionId && t.active);
  }, [academic.timetable, targetSectionId]);

  return {
    timetable: academic.timetable,
    sectionTimetable,
    refreshTimetable: academic.refreshData,
    isLoading: academic.isLoading,
  };
}

/**
 * High-performance hook for Assessments & Marks
 */
export function useAssessments(sectionId?: string, subjectId?: string) {
  const academic = useAcademic();

  const filteredQuizzes = useMemo<Quiz[]>(() => {
    let list = academic.quizzes;
    if (sectionId) list = list.filter(q => q.section_id === sectionId);
    if (subjectId) list = list.filter(q => q.subject_id === subjectId);
    return list;
  }, [academic.quizzes, sectionId, subjectId]);

  const filteredAssignments = useMemo<Assignment[]>(() => {
    let list = academic.courseAssignments;
    if (sectionId) list = list.filter(a => a.section_id === sectionId);
    if (subjectId) list = list.filter(a => a.subject_id === subjectId);
    return list;
  }, [academic.courseAssignments, sectionId, subjectId]);

  const filteredSessionalMarks = useMemo<SessionalMark[]>(() => {
    let list = academic.sessionalMarks;
    if (sectionId) list = list.filter(sm => sm.section_id === sectionId);
    if (subjectId) list = list.filter(sm => sm.subject_id === subjectId);
    return list;
  }, [academic.sessionalMarks, sectionId, subjectId]);

  const filteredAssessments = useMemo<SessionalAssessment[]>(() => {
    let list = academic.sessionalAssessments;
    if (sectionId) list = list.filter(sa => sa.section_id === sectionId);
    if (subjectId) list = list.filter(sa => sa.subject_id === subjectId);
    return list;
  }, [academic.sessionalAssessments, sectionId, subjectId]);

  return {
    quizzes: filteredQuizzes,
    assignments: filteredAssignments,
    sessionalMarks: filteredSessionalMarks,
    sessionalAssessments: filteredAssessments,
    isLoading: academic.isLoading,
  };
}

import { 
  AcademicYear, 
  Semester, 
  Section, 
  Subject, 
  TimetableEntry, 
  FacultySubjectAssignment,
  Faculty
} from '../../types/database.types';

export interface FacultyResolvedAssignment {
  facultyId: string;
  facultyName: string;
  academicYearId: string;
  academicYearName: string;
  academicYearNumber: number;
  semesterId: string;
  semesterName: string;
  semesterNumber: number;
  sectionId: string;
  sectionName: string;
  cleanSectionName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  roomNumber: string;
  source: 'timetable' | 'faculty_subject_assignment' | 'both';
  section?: Section;
  subject?: Subject;
  semester?: Semester;
  academicYear?: AcademicYear;
}

export interface FacultyTeachingScope {
  facultyId: string;
  assignedYears: AcademicYear[];
  assignedSemesters: Semester[];
  assignedSections: Section[];
  assignedSubjects: Subject[];
  allAssignments: FacultyResolvedAssignment[];
  isSuperAdminOrHOD: boolean;
}

export interface FacultyAssignmentResolverContext {
  timetable: TimetableEntry[];
  facultySubjectAssignments: FacultySubjectAssignment[];
  sections: Section[];
  subjects: Subject[];
  semesters: Semester[];
  years: AcademicYear[];
  faculty?: Faculty[];
  isSuperAdminOrHOD?: boolean;
}

/**
 * Normalizes section names: "Section A" -> "A", "A" -> "A"
 */
export function cleanSectionName(name?: string): string {
  if (!name) return '';
  return name.replace(/^section\s*/i, '').trim() || name;
}

/**
 * Normalizes room numbers: "Room A007" -> "A007", "Room No. A-301" -> "A-301"
 */
export function cleanRoomNumber(room?: string): string {
  if (!room) return 'Room TBD';
  const cleaned = room.replace(/^Room\s*(No\.?\s*)?/i, '').trim();
  return cleaned || 'Room TBD';
}

/**
 * Resolves all distinct sections for a selected Academic Year from this faculty's assignments.
 */
export function getAssignedSectionsForYear(
  assignments: FacultyResolvedAssignment[],
  allSections: Section[],
  selectedYearId?: string
): Section[] {
  if (!selectedYearId) {
    const sectionIds = new Set(assignments.map(a => a.sectionId));
    return allSections
      .filter(s => sectionIds.has(s.id) && s.active !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  const matchingSectionIds = new Set(
    assignments
      .filter(a => a.academicYearId === selectedYearId)
      .map(a => a.sectionId)
  );

  return allSections
    .filter(s => matchingSectionIds.has(s.id) && s.active !== false)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Resolves all distinct subjects for a selected Section (and optional Academic Year) from this faculty's assignments.
 */
export function getAssignedSubjectsForSection(
  assignments: FacultyResolvedAssignment[],
  allSubjects: Subject[],
  selectedSectionId?: string,
  selectedYearId?: string
): Subject[] {
  if (!selectedSectionId) {
    const subjectIds = new Set(
      assignments
        .filter(a => !selectedYearId || a.academicYearId === selectedYearId)
        .map(a => a.subjectId)
    );
    return allSubjects
      .filter(s => subjectIds.has(s.id) && s.active !== false)
      .sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || ''));
  }

  const matchingSubjectIds = new Set(
    assignments
      .filter(a => 
        a.sectionId === selectedSectionId && 
        (!selectedYearId || a.academicYearId === selectedYearId)
      )
      .map(a => a.subjectId)
  );

  return allSubjects
    .filter(s => matchingSubjectIds.has(s.id) && s.active !== false)
    .sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || ''));
}

/**
 * Authoritative single resolver for any faculty member's teaching scope.
 * 
 * Unions both `timetable_entries` and `faculty_subject_assignments`,
 * dynamically resolving:
 *   Faculty -> Assigned Years -> Assigned Sections -> Assigned Subjects
 * 
 * Strictly preserves multi-tenant isolation. Faculty A never sees Faculty B's classes.
 */
export function resolveFacultyTeachingScope(
  facultyId: string,
  context: FacultyAssignmentResolverContext
): FacultyTeachingScope {
  const {
    timetable = [],
    facultySubjectAssignments = [],
    sections = [],
    subjects = [],
    semesters = [],
    years = [],
    faculty = [],
    isSuperAdminOrHOD = false,
  } = context;

  const currentFaculty = faculty.find(f => f.id === facultyId);
  const facultyName = currentFaculty?.full_name || 'Faculty Member';

  // If super admin / HOD in global oversight mode (no specific faculty context selected)
  if (isSuperAdminOrHOD && !facultyId) {
    const activeYears = years.filter(y => y.active !== false).sort((a, b) => a.year_number - b.year_number);
    const activeSemesters = semesters.filter(s => s.active !== false).sort((a, b) => a.semester_number - b.semester_number);
    const activeSections = sections.filter(s => s.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const activeSubjects = subjects.filter(s => s.active !== false).sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || ''));

    return {
      facultyId: '',
      assignedYears: activeYears,
      assignedSemesters: activeSemesters,
      assignedSections: activeSections,
      assignedSubjects: activeSubjects,
      allAssignments: [],
      isSuperAdminOrHOD: true,
    };
  }

  if (!facultyId) {
    return {
      facultyId: '',
      assignedYears: [],
      assignedSemesters: [],
      assignedSections: [],
      assignedSubjects: [],
      allAssignments: [],
      isSuperAdminOrHOD: Boolean(isSuperAdminOrHOD),
    };
  }

  // Keyed map for unique (section_id + subject_id) pairs
  const assignmentMap = new Map<string, FacultyResolvedAssignment>();

  // Helper to resolve Semester & AcademicYear
  const resolveHierarchy = (sectionId: string, subjectId: string, rawSemesterId?: string, rawYearId?: string) => {
    const sec = sections.find(s => s.id === sectionId);
    const sub = subjects.find(s => s.id === subjectId);

    const semId = rawSemesterId || sec?.semester_id || sub?.semester_id || '';
    let sem = semesters.find(s => s.id === semId);

    const yrId = rawYearId || sem?.academic_year_id || '';
    let yr = years.find(y => y.id === yrId);

    // Fallback: If yr not resolved directly, resolve via matched semester or section's semester
    const semYearId = sem?.academic_year_id;
    if (!yr && semYearId) {
      yr = years.find(y => y.id === semYearId);
    }
    if (!yr && sec?.semester_id) {
      const secSem = semesters.find(s => s.id === sec.semester_id);
      if (secSem) {
        sem = sem || secSem;
        yr = years.find(y => y.id === secSem.academic_year_id);
      }
    }

    return { sec, sub, sem, yr };
  };

  // 1. Process Timetable Entries for this faculty (matches both direct faculty_id and nested faculty.id)
  const facultyTimetable = timetable.filter(
    t => (t.faculty_id === facultyId || t.faculty?.id === facultyId) && 
         t.active !== false && 
         !t.is_break && 
         Boolean(t.subject_id) && 
         Boolean(t.section_id)
  );

  for (const entry of facultyTimetable) {
    const sectionId = entry.section_id;
    const subjectId = entry.subject_id!;
    const key = `${sectionId}__${subjectId}`;

    const { sec, sub, sem, yr } = resolveHierarchy(sectionId, subjectId);
    if (!sec || sec.active === false || !sub || sub.active === false) {
      continue;
    }

    const roomNumber = entry.room_number || sec.room_number || 'Room TBD';

    assignmentMap.set(key, {
      facultyId,
      facultyName,
      academicYearId: yr?.id || '',
      academicYearName: yr?.name || 'Academic Year',
      academicYearNumber: yr?.year_number ?? 0,
      semesterId: sem?.id || '',
      semesterName: sem?.name || 'Semester',
      semesterNumber: sem?.semester_number ?? 0,
      sectionId,
      sectionName: sec.name || 'Section',
      cleanSectionName: cleanSectionName(sec.name),
      subjectId,
      subjectCode: sub.subject_code,
      subjectName: sub.subject_name,
      roomNumber: cleanRoomNumber(roomNumber),
      source: 'timetable',
      section: sec,
      subject: sub,
      semester: sem,
      academicYear: yr,
    });
  }

  // 2. Process Faculty Subject Assignments (FSA) for this faculty
  const fsaList = facultySubjectAssignments.filter(
    fsa => (fsa.faculty_id === facultyId || fsa.faculty?.id === facultyId) && 
           fsa.active !== false && 
           Boolean(fsa.subject_id) && 
           Boolean(fsa.section_id)
  );

  for (const fsa of fsaList) {
    const sectionId = fsa.section_id;
    const subjectId = fsa.subject_id;
    const key = `${sectionId}__${subjectId}`;

    const existing = assignmentMap.get(key);
    if (existing) {
      existing.source = 'both';
      continue;
    }

    const { sec, sub, sem, yr } = resolveHierarchy(sectionId, subjectId, fsa.semester_id, fsa.academic_year_id);
    if (!sec || sec.active === false || !sub || sub.active === false) {
      continue;
    }

    const roomNumber = sec.room_number || 'Room TBD';

    assignmentMap.set(key, {
      facultyId,
      facultyName,
      academicYearId: yr?.id || '',
      academicYearName: yr?.name || 'Academic Year',
      academicYearNumber: yr?.year_number ?? 0,
      semesterId: sem?.id || '',
      semesterName: sem?.name || 'Semester',
      semesterNumber: sem?.semester_number ?? 0,
      sectionId,
      sectionName: sec.name || 'Section',
      cleanSectionName: cleanSectionName(sec.name),
      subjectId,
      subjectCode: sub.subject_code,
      subjectName: sub.subject_name,
      roomNumber: cleanRoomNumber(roomNumber),
      source: 'faculty_subject_assignment',
      section: sec,
      subject: sub,
      semester: sem,
      academicYear: yr,
    });
  }

  const allAssignments = Array.from(assignmentMap.values());

  // 3. Extract distinct Academic Years (sorted by year_number ASC, e.g. 1st, 2nd, 3rd, 4th Year)
  const assignedYearIds = new Set(allAssignments.map(a => a.academicYearId).filter(Boolean));
  let assignedYears = years
    .filter(y => assignedYearIds.has(y.id) && y.active !== false)
    .sort((a, b) => a.year_number - b.year_number);

  // Fallback: If assignedYears is empty but assignments exist, derive years from assigned semesters
  if (assignedYears.length === 0 && allAssignments.length > 0) {
    const assignedSemIds = new Set(allAssignments.map(a => a.semesterId).filter(Boolean));
    const matchedSemesters = semesters.filter(s => assignedSemIds.has(s.id));
    const yearIdsFromSems = new Set(matchedSemesters.map(s => s.academic_year_id).filter(Boolean));
    assignedYears = years
      .filter(y => yearIdsFromSems.has(y.id) && y.active !== false)
      .sort((a, b) => a.year_number - b.year_number);
  }

  // 4. Extract distinct Semesters
  const assignedSemesterIds = new Set(allAssignments.map(a => a.semesterId).filter(Boolean));
  const assignedSemesters = semesters
    .filter(s => assignedSemesterIds.has(s.id) && s.active !== false)
    .sort((a, b) => a.semester_number - b.semester_number);

  // 5. Extract distinct Sections
  const assignedSectionIds = new Set(allAssignments.map(a => a.sectionId).filter(Boolean));
  const assignedSections = sections
    .filter(s => assignedSectionIds.has(s.id) && s.active !== false)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // 6. Extract distinct Subjects
  const assignedSubjectIds = new Set(allAssignments.map(a => a.subjectId).filter(Boolean));
  const assignedSubjects = subjects
    .filter(s => assignedSubjectIds.has(s.id) && s.active !== false)
    .sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || ''));

  return {
    facultyId,
    assignedYears,
    assignedSemesters,
    assignedSections,
    assignedSubjects,
    allAssignments,
    isSuperAdminOrHOD: Boolean(isSuperAdminOrHOD),
  };
}

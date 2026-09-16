import { 
  ExtractedTimetableDocument, 
  ExtractedTimetablePeriod,
  TimetableSlotDiff,
  TimetableConflict,
  ExtractedSubjectMapping,
  ExtractedFacultyMapping
} from '../../types/academic.types';
import { 
  Department, 
  Program, 
  AcademicYear, 
  Semester, 
  Section, 
  Subject, 
  Faculty, 
  TimetableEntry, 
  DayOfWeek, 
  LectureType 
} from '../../types/database.types';

export interface ResolvedEntityReport {
  department?: Department;
  program?: Program;
  academicYear?: AcademicYear;
  semester?: Semester;
  section?: Section;
  isNewSection: boolean;
  classCoordinator?: Faculty;
  subjectMatches: Array<{
    extracted: ExtractedSubjectMapping;
    matchedSubject?: Subject;
    isNew: boolean;
  }>;
  facultyMatches: Array<{
    extracted: ExtractedFacultyMapping;
    matchedFaculty?: Faculty;
    isNew: boolean;
  }>;
  conflicts: TimetableConflict[];
  diffs: TimetableSlotDiff[];
  stats: {
    totalSlots: number;
    newCount: number;
    changedCount: number;
    unchangedCount: number;
    removedCount: number;
    conflictCount: number;
  };
}

export class TimetableResolver {
  /**
   * Resolves raw extracted AI document against live Supabase database entities
   */
  public static resolveDocument(
    doc: ExtractedTimetableDocument,
    context: {
      departments: Department[];
      programs: Program[];
      years: AcademicYear[];
      semesters: Semester[];
      sections: Section[];
      subjects: Subject[];
      faculty: Faculty[];
      existingTimetable: TimetableEntry[];
    }
  ): ResolvedEntityReport {
    const { departments, programs, years, semesters, sections, subjects, faculty, existingTimetable } = context;

    // 1. Resolve Department
    const deptClean = (doc.branch_name || doc.institution_name || '').toLowerCase();
    const department = departments.find(d => 
      deptClean.includes(d.code.toLowerCase()) || 
      deptClean.includes(d.name.toLowerCase()) ||
      d.name.toLowerCase().includes('computer science')
    ) || departments[0];

    // 2. Resolve Program
    const progClean = (doc.program_name || '').toLowerCase();
    const program = programs.find(p => 
      progClean.includes(p.code.toLowerCase()) || 
      progClean.includes(p.name.toLowerCase())
    ) || programs[0];

    // 3. Resolve Academic Year
    const yearClean = (doc.academic_year || '').toLowerCase();
    const academicYear = years.find(y => 
      yearClean.includes(y.name.toLowerCase()) ||
      (yearClean.includes('2') && y.year_number === 2) ||
      (yearClean.includes('second') && y.year_number === 2) ||
      (yearClean.includes('3') && y.year_number === 3) ||
      (yearClean.includes('third') && y.year_number === 3) ||
      (yearClean.includes('4') && y.year_number === 4) ||
      (yearClean.includes('1') && y.year_number === 1)
    ) || years.find(y => y.year_number === 2) || years[0];

    // 4. Resolve Semester
    const semClean = (doc.semester || '').toLowerCase();
    const semester = semesters.find(s => 
      semClean.includes(s.name.toLowerCase()) ||
      (semClean.includes('3') && s.semester_number === 3) ||
      (semClean.includes('third') && s.semester_number === 3) ||
      (semClean.includes('odd') && s.semester_number % 2 !== 0)
    ) || semesters[0];

    // 5. Resolve Section (Strictly hierarchically scoped by semester and year)
    let section: Section | undefined;
    if (doc.target_section_id) {
      section = sections.find(s => s.id === doc.target_section_id);
    }
    if (!section && doc.section_name) {
      const secClean = doc.section_name.toUpperCase().replace(/SECTION/g, '').trim();
      // Primary match: within the resolved semester and active
      if (semester?.id) {
        section = sections.find(s => 
          s.semester_id === semester.id &&
          s.name.toUpperCase().trim() === secClean &&
          s.active !== false
        ) || sections.find(s => 
          s.semester_id === semester.id &&
          s.name.toUpperCase().trim() === secClean
        );
      }
      // Secondary match: within the resolved academic year's semesters
      if (!section && academicYear?.id) {
        const semIdsInYear = new Set(semesters.filter(sem => sem.academic_year_id === academicYear.id).map(sem => sem.id));
        section = sections.find(s => 
          semIdsInYear.has(s.semester_id) &&
          s.name.toUpperCase().trim() === secClean &&
          s.active !== false
        ) || sections.find(s => 
          semIdsInYear.has(s.semester_id) &&
          s.name.toUpperCase().trim() === secClean
        );
      }
      // Tertiary fallback only if no semester or year matches exist
      if (!section) {
        section = sections.find(s => s.name.toUpperCase().trim() === secClean && s.active !== false) ||
                  sections.find(s => s.name.toUpperCase().trim() === secClean);
      }
    }
    const isNewSection = !section;

    // 6. Resolve Class Coordinator
    const inchargeStr = (doc.class_incharges && doc.class_incharges[0]) ? doc.class_incharges[0].toLowerCase() : '';
    const classCoordinator = faculty.find(f => 
      inchargeStr.includes(f.full_name.toLowerCase()) ||
      f.full_name.toLowerCase().includes(inchargeStr.replace(/mr\.|ms\.|dr\.|prof\./g, '').trim())
    );

    const findMatchingSubject = (codeOrName: string): Subject | undefined => {
      if (!codeOrName) return undefined;
      const clean = codeOrName.toUpperCase().replace(/[\s\-_.]/g, '');
      const cleanLower = codeOrName.toLowerCase().trim();

      // 1. Exact or sanitized match on subject_code
      const byCode = subjects.find(s => {
        const sCode = s.subject_code.toUpperCase().replace(/[\s\-_.]/g, '');
        return sCode === clean;
      });
      if (byCode) return byCode;

      // 2. Check parenthesized acronym in subject_name: e.g. "Data Structure (DS)" -> "DS"
      const byParen = subjects.find(s => {
        const matches = s.subject_name.match(/\(([^)]+)\)/g);
        if (matches) {
          for (const m of matches) {
            const inner = m.replace(/[()]/g, '').trim().toUpperCase().replace(/[\s\-_.]/g, '');
            if (inner === clean) return true;
          }
        }
        return false;
      });
      if (byParen) return byParen;

      // 3. Name match
      const byName = subjects.find(s => {
        const sNameClean = s.subject_name.toLowerCase().replace(/[\s\-_.]/g, '');
        return sNameClean === cleanLower.replace(/[\s\-_.]/g, '') || s.subject_name.toLowerCase().includes(cleanLower);
      });
      if (byName) return byName;

      return undefined;
    };

    const findMatchingFaculty = (codeOrName: string): Faculty | undefined => {
      if (!codeOrName) return undefined;
      const cleanCode = codeOrName.toUpperCase().trim();
      const cleanCodeNoPunct = cleanCode.replace(/[\s\-_.]/g, '');
      const cleanName = codeOrName.toLowerCase().replace(/^(?:mr\.|ms\.|mrs\.|dr\.|prof\.)\s*/i, '').trim();

      return faculty.find(f => {
        if (f.faculty_code && f.faculty_code.toUpperCase().trim() === cleanCode) return true;
        if (f.employee_code && f.employee_code.toUpperCase().trim() === cleanCode) return true;
        if (f.employee_code && f.employee_code.toUpperCase().replace(/[\s\-_.]/g, '') === cleanCodeNoPunct) return true;

        const fClean = f.full_name.toLowerCase().replace(/^(?:mr\.|ms\.|mrs\.|dr\.|prof\.)\s*/i, '').trim();
        if (fClean === cleanName || fClean.includes(cleanName) || cleanName.includes(fClean)) return true;

        // Dynamic initials from full name words (e.g. "Hemlata Chaudhry" -> "HC")
        const words = fClean.split(/\s+/).filter(Boolean);
        const initials = words.map(w => w[0]).join('').toUpperCase();
        if (initials === cleanCode) return true;

        // Dynamic code prefix (e.g. "HEM" -> "Hemlata" starts with "hem")
        if (cleanCode.length >= 3 && words[0]?.toUpperCase().startsWith(cleanCode)) return true;

        return false;
      });
    };

    // 7. Match Subject mappings
    const subjectMatches = (doc.subject_mappings || []).map(sm => {
      const matchedSubject = findMatchingSubject(sm.subject_code) || findMatchingSubject(sm.subject_name);
      return {
        extracted: sm,
        matchedSubject,
        isNew: !matchedSubject
      };
    });

    // 8. Match Faculty mappings
    const facultyMatches = (doc.faculty_mappings || []).map(fm => {
      const matchedFaculty = findMatchingFaculty(fm.faculty_code) || findMatchingFaculty(fm.faculty_name);
      return {
        extracted: fm,
        matchedFaculty,
        isNew: !matchedFaculty
      };
    });

    // 9. Compute Diffs and Detect Conflicts
    const targetSectionId = section?.id || doc.target_section_id;
    const sectionTimetable = targetSectionId 
      ? existingTimetable.filter(t => t.section_id === targetSectionId && t.active)
      : [];

    const diffs: TimetableSlotDiff[] = [];
    const conflicts: TimetableConflict[] = [];

    const allDays: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (const day of allDays) {
      const extractedDay = doc.schedule?.find(s => s.day === day);
      const dayPeriods = extractedDay?.periods || [];

      // Loop through standard 1-8 periods
      const allPeriodNums = Array.from(new Set([
        ...dayPeriods.map(p => p.period_number),
        ...sectionTimetable.filter(t => t.day_of_week === day).map(t => t.period_number),
        1, 2, 3, 4, 6, 7, 8
      ])).sort((a, b) => a - b);

      for (const pNum of allPeriodNums) {
        if (pNum === 5) continue; // Lunch period

        const oldSlot = sectionTimetable.find(t => t.day_of_week === day && t.period_number === pNum);
        const newSlot = dayPeriods.find(p => p.period_number === pNum && !p.is_break);

        if (!oldSlot && !newSlot) continue;

        // Resolve subject & faculty for new slot accurately
        let resolvedSub: Subject | undefined;
        let resolvedFac: Faculty | undefined;

        if (newSlot) {
          resolvedSub = findMatchingSubject(newSlot.subject_code) || 
                        (newSlot.subject_name ? findMatchingSubject(newSlot.subject_name) : undefined);

          resolvedFac = findMatchingFaculty(newSlot.faculty_code || '') || 
                        (newSlot.faculty_name ? findMatchingFaculty(newSlot.faculty_name) : undefined);
        }

        // Helper: Time Interval Overlap (startA < endB && endA > startB)
        const toMinutes = (timeStr?: string): number => {
          if (!timeStr) return 0;
          const parts = timeStr.trim().split(':').map(Number);
          return (parts[0] || 0) * 60 + (parts[1] || 0);
        };

        const doTimeOverlap = (sA?: string, eA?: string, sB?: string, eB?: string): boolean => {
          if (!sA || !eA || !sB || !eB) return false;
          const startA = toMinutes(sA);
          const endA = toMinutes(eA);
          const startB = toMinutes(sB);
          const endB = toMinutes(eB);
          return startA < endB && endA > startB;
        };

        const slotStart = newSlot?.start_time || '09:00';
        const slotEnd = newSlot?.end_time || '09:50';
        const targetSecName = section?.name || doc.section_name || 'Target Section';

        // Check Conflicts for new slot against other sections
        let slotConflict: TimetableConflict | undefined;

        // A. FACULTY CONFLICT: Same faculty + same day + overlapping time + active in another section
        if (newSlot && resolvedFac) {
          const facultyOverlap = existingTimetable.find(t => {
            if (t.faculty_id !== resolvedFac?.id || t.day_of_week !== day || !t.active) return false;
            if (t.section_id === targetSectionId) return false; // Exclude own section being replaced

            const existStart = t.start_time?.substring(0, 5) || '09:00';
            const existEnd = t.end_time?.substring(0, 5) || '09:50';

            return doTimeOverlap(slotStart, slotEnd, existStart, existEnd);
          });

          if (facultyOverlap) {
            const conflictSecName = sections.find(s => s.id === facultyOverlap.section_id)?.name || facultyOverlap.section?.name || 'another section';
            const existStart = facultyOverlap.start_time?.substring(0, 5) || '09:00';
            const existEnd = facultyOverlap.end_time?.substring(0, 5) || '09:50';

            slotConflict = {
              type: 'faculty',
              severity: 'warning',
              targetSectionName: targetSecName,
              conflictSourceName: conflictSecName,
              message: `Cross-section faculty overlap: ${resolvedFac.full_name} (${resolvedFac.faculty_code || 'FAC'}) is assigned to Section ${conflictSecName} on ${day} ${existStart}–${existEnd} and Target Section ${targetSecName} on ${day} ${slotStart}–${slotEnd} in Room ${facultyOverlap.room_number || 'Room'}.`,
              conflictingEntry: facultyOverlap
            };
            conflicts.push(slotConflict);
          }
        }

        // B. ROOM CONFLICT: Same room + same day + overlapping time + active in another section
        if (newSlot && (newSlot.room_number || doc.room_number)) {
          const roomToTest = (newSlot.room_number || doc.room_number).toUpperCase().replace(/ROOM/g, '').trim();
          const roomOverlap = existingTimetable.find(t => {
            if (t.section_id === targetSectionId || !t.active || t.day_of_week !== day) return false;
            const tRoom = (t.room_number || '').toUpperCase().replace(/ROOM/g, '').trim();
            if (tRoom !== roomToTest) return false;

            const existStart = t.start_time?.substring(0, 5) || '09:00';
            const existEnd = t.end_time?.substring(0, 5) || '09:50';

            return doTimeOverlap(slotStart, slotEnd, existStart, existEnd);
          });

          if (roomOverlap && !slotConflict) {
            const conflictSecName = sections.find(s => s.id === roomOverlap.section_id)?.name || roomOverlap.section?.name || 'another section';
            const existStart = roomOverlap.start_time?.substring(0, 5) || '09:00';
            const existEnd = roomOverlap.end_time?.substring(0, 5) || '09:50';

            slotConflict = {
              type: 'room',
              severity: 'warning',
              targetSectionName: targetSecName,
              conflictSourceName: conflictSecName,
              message: `Room overlap: Room ${roomToTest} is already occupied by Section ${conflictSecName} on ${day} ${existStart}–${existEnd}.`,
              conflictingEntry: roomOverlap
            };
            conflicts.push(slotConflict);
          }
        }

        // C. SAME-SECTION CONFLICT: Overlapping simultaneous classes in this same section
        if (newSlot && !slotConflict) {
          const sameSecOverlap = dayPeriods.find(other => 
            other !== newSlot &&
            !other.is_break &&
            doTimeOverlap(slotStart, slotEnd, other.start_time, other.end_time)
          );

          if (sameSecOverlap) {
            slotConflict = {
              type: 'section',
              severity: 'blocking',
              targetSectionName: targetSecName,
              message: `Section scheduling collision: Section ${targetSecName} has multiple simultaneous classes on ${day} ${slotStart}–${slotEnd} (${newSlot.subject_code} and ${sameSecOverlap.subject_code}).`,
            };
            conflicts.push(slotConflict);
          }
        }

        // Determine Diff Classification
        let status: 'NEW' | 'CHANGED' | 'REMOVED' | 'UNCHANGED' = 'UNCHANGED';
        const changes: string[] = [];

        if (!oldSlot && newSlot) {
          status = 'NEW';
          changes.push(`New class scheduled: ${newSlot.subject_code} (${newSlot.faculty_code || 'Faculty'})`);
        } else if (oldSlot && !newSlot) {
          status = 'REMOVED';
          changes.push(`Class removed from timetable (was ${oldSlot.subject?.subject_code || 'Subject'})`);
        } else if (oldSlot && newSlot) {
          const oldSubCode = oldSlot.subject?.subject_code?.toUpperCase();
          const newSubCode = (resolvedSub?.subject_code || newSlot.subject_code).toUpperCase();
          if (oldSubCode !== newSubCode) {
            changes.push(`Subject: ${oldSlot.subject?.subject_code || 'Old'} → ${newSubCode}`);
          }

          const oldFacId = oldSlot.faculty_id;
          const newFacId = resolvedFac?.id;
          if (oldFacId !== newFacId) {
            changes.push(`Faculty: ${oldSlot.faculty?.full_name || 'Old Faculty'} → ${resolvedFac?.full_name || newSlot.faculty_name || newSlot.faculty_code}`);
          }

          const oldRoom = (oldSlot.room_number || '').trim();
          const newRoom = (newSlot.room_number || doc.room_number || '').trim();
          if (oldRoom && newRoom && oldRoom !== newRoom) {
            changes.push(`Room: ${oldRoom} → ${newRoom}`);
          }

          status = changes.length > 0 ? 'CHANGED' : 'UNCHANGED';
        }

        diffs.push({
          day_of_week: day,
          period_number: pNum,
          start_time: newSlot?.start_time || oldSlot?.start_time || '09:00',
          end_time: newSlot?.end_time || oldSlot?.end_time || '09:50',
          status,
          old_entry: oldSlot,
          new_entry: {
            ...newSlot,
            resolvedSubject: resolvedSub,
            resolvedFaculty: resolvedFac,
            room_number: newSlot?.room_number || doc.room_number || oldSlot?.room_number || `Room ${doc.section_name || ''}`
          },
          changes,
          conflict: slotConflict
        });
      }
    }

    const newCount = diffs.filter(d => d.status === 'NEW').length;
    const changedCount = diffs.filter(d => d.status === 'CHANGED').length;
    const unchangedCount = diffs.filter(d => d.status === 'UNCHANGED').length;
    const removedCount = diffs.filter(d => d.status === 'REMOVED').length;

    return {
      department,
      program,
      academicYear,
      semester,
      section,
      isNewSection,
      classCoordinator,
      subjectMatches,
      facultyMatches,
      conflicts,
      diffs,
      stats: {
        totalSlots: diffs.length,
        newCount,
        changedCount,
        unchangedCount,
        removedCount,
        conflictCount: conflicts.length
      }
    };
  }
}

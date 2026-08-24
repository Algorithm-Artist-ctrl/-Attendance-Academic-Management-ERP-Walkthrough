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

    // 5. Resolve Section
    const secClean = (doc.section_name || 'A').toUpperCase().replace(/SECTION/g, '').trim();
    let section = sections.find(s => 
      s.name.toUpperCase().trim() === secClean ||
      (s.semester_id === semester?.id && s.name.toUpperCase().trim() === secClean)
    );
    const isNewSection = !section;

    // 6. Resolve Class Coordinator
    const inchargeStr = (doc.class_incharges && doc.class_incharges[0]) ? doc.class_incharges[0].toLowerCase() : '';
    const classCoordinator = faculty.find(f => 
      inchargeStr.includes(f.full_name.toLowerCase()) ||
      f.full_name.toLowerCase().includes(inchargeStr.replace(/mr\.|ms\.|dr\.|prof\./g, '').trim())
    );

    const findMatchingSubject = (codeOrName: string): Subject | undefined => {
      if (!codeOrName) return undefined;
      const clean = codeOrName.toUpperCase().replace(/[\s\-_]/g, '');
      const cleanLower = codeOrName.toLowerCase().trim();

      return subjects.find(s => {
        const sCode = s.subject_code.toUpperCase().replace(/[\s\-_]/g, '');
        if (sCode === clean) return true;
        if (clean === 'DS' && sCode === 'BCS301') return true;
        if (clean === 'COA' && sCode === 'BCS302') return true;
        if (clean === 'DSTL' && sCode === 'BCS303') return true;
        if ((clean === 'M4' || clean === 'MATHS4' || clean === 'MATHSIV') && sCode === 'BAS303') return true;
        if (clean === 'UHV' && sCode === 'BVE301') return true;
        if (clean === 'DSLAB' && sCode === 'BCS351') return true;
        if (clean === 'COALAB' && sCode === 'BCS352') return true;
        if (clean === 'DSTLLAB' && sCode === 'BCS353') return true;
        if ((clean === 'CS' || clean === 'CYBER' || clean === 'CYBERSECURITY') && sCode === 'BCC301') return true;
        if ((clean === 'CSLAB' || clean === 'CYBERLAB') && sCode === 'BCC351') return true;
        
        const sNameLower = s.subject_name.toLowerCase();
        if (sNameLower.includes(cleanLower) || cleanLower.includes(sNameLower)) return true;
        return false;
      });
    };

    const findMatchingFaculty = (codeOrName: string): Faculty | undefined => {
      if (!codeOrName) return undefined;
      const cleanCode = codeOrName.toUpperCase().trim();
      const cleanName = codeOrName.toLowerCase().replace(/mr\.|ms\.|dr\.|prof\./g, '').trim();

      return faculty.find(f => {
        if (f.faculty_code && f.faculty_code.toUpperCase().trim() === cleanCode) return true;
        if (f.employee_code && f.employee_code.toUpperCase().trim() === cleanCode) return true;
        if (cleanCode === 'HEM' && f.full_name.toLowerCase().includes('hemlata')) return true;
        if (cleanCode === 'KK' && f.full_name.toLowerCase().includes('kuldeep')) return true;
        if (cleanCode === 'NAK' && f.full_name.toLowerCase().includes('naseem')) return true;
        if (cleanCode === 'IRK' && f.full_name.toLowerCase().includes('imran')) return true;
        if ((cleanCode === 'SHS' || cleanCode === 'SS') && f.full_name.toLowerCase().includes('shivani')) return true;
        if (cleanCode === 'PRS' && f.full_name.toLowerCase().includes('praveen')) return true;
        if ((cleanCode === 'ALG' || cleanCode === 'AG') && f.full_name.toLowerCase().includes('alok')) return true;
        if (cleanCode === 'ABG' && f.full_name.toLowerCase().includes('abhishek')) return true;
        if (cleanCode === 'GDS' && f.full_name.toLowerCase().includes('gagandep')) return true;

        const fClean = f.full_name.toLowerCase().replace(/mr\.|ms\.|dr\.|prof\./g, '').trim();
        if (fClean.includes(cleanName) || cleanName.includes(fClean)) return true;
        const initials = fClean.split(/\s+/).map(w => w[0]).join('').toUpperCase();
        if (initials === cleanCode) return true;
        return false;
      });
    };

    // 7. Resolve Subjects
    const subjectMatches = doc.subject_mappings.map(sm => {
      const matchedSubject = findMatchingSubject(sm.subject_code) || findMatchingSubject(sm.subject_name);

      return {
        extracted: sm,
        matchedSubject,
        isNew: !matchedSubject
      };
    });

    // 8. Resolve Faculty
    const facultyMatches = doc.faculty_mappings.map(fm => {
      const matchedFaculty = findMatchingFaculty(fm.faculty_code) || findMatchingFaculty(fm.faculty_name);

      return {
        extracted: fm,
        matchedFaculty,
        isNew: !matchedFaculty
      };
    });

    // 9. Compute Diffs and Detect Conflicts
    const sectionTimetable = section 
      ? existingTimetable.filter(t => t.section_id === section?.id && t.active)
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

        // Check Conflicts for new slot against other sections
        let slotConflict: TimetableConflict | undefined;
        if (newSlot && resolvedFac) {
          const facultyOverlap = existingTimetable.find(t => 
            t.faculty_id === resolvedFac?.id &&
            t.day_of_week === day &&
            t.period_number === pNum &&
            t.section_id !== section?.id &&
            t.active
          );

          if (facultyOverlap) {
            slotConflict = {
              type: 'faculty',
              message: `Faculty overlap: ${resolvedFac.full_name} is already scheduled in Section ${facultyOverlap.section?.name || 'another section'} on ${day} Period ${pNum}.`,
              conflictingEntry: facultyOverlap
            };
            conflicts.push(slotConflict);
          }
        }

        if (newSlot && (newSlot.room_number || doc.room_number)) {
          const roomToTest = (newSlot.room_number || doc.room_number).toUpperCase().replace(/ROOM/g, '').trim();
          const roomOverlap = existingTimetable.find(t => {
            if (t.section_id === section?.id || !t.active) return false;
            const tRoom = (t.room_number || '').toUpperCase().replace(/ROOM/g, '').trim();
            return tRoom === roomToTest && t.day_of_week === day && t.period_number === pNum;
          });

          if (roomOverlap && !slotConflict) {
            slotConflict = {
              type: 'room',
              message: `Room double-booking: Room ${roomToTest} is already occupied on ${day} Period ${pNum}.`,
              conflictingEntry: roomOverlap
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
            room_number: newSlot?.room_number || doc.room_number || oldSlot?.room_number || 'A007'
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

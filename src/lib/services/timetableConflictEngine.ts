import { DayOfWeek, LectureType, Section, Subject, Faculty, FacultySubjectAssignment, TimetableEntry, Semester, AcademicYear } from '../../types/database.types';

export interface ProposedTimetableEntry {
  id?: string;
  section_id?: string;
  subject_id?: string | null;
  faculty_id?: string | null;
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  room_number?: string;
  lecture_type?: LectureType;
  subject_code?: string;
  subject_name?: string;
  faculty_name?: string;
}

export type ConflictRule = 
  | 'SAME_SECTION' 
  | 'FACULTY_OVERLAP' 
  | 'ROOM_COLLISION' 
  | 'INVALID_ASSIGNMENT' 
  | 'INVALID_SECTION' 
  | 'INVALID_TIME';

export interface TimetableConflictItem {
  rule: ConflictRule;
  severity: 'blocking' | 'warning';
  day: DayOfWeek;
  period_number: number;
  timeRange: string;
  message: string;
  entry: ProposedTimetableEntry;
  conflictingEntry?: any;
}

export interface ConflictAnalysisReport {
  hasBlockingConflicts: boolean;
  conflicts: TimetableConflictItem[];
  blockingCount: number;
  warningCount: number;
  validEntries: ProposedTimetableEntry[];
  invalidEntries: ProposedTimetableEntry[];
}

/**
 * Converts HH:MM string to minutes from midnight for interval math
 */
export function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Strict interval overlap check: startA < endB AND endA > startB
 */
export function checkIntervalOverlap(
  startA: string, 
  endA: string, 
  startB: string, 
  endB: string
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);

  // If time parsing failed or missing, fallback to period comparison if called elsewhere
  if (eA <= sA || eB <= sB) return false;

  return sA < eB && eA > sB;
}

/**
 * Comprehensive Timetable Conflict & Validation Engine
 */
export class TimetableConflictEngine {
  public static analyzeConflicts(params: {
    targetSectionId: string;
    proposedEntries: ProposedTimetableEntry[];
    currentDbEntries: TimetableEntry[];
    sections?: Section[];
    subjects?: Subject[];
    faculty?: Faculty[];
    assignments?: FacultySubjectAssignment[];
    semesters?: Semester[];
    academicYears?: AcademicYear[];
  }): ConflictAnalysisReport {
    const {
      targetSectionId,
      proposedEntries,
      currentDbEntries,
      sections = [],
      subjects = [],
      faculty = [],
      assignments = [],
      semesters = [],
      academicYears = [],
    } = params;

    const conflicts: TimetableConflictItem[] = [];
    const validEntries: ProposedTimetableEntry[] = [];
    const invalidEntries: ProposedTimetableEntry[] = [];

    // Helper lookups
    const sectionMap = new Map(sections.map(s => [s.id, s]));
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const facultyMap = new Map(faculty.map(f => [f.id, f]));

    const getSectionDisplayName = (secId: string): string => {
      const sec = sectionMap.get(secId);
      if (!sec) return 'another section';
      const sem = semesters.find(s => s.id === sec.semester_id);
      const yr = sem ? academicYears.find(y => y.id === sem.academic_year_id) : undefined;
      const yrPrefix = yr?.name ? `${yr.name} ` : (sem?.name ? `${sem.name} ` : (sem?.semester_number ? `Sem ${sem.semester_number} ` : ''));
      return `${yrPrefix}Section ${sec.name} (${sec.room_number || 'Room TBD'})`;
    };

    // Verify Rule E: Target section exists and active
    const targetSection = sectionMap.get(targetSectionId);
    if (sections.length > 0 && (!targetSection || !targetSection.active)) {
      conflicts.push({
        rule: 'INVALID_SECTION',
        severity: 'blocking',
        day: 'MON',
        period_number: 1,
        timeRange: 'N/A',
        message: `Target section "${targetSectionId}" does not exist or is marked inactive.`,
        entry: proposedEntries[0] || {
          subject_id: '',
          faculty_id: '',
          day_of_week: 'MON',
          period_number: 1,
          start_time: '09:00',
          end_time: '09:50',
        },
      });
      return {
        hasBlockingConflicts: true,
        conflicts,
        blockingCount: 1,
        warningCount: 0,
        validEntries: [],
        invalidEntries: proposedEntries,
      };
    }

    // Active other section DB entries (ignore entries from the section being replaced)
    const otherSectionDbEntries = currentDbEntries.filter(t => 
      t.active && 
      t.section_id !== targetSectionId
    );

    // Track processed slots to detect internal intra-schedule collisions
    const processedProposed: ProposedTimetableEntry[] = [];

    for (let idx = 0; idx < proposedEntries.length; idx++) {
      const entry = proposedEntries[idx];
      let entryHasBlockingError = false;

      const fac = entry.faculty_id ? facultyMap.get(entry.faculty_id) : undefined;
      const sub = entry.subject_id ? subjectMap.get(entry.subject_id) : undefined;
      const facName = fac?.full_name || entry.faculty_name || 'Faculty Member';
      const subCode = sub?.subject_code || entry.subject_code || (entry.lecture_type === 'Lunch' ? 'Lunch Break' : 'Subject');
      const roomNum = (entry.room_number || targetSection?.room_number || '').trim();
      const timeStr = `${entry.start_time}–${entry.end_time}`;

      // -------------------------------------------------------------
      // Rule F: Invalid Time Interval (End time <= start time)
      // -------------------------------------------------------------
      const startMin = timeToMinutes(entry.start_time);
      const endMin = timeToMinutes(entry.end_time);
      if (endMin <= startMin) {
        conflicts.push({
          rule: 'INVALID_TIME',
          severity: 'blocking',
          day: entry.day_of_week,
          period_number: entry.period_number,
          timeRange: timeStr,
          message: `Invalid slot timing on ${entry.day_of_week} Period ${entry.period_number}: End time (${entry.end_time}) must be later than start time (${entry.start_time}).`,
          entry,
        });
        entryHasBlockingError = true;
      }

      // -------------------------------------------------------------
      // Rule A: Same Section Conflict (Intra-batch duplicate assignment)
      // -------------------------------------------------------------
      for (const prior of processedProposed) {
        if (prior.day_of_week === entry.day_of_week) {
          const overlaps = checkIntervalOverlap(entry.start_time, entry.end_time, prior.start_time, prior.end_time);
          if (overlaps) {
            const priorSub = prior.subject_id ? (subjectMap.get(prior.subject_id)?.subject_code || prior.subject_code || 'Class') : (prior.lecture_type || 'Break');
            conflicts.push({
              rule: 'SAME_SECTION',
              severity: 'blocking',
              day: entry.day_of_week,
              period_number: entry.period_number,
              timeRange: timeStr,
              message: `Same-section collision on ${entry.day_of_week} Period ${entry.period_number}: Section ${targetSection?.name || ''} already has ${priorSub} scheduled during ${prior.start_time}–${prior.end_time}.`,
              entry,
              conflictingEntry: prior,
            });
            entryHasBlockingError = true;
          }
        }
      }

      // Helper for non-instructional and common areas
      const isNonInstructionalType = (type?: string, period?: number) => {
        if (period === 5) return true;
        if (!type) return false;
        const low = type.toLowerCase().trim();
        return low === 'lunch' || low.includes('lunch') || low.includes('break') || low.includes('sport') || low.includes('recess') || low.includes('other');
      };
      const isCommonRoomArea = (r?: string) => {
        if (!r) return true;
        const low = r.toLowerCase().trim();
        return (
          low === '' ||
          low === 'tbd' ||
          low === 'room' ||
          low.includes('refectory') ||
          low.includes('break') ||
          low.includes('cafeteria') ||
          low.includes('dining') ||
          low.includes('canteen') ||
          low.includes('ground') ||
          low.includes('sports')
        );
      };

      // -------------------------------------------------------------
      // Rule B: Faculty Conflict (Simultaneous double-booking)
      // -------------------------------------------------------------
      if (entry.faculty_id && !isNonInstructionalType(entry.lecture_type, entry.period_number)) {
        // B1: Against other entries in this proposed batch
        for (const prior of processedProposed) {
          if (prior.faculty_id && !isNonInstructionalType(prior.lecture_type, prior.period_number) && prior.faculty_id === entry.faculty_id && prior.day_of_week === entry.day_of_week) {
            const overlaps = checkIntervalOverlap(entry.start_time, entry.end_time, prior.start_time, prior.end_time);
            if (overlaps) {
              conflicts.push({
                rule: 'FACULTY_OVERLAP',
                severity: 'blocking',
                day: entry.day_of_week,
                period_number: entry.period_number,
                timeRange: timeStr,
                message: `Faculty double-booking: ${facName} is scheduled twice on ${entry.day_of_week} during overlapping times (${timeStr}).`,
                entry,
                conflictingEntry: prior,
              });
              entryHasBlockingError = true;
            }
          }
        }

        // B2: Against other sections in active Supabase DB
        for (const dbEntry of otherSectionDbEntries) {
          if (entry.id && dbEntry.id && entry.id === dbEntry.id) continue;
          if (entry.section_id && dbEntry.section_id && entry.section_id === dbEntry.section_id) continue;
          if (dbEntry.section_id === targetSectionId) continue;
          if (isNonInstructionalType(dbEntry.lecture_type, dbEntry.period_number)) continue;

          if (dbEntry.faculty_id && dbEntry.faculty_id === entry.faculty_id && dbEntry.day_of_week === entry.day_of_week) {
            const dbStart = dbEntry.start_time || '09:00';
            const dbEnd = dbEntry.end_time || '09:50';
            const overlaps = checkIntervalOverlap(entry.start_time, entry.end_time, dbStart, dbEnd);

            if (overlaps) {
              const secName = getSectionDisplayName(dbEntry.section_id);
              conflicts.push({
                rule: 'FACULTY_OVERLAP',
                severity: 'blocking',
                day: entry.day_of_week,
                period_number: entry.period_number,
                timeRange: timeStr,
                message: `Faculty conflict: ${facName} is already assigned to ${secName} on ${entry.day_of_week} ${dbStart}–${dbEnd} (Period ${dbEntry.period_number}).`,
                entry,
                conflictingEntry: dbEntry,
              });
              entryHasBlockingError = true;
            }
          }
        }
      }

      // -------------------------------------------------------------
      // Rule C: Room Collision (Simultaneous room occupancy)
      // -------------------------------------------------------------
      if (roomNum && !isCommonRoomArea(roomNum) && !isNonInstructionalType(entry.lecture_type, entry.period_number)) {
        // C1: Against other entries in this proposed batch
        for (const prior of processedProposed) {
          const priorRoom = (prior.room_number || targetSection?.room_number || '').trim();
          if (
            priorRoom && 
            !isCommonRoomArea(priorRoom) &&
            !isNonInstructionalType(prior.lecture_type, prior.period_number) &&
            priorRoom.toLowerCase() === roomNum.toLowerCase() && 
            prior.day_of_week === entry.day_of_week
          ) {
            const overlaps = checkIntervalOverlap(entry.start_time, entry.end_time, prior.start_time, prior.end_time);
            if (overlaps) {
              conflicts.push({
                rule: 'ROOM_COLLISION',
                severity: 'blocking',
                day: entry.day_of_week,
                period_number: entry.period_number,
                timeRange: timeStr,
                message: `Room collision: ${roomNum} is assigned multiple times on ${entry.day_of_week} during overlapping times (${timeStr}).`,
                entry,
                conflictingEntry: prior,
              });
              entryHasBlockingError = true;
            }
          }
        }

        // C2: Against other sections in active Supabase DB
        for (const dbEntry of otherSectionDbEntries) {
          if (entry.id && dbEntry.id && entry.id === dbEntry.id) continue;
          if (entry.section_id && dbEntry.section_id && entry.section_id === dbEntry.section_id) continue;
          if (dbEntry.section_id === targetSectionId) continue;
          if (isNonInstructionalType(dbEntry.lecture_type, dbEntry.period_number)) continue;

          const dbRoom = (dbEntry.room_number || '').trim();
          if (
            dbRoom && 
            !isCommonRoomArea(dbRoom) &&
            dbRoom.toLowerCase() === roomNum.toLowerCase() && 
            dbEntry.day_of_week === entry.day_of_week
          ) {
            const dbStart = dbEntry.start_time || '09:00';
            const dbEnd = dbEntry.end_time || '09:50';
            const overlaps = checkIntervalOverlap(entry.start_time, entry.end_time, dbStart, dbEnd);

            if (overlaps) {
              const secName = getSectionDisplayName(dbEntry.section_id);
              conflicts.push({
                rule: 'ROOM_COLLISION',
                severity: 'blocking',
                day: entry.day_of_week,
                period_number: entry.period_number,
                timeRange: timeStr,
                message: `Room collision: ${roomNum} is already occupied by ${secName} on ${entry.day_of_week} ${dbStart}–${dbEnd} (Period ${dbEntry.period_number}).`,
                entry,
                conflictingEntry: dbEntry,
              });
              entryHasBlockingError = true;
            }
          }
        }
      }

      // -------------------------------------------------------------
      // Rule D: Invalid Faculty/Subject Assignment (Warning)
      // -------------------------------------------------------------
      if (
        entry.faculty_id && 
        entry.subject_id && 
        entry.lecture_type !== 'Lunch' && 
        entry.lecture_type !== 'Sports' && 
        entry.lecture_type !== 'Other' && 
        assignments.length > 0
      ) {
        const hasAssignment = assignments.some(a => 
          a.active &&
          a.faculty_id === entry.faculty_id &&
          a.subject_id === entry.subject_id &&
          (!a.section_id || a.section_id === targetSectionId)
        );

        if (!hasAssignment) {
          conflicts.push({
            rule: 'INVALID_ASSIGNMENT',
            severity: 'warning',
            day: entry.day_of_week,
            period_number: entry.period_number,
            timeRange: timeStr,
            message: `Assignment notice: ${facName} is not officially mapped to subject ${subCode} in the teaching assignments master.`,
            entry,
          });
        }
      }

      // Categorize entry
      if (entryHasBlockingError) {
        invalidEntries.push(entry);
      } else {
        validEntries.push(entry);
      }

      processedProposed.push(entry);
    }

    const blockingCount = conflicts.filter(c => c.severity === 'blocking').length;
    const warningCount = conflicts.filter(c => c.severity === 'warning').length;

    return {
      hasBlockingConflicts: blockingCount > 0,
      conflicts,
      blockingCount,
      warningCount,
      validEntries,
      invalidEntries,
    };
  }
}

import { DayOfWeek, LectureType, Section, Subject, Faculty, Classroom } from '../../types/database.types';
import { fetchCSVContent } from '../utils/urlUtils';
import { getCanonicalPeriodTiming } from '../../config/academicConfig';

export interface RawCSVRow {
  day?: string;
  period?: string | number;
  start_time?: string;
  end_time?: string;
  subject_code?: string;
  subject_name?: string;
  faculty?: string;
  faculty_name?: string;
  faculty_code?: string;
  room?: string;
  type?: string;
  section?: string;
  [key: string]: any;
}

export interface ValidatedCSVTimetableEntry {
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_code: string;
  subject_name: string;
  subject_id?: string;
  faculty_code: string;
  faculty_name: string;
  faculty_id?: string;
  room_number: string;
  classroom_id?: string;
  lecture_type: LectureType;
}

export interface CSVTimetableMetadata {
  institution?: string;
  session?: string;
  degree?: string;
  branch?: string;
  section?: string;
  year?: string;
  effectiveDate?: string;
  classIncharge?: string;
  roomNumber?: string;
  classroomId?: string;
}

export interface CSVValidationResult {
  valid: boolean;
  format: 'matrix' | 'normalized';
  errors: string[];
  warnings: string[];
  totalSlots: number;
  instructionalSlots: number;
  nonInstructionalSlots: number;
  dayBreakdown: Record<string, number>;
  entries: ValidatedCSVTimetableEntry[];
  metadata?: CSVTimetableMetadata;
  detectedSectionMismatch?: {
    csvSection: string;
    targetSection: string;
  };
}

export interface CSVTimetableContext {
  targetSection: Section;
  subjects: Subject[];
  faculty: Faculty[];
  classrooms?: Classroom[];
  selectedEffectiveDate?: string;
}

export class CSVTimetableService {
  private static instance: CSVTimetableService;
  public static getInstance(): CSVTimetableService {
    if (!this.instance) this.instance = new CSVTimetableService();
    return this.instance;
  }

  public async fetchTimetableCSV(url: string): Promise<string> {
    return fetchCSVContent(url);
  }

  public parseCSVLines(csvContent: string): string[][] {
    const text = csvContent.replace(/^\uFEFF/, '').trim();
    if (!text) return [];
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"') {
        if (quoted && next === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        row.push(field.trim()); field = '';
      } else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && next === '\n') i++;
        row.push(field.trim()); field = '';
        if (row.some(Boolean)) rows.push(row);
        row = [];
      } else field += ch;
    }
    if (field.length || row.length) {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
    }
    return rows;
  }

  public normalizeColumnHeader(header: string): string {
    const h = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (h.includes('day') || h.includes('weekday')) return 'day_of_week';
    if (h.includes('period') || h.includes('slot') || h.includes('lectureno')) return 'period_number';
    if (h.includes('start') || h === 'from') return 'start_time';
    if (h.includes('end') || h === 'to') return 'end_time';
    if (h.includes('time') || h.includes('timing')) return 'time_range';
    if (h.includes('subjectcode') || h.includes('coursecode') || h === 'code') return 'subject_code';
    if (h.includes('subjectname') || h.includes('coursename') || h.includes('subjecttitle') || h === 'subject') return 'subject_name';
    if (h.includes('facultycode') || h.includes('teachercode') || h.includes('initials') || h === 'faccode') return 'faculty_code';
    if (h.includes('faculty') || h.includes('teacher') || h.includes('instructor') || h.includes('prof')) return 'faculty_name';
    if (h.includes('room') || h.includes('classroom') || h === 'hall') return 'room_number';
    if (h.includes('type') || h.includes('format') || h.includes('mode')) return 'lecture_type';
    if (h.includes('section') || h === 'sec') return 'section_name';
    return h;
  }

  public normalizeDay(raw: string): DayOfWeek | null {
    const clean = (raw || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    return days.find(day => clean.startsWith(day)) || null;
  }

  /**
   * Universal Entry Point for Timetable CSV Ingestion.
   * Auto-detects between MATRIX format and NORMALIZED format without requiring manual conversion.
   */
  public parseAndValidateCSV(csvText: string, context: CSVTimetableContext): CSVValidationResult {
    const lines = this.parseCSVLines(csvText);
    if (!lines || lines.length < 2) {
      return {
        valid: false,
        format: 'normalized',
        errors: ['CSV must contain a header row and at least one timetable row.'],
        warnings: [],
        totalSlots: 0,
        instructionalSlots: 0,
        nonInstructionalSlots: 0,
        dayBreakdown: {},
        entries: [],
      };
    }

    const detection = this.detectFormat(lines);
    if (detection.format === 'matrix') {
      return this.parseMatrixCSV(lines, detection.headerRowIndex, context);
    } else if (detection.format === 'normalized') {
      return this.parseNormalizedCSV(lines, detection.headerRowIndex, context);
    } else {
      return {
        valid: false,
        format: 'normalized',
        errors: [
          'CSV could not be recognized as a timetable. Supported formats: matrix timetable or normalized Day/Period format.'
        ],
        warnings: [],
        totalSlots: 0,
        instructionalSlots: 0,
        nonInstructionalSlots: 0,
        dayBreakdown: {},
        entries: [],
      };
    }
  }

  /**
   * Scans all rows to detect format and header index dynamically.
   * Supports:
   * - FORMAT A: Normalized (Day, Period, Subject, Faculty, Room)
   * - FORMAT B: Matrix (DAY/TIME, P1, P2, P3...)
   * - FORMAT C: Time Matrix (DAY/TIME, 09:00-09:50, 09:50-10:40...)
   * - FORMAT D: Subject + Faculty Cell (multiline or pipe/slash delimited)
   * - FORMAT E: Google Sheet CSV export
   */
  public detectFormat(lines: string[][]): { format: 'matrix' | 'normalized' | 'unknown'; headerRowIndex: number } {
    for (let r = 0; r < Math.min(lines.length, 15); r++) {
      const row = lines[r];
      if (!row || row.length === 0) continue;

      const firstCell = (row[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const isDayCell = firstCell.includes('day') || firstCell.includes('date') || firstCell.includes('time') || firstCell.length <= 4;

      // Check if subsequent columns look like period headers or time ranges
      const hasMatrixPeriodOrTimeColumns = row.slice(1).some(col => {
        const c = col.trim();
        if (!c) return false;
        // P1, P2, P3... or Period 1, Period 2...
        if (/^p\s*\d+$/i.test(c) || /^period\s*\d+$/i.test(c) || /^slot\s*\d+$/i.test(c)) return true;
        // 1, 2, 3... or Roman numerals I, II, III...
        if (/^[1-9]\d*$/.test(c) || /^[IVX]+$/i.test(c)) return true;
        // Roman numeral / digit with paren time: "I (09:00 - 09:50)"
        if (/^([IVX]+|\d+)\s*\([^\)]*\d{1,2}:\d{2}[^\)]*\)/i.test(c)) return true;
        // Time range: "09:00-09:50", "09:50 - 10:40"
        if (/\d{1,2}:\d{2}\s*(?:-|–|—|to)\s*\d{1,2}:\d{2}/i.test(c)) return true;
        return false;
      });

      // Also check if subsequent rows in column 0 contain day names (Monday, Tuesday...)
      const subsequentRowsHaveDays = lines.slice(r + 1, r + 7).some(subRow => {
        const d = this.normalizeDay(subRow?.[0] || '');
        return d !== null && d !== 'SUN';
      });

      if ((isDayCell || subsequentRowsHaveDays) && hasMatrixPeriodOrTimeColumns) {
        return { format: 'matrix', headerRowIndex: r };
      }

      // Check for normalized format header
      const normalizedKeys = row.map(h => this.normalizeColumnHeader(h));
      const hasDay = normalizedKeys.includes('day_of_week');
      const hasPeriod = normalizedKeys.includes('period_number') || normalizedKeys.includes('start_time');
      const hasSubject = normalizedKeys.includes('subject_code') || normalizedKeys.includes('subject_name');

      if (hasDay && hasPeriod && hasSubject) {
        return { format: 'normalized', headerRowIndex: r };
      }
    }

    return { format: 'unknown', headerRowIndex: -1 };
  }

  /**
   * Intelligently normalizes 12-hour or 24-hour timetable time strings into HH:mm (24-hour).
   * E.g. 9:00 -> 09:00, 1:10 -> 13:10, 2:50 -> 14:50, 3:40 -> 15:40.
   */
  public normalizeTimeTo24H(timeStr: string, isEndTime = false, refStartTime?: string): string {
    const clean = timeStr.trim();
    const match = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return clean;

    let h = parseInt(match[1], 10);
    const m = match[2];

    // Standard institutional hours rule:
    // In college timetables running from ~8 AM to ~6 PM, hours 1 through 7 are PM (13:00 to 19:00).
    if (h >= 1 && h <= 7) {
      h += 12;
    }

    // If start time was 12:20 and end time was 1:10 (represented as 1 or 13), ensure end is strictly after start
    if (refStartTime) {
      const refH = parseInt(refStartTime.split(':')[0], 10);
      if (h < refH && h + 12 <= 23) {
        h += 12;
      }
    }

    return `${h.toString().padStart(2, '0')}:${m}`;
  }

  /**
   * Convert Roman numeral strings (I, II, III, IV, etc.) or Arabic numerals to number.
   */
  public parsePeriodNumber(numeralStr: string): number | null {
    const clean = numeralStr.replace(/\s+/g, '').toUpperCase();
    const romanMap: Record<string, number> = {
      I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12
    };
    if (romanMap[clean]) return romanMap[clean];
    const parsed = parseInt(clean, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  /**
   * Matrix-style CSV parser (Metadata rows + Day rows + Period columns)
   */
  private parseMatrixCSV(lines: string[][], headerRowIndex: number, context: CSVTimetableContext): CSVValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const entries: ValidatedCSVTimetableEntry[] = [];
    const dayBreakdown: Record<string, number> = {};
    let instructionalSlots = 0;
    let nonInstructionalSlots = 0;

    // ── 1. Metadata Extraction ──
    const metadata: CSVTimetableMetadata = {};
    const metaRows = lines.slice(0, headerRowIndex);
    const metaText = metaRows.map(r => r.join(' | ')).join('\n');

    const matchDegree = metaText.match(/Degree\s*Program:\s*([^\r\n|;,]+)/i);
    if (matchDegree) metadata.degree = matchDegree[1].trim();

    const matchBranch = metaText.match(/Branch:\s*([^\r\n|;,]+)/i);
    if (matchBranch) metadata.branch = matchBranch[1].trim();

    const matchSection = metaText.match(/Section:\s*([A-Za-z0-9]+)/i);
    if (matchSection) metadata.section = matchSection[1].trim();

    const matchYear = metaText.match(/Year:\s*([^\r\n|;,]+)/i);
    if (matchYear) metadata.year = matchYear[1].trim();

    const matchWef = metaText.match(/(?:w\.e\.f\.|effective(?:\s*date)?):\s*([^\r\n|;,]+)/i);
    if (matchWef) metadata.effectiveDate = matchWef[1].trim();

    const matchIncharge = metaText.match(/Class\s*Incharge:\s*([^\r\n|;,]+)/i);
    if (matchIncharge) metadata.classIncharge = matchIncharge[1].trim();

    const matchRoom = metaText.match(/Room\s*(?:No\.?)?:\s*([^\r\n|;,]+)/i);
    if (matchRoom) metadata.roomNumber = matchRoom[1].trim();

    const matchSession = metaText.match(/(?:SESSION|SEMESTER)?\s*\(?(\d{4}[-–]\d{4})\)?/i);
    if (matchSession) metadata.session = matchSession[1].trim();

    // ── 2. Metadata Scope Validation ──
    let detectedSectionMismatch: { csvSection: string; targetSection: string } | undefined = undefined;
    if (metadata.section) {
      const csvSecClean = metadata.section.toUpperCase().replace(/SECTION/i, '').trim();
      const targetSecClean = context.targetSection.name.toUpperCase().replace(/SECTION/i, '').trim();
      if (csvSecClean !== targetSecClean) {
        detectedSectionMismatch = {
          csvSection: metadata.section,
          targetSection: context.targetSection.name,
        };
        errors.push(
          `CSV metadata section "${metadata.section}" does not match the active selected section "${context.targetSection.name}". Import blocked to prevent accidental cross-section schedule overwrites.`
        );
      }
    }

    // ── 3. Classroom Validation ──
    let canonicalRoomNumber = context.targetSection.room_number || '';
    let canonicalClassroomId: string | undefined = undefined;

    if (metadata.roomNumber) {
      const rawRoom = metadata.roomNumber.trim();
      const cleanRoom = rawRoom.toUpperCase().replace(/[\s\-_.]/g, '');
      
      if (context.classrooms && context.classrooms.length > 0) {
        const matchedClassroom = context.classrooms.find(c => {
          const cRoomClean = c.room_number.toUpperCase().replace(/[\s\-_.]/g, '');
          return cRoomClean === cleanRoom || cleanRoom.endsWith(cRoomClean) || cRoomClean.endsWith(cleanRoom);
        });

        if (matchedClassroom) {
          canonicalRoomNumber = matchedClassroom.room_number;
          canonicalClassroomId = matchedClassroom.id;
          metadata.classroomId = matchedClassroom.id;
        } else {
          errors.push(`Classroom "${rawRoom}" does not exist in the academic database.`);
        }
      } else {
        canonicalRoomNumber = rawRoom;
      }
    }

    // ── 4. Header Row Parsing (Period Numbers & Time Ranges) ──
    const headerRow = lines[headerRowIndex];
    const periodMap: Record<number, { periodNumber: number; start: string; end: string }> = {};
    let sequentialPeriodCounter = 1;

    for (let colIdx = 1; colIdx < headerRow.length; colIdx++) {
      const cell = headerRow[colIdx]?.trim();
      if (!cell) continue;

      // Case A: Roman numeral or digit with parenthesized time range: "I (9:00 - 9:50)", "1 (09:00-09:50)"
      const parenMatch = cell.match(/^([IVX]+|\d+)\s*\(([^\)]+)\)$/i);
      if (parenMatch) {
        const periodNum = this.parsePeriodNumber(parenMatch[1]);
        const timeRangeRaw = parenMatch[2].trim();
        const timeMatch = timeRangeRaw.match(/(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})/i);

        if (periodNum && timeMatch) {
          const rawStart = timeMatch[1].trim();
          const rawEnd = timeMatch[2].trim();
          const start = this.normalizeTimeTo24H(rawStart, false);
          const end = this.normalizeTimeTo24H(rawEnd, true, start);

          if (start >= end) {
            errors.push(`Header column ${colIdx + 1} ("${cell}"): end time (${end}) must be after start time (${start}).`);
          } else {
            periodMap[colIdx] = { periodNumber: periodNum, start, end };
            sequentialPeriodCounter = Math.max(sequentialPeriodCounter, periodNum + 1);
          }
          continue;
        }
      }

      // Case B: Time range directly: "09:00-09:50", "09:50 - 10:40" (Format C)
      const directTimeMatch = cell.match(/(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})/i);
      if (directTimeMatch) {
        const rawStart = directTimeMatch[1].trim();
        const rawEnd = directTimeMatch[2].trim();
        const start = this.normalizeTimeTo24H(rawStart, false);
        const end = this.normalizeTimeTo24H(rawEnd, true, start);
        const periodNum = sequentialPeriodCounter++;

        if (start >= end) {
          errors.push(`Header column ${colIdx + 1} ("${cell}"): end time (${end}) must be after start time (${start}).`);
        } else {
          periodMap[colIdx] = { periodNumber: periodNum, start, end };
        }
        continue;
      }

      // Case C: Period code: "P1", "P2", "Period 1", "1", "I" (Format B)
      const pMatch = cell.match(/^(?:P|Period\s*|Slot\s*)?([IVX]+|\d+)$/i);
      if (pMatch) {
        const periodNum = this.parsePeriodNumber(pMatch[1]) || sequentialPeriodCounter++;
        const defaultTiming = getCanonicalPeriodTiming(periodNum);
        periodMap[colIdx] = {
          periodNumber: periodNum,
          start: defaultTiming.start_time,
          end: defaultTiming.end_time,
        };
        sequentialPeriodCounter = Math.max(sequentialPeriodCounter, periodNum + 1);
        continue;
      }

      warnings.push(`Column ${colIdx + 1} header "${cell}" does not match known period pattern.`);
    }

    if (Object.keys(periodMap).length === 0) {
      errors.push('No valid period columns found in the timetable header row.');
      return {
        valid: false,
        format: 'matrix',
        errors,
        warnings,
        totalSlots: 0,
        instructionalSlots: 0,
        nonInstructionalSlots: 0,
        dayBreakdown,
        entries: [],
        metadata,
        detectedSectionMismatch,
      };
    }

    // ── 5. Parse Day Rows ──
    const seenSlots = new Set<string>();

    for (let rowIdx = headerRowIndex + 1; rowIdx < lines.length; rowIdx++) {
      const row = lines[rowIdx];
      if (!row || row.length === 0) continue;

      const dayRaw = row[0]?.trim();
      if (!dayRaw) continue;

      const day = this.normalizeDay(dayRaw);
      if (!day) {
        // Might be a note or footer row at bottom of timetable
        warnings.push(`Row ${rowIdx + 1}: unrecognized day label "${dayRaw}". Row skipped.`);
        continue;
      }
      if (day === 'SUN') {
        warnings.push(`Row ${rowIdx + 1}: Sunday timetable row skipped (Sunday is non-instructional).`);
        continue;
      }

      for (let colIdx = 1; colIdx < row.length; colIdx++) {
        const cell = row[colIdx]?.trim();
        if (!cell) continue; // Empty slot

        const periodInfo = periodMap[colIdx];
        if (!periodInfo) continue;

        const slotKey = `${day}-${periodInfo.periodNumber}`;
        if (seenSlots.has(slotKey)) {
          errors.push(`Duplicate slot detected on ${day} Period ${periodInfo.periodNumber}.`);
          continue;
        }
        seenSlots.add(slotKey);

        const lowerCell = cell.toLowerCase();
        const isNonInstructional = 
          lowerCell.includes('lunch') || 
          lowerCell.includes('break') || 
          lowerCell.includes('recess') || 
          lowerCell.includes('sports') || 
          lowerCell.includes('holiday') || 
          lowerCell.includes('vacation') ||
          lowerCell === 'off';

        if (isNonInstructional) {
          nonInstructionalSlots++;
          dayBreakdown[day] = (dayBreakdown[day] || 0) + 1;

          let slotType: LectureType = 'Other';
          if (lowerCell.includes('lunch') || lowerCell.includes('recess')) slotType = 'Lunch';
          else if (lowerCell.includes('sports')) slotType = 'Sports';
          else if (lowerCell.includes('break')) slotType = 'Break';

          entries.push({
            day_of_week: day,
            period_number: periodInfo.periodNumber,
            start_time: periodInfo.start,
            end_time: periodInfo.end,
            subject_code: cell.toUpperCase().includes('LUNCH') ? 'LUNCH' : cell.toUpperCase(),
            subject_name: cell.toUpperCase().includes('LUNCH') ? 'Lunch Break' : cell,
            subject_id: undefined,
            faculty_code: '',
            faculty_name: '',
            faculty_id: undefined,
            room_number: canonicalRoomNumber,
            classroom_id: canonicalClassroomId,
            lecture_type: slotType,
          });
        } else {
          instructionalSlots++;
          // Parse cell tokens across Format B, D, and parenthesized formats:
          let subjectToken = '';
          let facultyToken = '';
          let roomToken = '';

          if (cell.includes('\n') || cell.includes('\r')) {
            // Multiline cell (Format D)
            const parts = cell.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
            subjectToken = parts[0] || '';
            facultyToken = parts[1] || '';
            roomToken = parts[2] || '';
          } else if (cell.includes('|') || cell.includes('//') || (cell.includes('/') && !cell.includes('and/or'))) {
            // Delimited cell (Format B)
            const delim = cell.includes('|') ? '|' : (cell.includes('//') ? '//' : '/');
            const parts = cell.split(delim).map(p => p.trim()).filter(Boolean);
            subjectToken = parts[0] || '';
            facultyToken = parts[1] || '';
            roomToken = parts[2] || '';
          } else {
            // Parenthesized or dash format: "DS (HEM)" or "Data Structure (Hemlata) - A006"
            const parenMatch = cell.match(/^(.+?)\s*\(([^)]+)\)(?:\s*[-–—]\s*(.+))?$/);
            if (parenMatch) {
              subjectToken = parenMatch[1].trim();
              facultyToken = parenMatch[2].trim();
              roomToken = parenMatch[3]?.trim() || '';
            } else {
              subjectToken = cell.trim();
            }
          }

          if (!subjectToken) {
            errors.push(`Row ${rowIdx + 1}, ${day} Period ${periodInfo.periodNumber}: Subject is empty in cell "${cell}".`);
            continue;
          }

          // Resolve Subject dynamically against Supabase active subjects
          const matchedSubject = this.findMatchingSubject(subjectToken, context.subjects);
          if (!matchedSubject) {
            warnings.push(
              `Row ${rowIdx + 1}, ${day} Period ${periodInfo.periodNumber}: Subject "${subjectToken}" could not be matched to an active catalog record.`
            );
          }

          // Resolve Faculty dynamically against Supabase active faculty records
          let matchedFaculty: Faculty | undefined = undefined;
          if (facultyToken) {
            matchedFaculty = this.findMatchingFaculty(facultyToken, context.faculty);
            if (!matchedFaculty) {
              warnings.push(
                `Row ${rowIdx + 1}, ${day} Period ${periodInfo.periodNumber}: Faculty "${facultyToken}" could not be matched to an active faculty record.`
              );
            }
          }

          // Resolve Room if present in cell
          let slotRoomNumber = canonicalRoomNumber;
          let slotClassroomId = canonicalClassroomId;
          if (roomToken) {
            const cleanR = roomToken.toUpperCase().replace(/[\s\-_.]/g, '');
            const matchedRoom = (context.classrooms || []).find(c => {
              const cRoomClean = c.room_number.toUpperCase().replace(/[\s\-_.]/g, '');
              return cRoomClean === cleanR || cleanR.endsWith(cRoomClean) || cRoomClean.endsWith(cleanR);
            });
            if (matchedRoom) {
              slotRoomNumber = matchedRoom.room_number;
              slotClassroomId = matchedRoom.id;
            } else {
              slotRoomNumber = roomToken;
            }
          }

          // Determine LectureType
          const lowerSub = subjectToken.toLowerCase();
          let lectureType: LectureType = 'Theory';
          if (lowerSub.includes('lab') || lowerSub.includes('practical')) {
            lectureType = 'Practical';
          } else if (lowerSub.includes('workshop') || lowerSub.includes('ws')) {
            lectureType = 'Workshop';
          } else if (lowerSub.includes('project') || lowerSub.includes('internship')) {
            lectureType = 'Project';
          } else if (lowerSub.includes('tutorial')) {
            lectureType = 'Tutorial';
          } else if (matchedSubject?.lecture_type) {
            lectureType = matchedSubject.lecture_type;
          }

          dayBreakdown[day] = (dayBreakdown[day] || 0) + 1;
          entries.push({
            day_of_week: day,
            period_number: periodInfo.periodNumber,
            start_time: periodInfo.start,
            end_time: periodInfo.end,
            subject_code: matchedSubject?.subject_code || subjectToken,
            subject_name: matchedSubject?.subject_name || subjectToken,
            subject_id: matchedSubject?.id,
            faculty_code: matchedFaculty?.faculty_code || matchedFaculty?.employee_code || facultyToken,
            faculty_name: matchedFaculty?.full_name || facultyToken,
            faculty_id: matchedFaculty?.id,
            room_number: slotRoomNumber,
            classroom_id: slotClassroomId,
            lecture_type: lectureType,
          });
        }
      }
    }

    if (!entries.length && !errors.length) {
      errors.push('No timetable entries could be extracted from the matrix CSV.');
    }

    return {
      valid: errors.length === 0,
      format: 'matrix',
      errors,
      warnings,
      totalSlots: entries.length,
      instructionalSlots,
      nonInstructionalSlots,
      dayBreakdown,
      entries: errors.length ? [] : entries,
      metadata,
      detectedSectionMismatch,
    };
  }

  /**
   * Normalized CSV parser (Row-based: Day, Period, Subject, Faculty, ...)
   */
  private parseNormalizedCSV(lines: string[][], headerRowIndex: number, context: CSVTimetableContext): CSVValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const entries: ValidatedCSVTimetableEntry[] = [];
    const dayBreakdown: Record<string, number> = {};
    let instructionalSlots = 0;
    let nonInstructionalSlots = 0;

    const header = lines[headerRowIndex];
    const keys = header.map(h => this.normalizeColumnHeader(h));
    const idx = (key: string) => keys.indexOf(key);

    const dayIdx = idx('day_of_week');
    const periodIdx = idx('period_number');
    const startIdx = idx('start_time');
    const endIdx = idx('end_time');
    const rangeIdx = idx('time_range');
    const codeIdx = idx('subject_code');
    const nameIdx = idx('subject_name');
    const facNameIdx = idx('faculty_name');
    const facCodeIdx = idx('faculty_code');
    const roomIdx = idx('room_number');
    const typeIdx = idx('lecture_type');
    const secIdx = idx('section_name');

    if (dayIdx < 0 || periodIdx < 0) {
      return {
        valid: false,
        format: 'normalized',
        errors: ['Normalized CSV must contain Day and Period columns.'],
        warnings,
        totalSlots: 0,
        instructionalSlots: 0,
        nonInstructionalSlots: 0,
        dayBreakdown,
        entries,
      };
    }

    const seen = new Set<string>();
    let detectedSectionMismatch: { csvSection: string; targetSection: string } | undefined = undefined;

    for (let rowIndex = headerRowIndex + 1; rowIndex < lines.length; rowIndex++) {
      const row = lines[rowIndex];
      const lineNum = rowIndex + 1;
      if (!row || row.length === 0 || row.every(c => !c.trim())) continue;

      if (secIdx >= 0 && row[secIdx]) {
        const rowSec = row[secIdx].trim().toUpperCase().replace(/SECTION/i, '').trim();
        const targetSec = context.targetSection.name.trim().toUpperCase().replace(/SECTION/i, '').trim();
        if (rowSec && rowSec !== targetSec) {
          if (!detectedSectionMismatch) {
            detectedSectionMismatch = {
              csvSection: row[secIdx].trim(),
              targetSection: context.targetSection.name,
            };
          }
          errors.push(`Row ${lineNum}: Section "${row[secIdx]}" does not match target section "${context.targetSection.name}".`);
          continue;
        }
      }

      const day = this.normalizeDay(row[dayIdx]);
      if (!day || day === 'SUN') {
        errors.push(`Row ${lineNum}: invalid weekday "${row[dayIdx]}".`);
        continue;
      }

      const periodNumber = Number.parseInt(String(row[periodIdx] || '').replace(/[^0-9]/g, ''), 10);
      if (!Number.isInteger(periodNumber) || periodNumber < 1) {
        errors.push(`Row ${lineNum}: invalid period number "${row[periodIdx]}".`);
        continue;
      }

      let start = startIdx >= 0 ? (row[startIdx] || '').trim() : '';
      let end = endIdx >= 0 ? (row[endIdx] || '').trim() : '';
      if ((!start || !end) && rangeIdx >= 0) {
        const match = String(row[rangeIdx] || '').match(/(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})/i);
        if (match) {
          start = match[1].trim();
          end = match[2].trim();
        }
      }

      if (!start || !end) {
        errors.push(`Row ${lineNum}: start_time and end_time are required.`);
        continue;
      }

      start = this.normalizeTimeTo24H(start, false);
      end = this.normalizeTimeTo24H(end, true, start);

      if (start >= end) {
        errors.push(`Row ${lineNum}: end_time (${end}) must be after start_time (${start}).`);
        continue;
      }

      const subCode = codeIdx >= 0 ? (row[codeIdx] || '').trim() : '';
      const subName = nameIdx >= 0 ? (row[nameIdx] || '').trim() : '';
      const rawType = typeIdx >= 0 ? (row[typeIdx] || '').trim().toLowerCase() : '';
      const isBreak = rawType.includes('break') || rawType.includes('lunch') || subName.toLowerCase().includes('lunch') || subCode.toLowerCase() === 'lunch';

      if (!isBreak && !subCode && !subName) {
        errors.push(`Row ${lineNum}: subject code or subject name is required.`);
        continue;
      }

      const facCode = facCodeIdx >= 0 ? (row[facCodeIdx] || '').trim() : '';
      const facName = facNameIdx >= 0 ? (row[facNameIdx] || '').trim() : '';
      if (!isBreak && !facCode && !facName) {
        errors.push(`Row ${lineNum}: faculty code or faculty name is required.`);
        continue;
      }

      const matchedSubject = isBreak ? undefined : this.findMatchingSubject(subCode || subName, context.subjects);
      if (!isBreak && !matchedSubject) {
        warnings.push(`Row ${lineNum}: subject "${subCode || subName}" could not be matched to an active subject in the academic catalog.`);
      }

      const matchedFaculty = isBreak ? undefined : this.findMatchingFaculty(facCode || facName, context.faculty);
      if (!isBreak && !matchedFaculty) {
        warnings.push(`Row ${lineNum}: faculty "${facCode || facName}" could not be matched to an active faculty record.`);
      }

      const slotKey = `${day}-${periodNumber}`;
      if (seen.has(slotKey)) {
        errors.push(`Row ${lineNum}: duplicate slot ${day} Period ${periodNumber}.`);
        continue;
      }
      seen.add(slotKey);
      dayBreakdown[day] = (dayBreakdown[day] || 0) + 1;

      let lectureType: LectureType = 'Theory';
      if (isBreak) {
        lectureType = rawType.includes('lunch') ? 'Lunch' : 'Break';
        nonInstructionalSlots++;
      } else {
        instructionalSlots++;
        if (rawType.includes('lab') || rawType.includes('practical')) lectureType = 'Practical';
        else if (rawType.includes('workshop')) lectureType = 'Workshop';
        else if (rawType.includes('project')) lectureType = 'Project';
        else if (rawType.includes('tutorial')) lectureType = 'Tutorial';
        else if (matchedSubject?.lecture_type) lectureType = matchedSubject.lecture_type;
      }

      const rowRoom = roomIdx >= 0 ? (row[roomIdx] || '').trim() : '';
      let canonicalRoom = rowRoom || context.targetSection.room_number || '';
      let classroomId: string | undefined = undefined;

      if (canonicalRoom && context.classrooms && context.classrooms.length > 0) {
        const cleanRoom = canonicalRoom.toUpperCase().replace(/[\s\-_.]/g, '');
        const matchedClassroom = context.classrooms.find(c => {
          const cClean = c.room_number.toUpperCase().replace(/[\s\-_.]/g, '');
          return cClean === cleanRoom || cleanRoom.endsWith(cClean) || cClean.endsWith(cleanRoom);
        });
        if (matchedClassroom) {
          canonicalRoom = matchedClassroom.room_number;
          classroomId = matchedClassroom.id;
        }
      }

      entries.push({
        day_of_week: day,
        period_number: periodNumber,
        start_time: start,
        end_time: end,
        subject_code: isBreak ? (subCode || 'LUNCH') : (matchedSubject?.subject_code || subCode || subName),
        subject_name: isBreak ? (subName || 'Lunch Break') : (matchedSubject?.subject_name || subName || subCode),
        subject_id: matchedSubject?.id,
        faculty_code: isBreak ? '' : (matchedFaculty?.faculty_code || matchedFaculty?.employee_code || facCode || facName),
        faculty_name: isBreak ? '' : (matchedFaculty?.full_name || facName || facCode),
        faculty_id: matchedFaculty?.id,
        room_number: canonicalRoom,
        classroom_id: classroomId,
        lecture_type: lectureType,
      });
    }

    if (!entries.length && !errors.length) errors.push('No timetable rows were found in normalized CSV.');

    return {
      valid: errors.length === 0,
      format: 'normalized',
      errors,
      warnings,
      totalSlots: entries.length,
      instructionalSlots,
      nonInstructionalSlots,
      dayBreakdown,
      entries: errors.length ? [] : entries,
      detectedSectionMismatch,
    };
  }

  /**
   * Database-backed Subject Matcher:
   * Resolves against active catalog in Supabase via code, aliases, parenthesized acronym in name, or full name.
   */
  public findMatchingSubject(token: string, subjects: Subject[]): Subject | undefined {
    if (!token || !subjects || subjects.length === 0) return undefined;

    const cleanToken = token.toUpperCase().replace(/[\s\-_.]/g, '');
    const lowerToken = token.toLowerCase().trim();

    // 1. Exact or sanitized match on subject_code
    const byCode = subjects.find(s => {
      const sc = (s.subject_code || '').toUpperCase().replace(/[\s\-_.]/g, '');
      return sc === cleanToken;
    });
    if (byCode) return byCode;

    // 2. Check aliases array if supported on Subject
    const byAlias = subjects.find(s => {
      const aliases = (s as any).aliases;
      if (Array.isArray(aliases)) {
        return aliases.some(a => {
          const cleanA = String(a).toUpperCase().replace(/[\s\-_.]/g, '');
          return cleanA === cleanToken || String(a).toLowerCase().trim() === lowerToken;
        });
      }
      return false;
    });
    if (byAlias) return byAlias;

    // 3. Check parenthesized alias/acronym in subject_name
    // E.g.: "Data Structure (DS)" -> "DS"
    // "Computer Organization & Architecture (COA)" -> "COA"
    // "Web Designing Workshop (WD WS)" -> "WD WS"
    // "Mathematics IV (Maths 4)" -> "Maths 4"
    const byParen = subjects.find(s => {
      const parenMatches = s.subject_name.match(/\(([^)]+)\)/g);
      if (parenMatches) {
        for (const pm of parenMatches) {
          const inner = pm.replace(/[()]/g, '').trim();
          const cleanInner = inner.toUpperCase().replace(/[\s\-_.]/g, '');
          if (cleanInner === cleanToken || inner.toLowerCase().trim() === lowerToken) {
            return true;
          }
        }
      }
      return false;
    });
    if (byParen) return byParen;

    // 4. Normalized name match (name before parentheses or full name)
    const byName = subjects.find(s => {
      const nameBeforeParen = s.subject_name.replace(/\(.*?\)/g, '').trim().toLowerCase();
      const cleanBeforeParen = nameBeforeParen.replace(/[\s\-_.]/g, '');
      if (cleanBeforeParen === cleanToken || nameBeforeParen === lowerToken) return true;
      const fullNameClean = s.subject_name.toLowerCase().replace(/[\s\-_.]/g, '');
      return fullNameClean === cleanToken.toLowerCase();
    });
    if (byName) return byName;

    // 5. Acronym generation from words in subject_name
    const byAcronym = subjects.find(s => {
      const nameBeforeParen = s.subject_name.replace(/\(.*?\)/g, '').trim();
      const words = nameBeforeParen.split(/\s+/).filter(w => !['and', '&', 'of', 'in', 'the', 'to'].includes(w.toLowerCase()));
      const acronym = words.map(w => w[0]).join('').toUpperCase();
      return acronym === cleanToken;
    });
    if (byAcronym) return byAcronym;

    // 6. Component and word-by-word acronym matching
    // Handles tokens like "WD WORKSHOP" matching "Web Designing Workshop (WD WS)"
    // or "MINI PROJECT" matching "Internship Assessment / Mini Project"
    const byComponentMatch = subjects.find(s => {
      const sNameClean = s.subject_name.toLowerCase();
      if (sNameClean.includes(lowerToken)) return true;

      const tokenWords = token.trim().split(/\s+/);
      if (tokenWords.length >= 2) {
        const sWords = s.subject_name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(w => !['and', '&', 'of', 'in', 'the', 'to'].includes(w.toLowerCase()));
        const lastTokenWord = tokenWords[tokenWords.length - 1].toLowerCase();
        const lastSubjectWord = sWords[sWords.length - 1]?.toLowerCase();

        // Check if last token word matches last subject word (e.g. Workshop, Lab, Project)
        if (
          lastTokenWord === lastSubjectWord || 
          (lastTokenWord === 'workshop' && (s.lecture_type === 'Workshop' || sNameClean.includes('workshop'))) ||
          (lastTokenWord === 'lab' && (s.lecture_type === 'Practical' || sNameClean.includes('lab')))
        ) {
          const tokenInitials = tokenWords.slice(0, -1).join('').toUpperCase();
          const subjectInitials = sWords.slice(0, -1).map(w => w[0]).join('').toUpperCase();
          if (tokenInitials === subjectInitials) return true;

          // Check against parenthesized initials (e.g. "WD" in "(WD WS)")
          const parenInner = (s.subject_name.match(/\(([^)]+)\)/)?.[1] || '').toUpperCase();
          const parenWords = parenInner.split(/\s+/);
          if (parenWords.includes(tokenInitials) || parenInner.startsWith(tokenInitials)) return true;
        }
      }

      return false;
    });
    if (byComponentMatch) return byComponentMatch;

    return undefined;
  }

  /**
   * Database-backed Faculty Matcher:
   * Resolves against active faculty records in Supabase via faculty_code, employee_code, or full_name.
   */
  public findMatchingFaculty(token: string, facultyList: Faculty[]): Faculty | undefined {
    if (!token || !facultyList || facultyList.length === 0) return undefined;

    const cleanToken = token.toUpperCase().trim();
    const cleanTokenNoPunct = cleanToken.replace(/[\s\-_.]/g, '');
    const lowerToken = token.toLowerCase().replace(/^(?:mr\.|ms\.|mrs\.|dr\.|prof\.)\s*/i, '').replace(/\s+/g, ' ').trim();

    // 1. Match faculty_code (HEM, KK, NAK, IRK, PRS, SHS, GDS, FZN, ALG, ABG, WSM)
    const byFacultyCode = facultyList.find(f => {
      const fc = (f.faculty_code || '').toUpperCase().trim();
      return fc && fc === cleanToken;
    });
    if (byFacultyCode) return byFacultyCode;

    // 2. Match employee_code (FAC-CSE-002, etc.)
    const byEmpCode = facultyList.find(f => {
      const ec = (f.employee_code || '').toUpperCase().trim();
      return ec && (ec === cleanToken || ec.replace(/[\s\-_.]/g, '') === cleanTokenNoPunct);
    });
    if (byEmpCode) return byEmpCode;

    // 3. Match full_name or stripped name
    const byName = facultyList.find(f => {
      const cleanFn = f.full_name.toLowerCase().replace(/^(?:mr\.|ms\.|mrs\.|dr\.|prof\.)\s*/i, '').replace(/\s+/g, ' ').trim();
      return cleanFn === lowerToken || cleanFn.includes(lowerToken) || lowerToken.includes(cleanFn);
    });
    if (byName) return byName;

    return undefined;
  }
}

export const csvTimetableService = CSVTimetableService.getInstance();

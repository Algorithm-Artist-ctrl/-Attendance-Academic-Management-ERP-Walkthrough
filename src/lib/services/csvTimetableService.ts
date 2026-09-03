import { DayOfWeek, LectureType, Section, Subject, Faculty } from '../../types/database.types';
import { ExtractedTimetableDocument, UploadTargetContext } from '../../types/academic.types';
import { fetchCSVContent } from '../utils/urlUtils';

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
  lecture_type: LectureType;
}

export interface CSVValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalSlots: number;
  dayBreakdown: Record<string, number>;
  entries: ValidatedCSVTimetableEntry[];
}

export class CSVTimetableService {
  private static instance: CSVTimetableService;

  public static getInstance(): CSVTimetableService {
    if (!CSVTimetableService.instance) {
      CSVTimetableService.instance = new CSVTimetableService();
    }
    return CSVTimetableService.instance;
  }

  /**
   * Safely fetch a remote CSV timetable from a Google Sheets or direct URL
   */
  public async fetchTimetableCSV(url: string): Promise<string> {
    return await fetchCSVContent(url);
  }

  /**
   * Robust CSV Line and Token Parser with quote handling and BOM stripping
   */
  public parseCSVLines(csvContent: string): string[][] {
    // Strip UTF-8 BOM if present
    let cleanText = csvContent.replace(/^\uFEFF/, '').trim();
    if (!cleanText) return [];

    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quotes
          currentField += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        // Line ending
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
        currentRow.push(currentField.trim());
        // Only push non-empty rows
        if (currentRow.some(f => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Push last row if exists
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f.length > 0)) {
        lines.push(currentRow);
      }
    }

    return lines;
  }

  /**
   * Normalize flexible column headers into standardized keys
   */
  public normalizeColumnHeader(header: string): string {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Day
    if (h.includes('day') || h.includes('weekday')) return 'day_of_week';

    // Period
    if (h.includes('period') || h.includes('slot') || h.includes('lectureno') || h === 'p' || h === 'no') return 'period_number';

    // Start / End Times
    if (h.includes('start') || h === 'from' || h.includes('starttime')) return 'start_time';
    if (h.includes('end') || h === 'to' || h.includes('endtime')) return 'end_time';
    if (h.includes('time') || h.includes('timing')) return 'time_range';

    // Subject
    if (h.includes('subjectcode') || h.includes('coursecode') || h === 'code') return 'subject_code';
    if (h.includes('subjectname') || h.includes('coursename') || h.includes('subjecttitle') || h === 'subject') return 'subject_name';

    // Faculty
    if (h.includes('facultycode') || h.includes('teachercode') || h.includes('initials') || h === 'faccode') return 'faculty_code';
    if (h.includes('faculty') || h.includes('teacher') || h.includes('instructor') || h.includes('prof') || h.includes('professor')) return 'faculty_name';

    // Room
    if (h.includes('room') || h.includes('classroom') || h.includes('lab') || h === 'hall') return 'room_number';

    // Lecture Type
    if (h.includes('type') || h.includes('format') || h.includes('mode')) return 'lecture_type';

    // Section
    if (h.includes('section') || h === 'sec') return 'section_name';

    return h;
  }

  /**
   * Standard period timing lookup
   */
  public getStandardTimeForPeriod(period: number): { start: string; end: string } {
    switch (period) {
      case 1: return { start: '09:00', end: '09:50' };
      case 2: return { start: '09:50', end: '10:40' };
      case 3: return { start: '10:40', end: '11:30' };
      case 4: return { start: '11:30', end: '12:20' };
      case 5: return { start: '12:20', end: '13:10' }; // Lunch
      case 6: return { start: '13:10', end: '14:00' };
      case 7: return { start: '14:00', end: '14:50' };
      case 8: return { start: '14:50', end: '15:40' };
      default: return { start: '09:00', end: '09:50' };
    }
  }

  /**
   * Normalize day name to DayOfWeek ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT')
   */
  public normalizeDay(raw: string): DayOfWeek | null {
    if (!raw) return null;
    const clean = raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.startsWith('MON')) return 'MON';
    if (clean.startsWith('TUE')) return 'TUE';
    if (clean.startsWith('WED')) return 'WED';
    if (clean.startsWith('THU')) return 'THU';
    if (clean.startsWith('FRI')) return 'FRI';
    if (clean.startsWith('SAT')) return 'SAT';
    if (clean.startsWith('SUN')) return 'SUN';
    return null;
  }

  /**
   * Parse and validate CSV text against database context
   */
  public parseAndValidateCSV(
    csvText: string,
    context: {
      targetSection: Section;
      subjects: Subject[];
      faculty: Faculty[];
    }
  ): CSVValidationResult {
    const lines = this.parseCSVLines(csvText);
    const errors: string[] = [];
    const warnings: string[] = [];
    const entries: ValidatedCSVTimetableEntry[] = [];
    const dayBreakdown: Record<string, number> = {
      MON: 0,
      TUE: 0,
      WED: 0,
      THU: 0,
      FRI: 0,
      SAT: 0,
    };

    if (lines.length < 2) {
      return {
        valid: false,
        errors: ['CSV file must contain a header row and at least one schedule entry row.'],
        warnings: [],
        totalSlots: 0,
        dayBreakdown,
        entries: [],
      };
    }

    const rawHeaders = lines[0];
    const headerKeys = rawHeaders.map(h => this.normalizeColumnHeader(h));

    // Helper to find column index
    const colIdx = (key: string) => headerKeys.indexOf(key);

    const dayIdx = colIdx('day_of_week');
    const periodIdx = colIdx('period_number');
    const subCodeIdx = colIdx('subject_code');
    const subNameIdx = colIdx('subject_name');
    const facNameIdx = colIdx('faculty_name');
    const facCodeIdx = colIdx('faculty_code');
    const roomIdx = colIdx('room_number');
    const typeIdx = colIdx('lecture_type');
    const startIdx = colIdx('start_time');
    const endIdx = colIdx('end_time');
    const timeRangeIdx = colIdx('time_range');

    if (dayIdx === -1 && periodIdx === -1) {
      return {
        valid: false,
        errors: ['CSV is missing required Day and Period columns. Please ensure columns such as "Day" and "Period" are present.'],
        warnings: [],
        totalSlots: 0,
        dayBreakdown,
        entries: [],
      };
    }

    const defaultRoom = context.targetSection?.room_number || `Room ${context.targetSection?.name || 'A'}`;
    const seenSlots = new Set<string>();

    for (let rowNum = 1; rowNum < lines.length; rowNum++) {
      const row = lines[rowNum];
      if (row.length === 0 || row.every(c => !c.trim())) continue;

      const rawDay = dayIdx >= 0 ? row[dayIdx] : '';
      const day = this.normalizeDay(rawDay);
      if (!day || day === 'SUN') {
        errors.push(`Row ${rowNum + 1}: Invalid academic weekday "${rawDay}". Expected Monday through Saturday.`);
        continue;
      }

      const rawPeriod = periodIdx >= 0 ? row[periodIdx] : '';
      const periodNumber = parseInt(rawPeriod.replace(/[^0-9]/g, ''), 10);
      if (isNaN(periodNumber) || periodNumber < 1 || periodNumber > 8) {
        errors.push(`Row ${rowNum + 1}: Invalid period number "${rawPeriod}". Expected period between 1 and 8.`);
        continue;
      }

      if (periodNumber === 5) {
        // Skip lunch slot if explicitly entered
        continue;
      }

      const slotKey = `${day}-${periodNumber}`;
      if (seenSlots.has(slotKey)) {
        errors.push(`Row ${rowNum + 1}: Duplicate schedule slot for ${day} Period ${periodNumber}.`);
        continue;
      }
      seenSlots.add(slotKey);

      // Subject code & name
      let subCode = subCodeIdx >= 0 ? row[subCodeIdx]?.trim() : '';
      let subName = subNameIdx >= 0 ? row[subNameIdx]?.trim() : '';
      if (!subCode && subName) {
        subCode = subName;
      }
      if (!subCode) {
        errors.push(`Row ${rowNum + 1}: Missing subject for ${day} Period ${periodNumber}.`);
        continue;
      }

      // Faculty name & code
      let facName = facNameIdx >= 0 ? row[facNameIdx]?.trim() : '';
      let facCode = facCodeIdx >= 0 ? row[facCodeIdx]?.trim() : '';
      if (!facName && facCode) {
        facName = facCode;
      }
      if (!facName && !facCode) {
        facName = 'Faculty';
        facCode = 'FAC';
      }

      // Room Number
      const room = (roomIdx >= 0 && row[roomIdx]?.trim()) ? row[roomIdx].trim() : defaultRoom;

      // Lecture Type
      let lectureType: LectureType = 'Theory';
      const rawType = (typeIdx >= 0 && row[typeIdx]?.trim()) ? row[typeIdx].trim().toLowerCase() : '';
      if (rawType.includes('lab') || rawType.includes('practical')) {
        lectureType = 'Practical';
      } else if (rawType.includes('workshop') || rawType.includes('ws')) {
        lectureType = 'Workshop';
      } else if (rawType.includes('project')) {
        lectureType = 'Project';
      } else if (rawType.includes('tutorial') || rawType.includes('tut')) {
        lectureType = 'Tutorial';
      }

      // Timings
      let startTime = startIdx >= 0 ? row[startIdx]?.trim() : '';
      let endTime = endIdx >= 0 ? row[endIdx]?.trim() : '';

      if ((!startTime || !endTime) && timeRangeIdx >= 0 && row[timeRangeIdx]) {
        const parts = row[timeRangeIdx].split(/[-–—to]/i).map(s => s.trim());
        if (parts.length >= 2) {
          startTime = parts[0];
          endTime = parts[1];
        }
      }

      if (!startTime || !endTime) {
        const standard = this.getStandardTimeForPeriod(periodNumber);
        startTime = standard.start;
        endTime = standard.end;
      }

      // Deterministic database resolution for Subject
      const matchedSubject = this.findMatchingSubject(subCode, subName, context.subjects);
      const matchedFaculty = this.findMatchingFaculty(facCode, facName, context.faculty);

      entries.push({
        day_of_week: day,
        period_number: periodNumber,
        start_time: startTime,
        end_time: endTime,
        subject_code: matchedSubject?.subject_code || subCode.toUpperCase(),
        subject_name: matchedSubject?.subject_name || subName || subCode,
        subject_id: matchedSubject?.id,
        faculty_code: matchedFaculty?.faculty_code || facCode.toUpperCase(),
        faculty_name: matchedFaculty?.full_name || facName,
        faculty_id: matchedFaculty?.id,
        room_number: room,
        lecture_type: lectureType,
      });

      dayBreakdown[day] = (dayBreakdown[day] || 0) + 1;
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        warnings,
        totalSlots: entries.length,
        dayBreakdown,
        entries: [],
      };
    }

    return {
      valid: true,
      errors: [],
      warnings,
      totalSlots: entries.length,
      dayBreakdown,
      entries,
    };
  }

  /**
   * Deterministic fuzzy subject resolution
   */
  public findMatchingSubject(code: string, name: string, subjects: Subject[]): Subject | undefined {
    const cleanCode = (code || '').toUpperCase().replace(/[\s\-_]/g, '');
    const cleanName = (name || code || '').toLowerCase().trim();

    return subjects.find(s => {
      const sCode = s.subject_code.toUpperCase().replace(/[\s\-_]/g, '');
      if (sCode === cleanCode) return true;
      if (cleanCode === 'DS' && sCode === 'BCS301') return true;
      if (cleanCode === 'COA' && sCode === 'BCS302') return true;
      if (cleanCode === 'DSTL' && sCode === 'BCS303') return true;
      if ((cleanCode === 'M4' || cleanCode === 'MATHS4' || cleanCode === 'MATHSIV') && sCode === 'BAS303') return true;
      if (cleanCode === 'UHV' && sCode === 'BVE301') return true;
      if (cleanCode === 'DSLAB' && sCode === 'BCS351') return true;
      if (cleanCode === 'COALAB' && sCode === 'BCS352') return true;
      if (cleanCode === 'DSTLLAB' && sCode === 'BCS353') return true;
      if ((cleanCode === 'CS' || cleanCode === 'CYBER') && sCode === 'BCC301') return true;
      if ((cleanCode === 'CSLAB' || cleanCode === 'CYBERLAB') && sCode === 'BCC351') return true;

      const sName = s.subject_name.toLowerCase();
      if (cleanName && (sName.includes(cleanName) || cleanName.includes(sName))) return true;
      return false;
    });
  }

  /**
   * Deterministic fuzzy faculty resolution
   */
  public findMatchingFaculty(code: string, name: string, facultyList: Faculty[]): Faculty | undefined {
    const cleanCode = (code || '').toUpperCase().trim();
    const cleanName = (name || code || '').toLowerCase().replace(/mr\.|ms\.|dr\.|prof\./g, '').trim();

    return facultyList.find(f => {
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
      if (cleanName && (fClean.includes(cleanName) || cleanName.includes(fClean))) return true;
      const initials = fClean.split(/\s+/).map(w => w[0]).join('').toUpperCase();
      if (initials === cleanCode) return true;
      return false;
    });
  }
}

export const csvTimetableService = CSVTimetableService.getInstance();

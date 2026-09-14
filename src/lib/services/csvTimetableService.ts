import { DayOfWeek, LectureType, Section, Subject, Faculty } from '../../types/database.types';
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
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
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

  public parseAndValidateCSV(csvText: string, context: { targetSection: Section; subjects: Subject[]; faculty: Faculty[] }): CSVValidationResult {
    const lines = this.parseCSVLines(csvText);
    const format = this.detectFormat(lines);
    if (format === 'matrix') {
      return this.parseMatrixCSV(lines, context);
    }
    const errors: string[] = [];
    const warnings: string[] = [];
    const entries: ValidatedCSVTimetableEntry[] = [];
    const dayBreakdown: Record<string, number> = {};
    if (lines.length < 2) return { valid: false, errors: ['CSV must contain a header row and at least one timetable row.'], warnings, totalSlots: 0, dayBreakdown, entries };

    const keys = lines[0].map(this.normalizeColumnHeader);
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

    if (dayIdx < 0 || periodIdx < 0) return { valid: false, errors: ['CSV must contain Day and Period columns.'], warnings, totalSlots: 0, dayBreakdown, entries };

    const seen = new Set<string>();
    for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
      const row = lines[rowIndex];
      const line = rowIndex + 1;
      const day = this.normalizeDay(row[dayIdx]);
      if (!day || day === 'SUN') { errors.push(`Row ${line}: invalid weekday.`); continue; }

      const periodNumber = Number.parseInt(String(row[periodIdx] || '').replace(/[^0-9]/g, ''), 10);
      if (!Number.isInteger(periodNumber) || periodNumber < 1) { errors.push(`Row ${line}: invalid period number.`); continue; }

      let start = startIdx >= 0 ? (row[startIdx] || '').trim() : '';
      let end = endIdx >= 0 ? (row[endIdx] || '').trim() : '';
      if ((!start || !end) && rangeIdx >= 0) {
        const match = String(row[rangeIdx] || '').match(/^\s*(\d{1,2}:\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2})\s*$/i);
        if (match) { start = match[1]; end = match[2]; }
      }
      if (!start || !end) { errors.push(`Row ${line}: start_time and end_time are required; no default timetable time is assumed.`); continue; }
      if (start >= end) { errors.push(`Row ${line}: end_time must be after start_time.`); continue; }

      const subCode = codeIdx >= 0 ? (row[codeIdx] || '').trim() : '';
      const subName = nameIdx >= 0 ? (row[nameIdx] || '').trim() : '';
      const rawType = typeIdx >= 0 ? (row[typeIdx] || '').trim().toLowerCase() : '';
      const isBreak = rawType.includes('break') || rawType.includes('lunch') || subName.toLowerCase().includes('lunch') || subCode.toLowerCase() === 'lunch';
      if (!isBreak && !subCode && !subName) { errors.push(`Row ${line}: subject code or subject name is required.`); continue; }

      const facCode = facCodeIdx >= 0 ? (row[facCodeIdx] || '').trim() : '';
      const facName = facNameIdx >= 0 ? (row[facNameIdx] || '').trim() : '';
      if (!isBreak && !facCode && !facName) { errors.push(`Row ${line}: faculty code or faculty name is required.`); continue; }

      const matchedSubject = isBreak ? undefined : this.findMatchingSubject(subCode, subName, context.subjects);
      if (!isBreak && !matchedSubject) { errors.push(`Row ${line}: subject "${subCode || subName}" does not match an active subject in the selected academic scope.`); continue; }
      const matchedFaculty = isBreak ? undefined : this.findMatchingFaculty(facCode, facName, context.faculty);
      if (!isBreak && !matchedFaculty) { errors.push(`Row ${line}: faculty "${facCode || facName}" does not match an active faculty record.`); continue; }

      const slotKey = `${day}-${periodNumber}`;
      if (seen.has(slotKey)) { errors.push(`Row ${line}: duplicate slot ${day} Period ${periodNumber}.`); continue; }
      seen.add(slotKey);
      dayBreakdown[day] = (dayBreakdown[day] || 0) + 1;

      let lectureType: LectureType = 'Theory';
      if (rawType.includes('lab') || rawType.includes('practical')) lectureType = 'Practical';
      else if (rawType.includes('workshop')) lectureType = 'Workshop';
      else if (rawType.includes('project')) lectureType = 'Project';
      else if (rawType.includes('tutorial')) lectureType = 'Tutorial';

      entries.push({
        day_of_week: day,
        period_number: periodNumber,
        start_time: start,
        end_time: end,
        subject_code: matchedSubject?.subject_code || subCode,
        subject_name: matchedSubject?.subject_name || subName,
        subject_id: matchedSubject?.id,
        faculty_code: matchedFaculty?.faculty_code || matchedFaculty?.employee_code || facCode,
        faculty_name: matchedFaculty?.full_name || facName,
        faculty_id: matchedFaculty?.id,
        room_number: (roomIdx >= 0 ? row[roomIdx]?.trim() : '') || context.targetSection.room_number || '',
        lecture_type: lectureType,
      });
    }

    if (!entries.length && !errors.length) errors.push('No timetable rows were found.');
    return { valid: errors.length === 0, errors, warnings, totalSlots: entries.length, dayBreakdown, entries: errors.length ? [] : entries };
  }

  public findMatchingSubject(code: string, name: string, subjects: Subject[]): Subject | undefined {
    const cleanCode = (code || '').toUpperCase().replace(/[\s\-_]/g, '');
    const cleanName = (name || '').toLowerCase().trim();
    return subjects.find(subject => {
      const subjectCode = subject.subject_code.toUpperCase().replace(/[\s\-_]/g, '');
      const subjectName = subject.subject_name.toLowerCase().trim();
      return (cleanCode && subjectCode === cleanCode) || (cleanName && (subjectName === cleanName || subjectName.includes(cleanName) || cleanName.includes(subjectName)));
    });
  }

  public findMatchingFaculty(code: string, name: string, facultyList: Faculty[]): Faculty | undefined {
    const cleanCode = (code || '').toUpperCase().trim();
    const cleanName = (name || '').toLowerCase().replace(/mr\.|ms\.|mrs\.|dr\.|prof\./g, '').replace(/\s+/g, ' ').trim();
    return facultyList.find(faculty => {
      const facultyCodes = [faculty.faculty_code, faculty.employee_code].filter(Boolean).map(value => value!.toUpperCase().trim());
      const facultyName = faculty.full_name.toLowerCase().replace(/mr\.|ms\.|mrs\.|dr\.|prof\./g, '').replace(/\s+/g, ' ').trim();
      return (cleanCode && facultyCodes.includes(cleanCode)) || (cleanName && (facultyName === cleanName || facultyName.includes(cleanName) || cleanName.includes(facultyName)));
    });
  }

  // Detect CSV format (matrix vs normalized)
  private detectFormat(lines: string[][]): 'matrix' | 'normalized' {
    if (lines.length < 2) return 'normalized';
    const header = lines[5] || lines[0];
    const firstCell = header[0]?.toLowerCase() || '';
    const hasDayTime = firstCell.includes('day') && firstCell.includes('time');
    const periodCols = header.slice(1).some(col => /^\s*[IVX]+\s*\(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\)\s*$/i.test(col.trim()));
    return hasDayTime && periodCols ? 'matrix' : 'normalized';
  }

  // Parse matrix‑style CSV (metadata + day rows + period columns)
  private parseMatrixCSV(lines: string[][], context: { targetSection: Section; subjects: Subject[]; faculty: Faculty[] }): CSVValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const entries: ValidatedCSVTimetableEntry[] = [];
    const dayBreakdown: Record<string, number> = {};

    // ---- Metadata validation ----
    const metaLines = lines.slice(0, 5);
    const sectionMatch = metaLines[2]?.join(' ')?.match(/Section:\s*([^.]*)/i);
    const roomMatch = metaLines[3]?.join(' ')?.match(/Room No\.:\s*([^.]*)/i);
    if (sectionMatch) {
      const csvSection = sectionMatch[1].trim();
      if (csvSection !== context.targetSection.name) {
        errors.push(`CSV metadata section "${csvSection}" does not match selected section "${context.targetSection.name}".`);
      }
    }
    if (roomMatch) {
      const csvRoom = roomMatch[1].trim();
      const sectionRoom = context.targetSection.room_number?.trim() || '';
      if (csvRoom && csvRoom !== sectionRoom) {
        errors.push(`CSV classroom "${csvRoom}" does not match the selected section's room "${sectionRoom}".`);
      }
    }

    // ---- Header row (expected at index 5) ----
    const header = lines[5];
    if (!header) {
      errors.push('Matrix CSV missing header row at expected position.');
      return { valid: false, errors, warnings, totalSlots: 0, dayBreakdown, entries: [] };
    }

    // Build period map: column index -> { periodNumber, start, end }
    const periodMap: Record<number, { periodNumber: number; start: string; end: string }> = {};
    header.slice(1).forEach((col, idx) => {
      const match = col.trim().match(/^([IVX]+)\s*\((\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\)$/i);
      if (match) {
        const roman = match[1].toUpperCase();
        const start = match[2];
        const end = match[3];
        const periodNumber = this.romanToNumber(roman);
        if (periodNumber) {
          periodMap[idx + 1] = { periodNumber, start, end };
        } else {
          warnings.push(`Unrecognised period label "${roman}" in header.`);
        }
      } else {
        warnings.push(`Header column ${idx + 2} does not match expected period pattern.`);
      }
    });

    // ---- Day rows (starting at index 6) ----
    for (let i = 6; i < lines.length; i++) {
      const row = lines[i];
      if (!row || row.length === 0) continue;
      const dayRaw = row[0];
      const day = this.normalizeDay(dayRaw);
      if (!day || day === 'SUN') {
        errors.push(`Row ${i + 1}: invalid or missing day label "${dayRaw}".`);
        continue;
      }
      for (let colIdx = 1; colIdx < row.length; colIdx++) {
        const cell = row[colIdx]?.trim();
        if (!cell) continue; // empty slot
        const periodInfo = periodMap[colIdx];
        if (!periodInfo) {
          warnings.push(`No period info for column ${colIdx + 1} (row ${i + 1}).`);
          continue;
        }
        const lowerCell = cell.toLowerCase();
        const isBreak = lowerCell.includes('lunch') || lowerCell.includes('break') || lowerCell.includes('sports') || lowerCell.includes('holiday') || lowerCell.includes('vacation');
        let subjectToken = '';
        let facultyCode = '';
        if (!isBreak) {
          const splitMatch = cell.match(/^([^\(]+)\s*\(([^)]+)\)\s*$/);
          if (splitMatch) {
            subjectToken = splitMatch[1].trim();
            facultyCode = splitMatch[2].trim();
          } else {
            subjectToken = cell;
          }
        }
        const matchedSubject = isBreak ? undefined : this.findMatchingSubject(facultyCode, subjectToken, context.subjects);
        if (!isBreak && !matchedSubject) {
          errors.push(`Row ${i + 1}, ${day} Period ${periodInfo.periodNumber}: subject "${subjectToken}" not found.`);
          continue;
        }
        const matchedFaculty = isBreak ? undefined : this.findMatchingFaculty(facultyCode, subjectToken, context.faculty);
        if (!isBreak && !matchedFaculty) {
          errors.push(`Row ${i + 1}, ${day} Period ${periodInfo.periodNumber}: faculty "${facultyCode}" not found.`);
          continue;
        }
        // Duplicate detection within matrix
        if (entries.find(e => e.day_of_week === day && e.period_number === periodInfo.periodNumber)) {
          errors.push(`Duplicate entry for ${day} Period ${periodInfo.periodNumber}.`);
          continue;
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
          faculty_code: matchedFaculty?.faculty_code || facultyCode,
          faculty_name: matchedFaculty?.full_name || facultyCode,
          faculty_id: matchedFaculty?.id,
          room_number: context.targetSection.room_number || '',
          lecture_type: isBreak ? 'Other' : 'Theory',
        });
      }
    }

    if (!entries.length && !errors.length) errors.push('No timetable rows were found in matrix CSV.');
    return { valid: errors.length === 0, errors, warnings, totalSlots: entries.length, dayBreakdown, entries: errors.length ? [] : entries };
  }

  // Convert Roman numerals (I, II, III, …) to period numbers
  private romanToNumber(roman: string): number | null {
    const map: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
    const clean = roman.replace(/\s+/g, '').toUpperCase();
    return map[clean] || null;
  }
}

export const csvTimetableService = CSVTimetableService.getInstance();

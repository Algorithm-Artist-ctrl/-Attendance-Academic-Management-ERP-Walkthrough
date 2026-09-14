import { DayOfWeek, LectureType } from '../../types/database.types';

export interface TimetableMetadata {
  institution?: string;
  academicSession?: string;
  semesterType?: string;
  program?: string;
  branch?: string;
  section?: string;
  academicYear?: string;
  effectiveDate?: string; // YYYY-MM-DD
  classIncharge?: string;
  room?: string;
}

export interface PeriodInfo {
  label: string;
  startTime: string; // "09:00"
  endTime: string;   // "09:50"
}

export interface RawTimetableEntry {
  day: DayOfWeek;
  period: number;
  startTime: string;
  endTime: string;
  subjectRef?: string; // e.g. "DS" or full subject name
  facultyRef?: string; // e.g. "HEM" or full name
  lectureType: LectureType;
}

export interface ParsedTimetable {
  metadata: TimetableMetadata;
  periods: PeriodInfo[];
  entries: RawTimetableEntry[];
  subjectMappings: Array<{ code: string; name: string; faculty: string }>;
}

/**
 * Parses the VCTM CSV format used for Section B timetables.
 * The parser walks the file line‑by‑line, extracts metadata, period headers,
 * the timetable matrix, and the reference table at the end.
 */
export function parseSectionTimetable(csvText: string): ParsedTimetable {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) throw new Error('CSV is empty');

  const metadata: TimetableMetadata = {};
  let i = 0;

  // ---- 1️⃣ Metadata block ----------------------------------------------------
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/DAY\s*\/\s*TIME/i.test(line)) break; // reached matrix header
    if (/^VIVEKANANDA/i.test(line)) metadata.institution = line;
    else if (/TIME TABLE/i.test(line)) metadata.academicSession = line;
    else if (/Degree Program:/i.test(line)) metadata.program = line.split(':')[1].trim();
    else if (/Branch:/i.test(line)) metadata.branch = line.split(':')[1].trim();
    else if (/Section:/i.test(line)) metadata.section = line.split(':')[1].trim();
    else if (/Year:/i.test(line)) metadata.academicYear = line.split(':')[1].trim();
    else if (/w\.e\.f\./i.test(line)) metadata.effectiveDate = line.split(' ').pop();
    else if (/Class Incharge/i.test(line)) metadata.classIncharge = line.split(':')[1]?.trim();
    else if (/Room No\./i.test(line)) metadata.room = line.split(':')[1]?.trim();
  }

  // ---- 2️⃣ Period header row -------------------------------------------------
  const periodHeaderLine = lines[i];
  const periodMatches = [...periodHeaderLine.matchAll(/([IVX]+)\s*\((\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\)/gi)];
  const periods: PeriodInfo[] = periodMatches.map(m => ({
    label: m[1].toUpperCase(),
    startTime: m[2].padStart(5, '0'),
    endTime: m[3].padStart(5, '0'),
  }));

  // ---- 3️⃣ Timetable matrix -------------------------------------------------
  const entries: RawTimetableEntry[] = [];
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  let rowIdx = i + 1;
  for (; rowIdx < lines.length; rowIdx++) {
    const line = lines[rowIdx];
    if (/^Sub\s*Code/i.test(line)) break; // reference table starts
    const cells = line.split(',').map(c => c.trim());
    const dayCell = cells[0]?.toUpperCase() ?? '';
    const day = dayNames.find(d => dayCell.startsWith(d)) as DayOfWeek;
    if (!day) continue; // skip unexpected rows
    for (let p = 0; p < periods.length; p++) {
      const raw = cells[p + 1] ?? '';
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      const isBreak = /lunch|break|sports|project|workshop/.test(lower);
      const lectureType: LectureType =
        lower.includes('lab') ? 'Practical' :
        lower.includes('workshop') ? 'Workshop' :
        lower.includes('project') ? 'Project' :
        isBreak ? 'Break' : 'Theory';

      const subjectFacMatch = trimmed.match(/^([^()]+)\s*\(([^)]+)\)$/);
      let subjectRef: string | undefined;
      let facultyRef: string | undefined;
      if (subjectFacMatch) {
        subjectRef = subjectFacMatch[1].trim();
        facultyRef = subjectFacMatch[2].trim();
      } else if (!isBreak) {
        subjectRef = trimmed;
      }

      entries.push({
        day,
        period: p + 1,
        startTime: periods[p].startTime,
        endTime: periods[p].endTime,
        subjectRef,
        facultyRef,
        lectureType,
      });
    }
  }

  // ---- 4️⃣ Reference table (subject code ↔ name ↔ faculty) -------------------
  const subjectMappings: Array<{ code: string; name: string; faculty: string }> = [];
  for (; rowIdx < lines.length; rowIdx++) {
    const line = lines[rowIdx];
    if (!line) continue;
    const cols = line.split(',').map(c => c.trim());
    if (cols.length < 3) continue;
    const [code, name, faculty] = cols;
    if (/^Sub\s*Code$/i.test(code)) continue; // header row
    subjectMappings.push({ code, name, faculty });
  }

  return { metadata, periods, entries, subjectMappings };
}

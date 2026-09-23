/**
 * academicYearMapping.ts
 * Centralized utility for Academic Year and Semester / Term mapping.
 * Aligns with AKTU / VCTM academic standards:
 * - 4 Academic Years mapped to 8 Semesters
 * - Year 1: Semesters 1 (ODD) & 2 (EVEN)
 * - Year 2: Semesters 3 (ODD) & 4 (EVEN)
 * - Year 3: Semesters 5 (ODD) & 6 (EVEN)
 * - Year 4: Semesters 7 (ODD) & 8 (EVEN)
 */

export type TermType = 'ODD' | 'EVEN';

export interface YearMapping {
  yearNumber: number;
  yearName: string;
  semesters: number[];
}

export const ACADEMIC_YEAR_MAP: YearMapping[] = [
  { yearNumber: 1, yearName: '1st Year', semesters: [1, 2] },
  { yearNumber: 2, yearName: '2nd Year', semesters: [3, 4] },
  { yearNumber: 3, yearName: '3rd Year', semesters: [5, 6] },
  { yearNumber: 4, yearName: '4th Year', semesters: [7, 8] },
];

/**
 * Returns the two semester numbers corresponding to an academic year number (1..4)
 */
export function getSemestersForYear(yearNumber: number): number[] {
  const mapping = ACADEMIC_YEAR_MAP.find((m) => m.yearNumber === yearNumber);
  if (mapping) return mapping.semesters;
  // Fallback formula for multi-year programs
  const base = (yearNumber - 1) * 2;
  return [base + 1, base + 2];
}

/**
 * Returns the academic year number (1..4) for a given semester number (1..8)
 */
export function getYearForSemester(semNumber: number): number {
  if (semNumber <= 0) return 1;
  return Math.ceil(semNumber / 2);
}

/**
 * Returns the term type ('ODD' | 'EVEN') for a given semester number
 */
export function getTermType(semNumber: number): TermType {
  return semNumber % 2 !== 0 ? 'ODD' : 'EVEN';
}

/**
 * Returns a human-friendly name for a year number (e.g. 1 -> "1st Year")
 */
export function getYearName(yearNumber: number): string {
  switch (yearNumber) {
    case 1:
      return '1st Year';
    case 2:
      return '2nd Year';
    case 3:
      return '3rd Year';
    case 4:
      return '4th Year';
    default:
      return `Year ${yearNumber}`;
  }
}

/**
 * Returns a human-friendly name for a semester number (e.g. 1 -> "Semester 1")
 */
export function getSemesterName(semNumber: number): string {
  return `Semester ${semNumber}`;
}

/**
 * Returns list of semester numbers matching a specific term type (ODD or EVEN)
 * For a standard 4-year degree (8 semesters):
 * - ODD -> [1, 3, 5, 7]
 * - EVEN -> [2, 4, 6, 8]
 */
export function getSemestersForTerm(termType: TermType, maxYears: number = 4): number[] {
  const sems: number[] = [];
  const totalSemesters = maxYears * 2;
  for (let s = 1; s <= totalSemesters; s++) {
    if (getTermType(s) === termType) {
      sems.push(s);
    }
  }
  return sems;
}

/**
 * Dynamically suggests the current academic term (ODD or EVEN) based on date.
 * Standard AKTU / VCTM academic calendar:
 * - ODD Term (Sem 1, 3, 5, 7): July 1st through December 31st (Month 6 to 11 in 0-indexed Date)
 * - EVEN Term (Sem 2, 4, 6, 8): January 1st through June 30th (Month 0 to 5 in 0-indexed Date)
 */
export function suggestAcademicTerm(currentDate: Date = new Date()): {
  termType: TermType;
  activeSemesters: number[];
  reason: string;
} {
  const month = currentDate.getMonth(); // 0 = Jan, 11 = Dec
  // July (6) to December (11) is ODD Term
  const isOdd = month >= 6 && month <= 11;
  const termType: TermType = isOdd ? 'ODD' : 'EVEN';
  const activeSemesters = getSemestersForTerm(termType);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const reason = isOdd
    ? `Current month is ${monthName} (July–Dec calendar window). Institutional standard schedules ODD Semesters (1, 3, 5, 7).`
    : `Current month is ${monthName} (January–June calendar window). Institutional standard schedules EVEN Semesters (2, 4, 6, 8).`;

  return {
    termType,
    activeSemesters,
    reason,
  };
}

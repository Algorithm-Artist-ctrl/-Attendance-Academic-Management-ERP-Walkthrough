import { DayOfWeek } from '../../types/database.types';
import { INSTITUTION_TIMEZONE } from '../../config/academicConfig';

// Format current date in Asia/Kolkata (IST) college timezone as YYYY-MM-DD
export function getCollegeToday(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INSTITUTION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || String(now.getFullYear());
  const month = parts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1).padStart(2, '0');
  const day = parts.find(p => p.type === 'day')?.value || String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get yesterday's date in Asia/Kolkata college timezone as YYYY-MM-DD
export function getCollegeYesterday(): string {
  return getRelativeDate(getCollegeToday(), -1);
}

// Backward-compatible alias
export const getISTTodayDate = getCollegeToday;

// Get day of week code ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN') in Asia/Kolkata (IST)
export function getISTDayOfWeek(dateStr?: string): DayOfWeek {
  let date: Date;

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Use UTC noon to guarantee timezone independence when converting to Asia/Kolkata
    date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  } else if (dateStr) {
    date = new Date(dateStr);
  } else {
    date = new Date();
  }

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(date).toUpperCase();

  if (weekday.startsWith('SUN')) return 'SUN';
  if (weekday.startsWith('MON')) return 'MON';
  if (weekday.startsWith('TUE')) return 'TUE';
  if (weekday.startsWith('WED')) return 'WED';
  if (weekday.startsWith('THU')) return 'THU';
  if (weekday.startsWith('FRI')) return 'FRI';
  if (weekday.startsWith('SAT')) return 'SAT';
  return 'SUN';
}

// Format 24-hour time to 12-hour AM/PM
export function formatTime12H(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// Format date nicely (e.g. 22 Aug 2026, Saturday)
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatTimeAgo(isoString?: string): string {
  if (!isoString) return 'Just now';
  try {
    const diff = (new Date().getTime() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  } catch {
    return 'Recently';
  }
}

const WEEKDAY_ORDER: Record<DayOfWeek, number> = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
  SUN: 6,
};

// Computes the exact calendar date (YYYY-MM-DD) for a weekday in the week of the reference date
export function getDateForWeekdayInCurrentWeek(targetDay: DayOfWeek, refDateStr?: string): string {
  const baseStr = refDateStr || getISTTodayDate();
  const [y, m, d] = baseStr.split('-').map(Number);
  // UTC noon avoids any timezone or daylight boundary shift
  const refDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const jsDay = refDate.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const refIndex = jsDay === 0 ? 6 : jsDay - 1; // Mon=0..Sun=6
  const targetIndex = WEEKDAY_ORDER[targetDay];
  const diffDays = targetIndex - refIndex;
  const targetDate = new Date(refDate.getTime() + diffDays * 86400000);
  return targetDate.toISOString().split('T')[0];
}

// Relative date arithmetic (e.g. -1 for previous day, +1 for next day)
export function getRelativeDate(baseDateStr: string, offsetDays: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + offsetDays, 12, 0, 0));
  return date.toISOString().split('T')[0];
}

// Full descriptive date format (e.g. "Wednesday, 16 September 2026")
export function formatDateFull(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return date.toLocaleDateString('en-GB', {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function isDateInFuture(dateStr: string, refDateStr?: string): boolean {
  const base = refDateStr || getISTTodayDate();
  return dateStr > base;
}

export function isDateInPast(dateStr: string, refDateStr?: string): boolean {
  const base = refDateStr || getISTTodayDate();
  return dateStr < base;
}

export function isDateToday(dateStr: string, refDateStr?: string): boolean {
  const base = refDateStr || getISTTodayDate();
  return dateStr === base;
}

// ==============================================================================
// STUDENT ATTENDANCE CLAIM TIME WINDOW (09:00:00 AM -> 03:40:00 PM IST)
// ==============================================================================
export const CLAIM_WINDOW_START_TIME = '09:00:00';
export const CLAIM_WINDOW_END_TIME = '15:40:00'; // 03:40 PM IST

export type ClaimWindowStatus = 'BEFORE_WINDOW' | 'OPEN' | 'CLOSED';

// Returns current time in Asia/Kolkata (IST) in "HH:mm:ss" format (24-hour)
export function getISTCurrentTimeString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INSTITUTION_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const h = parts.find(p => p.type === 'hour')?.value || '00';
  const m = parts.find(p => p.type === 'minute')?.value || '00';
  const s = parts.find(p => p.type === 'second')?.value || '00';

  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

// Determines if student attendance claim window is open, before window, or closed
export function getClaimWindowStatus(customTimeOrDate?: Date | string): ClaimWindowStatus {
  let timeStr: string;

  if (typeof customTimeOrDate === 'string' && customTimeOrDate.includes(':')) {
    const segments = customTimeOrDate.split(':');
    const h = segments[0].padStart(2, '0');
    const m = (segments[1] || '00').padStart(2, '0');
    const s = (segments[2] || '00').padStart(2, '0');
    timeStr = `${h}:${m}:${s}`;
  } else if (customTimeOrDate instanceof Date) {
    timeStr = getISTCurrentTimeString(customTimeOrDate);
  } else {
    timeStr = getISTCurrentTimeString(new Date());
  }

  if (timeStr < CLAIM_WINDOW_START_TIME) {
    return 'BEFORE_WINDOW';
  }
  if (timeStr >= CLAIM_WINDOW_END_TIME) {
    return 'CLOSED';
  }
  return 'OPEN';
}

// Returns true strictly between 09:00:00 AM and 03:39:59 PM IST
export function isClaimWindowOpen(customTimeOrDate?: Date | string): boolean {
  return getClaimWindowStatus(customTimeOrDate) === 'OPEN';
}

// Normalize time string to standard "HH:mm:ss" (24-hour)
export function normalizeTimeHHMMSS(timeStr: string): string {
  if (!timeStr) return '00:00:00';
  const clean = timeStr.trim();
  const parts = clean.split(':');
  const h = (parts[0] || '0').padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export type ClassTimingStatus = 'FUTURE' | 'ONGOING' | 'COMPLETED';

// Determines whether a lecture is in the future, ongoing, or completed relative to IST
export function getClassTimingStatus(params: {
  startTime: string;
  endTime: string;
  sessionDate?: string;
  currentTimeIST?: string;
  currentDateIST?: string;
}): ClassTimingStatus {
  const currentDate = params.currentDateIST || getCollegeToday();
  const sessionDate = params.sessionDate || currentDate;

  // Past dates are completed
  if (sessionDate < currentDate) {
    return 'COMPLETED';
  }
  // Future dates are upcoming
  if (sessionDate > currentDate) {
    return 'FUTURE';
  }

  // Same day (Today): compare times in Asia/Kolkata (IST)
  const currentTime = params.currentTimeIST ? normalizeTimeHHMMSS(params.currentTimeIST) : getISTCurrentTimeString();
  const startTime = normalizeTimeHHMMSS(params.startTime);
  const endTime = normalizeTimeHHMMSS(params.endTime);

  if (currentTime < startTime) {
    return 'FUTURE';
  }
  if (currentTime >= endTime) {
    return 'COMPLETED';
  }
  return 'ONGOING';
}

// Returns true only if the lecture has strictly reached or passed its end time
export function isClassCompleted(params: {
  startTime?: string;
  endTime: string;
  sessionDate?: string;
  currentTimeIST?: string;
  currentDateIST?: string;
}): boolean {
  return getClassTimingStatus({
    startTime: params.startTime || '00:00:00',
    endTime: params.endTime,
    sessionDate: params.sessionDate,
    currentTimeIST: params.currentTimeIST,
    currentDateIST: params.currentDateIST,
  }) === 'COMPLETED';
}

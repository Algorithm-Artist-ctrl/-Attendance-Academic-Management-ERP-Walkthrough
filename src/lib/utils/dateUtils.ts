import { DayOfWeek } from '../../types/database.types';

// Format current date in Asia/Kolkata (IST) timezone as YYYY-MM-DD
export function getISTTodayDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  const month = parts.find(p => p.type === 'month')?.value || '08';
  const day = parts.find(p => p.type === 'day')?.value || '23';
  return `${year}-${month}-${day}`;
}

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


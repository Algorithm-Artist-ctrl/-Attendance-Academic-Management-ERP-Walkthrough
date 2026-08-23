import { DayOfWeek } from '../../types/database.types';

// Format current date in Asia/Kolkata (IST) timezone as YYYY-MM-DD
export function getISTTodayDate(): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  const month = parts.find(p => p.type === 'month')?.value || '08';
  const day = parts.find(p => p.type === 'day')?.value || '22';
  return `${year}-${month}-${day}`;
}

// Get day of week code ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT') in IST
export function getISTDayOfWeek(dateStr?: string): DayOfWeek {
  const date = dateStr ? new Date(dateStr) : new Date();
  const dayIndex = date.getDay(); // 0 is Sunday, 1 is Monday, ... 6 is Saturday
  
  switch (dayIndex) {
    case 1: return 'MON';
    case 2: return 'TUE';
    case 3: return 'WED';
    case 4: return 'THU';
    case 5: return 'FRI';
    case 6: return 'SAT';
    default: return 'MON'; // Sunday defaults to Monday schedule view
  }
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


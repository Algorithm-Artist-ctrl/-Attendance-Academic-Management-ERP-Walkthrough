import { DayOfWeek } from '../types/database.types';

/**
 * Institutional Academic Configuration
 * Central source of truth for institution-wide academic standards and constants.
 */

// Deployment timezone for Vivekananda College of Technology & Management
export const INSTITUTION_TIMEZONE = 'Asia/Kolkata';

// Official university / institutional minimum attendance eligibility percentage
export const ATTENDANCE_ELIGIBILITY_THRESHOLD = 75;

// Standard institutional period schedule definitions
export interface InstitutionalPeriodDefinition {
  period_number: number;
  name: string;
  start_time: string;
  end_time: string;
  is_break?: boolean;
}

export const DEFAULT_INSTITUTIONAL_PERIODS: InstitutionalPeriodDefinition[] = [
  { period_number: 1, name: 'Period 1', start_time: '09:00', end_time: '09:50' },
  { period_number: 2, name: 'Period 2', start_time: '09:50', end_time: '10:40' },
  { period_number: 3, name: 'Period 3', start_time: '10:40', end_time: '11:30' },
  { period_number: 4, name: 'Period 4', start_time: '11:30', end_time: '12:20' },
  { period_number: 5, name: 'Lunch Break', start_time: '12:20', end_time: '13:10', is_break: true },
  { period_number: 6, name: 'Period 6', start_time: '13:10', end_time: '14:00' },
  { period_number: 7, name: 'Period 7', start_time: '14:00', end_time: '14:50' },
  { period_number: 8, name: 'Period 8', start_time: '14:50', end_time: '15:40' },
];

export const ACADEMIC_DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

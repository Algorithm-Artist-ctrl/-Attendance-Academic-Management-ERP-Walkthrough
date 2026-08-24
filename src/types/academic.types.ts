import { AttendanceStatus, CorrectionStatus, DayOfWeek, LectureType } from './database.types';

export interface SubjectAttendanceStat {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  lectureType: LectureType;
  facultyName: string;
  totalConducted: number;
  attended: number;
  percentage: number;
  credits: number;
}

export interface StudentOverallAttendance {
  studentId: string;
  rollNumber: string;
  fullName: string;
  sectionName: string;
  totalLectures: number;
  presentLectures: number;
  percentage: number;
  isDefaulter: boolean; // Below 75%
  subjectStats: SubjectAttendanceStat[];
}

export interface TodayLectureItem {
  timetableEntryId: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  facultyCode?: string;
  roomNumber: string;
  lectureType: LectureType;
  sectionName: string;
  sectionId: string;
  attendanceTaken: boolean;
  attendanceSessionId?: string;
  studentStatus?: AttendanceStatus | 'Not Recorded';
}

export interface TimetableConflict {
  type: 'faculty' | 'room' | 'section';
  message: string;
  conflictingEntry?: any;
}

export interface ExtractedTimetablePeriod {
  period_number: number;
  start_time: string;
  end_time: string;
  subject_code: string;
  subject_name?: string;
  faculty_code?: string;
  faculty_name?: string;
  room_number?: string;
  lecture_type?: LectureType | 'Break' | 'Library' | 'Sports' | 'Robotics' | 'Workshop' | 'Project' | 'Other';
  is_break?: boolean;
  confidence?: number;
  notes?: string;
}

export interface ExtractedTimetableDay {
  day: DayOfWeek | string;
  periods: ExtractedTimetablePeriod[];
}

export interface ExtractedSubjectMapping {
  subject_code: string;
  subject_name: string;
  faculty_name?: string;
  faculty_code?: string;
  lecture_type?: string;
}

export interface ExtractedFacultyMapping {
  faculty_code: string;
  faculty_name: string;
  subject_code?: string;
}

export interface ExtractedTimetableDocument {
  id?: string;
  source_file_name?: string;
  source_file_url?: string;
  institution_name?: string;
  program_name: string;
  branch_name: string;
  academic_year: string;
  semester: string;
  section_name: string;
  effective_from: string;
  room_number: string;
  class_incharges: string[];
  subject_mappings: ExtractedSubjectMapping[];
  faculty_mappings: ExtractedFacultyMapping[];
  schedule: ExtractedTimetableDay[];
  overall_confidence: number;
  confidence_breakdown?: {
    metadata: number;
    grid: number;
    legend: number;
  };
  warnings?: string[];
  raw_text?: string;
}

export interface TimetableSlotDiff {
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  status: 'NEW' | 'CHANGED' | 'REMOVED' | 'UNCHANGED';
  old_entry?: any;
  new_entry: any;
  changes?: string[];
  conflict?: TimetableConflict;
}


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

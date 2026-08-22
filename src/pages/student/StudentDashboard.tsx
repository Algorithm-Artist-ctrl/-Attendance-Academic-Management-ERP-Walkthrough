import React, { useState } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RotateCcw,
  Sparkles,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { CorrectionRequestModal } from '../../components/correction/CorrectionRequestModal';
import { getISTDayOfWeek, getISTTodayDate, formatDateDisplay, formatTime12H } from '../../lib/utils/dateUtils';
import { AttendanceRecord } from '../../types/database.types';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const { students, attendanceRecords, getStudentAttendance, getTodaySchedule } = useAcademic();

  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<AttendanceRecord | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  const student = students.find(s => s.id === user?.student_id) || students[0];
  const todayDateStr = getISTTodayDate();
  const todayDay = getISTDayOfWeek(todayDateStr);

  const stats = getStudentAttendance(student.id);
  const todaySchedule = getTodaySchedule({
    dayOfWeek: todayDay,
    sectionId: student.section_id,
    studentId: student.id,
    dateStr: todayDateStr,
  });

  const recentRecords = attendanceRecords
    .filter(r => r.student_id === student.id)
    .slice(0, 10);

  const openCorrection = (record: AttendanceRecord) => {
    setSelectedRecordForCorrection(record);
    setIsCorrectionModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Student Profile Card */}
      <div className="bg-gradient-to-r from-vctm-navy-900 to-vctm-navy-800 rounded-2xl p-6 text-white shadow-md border border-vctm-navy-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-400 text-vctm-navy-950 font-black text-2xl flex items-center justify-center shadow-md shrink-0">
              {student.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">{student.full_name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {student.admission_type}
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Roll No: <strong className="text-white">{student.roll_number}</strong></span>
                <span>•</span>
                <span>B.Tech CSE II Year</span>
                <span>•</span>
                <span>Section <strong className="text-amber-300">{student.section?.name}</strong></span>
                <span>•</span>
                <span>Session: <strong>2026–2027</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs bg-vctm-navy-950/60 p-3 rounded-xl border border-vctm-navy-700">
            <div>
              <span className="text-slate-400 block text-[10px]">Class Coordinator:</span>
              <span className="font-semibold text-slate-200">{student.section?.class_coordinator?.full_name || 'Coordinator'}</span>
            </div>
            <div className="border-l border-vctm-navy-700 pl-3">
              <span className="text-slate-400 block text-[10px]">Faculty Mentor:</span>
              <span className="font-semibold text-slate-200">{student.mentor?.full_name || 'Assigned Mentor'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Percentage */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Attendance</span>
            {stats.isDefaulter ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Low (&lt;75%)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Good Standing
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${stats.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {stats.percentage}%
            </span>
            <span className="text-xs text-slate-500">
              ({stats.presentLectures} / {stats.totalLectures} Lectures)
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${stats.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(stats.percentage, 100)}%` }}
            />
          </div>
        </Card>

        {/* Total Lectures Conducted */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conducted Lectures</span>
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900">{stats.totalLectures}</span>
            <span className="text-xs text-slate-500 ml-2">Total Held</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Odd Semester 2026-2027</p>
        </Card>

        {/* Lectures Attended */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attended (Present)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-600">{stats.presentLectures}</span>
            <span className="text-xs text-slate-500 ml-2">Lectures Present</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Verified Attendance</p>
        </Card>

        {/* Absences */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Absences</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-600">{stats.totalLectures - stats.presentLectures}</span>
            <span className="text-xs text-slate-500 ml-2">Missed</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Eligible for correction if missed</p>
        </Card>
      </div>

      {/* Today's Lectures Schedule */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-vctm-navy-700" />
            <span>Today's Lecture Schedule ({formatDateDisplay(todayDateStr)})</span>
          </div>
        }
        subtitle="Live attendance recorded in real-time by your professors"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Time Slot</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Faculty</th>
                <th className="px-4 py-2.5">Room</th>
                <th className="px-4 py-2.5 text-right">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todaySchedule.map((lec) => (
                <tr key={lec.timetableEntryId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    Period {lec.periodNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                    {formatTime12H(lec.startTime)} – {formatTime12H(lec.endTime)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div>{lec.subjectName}</div>
                    <div className="text-xs text-slate-400">{lec.subjectCode} • {lec.lectureType}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs font-medium">
                    {lec.facultyName}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {lec.roomNumber}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AttendanceStatusBadge status={lec.studentStatus || 'Not Recorded'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Subject-Wise Attendance Breakdown Table */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-vctm-navy-700" />
            <span>Subject-Wise Attendance Breakdown</span>
          </div>
        }
        subtitle="Individual course requirements (AKTU Minimum Target: 75%)"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-2.5">Subject Code</th>
                <th className="px-4 py-2.5">Subject Name</th>
                <th className="px-4 py-2.5">Faculty</th>
                <th className="px-4 py-2.5">Credits</th>
                <th className="px-4 py-2.5">Attended / Total</th>
                <th className="px-4 py-2.5">Percentage</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.subjectStats.map((sub) => (
                <tr key={sub.subjectId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">{sub.subjectCode}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{sub.subjectName}</span>
                    <span className="text-[11px] text-slate-400 block">{sub.lectureType}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-medium">{sub.facultyName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{sub.credits}</td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">
                    {sub.attended} / {sub.totalConducted}
                  </td>
                  <td className="px-4 py-3 w-44">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-10 ${sub.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {sub.percentage}%
                      </span>
                      <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${sub.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(sub.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {sub.percentage >= 75 ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                        Eligible
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700">
                        Shortage
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Attendance History & Correction Option */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-vctm-navy-700" />
            <span>Recent Recorded Lectures & Correction Requests</span>
          </div>
        }
        subtitle="If you were marked absent by mistake, click 'Request Correction' to submit a rectification request to your faculty."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Faculty</th>
                <th className="px-4 py-2.5">Recorded Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">
                    {rec.session?.session_date}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {rec.session?.subject?.subject_name}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {rec.session?.faculty?.full_name}
                  </td>
                  <td className="px-4 py-3">
                    <AttendanceStatusBadge status={rec.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {rec.status === 'Absent' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCorrection(rec)}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
                      >
                        Request Correction
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Verified</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Correction Modal */}
      <CorrectionRequestModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        record={selectedRecordForCorrection}
        studentId={student.id}
      />
    </div>
  );
};

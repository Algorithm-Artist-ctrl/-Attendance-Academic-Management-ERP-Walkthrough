import React from 'react';
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  RotateCcw, 
  Clock, 
  MapPin, 
  BookOpen, 
  Building2,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { getISTDayOfWeek, getISTTodayDate, formatDateDisplay, formatTime12H } from '../../lib/utils/dateUtils';

interface FacultyDashboardProps {
  onNavigate: (tab: string, params?: any) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { faculty, assignments, corrections, getTodaySchedule } = useAcademic();

  const currentFaculty = faculty.find(f => f.id === user?.faculty_id) || faculty[1]; // Ms. Hemlata
  const todayDateStr = getISTTodayDate();
  const todayDay = getISTDayOfWeek(todayDateStr);

  const myAssignments = assignments.filter(a => a.faculty_id === currentFaculty.id && a.active);
  const todayClasses = getTodaySchedule({
    dayOfWeek: todayDay,
    facultyId: currentFaculty.id,
    dateStr: todayDateStr,
  });

  const pendingCorrections = corrections.filter(
    c => c.status === 'pending' &&
         myAssignments.some(a => a.section_id === c.record?.session?.section_id)
  );

  return (
    <div className="space-y-6">
      {/* Faculty Profile Card */}
      <div className="bg-gradient-to-r from-vctm-navy-900 to-vctm-navy-800 rounded-2xl p-6 text-white shadow-md border border-vctm-navy-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-400 text-vctm-navy-950 font-black text-2xl flex items-center justify-center shadow-md shrink-0">
              {currentFaculty.faculty_code || currentFaculty.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{currentFaculty.full_name}</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {currentFaculty.faculty_code}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {currentFaculty.designation} • Dept. of Computer Science & Engineering
              </p>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                <span>Emp Code: <strong className="text-white">{currentFaculty.employee_code}</strong></span>
                <span>•</span>
                <span>{currentFaculty.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="maroon"
              size="lg"
              leftIcon={<CheckSquare className="w-5 h-5" />}
              onClick={() => onNavigate('take_attendance')}
              className="font-bold shadow-lg"
            >
              Take Today's Attendance
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Lectures</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900">{todayClasses.length}</span>
            <span className="text-xs text-slate-500 ml-2">Scheduled Today</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">{formatDateDisplay(todayDateStr)}</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Corrections</span>
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-amber-600">{pendingCorrections.length}</span>
            <span className="text-xs text-slate-500 ml-2">Awaiting Review</span>
          </div>
          <button
            onClick={() => onNavigate('corrections')}
            className="text-xs text-vctm-navy-700 font-semibold hover:underline mt-2 flex items-center gap-1"
          >
            <span>Review requests</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Subjects</span>
            <BookOpen className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-600">{myAssignments.length}</span>
            <span className="text-xs text-slate-500 ml-2">Course Sections</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Section A & Section B</p>
        </Card>
      </div>

      {/* Today's Lectures Schedule */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-vctm-navy-700" />
            <span>Today's Classes ({formatDateDisplay(todayDateStr)})</span>
          </div>
        }
        subtitle="Click 'Take Attendance' to immediately open the student roll list for that section"
      >
        {todayClasses.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No classes scheduled for you today.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayClasses.map((lec) => (
              <div 
                key={lec.timetableEntryId}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-vctm-navy-400 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-vctm-navy-100 text-vctm-navy-900">
                      Period {lec.periodNumber} ({formatTime12H(lec.startTime)} – {formatTime12H(lec.endTime)})
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                      Sec {lec.sectionName}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {lec.subjectName}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>Code: <strong className="text-slate-700">{lec.subjectCode}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {lec.roomNumber}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs">
                    {lec.attendanceTaken ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                        <CheckSquare className="w-4 h-4" /> Attendance Recorded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                        <Clock className="w-4 h-4" /> Not Yet Marked
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={lec.attendanceTaken ? 'outline' : 'navy'}
                    onClick={() => onNavigate('take_attendance', { timetableEntryId: lec.timetableEntryId })}
                  >
                    {lec.attendanceTaken ? 'Edit Attendance' : 'Take Attendance'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Assigned Subjects & Sections Matrix */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-vctm-navy-700" />
            <span>Assigned Courses & Sections (Academic Session 2026-2027)</span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-2.5">Subject Code</th>
                <th className="px-4 py-2.5">Subject Name</th>
                <th className="px-4 py-2.5">Section</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Credits</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myAssignments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">{a.subject?.subject_code}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{a.subject?.subject_name}</td>
                  <td className="px-4 py-3 font-bold text-vctm-navy-800">Section {a.section?.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{a.subject?.lecture_type}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{a.subject?.credits}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate('take_attendance')}
                    >
                      Open Class
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

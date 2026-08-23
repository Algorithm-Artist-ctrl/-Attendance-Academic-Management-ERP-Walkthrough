import React from 'react';
import { 
  Calendar, 
  CheckSquare, 
  Users, 
  BookOpen, 
  RotateCcw, 
  ArrowRight, 
  TrendingUp, 
  Clock, 
  Layers, 
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';

interface FacultyDashboardProps {
  onNavigate: (tab: string, params?: any) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    timetable, 
    assignments, 
    subjects, 
    sections, 
    corrections, 
    departments,
    faculty: facultyList,
    getFacultyCorrectionRequests
  } = useAcademic();

  const currentFaculty = facultyList.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;

  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
  const todayDay = days[new Date().getDay()] === 'SUN' ? 'MON' : days[new Date().getDay()];

  // Today's classes for this faculty strictly from Supabase timetable
  const todaySchedule = timetable
    .filter(t => t.faculty_id === facultyId && t.day_of_week === todayDay)
    .sort((a, b) => a.period_number - b.period_number);

  // Assigned subjects and sections strictly from faculty_subject_assignments
  const myAssignments = assignments.filter(fa => fa.faculty_id === facultyId);
  const mySubjects = subjects.filter(s => myAssignments.some(fa => fa.subject_id === s.id));
  const mySections = sections.filter(sec => myAssignments.some(fa => fa.section_id === sec.id));

  // Pending correction requests assigned strictly to this faculty
  const myPendingCorrections = getFacultyCorrectionRequests(facultyId).filter(c => c.status === 'pending');
  const dept = departments.find(d => d.id === currentFaculty?.department_id) || departments[0];

  return (
    <div className="space-y-6">
      {/* 1. WELCOME BANNER */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Welcome back, {currentFaculty?.full_name || user?.full_name || 'Faculty Member'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            {currentFaculty?.designation || 'Assistant Professor'} • {dept?.name || 'Computer Science & Engineering'} • Code: <span className="text-[#00ff88] font-bold">{currentFaculty?.faculty_code || currentFaculty?.employee_code || 'FACULTY'}</span>
          </p>
        </div>

        <div className="z-10 flex items-center gap-3">
          <Button
            variant="neon"
            size="sm"
            onClick={() => onNavigate('take_attendance')}
            leftIcon={<CheckSquare className="w-3.5 h-3.5 text-slate-950" />}
          >
            Mark Live Attendance
          </Button>
        </div>
      </div>

      {/* 2. STATS KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Classes */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Today's Classes</p>
            <h3 className="text-2xl sm:text-3xl font-black text-[#00ff88] mt-1">
              {todaySchedule.length}
            </h3>
            <span className="text-[10px] text-emerald-400 font-medium">{todayDay} Timetable</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Assigned Subjects */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Assigned Subjects</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {mySubjects.length}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Theory & Labs</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Assigned Sections */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Assigned Sections</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {mySections.length}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Active Sections</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Requests */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Pending Requests</p>
            <h3 className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
              {myPendingCorrections.length}
            </h3>
            <span className="text-[10px] text-amber-400/80 font-medium">Requires Review</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. TODAY'S SCHEDULE & RECENT REQUESTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Today's Schedule with "Take Attendance" button */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Today's Schedule
              </h3>
              <p className="text-xs text-slate-400">{todayDay} Lecture Schedule • Odd Semester</p>
            </div>
            <button
              onClick={() => onNavigate('timetable')}
              className="text-xs font-bold text-[#00ff88] hover:underline cursor-pointer"
            >
              Full Schedule →
            </button>
          </div>

          <div className="space-y-3">
            {todaySchedule.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No scheduled lectures for today in your timetable.
              </div>
            ) : (
              todaySchedule.map((entry) => {
                const sec = sections.find(s => s.id === entry.section_id);
                const sub = subjects.find(s => s.id === entry.subject_id);

                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/35 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-[#00ff88] font-mono text-xs font-bold shrink-0">
                        {entry.start_time?.substring(0, 5) || '09:00'} – {entry.end_time?.substring(0, 5) || '09:50'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">
                          {sub?.subject_name || 'Subject'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">
                          Section {sec?.name} • {entry.room_number || sec?.room_number} • {entry.lecture_type || 'Theory'}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="neon"
                      size="sm"
                      onClick={() => onNavigate('take_attendance', { timetableEntryId: entry.id })}
                      leftIcon={<CheckSquare className="w-3.5 h-3.5 text-slate-950" />}
                      className="shrink-0 text-xs font-bold"
                    >
                      Take Attendance
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Card: Recent Student Correction Requests */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Recent Correction Requests
              </h3>
              <button
                onClick={() => onNavigate('corrections')}
                className="text-xs font-bold text-[#00ff88] hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>

            <div className="space-y-2.5">
              {myPendingCorrections.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No pending correction requests from students.
                </div>
              ) : (
                myPendingCorrections.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-white">
                        {c.student?.full_name || 'Student'}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Roll: {c.student?.roll_number} • {c.reason}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate('corrections')}
                      className="text-[10px] py-1 px-2.5 shrink-0"
                    >
                      Review
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-emerald-500/10 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('corrections')}
              className="w-full text-xs"
            >
              Review All Requests
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

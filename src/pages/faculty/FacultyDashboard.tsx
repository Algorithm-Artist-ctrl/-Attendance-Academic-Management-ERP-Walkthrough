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
  onNavigate: (tab: string) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    timetable, 
    assignments, 
    subjects, 
    sections, 
    corrections, 
    departments 
  } = useAcademic();

  const faculty = user?.faculty;
  const facultyId = faculty?.id || 'fac-hemlata-02';

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
  const todayDay = days[new Date().getDay()] === 'SUN' ? 'MON' : days[new Date().getDay()];

  // Today's classes for this faculty
  const todaySchedule = timetable
    .filter(t => t.faculty_id === facultyId && t.day_of_week === todayDay)
    .sort((a, b) => a.period_number - b.period_number);

  // Assigned subjects and sections
  const myAssignments = assignments.filter(fa => fa.faculty_id === facultyId);
  const mySubjects = subjects.filter(s => myAssignments.some(fa => fa.subject_id === s.id));
  const mySections = sections.filter(sec => myAssignments.some(fa => fa.section_id === sec.id));

  // Pending correction requests
  const pendingCorrections = corrections.filter(c => c.status === 'pending');
  const dept = departments.find(d => d.id === faculty?.department_id);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. WELCOME BANNER (Matching Screen 6) */}
      {/* ======================================================== */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Welcome back, {faculty?.full_name || 'Ms. Hemlata Chaudhary'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            {faculty?.designation || 'Assistant Professor'} • {dept?.name || 'Computer Science & Engineering'} • Code: <span className="text-[#00ff88] font-bold">{faculty?.faculty_code || 'HEM'}</span>
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

      {/* ======================================================== */}
      {/* 2. STATS KPI CARDS (Matching Screen 6) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Classes */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Today's Classes</p>
            <h3 className="text-2xl sm:text-3xl font-black text-[#00ff88] mt-1">
              {todaySchedule.length || 3}
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
              {mySubjects.length || 2}
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
              {mySections.length || 2}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Sec A & Sec B</span>
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
              {pendingCorrections.length || 5}
            </h3>
            <span className="text-[10px] text-amber-400/80 font-medium">Requires Review</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. TODAY'S SCHEDULE & RECENT REQUESTS (Screen 6) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Today's Schedule with "Take Attendance" button */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Today's Schedule
              </h3>
              <p className="text-xs text-slate-400">{todayDay} Lecture Schedule</p>
            </div>
            <button
              onClick={() => onNavigate('timetable')}
              className="text-xs font-bold text-[#00ff88] hover:underline"
            >
              Full Schedule →
            </button>
          </div>

          <div className="space-y-3">
            {todaySchedule.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No scheduled lectures for today.
              </div>
            ) : (
              todaySchedule.map((entry) => {
                const sec = sections.find(s => s.id === entry.section_id);
                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/35 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold shrink-0">
                        {entry.start_time} - {entry.end_time}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">
                          {entry.subject?.subject_name || 'Data Structure'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Section {sec?.name || 'A'} • {entry.room_number || 'Room A-007'}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate('take_attendance')}
                      leftIcon={<CheckSquare className="w-3.5 h-3.5 text-[#00ff88]" />}
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
                className="text-xs font-bold text-[#00ff88] hover:underline"
              >
                View All →
              </button>
            </div>

            <div className="space-y-3">
              {pendingCorrections.slice(0, 4).map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {req.student?.full_name || 'Tarun Kushwah'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Roll: {req.student?.roll_number || '2503400100057'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      Pending
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-emerald-500/10 mt-4">
            <Button
              variant="neon"
              size="sm"
              onClick={() => onNavigate('corrections')}
              className="w-full text-xs"
            >
              Review Pending Requests ({pendingCorrections.length})
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

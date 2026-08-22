import React from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  BookOpen, 
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { CyberGauge3D } from '../../components/3d/CyberGauge3D';
import { DayOfWeek } from '../../types/database.types';

interface StudentDashboardProps {
  onNavigate: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    getStudentAttendance, 
    timetable, 
    subjects, 
    faculty,
    sections, 
    years, 
    semesters, 
    programs,
    corrections
  } = useAcademic();

  const student = user?.student;
  const studentId = student?.id || '';
  const stats = getStudentAttendance(studentId);

  const section = sections.find(s => s.id === student?.section_id) || sections[0];
  const isSectionB = section?.name === 'B';
  const branchName = isSectionB ? 'CSE + IT' : 'CSE';

  const year = years.find(y => y.id === student?.academic_year_id);
  const sem = semesters.find(s => s.id === student?.semester_id);
  const prog = programs.find(p => p.id === student?.program_id);

  // Today's Day of Week
  const days: DayOfWeek[] = ['SUN' as any, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const todayDay: DayOfWeek = days[new Date().getDay()] === ('SUN' as any) ? 'MON' : days[new Date().getDay()];

  // Today's timetable entries strictly for this student's section
  const todaySchedule = timetable
    .filter(t => t.section_id === section?.id && t.day_of_week === todayDay)
    .sort((a, b) => a.period_number - b.period_number);

  const studentCorrections = corrections.filter(c => c.student_id === studentId);
  const pendingRequests = studentCorrections.filter(c => c.status === 'pending');

  const totalAbsent = stats.totalLectures - stats.presentLectures;

  return (
    <div className="space-y-6">
      {/* 1. WELCOME BANNER */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Welcome back, {student?.full_name || user?.full_name || 'Tarun Kushwah'} 👋
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Roll No. <span className="text-[#00ff88] font-bold">{student?.roll_number || '2503400100057'}</span> • B.Tech <span className="text-[#00ff88] font-bold">{branchName}</span> • {year?.name || '2nd Year'} • Odd Semester 2026–2027 • Section <span className="text-[#00ff88] font-bold">{section?.name}</span> ({section?.room_number})
          </p>
        </div>

        {/* Quick Action */}
        <div className="z-10 flex items-center gap-3">
          <Button
            variant="neon"
            size="sm"
            onClick={() => onNavigate('corrections')}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Correction Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </Button>
        </div>
      </div>

      {/* 2. STATS KPI CARDS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Attendance */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Overall Attendance</p>
            <h3 className="text-2xl sm:text-3xl font-black text-[#00ff88] mt-1">
              {stats.percentage}%
            </h3>
            <span className="text-[10px] text-emerald-400 font-medium">
              {stats.isDefaulter ? '⚠️ Below 75% Requirement' : '✅ AKTU Criteria Satisfied'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Recorded Lectures */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Recorded Lectures</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {stats.totalLectures}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Odd Semester 2026–27</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Attended (Present) */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Attended (Present)</p>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
              {stats.presentLectures}
            </h3>
            <span className="text-[10px] text-emerald-400 font-medium">Verified in Database</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Absent */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Absent Lectures</p>
            <h3 className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">
              {totalAbsent}
            </h3>
            <span className="text-[10px] text-rose-400 font-medium">Missed Lectures</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. ATTENDANCE OVERVIEW & TODAY'S TIMETABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Attendance Overview with CyberGauge3D */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Attendance Overview
            </h3>
            <span className="text-xs font-semibold text-emerald-400">Semester 3</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
            <CyberGauge3D
              percentage={stats.percentage}
              size={150}
              label="Overall"
              subLabel="Attendance"
            />

            {/* Legend breakdown */}
            <div className="space-y-3 w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88]" />
                  <span className="text-slate-300 font-medium">Present</span>
                </div>
                <span className="font-bold text-white ml-auto sm:ml-4">{stats.presentLectures}</span>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-300 font-medium">Absent</span>
                </div>
                <span className="font-bold text-white ml-auto sm:ml-4">{totalAbsent}</span>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="text-slate-300 font-medium">Total Recorded</span>
                </div>
                <span className="font-bold text-white ml-auto sm:ml-4">{stats.totalLectures}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-emerald-500/10 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('attendance')}
              className="w-full text-xs"
            >
              View Detailed Attendance Breakdown
            </Button>
          </div>
        </div>

        {/* Right Card: Today's Time Table */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Today's Time Table
              </h3>
              <p className="text-xs text-slate-400">{todayDay}, Odd Semester • Section {section?.name} ({section?.room_number})</p>
            </div>
            <button
              onClick={() => onNavigate('timetable')}
              className="text-xs font-bold text-[#00ff88] hover:underline cursor-pointer"
            >
              View Full Schedule →
            </button>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-64 pr-1">
            {todaySchedule.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No scheduled lectures for today.
              </div>
            ) : (
              todaySchedule.map((entry) => {
                const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
                const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;

                return (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/35 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-900 border border-emerald-500/20 text-[#00ff88] font-mono text-xs font-bold shrink-0">
                        {entry.start_time?.substring(0, 5) || '09:00'} – {entry.end_time?.substring(0, 5) || '09:50'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">
                          {sub?.subject_name || 'Lecture Subject'}
                        </h4>
                        <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                          {fac?.full_name || 'Assigned Faculty'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] font-bold text-xs">
                        {entry.room_number || section?.room_number}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-emerald-500/10 text-xs text-slate-400 flex items-center justify-between">
            <span>Room: {section?.room_number}</span>
            <span className="text-[#00ff88] font-semibold">Active Odd Session 2026–2027</span>
          </div>
        </div>

      </div>

      {/* 4. BOTTOM: SUBJECT WISE ATTENDANCE CARDS GRID */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Subject Wise Attendance Breakdown
            </h3>
            <p className="text-xs text-slate-400">Current Semester Performance • Section {section?.name}</p>
          </div>
          <button
            onClick={() => onNavigate('attendance')}
            className="text-xs font-bold text-[#00ff88] hover:underline cursor-pointer"
          >
            View All Subjects
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(stats.subjectStats || []).map((sb) => (
            <div
              key={sb.subjectId}
              className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/35 transition-all text-center space-y-2"
            >
              <div className="text-xs font-bold text-white truncate" title={sb.subjectName}>
                {sb.subjectName}
              </div>
              <div className="text-[10px] text-emerald-400 font-medium truncate" title={sb.facultyName}>
                {sb.facultyName}
              </div>
              <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                {sb.totalConducted > 0 ? `${sb.percentage}%` : '0% (No Lectures)'}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

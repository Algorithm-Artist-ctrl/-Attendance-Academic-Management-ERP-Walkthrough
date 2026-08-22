import React, { useState } from 'react';
import { 
  Download, 
  Filter, 
  Calendar as CalendarIcon, 
  Table as TableIcon,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { clsx } from 'clsx';
import { SubjectAttendanceStat } from '../../types/academic.types';

export const StudentAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { 
    getStudentAttendance, 
    subjects, 
    faculty
  } = useAcademic();

  const student = user?.student;
  const studentId = student?.id || 'stud-a-05';
  const stats = getStudentAttendance(studentId);

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('May 2025');
  const [activeViewMode, setActiveViewMode] = useState<'table' | 'calendar'>('table');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(14);

  const subjectStatsList: SubjectAttendanceStat[] = stats.subjectStats || [];
  const filteredSubjectBreakdown = selectedSubject === 'all'
    ? subjectStatsList
    : subjectStatsList.filter(s => s.subjectId === selectedSubject);

  const daysOfWeek = [
    { day: 'Mon', date: 12 },
    { day: 'Tue', date: 13 },
    { day: 'Wed', date: 14 },
    { day: 'Thu', date: 15 },
    { day: 'Fri', date: 16 },
    { day: 'Sat', date: 17 },
  ];

  const calendarLectures = [
    { time: '09:00 - 09:50', subject: 'Data Structure', faculty: 'Ms. Hemlata Chaudhary', status: 'Present' as const },
    { time: '10:40 - 11:30', subject: 'Discrete Structure & TOI', faculty: 'Mr. Imran Raza Khan', status: 'Absent' as const },
    { time: '11:40 - 12:30', subject: 'Computer Organization', faculty: 'Mr. Kuldeep Kumar', status: 'Present' as const },
    { time: '01:20 - 02:10', subject: 'Universal Human Values', faculty: 'Ms. Shivani Sarswat', status: 'Not Recorded' as const },
    { time: '02:20 - 03:10', subject: 'Web Designing Workshop', faculty: 'Mr. Gagandeep Singh', status: 'Present' as const },
  ];

  const handleExportCSV = () => {
    const headers = ['Subject Code', 'Subject Name', 'Faculty Name', 'Total Lectures', 'Present', 'Absent', 'Attendance %'];
    const rows = subjectStatsList.map(s => [
      s.subjectCode,
      s.subjectName,
      s.facultyName,
      s.totalConducted,
      s.attended,
      s.totalConducted - s.attended,
      `${s.percentage}%`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VCTM_Attendance_${student?.roll_number || 'Student'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalAbsent = stats.totalLectures - stats.presentLectures;

  return (
    <div className="space-y-6">
      {/* Header & Controls Matching Screen 3 */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#00ff88]" />
            My Attendance Record
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Detailed subject-wise breakdown and lecture attendance timeline
          </p>
        </div>

        {/* View Switcher & Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-950/80 p-1 rounded-xl border border-emerald-500/20 flex items-center text-xs font-bold">
            <button
              onClick={() => setActiveViewMode('table')}
              className={clsx(
                'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer',
                activeViewMode === 'table'
                  ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Subject Table</span>
            </button>
            <button
              onClick={() => setActiveViewMode('calendar')}
              className={clsx(
                'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer',
                activeViewMode === 'calendar'
                  ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Attendance Calendar</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
          >
            Download CSV
          </Button>
        </div>
      </div>

      {/* Filter Row Matching Screen 3 */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Select Subject */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">Subject:</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            >
              <option value="all">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
              ))}
            </select>
          </div>

          {/* Select Month */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            >
              <option value="May 2025">May 2025</option>
              <option value="April 2025">April 2025</option>
              <option value="March 2025">March 2025</option>
              <option value="February 2025">February 2025</option>
            </select>
          </div>
        </div>

        {/* Quick KPI Stats Summary Bar Matching Screen 3 */}
        <div className="flex items-center gap-3 text-xs font-semibold bg-slate-950/60 px-4 py-1.5 rounded-xl border border-emerald-500/15">
          <div>
            <span className="text-slate-400">Overall: </span>
            <span className="text-[#00ff88] font-black">{stats.percentage}%</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400">Total: </span>
            <span className="text-white font-bold">{stats.totalLectures}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400">Present: </span>
            <span className="text-emerald-400 font-bold">{stats.presentLectures}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400">Absent: </span>
            <span className="text-rose-400 font-bold">{totalAbsent}</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: DETAILED SUBJECT-WISE TABLE (Screen 3) */}
      {/* ======================================================== */}
      {activeViewMode === 'table' && (
        <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-5 py-3.5">Subject Code</th>
                  <th className="px-5 py-3.5">Subject Name</th>
                  <th className="px-5 py-3.5">Faculty Full Name</th>
                  <th className="px-5 py-3.5 text-center">Total</th>
                  <th className="px-5 py-3.5 text-center">Present</th>
                  <th className="px-5 py-3.5 text-center">Absent</th>
                  <th className="px-5 py-3.5 text-center">Attendance %</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {filteredSubjectBreakdown.map((item) => {
                  const isEligible = item.percentage >= 75;
                  const itemAbsent = item.totalConducted - item.attended;
                  return (
                    <tr key={item.subjectId} className="hover:bg-emerald-500/5 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-emerald-400">
                        {item.subjectCode}
                      </td>
                      <td className="px-5 py-4 font-bold text-white">
                        {item.subjectName}
                      </td>
                      <td className="px-5 py-4 text-slate-300 font-medium">
                        {item.facultyName}
                      </td>
                      <td className="px-5 py-4 text-center font-semibold text-slate-200">
                        {item.totalConducted}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-emerald-400">
                        {item.attended}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-rose-400">
                        {itemAbsent}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                          {item.percentage}%
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={clsx(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold border',
                          isEligible 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                        )}>
                          {isEligible ? 'Eligible' : 'Defaulter (<75%)'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: ATTENDANCE CALENDAR (Screen 4) */}
      {/* ======================================================== */}
      {activeViewMode === 'calendar' && (
        <div className="space-y-6">
          {/* Week Date Selector Pills Matching Screen 4 */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Select Attendance Date
              </h3>
              <span className="text-xs font-semibold text-emerald-400">Odd Semester 2026-27</span>
            </div>

            <div className="grid grid-cols-6 gap-2 sm:gap-4">
              {daysOfWeek.map((d) => (
                <button
                  key={d.date}
                  onClick={() => setSelectedCalendarDay(d.date)}
                  className={clsx(
                    'p-3 sm:p-4 rounded-2xl text-center transition-all cursor-pointer select-none border',
                    selectedCalendarDay === d.date
                      ? 'bg-[#00ff88] text-slate-950 font-black border-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.35)]'
                      : 'bg-slate-950/60 text-slate-400 border-emerald-500/15 hover:border-emerald-500/35 hover:text-white'
                  )}
                >
                  <p className="text-[11px] uppercase font-bold">{d.day}</p>
                  <p className="text-lg sm:text-xl font-black mt-0.5">{d.date}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Day Lecture Breakdown Cards Matching Screen 4 */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Lectures for Wednesday, {selectedCalendarDay} May 2025
              </h3>
              <span className="text-xs text-slate-400">Section {student?.section_id?.includes('b') ? 'B' : 'A'}</span>
            </div>

            <div className="space-y-3">
              {calendarLectures.map((lec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                      {lec.time}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {lec.subject}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lec.faculty}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <AttendanceStatusBadge status={lec.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

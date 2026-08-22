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
  BookOpen,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { CorrectionRequestModal } from '../../components/correction/CorrectionRequestModal';
import { clsx } from 'clsx';
import { SubjectAttendanceStat } from '../../types/academic.types';
import { DayOfWeek } from '../../types/database.types';

export const StudentAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { 
    getStudentAttendance, 
    subjects, 
    faculty,
    sections,
    timetable,
    attendanceSessions,
    attendanceRecords,
  } = useAcademic();

  const student = user?.student;
  const studentId = student?.id || '';
  const stats = getStudentAttendance(studentId);

  const currentSection = sections.find(s => s.id === student?.section_id) || sections[0];
  const isSectionB = currentSection?.name === 'B';
  const branchName = isSectionB ? 'CSE + IT' : 'CSE';

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('August 2026');
  const [activeViewMode, setActiveViewMode] = useState<'table' | 'calendar'>('table');
  const [selectedDayKey, setSelectedDayKey] = useState<DayOfWeek>('MON');
  const [selectedDateNum, setSelectedDateNum] = useState<number>(24);

  // Correction request modal state
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<any>(null);

  const subjectStatsList: SubjectAttendanceStat[] = stats.subjectStats || [];
  const filteredSubjectBreakdown = selectedSubject === 'all'
    ? subjectStatsList
    : subjectStatsList.filter(s => s.subjectId === selectedSubject);

  const daysOfWeek: Array<{ dayKey: DayOfWeek; day: string; date: number }> = [
    { dayKey: 'MON', day: 'Mon', date: 24 },
    { dayKey: 'TUE', day: 'Tue', date: 25 },
    { dayKey: 'WED', day: 'Wed', date: 26 },
    { dayKey: 'THU', day: 'Thu', date: 27 },
    { dayKey: 'FRI', day: 'Fri', date: 28 },
    { dayKey: 'SAT', day: 'Sat', date: 29 },
  ];

  // Dynamic scheduled lectures for the selected day for this student's section
  const dayScheduleEntries = timetable
    .filter(t => t.section_id === currentSection?.id && t.day_of_week === selectedDayKey)
    .sort((a, b) => a.period_number - b.period_number);

  const selectedDateStr = `2026-08-${String(selectedDateNum).padStart(2, '0')}`;

  const calendarLectures = dayScheduleEntries.map(entry => {
    const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
    const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;

    // Check if session was conducted on this date
    const session = attendanceSessions.find(
      s => s.section_id === currentSection?.id &&
           s.subject_id === entry.subject_id &&
           s.session_date === selectedDateStr
    );

    let status: 'Present' | 'Absent' | 'Not Recorded' = 'Not Recorded';
    let recordId: string | undefined = undefined;

    if (session) {
      const rec = attendanceRecords.find(
        r => r.attendance_session_id === session.id && r.student_id === studentId
      );
      if (rec) {
        status = rec.status;
        recordId = rec.id;
      }
    }

    return {
      timetableEntryId: entry.id,
      time: `${entry.start_time?.substring(0, 5) || '09:00'} – ${entry.end_time?.substring(0, 5) || '09:50'}`,
      subjectCode: sub?.subject_code || '',
      subjectName: sub?.subject_name || 'Subject',
      facultyName: fac?.full_name || 'Faculty Member',
      roomNumber: entry.room_number || currentSection?.room_number,
      lectureType: entry.lecture_type,
      status,
      recordId,
    };
  });

  const handleExportCSV = () => {
    const headers = ['Subject Code', 'Subject Name', 'Assigned Faculty', 'Total Recorded Lectures', 'Present', 'Absent', 'Attendance %'];
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
    link.setAttribute('download', `VCTM_Attendance_${student?.roll_number || 'Student'}_2026_2027.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalAbsent = stats.totalLectures - stats.presentLectures;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#00ff88]" />
            Official Attendance Ledger
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            B.Tech <span className="text-[#00ff88] font-bold">{branchName}</span> 2nd Year • Section <span className="text-[#00ff88] font-bold">{currentSection?.name}</span> • Odd Semester 2026–2027
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
              <span>Lecture Timeline</span>
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

      {/* Filter Row */}
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
              <option value="all">All Subjects (10)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
              ))}
            </select>
          </div>

          {/* Select Month */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-400">Academic Period:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            >
              <option value="August 2026">August 2026 (Current)</option>
              <option value="September 2026">September 2026</option>
              <option value="October 2026">October 2026</option>
              <option value="November 2026">November 2026</option>
              <option value="December 2026">December 2026</option>
            </select>
          </div>
        </div>

        {/* Quick KPI Stats Summary Bar */}
        <div className="flex items-center gap-3 text-xs font-semibold bg-slate-950/60 px-4 py-1.5 rounded-xl border border-emerald-500/15">
          <div>
            <span className="text-slate-400">Overall: </span>
            <span className="text-[#00ff88] font-black">{stats.percentage}%</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400">Recorded Lectures: </span>
            <span className="text-white font-bold">{stats.totalLectures}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400">Attended: </span>
            <span className="text-emerald-400 font-bold">{stats.presentLectures}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400">Absent: </span>
            <span className="text-rose-400 font-bold">{totalAbsent}</span>
          </div>
        </div>
      </div>

      {/* VIEW 1: DETAILED SUBJECT-WISE TABLE */}
      {activeViewMode === 'table' && (
        <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-5 py-3.5">Subject Code</th>
                  <th className="px-5 py-3.5">Subject Name</th>
                  <th className="px-5 py-3.5">Assigned Faculty (Section {currentSection?.name})</th>
                  <th className="px-5 py-3.5 text-center">Conducted</th>
                  <th className="px-5 py-3.5 text-center">Present</th>
                  <th className="px-5 py-3.5 text-center">Absent</th>
                  <th className="px-5 py-3.5 text-center">Attendance %</th>
                  <th className="px-5 py-3.5 text-center">AKTU 75% Status</th>
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
                          {item.totalConducted > 0 ? `${item.percentage}%` : 'No Lectures'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={clsx(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold border',
                          item.totalConducted === 0
                            ? 'bg-slate-800 border-slate-700 text-slate-400'
                            : isEligible 
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                              : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                        )}>
                          {item.totalConducted === 0 ? 'No Data' : isEligible ? 'Eligible' : 'Defaulter (<75%)'}
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

      {/* VIEW 2: LECTURE TIMELINE / CALENDAR */}
      {activeViewMode === 'calendar' && (
        <div className="space-y-6">
          {/* Day Selector Pills */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Select Date ({selectedMonth})
              </h3>
              <span className="text-xs font-semibold text-[#00ff88]">Section {currentSection?.name} ({currentSection?.room_number})</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4">
              {daysOfWeek.map((d) => (
                <button
                  key={d.date}
                  onClick={() => {
                    setSelectedDayKey(d.dayKey);
                    setSelectedDateNum(d.date);
                  }}
                  className={clsx(
                    'p-3 sm:p-4 rounded-2xl text-center transition-all cursor-pointer select-none border',
                    selectedDateNum === d.date
                      ? 'bg-[#00ff88] text-slate-950 font-black border-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.35)]'
                      : 'bg-slate-950/60 text-slate-400 border-emerald-500/15 hover:border-emerald-500/35 hover:text-white'
                  )}
                >
                  <p className="text-[11px] uppercase font-bold">{d.day}</p>
                  <p className="text-lg sm:text-xl font-black mt-0.5">{d.date} Aug</p>
                </button>
              ))}
            </div>
          </div>

          {/* Lecture Timeline */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/15 pb-3">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Official Scheduled Lectures • {selectedDayKey}, {selectedDateNum} August 2026
              </h3>
              <span className="text-xs text-[#00ff88] font-semibold">B.Tech {branchName} • Section {currentSection?.name}</span>
            </div>

            {calendarLectures.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No lectures scheduled on this day for Section {currentSection?.name}.
              </div>
            ) : (
              <div className="space-y-3">
                {calendarLectures.map((lec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-[#00ff88] font-mono text-xs font-bold shrink-0">
                        {lec.time}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">
                            {lec.subjectName}
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                            {lec.subjectCode}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">
                          {lec.facultyName} • <span className="text-slate-300">{lec.roomNumber}</span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      <AttendanceStatusBadge status={lec.status} />

                      {lec.status === 'Absent' && lec.recordId && (
                        <Button
                          variant="neon"
                          size="sm"
                          onClick={() => setSelectedRecordForCorrection(lec)}
                          leftIcon={<RotateCcw className="w-3.5 h-3.5 text-slate-950" />}
                        >
                          Request Rectification
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rectification Modal */}
      {selectedRecordForCorrection && (
        <CorrectionRequestModal
          isOpen={true}
          onClose={() => setSelectedRecordForCorrection(null)}
          preselectedSubjectId={selectedRecordForCorrection.subjectId}
          preselectedRecordId={selectedRecordForCorrection.recordId}
        />
      )}
    </div>
  );
};

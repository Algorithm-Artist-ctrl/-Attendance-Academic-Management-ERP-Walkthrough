import React, { useState } from 'react';
import { 
  Download, 
  Filter, 
  Calendar,
  Calendar as CalendarIcon, 
  Table as TableIcon,
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCcw, 
  BookOpen,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic, TodayAttendanceLecture } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { ClaimAttendanceModal } from '../../components/correction/ClaimAttendanceModal';
import { getISTTodayDate, getISTDayOfWeek, formatDateDisplay } from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';
import { SubjectAttendanceStat } from '../../types/academic.types';
import { DayOfWeek } from '../../types/database.types';

export const StudentAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { 
    getStudentAttendance, 
    getTodayLecturesForStudent,
    getDateLecturesForStudent,
    subjects, 
    faculty,
    sections,
    attendanceSessions,
    attendanceRecords,
    corrections,
    students
  } = useAcademic();

  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const student = currentStudent;
  const studentId = currentStudent?.id || '';
  const stats = getStudentAttendance(studentId);

  const currentSection = sections.find(s => s.id === currentStudent?.section_id) || 
                         sections.find(s => s.name === currentStudent?.section?.name);
  const isSectionB = currentSection?.name === 'B';
  const branchName = isSectionB ? 'CSE + IT' : 'CSE';

  // Primary Navigation Tab: 'today' | 'history' | 'table' | 'claims'
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'table' | 'claims'>('today');

  // Filter state for Table View
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  // History State
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(7); // August (0-indexed = 7)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('2026-08-22');

  // Modal State for Claiming Attendance
  const [selectedLectureForClaim, setSelectedLectureForClaim] = useState<TodayAttendanceLecture | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const todayDateStr = getISTTodayDate();
  const todayDay = getISTDayOfWeek(todayDateStr);
  const formattedTodayDate = formatDateDisplay(todayDateStr);

  // Today's Lectures
  const todayLectures = getTodayLecturesForStudent(studentId, todayDateStr);

  // Selected Date Lectures for History Tab
  const historyData = getDateLecturesForStudent(studentId, selectedHistoryDate);
  const formattedHistoryDate = formatDateDisplay(selectedHistoryDate);

  // Subject stats list
  const subjectStatsList: SubjectAttendanceStat[] = stats.subjectStats || [];
  const filteredSubjectBreakdown = selectedSubjectFilter === 'all'
    ? subjectStatsList
    : subjectStatsList.filter(s => s.subjectId === selectedSubjectFilter);

  // Student's Claims History
  const myClaims = corrections.filter(c => c.student_id === studentId);

  // Calendar generation for current selected month
  const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonthIndex, 1).getDay(); // 0 = Sunday

  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const daySummary = getDateLecturesForStudent(studentId, dStr);
    calendarDays.push({
      dayNumber: d,
      dateStr: dStr,
      isSunday: getISTDayOfWeek(dStr) === 'SUN',
      totalLectures: daySummary.totalLectures,
      presentCount: daySummary.presentCount,
      absentCount: daySummary.absentCount,
      notRecordedCount: daySummary.notRecordedCount,
    });
  }

  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonthIndex(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonthIndex(m => m + 1);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Subject Code', 'Subject Name', 'Assigned Faculty', 'Recorded Lectures', 'Present', 'Absent', 'Attendance %', 'AKTU Status'];
    const rows = subjectStatsList.map(s => [
      s.subjectCode,
      s.subjectName,
      s.facultyName,
      s.totalConducted,
      s.attended,
      s.totalConducted - s.attended,
      `${s.percentage}%`,
      s.percentage >= 75 ? 'Eligible' : 'Defaulter'
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
      {/* 1. TOP HEADER & SUMMARY METRICS */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#00ff88]" />
            Official Attendance Ledger & History
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            B.Tech <span className="text-[#00ff88] font-bold">{branchName}</span> 2nd Year • Section <span className="text-[#00ff88] font-bold">{currentSection?.name}</span> • Odd Semester 2026–2027
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
        >
          Download CSV Report
        </Button>
      </div>

      {/* 2. SUMMARY KPI STATS ROW (100% Real Supabase Calculation) */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/25">
            <span className="text-slate-400">Overall Attendance: </span>
            <span className="text-[#00ff88] font-black text-sm ml-1">{stats.percentage}%</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/20">
            <span className="text-slate-400">Recorded Lectures: </span>
            <span className="text-white font-bold text-sm ml-1">{stats.totalLectures}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/20">
            <span className="text-slate-400">Attended (Present): </span>
            <span className="text-emerald-400 font-bold text-sm ml-1">{stats.presentLectures}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/20">
            <span className="text-slate-400">Missed (Absent): </span>
            <span className="text-rose-400 font-bold text-sm ml-1">{totalAbsent}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/20">
            <span className="text-slate-400">Today Not Recorded: </span>
            <span className="text-amber-300 font-bold text-sm ml-1">{stats.notRecordedCount}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/20">
            <span className="text-slate-400">Pending Claims: </span>
            <span className="text-amber-400 font-bold text-sm ml-1">{stats.pendingClaimsCount}</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-medium italic">
          Formula: Present ÷ (Present + Absent) × 100
        </div>
      </div>

      {/* 3. PRIMARY NAVIGATION TABS */}
      <div className="bg-slate-950/80 p-1.5 rounded-2xl border border-emerald-500/20 flex flex-wrap items-center gap-2 w-fit text-xs font-bold">
        <button
          onClick={() => setActiveTab('today')}
          className={clsx(
            'px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer',
            activeTab === 'today'
              ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <Clock className="w-4 h-4" />
          <span>Today's Classes</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={clsx(
            'px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer',
            activeTab === 'history'
              ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Attendance History & Calendar</span>
        </button>

        <button
          onClick={() => setActiveTab('table')}
          className={clsx(
            'px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer',
            activeTab === 'table'
              ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <TableIcon className="w-4 h-4" />
          <span>Subject-Wise Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={clsx(
            'px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer',
            activeTab === 'claims'
              ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <RotateCcw className="w-4 h-4" />
          <span>My Attendance Claims ({myClaims.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: TODAY'S CLASSES & LIVE ATTENDANCE */}
      {/* ======================================================== */}
      {activeTab === 'today' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-500/15 pb-4">
            <div>
              <h2 className="text-base font-black text-white">
                Scheduled Lectures for Today — {formattedTodayDate}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Section {currentSection?.name} • Classroom: {currentSection?.room_number}
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-[#00ff88] text-xs font-bold">
              Live Real-Time Sync
            </span>
          </div>

          {todayLectures.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No scheduled classes for today.
            </div>
          ) : (
            <div className="space-y-3">
              {todayLectures.map((lec) => {
                const isPresent = lec.status === 'Present';
                const isAbsent = lec.status === 'Absent';
                const isNotRecorded = lec.status === 'Not Recorded';
                const hasPendingClaim = lec.claimStatus === 'pending';
                const hasApprovedClaim = lec.claimStatus === 'approved';

                return (
                  <div
                    key={lec.timetableEntryId}
                    className={clsx(
                      'p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4',
                      isAbsent 
                        ? 'bg-rose-950/20 border-rose-500/30' 
                        : isPresent 
                        ? 'bg-slate-950/60 border-emerald-500/20' 
                        : 'bg-slate-950/40 border-slate-800'
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-[#00ff88] font-mono text-xs font-bold shrink-0 min-w-[105px] text-center">
                        {lec.startTime} – {lec.endTime}
                        <span className="block text-[9px] text-slate-400 font-sans font-normal">Period {lec.periodNumber}</span>
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
                          {lec.facultyName} • <span className="text-slate-300">{lec.roomNumber}</span> • {lec.lectureType}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      {isPresent && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          PRESENT
                        </span>
                      )}

                      {isAbsent && !hasPendingClaim && !hasApprovedClaim && (
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-rose-500/20 border border-rose-500/30 text-rose-400">
                            <XCircle className="w-3.5 h-3.5" />
                            ABSENT
                          </span>

                          <Button
                            variant="neon"
                            size="sm"
                            onClick={() => setSelectedLectureForClaim(lec)}
                            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-slate-950" />}
                            className="text-xs font-bold"
                          >
                            Claim Attendance
                          </Button>
                        </div>
                      )}

                      {isAbsent && hasPendingClaim && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          Claim Pending
                        </span>
                      )}

                      {hasApprovedClaim && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/30 text-[#00ff88]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Claim Approved (Present)
                        </span>
                      )}

                      {isNotRecorded && !hasPendingClaim && !hasApprovedClaim && (
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-amber-400/80" />
                            Attendance Not Recorded
                          </span>

                          <Button
                            variant="neon"
                            size="sm"
                            onClick={() => setSelectedLectureForClaim(lec)}
                            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-slate-950" />}
                            className="text-xs font-bold"
                          >
                            Claim Attendance
                          </Button>
                        </div>
                      )}

                      {isNotRecorded && hasPendingClaim && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          Claim Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ATTENDANCE HISTORY & INTERACTIVE CALENDAR */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Month Selector Header */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Interactive Attendance Calendar
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select any date to inspect historical lecture records and claim discrepancies
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-300 hover:text-white hover:border-[#00ff88] transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-emerald-500/25 text-white font-bold text-xs min-w-[150px] text-center">
                {monthNames[selectedMonthIndex]} {selectedYear}
              </div>

              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-300 hover:text-white hover:border-[#00ff88] transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20">
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((item, idx) => {
                if (!item) {
                  return <div key={`empty-${idx}`} className="h-20 rounded-2xl bg-slate-950/20 border border-transparent" />;
                }

                const isSelected = item.dateStr === selectedHistoryDate;
                const hasAbsence = item.absentCount > 0;
                const hasRecorded = item.presentCount > 0 && !hasAbsence;

                return (
                  <button
                    key={item.dateStr}
                    onClick={() => setSelectedHistoryDate(item.dateStr)}
                    className={clsx(
                      'h-20 p-2 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                      isSelected
                        ? 'bg-[#00ff88]/15 border-[#00ff88] shadow-[0_0_15px_rgba(0,255,136,0.25)]'
                        : 'bg-slate-950/60 border-emerald-500/15 hover:border-emerald-500/40'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={clsx('text-xs font-black', isSelected ? 'text-[#00ff88]' : 'text-white')}>
                        {item.dayNumber}
                      </span>
                      {item.isSunday && (
                        <span className="text-[9px] text-slate-500 font-bold">Holiday</span>
                      )}
                    </div>

                    {!item.isSunday && item.totalLectures > 0 && (
                      <div className="flex items-center gap-1 mt-auto">
                        {hasAbsence ? (
                          <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>{item.absentCount} Absent</span>
                          </div>
                        ) : hasRecorded ? (
                          <div className="flex items-center gap-1 text-[10px] text-[#00ff88] font-bold">
                            <span className="w-2 h-2 rounded-full bg-[#00ff88]" />
                            <span>{item.presentCount} Present</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <span>Scheduled</span>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Detail Inspection */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/15 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Lectures for {formattedHistoryDate}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Section {currentSection?.name} • Room {currentSection?.room_number}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="text-emerald-400">Present: {historyData.presentCount}</span>
                <span className="text-slate-600">|</span>
                <span className="text-rose-400">Absent: {historyData.absentCount}</span>
                <span className="text-slate-600">|</span>
                <span className="text-amber-300">Not Recorded: {historyData.notRecordedCount}</span>
              </div>
            </div>

            {historyData.lectures.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-emerald-500/10">
                <Calendar className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                <p className="font-bold text-white text-sm">
                  {new Date(selectedHistoryDate).getDay() === 0 
                    ? 'Sunday — No Academic Classes Scheduled (Weekend / Holiday)' 
                    : `No lectures scheduled on this date for Section ${currentSection?.name}.`}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {new Date(selectedHistoryDate).getDay() === 0 
                    ? 'College academic sessions operate Monday through Saturday.' 
                    : 'No timetable slots exist for this date in your section.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyData.lectures.map((lec) => (
                  <div
                    key={lec.timetableEntryId}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-[#00ff88] font-mono text-xs font-bold shrink-0 min-w-[105px] text-center">
                        {lec.startTime} – {lec.endTime}
                        <span className="block text-[9px] text-slate-400 font-sans font-normal">Period {lec.periodNumber}</span>
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

                      {lec.status !== 'Present' && !lec.claimId && (
                        <Button
                          variant="neon"
                          size="sm"
                          onClick={() => setSelectedLectureForClaim(lec)}
                          leftIcon={<RotateCcw className="w-3.5 h-3.5 text-slate-950" />}
                          className="text-xs font-bold"
                        >
                          Claim Attendance
                        </Button>
                      )}

                      {lec.claimStatus === 'pending' && (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                          Claim Pending Review
                        </span>
                      )}

                      {lec.claimStatus === 'approved' && (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-[#00ff88] text-[11px] font-bold border border-emerald-500/30">
                          Claim Approved
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: SUBJECT-WISE LEDGER TABLE */}
      {/* ======================================================== */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-400">Filter Subject:</label>
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
              >
                <option value="all">All Subjects (10)</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
                ))}
              </select>
            </div>

            <span className="text-xs text-[#00ff88] font-bold">AKTU 75% Rule Enforced</span>
          </div>

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
                    <th className="px-5 py-3.5 text-center">Eligibility</th>
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
                            {item.totalConducted > 0 ? `${item.percentage}%` : 'No Data'}
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
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: MY ATTENDANCE CLAIMS HISTORY */}
      {/* ======================================================== */}
      {activeTab === 'claims' && (
        <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-emerald-500/15 flex items-center justify-between bg-slate-950/40">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Submitted Attendance Claims & Rectifications
              </h3>
              <p className="text-xs text-slate-400">Claims are reviewed directly by the designated faculty coordinator</p>
            </div>
            <span className="text-xs text-emerald-400 font-semibold">Real-Time Database Records</span>
          </div>

          {myClaims.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00ff88] mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">No Attendance Claims Submitted</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                If you were marked absent for a lecture you attended, you can claim attendance from the Today or History tabs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                  <tr>
                    <th className="px-5 py-3.5">Lecture Date & Time</th>
                    <th className="px-5 py-3.5">Subject</th>
                    <th className="px-5 py-3.5">Faculty Coordinator</th>
                    <th className="px-5 py-3.5">Your Reason</th>
                    <th className="px-5 py-3.5">Faculty Remarks</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-500/10">
                  {myClaims.map((req) => {
                    const record = attendanceRecords.find(r => r.id === req.attendance_record_id);
                    const session = attendanceSessions.find(s => s.id === record?.attendance_session_id);
                    const sub = subjects.find(s => s.id === session?.subject_id);
                    const fac = faculty.find(f => f.id === session?.faculty_id);

                    return (
                      <tr key={req.id} className="hover:bg-emerald-500/5 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-white">
                          {session?.session_date || '2026-08-22'}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {session?.start_time?.substring(0, 5) || '09:00'} – {session?.end_time?.substring(0, 5) || '09:50'}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-bold text-emerald-400">
                          {sub?.subject_name || 'Subject'}
                        </td>
                        <td className="px-5 py-4 text-slate-300 font-medium">
                          {fac?.full_name || 'Faculty Member'}
                        </td>
                        <td className="px-5 py-4 text-slate-300 italic max-w-xs truncate" title={req.reason}>
                          "{req.reason}"
                        </td>
                        <td className="px-5 py-4 text-slate-400 text-[11px]">
                          {req.review_remarks || (req.status === 'pending' ? 'Pending faculty review' : 'No remarks')}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border',
                            req.status === 'approved' 
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                              : req.status === 'rejected'
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          )}>
                            {req.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Claim Attendance Modal */}
      {selectedLectureForClaim && (
        <ClaimAttendanceModal
          isOpen={true}
          onClose={() => setSelectedLectureForClaim(null)}
          lecture={selectedLectureForClaim}
        />
      )}
    </div>
  );
};

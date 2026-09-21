import React, { useState, useEffect } from 'react';
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
import { clsx } from 'clsx';
import { 
  getISTTodayDate, 
  getISTDayOfWeek, 
  formatDateDisplay, 
  getClaimWindowStatus, 
  getISTCurrentTimeString,
  getClassTimingStatus,
  isClassCompleted,
  ClaimWindowStatus 
} from '../../lib/utils/dateUtils';
import { SubjectAttendanceStat } from '../../types/academic.types';
import { DayOfWeek } from '../../types/database.types';

export const StudentAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { 
    getStudentAttendance, 
    getTodayLecturesForStudent,
    getDateLecturesForStudent,
    getStudentAcademicContext,
    subjects, 
    faculty,
    sections,
    attendanceSessions,
    attendanceRecords,
    corrections,
    students,
    departments,
    programs,
    years,
    semesters,
    sessions
  } = useAcademic();

  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const student = currentStudent;
  const studentId = currentStudent?.id || '';
  const stats = getStudentAttendance(studentId);
  const studentContext = getStudentAcademicContext(studentId);

  const currentSection = studentContext.section;
  const dept = studentContext.department;
  const program = studentContext.program;
  const year = studentContext.academicYear;
  const sem = studentContext.semester;
  const session = studentContext.academicSession;
  const branchName = studentContext.departmentName;

  // Primary Navigation Tab: 'today' | 'history' | 'table' | 'claims'
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'table' | 'claims'>('today');

  // Filter state for Table View
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  // History State
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => {
    const d = new Date(getISTTodayDate());
    return d.getMonth();
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const d = new Date(getISTTodayDate());
    return d.getFullYear();
  });
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>(() => getISTTodayDate());

  // Modal State for Claiming Attendance
  const [selectedLectureForClaim, setSelectedLectureForClaim] = useState<TodayAttendanceLecture | null>(null);

  // Reactive Time and Claim Window Status (IST)
  const [currentTimeIST, setCurrentTimeIST] = useState<string>(() => getISTCurrentTimeString());
  const [claimWindowStatus, setClaimWindowStatus] = useState<ClaimWindowStatus>(() => getClaimWindowStatus());

  useEffect(() => {
    const checkStatus = () => {
      setCurrentTimeIST(getISTCurrentTimeString());
      setClaimWindowStatus(getClaimWindowStatus());
    };
    const timer = setInterval(checkStatus, 10000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkStatus();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

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
      s.totalConducted > 0 && s.percentage !== null ? `${s.percentage}%` : 'No data',
      s.totalConducted === 0 || s.percentage === null ? 'No attendance recorded' : s.percentage >= 75 ? 'Eligible' : 'Defaulter'
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
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0f172a] font-serif-institutional tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#0f172a]" />
            Official Attendance Ledger & History
          </h1>
          <p className="text-[15px] text-[#475569] mt-1 font-medium leading-relaxed">
            {program?.name || 'B.Tech'} <span className="text-[#0f172a] font-bold">{branchName}</span>{year?.name ? ` • ${year.name}` : ''}{sem?.name ? ` • ${sem.name}` : ''} • Section <span className="text-[#0f172a] font-bold">{currentSection?.name || '—'}</span>{session?.name ? ` • ${session.name}` : ''}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          leftIcon={<Download className="w-4 h-4 text-[#0f172a]" />}
          className="border-slate-200 hover:bg-slate-50 text-[#0f172a] font-semibold"
        >
          Download CSV Report
        </Button>
      </div>

      {/* 2. SUMMARY KPI STATS ROW (100% Real Supabase Calculation) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[#475569]">Overall Attendance: </span>
            <span className="text-[#0f172a] font-extrabold text-sm ml-1">
              {stats.totalLectures > 0 && stats.percentage !== null ? `${stats.percentage}%` : 'No data'}
            </span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[#475569]">Recorded Lectures: </span>
            <span className="text-[#0f172a] font-bold text-sm ml-1">{stats.totalLectures}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-800">Attended (Present): </span>
            <span className="text-emerald-900 font-bold text-sm ml-1">{stats.presentLectures}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
            <span className="text-rose-800">Missed (Absent): </span>
            <span className="text-rose-900 font-bold text-sm ml-1">{totalAbsent}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[#475569]">Today Not Recorded: </span>
            <span className="text-[#0f172a] font-bold text-sm ml-1">{stats.notRecordedCount}</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-amber-900">Pending Claims: </span>
            <span className="text-amber-950 font-bold text-sm ml-1">{stats.pendingClaimsCount}</span>
          </div>
        </div>

        <div className="text-xs text-[#475569] font-medium italic">
          Formula: Present ÷ (Present + Absent) × 100
        </div>
      </div>

      {/* 3. PRIMARY NAVIGATION TABS */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-2 w-fit text-sm font-semibold">
        <button
          onClick={() => setActiveTab('today')}
          className={clsx(
            'px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer font-semibold',
            activeTab === 'today' ? 'bg-[#0f172a] text-white shadow-xs font-bold' : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-100'
          )}
        >
          <Clock className="w-4 h-4" />
          <span>Today's Classes</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={clsx(
            'px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer font-semibold',
            activeTab === 'history' ? 'bg-[#0f172a] text-white shadow-xs font-bold' : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-100'
          )}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Attendance History & Calendar</span>
        </button>

        <button
          onClick={() => setActiveTab('table')}
          className={clsx(
            'px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer font-semibold',
            activeTab === 'table' ? 'bg-[#0f172a] text-white shadow-xs font-bold' : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-100'
          )}
        >
          <TableIcon className="w-4 h-4" />
          <span>Subject-Wise Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={clsx(
            'px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer font-semibold',
            activeTab === 'claims' ? 'bg-[#0f172a] text-white shadow-xs font-bold' : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-100'
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
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#0f172a] font-serif-institutional">
                Scheduled Lectures for Today — {formattedTodayDate}
              </h2>
              <p className="text-sm text-[#475569] mt-0.5 font-medium">
                {studentContext.formattedSectionLabel}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {claimWindowStatus === 'OPEN' ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Claim Window Open (09:00 AM – 03:40 PM IST)
                </span>
              ) : claimWindowStatus === 'BEFORE_WINDOW' ? (
                <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Claim Window Opens at 09:00 AM IST
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-1.5" title="Student claims close promptly at 03:40 PM IST">
                  <XCircle className="w-3.5 h-3.5 text-rose-700" />
                  Claim Window Closed for Today (03:40 PM IST)
                </span>
              )}
              <span className="hidden sm:inline-block px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[#475569] text-xs font-bold">
                Live Sync
              </span>
            </div>
          </div>

          {todayLectures.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#475569] font-medium">
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
                const isLunchOrBreak = lec.lectureType?.toLowerCase().includes('lunch') || 
                                       lec.lectureType?.toLowerCase().includes('break') ||
                                       lec.subjectName?.toLowerCase().includes('lunch') ||
                                       lec.subjectName?.toLowerCase().includes('break');

                return (
                  <div
                    key={lec.timetableEntryId}
                    className={clsx(
                      'p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4',
                      isAbsent ? 'bg-rose-50/20 border-rose-200' : isPresent ? 'bg-slate-50/60 border-slate-200' : 'bg-white border-slate-200'
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[#0f172a] font-mono text-xs sm:text-sm font-bold shrink-0 min-w-[105px] text-center shadow-2xs">
                        {lec.startTime} – {lec.endTime}
                        <span className="block text-[11px] text-[#475569] font-sans font-medium">Period {lec.periodNumber}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[15px] font-bold text-[#0f172a]">
                            {lec.subjectName}
                          </h4>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-[#0f172a] font-bold border border-slate-200">
                            {lec.subjectCode}
                          </span>
                        </div>
                        <p className="text-sm text-[#475569] mt-0.5 font-medium">
                          {lec.facultyName} • <span className="text-[#0f172a] font-semibold">{lec.roomNumber}</span> • {lec.lectureType}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      {isLunchOrBreak ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 border border-slate-200 text-[#475569]">
                          Attendance Not Applicable
                        </span>
                      ) : (
                        <>
                          {isPresent && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              ✓ PRESENT
                            </span>
                          )}

                          {hasPendingClaim && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 shadow-2xs">
                              <Clock className="w-3.5 h-3.5 animate-spin text-amber-700" />
                              ⏳ Claim Pending
                            </span>
                          )}

                          {hasApprovedClaim && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              ✓ Claim Approved
                            </span>
                          )}

                          {!isPresent && !hasPendingClaim && !hasApprovedClaim && (
                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* Absent without Claim */}
                              {isAbsent && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 border border-rose-300 text-rose-800 shadow-2xs">
                                  <XCircle className="w-3.5 h-3.5 text-rose-700" />
                                  ✕ ABSENT
                                </span>
                              )}

                              {/* Attendance Not Recorded */}
                              {isNotRecorded && (() => {
                                const timingStatus = getClassTimingStatus({
                                  startTime: lec.startTime,
                                  endTime: lec.endTime,
                                  sessionDate: lec.sessionDate || todayDateStr,
                                  currentTimeIST,
                                  currentDateIST: todayDateStr,
                                });

                                return (
                                  <>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 border border-slate-300 text-[#475569]">
                                      <Clock className="w-3.5 h-3.5 text-[#475569]" />
                                      — Not Recorded
                                    </span>

                                    {/* 1. Future Class */}
                                    {timingStatus === 'FUTURE' && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100 border border-slate-200 text-[#475569]">
                                        <Clock className="w-3.5 h-3.5 text-[#475569]" />
                                        Starts at {lec.startTime}
                                      </span>
                                    )}

                                    {/* 2. Ongoing Class */}
                                    {timingStatus === 'ONGOING' && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#0f172a] text-white shadow-xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        In Progress (Ends {lec.endTime})
                                      </span>
                                    )}

                                    {/* 3. Completed Class */}
                                    {timingStatus === 'COMPLETED' && (
                                      claimWindowStatus === 'OPEN' ? (
                                        <Button
                                          variant="neon"
                                          size="sm"
                                          onClick={() => setSelectedLectureForClaim(lec)}
                                          leftIcon={<RotateCcw className="w-3.5 h-3.5 text-white" />}
                                          className="text-xs font-bold"
                                        >
                                          Claim Attendance
                                        </Button>
                                      ) : claimWindowStatus === 'BEFORE_WINDOW' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900">
                                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                                          Claim opens 9:00 AM
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 border border-rose-300 text-rose-800" title="Claims are only accepted between 09:00 AM and 03:40 PM IST">
                                          <Clock className="w-3.5 h-3.5 text-rose-700" />
                                          Claim Closed (3:40 PM)
                                        </span>
                                      )
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </>
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
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0f172a] font-serif-institutional tracking-tight">
                Interactive Attendance Calendar
              </h2>
              <p className="text-sm text-[#475569] mt-0.5 font-medium">
                Select any date to inspect historical lecture records and claim discrepancies
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevMonth}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#475569] hover:text-[#0f172a] hover:bg-slate-100 transition-all cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[#0f172a] font-bold text-sm min-w-[160px] text-center">
                {monthNames[selectedMonthIndex]} {selectedYear}
              </div>

              <button
                onClick={handleNextMonth}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#475569] hover:text-[#0f172a] hover:bg-slate-100 transition-all cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-[#475569] uppercase tracking-wider">
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
                  return <div key={`empty-${idx}`} className="h-20 rounded-2xl bg-slate-50/50 border border-transparent" />;
                }

                const isSelected = item.dateStr === selectedHistoryDate;
                const hasAbsence = item.absentCount > 0;
                const hasRecorded = item.presentCount > 0 && !hasAbsence;

                return (
                  <button
                    key={item.dateStr}
                    onClick={() => setSelectedHistoryDate(item.dateStr)}
                    className={clsx(
                      'h-20 p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                      isSelected ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-xs' : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50/60'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={clsx('text-sm font-bold', isSelected ? 'text-white' : 'text-[#0f172a]')}>
                        {item.dayNumber}
                      </span>
                      {item.isSunday && (
                        <span className={clsx('text-[10px] font-bold', isSelected ? 'text-slate-300' : 'text-slate-500')}>Holiday</span>
                      )}
                    </div>

                    {!item.isSunday && item.totalLectures > 0 && (
                      <div className="flex items-center gap-1 mt-auto">
                        {hasAbsence ? (
                          <div className="flex items-center gap-1 text-[11px] text-rose-700 font-bold">
                            <span className="w-2 h-2 rounded-full bg-rose-600" />
                            <span>{item.absentCount} Absent</span>
                          </div>
                        ) : hasRecorded ? (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                            <span>{item.presentCount} Present</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-[#475569] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
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
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#0f172a] font-serif-institutional tracking-tight">
                    Lectures for {formattedHistoryDate}
                  </h3>
                  {selectedHistoryDate === todayDateStr && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-[#0f172a] text-white">
                      Today
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#475569] mt-0.5 font-medium">
                  {studentContext.formattedSectionLabel}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-emerald-700 font-bold">Present: {historyData.presentCount}</span>
                <span className="text-slate-300">|</span>
                <span className="text-rose-700 font-bold">Absent: {historyData.absentCount}</span>
                <span className="text-slate-300">|</span>
                <span className="text-amber-700 font-bold">Not Recorded: {historyData.notRecordedCount}</span>
              </div>
            </div>

            {historyData.lectures.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#475569] bg-slate-50 rounded-2xl border border-slate-200/80">
                <Calendar className="w-8 h-8 text-[#475569] mx-auto mb-2 opacity-60" />
                <p className="font-bold text-[#0f172a] text-base">
                  {new Date(selectedHistoryDate).getDay() === 0 
                    ? 'Sunday — No Academic Classes Scheduled (Weekend / Holiday)' 
                    : `No lectures scheduled on this date for Section ${currentSection?.name}.`}
                </p>
                <p className="text-xs text-[#475569] mt-1 font-medium">
                  {new Date(selectedHistoryDate).getDay() === 0 
                    ? 'College academic sessions operate Monday through Saturday.' 
                    : 'No timetable slots exist for this date in your section.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyData.lectures.map((lec) => {
                  const isToday = selectedHistoryDate === todayDateStr;
                  const isLunchOrBreak = lec.lectureType?.toLowerCase().includes('lunch') || 
                                         lec.lectureType?.toLowerCase().includes('break') ||
                                         lec.subjectName?.toLowerCase().includes('lunch') ||
                                         lec.subjectName?.toLowerCase().includes('break');
                  const isPresent = lec.status === 'Present';
                  const hasPendingClaim = lec.claimStatus === 'pending';
                  const hasApprovedClaim = lec.claimStatus === 'approved';

                  return (
                    <div
                      key={lec.timetableEntryId}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[#0f172a] font-mono text-xs font-bold shrink-0 min-w-[110px] text-center shadow-2xs">
                          {lec.startTime} – {lec.endTime}
                          <span className="block text-[11px] text-[#475569] font-sans font-medium">Period {lec.periodNumber}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-[#0f172a]">
                              {lec.subjectName}
                            </h4>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-[#0f172a] font-bold border border-slate-200">
                              {lec.subjectCode}
                            </span>
                          </div>
                          <p className="text-sm text-[#475569] mt-0.5 font-medium">
                            {lec.facultyName} • <span className="text-[#0f172a] font-semibold">{lec.roomNumber}</span> • {lec.lectureType}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        {isLunchOrBreak ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 border border-slate-200 text-[#475569]">
                            Attendance Not Applicable
                          </span>
                        ) : (
                          <>
                            <AttendanceStatusBadge status={lec.status} />

                            {hasPendingClaim && (
                              <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                                Claim Pending Review
                              </span>
                            )}

                            {hasApprovedClaim && (
                              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                                Claim Approved
                              </span>
                            )}

                            {/* Only today's unrecorded classes can be claimed within the open window once class has ended */}
                            {isToday && lec.status === 'Not Recorded' && !hasPendingClaim && !hasApprovedClaim && (() => {
                              const timingStatus = getClassTimingStatus({
                                startTime: lec.startTime,
                                endTime: lec.endTime,
                                sessionDate: lec.sessionDate || todayDateStr,
                                currentTimeIST,
                                currentDateIST: todayDateStr,
                              });

                              if (timingStatus !== 'COMPLETED') {
                                return null;
                              }

                              return claimWindowStatus === 'OPEN' ? (
                                <Button
                                  variant="neon"
                                  size="sm"
                                  onClick={() => setSelectedLectureForClaim(lec)}
                                  leftIcon={<RotateCcw className="w-3.5 h-3.5 text-white" />}
                                  className="text-xs font-bold"
                                >
                                  Claim Attendance
                                </Button>
                              ) : claimWindowStatus === 'BEFORE_WINDOW' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800">
                                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                                  Claim opens 9:00 AM
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 border border-rose-200 text-rose-800" title="Claims are only accepted between 09:00 AM and 03:40 PM IST">
                                  <Clock className="w-3.5 h-3.5 text-rose-700" />
                                  Claim Closed (3:40 PM)
                                </span>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
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
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-[#475569]">Filter Subject:</label>
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="px-3 py-1.5 text-sm font-semibold bg-white border border-slate-200 rounded-xl text-[#0f172a] focus:outline-none focus:border-slate-400"
              >
                <option value="all">All Enrolled Subjects ({stats.subjectStats.length})</option>
                {stats.subjectStats.map(s => (
                  <option key={s.subjectId} value={s.subjectId}>{s.subjectName} ({s.subjectCode})</option>
                ))}
              </select>
            </div>

            <span className="text-xs text-[#0f172a] font-bold px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
              AKTU 75% Rule Enforced
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[#0f172a] font-bold text-xs uppercase tracking-wider border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-200">
                  {filteredSubjectBreakdown.map((item) => {
                    const isEligible = item.totalConducted > 0 && item.percentage !== null && item.percentage >= 75;
                    const itemAbsent = item.totalConducted - item.attended;
                    return (
                      <tr key={item.subjectId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-[#0f172a]">
                          {item.subjectCode}
                        </td>
                        <td className="px-5 py-4 font-bold text-[#0f172a]">
                          {item.subjectName}
                        </td>
                        <td className="px-5 py-4 text-[#475569] font-medium">
                          {item.facultyName}
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-[#0f172a]">
                          {item.totalConducted}
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-emerald-700">
                          {item.attended}
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-rose-700">
                          {itemAbsent}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-slate-100 border border-slate-200 text-[#0f172a]">
                            {item.totalConducted > 0 && item.percentage !== null ? `${item.percentage}%` : 'No Data'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-bold border',
                            item.totalConducted === 0 || item.percentage === null
                              ? 'bg-slate-100 border-slate-200 text-[#475569]'
                              : isEligible 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                          )}>
                            {item.totalConducted === 0 || item.percentage === null ? 'No attendance recorded' : isEligible ? 'Eligible' : 'Defaulter (<75%)'}
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
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
            <div>
              <h3 className="text-base font-bold text-[#0f172a] tracking-tight">
                Submitted Attendance Claims & Rectifications
              </h3>
              <p className="text-sm text-[#475569] font-medium mt-0.5">Claims are reviewed directly by the designated faculty coordinator</p>
            </div>
            <span className="text-xs text-[#475569] font-semibold">Real-Time Database Records</span>
          </div>

          {myClaims.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f172a] mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-[#0f172a]">No Attendance Claims Submitted</h4>
              <p className="text-sm text-[#475569] font-medium max-w-sm mx-auto">
                If you were marked absent for a lecture you attended, you can claim attendance from the Today or History tabs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[#0f172a] font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Lecture Date & Time</th>
                    <th className="px-5 py-3.5">Subject</th>
                    <th className="px-5 py-3.5">Faculty Coordinator</th>
                    <th className="px-5 py-3.5">Your Reason</th>
                    <th className="px-5 py-3.5">Faculty Remarks</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {myClaims.map((req) => {
                    const record = attendanceRecords.find(r => r.id === req.attendance_record_id);
                    const session = attendanceSessions.find(s => s.id === record?.attendance_session_id);
                    const sub = subjects.find(s => s.id === session?.subject_id);
                    const fac = faculty.find(f => f.id === session?.faculty_id);

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-[#0f172a]">
                          {session?.session_date || '2026-08-22'}
                          <span className="block text-xs text-[#475569] font-sans font-normal mt-0.5">
                            {session?.start_time?.substring(0, 5) || '09:00'} – {session?.end_time?.substring(0, 5) || '09:50'}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-bold text-[#0f172a]">
                          {sub?.subject_name || 'Subject'}
                        </td>
                        <td className="px-5 py-4 text-[#475569] font-medium">
                          {fac?.full_name || 'Faculty Member'}
                        </td>
                        <td className="px-5 py-4 text-[#334155] italic max-w-xs truncate" title={req.reason}>
                          "{req.reason}"
                        </td>
                        <td className="px-5 py-4 text-[#475569] text-xs font-medium">
                          {req.review_remarks || (req.status === 'pending' ? 'Pending faculty review' : 'No remarks')}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border',
                            req.status === 'approved' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : req.status === 'rejected'
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
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

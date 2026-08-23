import React, { useState } from 'react';
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
  Sparkles,
  HelpCircle,
  ShieldCheck,
  FileQuestion
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic, TodayAttendanceLecture } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { CyberGauge3D } from '../../components/3d/CyberGauge3D';
import { ClaimAttendanceModal } from '../../components/correction/ClaimAttendanceModal';
import { getISTTodayDate, getISTDayOfWeek, formatDateDisplay } from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';

interface StudentDashboardProps {
  onNavigate: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    getStudentAttendance, 
    getTodayLecturesForStudent,
    sections, 
    years, 
    semesters, 
    programs,
    corrections,
    students
  } = useAcademic();

  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const student = currentStudent;
  const studentId = currentStudent?.id || '';
  const stats = getStudentAttendance(studentId);

  const section = sections.find(s => s.id === currentStudent?.section_id) || 
                  sections.find(s => s.name === currentStudent?.section?.name);
  const isSectionB = section?.name === 'B';
  const branchName = isSectionB ? 'CSE + IT' : 'CSE';

  const year = years.find(y => y.id === currentStudent?.academic_year_id);
  const prog = programs.find(p => p.id === currentStudent?.program_id);

  // Today's Date in Asia/Kolkata (IST)
  const todayDateStr = getISTTodayDate();
  const todayDay = getISTDayOfWeek(todayDateStr);
  const formattedTodayDate = formatDateDisplay(todayDateStr);

  // Today's live scheduled lectures and attendance statuses strictly from Supabase
  const todayLectures = getTodayLecturesForStudent(studentId, todayDateStr);

  const todayRecorded = todayLectures.filter(l => l.status === 'Present' || l.status === 'Absent').length;
  const todayPresent = todayLectures.filter(l => l.status === 'Present').length;
  const todayAbsent = todayLectures.filter(l => l.status === 'Absent').length;
  const todayNotRecorded = todayLectures.filter(l => l.status === 'Not Recorded').length;

  // Unclaimed absent lectures today
  const unclaimedAbsents = todayLectures.filter(l => l.status === 'Absent' && !l.claimId);

  // Modal State for Claiming Attendance
  const [selectedLectureForClaim, setSelectedLectureForClaim] = useState<TodayAttendanceLecture | null>(null);

  const totalAbsent = stats.totalLectures - stats.presentLectures;

  return (
    <div className="space-y-6">
      {/* 1. WELCOME BANNER */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Welcome back, {student?.full_name || user?.full_name || 'Student'} 👋
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Roll No. <span className="text-[#00ff88] font-bold">{student?.roll_number || '—'}</span> • B.Tech <span className="text-[#00ff88] font-bold">{branchName}</span> • {year?.name || 'Academic Year'} • {section?.name ? `Section ${section.name}` : 'Section Assigned'} {section?.room_number ? `(${section.room_number})` : ''}
          </p>
        </div>

        <div className="z-10 flex items-center gap-3">
          <Button
            variant="neon"
            size="sm"
            onClick={() => onNavigate('corrections')}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            My Claims {stats.pendingClaimsCount > 0 && `(${stats.pendingClaimsCount} Pending)`}
          </Button>
        </div>
      </div>

      {/* 2. ATTENDANCE ISSUE ALERT BANNER (If Absent exists) */}
      {unclaimedAbsents.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {unclaimedAbsents.length} Attendance Issue{unclaimedAbsents.length > 1 ? 's' : ''} Today May Need Your Attention
              </h4>
              <p className="text-[11px] text-amber-200/80">
                You were marked absent in {unclaimedAbsents[0].subjectName}. If this is incorrect, you can submit an attendance claim.
              </p>
            </div>
          </div>

          <Button
            variant="neon"
            size="sm"
            onClick={() => setSelectedLectureForClaim(unclaimedAbsents[0])}
            className="text-xs shrink-0 bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-400 font-bold"
          >
            Review & Claim Now
          </Button>
        </div>
      )}

      {/* 3. TODAY'S ATTENDANCE SUMMARY & CLASSES (PROMINENT SECTION) */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/15 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse" />
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                Today's Classes & Live Attendance
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Official live status for <strong className="text-white">{formattedTodayDate}</strong> • Section {section?.name} ({section?.room_number})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-300">
              Scheduled: <strong className="text-white">{todayLectures.length}</strong>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-300">
              Recorded: <strong className="text-[#00ff88]">{todayRecorded}</strong>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-300">
              Present: <strong className="text-emerald-400">{todayPresent}</strong>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-300">
              Absent: <strong className="text-rose-400">{todayAbsent}</strong>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-slate-300">
              Not Recorded: <strong className="text-amber-300">{todayNotRecorded}</strong>
            </div>
          </div>
        </div>

        {/* Lectures List for Today */}
        {todayLectures.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-emerald-500/10">
            <Calendar className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
            <p className="font-bold text-white text-sm">
              {todayDay === 'SUN' ? 'Sunday — No classes scheduled today' : 'No classes scheduled for today'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {todayDay === 'SUN' 
                ? 'Academic lectures are not held on Sundays. Classes resume on Monday.' 
                : 'No timetable classes are scheduled for today in your section.'}
            </p>
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
                      ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50' 
                      : isPresent 
                      ? 'bg-slate-950/60 border-emerald-500/20 hover:border-emerald-500/40' 
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Time Slot Badge */}
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-[#00ff88] font-mono text-xs font-bold shrink-0 text-center min-w-[100px]">
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

                  {/* Right: Status and Claim Action */}
                  <div className="shrink-0 flex items-center gap-3 justify-between sm:justify-end">
                    {/* Status Badge */}
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
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          Claim Pending Review
                        </span>
                      </div>
                    )}

                    {hasApprovedClaim && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/30 text-[#00ff88]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Claim Approved (Present)
                      </span>
                    )}

                    {isNotRecorded && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-amber-400/80" />
                        Attendance Not Recorded
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. OVERALL STATS KPI CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

      {/* 5. ATTENDANCE OVERVIEW & SUBJECT PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: CyberGauge3D Overview */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Semester 3 Attendance Ratio
            </h3>
            <span className="text-xs font-semibold text-emerald-400">Odd Sem 2026–27</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
            <CyberGauge3D
              percentage={stats.percentage}
              size={150}
              label="Overall"
              subLabel="Attendance"
            />

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
              Open Complete Attendance Ledger & History →
            </Button>
          </div>
        </div>

        {/* Right: Subject-wise Performance Cards */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Subject Wise Performance
              </h3>
              <p className="text-xs text-slate-400">Assigned Faculty & Eligibility • Section {section?.name}</p>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-bold text-[#00ff88] hover:underline cursor-pointer"
            >
              Detailed Table →
            </button>
          </div>

          {(!stats.subjectStats || stats.subjectStats.length === 0) ? (
            <div className="py-8 text-center text-slate-400">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">No subjects assigned yet.</p>
              <p className="text-[11px] text-slate-500">Subject performance cards will appear upon enrollment</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stats.subjectStats.slice(0, 6).map((sb) => (
                <div
                  key={sb.subjectId}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/35 transition-all text-center space-y-1.5"
                >
                  <div className="text-xs font-bold text-white truncate" title={sb.subjectName}>
                    {sb.subjectName}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium truncate" title={sb.facultyName}>
                    {sb.facultyName}
                  </div>
                  <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                    {sb.totalConducted > 0 ? `${sb.percentage}%` : 'No Class Yet'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-emerald-500/10 text-xs text-slate-400 flex items-center justify-between">
            <span>Minimum AKTU Requirement: <strong>75%</strong></span>
            <span className="text-[#00ff88] font-semibold">Odd Session 2026–2027</span>
          </div>
        </div>

      </div>

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

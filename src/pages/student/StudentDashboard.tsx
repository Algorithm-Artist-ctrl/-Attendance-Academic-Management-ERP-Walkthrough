import React, { useState, useMemo } from 'react';
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
  FileQuestion,
  Award,
  FileText,
  Upload,
  ExternalLink,
  FileCheck,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic, TodayAttendanceLecture } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { CyberGauge3D } from '../../components/3d/CyberGauge3D';
import { ClaimAttendanceModal } from '../../components/correction/ClaimAttendanceModal';
import { Assignment, AssignmentSubmission, Quiz } from '../../types/database.types';
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
    sessions,
    programs,
    corrections,
    students,
    courseAssignments,
    assignmentSubmissions,
    quizzes,
    quizResults,
    submitAssignment
  } = useAcademic();

  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const student = currentStudent;
  const studentId = currentStudent?.id || '';
  const mySectionQuizzes = useMemo(() => {
    if (!currentStudent?.section_id) return [];
    return quizzes.filter(q => q.section_id === currentStudent.section_id && q.active);
  }, [quizzes, currentStudent?.section_id]);

  const mySectionAssignments = useMemo(() => {
    if (!currentStudent?.section_id) return [];
    return courseAssignments.filter(a => a.section_id === currentStudent.section_id && a.active);
  }, [courseAssignments, currentStudent?.section_id]);

  const mySubmissionsMap = useMemo(() => {
    if (!currentStudent) return new Map<string, AssignmentSubmission>();
    const map = new Map<string, AssignmentSubmission>();
    for (const sub of assignmentSubmissions.filter(s => s.student_id === currentStudent.id)) {
      map.set(sub.assignment_id, sub);
    }
    return map;
  }, [assignmentSubmissions, currentStudent]);

  // Quick Assignment Submission Modal State
  const [quickSubmitAssignment, setQuickSubmitAssignment] = useState<Assignment | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState('');

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSubmitAssignment || !currentStudent) return;
    setSubmitError('');
    setSubmitSuccessMsg('');

    if (quickSubmitAssignment.submission_type === 'google_form') {
      try {
        setIsSubmittingFile(true);
        await submitAssignment({
          assignmentId: quickSubmitAssignment.id,
          studentId: currentStudent.id,
          submissionType: 'google_form',
          googleFormSubmitted: true,
        });
        setSubmitSuccessMsg('Google Form submission recorded successfully!');
        setTimeout(() => {
          setQuickSubmitAssignment(null);
          setSubmitSuccessMsg('');
        }, 1500);
      } catch (err: any) {
        setSubmitError(err.message || 'Failed to record Google Form submission.');
      } finally {
        setIsSubmittingFile(false);
      }
      return;
    }

    if (!selectedFile) {
      setSubmitError('Please select a file to upload.');
      return;
    }

    try {
      setIsSubmittingFile(true);
      const reader = new FileReader();
      const fileDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await submitAssignment({
        assignmentId: quickSubmitAssignment.id,
        studentId: currentStudent.id,
        submissionType: 'file_upload',
        filePath: fileDataUrl,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
      });

      setSubmitSuccessMsg('Assignment submitted successfully!');
      setTimeout(() => {
        setQuickSubmitAssignment(null);
        setSelectedFile(null);
        setSubmitSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit assignment.');
    } finally {
      setIsSubmittingFile(false);
    }
  };

  const stats = getStudentAttendance(studentId);

  const section = sections.find(s => s.id === currentStudent?.section_id) || 
                  sections.find(s => s.name === currentStudent?.section?.name);
  const isSectionB = section?.name === 'B';
  const branchName = isSectionB ? 'CSE + IT' : 'CSE';

  const year = years.find(y => y.id === currentStudent?.academic_year_id);
  const prog = programs.find(p => p.id === currentStudent?.program_id);
  const sem = semesters.find(s => s.id === currentStudent?.semester_id);
  const session = sessions.find(s => s.id === currentStudent?.academic_session_id) || sessions[0];
  const sessionName = session?.name || 'Academic Session';
  const semTitle = sem?.name ? `${sem.name} Attendance Ratio` : 'Semester Attendance Ratio';

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
              {stats.totalLectures > 0 ? `${stats.percentage}%` : 'No Class Yet'}
            </h3>
            <span className="text-[10px] text-emerald-400 font-medium">
              {stats.totalLectures === 0 ? 'No attendance recorded' : stats.isDefaulter ? '⚠️ Below 75% Requirement' : '✅ AKTU Criteria Satisfied'}
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
            <span className="text-[10px] text-slate-400 font-medium">{sessionName}</span>
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

      {/* 5. CONTINUOUS ASSESSMENT & ACADEMIC WORK */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Quizzes */}
        <div 
          onClick={() => onNavigate('quizzes')}
          className="glass-panel rounded-2xl p-5 border border-purple-500/25 hover:border-purple-500/50 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Active Quizzes</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-2xl font-black text-white mt-2">
              {mySectionQuizzes.length}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Google Form assessments for Section {section?.name}</p>
          </div>
          <div className="mt-4 pt-3 border-t border-purple-500/15 flex items-center justify-between text-xs font-bold text-purple-400 group-hover:underline">
            <span>Open Quizzes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Assignments */}
        <div 
          onClick={() => onNavigate('student_assignments')}
          className="glass-panel rounded-2xl p-5 border border-blue-500/25 hover:border-blue-500/50 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Assignments</span>
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-2xl font-black text-white mt-2">
              {mySectionAssignments.length}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Tasks, file uploads & form submissions</p>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-500/15 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:underline">
            <span>Submit Assignments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Sessional Scorecard */}
        <div 
          onClick={() => onNavigate('marks')}
          className="glass-panel rounded-2xl p-5 border border-emerald-500/25 hover:border-emerald-500/50 cursor-pointer transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Marks Scorecard</span>
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black text-white mt-2">
              View Marks
            </h3>
            <p className="text-xs text-slate-400 mt-1">Sessional 1, 2, PUT & internal scores</p>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:underline">
            <span>Open Scorecard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 6. ATTENDANCE OVERVIEW & SUBJECT PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: CyberGauge3D Overview */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">
              {semTitle}
            </h3>
            <span className="text-xs font-semibold text-emerald-400">{sessionName}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
            <CyberGauge3D
              percentage={stats.totalLectures > 0 ? stats.percentage : 0}
              size={150}
              label={stats.totalLectures > 0 ? "Overall" : "No Data"}
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
              <p className="text-xs text-slate-400">Assigned Faculty & Eligibility{section?.name ? ` • Section ${section.name}` : ''}</p>
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
            <span className="text-[#00ff88] font-semibold">{sessionName}</span>
          </div>
        </div>

      </div>

      {/* 7. ACADEMIC ASSIGNMENTS & QUIZZES (SECTION SCOPED) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Section {section?.name || 'Assigned'} Assignments & Quizzes
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-semibold">
                  {mySectionAssignments.length} Assignments • {mySectionQuizzes.length} Quizzes
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Tasks, file submissions and Google Form assessments published for your section
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('student_assignments')}
              className="text-xs font-bold text-blue-400 hover:underline cursor-pointer"
            >
              All Assignments →
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => onNavigate('quizzes')}
              className="text-xs font-bold text-purple-400 hover:underline cursor-pointer"
            >
              All Quizzes →
            </button>
          </div>
        </div>

        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mySectionAssignments.length === 0 ? (
            <div className="col-span-full py-8 text-center glass-panel rounded-2xl border border-slate-800 text-slate-400">
              <FileCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">No active assignments for Section {section?.name || 'Assigned'}.</p>
              <p className="text-[11px] text-slate-500">Newly assigned homework and practicals will appear here</p>
            </div>
          ) : (
            mySectionAssignments.map(asgn => {
              const sub = mySubmissionsMap.get(asgn.id);
              const dueDate = new Date(asgn.due_date);
              const isPastDue = new Date() > dueDate;
              const isSubmitted = !!sub;

              return (
                <div
                  key={asgn.id}
                  className="glass-panel rounded-2xl p-4 border border-blue-500/20 hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 font-bold border border-blue-500/20">
                        {asgn.subject?.subject_code || 'Subject'}
                      </span>
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-black',
                        isSubmitted
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isPastDue
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      )}>
                        {isSubmitted ? (sub.status === 'graded' ? `Graded: ${sub.marks_obtained}/${asgn.max_marks}` : 'Submitted') : isPastDue ? 'Past Due' : 'Pending'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white line-clamp-1">{asgn.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{asgn.description || asgn.subject?.subject_name}</p>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span>Faculty: <strong className="text-slate-200">{asgn.faculty?.full_name || 'Faculty'}</strong></span>
                        <span>Max: <strong className="text-[#00ff88]">{asgn.max_marks} M</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3 h-3 text-blue-400" />
                        <span>Due: <strong className="text-slate-200">{dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-500/10 flex items-center gap-2">
                    {isSubmitted ? (
                      <div className="w-full flex items-center justify-between text-xs">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {sub.file_name ? sub.file_name.slice(0, 16) + '...' : 'Submitted'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[11px] py-1 px-2 h-auto"
                          onClick={() => {
                            setQuickSubmitAssignment(asgn);
                            setSelectedFile(null);
                            setSubmitError('');
                          }}
                        >
                          Resubmit
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full text-xs"
                        leftIcon={<Upload className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setQuickSubmitAssignment(asgn);
                          setSelectedFile(null);
                          setSubmitError('');
                        }}
                      >
                        Submit Assignment
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quizzes Quick Attempt Grid */}
        {mySectionQuizzes.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Active Section Quizzes (Google Forms)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {mySectionQuizzes.map(quiz => {
                return (
                  <div
                    key={quiz.id}
                    className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/25 flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-purple-300">{quiz.subject?.subject_code || 'Quiz'}</span>
                        <span className="text-[#00ff88] font-bold">{quiz.max_marks} Marks</span>
                      </div>
                      <h5 className="text-xs font-bold text-white mt-1 line-clamp-1">{quiz.title}</h5>
                      <p className="text-[11px] text-slate-400">By {quiz.faculty?.full_name || 'Faculty'}</p>
                    </div>

                    <a
                      href={quiz.google_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>Attempt Quiz</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Claim Attendance Modal */}
      {selectedLectureForClaim && (
        <ClaimAttendanceModal
          isOpen={true}
          onClose={() => setSelectedLectureForClaim(null)}
          lecture={selectedLectureForClaim}
        />
      )}

      {/* QUICK ASSIGNMENT SUBMISSION MODAL */}
      {quickSubmitAssignment && (
        <Modal
          isOpen={true}
          onClose={() => setQuickSubmitAssignment(null)}
          title={`Submit: ${quickSubmitAssignment.title}`}
        >
          <form onSubmit={handleQuickSubmit} className="space-y-4 text-xs">
            {submitError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {submitError}
              </div>
            )}
            {submitSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {submitSuccessMsg}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950/80 border border-blue-500/20 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-white">
                <span>{quickSubmitAssignment.subject?.subject_code} - {quickSubmitAssignment.subject?.subject_name}</span>
                <span className="text-[#00ff88]">Max: {quickSubmitAssignment.max_marks} Marks</span>
              </div>
              <p className="text-slate-400">{quickSubmitAssignment.description || 'Follow instructions given by faculty.'}</p>
              <div className="text-[11px] text-slate-500">
                Faculty: <strong className="text-slate-300">{quickSubmitAssignment.faculty?.full_name}</strong> • Section: <strong className="text-slate-300">{section?.name}</strong>
              </div>
            </div>

            {quickSubmitAssignment.google_form_url && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-purple-300 block">Google Form Task Link</span>
                  <span className="text-[10px] text-slate-400">Complete the form externally if required</span>
                </div>
                <a
                  href={quickSubmitAssignment.google_form_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold inline-flex items-center gap-1.5"
                >
                  <span>Open Form</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {quickSubmitAssignment.submission_type !== 'google_form' && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Upload Submission File (PDF / Doc / Image) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer bg-slate-950 border border-slate-800 rounded-xl p-2"
                />
                {selectedFile && (
                  <p className="text-[11px] text-emerald-400 mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickSubmitAssignment(null)}
                disabled={isSubmittingFile}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingFile}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                {quickSubmitAssignment.submission_type === 'google_form' ? 'Confirm Google Form Submitted' : 'Submit File to Supabase'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

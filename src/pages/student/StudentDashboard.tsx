import React, { useState, useMemo, useEffect } from 'react';
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
import { CardSkeleton, TimetableSkeleton } from '../../components/common/SkeletonLoader';
import { CyberGauge3D } from '../../components/3d/CyberGauge3D';
import { ClaimAttendanceModal } from '../../components/correction/ClaimAttendanceModal';
import { Assignment, AssignmentSubmission, Quiz } from '../../types/database.types';
import { 
  getISTTodayDate, 
  getISTDayOfWeek, 
  formatDateDisplay,
  getClaimWindowStatus,
  getISTCurrentTimeString,
  getClassTimingStatus,
  ClaimWindowStatus
} from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';

interface StudentDashboardProps {
  onNavigate: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [currentTimeIST, setCurrentTimeIST] = useState<string>(() => getISTCurrentTimeString());
  const [claimWindowStatus, setClaimWindowStatus] = useState<ClaimWindowStatus>(() => getClaimWindowStatus());

  useEffect(() => {
    const updateStatus = () => {
      setCurrentTimeIST(getISTCurrentTimeString());
      setClaimWindowStatus(getClaimWindowStatus());
    };
    const interval = setInterval(updateStatus, 10000);
    document.addEventListener('visibilitychange', updateStatus);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', updateStatus);
    };
  }, []);
  const { 
    getStudentAttendance, 
    getTodayLecturesForStudent,
    sections, 
    years, 
    semesters, 
    sessions,
    programs,
    departments,
    corrections,
    students,
    courseAssignments,
    assignmentSubmissions,
    quizzes,
    quizResults,
    submitAssignment,
    getStudentAcademicScorecard,
    isLoading,
    timetable,
  } = useAcademic();

  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const student = currentStudent;
  const studentId = currentStudent?.id || '';

  const publishedScorecard = useMemo(() => {
    if (!studentId) return [];
    return getStudentAcademicScorecard(studentId);
  }, [studentId, getStudentAcademicScorecard]);

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

  const section = sections.find(s => s.id === currentStudent?.section_id);
  const dept = departments.find(d => d.id === currentStudent?.department_id);
  const prog = programs.find(p => p.id === currentStudent?.program_id);
  const branchName = dept?.name || prog?.name || 'Computer Science & Engineering';

  const year = years.find(y => y.id === currentStudent?.academic_year_id);
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
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <h1 className="font-serif-institutional text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Welcome back, {student?.full_name || user?.full_name || 'Student'} 👋
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Roll No. <strong className="text-slate-900 font-bold">{student?.roll_number || '—'}</strong> • {prog?.name || 'B.Tech'} <strong className="text-slate-900 font-bold">{branchName}</strong> • {year?.name || 'Academic Year'} • {section?.name ? `Section ${section.name}` : 'Section Assigned'} {section?.room_number ? `(${section.room_number})` : ''}
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
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                {unclaimedAbsents.length} Attendance Issue{unclaimedAbsents.length > 1 ? 's' : ''} Today May Need Your Attention
              </h4>
              <p className="text-[11px] text-amber-800">
                You were marked absent in {unclaimedAbsents[0].subjectName}. If this is incorrect, you can submit an attendance claim.
              </p>
            </div>
          </div>

          <Button
            variant="neon"
            size="sm"
            onClick={() => setSelectedLectureForClaim(unclaimedAbsents[0])}
            className="text-xs shrink-0 bg-[#0f172a] hover:bg-black text-white font-bold rounded-xl shadow-xs"
          >
            Review & Claim Now
          </Button>
        </div>
      )}

      {/* 3. TODAY'S ATTENDANCE SUMMARY & CLASSES (PROMINENT SECTION) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 animate-pulse" />
              <h2 className="font-serif-institutional text-base sm:text-lg font-black text-slate-900 tracking-wide">
                Today's Classes & Live Attendance
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official live status for <strong className="text-slate-900">{formattedTodayDate}</strong> • Section {section?.name} ({section?.room_number})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
              Scheduled: <strong className="text-slate-900">{todayLectures.length}</strong>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
              Recorded: <strong className="text-slate-900">{todayRecorded}</strong>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
              Present: <strong className="text-slate-900">{todayPresent}</strong>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
              Absent: <strong className="text-slate-700">{todayAbsent}</strong>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
              Not Recorded: <strong className="text-slate-500">{todayNotRecorded}</strong>
            </div>
          </div>
        </div>

        {/* Lectures List for Today */}
        {isLoading && todayLectures.length === 0 ? (
          <TimetableSkeleton slots={3} />
        ) : todayLectures.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200/80">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="font-bold text-slate-900 text-sm">
              {todayDay === 'SUN' ? 'Sunday — No classes scheduled today' : 'No classes scheduled for today'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
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
                      ? 'bg-slate-50/60 border-slate-200 hover:border-slate-300' 
                      : isPresent 
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs' 
                      : 'bg-slate-50/40 border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Time Slot Badge */}
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 font-mono text-xs font-bold shrink-0 text-center min-w-[100px]">
                      {lec.startTime} – {lec.endTime}
                      <span className="block text-[9px] text-slate-500 font-sans font-normal">Period {lec.periodNumber}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">
                          {lec.subjectName}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                          {lec.subjectCode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        {lec.facultyName} • <span className="text-slate-700">{lec.roomNumber}</span> • {lec.lectureType}
                      </p>
                    </div>
                  </div>

                  {/* Right: Status and Claim Action */}
                  <div className="shrink-0 flex items-center gap-2.5 justify-between sm:justify-end">
                    {/* Non-instructional / Lunch / Break */}
                    {lec.lectureType === 'Lunch' || lec.lectureType === 'Break' || !lec.subjectId ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/60 border border-slate-700/60 text-slate-400">
                        Attendance Not Applicable
                      </span>
                    ) : (
                      <>
                        {/* Status Badge */}
                        {isPresent && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0f172a] border border-slate-900 text-white shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            PRESENT
                          </span>
                        )}

                        {hasApprovedClaim && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0f172a] border border-slate-900 text-white shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Claim Approved (Present)
                          </span>
                        )}

                        {hasPendingClaim && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 border border-slate-300 text-slate-700">
                              <Clock className="w-3.5 h-3.5 animate-spin" />
                              Claim Submitted
                            </span>
                          </div>
                        )}

                        {!isPresent && !hasPendingClaim && !hasApprovedClaim && (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Scenario 5: When attendance was recorded by faculty as ABSENT, show Absent without Claim button */}
                            {isAbsent && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 border border-slate-200 text-slate-700">
                                <XCircle className="w-3.5 h-3.5" />
                                ABSENT
                              </span>
                            )}

                            {/* Attendance Not Recorded: Only eligible for claim if class has ENDED */}
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
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-50 border border-slate-200 text-slate-500">
                                    <Clock className="w-3.5 h-3.5 text-amber-400/80" />
                                    Attendance Not Recorded
                                  </span>

                                  {/* 1. Future Class: Show Scheduled indicator, NO Claim Attendance */}
                                  {timingStatus === 'FUTURE' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-600">
                                      Upcoming (Starts at {lec.startTime})
                                    </span>
                                  )}

                                  {/* 2. Ongoing Class: Show Class In Progress indicator, NO Claim Attendance */}
                                  {timingStatus === 'ONGOING' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-900 text-white shadow-xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      In Progress Now
                                    </span>
                                  )}

                                  {/* 3. Completed Class: Only after class has ended can student claim attendance */}
                                  {timingStatus === 'COMPLETED' && (
                                    claimWindowStatus === 'OPEN' ? (
                                      <Button
                                        variant="neon"
                                        size="sm"
                                        onClick={() => setSelectedLectureForClaim(lec)}
                                        leftIcon={<RotateCcw className="w-3.5 h-3.5 text-slate-950" />}
                                        className="text-xs font-bold"
                                      >
                                        Claim Attendance
                                      </Button>
                                    ) : claimWindowStatus === 'BEFORE_WINDOW' ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-900/90 border border-slate-700/60 text-slate-400">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        Claim opens 9:00 AM
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-900/90 border border-amber-500/20 text-slate-400">
                                        <Clock className="w-3 h-3 text-amber-400" />
                                        Claim Window Closed (3:40 PM)
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

      {/* 4. OVERALL STATS KPI CARDS GRID */}
      {isLoading && (!currentStudent || stats.totalLectures === 0) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <CardSkeleton count={4} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Overall Attendance */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs hover:shadow-sm transition-all">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Attendance</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {stats.totalLectures > 0 && stats.percentage !== null ? `${stats.percentage}%` : 'No attendance recorded yet'}
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">
                {stats.totalLectures === 0 || stats.percentage === null ? 'No attendance recorded yet' : stats.isDefaulter ? '⚠️ Below 75% Requirement' : '✅ AKTU Criteria Satisfied'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Recorded Lectures */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs hover:shadow-sm transition-all">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recorded Lectures</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {stats.totalLectures}
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">{sessionName}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>

          {/* Attended (Present) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs hover:shadow-sm transition-all">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attended (Present)</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {stats.presentLectures}
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">
                {stats.totalLectures > 0 ? 'Verified in Database' : 'No records yet'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* Absent */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs hover:shadow-sm transition-all">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Absent Lectures</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {totalAbsent}
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">Missed Lectures</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
              <XCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* 5. CONTINUOUS ASSESSMENT & ACADEMIC WORK */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Quizzes */}
        <div 
          onClick={() => onNavigate('quizzes')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-slate-400 cursor-pointer transition-all flex flex-col justify-between group shadow-xs hover:shadow-sm"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Quizzes</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {mySectionQuizzes.length}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Google Form assessments for Section {section?.name}</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 group-hover:underline">
            <span>Open Quizzes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Assignments */}
        <div 
          onClick={() => onNavigate('student_assignments')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-slate-400 cursor-pointer transition-all flex flex-col justify-between group shadow-xs hover:shadow-sm"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assignments</span>
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {mySectionAssignments.length}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Tasks, file uploads & form submissions</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 group-hover:underline">
            <span>Submit Assignments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Sessional Scorecard */}
        <div 
          onClick={() => onNavigate('marks')}
          className="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-slate-400 cursor-pointer transition-all flex flex-col justify-between group shadow-xs hover:shadow-sm"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marks Scorecard</span>
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {publishedScorecard.length > 0 ? `${publishedScorecard.length} Published` : 'No Marks Yet'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {publishedScorecard.length > 0 
                ? `${publishedScorecard.length} subject${publishedScorecard.length > 1 ? 's' : ''} with published scores`
                : 'Awaiting faculty evaluation'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 group-hover:underline">
            <span>Open Detailed Scorecard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* 6. ATTENDANCE OVERVIEW & SUBJECT PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: CyberGauge3D Overview */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              {semTitle}
            </h3>
            <span className="text-xs font-semibold text-slate-500">{sessionName}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
            <CyberGauge3D
              percentage={stats.totalLectures > 0 && stats.percentage !== null ? stats.percentage : 0}
              size={150}
              label={stats.totalLectures > 0 && stats.percentage !== null ? "Overall" : "No Data"}
              subLabel={stats.totalLectures > 0 && stats.percentage !== null ? "Attendance" : "No Records"}
            />

            <div className="space-y-3 w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                  <span className="text-slate-600 font-medium">Present</span>
                </div>
                <span className="font-bold text-slate-900 ml-auto sm:ml-4">{stats.presentLectures}</span>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-600 font-medium">Absent</span>
                </div>
                <span className="font-bold text-slate-900 ml-auto sm:ml-4">{totalAbsent}</span>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="text-slate-600 font-medium">Total Recorded</span>
                </div>
                <span className="font-bold text-slate-900 ml-auto sm:ml-4">{stats.totalLectures}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
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
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                Subject Wise Performance
              </h3>
              <p className="text-xs text-slate-400">Assigned Faculty & Eligibility{section?.name ? ` • Section ${section.name}` : ''}</p>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-bold text-slate-900 hover:underline cursor-pointer"
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
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all text-center space-y-1.5"
                >
                  <div className="text-xs font-bold text-slate-900 truncate" title={sb.subjectName}>
                    {sb.subjectName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate" title={sb.facultyName}>
                    {sb.facultyName}
                  </div>
                  <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-black bg-[#0f172a] text-white shadow-xs">
                    {sb.totalConducted > 0 && sb.percentage !== null ? `${sb.percentage}%` : 'No records yet'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Minimum AKTU Requirement: <strong>75%</strong></span>
            <span className="text-slate-800 font-semibold">{sessionName}</span>
          </div>
        </div>

      </div>

      {/* 6.5. PUBLISHED MARKS & CONTINUOUS ASSESSMENTS (ONLY SUBJECTS WITH PUBLISHED MARKS) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={clsx(
              "p-2 rounded-xl border",
              publishedScorecard.length > 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-slate-900 font-bold"
                : "bg-slate-800/60 border-slate-700/60 text-slate-400"
            )}>
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Published Continuous Assessments
                <span className={clsx(
                  "text-xs px-2.5 py-0.5 rounded-full border font-semibold",
                  publishedScorecard.length > 0
                    ? "bg-emerald-500/15 border-emerald-500/30 text-slate-900 font-bold"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                )}>
                  {publishedScorecard.length} Subject{publishedScorecard.length === 1 ? '' : 's'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Official sessional and internal marks published by faculty
              </p>
            </div>
          </div>
          {publishedScorecard.length > 0 && (
            <button
              onClick={() => onNavigate('marks')}
              className="text-xs font-bold text-slate-900 hover:underline cursor-pointer"
            >
              Full Scorecard →
            </button>
          )}
        </div>

        {publishedScorecard.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedScorecard.map((item) => (
              <div
                key={item.subjectId}
                onClick={() => onNavigate('marks')}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-slate-400 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between space-y-3 cursor-pointer group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      {item.subjectCode}
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {item.totalInternalScore} <span className="text-xs text-slate-500">/ {item.maxInternalScore}</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-black transition-colors line-clamp-1">
                      {item.subjectName}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Faculty: {item.facultyName}</p>
                  </div>

                  {item.sessionalMarks.sessionals.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-800 text-xs">
                      {item.sessionalMarks.sessionals.slice(0, 2).map((s, idx) => (
                        <div key={s.assessmentId || idx} className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 truncate max-w-[140px]">{s.title}:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {s.obtainedMarks} / {s.maxMarks}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-900 font-bold group-hover:underline">
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 text-center space-y-2">
            <Award className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">No Published Continuous Assessments Yet</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Faculty has not released any marks for this academic session yet. Saved drafts and internal evaluations will appear here once officially published.
            </p>
          </div>
        )}
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
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-slate-400 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
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
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{asgn.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{asgn.description || asgn.subject?.subject_name}</p>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span>Faculty: <strong className="text-slate-800">{asgn.faculty?.full_name || 'Faculty'}</strong></span>
                        <span>Max: <strong className="text-slate-900 font-bold">{asgn.max_marks} M</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3 h-3 text-blue-400" />
                        <span>Due: <strong className="text-slate-800">{dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
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
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 font-bold">{quiz.subject?.subject_code || 'Quiz'}</span>
                        <span className="text-slate-900 font-bold font-bold">{quiz.max_marks} Marks</span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{quiz.title}</h5>
                      <p className="text-[11px] text-slate-400">By {quiz.faculty?.full_name || 'Faculty'}</p>
                    </div>

                    <a
                      href={quiz.google_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-1.5 px-3 rounded-xl bg-[#0f172a] hover:bg-black text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-xs"
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

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>{quickSubmitAssignment.subject?.subject_code} - {quickSubmitAssignment.subject?.subject_name}</span>
                <span className="text-slate-900 font-bold">Max: {quickSubmitAssignment.max_marks} Marks</span>
              </div>
              <p className="text-slate-400">{quickSubmitAssignment.description || 'Follow instructions given by faculty.'}</p>
              <div className="text-[11px] text-slate-500">
                Faculty: <strong className="text-slate-300">{quickSubmitAssignment.faculty?.full_name}</strong> • Section: <strong className="text-slate-300">{section?.name}</strong>
              </div>
            </div>

            {quickSubmitAssignment.google_form_url && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-700 font-bold block">Google Form Task Link</span>
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
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer bg-white border border-slate-300 rounded-xl p-2 text-slate-800"
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

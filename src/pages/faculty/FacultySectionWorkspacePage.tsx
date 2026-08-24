import React, { useState, useMemo, useEffect } from 'react';
import { 
  Layers, 
  Users, 
  BookOpen, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Sparkles, 
  Award, 
  Clock, 
  Search, 
  Plus, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  History, 
  ArrowLeft,
  Filter,
  Save
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Assignment, Quiz, SessionalAssessment, SubmissionType } from '../../types/database.types';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';

interface FacultySectionWorkspacePageProps {
  initialSubjectId?: string;
  initialSectionId?: string;
  initialSubTab?: 'overview' | 'students' | 'timetable' | 'assignments' | 'quizzes' | 'sessionals';
  onBack?: () => void;
  onTakeAttendance?: (timetableEntryId?: string) => void;
}

export const FacultySectionWorkspacePage: React.FC<FacultySectionWorkspacePageProps> = ({
  initialSubjectId,
  initialSectionId,
  initialSubTab = 'overview',
  onBack,
  onTakeAttendance
}) => {
  const { user } = useAuth();
  const { 
    subjects, 
    sections, 
    faculty,
    students, 
    timetable, 
    courseAssignments, 
    assignmentSubmissions, 
    quizzes, 
    quizResults, 
    sessionalAssessments, 
    sessionalMarks, 
    marksHistory,
    attendanceSessions,
    attendanceRecords,
    assignments: facultySubjectAssignments,
    createAssignment,
    deleteCourseAssignment,
    gradeAssignmentSubmission,
    createQuiz,
    deleteQuiz,
    saveQuizMarks,
    createSessionalAssessment,
    deleteSessionalAssessment,
    saveSessionalMarks,
    getStudentAttendance
  } = useAcademic();

  const currentFaculty = faculty.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;

  const currentFacultyId = currentFaculty?.id || user?.faculty_id || user?.id || '';
  const isSuperAdmin = (user?.role === 'super_admin' || user?.role === 'hod') && !currentFacultyId;

  // 1. Determine all assigned Subject + Section pairs strictly for this faculty
  const myAssignedClasses = useMemo(() => {
    if (isSuperAdmin) {
      const list: Array<{ subject: typeof subjects[0]; section: typeof sections[0] }> = [];
      for (const sub of subjects) {
        for (const sec of sections) {
          list.push({ subject: sub, section: sec });
        }
      }
      return list;
    }

    const myFsa = facultySubjectAssignments.filter(fsa => fsa.faculty_id === currentFacultyId && fsa.active);
    const myTt = timetable.filter(t => t.faculty_id === currentFacultyId && t.active);
    const list: Array<{ subject: typeof subjects[0]; section: typeof sections[0] }> = [];

    for (const fsa of myFsa) {
      const sub = subjects.find(s => s.id === fsa.subject_id);
      const sec = sections.find(s => s.id === fsa.section_id);
      if (sub && sec) {
        if (!list.some(item => item.subject.id === sub.id && item.section.id === sec.id)) {
          list.push({ subject: sub, section: sec });
        }
      }
    }

    for (const t of myTt) {
      const sub = subjects.find(s => s.id === t.subject_id);
      const sec = sections.find(s => s.id === t.section_id);
      if (sub && sec) {
        if (!list.some(item => item.subject.id === sub.id && item.section.id === sec.id)) {
          list.push({ subject: sub, section: sec });
        }
      }
    }

    return list;
  }, [isSuperAdmin, subjects, sections, facultySubjectAssignments, timetable, currentFacultyId]);

  // Selected Subject & Section State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || myAssignedClasses[0]?.subject.id || ''
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    initialSectionId || myAssignedClasses[0]?.section.id || ''
  );

  // Active Workspace Sub-Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'timetable' | 'assignments' | 'quizzes' | 'sessionals'>(initialSubTab);

  // Ensure selection validity
  useEffect(() => {
    if (initialSubjectId) setSelectedSubjectId(initialSubjectId);
    if (initialSectionId) setSelectedSectionId(initialSectionId);
  }, [initialSubjectId, initialSectionId]);

  useEffect(() => {
    if (!selectedSubjectId && myAssignedClasses.length > 0) {
      setSelectedSubjectId(myAssignedClasses[0].subject.id);
      setSelectedSectionId(myAssignedClasses[0].section.id);
    }
  }, [myAssignedClasses, selectedSubjectId]);

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const currentSection = sections.find(s => s.id === selectedSectionId);

  // Available sections for the currently selected subject
  const availableSectionsForSubject = useMemo(() => {
    return myAssignedClasses
      .filter(item => item.subject.id === selectedSubjectId)
      .map(item => item.section);
  }, [myAssignedClasses, selectedSubjectId]);

  // Available subjects for current faculty
  const distinctSubjects = useMemo(() => {
    const map = new Map<string, typeof subjects[0]>();
    for (const item of myAssignedClasses) {
      if (!map.has(item.subject.id)) {
        map.set(item.subject.id, item.subject);
      }
    }
    return Array.from(map.values());
  }, [myAssignedClasses]);

  // 2. Strict Section-Filtered Data
  // Section Students
  const sectionStudents = useMemo(() => {
    if (!selectedSectionId) return [];
    return students.filter(s => s.section_id === selectedSectionId && s.active);
  }, [students, selectedSectionId]);

  // Section Timetable Entries for this Subject & Section
  const sectionTimetable = useMemo(() => {
    if (!selectedSubjectId || !selectedSectionId) return [];
    return timetable.filter(t => 
      t.subject_id === selectedSubjectId && 
      t.section_id === selectedSectionId &&
      (isSuperAdmin || t.faculty_id === currentFacultyId)
    );
  }, [timetable, selectedSubjectId, selectedSectionId, isSuperAdmin, currentFacultyId]);

  // Section Assignments
  const sectionAssignments = useMemo(() => {
    if (!selectedSubjectId || !selectedSectionId) return [];
    return courseAssignments.filter(a => 
      a.subject_id === selectedSubjectId && 
      a.section_id === selectedSectionId &&
      (isSuperAdmin || a.faculty_id === currentFacultyId)
    );
  }, [courseAssignments, selectedSubjectId, selectedSectionId, isSuperAdmin, currentFacultyId]);

  // Section Quizzes
  const sectionQuizzes = useMemo(() => {
    if (!selectedSubjectId || !selectedSectionId) return [];
    return quizzes.filter(q => 
      q.subject_id === selectedSubjectId && 
      q.section_id === selectedSectionId &&
      (isSuperAdmin || q.faculty_id === currentFacultyId)
    );
  }, [quizzes, selectedSubjectId, selectedSectionId, isSuperAdmin, currentFacultyId]);

  // Section Sessionals
  const sectionSessionals = useMemo(() => {
    if (!selectedSubjectId || !selectedSectionId) return [];
    return sessionalAssessments.filter(sa => 
      sa.subject_id === selectedSubjectId && 
      sa.section_id === selectedSectionId
    );
  }, [sessionalAssessments, selectedSubjectId, selectedSectionId]);

  // Average Section Attendance
  const avgAttendance = useMemo(() => {
    if (sectionStudents.length === 0) return 0;
    let totalPct = 0;
    for (const stud of sectionStudents) {
      const stats = getStudentAttendance(stud.id);
      const subStat = stats.subjectStats.find(st => st.subjectId === selectedSubjectId);
      totalPct += subStat ? subStat.percentage : 0;
    }
    return Math.round(totalPct / sectionStudents.length);
  }, [sectionStudents, getStudentAttendance, selectedSubjectId]);

  // -------------------------------------------------------------
  // MODAL STATES
  // -------------------------------------------------------------
  // A. Create Assignment Modal State
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [asgnTitle, setAsgnTitle] = useState('');
  const [asgnDesc, setAsgnDesc] = useState('');
  const [asgnSubmissionType, setAsgnSubmissionType] = useState<SubmissionType>('both');
  const [asgnGoogleFormUrl, setAsgnGoogleFormUrl] = useState('');
  const [asgnMaxMarks, setAsgnMaxMarks] = useState(10);
  const [asgnDueDate, setAsgnDueDate] = useState('');
  const [asgnSubmitting, setAsgnSubmitting] = useState(false);
  const [asgnError, setAsgnError] = useState('');

  // B. Create Quiz Modal State
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [quizGoogleFormUrl, setQuizGoogleFormUrl] = useState('');
  const [quizMaxMarks, setQuizMaxMarks] = useState(20);
  const [quizStartTime, setQuizStartTime] = useState('');
  const [quizEndTime, setQuizEndTime] = useState('');
  const [quizInstructions, setQuizInstructions] = useState('');
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizError, setQuizError] = useState('');

  // C. Quiz Marks Roster Modal State
  const [activeQuizForMarks, setActiveQuizForMarks] = useState<Quiz | null>(null);
  const [quizMarksRoster, setQuizMarksRoster] = useState<Record<string, { marks: number | ''; remarks: string }>>({});
  const [isSavingQuizMarks, setIsSavingQuizMarks] = useState(false);

  // D. Create Sessional Assessment Modal State
  const [isSessionalModalOpen, setIsSessionalModalOpen] = useState(false);
  const [sessTitle, setSessTitle] = useState('');
  const [sessMaxMarks, setSessMaxMarks] = useState<number>(20);
  const [sessExamDate, setSessExamDate] = useState<string>(getISTTodayDate());
  const [sessDesc, setSessDesc] = useState('');
  const [sessSubmitting, setSessSubmitting] = useState(false);
  const [sessError, setSessError] = useState('');

  // E. Sessional Marks Ledger State
  const [selectedSessionalId, setSelectedSessionalId] = useState<string>('');
  const [sessionalMarksRoster, setSessionalMarksRoster] = useState<Record<string, { marks: number | ''; remarks: string }>>({});
  const [isSavingSessionalMarks, setIsSavingSessionalMarks] = useState(false);
  const [sessionalSaveSuccess, setSessionalSaveSuccess] = useState(false);

  // Search filter inside lists
  const [listSearch, setListSearch] = useState('');

  // Initialize Sessional Marks when selectedSessionalId changes
  useEffect(() => {
    if (sectionSessionals.length > 0) {
      if (!selectedSessionalId || !sectionSessionals.some(s => s.id === selectedSessionalId)) {
        setSelectedSessionalId(sectionSessionals[0].id);
      }
    } else {
      setSelectedSessionalId('');
    }
  }, [sectionSessionals, selectedSessionalId]);

  useEffect(() => {
    if (selectedSessionalId && sectionStudents.length > 0) {
      const roster: Record<string, { marks: number | ''; remarks: string }> = {};
      for (const stud of sectionStudents) {
        const sm = sessionalMarks.find(
          m => m.sessional_assessment_id === selectedSessionalId && m.student_id === stud.id
        );
        roster[stud.id] = {
          marks: sm ? sm.marks_obtained : '',
          remarks: sm?.remarks || ''
        };
      }
      setSessionalMarksRoster(roster);
    }
  }, [selectedSessionalId, sectionStudents, sessionalMarks]);

  // Handlers for Assignment Creation
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAsgnError('');
    if (!asgnTitle.trim() || !selectedSubjectId || !selectedSectionId) {
      setAsgnError('Title, Subject, and Section are required.');
      return;
    }
    if ((asgnSubmissionType === 'google_form' || asgnSubmissionType === 'both') && !asgnGoogleFormUrl.trim()) {
      setAsgnError('Google Form URL is required for Google Form submission mode.');
      return;
    }

    setAsgnSubmitting(true);
    try {
      await createAssignment({
        faculty_id: currentFacultyId,
        subject_id: selectedSubjectId,
        section_id: selectedSectionId,
        title: asgnTitle.trim(),
        description: asgnDesc.trim() || undefined,
        submission_type: asgnSubmissionType,
        google_form_url: asgnGoogleFormUrl.trim() || undefined,
        max_marks: asgnMaxMarks || 10,
        assigned_date: getISTTodayDate(),
        due_date: asgnDueDate ? new Date(asgnDueDate).toISOString() : new Date().toISOString(),
        allow_late_submission: true,
        active: true,
      });

      setIsAssignmentModalOpen(false);
      setAsgnTitle('');
      setAsgnDesc('');
      setAsgnGoogleFormUrl('');
    } catch (err: any) {
      setAsgnError(err.message || 'Failed to create assignment');
    } finally {
      setAsgnSubmitting(false);
    }
  };

  // Handlers for Quiz Creation
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuizError('');
    if (!quizTitle.trim() || !selectedSubjectId || !selectedSectionId || !quizGoogleFormUrl.trim()) {
      setQuizError('Quiz Title, Google Form URL, Subject, and Section are required.');
      return;
    }

    setQuizSubmitting(true);
    try {
      await createQuiz({
        faculty_id: currentFacultyId,
        subject_id: selectedSubjectId,
        section_id: selectedSectionId,
        title: quizTitle.trim(),
        description: quizDesc.trim() || undefined,
        google_form_url: quizGoogleFormUrl.trim(),
        max_marks: quizMaxMarks || 20,
        quiz_date: getISTTodayDate(),
        start_time: quizStartTime ? new Date(quizStartTime).toISOString() : new Date().toISOString(),
        end_time: quizEndTime ? new Date(quizEndTime).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        instructions: quizInstructions.trim() || undefined,
        status: 'published',
        active: true,
      });

      setIsQuizModalOpen(false);
      setQuizTitle('');
      setQuizDesc('');
      setQuizGoogleFormUrl('');
    } catch (err: any) {
      setQuizError(err.message || 'Failed to create quiz');
    } finally {
      setQuizSubmitting(false);
    }
  };

  // Handlers for Sessional Assessment Creation
  const handleCreateSessional = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessError('');
    if (!sessTitle.trim() || !selectedSubjectId || !selectedSectionId) {
      setSessError('Sessional Name, Subject, and Section are required.');
      return;
    }

    setSessSubmitting(true);
    try {
      const created = await createSessionalAssessment({
        faculty_id: currentFacultyId,
        subject_id: selectedSubjectId,
        section_id: selectedSectionId,
        title: sessTitle.trim(),
        max_marks: sessMaxMarks || 20,
        exam_date: sessExamDate || getISTTodayDate(),
        description: sessDesc.trim() || undefined,
        status: 'published',
      });

      setIsSessionalModalOpen(false);
      setSessTitle('');
      setSessDesc('');
      if (created?.id) setSelectedSessionalId(created.id);
    } catch (err: any) {
      setSessError(err.message || 'Failed to create sessional');
    } finally {
      setSessSubmitting(false);
    }
  };

  // Save Sessional Marks for Section
  const handleSaveSessionalMarks = async () => {
    if (!selectedSessionalId || !selectedSubjectId || !selectedSectionId) return;
    const activeAssessment = sectionSessionals.find(s => s.id === selectedSessionalId);
    if (!activeAssessment) return;

    setIsSavingSessionalMarks(true);
    setSessionalSaveSuccess(false);

    try {
      const studentMarksPayload = sectionStudents.map(stud => {
        const entry = sessionalMarksRoster[stud.id];
        const val = entry?.marks === '' ? 0 : Number(entry?.marks || 0);
        const existingSm = sessionalMarks.find(
          m => m.sessional_assessment_id === selectedSessionalId && m.student_id === stud.id
        );
        return {
          studentId: stud.id,
          marksObtained: Math.min(Math.max(0, val), activeAssessment.max_marks),
          remarks: entry?.remarks || undefined,
          oldMarks: existingSm?.marks_obtained,
        };
      });

      await saveSessionalMarks({
        sessionalAssessmentId: selectedSessionalId,
        facultyId: currentFacultyId,
        subjectId: selectedSubjectId,
        sectionId: selectedSectionId,
        maxMarks: activeAssessment.max_marks,
        studentMarks: studentMarksPayload,
      });

      setSessionalSaveSuccess(true);
      setTimeout(() => setSessionalSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save sessional marks:', err);
    } finally {
      setIsSavingSessionalMarks(false);
    }
  };

  const currentActiveSessional = sectionSessionals.find(s => s.id === selectedSessionalId);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & CLASS / SECTION SWITCHER */}
      {/* ======================================================== */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/25 relative overflow-hidden flex flex-col gap-4">
        
        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:border-[#00ff88] transition-all cursor-pointer"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-900 border border-emerald-500/30 text-emerald-400 font-mono">
                  {currentSubject?.subject_code || 'COURSE'}
                </span>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {currentSubject?.subject_name || 'Academic Class Workspace'}
                </h1>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-medium flex items-center gap-2">
                <span>Room: <strong className="text-white">{currentSection?.room_number || 'Room TBD'}</strong></span>
                <span>•</span>
                <span>Enrolled: <strong className="text-[#00ff88]">{sectionStudents.length} Students</strong></span>
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="neon"
              size="sm"
              onClick={() => onTakeAttendance ? onTakeAttendance(sectionTimetable[0]?.id) : null}
              leftIcon={<CheckSquare className="w-3.5 h-3.5 text-slate-950" />}
            >
              Take Attendance
            </Button>
          </div>
        </div>

        {/* SECTION SELECTION TABS & SUBJECT SWITCHER */}
        <div className="pt-2 border-t border-emerald-500/15 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Section Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-slate-400 shrink-0">Select Section:</span>
            {availableSectionsForSubject.map(sec => (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className={clsx(
                  'px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 flex items-center gap-1.5',
                  selectedSectionId === sec.id
                    ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)] font-black'
                    : 'bg-slate-950/80 text-slate-400 hover:text-white hover:bg-slate-900 border border-emerald-500/20'
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                Section {sec.name} ({sec.room_number || 'Room TBD'})
              </button>
            ))}
          </div>

          {/* Subject Switcher Dropdown (if faculty teaches multiple subjects) */}
          {distinctSubjects.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 shrink-0">Subject:</span>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  const newSubId = e.target.value;
                  setSelectedSubjectId(newSubId);
                  const firstSec = myAssignedClasses.find(item => item.subject.id === newSubId)?.section;
                  if (firstSec) setSelectedSectionId(firstSec.id);
                }}
                className="bg-slate-950/80 border border-emerald-500/25 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                {distinctSubjects.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.subject_code} — {sub.subject_name}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. SECTION WORKSPACE SUB-NAVIGATION TABS */}
      {/* ======================================================== */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20 overflow-x-auto no-scrollbar text-xs font-bold">
        {[
          { id: 'overview', label: '📊 Section Overview', count: undefined },
          { id: 'students', label: '👥 Students', count: sectionStudents.length },
          { id: 'timetable', label: '📅 Timetable & Schedule', count: sectionTimetable.length },
          { id: 'assignments', label: '📝 Assignments', count: sectionAssignments.length },
          { id: 'quizzes', label: '✨ Quizzes', count: sectionQuizzes.length },
          { id: 'sessionals', label: '🏆 Sessional Marks Ledger', count: sectionSessionals.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              'px-3.5 py-2 rounded-xl transition-all cursor-pointer select-none shrink-0 flex items-center gap-1.5',
              activeTab === tab.id
                ? 'bg-slate-800 text-white border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={clsx(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                activeTab === tab.id ? 'bg-[#00ff88] text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* 3. TAB CONTENT */}
      {/* ======================================================== */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* KPI Cards for this section */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <p className="text-[11px] text-slate-400 font-semibold">Enrolled Students</p>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1">{sectionStudents.length}</h3>
              <span className="text-[10px] text-emerald-400">Section {currentSection?.name}</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <p className="text-[11px] text-slate-400 font-semibold">Weekly Classes</p>
              <h3 className="text-xl sm:text-2xl font-black text-[#00ff88] mt-1">{sectionTimetable.length}</h3>
              <span className="text-[10px] text-slate-400">Mon – Sat</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <p className="text-[11px] text-slate-400 font-semibold">Assignments</p>
              <h3 className="text-xl sm:text-2xl font-black text-blue-400 mt-1">{sectionAssignments.length}</h3>
              <span className="text-[10px] text-slate-400">Created for Sec {currentSection?.name}</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <p className="text-[11px] text-slate-400 font-semibold">Active Quizzes</p>
              <h3 className="text-xl sm:text-2xl font-black text-purple-400 mt-1">{sectionQuizzes.length}</h3>
              <span className="text-[10px] text-slate-400">Google Forms</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <p className="text-[11px] text-slate-400 font-semibold">Sessionals</p>
              <h3 className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{sectionSessionals.length}</h3>
              <span className="text-[10px] text-slate-400">Exams Conducted</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <p className="text-[11px] text-slate-400 font-semibold">Attendance Avg</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">{avgAttendance}%</h3>
              <span className="text-[10px] text-slate-400">Section Average</span>
            </div>
          </div>

          {/* Quick Section Academic Actions */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00ff88]" />
              Manage Section {currentSection?.name} Academic Activities
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => { setActiveTab('assignments'); setIsAssignmentModalOpen(true); }}
                className="p-4 rounded-2xl bg-slate-950/80 border border-blue-500/20 hover:border-blue-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2.5">
                  <FileText className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-blue-400">+ New Assignment</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Publish assignment for Section {currentSection?.name}</p>
              </button>

              <button
                onClick={() => { setActiveTab('quizzes'); setIsQuizModalOpen(true); }}
                className="p-4 rounded-2xl bg-slate-950/80 border border-purple-500/20 hover:border-purple-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-purple-400">+ New Quiz</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Share Google Form quiz for Section {currentSection?.name}</p>
              </button>

              <button
                onClick={() => { setActiveTab('sessionals'); setIsSessionalModalOpen(true); }}
                className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/20 hover:border-amber-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2.5">
                  <Award className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-amber-400">+ Add Sessional</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Create Sessional 1, 2, 3, PUT for Section {currentSection?.name}</p>
              </button>

              <button
                onClick={() => setActiveTab('sessionals')}
                className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88] mb-2.5">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#00ff88]">Enter Sessional Marks</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Open {sectionStudents.length} student marks roster</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENTS */}
      {activeTab === 'students' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search students in Section..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Total {sectionStudents.length} Enrolled in Section {currentSection?.name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectionStudents
              .filter(s => 
                s.full_name.toLowerCase().includes(listSearch.toLowerCase()) || 
                s.roll_number.toLowerCase().includes(listSearch.toLowerCase())
              )
              .map((stud, idx) => {
                const attStats = getStudentAttendance(stud.id);
                const subStat = attStats.subjectStats.find(st => st.subjectId === selectedSubjectId);
                const pct = subStat ? subStat.percentage : 0;

                return (
                  <div key={stud.id} className="glass-card rounded-2xl p-4 border border-emerald-500/15 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500">#{idx + 1} • {stud.roll_number}</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{stud.full_name}</h4>
                      </div>
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold font-mono',
                        pct >= 75 ? 'bg-emerald-500/15 text-[#00ff88] border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      )}>
                        {pct}% Att.
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-emerald-500/10">
                      <span>{stud.admission_type}</span>
                      <span className="text-[11px] font-mono text-slate-300">{stud.email || `${stud.roll_number}@vctm.in`}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: TIMETABLE */}
      {activeTab === 'timetable' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#00ff88]" />
              Weekly Lecture Schedule: {currentSubject?.subject_name} • Section {currentSection?.name}
            </h3>

            {sectionTimetable.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-8">No scheduled timetable entries found for this class.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sectionTimetable.map(entry => (
                  <div key={entry.id} className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 flex items-center justify-between gap-3">
                    <div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/20 text-[#00ff88]">
                        {entry.day_of_week}
                      </span>
                      <h4 className="text-xs font-bold text-white mt-1">Period {entry.period_number}</h4>
                      <p className="text-[11px] font-mono text-slate-400">{entry.start_time?.substring(0, 5)} – {entry.end_time?.substring(0, 5)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Room {entry.room_number || currentSection?.room_number}</p>
                    </div>

                    <Button
                      variant="neon"
                      size="sm"
                      onClick={() => onTakeAttendance ? onTakeAttendance(entry.id) : null}
                      leftIcon={<CheckSquare className="w-3 h-3 text-slate-950" />}
                      className="text-[11px] py-1.5 px-2.5 shrink-0"
                    >
                      Attendance
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Assignments for Section {currentSection?.name} ({sectionAssignments.length})
            </h3>
            <Button
              variant="neon"
              size="sm"
              onClick={() => setIsAssignmentModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5 text-slate-950" />}
            >
              + Create Assignment
            </Button>
          </div>

          {sectionAssignments.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20 space-y-2">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-semibold text-white">No assignments created for Section {currentSection?.name} yet.</p>
              <p className="text-xs text-slate-500">Click "+ Create Assignment" to publish an assignment for this section.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sectionAssignments.map(asgn => {
                const submissions = assignmentSubmissions.filter(s => s.assignment_id === asgn.id);

                return (
                  <div key={asgn.id} className="glass-panel rounded-3xl p-5 border border-emerald-500/20 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Section {currentSection?.name}
                          </span>
                          <span className="text-[10px] text-slate-400">Max: {asgn.max_marks} Marks</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">{asgn.title}</h4>
                      </div>

                      <button
                        onClick={() => deleteCourseAssignment(asgn.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        title="Delete Assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {asgn.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{asgn.description}</p>
                    )}

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-emerald-500/10">
                      <span>Due: {asgn.due_date ? asgn.due_date.substring(0, 10) : 'No deadline'}</span>
                      <span className="text-emerald-400 font-bold">
                        {submissions.length} / {sectionStudents.length} Submitted
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {asgn.google_form_url && (
                        <a
                          href={asgn.google_form_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Form Link
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: QUIZZES */}
      {activeTab === 'quizzes' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Quizzes for Section {currentSection?.name} ({sectionQuizzes.length})
            </h3>
            <Button
              variant="neon"
              size="sm"
              onClick={() => setIsQuizModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5 text-slate-950" />}
            >
              + Create Quiz
            </Button>
          </div>

          {sectionQuizzes.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20 space-y-2">
              <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-semibold text-white">No quizzes created for Section {currentSection?.name} yet.</p>
              <p className="text-xs text-slate-500">Click "+ Create Quiz" to share a Google Form quiz with this section.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sectionQuizzes.map(quiz => {
                const results = quizResults.filter(r => r.quiz_id === quiz.id);

                return (
                  <div key={quiz.id} className="glass-panel rounded-3xl p-5 border border-emerald-500/20 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Section {currentSection?.name}
                          </span>
                          <span className="text-[10px] text-slate-400">Max: {quiz.max_marks} Marks</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">{quiz.title}</h4>
                      </div>

                      <button
                        onClick={() => deleteQuiz(quiz.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {quiz.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{quiz.description}</p>
                    )}

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-emerald-500/10">
                      <span>Google Form Quiz</span>
                      <span className="text-purple-400 font-bold">
                        {results.length} / {sectionStudents.length} Marked
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {quiz.google_form_url && (
                        <a
                          href={quiz.google_form_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Open Form
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveQuizForMarks(quiz);
                          const roster: Record<string, { marks: number | ''; remarks: string }> = {};
                          for (const s of sectionStudents) {
                            const res = quizResults.find(r => r.quiz_id === quiz.id && r.student_id === s.id);
                            roster[s.id] = { marks: res ? res.marks_obtained : '', remarks: '' };
                          }
                          setQuizMarksRoster(roster);
                        }}
                        className="ml-auto text-xs py-1 px-3"
                      >
                        Enter Quiz Marks
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SESSIONALS & MARKS LEDGER */}
      {activeTab === 'sessionals' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Sessional Examination Ledger: Section {currentSection?.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dynamic continuous internal assessments & marks entry for {sectionStudents.length} students
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="neon"
                size="sm"
                onClick={() => setIsSessionalModalOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5 text-slate-950" />}
              >
                + Add Sessional
              </Button>
            </div>
          </div>

          {/* Sessional Selector Pills */}
          {sectionSessionals.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <span className="text-xs font-bold text-slate-400 shrink-0">Select Assessment:</span>
              {sectionSessionals.map(sa => (
                <button
                  key={sa.id}
                  onClick={() => setSelectedSessionalId(sa.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 flex items-center gap-1.5',
                    selectedSessionalId === sa.id
                      ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.35)] font-black'
                      : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
                  )}
                >
                  <Award className="w-3.5 h-3.5" />
                  {sa.title} ({sa.max_marks}M)
                </button>
              ))}
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-8 text-center text-slate-400 border border-emerald-500/20 space-y-2">
              <Award className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-white">No sessional assessments created for Section {currentSection?.name} yet.</p>
              <p className="text-xs text-slate-500">Click "+ Add Sessional" above to create Sessional 1, 2, 3, or PUT for this section.</p>
            </div>
          )}

          {/* Sessional Marks Entry Table */}
          {currentActiveSessional && (
            <div className="glass-panel rounded-3xl p-5 border border-emerald-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Marks Entry Roster — {currentActiveSessional.title} (Max: {currentActiveSessional.max_marks})
                  </h4>
                  <p className="text-xs text-slate-400">Exam Date: {currentActiveSessional.exam_date || 'N/A'}</p>
                </div>

                <div className="flex items-center gap-2">
                  {sessionalSaveSuccess && (
                    <span className="text-xs font-bold text-[#00ff88] flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Marks Saved
                    </span>
                  )}
                  <Button
                    variant="neon"
                    size="sm"
                    onClick={handleSaveSessionalMarks}
                    disabled={isSavingSessionalMarks}
                    leftIcon={<Save className="w-3.5 h-3.5 text-slate-950" />}
                  >
                    {isSavingSessionalMarks ? 'Saving...' : 'Save Marks'}
                  </Button>
                </div>
              </div>

              {/* Roster Table */}
              <div className="overflow-x-auto rounded-2xl border border-emerald-500/15">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-emerald-500/15">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Roll Number</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Marks Obtained (0 – {currentActiveSessional.max_marks})</th>
                      <th className="p-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-500/10">
                    {sectionStudents.map((stud, idx) => {
                      const entry = sessionalMarksRoster[stud.id] || { marks: '', remarks: '' };

                      return (
                        <tr key={stud.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-bold text-emerald-400">{stud.roll_number}</td>
                          <td className="p-3 font-bold text-white">{stud.full_name}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              min={0}
                              max={currentActiveSessional.max_marks}
                              value={entry.marks}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                setSessionalMarksRoster(prev => ({
                                  ...prev,
                                  [stud.id]: {
                                    ...prev[stud.id],
                                    marks: val === '' ? '' : Math.min(Math.max(0, val), currentActiveSessional.max_marks)
                                  }
                                }));
                              }}
                              placeholder={`0 - ${currentActiveSessional.max_marks}`}
                              className="w-28 px-3 py-1.5 bg-slate-950 border border-emerald-500/25 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-[#00ff88]"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={entry.remarks}
                              onChange={(e) => {
                                setSessionalMarksRoster(prev => ({
                                  ...prev,
                                  [stud.id]: {
                                    ...prev[stud.id],
                                    remarks: e.target.value
                                  }
                                }));
                              }}
                              placeholder="Optional note"
                              className="w-full max-w-xs px-3 py-1.5 bg-slate-950 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODALS */}
      {/* ======================================================== */}

      {/* MODAL 1: Create Assignment for this Section */}
      <Modal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        title={`Create Assignment — Section ${currentSection?.name}`}
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
          {asgnError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {asgnError}
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Target Subject & Section</label>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/20 text-white font-bold">
              {currentSubject?.subject_name} • <span className="text-[#00ff88]">Section {currentSection?.name}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Assignment Title *</label>
            <input
              type="text"
              required
              value={asgnTitle}
              onChange={(e) => setAsgnTitle(e.target.value)}
              placeholder="e.g. Assignment 1: Dynamic Arrays & Linked Lists"
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Max Marks</label>
              <input
                type="number"
                min={1}
                max={100}
                value={asgnMaxMarks}
                onChange={(e) => setAsgnMaxMarks(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white font-mono focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Due Date</label>
              <input
                type="date"
                value={asgnDueDate}
                onChange={(e) => setAsgnDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Submission Mode</label>
            <select
              value={asgnSubmissionType}
              onChange={(e) => setAsgnSubmissionType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            >
              <option value="both">Both (File Upload + Google Form)</option>
              <option value="file_upload">File Upload Only (PDF / DOCX)</option>
              <option value="google_form">Google Form Link Only</option>
            </select>
          </div>

          {(asgnSubmissionType === 'google_form' || asgnSubmissionType === 'both') && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Google Form URL</label>
              <input
                type="url"
                value={asgnGoogleFormUrl}
                onChange={(e) => setAsgnGoogleFormUrl(e.target.value)}
                placeholder="https://forms.google.com/..."
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Instructions / Description</label>
            <textarea
              rows={3}
              value={asgnDesc}
              onChange={(e) => setAsgnDesc(e.target.value)}
              placeholder="Provide guidelines for Section students..."
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAssignmentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="neon" size="sm" type="submit" disabled={asgnSubmitting}>
              {asgnSubmitting ? 'Publishing...' : 'Publish to Section ' + currentSection?.name}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Create Quiz for this Section */}
      <Modal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        title={`Create Quiz — Section ${currentSection?.name}`}
      >
        <form onSubmit={handleCreateQuiz} className="space-y-4 text-xs">
          {quizError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {quizError}
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Target Subject & Section</label>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/20 text-white font-bold">
              {currentSubject?.subject_name} • <span className="text-purple-400">Section {currentSection?.name}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Quiz Title *</label>
            <input
              type="text"
              required
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="e.g. Unit 1 Quiz: Data Structures & Algorithms"
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Google Form URL *</label>
            <input
              type="url"
              required
              value={quizGoogleFormUrl}
              onChange={(e) => setQuizGoogleFormUrl(e.target.value)}
              placeholder="https://forms.gle/... or https://docs.google.com/forms/..."
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Max Marks</label>
              <input
                type="number"
                min={1}
                max={100}
                value={quizMaxMarks}
                onChange={(e) => setQuizMaxMarks(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white font-mono focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Active Window (Optional)</label>
              <input
                type="date"
                value={quizStartTime}
                onChange={(e) => setQuizStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description / Instructions</label>
            <textarea
              rows={3}
              value={quizDesc}
              onChange={(e) => setQuizDesc(e.target.value)}
              placeholder="Provide quiz rules or time limit guidelines..."
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsQuizModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="neon" size="sm" type="submit" disabled={quizSubmitting}>
              {quizSubmitting ? 'Publishing...' : 'Publish Quiz to Section ' + currentSection?.name}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Create Dynamic Sessional for this Section */}
      <Modal
        isOpen={isSessionalModalOpen}
        onClose={() => setIsSessionalModalOpen(false)}
        title={`Add Sessional Assessment — Section ${currentSection?.name}`}
      >
        <form onSubmit={handleCreateSessional} className="space-y-4 text-xs">
          {sessError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {sessError}
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Target Subject & Section</label>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/20 text-white font-bold">
              {currentSubject?.subject_name} • <span className="text-amber-400">Section {currentSection?.name}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Sessional Name / Assessment Title *</label>
            <input
              type="text"
              required
              value={sessTitle}
              onChange={(e) => setSessTitle(e.target.value)}
              placeholder="e.g. Sessional 1, Sessional 2, Sessional 3, PUT, Unit Test"
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Maximum Marks *</label>
              <input
                type="number"
                required
                min={1}
                max={100}
                value={sessMaxMarks}
                onChange={(e) => setSessMaxMarks(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white font-mono focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Exam Date *</label>
              <input
                type="date"
                required
                value={sessExamDate}
                onChange={(e) => setSessExamDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Syllabus Covered / Description</label>
            <textarea
              rows={2}
              value={sessDesc}
              onChange={(e) => setSessDesc(e.target.value)}
              placeholder="e.g. Units 1 and 2: Stacks, Queues, Trees"
              className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsSessionalModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="neon" size="sm" type="submit" disabled={sessSubmitting}>
              {sessSubmitting ? 'Creating...' : 'Create Sessional for Section ' + currentSection?.name}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: Enter Quiz Marks */}
      {activeQuizForMarks && (
        <Modal
          isOpen={Boolean(activeQuizForMarks)}
          onClose={() => setActiveQuizForMarks(null)}
          title={`Quiz Marks Roster — ${activeQuizForMarks.title} (Section ${currentSection?.name})`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-400">
              Enter quiz scores out of <strong>{activeQuizForMarks.max_marks}</strong> for enrolled students in Section {currentSection?.name}.
            </p>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {sectionStudents.map(stud => {
                const currentEntry = quizMarksRoster[stud.id] || { marks: '', remarks: '' };

                return (
                  <div key={stud.id} className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/15 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">{stud.roll_number}</span>
                      <h5 className="text-xs font-bold text-white">{stud.full_name}</h5>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={activeQuizForMarks.max_marks}
                        value={currentEntry.marks}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setQuizMarksRoster(prev => ({
                            ...prev,
                            [stud.id]: {
                              ...prev[stud.id],
                              marks: val === '' ? '' : Math.min(Math.max(0, val), activeQuizForMarks.max_marks)
                            }
                          }));
                        }}
                        placeholder={`0 - ${activeQuizForMarks.max_marks}`}
                        className="w-24 px-2.5 py-1 bg-slate-900 border border-emerald-500/25 rounded-lg text-xs font-mono font-bold text-white text-right focus:outline-none focus:border-[#00ff88]"
                      />
                      <span className="text-slate-500 text-[10px]">/ {activeQuizForMarks.max_marks}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/15">
              <Button variant="outline" size="sm" onClick={() => setActiveQuizForMarks(null)}>
                Cancel
              </Button>
              <Button
                variant="neon"
                size="sm"
                disabled={isSavingQuizMarks}
                onClick={async () => {
                  setIsSavingQuizMarks(true);
                  try {
                    const resultsPayload = sectionStudents.map(stud => {
                      const entry = quizMarksRoster[stud.id];
                      return {
                        studentId: stud.id,
                        marksObtained: entry?.marks === '' ? 0 : Number(entry?.marks || 0),
                        remarks: entry?.remarks
                      };
                    });

                    await saveQuizMarks({
                      quizId: activeQuizForMarks.id,
                      facultyId: currentFacultyId,
                      studentMarks: resultsPayload
                    });

                    setActiveQuizForMarks(null);
                  } catch (err) {
                    console.error('Failed to save quiz marks:', err);
                  } finally {
                    setIsSavingQuizMarks(false);
                  }
                }}
              >
                {isSavingQuizMarks ? 'Saving...' : 'Save Quiz Marks'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

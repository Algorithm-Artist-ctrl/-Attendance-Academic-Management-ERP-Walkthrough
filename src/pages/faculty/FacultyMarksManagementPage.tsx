import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Award, 
  Search, 
  Save, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  BookOpen, 
  Users, 
  Calendar,
  FileDown,
  Upload,
  Download,
  Filter,
  Eye,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Percent,
  Plus,
  ArrowUpDown,
  FileSpreadsheet,
  Check,
  HelpCircle
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { supabaseService } from '../../lib/services/supabaseService';
import { 
  SessionalAssessment, 
  SessionalMark, 
  Quiz, 
  QuizResult, 
  Assignment, 
  AssignmentSubmission,
  Student, 
  MarksHistory 
} from '../../types/database.types';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { exportToCSV } from '../../lib/utils/exportUtils';
import { 
  generateMarksReportPdf, 
  MarksReportType, 
  StudentMarkRow, 
  SubjectScorecardRow 
} from '../../lib/utils/marksPdfGenerator';
import Papa from 'papaparse';
import { clsx } from 'clsx';

type AssessmentKind = 'sessional' | 'quiz' | 'assignment';

interface SelectedAssessmentInfo {
  id: string;
  kind: AssessmentKind;
  title: string;
  maxMarks: number;
  status: 'draft' | 'published';
  date?: string;
}

interface StudentMarkRowComponentProps {
  student: Student;
  index: number;
  marks: number | '';
  remarks: string;
  maxMarks: number;
  onMarkChange: (studentId: string, valueStr: string) => void;
  onRemarkChange: (studentId: string, remarks: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, index: number) => void;
  registerInputRef: (studentId: string, el: HTMLInputElement | null) => void;
}

const MemoizedStudentMarkRow = React.memo<StudentMarkRowComponentProps>(({
  student,
  index,
  marks,
  remarks,
  maxMarks,
  onMarkChange,
  onRemarkChange,
  onKeyDown,
  registerInputRef,
}) => {
  const hasMark = marks !== '' && marks !== undefined;
  const percentage = hasMark ? ((Number(marks) / maxMarks) * 100).toFixed(1) : null;
  const isPassing = hasMark && Number(marks) >= (maxMarks * 0.4);

  return (
    <tr 
      className={clsx(
        'hover:bg-slate-50/60 transition-colors',
        !hasMark && 'bg-amber-50/30'
      )}
    >
      {/* S.No */}
      <td className="py-3 px-4 text-center text-slate-500 font-mono">
        {index + 1}
      </td>

      {/* Roll Number */}
      <td className="py-3 px-4 font-mono font-bold text-slate-900">
        {student.roll_number}
      </td>

      {/* Student Name */}
      <td className="py-3 px-4 font-semibold text-slate-900">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
            {student.full_name?.charAt(0) || 'S'}
          </div>
          <span>{student.full_name}</span>
        </div>
      </td>

      {/* Marks Input */}
      <td className="py-2.5 px-4 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <input
            ref={(el) => registerInputRef(student.id, el)}
            type="number"
            step="any"
            min="0"
            max={maxMarks}
            value={marks}
            placeholder="—"
            onChange={(e) => onMarkChange(student.id, e.target.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={clsx(
              'w-24 text-center py-1.5 px-2 rounded-xl font-mono text-sm font-bold transition-all focus:outline-none',
              hasMark 
                ? isPassing
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 focus:border-emerald-500'
                  : 'bg-rose-50 text-rose-900 border border-rose-300 focus:border-rose-500'
                : 'bg-white text-slate-900 border border-slate-300 border-dashed focus:border-slate-500'
            )}
          />
          <span className="text-[11px] text-slate-500 font-mono">
            /{maxMarks}
          </span>
        </div>
      </td>

      {/* Percentage */}
      <td className="py-3 px-4 text-center font-mono font-semibold">
        {percentage !== null ? (
          <span className={clsx(isPassing ? 'text-slate-800' : 'text-rose-700')}>
            {percentage}%
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-4 text-center">
        {hasMark ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Entered
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Missing
          </span>
        )}
      </td>

      {/* Remarks */}
      <td className="py-2.5 px-4">
        <input
          type="text"
          value={remarks}
          placeholder="Add comment..."
          onChange={(e) => onRemarkChange(student.id, e.target.value)}
          className="w-full bg-transparent border-b border-slate-200 hover:border-slate-300 focus:border-slate-500 text-xs text-slate-800 placeholder-slate-400 focus:outline-none px-1 py-1 transition-colors"
        />
      </td>
    </tr>
  );
});

export const FacultyMarksManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    institution,
    sessionalAssessments,
    sessionalMarks, 
    quizzes,
    quizResults,
    courseAssignments,
    assignmentSubmissions,
    subjects, 
    sections, 
    years,
    semesters,
    faculty,
    students: allContextStudents,
    timetable,
    assignments: facultySubjectAssignments,
    createSessionalAssessment,
    ensureDefaultSessionalAssessments,
    ensureDefaultAssessments,
    createQuiz,
    saveSessionalMarks,
    saveQuizMarks,
    publishAssessment,
    fetchAssessmentMarks,
    deleteSessionalAssessment,
    deleteQuiz
  } = useAcademic();

  // 1. Identify logged-in faculty
  const currentFaculty = faculty.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name?.toLowerCase().trim() === user.full_name?.toLowerCase().trim()) ||
         (user?.email && f.email?.toLowerCase().trim() === user.email?.toLowerCase().trim())
  ) || user?.faculty;

  const currentFacultyId = currentFaculty?.id || user?.faculty_id || user?.id || '';
  const isSuperAdminOrHOD = (user?.role === 'super_admin' || user?.role === 'hod');

  // 2. Discover faculty-assigned Years, Sections, and Subjects strictly
  const facultyTeachingScope = useMemo(() => {
    // If super admin or HOD in oversight mode (not acting as specific teacher), allow all active academic structures
    if (isSuperAdminOrHOD && !currentFacultyId) {
      const activeYears = years.filter(y => y.active);
      const activeSecs = sections.filter(s => s.active);
      const activeSubs = subjects.filter(s => s.active);
      return {
        assignedYears: activeYears,
        assignedSections: activeSecs,
        assignedSubjects: activeSubs,
        validCombinations: []
      };
    }

    // Collect valid combinations from timetable and facultySubjectAssignments
    const pairs: Array<{ subjectId: string; sectionId: string }> = [];

    // From timetable
    const tt = timetable.filter(t => t.faculty_id === currentFacultyId && t.active && !t.is_break && t.subject_id);
    for (const t of tt) {
      if (t.subject_id && t.section_id) {
        pairs.push({ subjectId: t.subject_id, sectionId: t.section_id });
      }
    }

    // From facultySubjectAssignments
    const fsa = facultySubjectAssignments.filter(a => a.faculty_id === currentFacultyId && a.active);
    for (const a of fsa) {
      pairs.push({ subjectId: a.subject_id, sectionId: a.section_id });
    }

    // Deduplicate pairs
    const uniquePairKey = new Set<string>();
    const deduplicatedPairs: Array<{ subjectId: string; sectionId: string }> = [];
    for (const p of pairs) {
      const key = `${p.subjectId}__${p.sectionId}`;
      if (!uniquePairKey.has(key)) {
        uniquePairKey.add(key);
        deduplicatedPairs.push(p);
      }
    }

    // Resolve assigned sections
    const assignedSectionIds = new Set(deduplicatedPairs.map(p => p.sectionId));
    const matchedSections = sections.filter(s => assignedSectionIds.has(s.id) && s.active);

    // Resolve assigned years from sections via semester -> academic_year_id
    const matchedYearIds = new Set<string>();
    for (const sec of matchedSections) {
      const sem = semesters.find(sm => sm.id === sec.semester_id);
      if (sem?.academic_year_id) {
        matchedYearIds.add(sem.academic_year_id);
      }
    }
    const matchedYears = years.filter(y => matchedYearIds.has(y.id) && y.active);

    // Resolve assigned subjects
    const assignedSubjectIds = new Set(deduplicatedPairs.map(p => p.subjectId));
    const matchedSubjects = subjects.filter(s => assignedSubjectIds.has(s.id) && s.active);

    return {
      assignedYears: matchedYears.length > 0 ? matchedYears : (isSuperAdminOrHOD ? years.filter(y => y.active) : []),
      assignedSections: matchedSections.length > 0 ? matchedSections : (isSuperAdminOrHOD ? sections.filter(s => s.active) : []),
      assignedSubjects: matchedSubjects.length > 0 ? matchedSubjects : (isSuperAdminOrHOD ? subjects.filter(s => s.active) : []),
      validCombinations: deduplicatedPairs
    };
  }, [
    isSuperAdminOrHOD, 
    currentFacultyId, 
    timetable, 
    facultySubjectAssignments, 
    sections, 
    semesters, 
    years, 
    subjects
  ]);

  // 3. Selection Filters
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');

  // Available Sections based on selected Year
  const availableSections = useMemo(() => {
    if (!selectedYearId) return facultyTeachingScope.assignedSections;
    return facultyTeachingScope.assignedSections.filter(sec => {
      const sem = semesters.find(sm => sm.id === sec.semester_id);
      return sem?.academic_year_id === selectedYearId;
    });
  }, [selectedYearId, facultyTeachingScope.assignedSections, semesters]);

  // Available Subjects based on selected Section
  const availableSubjects = useMemo(() => {
    if (!selectedSectionId) return facultyTeachingScope.assignedSubjects;
    if (isSuperAdminOrHOD && facultyTeachingScope.validCombinations.length === 0) {
      const currentSec = sections.find(s => s.id === selectedSectionId);
      return subjects.filter(s => s.active && (!currentSec || s.semester_id === currentSec.semester_id));
    }
    const validSubjectIds = new Set(
      facultyTeachingScope.validCombinations
        .filter(c => c.sectionId === selectedSectionId)
        .map(c => c.subjectId)
    );
    return facultyTeachingScope.assignedSubjects.filter(s => validSubjectIds.has(s.id));
  }, [selectedSectionId, facultyTeachingScope, isSuperAdminOrHOD, sections, subjects]);

  // 4. Initialize cascading filter state
  useEffect(() => {
    if (facultyTeachingScope.assignedYears.length > 0 && !selectedYearId) {
      setSelectedYearId(facultyTeachingScope.assignedYears[0].id);
    }
  }, [facultyTeachingScope.assignedYears, selectedYearId]);

  useEffect(() => {
    if (availableSections.length > 0) {
      if (!selectedSectionId || !availableSections.some(s => s.id === selectedSectionId)) {
        setSelectedSectionId(availableSections[0].id);
      }
    } else {
      setSelectedSectionId('');
    }
  }, [availableSections, selectedSectionId]);

  useEffect(() => {
    if (availableSubjects.length > 0) {
      if (!selectedSubjectId || !availableSubjects.some(s => s.id === selectedSubjectId)) {
        setSelectedSubjectId(availableSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [availableSubjects, selectedSubjectId]);

  // 5. Ensure default assessments (Sessionals 1, 2, 3 and Quizzes 1-5) exist when Subject & Section are selected
  useEffect(() => {
    if (selectedSubjectId && selectedSectionId && currentFacultyId) {
      const currentSec = sections.find(s => s.id === selectedSectionId);
      ensureDefaultAssessments({
        subjectId: selectedSubjectId,
        sectionId: selectedSectionId,
        facultyId: currentFacultyId,
        semesterId: currentSec?.semester_id
      }).catch(err => {
        console.warn('Auto-ensuring default assessments noticed:', err);
      });
    }
  }, [selectedSubjectId, selectedSectionId, currentFacultyId, sections, ensureDefaultAssessments]);

  // 6. Build Assessment List for current (Subject, Section)
  const assessmentOptions = useMemo<SelectedAssessmentInfo[]>(() => {
    if (!selectedSubjectId || !selectedSectionId) return [];

    const list: SelectedAssessmentInfo[] = [];

    // Sessionals
    const matchedSessionals = sessionalAssessments.filter(
      sa => sa.subject_id === selectedSubjectId && sa.section_id === selectedSectionId && sa.status !== 'archived' && !sa.deleted_at
    );
    // Sort sessionals: Sessional 1, 2, 3, etc.
    matchedSessionals.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aNum = parseInt(aTitle.replace(/\D/g, '')) || 99;
      const bNum = parseInt(bTitle.replace(/\D/g, '')) || 99;
      if (aNum !== bNum) return aNum - bNum;
      return a.title.localeCompare(b.title);
    });

    const seenSessionalTitles = new Set<string>();
    for (const sa of matchedSessionals) {
      const normTitle = (sa.title || '').trim().toLowerCase();
      if (seenSessionalTitles.has(normTitle)) continue;
      seenSessionalTitles.add(normTitle);
      const isSess2 = normTitle === 'sessional 2' || normTitle.startsWith('sessional 2');
      const maxMarks = isSess2 ? (sa.max_marks === 20 ? 30 : sa.max_marks || 30) : (sa.max_marks || 20);
      list.push({
        id: sa.id,
        kind: 'sessional',
        title: sa.title,
        maxMarks,
        status: (sa.status === 'published' || sa.status === 'completed') ? 'published' : 'draft',
        date: sa.exam_date
      });
    }

    // Quizzes
    const matchedQuizzes = quizzes.filter(
      q => q.subject_id === selectedSubjectId && q.section_id === selectedSectionId && q.active !== false && !q.deleted_at
    );
    // Sort quizzes: Quiz 1, 2, 3, 4, 5, etc.
    matchedQuizzes.sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      const aNum = parseInt(aTitle.replace(/\D/g, '')) || 99;
      const bNum = parseInt(bTitle.replace(/\D/g, '')) || 99;
      if (aNum !== bNum) return aNum - bNum;
      return (a.title || '').localeCompare(b.title || '');
    });

    const seenQuizTitles = new Set<string>();
    for (const q of matchedQuizzes) {
      const normTitle = (q.title || '').trim().toLowerCase();
      if (seenQuizTitles.has(normTitle)) continue;
      seenQuizTitles.add(normTitle);
      list.push({
        id: q.id,
        kind: 'quiz',
        title: q.title || 'Quiz',
        maxMarks: q.max_marks || 20,
        status: (q.status === 'published' || q.status === 'completed') ? 'published' : 'draft',
        date: q.quiz_date
      });
    }

    // Assignments
    const matchedAssignments = courseAssignments.filter(
      ca => ca.subject_id === selectedSubjectId && ca.section_id === selectedSectionId && ca.active !== false && !ca.deleted_at
    );
    for (const ca of matchedAssignments) {
      list.push({
        id: ca.id,
        kind: 'assignment',
        title: ca.title || 'Assignment',
        maxMarks: ca.max_marks || 20,
        status: ca.status === 'published' ? 'published' : 'draft',
        date: ca.due_date
      });
    }

    return list;
  }, [selectedSubjectId, selectedSectionId, sessionalAssessments, quizzes, courseAssignments]);

  const sessionalsGroup = useMemo(() => assessmentOptions.filter(a => a.kind === 'sessional'), [assessmentOptions]);
  const quizzesGroup = useMemo(() => assessmentOptions.filter(a => a.kind === 'quiz'), [assessmentOptions]);
  const assignmentsGroup = useMemo(() => assessmentOptions.filter(a => a.kind === 'assignment'), [assessmentOptions]);

  // Set default assessment selection
  useEffect(() => {
    if (assessmentOptions.length > 0) {
      if (!selectedAssessmentId || !assessmentOptions.some(a => a.id === selectedAssessmentId)) {
        setSelectedAssessmentId(assessmentOptions[0].id);
      }
    } else {
      setSelectedAssessmentId('');
    }
  }, [assessmentOptions, selectedAssessmentId]);

  const activeAssessment = useMemo(() => {
    return assessmentOptions.find(a => a.id === selectedAssessmentId) || null;
  }, [assessmentOptions, selectedAssessmentId]);

  // 7. Load Active Section Students (Real Database Query with fallback to AcademicContext)
  const [sectionStudents, setSectionStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    if (!selectedSectionId) {
      setSectionStudents([]);
      return;
    }

    setIsLoadingStudents(true);
    supabaseService.fetchSectionStudents(selectedSectionId, true)
      .then(res => {
        if (!isCancelled) {
          if (res && res.length > 0) {
            setSectionStudents(res);
          } else {
            // Fallback to AcademicContext students
            const ctxStudents = allContextStudents.filter(
              s => s.section_id === selectedSectionId && s.active
            );
            ctxStudents.sort((a, b) => a.roll_number.localeCompare(b.roll_number));
            setSectionStudents(ctxStudents);
          }
          setIsLoadingStudents(false);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          console.warn('Error fetching section students, using context fallback:', err);
          const ctxStudents = allContextStudents.filter(
            s => s.section_id === selectedSectionId && s.active
          );
          ctxStudents.sort((a, b) => a.roll_number.localeCompare(b.roll_number));
          setSectionStudents(ctxStudents);
          setIsLoadingStudents(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedSectionId, allContextStudents]);

  // 8. Roster Marks State
  const [marksRoster, setMarksRoster] = useState<Record<string, { marks: number | ''; remarks: string }>>({});
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  isSavingRef.current = isSaving;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notificationToast, setNotificationToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const prevAssessmentIdRef = useRef<string>('');
  const prevSectionIdRef = useRef<string>('');

  // Sync marks roster when active assessment or students change
  useEffect(() => {
    if (!activeAssessment || sectionStudents.length === 0) {
      setMarksRoster({});
      setIsDirty(false);
      prevAssessmentIdRef.current = '';
      prevSectionIdRef.current = '';
      return;
    }

    const isAssessmentSwitch = activeAssessment.id !== prevAssessmentIdRef.current;
    const isSectionSwitch = selectedSectionId !== prevSectionIdRef.current;
    const isExplicitSwitch = isAssessmentSwitch || isSectionSwitch;

    // DATA-SAFETY GUARANTEE: If faculty is typing or saving, do NOT wipe entered marks from background updates
    if (!isExplicitSwitch && (isDirtyRef.current || isSavingRef.current)) {
      return;
    }

    const roster: Record<string, { marks: number | ''; remarks: string }> = {};

    if (activeAssessment.kind === 'sessional') {
      const marksForAssessment = sessionalMarks.filter(sm => sm.sessional_assessment_id === activeAssessment.id);
      for (const st of sectionStudents) {
        const sm = marksForAssessment.find(m => m.student_id === st.id);
        roster[st.id] = {
          marks: sm && sm.marks_obtained !== undefined && sm.marks_obtained !== null ? sm.marks_obtained : '',
          remarks: sm?.remarks || ''
        };
      }
    } else if (activeAssessment.kind === 'quiz') {
      const resultsForQuiz = quizResults.filter(qr => qr.quiz_id === activeAssessment.id);
      for (const st of sectionStudents) {
        const qr = resultsForQuiz.find(r => r.student_id === st.id);
        roster[st.id] = {
          marks: qr && qr.marks_obtained !== undefined && qr.marks_obtained !== null ? qr.marks_obtained : '',
          remarks: qr?.remarks || ''
        };
      }
    } else if (activeAssessment.kind === 'assignment') {
      const subs = assignmentSubmissions.filter(sub => sub.assignment_id === activeAssessment.id);
      for (const st of sectionStudents) {
        const sub = subs.find(s => s.student_id === st.id);
        roster[st.id] = {
          marks: sub && sub.marks_obtained !== undefined && sub.marks_obtained !== null ? sub.marks_obtained : '',
          remarks: sub?.feedback || ''
        };
      }
    }

    setMarksRoster(roster);
    setIsDirty(false);
    prevAssessmentIdRef.current = activeAssessment.id;
    prevSectionIdRef.current = selectedSectionId;
  }, [activeAssessment, selectedSectionId, sectionStudents, sessionalMarks, quizResults, assignmentSubmissions]);

  // Proactively fetch marks from PostgreSQL whenever activeAssessment changes
  useEffect(() => {
    if (!activeAssessment || !activeAssessment.id) return;
    let isCancelled = false;

    fetchAssessmentMarks(activeAssessment.id, activeAssessment.kind)
      .then(records => {
        if (isCancelled || !records) return;
        if (!isDirtyRef.current && !isSavingRef.current && sectionStudents.length > 0) {
          setMarksRoster(prev => {
            const next = { ...prev };
            if (activeAssessment.kind === 'sessional') {
              for (const st of sectionStudents) {
                const sm = (records as SessionalMark[]).find(m => m.student_id === st.id);
                if (sm && sm.marks_obtained !== undefined && sm.marks_obtained !== null) {
                  next[st.id] = {
                    marks: sm.marks_obtained,
                    remarks: sm.remarks || ''
                  };
                }
              }
            } else if (activeAssessment.kind === 'quiz') {
              for (const st of sectionStudents) {
                const qr = (records as QuizResult[]).find(r => r.student_id === st.id);
                if (qr && qr.marks_obtained !== undefined && qr.marks_obtained !== null) {
                  next[st.id] = {
                    marks: qr.marks_obtained,
                    remarks: qr.remarks || ''
                  };
                }
              }
            }
            return next;
          });
        }
      })
      .catch(err => {
        console.warn('Error fetching assessment marks:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeAssessment?.id, activeAssessment?.kind, sectionStudents, fetchAssessmentMarks]);

  // Auto-dismiss notification toast
  useEffect(() => {
    if (notificationToast) {
      const timer = setTimeout(() => setNotificationToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notificationToast]);

  // Keyboard navigation between student marks inputs
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const registerInputRef = useCallback((studentId: string, el: HTMLInputElement | null) => {
    inputRefs.current[studentId] = el;
  }, []);

  // Handle Mark Input with Live Bounds Validation
  const maxAllowedMarks = activeAssessment?.maxMarks || 30;

  const handleMarkChange = useCallback((studentId: string, valueStr: string) => {
    if (valueStr.trim() === '') {
      setMarksRoster(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], marks: '' }
      }));
      setIsDirty(true);
      return;
    }

    const num = parseFloat(valueStr);
    if (isNaN(num)) return;

    // Constrain input: do not allow negative or > maxMarks
    if (num < 0) return;
    if (num > maxAllowedMarks) {
      setNotificationToast({
        type: 'error',
        message: `Maximum marks allowed is ${maxAllowedMarks}.`
      });
      return;
    }

    setMarksRoster(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], marks: num }
    }));
    setIsDirty(true);
  }, [maxAllowedMarks]);

  const handleRemarkChange = useCallback((studentId: string, remarks: string) => {
    setMarksRoster(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], remarks }
    }));
    setIsDirty(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextStudent = sectionStudents[currentIndex + 1];
      if (nextStudent && inputRefs.current[nextStudent.id]) {
        inputRefs.current[nextStudent.id]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevStudent = sectionStudents[currentIndex - 1];
      if (prevStudent && inputRefs.current[prevStudent.id]) {
        inputRefs.current[prevStudent.id]?.focus();
      }
    }
  }, [sectionStudents]);

  // 9. Summary Metrics & Statistics
  const stats = useMemo(() => {
    const totalStudents = sectionStudents.length;
    let enteredCount = 0;
    let sumMarks = 0;
    let highest = -Infinity;
    let lowest = Infinity;
    let passCount = 0;
    const maxMarks = activeAssessment?.maxMarks || 30;
    const passThreshold = maxMarks * 0.4; // 40% AKTU standard pass marks

    for (const st of sectionStudents) {
      const entry = marksRoster[st.id];
      if (entry && entry.marks !== '' && entry.marks !== undefined) {
        const val = Number(entry.marks);
        enteredCount++;
        sumMarks += val;
        if (val > highest) highest = val;
        if (val < lowest) lowest = val;
        if (val >= passThreshold) passCount++;
      }
    }

    const missingCount = totalStudents - enteredCount;
    const avgMarks = enteredCount > 0 ? (sumMarks / enteredCount).toFixed(1) : '—';
    const passPercentage = enteredCount > 0 ? ((passCount / enteredCount) * 100).toFixed(0) : '0';

    return {
      totalStudents,
      enteredCount,
      missingCount,
      avgMarks,
      highest: enteredCount > 0 ? highest : '—',
      lowest: enteredCount > 0 ? lowest : '—',
      passPercentage
    };
  }, [sectionStudents, marksRoster, activeAssessment]);

  // 10. Table Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  const displayedStudents = useMemo(() => {
    return sectionStudents.filter(st => {
      const matchesSearch = 
        !searchTerm || 
        st.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
        st.full_name.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (showMissingOnly) {
        const entry = marksRoster[st.id];
        const isMissing = entry === undefined || entry.marks === '' || entry.marks === null;
        return isMissing;
      }

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionStudents, searchTerm, showMissingOnly, showMissingOnly ? marksRoster : null]);

  // 11. Save Draft & Publish Marks Actions
  const handleSaveMarks = async (publishMode: 'draft' | 'published') => {
    if (!activeAssessment || !selectedSubjectId || !selectedSectionId) return;

    try {
      setIsSaving(true);
      setSaveStatus('saving');
      const studentMarksPayload: Array<{
        studentId: string;
        marksObtained: number;
        remarks?: string;
        oldMarks?: number;
      }> = [];

      for (const st of sectionStudents) {
        const entry = marksRoster[st.id];
        if (entry && entry.marks !== '' && entry.marks !== undefined) {
          let oldMarkVal: number | undefined = undefined;
          if (activeAssessment.kind === 'sessional') {
            const existingSm = sessionalMarks.find(
              m => m.sessional_assessment_id === activeAssessment.id && m.student_id === st.id
            );
            oldMarkVal = existingSm?.marks_obtained;
          }

          studentMarksPayload.push({
            studentId: st.id,
            marksObtained: Number(entry.marks),
            remarks: entry.remarks || undefined,
            oldMarks: oldMarkVal
          });
        }
      }

      if (activeAssessment.kind === 'sessional') {
        await saveSessionalMarks({
          sessionalAssessmentId: activeAssessment.id,
          facultyId: currentFacultyId,
          subjectId: selectedSubjectId,
          sectionId: selectedSectionId,
          sessionalType: activeAssessment.title,
          maxMarks: activeAssessment.maxMarks,
          studentMarks: studentMarksPayload,
          isPublished: publishMode === 'published'
        });
      } else if (activeAssessment.kind === 'quiz') {
        await saveQuizMarks({
          quizId: activeAssessment.id,
          facultyId: currentFacultyId,
          studentMarks: studentMarksPayload,
          isPublished: publishMode === 'published'
        });
      }

      if (publishMode === 'published') {
        try {
          await publishAssessment(activeAssessment.id, currentFacultyId);
        } catch (pubErr) {
          console.warn('publishAssessment RPC notice:', pubErr);
        }
      }

      // Re-fetch assessment marks to guarantee synchronization with PostgreSQL single source of truth
      try {
        await fetchAssessmentMarks(activeAssessment.id, activeAssessment.kind);
      } catch (refetchErr) {
        console.warn('fetchAssessmentMarks sync warning:', refetchErr);
      }

      setIsDirty(false);
      setSaveStatus('saved');
      setIsPublishModalOpen(false);
      setNotificationToast({
        type: 'success',
        message: publishMode === 'published' 
          ? `Marks successfully PUBLISHED! Scores are now visible on student dashboards.` 
          : `Marks saved securely as DRAFT (hidden from students).`
      });
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      console.error('Save marks error:', err);
      setSaveStatus('error');
      setNotificationToast({
        type: 'error',
        message: err?.message || 'Failed to save marks. Please check your network and try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 12. Modals State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isAddAssessmentModalOpen, setIsAddAssessmentModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Add Assessment Form State (supports both Sessionals and Quizzes)
  const [newAssessmentKind, setNewAssessmentKind] = useState<'sessional' | 'quiz'>('sessional');
  const [newAssessmentTitle, setNewAssessmentTitle] = useState('');
  const [newAssessmentMaxMarks, setNewAssessmentMaxMarks] = useState<number>(20);
  const [newAssessmentDate, setNewAssessmentDate] = useState(getISTTodayDate());
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newAssessmentTitle.trim();
    if (!trimmedTitle || !selectedSubjectId || !selectedSectionId || !currentFacultyId) return;

    if (newAssessmentKind === 'sessional') {
      const existing = sessionalAssessments.find(
        sa => sa.subject_id === selectedSubjectId &&
              sa.section_id === selectedSectionId &&
              (sa.title || '').trim().toLowerCase() === trimmedTitle.toLowerCase()
      );
      if (existing) {
        setSelectedAssessmentId(existing.id);
        setIsAddAssessmentModalOpen(false);
        setNotificationToast({
          type: 'error',
          message: `Sessional assessment "${existing.title}" already exists for this subject & section. Switched to existing record.`
        });
        return;
      }
    } else {
      const existing = quizzes.find(
        q => q.subject_id === selectedSubjectId &&
             q.section_id === selectedSectionId &&
             (q.title || '').trim().toLowerCase() === trimmedTitle.toLowerCase()
      );
      if (existing) {
        setSelectedAssessmentId(existing.id);
        setIsAddAssessmentModalOpen(false);
        setNotificationToast({
          type: 'error',
          message: `Quiz "${existing.title}" already exists for this subject & section. Switched to existing record.`
        });
        return;
      }
    }

    try {
      setIsCreatingAssessment(true);
      const currentSec = sections.find(s => s.id === selectedSectionId);

      if (newAssessmentKind === 'sessional') {
        const created = await createSessionalAssessment({
          title: trimmedTitle,
          subject_id: selectedSubjectId,
          section_id: selectedSectionId,
          faculty_id: currentFacultyId,
          semester_id: currentSec?.semester_id,
          max_marks: Number(newAssessmentMaxMarks) || 20,
          exam_date: newAssessmentDate || getISTTodayDate(),
          status: 'draft'
        });

        setSelectedAssessmentId(created.id);
        setIsAddAssessmentModalOpen(false);
        setNewAssessmentTitle('');
        setNotificationToast({
          type: 'success',
          message: `Sessional assessment "${created.title}" created successfully.`
        });
      } else {
        const now = new Date();
        const created = await createQuiz({
          title: newAssessmentTitle.trim(),
          subject_id: selectedSubjectId,
          section_id: selectedSectionId,
          faculty_id: currentFacultyId,
          max_marks: Number(newAssessmentMaxMarks) || 20,
          quiz_date: newAssessmentDate || getISTTodayDate(),
          start_time: now.toISOString(),
          end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          google_form_url: 'https://vctm.in/quizzes',
          status: 'draft',
          active: true
        });

        setSelectedAssessmentId(created.id);
        setIsAddAssessmentModalOpen(false);
        setNewAssessmentTitle('');
        setNotificationToast({
          type: 'success',
          message: `Quiz "${created.title}" created successfully.`
        });
      }
    } catch (err: any) {
      setNotificationToast({
        type: 'error',
        message: err?.message || 'Failed to create assessment.'
      });
    } finally {
      setIsCreatingAssessment(false);
    }
  };

  // 13. Audit Trail / History State
  const [historyRecords, setHistoryRecords] = useState<MarksHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const openHistoryModal = async () => {
    if (!activeAssessment) return;
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
      const records = await supabaseService.fetchMarksHistory({
        entityId: activeAssessment.id,
        entityType: activeAssessment.kind === 'sessional' ? 'sessional' : 'quiz',
        subjectId: selectedSubjectId
      });
      setHistoryRecords(records);
    } catch (err) {
      console.warn('Error loading marks history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 14. CSV Export
  const handleExportCSV = () => {
    if (!activeAssessment || sectionStudents.length === 0) return;
    const currentSub = subjects.find(s => s.id === selectedSubjectId);
    const currentSec = sections.find(s => s.id === selectedSectionId);

    const data = sectionStudents.map((st, idx) => {
      const entry = marksRoster[st.id];
      const marksVal = entry && entry.marks !== '' && entry.marks !== undefined ? entry.marks : '';
      const percentage = marksVal !== '' ? `${((Number(marksVal) / activeAssessment.maxMarks) * 100).toFixed(1)}%` : '';
      return {
        'S.No': idx + 1,
        'Roll Number': st.roll_number,
        'Student Name': st.full_name,
        'Subject': currentSub?.subject_name || '',
        'Subject Code': currentSub?.subject_code || '',
        'Section': currentSec?.name || '',
        'Assessment': activeAssessment.title,
        'Marks Obtained': marksVal,
        'Max Marks': activeAssessment.maxMarks,
        'Percentage': percentage,
        'Status': marksVal !== '' ? 'Entered' : 'Missing',
        'Remarks': entry?.remarks || ''
      };
    });

    const filename = `VCTM_${currentSub?.subject_code || 'MARKS'}_${currentSec?.name || 'SEC'}_${activeAssessment.title.replace(/\s+/g, '_')}`;
    exportToCSV(data, filename);
  };

  // 15. CSV Import & Validation
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    validRows: Array<{ studentId: string; rollNumber: string; studentName: string; marks: number; remarks: string }>;
    invalidRows: Array<{ rawRow: any; error: string }>;
  } | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);

  const handleCsvFileSelect = (file: File) => {
    setCsvFile(file);
    setIsProcessingCsv(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        const valid: Array<{ studentId: string; rollNumber: string; studentName: string; marks: number; remarks: string }> = [];
        const invalid: Array<{ rawRow: any; error: string }> = [];

        const maxMarks = activeAssessment?.maxMarks || 30;
        const studentMap = new Map<string, Student>();
        for (const st of sectionStudents) {
          studentMap.set(st.roll_number.trim().toLowerCase(), st);
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rollKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('roll') || k.toLowerCase().includes('roll_number')
          );
          const marksKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('marks') || k.toLowerCase().includes('obtained') || k.toLowerCase().includes('score')
          );
          const remarksKey = Object.keys(row).find(k => k.toLowerCase().includes('remark'));

          const rollRaw = rollKey ? String(row[rollKey] || '').trim() : '';
          const marksRaw = marksKey ? String(row[marksKey] || '').trim() : '';
          const remarksRaw = remarksKey ? String(row[remarksKey] || '').trim() : '';

          if (!rollRaw) {
            invalid.push({ rawRow: row, error: 'Row missing roll number column.' });
            continue;
          }

          const matchedStudent = studentMap.get(rollRaw.toLowerCase());
          if (!matchedStudent) {
            invalid.push({
              rawRow: row,
              error: `Roll Number "${rollRaw}" does not match any active student in this section.`
            });
            continue;
          }

          const markNum = parseFloat(marksRaw);
          if (isNaN(markNum)) {
            invalid.push({
              rawRow: row,
              error: `Marks "${marksRaw}" is not a valid number.`
            });
            continue;
          }

          if (markNum < 0 || markNum > maxMarks) {
            invalid.push({
              rawRow: row,
              error: `Marks ${markNum} out of bounds (0 - ${maxMarks}).`
            });
            continue;
          }

          valid.push({
            studentId: matchedStudent.id,
            rollNumber: matchedStudent.roll_number,
            studentName: matchedStudent.full_name,
            marks: markNum,
            remarks: remarksRaw
          });
        }

        setImportPreview({ validRows: valid, invalidRows: invalid });
        setIsProcessingCsv(false);
      },
      error: (error) => {
        setNotificationToast({
          type: 'error',
          message: `CSV Parse Error: ${error.message}`
        });
        setIsProcessingCsv(false);
      }
    });
  };

  const applyCsvImport = () => {
    if (!importPreview || importPreview.validRows.length === 0) return;

    setMarksRoster(prev => {
      const updated = { ...prev };
      for (const row of importPreview.validRows) {
        updated[row.studentId] = {
          marks: row.marks,
          remarks: row.remarks || prev[row.studentId]?.remarks || ''
        };
      }
      return updated;
    });

    setIsDirty(true);
    setIsCsvImportModalOpen(false);
    setCsvFile(null);
    setImportPreview(null);
    setNotificationToast({
      type: 'success',
      message: `Successfully imported marks for ${importPreview.validRows.length} students. Click "Save Draft" or "Publish Marks" to persist.`
    });
  };

  // 16. PDF Generation Trigger
  const [selectedPdfReportType, setSelectedPdfReportType] = useState<MarksReportType>('CURRENT_ASSESSMENT');
  const [selectedStudentForPdf, setSelectedStudentForPdf] = useState<string>('');

  const handleDownloadPdf = () => {
    if (!activeAssessment || sectionStudents.length === 0) return;

    const currentSub = subjects.find(s => s.id === selectedSubjectId);
    const currentSec = sections.find(s => s.id === selectedSectionId);
    const currentYr = years.find(y => y.id === selectedYearId);

    // Prepare StudentMarkRow list
    const studentRows: StudentMarkRow[] = sectionStudents.map((st, idx) => {
      const entry = marksRoster[st.id];
      const marksVal = entry && entry.marks !== '' && entry.marks !== undefined ? Number(entry.marks) : null;
      return {
        sNo: idx + 1,
        rollNumber: st.roll_number,
        studentName: st.full_name,
        marksObtained: marksVal,
        maxMarks: activeAssessment.maxMarks,
        status: marksVal !== null ? 'Entered' : 'Missing',
        percentage: marksVal !== null ? `${((marksVal / activeAssessment.maxMarks) * 100).toFixed(1)}%` : '—',
        remarks: entry?.remarks || ''
      };
    });

    // Prepare SubjectScorecardRow list
    const scorecardRows: SubjectScorecardRow[] = sectionStudents.map((st, idx) => {
      const s1Assessment = sessionalAssessments.find(
        sa => sa.subject_id === selectedSubjectId && sa.section_id === selectedSectionId && sa.title.toLowerCase().includes('1')
      );
      const s2Assessment = sessionalAssessments.find(
        sa => sa.subject_id === selectedSubjectId && sa.section_id === selectedSectionId && sa.title.toLowerCase().includes('2')
      );

      const s1Mark = s1Assessment ? sessionalMarks.find(m => m.sessional_assessment_id === s1Assessment.id && m.student_id === st.id) : null;
      const s2Mark = s2Assessment ? sessionalMarks.find(m => m.sessional_assessment_id === s2Assessment.id && m.student_id === st.id) : null;

      const subQuizzes = quizzes.filter(q => q.subject_id === selectedSubjectId && q.section_id === selectedSectionId);
      const qIds = new Set(subQuizzes.map(q => q.id));
      const stQuizMarks = quizResults.filter(qr => qIds.has(qr.quiz_id) && qr.student_id === st.id);
      const quizTotalObt = stQuizMarks.reduce((sum, r) => sum + (r.marks_obtained || 0), 0);
      const quizTotalMax = subQuizzes.reduce((sum, q) => sum + (q.max_marks || 20), 0);

      const s1Val = s1Mark?.marks_obtained ?? '—';
      const s2Val = s2Mark?.marks_obtained ?? '—';
      const quizStr = subQuizzes.length > 0 ? `${quizTotalObt}/${quizTotalMax}` : '—';

      // Computed internal calculation (e.g. S1 + S2 + Quizzes)
      let intObt = 0;
      let intMax = 0;
      if (s1Mark && s1Mark.marks_obtained !== null) { intObt += s1Mark.marks_obtained; intMax += (s1Assessment?.max_marks || 30); }
      if (s2Mark && s2Mark.marks_obtained !== null) { intObt += s2Mark.marks_obtained; intMax += (s2Assessment?.max_marks || 30); }
      intObt += quizTotalObt;
      intMax += quizTotalMax;

      return {
        sNo: idx + 1,
        rollNumber: st.roll_number,
        studentName: st.full_name,
        sessional1: s1Val,
        sessional2: s2Val,
        quizzesTotal: quizStr,
        internalTotal: intMax > 0 ? intObt : '—',
        maxTotal: intMax > 0 ? intMax : '—',
        status: intMax > 0 && intObt >= (intMax * 0.4) ? 'Pass' : 'Eligible'
      };
    });

    // Single student data for individual scorecard
    let singleStudentData: any = undefined;
    if (selectedPdfReportType === 'STUDENT_REPORT') {
      const targetStudent = sectionStudents.find(s => s.id === selectedStudentForPdf) || sectionStudents[0];
      if (targetStudent) {
        const studentAssessments = assessmentOptions.map(opt => {
          let markObtained: number | null = null;
          if (opt.kind === 'sessional') {
            const sm = sessionalMarks.find(m => m.sessional_assessment_id === opt.id && m.student_id === targetStudent.id);
            markObtained = sm?.marks_obtained ?? null;
          } else if (opt.kind === 'quiz') {
            const qr = quizResults.find(r => r.quiz_id === opt.id && r.student_id === targetStudent.id);
            markObtained = qr?.marks_obtained ?? null;
          }
          return {
            title: opt.title,
            marksObtained: markObtained,
            maxMarks: opt.maxMarks,
            percentage: markObtained !== null ? `${((markObtained / opt.maxMarks) * 100).toFixed(1)}%` : '—',
            status: markObtained !== null ? 'Evaluated' : 'Pending'
          };
        });

        singleStudentData = {
          studentName: targetStudent.full_name,
          rollNumber: targetStudent.roll_number,
          assessments: studentAssessments
        };
      }
    }

    const doc = generateMarksReportPdf({
      reportType: selectedPdfReportType,
      institutionName: institution?.name || 'VIVEKANANDA COLLEGE OF TECHNOLOGY & MANAGEMENT',
      collegeCode: '340',
      academicYear: currentYr?.name || 'Academic Year',
      sectionName: currentSec?.name || 'Section A',
      subjectName: currentSub?.subject_name || 'Subject',
      subjectCode: currentSub?.subject_code || 'SUB-001',
      facultyName: currentFaculty?.full_name || user?.full_name || 'Faculty Member',
      assessmentTitle: activeAssessment.title,
      maxMarks: activeAssessment.maxMarks,
      publishStatus: activeAssessment.status,
      studentRows,
      scorecardRows,
      singleStudent: singleStudentData
    });

    const filePrefix = selectedPdfReportType.toLowerCase();
    doc.save(`VCTM_${filePrefix}_${currentSub?.subject_code || 'MARKS'}_${currentSec?.name || 'SEC'}.pdf`);
    setIsPdfModalOpen(false);
  };

  const currentSubjectObj = subjects.find(s => s.id === selectedSubjectId);
  const currentSectionObj = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Toast Notification */}
      {notificationToast && (
        <div 
          className={clsx(
            'fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-top-4 duration-200 max-w-md',
            notificationToast.type === 'success' 
              ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40 shadow-emerald-950/50' 
              : 'bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-950/50'
          )}
        >
          {notificationToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-medium">{notificationToast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] font-serif-institutional tracking-tight flex items-center gap-3">
              Marks & Assessment Management
              {activeAssessment && (
                <span 
                  className={clsx(
                    'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border',
                    activeAssessment.status === 'published'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  )}
                >
                  {activeAssessment.status === 'published' ? '● Published' : '○ Draft'}
                </span>
              )}
            </h1>
            <p className="text-[15px] text-[#475569] mt-0.5 font-medium leading-relaxed">
              Record, validate, publish, and audit continuous internal assessments, sessionals, and quizzes
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openHistoryModal}
            disabled={!activeAssessment}
            className="border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs font-semibold"
          >
            <History className="w-4 h-4 mr-1.5 text-slate-600" />
            Marks History
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCsvImportModalOpen(true)}
            disabled={!activeAssessment || sectionStudents.length === 0}
            className="border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs font-semibold"
          >
            <Upload className="w-4 h-4 mr-1.5 text-slate-600" />
            Import CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!activeAssessment || sectionStudents.length === 0}
            className="border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs font-semibold"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-600" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPdfModalOpen(true)}
            disabled={!activeAssessment || sectionStudents.length === 0}
            className="border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs font-semibold"
          >
            <FileDown className="w-4 h-4 mr-1.5 text-slate-600" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Faculty Assignment Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 items-end">
          {/* 1. Academic Year */}
          <div className="xl:col-span-2">
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all shadow-xs cursor-pointer"
            >
              {facultyTeachingScope.assignedYears.map(yr => (
                <option key={yr.id} value={yr.id} className="text-slate-900 bg-white font-medium">
                  {yr.name}
                </option>
              ))}
              {facultyTeachingScope.assignedYears.length === 0 && (
                <option value="">No Assigned Years</option>
              )}
            </select>
          </div>

          {/* 2. Section */}
          <div className="xl:col-span-2">
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-600" />
              Section
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all shadow-xs cursor-pointer"
            >
              {availableSections.map(sec => (
                <option key={sec.id} value={sec.id} className="text-slate-900 bg-white font-medium">
                  {sec.name} ({sec.room_number ? `Room ${sec.room_number}` : 'Active'})
                </option>
              ))}
              {availableSections.length === 0 && (
                <option value="">No Sections Found</option>
              )}
            </select>
          </div>

          {/* 3. Subject */}
          <div className="xl:col-span-4">
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-600" />
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all shadow-xs cursor-pointer"
            >
              {availableSubjects.map(sub => (
                <option key={sub.id} value={sub.id} className="text-slate-900 bg-white font-medium">
                  {sub.subject_name} ({sub.subject_code})
                </option>
              ))}
              {availableSubjects.length === 0 && (
                <option value="">No Subjects Assigned</option>
              )}
            </select>
          </div>

          {/* 4. Assessment */}
          <div className="xl:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-slate-600" />
                Assessment
              </label>
              <button
                type="button"
                onClick={() => {
                  setNewAssessmentKind('sessional');
                  setNewAssessmentTitle('');
                  setNewAssessmentMaxMarks(20);
                  setNewAssessmentDate(getISTTodayDate());
                  setIsAddAssessmentModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-black bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-0.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Assessment
              </button>
            </div>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all shadow-xs cursor-pointer"
            >
              {sessionalsGroup.length > 0 && (
                <optgroup label="SESSIONALS" className="font-bold text-slate-700 bg-slate-100">
                  {sessionalsGroup.map(opt => (
                    <option key={opt.id} value={opt.id} className="text-slate-900 bg-white font-medium py-1">
                      {opt.title} — {opt.maxMarks} Marks • {opt.status === 'published' ? 'Published' : 'Draft'}
                    </option>
                  ))}
                </optgroup>
              )}
              {quizzesGroup.length > 0 && (
                <optgroup label="QUIZZES" className="font-bold text-slate-700 bg-slate-100">
                  {quizzesGroup.map(opt => (
                    <option key={opt.id} value={opt.id} className="text-slate-900 bg-white font-medium py-1">
                      {opt.title} — {opt.maxMarks} Marks • {opt.status === 'published' ? 'Published' : 'Draft'}
                    </option>
                  ))}
                </optgroup>
              )}
              {assignmentsGroup.length > 0 && (
                <optgroup label="ASSIGNMENTS" className="font-bold text-slate-700 bg-slate-100">
                  {assignmentsGroup.map(opt => (
                    <option key={opt.id} value={opt.id} className="text-slate-900 bg-white font-medium py-1">
                      {opt.title} — {opt.maxMarks} Marks • {opt.status === 'published' ? 'Published' : 'Draft'}
                    </option>
                  ))}
                </optgroup>
              )}
              {assessmentOptions.length === 0 && (
                <option value="">No Assessments Found</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Statistics & KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Students */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs sm:text-[13px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#475569]" />
            Total Roster
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] mt-1 font-sans tracking-tight">
            {stats.totalStudents}
          </div>
          <span className="text-xs sm:text-[13px] font-medium text-[#64748b] mt-0.5">Enrolled in Section</span>
        </div>

        {/* Marks Entered */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs sm:text-[13px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            Entered
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800 mt-1 font-sans tracking-tight">
            {stats.enteredCount}
          </div>
          <span className="text-xs sm:text-[13px] font-medium text-emerald-800 mt-0.5">
            {stats.totalStudents > 0 ? `${((stats.enteredCount / stats.totalStudents) * 100).toFixed(0)}% Completed` : '0%'}
          </span>
        </div>

        {/* Marks Missing */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs sm:text-[13px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            Missing
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-900 mt-1 font-sans tracking-tight">
            {stats.missingCount}
          </div>
          <span className="text-xs sm:text-[13px] font-medium text-amber-800 mt-0.5">Pending input</span>
        </div>

        {/* Publication Status */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs sm:text-[13px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-[#475569]" />
            Status
          </span>
          <div className="mt-1">
            {activeAssessment?.status === 'published' ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
                Published
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300">
                Draft Only
              </span>
            )}
          </div>
          <span className="text-xs sm:text-[13px] font-medium text-[#475569] mt-0.5">
            {activeAssessment?.status === 'published' ? 'Live to Students' : 'Hidden from Students'}
          </span>
        </div>

        {/* Class Average */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs sm:text-[13px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#475569]" />
            Class Average
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] mt-1 font-sans tracking-tight">
            {stats.avgMarks} <span className="text-xs font-semibold text-[#475569]">/ {activeAssessment?.maxMarks || 20}</span>
          </div>
          <span className="text-xs sm:text-[13px] font-medium text-[#64748b] mt-0.5">Mean Performance</span>
        </div>

        {/* Highest Mark */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs sm:text-[13px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#475569]" />
            Highest Mark
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] mt-1 font-sans tracking-tight">
            {stats.highest} <span className="text-xs font-semibold text-[#475569]">/ {activeAssessment?.maxMarks || 20}</span>
          </div>
          <span className="text-xs sm:text-[13px] font-medium text-[#64748b] mt-0.5">Top Score</span>
        </div>

        {/* Lowest & Pass Rate */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs sm:text-[13px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-[#475569]" />
            Pass Rate
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800 mt-1 font-sans tracking-tight">
            {stats.passPercentage}%
          </div>
          <span className="text-xs sm:text-[13px] font-medium text-[#64748b] mt-0.5">Min: {stats.lowest}</span>
        </div>
      </div>

      {/* Roster Controls & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Left: Search & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search roll number or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMissingOnly(prev => !prev)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors',
              showMissingOnly
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            {showMissingOnly ? 'Showing Missing Only' : 'Show Missing Only'}
            {stats.missingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-900 font-bold">
                {stats.missingCount}
              </span>
            )}
          </button>
        </div>

        {/* Right: Primary Save & Publish Buttons */}
        <div className="flex items-center gap-2.5">
          {isDirty && (
            <span className="text-xs text-amber-800 font-medium flex items-center gap-1 mr-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Unsaved Changes
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSaveMarks('draft')}
            disabled={isSaving || !activeAssessment || sectionStudents.length === 0}
            className={clsx(
              "rounded-xl font-bold shadow-xs transition-all",
              saveStatus === 'saved' && "border-emerald-300 bg-emerald-50 text-emerald-800",
              saveStatus === 'error' && "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",
              saveStatus !== 'saved' && saveStatus !== 'error' && "border-slate-300 hover:bg-slate-50 text-slate-700"
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-slate-600" />
            ) : saveStatus === 'saved' ? (
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
            ) : saveStatus === 'error' ? (
              <AlertCircle className="w-4 h-4 mr-1.5 text-rose-600" />
            ) : (
              <Save className="w-4 h-4 mr-1.5 text-slate-600" />
            )}
            {saveStatus === 'saved' ? 'Draft Saved' : saveStatus === 'error' ? 'Save Failed — Retry' : 'Save Draft'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPublishModalOpen(true)}
            disabled={isSaving || !activeAssessment || sectionStudents.length === 0}
            className="bg-[#0f172a] hover:bg-black text-white font-bold rounded-xl shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Publish Marks
          </Button>
        </div>
      </div>

      {/* Main Student Marks Roster Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
        {isLoadingStudents ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-slate-900 mb-3" />
            <p className="text-sm">Loading student roster for {currentSectionObj?.name || 'selected section'}...</p>
          </div>
        ) : displayedStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-1">No Students Match Selection</h3>
            <p className="text-xs text-slate-500">
              {showMissingOnly 
                ? 'All students in this section have marks entered! Great job.' 
                : 'No active students found in this section.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4 w-44">Roll Number</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4 w-44 text-center">
                    Marks ({activeAssessment?.maxMarks || 30})
                  </th>
                  <th className="py-3.5 px-4 w-28 text-center">% Score</th>
                  <th className="py-3.5 px-4 w-28 text-center">Status</th>
                  <th className="py-3.5 px-4 w-60">Remarks (Optional)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedStudents.map((st, index) => {
                  const entry = marksRoster[st.id] || { marks: '', remarks: '' };
                  return (
                    <MemoizedStudentMarkRow
                      key={st.id}
                      student={st}
                      index={index}
                      marks={entry.marks}
                      remarks={entry.remarks || ''}
                      maxMarks={activeAssessment?.maxMarks || 30}
                      onMarkChange={handleMarkChange}
                      onRemarkChange={handleRemarkChange}
                      onKeyDown={handleKeyDown}
                      registerInputRef={registerInputRef}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Publish Confirmation Modal */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Publish Marks Confirmation</span>
          </div>
        }
        description={`Confirm publication of ${activeAssessment?.title} marks for ${currentSubjectObj?.subject_name} (${currentSectionObj?.name})`}
      >
        <div className="space-y-4 pt-2">
          {stats.missingCount > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-amber-900 block">
                  Warning: {stats.missingCount} student(s) have missing marks!
                </span>
                <p className="text-slate-600">
                  Publishing now will make entered marks visible immediately to students on their portal, while leaving {stats.missingCount} record(s) blank.
                </p>
              </div>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Students in Section:</span>
              <span className="text-slate-900 font-mono font-bold">{stats.totalStudents}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Marks Entered:</span>
              <span className="text-emerald-800 font-mono font-bold">{stats.enteredCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Missing Marks:</span>
              <span className="text-amber-800 font-mono font-bold">{stats.missingCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Maximum Marks:</span>
              <span className="text-slate-900 font-mono font-bold">{activeAssessment?.maxMarks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Class Average:</span>
              <span className="text-slate-900 font-mono font-bold">{stats.avgMarks}</span>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Once published, these scores will be visible on the student scorecard in realtime. You may re-edit and update scores at any time.
          </p>

          <div className="flex justify-end gap-2.5 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPublishModalOpen(false)}
              className="border-slate-300 text-slate-700"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveMarks('published')}
              disabled={isSaving}
              className="bg-[#0f172a] hover:bg-black text-white font-bold"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              Confirm & Publish Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: Add Assessment Modal */}
      <Modal
        isOpen={isAddAssessmentModalOpen}
        onClose={() => setIsAddAssessmentModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900">
            <Plus className="w-5 h-5 text-slate-900" />
            <span className="font-bold">Add Assessment</span>
          </div>
        }
        description={`Create a new continuous assessment for ${currentSubjectObj?.subject_name || 'Subject'} (${currentSectionObj?.name || 'Section'})`}
      >
        <form onSubmit={handleCreateAssessment} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
              Assessment Type <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={clsx(
                'flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all',
                newAssessmentKind === 'sessional' 
                  ? 'bg-slate-100 border-slate-900 text-slate-900 font-bold shadow-xs' 
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              )}>
                <input
                  type="radio"
                  name="assessmentKind"
                  value="sessional"
                  checked={newAssessmentKind === 'sessional'}
                  onChange={() => {
                    setNewAssessmentKind('sessional');
                    if (!newAssessmentTitle || newAssessmentTitle.toLowerCase().includes('quiz')) {
                      setNewAssessmentTitle('Sessional 3');
                    }
                  }}
                  className="text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs">Sessional Exam</span>
              </label>

              <label className={clsx(
                'flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all',
                newAssessmentKind === 'quiz' 
                  ? 'bg-slate-100 border-slate-900 text-slate-900 font-bold shadow-xs' 
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              )}>
                <input
                  type="radio"
                  name="assessmentKind"
                  value="quiz"
                  checked={newAssessmentKind === 'quiz'}
                  onChange={() => {
                    setNewAssessmentKind('quiz');
                    if (!newAssessmentTitle || newAssessmentTitle.toLowerCase().includes('sessional')) {
                      setNewAssessmentTitle('Quiz 6');
                    }
                  }}
                  className="text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs">Quiz / Class Test</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Assessment Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={newAssessmentKind === 'sessional' ? 'e.g. Sessional 3, PUT, Midterm Exam' : 'e.g. Quiz 6, Chapter 1 Quiz, Surprise Test'}
              value={newAssessmentTitle}
              onChange={(e) => setNewAssessmentTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Maximum Marks <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                required
                min="5"
                max="100"
                value={newAssessmentMaxMarks}
                onChange={(e) => setNewAssessmentMaxMarks(parseInt(e.target.value) || 20)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 font-mono focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={newAssessmentDate}
                onChange={(e) => setNewAssessmentDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsAddAssessmentModalOpen(false)}
              className="border-slate-300 text-slate-700 font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isCreatingAssessment}
              className="bg-[#0f172a] hover:bg-black text-white font-bold"
            >
              {isCreatingAssessment ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              Create Assessment
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: PDF Download Options Modal */}
      <Modal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900">
            <FileDown className="w-5 h-5 text-slate-900" />
            <span>Download Marks Report PDF</span>
          </div>
        }
        description="Select official academic report template and format"
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Report Template:
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-colors">
              <input
                type="radio"
                name="pdfReportType"
                checked={selectedPdfReportType === 'CURRENT_ASSESSMENT'}
                onChange={() => setSelectedPdfReportType('CURRENT_ASSESSMENT')}
                className="mt-1 text-slate-900 focus:ring-slate-900"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  1. Current Assessment Marks Sheet
                </span>
                <span className="text-[11px] text-slate-600">
                  Standard roster with marks, percentage, status, summary statistics, and faculty/HOD signature lines.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-colors">
              <input
                type="radio"
                name="pdfReportType"
                checked={selectedPdfReportType === 'SUBJECT_SCORECARD'}
                onChange={() => setSelectedPdfReportType('SUBJECT_SCORECARD')}
                className="mt-1 text-slate-900 focus:ring-slate-900"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  2. Complete Subject Scorecard
                </span>
                <span className="text-[11px] text-slate-600">
                  Comprehensive internal ledger: Sessional 1 + Sessional 2 + Quizzes Total + Internal Marks.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-colors">
              <input
                type="radio"
                name="pdfReportType"
                checked={selectedPdfReportType === 'SECTION_REPORT'}
                onChange={() => setSelectedPdfReportType('SECTION_REPORT')}
                className="mt-1 text-slate-900 focus:ring-slate-900"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  3. Section Assessment Ledger
                </span>
                <span className="text-[11px] text-slate-600">
                  Official class-wide continuous evaluation report for academic records and university compliance.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-colors">
              <input
                type="radio"
                name="pdfReportType"
                checked={selectedPdfReportType === 'STUDENT_REPORT'}
                onChange={() => setSelectedPdfReportType('STUDENT_REPORT')}
                className="mt-1 text-slate-900 focus:ring-slate-900"
              />
              <div className="w-full">
                <span className="text-xs font-semibold text-slate-900 block">
                  4. Individual Student Scorecard
                </span>
                <span className="text-[11px] text-slate-600">
                  Detailed single student assessment breakdown across all tests in this subject.
                </span>
                {selectedPdfReportType === 'STUDENT_REPORT' && (
                  <div className="mt-2">
                    <select
                      value={selectedStudentForPdf}
                      onChange={(e) => setSelectedStudentForPdf(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-400"
                    >
                      {sectionStudents.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.roll_number} — {st.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPdfModalOpen(false)}
              className="border-slate-300 text-slate-700"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              className="bg-[#0f172a] hover:bg-black text-white font-bold"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Generate & Download
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: CSV Import with Validation Modal */}
      <Modal
        isOpen={isCsvImportModalOpen}
        onClose={() => {
          setIsCsvImportModalOpen(false);
          setImportPreview(null);
          setCsvFile(null);
        }}
        title={
          <div className="flex items-center gap-2 text-slate-900">
            <Upload className="w-5 h-5 text-slate-900" />
            <span>Bulk CSV Marks Import</span>
          </div>
        }
        description={`Upload a CSV marks sheet for ${activeAssessment?.title} (${currentSectionObj?.name})`}
        maxWidth="xl"
      >
        <div className="space-y-4 pt-2">
          {/* File Picker */}
          {!importPreview && (
            <div className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 rounded-2xl p-6 text-center transition-colors">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-900 mb-1">
                Upload CSV File
              </p>
              <p className="text-[11px] text-slate-600 mb-4">
                Required columns: <code>Roll Number</code> and <code>Marks</code> (or <code>Marks Obtained</code>). Optional: <code>Remarks</code>.
              </p>
              <input
                type="file"
                accept=".csv"
                id="csvMarksInput"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleCsvFileSelect(e.target.files[0]);
                  }
                }}
              />
              <label
                htmlFor="csvMarksInput"
                className="cursor-pointer inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold bg-[#0f172a] hover:bg-black text-white shadow-xs transition-all"
              >
                Browse CSV File
              </label>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessingCsv && (
            <div className="p-8 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-slate-900 mx-auto mb-2" />
              <p className="text-xs">Validating rows against section students and max marks...</p>
            </div>
          )}

          {/* Import Preview */}
          {importPreview && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-emerald-800 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {importPreview.validRows.length} Valid Records
                  </span>
                  {importPreview.invalidRows.length > 0 && (
                    <span className="text-rose-700 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      {importPreview.invalidRows.length} Invalid Records
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImportPreview(null);
                    setCsvFile(null);
                  }}
                  className="text-slate-600 hover:text-slate-900 underline text-[11px] font-medium"
                >
                  Choose Different File
                </button>
              </div>

              {/* Invalid Rows Warning */}
              {importPreview.invalidRows.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 max-h-36 overflow-y-auto">
                  <span className="text-[11px] font-bold text-rose-900 block mb-1">
                    Issues Detected (these rows will be skipped):
                  </span>
                  <ul className="text-[10px] text-rose-800 space-y-1 list-disc pl-4">
                    {importPreview.invalidRows.map((inv, idx) => (
                      <li key={idx}>{inv.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Valid Rows Preview Table */}
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2">Roll Number</th>
                      <th className="p-2">Student Name</th>
                      <th className="p-2 text-center">Marks</th>
                      <th className="p-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreview.validRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-2 font-mono font-bold text-slate-900">{row.rollNumber}</td>
                        <td className="p-2 text-slate-800 font-medium">{row.studentName}</td>
                        <td className="p-2 font-mono font-bold text-emerald-800 text-center">{row.marks}</td>
                        <td className="p-2 text-slate-500">{row.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportPreview(null);
                    setIsCsvImportModalOpen(false);
                  }}
                  className="border-slate-300 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={applyCsvImport}
                  disabled={importPreview.validRows.length === 0}
                  className="bg-[#0f172a] hover:bg-black text-white font-bold"
                >
                  Apply {importPreview.validRows.length} Valid Marks
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 5: Marks History / Audit Trail Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900">
            <History className="w-5 h-5 text-slate-900" />
            <span>Marks Modification Audit Trail</span>
          </div>
        }
        description={`Historical ledger of marks updates for ${activeAssessment?.title}`}
        maxWidth="xl"
      >
        <div className="space-y-4 pt-2">
          {isLoadingHistory ? (
            <div className="p-8 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-slate-900 mx-auto mb-2" />
              <p className="text-xs">Loading audit logs from database...</p>
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs">No modification history recorded yet for this assessment.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Roll No</th>
                    <th className="p-2.5">Student</th>
                    <th className="p-2.5 text-center">Change</th>
                    <th className="p-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyRecords.map((hist) => (
                    <tr key={hist.id} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-mono text-[11px] text-slate-500">
                        {new Date(hist.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">
                        {hist.student?.roll_number || '—'}
                      </td>
                      <td className="p-2.5 text-slate-800 font-medium">
                        {hist.student?.full_name || 'Student'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        <span className="text-slate-400">{hist.old_marks ?? '—'}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="text-emerald-800">{hist.new_marks}</span>
                      </td>
                      <td className="p-2.5 text-slate-600 text-[11px]">
                        {hist.reason || 'Marks Updated'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryModalOpen(false)}
              className="border-slate-300 text-slate-700"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};



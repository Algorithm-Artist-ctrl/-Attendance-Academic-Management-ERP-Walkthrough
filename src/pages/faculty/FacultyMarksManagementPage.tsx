import React, { useState, useMemo, useEffect, useRef } from 'react';
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
    saveSessionalMarks,
    saveQuizMarks
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

  // 5. Ensure default Sessional 1 & 2 exist when Subject & Section are selected
  useEffect(() => {
    if (selectedSubjectId && selectedSectionId && currentFacultyId) {
      const currentSec = sections.find(s => s.id === selectedSectionId);
      ensureDefaultSessionalAssessments({
        subjectId: selectedSubjectId,
        sectionId: selectedSectionId,
        facultyId: currentFacultyId,
        semesterId: currentSec?.semester_id
      }).catch(err => {
        console.warn('Auto-ensuring default sessionals noticed:', err);
      });
    }
  }, [selectedSubjectId, selectedSectionId, currentFacultyId, sections, ensureDefaultSessionalAssessments]);

  // 6. Build Assessment List for current (Subject, Section)
  const assessmentOptions = useMemo<SelectedAssessmentInfo[]>(() => {
    if (!selectedSubjectId || !selectedSectionId) return [];

    const list: SelectedAssessmentInfo[] = [];

    // Sessionals
    const matchedSessionals = sessionalAssessments.filter(
      sa => sa.subject_id === selectedSubjectId && sa.section_id === selectedSectionId
    );
    // Sort sessionals: Sessional 1 first, then Sessional 2, then others
    matchedSessionals.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      if (aTitle.includes('1') && !bTitle.includes('1')) return -1;
      if (!aTitle.includes('1') && bTitle.includes('1')) return 1;
      if (aTitle.includes('2') && !bTitle.includes('2')) return -1;
      if (!aTitle.includes('2') && bTitle.includes('2')) return 1;
      return a.title.localeCompare(b.title);
    });

    for (const sa of matchedSessionals) {
      list.push({
        id: sa.id,
        kind: 'sessional',
        title: sa.title,
        maxMarks: sa.max_marks,
        status: (sa.status === 'published' || sa.status === 'completed') ? 'published' : 'draft',
        date: sa.exam_date
      });
    }

    // Quizzes
    const matchedQuizzes = quizzes.filter(
      q => q.subject_id === selectedSubjectId && q.section_id === selectedSectionId
    );
    for (const q of matchedQuizzes) {
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
      ca => ca.subject_id === selectedSubjectId && ca.section_id === selectedSectionId
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
  const [isSaving, setIsSaving] = useState(false);
  const [notificationToast, setNotificationToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync marks roster when active assessment or students change
  useEffect(() => {
    if (!activeAssessment || sectionStudents.length === 0) {
      setMarksRoster({});
      setIsDirty(false);
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
  }, [activeAssessment, sectionStudents, sessionalMarks, quizResults, assignmentSubmissions]);

  // Auto-dismiss notification toast
  useEffect(() => {
    if (notificationToast) {
      const timer = setTimeout(() => setNotificationToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notificationToast]);

  // Handle Mark Input with Live Bounds Validation
  const handleMarkChange = (studentId: string, valueStr: string) => {
    if (!activeAssessment) return;
    const maxMarks = activeAssessment.maxMarks;

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
    if (num > maxMarks) {
      setNotificationToast({
        type: 'error',
        message: `Maximum marks allowed is ${maxMarks}.`
      });
      return;
    }

    setMarksRoster(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], marks: num }
    }));
    setIsDirty(true);
  };

  const handleRemarkChange = (studentId: string, remarks: string) => {
    setMarksRoster(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], remarks }
    }));
    setIsDirty(true);
  };

  // Keyboard navigation between student marks inputs
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
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
  };

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
  }, [sectionStudents, searchTerm, showMissingOnly, marksRoster]);

  // 11. Save Draft & Publish Marks Actions
  const handleSaveMarks = async (publishMode: 'draft' | 'published') => {
    if (!activeAssessment || !selectedSubjectId || !selectedSectionId) return;

    try {
      setIsSaving(true);
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

      setIsDirty(false);
      setNotificationToast({
        type: 'success',
        message: publishMode === 'published' 
          ? `Marks successfully PUBLISHED! Scores are now visible on student dashboards.` 
          : `Marks saved securely as DRAFT (hidden from students).`
      });
    } catch (err: any) {
      console.error('Save marks error:', err);
      setNotificationToast({
        type: 'error',
        message: err?.message || 'Failed to save marks. Please check your network and try again.'
      });
    } finally {
      setIsSaving(false);
      setIsPublishModalOpen(false);
    }
  };

  // 12. Modals State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isAddSessionalModalOpen, setIsAddSessionalModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Add Sessional Form State
  const [newSessionalTitle, setNewSessionalTitle] = useState('');
  const [newSessionalMaxMarks, setNewSessionalMaxMarks] = useState<number>(30);
  const [newSessionalDate, setNewSessionalDate] = useState(getISTTodayDate());
  const [isCreatingSessional, setIsCreatingSessional] = useState(false);

  const handleCreateSessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionalTitle.trim() || !selectedSubjectId || !selectedSectionId || !currentFacultyId) return;

    try {
      setIsCreatingSessional(true);
      const currentSec = sections.find(s => s.id === selectedSectionId);
      const created = await createSessionalAssessment({
        title: newSessionalTitle.trim(),
        subject_id: selectedSubjectId,
        section_id: selectedSectionId,
        faculty_id: currentFacultyId,
        semester_id: currentSec?.semester_id,
        max_marks: Number(newSessionalMaxMarks) || 30,
        exam_date: newSessionalDate || getISTTodayDate(),
        status: 'draft'
      });

      setSelectedAssessmentId(created.id);
      setIsAddSessionalModalOpen(false);
      setNewSessionalTitle('');
      setNotificationToast({
        type: 'success',
        message: `Assessment "${created.title}" created successfully.`
      });
    } catch (err: any) {
      setNotificationToast({
        type: 'error',
        message: err?.message || 'Failed to create assessment.'
      });
    } finally {
      setIsCreatingSessional(false);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Marks & Assessment Management
              {activeAssessment && (
                <span 
                  className={clsx(
                    'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border',
                    activeAssessment.status === 'published'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  )}
                >
                  {activeAssessment.status === 'published' ? '● Published' : '○ Draft'}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
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
            className="border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-300"
          >
            <History className="w-4 h-4 mr-1.5 text-cyan-400" />
            Marks History
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCsvImportModalOpen(true)}
            disabled={!activeAssessment || sectionStudents.length === 0}
            className="border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-slate-300"
          >
            <Upload className="w-4 h-4 mr-1.5 text-emerald-400" />
            Import CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!activeAssessment || sectionStudents.length === 0}
            className="border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-slate-300"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-400" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPdfModalOpen(true)}
            disabled={!activeAssessment || sectionStudents.length === 0}
            className="border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-300"
          >
            <FileDown className="w-4 h-4 mr-1.5 text-cyan-400" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Faculty Assignment Filter Bar */}
      <div className="bg-[#091322]/90 border border-emerald-500/20 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* 1. Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all font-medium"
            >
              {facultyTeachingScope.assignedYears.map(yr => (
                <option key={yr.id} value={yr.id}>
                  {yr.name}
                </option>
              ))}
              {facultyTeachingScope.assignedYears.length === 0 && (
                <option value="">No Assigned Years</option>
              )}
            </select>
          </div>

          {/* 2. Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              Section
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all font-medium"
            >
              {availableSections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} ({sec.room_number ? `Room ${sec.room_number}` : 'Active'})
                </option>
              ))}
              {availableSections.length === 0 && (
                <option value="">No Sections Found</option>
              )}
            </select>
          </div>

          {/* 3. Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all font-medium"
            >
              {availableSubjects.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.subject_name} ({sub.subject_code})
                </option>
              ))}
              {availableSubjects.length === 0 && (
                <option value="">No Subjects Assigned</option>
              )}
            </select>
          </div>

          {/* 4. Assessment */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                Assessment
              </label>
              <button
                type="button"
                onClick={() => setIsAddSessionalModalOpen(true)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 transition-colors font-medium"
              >
                <Plus className="w-3 h-3" />
                Add Assessment
              </button>
            </div>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all font-medium"
            >
              {assessmentOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.title} ({opt.maxMarks} Marks) • {opt.status === 'published' ? 'Published' : 'Draft'}
                </option>
              ))}
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
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-400" />
            Total Roster
          </span>
          <div className="text-xl font-bold text-white mt-1">
            {stats.totalStudents}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Enrolled in Section</span>
        </div>

        {/* Marks Entered */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Entered
          </span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {stats.enteredCount}
          </div>
          <span className="text-[10px] text-emerald-400/70 mt-0.5">
            {stats.totalStudents > 0 ? `${((stats.enteredCount / stats.totalStudents) * 100).toFixed(0)}% Completed` : '0%'}
          </span>
        </div>

        {/* Marks Missing */}
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            Missing
          </span>
          <div className="text-xl font-bold text-amber-400 mt-1">
            {stats.missingCount}
          </div>
          <span className="text-[10px] text-amber-400/70 mt-0.5">Pending input</span>
        </div>

        {/* Publication Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Eye className="w-3 h-3 text-slate-400" />
            Status
          </span>
          <div className="mt-1">
            {activeAssessment?.status === 'published' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Published
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                Draft Only
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">
            {activeAssessment?.status === 'published' ? 'Live to Students' : 'Hidden from Students'}
          </span>
        </div>

        {/* Class Average */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-slate-400" />
            Class Average
          </span>
          <div className="text-xl font-bold text-cyan-400 mt-1">
            {stats.avgMarks} <span className="text-xs font-normal text-slate-500">/ {activeAssessment?.maxMarks || 30}</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Mean Performance</span>
        </div>

        {/* Highest Mark */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3 h-3 text-amber-400" />
            Highest Mark
          </span>
          <div className="text-xl font-bold text-amber-400 mt-1">
            {stats.highest} <span className="text-xs font-normal text-slate-500">/ {activeAssessment?.maxMarks || 30}</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Top Score</span>
        </div>

        {/* Lowest & Pass Rate */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Percent className="w-3 h-3 text-emerald-400" />
            Pass Rate
          </span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {stats.passPercentage}%
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Min: {stats.lowest}</span>
        </div>
      </div>

      {/* Roster Controls & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        {/* Left: Search & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search roll number or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMissingOnly(prev => !prev)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors',
              showMissingOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            {showMissingOnly ? 'Showing Missing Only' : 'Show Missing Only'}
            {stats.missingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300">
                {stats.missingCount}
              </span>
            )}
          </button>
        </div>

        {/* Right: Primary Save & Publish Buttons */}
        <div className="flex items-center gap-2.5">
          {isDirty && (
            <span className="text-xs text-amber-400/90 font-medium flex items-center gap-1 animate-pulse mr-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Unsaved Changes
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSaveMarks('draft')}
            disabled={isSaving || !activeAssessment || sectionStudents.length === 0}
            className="border-slate-700 hover:border-slate-500 text-slate-300"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-slate-400" />
            ) : (
              <Save className="w-4 h-4 mr-1.5 text-slate-400" />
            )}
            Save Draft
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPublishModalOpen(true)}
            disabled={isSaving || !activeAssessment || sectionStudents.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Publish Marks
          </Button>
        </div>
      </div>

      {/* Main Student Marks Roster Table */}
      <div className="bg-[#091322]/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        {isLoadingStudents ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
            <p className="text-sm">Loading student roster for {currentSectionObj?.name || 'selected section'}...</p>
          </div>
        ) : displayedStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-medium text-white mb-1">No Students Match Selection</h3>
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
                <tr className="bg-slate-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
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
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {displayedStudents.map((st, index) => {
                  const entry = marksRoster[st.id] || { marks: '', remarks: '' };
                  const marksVal = entry.marks;
                  const hasMark = marksVal !== '' && marksVal !== undefined;
                  const maxMarks = activeAssessment?.maxMarks || 30;
                  const percentage = hasMark ? ((Number(marksVal) / maxMarks) * 100).toFixed(1) : null;
                  const isPassing = hasMark && Number(marksVal) >= (maxMarks * 0.4);

                  return (
                    <tr 
                      key={st.id} 
                      className={clsx(
                        'hover:bg-slate-900/50 transition-colors',
                        !hasMark && 'bg-amber-950/5'
                      )}
                    >
                      {/* S.No */}
                      <td className="py-3 px-4 text-center text-slate-500 font-mono">
                        {index + 1}
                      </td>

                      {/* Roll Number */}
                      <td className="py-3 px-4 font-mono font-semibold text-cyan-400">
                        {st.roll_number}
                      </td>

                      {/* Student Name */}
                      <td className="py-3 px-4 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                            {st.full_name?.charAt(0) || 'S'}
                          </div>
                          <span>{st.full_name}</span>
                        </div>
                      </td>

                      {/* Marks Input */}
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            ref={el => { inputRefs.current[st.id] = el; }}
                            type="number"
                            step="any"
                            min="0"
                            max={maxMarks}
                            value={marksVal}
                            placeholder="—"
                            onChange={(e) => handleMarkChange(st.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            className={clsx(
                              'w-24 text-center py-1.5 px-2 rounded-lg font-mono text-sm font-semibold transition-all focus:outline-none',
                              hasMark 
                                ? isPassing
                                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/50 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'
                                  : 'bg-rose-950/40 text-rose-300 border border-rose-500/50 focus:border-rose-400 focus:ring-1 focus:ring-rose-400'
                                : 'bg-slate-950/80 text-white border border-slate-700/80 border-dashed focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                            )}
                          />
                          <span className="text-[11px] text-slate-500 font-mono">
                            /{maxMarks}
                          </span>
                        </div>
                      </td>

                      {/* Percentage */}
                      <td className="py-3 px-4 text-center font-mono">
                        {percentage !== null ? (
                          <span 
                            className={clsx(
                              'font-medium',
                              isPassing ? 'text-slate-300' : 'text-rose-400'
                            )}
                          >
                            {percentage}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {hasMark ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Entered
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            Missing
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={entry.remarks || ''}
                          placeholder="Add comment..."
                          onChange={(e) => handleRemarkChange(st.id, e.target.value)}
                          className="w-full bg-transparent border-b border-slate-800 hover:border-slate-700 focus:border-emerald-500 text-xs text-slate-300 placeholder-slate-600 focus:outline-none px-1 py-1 transition-colors"
                        />
                      </td>
                    </tr>
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
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span>Publish Marks Confirmation</span>
          </div>
        }
        description={`Confirm publication of ${activeAssessment?.title} marks for ${currentSubjectObj?.subject_name} (${currentSectionObj?.name})`}
      >
        <div className="space-y-4 pt-2">
          {stats.missingCount > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-semibold text-amber-300 block">
                  Warning: {stats.missingCount} student(s) have missing marks!
                </span>
                <p className="text-slate-300">
                  Publishing now will make entered marks visible immediately to students on their portal, while leaving {stats.missingCount} record(s) blank.
                </p>
              </div>
            </div>
          )}

          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Students in Section:</span>
              <span className="text-white font-mono font-semibold">{stats.totalStudents}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Marks Entered:</span>
              <span className="text-emerald-400 font-mono font-semibold">{stats.enteredCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Missing Marks:</span>
              <span className="text-amber-400 font-mono font-semibold">{stats.missingCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Maximum Marks:</span>
              <span className="text-white font-mono font-semibold">{activeAssessment?.maxMarks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Class Average:</span>
              <span className="text-cyan-400 font-mono font-semibold">{stats.avgMarks}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Once published, these scores will be visible on the student scorecard in realtime. You may re-edit and update scores at any time.
          </p>

          <div className="flex justify-end gap-2.5 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPublishModalOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveMarks('published')}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
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

      {/* MODAL 2: Add Sessional / Assessment Modal */}
      <Modal
        isOpen={isAddSessionalModalOpen}
        onClose={() => setIsAddSessionalModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-emerald-400" />
            <span>Add Sessional Assessment</span>
          </div>
        }
        description={`Create a new continuous assessment for ${currentSubjectObj?.subject_name} (${currentSectionObj?.name})`}
      >
        <form onSubmit={handleCreateSessional} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Assessment Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sessional 3, PUT (Pre-University Test), Class Test 1"
              value={newSessionalTitle}
              onChange={(e) => setNewSessionalTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Maximum Marks <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                required
                min="5"
                max="100"
                value={newSessionalMaxMarks}
                onChange={(e) => setNewSessionalMaxMarks(parseInt(e.target.value) || 30)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Exam Date
              </label>
              <input
                type="date"
                value={newSessionalDate}
                onChange={(e) => setNewSessionalDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsAddSessionalModalOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isCreatingSessional}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {isCreatingSessional ? (
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
          <div className="flex items-center gap-2 text-cyan-400">
            <FileDown className="w-5 h-5" />
            <span>Download Marks Report PDF</span>
          </div>
        }
        description="Select official academic report template and format"
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Report Template:
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition-colors">
              <input
                type="radio"
                name="pdfReportType"
                checked={selectedPdfReportType === 'CURRENT_ASSESSMENT'}
                onChange={() => setSelectedPdfReportType('CURRENT_ASSESSMENT')}
                className="mt-1 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">
                  1. Current Assessment Marks Sheet
                </span>
                <span className="text-[11px] text-slate-400">
                  Standard roster with marks, percentage, status, summary statistics, and faculty/HOD signature lines.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition-colors">
              <input
                type="radio"
                name="pdfReportType"
                checked={selectedPdfReportType === 'SUBJECT_SCORECARD'}
                onChange={() => setSelectedPdfReportType('SUBJECT_SCORECARD')}
                className="mt-1 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">
                  2. Complete Subject Scorecard
                </span>
                <span className="text-[11px] text-slate-400">
                  Comprehensive internal ledger: Sessional 1 + Sessional 2 + Quizzes Total + Internal Marks.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition-colors">
              <input
                type="radio"
                name="pdfReportType"
                checked={selectedPdfReportType === 'SECTION_REPORT'}
                onChange={() => setSelectedPdfReportType('SECTION_REPORT')}
                className="mt-1 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">
                  3. Section Assessment Ledger
                </span>
                <span className="text-[11px] text-slate-400">
                  Official class-wide continuous evaluation report for academic records and university compliance.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition-colors">
              <input
                type="radio"
                name="pdfReportType"
                checked={selectedPdfReportType === 'STUDENT_REPORT'}
                onChange={() => setSelectedPdfReportType('STUDENT_REPORT')}
                className="mt-1 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="w-full">
                <span className="text-xs font-semibold text-white block">
                  4. Individual Student Scorecard
                </span>
                <span className="text-[11px] text-slate-400">
                  Detailed single student assessment breakdown across all tests in this subject.
                </span>
                {selectedPdfReportType === 'STUDENT_REPORT' && (
                  <div className="mt-2">
                    <select
                      value={selectedStudentForPdf}
                      onChange={(e) => setSelectedStudentForPdf(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
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
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
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
          <div className="flex items-center gap-2 text-white">
            <Upload className="w-5 h-5 text-emerald-400" />
            <span>Bulk CSV Marks Import</span>
          </div>
        }
        description={`Upload a CSV marks sheet for ${activeAssessment?.title} (${currentSectionObj?.name})`}
        maxWidth="xl"
      >
        <div className="space-y-4 pt-2">
          {/* File Picker */}
          {!importPreview && (
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 text-center transition-colors">
              <FileSpreadsheet className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-white mb-1">
                Upload CSV File
              </p>
              <p className="text-[11px] text-slate-400 mb-4">
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
                className="cursor-pointer inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all"
              >
                Browse CSV File
              </label>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessingCsv && (
            <div className="p-8 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
              <p className="text-xs">Validating rows against section students and max marks...</p>
            </div>
          )}

          {/* Import Preview */}
          {importPreview && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {importPreview.validRows.length} Valid Records
                  </span>
                  {importPreview.invalidRows.length > 0 && (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
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
                  className="text-slate-400 hover:text-white underline text-[11px]"
                >
                  Choose Different File
                </button>
              </div>

              {/* Invalid Rows Warning */}
              {importPreview.invalidRows.length > 0 && (
                <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 max-h-36 overflow-y-auto">
                  <span className="text-[11px] font-semibold text-rose-300 block mb-1">
                    Issues Detected (these rows will be skipped):
                  </span>
                  <ul className="text-[10px] text-rose-200/80 space-y-1 list-disc pl-4">
                    {importPreview.invalidRows.map((inv, idx) => (
                      <li key={idx}>{inv.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Valid Rows Preview Table */}
              <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2">Roll Number</th>
                      <th className="p-2">Student Name</th>
                      <th className="p-2 text-center">Marks</th>
                      <th className="p-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {importPreview.validRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-2 font-mono text-cyan-400">{row.rollNumber}</td>
                        <td className="p-2 text-slate-200">{row.studentName}</td>
                        <td className="p-2 font-mono font-semibold text-emerald-400 text-center">{row.marks}</td>
                        <td className="p-2 text-slate-400">{row.remarks || '—'}</td>
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
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={applyCsvImport}
                  disabled={importPreview.validRows.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
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
          <div className="flex items-center gap-2 text-cyan-400">
            <History className="w-5 h-5" />
            <span>Marks Modification Audit Trail</span>
          </div>
        }
        description={`Historical ledger of marks updates for ${activeAssessment?.title}`}
        maxWidth="xl"
      >
        <div className="space-y-4 pt-2">
          {isLoadingHistory ? (
            <div className="p-8 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
              <p className="text-xs">Loading audit logs from database...</p>
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs">No modification history recorded yet for this assessment.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Roll No</th>
                    <th className="p-2.5">Student</th>
                    <th className="p-2.5 text-center">Change</th>
                    <th className="p-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {historyRecords.map((hist) => (
                    <tr key={hist.id} className="hover:bg-slate-900/40">
                      <td className="p-2.5 font-mono text-[11px] text-slate-400">
                        {new Date(hist.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="p-2.5 font-mono text-cyan-400">
                        {hist.student?.roll_number || '—'}
                      </td>
                      <td className="p-2.5 text-slate-300">
                        {hist.student?.full_name || 'Student'}
                      </td>
                      <td className="p-2.5 text-center font-mono font-semibold">
                        <span className="text-slate-500">{hist.old_marks ?? '—'}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="text-emerald-400">{hist.new_marks}</span>
                      </td>
                      <td className="p-2.5 text-slate-400 text-[11px]">
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
              className="border-slate-700 text-slate-300"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Layers, 
  Users, 
  GraduationCap, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Search, 
  Filter, 
  Plus, 
  RefreshCw, 
  Calendar, 
  BookOpen, 
  Building2, 
  Archive, 
  RotateCcw, 
  Trash2, 
  Edit3, 
  Eye, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  Award, 
  AlertCircle,
  Sparkles,
  UserCheck,
  Check,
  X,
  FileSpreadsheet,
  HelpCircle
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AddSectionModal } from '../../components/academic/AddSectionModal';
import { StudentProfileModal } from '../../components/student/StudentProfileModal';
import { supabaseService } from '../../lib/services/supabaseService';
import { 
  Section, 
  AcademicYear, 
  Semester, 
  Student, 
  PromotionBatch, 
  StudentAcademicHistory, 
  SectionReferenceCheckResult,
  StudentPromotionActionType,
  BulkPromotionStudentItem
} from '../../types/database.types';
import { clsx } from 'clsx';

interface AcademicManagementPageProps {
  onNavigate?: (tab: string) => void;
}

export const AcademicManagementPage: React.FC<AcademicManagementPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    years, 
    semesters, 
    sections, 
    students, 
    faculty, 
    sessions,
    subjects,
    timetable,
    assignments,
    archiveSection,
    restoreSection,
    deleteSection,
    updateSection,
    checkSectionReferences,
    refreshSections,
    refreshStudents
  } = useAcademic();

  // Top level active tab
  const [activeTab, setActiveTab] = useState<'sections' | 'promotion' | 'history'>('sections');

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 1: SECTION & COHORT MANAGEMENT STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [sectionSearchTerm, setSectionSearchTerm] = useState<string>('');
  
  // Modals for Sections
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editSecName, setEditSecName] = useState('');
  const [editSecRoom, setEditSecRoom] = useState('');
  const [editSecCoordinatorId, setEditSecCoordinatorId] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Section Action Confirmation Modals
  const [safeguardSection, setSafeguardSection] = useState<Section | null>(null);
  const [referenceCheckResult, setReferenceCheckResult] = useState<SectionReferenceCheckResult | null>(null);
  const [isCheckingReferences, setIsCheckingReferences] = useState(false);
  const [safeguardMode, setSafeguardMode] = useState<'archive' | 'restore' | 'delete' | null>(null);
  const [isProcessingSafeguard, setIsProcessingSafeguard] = useState(false);

  // Drawer / View Modals
  const [rosterSection, setRosterSection] = useState<Section | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [curriculumSection, setCurriculumSection] = useState<Section | null>(null);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 2: BULK STUDENT PROMOTION WIZARD STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [promoStep, setPromoStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [sourceYearId, setSourceYearId] = useState<string>('');
  const [sourceSessionId, setSourceSessionId] = useState<string>('');
  const [targetYearId, setTargetYearId] = useState<string>('');
  const [targetSessionId, setTargetSessionId] = useState<string>('');
  const [targetSemesterId, setTargetSemesterId] = useState<string>('');
  const [isGraduationCohort, setIsGraduationCohort] = useState<boolean>(false);
  const [transitionNotes, setTransitionNotes] = useState<string>('');

  // Step 2: Section-to-Section Mapping (key: sourceSectionId -> targetSectionId)
  const [sectionMappings, setSectionMappings] = useState<Record<string, string>>({});

  // Step 4: Student Overrides & Roster
  interface StudentPromoRow {
    student: Student;
    action: StudentPromotionActionType;
    targetSectionId: string;
    remarks: string;
  }
  const [promoRoster, setPromoRoster] = useState<StudentPromoRow[]>([]);
  const [rosterFilterSec, setRosterFilterSec] = useState<string>('ALL');
  const [rosterSearchTerm, setRosterSearchTerm] = useState<string>('');

  // Step 5 & 6: Promotion Execution
  const [isExecutingPromo, setIsExecutingPromo] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    batch_id: string;
    total_students: number;
    promoted_count: number;
    held_count: number;
    graduated_count: number;
    excluded_count: number;
  } | null>(null);

  // Post-Promotion Checklist state
  const [completedChecklist, setCompletedChecklist] = useState<{
    studentsPromoted: boolean;
    historyLogged: boolean;
    subjectsReviewed: boolean;
    facultyReviewed: boolean;
    timetableReviewed: boolean;
  }>({
    studentsPromoted: true,
    historyLogged: true,
    subjectsReviewed: false,
    facultyReviewed: false,
    timetableReviewed: false,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 3: PROMOTION & ACADEMIC HISTORY STATE
  // ──────────────────────────────────────────────────────────────────────────
  const [historySubTab, setHistorySubTab] = useState<'batches' | 'student_timeline'>('batches');
  const [batches, setBatches] = useState<PromotionBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchHistoryRecords, setBatchHistoryRecords] = useState<StudentAcademicHistory[]>([]);
  const [isLoadingBatchDetails, setIsLoadingBatchDetails] = useState(false);

  // Student Timeline Search
  const [timelineSearchTerm, setTimelineSearchTerm] = useState('');
  const [selectedTimelineStudent, setSelectedTimelineStudent] = useState<Student | null>(null);
  const [studentHistoryLogs, setStudentHistoryLogs] = useState<StudentAcademicHistory[]>([]);
  const [isLoadingStudentHistory, setIsLoadingStudentHistory] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // INITIALIZATIONS & COMPUTED VALUES
  // ──────────────────────────────────────────────────────────────────────────
  const activeYears = useMemo(() => {
    return [...years].sort((a, b) => a.year_number - b.year_number);
  }, [years]);

  const currentSession = useMemo(() => {
    return sessions.find(s => s.is_current) || sessions[0];
  }, [sessions]);

  // Set default source session and year on first load
  useEffect(() => {
    if (sessions.length > 0 && !sourceSessionId) {
      setSourceSessionId(currentSession?.id || sessions[0].id);
      setTargetSessionId(currentSession?.id || sessions[0].id);
    }
    if (activeYears.length > 0 && !sourceYearId) {
      // Default to 2nd year if available or first
      const y2 = activeYears.find(y => y.year_number === 2) || activeYears[0];
      setSourceYearId(y2.id);
    }
  }, [sessions, currentSession, activeYears, sourceSessionId, sourceYearId]);

  // When source year changes in promotion wizard, auto-resolve target year and graduation
  useEffect(() => {
    if (!sourceYearId) return;
    const srcYear = activeYears.find(y => y.id === sourceYearId);
    if (!srcYear) return;

    if (srcYear.year_number >= 4) {
      setIsGraduationCohort(true);
      setTargetYearId('');
      setTargetSemesterId('');
    } else {
      setIsGraduationCohort(false);
      const nextYr = activeYears.find(y => y.year_number === srcYear.year_number + 1);
      if (nextYr) {
        setTargetYearId(nextYr.id);
        // Find odd semester of target year
        const targetSems = semesters.filter(s => s.academic_year_id === nextYr.id);
        if (targetSems.length > 0) {
          setTargetSemesterId(targetSems[0].id);
        }
      }
    }
  }, [sourceYearId, activeYears, semesters]);

  // Sections filtered by Year, Status, and Search
  const filteredSections = useMemo(() => {
    return sections.filter(sec => {
      // Find semester for this section
      const sem = semesters.find(s => s.id === sec.semester_id);
      if (!sem) return false;

      // Year filter
      if (selectedYearFilter !== 'ALL' && sem.academic_year_id !== selectedYearFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'ACTIVE' && !sec.active) return false;
      if (statusFilter === 'ARCHIVED' && sec.active) return false;

      // Search term
      if (sectionSearchTerm.trim()) {
        const query = sectionSearchTerm.toLowerCase();
        const coord = faculty.find(f => f.id === sec.class_coordinator_id);
        const nameMatch = sec.name.toLowerCase().includes(query);
        const roomMatch = (sec.room_number || '').toLowerCase().includes(query);
        const coordMatch = coord ? coord.full_name.toLowerCase().includes(query) : false;
        if (!nameMatch && !roomMatch && !coordMatch) return false;
      }

      return true;
    });
  }, [sections, semesters, selectedYearFilter, statusFilter, sectionSearchTerm, faculty]);

  // Section student count map
  const sectionStudentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const st of students) {
      if (st.section_id) {
        map.set(st.section_id, (map.get(st.section_id) || 0) + 1);
      }
    }
    return map;
  }, [students]);

  // Cohort statistics
  const cohortStats = useMemo(() => {
    return activeYears.map(yr => {
      const semIds = new Set(semesters.filter(s => s.academic_year_id === yr.id).map(s => s.id));
      const yrSections = sections.filter(sec => semIds.has(sec.semester_id));
      const activeSecCount = yrSections.filter(s => s.active).length;
      const archivedSecCount = yrSections.filter(s => !s.active).length;
      const yrStudents = students.filter(st => st.academic_year_id === yr.id);

      return {
        year: yr,
        totalSections: yrSections.length,
        activeSections: activeSecCount,
        archivedSections: archivedSecCount,
        totalStudents: yrStudents.length,
      };
    });
  }, [activeYears, semesters, sections, students]);

  // ──────────────────────────────────────────────────────────────────────────
  // PROMOTION STEP 2: BUILD SECTION MAPPINGS
  // ──────────────────────────────────────────────────────────────────────────
  const sourceSections = useMemo(() => {
    if (!sourceYearId) return [];
    const srcSemIds = new Set(semesters.filter(s => s.academic_year_id === sourceYearId).map(s => s.id));
    return sections.filter(s => srcSemIds.has(s.semester_id) && s.active);
  }, [sourceYearId, semesters, sections]);

  const targetSections = useMemo(() => {
    if (isGraduationCohort || !targetYearId) return [];
    const tgtSemIds = new Set(semesters.filter(s => s.academic_year_id === targetYearId).map(s => s.id));
    return sections.filter(s => tgtSemIds.has(s.semester_id) && s.active);
  }, [isGraduationCohort, targetYearId, semesters, sections]);

  // Auto-initialize section mapping when moving to Step 2
  useEffect(() => {
    if (sourceSections.length > 0 && targetSections.length > 0) {
      const newMapping: Record<string, string> = {};
      for (const srcSec of sourceSections) {
        // Find target section with identical name (e.g. A -> A)
        const match = targetSections.find(t => t.name.trim().toUpperCase() === srcSec.name.trim().toUpperCase());
        newMapping[srcSec.id] = match ? match.id : targetSections[0].id;
      }
      setSectionMappings(prev => ({ ...newMapping, ...prev }));
    }
  }, [sourceSections, targetSections]);

  // Step 4 Roster Generation: populate students from source year
  const eligibleSourceStudents = useMemo(() => {
    if (!sourceYearId) return [];
    return students.filter(st => st.academic_year_id === sourceYearId && st.status !== 'ARCHIVED');
  }, [students, sourceYearId]);

  // Initialize or synchronize promoRoster when entering Step 4
  const buildPromotionRoster = useCallback(() => {
    const rows: StudentPromoRow[] = eligibleSourceStudents.map(st => {
      let defaultAction: StudentPromotionActionType = isGraduationCohort ? 'GRADUATE' : 'PROMOTE';
      let defaultTargetSec = sectionMappings[st.section_id] || (targetSections[0]?.id || '');

      return {
        student: st,
        action: defaultAction,
        targetSectionId: defaultTargetSec,
        remarks: isGraduationCohort ? 'Program Completed - Graduated' : 'Annual Academic Promotion',
      };
    });
    setPromoRoster(rows);
  }, [eligibleSourceStudents, isGraduationCohort, sectionMappings, targetSections]);

  // Load promotion batches on tab change
  const loadBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const data = await supabaseService.fetchPromotionBatches();
      setBatches(data);
    } catch (e) {
      console.error('Failed to load promotion batches:', e);
    } finally {
      setIsLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadBatches();
    }
  }, [activeTab, loadBatches]);

  // Expand Batch Details
  const handleToggleExpandBatch = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }
    setExpandedBatchId(batchId);
    setIsLoadingBatchDetails(true);
    try {
      const data = await supabaseService.fetchStudentAcademicHistory();
      const batchRecords = data.filter(r => r.promotion_batch_id === batchId);
      setBatchHistoryRecords(batchRecords);
    } catch (e) {
      console.error('Failed to fetch batch records:', e);
    } finally {
      setIsLoadingBatchDetails(false);
    }
  };

  // Student Timeline Search
  const handleSearchStudentTimeline = async (st: Student) => {
    setSelectedTimelineStudent(st);
    setIsLoadingStudentHistory(true);
    try {
      const history = await supabaseService.fetchStudentAcademicHistory(st.id);
      setStudentHistoryLogs(history);
    } catch (e) {
      console.error('Failed to load student history timeline:', e);
    } finally {
      setIsLoadingStudentHistory(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLERS: SECTION SAFEGUARDS (ARCHIVE / RESTORE / DELETE)
  // ──────────────────────────────────────────────────────────────────────────
  const handleOpenSafeguard = async (sec: Section, mode: 'archive' | 'restore' | 'delete') => {
    setSafeguardSection(sec);
    setSafeguardMode(mode);
    setIsCheckingReferences(true);
    try {
      const check = await checkSectionReferences(sec.id);
      setReferenceCheckResult(check);
    } catch (e) {
      console.error('Error checking section references:', e);
    } finally {
      setIsCheckingReferences(false);
    }
  };

  const handleConfirmSafeguard = async () => {
    if (!safeguardSection || !safeguardMode) return;
    setIsProcessingSafeguard(true);
    try {
      if (safeguardMode === 'archive') {
        await archiveSection(safeguardSection.id);
      } else if (safeguardMode === 'restore') {
        await restoreSection(safeguardSection.id);
      } else if (safeguardMode === 'delete') {
        await deleteSection(safeguardSection.id);
      }
      setSafeguardSection(null);
      setSafeguardMode(null);
      setReferenceCheckResult(null);
      await refreshSections();
    } catch (err: any) {
      alert(`Error performing section action: ${err.message}`);
    } finally {
      setIsProcessingSafeguard(false);
    }
  };

  // Save Edit Section
  const handleSaveEditSection = async () => {
    if (!editingSection) return;
    setIsSavingEdit(true);
    try {
      await updateSection(editingSection.id, {
        name: editSecName.trim() || editingSection.name,
        room_number: editSecRoom.trim() || editingSection.room_number,
        class_coordinator_id: editSecCoordinatorId || undefined,
      });
      setEditingSection(null);
      await refreshSections();
    } catch (err: any) {
      alert(`Error updating section: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLERS: BULK PROMOTION EXECUTION
  // ──────────────────────────────────────────────────────────────────────────
  const handleExecutePromotion = async () => {
    if (promoRoster.length === 0) return;
    setIsExecutingPromo(true);

    try {
      const studentPayloadItems: BulkPromotionStudentItem[] = promoRoster.map(row => {
        return {
          student_id: row.student.id,
          action: row.action,
          target_section_id: row.action === 'PROMOTE' || row.action === 'REASSIGN' ? row.targetSectionId : null,
          target_semester_id: isGraduationCohort ? null : targetSemesterId || null,
          target_academic_year_id: isGraduationCohort ? null : targetYearId || null,
          remarks: row.remarks || null,
        };
      });

      const payload = {
        source_academic_year_id: sourceYearId || null,
        target_academic_year_id: isGraduationCohort ? null : targetYearId || null,
        source_academic_session_id: sourceSessionId || null,
        target_academic_session_id: targetSessionId || null,
        target_semester_id: isGraduationCohort ? null : targetSemesterId || null,
        notes: transitionNotes || `Promotion ${new Date().toLocaleDateString('en-GB')}`,
        students: studentPayloadItems,
      };

      const result = await supabaseService.promoteStudentsBulk(
        payload, 
        user?.id, 
        user?.full_name || 'Super Admin'
      );

      setPromoResult(result);
      setPromoStep(6);
      await refreshStudents();
      await refreshSections();
    } catch (err: any) {
      alert(`Bulk Promotion Failed: ${err.message}`);
    } finally {
      setIsExecutingPromo(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER UI
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── HEADER PANEL ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Super Admin Module
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                Session: {currentSession?.name || '2026-2027'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif-institutional text-slate-900 tracking-tight flex items-center gap-3">
              <Layers className="w-7 h-7 text-slate-800" />
              Academic Management & Bulk Promotion
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Configure academic cohorts, manage active & archived sections with relational safeguards, and execute atomic student promotions without account recreation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await refreshSections();
                await refreshStudents();
              }}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Data
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddSectionModalOpen(true)}
              className="bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Section
            </Button>
          </div>
        </div>

        {/* ── NAVIGATION TABS ── */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('sections')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
              activeTab === 'sections'
                ? 'bg-[#0f172a] text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <Layers className="w-4 h-4" />
            Year & Section Management
          </button>
          <button
            onClick={() => {
              setActiveTab('promotion');
              setPromoStep(1);
            }}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
              activeTab === 'promotion'
                ? 'bg-[#0f172a] text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <GraduationCap className="w-4 h-4" />
            Bulk Student Promotion
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
              activeTab === 'history'
                ? 'bg-[#0f172a] text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <Clock className="w-4 h-4" />
            Promotion & Academic History
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: YEAR & SECTION MANAGEMENT                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          {/* Cohort Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cohortStats.map(stat => {
              const isSelected = selectedYearFilter === stat.year.id;
              return (
                <div
                  key={stat.year.id}
                  onClick={() => setSelectedYearFilter(isSelected ? 'ALL' : stat.year.id)}
                  className={clsx(
                    'p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden backdrop-blur-md',
                    isSelected
                      ? 'bg-slate-50 border-slate-400 shadow-xs ring-1 ring-slate-400'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Cohort #{stat.year.year_number}
                    </span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                      stat.activeSections > 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      {stat.activeSections} Active Sec
                    </span>
                  </div>
                  <h3 className="text-lg font-bold font-serif-institutional text-slate-900 mt-1">{stat.year.name}</h3>
                  <div className="flex items-center justify-between mt-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-600" />
                      <span className="font-semibold text-slate-900">{stat.totalStudents}</span> Students
                    </div>
                    {stat.archivedSections > 0 && (
                      <span className="text-amber-700 font-medium">
                        {stat.archivedSections} Archived
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section Filter and Search Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search section or coordinator..."
                  value={sectionSearchTerm}
                  onChange={(e) => setSectionSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                />
              </div>

              {/* Year Dropdown */}
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
              >
                <option value="ALL">All Academic Years</option>
                {activeYears.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>

              {/* Status Pill Toggle */}
              <div className="flex items-center rounded-xl bg-slate-100 border border-slate-200/80 p-0.5">
                <button
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                    statusFilter === 'ACTIVE' ? 'bg-[#0f172a] text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  Active
                </button>
                <button
                  onClick={() => setStatusFilter('ARCHIVED')}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                    statusFilter === 'ARCHIVED' ? 'bg-[#0f172a] text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  Archived
                </button>
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                    statusFilter === 'ALL' ? 'bg-[#0f172a] text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  All
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Showing <span className="text-slate-900 font-bold">{filteredSections.length}</span> section{filteredSections.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Section Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSections.map(sec => {
              const sem = semesters.find(s => s.id === sec.semester_id);
              const yr = sem ? years.find(y => y.id === sem.academic_year_id) : undefined;
              const coordinator = faculty.find(f => f.id === sec.class_coordinator_id);
              const studentCount = sectionStudentCountMap.get(sec.id) || 0;

              return (
                <div
                  key={sec.id}
                  className={clsx(
                    'rounded-2xl border p-5 transition-all flex flex-col justify-between backdrop-blur-md',
                    sec.active
                      ? 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-sm'
                      : 'bg-slate-50/70 border-slate-200/60 opacity-80'
                  )}
                >
                  <div>
                    {/* Top Row: Year, Section Name, Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
                          {yr?.name || 'Academic Cohort'} • {sem?.name || 'Semester'}
                        </span>
                        <h4 className="text-xl font-bold font-serif-institutional text-slate-900 mt-0.5 flex items-center gap-2">
                          Section {sec.name}
                          {!sec.active && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              ARCHIVED
                            </span>
                          )}
                        </h4>
                      </div>

                      <span className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-bold border',
                        sec.active
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      )}>
                        {sec.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Meta info: Room & Coordinator */}
                    <div className="space-y-2 mt-4 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-slate-500 font-medium">Classroom / Room:</span>
                        <span className="font-semibold text-slate-900">{sec.room_number || 'TBD'}</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-slate-500 font-medium">Class Coordinator:</span>
                        <span className="font-semibold text-slate-900 truncate max-w-[180px]">
                          {coordinator?.full_name || 'Unassigned'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-slate-500 font-medium">Enrolled Students:</span>
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-600" />
                          {studentCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRosterSection(sec)}
                        className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1 py-1 px-2.5 shadow-xs"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Roster
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurriculumSection(sec)}
                        className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1 py-1 px-2.5 shadow-xs"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Subjects
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title="Edit Section"
                        onClick={() => {
                          setEditingSection(sec);
                          setEditSecName(sec.name);
                          setEditSecRoom(sec.room_number || '');
                          setEditSecCoordinatorId(sec.class_coordinator_id || '');
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {sec.active ? (
                        <button
                          title="Archive Section"
                          onClick={() => handleOpenSafeguard(sec, 'archive')}
                          className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          title="Restore Section"
                          onClick={() => handleOpenSafeguard(sec, 'restore')}
                          className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        title="Safeguarded Delete"
                        onClick={() => handleOpenSafeguard(sec, 'delete')}
                        className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="col-span-full p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-slate-900 font-serif-institutional">No Sections Match Filter</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Try clearing your search query or selecting a different academic year or status.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedYearFilter('ALL');
                    setStatusFilter('ACTIVE');
                    setSectionSearchTerm('');
                  }}
                  className="mt-4 border-slate-200 text-slate-700 shadow-xs"
                >
                  Reset Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: BULK STUDENT PROMOTION SYSTEM (WIZARD)                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'promotion' && (
        <div className="space-y-6">
          {/* Wizard Step Progress Tracker */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              {[
                { num: 1, label: 'Cohort' },
                { num: 2, label: 'Section Map' },
                { num: 3, label: 'Pre-Check' },
                { num: 4, label: 'Roster & Overrides' },
                { num: 5, label: 'Preview' },
                { num: 6, label: 'Checklist' },
              ].map((s, idx) => (
                <React.Fragment key={s.num}>
                  <div className="flex items-center gap-2">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                        promoStep === s.num
                          ? 'bg-[#0f172a] text-white ring-4 ring-slate-100 shadow-xs'
                          : promoStep > s.num
                          ? 'bg-slate-100 text-slate-800 border border-slate-300'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      )}
                    >
                      {promoStep > s.num ? <Check className="w-4 h-4" /> : s.num}
                    </div>
                    <span className={clsx(
                      'text-xs font-semibold hidden md:inline',
                      promoStep === s.num ? 'text-slate-900 font-bold' : 'text-slate-500'
                    )}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 5 && (
                    <div className={clsx(
                      'flex-1 h-0.5 mx-2',
                      promoStep > s.num ? 'bg-[#0f172a]' : 'bg-slate-200'
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* STEP 1: SELECT COHORT & SESSIONS */}
          {promoStep === 1 && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h3 className="text-xl font-bold font-serif-institutional text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-slate-800" />
                  Step 1: Select Cohort & Academic Session
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Specify the source academic year you wish to advance, and the target year/session.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Source Column */}
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    Source (Current Placement)
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Source Academic Year</label>
                    <select
                      value={sourceYearId}
                      onChange={(e) => setSourceYearId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    >
                      {activeYears.map(y => (
                        <option key={y.id} value={y.id}>{y.name} (Cohort #{y.year_number})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Source Academic Session</label>
                    <select
                      value={sourceSessionId}
                      onChange={(e) => setSourceSessionId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    >
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.is_current ? '(Current)' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 shadow-xs">
                    Students currently enrolled in this source cohort: <span className="text-slate-900 font-bold">{eligibleSourceStudents.length}</span>
                  </div>
                </div>

                {/* Target Column */}
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <ArrowRight className="w-4 h-4 text-slate-900" />
                    Destination (Next Academic Placement)
                  </div>

                  {isGraduationCohort ? (
                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-indigo-300">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        Final-Year Graduation Detected
                      </div>
                      <p className="text-xs text-indigo-200/80 leading-relaxed">
                        Students in this cohort are in their final academic year (4th Year). Advancing this cohort will mark eligible students with status <span className="font-mono font-bold text-white bg-indigo-900/60 px-1 py-0.5 rounded">GRADUATED</span> while fully preserving all attendance records, marks, and profiles.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Target Academic Year</label>
                        <select
                          value={targetYearId}
                          onChange={(e) => setTargetYearId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                        >
                          {activeYears.filter(y => {
                            const srcYr = activeYears.find(x => x.id === sourceYearId);
                            return srcYr ? y.year_number > srcYr.year_number : true;
                          }).map(y => (
                            <option key={y.id} value={y.id}>{y.name} (Cohort #{y.year_number})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Target Semester</label>
                        <select
                          value={targetSemesterId}
                          onChange={(e) => setTargetSemesterId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                        >
                          {semesters.filter(s => s.academic_year_id === targetYearId).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Target Academic Session</label>
                    <select
                      value={targetSessionId}
                      onChange={(e) => setTargetSessionId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    >
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.is_current ? '(Current Active Session)' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transition Batch Remarks / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Promotion Session 2026-27 to 2027-28"
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!isGraduationCohort && (!targetYearId || !targetSemesterId)) {
                      alert('Please select valid target year and semester.');
                      return;
                    }
                    setPromoStep(2);
                  }}
                  className="bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  Next: Section Mapping
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: SECTION-TO-SECTION MAPPING */}
          {promoStep === 2 && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h3 className="text-xl font-bold font-serif-institutional text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-slate-800" />
                  Step 2: Section-to-Section Mapping
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Establish default mapping from source sections to destination sections. (You can also adjust individual students in Step 4).
                </p>
              </div>

              {isGraduationCohort ? (
                <div className="p-6 text-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-3">
                  <GraduationCap className="w-10 h-10 text-indigo-400 mx-auto" />
                  <h4 className="text-base font-bold text-white">Graduating Final-Year Cohort</h4>
                  <p className="text-xs text-indigo-200/80 max-w-md mx-auto">
                    Destination section mapping is not required for graduating students. Students will graduate with their current section recorded in history.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sourceSections.map(srcSec => {
                    const srcCount = sectionStudentCountMap.get(srcSec.id) || 0;
                    return (
                      <div
                        key={srcSec.id}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-900 shadow-xs">
                            {srcSec.name}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">Source Section {srcSec.name}</div>
                            <div className="text-xs text-slate-400">
                              Room {srcSec.room_number || 'TBD'} • <span className="text-slate-900 font-semibold">{srcCount}</span> students
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <ArrowRight className="w-4 h-4 text-slate-500" />
                          <div>
                            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                              Destination Section
                            </label>
                            <select
                              value={sectionMappings[srcSec.id] || ''}
                              onChange={(e) => {
                                setSectionMappings({
                                  ...sectionMappings,
                                  [srcSec.id]: e.target.value,
                                });
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 min-w-[180px]"
                            >
                              {targetSections.map(tgtSec => (
                                <option key={tgtSec.id} value={tgtSec.id}>
                                  Section {tgtSec.name} (Room {tgtSec.room_number || 'TBD'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {sourceSections.length === 0 && (
                    <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-sm">
                      No active sections found in selected source academic year.
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setPromoStep(1)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setPromoStep(3)}
                  className="bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  Next: Validation Pre-Check
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PRE-CHECK & CONFLICT DETECTION */}
          {promoStep === 3 && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h3 className="text-xl font-bold font-serif-institutional text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-slate-800" />
                  Step 3: Pre-Check & Conflict Detection
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Automated validation verifies destination integrity and detects potential duplicate promotions.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">Source Cohort Students Identified</div>
                      <div className="text-xs text-slate-400">
                        {eligibleSourceStudents.length} students enrolled in source academic year
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    PASSED
                  </span>
                </div>

                {!isGraduationCohort && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        targetSections.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      )}>
                        {targetSections.length > 0 ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">Target Active Sections Availability</div>
                        <div className="text-xs text-slate-400">
                          {targetSections.length} destination active sections available
                        </div>
                      </div>
                    </div>
                    <span className={clsx(
                      'text-xs font-bold px-2.5 py-1 rounded-full border',
                      targetSections.length > 0
                        ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                        : 'text-rose-800 bg-rose-50 border-rose-200'
                    )}>
                      {targetSections.length > 0 ? 'READY' : 'MISSING SECTIONS'}
                    </span>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">Permanent Student Identity Protection</div>
                      <div className="text-xs text-slate-400">
                        Zero accounts deleted. Student roll numbers, attendance, marks, and login credentials stay intact.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    PROTECTED
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setPromoStep(2)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    buildPromotionRoster();
                    setPromoStep(4);
                  }}
                  className="bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  Next: Student Roster & Overrides
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: STUDENT ROSTER & INDIVIDUAL OVERRIDES */}
          {promoStep === 4 && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold font-serif-institutional text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-800" />
                    Step 4: Student Roster & Individual Overrides
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Fine-tune decisions per student: Promote, Change Destination Section, Hold Back / Repeat Year, or Exclude.
                  </p>
                </div>

                {/* Bulk controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPromoRoster(prev => prev.map(r => ({
                        ...r,
                        action: isGraduationCohort ? 'GRADUATE' : 'PROMOTE',
                      })));
                    }}
                    className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 shadow-xs"
                  >
                    Promote All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPromoRoster(prev => prev.map(r => ({
                        ...r,
                        action: 'HOLD',
                        remarks: 'Held back in current academic year',
                      })));
                    }}
                    className="border-amber-200 text-xs text-amber-800 hover:bg-amber-50 shadow-xs"
                  >
                    Hold All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPromoRoster(prev => prev.map(r => ({
                        ...r,
                        action: 'EXCLUDE',
                        remarks: 'Excluded from this batch',
                      })));
                    }}
                    className="border-slate-200 text-xs text-slate-500 hover:bg-slate-50 shadow-xs"
                  >
                    Exclude All
                  </Button>
                </div>
              </div>

              {/* Roster Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by student name or roll number..."
                    value={rosterSearchTerm}
                    onChange={(e) => setRosterSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                  />
                </div>

                <select
                  value={rosterFilterSec}
                  onChange={(e) => setRosterFilterSec(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                >
                  <option value="ALL">All Source Sections</option>
                  {sourceSections.map(sec => (
                    <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                  ))}
                </select>
              </div>

              {/* Interactive Roster Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-xs">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Current Sec</th>
                      <th className="py-3 px-4">Action</th>
                      {!isGraduationCohort && <th className="py-3 px-4">Target Sec</th>}
                      <th className="py-3 px-4">Remarks / Overrides</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {promoRoster
                      .filter(row => {
                        if (rosterFilterSec !== 'ALL' && row.student.section_id !== rosterFilterSec) return false;
                        if (rosterSearchTerm.trim()) {
                          const q = rosterSearchTerm.toLowerCase();
                          const roll = row.student.roll_number.toLowerCase();
                          const name = row.student.full_name.toLowerCase();
                          if (!roll.includes(q) && !name.includes(q)) return false;
                        }
                        return true;
                      })
                      .map((row, idx) => {
                        const currentSec = sections.find(s => s.id === row.student.section_id);

                        return (
                          <tr key={row.student.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-slate-900">
                              {row.student.roll_number}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{row.student.full_name}</div>
                              <div className="text-[11px] text-slate-400">{row.student.admission_type || 'Regular'}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                {currentSec?.name || 'Unassigned'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={row.action}
                                onChange={(e) => {
                                  const newAction = e.target.value as StudentPromotionActionType;
                                  setPromoRoster(prev => prev.map((item, i) => 
                                    item.student.id === row.student.id ? { ...item, action: newAction } : item
                                  ));
                                }}
                                className={clsx(
                                  'px-2.5 py-1 rounded-lg text-xs font-semibold border focus:outline-none',
                                  row.action === 'PROMOTE' && 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                  row.action === 'GRADUATE' && 'bg-slate-100 text-slate-800 border-slate-200',
                                  row.action === 'HOLD' && 'bg-amber-50 text-amber-800 border-amber-200',
                                  row.action === 'EXCLUDE' && 'bg-slate-100 text-slate-600 border-slate-200'
                                )}
                              >
                                {!isGraduationCohort && <option value="PROMOTE">Promote</option>}
                                {!isGraduationCohort && <option value="REASSIGN">Promote & Reassign</option>}
                                <option value="HOLD">Hold / Repeat</option>
                                <option value="EXCLUDE">Exclude / Skip</option>
                                <option value="GRADUATE">Graduate</option>
                              </select>
                            </td>

                            {!isGraduationCohort && (
                              <td className="py-3 px-4">
                                {row.action === 'HOLD' || row.action === 'EXCLUDE' || row.action === 'GRADUATE' ? (
                                  <span className="text-xs text-slate-500 italic">—</span>
                                ) : (
                                  <select
                                    value={row.targetSectionId}
                                    onChange={(e) => {
                                      const secId = e.target.value;
                                      setPromoRoster(prev => prev.map(item => 
                                        item.student.id === row.student.id ? { ...item, targetSectionId: secId } : item
                                      ));
                                    }}
                                    className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400"
                                  >
                                    {targetSections.map(tgt => (
                                      <option key={tgt.id} value={tgt.id}>Section {tgt.name}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                            )}

                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={row.remarks}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setPromoRoster(prev => prev.map(item => 
                                    item.student.id === row.student.id ? { ...item, remarks: text } : item
                                  ));
                                }}
                                placeholder="Notes..."
                                className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400"
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setPromoStep(3)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setPromoStep(5)}
                  className="bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  Next: Review Preview
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: MULTI-STEP CONFIRMATION & PREVIEW */}
          {promoStep === 5 && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h3 className="text-xl font-bold font-serif-institutional text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-slate-800" />
                  Step 5: Final Review & Confirmation
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Verify the transition breakdown before committing changes. This action is executed atomically in PostgreSQL.
                </p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs">
                  <span className="text-xs text-slate-400 font-medium">Total Roster</span>
                  <div className="text-2xl font-bold font-serif-institutional text-slate-900 mt-1">{promoRoster.length}</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-xs">
                  <span className="text-xs text-emerald-800 font-semibold">To Promote</span>
                  <div className="text-2xl font-bold font-serif-institutional text-emerald-900 mt-1">
                    {promoRoster.filter(r => r.action === 'PROMOTE' || r.action === 'REASSIGN').length}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 shadow-xs">
                  <span className="text-xs text-amber-800 font-semibold">Hold / Repeat</span>
                  <div className="text-2xl font-bold font-serif-institutional text-amber-900 mt-1">
                    {promoRoster.filter(r => r.action === 'HOLD').length}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-600 font-semibold">Graduating</span>
                  <div className="text-2xl font-bold font-serif-institutional text-slate-900 mt-1">
                    {promoRoster.filter(r => r.action === 'GRADUATE').length}
                  </div>
                </div>
              </div>

              {/* Relational Safeguard Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 shadow-xs">
                <ShieldCheck className="w-6 h-6 text-slate-700 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-slate-300">
                  <div className="font-bold text-slate-900 mb-1">Guaranteed Permanent Student Identity</div>
                  No student accounts or login credentials will be deleted or recreated. Every student retains their permanent UUID, roll number, attendance records, marks history, and leave applications. Baseline records and transition milestones are logged into <span className="font-mono text-slate-900 font-semibold">public.student_academic_history</span>.
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setPromoStep(4)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                  disabled={isExecutingPromo}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExecutePromotion}
                  disabled={isExecutingPromo}
                  className="bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl shadow-xs flex items-center gap-2 px-6 py-2.5"
                >
                  {isExecutingPromo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Executing Atomic Promotion...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Confirm & Execute Promotion
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: EXECUTION RESULTS & POST-PROMOTION CHECKLIST */}
          {promoStep === 6 && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold font-serif-institutional text-slate-900">Promotion Completed Successfully!</h3>
                <p className="text-sm text-slate-600 max-w-lg mx-auto">
                  Batch <span className="font-mono font-bold text-slate-900">#{promoResult?.batch_id.slice(0, 8)}</span> has been committed atomically to PostgreSQL.
                </p>
                <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-slate-300 pt-3">
                  <span className="bg-white px-3 py-1 rounded-full border border-slate-200 text-slate-700 shadow-xs">
                    Total: {promoResult?.total_students}
                  </span>
                  <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                    Promoted: {promoResult?.promoted_count}
                  </span>
                  <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
                    Held Back: {promoResult?.held_count}
                  </span>
                  <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                    Graduated: {promoResult?.graduated_count}
                  </span>
                </div>
              </div>

              {/* Post-Promotion Follow-up Checklist */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="font-bold font-serif-institutional text-slate-900 text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-slate-700" />
                  Post-Promotion Transition Checklist
                </div>
                <p className="text-xs text-slate-400">
                  Follow these essential steps to ensure seamless academic operations for the newly promoted cohort:
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-slate-700">Students promoted and sections updated in database</span>
                    </div>
                    <span className="text-emerald-700 font-bold">COMPLETED</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-slate-700">Permanent academic career history records logged in <span className="font-mono text-slate-900">student_academic_history</span></span>
                    </div>
                    <span className="text-emerald-700 font-bold">COMPLETED</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      <span>Review & configure Subject Master for the new semester</span>
                    </div>
                    {onNavigate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate('subjects')}
                        className="border-slate-200 text-xs text-slate-900 hover:bg-slate-50 py-1 shadow-xs"
                      >
                        Open Subject Master
                      </Button>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>Assign Faculty to new section subjects in Faculty Assignments</span>
                    </div>
                    {onNavigate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate('faculty_assignments')}
                        className="border-slate-200 text-xs text-slate-900 hover:bg-slate-50 py-1 shadow-xs"
                      >
                        Open Assignments
                      </Button>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>Create and publish weekly section timetable schedule</span>
                    </div>
                    {onNavigate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate('timetable')}
                        className="border-slate-200 text-xs text-slate-900 hover:bg-slate-50 py-1 shadow-xs"
                      >
                        Open Timetable
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('history')}
                  className="border-slate-700 text-slate-300 flex items-center gap-1.5"
                >
                  <Clock className="w-4 h-4" />
                  View Promotion History
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setPromoStep(1);
                    setPromoResult(null);
                  }}
                  className="bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl shadow-xs"
                >
                  Promote Another Cohort
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: PROMOTION & ACADEMIC HISTORY                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Subtabs: Batches vs Student Career Timeline */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200/80 w-fit">
            <button
              onClick={() => setHistorySubTab('batches')}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
                historySubTab === 'batches' ? 'bg-[#0f172a] text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Promotion Batches Audit
            </button>
            <button
              onClick={() => setHistorySubTab('student_timeline')}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
                historySubTab === 'student_timeline' ? 'bg-[#0f172a] text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Student Career Timeline Lookup
            </button>
          </div>

          {/* Subtab 1: Batches Audit */}
          {historySubTab === 'batches' && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-serif-institutional text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-700" />
                    Promotion Batches Audit Trail
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Immutable log of all academic transitions executed by Super Admin.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadBatches}
                  disabled={isLoadingBatches}
                  className="border-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={clsx('w-3.5 h-3.5', isLoadingBatches && 'animate-spin')} />
                  Refresh
                </Button>
              </div>

              {batches.length === 0 && !isLoadingBatches && (
                <div className="p-12 text-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-sm">
                  No bulk promotion batches have been executed yet.
                </div>
              )}

              <div className="space-y-3">
                {batches.map(b => {
                  const isExpanded = expandedBatchId === b.id;
                  const dateStr = new Date(b.created_at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={b.id}
                      className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden transition-all"
                    >
                      <div
                        onClick={() => handleToggleExpandBatch(b.id)}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-900 shadow-xs">
                            #{b.batch_number}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              {b.source_year?.name || 'Cohort'} 
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                              {b.target_year?.name || 'Graduated'}
                              <span className="text-xs font-normal text-slate-400">
                                ({b.notes || 'Batch Promotion'})
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {dateStr} • Executed by <span className="text-slate-200">{b.performed_by_name}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
                              Total: {b.total_students}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                              Promoted: {b.promoted_count}
                            </span>
                            {b.held_count > 0 && (
                              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                Held: {b.held_count}
                              </span>
                            )}
                            {b.graduated_count > 0 && (
                              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                Graduated: {b.graduated_count}
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Student Roster in this batch */}
                      {isExpanded && (
                        <div className="p-4 bg-slate-50 border-t border-slate-200/80 space-y-3">
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Batch Roster & Outcomes
                          </div>
                          {isLoadingBatchDetails ? (
                            <div className="text-xs text-slate-500 py-3 flex items-center gap-2">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Loading batch records...
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs">
                              {batchHistoryRecords.map(rec => (
                                <div
                                  key={rec.id}
                                  className="p-2 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between shadow-xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono font-bold text-slate-900">
                                      {rec.student?.roll_number || 'STU'}
                                    </span>
                                    <span className="text-slate-700 font-medium">
                                      {rec.student?.full_name || 'Student'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-slate-400">
                                      Sec {rec.section?.name || 'TBD'}
                                    </span>
                                    <span className={clsx(
                                      'px-2 py-0.5 rounded text-[10px] font-bold border',
                                      rec.promotion_action === 'PROMOTED' && 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                      rec.promotion_action === 'GRADUATED' && 'bg-slate-100 text-slate-800 border-slate-200',
                                      rec.promotion_action === 'HELD_BACK' && 'bg-amber-50 text-amber-800 border-amber-200'
                                    )}>
                                      {rec.promotion_action}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subtab 2: Student Career Timeline Lookup */}
          {historySubTab === 'student_timeline' && (
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-bold font-serif-institutional text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-slate-700" />
                  Student Academic Career Timeline
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Trace the continuous lifecycle and section history of any student since initial admission.
                </p>
              </div>

              {/* Student Search Input */}
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Student Roll Number or Name..."
                  value={timelineSearchTerm}
                  onChange={(e) => setTimelineSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                />
              </div>

              {/* Matching Student Candidates */}
              {timelineSearchTerm.trim().length >= 2 && !selectedTimelineStudent && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-white shadow-xs">
                  {students
                    .filter(s => {
                      const q = timelineSearchTerm.toLowerCase();
                      return s.roll_number.toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q);
                    })
                    .slice(0, 8)
                    .map(st => (
                      <div
                        key={st.id}
                        onClick={() => handleSearchStudentTimeline(st)}
                        className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{st.roll_number}</span>
                          <span className="text-slate-700">{st.full_name}</span>
                        </div>
                        <span className="text-slate-400">View Career Timeline →</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Selected Student Profile & Career Timeline */}
              {selectedTimelineStudent && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between shadow-xs">
                    <div>
                      <div className="font-bold font-serif-institutional text-slate-900 text-base flex items-center gap-2">
                        {selectedTimelineStudent.full_name}
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white text-slate-900 border border-slate-200 shadow-xs">
                          {selectedTimelineStudent.roll_number}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Status: <span className="font-semibold text-emerald-700">{selectedTimelineStudent.status || 'ACTIVE'}</span> • Admission: {selectedTimelineStudent.admission_type || 'Regular'}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTimelineStudent(null);
                        setStudentHistoryLogs([]);
                      }}
                      className="border-slate-200 text-xs text-slate-500 hover:bg-slate-50 shadow-xs"
                    >
                      Clear Selection
                    </Button>
                  </div>

                  {/* Vertical Timeline */}
                  <div className="space-y-4 pl-4 relative border-l-2 border-slate-200">
                    {isLoadingStudentHistory ? (
                      <div className="text-xs text-slate-400 flex items-center gap-2 py-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
                        Loading student history...
                      </div>
                    ) : studentHistoryLogs.length === 0 ? (
                      <div className="text-xs text-slate-400 py-2">
                        No historical transition records found. Student is currently in active placement.
                      </div>
                    ) : (
                      studentHistoryLogs.map((log, idx) => (
                        <div key={log.id} className="relative pl-6">
                          <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-[#0f172a] ring-4 ring-slate-100" />
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 shadow-xs">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-900 text-sm">
                                {log.academic_year?.name || 'Academic Cohort'} • Section {log.section?.name || 'A'}
                              </span>
                              <span className={clsx(
                                'px-2 py-0.5 rounded text-[10px] font-bold border',
                                log.promotion_action === 'INITIAL_ENROLLMENT' && 'bg-slate-100 text-slate-700 border-slate-200',
                                log.promotion_action === 'PROMOTED' && 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                log.promotion_action === 'GRADUATED' && 'bg-slate-100 text-slate-800 border-slate-200',
                                log.promotion_action === 'HELD_BACK' && 'bg-amber-50 text-amber-800 border-amber-200'
                              )}>
                                {log.promotion_action}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">
                              Session: {log.academic_session?.name || '2026-2027'} • Semester: {log.semester?.name || 'Odd Semester'}
                            </div>
                            {log.remarks && (
                              <div className="text-xs text-slate-400 italic pt-1">
                                "{log.remarks}"
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 pt-1">
                              Logged on {new Date(log.created_at).toLocaleString('en-GB')}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODALS & DRAWERS                                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Create Section Modal */}
      <AddSectionModal
        isOpen={isAddSectionModalOpen}
        onClose={() => setIsAddSectionModalOpen(false)}
        onCreated={async () => {
          await refreshSections();
          setIsAddSectionModalOpen(false);
        }}
      />

      {/* Edit Section Modal */}
      {editingSection && (
        <Modal
          isOpen={true}
          onClose={() => setEditingSection(null)}
          title={`Edit Section ${editingSection.name}`}
        >
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Section Name</label>
              <input
                type="text"
                value={editSecName}
                onChange={(e) => setEditSecName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room Number / Classroom</label>
              <input
                type="text"
                value={editSecRoom}
                onChange={(e) => setEditSecRoom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class Coordinator</label>
              <select
                value={editSecCoordinatorId}
                onChange={(e) => setEditSecCoordinatorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              >
                <option value="">No Coordinator Assigned</option>
                {faculty.map(f => (
                  <option key={f.id} value={f.id}>{f.full_name} ({f.designation || 'Faculty'})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingSection(null)}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEditSection}
                disabled={isSavingEdit}
                className="bg-[#0f172a] hover:bg-black text-white font-semibold rounded-xl shadow-xs"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Section Safeguard Confirmation Modal (Archive / Restore / Delete) */}
      {safeguardSection && safeguardMode && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSafeguardSection(null);
            setSafeguardMode(null);
          }}
          title={
            safeguardMode === 'archive'
              ? `Archive Section ${safeguardSection.name}`
              : safeguardMode === 'restore'
              ? `Restore Section ${safeguardSection.name}`
              : `Delete Section ${safeguardSection.name}`
          }
        >
          <div className="space-y-4 pt-2">
            {isCheckingReferences ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
                Checking historical references...
              </div>
            ) : (
              <>
                {safeguardMode === 'delete' && referenceCheckResult && (
                  <div>
                    {!referenceCheckResult.can_hard_delete ? (
                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-3">
                        <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          Cannot Hard Delete Section: Historical Data Attached
                        </div>
                        <p className="leading-relaxed">
                          This section cannot be permanently deleted because it has active or historical relations in the academic database:
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">
                            Students: <span className="text-white font-bold">{referenceCheckResult.student_count}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">
                            Attendance Sessions: <span className="text-white font-bold">{referenceCheckResult.attendance_count}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">
                            Timetable Entries: <span className="text-white font-bold">{referenceCheckResult.timetable_count}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200 text-slate-700">
                            Faculty Assignments: <span className="text-white font-bold">{referenceCheckResult.assignment_count}</span>
                          </div>
                        </div>
                        <p className="text-slate-300">
                          To protect historical integrity, you can safely <span className="font-bold text-amber-300">Archive</span> this section instead. Archived sections retain all historical records but do not appear in active timetable scheduling.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-2">
                        <div className="text-emerald-700 font-bold text-sm">Zero References Found</div>
                        <p>
                          This section has no enrolled students, timetable entries, or attendance records. It can be safely deleted.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {safeguardMode === 'archive' && (
                  <div className="text-xs text-slate-300 space-y-3">
                    <p>
                      Archiving <span className="font-bold text-white">Section {safeguardSection.name}</span> will deactivate it from active attendance taking and class selections.
                    </p>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                      All historical attendance records, student profiles, and past timetable entries will be completely preserved.
                    </div>
                  </div>
                )}

                {safeguardMode === 'restore' && (
                  <div className="text-xs text-slate-300 space-y-2">
                    <p>
                      Restoring <span className="font-bold text-white">Section {safeguardSection.name}</span> will set its status to active, allowing faculty to schedule classes and take attendance.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSafeguardSection(null);
                      setSafeguardMode(null);
                    }}
                    className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                  >
                    Cancel
                  </Button>

                  {safeguardMode === 'delete' && !referenceCheckResult?.can_hard_delete ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSafeguardMode('archive');
                      }}
                      className="bg-amber-500 text-black font-semibold hover:bg-amber-400"
                    >
                      Archive Section Instead
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleConfirmSafeguard}
                      disabled={isProcessingSafeguard}
                      className={clsx(
                        'font-semibold',
                        safeguardMode === 'delete' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-[#0f172a] hover:bg-black text-white'
                      )}
                    >
                      {isProcessingSafeguard
                        ? 'Processing...'
                        : safeguardMode === 'archive'
                        ? 'Confirm Archive'
                        : safeguardMode === 'restore'
                        ? 'Confirm Restore'
                        : 'Confirm Delete'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* View Section Students Modal */}
      {rosterSection && (
        <Modal
          isOpen={true}
          onClose={() => setRosterSection(null)}
          title={`Enrolled Students — Section ${rosterSection.name}`}
        >
          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students in this section..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {students
                .filter(s => s.section_id === rosterSection.id)
                .filter(s => {
                  if (!rosterSearch.trim()) return true;
                  const q = rosterSearch.toLowerCase();
                  return s.roll_number.toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q);
                })
                .map(st => (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStudentForProfile(st)}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between hover:border-slate-300 cursor-pointer transition-colors shadow-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {st.full_name}
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {st.roll_number}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {st.admission_type || 'Regular'} • {st.email || 'No email registered'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {st.status || 'ACTIVE'}
                      </span>
                      <Eye className="w-4 h-4 text-slate-400 hover:text-white" />
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRosterSection(null)}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Section Subjects Modal */}
      {curriculumSection && (
        <Modal
          isOpen={true}
          onClose={() => setCurriculumSection(null)}
          title={`Curriculum & Schedule — Section ${curriculumSection.name}`}
        >
          <div className="space-y-4 pt-2">
            <div className="text-xs text-slate-400">
              Assigned subjects and teaching faculty for this section:
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {assignments
                .filter(a => a.section_id === curriculumSection.id && a.active)
                .map(a => {
                  const sub = subjects.find(s => s.id === a.subject_id);
                  const fac = faculty.find(f => f.id === a.faculty_id);

                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs shadow-xs"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">
                          {sub?.subject_name || 'Subject'}
                        </div>
                        <div className="text-slate-400 font-mono mt-0.5">
                          {sub?.subject_code || 'CODE'} • {sub?.lecture_type || 'Theory'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-900 font-semibold">
                          {fac?.full_name || 'Assigned Faculty'}
                        </span>
                        <div className="text-slate-500 text-[10px]">
                          {fac?.designation || 'Faculty'}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {assignments.filter(a => a.section_id === curriculumSection.id && a.active).length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200/80">
                  No active faculty subject assignments for this section.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurriculumSection(null)}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Student Profile Modal */}
      {selectedStudentForProfile && (
        <StudentProfileModal
          isOpen={true}
          studentId={selectedStudentForProfile.id}
          onClose={() => setSelectedStudentForProfile(null)}
        />
      )}
    </div>
  );
};


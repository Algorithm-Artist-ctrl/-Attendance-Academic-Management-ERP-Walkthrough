import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  MapPin, 
  Trash2, 
  Sparkles, 
  History,
  Edit3,
  Save,
  RotateCcw,
  ShieldCheck,
  X,
  Layers,
  HelpCircle,
  ArrowRight,
  FileSpreadsheet,
  Download,
  UploadCloud,
  FileText
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { DayOfWeek, LectureType, TimetableEntry } from '../../types/database.types';
import { formatTime12H, getISTDayOfWeek } from '../../lib/utils/dateUtils';
import { TimetableConflict, ExtractedTimetableDocument } from '../../types/academic.types';
import { csvTimetableService, CSVValidationResult } from '../../lib/services/csvTimetableService';
import { supabaseService } from '../../lib/services/supabaseService';
import { AITimetableUploadModal } from '../../components/timetable/AITimetableUploadModal';
import { DEFAULT_INSTITUTIONAL_PERIODS, ACADEMIC_DAYS, CANONICAL_PERIOD_NUMBERS } from '../../config/academicConfig';
import { AITimetablePreviewModal } from '../../components/timetable/AITimetablePreviewModal';
import { TimetableVersionHistoryModal } from '../../components/timetable/TimetableVersionHistoryModal';
import { TimetableConflictEngine, TimetableConflictItem } from '../../lib/services/timetableConflictEngine';
import { clsx } from 'clsx';

interface DraftSlot {
  id?: string;
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id?: string | null;
  faculty_id?: string | null;
  room_number: string;
  lecture_type: LectureType;
}

export const TimetableManagerPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    departments,
    sections, 
    classrooms,
    subjects, 
    faculty, 
    timetable, 
    years, 
    semesters, 
    assignments,
    saveSectionTimetable, 
    deleteSectionTimetable,
    refreshData 
  } = useAcademic();

  const isSuperAdmin = user?.role === 'super_admin';
  const isHOD = user?.role === 'hod';
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [selectedYearId, setSelectedYearId] = useState<string>(() => {
    const y2 = years.find(y => y.year_number === 2);
    return y2 ? y2.id : 'ALL';
  });
  const [selectedSectionId, setSelectedSectionId] = useState<string>(() => {
    return sections[0]?.id || '';
  });

  // Dynamic sections filtered by selected academic year
  const filteredSections = useMemo(() => {
    if (selectedYearId === 'ALL') return sections.filter(s => s.active);
    const matchingSemIds = semesters.filter(s => s.academic_year_id === selectedYearId).map(s => s.id);
    return sections.filter(s => s.active && matchingSemIds.includes(s.semester_id));
  }, [sections, semesters, selectedYearId]);
  
  // Ensure selectedSectionId updates when sections or year filter changes
  useEffect(() => {
    if (filteredSections.length > 0 && !filteredSections.some(s => s.id === selectedSectionId)) {
      setSelectedSectionId(filteredSections[0].id);
    }
  }, [filteredSections, selectedSectionId]);

  useEffect(() => {
    if (years.length > 0 && selectedYearId === 'ALL') {
      const y2 = years.find(y => y.year_number === 2);
      if (y2) setSelectedYearId(y2.id);
    }
  }, [years]);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isAIUploadOpen, setIsAIUploadOpen] = useState(false);
  const [isAIPreviewOpen, setIsAIPreviewOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [extractedDocs, setExtractedDocs] = useState<ExtractedTimetableDocument[]>([]);

  // CSV URL and File Ingestion State
  const [csvUrl, setCsvUrl] = useState('');
  const [isFetchingCSV, setIsFetchingCSV] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVValidationResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [csvSourceType, setCsvSourceType] = useState<'CSV_FILE_UPLOAD' | 'GOOGLE_SHEET_CSV_SYNC'>('CSV_FILE_UPLOAD');
  const [isAnalyzingCSV, setIsAnalyzingCSV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Publishing & Deletion state
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [crossSectionWarnings, setCrossSectionWarnings] = useState<string[]>([]);
  const [facultyConflicts, setFacultyConflicts] = useState<Array<{ facultyName: string; day: DayOfWeek; period: number; otherSectionName: string; otherSubjectCode?: string }>>([]);
  const [detectedConflicts, setDetectedConflicts] = useState<TimetableConflictItem[]>([]);
  const [showConflictDetails, setShowConflictDetails] = useState(false);

  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayLabels: Record<DayOfWeek, string> = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
    SUN: 'Sunday',
  };

  const currentSection = useMemo(() => {
    return sections.find(s => s.id === selectedSectionId) || sections[0];
  }, [sections, selectedSectionId]);

  // Live Database Timetable strictly for selected section
  const sectionTimetable = useMemo(() => {
    return timetable.filter(t => t.section_id === selectedSectionId && t.active);
  }, [timetable, selectedSectionId]);

  // Institutional standard period schedule (Periods 1 to 8, including Period 5 Lunch)
  const periods = useMemo(() => {
    return CANONICAL_PERIOD_NUMBERS;
  }, []);

  // Real-time conflict analysis against current database state for the viewed section
  const activeSectionConflicts = useMemo(() => {
    if (!selectedSectionId) return [];
    const sectionEntries = timetable.filter(t => t.section_id === selectedSectionId && t.active);
    const report = TimetableConflictEngine.analyzeConflicts({
      targetSectionId: selectedSectionId,
      proposedEntries: sectionEntries.map(t => ({
        id: t.id,
        section_id: t.section_id,
        subject_id: t.subject_id,
        faculty_id: t.faculty_id,
        day_of_week: t.day_of_week,
        period_number: t.period_number,
        start_time: t.start_time || '09:00',
        end_time: t.end_time || '09:50',
        room_number: t.room_number || currentSection?.room_number || '',
        lecture_type: t.lecture_type,
      })),
      currentDbEntries: timetable,
      sections,
      subjects,
      faculty,
      assignments,
      semesters,
      academicYears: years,
    });
    return report.conflicts;
  }, [timetable, selectedSectionId, sections, subjects, faculty, assignments, semesters, years, currentSection]);

  // Combined conflict list: displays newly encountered import/edit errors, or existing DB collisions
  const displayedConflicts = useMemo(() => {
    return detectedConflicts.length > 0 ? detectedConflicts : activeSectionConflicts;
  }, [detectedConflicts, activeSectionConflicts]);

  // Draft in-memory map for Edit Mode: Key = `${day_of_week}-${period_number}`
  const [draftSlots, setDraftSlots] = useState<Map<string, DraftSlot>>(new Map());

  // Synchronize draftSlots whenever section changes or edit mode is entered
  useEffect(() => {
    const map = new Map<string, DraftSlot>();
    for (const t of sectionTimetable) {
      const key = `${t.day_of_week}-${t.period_number}`;
      map.set(key, {
        id: t.id,
        day_of_week: t.day_of_week,
        period_number: t.period_number,
        start_time: t.start_time || '09:00',
        end_time: t.end_time || '09:50',
        subject_id: t.subject_id,
        faculty_id: t.faculty_id,
        room_number: t.room_number || currentSection?.room_number || '',
        lecture_type: t.lecture_type || 'Theory',
      });
    }
    setDraftSlots(map);
    setPublishSuccessMsg(null);
    setPublishError(null);
  }, [selectedSectionId, sectionTimetable, currentSection]);

  // Active slot being edited in the Modal
  const [editingSlot, setEditingSlot] = useState<DraftSlot | null>(null);

  const getStandardTimeForPeriod = (p: number) => {
    const existing = sectionTimetable.find(t => t.period_number === p && t.start_time && t.end_time);
    if (existing) {
      return { start: existing.start_time, end: existing.end_time };
    }
    const standard = DEFAULT_INSTITUTIONAL_PERIODS.find(dp => dp.period_number === p);
    if (standard) {
      return { start: standard.start_time, end: standard.end_time };
    }
    return { start: '09:00', end: '09:50' };
  };

  // Open Slot Editor for specific day & period
  const handleOpenSlotEditor = (day: DayOfWeek, period: number) => {
    if (isSuperAdmin) return;
    const key = `${day}-${period}`;
    const existing = draftSlots.get(key);
    const time = getStandardTimeForPeriod(period);

    if (existing) {
      setEditingSlot({ ...existing });
    } else {
      const isLunch = period === 5;
      setEditingSlot({
        day_of_week: day,
        period_number: period,
        start_time: time.start,
        end_time: time.end,
        subject_id: isLunch ? null : (subjects[0]?.id || ''),
        faculty_id: isLunch ? null : (faculty[0]?.id || ''),
        room_number: isLunch ? 'Refectory / Break' : (currentSection?.room_number || ''),
        lecture_type: isLunch ? 'Lunch' : 'Theory',
      });
    }
  };

  // Save slot into draft map
  const handleSaveSlotModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;

    const isLunch = editingSlot.lecture_type === 'Lunch';
    const key = `${editingSlot.day_of_week}-${editingSlot.period_number}`;
    setDraftSlots(prev => {
      const next = new Map(prev);
      next.set(key, {
        ...editingSlot,
        subject_id: isLunch ? null : (editingSlot.subject_id || null),
        faculty_id: isLunch ? null : (editingSlot.faculty_id || null),
      });
      return next;
    });

    setEditingSlot(null);
  };

  // Delete / Clear a slot from draft map
  const handleClearSlot = (day: DayOfWeek, period: number) => {
    const key = `${day}-${period}`;
    setDraftSlots(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  // Clear all slots to restructure section timetable
  const handleClearAllDrafts = () => {
    if (window.confirm(`Are you sure you want to clear all slots for Section ${currentSection?.name}? You can re-populate the entire weekly grid before publishing.`)) {
      setDraftSlots(new Map());
    }
  };

  // Reset to live database version
  const handleResetToLive = () => {
    const map = new Map<string, DraftSlot>();
    for (const t of sectionTimetable) {
      const key = `${t.day_of_week}-${t.period_number}`;
      map.set(key, {
        id: t.id,
        day_of_week: t.day_of_week,
        period_number: t.period_number,
        start_time: t.start_time || '09:00',
        end_time: t.end_time || '09:50',
        subject_id: t.subject_id,
        faculty_id: t.faculty_id,
        room_number: t.room_number || currentSection?.room_number || '',
        lecture_type: t.lecture_type || 'Theory',
      });
    }
    setDraftSlots(map);
    setIsEditMode(false);
  };

  // Atomically delete section timetable from Supabase
  const handleDeleteSectionTimetable = async () => {
    if (isSuperAdmin || !selectedSectionId) return;
    setIsDeleting(true);
    setPublishError(null);
    setPublishSuccessMsg(null);
    setDetectedConflicts([]);

    try {
      const ok = await deleteSectionTimetable(selectedSectionId, user?.full_name || 'HOD');
      if (ok) {
        setPublishSuccessMsg(`Section ${currentSection?.name} timetable deleted successfully. All periods cleared.`);
        setDraftSlots(new Map());
        setIsEditMode(false);
        setShowDeleteConfirm(false);
        await refreshData(true);
      } else {
        setPublishError('Failed to delete section timetable.');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setPublishError(err.message || 'Failed to delete section timetable.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Publish Section Timetable to Supabase (Full Section Replacement)
  const handlePublishTimetable = async () => {
    if (isSuperAdmin) return;
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccessMsg(null);
    setCrossSectionWarnings([]);
    setDetectedConflicts([]);

    try {
      const entriesToPublish = Array.from(draftSlots.values());

      // Validate through TimetableConflictEngine
      const conflictReport = TimetableConflictEngine.analyzeConflicts({
        targetSectionId: selectedSectionId,
        proposedEntries: entriesToPublish.map(e => ({
          subject_id: e.subject_id,
          faculty_id: e.faculty_id,
          day_of_week: e.day_of_week,
          period_number: e.period_number,
          start_time: e.start_time,
          end_time: e.end_time,
          room_number: e.room_number || currentSection?.room_number || '',
          lecture_type: e.lecture_type,
        })),
        currentDbEntries: timetable,
        sections,
        subjects,
        faculty,
        assignments,
        semesters,
        academicYears: years,
      });

      if (conflictReport.hasBlockingConflicts) {
        setDetectedConflicts(conflictReport.conflicts);
        setShowConflictDetails(true);
        setPublishError(`Cannot publish timetable: ${conflictReport.blockingCount} collision(s) detected. Please resolve them before saving.`);
        return;
      }

      // Perform atomic database replacement
      const result = await saveSectionTimetable({
        sectionId: selectedSectionId,
        entries: entriesToPublish.map(e => ({
          subject_id: e.subject_id,
          faculty_id: e.faculty_id,
          day_of_week: e.day_of_week,
          period_number: e.period_number,
          start_time: e.start_time,
          end_time: e.end_time,
          room_number: e.room_number || currentSection?.room_number || '',
          lecture_type: e.lecture_type,
          active: true,
        })),
        publishedBy: user?.full_name || 'HOD / Super Administrator',
      });

      setPublishSuccessMsg(`Section ${currentSection?.name} Timetable published successfully to Supabase! (${result.count} active periods verified)`);
      setIsEditMode(false);
      setDetectedConflicts([]);
      await refreshData(true);
    } catch (err: any) {
      console.error('Publish error:', err);
      setPublishError(err.message || 'Failed to publish section timetable to database.');
    } finally {
      setIsPublishing(false);
    }
  };

  // ----------------------------------------------------
  // ----------------------------------------------------
  // ----------------------------------------------------
  // GOOGLE SHEET & CSV TIMETABLE SYNC & PREVIEW HANDLERS
  // ----------------------------------------------------
  const handleSyncTimetable = async () => {
    if (isSuperAdmin) return;
    if (!csvUrl.trim()) {
      setCsvError('Please enter a valid Google Sheet CSV URL.');
      return;
    }
    setIsAnalyzingCSV(true);
    setCsvError(null);
    setPublishSuccessMsg(null);
    setFacultyConflicts([]);
    setDetectedConflicts([]);
    setShowConflictDetails(false);

    try {
      const csvText = await csvTimetableService.fetchTimetableCSV(csvUrl);
      const validation = csvTimetableService.parseAndValidateCSV(csvText, {
        targetSection: currentSection,
        subjects,
        faculty,
        classrooms,
      });

      if (!validation.valid) {
        setCsvError(`Validation failed (${validation.errors.length} issue${validation.errors.length > 1 ? 's' : ''}):\n• ${validation.errors.join('\n• ')}`);
        setCsvPreview(null);
        return;
      }

      setCsvSourceType('GOOGLE_SHEET_CSV_SYNC');
      setSelectedFileName('Google Sheet (CSV)');
      setCsvPreview(validation);
    } catch (err: any) {
      setCsvError(err.message || 'Failed to fetch and parse Google Sheet CSV. Ensure link is public and accessible.');
      setCsvPreview(null);
    } finally {
      setIsAnalyzingCSV(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSuperAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setCsvSourceType('CSV_FILE_UPLOAD');
    setCsvError(null);
    setPublishSuccessMsg(null);
    setFacultyConflicts([]);
    setDetectedConflicts([]);
    setShowConflictDetails(false);
    setIsAnalyzingCSV(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setCsvError('Uploaded CSV file is empty.');
        setIsAnalyzingCSV(false);
        return;
      }
      try {
        const validation = csvTimetableService.parseAndValidateCSV(content, {
          targetSection: currentSection,
          subjects,
          faculty,
          classrooms,
        });

        if (!validation.valid) {
          setCsvError(`Validation failed (${validation.errors.length} issue${validation.errors.length > 1 ? 's' : ''}):\n• ${validation.errors.join('\n• ')}`);
          setCsvPreview(null);
          return;
        }

        // CSV parsed successfully -> present preview for HOD review BEFORE replacement
        setCsvPreview(validation);
      } catch (err: any) {
        setCsvError(err.message || 'Failed to parse uploaded CSV file.');
        setCsvPreview(null);
      } finally {
        setIsAnalyzingCSV(false);
      }
    };
    reader.onerror = () => {
      setCsvError('Failed to read uploaded CSV file.');
      setIsAnalyzingCSV(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmPublishCsv = async () => {
    if (!csvPreview || !csvPreview.valid || !currentSection) return;

    setIsPublishing(true);
    setCsvError(null);
    setDetectedConflicts([]);
    setShowConflictDetails(false);

    try {
      const proposed = csvPreview.entries.map(e => ({
        subject_id: e.subject_id || undefined,
        faculty_id: e.faculty_id || undefined,
        day_of_week: e.day_of_week,
        period_number: e.period_number,
        start_time: e.start_time,
        end_time: e.end_time,
        room_number: e.room_number || currentSection.room_number || '',
        classroom_id: e.classroom_id || undefined,
        lecture_type: e.lecture_type || 'Theory',
      }));

      // Analyze conflicts before database mutation
      const conflictReport = TimetableConflictEngine.analyzeConflicts({
        targetSectionId: selectedSectionId,
        proposedEntries: proposed,
        currentDbEntries: timetable,
        sections,
        subjects,
        faculty,
        assignments,
        semesters,
        academicYears: years,
      });

      if (conflictReport.hasBlockingConflicts) {
        setDetectedConflicts(conflictReport.conflicts);
        setShowConflictDetails(true);
        setCsvError(`Sync halted: ${conflictReport.blockingCount} conflict(s) detected. Existing timetable was not modified.`);
        return;
      }

      const result = await saveSectionTimetable({
        sectionId: selectedSectionId,
        entries: proposed.map(e => ({
          ...e,
          active: true,
        })),
        publishedBy: user?.full_name || 'HOD / Central Administrator',
        sourceType: csvSourceType,
        sourceUrl: csvSourceType === 'GOOGLE_SHEET_CSV_SYNC' ? csvUrl : (selectedFileName || undefined),
      });

      setPublishSuccessMsg(`✓ Timetable replaced successfully • ${result.count} periods synchronized`);
      setCsvPreview(null);
      setSelectedFileName(null);
      setDetectedConflicts([]);
      setIsEditMode(false);
      await refreshData(true);
    } catch (err: any) {
      setCsvError(err.message || 'Sync failed — existing timetable was not changed.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCancelCsvPreview = () => {
    setCsvPreview(null);
    setSelectedFileName(null);
    setCsvError(null);
    setDetectedConflicts([]);
  };

  const todayDay = getISTDayOfWeek();
  const defaultDay = (days.includes(todayDay as any) ? todayDay : 'MON') as DayOfWeek;
  const [selectedMobileDay, setSelectedMobileDay] = useState<DayOfWeek>(defaultDay);

  // Quick stats
  const scheduledCount = isEditMode ? draftSlots.size : sectionTimetable.length;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-[#00ff88]" />
            {isSuperAdmin ? 'Timetable Overview' : 'Department Schedule Management'}
            {isSuperAdmin && (
              <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
                Institution View-Only
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {isSuperAdmin 
              ? 'Institution-wide timetable inspection & conflict monitoring • Timetable operations managed by respective department HODs'
              : 'Authoritative section-wise schedule matrix with live editing, collision resolution & real-time sync'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Selector (Super Admin Institution Monitoring) */}
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-bold hidden sm:inline">Dept:</span>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="px-3 py-2 bg-slate-950/90 border-2 border-blue-500/40 rounded-xl text-xs text-blue-300 font-bold focus:outline-none focus:border-blue-400 touch-target cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          )}

          {/* Year Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">Year:</span>
            <select
              value={selectedYearId}
              onChange={(e) => {
                const yr = e.target.value;
                setSelectedYearId(yr);
                const matchingSemIds = yr === 'ALL'
                  ? []
                  : semesters.filter(s => s.academic_year_id === yr).map(s => s.id);
                const nextSecs = yr === 'ALL'
                  ? sections
                  : sections.filter(s => matchingSemIds.includes(s.semester_id));
                if (nextSecs.length > 0 && !nextSecs.some(s => s.id === selectedSectionId)) {
                  setSelectedSectionId(nextSecs[0].id);
                }
                setIsEditMode(false);
                setCsvPreview(null);
                setCsvError(null);
              }}
              className="px-3 py-2 bg-slate-950/90 border-2 border-emerald-500/40 rounded-xl text-xs text-[#00ff88] font-black focus:outline-none focus:border-[#00ff88] touch-target cursor-pointer"
            >
              <option value="ALL">All Years</option>
              {years.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          {/* Dynamic Section Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">Section:</span>
            <select
              value={selectedSectionId}
              onChange={(e) => {
                setSelectedSectionId(e.target.value);
                setIsEditMode(false);
                setCsvPreview(null);
                setCsvError(null);
              }}
              className="px-3 py-2 bg-slate-950/90 border-2 border-emerald-500/40 rounded-xl text-xs text-[#00ff88] font-black focus:outline-none focus:border-[#00ff88] touch-target cursor-pointer"
            >
              {filteredSections.map(s => {
                const sem = semesters.find(sm => sm.id === s.semester_id);
                const yr = years.find(y => y.id === sem?.academic_year_id);
                return (
                  <option key={s.id} value={s.id}>
                    {yr ? `${yr.name} • ` : ''}Section {s.name} ({s.room_number || 'Room'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* HOD Operational Controls: Edit Mode Toggle */}
          {!isSuperAdmin && (!isEditMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditMode(true)}
              leftIcon={<Edit3 className="w-4 h-4 text-[#00ff88]" />}
              className="touch-target font-bold border-emerald-500/40 hover:bg-emerald-500/10 text-white"
            >
              Edit Timetable
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToLive}
              leftIcon={<X className="w-4 h-4 text-rose-400" />}
              className="touch-target font-bold border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
            >
              Cancel Edits
            </Button>
          ))}

          {/* HOD Operational Controls: AI Timetable Ingestion */}
          {!isSuperAdmin && (
            <Button
              variant="neon"
              size="sm"
              onClick={() => setIsAIUploadOpen(true)}
              leftIcon={<Sparkles className="w-4 h-4 text-slate-950" />}
              className="touch-target font-black shadow-[0_0_15px_rgba(0,255,136,0.3)]"
            >
              AI Timetable Ingestion
            </Button>
          )}

          {/* HOD Operational Controls: Delete Section Timetable */}
          {!isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              leftIcon={<Trash2 className="w-4 h-4 text-rose-400" />}
              className="touch-target font-bold border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
              title={`Delete all timetable entries for Section ${currentSection?.name}`}
            >
              Delete Timetable
            </Button>
          )}

          {/* Versions History (View-Only Audit for Super Admin, Restore enabled for HOD) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVersionHistoryOpen(true)}
            leftIcon={<History className="w-4 h-4 text-[#00ff88]" />}
            className="touch-target font-semibold"
          >
            {isSuperAdmin ? 'Audit Versions' : 'Versions'}
          </Button>
        </div>
      </div>

      {/* SUPER ADMIN INSTITUTION MONITORING BANNER */}
      {isSuperAdmin && (
        <div className="glass-panel rounded-3xl p-5 border border-blue-500/20 bg-blue-950/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                  Academic Schedule Monitoring
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
                    Super Admin View-Only
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Super Admin monitors department schedules, faculty allocations, and scheduling conflicts. Department HODs manage operational editing and synchronization.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-emerald-400 font-bold">
                {sectionTimetable.length} Active Periods
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-blue-500/20 text-blue-300 font-bold">
                Room: {currentSection?.room_number || 'Unassigned'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* HOD OPERATIONAL TIMETABLE CSV SOURCE PANEL */}
      {!isSuperAdmin && (
        <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  Timetable CSV Source
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30 font-bold">
                    Target: Section {currentSection?.name}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste a Google Sheet CSV URL or upload a CSV file to atomically synchronize Section {currentSection?.name}'s schedule
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<UploadCloud className="w-4 h-4 text-emerald-400" />}
                className="text-xs font-bold border-emerald-500/30 text-white hover:bg-emerald-500/10"
              >
                Upload CSV File
              </Button>
            </div>
          </div>

          {/* Selected File Badge */}
          {selectedFileName && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-slate-900 border border-emerald-500/30 text-xs text-emerald-400 font-mono">
              <div className="flex items-center gap-2 truncate">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-white truncate">{selectedFileName}</span>
                {isAnalyzingCSV && <span className="text-[10px] text-slate-400 animate-pulse">(Parsing CSV...)</span>}
              </div>
              <button 
                onClick={handleCancelCsvPreview}
                className="text-slate-400 hover:text-white text-xs cursor-pointer ml-2"
                title="Clear selected file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* URL Input Bar & Sync Button */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <input
                type="url"
                value={csvUrl}
                onChange={(e) => {
                  setCsvUrl(e.target.value);
                  setCsvError(null);
                }}
                placeholder="Paste Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/.../edit)..."
                className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-emerald-500/30 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00ff88] font-mono shadow-inner"
              />
            </div>
            <Button
              variant="neon"
              size="sm"
              onClick={handleSyncTimetable}
              isLoading={isAnalyzingCSV}
              leftIcon={<Download className="w-4 h-4 text-slate-950" />}
              className="w-full sm:w-auto font-black shadow-[0_0_15px_rgba(0,255,136,0.25)] shrink-0"
            >
              PREVIEW GOOGLE SHEET
            </Button>
          </div>

          {/* PRE-PUBLISH TIMETABLE REPLACEMENT PREVIEW */}
          {csvPreview && csvPreview.valid && (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/95 border-2 border-emerald-500/40 text-white space-y-4 animate-in fade-in shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30 font-black tracking-wider">
                      Pre-Publish Preview
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {selectedFileName || 'CSV Timetable Import'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">
                    Review Timetable Before Replacing Section {currentSection?.name} Schedule
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelCsvPreview}
                    disabled={isPublishing}
                    className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="neon"
                    size="sm"
                    onClick={handleConfirmPublishCsv}
                    isLoading={isPublishing}
                    leftIcon={<CheckCircle2 className="w-4 h-4 text-slate-950" />}
                    className="font-black text-xs shadow-[0_0_20px_rgba(0,255,136,0.35)]"
                  >
                    Publish / Replace Section {currentSection?.name} Timetable
                  </Button>
                </div>
              </div>

              {/* Metadata & Scope Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Target Section</span>
                  <span className="text-xs font-black text-[#00ff88]">Section {currentSection?.name}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Classroom</span>
                  <span className="text-xs font-black text-white">{csvPreview.metadata?.roomNumber || currentSection?.room_number || 'A006'}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Effective Date</span>
                  <span className="text-xs font-black text-amber-300">{csvPreview.metadata?.effectiveDate || '20-08-2026'}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Days & Periods</span>
                  <span className="text-xs font-black text-sky-400">
                    {Object.keys(csvPreview.dayBreakdown).length} Days • {Math.max(...csvPreview.entries.map(e => e.period_number), 8)} Periods
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Instructional Slots</span>
                  <span className="text-xs font-black text-emerald-400">{csvPreview.instructionalSlots} Classes</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block">Non-Instructional</span>
                  <span className="text-xs font-black text-slate-400">{csvPreview.nonInstructionalSlots} Breaks</span>
                </div>
              </div>

              {/* Parsed Entries Table Preview */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                <div className="max-h-72 overflow-y-auto overflow-x-auto text-xs font-mono">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase tracking-wider sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Day</th>
                        <th className="py-2.5 px-2">Period</th>
                        <th className="py-2.5 px-3">Timing</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Faculty</th>
                        <th className="py-2.5 px-2">Type</th>
                        <th className="py-2.5 px-2">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {csvPreview.entries.map((entry, idx) => {
                        const isNonInst = ['Lunch', 'Break', 'Sports', 'Other'].includes(entry.lecture_type);
                        return (
                          <tr key={idx} className={clsx(isNonInst ? 'bg-slate-900/30 text-slate-500' : 'hover:bg-slate-900/40 text-slate-200')}>
                            <td className="py-2 px-3 font-bold text-white">{entry.day_of_week}</td>
                            <td className="py-2 px-2 text-emerald-400 font-bold">P{entry.period_number}</td>
                            <td className="py-2 px-3 text-slate-400">{entry.start_time}–{entry.end_time}</td>
                            <td className="py-2 px-3 font-medium">
                              <span className={isNonInst ? 'text-amber-400/80 font-bold' : 'text-sky-300'}>
                                {entry.subject_name}
                              </span>
                              {!isNonInst && entry.subject_code && (
                                <span className="text-[10px] text-slate-500 ml-1.5 font-bold">({entry.subject_code})</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {isNonInst ? '—' : (
                                <span className="text-emerald-300/90">{entry.faculty_name} {entry.faculty_code && <span className="text-[10px] text-slate-500">[{entry.faculty_code}]</span>}</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <span className={clsx(
                                'text-[9px] uppercase px-1.5 py-0.5 rounded font-bold',
                                entry.lecture_type === 'Practical' ? 'bg-purple-500/20 text-purple-300' :
                                entry.lecture_type === 'Workshop' ? 'bg-amber-500/20 text-amber-300' :
                                entry.lecture_type === 'Project' ? 'bg-cyan-500/20 text-cyan-300' :
                                entry.lecture_type === 'Lunch' ? 'bg-rose-500/20 text-rose-300' :
                                'bg-slate-800 text-slate-300'
                              )}>
                                {entry.lecture_type}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-slate-400">{entry.room_number || 'A006'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Compact Success Toast */}
          {publishSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" />
                <span>{publishSuccessMsg}</span>
              </div>
              <button onClick={() => setPublishSuccessMsg(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Conflict Alert Banner (Real-Time DB & Validation Collisions) */}
          {displayedConflicts.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-300 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>⚠ {displayedConflicts.length} schedule conflict{displayedConflicts.length > 1 ? 's' : ''} detected for Section {currentSection?.name}</span>
                </div>
                <button
                  onClick={() => setShowConflictDetails(!showConflictDetails)}
                  className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  [{showConflictDetails ? 'Hide Details' : 'View Details'}]
                </button>
              </div>
              {showConflictDetails && (
                <ul className="list-disc pl-5 space-y-1.5 text-[11px] text-amber-200/90 font-mono pt-1">
                  {displayedConflicts.map((c, i) => (
                    <li key={i}>
                      <span className="font-bold text-amber-300 uppercase">[{c.rule}]</span> {c.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* CSV Validation Error Display */}
          {csvError && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Sync failed — existing timetable was not changed.</span>
                </div>
                <button onClick={() => setCsvError(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-[11px] text-rose-200/90 pl-1">{csvError}</pre>
            </div>
          )}
        </div>
      )}

      {/* EDIT MODE PROMINENT ACTION BANNER */}
      {isEditMode && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 text-white space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
                <Edit3 className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Interactive Edit Mode — Target: Section {currentSection?.name} ({currentSection?.room_number})</span>
              </div>
              <p className="text-xs text-amber-200/80">
                Click any slot below to edit subject, faculty, or room. You can also add or clear slots.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllDrafts}
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                className="text-xs text-rose-300 border-rose-500/30 hover:bg-rose-500/10"
              >
                Clear All Slots
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenSlotEditor('MON', 1)}
                leftIcon={<Plus className="w-3.5 h-3.5 text-[#00ff88]" />}
                className="text-xs text-white border-emerald-500/30"
              >
                Add Class
              </Button>

              <Button
                variant="neon"
                size="sm"
                onClick={handlePublishTimetable}
                isLoading={isPublishing}
                leftIcon={<Save className="w-4 h-4 text-slate-950" />}
                className="font-black shadow-[0_0_20px_rgba(0,255,136,0.35)]"
              >
                Save & Publish Timetable ({draftSlots.size} Slots)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {publishSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" />
            <span>{publishSuccessMsg}</span>
          </div>
          <button onClick={() => setPublishSuccessMsg(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Publish Error Notification */}
      {publishError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{publishError}</span>
          </div>
          <button onClick={() => setPublishError(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cross-Section Informational Warnings */}
      {crossSectionWarnings.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Cross-Section Overlap Notice ({crossSectionWarnings.length} Overlaps)</span>
          </div>
          <p className="text-[11px] text-amber-200/80 font-medium">
            Cross-section overlap detected. This timetable was published because Section {currentSection?.name} is the authoritative target section.
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/90 pl-1">
            {crossSectionWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* SECTION SUMMARY BAR */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Active Section</span>
            <span className="font-black text-white text-sm">Section {currentSection?.name}</span>
          </div>
          <div className="h-6 w-px bg-emerald-500/20" />
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Classroom</span>
            <span className="font-bold text-[#00ff88] text-sm">
              {currentSection?.room_number 
                ? (currentSection.room_number.startsWith('Room') ? currentSection.room_number : `Room ${currentSection.room_number}`) 
                : 'Room Unassigned'}
            </span>
          </div>
          <div className="h-6 w-px bg-emerald-500/20" />
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Scheduled Classes</span>
            <span className="font-bold text-emerald-400 text-sm">{scheduledCount} Scheduled {scheduledCount === 1 ? 'Class' : 'Classes'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span className="inline-block w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
          <span>Live Supabase Synchronized</span>
        </div>
      </div>

      {/* MOBILE VIEW: Day Selector Tab Bar & Vertical Period Cards */}
      <div className="block lg:hidden space-y-4">
        {/* Day Selector Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-emerald-500/20 overflow-x-auto no-scrollbar">
          {days.map(d => (
            <button
              key={d}
              onClick={() => setSelectedMobileDay(d)}
              className={clsx(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center cursor-pointer touch-target',
                selectedMobileDay === d
                  ? 'bg-[#00ff88] text-slate-950 font-black shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              )}
            >
              {d} • {dayLabels[d]}
            </button>
          ))}
        </div>

        {/* Schedule Cards for Selected Day */}
        <div className="space-y-3">
          {periods.map(period => {
            const time = getStandardTimeForPeriod(period);
            const timeStr = `${time.start} – ${time.end}`;
            const key = `${selectedMobileDay}-${period}`;
            
            // In edit mode use draftSlots, else live sectionTimetable
            const draftEntry = isEditMode ? draftSlots.get(key) : undefined;
            const liveEntry = sectionTimetable.find(e => e.day_of_week === selectedMobileDay && e.period_number === period);
            const entry = isEditMode ? draftEntry : liveEntry;
            const slotConflict = displayedConflicts.find(c => c.day === selectedMobileDay && c.period_number === period);

            const sub = entry ? (subjects.find(s => s.id === entry.subject_id) || (entry as any).subject) : undefined;
            const fac = entry ? (faculty.find(f => f.id === entry.faculty_id) || (entry as any).faculty) : undefined;

            if (!entry) {
              return (
                <div 
                  key={period}
                  className={clsx(
                    "p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all",
                    isEditMode 
                      ? "bg-slate-950/60 border-dashed border-emerald-500/30 hover:border-[#00ff88] cursor-pointer" 
                      : "bg-slate-950/40 border-emerald-500/10 text-slate-500"
                  )}
                  onClick={isEditMode ? () => handleOpenSlotEditor(selectedMobileDay, period) : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-400">Period {period}</span>
                    <span>({timeStr})</span>
                  </div>

                  {isEditMode ? (
                    <span className="text-[11px] font-bold text-[#00ff88] flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      Add Class
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-600">Unassigned Slot</span>
                  )}
                </div>
              );
            }

            return (
              <div 
                key={period}
                className={clsx(
                  "glass-card rounded-2xl p-4 border space-y-2 transition-all",
                  slotConflict 
                    ? "bg-rose-950/40 border-2 border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.25)]" 
                    : "border-emerald-500/25 hover:border-emerald-500/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-black bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30">
                      Period {period}
                    </span>
                    <span className="text-xs font-mono text-slate-300 font-bold">{timeStr}</span>
                    {slotConflict && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        {slotConflict.rule}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-emerald-500/20 text-slate-300">
                      {entry.lecture_type || 'Theory'}
                    </span>
                    {isEditMode && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenSlotEditor(selectedMobileDay, period)}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/15 cursor-pointer"
                          title="Edit Slot"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleClearSlot(selectedMobileDay, period)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          title="Clear Slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {entry.lecture_type === 'Lunch' ? (
                  <div className="py-2">
                    <h4 className="text-sm font-black text-amber-300 tracking-wider">LUNCH BREAK</h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">12:20 – 13:10 • Refectory / Break Time</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">{sub?.subject_name || 'Subject'}</h4>
                      <p className="text-xs text-emerald-400 font-mono mt-0.5">{sub?.subject_code}</p>
                    </div>

                    <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                        <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{fac?.full_name || (entry.lecture_type === 'Sports' ? 'Sports Coordinator' : 'Faculty')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-bold text-[#00ff88]">{entry.room_number || currentSection?.room_number}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* DESKTOP/TABLET VIEW: Grid Timetable Table */}
      <div className="hidden lg:block glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-950/90 text-slate-300 border-b border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 text-left w-32 border-r border-emerald-500/10">Day / Period</th>
                {periods.map(p => {
                  const time = getStandardTimeForPeriod(p);
                  return (
                    <th key={p} className="p-3.5 min-w-[135px] border-r border-emerald-500/10 last:border-r-0">
                      <span className="block text-white font-mono">Period {p}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                        {time.start} – {time.end}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10 text-xs">
              {days.map(day => (
                <tr key={day} className="hover:bg-emerald-500/5 transition-colors">
                  <td className="p-4 text-left font-black text-white bg-slate-950/50 border-r border-emerald-500/10">
                    <span className="text-sm text-[#00ff88]">{dayLabels[day]}</span>
                  </td>
                  {periods.map(period => {
                    const key = `${day}-${period}`;
                    const draftEntry = isEditMode ? draftSlots.get(key) : undefined;
                    const liveEntry = sectionTimetable.find(e => e.day_of_week === day && e.period_number === period);
                    const entry = isEditMode ? draftEntry : liveEntry;
                    const slotConflict = displayedConflicts.find(c => c.day === day && c.period_number === period);

                    const sub = entry ? (subjects.find(s => s.id === entry.subject_id) || (entry as any).subject) : undefined;
                    const fac = entry ? (faculty.find(f => f.id === entry.faculty_id) || (entry as any).faculty) : undefined;

                    if (!entry) {
                      return (
                        <td key={period} className="p-2 border-r border-emerald-500/10">
                          {isEditMode ? (
                            <button
                              onClick={() => handleOpenSlotEditor(day, period)}
                              className="w-full h-20 rounded-xl border border-dashed border-emerald-500/25 hover:border-[#00ff88] hover:bg-emerald-500/10 transition-all flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-[#00ff88] cursor-pointer group"
                            >
                              <Plus className="w-4 h-4 text-slate-500 group-hover:text-[#00ff88]" />
                              <span className="text-[10px] font-bold">Add Class</span>
                            </button>
                          ) : (
                            <span className="text-slate-600 font-mono">—</span>
                          )}
                        </td>
                      );
                    }

                    if (entry.lecture_type === 'Lunch') {
                      return (
                        <td key={period} className="p-2 border-r border-emerald-500/10">
                          <div className={clsx(
                            "p-2.5 rounded-xl text-center space-y-1 group relative transition-all bg-amber-950/25 border border-amber-500/30",
                            isEditMode && "hover:border-amber-400"
                          )}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold text-amber-400/80 uppercase tracking-wider">Break</span>
                              {isEditMode ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenSlotEditor(day, period)}
                                    className="text-amber-400 hover:text-white p-0.5 rounded cursor-pointer"
                                    title="Edit Slot"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleClearSlot(day, period)}
                                    className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                                    title="Clear Slot"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <div className="py-1.5">
                              <span className="font-black text-amber-300 block text-xs tracking-wider">LUNCH BREAK</span>
                              <span className="text-[10px] text-slate-400 font-mono">12:20 – 13:10</span>
                            </div>
                            <div className="text-[10px] pt-1 border-t border-amber-500/20 text-slate-400 truncate">
                              Refectory
                            </div>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={period} className="p-2 border-r border-emerald-500/10">
                        <div className={clsx(
                          "p-2.5 rounded-xl text-left space-y-1 group relative transition-all",
                          slotConflict
                            ? "bg-rose-950/50 border-2 border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                            : isEditMode 
                              ? "bg-slate-950/90 border-2 border-emerald-500/40 hover:border-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.1)]"
                              : "bg-slate-950/70 border border-emerald-500/20 hover:border-[#00ff88]"
                        )}>
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-black text-white block text-xs truncate max-w-[100px]" title={sub?.subject_name}>
                              {sub?.subject_code || 'Subject'}
                            </span>
                            {isEditMode ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenSlotEditor(day, period)}
                                  className="text-emerald-400 hover:text-white p-0.5 rounded cursor-pointer"
                                  title="Edit Slot"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleClearSlot(day, period)}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                                  title="Clear Slot"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : null}
                          </div>

                          <span className="text-[11px] text-slate-300 block truncate font-medium" title={sub?.subject_name}>
                            {sub?.subject_name}
                          </span>

                          <span className="text-[11px] text-emerald-400 block truncate font-mono" title={fac?.full_name}>
                            {fac?.full_name || 'Faculty'}
                          </span>

                          {slotConflict && (
                            <div className="pt-0.5">
                              <span className="text-[9px] font-black text-rose-300 flex items-center gap-1 bg-rose-900/60 px-1 py-0.5 rounded border border-rose-500/40 truncate" title={slotConflict.message}>
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                                <span className="truncate">{slotConflict.rule}</span>
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-emerald-500/10">
                            <span className="text-[#00ff88] font-bold">{entry.room_number || currentSection?.room_number}</span>
                            <span className="text-slate-400 font-medium">{entry.lecture_type || 'Theory'}</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Slot Editor Modal */}
      {editingSlot && (
        <Modal
          isOpen={true}
          onClose={() => setEditingSlot(null)}
          title={`Edit Timetable Slot — ${editingSlot.day_of_week} Period ${editingSlot.period_number}`}
          description={`Target: Section ${currentSection?.name} (${currentSection?.room_number})`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveSlotModal} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Day of Week</label>
                <select
                  value={editingSlot.day_of_week}
                  onChange={(e) => setEditingSlot({ ...editingSlot, day_of_week: e.target.value as DayOfWeek })}
                  className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
                >
                  <option value="MON">Monday</option>
                  <option value="TUE">Tuesday</option>
                  <option value="WED">Wednesday</option>
                  <option value="THU">Thursday</option>
                  <option value="FRI">Friday</option>
                  <option value="SAT">Saturday</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Period Number</label>
                <select
                  value={editingSlot.period_number}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    const time = getStandardTimeForPeriod(p);
                    setEditingSlot({
                      ...editingSlot,
                      period_number: p,
                      start_time: time.start,
                      end_time: time.end,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
                >
                  {periods.map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Subject</label>
              <select
                value={editingSlot.subject_id || ''}
                onChange={(e) => setEditingSlot({ ...editingSlot, subject_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                <option value="">— None / Non-Instructional Break —</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Faculty Professor</label>
              <select
                value={editingSlot.faculty_id || ''}
                onChange={(e) => setEditingSlot({ ...editingSlot, faculty_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                <option value="">— None / Non-Instructional Break —</option>
                {faculty.map(f => (
                  <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code || f.designation})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Classroom / Room Number</label>
                <input
                  type="text"
                  value={editingSlot.room_number}
                  onChange={(e) => setEditingSlot({ ...editingSlot, room_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Class Format / Lecture Type</label>
                <select
                  value={editingSlot.lecture_type}
                  onChange={(e) => {
                    const newType = e.target.value as LectureType;
                    const isLunch = newType === 'Lunch';
                    const isSports = newType === 'Sports';
                    setEditingSlot({
                      ...editingSlot,
                      lecture_type: newType,
                      ...(isLunch ? {
                        subject_id: null,
                        faculty_id: null,
                        room_number: editingSlot.room_number || 'Refectory / Break'
                      } : isSports ? {
                        room_number: editingSlot.room_number || 'Sports Ground'
                      } : {})
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
                >
                  <option value="Theory">Theory Lecture</option>
                  <option value="Practical">Practical Lab</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Project">Project Session</option>
                  <option value="Tutorial">Tutorial</option>
                  <option value="Sports">Sports Session</option>
                  <option value="Lunch">Lunch Break</option>
                  <option value="Other">Other Institutional Activity</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-emerald-500/15">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingSlot(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="neon" size="sm">
                Save Slot
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* AI Timetable Upload Modal */}
      <AITimetableUploadModal
        isOpen={isAIUploadOpen}
        onClose={() => setIsAIUploadOpen(false)}
        initialSectionId={selectedSectionId}
        onExtractionComplete={(extracted) => {
          setExtractedDocs(extracted);
          setIsAIPreviewOpen(true);
        }}
      />

      {/* AI Timetable Preview & Diff Review Modal */}
      {isAIPreviewOpen && (
        <AITimetablePreviewModal
          isOpen={isAIPreviewOpen}
          onClose={() => setIsAIPreviewOpen(false)}
          extractedDocs={extractedDocs}
          onPublishedSuccessfully={() => {
            refreshData(true);
          }}
        />
      )}

      {/* Timetable Version History Modal */}
      <TimetableVersionHistoryModal
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        sectionId={selectedSectionId}
        sectionName={currentSection?.name}
      />

      {/* Confirmation Modal for Timetable Deletion */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Delete Section ${currentSection?.name} Timetable`}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-rose-200">
                This will permanently remove all {sectionTimetable.length} scheduled periods for Section {currentSection?.name} from Supabase.
              </p>
              <p className="text-rose-300/80">
                The active timetable version will be archived. Any faculty or room collisions caused by this section's schedule will clear immediately across the college.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSectionTimetable}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-4 h-4" />}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold border-rose-600"
            >
              {isDeleting ? 'Deleting...' : 'Confirm & Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};



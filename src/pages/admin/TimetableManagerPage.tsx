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
import { AITimetablePreviewModal } from '../../components/timetable/AITimetablePreviewModal';
import { TimetableVersionHistoryModal } from '../../components/timetable/TimetableVersionHistoryModal';
import { clsx } from 'clsx';

interface DraftSlot {
  id?: string;
  day_of_week: DayOfWeek;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  faculty_id: string;
  room_number: string;
  lecture_type: LectureType;
}

export const TimetableManagerPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    departments,
    sections, 
    subjects, 
    faculty, 
    timetable, 
    years, 
    semesters, 
    saveSectionTimetable, 
    refreshData 
  } = useAcademic();

  const isSuperAdmin = user?.role === 'super_admin';
  const isHOD = user?.role === 'hod';
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [selectedYearId, setSelectedYearId] = useState<string>('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(() => sections[0]?.id || 'sec-btech-cse-2-a');

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [crossSectionWarnings, setCrossSectionWarnings] = useState<string[]>([]);
  const [facultyConflicts, setFacultyConflicts] = useState<Array<{ facultyName: string; day: DayOfWeek; period: number; otherSectionName: string; otherSubjectCode?: string }>>([]);
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

  const periods = [1, 2, 3, 4, 6, 7, 8];

  const currentSection = useMemo(() => {
    return sections.find(s => s.id === selectedSectionId) || sections[0];
  }, [sections, selectedSectionId]);

  // Live Database Timetable strictly for selected section
  const sectionTimetable = useMemo(() => {
    return timetable.filter(t => t.section_id === selectedSectionId && t.active);
  }, [timetable, selectedSectionId]);

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
        room_number: t.room_number || currentSection?.room_number || 'Room A-007',
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
    switch (p) {
      case 1: return { start: '09:00', end: '09:50' };
      case 2: return { start: '09:50', end: '10:40' };
      case 3: return { start: '10:40', end: '11:30' };
      case 4: return { start: '11:30', end: '12:20' };
      case 6: return { start: '13:10', end: '14:00' };
      case 7: return { start: '14:00', end: '14:50' };
      case 8: return { start: '14:50', end: '15:40' };
      default: return { start: '09:00', end: '09:50' };
    }
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
      setEditingSlot({
        day_of_week: day,
        period_number: period,
        start_time: time.start,
        end_time: time.end,
        subject_id: subjects[0]?.id || '',
        faculty_id: faculty[0]?.id || '',
        room_number: currentSection?.room_number || 'Room A-007',
        lecture_type: 'Theory',
      });
    }
  };

  // Save slot into draft map
  const handleSaveSlotModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;

    const key = `${editingSlot.day_of_week}-${editingSlot.period_number}`;
    setDraftSlots(prev => {
      const next = new Map(prev);
      next.set(key, { ...editingSlot });
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
        room_number: t.room_number || currentSection?.room_number || 'Room A-007',
        lecture_type: t.lecture_type || 'Theory',
      });
    }
    setDraftSlots(map);
    setIsEditMode(false);
  };

  // Publish Section Timetable to Supabase (Full Section Replacement)
  const handlePublishTimetable = async () => {
    if (isSuperAdmin) return;
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccessMsg(null);
    setCrossSectionWarnings([]);

    try {
      const entriesToPublish = Array.from(draftSlots.values());

      // Detect non-blocking cross-section faculty overlaps
      const warnings: string[] = [];
      for (const entry of entriesToPublish) {
        const fac = faculty.find(f => f.id === entry.faculty_id);
        const overlap = timetable.find(t => 
          t.faculty_id === entry.faculty_id &&
          t.day_of_week === entry.day_of_week &&
          t.period_number === entry.period_number &&
          t.section_id !== selectedSectionId &&
          t.active
        );

        if (overlap) {
          const overlapSec = sections.find(s => s.id === overlap.section_id);
          warnings.push(`Cross-section faculty overlap: ${fac?.full_name || 'Faculty'} is also scheduled in Section ${overlapSec?.name || 'other section'} on ${entry.day_of_week} Period ${entry.period_number}. This timetable will still be published because Section ${currentSection?.name} is the authoritative target.`);
        }
      }

      setCrossSectionWarnings(warnings);

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
          room_number: e.room_number,
          lecture_type: e.lecture_type,
          active: true,
        })),
        publishedBy: user?.full_name || 'HOD / Super Administrator',
      });

      setPublishSuccessMsg(`Section ${currentSection?.name} Timetable published successfully to Supabase! (${result.count} active periods verified)`);
      setIsEditMode(false);
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
  // ONE-CLICK GOOGLE SHEET & CSV TIMETABLE SYNC HANDLERS
  // ----------------------------------------------------
  const handleSyncTimetable = async () => {
    if (isSuperAdmin) return;
    if (!csvUrl.trim()) {
      setCsvError('Please enter a valid Google Sheet CSV URL.');
      return;
    }
    setIsPublishing(true);
    setCsvError(null);
    setPublishSuccessMsg(null);
    setFacultyConflicts([]);
    setShowConflictDetails(false);

    try {
      const csvText = await csvTimetableService.fetchTimetableCSV(csvUrl);
      const validation = csvTimetableService.parseAndValidateCSV(csvText, {
        targetSection: currentSection,
        subjects,
        faculty,
      });

      if (!validation.valid) {
        setCsvError(`Validation failed (${validation.errors.length} issue${validation.errors.length > 1 ? 's' : ''}):\n• ${validation.errors.join('\n• ')}`);
        return;
      }

      // Check for genuine faculty cross-section scheduling conflicts
      const conflicts = await supabaseService.checkFacultyCrossSectionConflicts({
        sectionId: selectedSectionId,
        entries: validation.entries.map(e => ({
          faculty_id: e.faculty_id || '',
          day_of_week: e.day_of_week,
          period_number: e.period_number,
          subject_id: e.subject_id
        }))
      });

      // Atomically replace section timetable
      const result = await saveSectionTimetable({
        sectionId: selectedSectionId,
        entries: validation.entries.map(e => ({
          subject_id: e.subject_id || subjects[0]?.id,
          faculty_id: e.faculty_id || faculty[0]?.id,
          day_of_week: e.day_of_week,
          period_number: e.period_number,
          start_time: e.start_time,
          end_time: e.end_time,
          room_number: e.room_number || currentSection?.room_number || 'Room A-007',
          lecture_type: e.lecture_type || 'Theory',
          active: true,
        })),
        publishedBy: user?.full_name || 'HOD / Central Administrator',
        sourceType: 'GOOGLE_SHEET_CSV_SYNC',
        sourceUrl: csvUrl,
      });

      setPublishSuccessMsg(`✓ Timetable updated • ${result.count} periods synchronized`);
      if (conflicts && conflicts.length > 0) {
        setFacultyConflicts(conflicts);
      }
      setIsEditMode(false);
      await refreshData(true);
    } catch (err: any) {
      setCsvError(err.message || 'Sync failed — existing timetable was not changed.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSuperAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    setPublishSuccessMsg(null);
    setFacultyConflicts([]);
    setShowConflictDetails(false);
    setIsPublishing(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setCsvError('Uploaded CSV file is empty.');
        setIsPublishing(false);
        return;
      }
      try {
        const validation = csvTimetableService.parseAndValidateCSV(content, {
          targetSection: currentSection,
          subjects,
          faculty,
        });

        if (!validation.valid) {
          setCsvError(`Validation failed (${validation.errors.length} issue${validation.errors.length > 1 ? 's' : ''}):\n• ${validation.errors.join('\n• ')}`);
          setIsPublishing(false);
          return;
        }

        const conflicts = await supabaseService.checkFacultyCrossSectionConflicts({
          sectionId: selectedSectionId,
          entries: validation.entries.map(e => ({
            faculty_id: e.faculty_id || '',
            day_of_week: e.day_of_week,
            period_number: e.period_number,
            subject_id: e.subject_id
          }))
        });

        const result = await saveSectionTimetable({
          sectionId: selectedSectionId,
          entries: validation.entries.map(e => ({
            subject_id: e.subject_id || subjects[0]?.id,
            faculty_id: e.faculty_id || faculty[0]?.id,
            day_of_week: e.day_of_week,
            period_number: e.period_number,
            start_time: e.start_time,
            end_time: e.end_time,
            room_number: e.room_number || currentSection?.room_number || 'Room A-007',
            lecture_type: e.lecture_type || 'Theory',
            active: true,
          })),
          publishedBy: user?.full_name || 'HOD / Central Administrator',
          sourceType: 'CSV_FILE_UPLOAD',
        });

        setPublishSuccessMsg(`✓ Timetable updated • ${result.count} periods synchronized`);
        if (conflicts && conflicts.length > 0) {
          setFacultyConflicts(conflicts);
        }
        setIsEditMode(false);
        await refreshData(true);
      } catch (err: any) {
        setCsvError(err.message || 'Sync failed — existing timetable was not changed.');
      } finally {
        setIsPublishing(false);
      }
    };
    reader.onerror = () => {
      setCsvError('Failed to read uploaded CSV file.');
      setIsPublishing(false);
    };
    reader.readAsText(file);
    e.target.value = '';
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

          {/* URL Input Bar & One-Click Sync */}
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
              isLoading={isPublishing}
              leftIcon={<Download className="w-4 h-4 text-slate-950" />}
              className="w-full sm:w-auto font-black shadow-[0_0_15px_rgba(0,255,136,0.25)] shrink-0"
            >
              SYNC TIMETABLE
            </Button>
          </div>

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

          {/* Compact Non-Blocking Faculty Conflict Alert */}
          {facultyConflicts.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>⚠ {facultyConflicts.length} faculty scheduling conflict{facultyConflicts.length > 1 ? 's' : ''} detected</span>
                </div>
                <button
                  onClick={() => setShowConflictDetails(!showConflictDetails)}
                  className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  [{showConflictDetails ? 'Hide Details' : 'View Details'}]
                </button>
              </div>
              {showConflictDetails && (
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-200/90 font-mono pt-1">
                  {facultyConflicts.map((c, i) => (
                    <li key={i}>
                      {c.facultyName} has concurrent class at {c.day} Period {c.period} in Section {c.otherSectionName}{c.otherSubjectCode ? ` (${c.otherSubjectCode})` : ''}
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
            <span className="font-bold text-[#00ff88] text-sm">{currentSection?.room_number || 'Room TBD'}</span>
          </div>
          <div className="h-6 w-px bg-emerald-500/20" />
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Scheduled Classes</span>
            <span className="font-bold text-emerald-400 text-sm">{scheduledCount} / 42 Periods</span>
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
                className="glass-card rounded-2xl p-4 border border-emerald-500/25 space-y-2 hover:border-emerald-500/40 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-black bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30">
                      Period {period}
                    </span>
                    <span className="text-xs font-mono text-slate-300 font-bold">{timeStr}</span>
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

                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">{sub?.subject_name || 'Subject'}</h4>
                  <p className="text-xs text-emerald-400 font-mono mt-0.5">{sub?.subject_code}</p>
                </div>

                <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                    <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{fac?.full_name || 'Faculty'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-[#00ff88]">{entry.room_number || currentSection?.room_number}</span>
                  </div>
                </div>
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

                    return (
                      <td key={period} className="p-2 border-r border-emerald-500/10">
                        <div className={clsx(
                          "p-2.5 rounded-xl text-left space-y-1 group relative transition-all",
                          isEditMode 
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
                value={editingSlot.subject_id}
                onChange={(e) => setEditingSlot({ ...editingSlot, subject_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Faculty Professor</label>
              <select
                value={editingSlot.faculty_id}
                onChange={(e) => setEditingSlot({ ...editingSlot, faculty_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
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
                  onChange={(e) => setEditingSlot({ ...editingSlot, lecture_type: e.target.value as LectureType })}
                  className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/30 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
                >
                  <option value="Theory">Theory Lecture</option>
                  <option value="Practical">Practical Lab</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Project">Project Session</option>
                  <option value="Tutorial">Tutorial</option>
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
    </div>
  );
};



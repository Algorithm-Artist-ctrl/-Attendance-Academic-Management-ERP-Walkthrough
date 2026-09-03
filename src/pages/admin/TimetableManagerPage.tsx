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
    sections, 
    subjects, 
    faculty, 
    timetable, 
    saveSectionTimetable,
    refreshData
  } = useAcademic();

  const [selectedSectionId, setSelectedSectionId] = useState<string>(() => sections[0]?.id || 'sec-btech-cse-2-a');
  
  // Ensure selectedSectionId updates when sections load
  useEffect(() => {
    if (sections.length > 0 && !sections.some(s => s.id === selectedSectionId)) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

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
  // CSV INGESTION & ATOMIC REPLACEMENT HANDLERS
  // ----------------------------------------------------
  const handleFetchCSV = async () => {
    if (!csvUrl.trim()) {
      setCsvError('Please enter a valid CSV URL.');
      return;
    }
    setIsFetchingCSV(true);
    setCsvError(null);
    setCsvPreview(null);
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

      setCsvPreview(validation);
    } catch (err: any) {
      setCsvError(err.message || 'Failed to fetch CSV timetable.');
    } finally {
      setIsFetchingCSV(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    setCsvPreview(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setCsvError('Uploaded CSV file is empty.');
        return;
      }
      const validation = csvTimetableService.parseAndValidateCSV(content, {
        targetSection: currentSection,
        subjects,
        faculty,
      });

      if (!validation.valid) {
        setCsvError(`Validation failed (${validation.errors.length} issue${validation.errors.length > 1 ? 's' : ''}):\n• ${validation.errors.join('\n• ')}`);
        return;
      }

      setCsvPreview(validation);
    };
    reader.onerror = () => {
      setCsvError('Failed to read uploaded CSV file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportAndReplaceFromCSV = async () => {
    if (!csvPreview || csvPreview.entries.length === 0) return;

    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccessMsg(null);

    try {
      const result = await saveSectionTimetable({
        sectionId: selectedSectionId,
        entries: csvPreview.entries.map(e => ({
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
        publishedBy: user?.full_name || 'HOD / Super Administrator',
        sourceType: csvUrl ? 'CSV_URL' : 'CSV_UPLOAD',
        sourceUrl: csvUrl || undefined,
      });

      setPublishSuccessMsg(`Section ${currentSection?.name} Timetable completely replaced and published! (${result.count} periods active, Version ${result.version?.version_number || 'New'})`);
      setCsvPreview(null);
      setCsvUrl('');
      setIsEditMode(false);
      await refreshData(true);
    } catch (err: any) {
      setPublishError(err.message || 'Failed to replace section timetable.');
    } finally {
      setIsPublishing(false);
    }
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
            Department Schedule Management
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Authoritative section-wise schedule matrix with live editing, collision resolution & real-time sync
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
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
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  Section {s.name} ({s.room_number || 'Room'})
                </option>
              ))}
            </select>
          </div>

          {/* Edit Mode Toggle Button */}
          {!isEditMode ? (
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
          )}

          {/* AI Timetable Ingestion */}
          <Button
            variant="neon"
            size="sm"
            onClick={() => setIsAIUploadOpen(true)}
            leftIcon={<Sparkles className="w-4 h-4 text-slate-950" />}
            className="touch-target font-black shadow-[0_0_15px_rgba(0,255,136,0.3)]"
          >
            AI Timetable Ingestion
          </Button>

          {/* Versions History */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVersionHistoryOpen(true)}
            leftIcon={<History className="w-4 h-4 text-[#00ff88]" />}
            className="touch-target font-semibold"
          >
            Versions
          </Button>
        </div>
      </div>

      {/* CSV TIMETABLE SOURCE PANEL */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                CSV Timetable Source
                <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30 font-bold">
                  Target: Section {currentSection?.name}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Paste a remote CSV URL or upload a CSV file to atomically replace Section {currentSection?.name}'s complete schedule
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

        {/* URL Input Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <input
              type="url"
              value={csvUrl}
              onChange={(e) => {
                setCsvUrl(e.target.value);
                setCsvError(null);
              }}
              placeholder="Paste CSV URL (e.g. https://example.com/section_a_timetable.csv)..."
              className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-emerald-500/30 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00ff88] font-mono shadow-inner"
            />
          </div>
          <Button
            variant="neon"
            size="sm"
            onClick={handleFetchCSV}
            isLoading={isFetchingCSV}
            leftIcon={<Download className="w-4 h-4 text-slate-950" />}
            className="w-full sm:w-auto font-black shadow-[0_0_15px_rgba(0,255,136,0.25)] shrink-0"
          >
            Fetch CSV
          </Button>
        </div>

        {/* CSV Validation Error Display */}
        {csvError && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>CSV Ingestion Issue Detected — Existing Section Timetable Unchanged</span>
              </div>
              <button onClick={() => setCsvError(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[11px] text-rose-200/90 pl-1">{csvError}</pre>
          </div>
        )}

        {/* CSV Preview Summary & One-Click Replace */}
        {csvPreview && (
          <div className="p-4 sm:p-5 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/40 text-white space-y-3 animate-in zoom-in-95">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-black text-sm text-[#00ff88]">
                  <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
                  <span>Valid Timetable Source — {csvPreview.totalSlots} Periods Ready for Section {currentSection?.name}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 pt-1">
                  {Object.entries(csvPreview.dayBreakdown).map(([d, count]) => (
                    <span key={d} className="px-2 py-0.5 rounded-lg bg-slate-950 border border-emerald-500/20 font-mono text-[10px]">
                      <strong>{d}:</strong> <span className="text-emerald-400">{count}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCsvPreview(null)}
                  className="text-xs text-slate-400 border-slate-700 hover:bg-slate-900"
                >
                  Discard
                </Button>
                <Button
                  variant="neon"
                  size="sm"
                  onClick={handleImportAndReplaceFromCSV}
                  isLoading={isPublishing}
                  leftIcon={<ShieldCheck className="w-4 h-4 text-slate-950" />}
                  className="font-black shadow-[0_0_20px_rgba(0,255,136,0.35)]"
                >
                  Import & Replace Section {currentSection?.name} ({csvPreview.totalSlots} Slots)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

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



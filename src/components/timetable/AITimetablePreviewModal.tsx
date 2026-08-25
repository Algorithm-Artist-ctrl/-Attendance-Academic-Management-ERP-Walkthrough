import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  BookOpen, 
  Edit3, 
  Save, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  X,
  Layers,
  ChevronRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { 
  ExtractedTimetableDocument, 
  ExtractedTimetablePeriod,
  TimetableSlotDiff 
} from '../../types/academic.types';
import { TimetableResolver, ResolvedEntityReport } from '../../lib/utils/timetableResolver';
import { timetableIngestionService } from '../../lib/services/timetableIngestionService';
import { DayOfWeek } from '../../types/database.types';
import { clsx } from 'clsx';

interface AITimetablePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedDocs: ExtractedTimetableDocument[];
  onPublishedSuccessfully?: () => void;
}

export const AITimetablePreviewModal: React.FC<AITimetablePreviewModalProps> = ({
  isOpen,
  onClose,
  extractedDocs,
  onPublishedSuccessfully,
}) => {
  const { user } = useAuth();
  const { 
    departments, 
    programs, 
    years, 
    semesters, 
    sections, 
    subjects, 
    faculty, 
    timetable: existingTimetable,
    refreshData 
  } = useAcademic();

  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [docs, setDocs] = useState<ExtractedTimetableDocument[]>(extractedDocs);
  const [activeViewTab, setActiveViewTab] = useState<'grid' | 'legend' | 'diff'>('grid');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Active Document
  const currentDoc = docs[activeDocIndex] || docs[0];

  // Resolve Entities and Compute Diffs dynamically
  const report: ResolvedEntityReport = useMemo(() => {
    if (!currentDoc) {
      return {
        isNewSection: false,
        subjectMatches: [],
        facultyMatches: [],
        conflicts: [],
        diffs: [],
        stats: { totalSlots: 0, newCount: 0, changedCount: 0, unchangedCount: 0, removedCount: 0, conflictCount: 0 }
      };
    }

    return TimetableResolver.resolveDocument(currentDoc, {
      departments,
      programs,
      years,
      semesters,
      sections,
      subjects,
      faculty,
      existingTimetable,
    });
  }, [currentDoc, departments, programs, years, semesters, sections, subjects, faculty, existingTimetable]);

  // Cell Editing Modal State
  const [editingSlot, setEditingSlot] = useState<{
    day: DayOfWeek;
    period: number;
    subjectCode: string;
    facultyCode: string;
    roomNumber: string;
  } | null>(null);

  if (!currentDoc) return null;

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

  const periodTimes = [
    { period: 1, time: '09:00 – 09:50' },
    { period: 2, time: '09:50 – 10:40' },
    { period: 3, time: '10:40 – 11:30' },
    { period: 4, time: '11:30 – 12:20' },
    { period: 5, time: '12:20 – 01:10', isLunch: true },
    { period: 6, time: '01:10 – 02:00' },
    { period: 7, time: '02:00 – 02:50' },
    { period: 8, time: '02:50 – 03:40' },
  ];

  // Update cell modification
  const handleSaveCellEdit = () => {
    if (!editingSlot) return;

    setDocs(prevDocs => {
      const updatedDocs = [...prevDocs];
      const doc = { ...updatedDocs[activeDocIndex] };
      const schedule = [...(doc.schedule || [])];

      const dayIdx = schedule.findIndex(s => s.day === editingSlot.day);
      if (dayIdx >= 0) {
        const dayEntry = { ...schedule[dayIdx] };
        const periods = [...(dayEntry.periods || [])];
        const pIdx = periods.findIndex(p => p.period_number === editingSlot.period);

        if (pIdx >= 0) {
          periods[pIdx] = {
            ...periods[pIdx],
            subject_code: editingSlot.subjectCode,
            faculty_code: editingSlot.facultyCode,
            room_number: editingSlot.roomNumber,
          };
        } else {
          periods.push({
            period_number: editingSlot.period,
            start_time: '09:00',
            end_time: '09:50',
            subject_code: editingSlot.subjectCode,
            faculty_code: editingSlot.facultyCode,
            room_number: editingSlot.roomNumber,
            lecture_type: 'Theory',
            is_break: false,
          });
        }
        dayEntry.periods = periods;
        schedule[dayIdx] = dayEntry;
      }
      doc.schedule = schedule;
      updatedDocs[activeDocIndex] = doc;
      return updatedDocs;
    });

    setEditingSlot(null);
  };

  // Publish to Database
  const handleApproveAndPublish = async () => {
    setIsPublishing(true);
    setPublishError(null);

    try {
      // If multiple pages were extracted, publish each verified page into Supabase
      const docsToPublish = docs.length > 1 ? docs : [currentDoc];

      for (const docToPublish of docsToPublish) {
        const docReport = TimetableResolver.resolveDocument(docToPublish, {
          departments,
          programs,
          years,
          semesters,
          sections,
          subjects,
          faculty,
          existingTimetable,
        });

        await timetableIngestionService.approveAndPublishTimetable({
          doc: docToPublish,
          report: docReport,
          approvedBy: user?.full_name || 'HOD / Super Administrator',
          importId: docToPublish.id,
          customEffectiveDate: docToPublish.effective_from,
        });
      }

      setPublishSuccess(true);
      await refreshData();

      setTimeout(() => {
        setIsPublishing(false);
        onClose();
        onPublishedSuccessfully?.();
      }, 1500);
    } catch (err: any) {
      console.error('Publish error:', err);
      setPublishError(err.message || 'Failed to publish timetable to Supabase database.');
      setIsPublishing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isPublishing ? () => {} : onClose}
      title={
        <div className="flex items-center justify-between w-full pr-6 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                AI Timetable Ingestion & Diff Review
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] font-bold">
                  {docs.length} {docs.length === 1 ? 'Page' : 'Pages'} Analyzed
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-normal">
                Review extracted grid, legend codes, and live database conflict analysis before publishing
              </p>
            </div>
          </div>
        </div>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Multi-Document Selector Tabs if >1 uploaded */}
        {docs.length > 1 && (
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20 overflow-x-auto no-scrollbar">
            {docs.map((d, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveDocIndex(idx)}
                className={clsx(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2',
                  activeDocIndex === idx
                    ? 'bg-[#00ff88] text-slate-950 font-black shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                )}
              >
                <span>Page {idx + 1}:</span>
                <span>{d.branch_name} {d.academic_year} Sec {d.section_name}</span>
              </button>
            ))}
          </div>
        )}

        {/* 1. HEADER METADATA REVIEW BANNER */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/80 border border-emerald-500/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase tracking-wider">Program & Branch</span>
            <span className="font-bold text-white text-sm">{currentDoc.program_name} • {currentDoc.branch_name}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase tracking-wider">Academic Year & Sem</span>
            <span className="font-bold text-emerald-400 text-sm">{currentDoc.academic_year} • {currentDoc.semester}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase tracking-wider">Target Section & Room</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <select
                value={currentDoc.target_section_id || sections.find(s => s.name === currentDoc.section_name)?.id || ''}
                onChange={(e) => {
                  const newSecId = e.target.value;
                  const newSec = sections.find(s => s.id === newSecId);
                  if (newSec) {
                    setDocs(prevDocs => {
                      const updated = [...prevDocs];
                      updated[activeDocIndex] = {
                        ...updated[activeDocIndex],
                        section_name: newSec.name,
                        target_section_id: newSec.id,
                        room_number: newSec.room_number || (newSec.name === 'B' ? 'A006' : 'A007')
                      };
                      return updated;
                    });
                  }
                }}
                className="bg-slate-900 border-2 border-emerald-500/60 rounded-lg px-2 py-0.5 text-xs text-[#00ff88] font-black focus:outline-none focus:border-[#00ff88]"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    Section {s.name} ({s.room_number || (s.name === 'B' ? 'A006' : 'A007')})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase tracking-wider">Effective From (W.E.F.)</span>
            <span className="font-bold text-[#00ff88] text-sm font-mono">{currentDoc.effective_from}</span>
          </div>
        </div>

        {/* Validation Notes & Warnings Banner */}
        {currentDoc.warnings && currentDoc.warnings.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Document Extraction & Section Alignment:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-amber-200/90 pl-1 space-y-0.5">
              {currentDoc.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Conflict Alert Banner if any conflicts exist */}
        {report.conflicts.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs space-y-1.5 animate-pulse">
            <div className="flex items-center gap-2 font-black text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{report.conflicts.length} Timetable Scheduling Conflict(s) Detected</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-200 pl-1">
              {report.conflicts.map((c, i) => (
                <li key={i}>{c.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* View Switcher Tabs (Grid / Legend / Old vs New Diff) */}
        <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveViewTab('grid')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeViewTab === 'grid'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88]'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Extracted Schedule Grid
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('legend')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeViewTab === 'legend'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88]'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Subject & Faculty Legend ({currentDoc.subject_mappings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('diff')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5',
                activeViewTab === 'diff'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88]'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <span>Diff vs Live Timetable</span>
              <span className="px-1.5 py-0.2 rounded-md bg-slate-900 text-[10px] text-emerald-400 font-mono">
                +{report.stats.newCount} / ~{report.stats.changedCount}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Extraction Confidence: <strong className="text-[#00ff88]">{currentDoc.overall_confidence}%</strong>
          </div>
        </div>

        {/* TAB 1: SCHEDULE GRID */}
        {activeViewTab === 'grid' && (
          <div className="overflow-x-auto rounded-2xl border border-emerald-500/20 bg-slate-950/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-3.5 py-3 w-24">Day</th>
                  {periodTimes.map(pt => (
                    <th key={pt.period} className="px-3 py-3 text-center border-l border-emerald-500/10">
                      <div>Period {pt.period}</div>
                      <div className="text-[10px] text-slate-500 font-mono font-normal">{pt.time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {days.map(d => {
                  const extractedDay = currentDoc.schedule?.find(s => s.day === d);
                  const periods = extractedDay?.periods || [];

                  return (
                    <tr key={d} className="hover:bg-emerald-500/5">
                      <td className="px-3.5 py-3 font-bold text-white bg-slate-950/50">
                        {d} • {dayLabels[d]}
                      </td>

                      {periodTimes.map(pt => {
                        if (pt.isLunch) {
                          return (
                            <td key={pt.period} className="p-2 text-center bg-slate-950/80 border-l border-emerald-500/10">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Lunch
                              </span>
                            </td>
                          );
                        }

                        const p = periods.find(p => p.period_number === pt.period);
                        const diffSlot = report.diffs.find(df => df.day_of_week === d && df.period_number === pt.period);
                        const isConflict = Boolean(diffSlot?.conflict);

                        return (
                          <td 
                            key={pt.period}
                            onClick={() => {
                              setEditingSlot({
                                day: d,
                                period: pt.period,
                                subjectCode: p?.subject_code || '',
                                facultyCode: p?.faculty_code || '',
                                roomNumber: p?.room_number || currentDoc.room_number || 'A007',
                              });
                            }}
                            className={clsx(
                              'p-2.5 text-center border-l border-emerald-500/10 cursor-pointer transition-all hover:ring-1 hover:ring-[#00ff88]/50',
                              isConflict 
                                ? 'bg-rose-500/15 ring-1 ring-rose-500/40' 
                                : diffSlot?.status === 'CHANGED'
                                ? 'bg-amber-500/10'
                                : diffSlot?.status === 'NEW'
                                ? 'bg-emerald-500/10'
                                : 'bg-transparent'
                            )}
                          >
                            {p && !p.is_break ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-white text-[11px] truncate">
                                  {p.subject_code}
                                </div>
                                <div className="text-[10px] text-emerald-400 font-mono">
                                  {p.faculty_code}
                                </div>
                                {diffSlot && (
                                  <span className={clsx(
                                    'inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase',
                                    diffSlot.status === 'NEW' && 'bg-emerald-500/20 text-emerald-300',
                                    diffSlot.status === 'CHANGED' && 'bg-amber-500/20 text-amber-300',
                                    diffSlot.status === 'UNCHANGED' && 'text-slate-500',
                                  )}>
                                    {diffSlot.status}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[10px] italic">Free Slot</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: LEGEND MAPPINGS */}
        {activeViewTab === 'legend' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Subject Mappings */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#00ff88]" />
                Extracted Curriculum Subjects ({report.subjectMatches.length})
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {report.subjectMatches.map((sm, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/10 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-[12px]">{sm.extracted.subject_code}</span>
                      <span className="text-slate-400 block text-[11px]">{sm.extracted.subject_name}</span>
                    </div>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold',
                      sm.matchedSubject ? 'bg-emerald-500/15 text-[#00ff88]' : 'bg-blue-500/15 text-blue-300'
                    )}>
                      {sm.matchedSubject ? 'Matched in DB' : 'New Subject (Auto-Create)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Faculty Mappings */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-[#00ff88]" />
                Extracted Faculty Initials & Names ({report.facultyMatches.length})
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {report.facultyMatches.map((fm, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/10 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-400 font-mono text-[12px]">{fm.extracted.faculty_code}</span>
                      <span className="text-white block text-[11px]">{fm.extracted.faculty_name}</span>
                    </div>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold',
                      fm.matchedFaculty ? 'bg-emerald-500/15 text-[#00ff88]' : 'bg-amber-500/15 text-amber-300'
                    )}>
                      {fm.matchedFaculty ? `Linked: ${fm.matchedFaculty.full_name}` : 'Unmatched'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIFF VS LIVE TIMETABLE */}
        {activeViewTab === 'diff' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <span className="block text-lg font-black">{report.stats.newCount}</span>
                <span>New Slots</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                <span className="block text-lg font-black">{report.stats.changedCount}</span>
                <span>Changed Slots</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/10 text-slate-300">
                <span className="block text-lg font-black">{report.stats.unchangedCount}</span>
                <span>Unchanged Slots</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                <span className="block text-lg font-black">{report.stats.conflictCount}</span>
                <span>Conflicts Detected</span>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-2xl border border-emerald-500/20 bg-slate-950/60 divide-y divide-emerald-500/10 text-xs">
              {report.diffs.filter(d => d.status !== 'UNCHANGED').map((diff, i) => (
                <div key={i} className="p-3 flex items-center justify-between hover:bg-emerald-500/5">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white">
                      {diff.day_of_week} Period {diff.period_number} ({diff.start_time}–{diff.end_time})
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {diff.changes?.join(' • ') || 'Slot updated'}
                    </p>
                  </div>
                  <span className={clsx(
                    'px-2.5 py-1 rounded-full text-[10px] font-black uppercase',
                    diff.status === 'NEW' && 'bg-emerald-500/20 text-[#00ff88]',
                    diff.status === 'CHANGED' && 'bg-amber-500/20 text-amber-300',
                    diff.status === 'REMOVED' && 'bg-rose-500/20 text-rose-300',
                  )}>
                    {diff.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success / Error Messages */}
        {publishSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5" />
            <span>Timetable successfully committed and published to Supabase database! Realtime active.</span>
          </div>
        )}

        {publishError && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{publishError}</span>
          </div>
        )}

        {/* Modal Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-emerald-500/15">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPublishing}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="neon"
            size="sm"
            onClick={handleApproveAndPublish}
            isLoading={isPublishing}
            leftIcon={<ShieldCheck className="w-4 h-4 text-slate-950" />}
            className="shadow-[0_0_20px_rgba(0,255,136,0.3)]"
          >
            Approve & Publish to Supabase Database
          </Button>
        </div>
      </div>

      {/* Interactive Cell Quick-Editor Modal */}
      {editingSlot && (
        <Modal
          isOpen={true}
          onClose={() => setEditingSlot(null)}
          title={`Edit Slot: ${editingSlot.day} Period ${editingSlot.period}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Subject Code / Name</label>
              <input
                type="text"
                value={editingSlot.subjectCode}
                onChange={(e) => setEditingSlot({ ...editingSlot, subjectCode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Faculty Initials / Code</label>
              <input
                type="text"
                value={editingSlot.facultyCode}
                onChange={(e) => setEditingSlot({ ...editingSlot, facultyCode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white font-bold font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Classroom / Lab Room</label>
              <input
                type="text"
                value={editingSlot.roomNumber}
                onChange={(e) => setEditingSlot({ ...editingSlot, roomNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-white font-bold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingSlot(null)}>Cancel</Button>
              <Button type="button" variant="neon" size="sm" onClick={handleSaveCellEdit}>Update Cell</Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

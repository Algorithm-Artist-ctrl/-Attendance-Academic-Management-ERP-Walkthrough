import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Building2, FileSpreadsheet, FileText, RotateCcw, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAcademic } from '../../context/AcademicContext';
import { aiTimetableService } from '../../lib/services/aiTimetableService';
import { ExtractedTimetableDocument, UploadTargetContext } from '../../types/academic.types';
import { clsx } from 'clsx';

interface AITimetableUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSectionId?: string;
  onExtractionComplete: (extractedDocs: ExtractedTimetableDocument[]) => void;
  onSwitchToCsv?: () => void;
}

export const AITimetableUploadModal: React.FC<AITimetableUploadModalProps> = ({ isOpen, onClose, initialSectionId, onExtractionComplete, onSwitchToCsv }) => {
  const { departments, programs, sessions, years, semesters, sections } = useAcademic();
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [programId, setProgramId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSections = useMemo(() => sections.filter(section => section.active !== false), [sections]);
  const selectedSection = useMemo(() => activeSections.find(section => section.id === sectionId), [activeSections, sectionId]);
  const selectedProgram = useMemo(() => programs.find(item => item.id === programId), [programs, programId]);
  const selectedBranch = useMemo(() => departments.find(item => item.id === branchId), [departments, branchId]);
  const selectedYear = useMemo(() => years.find(item => item.id === yearId), [years, yearId]);
  const selectedSemester = useMemo(() => semesters.find(item => item.id === semesterId), [semesters, semesterId]);
  const selectedSession = useMemo(() => sessions.find(item => item.id === sessionId), [sessions, sessionId]);

  const yearsForProgram = useMemo(() => years.filter(item => !programId || item.program_id === programId), [years, programId]);
  const semestersForYear = useMemo(() => semesters.filter(item => !yearId || item.academic_year_id === yearId), [semesters, yearId]);
  const sectionsForSemester = useMemo(() => activeSections.filter(item => !semesterId || item.semester_id === semesterId), [activeSections, semesterId]);

  useEffect(() => {
    if (!isOpen) return;
    const target = initialSectionId ? activeSections.find(item => item.id === initialSectionId) : selectedSection || activeSections[0];
    if (!target) return;
    setSectionId(target.id);
    setRoomNumber(target.room_number || '');
    const semester = semesters.find(item => item.id === target.semester_id);
    const year = semester ? years.find(item => item.id === semester.academic_year_id) : undefined;
    if (semester) setSemesterId(semester.id);
    if (year) {
      setYearId(year.id);
      setProgramId(year.program_id);
    }
    if (year?.program_id) {
      const program = programs.find(item => item.id === year.program_id);
      if (program) setBranchId(program.department_id);
    }
    const currentSession = sessions.find(item => item.is_current && item.active);
    if (currentSession) {
      setSessionId(currentSession.id);
      setEffectiveFrom(currentSession.start_date || '');
    }
  }, [isOpen, initialSectionId, activeSections, selectedSection, semesters, years, programs, sessions]);

  useEffect(() => {
    if (programId && !yearsForProgram.some(item => item.id === yearId)) setYearId(yearsForProgram[0]?.id || '');
  }, [programId, yearsForProgram, yearId]);

  useEffect(() => {
    if (yearId && !semestersForYear.some(item => item.id === semesterId)) setSemesterId(semestersForYear[0]?.id || '');
  }, [yearId, semestersForYear, semesterId]);

  useEffect(() => {
    if (semesterId && !sectionsForSemester.some(item => item.id === sectionId)) {
      setSectionId(sectionsForSemester[0]?.id || '');
    }
  }, [semesterId, sectionsForSemester, sectionId]);

  useEffect(() => {
    if (selectedSection) setRoomNumber(selectedSection.room_number || '');
  }, [selectedSection]);

  const acceptPdfFiles = (incoming: File[]) => {
    const pdfs = incoming.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    setFiles(pdfs);
    setErrorMessage(pdfs.length !== incoming.length ? 'Only PDF timetable files are supported in this importer. Use the CSV importer for CSV files.' : null);
  };

  const resetFiles = () => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartExtraction = async () => {
    setErrorMessage(null);
    if (!selectedSection || !sessionId || !programId || !branchId || !yearId || !semesterId || !effectiveFrom) {
      setErrorMessage('Complete the target scope using records from the live academic database.');
      return;
    }
    if (!files.length) {
      setErrorMessage('Select at least one PDF timetable file.');
      return;
    }

    setIsExtracting(true);
    setProgress(15);
    setProgressMessage('Uploading PDF...');
    const context: UploadTargetContext = {
      academicSessionId: sessionId,
      academicSessionName: selectedSession?.name,
      programId,
      programName: selectedProgram?.name,
      branchId,
      branchName: selectedBranch?.name,
      academicYearId: yearId,
      academicYearName: selectedYear?.name,
      semesterId,
      semesterName: selectedSemester?.name,
      sectionId,
      sectionName: selectedSection.name,
      roomNumber: roomNumber || selectedSection.room_number || undefined,
      effectiveFrom,
    };

    try {
      const docs = await aiTimetableService.extractMultipleTimetables(files, (percent, name, message) => {
        setProgress(percent);
        setProgressMessage(`${name}: ${message}`);
      }, context);
      onExtractionComplete(docs);
      resetFiles();
      onClose();
    } catch (error: any) {
      console.error('PDF timetable extraction failed:', error);
      setErrorMessage(error?.message || 'PDF timetable extraction failed.');
      setProgress(0);
      setProgressMessage('');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={isExtracting ? () => {} : onClose} title={<div className="flex items-center gap-2.5 text-white"><div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]"><Sparkles className="w-5 h-5" /></div><div><h2 className="text-lg font-black tracking-tight">PDF Timetable Import</h2><p className="text-xs text-slate-400 font-normal">Import a PDF into the selected live academic scope</p></div></div>} maxWidth="2xl">
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15"><span className="text-xs font-black text-white flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-[#00ff88]" />Target Academic Scope</span><span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-[#00ff88] border border-emerald-500/30">{selectedSection ? `Section ${selectedSection.name}` : 'Select section'}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <label><span className="block text-[11px] font-semibold text-slate-400 mb-1">Academic Session</span><select value={sessionId} onChange={e => setSessionId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-white"><option value="">Select session</option>{sessions.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span className="block text-[11px] font-semibold text-slate-400 mb-1">Program / Degree</span><select value={programId} onChange={e => setProgramId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-white"><option value="">Select program</option>{programs.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.code || item.name}</option>)}</select></label>
            <label><span className="block text-[11px] font-semibold text-slate-400 mb-1">Branch / Dept</span><select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-white"><option value="">Select department</option>{departments.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.code || item.name}</option>)}</select></label>
            <label><span className="block text-[11px] font-semibold text-slate-400 mb-1">Academic Year</span><select value={yearId} onChange={e => setYearId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-white"><option value="">Select year</option>{yearsForProgram.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span className="block text-[11px] font-semibold text-slate-400 mb-1">Semester</span><select value={semesterId} onChange={e => setSemesterId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-white"><option value="">Select semester</option>{semestersForYear.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span className="block text-[11px] font-bold text-[#00ff88] mb-1">Target Section *</span><select value={sectionId} onChange={e => setSectionId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border-2 border-emerald-500 rounded-xl text-xs text-white font-black"><option value="">Select section</option>{sectionsForSemester.map(item => <option key={item.id} value={item.id}>Section {item.name}{item.room_number ? ` (${item.room_number})` : ''}</option>)}</select></label>
            <label><span className="block text-[11px] font-semibold text-slate-400 mb-1">Room Number</span><input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="Uses section room when available" className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-white" /></label>
            <label><span className="block text-[11px] font-semibold text-slate-400 mb-1">Effective Date</span><input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-500/25 rounded-xl text-xs text-white" /></label>
          </div>
        </div>

        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); acceptPdfFiles(Array.from(e.dataTransfer.files)); }} onClick={() => fileInputRef.current?.click()} className={clsx('border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer', files.length ? 'border-emerald-500/50 bg-slate-950/70' : 'border-emerald-500/25 bg-slate-950/40 hover:border-emerald-500/60')}>
          <input ref={fileInputRef} type="file" multiple accept="application/pdf,.pdf" onChange={e => acceptPdfFiles(Array.from(e.target.files || []))} className="hidden" />
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88] mx-auto mb-3"><UploadCloud className="w-7 h-7" /></div>
          <h3 className="text-sm font-black text-white">Upload PDF Timetable</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">PDF only. CSV timetables use the dedicated CSV importer.</p>
          <div className="text-[11px] text-emerald-400 font-semibold mt-2">PDF</div>
        </div>

        {isExtracting && (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#00ff88]">PDF Extraction in Progress</span>
              <span className="text-white font-mono">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-[#00ff88] transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 truncate">{progressMessage || 'Processing document with Gemini AI...'}</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div className="space-y-1">
                <p className="font-bold text-rose-200 text-sm">AI Timetable Import Notice</p>
                <p className="text-rose-300/90 leading-relaxed">{errorMessage}</p>
                <p className="text-[11px] text-slate-400">
                  Existing database records for this section remain completely safe and untouched.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/20">
              {files.length > 0 && !isExtracting && (
                <Button
                  type="button"
                  variant="neon"
                  size="sm"
                  onClick={handleStartExtraction}
                  className="text-xs"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Retry Extraction
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onSwitchToCsv) {
                    onSwitchToCsv();
                  } else {
                    onClose();
                    setTimeout(() => {
                      const el = document.getElementById('csv-sync-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }
                }}
                className="text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
              >
                Switch to CSV Import Instead
              </Button>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isExtracting}>Cancel</Button>
          <Button type="button" variant="neon" size="sm" onClick={handleStartExtraction} disabled={!files.length || isExtracting || !sectionId || !sessionId || !effectiveFrom} isLoading={isExtracting} rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}>Extract PDF & Validate</Button>
        </div>
      </div>
    </Modal>
  );
};

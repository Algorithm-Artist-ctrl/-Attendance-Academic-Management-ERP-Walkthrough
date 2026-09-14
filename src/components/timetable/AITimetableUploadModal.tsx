import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Building2, FileText, Sparkles, Trash2, UploadCloud } from 'lucide-react';
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
}

const normalizeName = (value?: string | null) => (value || '').trim().toLowerCase();

export const AITimetableUploadModal: React.FC<AITimetableUploadModalProps> = ({
  isOpen,
  onClose,
  initialSectionId,
  onExtractionComplete,
}) => {
  const { departments, programs, years, semesters, sections } = useAcademic();
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [academicSessionName, setAcademicSessionName] = useState('');
  const [programId, setProgramId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSections = useMemo(() => sections.filter(section => section.active !== false), [sections]);
  const selectedSection = useMemo(
    () => activeSections.find(section => section.id === sectionId),
    [activeSections, sectionId]
  );

  const selectedProgram = useMemo(() => programs.find(program => program.id === programId), [programs, programId]);
  const selectedBranch = useMemo(() => departments.find(department => department.id === branchId), [departments, branchId]);
  const selectedYear = useMemo(() => years.find(year => year.id === yearId), [years, yearId]);
  const selectedSemester = useMemo(() => semesters.find(semester => semester.id === semesterId), [semesters, semesterId]);

  useEffect(() => {
    if (!isOpen) return;

    const target = initialSectionId
      ? activeSections.find(section => section.id === initialSectionId)
      : activeSections.find(section => section.id === sectionId) || activeSections[0];

    if (target) {
      setSectionId(target.id);
      setRoomNumber(target.room_number || '');

      const targetRecord = target as any;
      if (targetRecord.program_id && programs.some(item => item.id === targetRecord.program_id)) {
        setProgramId(targetRecord.program_id);
      }
      if (targetRecord.branch_id && departments.some(item => item.id === targetRecord.branch_id)) {
        setBranchId(targetRecord.branch_id);
      }
      if (targetRecord.academic_year_id && years.some(item => item.id === targetRecord.academic_year_id)) {
        setYearId(targetRecord.academic_year_id);
      }
      if (targetRecord.semester_id && semesters.some(item => item.id === targetRecord.semester_id)) {
        setSemesterId(targetRecord.semester_id);
      }
    } else {
      setSectionId('');
      setRoomNumber('');
    }
  }, [isOpen, initialSectionId, activeSections, programs, departments, years, semesters]);

  useEffect(() => {
    if (!programId && programs.length > 0) setProgramId(programs[0].id);
  }, [programId, programs]);

  useEffect(() => {
    if (!branchId && departments.length > 0) setBranchId(departments[0].id);
  }, [branchId, departments]);

  useEffect(() => {
    if (!yearId && years.length > 0) setYearId(years[0].id);
  }, [yearId, years]);

  useEffect(() => {
    if (!semesterId && semesters.length > 0) setSemesterId(semesters[0].id);
  }, [semesterId, semesters]);

  useEffect(() => {
    if (selectedSection?.room_number) setRoomNumber(selectedSection.room_number);
  }, [selectedSection]);

  const resetTransientState = () => {
    setFiles([]);
    setProgress(0);
    setProgressMessage('');
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const acceptPdfFiles = (incoming: File[]) => {
    const pdfs = incoming.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length !== incoming.length) {
      setErrorMessage('Only PDF timetable files are supported here. CSV files can be imported from the CSV timetable importer.');
    }
    setFiles(pdfs);
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    acceptPdfFiles(Array.from(event.dataTransfer.files));
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptPdfFiles(Array.from(event.target.files || []));
  };

  const handleSectionChange = (nextSectionId: string) => {
    setSectionId(nextSectionId);
    const nextSection = activeSections.find(section => section.id === nextSectionId);
    setRoomNumber(nextSection?.room_number || '');
    const record = nextSection as any;
    if (record?.program_id) setProgramId(record.program_id);
    if (record?.branch_id) setBranchId(record.branch_id);
    if (record?.academic_year_id) setYearId(record.academic_year_id);
    if (record?.semester_id) setSemesterId(record.semester_id);
  };

  const handleStartExtraction = async () => {
    setErrorMessage(null);

    if (!sectionId || !selectedSection) {
      setErrorMessage('Select a valid target section from the live academic structure.');
      return;
    }
    if (!programId || !branchId || !yearId || !semesterId) {
      setErrorMessage('Complete the academic scope using values loaded from the database.');
      return;
    }
    if (!effectiveFrom) {
      setErrorMessage('Select the timetable effective date.');
      return;
    }
    if (!files.length) {
      setErrorMessage('Select at least one PDF timetable file.');
      return;
    }

    setIsExtracting(true);
    setProgress(5);
    setProgressMessage('Preparing PDF timetable for extraction...');

    const uploadContext: UploadTargetContext = {
      academicSessionName: academicSessionName.trim() || undefined,
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
      roomNumber: roomNumber.trim() || undefined,
      effectiveFrom,
    };

    try {
      const results = await aiTimetableService.extractMultipleTimetables(
        files,
        (percent, fileName, message) => {
          setProgress(percent);
          setProgressMessage(`${fileName}: ${message}`);
        },
        uploadContext
      );

      const invalid = results.find(doc => !doc.target_section_id || !doc.schedule.some(day => day.periods.length > 0));
      if (invalid) {
        throw new Error('The PDF did not produce a valid timetable for the selected database section. No timetable was published.');
      }

      setProgress(100);
      setProgressMessage('PDF extracted successfully. Opening validation preview...');
      onExtractionComplete(results);
      resetTransientState();
      onClose();
    } catch (error: any) {
      console.error('PDF timetable extraction failed:', error);
      setErrorMessage(error?.message || 'PDF timetable extraction failed. Check the PDF and try again.');
      setProgress(0);
      setProgressMessage('');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isExtracting ? () => {} : onClose}
      title={
        <div className="flex items-center gap-2.5 text-white">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">PDF Timetable Import</h2>
            <p className="text-xs text-slate-400 font-normal">Import a PDF into the selected live academic scope</p>
          </div>
        </div>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#00ff88]" />
              Target Academic Scope
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-[#00ff88] border border-emerald-500/30">
              {selectedSection ? `Section ${selectedSection.name}` : 'Select section'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">Academic Session</span>
              <input value={academicSessionName} onChange={e => setAcademicSessionName(e.target.value)} placeholder="From academic record" className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white" />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">Program / Degree</span>
              <select value={programId} onChange={e => setProgramId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white">
                {programs.map(item => <option key={item.id} value={item.id}>{item.code || item.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">Branch / Dept</span>
              <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white">
                {departments.map(item => <option key={item.id} value={item.id}>{item.code || item.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">Academic Year</span>
              <select value={yearId} onChange={e => setYearId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white">
                {years.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">Semester</span>
              <select value={semesterId} onChange={e => setSemesterId(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white">
                {semesters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-bold text-[#00ff88] mb-1">Target Section *</span>
              <select value={sectionId} onChange={e => handleSectionChange(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900 border-2 border-emerald-500 rounded-xl text-xs text-white font-black">
                <option value="">Select section</option>
                {activeSections.map(item => <option key={item.id} value={item.id}>Section {item.name}{item.room_number ? ` (${item.room_number})` : ''}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">Room Number</span>
              <input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="Optional; uses section room" className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white" />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-400 mb-1">Effective Date</span>
              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white" />
            </label>
          </div>
        </div>

        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer',
            files.length ? 'border-emerald-500/50 bg-slate-950/70' : 'border-emerald-500/25 bg-slate-950/40 hover:border-emerald-500/60'
          )}
        >
          <input ref={fileInputRef} type="file" multiple accept="application/pdf,.pdf" onChange={handleFileInput} className="hidden" />
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88] mx-auto mb-3">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-black text-white">Upload PDF Timetable</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">PDF only. The selected database section is the authoritative target.</p>
          <div className="text-[11px] text-emerald-400 font-semibold mt-2">PDF</div>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Selected PDF files ({files.length})</span>
              <button type="button" onClick={() => { setFiles([]); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-rose-400 hover:underline">Clear</button>
            </div>
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/15 text-xs text-white">
                <div className="flex items-center gap-2.5 truncate">
                  <FileText className="w-4 h-4 text-[#00ff88] shrink-0" />
                  <span className="font-semibold truncate">{file.name}</span>
                  <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                {!isExtracting && <button type="button" onClick={e => { e.stopPropagation(); setFiles(current => current.filter((_, i) => i !== index)); }} className="p-1 text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        )}

        {isExtracting && (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold"><span className="text-[#00ff88]">PDF extraction</span><span className="text-white font-mono">{progress}%</span></div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-[#00ff88] transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="text-[11px] text-slate-400 truncate">{progressMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isExtracting}>Cancel</Button>
          <Button type="button" variant="neon" size="sm" onClick={handleStartExtraction} disabled={!files.length || isExtracting || !sectionId || !effectiveFrom} isLoading={isExtracting} rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}>
            Extract PDF & Validate
          </Button>
        </div>
      </div>
    </Modal>
  );
};

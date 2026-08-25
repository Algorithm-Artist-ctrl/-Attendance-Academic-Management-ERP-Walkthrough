import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Key, 
  Trash2, 
  Clock, 
  Layers,
  ArrowRight,
  Eye,
  Building2,
  BookOpen,
  Calendar,
  MapPin
} from 'lucide-react';
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

export const AITimetableUploadModal: React.FC<AITimetableUploadModalProps> = ({
  isOpen,
  onClose,
  initialSectionId,
  onExtractionComplete,
}) => {
  const { departments, programs, years, semesters, sections } = useAcademic();

  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [currentProgressMsg, setCurrentProgressMsg] = useState('');
  const [overallPercent, setOverallPercent] = useState(0);
  const [customKey, setCustomKey] = useState(() => aiTimetableService.getApiKey() || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authoritative upload target context fields
  const [academicSession, setAcademicSession] = useState('2026-2027');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [roomNumber, setRoomNumber] = useState<string>('A006');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('2026-08-20');

  // Initialize and synchronize selectors with available academic hierarchy
  useEffect(() => {
    if (programs.length > 0 && !selectedProgramId) {
      const btech = programs.find(p => p.code === 'B.Tech') || programs[0];
      setSelectedProgramId(btech.id);
    }
    if (departments.length > 0 && !selectedDepartmentId) {
      const cse = departments.find(d => d.code === 'CSE') || departments[0];
      setSelectedDepartmentId(cse.id);
    }
    if (years.length > 0 && !selectedYearId) {
      const secondYear = years.find(y => y.year_number === 2) || years[0];
      setSelectedYearId(secondYear.id);
    }
    if (semesters.length > 0 && !selectedSemesterId) {
      const thirdSem = semesters.find(s => s.semester_number === 3) || semesters[0];
      setSelectedSemesterId(thirdSem.id);
    }
    if (sections.length > 0) {
      if (initialSectionId) {
        setSelectedSectionId(initialSectionId);
        const sec = sections.find(s => s.id === initialSectionId);
        if (sec?.room_number) setRoomNumber(sec.room_number);
      } else if (!selectedSectionId) {
        const secB = sections.find(s => s.name.toUpperCase().trim() === 'B') || sections[0];
        setSelectedSectionId(secB.id);
        if (secB?.room_number) setRoomNumber(secB.room_number);
      }
    }
  }, [programs, departments, years, semesters, sections, initialSectionId]);

  const handleSectionChange = (secId: string) => {
    setSelectedSectionId(secId);
    const sec = sections.find(s => s.id === secId);
    if (sec?.room_number) {
      setRoomNumber(sec.room_number);
    } else if (sec?.name === 'B') {
      setRoomNumber('A006');
    } else if (sec?.name === 'A') {
      setRoomNumber('A007');
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const incoming = Array.from(e.dataTransfer.files).filter(f => 
        f.type.startsWith('image/') || f.name.endsWith('.pdf') || f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.jpeg')
      );
      setFiles(prev => [...prev, ...incoming]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      setFiles(prev => [...prev, ...incoming]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStartExtraction = async () => {
    if (!selectedSectionId) {
      setErrorMsg('Please select a section before uploading the timetable.');
      return;
    }

    if (files.length === 0) {
      setErrorMsg('Please select or drop at least one timetable document to analyze.');
      return;
    }

    setIsExtracting(true);
    setErrorMsg(null);
    setOverallPercent(5);
    setCurrentProgressMsg('Initializing AI Vision Multi-Page Pipeline...');

    if (customKey.trim()) {
      aiTimetableService.setApiKey(customKey.trim());
    }

    const currentSec = sections.find(s => s.id === selectedSectionId);
    const currentProg = programs.find(p => p.id === selectedProgramId);
    const currentDept = departments.find(d => d.id === selectedDepartmentId);
    const currentYear = years.find(y => y.id === selectedYearId);
    const currentSem = semesters.find(s => s.id === selectedSemesterId);

    const uploadContext: UploadTargetContext = {
      academicSessionName: academicSession,
      programId: selectedProgramId,
      programName: currentProg?.name || 'B.Tech',
      branchId: selectedDepartmentId,
      branchName: currentDept?.name || 'CSE',
      academicYearId: selectedYearId,
      academicYearName: currentYear?.name || 'Second Year (2026-27)',
      semesterId: selectedSemesterId,
      semesterName: currentSem?.name || '3rd Semester',
      sectionId: selectedSectionId,
      sectionName: currentSec?.name || 'B',
      roomNumber: roomNumber || currentSec?.room_number || 'A006',
      effectiveFrom: effectiveFrom || '2026-08-20',
    };

    try {
      const results = await aiTimetableService.extractMultipleTimetables(
        files,
        (percent, fileName, stepMsg) => {
          setOverallPercent(percent);
          setCurrentProgressMsg(`[${fileName}]: ${stepMsg}`);
        },
        uploadContext
      );

      setOverallPercent(100);
      setCurrentProgressMsg('All timetable pages extracted and validated!');
      setTimeout(() => {
        setIsExtracting(false);
        onClose();
        onExtractionComplete(results);
      }, 600);
    } catch (err: any) {
      console.error('Extraction pipeline failure:', err);
      setErrorMsg(err.message || 'Failed to extract timetable. Please verify files and try again.');
      setIsExtracting(false);
    }
  };

  const selectedSecObj = sections.find(s => s.id === selectedSectionId);

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
            <h2 className="text-lg font-black tracking-tight">
              AI Timetable Document Ingestion
            </h2>
            <p className="text-xs text-slate-400 font-normal">
              Select academic target scope and upload schedule image for AI Vision processing
            </p>
          </div>
        </div>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* 1. AUTHORITATIVE ACADEMIC SCOPE SELECTION FORM */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#00ff88]" />
              Target Academic Scope (Source of Truth)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-[#00ff88] border border-emerald-500/30">
              Section: {selectedSecObj?.name ? `Section ${selectedSecObj.name}` : 'Not Selected'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Academic Session */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Academic Session</label>
              <input
                type="text"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                placeholder="2026-2027"
                className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white font-medium focus:outline-none focus:border-[#00ff88]"
              />
            </div>

            {/* Program */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Program / Degree</label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white font-medium focus:outline-none focus:border-[#00ff88]"
              >
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.code || p.name}</option>
                ))}
              </select>
            </div>

            {/* Department / Branch */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Branch / Dept</label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white font-medium focus:outline-none focus:border-[#00ff88]"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.code || d.name}</option>
                ))}
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Academic Year</label>
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white font-medium focus:outline-none focus:border-[#00ff88]"
              >
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Semester</label>
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white font-medium focus:outline-none focus:border-[#00ff88]"
              >
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Section (CRITICAL - Selected Section is authoritative) */}
            <div>
              <label className="block text-[11px] font-bold text-[#00ff88] mb-1">Target Section *</label>
              <select
                value={selectedSectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border-2 border-emerald-500 rounded-xl text-xs text-white font-black focus:outline-none focus:border-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.2)]"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    Section {s.name} ({s.room_number || 'Room TBD'})
                  </option>
                ))}
              </select>
            </div>

            {/* Classroom */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Room Number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="A006"
                className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white font-medium focus:outline-none focus:border-[#00ff88]"
              />
            </div>

            {/* Effective From Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Effective Date (W.E.F.)</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-emerald-500/25 rounded-xl text-xs text-white font-medium focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>
        </div>

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className={clsx(
            'border-2 border-dashed rounded-3xl p-7 text-center transition-all cursor-pointer relative overflow-hidden',
            files.length > 0 
              ? 'border-emerald-500/50 bg-slate-950/70' 
              : 'border-emerald-500/25 bg-slate-950/40 hover:border-emerald-500/60 hover:bg-slate-950/60'
          )}
          onClick={() => {
            const input = document.getElementById('timetable-file-input');
            if (input) input.click();
          }}
        >
          <input
            id="timetable-file-input"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/jpg,application/pdf"
            onChange={handleFileInput}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88] mx-auto mb-2.5 shadow-[0_0_20px_rgba(0,255,136,0.15)]">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-sm font-black text-white">
            Upload Section {selectedSecObj?.name || 'B'} Timetable Document
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Drag & drop timetable images (PNG, JPG) or PDFs for AI schedule extraction
          </p>
          <div className="flex items-center justify-center gap-2 mt-2.5 text-[11px] text-emerald-400 font-semibold">
            <span>JPG</span> • <span>PNG</span> • <span>PDF</span>
          </div>
        </div>

        {/* Selected File Queue */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
              <span>Selected Document Pages ({files.length})</span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-rose-400 hover:underline cursor-pointer"
              >
                Clear All
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/15 text-xs text-white"
                >
                  <div className="flex items-center gap-2.5 truncate max-w-md">
                    <FileText className="w-4 h-4 text-[#00ff88] shrink-0" />
                    <span className="font-semibold truncate">{f.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({(f.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>

                  {!isExtracting && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gemini Vision API Key Configuration */}
        <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/15 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Key className="w-4 h-4 text-[#00ff88]" />
              <span>Google Gemini AI Vision Engine</span>
            </div>
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
            >
              {showKeyInput ? 'Hide Settings' : 'Configure API Key'}
            </button>
          </div>

          {showKeyInput && (
            <div className="pt-2">
              <input
                type="password"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="Enter custom Gemini API Key (Optional — Uses default server key if empty)"
                className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          )}
        </div>

        {/* Progress & Error States */}
        {isExtracting && (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#00ff88] flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                AI Multimodal Processing...
              </span>
              <span className="text-white font-mono">{overallPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-[#00ff88] transition-all duration-300 shadow-[0_0_10px_#00ff88]"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 truncate">{currentProgressMsg}</p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isExtracting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="neon"
            size="sm"
            onClick={handleStartExtraction}
            disabled={files.length === 0 || isExtracting || !selectedSectionId}
            isLoading={isExtracting}
            rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
          >
            Extract & Analyze for Section {selectedSecObj?.name || 'B'} ({files.length})
          </Button>
        </div>
      </div>
    </Modal>
  );
};

import React, { useState } from 'react';
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
  Eye
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { aiTimetableService } from '../../lib/services/aiTimetableService';
import { ExtractedTimetableDocument } from '../../types/academic.types';
import { clsx } from 'clsx';

interface AITimetableUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtractionComplete: (extractedDocs: ExtractedTimetableDocument[]) => void;
}

export const AITimetableUploadModal: React.FC<AITimetableUploadModalProps> = ({
  isOpen,
  onClose,
  onExtractionComplete,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [currentProgressMsg, setCurrentProgressMsg] = useState('');
  const [overallPercent, setOverallPercent] = useState(0);
  const [customKey, setCustomKey] = useState(() => aiTimetableService.getApiKey() || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    if (files.length === 0) return;
    setIsExtracting(true);
    setErrorMsg(null);
    setOverallPercent(5);
    setCurrentProgressMsg('Initializing AI Vision Multi-Page Pipeline...');

    if (customKey.trim()) {
      aiTimetableService.setApiKey(customKey.trim());
    }

    try {
      const results = await aiTimetableService.extractMultipleTimetables(
        files,
        (percent, fileName, stepMsg) => {
          setOverallPercent(percent);
          setCurrentProgressMsg(`[${fileName}]: ${stepMsg}`);
        }
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
              Upload multi-page academic schedules (JPG, PNG, PDF) for AI Vision extraction
            </p>
          </div>
        </div>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Dropzone Area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className={clsx(
            'border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer relative overflow-hidden',
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

          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88] mx-auto mb-3 shadow-[0_0_20px_rgba(0,255,136,0.15)]">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-sm font-black text-white">
            Click to upload or drag and drop timetable images
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Supports multiple pages/files simultaneously (e.g. 2nd Year Sec A, Sec B, 3rd Year, Diploma, MCA)
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-emerald-400 font-semibold">
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

            <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
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
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 text-xs space-y-2">
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
              <p className="text-[10px] text-slate-400 mt-1">
                Powered by Gemini 2.5 Flash Multimodal Vision for sub-second table cell understanding.
              </p>
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
            disabled={files.length === 0 || isExtracting}
            isLoading={isExtracting}
            rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
          >
            Extract & Analyze with AI ({files.length})
          </Button>
        </div>
      </div>
    </Modal>
  );
};

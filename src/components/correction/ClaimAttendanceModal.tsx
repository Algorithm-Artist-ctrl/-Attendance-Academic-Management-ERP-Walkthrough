import React, { useState } from 'react';
import { 
  CheckCircle2, 
  RotateCcw, 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  AlertCircle,
  MapPin,
  HelpCircle,
  Send,
  X
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useAcademic, TodayAttendanceLecture } from '../../context/AcademicContext';
import { clsx } from 'clsx';

interface ClaimAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lecture: TodayAttendanceLecture | null;
  onClaimSubmitted?: () => void;
}

export const ClaimAttendanceModal: React.FC<ClaimAttendanceModalProps> = ({
  isOpen,
  onClose,
  lecture,
  onClaimSubmitted,
}) => {
  const { user } = useAuth();
  const { 
    submitCorrectionRequest, 
    canSubmitClaim, 
    claimWindowDays 
  } = useAcademic();

  const student = user?.student;
  const studentId = student?.id || '';

  const [reason, setReason] = useState<string>('I was present in the class, but my attendance was marked absent by mistake.');
  const [customReason, setCustomReason] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!lecture) return null;

  const presets = [
    'I was physically present in the classroom, but marked absent by mistake.',
    'I arrived slightly late due to lab setup and attended the full lecture.',
    'My roll number was missed during the physical roll call.',
    'Present in class; verified in lab sign-in register.',
    'Other reason (type custom justification below)'
  ];

  const handlePresetSelect = (index: number) => {
    setSelectedPreset(index);
    if (index === presets.length - 1) {
      setReason(customReason);
    } else {
      setReason(presets[index]);
    }
  };

  const handleCustomReasonChange = (val: string) => {
    setCustomReason(val);
    if (selectedPreset === presets.length - 1) {
      setReason(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecture.attendanceRecordId) {
      setErrorMessage('No attendance record found for this lecture.');
      return;
    }

    const finalReason = reason.trim();
    if (!finalReason) {
      setErrorMessage('Please state the reason for your attendance claim.');
      return;
    }

    // Validate using helper
    const validation = canSubmitClaim({
      attendanceRecordId: lecture.attendanceRecordId,
      sessionDate: lecture.sessionDate,
    });

    if (!validation.canSubmit) {
      setErrorMessage(validation.message || 'Unable to submit claim.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitCorrectionRequest({
        attendanceRecordId: lecture.attendanceRecordId,
        studentId,
        requestedStatus: 'Present',
        reason: finalReason,
      });

      setSuccessMessage('Attendance claim submitted successfully! It has been routed to your assigned faculty coordinator.');
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessMessage(null);
        if (onClaimSubmitted) onClaimSubmitted();
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit attendance claim to Supabase.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-white">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[#00ff88]">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">Claim Lecture Attendance</h2>
            <p className="text-xs text-slate-400 font-normal">Report attendance discrepancy directly to assigned faculty</p>
          </div>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#00ff88]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Readonly Lecture Info Card */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2.5">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Scheduled Lecture</span>
              <h3 className="text-sm font-black text-white">{lecture.subjectName} ({lecture.subjectCode})</h3>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/25 text-[#00ff88] font-mono text-xs font-bold">
              {lecture.startTime} – {lecture.endTime}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Assigned Faculty</span>
              <span className="font-bold text-white">{lecture.facultyName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Date & Day</span>
              <span className="font-bold text-white">{lecture.sessionDate} ({lecture.dayOfWeek})</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Classroom / Section</span>
              <span className="font-bold text-white">{lecture.roomNumber} • Sec {lecture.sectionName}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Recorded Status:</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[11px]">
                ● ABSENT
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Claiming:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30 font-bold text-[11px]">
                ● PRESENT
              </span>
            </div>
          </div>
        </div>

        {/* Claim Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              Select Justification Reason
            </label>
            <div className="space-y-2">
              {presets.map((p, idx) => (
                <label
                  key={idx}
                  onClick={() => handlePresetSelect(idx)}
                  className={clsx(
                    'p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all',
                    selectedPreset === idx
                      ? 'bg-emerald-500/10 border-[#00ff88] text-white font-semibold shadow-[0_0_12px_rgba(0,255,136,0.15)]'
                      : 'bg-slate-950/50 border-emerald-500/15 text-slate-400 hover:border-emerald-500/30 hover:text-slate-200'
                  )}
                >
                  <input
                    type="radio"
                    name="claimPreset"
                    checked={selectedPreset === idx}
                    onChange={() => handlePresetSelect(idx)}
                    className="accent-[#00ff88]"
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedPreset === presets.length - 1 && (
            <div className="animate-in fade-in">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Detailed Reason / Remarks
              </label>
              <textarea
                rows={3}
                value={customReason}
                onChange={(e) => handleCustomReasonChange(e.target.value)}
                placeholder="Explain clearly why your attendance was marked absent..."
                className="w-full p-3 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
                required
              />
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950/40 border border-emerald-500/10 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Claim Policy Window: <strong>{claimWindowDays} Days</strong></span>
            <span>Target Reviewer: <strong className="text-white">{lecture.facultyName}</strong></span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-emerald-500/15">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="neon"
              size="sm"
              disabled={isSubmitting || !!successMessage}
              leftIcon={<Send className="w-3.5 h-3.5 text-slate-950" />}
            >
              {isSubmitting ? 'Submitting Claim...' : 'Submit Attendance Claim'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

import React, { useState, useMemo } from 'react';
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
  } = useAcademic();

  const student = user?.student;
  const studentId = student?.id || '';

  const [reason, setReason] = useState<string>('I was present in the class, but my attendance was marked absent by mistake.');
  const [customReason, setCustomReason] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Validate claim window and eligibility
  const claimValidation = useMemo(() => {
    if (!lecture) return { canSubmit: false, message: 'No lecture selected.' };
    return canSubmitClaim({
      attendanceRecordId: lecture.attendanceRecordId,
      sessionDate: lecture.sessionDate,
      lectureType: lecture.lectureType,
      timetableEntryId: lecture.timetableEntryId,
      startTime: lecture.startTime,
      endTime: lecture.endTime,
    });
  }, [lecture, canSubmitClaim]);

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

    const finalReason = reason.trim();
    if (!finalReason) {
      setErrorMessage('Please state the reason for your attendance claim.');
      return;
    }

    // Validate using helper
    if (!claimValidation.canSubmit) {
      setErrorMessage(claimValidation.message || 'Attendance claim window is closed.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitCorrectionRequest({
        attendanceRecordId: lecture.attendanceRecordId,
        timetableEntryId: lecture.timetableEntryId,
        sessionDate: lecture.sessionDate,
        subjectId: lecture.subjectId,
        facultyId: lecture.facultyId,
        sectionId: lecture.sectionId,
        studentId,
        requestedStatus: 'Present',
        reason: finalReason,
      });

      setSuccessMessage('Attendance claim submitted successfully! Routed to assigned faculty.');
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessMessage(null);
        if (onClaimSubmitted) onClaimSubmitted();
        onClose();
      }, 500);
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
        <div className="flex items-center gap-2.5 text-slate-900">
          <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-900">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight font-serif-institutional">Claim Lecture Attendance</h2>
            <p className="text-xs text-slate-500 font-normal">Report attendance discrepancy directly to assigned faculty</p>
          </div>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Readonly Lecture Info Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Scheduled Lecture</span>
              <h3 className="text-sm font-black text-slate-900">{lecture.subjectName} ({lecture.subjectCode})</h3>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono text-xs font-bold shadow-2xs">
              {lecture.startTime} – {lecture.endTime}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Assigned Faculty</span>
              <span className="font-bold text-slate-900">{lecture.facultyName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Date & Day</span>
              <span className="font-bold text-slate-900">{lecture.sessionDate} ({lecture.dayOfWeek})</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Classroom / Section</span>
              <span className="font-bold text-slate-900">{lecture.roomNumber} • Sec {lecture.sectionName}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Recorded Status:</span>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                ● ABSENT
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Claiming:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                ● PRESENT
              </span>
            </div>
          </div>
        </div>

        {/* Claim Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
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
                      ? 'bg-slate-100 border-slate-900 text-slate-900 font-semibold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  )}
                >
                  <input
                    type="radio"
                    name="claimPreset"
                    checked={selectedPreset === idx}
                    onChange={() => handlePresetSelect(idx)}
                    className="accent-slate-900"
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedPreset === presets.length - 1 && (
            <div className="animate-in fade-in">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Detailed Reason / Remarks
              </label>
              <textarea
                rows={3}
                value={customReason}
                onChange={(e) => handleCustomReasonChange(e.target.value)}
                placeholder="Explain clearly why your attendance was marked absent..."
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                required
              />
            </div>
          )}

          {!claimValidation.canSubmit && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{claimValidation.message}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Daily Claim Window: <strong className="text-slate-900">09:00 AM – 03:40 PM IST</strong></span>
            <span>Target Reviewer: <strong className="text-slate-900">{lecture.facultyName}</strong></span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
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
              disabled={isSubmitting || !!successMessage || !claimValidation.canSubmit}
              leftIcon={<Send className="w-3.5 h-3.5 text-white" />}
            >
              {isSubmitting ? 'Submitting Claim...' : 'Submit Attendance Claim'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

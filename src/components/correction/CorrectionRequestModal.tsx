import React, { useState } from 'react';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AttendanceRecord, AttendanceStatus } from '../../types/database.types';
import { useAcademic } from '../../context/AcademicContext';

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  studentId: string;
  onSuccess?: () => void;
}

export const CorrectionRequestModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  onClose,
  record,
  studentId,
  onSuccess,
}) => {
  const { submitCorrectionRequest } = useAcademic();
  const [requestedStatus, setRequestedStatus] = useState<AttendanceStatus>('Present');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!record) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError('Please provide a specific reason for attendance correction.');
      return;
    }

    setIsSubmitting(true);
    try {
      submitCorrectionRequest({
        attendanceRecordId: record.id,
        studentId: studentId,
        requestedStatus: requestedStatus,
        reason: reason.trim(),
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setReason('');
        onClose();
        if (onSuccess) onSuccess();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to submit correction request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
            <RotateCcw className="w-4 h-4" />
          </div>
          <span>Request Attendance Correction</span>
        </div>
      }
      description="Submit a verified attendance rectification request to your assigned faculty."
      maxWidth="md"
    >
      {isSuccess ? (
        <div className="py-8 text-center space-y-3 animate-in zoom-in-95">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h4 className="text-base font-bold text-slate-800">Correction Request Submitted!</h4>
          <p className="text-xs text-slate-500">
            Your request has been forwarded to the concerned faculty member for review.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* Lecture Info Summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Subject:</span>
              <span className="font-semibold text-slate-800">
                {record.session?.subject?.subject_name} ({record.session?.subject?.subject_code})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Lecture Date:</span>
              <span className="font-semibold text-slate-800">{record.session?.session_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Recorded Status:</span>
              <span className={`font-bold ${record.status === 'Present' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {record.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Marked By Faculty:</span>
              <span className="font-medium text-slate-700">{record.session?.faculty?.full_name}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Requested Correct Status
            </label>
            <select
              value={requestedStatus}
              onChange={(e) => setRequestedStatus(e.target.value as AttendanceStatus)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Correction <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. I was present in the classroom, but my response was missed during the initial roll call."
              className="w-full text-sm border border-slate-200 rounded-lg p-3 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="navy" isLoading={isSubmitting}>
              Submit Request
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

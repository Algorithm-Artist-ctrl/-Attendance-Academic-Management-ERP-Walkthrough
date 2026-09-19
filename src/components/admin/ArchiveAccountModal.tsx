import React, { useState, useEffect } from 'react';
import { 
  Archive, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  FileText, 
  User, 
  X, 
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AccountStatus } from '../../types/database.types';
import { useAcademic } from '../../context/AcademicContext';
import { getISTTodayDate } from '../../lib/utils/dateUtils';

export interface ArchiveTarget {
  id: string;
  name: string;
  role: 'student' | 'faculty';
  identifier?: string; // Roll number or Employee code
  currentStatus?: AccountStatus;
  email?: string;
}

interface ArchiveAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ArchiveTarget | null;
  onSuccess?: () => void;
}

export const ArchiveAccountModal: React.FC<ArchiveAccountModalProps> = ({
  isOpen,
  onClose,
  target,
  onSuccess
}) => {
  const { archiveAccount } = useAcademic();
  const [exitStatus, setExitStatus] = useState<AccountStatus>('ARCHIVED');
  const [exitDate, setExitDate] = useState<string>(getISTTodayDate());
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && target) {
      // Default exit status tailored to role
      if (target.role === 'student') {
        setExitStatus('WITHDRAWN');
      } else {
        setExitStatus('RESIGNED');
      }
      setExitDate(getISTTodayDate());
      setReason('');
      setError(null);
    }
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason or administrative note for archiving this account.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await archiveAccount({
        targetId: target.id,
        entityType: target.role,
        exitStatus,
        exitDate,
        reason: reason.trim(),
      });

      if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || 'Failed to archive account.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while archiving the account.');
    } finally {
      setLoading(false);
    }
  };

  const studentStatusOptions: { value: AccountStatus; label: string }[] = [
    { value: 'WITHDRAWN', label: 'Withdrawn (Left Institution)' },
    { value: 'TRANSFERRED', label: 'Transferred (Migrated to other College)' },
    { value: 'DROPPED_OUT', label: 'Dropped Out' },
    { value: 'GRADUATED', label: 'Graduated / Degree Completed' },
    { value: 'ARCHIVED', label: 'General Administrative Archive' },
    { value: 'SUSPENDED', label: 'Suspended (Disciplinary Action)' },
  ];

  const facultyStatusOptions: { value: AccountStatus; label: string }[] = [
    { value: 'RESIGNED', label: 'Resigned (Voluntary Departure)' },
    { value: 'TRANSFERRED', label: 'Transferred to other Unit/Campus' },
    { value: 'ARCHIVED', label: 'General Administrative Archive' },
    { value: 'SUSPENDED', label: 'Suspended' },
  ];

  const statusOptions = target.role === 'student' ? studentStatusOptions : facultyStatusOptions;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Header Badge */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Institutional Lifecycle
            </span>
            <h2 className="text-lg font-black text-white mt-1">Archive Institutional Account</h2>
            <p className="text-xs text-slate-400">
              Preserve institutional historical records while revoking active operational privileges.
            </p>
          </div>
        </div>

        {/* Target Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Person Name</span>
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              {target.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Role & Identifier</span>
            <span className="text-xs font-semibold text-slate-200">
              <span className="capitalize">{target.role}</span>
              {target.identifier ? ` • ${target.identifier}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Current Status</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {target.currentStatus || 'ACTIVE'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Exit Status Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Exit / Archival Status <span className="text-rose-400">*</span>
            </label>
            <select
              value={exitStatus}
              onChange={(e) => setExitStatus(e.target.value as AccountStatus)}
              className="w-full px-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Exit Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Official Exit / Effective Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white focus:border-amber-400 focus:outline-none"
              required
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Reason for Departure / Archival <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide reason (e.g., Graduated cohort 2026, voluntary transfer to state university, resignation approved by Dean)..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none resize-none"
              required
            />
          </div>

          {/* Preservation Guarantee Checklist */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
            <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              Institutional Preservation Guarantees:
            </p>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Disable login access</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Preserve attendance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Revoke active sessions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Preserve sessional marks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Remove from active lists</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Permanent audit trail</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={loading}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold border-none"
              leftIcon={<Archive className="w-3.5 h-3.5" />}
            >
              Confirm Archive
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

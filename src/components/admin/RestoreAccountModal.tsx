import React, { useState } from 'react';
import { 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  User, 
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AccountStatus } from '../../types/database.types';
import { useAcademic } from '../../context/AcademicContext';

export interface RestoreTarget {
  id: string;
  name: string;
  role: 'student' | 'faculty';
  identifier?: string;
  currentStatus?: AccountStatus;
  email?: string;
  exitReason?: string;
  exitDate?: string;
}

interface RestoreAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: RestoreTarget | null;
  onSuccess?: () => void;
}

export const RestoreAccountModal: React.FC<RestoreAccountModalProps> = ({
  isOpen,
  onClose,
  target,
  onSuccess
}) => {
  const { restoreAccount } = useAcademic();
  const [reason, setReason] = useState<string>('Account restored to active status by Super Admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !target) return null;

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await restoreAccount({
        targetId: target.id,
        entityType: target.role,
        reason: reason.trim() || 'Restored by Super Admin',
      });

      if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || 'Failed to restore account.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while restoring the account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restore Account to Active Status"
      maxWidth="md"
    >
      <form onSubmit={handleRestore} className="space-y-6">
        {/* Warning Banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-300 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-emerald-300">
              Safe Institutional Restoration
            </p>
            <p className="text-emerald-200/80 leading-relaxed text-xs">
              Restoring this record will re-enable authentication and mark the account as <span className="text-emerald-400 font-bold">ACTIVE</span>. All prior academic records (attendance, marks, assignments) will remain completely intact without duplicate entries.
            </p>
          </div>
        </div>

        {/* Target Profile Summary */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center text-primary-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-base">{target.name}</h4>
                <p className="text-xs text-slate-400">
                  {target.role === 'student' ? 'Student' : 'Faculty Member'} •{' '}
                  <span className="font-mono text-slate-300">{target.identifier || target.email || target.id.slice(0, 8)}</span>
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {target.currentStatus || 'ARCHIVED'}
            </span>
          </div>

          {target.exitReason && (
            <div className="text-xs text-slate-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
              <span className="text-slate-500 font-medium">Archive Note: </span>
              {target.exitReason} {target.exitDate && `(${target.exitDate})`}
            </div>
          )}
        </div>

        {/* Impact Checklist */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Restoration Safeguards & Effects
          </p>
          <div className="space-y-1.5 text-xs text-slate-300 bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Unbans Auth login and grants active access credentials</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Re-enters active student/faculty directories and class registries</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Preserves 100% of historical attendance and academic assessments</span>
            </div>
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Does not automatically recreate previous teaching assignments (assign manually if needed)</span>
            </div>
          </div>
        </div>

        {/* Reason / Admin Note */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Administrative Restoration Note
          </label>
          <div className="relative">
            <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Student re-admission approved by Academic Dean; mistake corrected..."
              rows={2}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary-500/50 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 border border-emerald-500/50 shadow-lg shadow-emerald-600/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Restoring Account...
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Account
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

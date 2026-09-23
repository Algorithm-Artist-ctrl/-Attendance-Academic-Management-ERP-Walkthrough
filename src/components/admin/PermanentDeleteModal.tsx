import React, { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Database,
  CheckCircle2,
  X,
  FileText
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { supabaseService } from '../../lib/services/supabaseService';

export interface PermanentDeleteTarget {
  id: string;
  name: string;
  role: 'student' | 'faculty';
  identifier?: string;
  status?: string;
  email?: string;
  department?: string;
}

interface PermanentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: PermanentDeleteTarget | null;
  onSuccess?: () => void;
}

export const PermanentDeleteModal: React.FC<PermanentDeleteModalProps> = ({
  isOpen,
  onClose,
  target,
  onSuccess
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [dependencies, setDependencies] = useState<Record<string, number> | null>(null);
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && target) {
      setConfirmationInput('');
      setError(null);
      setLoadingDependencies(true);

      supabaseService.fetchAccountDependencies(target.id, target.role)
        .then((res) => {
          if (res?.dependencies) {
            setDependencies(res.dependencies);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch dependencies preview:', err);
        })
        .finally(() => {
          setLoadingDependencies(false);
        });
    } else {
      setDependencies(null);
      setConfirmationInput('');
      setError(null);
    }
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const totalDependentRecords = dependencies
    ? Object.values(dependencies).reduce((sum, count) => sum + count, 0)
    : 0;

  const isConfirmed = confirmationInput.trim() === 'DELETE';

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDeleting) return;
    if (!isConfirmed) {
      setError('You must type "DELETE" exactly to confirm permanent deletion.');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await supabaseService.permanentDeleteAccount(target.id, target.role, 'DELETE');
      if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(res.message || 'Failed to permanently delete account.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred during account deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose}
      title={
        <div className="flex items-center gap-2 text-rose-700">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <span>Permanent Account Deletion</span>
        </div>
      }
      description="Irreversible Super Admin Action — Full Purge"
    >
      <form onSubmit={handleDelete} className="space-y-4 pt-2">
        {/* Critical Danger Banner */}
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 space-y-1">
            <span className="font-bold block">
              WARNING: This operation is permanent and cannot be undone!
            </span>
            <p className="text-rose-800 leading-relaxed">
              Permanently deleting this account will remove login credentials and purge personal communications. In accordance with institutional retention policies, student attendance and examination records are safely preserved under the Institutional Archive.
            </p>
          </div>
        </div>

        {/* Target Profile Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Target Entity:</span>
            <span className="font-bold text-slate-900 text-sm">{target.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Role / Type:</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
              {target.role}
            </span>
          </div>
          {target.identifier && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{target.role === 'student' ? 'Roll Number:' : 'Employee Code:'}</span>
              <span className="font-mono font-bold text-slate-800">{target.identifier}</span>
            </div>
          )}
          {target.email && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Official Email:</span>
              <span className="font-mono text-slate-700">{target.email}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Archive Status:</span>
            <span className="font-semibold text-amber-800">{target.status || 'ARCHIVED'}</span>
          </div>
        </div>

        {/* Dependent Records Breakdown */}
        <div className="border border-slate-200 rounded-2xl p-3.5 bg-white space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              Linked Database Records Analysis
            </span>
            {loadingDependencies ? (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Scanning database...
              </span>
            ) : (
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {totalDependentRecords} total records
              </span>
            )}
          </div>

          {dependencies && Object.keys(dependencies).length > 0 ? (
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              {Object.entries(dependencies).map(([label, count]) => {
                const isPreserved = label.includes('(Preserved)');
                return (
                  <div key={label} className="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <span className="text-slate-600 text-[11px] truncate max-w-[145px]" title={label}>{label}</span>
                    <span className={`font-mono font-bold text-[11px] ${
                      count > 0 
                        ? (isPreserved ? 'text-emerald-700' : 'text-rose-600') 
                        : 'text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : !loadingDependencies ? (
            <p className="text-[11px] text-slate-400 italic">No active dependencies found.</p>
          ) : null}
        </div>

        {/* Typed Confirmation Prompt */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-semibold text-slate-800">
            Type <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">DELETE</span> to confirm permanent destruction:
          </label>
          <input
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder="DELETE"
            disabled={isDeleting}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold tracking-wider placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            autoFocus
          />
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>

          <button
            type="submit"
            disabled={!isConfirmed || isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs transition-colors"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Purging Account...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Permanently Delete Account
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose }) => {
  const { user, role, completePasswordRecovery, cancelPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isStudent = role === 'student' || user?.role === 'student' || (user?.email && user.email.toLowerCase().includes('@student.'));

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isStudent) {
      setErrorMessage('For security reasons, students cannot reset their password directly.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await completePasswordRecovery(newPassword);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to update account password.');
      } else {
        setSuccessMessage('Password successfully updated! Redirecting to your ERP dashboard...');
        setTimeout(() => {
          if (onClose) onClose();
        }, 1800);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    cancelPasswordRecovery();
    if (onClose) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={
        <div className="flex items-center gap-2.5 text-white">
          <div className={`p-1.5 rounded-lg ${isStudent ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-[#00ff88]'}`}>
            {isStudent ? <ShieldAlert className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
          </div>
          <span>Password Recovery</span>
        </div>
      }
      description={
        isStudent
          ? 'Student account security policy'
          : user?.email
          ? `Setting new password for verified recovery session: ${user.email}`
          : 'Enter your new secure password to finalize account recovery'
      }
      maxWidth="md"
    >
      {isStudent ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Password Recovery Restricted</span>
            </div>
            <p className="text-slate-300 text-sm font-medium">
              For security reasons, students cannot reset their password directly.
            </p>
            <p className="text-slate-400 text-xs">
              Please contact your Super Admin / College Administrator to reset your account password.
            </p>
          </div>

          <div className="flex justify-end pt-3 border-t border-emerald-500/15">
            <Button
              type="button"
              variant="neon"
              onClick={handleCancel}
            >
              Back to Login
            </Button>
          </div>
        </div>
      ) : successMessage ? (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-3 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-[#00ff88]">
            <CheckCircle2 className="w-5 h-5" />
            <span>Password Updated Successfully</span>
          </div>
          <p>{successMessage}</p>
        </div>
      ) : (
        <form onSubmit={handleResetSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              New Password (minimum 6 characters)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-900/80 border border-emerald-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-900/80 border border-emerald-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-emerald-500/15">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel Recovery
            </Button>
            <Button
              type="submit"
              variant="neon"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4 text-slate-950" />}
            >
              Update Password & Enter ERP
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

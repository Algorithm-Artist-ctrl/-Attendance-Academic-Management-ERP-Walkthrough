import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, KeyRound, ArrowRight, ShieldAlert, Lock } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalRole?: 'student' | 'faculty' | 'admin' | string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ 
  isOpen, 
  onClose,
  portalRole = 'student',
}) => {
  const { resetPasswordForEmail } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isStudent = portalRole === 'student';

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setErrorMessage('Please enter your registered Employee ID or Official Email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordForEmail(cleanInput);

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to dispatch recovery link.');
      } else {
        setStatusMessage(`A password reset link has been dispatched to ${res.email || cleanInput}. Please check your institutional email inbox and click the link to choose a new password.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while requesting password recovery.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. STUDENT RECOVERY VIEW: Informational only, no inputs, no reset links
  if (isStudent) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2.5 text-slate-900 font-bold">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
            </div>
            <span>Password Recovery</span>
          </div>
        }
        maxWidth="md"
      >
        <div className="space-y-5 py-1">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mx-auto shadow-xs">
              <Lock className="w-6 h-6 text-amber-700" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-900 leading-snug">
                For security reasons, students cannot reset their password directly.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Please contact your Super Admin / College Administrator to reset your account password.
              </p>
            </div>
          </div>

          <div className="flex justify-center pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="neon"
              onClick={onClose}
              className="w-full font-bold text-xs py-2.5"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // 2. FACULTY / ADMIN RECOVERY VIEW: Self-service email reset link flow
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-slate-900 font-bold">
          <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
            <KeyRound className="w-4 h-4" />
          </div>
          <span>Recover VCTM Account Password</span>
        </div>
      }
      description="Enter your registered Employee ID or Official Email to receive password reset instructions"
      maxWidth="md"
    >
      {statusMessage ? (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Recovery Dispatched</span>
          </div>
          <p>{statusMessage}</p>
          <Button variant="neon" size="sm" onClick={onClose} className="w-full mt-2">
            Return to Sign In
          </Button>
        </div>
      ) : (
        <form onSubmit={handleResetRequest} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Registered Employee ID or Official Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. Employee ID / Official Email"
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="neon" isLoading={isSubmitting} rightIcon={<ArrowRight className="w-4 h-4 text-white" />}>
              Send Reset Link
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

import React from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { AttendanceStatus, CorrectionStatus } from '../../types/database.types';

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus | CorrectionStatus | 'Not Recorded';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const AttendanceStatusBadge: React.FC<AttendanceStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-3.5 py-2 text-[15px] gap-2',
  };

  const configMap: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode; glow?: string }> = {
    Present: {
      label: '✓ PRESENT',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      glow: 'shadow-2xs',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />,
    },
    Absent: {
      label: '✕ ABSENT',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-300',
      glow: 'shadow-2xs',
      icon: <XCircle className="w-3.5 h-3.5 text-rose-700" />,
    },
    'Not Recorded': {
      label: '— NOT RECORDED',
      bg: 'bg-slate-100',
      text: 'text-[#52627A]',
      border: 'border-slate-300',
      icon: <Clock className="w-3.5 h-3.5 text-[#52627A]" />,
    },
    pending: {
      label: '⏳ PENDING',
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      border: 'border-amber-300',
      icon: <AlertCircle className="w-3.5 h-3.5 text-amber-700" />,
    },
    approved: {
      label: '✓ APPROVED',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      glow: 'shadow-2xs',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />,
    },
    rejected: {
      label: '✕ REJECTED',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-300',
      icon: <XCircle className="w-3.5 h-3.5 text-rose-700" />,
    },
  };

  const current = configMap[status] || configMap['Not Recorded'];

  return (
    <span
      className={clsx(
        'inline-flex items-center font-bold rounded-full border transition-all select-none',
        current.bg,
        current.text,
        current.border,
        current.glow,
        sizeStyles[size],
        className
      )}
    >
      {showIcon && current.icon}
      <span>{current.label}</span>
    </span>
  );
};

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
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const configMap: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode; glow?: string }> = {
    Present: {
      label: 'Present',
      bg: 'bg-[#0f172a]',
      text: 'text-white',
      border: 'border-slate-900',
      glow: 'shadow-xs',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-white" />,
    },
    Absent: {
      label: 'Absent',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      icon: <XCircle className="w-3.5 h-3.5 text-slate-500" />,
    },
    'Not Recorded': {
      label: 'Not Recorded',
      bg: 'bg-slate-50',
      text: 'text-slate-500',
      border: 'border-slate-200',
      icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
    },
    pending: {
      label: 'Pending Review',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      icon: <AlertCircle className="w-3.5 h-3.5 text-slate-500" />,
    },
    approved: {
      label: 'Approved',
      bg: 'bg-[#0f172a]',
      text: 'text-white',
      border: 'border-slate-900',
      glow: 'shadow-xs',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-white" />,
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />,
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

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
      bg: 'bg-emerald-500/15',
      text: 'text-[#00ff88]',
      border: 'border-emerald-500/35',
      glow: 'shadow-[0_0_12px_rgba(0,255,136,0.2)]',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88]" />,
    },
    Absent: {
      label: 'Absent',
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/35',
      glow: 'shadow-[0_0_12px_rgba(244,63,94,0.2)]',
      icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
    },
    'Not Recorded': {
      label: 'Not Recorded',
      bg: 'bg-slate-800/50',
      text: 'text-slate-400',
      border: 'border-slate-700/50',
      icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
    },
    pending: {
      label: 'Pending Review',
      bg: 'bg-amber-500/15',
      text: 'text-amber-300',
      border: 'border-amber-500/35',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.2)]',
      icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400" />,
    },
    approved: {
      label: 'Approved',
      bg: 'bg-emerald-500/15',
      text: 'text-[#00ff88]',
      border: 'border-emerald-500/35',
      glow: 'shadow-[0_0_12px_rgba(0,255,136,0.2)]',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88]" />,
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/35',
      icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
    },
  };

  const current = configMap[status] || configMap['Not Recorded'];

  return (
    <span
      className={clsx(
        'inline-flex items-center font-bold rounded-full border backdrop-blur-md transition-all select-none',
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

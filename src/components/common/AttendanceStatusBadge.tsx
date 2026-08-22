import React from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { AttendanceStatus, CorrectionStatus } from '../../types/database.types';

interface AttendanceBadgeProps {
  status: AttendanceStatus | 'Not Recorded' | CorrectionStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const AttendanceStatusBadge: React.FC<AttendanceBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  switch (status) {
    case 'Present':
      return (
        <span className={clsx('inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80', sizeStyles[size])}>
          {showIcon && <CheckCircle2 className={iconSizes[size]} />}
          <span>Present</span>
        </span>
      );

    case 'Absent':
      return (
        <span className={clsx('inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80', sizeStyles[size])}>
          {showIcon && <XCircle className={iconSizes[size]} />}
          <span>Absent</span>
        </span>
      );

    case 'Not Recorded':
      return (
        <span className={clsx('inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200', sizeStyles[size])}>
          {showIcon && <Clock className={iconSizes[size]} />}
          <span>Not Recorded</span>
        </span>
      );

    case 'pending':
      return (
        <span className={clsx('inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80', sizeStyles[size])}>
          {showIcon && <Clock className={iconSizes[size]} />}
          <span>Pending Review</span>
        </span>
      );

    case 'approved':
      return (
        <span className={clsx('inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80', sizeStyles[size])}>
          {showIcon && <CheckCircle2 className={iconSizes[size]} />}
          <span>Approved</span>
        </span>
      );

    case 'rejected':
      return (
        <span className={clsx('inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300', sizeStyles[size])}>
          {showIcon && <AlertCircle className={iconSizes[size]} />}
          <span>Rejected</span>
        </span>
      );

    default:
      return (
        <span className={clsx('inline-flex items-center rounded-full bg-slate-100 text-slate-700', sizeStyles[size])}>
          {status}
        </span>
      );
  }
};

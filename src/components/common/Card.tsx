import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  glow?: boolean;
  active?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  className = '',
  noPadding = false,
  glow = false,
  active = false,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'rounded-2xl transition-all duration-200 relative overflow-hidden bg-white border border-slate-200/80 shadow-xs',
        active 
          ? 'border-2 border-slate-900 shadow-sm' 
          : 'hover:border-slate-300 hover:shadow-sm',
        glow && 'shadow-md border-slate-300',
        className
      )}
      {...props}
    >
      {/* Optional Card Header */}
      {(title || headerAction) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div>
            {title && (
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 font-normal">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      {/* Card Content Body */}
      <div className={clsx(!noPadding && 'p-5', 'text-slate-800')}>{children}</div>
    </div>
  );
};

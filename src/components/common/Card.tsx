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
        'rounded-2xl transition-all duration-200 relative overflow-hidden',
        active 
          ? 'glass-card-active' 
          : 'glass-card hover:border-emerald-500/30',
        glow && 'neon-glow-sm border-emerald-500/40',
        className
      )}
      {...props}
    >
      {/* Optional Card Header */}
      {(title || headerAction) && (
        <div className="px-5 py-4 border-b border-emerald-500/10 flex items-center justify-between gap-4 bg-slate-950/30">
          <div>
            {title && (
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5 font-medium">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      {/* Card Content Body */}
      <div className={clsx(!noPadding && 'p-5')}>{children}</div>
    </div>
  );
};

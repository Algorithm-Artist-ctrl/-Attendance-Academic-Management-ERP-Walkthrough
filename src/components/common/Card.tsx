import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  title,
  subtitle,
  headerAction,
  footer,
  noPadding = false,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-slate-200/80 shadow-xs transition-shadow hover:shadow-sm overflow-hidden',
        className
      )}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={clsx(!noPadding && 'p-5')}>{children}</div>
      {footer && (
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
};

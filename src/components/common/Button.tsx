import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'neon' | 'navy' | 'maroon' | 'outline' | 'ghost' | 'success' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'neon',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold tracking-wide rounded-xl transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs sm:text-sm gap-2',
    lg: 'px-6 py-3 text-sm sm:text-base gap-2.5 shadow-md',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-[#00ff88] hover:bg-[#10b981] text-slate-950 shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:shadow-[0_0_28px_rgba(0,255,136,0.5)]',
    neon: 'bg-[#00ff88] hover:bg-[#10b981] text-slate-950 shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:shadow-[0_0_28px_rgba(0,255,136,0.5)]',
    navy: 'bg-[#00ff88] hover:bg-[#10b981] text-slate-950 shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:shadow-[0_0_28px_rgba(0,255,136,0.5)]',
    success: 'bg-[#00ff88] hover:bg-[#10b981] text-slate-950 shadow-[0_0_20px_rgba(0,255,136,0.3)]',
    outline: 'bg-slate-900/60 hover:bg-emerald-500/10 text-slate-200 border border-emerald-500/25 hover:border-emerald-400 hover:text-white backdrop-blur-md',
    ghost: 'text-slate-300 hover:text-white hover:bg-emerald-500/10',
    maroon: 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]',
  };

  return (
    <button
      className={clsx(
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};

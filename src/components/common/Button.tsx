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
  const baseStyles = 'inline-flex items-center justify-center font-semibold tracking-normal rounded-xl transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]';

  const sizeStyles = {
    sm: 'px-3.5 py-2 text-sm gap-1.5',
    md: 'px-4.5 py-2.5 text-[15px] gap-2',
    lg: 'px-6 py-3 text-base gap-2.5 shadow-sm',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-[#0f172a] hover:bg-black text-white shadow-xs',
    neon: 'bg-[#0f172a] hover:bg-black text-white shadow-xs',
    navy: 'bg-[#0f172a] hover:bg-black text-white shadow-xs',
    success: 'bg-[#0f172a] hover:bg-black text-white shadow-xs',
    outline: 'bg-white hover:bg-slate-50 text-[#172033] border border-slate-300 shadow-xs',
    ghost: 'text-[#52627A] hover:text-[#172033] hover:bg-slate-100',
    maroon: 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 shadow-xs',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
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

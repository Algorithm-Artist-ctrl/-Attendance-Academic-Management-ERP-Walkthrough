import React from 'react';

interface CyberGauge3DProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subLabel?: string;
}

export const CyberGauge3D: React.FC<CyberGauge3DProps> = ({
  percentage,
  size = 140,
  strokeWidth = 10,
  label,
  subLabel,
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  const isEligible = safePercentage >= 75;
  const strokeColor = isEligible ? '#0f172a' : '#e11d48';

  return (
    <div className="relative flex flex-col items-center justify-center select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Foreground progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>

      {/* Center percentage label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-black text-slate-900 tracking-tight">
          {safePercentage}%
        </span>
        {label && (
          <span className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
            {label}
          </span>
        )}
        {subLabel && (
          <span className="text-[9px] text-slate-400 font-medium">
            {subLabel}
          </span>
        )}
      </div>
    </div>
  );
};

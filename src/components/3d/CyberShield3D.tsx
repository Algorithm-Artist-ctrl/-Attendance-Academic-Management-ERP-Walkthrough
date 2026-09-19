import React from 'react';

interface CyberShield3DProps {
  className?: string;
  size?: number;
}

export const CyberShield3D: React.FC<CyberShield3DProps> = ({ className = '', size = 160 }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`} style={{ width: size, height: size }}>
      {/* Ambient Radial Subtle Tint */}
      <div className="absolute inset-0 rounded-full bg-slate-200/40 blur-xl pointer-events-none" />

      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="shieldPlate" x1="50" y1="30" x2="150" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="shieldBorder" x1="30" y1="30" x2="170" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>

        {/* Base Plate */}
        <ellipse cx="100" cy="170" rx="65" ry="18" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" strokeOpacity="0.8" />
        <ellipse cx="100" cy="170" rx="45" ry="12" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />

        {/* Outer Shield Shell */}
        <path
          d="M 100 25 L 155 48 C 155 105 130 145 100 165 C 70 145 45 105 45 48 Z"
          fill="url(#shieldPlate)"
          stroke="url(#shieldBorder)"
          strokeWidth="3"
        />

        {/* Inner Shield Facet */}
        <path
          d="M 100 38 L 142 56 C 142 98 122 132 100 148 C 78 132 58 98 58 56 Z"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />

        {/* Center Checkmark */}
        <path
          d="M 82 92 L 95 106 L 122 76"
          stroke="#0f172a"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Nodes */}
        <circle cx="100" cy="25" r="3.5" fill="#0f172a" />
        <circle cx="155" cy="48" r="3" fill="#0f172a" />
        <circle cx="45" cy="48" r="3" fill="#0f172a" />
        <circle cx="100" cy="165" r="3" fill="#0f172a" />
      </svg>
    </div>
  );
};

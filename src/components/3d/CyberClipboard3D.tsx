import React from 'react';

interface CyberClipboard3DProps {
  className?: string;
  size?: number;
}

export const CyberClipboard3D: React.FC<CyberClipboard3DProps> = ({ className = '', size = 160 }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-slate-200/40 blur-xl pointer-events-none" />

      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="clipBody" x1="40" y1="30" x2="160" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
        </defs>

        {/* Base Plate */}
        <ellipse cx="100" cy="175" rx="65" ry="16" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Main Tablet Screen */}
        <rect
          x="55"
          y="25"
          width="90"
          height="140"
          rx="12"
          fill="url(#clipBody)"
          stroke="#cbd5e1"
          strokeWidth="2"
        />

        {/* Top Speaker / Sensor Notch */}
        <rect x="85" y="32" width="30" height="3" rx="1.5" fill="#94a3b8" />

        {/* Checklist Rows on Screen */}
        {/* Row 1 */}
        <rect x="68" y="48" width="16" height="16" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <path d="M 72 56 L 76 60 L 81 53" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="90" y="52" width="42" height="4" rx="2" fill="#0f172a" />
        <rect x="90" y="58" width="28" height="3" rx="1.5" fill="#94a3b8" />

        {/* Row 2 */}
        <rect x="68" y="74" width="16" height="16" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <path d="M 72 82 L 76 86 L 81 79" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="90" y="78" width="40" height="4" rx="2" fill="#0f172a" />
        <rect x="90" y="84" width="24" height="3" rx="1.5" fill="#94a3b8" />

        {/* Row 3 */}
        <rect x="68" y="100" width="16" height="16" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
        <path d="M 72 108 L 76 112 L 81 105" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="90" y="104" width="38" height="4" rx="2" fill="#0f172a" />
        <rect x="90" y="110" width="30" height="3" rx="1.5" fill="#94a3b8" />

        {/* Bottom Institutional Button */}
        <rect x="68" y="130" width="64" height="18" rx="9" fill="#0f172a" />
        <rect x="74" y="134" width="20" height="10" rx="5" fill="#ffffff" />
      </svg>
    </div>
  );
};

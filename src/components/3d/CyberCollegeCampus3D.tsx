import React from 'react';

interface CyberCollegeCampus3DProps {
  className?: string;
}

export const CyberCollegeCampus3D: React.FC<CyberCollegeCampus3DProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Subtle Ambient Background */}
      <div className="absolute w-72 h-72 rounded-full bg-slate-200/40 blur-3xl pointer-events-none" />

      {/* SVG 3D Isometric Campus Illustration */}
      <svg
        viewBox="0 0 500 420"
        className="w-full max-w-[460px] h-auto drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cyberPlatform" x1="250" y1="200" x2="250" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id="buildingFacade" x1="180" y1="120" x2="320" y2="280" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id="roofDome" x1="200" y1="80" x2="300" y2="150" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* Outer Circular Rings & Pedestal */}
        <ellipse cx="250" cy="310" rx="200" ry="85" fill="url(#cyberPlatform)" stroke="#cbd5e1" strokeWidth="1.5" />
        <ellipse cx="250" cy="310" rx="160" ry="68" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="8 6" />
        <ellipse cx="250" cy="310" rx="120" ry="50" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Radiating Accent Lines */}
        <path d="M 90 310 L 160 310 L 190 280" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="90" cy="310" r="3" fill="#0f172a" />
        <path d="M 410 310 L 340 310 L 310 280" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="410" cy="310" r="3" fill="#0f172a" />
        <path d="M 250 395 L 250 360" stroke="#94a3b8" strokeWidth="1.5" />
        <circle cx="250" cy="395" r="3" fill="#0f172a" />

        {/* 3D Isometric Base Steps */}
        <path d="M 170 290 L 250 250 L 330 290 L 250 330 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M 180 280 L 250 245 L 320 280 L 250 315 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />

        {/* Main College Building Left Wing */}
        <path d="M 140 220 L 200 190 L 200 270 L 140 300 Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M 140 220 L 200 190 L 200 175 L 140 205 Z" fill="#e2e8f0" />
        {/* Left wing windows */}
        <rect x="150" y="225" width="8" height="14" fill="#0f172a" rx="1" />
        <rect x="165" y="217" width="8" height="14" fill="#0f172a" rx="1" />
        <rect x="180" y="210" width="8" height="14" fill="#0f172a" rx="1" />
        <rect x="150" y="250" width="8" height="14" fill="#64748b" rx="1" />
        <rect x="165" y="242" width="8" height="14" fill="#64748b" rx="1" />
        <rect x="180" y="235" width="8" height="14" fill="#64748b" rx="1" />

        {/* Main College Building Right Wing */}
        <path d="M 300 190 L 360 220 L 360 300 L 300 270 Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M 300 175 L 360 205 L 360 220 L 300 190 Z" fill="#e2e8f0" />
        {/* Right wing windows */}
        <rect x="310" y="210" width="8" height="14" fill="#0f172a" rx="1" />
        <rect x="325" y="217" width="8" height="14" fill="#0f172a" rx="1" />
        <rect x="340" y="225" width="8" height="14" fill="#0f172a" rx="1" />
        <rect x="310" y="235" width="8" height="14" fill="#64748b" rx="1" />
        <rect x="325" y="242" width="8" height="14" fill="#64748b" rx="1" />
        <rect x="340" y="250" width="8" height="14" fill="#64748b" rx="1" />

        {/* Center Grand Entrance Block */}
        <path d="M 200 175 L 250 150 L 300 175 L 300 275 L 250 300 L 200 275 Z" fill="url(#buildingFacade)" stroke="#0f172a" strokeWidth="1.5" />
        
        {/* Grand Portico & Entrance */}
        <path d="M 225 240 L 250 225 L 275 240 L 275 285 L 250 298 L 225 285 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
        <path d="M 240 250 L 250 244 L 260 250 L 260 288 L 250 294 L 240 288 Z" fill="#0f172a" />

        {/* Pillars */}
        <line x1="215" y1="210" x2="215" y2="265" stroke="#94a3b8" strokeWidth="2" />
        <line x1="285" y1="210" x2="285" y2="265" stroke="#94a3b8" strokeWidth="2" />

        {/* Center Dome & Observatory */}
        <path d="M 215 150 Q 250 90 285 150 Z" fill="url(#roofDome)" stroke="#0f172a" strokeWidth="1.5" />
        <ellipse cx="250" cy="150" rx="35" ry="12" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="250" y1="100" x2="250" y2="65" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        <circle cx="250" cy="65" r="4" fill="#0f172a" />

        {/* Accent Ring floating above */}
        <ellipse cx="250" cy="115" rx="55" ry="18" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
    </div>
  );
};

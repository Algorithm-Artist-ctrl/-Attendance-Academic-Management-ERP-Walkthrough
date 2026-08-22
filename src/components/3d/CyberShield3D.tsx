import React from 'react';

interface CyberShield3DProps {
  className?: string;
  size?: number;
}

export const CyberShield3D: React.FC<CyberShield3DProps> = ({ className = '', size = 160 }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`} style={{ width: size, height: size }}>
      {/* Ambient Radial Glow */}
      <div className="absolute inset-0 rounded-full bg-[#00ff88]/15 blur-xl pointer-events-none animate-pulse" />

      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="shieldPlate" x1="50" y1="30" x2="150" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="50%" stopColor="#0d1b32" />
            <stop offset="100%" stopColor="#050b14" />
          </linearGradient>
          <linearGradient id="shieldBorder" x1="30" y1="30" x2="170" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00ff88" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id="shieldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 3D Hologram Base Plate */}
        <ellipse cx="100" cy="170" rx="65" ry="18" fill="#040b15" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.4" />
        <ellipse cx="100" cy="170" rx="45" ry="12" stroke="#00ff88" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.6" />

        {/* Outer Shield Shell */}
        <path
          d="M 100 25 L 155 48 C 155 105 130 145 100 165 C 70 145 45 105 45 48 Z"
          fill="url(#shieldPlate)"
          stroke="url(#shieldBorder)"
          strokeWidth="3.5"
          filter="url(#shieldGlow)"
        />

        {/* Inner Shield Facet */}
        <path
          d="M 100 38 L 142 56 C 142 98 122 132 100 148 C 78 132 58 98 58 56 Z"
          fill="#061220"
          stroke="#00ff88"
          strokeWidth="1.5"
          strokeOpacity="0.5"
        />

        {/* Center Glowing Neon Checkmark */}
        <path
          d="M 82 92 L 95 106 L 122 76"
          stroke="#00ff88"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#shieldGlow)"
        />

        {/* Cyber Nodes */}
        <circle cx="100" cy="25" r="3.5" fill="#00ff88" />
        <circle cx="155" cy="48" r="3" fill="#00ff88" />
        <circle cx="45" cy="48" r="3" fill="#00ff88" />
        <circle cx="100" cy="165" r="3" fill="#00ff88" />
      </svg>
    </div>
  );
};

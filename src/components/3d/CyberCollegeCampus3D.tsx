import React from 'react';

interface CyberCollegeCampus3DProps {
  className?: string;
}

export const CyberCollegeCampus3D: React.FC<CyberCollegeCampus3DProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Ambient Cyber Glow Background */}
      <div className="absolute w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute w-48 h-48 rounded-full bg-[#00ff88]/15 blur-2xl pointer-events-none" />

      {/* SVG 3D Isometric Campus Illustration */}
      <svg
        viewBox="0 0 500 420"
        className="w-full max-w-[460px] h-auto drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cyberPlatform" x1="250" y1="200" x2="250" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0d243a" />
            <stop offset="100%" stopColor="#061220" />
          </linearGradient>
          <linearGradient id="neonGreenGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00ff88" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="buildingFacade" x1="180" y1="120" x2="320" y2="280" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="50%" stopColor="#102540" />
            <stop offset="100%" stopColor="#091424" />
          </linearGradient>
          <linearGradient id="roofDome" x1="200" y1="80" x2="300" y2="150" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#065f46" stopOpacity="0.4" />
          </linearGradient>
          <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Circular Cyber Rings & Pedestal */}
        <ellipse cx="250" cy="310" rx="200" ry="85" fill="url(#cyberPlatform)" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.35" />
        <ellipse cx="250" cy="310" rx="160" ry="68" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="8 6" />
        <ellipse cx="250" cy="310" rx="120" ry="50" fill="#040b15" stroke="#00ff88" strokeWidth="2" filter="url(#glowFilter)" strokeOpacity="0.8" />

        {/* Circuit Data Lines radiating */}
        <path d="M 90 310 L 160 310 L 190 280" stroke="#00ff88" strokeWidth="2" strokeOpacity="0.7" strokeLinecap="round" />
        <circle cx="90" cy="310" r="4" fill="#00ff88" />
        <path d="M 410 310 L 340 310 L 310 280" stroke="#00ff88" strokeWidth="2" strokeOpacity="0.7" strokeLinecap="round" />
        <circle cx="410" cy="310" r="4" fill="#00ff88" />
        <path d="M 250 395 L 250 360" stroke="#00ff88" strokeWidth="2" strokeOpacity="0.8" />
        <circle cx="250" cy="395" r="4" fill="#00ff88" />

        {/* 3D Isometric Base Steps */}
        <path d="M 170 290 L 250 250 L 330 290 L 250 330 Z" fill="#0c1d33" stroke="#10b981" strokeWidth="1" />
        <path d="M 180 280 L 250 245 L 320 280 L 250 315 Z" fill="#132a48" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.5" />

        {/* Main College Building Left Wing */}
        <path d="M 140 220 L 200 190 L 200 270 L 140 300 Z" fill="#0a192c" stroke="#10b981" strokeWidth="1" />
        <path d="M 140 220 L 200 190 L 200 175 L 140 205 Z" fill="#153255" />
        {/* Left wing cyber windows */}
        <rect x="150" y="225" width="8" height="14" fill="#00ff88" fillOpacity="0.8" rx="1" filter="url(#glowFilter)" />
        <rect x="165" y="217" width="8" height="14" fill="#00ff88" fillOpacity="0.8" rx="1" filter="url(#glowFilter)" />
        <rect x="180" y="210" width="8" height="14" fill="#00ff88" fillOpacity="0.8" rx="1" filter="url(#glowFilter)" />
        <rect x="150" y="250" width="8" height="14" fill="#00ff88" fillOpacity="0.6" rx="1" />
        <rect x="165" y="242" width="8" height="14" fill="#00ff88" fillOpacity="0.6" rx="1" />
        <rect x="180" y="235" width="8" height="14" fill="#00ff88" fillOpacity="0.6" rx="1" />

        {/* Main College Building Right Wing */}
        <path d="M 300 190 L 360 220 L 360 300 L 300 270 Z" fill="#091424" stroke="#10b981" strokeWidth="1" />
        <path d="M 300 175 L 360 205 L 360 220 L 300 190 Z" fill="#153255" />
        {/* Right wing cyber windows */}
        <rect x="310" y="210" width="8" height="14" fill="#00ff88" fillOpacity="0.8" rx="1" filter="url(#glowFilter)" />
        <rect x="325" y="217" width="8" height="14" fill="#00ff88" fillOpacity="0.8" rx="1" filter="url(#glowFilter)" />
        <rect x="340" y="225" width="8" height="14" fill="#00ff88" fillOpacity="0.8" rx="1" filter="url(#glowFilter)" />
        <rect x="310" y="235" width="8" height="14" fill="#00ff88" fillOpacity="0.6" rx="1" />
        <rect x="325" y="242" width="8" height="14" fill="#00ff88" fillOpacity="0.6" rx="1" />
        <rect x="340" y="250" width="8" height="14" fill="#00ff88" fillOpacity="0.6" rx="1" />

        {/* Center Grand Entrance Block */}
        <path d="M 200 175 L 250 150 L 300 175 L 300 275 L 250 300 L 200 275 Z" fill="url(#buildingFacade)" stroke="#00ff88" strokeWidth="1.5" strokeOpacity="0.8" />
        
        {/* Grand Portico & Glass Cyber Entrance */}
        <path d="M 225 240 L 250 225 L 275 240 L 275 285 L 250 298 L 225 285 Z" fill="#040b15" stroke="#00ff88" strokeWidth="2" filter="url(#glowFilter)" />
        <path d="M 240 250 L 250 244 L 260 250 L 260 288 L 250 294 L 240 288 Z" fill="#00ff88" fillOpacity="0.85" />

        {/* Futuristic Pillars */}
        <line x1="215" y1="210" x2="215" y2="265" stroke="#00ff88" strokeWidth="2" strokeOpacity="0.7" />
        <line x1="285" y1="210" x2="285" y2="265" stroke="#00ff88" strokeWidth="2" strokeOpacity="0.7" />

        {/* Center Dome & Observatory */}
        <path d="M 215 150 Q 250 90 285 150 Z" fill="url(#roofDome)" stroke="#00ff88" strokeWidth="2" filter="url(#glowFilter)" />
        <ellipse cx="250" cy="150" rx="35" ry="12" fill="#0a192c" stroke="#00ff88" strokeWidth="1.5" />
        <line x1="250" y1="100" x2="250" y2="65" stroke="#00ff88" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="250" cy="65" r="5" fill="#00ff88" filter="url(#glowFilter)" />

        {/* Ambient Hologram Grid Ring floating above */}
        <ellipse cx="250" cy="115" rx="55" ry="18" stroke="#00ff88" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 4" />
      </svg>
    </div>
  );
};

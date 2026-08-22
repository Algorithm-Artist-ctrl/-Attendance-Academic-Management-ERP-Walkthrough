import React from 'react';
import { 
  Users, 
  GraduationCap, 
  Building2, 
  BookOpen, 
  TrendingUp, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  ArrowRight,
  Layers,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { CyberShield3D } from '../../components/3d/CyberShield3D';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    students, 
    faculty, 
    departments, 
    programs, 
    attendanceSessions, 
    attendanceRecords,
    auditLogs 
  } = useAcademic();

  const totalStudents = students.length || 106;
  const totalFaculty = faculty.length || 11;
  const totalDepts = departments.length || 6;
  const totalPrograms = programs.length || 8;

  // Calculate overall attendance rate
  const totalPresent = attendanceRecords.filter(r => r.status === 'Present').length;
  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((totalPresent / attendanceRecords.length) * 100)
    : 92;

  // Recent system activities
  const recentActivities = [
    { title: 'Attendance marked by Ms. Hemlata Chaudhary', time: '2 min ago', type: 'attendance' },
    { title: 'New student added: Tarun Kushwah (2503400100057)', time: '15 min ago', type: 'student' },
    { title: 'B.Tech CSE 2nd Year timetable entry updated', time: '30 min ago', type: 'timetable' },
    { title: 'Correction request approved for Section A student', time: '45 min ago', type: 'correction' },
  ];

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. WELCOME BANNER (Matching Screen 9) */}
      {/* ======================================================== */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Welcome back, {user?.full_name || 'Admin'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Super Administrator • Vivekananda College of Technology & Management • System Online
          </p>
        </div>

        <div className="z-10 flex items-center gap-3">
          <Button
            variant="neon"
            size="sm"
            onClick={() => onNavigate('academic_setup')}
            leftIcon={<Building2 className="w-3.5 h-3.5 text-slate-950" />}
          >
            Academic Structure
          </Button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STATS KPI CARDS GRID (Matching Screen 9) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Students */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Students</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {totalStudents}
            </h3>
            <span className="text-[10px] text-emerald-400 font-semibold">Active Enrolled</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        {/* Total Faculty */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Faculty</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {totalFaculty}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">11 Departments</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Departments */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Departments</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {totalDepts}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">CSE, ME, EE, etc.</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Programs */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Programs</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {totalPrograms}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">B.Tech, M.Tech, etc.</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-xs font-semibold text-slate-400">Today's Attendance</p>
            <h3 className="text-2xl sm:text-3xl font-black text-[#00ff88] mt-1">
              {attendanceRate}%
            </h3>
            <span className="text-[10px] text-emerald-400 font-semibold">Institute Average</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. ATTENDANCE TREND CHART & RECENT ACTIVITIES (Screen 9) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Attendance Trend Curve Graph Matching Screen 9 */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Attendance Trend (This Month)
              </h3>
              <p className="text-xs text-slate-400">Daily Institutional Attendance Trajectory</p>
            </div>
            <span className="text-xs font-bold text-[#00ff88]">+4.2% vs Last Month</span>
          </div>

          {/* SVG Glowing Cyber Curve Graph */}
          <div className="relative py-4">
            <svg viewBox="0 0 500 200" className="w-full h-48 overflow-visible">
              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity="0.0" />
                </linearGradient>
                <filter id="neonGlowLine" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="#0d1b32" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="65" x2="480" y2="65" stroke="#0d1b32" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="110" x2="480" y2="110" stroke="#0d1b32" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="155" x2="480" y2="155" stroke="#0d1b32" strokeWidth="1" strokeDasharray="4 4" />

              {/* Y Axis Labels */}
              <text x="30" y="24" fill="#64748b" fontSize="10" textAnchor="end">100%</text>
              <text x="30" y="69" fill="#64748b" fontSize="10" textAnchor="end">75%</text>
              <text x="30" y="114" fill="#64748b" fontSize="10" textAnchor="end">50%</text>
              <text x="30" y="159" fill="#64748b" fontSize="10" textAnchor="end">25%</text>

              {/* Filled Curve Area */}
              <path
                d="M 60 160 L 140 120 L 220 135 L 300 70 L 380 90 L 460 35 L 460 180 L 60 180 Z"
                fill="url(#curveGradient)"
              />

              {/* Glowing Neon Line */}
              <path
                d="M 60 160 L 140 120 L 220 135 L 300 70 L 380 90 L 460 35"
                fill="none"
                stroke="#00ff88"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#neonGlowLine)"
              />

              {/* Data Point Circles */}
              <circle cx="60" cy="160" r="5" fill="#00ff88" stroke="#050b14" strokeWidth="2" />
              <circle cx="140" cy="120" r="5" fill="#00ff88" stroke="#050b14" strokeWidth="2" />
              <circle cx="220" cy="135" r="5" fill="#00ff88" stroke="#050b14" strokeWidth="2" />
              <circle cx="300" cy="70" r="5" fill="#00ff88" stroke="#050b14" strokeWidth="2" />
              <circle cx="380" cy="90" r="5" fill="#00ff88" stroke="#050b14" strokeWidth="2" />
              <circle cx="460" cy="35" r="6" fill="#00ff88" stroke="#050b14" strokeWidth="2" />

              {/* X Axis Labels */}
              <text x="60" y="195" fill="#64748b" fontSize="10" textAnchor="middle">1 May</text>
              <text x="140" y="195" fill="#64748b" fontSize="10" textAnchor="middle">8 May</text>
              <text x="220" y="195" fill="#64748b" fontSize="10" textAnchor="middle">15 May</text>
              <text x="300" y="195" fill="#64748b" fontSize="10" textAnchor="middle">22 May</text>
              <text x="380" y="195" fill="#64748b" fontSize="10" textAnchor="middle">26 May</text>
              <text x="460" y="195" fill="#00ff88" fontWeight="bold" fontSize="10" textAnchor="middle">31 May</text>
            </svg>
          </div>

          <div className="pt-3 border-t border-emerald-500/10 flex items-center justify-between text-xs text-slate-400">
            <span>Overall Session: 2026-2027</span>
            <button onClick={() => onNavigate('reports')} className="text-[#00ff88] font-bold hover:underline">
              Full Analytics Report →
            </button>
          </div>
        </div>

        {/* Right Card: Recent Activities + 3D Shield Matching Screen 9 */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between relative overflow-hidden">
          {/* 3D Cyber Security Shield Watermark in background */}
          <div className="absolute right-2 bottom-2 opacity-35 pointer-events-none">
            <CyberShield3D size={180} />
          </div>

          <div className="z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Recent Activities
              </h3>
              <button onClick={() => onNavigate('audit_logs')} className="text-xs font-bold text-[#00ff88] hover:underline">
                View All →
              </button>
            </div>

            <div className="space-y-3 z-10">
              {recentActivities.map((act, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-950/75 border border-emerald-500/15 flex items-start gap-3 backdrop-blur-md"
                >
                  <div className="w-2 h-2 rounded-full bg-[#00ff88] mt-1.5 shrink-0 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white leading-tight">
                      {act.title}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
                      {act.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-emerald-500/10 mt-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('audit_logs')}
              className="w-full text-xs"
            >
              Inspect Audit Trails & Ledger
            </Button>
          </div>
        </div>

      </div>

      {/* Quick Admin Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('students')}
          className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left group"
        >
          <GraduationCap className="w-5 h-5 text-emerald-400 group-hover:text-[#00ff88] mb-2" />
          <h4 className="text-xs font-bold text-white">Student Directory</h4>
          <p className="text-[11px] text-slate-400">Manage {totalStudents} students</p>
        </button>

        <button
          onClick={() => onNavigate('faculty')}
          className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left group"
        >
          <Users className="w-5 h-5 text-emerald-400 group-hover:text-[#00ff88] mb-2" />
          <h4 className="text-xs font-bold text-white">Faculty Directory</h4>
          <p className="text-[11px] text-slate-400">Manage {totalFaculty} professors</p>
        </button>

        <button
          onClick={() => onNavigate('timetable')}
          className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left group"
        >
          <Calendar className="w-5 h-5 text-emerald-400 group-hover:text-[#00ff88] mb-2" />
          <h4 className="text-xs font-bold text-white">Timetable Manager</h4>
          <p className="text-[11px] text-slate-400">Period schedule & clashes</p>
        </button>

        <button
          onClick={() => onNavigate('csv_import')}
          className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left group"
        >
          <FileSpreadsheet className="w-5 h-5 text-emerald-400 group-hover:text-[#00ff88] mb-2" />
          <h4 className="text-xs font-bold text-white">CSV Student Import</h4>
          <p className="text-[11px] text-slate-400">Bulk upload & deduplicate</p>
        </button>
      </div>

    </div>
  );
};

import React from 'react';
import { 
  Users, 
  GraduationCap, 
  Building2, 
  ShieldCheck, 
  ShieldAlert,
  ArrowRight,
  Layers,
  UserCheck,
  UserX,
  KeyRound,
  FileSpreadsheet,
  Activity,
  History,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { CyberShield3D } from '../../components/3d/CyberShield3D';
import { formatTimeAgo } from '../../lib/utils/dateUtils';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    sessions,
    students, 
    faculty, 
    departments, 
    programs, 
    adminAccounts,
    auditLogs 
  } = useAcademic();

  const totalStudents = students.filter(s => s.active !== false && s.status !== 'ARCHIVED').length;
  const totalFaculty = faculty.filter(f => f.active !== false && f.status !== 'ARCHIVED').length;
  const totalDepts = departments.filter(d => d.active !== false).length;
  const totalPrograms = programs.filter(p => p.active !== false).length;

  // Account Directory Breakdown
  const activeAccountsCount = adminAccounts.length > 0
    ? adminAccounts.filter(a => a.status === 'ACTIVE').length
    : (totalStudents + totalFaculty);
  const blockedAccountsCount = adminAccounts.filter(a => a.status === 'BLOCKED').length;
  const archivedAccountsCount = adminAccounts.filter(a => a.status === 'ARCHIVED').length;

  const facultyAccountsCount = adminAccounts.length > 0
    ? adminAccounts.filter(a => a.role === 'faculty' || a.role === 'hod').length
    : totalFaculty;
  const studentAccountsCount = adminAccounts.length > 0
    ? adminAccounts.filter(a => a.role === 'student').length
    : totalStudents;

  // Filter audit logs for account and security actions first, then fallback to recent logs
  const accountActionKeywords = [
    'ACCOUNT', 'PASSWORD', 'EMAIL', 'LOGIN', 'LOGOUT', 'USER', 'STATUS', 'BLOCK', 'UNBLOCK', 'ARCHIVE'
  ];
  const recentAccountLogs = auditLogs
    .filter(log => {
      const act = log.action.toUpperCase();
      const entity = log.entity_type?.toUpperCase() || '';
      return accountActionKeywords.some(kw => act.includes(kw) || entity.includes(kw));
    })
    .slice(0, 6);

  const displayLogs = recentAccountLogs.length > 0 ? recentAccountLogs : auditLogs.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. WELCOME BANNER */}
      {/* ======================================================== */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Welcome back, {user?.full_name || 'Administrator'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Super Administrator • Account Authority & System Governance • Vivekananda College of Technology & Management
          </p>
        </div>

        <div className="z-10 flex items-center gap-3">
          <Button
            variant="neon"
            size="sm"
            onClick={() => onNavigate('faculty_accounts')}
            leftIcon={<Users className="w-3.5 h-3.5 text-slate-950" />}
          >
            Manage Accounts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('academic_setup')}
            leftIcon={<Building2 className="w-3.5 h-3.5 text-emerald-400" />}
          >
            Academic Structure
          </Button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STATS KPI CARDS GRID */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Students */}
        <div 
          onClick={() => onNavigate('student_accounts')}
          className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:border-[#00ff88]/50 transition-all"
        >
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
        <div 
          onClick={() => onNavigate('faculty_accounts')}
          className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:border-[#00ff88]/50 transition-all"
        >
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Faculty</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {totalFaculty}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Faculty Members</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Accounts */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Active Accounts</p>
            <h3 className="text-2xl sm:text-3xl font-black text-[#00ff88] mt-1">
              {activeAccountsCount}
            </h3>
            <span className="text-[10px] text-emerald-400 font-semibold">Verified & Enabled</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Blocked Accounts */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Blocked Accounts</p>
            <h3 className={`text-2xl sm:text-3xl font-black mt-1 ${blockedAccountsCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {blockedAccountsCount}
            </h3>
            <span className="text-[10px] text-amber-400 font-semibold">
              {blockedAccountsCount > 0 ? 'Access Restricted' : 'Zero Blocked'}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${blockedAccountsCount > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800/80 border-slate-700 text-slate-400'}`}>
            <UserX className="w-5 h-5" />
          </div>
        </div>

        {/* Departments */}
        <div 
          onClick={() => onNavigate('academic_setup')}
          className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:border-[#00ff88]/50 transition-all col-span-2 sm:col-span-1"
        >
          <div>
            <p className="text-xs font-semibold text-slate-400">Academic Structure</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {totalDepts}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">{totalPrograms} Programs</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. ACCOUNT GOVERNANCE & LIVE AUDIT RECENT ACTIVITY */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Account Directory & Security Controls */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Account Governance & Directory Status
                </h3>
                <p className="text-xs text-slate-400">
                  Authentication posture, credential lifecycle, and institutional directory
                </p>
              </div>
              <span className="text-xs font-bold text-[#00ff88] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                Auth Shield Active
              </span>
            </div>

            {/* Account Matrix Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div 
                onClick={() => onNavigate('faculty_accounts')}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/40 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Faculty Accounts</span>
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white mt-2">{facultyAccountsCount}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
                  <span>Directory: Active</span>
                  <span className="text-[#00ff88] font-semibold">Manage →</span>
                </div>
              </div>

              <div 
                onClick={() => onNavigate('student_accounts')}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/40 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Student Accounts</span>
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white mt-2">{studentAccountsCount}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
                  <span>Directory: Active</span>
                  <span className="text-[#00ff88] font-semibold">Manage →</span>
                </div>
              </div>
            </div>

            {/* Security Notice / Rules Box */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/20 mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Super Admin Credential & Access Enforcement Policy</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 pl-6 list-disc">
                <li>Plaintext passwords are strictly protected and never exposed in the interface.</li>
                <li>Password resets dispatch authoritative Supabase email instructions with audit logging.</li>
                <li>Blocking an account immediately revokes database RLS permissions and terminates active sessions.</li>
                <li>Account archiving preserves all historical academic and attendance integrity.</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-emerald-500/10 mt-6 flex items-center justify-between text-xs text-slate-400">
            <span>Session: {sessions.find(s => s.is_current)?.name || sessions[0]?.name || '2026-2027'}</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onNavigate('faculty_accounts')}
                className="text-[#00ff88] font-bold hover:underline"
              >
                Faculty Directory →
              </button>
              <span>•</span>
              <button 
                onClick={() => onNavigate('student_accounts')}
                className="text-[#00ff88] font-bold hover:underline"
              >
                Student Directory →
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: Live Audit Logs & Security Activity */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between relative overflow-hidden">
          {/* 3D Cyber Security Shield Watermark in background */}
          <div className="absolute right-2 bottom-2 opacity-35 pointer-events-none">
            <CyberShield3D size={180} />
          </div>

          <div className="z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Recent Account Activity
                </h3>
                <p className="text-xs text-slate-400">Live security & account operations</p>
              </div>
              <button onClick={() => onNavigate('audit_logs')} className="text-xs font-bold text-[#00ff88] hover:underline">
                View All Logs →
              </button>
            </div>

            {displayLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                <History className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
                <p className="font-semibold text-slate-300">No recent account activity</p>
                <p className="text-slate-500 mt-1">Audit trail events will appear here in real time.</p>
              </div>
            ) : (
              <div className="space-y-2.5 z-10">
                {displayLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3 rounded-2xl bg-slate-950/75 border border-emerald-500/15 flex items-start gap-3 backdrop-blur-md"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#00ff88] mt-1.5 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white leading-tight truncate">
                        {log.action.replace(/_/g, ' ')}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                        <span className="truncate">{log.actor_name ? `By ${log.actor_name}` : 'System'}</span>
                        <span className="shrink-0">{formatTimeAgo(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-emerald-500/10 mt-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('audit_logs')}
              className="w-full text-xs"
              leftIcon={<History className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Inspect Complete Audit Ledger
            </Button>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 4. QUICK ADMIN NAVIGATION GRID */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('faculty_accounts')}
          className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left group"
        >
          <Users className="w-5 h-5 text-emerald-400 group-hover:text-[#00ff88] mb-2" />
          <h4 className="text-xs font-bold text-white">Faculty Accounts</h4>
          <p className="text-[11px] text-slate-400">Security, credentials & status</p>
        </button>

        <button
          onClick={() => onNavigate('student_accounts')}
          className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left group"
        >
          <GraduationCap className="w-5 h-5 text-emerald-400 group-hover:text-[#00ff88] mb-2" />
          <h4 className="text-xs font-bold text-white">Student Accounts</h4>
          <p className="text-[11px] text-slate-400">Enrollments, year/sec & access</p>
        </button>

        <button
          onClick={() => onNavigate('academic_setup')}
          className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left group"
        >
          <Building2 className="w-5 h-5 text-emerald-400 group-hover:text-[#00ff88] mb-2" />
          <h4 className="text-xs font-bold text-white">Academic Structure</h4>
          <p className="text-[11px] text-slate-400">Programs, departments & years</p>
        </button>

        <button
          onClick={() => onNavigate('audit_logs')}
          className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left group"
        >
          <History className="w-5 h-5 text-emerald-400 group-hover:text-[#00ff88] mb-2" />
          <h4 className="text-xs font-bold text-white">Audit Trails & Logs</h4>
          <p className="text-[11px] text-slate-400">Immutable governance ledger</p>
        </button>
      </div>

    </div>
  );
};

import React, { useEffect } from 'react';
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
import { CardSkeleton } from '../../components/common/SkeletonLoader';
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
    refreshAdminAccounts,
    auditLogs,
    isLoading
  } = useAcademic();

  useEffect(() => {
    if (adminAccounts.length === 0) {
      refreshAdminAccounts();
    }
  }, [adminAccounts.length, refreshAdminAccounts]);

  const totalStudents = students.filter(s => s.active !== false && (!s.status || s.status === 'ACTIVE')).length;
  const totalFaculty = faculty.filter(f => f.active !== false && (!f.status || f.status === 'ACTIVE')).length;
  const totalDepts = departments.filter(d => d.active !== false).length;
  const totalPrograms = programs.filter(p => p.active !== false).length;

  // Account Directory Breakdown
  const activeAccountsCount = adminAccounts.length > 0
    ? adminAccounts.filter(a => a.status === 'ACTIVE').length
    : (totalStudents + totalFaculty);
  const blockedAccountsCount = adminAccounts.filter(a => a.status === 'BLOCKED').length;
  const archivedAccountsCount = adminAccounts.length > 0
    ? adminAccounts.filter(a => a.status !== 'ACTIVE' && a.status !== 'BLOCKED').length
    : 0;

  const facultyAccountsCount = adminAccounts.length > 0
    ? adminAccounts.filter(a => (a.role === 'faculty' || a.role === 'hod') && a.status === 'ACTIVE').length
    : totalFaculty;
  const studentAccountsCount = adminAccounts.length > 0
    ? adminAccounts.filter(a => a.role === 'student' && a.status === 'ACTIVE').length
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
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif-institutional text-[#172033] tracking-tight">
            Welcome back, {user?.full_name || 'Administrator'}
          </h1>
          <p className="text-sm text-[#52627A] font-medium">
            Super Administrator • Account Authority & System Governance • Vivekananda College of Technology & Management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate('faculty_accounts')}
            leftIcon={<Users className="w-4 h-4" />}
          >
            Manage Accounts
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => onNavigate('academic_setup')}
            leftIcon={<Building2 className="w-4 h-4 text-[#52627A]" />}
          >
            Academic Structure
          </Button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STATS KPI CARDS GRID */}
      {/* ======================================================== */}
      {isLoading && students.length === 0 ? (
        <CardSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Total Students */}
          <div 
            onClick={() => onNavigate('student_accounts')}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#52627A]">Total Students</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-serif-institutional text-[#172033] mt-1 font-mono">
                {totalStudents}
              </h3>
              <span className="text-xs text-emerald-800 font-semibold">Active Enrolled</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#172033] shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>

          {/* Total Faculty */}
          <div 
            onClick={() => onNavigate('faculty_accounts')}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-between cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#52627A]">Total Faculty</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-serif-institutional text-[#172033] mt-1 font-mono">
                {totalFaculty}
              </h3>
              <span className="text-xs text-[#52627A] font-medium">Faculty Members</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#172033] shadow-xs">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Active Accounts */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#52627A]">Active Accounts</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-serif-institutional text-[#172033] mt-1 font-mono">
                {activeAccountsCount}
              </h3>
              <span className="text-xs text-emerald-800 font-semibold">Verified & Enabled</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Blocked Accounts */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#52627A]">Blocked Accounts</p>
              <h3 className={`text-2xl sm:text-3xl font-bold font-serif-institutional mt-1 font-mono ${blockedAccountsCount > 0 ? 'text-amber-800' : 'text-[#172033]'}`}>
                {blockedAccountsCount}
              </h3>
              <span className={`text-xs font-semibold ${blockedAccountsCount > 0 ? 'text-amber-800' : 'text-[#52627A]'}`}>
                {blockedAccountsCount > 0 ? 'Access Restricted' : 'Zero Blocked'}
              </span>
            </div>
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-xs ${blockedAccountsCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-100 border border-slate-200 text-[#52627A]'}`}>
              <UserX className="w-5 h-5" />
            </div>
          </div>

          {/* Departments */}
          <div 
            onClick={() => onNavigate('academic_setup')}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex items-center justify-between cursor-pointer col-span-2 sm:col-span-1"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#52627A]">Academic Structure</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-serif-institutional text-[#172033] mt-1 font-mono">
                {totalDepts}
              </h3>
              <span className="text-xs text-[#52627A] font-medium">{totalPrograms} Programs</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#172033] shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ACCOUNT GOVERNANCE & LIVE AUDIT RECENT ACTIVITY */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Account Directory & Security Controls */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold font-serif-institutional text-[#172033] tracking-tight">
                  Account Governance & Directory Status
                </h3>
                <p className="text-sm text-[#52627A] mt-0.5">
                  Authentication posture, credential lifecycle, and institutional directory
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Auth Shield Active
              </span>
            </div>

            {/* Account Matrix Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div 
                onClick={() => onNavigate('faculty_accounts')}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 cursor-pointer transition-all shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#52627A]">Faculty Accounts</span>
                  <Users className="w-4 h-4 text-[#172033]" />
                </div>
                <div className="text-2xl font-bold font-serif-institutional text-[#172033] mt-2 font-mono">{facultyAccountsCount}</div>
                <div className="flex items-center justify-between text-xs text-[#52627A] mt-2 pt-2 border-t border-slate-200">
                  <span>Directory: Active</span>
                  <span className="text-[#172033] font-bold">Manage →</span>
                </div>
              </div>

              <div 
                onClick={() => onNavigate('student_accounts')}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 cursor-pointer transition-all shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#52627A]">Student Accounts</span>
                  <GraduationCap className="w-4 h-4 text-[#172033]" />
                </div>
                <div className="text-2xl font-bold font-serif-institutional text-[#172033] mt-2 font-mono">{studentAccountsCount}</div>
                <div className="flex items-center justify-between text-xs text-[#52627A] mt-2 pt-2 border-t border-slate-200">
                  <span>Directory: Active</span>
                  <span className="text-[#172033] font-bold">Manage →</span>
                </div>
              </div>
            </div>

            {/* Security Notice / Rules Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#172033]">
                <ShieldCheck className="w-4 h-4 text-[#172033]" />
                <span>Super Admin Credential & Access Enforcement Policy</span>
              </div>
              <ul className="text-xs text-[#52627A] space-y-1.5 pl-6 list-disc font-medium">
                <li>Plaintext passwords are strictly protected and never exposed in the interface.</li>
                <li>Password resets dispatch authoritative Supabase email instructions with audit logging.</li>
                <li>Blocking an account immediately revokes database RLS permissions and terminates active sessions.</li>
                <li>Account archiving preserves all historical academic and attendance integrity.</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-6 flex items-center justify-between text-xs text-[#52627A]">
            <span>Session: {sessions.find(s => s.is_current)?.name || sessions[0]?.name || '2026-2027'}</span>
            <div className="flex items-center gap-2 font-medium">
              <button 
                onClick={() => onNavigate('faculty_accounts')}
                className="text-[#172033] font-bold hover:underline cursor-pointer"
              >
                Faculty Directory →
              </button>
              <span>•</span>
              <button 
                onClick={() => onNavigate('student_accounts')}
                className="text-[#172033] font-bold hover:underline cursor-pointer"
              >
                Student Directory →
              </button>
              <span>•</span>
              <button 
                onClick={() => onNavigate('records_archive')}
                className="text-[#52627A] hover:text-[#172033] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Records & Archive ({archivedAccountsCount}) →
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: Live Audit Logs & Security Activity */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden">
          {/* 3D Security Shield Watermark in background */}
          <div className="absolute right-2 bottom-2 opacity-20 pointer-events-none">
            <CyberShield3D size={180} />
          </div>

          <div className="z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold font-serif-institutional text-[#172033] tracking-tight">
                  Recent Account Activity
                </h3>
                <p className="text-sm text-[#52627A] mt-0.5">Live security & account operations</p>
              </div>
              <button onClick={() => onNavigate('audit_logs')} className="text-xs font-bold text-[#172033] hover:underline cursor-pointer">
                View All Logs →
              </button>
            </div>

            {displayLogs.length === 0 ? (
              <div className="py-12 text-center text-[#52627A] text-xs flex flex-col items-center justify-center">
                <History className="w-8 h-8 text-[#52627A] mb-2 opacity-50" />
                <p className="font-bold text-[#172033] text-sm">No recent account activity</p>
                <p className="text-xs text-[#52627A] mt-1">Audit trail events will appear here in real time.</p>
              </div>
            ) : (
              <div className="space-y-2.5 z-10">
                {displayLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 shadow-xs"
                  >
                    <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#172033] leading-tight truncate">
                        {log.action.replace(/_/g, ' ')}
                      </p>
                      <div className="flex items-center justify-between text-xs text-[#52627A] mt-0.5 font-mono">
                        <span className="truncate">{log.actor_name ? `By ${log.actor_name}` : 'System'}</span>
                        <span className="shrink-0">{formatTimeAgo(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('audit_logs')}
              className="w-full text-xs font-bold"
              leftIcon={<History className="w-3.5 h-3.5 text-[#52627A]" />}
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
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all text-left group shadow-xs cursor-pointer"
        >
          <Users className="w-5 h-5 text-[#52627A] group-hover:text-[#172033] mb-2 transition-colors" />
          <h4 className="text-sm font-bold text-[#172033]">Faculty Accounts</h4>
          <p className="text-xs text-[#52627A] mt-0.5">Security, credentials & status</p>
        </button>

        <button
          onClick={() => onNavigate('student_accounts')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all text-left group shadow-xs cursor-pointer"
        >
          <GraduationCap className="w-5 h-5 text-[#52627A] group-hover:text-[#172033] mb-2 transition-colors" />
          <h4 className="text-sm font-bold text-[#172033]">Student Accounts</h4>
          <p className="text-xs text-[#52627A] mt-0.5">Enrollments, year/sec & access</p>
        </button>

        <button
          onClick={() => onNavigate('academic_setup')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all text-left group shadow-xs cursor-pointer"
        >
          <Building2 className="w-5 h-5 text-[#52627A] group-hover:text-[#172033] mb-2 transition-colors" />
          <h4 className="text-sm font-bold text-[#172033]">Academic Structure</h4>
          <p className="text-xs text-[#52627A] mt-0.5">Programs, departments & years</p>
        </button>

        <button
          onClick={() => onNavigate('audit_logs')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all text-left group shadow-xs cursor-pointer"
        >
          <History className="w-5 h-5 text-[#52627A] group-hover:text-[#172033] mb-2 transition-colors" />
          <h4 className="text-sm font-bold text-[#172033]">Audit Trails & Logs</h4>
          <p className="text-xs text-[#52627A] mt-0.5">Immutable governance ledger</p>
        </button>
      </div>

    </div>
  );
};

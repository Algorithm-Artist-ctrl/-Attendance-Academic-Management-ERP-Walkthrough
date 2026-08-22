import React, { useState } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  CheckSquare, 
  ClipboardCheck, 
  Users, 
  BookOpen, 
  Building2, 
  BarChart3, 
  ShieldCheck, 
  FileSpreadsheet, 
  LogOut, 
  Menu, 
  X, 
  ChevronDown,
  Layers,
  History,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { clsx } from 'clsx';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab,
  onTabChange,
}) => {
  const { user, role, logout, switchUser } = useAuth();
  const { institution, corrections, resetToInitialSeed } = useAcademic();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const pendingCorrectionsCount = corrections.filter(c => c.status === 'pending').length;

  // Build navigation items based on role
  const getNavItems = () => {
    switch (role) {
      case 'student':
        return [
          { id: 'dashboard', label: 'My Dashboard', icon: BarChart3 },
          { id: 'timetable', label: 'My Timetable', icon: Calendar },
          { id: 'attendance', label: 'Subject Attendance', icon: ClipboardCheck },
          { id: 'corrections', label: 'Correction Requests', icon: RotateCcw },
        ];

      case 'faculty':
        return [
          { id: 'dashboard', label: 'Faculty Dashboard', icon: BarChart3 },
          { id: 'take_attendance', label: 'Take Attendance', icon: CheckSquare },
          { id: 'timetable', label: 'My Schedule', icon: Calendar },
          { 
            id: 'corrections', 
            label: 'Correction Requests', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'history', label: 'Attendance History', icon: History },
        ];

      case 'hod':
        return [
          { id: 'dashboard', label: 'Department Overview', icon: BarChart3 },
          { id: 'students', label: 'Students Directory', icon: GraduationCap },
          { id: 'faculty', label: 'Faculty & Workload', icon: Users },
          { id: 'timetable', label: 'Department Schedule', icon: Calendar },
          { id: 'reports', label: 'Attendance & Defaulters', icon: FileSpreadsheet },
          { 
            id: 'corrections', 
            label: 'Correction Reviews', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
        ];

      case 'super_admin':
      default:
        return [
          { id: 'dashboard', label: 'Admin Dashboard', icon: BarChart3 },
          { id: 'take_attendance', label: 'Quick Attendance', icon: CheckSquare },
          { id: 'academic_setup', label: 'Academic Structure', icon: Building2 },
          { id: 'timetable', label: 'Timetable Manager', icon: Calendar },
          { id: 'students', label: 'Student Directory', icon: GraduationCap },
          { id: 'faculty', label: 'Faculty Directory', icon: Users },
          { id: 'subjects', label: 'Courses & Subjects', icon: BookOpen },
          { id: 'assignments', label: 'Faculty Assignments', icon: Layers },
          { id: 'csv_import', label: 'CSV Student Import', icon: FileSpreadsheet },
          { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
          { 
            id: 'corrections', 
            label: 'Correction Requests', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'audit_logs', label: 'System Audit Logs', icon: ShieldCheck },
        ];
    }
  };

  const navItems = getNavItems();

  // Switch to standard mock accounts for quick testing across roles
  const testAccounts = [
    { label: 'Super Admin (College Admin)', id: 'user-admin-01', role: 'super_admin' },
    { label: 'HOD CSE (Mr. Wasim)', id: 'user-fac-wasim-01', role: 'hod' },
    { label: 'Faculty Sec A (Ms. Hemlata Chaudhary)', id: 'user-fac-hemlata-02', role: 'faculty' },
    { label: 'Faculty Sec B (Mr. Imran Raza Khan)', id: 'user-fac-imran-03', role: 'faculty' },
    { label: 'Faculty (Mr. Alok Gupta)', id: 'user-fac-alok-04', role: 'faculty' },
    { label: 'Student Sec A (Shazeb - 2403400100047)', id: 'user-stud-a-04', role: 'student' },
    { label: 'Student Sec A (Aditya - 2503400100001)', id: 'user-stud-a-05', role: 'student' },
    { label: 'Student Sec B (Lubhnesh - 2403400130012)', id: 'user-stud-b-01', role: 'student' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-vctm-navy-900 text-white border-b border-vctm-navy-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* College Identity & Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-vctm-navy-800 focus:outline-none"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('dashboard')}>
                <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs">
                  <img src="/vctm-icon.svg" alt="VCTM Logo" className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base tracking-tight text-white">
                      VCTM ALIGARH
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 uppercase">
                      Code: 340
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 hidden sm:block">
                    Vivekananda College of Technology & Management | Attendance ERP
                  </p>
                </div>
              </div>
            </div>

            {/* User Profile & Role Switcher */}
            <div className="flex items-center gap-3">
              {/* Quick Role Persona Switcher */}
              <div className="relative">
                <button
                  onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-vctm-navy-800 hover:bg-vctm-navy-700 text-xs text-slate-200 border border-vctm-navy-700 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Role:</span>
                  <span className="font-semibold text-amber-300 capitalize">{role?.replace('_', ' ')}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isRoleDropdownOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 text-slate-800 text-xs"
                    onClick={() => setIsRoleDropdownOpen(false)}
                  >
                    <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Role Persona (Test & Verify)
                    </div>
                    {testAccounts.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          switchUser(acc.id);
                          onTabChange('dashboard');
                        }}
                        className={clsx(
                          'w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center justify-between',
                          user?.id === acc.id && 'bg-blue-50 font-semibold text-blue-700'
                        )}
                      >
                        <span>{acc.label}</span>
                        {user?.id === acc.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                      </button>
                    ))}
                    <div className="px-3 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          if (confirm('Reset database to initial VCTM seed data? All custom modifications will be re-seeded.')) {
                            resetToInitialSeed();
                          }
                        }}
                        className="w-full text-center py-1 text-slate-500 hover:text-rose-600 font-medium"
                      >
                        Re-Seed Initial VCTM Data
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* User badge */}
              <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-vctm-navy-700">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-900 font-bold flex items-center justify-center text-xs">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {user?.full_name}
                  </div>
                  <div className="text-[10px] text-slate-300">
                    {user?.student?.roll_number ? `Roll: ${user.student.roll_number}` : user?.email}
                  </div>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                title="Logout"
                className="p-2 rounded-lg text-slate-300 hover:text-rose-300 hover:bg-vctm-navy-800 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-header Navigation Tabs */}
      <nav className="bg-white border-b border-slate-200 shadow-xs hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-vctm-navy-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <Icon className={clsx('w-4 h-4', isActive ? 'text-amber-400' : 'text-slate-400')} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 shadow-lg px-4 pt-2 pb-4 space-y-1 animate-in slide-in-from-top duration-200">
          <div className="px-3 py-2 border-b border-slate-100 mb-2">
            <p className="text-xs font-semibold text-slate-900">{user?.full_name}</p>
            <p className="text-[11px] text-slate-500 capitalize">{role?.replace('_', ' ')} Portal</p>
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-left',
                  isActive ? 'bg-vctm-navy-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={clsx('w-4 h-4', isActive ? 'text-amber-400' : 'text-slate-500')} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            © 2026 <strong className="text-slate-700">{institution.name}</strong> (VCTM), Aligarh
          </div>
          <div className="flex items-center gap-4">
            <a href={institution.website} target="_blank" rel="noreferrer" className="hover:text-vctm-navy-700 underline">
              Official Website (vctm.in)
            </a>
            <span>•</span>
            <span>Odd Semester 2026-2027</span>
            <span>•</span>
            <span className="text-emerald-600 font-medium">System Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

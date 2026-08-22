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
  const { user, role, logout } = useAuth();
  const { institution, corrections } = useAcademic();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

            {/* User Profile Badge & Logout */}
            <div className="flex items-center gap-3">
              {/* User badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-vctm-navy-800 border border-vctm-navy-700">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-900 font-extrabold flex items-center justify-center text-xs shrink-0 shadow-xs">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white leading-tight">
                    {user?.full_name}
                  </div>
                  <div className="text-[10px] text-amber-300 font-medium">
                    {user?.student?.roll_number ? `Roll: ${user.student.roll_number}` : user?.role?.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={logout}
                title="Logout"
                className="p-2 rounded-lg text-slate-300 hover:text-rose-300 hover:bg-vctm-navy-800 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
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

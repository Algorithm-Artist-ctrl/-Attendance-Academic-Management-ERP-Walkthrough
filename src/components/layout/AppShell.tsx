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
  Layers, 
  History, 
  RotateCcw,
  Bell,
  Settings,
  FileText,
  MessageSquare,
  Sparkles,
  UserCheck
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

  // Build navigation items based on role (matching Screen 2, 6, 9)
  const getNavItems = () => {
    switch (role) {
      case 'student':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'profile', label: 'My Profile', icon: GraduationCap },
          { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
          { id: 'subjects', label: 'Subjects', icon: BookOpen },
          { id: 'timetable', label: 'Time Table', icon: Calendar },
          { id: 'notices', label: 'Notices', icon: Bell },
          { id: 'feedback', label: 'Feedback', icon: MessageSquare },
          { id: 'leave', label: 'Leave Application', icon: FileText },
          { 
            id: 'corrections', 
            label: 'My Requests', 
            icon: RotateCcw,
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined
          },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];

      case 'faculty':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'profile', label: 'My Profile', icon: UserCheck },
          { id: 'take_attendance', label: "Today's Classes", icon: CheckSquare },
          { id: 'timetable', label: 'Time Table', icon: Calendar },
          { id: 'history', label: 'Attendance', icon: History },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { 
            id: 'corrections', 
            label: 'Correction Requests', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          { id: 'notices', label: 'Notices', icon: Bell },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];

      case 'hod':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'faculty', label: 'Faculty', icon: Users },
          { id: 'timetable', label: 'Department Schedule', icon: Calendar },
          { id: 'reports', label: 'Attendance Reports', icon: FileSpreadsheet },
          { 
            id: 'corrections', 
            label: 'Correction Reviews', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];

      case 'super_admin':
      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'faculty', label: 'Faculty', icon: Users },
          { id: 'departments', label: 'Departments', icon: Building2 },
          { id: 'academic_setup', label: 'Academic Structure', icon: Layers },
          { id: 'subjects', label: 'Subjects', icon: BookOpen },
          { id: 'timetable', label: 'Timetable', icon: Calendar },
          { id: 'take_attendance', label: 'Take Attendance', icon: CheckSquare },
          { id: 'csv_import', label: 'CSV Import', icon: FileSpreadsheet },
          { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
          { 
            id: 'corrections', 
            label: 'Correction Requests', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'audit_logs', label: 'Audit Logs', icon: ShieldCheck },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-100 flex flex-col md:flex-row">
      {/* ======================================================== */}
      {/* DESKTOP LEFT CYBER SIDEBAR */}
      {/* ======================================================== */}
      <aside className="hidden md:flex flex-col w-64 bg-[#081220]/90 border-r border-emerald-500/15 backdrop-blur-xl shrink-0 z-30 min-h-screen">
        {/* VCTM Brand Logo */}
        <div className="p-5 border-b border-emerald-500/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-emerald-500/30 p-1 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,136,0.15)]">
            <img src="/vctm-icon.svg" alt="VCTM Logo" className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wider text-white">
                VCTM <span className="text-[#00ff88]">ERP</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">
              Vivekananda College (340)
            </p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={clsx(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none group',
                  isActive
                    ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_18px_rgba(0,255,136,0.35)]'
                    : 'text-slate-300 hover:text-white hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={clsx('w-4 h-4', isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-[#00ff88]')} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={clsx(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                    isActive ? 'bg-slate-950 text-[#00ff88]' : 'bg-rose-500 text-white'
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Logout Action */}
        <div className="p-3 border-t border-emerald-500/15">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/25 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* MAIN VIEWPORT AREA */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-[#07111e]/90 border-b border-emerald-500/15 backdrop-blur-xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Mobile Menu Toggle & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-900 border border-emerald-500/20 text-slate-300 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="md:hidden flex items-center gap-2">
              <img src="/vctm-icon.svg" alt="VCTM" className="w-6 h-6" />
              <span className="font-extrabold text-sm text-white">VCTM <span className="text-[#00ff88]">ERP</span></span>
            </div>
          </div>

          {/* User Profile Header Chip */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Notification Bell */}
            <button 
              onClick={() => onTabChange('notices')}
              title="View Notices & Circulars"
              className="relative p-2 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-slate-300 hover:text-white hover:border-[#00ff88] transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            </button>

            {/* Profile Avatar & Info */}
            <button 
              onClick={() => onTabChange('profile')}
              title="View Profile"
              className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 hover:border-[#00ff88] transition-colors shadow-xs cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-[#00ff88] text-slate-950 font-black flex items-center justify-center text-xs shadow-[0_0_12px_rgba(0,255,136,0.3)]">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white leading-tight">
                  {user?.full_name}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {user?.student?.roll_number ? `Roll: ${user.student.roll_number}` : user?.role?.replace('_', ' ').toUpperCase()}
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* Mobile Nav Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#091322] border-b border-emerald-500/20 px-4 py-3 space-y-1 animate-in slide-in-from-top duration-200">
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
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
                    isActive
                      ? 'bg-[#00ff88] text-slate-950 font-black shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={clsx('w-4 h-4', isActive ? 'text-slate-950' : 'text-slate-400')} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 pt-2 border-t border-emerald-500/10"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-emerald-500/10 bg-[#060c18] py-4 px-6 text-center text-xs text-slate-500">
          © 2026 <strong className="text-slate-300">{institution.name} (VCTM)</strong> • Code: 340 • Powered by Supabase Backend
        </footer>
      </div>
    </div>
  );
};

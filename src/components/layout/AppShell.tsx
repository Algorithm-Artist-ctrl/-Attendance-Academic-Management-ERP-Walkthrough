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
import vctmOfficialLogo from '../../assets/vctm-logo.png';
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
          { id: 'subjects', label: 'Subject Master', icon: BookOpen },
          { id: 'assignments', label: 'Faculty Assignments', icon: CheckSquare },
          { id: 'timetable', label: 'Timetable Master', icon: Calendar },
          { id: 'csv_import', label: 'CSV Import', icon: FileSpreadsheet },
          { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
          { 
            id: 'corrections', 
            label: 'Correction Oversight', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'audit_logs', label: 'Audit Logs', icon: ShieldCheck },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];
    }
  };

  // Bottom nav items for quick mobile access
  const getBottomNavItems = () => {
    switch (role) {
      case 'student':
        return [
          { id: 'dashboard', label: 'Home', icon: BarChart3 },
          { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
          { id: 'timetable', label: 'Timetable', icon: Calendar },
          { 
            id: 'corrections', 
            label: 'Requests', 
            icon: RotateCcw,
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined
          },
          { id: 'profile', label: 'Profile', icon: GraduationCap },
        ];

      case 'faculty':
        return [
          { id: 'dashboard', label: 'Home', icon: BarChart3 },
          { id: 'take_attendance', label: 'Classes', icon: CheckSquare },
          { id: 'timetable', label: 'Timetable', icon: Calendar },
          { 
            id: 'corrections', 
            label: 'Reviews', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'profile', label: 'Profile', icon: UserCheck },
        ];

      case 'hod':
        return [
          { id: 'dashboard', label: 'Home', icon: BarChart3 },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'faculty', label: 'Faculty', icon: Users },
          { id: 'timetable', label: 'Schedule', icon: Calendar },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
        ];

      case 'super_admin':
      default:
        return [
          { id: 'dashboard', label: 'Home', icon: BarChart3 },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'faculty', label: 'Faculty', icon: Users },
          { id: 'timetable', label: 'Timetable', icon: Calendar },
          { id: 'reports', label: 'Reports', icon: BarChart3 },
        ];
    }
  };

  const navItems = getNavItems();
  const bottomNavItems = getBottomNavItems();

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-100 flex flex-col md:flex-row max-w-full overflow-x-hidden">
      {/* ======================================================== */}
      {/* DESKTOP LEFT CYBER SIDEBAR */}
      {/* ======================================================== */}
      <aside className="hidden md:flex flex-col w-64 bg-[#081220]/90 border-r border-emerald-500/15 backdrop-blur-xl shrink-0 z-30 min-h-screen">
        {/* VCTM Brand Logo */}
        <div className="p-5 border-b border-emerald-500/15 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-950/80 border border-emerald-500/30 p-1 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,136,0.15)] shrink-0">
            <img src={vctmOfficialLogo} alt="VCTM Official Logo" className="w-full h-full object-contain" />
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
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/25 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* MAIN VIEWPORT AREA */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-[#07111e]/90 border-b border-emerald-500/15 backdrop-blur-xl px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 max-w-full">
          {/* Mobile Menu Toggle & Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-slate-300 hover:text-white hover:border-[#00ff88] active:scale-95 transition-all touch-target flex items-center justify-center cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <img src={vctmOfficialLogo} alt="VCTM" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
              <div>
                <span className="font-black text-sm sm:text-base text-white tracking-wide">
                  VCTM <span className="text-[#00ff88]">ERP</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] text-slate-400 font-mono">
                  Code: 340
                </span>
              </div>
            </div>
          </div>

          {/* User Profile Header Chip */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Notification Bell */}
            <button 
              onClick={() => onTabChange('notices')}
              title="View Notices & Circulars"
              className="relative p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-slate-300 hover:text-white hover:border-[#00ff88] transition-colors cursor-pointer touch-target flex items-center justify-center"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            </button>

            {/* Profile Avatar & Info */}
            <button 
              onClick={() => onTabChange('profile')}
              title="View Profile"
              className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 hover:border-[#00ff88] transition-colors shadow-xs cursor-pointer text-left touch-target"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-[#00ff88] text-slate-950 font-black flex items-center justify-center text-xs shadow-[0_0_12px_rgba(0,255,136,0.3)] shrink-0">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block max-w-[120px] lg:max-w-[180px] truncate">
                <div className="text-xs font-bold text-white leading-tight truncate">
                  {user?.full_name}
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">
                  {user?.student?.roll_number ? `Roll: ${user.student.roll_number}` : user?.role?.replace('_', ' ').toUpperCase()}
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* Full Slide-Out Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Slide Drawer Content */}
            <div className="relative w-4/5 max-w-xs bg-[#081220] border-r border-emerald-500/25 h-full flex flex-col z-10 shadow-2xl p-4 overflow-y-auto animate-in slide-in-from-left duration-250">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-emerald-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-950 border border-emerald-500/30 p-1 flex items-center justify-center">
                    <img src={vctmOfficialLogo} alt="VCTM" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white">VCTM ERP</h3>
                    <p className="text-[10px] text-slate-400">Institutional Portal</p>
                  </div>
                </div>

                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-emerald-500/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Mini Card */}
              <div className="my-3 p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-[#00ff88] text-slate-950 font-black flex items-center justify-center text-sm">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{user?.full_name}</p>
                  <p className="text-[10px] text-emerald-400 font-mono truncate">
                    {user?.student?.roll_number ? `Roll: ${user.student.roll_number}` : user?.role?.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="flex-1 space-y-1 py-2 overflow-y-auto">
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
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all touch-target',
                        isActive
                          ? 'bg-[#00ff88] text-slate-950 font-black shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={clsx('w-4 h-4', isActive ? 'text-slate-950' : 'text-slate-400')} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-extrabold">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Logout Button */}
              <div className="pt-3 border-t border-emerald-500/20 pb-safe">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all touch-target"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area (With bottom padding for Mobile Bottom Navigation) */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto space-y-6 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (Thumb Friendly) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#07111e]/95 border-t border-emerald-500/20 backdrop-blur-2xl px-2 py-1.5 pb-safe flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.5)]">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={clsx(
                  'flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative touch-target',
                  isActive ? 'text-[#00ff88]' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <div className={clsx(
                  'p-1 rounded-lg transition-all',
                  isActive && 'bg-emerald-500/20 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={clsx('text-[10px] font-bold mt-0.5 tracking-tight', isActive && 'text-white')}>
                  {item.label}
                </span>
                {item.badge && (
                  <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop/Tablet Footer */}
        <footer className="hidden md:block border-t border-emerald-500/10 bg-[#060c18] py-4 px-6 text-center text-xs text-slate-500">
          © 2026 <strong className="text-slate-300">{institution.name} (VCTM)</strong> • Code: 340 • Powered by Supabase Backend
        </footer>
      </div>
    </div>
  );
};

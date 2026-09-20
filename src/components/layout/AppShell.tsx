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
  MessageCircle,
  Sparkles,
  UserCheck,
  Award,
  WifiOff,
  ExternalLink,
  Archive
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import vctmOfficialLogo from '../../assets/vctm-logo.png';
import { clsx } from 'clsx';
import { NotificationSkeleton } from '../common/SkeletonLoader';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isTeachingMode?: boolean;
  onToggleTeachingMode?: (enabled: boolean) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab,
  onTabChange,
  isTeachingMode = false,
  onToggleTeachingMode,
}) => {
  const { user, role, logout } = useAuth();
  const { 
    institution, 
    corrections, 
    getFacultyCorrectionRequests, 
    faculty,
    attendanceRecords,
    attendanceSessions,
    subjects,
    notifications,
    unreadNotificationCount,
    unreadMessagesCount,
    leaveApplications,
    setActiveConversationId,
    setActiveGroupId,
    activeToast,
    dismissToast,
    isOnline,
    isLoading,
    markNotificationAsRead,
    markAllNotificationsAsRead
  } = useAcademic();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const currentFaculty = React.useMemo(() => {
    return faculty.find(
      f => f.id === user?.faculty_id || 
           f.id === user?.faculty?.id || 
           f.id === user?.id ||
           (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
           (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
           (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
    ) || user?.faculty;
  }, [faculty, user]);

  const pendingLeavesCount = React.useMemo(() => {
    if (role === 'student') {
      const studId = user?.student_id || user?.student?.id || user?.id;
      const activePending = leaveApplications.filter(
        l => (l.student_id === studId || !l.student_id) && 
             (l.status === 'PENDING_COORDINATOR' || l.status === 'PENDING_HOD')
      ).length;
      const unreadLeaveNotifs = notifications.filter(
        n => !n.is_read && (n.type?.startsWith('LEAVE_') || n.reference_type === 'leave_application')
      ).length;
      return Math.max(activePending, unreadLeaveNotifs);
    }
    if (role === 'faculty' || (role === 'hod' && isTeachingMode)) {
      return leaveApplications.filter(l => l.status === 'PENDING_COORDINATOR').length;
    }
    if (role === 'hod') {
      return leaveApplications.filter(l => l.status === 'PENDING_HOD').length;
    }
    if (role === 'super_admin') {
      return leaveApplications.filter(l => l.status === 'PENDING_COORDINATOR' || l.status === 'PENDING_HOD').length;
    }
    return 0;
  }, [leaveApplications, notifications, role, user, isTeachingMode]);

  const pendingCorrectionsCount = React.useMemo(() => {
    if (role === 'student') {
      const studId = user?.student_id || user?.student?.id || user?.id;
      return corrections.filter(c => c.student_id === studId && c.status === 'pending').length;
    }
    if (role === 'faculty' || (role === 'hod' && isTeachingMode)) {
      const facId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || user?.id || '';
      return getFacultyCorrectionRequests(facId).filter(c => c.status === 'pending').length;
    }
    if (role === 'hod') {
      const deptId = user?.department_id || currentFaculty?.department_id;
      if (!deptId) return corrections.filter(c => c.status === 'pending').length;
      return corrections.filter(c => {
        if (c.status !== 'pending') return false;
        const rec = c.record || attendanceRecords.find(r => r.id === c.attendance_record_id);
        const sess = rec?.session || attendanceSessions.find(s => s.id === rec?.attendance_session_id);
        const sub = sess?.subject || subjects.find(s => s.id === sess?.subject_id);
        const fac = sess?.faculty || faculty.find(f => f.id === sess?.faculty_id);
        return sub?.department_id === deptId || fac?.department_id === deptId || !sub?.department_id;
      }).length;
    }
    // super_admin
    return corrections.filter(c => c.status === 'pending').length;
  }, [corrections, role, user, currentFaculty, isTeachingMode, getFacultyCorrectionRequests, attendanceRecords, attendanceSessions, subjects, faculty]);

  const handleNotificationNavigation = (type: string, refType?: string, _refId?: string) => {
    const t = (type || '').toUpperCase();
    const rt = (refType || '').toUpperCase();
    if (t.includes('MESSAGE') || rt.includes('CONVERSATION') || rt.includes('GROUP')) {
      if (rt.includes('GROUP') || t.includes('GROUP')) {
        if (_refId) {
          setActiveGroupId(_refId);
        }
      } else if (_refId) {
        setActiveConversationId(_refId);
      }
      onTabChange('messages');
    } else if (t.includes('LEAVE') || rt.includes('LEAVE')) {
      onTabChange('leave');
    } else if (t.includes('MARKS') || rt.includes('MARKS') || rt.includes('SESSIONAL')) {
      onTabChange(role === 'student' ? 'marks' : 'marks_and_assessments');
    } else if (t.includes('ASSIGNMENT') || rt.includes('ASSIGNMENT')) {
      onTabChange(role === 'student' ? 'student_assignments' : 'assignments');
    } else if (t.includes('QUIZ') || rt.includes('QUIZ')) {
      onTabChange('quizzes');
    } else if (t.includes('ATTENDANCE') || rt.includes('ATTENDANCE')) {
      onTabChange(role === 'student' ? 'attendance' : 'corrections');
    } else if (t.includes('TIMETABLE') || rt.includes('TIMETABLE')) {
      onTabChange('timetable');
    } else if (t.includes('ACCOUNT') || rt.includes('ACCOUNT')) {
      onTabChange('profile');
    } else {
      onTabChange('notices');
    }
  };

  const renderNotificationIcon = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t.includes('LEAVE')) {
      return (
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
          <FileText className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (t.includes('MESSAGE') || t.includes('CONVERSATION')) {
      return (
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
          <MessageSquare className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (t.includes('MARKS')) {
      return (
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
          <Award className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (t.includes('ASSIGNMENT')) {
      return (
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
          <FileText className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (t.includes('QUIZ')) {
      return (
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (t.includes('ATTENDANCE')) {
      return (
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
          <ClipboardCheck className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (t.includes('TIMETABLE')) {
      return (
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
          <Calendar className="w-3.5 h-3.5" />
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
        <Bell className="w-3.5 h-3.5" />
      </div>
    );
  };

  // Build navigation items based on role (matching Screen 2, 6, 9)
  const getNavItems = () => {
    switch (role) {
      case 'student':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'profile', label: 'My Profile', icon: GraduationCap },
          { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
          { id: 'timetable', label: 'Time Table', icon: Calendar },
          { id: 'student_assignments', label: 'Assignments', icon: FileText },
          { id: 'quizzes', label: 'Quizzes', icon: Sparkles },
          { id: 'marks', label: 'My Marks & Sessional', icon: Award },
          { id: 'notices', label: 'Notices', icon: Bell },
          { 
            id: 'messages', 
            label: 'Messages', 
            icon: MessageSquare, 
            badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined 
          },
          { id: 'leave', label: 'Leave Application', icon: FileText, badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined },
          { id: 'feedback', label: 'Feedback', icon: MessageCircle },
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
          { id: 'quizzes', label: 'Quizzes', icon: Sparkles },
          { id: 'faculty_assignments', label: 'Assignments & Grading', icon: FileText },
          { id: 'marks_and_assessments', label: 'Marks & Assessments', icon: Award },
          { id: 'history', label: 'Attendance', icon: History },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { 
            id: 'corrections', 
            label: 'Correction Requests', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          { id: 'leave', label: 'Leave Applications', icon: FileText, badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined },
          { id: 'notices', label: 'Notices', icon: Bell },
          { 
            id: 'messages', 
            label: 'Messages', 
            icon: MessageSquare, 
            badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined 
          },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];

      case 'hod':
        if (isTeachingMode) {
          return [
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'profile', label: 'My Profile', icon: UserCheck },
            { id: 'take_attendance', label: "Today's Classes", icon: CheckSquare },
            { id: 'timetable', label: 'Time Table', icon: Calendar },
            { id: 'quizzes', label: 'Quizzes', icon: Sparkles },
            { id: 'faculty_assignments', label: 'Assignments & Grading', icon: FileText },
            { id: 'marks_and_assessments', label: 'Marks & Assessments', icon: Award },
            { id: 'history', label: 'Attendance History', icon: History },
            { id: 'students', label: 'Students', icon: GraduationCap },
            { 
              id: 'corrections', 
              label: 'Correction Requests', 
              icon: RotateCcw, 
              badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
            },
            { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
            { id: 'leave', label: 'Leave Applications', icon: FileText, badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined },
            { id: 'notices', label: 'Notices', icon: Bell },
            { 
              id: 'messages', 
              label: 'Messages', 
              icon: MessageSquare, 
              badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined 
            },
            { id: 'settings', label: 'Settings', icon: Settings },
          ];
        }
        return [
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'academic_oversight', label: 'Academic Oversight', icon: Award },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'import', label: 'Student Onboarding', icon: FileSpreadsheet },
          { id: 'faculty', label: 'Faculty', icon: Users },
          { id: 'timetable', label: 'Department Schedule', icon: Calendar },
          { id: 'academic_setup', label: 'Section Management', icon: Layers },
          { id: 'reports', label: 'Attendance Reports', icon: FileSpreadsheet },
          { 
            id: 'corrections', 
            label: 'Correction Reviews', 
            icon: RotateCcw, 
            badge: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined 
          },
          { id: 'leave', label: 'Leave Approvals', icon: FileText, badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined },
          { id: 'notices', label: 'Notices', icon: Bell },
          { 
            id: 'messages', 
            label: 'Messages', 
            icon: MessageSquare, 
            badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined 
          },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];

      case 'super_admin':
      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'faculty_accounts', label: 'Faculty Accounts', icon: Users },
          { id: 'student_accounts', label: 'Student Accounts', icon: GraduationCap },
          { id: 'academic_management', label: 'Academic Management', icon: Layers },
          { id: 'academic_setup', label: 'Academic Structure', icon: Building2 },
          { id: 'subjects', label: 'Subject Master', icon: BookOpen },
          { id: 'faculty_assignments', label: 'Faculty Assignments', icon: CheckSquare },
          { id: 'import', label: 'Student Data / CSV Import', icon: FileSpreadsheet },
          { id: 'timetable', label: 'Timetable Overview', icon: Calendar },
          { id: 'leave', label: 'Leave Oversight', icon: FileText, badge: pendingLeavesCount > 0 ? pendingLeavesCount : undefined },
          { id: 'notices', label: 'Notices', icon: Bell },
          { id: 'audit_logs', label: 'Audit Logs', icon: ShieldCheck },
          { id: 'records_archive', label: 'Records & Archive', icon: Archive },
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
        if (isTeachingMode) {
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
        }
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
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col md:flex-row max-w-full overflow-x-hidden">
      {/* ======================================================== */}
      {/* DESKTOP LEFT INSTITUTIONAL SIDEBAR */}
      {/* ======================================================== */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200/80 shrink-0 z-30 min-h-screen min-h-[100dvh]">
        {/* VCTM Brand Logo */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-white">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
            <img src={vctmOfficialLogo} alt="VCTM Official Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif-institutional font-black text-base tracking-wide text-slate-900">
                VCTM <span className="text-slate-950 font-sans font-extrabold text-sm">ERP</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium tracking-tight">
              Vivekananda College (340)
            </p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* HOD Faculty Mode Active Banner in Sidebar */}
          {role === 'hod' && isTeachingMode && (
            <div className="mb-3 p-3 rounded-2xl bg-slate-100 border border-slate-200 text-left space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" />
                  Faculty Mode
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-white">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                You are currently acting as <strong className="text-slate-900">Teaching Faculty</strong> for your assigned subjects & classes.
              </p>
              <button
                type="button"
                onClick={() => {
                  onToggleTeachingMode?.(false);
                  onTabChange('dashboard');
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white border border-slate-300 hover:border-rose-300 hover:bg-rose-50 text-xs font-bold text-slate-700 hover:text-rose-700 transition-all cursor-pointer shadow-xs group"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600 group-hover:rotate-180 transition-transform duration-300" />
                <span>Exit Faculty Mode</span>
              </button>
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={clsx(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[15px] font-semibold transition-all duration-200 cursor-pointer select-none group',
                  isActive
                    ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                    : 'text-[#334155] hover:text-[#0f172a] hover:bg-slate-100 border border-transparent'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={clsx('w-5 h-5 shrink-0', isActive ? 'text-white' : 'text-[#475569] group-hover:text-[#0f172a]')} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-bold shrink-0',
                    isActive ? 'bg-white text-[#0f172a]' : 'bg-[#0f172a] text-white'
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* HOD Teaching Mode Switcher (when in normal HOD mode) */}
          {role === 'hod' && !isTeachingMode && (
            <div className="pt-2">
              <div className="border-t border-slate-200 my-2.5" />
              <button
                type="button"
                onClick={() => {
                  onToggleTeachingMode?.(true);
                  onTabChange('dashboard');
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200 text-[#0f172a] hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer shadow-xs group select-none text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-800 group-hover:bg-[#0f172a] group-hover:text-white transition-colors">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold tracking-normal block leading-tight text-[#0f172a]">Teaching Mode</span>
                    <span className="text-xs text-[#334155] font-semibold">Act as Faculty</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-200 text-slate-800 group-hover:bg-[#0f172a] group-hover:text-white transition-colors">
                  Switch →
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer & Quick Actions */}
        <div className="p-3 border-t border-slate-100 space-y-2 bg-white">
          {role === 'hod' && isTeachingMode && (
            <button
              type="button"
              onClick={() => {
                onToggleTeachingMode?.(false);
                onTabChange('dashboard');
              }}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>← Return to HOD Portal</span>
            </button>
          )}

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] font-semibold text-[#334155] hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* MAIN VIEWPORT AREA */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full">
        {/* Offline Reconnection Alert Banner */}
        {!isOnline && (
          <aside role="status" className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md z-30 sticky top-0">
            <WifiOff className="w-4 h-4 text-slate-950 shrink-0" />
            <span>Connection interrupted. Reconnecting...</span>
          </aside>
        )}

        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-white/95 border-b border-slate-200/80 backdrop-blur-md px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 max-w-full">
          {/* Mobile Menu Toggle & Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-950 hover:border-slate-400 active:scale-95 transition-all touch-target flex items-center justify-center cursor-pointer shadow-xs"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 p-0.5 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                <img src={vctmOfficialLogo} alt="VCTM" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="font-serif-institutional font-bold text-base sm:text-lg text-[#0f172a] tracking-wide">
                  VCTM <span className="font-sans font-extrabold text-sm sm:text-base text-[#0f172a]">ERP</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs text-[#334155] font-semibold">
                  Institution Code: 340
                </span>
              </div>
            </div>
          </div>

          {/* User Profile Header Chip */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* HOD Faculty Mode Header Indicator & Exit Button */}
            {role === 'hod' && isTeachingMode && (
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-300 text-[#0f172a] text-xs font-bold tracking-normal flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#0f172a] animate-pulse" />
                  FACULTY MODE
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onToggleTeachingMode?.(false);
                    onTabChange('dashboard');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-rose-300 text-[#0f172a] hover:text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs hover:bg-rose-50"
                  title="Exit Faculty Mode and return to HOD Dashboard"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Exit Faculty Mode</span>
                  <span className="sm:hidden">Exit</span>
                </button>
              </div>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                title="View Notifications"
                className="relative p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0f172a] transition-colors cursor-pointer touch-target flex items-center justify-center shadow-xs"
              >
                <Bell className="w-5 h-5 text-[#0f172a]" />
                {unreadNotificationCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-[#0f172a] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                ) : (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-slate-400" />
                )}
              </button>

              {isNotifOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsNotifOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-150">
                    <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-[#0f172a]" />
                        <h4 className="text-sm font-bold text-[#0f172a] tracking-tight">Notifications</h4>
                        {unreadNotificationCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#0f172a] text-white">
                            {unreadNotificationCount} new
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadNotificationCount > 0 && (
                          <button
                            onClick={() => markAllNotificationsAsRead()}
                            className="text-xs font-bold text-[#334155] hover:text-[#0f172a] transition-colors cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setIsNotifOpen(false)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                      {isLoading && notifications.length === 0 ? (
                        <NotificationSkeleton count={4} />
                      ) : notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 space-y-1">
                          <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-bold text-[#0f172a]">No Notifications</p>
                          <p className="text-xs text-[#334155] font-medium">You're all caught up with classes and assessments.</p>
                        </div>
                      ) : (
                        notifications.slice(0, 15).map(n => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (!n.is_read) markNotificationAsRead(n.id);
                              handleNotificationNavigation(n.type, n.reference_type, n.reference_id);
                              setIsNotifOpen(false);
                            }}
                            className={clsx(
                              "p-3.5 transition-colors cursor-pointer flex gap-3 text-left",
                              n.is_read ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100"
                            )}
                          >
                            <div className="mt-0.5 shrink-0">
                              {renderNotificationIcon(n.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-sm font-bold text-[#0f172a] truncate">{n.title}</span>
                                {!n.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-[#0f172a] shrink-0" />
                                )}
                              </div>
                              <p className="text-[13px] text-[#334155] font-medium mt-0.5 line-clamp-2 leading-relaxed">
                                {n.message}
                              </p>
                              <span className="text-xs text-[#475569] font-medium mt-1 block">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                      <button
                        onClick={() => {
                          setIsNotifOpen(false);
                          onTabChange('notices');
                        }}
                        className="text-xs font-semibold text-[#0f172a] hover:underline cursor-pointer"
                      >
                        View Official Notices & Circulars →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Avatar & Info */}
            <button 
              onClick={() => onTabChange('profile')}
              title="View Profile"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0f172a] transition-colors shadow-xs cursor-pointer text-left touch-target"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0f172a] text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block max-w-[140px] lg:max-w-[200px] truncate">
                <div className="text-[15px] font-bold text-[#0f172a] leading-tight truncate">
                  {user?.full_name}
                </div>
                <div className="text-xs text-[#334155] font-semibold truncate">
                  {user?.student?.roll_number 
                    ? `Roll: ${user.student.roll_number}` 
                    : (role === 'hod' && isTeachingMode)
                      ? 'HOD • FACULTY MODE'
                      : user?.role?.replace('_', ' ').toUpperCase()}
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
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Slide Drawer Content */}
            <div className="relative w-4/5 max-w-xs bg-white border-r border-slate-200 h-full flex flex-col z-10 shadow-2xl p-4 overflow-y-auto animate-in slide-in-from-left duration-250 text-slate-900">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    <img src={vctmOfficialLogo} alt="VCTM" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-serif-institutional font-black text-sm text-slate-900">VCTM ERP</h3>
                    <p className="text-[10px] text-slate-500">Institutional Portal</p>
                  </div>
                </div>

                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Mini Card */}
              <div className="my-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0f172a] text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-[#0f172a] truncate">{user?.full_name}</p>
                  <p className="text-xs text-[#475569] font-bold truncate">
                    {user?.student?.roll_number 
                      ? `Roll: ${user.student.roll_number}` 
                      : (role === 'hod' && isTeachingMode)
                        ? 'HOD • FACULTY MODE'
                        : user?.role?.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="flex-1 space-y-1 py-2 overflow-y-auto">
                {/* Mobile Drawer HOD Faculty Mode Banner */}
                {role === 'hod' && isTeachingMode && (
                  <div className="mb-2 p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-left space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-normal text-[#0f172a] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#0f172a] animate-pulse" />
                        Faculty Mode Active
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleTeachingMode?.(false);
                        onTabChange('dashboard');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#0f172a]"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Exit Faculty Mode</span>
                    </button>
                  </div>
                )}

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
                        'w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-[15px] font-semibold transition-all touch-target',
                        isActive
                          ? 'bg-[#0f172a] text-white shadow-xs'
                          : 'text-[#475569] hover:text-[#0f172a] hover:bg-slate-100'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={clsx('w-5 h-5 shrink-0', isActive ? 'text-white' : 'text-[#475569]')} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={clsx(
                          'px-2 py-0.5 rounded-full text-xs font-bold',
                          isActive ? 'bg-white text-[#0f172a]' : 'bg-[#0f172a] text-white'
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Mobile Drawer HOD Teaching Mode Switcher */}
                {role === 'hod' && !isTeachingMode && (
                  <div className="pt-2">
                    <div className="border-t border-slate-200 my-2" />
                    <button
                      type="button"
                      onClick={() => {
                        onToggleTeachingMode?.(true);
                        onTabChange('dashboard');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200 text-[#0f172a]"
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-[#334155]" />
                        <span>Teaching / Faculty Mode</span>
                      </div>
                      <span className="text-xs font-bold uppercase text-[#0f172a]">Switch →</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Logout Button */}
              <div className="pt-3 border-t border-slate-100 pb-safe">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[15px] font-semibold text-[#475569] hover:text-rose-700 hover:bg-rose-50 border border-slate-300 transition-all touch-target cursor-pointer"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
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
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 border-t border-slate-200 backdrop-blur-2xl px-2 py-1.5 pb-safe flex items-center justify-around shadow-[0_-2px_15px_rgba(0,0,0,0.05)] h-[var(--app-bottom-nav-height)]">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={clsx(
                  'flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative touch-target',
                  isActive ? 'text-[#0f172a]' : 'text-[#475569] hover:text-[#0f172a]'
                )}
              >
                <div className={clsx(
                  'p-1 rounded-lg transition-all',
                  isActive && 'bg-slate-100 shadow-xs text-[#0f172a]'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={clsx('text-[11px] font-semibold mt-0.5 tracking-tight', isActive ? 'text-[#0f172a] font-bold' : 'text-[#475569]')}>
                  {item.label}
                </span>
                {item.badge && (
                  <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-[#0f172a] text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop/Tablet Footer */}
        <footer className="hidden md:block border-t border-slate-200/80 bg-white py-4 px-6 text-center text-xs text-[#475569] font-medium">
          © 2026 <strong className="text-[#0f172a]">{institution.name} (VCTM)</strong> • Code: 340 • Powered by Supabase Backend
        </footer>

        {/* Realtime Floating Non-Blocking Live Toast Banner */}
        {activeToast && (
          <aside
            role="status"
            aria-live="polite"
            className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-24px)] sm:w-auto p-4 rounded-2xl bg-white border border-slate-300 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200 text-[#0f172a]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {renderNotificationIcon(activeToast.type)}
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#0f172a]">
                    Live Notification
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#0f172a] animate-ping" />
                </div>
                <h5 className="text-sm font-bold text-[#0f172a] mt-0.5 truncate">{activeToast.title}</h5>
                <p className="text-xs text-[#475569] mt-0.5 line-clamp-2 leading-relaxed font-medium">
                  {activeToast.message}
                </p>
                <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeToast.id) markNotificationAsRead(activeToast.id);
                      handleNotificationNavigation(activeToast.type, activeToast.referenceType, activeToast.referenceId);
                      dismissToast();
                    }}
                    className="px-3 py-1 rounded-lg bg-[#0f172a] text-white text-xs font-semibold hover:bg-black transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Now</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={dismissToast}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-[#475569] hover:text-[#0f172a] text-xs font-bold transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissToast}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

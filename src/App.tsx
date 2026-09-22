import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from './context/AuthContext';
import { useAcademic } from './context/AcademicContext';
import { LoginPage } from './pages/auth/LoginPage';
import vctmOfficialLogo from './assets/vctm-logo.png';
import { GraduationCap, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  parseCurrentRoute,
  getCanonicalPath,
  getStoredHODMode,
  setStoredHODMode
} from './lib/routing/router';

const ResetPasswordModal = lazy(() => import('./components/auth/ResetPasswordModal').then(m => ({ default: m.ResetPasswordModal })));
const AppShell = lazy(() => import('./components/layout/AppShell').then(m => ({ default: m.AppShell })));

// Lazy Loaded Common Pages
const ProfilePage = lazy(() => import('./pages/common/ProfilePage').then(m => ({ default: m.ProfilePage })));
const NoticesPage = lazy(() => import('./pages/common/NoticesPage').then(m => ({ default: m.NoticesPage })));
const MessagesPage = lazy(() => import('./pages/communication/MessagesPage').then(m => ({ default: m.MessagesPage })));
const SettingsPage = lazy(() => import('./pages/common/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Lazy Loaded Student Pages
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const StudentAttendancePage = lazy(() => import('./pages/student/StudentAttendancePage').then(m => ({ default: m.StudentAttendancePage })));
const StudentTimetablePage = lazy(() => import('./pages/student/StudentTimetablePage').then(m => ({ default: m.StudentTimetablePage })));
const CorrectionRequestsPage = lazy(() => import('./pages/student/CorrectionRequestsPage').then(m => ({ default: m.CorrectionRequestsPage })));
const FeedbackPage = lazy(() => import('./pages/student/FeedbackPage').then(m => ({ default: m.FeedbackPage })));
const LeaveApplicationPage = lazy(() => import('./pages/student/LeaveApplicationPage').then(m => ({ default: m.LeaveApplicationPage })));
const StudentQuizzesPage = lazy(() => import('./pages/student/StudentQuizzesPage').then(m => ({ default: m.StudentQuizzesPage })));
const StudentAssignmentsPage = lazy(() => import('./pages/student/StudentAssignmentsPage').then(m => ({ default: m.StudentAssignmentsPage })));
const StudentMarksPage = lazy(() => import('./pages/student/StudentMarksPage').then(m => ({ default: m.StudentMarksPage })));

// Lazy Loaded Faculty Pages
const FacultyDashboard = lazy(() => import('./pages/faculty/FacultyDashboard').then(m => ({ default: m.FacultyDashboard })));
const TakeAttendancePage = lazy(() => import('./pages/faculty/TakeAttendancePage').then(m => ({ default: m.TakeAttendancePage })));
const FacultyTimetablePage = lazy(() => import('./pages/faculty/FacultyTimetablePage').then(m => ({ default: m.FacultyTimetablePage })));
const ReviewCorrectionsPage = lazy(() => import('./pages/faculty/ReviewCorrectionsPage').then(m => ({ default: m.ReviewCorrectionsPage })));
const AttendanceHistoryPage = lazy(() => import('./pages/faculty/AttendanceHistoryPage').then(m => ({ default: m.AttendanceHistoryPage })));
const CourseAssignmentsPage = lazy(() => import('./pages/faculty/FacultyAssignmentsPage').then(m => ({ default: m.FacultyAssignmentsPage })));
const FacultyQuizzesPage = lazy(() => import('./pages/faculty/FacultyQuizzesPage').then(m => ({ default: m.FacultyQuizzesPage })));
const FacultySessionalMarksPage = lazy(() => import('./pages/faculty/FacultySessionalMarksPage').then(m => ({ default: m.FacultySessionalMarksPage })));
const FacultyMarksManagementPage = lazy(() => import('./pages/faculty/FacultyMarksManagementPage').then(m => ({ default: m.FacultyMarksManagementPage })));
const FacultySectionWorkspacePage = lazy(() => import('./pages/faculty/FacultySectionWorkspacePage').then(m => ({ default: m.FacultySectionWorkspacePage })));

// Lazy Loaded HOD Pages
const HODDashboard = lazy(() => import('./pages/hod/HODDashboard').then(m => ({ default: m.HODDashboard })));
const HODAcademicOversightPage = lazy(() => import('./pages/hod/HODAcademicOversightPage').then(m => ({ default: m.HODAcademicOversightPage })));
const LeaveManagementPage = lazy(() => import('./pages/leave/LeaveManagementPage').then(m => ({ default: m.LeaveManagementPage })));

// Lazy Loaded Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AcademicSetupPage = lazy(() => import('./pages/admin/AcademicSetupPage').then(m => ({ default: m.AcademicSetupPage })));
const StudentDirectoryPage = lazy(() => import('./pages/admin/StudentDirectoryPage').then(m => ({ default: m.StudentDirectoryPage })));
const FacultyDirectoryPage = lazy(() => import('./pages/admin/FacultyDirectoryPage').then(m => ({ default: m.FacultyDirectoryPage })));
const SubjectsPage = lazy(() => import('./pages/admin/SubjectsPage').then(m => ({ default: m.SubjectsPage })));
const FacultyAssignmentsPage = lazy(() => import('./pages/admin/FacultyAssignmentsPage').then(m => ({ default: m.FacultyAssignmentsPage })));
const TimetableManagerPage = lazy(() => import('./pages/admin/TimetableManagerPage').then(m => ({ default: m.TimetableManagerPage })));
const CSVImportPage = lazy(() => import('./pages/admin/CSVImportPage').then(m => ({ default: m.CSVImportPage })));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const FacultyAccountsPage = lazy(() => import('./pages/admin/FacultyAccountsPage').then(m => ({ default: m.FacultyAccountsPage })));
const StudentAccountsPage = lazy(() => import('./pages/admin/StudentAccountsPage').then(m => ({ default: m.StudentAccountsPage })));
const AcademicManagementPage = lazy(() => import('./pages/admin/AcademicManagementPage').then(m => ({ default: m.AcademicManagementPage })));
const RecordsArchivePage = lazy(() => import('./pages/admin/RecordsArchivePage').then(m => ({ default: m.RecordsArchivePage })));

// Lightweight Institutional Skeleton Loader for Fast Transitions
const PageSkeletonLoader: React.FC = () => (
  <div className="space-y-6 animate-pulse p-2">
    <div className="h-24 rounded-3xl bg-white border border-slate-200/80 shadow-xs" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="h-28 rounded-2xl bg-white border border-slate-200/80 shadow-xs" />
      <div className="h-28 rounded-2xl bg-white border border-slate-200/80 shadow-xs" />
      <div className="h-28 rounded-2xl bg-white border border-slate-200/80 shadow-xs" />
      <div className="h-28 rounded-2xl bg-white border border-slate-200/80 shadow-xs" />
    </div>
    <div className="h-96 rounded-3xl bg-white border border-slate-200/80 shadow-xs" />
  </div>
);

export const AppContent: React.FC = () => {
  const { user, isAuthenticated, role, isLoading, logout, isPasswordRecovery } = useAuth();
  const { faculty } = useAcademic();
  // Synchronously parse route on initial render before any hooks/effects
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const parsed = parseCurrentRoute(window.location.pathname, window.location.search, role);
    return parsed.tab;
  });

  const [navigationParams, setNavigationParams] = useState<any>(() => {
    if (typeof window === 'undefined') return null;
    const parsed = parseCurrentRoute(window.location.pathname, window.location.search, role);
    return parsed.params;
  });

  const [isTeachingMode, setIsTeachingMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (window.location.pathname.startsWith('/hod/teaching')) return true;
    const stored = getStoredHODMode();
    return stored === 'teaching';
  });

  // Browser PopState (Back/Forward) listener
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (typeof window === 'undefined') return;
      const parsed = parseCurrentRoute(window.location.pathname, window.location.search, role);
      setActiveTab(parsed.tab);
      setIsTeachingMode(parsed.isTeachingMode);
      setNavigationParams(parsed.params || event.state || null);
      if (role === 'hod') {
        setStoredHODMode(parsed.isTeachingMode ? 'teaching' : 'management');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [role]);

  // Route authorization & canonicalization effect once auth resolves
  useEffect(() => {
    if (isLoading || !isAuthenticated || !role) return;

    if (typeof window !== 'undefined') {
      const currentRoute = parseCurrentRoute(window.location.pathname, window.location.search, role);

      // Authorization guard: if user is not authorized for this route, redirect to role home
      if (!currentRoute.isAuthorized) {
        const roleHome = getCanonicalPath(role, 'dashboard', false);
        setActiveTab('dashboard');
        setIsTeachingMode(false);
        setNavigationParams(null);
        window.history.replaceState(null, '', roleHome);
        return;
      }

      if (role === 'hod') {
        setStoredHODMode(currentRoute.isTeachingMode ? 'teaching' : 'management');
      }

      setActiveTab(currentRoute.tab);
      setIsTeachingMode(currentRoute.isTeachingMode);
      if (currentRoute.params) {
        setNavigationParams(currentRoute.params);
      }

      // Canonicalize alias/root routes (e.g. '/' or '/dashboard') without triggering page reload
      if (currentRoute.requiresRedirect || window.location.pathname === '/' || window.location.pathname === '/dashboard') {
        window.history.replaceState(currentRoute.params, '', currentRoute.canonicalPath);
      }
    }
  }, [isLoading, isAuthenticated, role]);

  // Role-Based Code-Splitting Prefetching: Preload key role pages into browser cache for instant switching
  useEffect(() => {
    if (!isAuthenticated || !role) return;

    const timer = setTimeout(() => {
      const runPrefetch = () => {
        if (role === 'faculty') {
          import('./pages/faculty/TakeAttendancePage');
          import('./pages/faculty/FacultyTimetablePage');
          import('./pages/faculty/FacultyMarksManagementPage');
          import('./pages/communication/MessagesPage');
        } else if (role === 'student') {
          import('./pages/student/StudentAttendancePage');
          import('./pages/student/StudentTimetablePage');
          import('./pages/student/StudentMarksPage');
          import('./pages/communication/MessagesPage');
        } else if (role === 'hod') {
          import('./pages/admin/TimetableManagerPage');
          import('./pages/leave/LeaveManagementPage');
          import('./pages/faculty/FacultyTimetablePage');
          import('./pages/communication/MessagesPage');
        } else if (role === 'super_admin') {
          import('./pages/admin/StudentDirectoryPage');
          import('./pages/admin/FacultyDirectoryPage');
          import('./pages/admin/TimetableManagerPage');
        }
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(runPrefetch, { timeout: 4000 });
      } else {
        runPrefetch();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, role]);

  const handleToggleTeachingMode = (enabled: boolean) => {
    setIsTeachingMode(enabled);
    setActiveTab('dashboard');
    setNavigationParams(null);
    setStoredHODMode(enabled ? 'teaching' : 'management');

    if (typeof window !== 'undefined') {
      const targetUrl = enabled ? '/hod/teaching' : '/hod';
      window.history.pushState(null, '', targetUrl);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4 text-slate-900">
        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-2 shadow-md flex items-center justify-center overflow-hidden">
          <img src={vctmOfficialLogo} alt="VCTM" className="w-full h-full object-contain rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" />
          <p className="text-xs font-bold tracking-wider text-slate-700">
            Connecting to VCTM ERP Cloud...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        {isPasswordRecovery && (
          <Suspense fallback={null}>
            <ResetPasswordModal isOpen={true} />
          </Suspense>
        )}
      </>
    );
  }

  const handleNavigate = (tab: string, params?: any, replace = false) => {
    setActiveTab(tab);
    setNavigationParams(params || null);

    if (typeof window !== 'undefined') {
      const targetUrl = getCanonicalPath(role, tab, role === 'hod' && isTeachingMode, params);
      const currentUrl = window.location.pathname + window.location.search;
      if (targetUrl !== currentUrl) {
        if (replace) {
          window.history.replaceState(params || null, '', targetUrl);
        } else {
          window.history.pushState(params || null, '', targetUrl);
        }
      }
    }
  };

  const renderContent = () => {
    // 1. Student Portal Routing
    if (role === 'student') {
      switch (activeTab) {
        case 'profile':
          return <ProfilePage />;
        case 'attendance':
          return <StudentAttendancePage />;
        case 'quizzes':
          return <StudentQuizzesPage />;
        case 'student_assignments':
          return <StudentAssignmentsPage />;
        case 'marks':
          return <StudentMarksPage />;
        case 'timetable':
          return <StudentTimetablePage />;
        case 'notices':
          return <NoticesPage />;
        case 'messages':
          return <MessagesPage initialConversationId={navigationParams?.conversationId} initialGroupId={navigationParams?.groupId} />;
        case 'feedback':
          return <FeedbackPage />;
        case 'leave':
          return <LeaveApplicationPage />;
        case 'corrections':
          return <CorrectionRequestsPage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return <StudentDashboard onNavigate={handleNavigate} />;
      }
    }

    // 2. Faculty Portal Routing
    if (role === 'faculty') {
      switch (activeTab) {
        case 'profile':
          return <ProfilePage />;
        case 'take_attendance':
          return (
            <TakeAttendancePage
              initialTimetableEntryId={navigationParams?.timetableEntryId}
              initialSessionDate={navigationParams?.sessionDate}
              onFinished={() => handleNavigate('dashboard')}
            />
          );
        case 'timetable':
          return (
            <FacultyTimetablePage
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'quizzes':
          return <FacultyQuizzesPage />;
        case 'faculty_assignments':
          return <CourseAssignmentsPage />;
        case 'section_workspace':
          return (
            <FacultySectionWorkspacePage
              initialSubjectId={navigationParams?.subjectId}
              initialSectionId={navigationParams?.sectionId}
              initialSubTab={navigationParams?.initialSubTab || 'overview'}
              onBack={() => handleNavigate('dashboard')}
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'marks_and_assessments':
        case 'sessional_marks':
          return <FacultyMarksManagementPage />;
        case 'history':
          return (
            <AttendanceHistoryPage
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'students':
          return <StudentDirectoryPage />;
        case 'reports':
          return <ReportsPage />;
        case 'notices':
          return <NoticesPage />;
        case 'messages':
          return <MessagesPage initialConversationId={navigationParams?.conversationId} initialGroupId={navigationParams?.groupId} />;
        case 'leave':
          return <LeaveManagementPage />;
        case 'corrections':
          return <ReviewCorrectionsPage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return (
            <FacultyDashboard
              onNavigate={handleNavigate}
            />
          );
      }
    }

    // 3. HOD Portal Routing
    if (role === 'hod') {
      // A. Dedicated Teaching / Faculty Mode for HOD
      if (isTeachingMode) {
        const currentFaculty = faculty.find(
          f => f.id === user?.faculty_id ||
               f.id === user?.faculty?.id ||
               f.id === user?.id ||
               (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
               (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
               (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
        ) || user?.faculty;
        const facultyId = currentFaculty?.id || user?.faculty_id || '';

        if (!facultyId) {
          return (
            <div className="bg-white p-8 rounded-3xl border border-rose-200 text-center max-w-xl mx-auto space-y-4 my-12 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-slate-900 font-serif-institutional">Faculty Profile Not Configured</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your account is authenticated as <strong className="text-slate-900">Head of Department</strong>, but no active teaching faculty profile was resolved for your user record ({user?.email}).
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleToggleTeachingMode(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#0f172a] text-white font-black text-xs hover:bg-black transition-all cursor-pointer shadow-xs"
                >
                  Return to HOD Dashboard
                </button>
              </div>
            </div>
          );
        }

        let facultyModeComponent: React.ReactNode;
        switch (activeTab) {
          case 'profile':
            facultyModeComponent = <ProfilePage />;
            break;
          case 'take_attendance':
            facultyModeComponent = (
              <TakeAttendancePage
                initialTimetableEntryId={navigationParams?.timetableEntryId}
                initialSessionDate={navigationParams?.sessionDate}
                onFinished={() => handleNavigate('dashboard')}
              />
            );
            break;
          case 'timetable':
            facultyModeComponent = (
              <FacultyTimetablePage
                onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
              />
            );
            break;
          case 'quizzes':
            facultyModeComponent = <FacultyQuizzesPage />;
            break;
          case 'faculty_assignments':
            facultyModeComponent = <CourseAssignmentsPage />;
            break;
          case 'section_workspace':
            facultyModeComponent = (
              <FacultySectionWorkspacePage
                initialSubjectId={navigationParams?.subjectId}
                initialSectionId={navigationParams?.sectionId}
                initialSubTab={navigationParams?.initialSubTab || 'overview'}
                onBack={() => handleNavigate('dashboard')}
                onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
              />
            );
            break;
          case 'marks_and_assessments':
          case 'sessional_marks':
            facultyModeComponent = <FacultyMarksManagementPage />;
            break;
          case 'history':
            facultyModeComponent = (
              <AttendanceHistoryPage
                onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
              />
            );
            break;
          case 'students':
            facultyModeComponent = <StudentDirectoryPage forceFacultyScope={true} />;
            break;
          case 'reports':
            facultyModeComponent = <ReportsPage forceFacultyMode={true} />;
            break;
          case 'notices':
            facultyModeComponent = <NoticesPage />;
            break;
          case 'messages':
            facultyModeComponent = <MessagesPage initialConversationId={navigationParams?.conversationId} initialGroupId={navigationParams?.groupId} />;
            break;
          case 'leave':
            facultyModeComponent = <LeaveManagementPage />;
            break;
          case 'corrections':
            facultyModeComponent = <ReviewCorrectionsPage forceFacultyMode={true} />;
            break;
          case 'settings':
            facultyModeComponent = <SettingsPage />;
            break;
          case 'dashboard':
          default:
            facultyModeComponent = <FacultyDashboard onNavigate={handleNavigate} />;
            break;
        }

        return (
          <div className="space-y-6">
            {/* Top Mode Banner */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-2.5 py-0.5 rounded-md bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    FACULTY MODE
                  </div>
                  <span className="text-[11px] font-bold text-slate-300">•</span>
                  <span className="text-xs font-bold text-slate-700">
                    Role: <span className="text-slate-900 font-semibold">HOD + Faculty</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-300">•</span>
                  <span className="text-xs font-medium text-slate-600">
                    You are currently acting as: <strong className="text-slate-900">FACULTY</strong>
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 font-serif-institutional tracking-tight flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-slate-900" />
                  Teaching / Faculty Mode
                </h2>
                <p className="text-xs text-slate-600">
                  Welcome, <strong className="text-slate-900">{user?.full_name || 'HOD'}</strong>. Manage attendance, tests, marks, and assignments strictly for your assigned classes.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleTeachingMode(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500 group-hover:rotate-180 transition-transform duration-300" />
                  <span>Exit Faculty Mode</span>
                </button>
              </div>
            </div>

            {facultyModeComponent}
          </div>
        );
      }

      // B. Normal HOD Management Mode
      switch (activeTab) {
        case 'profile':
          return <ProfilePage />;
        case 'academic_oversight':
          return <HODAcademicOversightPage />;
        case 'take_attendance':
          return (
            <TakeAttendancePage
              initialTimetableEntryId={navigationParams?.timetableEntryId}
              initialSessionDate={navigationParams?.sessionDate}
              onFinished={() => handleNavigate('dashboard')}
            />
          );
        case 'timetable':
          return <TimetableManagerPage />;
        case 'academic_management':
          return <AcademicManagementPage onNavigate={handleNavigate} />;
        case 'academic_setup':
          return <AcademicSetupPage />;
        case 'subjects':
          return <SubjectsPage />;
        case 'faculty_assignments':
          return <FacultyAssignmentsPage />;
        case 'quizzes':
          return <FacultyQuizzesPage />;
        case 'faculty_assignments_content':
          return <CourseAssignmentsPage />;
        case 'section_workspace':
          return (
            <FacultySectionWorkspacePage
              initialSubjectId={navigationParams?.subjectId}
              initialSectionId={navigationParams?.sectionId}
              initialSubTab={navigationParams?.initialSubTab || 'overview'}
              onBack={() => handleNavigate('dashboard')}
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'marks_and_assessments':
        case 'sessional_marks':
          return <FacultyMarksManagementPage />;
        case 'history':
          return (
            <AttendanceHistoryPage
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'students':
          return <StudentDirectoryPage />;
        case 'import':
          return <CSVImportPage />;
        case 'faculty':
          return <FacultyDirectoryPage />;
        case 'notices':
          return <NoticesPage />;
        case 'messages':
          return <MessagesPage initialConversationId={navigationParams?.conversationId} initialGroupId={navigationParams?.groupId} />;
        case 'leave':
          return <LeaveManagementPage />;
        case 'reports':
          return <ReportsPage />;
        case 'corrections':
          return <ReviewCorrectionsPage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return <HODDashboard onNavigate={handleNavigate} />;
      }
    }

    // 4. Admin Portal Routing
    if (role === 'super_admin') {
      switch (activeTab) {
        case 'profile':
          return <ProfilePage />;
        case 'faculty_accounts':
          return <FacultyAccountsPage />;
        case 'student_accounts':
          return <StudentAccountsPage />;
        case 'academic_management':
          return <AcademicManagementPage onNavigate={handleNavigate} />;
        case 'academic_setup':
          return <AcademicSetupPage />;
        case 'students':
          return <StudentAccountsPage />;
        case 'faculty':
          return <FacultyAccountsPage />;
        case 'subjects':
          return <SubjectsPage />;
        case 'faculty_assignments':
          return <FacultyAssignmentsPage />;
        case 'timetable':
          return <TimetableManagerPage />;
        case 'import':
          return <CSVImportPage />;
        case 'reports':
          return <ReportsPage />;
        case 'corrections':
          return <ReviewCorrectionsPage />;
        case 'notices':
          return <NoticesPage />;
        case 'messages':
          return <MessagesPage initialConversationId={navigationParams?.conversationId} initialGroupId={navigationParams?.groupId} />;
        case 'leave':
          return <LeaveManagementPage />;
        case 'audit_logs':
          return <AuditLogsPage />;
        case 'records_archive':
          return <RecordsArchivePage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return <AdminDashboard onNavigate={handleNavigate} />;
      }
    }

    return (
      <div className="p-8 text-center text-rose-400">
        <p className="font-bold text-sm">Unauthorized: Unrecognized institutional role.</p>
        <p className="text-xs text-slate-400 mt-1">Please contact your system administrator.</p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-4 px-4 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-bold hover:bg-rose-500/30"
        >
          Sign Out
        </button>
      </div>
    );
  };

  return (
    <>
      <Suspense fallback={<PageSkeletonLoader />}>
        <AppShell
          activeTab={activeTab}
          onTabChange={handleNavigate}
          isTeachingMode={role === 'hod' && isTeachingMode}
          onToggleTeachingMode={handleToggleTeachingMode}
        >
          <Suspense fallback={<PageSkeletonLoader />}>
            {renderContent()}
          </Suspense>
        </AppShell>
      </Suspense>
      {isPasswordRecovery && (
        <Suspense fallback={null}>
          <ResetPasswordModal isOpen={true} />
        </Suspense>
      )}
    </>
  );
};

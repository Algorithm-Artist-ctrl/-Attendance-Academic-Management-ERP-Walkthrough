import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from './context/AuthContext';
import { useAcademic } from './context/AcademicContext';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordModal } from './components/auth/ResetPasswordModal';
import { AppShell } from './components/layout/AppShell';
import vctmOfficialLogo from './assets/vctm-logo.png';
import { GraduationCap, RotateCcw, AlertTriangle } from 'lucide-react';

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

// Lightweight Cyber Skeleton Loader for Fast Transitions
const PageSkeletonLoader: React.FC = () => (
  <div className="space-y-6 animate-pulse p-2">
    <div className="h-24 rounded-3xl bg-slate-900/60 border border-emerald-500/15" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="h-28 rounded-2xl bg-slate-900/40 border border-emerald-500/10" />
      <div className="h-28 rounded-2xl bg-slate-900/40 border border-emerald-500/10" />
      <div className="h-28 rounded-2xl bg-slate-900/40 border border-emerald-500/10" />
      <div className="h-28 rounded-2xl bg-slate-900/40 border border-emerald-500/10" />
    </div>
    <div className="h-96 rounded-3xl bg-slate-900/50 border border-emerald-500/15" />
  </div>
);

export const AppContent: React.FC = () => {
  const { user, isAuthenticated, role, isLoading, logout, isPasswordRecovery } = useAuth();
  const { faculty } = useAcademic();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const [isTeachingMode, setIsTeachingMode] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/hod/teaching');
  });

  useEffect(() => {
    const handlePopState = () => {
      setIsTeachingMode(window.location.pathname.startsWith('/hod/teaching'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleToggleTeachingMode = (enabled: boolean) => {
    setIsTeachingMode(enabled);
    setActiveTab('dashboard');
    setNavigationParams(null);
    if (typeof window !== 'undefined') {
      if (enabled) {
        window.history.pushState(null, '', '/hod/teaching');
      } else {
        window.history.pushState(null, '', '/hod');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-emerald-500/30 p-1 animate-bounce shadow-[0_0_25px_rgba(0,255,136,0.3)] flex items-center justify-center overflow-hidden">
          <img src={vctmOfficialLogo} alt="VCTM" className="w-full h-full object-cover rounded-xl" />
        </div>
        <p className="text-xs font-bold tracking-wider text-[#00ff88]">
          Connecting to VCTM ERP Cloud...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        {isPasswordRecovery && <ResetPasswordModal isOpen={true} />}
      </>
    );
  }

  const handleNavigate = (tab: string, params?: any) => {
    setActiveTab(tab);
    setNavigationParams(params || null);
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
              onFinished={() => setActiveTab('dashboard')}
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
              onBack={() => setActiveTab('dashboard')}
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'sessional_marks':
          return <FacultySessionalMarksPage />;
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
            <div className="glass-panel p-8 rounded-3xl border border-rose-500/30 text-center max-w-xl mx-auto space-y-4 my-12">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-white">Faculty Profile Not Configured</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your account is authenticated as <strong className="text-white">Head of Department</strong>, but no active teaching faculty profile was resolved for your user record ({user?.email}).
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleToggleTeachingMode(false)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs hover:bg-[#00ff88] transition-all cursor-pointer shadow-md"
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
                onFinished={() => setActiveTab('dashboard')}
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
                onBack={() => setActiveTab('dashboard')}
                onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
              />
            );
            break;
          case 'sessional_marks':
            facultyModeComponent = <FacultySessionalMarksPage />;
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
            <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-[#00ff88]/30 bg-gradient-to-r from-emerald-950/70 via-slate-900/90 to-slate-950/80 shadow-[0_0_25px_rgba(0,255,136,0.12)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-2.5 py-0.5 rounded-md bg-[#00ff88]/20 border border-[#00ff88]/40 text-[#00ff88] text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                    FACULTY MODE
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">•</span>
                  <span className="text-xs font-bold text-slate-300">
                    Role: <span className="text-emerald-400">HOD + Faculty</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">•</span>
                  <span className="text-xs font-medium text-slate-400">
                    You are currently acting as: <strong className="text-white">FACULTY</strong>
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#00ff88]" />
                  Teaching / Faculty Mode
                </h2>
                <p className="text-xs text-slate-300">
                  Welcome, <strong className="text-white">{user?.full_name || 'HOD'}</strong>. Manage attendance, tests, marks, and assignments strictly for your assigned classes.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleTeachingMode(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 hover:border-rose-400/60 text-slate-200 hover:text-white hover:bg-rose-500/15 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md group"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400 group-hover:rotate-180 transition-transform duration-300" />
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
              onFinished={() => setActiveTab('dashboard')}
            />
          );
        case 'timetable':
          return <TimetableManagerPage />;
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
              onBack={() => setActiveTab('dashboard')}
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'sessional_marks':
          return <FacultySessionalMarksPage />;
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
      {isPasswordRecovery && <ResetPasswordModal isOpen={true} />}
    </>
  );
};

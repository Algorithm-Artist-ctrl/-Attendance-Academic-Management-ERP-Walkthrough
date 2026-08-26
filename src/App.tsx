import React, { useState, Suspense, lazy } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';
import vctmOfficialLogo from './assets/vctm-logo.png';

// Lazy Loaded Common Pages
const ProfilePage = lazy(() => import('./pages/common/ProfilePage').then(m => ({ default: m.ProfilePage })));
const NoticesPage = lazy(() => import('./pages/common/NoticesPage').then(m => ({ default: m.NoticesPage })));
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
  const { isAuthenticated, role, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [navigationParams, setNavigationParams] = useState<any>(null);

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
    return <LoginPage />;
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
        case 'notices':
          return <NoticesPage />;
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
      switch (activeTab) {
        case 'profile':
          return <ProfilePage />;
        case 'academic_oversight':
          return <HODAcademicOversightPage />;
        case 'take_attendance':
          return (
            <TakeAttendancePage
              initialTimetableEntryId={navigationParams?.timetableEntryId}
              onFinished={() => setActiveTab('dashboard')}
            />
          );
        case 'timetable':
          return <TimetableManagerPage />;
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
        case 'faculty':
          return <FacultyDirectoryPage />;
        case 'notices':
          return <NoticesPage />;
        case 'reports':
          return <ReportsPage />;
        case 'corrections':
          return <ReviewCorrectionsPage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return <HODDashboard />;
      }
    }

    // 4. Admin Portal Routing
    if (role === 'super_admin') {
      switch (activeTab) {
        case 'profile':
          return <ProfilePage />;
        case 'academic_setup':
          return <AcademicSetupPage />;
        case 'students':
          return <StudentDirectoryPage />;
        case 'faculty':
          return <FacultyDirectoryPage />;
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
        case 'audit_logs':
          return <AuditLogsPage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return <AdminDashboard onNavigate={handleNavigate} />;
      }
    }

    return <StudentDashboard onNavigate={handleNavigate} />;
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={handleNavigate}>
      <Suspense fallback={<PageSkeletonLoader />}>
        {renderContent()}
      </Suspense>
    </AppShell>
  );
};

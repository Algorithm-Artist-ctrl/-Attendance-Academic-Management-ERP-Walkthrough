import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';

// Common Pages
import { ProfilePage } from './pages/common/ProfilePage';
import { NoticesPage } from './pages/common/NoticesPage';
import { SettingsPage } from './pages/common/SettingsPage';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentAttendancePage } from './pages/student/StudentAttendancePage';
import { StudentTimetablePage } from './pages/student/StudentTimetablePage';
import { CorrectionRequestsPage } from './pages/student/CorrectionRequestsPage';
import { FeedbackPage } from './pages/student/FeedbackPage';
import { LeaveApplicationPage } from './pages/student/LeaveApplicationPage';

// Faculty Pages
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { TakeAttendancePage } from './pages/faculty/TakeAttendancePage';
import { FacultyTimetablePage } from './pages/faculty/FacultyTimetablePage';
import { ReviewCorrectionsPage } from './pages/faculty/ReviewCorrectionsPage';
import { AttendanceHistoryPage } from './pages/faculty/AttendanceHistoryPage';

// HOD Pages
import { HODDashboard } from './pages/hod/HODDashboard';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AcademicSetupPage } from './pages/admin/AcademicSetupPage';
import { StudentDirectoryPage } from './pages/admin/StudentDirectoryPage';
import { FacultyDirectoryPage } from './pages/admin/FacultyDirectoryPage';
import { SubjectsPage } from './pages/admin/SubjectsPage';
import { FacultyAssignmentsPage } from './pages/admin/FacultyAssignmentsPage';
import { TimetableManagerPage } from './pages/admin/TimetableManagerPage';
import { CSVImportPage } from './pages/admin/CSVImportPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';

export const AppContent: React.FC = () => {
  const { isAuthenticated, role, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [navigationParams, setNavigationParams] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-emerald-500/30 p-2 animate-bounce shadow-xl flex items-center justify-center">
          <img src="/vctm-icon.svg" alt="VCTM" className="w-full h-full" />
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
        case 'history':
          return (
            <AttendanceHistoryPage
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'students':
          return <StudentDirectoryPage />;
        case 'corrections':
          return <ReviewCorrectionsPage />;
        case 'reports':
          return <ReportsPage />;
        case 'notices':
          return <NoticesPage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return <FacultyDashboard onNavigate={handleNavigate} />;
      }
    }

    // 3. HOD Portal Routing
    if (role === 'hod') {
      switch (activeTab) {
        case 'profile':
          return <ProfilePage />;
        case 'students':
          return <StudentDirectoryPage />;
        case 'faculty':
          return <FacultyDirectoryPage />;
        case 'timetable':
          return <TimetableManagerPage />;
        case 'reports':
          return <ReportsPage />;
        case 'corrections':
          return <ReviewCorrectionsPage />;
        case 'notices':
          return <NoticesPage />;
        case 'settings':
          return <SettingsPage />;
        case 'dashboard':
        default:
          return <HODDashboard />;
      }
    }

    // 4. Super Admin Portal Routing
    switch (activeTab) {
      case 'profile':
        return <ProfilePage />;
      case 'departments':
      case 'academic_setup':
        return <AcademicSetupPage />;
      case 'timetable':
        return <TimetableManagerPage />;
      case 'students':
        return <StudentDirectoryPage />;
      case 'faculty':
        return <FacultyDirectoryPage />;
      case 'subjects':
        return <SubjectsPage />;
      case 'assignments':
        return <FacultyAssignmentsPage />;
      case 'csv_import':
        return <CSVImportPage />;
      case 'reports':
        return <ReportsPage />;
      case 'corrections':
        return <ReviewCorrectionsPage />;
      case 'audit_logs':
        return <AuditLogsPage />;
      case 'notices':
        return <NoticesPage />;
      case 'settings':
        return <SettingsPage />;
      case 'dashboard':
      default:
        return <AdminDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AppShell>
  );
};

export function App() {
  return <AppContent />;
}

export default App;

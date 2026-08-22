import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentAttendancePage } from './pages/student/StudentAttendancePage';
import { StudentTimetablePage } from './pages/student/StudentTimetablePage';
import { CorrectionRequestsPage } from './pages/student/CorrectionRequestsPage';

// Faculty Pages
import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { TakeAttendancePage } from './pages/faculty/TakeAttendancePage';
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
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-white p-2 animate-bounce shadow-xl">
          <img src="/vctm-icon.svg" alt="VCTM" className="w-full h-full" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-amber-400">
          Loading VCTM Attendance ERP...
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
    // 1. Student Portal Views
    if (role === 'student') {
      switch (activeTab) {
        case 'timetable':
          return <StudentTimetablePage />;
        case 'attendance':
        case 'subjects':
          return <StudentAttendancePage />;
        case 'corrections':
          return <CorrectionRequestsPage />;
        case 'dashboard':
        default:
          return <StudentDashboard onNavigate={handleNavigate} />;
      }
    }

    // 2. Faculty Portal Views
    if (role === 'faculty') {
      switch (activeTab) {
        case 'take_attendance':
          return (
            <TakeAttendancePage
              initialTimetableEntryId={navigationParams?.timetableEntryId}
              onFinished={() => setActiveTab('dashboard')}
            />
          );
        case 'timetable':
          return <StudentTimetablePage />;
        case 'corrections':
          return <ReviewCorrectionsPage />;
        case 'history':
          return (
            <AttendanceHistoryPage
              onTakeAttendance={(ttId) => handleNavigate('take_attendance', { timetableEntryId: ttId })}
            />
          );
        case 'dashboard':
        default:
          return <FacultyDashboard onNavigate={handleNavigate} />;
      }
    }

    // 3. HOD Portal Views
    if (role === 'hod') {
      switch (activeTab) {
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
        case 'dashboard':
        default:
          return <HODDashboard />;
      }
    }

    // 4. Super Admin Portal Views
    switch (activeTab) {
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
      case 'take_attendance':
        return <TakeAttendancePage onFinished={() => setActiveTab('dashboard')} />;
      case 'reports':
        return <ReportsPage />;
      case 'corrections':
        return <ReviewCorrectionsPage />;
      case 'audit_logs':
        return <AuditLogsPage />;
      case 'dashboard':
      default:
        return <AdminDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={handleNavigate}>
      {renderContent()}
    </AppShell>
  );
};

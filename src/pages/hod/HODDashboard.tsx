import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Download, 
  Calendar,
  Layers,
  BookOpen,
  History,
  Search,
  Clock,
  XCircle,
  ChevronRight,
  Filter,
  RefreshCw,
  RotateCcw,
  AlertCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { CardSkeleton, TableSkeleton } from '../../components/common/SkeletonLoader';
import { exportToCSV, exportAttendanceReportPDF } from '../../lib/utils/exportUtils';
import { getCollegeToday, getCollegeYesterday, getISTTodayDate, formatDateDisplay } from '../../lib/utils/dateUtils';
import { StudentOverallAttendance } from '../../types/academic.types';
import { StudentAttendanceHistorySummary } from '../../types/database.types';
import { ATTENDANCE_ELIGIBILITY_THRESHOLD } from '../../config/academicConfig';
import { supabaseService } from '../../lib/services/supabaseService';
import { clsx } from 'clsx';

interface HODDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export const HODDashboard: React.FC<HODDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    departments, 
    faculty, 
    sections, 
    students, 
    subjects, 
    assignments, 
    sessions,
    years,
    semesters,
    corrections,
    attendanceRecords,
    getStudentAttendance,
    refreshData,
    isLoading
  } = useAcademic();

  const dept = departments.find(
    d => d.id === user?.faculty?.department_id || 
         d.id === user?.department_id ||
         d.hod_faculty_id === user?.faculty_id || 
         d.hod_faculty_id === user?.faculty?.id
  ) || departments[0];

  const hodFaculty = faculty.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === dept?.hod_faculty_id
  ) || user?.faculty;

  const collegeToday = getCollegeToday();
  const collegeYesterday = getCollegeYesterday();

  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');

  // ---------------------------------------------------------------------------
  // Dedicated Student Attendance History & Drill-Down State
  // ---------------------------------------------------------------------------
  type QuickDateFilter = 'today' | 'yesterday' | 'custom' | 'all';
  const [quickDateFilter, setQuickDateFilter] = useState<QuickDateFilter>('today');
  const [drillDownYearId, setDrillDownYearId] = useState<string>('');
  const [drillDownSectionId, setDrillDownSectionId] = useState<string>('');
  const [drillDownStudentId, setDrillDownStudentId] = useState<string>('');
  const [drillDownStudentSearch, setDrillDownStudentSearch] = useState<string>('');
  const [drillDownStartDate, setDrillDownStartDate] = useState<string>(collegeToday);
  const [drillDownEndDate, setDrillDownEndDate] = useState<string>(collegeToday);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [studentHistoryData, setStudentHistoryData] = useState<StudentAttendanceHistorySummary | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [pendingLeavesCount, setPendingLeavesCount] = useState<number>(0);

  // Fetch pending leaves count for HOD
  useEffect(() => {
    supabaseService.fetchHODLeaveApplications(dept?.id)
      .then(apps => {
        setPendingLeavesCount(apps.filter(a => a.status === 'PENDING_HOD').length);
      })
      .catch(() => {});
  }, [dept?.id]);

  // Supported academic years (2nd, 3rd, 4th strictly — NO 1st Year)
  const supportedYears = useMemo(() => {
    return years.filter(y => y.active && y.year_number !== 1);
  }, [years]);

  // Dynamic sections for drill-down based on drillDownYearId
  const drillDownSections = useMemo(() => {
    if (!drillDownYearId) return [];
    const matchingSemIds = semesters.filter(s => s.academic_year_id === drillDownYearId).map(s => s.id);
    return sections.filter(s => s.active && matchingSemIds.includes(s.semester_id));
  }, [sections, semesters, drillDownYearId]);

  // Dynamic students for drill-down based on drillDownSectionId
  const drillDownStudents = useMemo(() => {
    if (!drillDownSectionId) return [];
    return students.filter(s => s.active && s.section_id === drillDownSectionId && (!dept?.id || s.department_id === dept.id));
  }, [students, drillDownSectionId, dept?.id]);

  // Filter drillDownStudents by drillDownStudentSearch (name or roll number)
  const filteredDrillDownStudents = useMemo(() => {
    if (!drillDownStudents) return [];
    if (!drillDownStudentSearch.trim()) return drillDownStudents;
    const q = drillDownStudentSearch.trim().toLowerCase();
    return drillDownStudents.filter(s => 
      (s.full_name || '').toLowerCase().includes(q) || 
      (s.roll_number || '').toLowerCase().includes(q)
    );
  }, [drillDownStudents, drillDownStudentSearch]);

  // Quick date filter switcher
  const handleSetQuickDateFilter = (mode: QuickDateFilter) => {
    setQuickDateFilter(mode);
    setDateValidationError(null);
    if (mode === 'today') {
      setDrillDownStartDate(collegeToday);
      setDrillDownEndDate(collegeToday);
    } else if (mode === 'yesterday') {
      setDrillDownStartDate(collegeYesterday);
      setDrillDownEndDate(collegeYesterday);
    } else if (mode === 'all') {
      setDrillDownStartDate('');
      setDrillDownEndDate(collegeToday);
    } else if (mode === 'custom') {
      if (drillDownStartDate > collegeToday) setDrillDownStartDate(collegeToday);
      if (drillDownEndDate > collegeToday || !drillDownEndDate) setDrillDownEndDate(collegeToday);
    }
  };

  const handleCustomStartDateChange = (val: string) => {
    if (val > collegeToday) {
      setDateValidationError('Attendance can only be viewed up to today.');
      setDrillDownStartDate(collegeToday);
      return;
    }
    setDateValidationError(null);
    setDrillDownStartDate(val);
    if (drillDownEndDate && val > drillDownEndDate) {
      setDrillDownEndDate(val);
    }
  };

  const handleCustomEndDateChange = (val: string) => {
    if (val > collegeToday) {
      setDateValidationError('Attendance can only be viewed up to today.');
      setDrillDownEndDate(collegeToday);
      return;
    }
    if (drillDownStartDate && val < drillDownStartDate) {
      setDateValidationError('End Date cannot be before Start Date.');
      return;
    }
    setDateValidationError(null);
    setDrillDownEndDate(val);
  };

  // Reactive fetch for selected student's attendance history
  useEffect(() => {
    if (!drillDownStudentId) {
      setStudentHistoryData(null);
      return;
    }

    if (dateValidationError) {
      return;
    }

    if (drillDownStartDate && drillDownStartDate > collegeToday) return;
    if (drillDownEndDate && drillDownEndDate > collegeToday) return;
    if (drillDownStartDate && drillDownEndDate && drillDownStartDate > drillDownEndDate) return;

    let isSubscribed = true;
    setIsLoadingHistory(true);
    supabaseService.fetchStudentAttendanceHistory({
      studentId: drillDownStudentId,
      startDate: drillDownStartDate || undefined,
      endDate: drillDownEndDate || undefined,
    }).then(res => {
      if (isSubscribed) {
        setStudentHistoryData(res);
        setIsLoadingHistory(false);
      }
    }).catch(err => {
      console.error('Failed to fetch student attendance history:', err);
      if (isSubscribed) setIsLoadingHistory(false);
    });
    return () => { isSubscribed = false; };
  }, [drillDownStudentId, drillDownStartDate, drillDownEndDate, dateValidationError, collegeToday, corrections, attendanceRecords]);

  // Jump from roster row directly into drill-down
  const handleSelectStudentForHistory = (sId: string) => {
    const stud = students.find(s => s.id === sId);
    if (stud) {
      const sem = semesters.find(sm => sm.id === stud.semester_id);
      const yrId = stud.academic_year_id || sem?.academic_year_id || '';
      if (yrId) setDrillDownYearId(yrId);
      if (stud.section_id) setDrillDownSectionId(stud.section_id);
      setDrillDownStudentId(stud.id);
      setDrillDownStudentSearch('');
      setQuickDateFilter('today');
      setDrillDownStartDate(collegeToday);
      setDrillDownEndDate(collegeToday);
      setDateValidationError(null);
      setTimeout(() => {
        const elem = document.getElementById('student-attendance-history-section');
        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Export Student Lecture-by-Lecture Attendance History to CSV (strictly up to today)
  const handleExportStudentHistoryCSV = () => {
    if (!studentHistoryData || studentHistoryData.records.length === 0) return;
    const exportRows = studentHistoryData.records
      .filter(r => r.sessionDate <= collegeToday)
      .map(r => ({
        'Student Name': studentHistoryData.fullName,
        'Roll Number': studentHistoryData.rollNumber,
        'Academic Year': studentHistoryData.yearName,
        'Section': studentHistoryData.sectionName,
        'Date': r.sessionDate,
        'Lecture Time': r.startTime ? `${r.startTime} – ${r.endTime || ''}` : 'Official Slot',
        'Subject': r.subjectName,
        'Subject Code': r.subjectCode,
        'Faculty': r.facultyName,
        'Status': r.status,
        'Remarks': r.claimStatus 
          ? `Claim ${r.claimStatus.toUpperCase()}: ${r.claimReason || ''} (${r.claimRemarks || ''})` 
          : (r.remarks || '—'),
      }));
    exportToCSV(exportRows, `Attendance_History_${studentHistoryData.rollNumber}_${collegeToday}`);
  };

  // Export Entire Section Overall Attendance Report to CSV
  const handleExportSectionReportCSV = () => {
    const sec = sections.find(s => s.id === drillDownSectionId);
    const secStats = studentStats.filter(s => s.sectionName === sec?.name);
    if (secStats.length === 0) return;
    const exportRows = secStats.map(s => ({
      'Roll Number': s.rollNumber,
      'Student Name': s.fullName,
      'Section': s.sectionName,
      'Total Conducted': s.totalLectures,
      'Attended (Present)': s.presentLectures,
      'Absent Count': s.totalLectures - s.presentLectures,
      'Attendance Percentage': s.percentage !== null ? `${s.percentage}%` : 'No Data',
      'Eligibility Status': s.totalLectures === 0 || s.percentage === null ? 'No Data' : s.isDefaulter ? 'Defaulter (<75%)' : 'Eligible',
    }));
    exportToCSV(exportRows, `Section_Report_${sec?.name || 'Section'}_${collegeToday}`);
  };

  // Dynamic sections based on selectedYearFilter
  const dynamicSections = useMemo(() => {
    if (selectedYearFilter === 'ALL') {
      const supportedYearIds = new Set(supportedYears.map(y => y.id));
      const matchingSemIds = new Set(
        semesters.filter(s => supportedYearIds.has(s.academic_year_id)).map(s => s.id)
      );
      return sections.filter(s => s.active && matchingSemIds.has(s.semester_id));
    }
    const matchingSemIds = semesters.filter(s => s.academic_year_id === selectedYearFilter).map(s => s.id);
    return sections.filter(s => s.active && matchingSemIds.includes(s.semester_id));
  }, [sections, semesters, selectedYearFilter, supportedYears]);

  // Unique section names available for the filter pills
  const availableSectionNames = useMemo(() => {
    const names = Array.from(new Set(dynamicSections.map(s => s.name)));
    return ['ALL', ...names.sort()];
  }, [dynamicSections]);

  // Compute stats for department students, scoped by selectedYearFilter (strictly excluding 1st Year)
  const studentStats: StudentOverallAttendance[] = useMemo(() => {
    return students
      .filter(s => {
        if (s.department_id !== dept?.id || !s.active) return false;
        const sem = semesters.find(sm => sm.id === s.semester_id);
        const yr = years.find(y => y.id === s.academic_year_id || y.id === sem?.academic_year_id);
        if (yr && yr.year_number === 1) return false;

        if (selectedYearFilter !== 'ALL' && s.academic_year_id !== selectedYearFilter && sem?.academic_year_id !== selectedYearFilter) {
          return false;
        }
        return true;
      })
      .map(s => getStudentAttendance(s.id));
  }, [students, dept?.id, selectedYearFilter, getStudentAttendance, semesters, years]);

  const filteredStats = useMemo(() => {
    return studentStats.filter(s => {
      const stud = students.find(st => st.id === s.studentId);
      if (!stud) return false;

      // Section filtering: exact DB relationship
      if (selectedSectionFilter !== 'ALL') {
        const matchingSection = dynamicSections.find(sec => sec.id === selectedSectionFilter || sec.name === selectedSectionFilter);
        if (matchingSection) {
          if (stud.section_id !== matchingSection.id) return false;
        } else if (s.sectionName !== selectedSectionFilter) {
          return false;
        }
      }

      // Search student by name or roll number (case-insensitive, full/partial)
      if (studentSearchTerm.trim()) {
        const query = studentSearchTerm.trim().toLowerCase();
        const matchesName = (stud.full_name || '').toLowerCase().includes(query);
        const matchesRoll = (stud.roll_number || '').toLowerCase().includes(query);
        if (!matchesName && !matchesRoll) return false;
      }

      return true;
    });
  }, [studentStats, students, selectedSectionFilter, studentSearchTerm, dynamicSections]);

  const handleClearLedgerFilters = () => {
    setStudentSearchTerm('');
    setSelectedYearFilter('ALL');
    setSelectedSectionFilter('ALL');
  };

  const handleExportFilteredLedgerCSV = () => {
    if (filteredStats.length === 0) return;
    const exportRows = filteredStats.map(s => ({
      'Roll Number': s.rollNumber,
      'Student Name': s.fullName,
      'Section': `Section ${s.sectionName}`,
      'Total Held': s.totalLectures,
      'Attended (Present)': s.presentLectures,
      'Absent Count': s.totalLectures - s.presentLectures,
      'Attendance Percentage': s.percentage !== null ? `${s.percentage}%` : 'No Data',
      'Status': s.totalLectures === 0 || s.percentage === null ? 'No Data' : s.isDefaulter ? 'Defaulter (<75%)' : 'Eligible',
    }));
    exportToCSV(exportRows, `VCTM_${dept?.code || 'CSE'}_Attendance_Ledger_${collegeToday}`);
  };

  const defaulters = useMemo(() => {
    return studentStats.filter(s => s.totalLectures > 0 && s.percentage !== null && (s.isDefaulter || s.percentage < ATTENDANCE_ELIGIBILITY_THRESHOLD));
  }, [studentStats]);

  // Strictly department-scoped active faculty
  const deptFaculty = useMemo(() => {
    return faculty.filter(f => f.department_id === dept?.id && f.active);
  }, [faculty, dept?.id]);

  // Compute workload assignment percentage based on real database records
  const assignedDeptFacultyCount = useMemo(() => {
    const assignedIds = new Set(assignments.filter(a => a.active).map(a => a.faculty_id));
    return deptFaculty.filter(f => assignedIds.has(f.id)).length;
  }, [deptFaculty, assignments]);

  const workloadPercentage = useMemo(() => {
    if (deptFaculty.length === 0) return 0;
    return Math.round((assignedDeptFacultyCount / deptFaculty.length) * 100);
  }, [deptFaculty.length, assignedDeptFacultyCount]);

  const activeSessionName = useMemo(() => {
    const curr = sessions.find(s => s.is_current);
    return curr?.name ? `Academic Session ${curr.name}` : 'Academic Session';
  }, [sessions]);

  const handleExportDefaultersCSV = () => {
    const data = defaulters.map(d => ({
      'Roll Number': d.rollNumber,
      'Student Name': d.fullName,
      'Section': d.sectionName,
      'Total Held': d.totalLectures,
      'Attended': d.presentLectures,
      'Attendance %': `${d.percentage ?? 0}%`,
      Status: 'Defaulter (<75%)',
    }));
    exportToCSV(data, `VCTM_${dept?.code || 'CSE'}_Defaulters_Report_${getISTTodayDate()}`);
  };

  const handleExportDefaultersPDF = () => {
    const headers = ['Roll Number', 'Student Name', 'Section', 'Total Held', 'Attended', 'Attendance %', 'Status'];
    const rows = defaulters.map(d => [
      d.rollNumber,
      d.fullName,
      d.sectionName,
      d.totalLectures,
      d.presentLectures,
      `${d.percentage ?? 0}%`,
      'Defaulter (<75%)'
    ]);
    exportAttendanceReportPDF({
      title: `DEPARTMENT OF ${dept?.code || 'ACADEMIC'} — ATTENDANCE DEFAULTER REPORT (<75%)`,
      subtitle: 'Official Academic Audit Report — VCTM Aligarh',
      department: dept?.name || 'Academic Department',
      section: selectedSectionFilter === 'ALL' ? 'All Sections' : `Section ${selectedSectionFilter}`,
      academicYear: activeSessionName,
      tableHeaders: headers,
      tableRows: rows,
      filename: `VCTM_${dept?.code || 'Dept'}_Defaulters_${getISTTodayDate()}`,
    });
  };

  const avgAttendance = useMemo(() => {
    const studentsWithAttendance = studentStats.filter(s => s.totalLectures > 0 && s.percentage !== null);
    if (studentsWithAttendance.length === 0) return null;
    return Math.round(
      studentsWithAttendance.reduce((acc, s) => acc + (s.percentage || 0), 0) /
      studentsWithAttendance.length
    );
  }, [studentStats]);

  const hasAnyAttendance = useMemo(() => {
    return studentStats.some(s => s.totalLectures > 0);
  }, [studentStats]);

  return (
    <div className="space-y-6">
      {/* Department Header */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-emerald-500/40 text-[#00ff88] font-black flex items-center justify-center shadow-[0_0_15px_rgba(0,255,136,0.2)] shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{dept.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                HOD Portal
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-medium">
              Head of Department: <strong className="text-white">{hodFaculty?.full_name || user?.full_name || 'Department Head'}</strong> • {dept?.name || 'Academic Department'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Academic Year Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs shadow-[0_0_10px_rgba(0,255,136,0.1)]">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Year:</span>
            <select
              value={selectedYearFilter}
              onChange={(e) => {
                setSelectedYearFilter(e.target.value);
                setSelectedSectionFilter('ALL');
              }}
              className="bg-transparent text-xs font-black text-[#00ff88] focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All Years</option>
              {years.filter(y => y.active && y.year_number !== 1).map(y => (
                <option key={y.id} value={y.id} className="bg-slate-950 text-white">{y.name}</option>
              ))}
            </select>
          </div>

          <Button
            variant="neon"
            size="sm"
            leftIcon={<Calendar className="w-4 h-4 text-slate-950" />}
            onClick={() => {
              if (onNavigate) {
                onNavigate('timetable', { yearId: selectedYearFilter !== 'ALL' ? selectedYearFilter : undefined });
              } else {
                window.location.hash = '#timetable';
              }
            }}
            className="shadow-[0_0_15px_rgba(0,255,136,0.3)] font-black"
          >
            Manage Timetable
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
            onClick={handleExportDefaultersCSV}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-[#00ff88]" />}
            onClick={handleExportDefaultersPDF}
          >
            PDF Audit
          </Button>
        </div>
      </div>

      {/* Pending Leave Applications Alert Banner */}
      {pendingLeavesCount > 0 && (
        <div className="glass-panel p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in zoom-in-95 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                Pending Leave Applications
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono">
                  {pendingLeavesCount} Awaiting Review
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Student leave requests forwarded by Class Coordinators awaiting your final sanction.
              </p>
            </div>
          </div>
          <Button
            variant="neon"
            size="sm"
            onClick={() => onNavigate?.('leave')}
            leftIcon={<FileText className="w-3.5 h-3.5 text-slate-950" />}
          >
            Review Leaves
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      {isLoading && studentStats.length === 0 ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400">Total {dept?.code || 'CSE'} Students</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
                {studentStats.length}
              </h3>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {selectedYearFilter === 'ALL' ? 'Across All Years' : years.find(y => y.id === selectedYearFilter)?.name}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400">Department Faculty</p>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
                {deptFaculty.length}
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">{workloadPercentage}% Workload Assigned</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400">Defaulters (&lt;75%)</p>
              <h3 className={`text-2xl sm:text-3xl font-black mt-1 ${!hasAnyAttendance ? 'text-slate-300' : defaulters.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {!hasAnyAttendance ? 'N/A' : defaulters.length}
              </h3>
              <span className={`text-[10px] font-bold ${!hasAnyAttendance ? 'text-slate-400 font-normal' : defaulters.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {!hasAnyAttendance ? 'No attendance data yet' : defaulters.length > 0 ? 'Action Recommended' : 'All Students Eligible'}
              </span>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!hasAnyAttendance ? 'bg-slate-800/80 border border-slate-700 text-slate-400' : defaulters.length > 0 ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400">Avg Attendance</p>
              {avgAttendance === null ? (
                <h3 className="text-xl sm:text-2xl font-black text-slate-300 mt-1">N/A</h3>
              ) : (
                <h3 className="text-2xl sm:text-3xl font-black text-[#00ff88] mt-1">
                  {avgAttendance}%
                </h3>
              )}
              <span className="text-[10px] text-emerald-400 font-semibold">
                {avgAttendance === null ? 'No attendance recorded yet' : 'Across All Subjects'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Department Attendance Roster Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-emerald-500/15 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#00ff88]" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Department Attendance Ledger & Defaulter Tracking
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
              onClick={handleExportFilteredLedgerCSV}
              disabled={filteredStats.length === 0}
              className="text-xs"
            >
              Export Filtered CSV
            </Button>
          </div>
        </div>

        {/* PROMINENT SEARCH & FILTER BAR DIRECTLY ABOVE TABLE */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-emerald-500/15 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Student Input */}
            <div className="sm:col-span-6 relative">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Search Student (Name or Roll Number)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  placeholder="Search by student name or roll number..."
                  className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl pl-10 pr-10 py-2.5 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] min-h-[44px]"
                />
                {studentSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setStudentSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                    title="Clear search"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Academic Year Filter (Strictly 2nd, 3rd, 4th Year - NO 1st Year) */}
            <div className="sm:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Academic Year (Strictly No 1st Year)
              </label>
              <select
                value={selectedYearFilter}
                onChange={(e) => {
                  setSelectedYearFilter(e.target.value);
                  setSelectedSectionFilter('ALL');
                }}
                className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2.5 text-xs font-bold text-[#00ff88] focus:outline-none focus:border-[#00ff88] cursor-pointer min-h-[44px]"
              >
                <option value="ALL">All Years (2nd, 3rd, 4th)</option>
                {supportedYears.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>

            {/* Section Filter (From actual academic structure) */}
            <div className="sm:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Section ({dynamicSections.length})
              </label>
              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00ff88] cursor-pointer min-h-[44px]"
              >
                <option value="ALL">All Sections</option>
                {dynamicSections.map(sec => {
                  const sem = semesters.find(sm => sm.id === sec.semester_id);
                  const secYear = years.find(y => y.id === sem?.academic_year_id);
                  return (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name} {selectedYearFilter === 'ALL' && secYear?.name ? `(${secYear.name})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Active Filter Badges & Reset Button */}
          {(studentSearchTerm || selectedYearFilter !== 'ALL' || selectedSectionFilter !== 'ALL') && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-500/10">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                <span className="text-[11px] font-semibold text-slate-400">Filters:</span>
                {studentSearchTerm && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] text-[11px] font-bold flex items-center gap-1">
                    "{studentSearchTerm}"
                    <button onClick={() => setStudentSearchTerm('')} className="hover:text-white ml-0.5">×</button>
                  </span>
                )}
                {selectedYearFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] text-[11px] font-bold flex items-center gap-1">
                    {years.find(y => y.id === selectedYearFilter)?.name}
                    <button onClick={() => setSelectedYearFilter('ALL')} className="hover:text-white ml-0.5">×</button>
                  </span>
                )}
                {selectedSectionFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] text-[11px] font-bold flex items-center gap-1">
                    Section {dynamicSections.find(s => s.id === selectedSectionFilter)?.name || selectedSectionFilter}
                    <button onClick={() => setSelectedSectionFilter('ALL')} className="hover:text-white ml-0.5">×</button>
                  </span>
                )}
                <span className="text-[11px] text-slate-500 ml-1">({filteredStats.length} matching)</span>
              </div>
              <button
                type="button"
                onClick={handleClearLedgerFilters}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                Clear Filters
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
              <tr>
                <th className="px-5 py-3.5">Roll Number</th>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5 text-center">Section</th>
                <th className="px-5 py-3.5 text-center">Total Held</th>
                <th className="px-5 py-3.5 text-center">Attended</th>
                <th className="px-5 py-3.5 text-center">Percentage</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {isLoading && filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6">
                    <TableSkeleton rows={5} columns={8} />
                  </td>
                </tr>
              ) : filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-2">
                      <Search className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-300">No students found matching current filters</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Try refining or clearing your search term, year, or section.</p>
                    <button
                      onClick={handleClearLedgerFilters}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88] text-xs font-bold hover:bg-emerald-500/20 transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredStats.map((s) => {
                  const hasData = s.totalLectures > 0 && s.percentage !== null;
                  const isDefaulter = hasData && s.percentage !== null && s.percentage < 75;
                  return (
                    <tr key={s.studentId} className="hover:bg-emerald-500/5 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-emerald-400">
                        {s.rollNumber}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-white">
                        {s.fullName}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-slate-300">
                        Section {s.sectionName}
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-300">
                        {s.totalLectures}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-emerald-400">
                        {s.presentLectures}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="font-mono font-black text-sm text-[#00ff88]">
                          {hasData ? `${s.percentage}%` : 'No data'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={clsx(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold border',
                          !hasData
                            ? 'bg-slate-800 border-slate-700 text-slate-400'
                            : isDefaulter
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                        )}>
                          {!hasData ? 'No attendance recorded' : isDefaulter ? 'Defaulter (<75%)' : 'Eligible'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleSelectStudentForHistory(s.studentId)}
                          className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[#00ff88] text-[11px] font-bold transition-all inline-flex items-center gap-1 shadow-sm cursor-pointer"
                          title="Open complete attendance history drill-down"
                        >
                          <span>View History</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* DEDICATED STUDENT ATTENDANCE HISTORY & VERIFICATION DRILL-DOWN SECTION */}
      {/* ====================================================================== */}
      <div id="student-attendance-history-section" className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden space-y-5 p-6 shadow-2xl">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/15 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-emerald-500/30 text-[#00ff88] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,136,0.15)] shrink-0">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Student Attendance History & Audit Drill-Down
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                  Authoritative DB Records
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Lecture-by-lecture audit with real status tracking, discrepancy claims, and formula percentage.
              </p>
            </div>
          </div>

          {/* Quick Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="neon"
              size="sm"
              disabled={!studentHistoryData || studentHistoryData.records.length === 0}
              onClick={handleExportStudentHistoryCSV}
              leftIcon={<Download className="w-4 h-4 text-slate-950" />}
              className="font-bold text-xs shadow-[0_0_12px_rgba(0,255,136,0.2)]"
            >
              Export Student History (CSV)
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!drillDownSectionId}
              onClick={handleExportSectionReportCSV}
              leftIcon={<FileSpreadsheet className="w-4 h-4 text-[#00ff88]" />}
              className="font-bold text-xs"
            >
              Export Section Report (CSV)
            </Button>
          </div>
        </div>

        {/* Interactive Filter Bar */}
        <div className="bg-slate-950/80 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Year Selector */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                1. Academic Year (Strictly No 1st Year)
              </label>
              <select
                value={drillDownYearId}
                onChange={(e) => {
                  setDrillDownYearId(e.target.value);
                  setDrillDownSectionId('');
                  setDrillDownStudentId('');
                  setDrillDownStudentSearch('');
                  setStudentHistoryData(null);
                }}
                className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2.5 text-xs font-bold text-[#00ff88] focus:outline-none focus:border-[#00ff88] cursor-pointer min-h-[44px]"
              >
                <option value="">Select Academic Year...</option>
                {supportedYears.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>

            {/* Section Selector */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                2. Section ({drillDownSections.length})
              </label>
              <select
                value={drillDownSectionId}
                disabled={!drillDownYearId}
                onChange={(e) => {
                  setDrillDownSectionId(e.target.value);
                  setDrillDownStudentId('');
                  setDrillDownStudentSearch('');
                  setStudentHistoryData(null);
                }}
                className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00ff88] cursor-pointer disabled:opacity-40 min-h-[44px]"
              >
                <option value="">Select Section...</option>
                {drillDownSections.map(s => (
                  <option key={s.id} value={s.id}>Section {s.name}</option>
                ))}
              </select>
            </div>

            {/* Student Selector with Quick Search */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                3. Student ({drillDownStudents.length})
              </label>
              <select
                value={drillDownStudentId}
                disabled={!drillDownSectionId}
                onChange={(e) => {
                  setDrillDownStudentId(e.target.value);
                  setStudentHistoryData(null);
                }}
                className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2.5 text-xs font-bold text-[#00ff88] focus:outline-none focus:border-[#00ff88] cursor-pointer disabled:opacity-40 min-h-[44px]"
              >
                <option value="">Select Student...</option>
                {filteredDrillDownStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.roll_number} — {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Student Quick Search Input within Selected Section */}
          {drillDownSectionId && drillDownStudents.length > 5 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={drillDownStudentSearch}
                onChange={(e) => setDrillDownStudentSearch(e.target.value)}
                placeholder="Filter student list by name or roll number..."
                className="w-full bg-slate-900/90 border border-emerald-500/20 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
              />
              {drillDownStudentSearch && (
                <button
                  type="button"
                  onClick={() => setDrillDownStudentSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Quick Date Filters & Future-Date Guard Controls: Today, Yesterday, Custom Range, All History */}
          <div className="pt-2 border-t border-emerald-500/15 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Date Filter:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-emerald-500/20">
                <button
                  type="button"
                  onClick={() => handleSetQuickDateFilter('today')}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px]",
                    quickDateFilter === 'today'
                      ? "bg-[#00ff88] text-slate-950 shadow-[0_0_10px_rgba(0,255,136,0.3)]"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Today • {formatDateDisplay(collegeToday)}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDateFilter('yesterday')}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px]",
                    quickDateFilter === 'yesterday'
                      ? "bg-[#00ff88] text-slate-950 shadow-[0_0_10px_rgba(0,255,136,0.3)]"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Yesterday • {formatDateDisplay(collegeYesterday)}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDateFilter('custom')}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px]",
                    quickDateFilter === 'custom'
                      ? "bg-[#00ff88] text-slate-950 shadow-[0_0_10px_rgba(0,255,136,0.3)]"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Custom Range
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDateFilter('all')}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px]",
                    quickDateFilter === 'all'
                      ? "bg-[#00ff88] text-slate-950 shadow-[0_0_10px_rgba(0,255,136,0.3)]"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  All History
                </button>
              </div>
            </div>

            {/* Custom Date Range Selectors (Strict max: Today) */}
            {quickDateFilter === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Start Date (Max: Today)
                  </label>
                  <input
                    type="date"
                    max={collegeToday}
                    value={drillDownStartDate}
                    onChange={(e) => handleCustomStartDateChange(e.target.value)}
                    className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-[#00ff88] cursor-pointer min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    End Date (Max: Today)
                  </label>
                  <input
                    type="date"
                    max={collegeToday}
                    min={drillDownStartDate || undefined}
                    value={drillDownEndDate}
                    onChange={(e) => handleCustomEndDateChange(e.target.value)}
                    className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-[#00ff88] cursor-pointer min-h-[44px]"
                  />
                </div>
              </div>
            )}

            {dateValidationError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{dateValidationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Performance Metric Cards */}
        {studentHistoryData && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Total Scheduled */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/15 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Total Lectures</span>
                <span className="text-xl sm:text-2xl font-black text-white mt-0.5 block font-mono">
                  {studentHistoryData.totalLectures}
                </span>
                <span className="text-[10px] text-slate-400">All Scheduled</span>
              </div>

              {/* Present Count */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/20 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 block">Attended (Present)</span>
                <span className="text-xl sm:text-2xl font-black text-[#00ff88] mt-0.5 block font-mono">
                  {studentHistoryData.presentCount}
                </span>
                <span className="text-[10px] text-emerald-400/80 font-bold">Present in Class</span>
              </div>

              {/* Absent Count */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-rose-500/20 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-rose-400 block">Absent Count</span>
                <span className="text-xl sm:text-2xl font-black text-rose-400 mt-0.5 block font-mono">
                  {studentHistoryData.absentCount}
                </span>
                <span className="text-[10px] text-rose-400/80 font-bold">Unattended</span>
              </div>

              {/* Excluded Slots */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Excluded Slots</span>
                <span className="text-xl sm:text-2xl font-black text-slate-400 mt-0.5 block font-mono">
                  {studentHistoryData.notMarkedCount + studentHistoryData.cancelledCount}
                </span>
                <span className="text-[10px] text-slate-500">Not Marked / Cancelled</span>
              </div>

              {/* Real Percentage */}
              <div className={clsx(
                'col-span-2 sm:col-span-1 p-3.5 rounded-2xl border text-center shadow-lg',
                studentHistoryData.attendancePercentage === null
                  ? 'bg-slate-950/60 border-slate-800'
                  : studentHistoryData.attendancePercentage < 75
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : 'bg-emerald-950/20 border-emerald-500/40'
              )}>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300 block">
                  Official Percentage
                </span>
                <span className={clsx(
                  'text-2xl font-black mt-0.5 block font-mono tracking-tight',
                  studentHistoryData.attendancePercentage === null
                    ? 'text-slate-400'
                    : studentHistoryData.attendancePercentage < 75
                      ? 'text-rose-400'
                      : 'text-[#00ff88]'
                )}>
                  {studentHistoryData.attendancePercentage !== null ? `${studentHistoryData.attendancePercentage}%` : '—'}
                </span>
                <span className="text-[9px] text-slate-400 block" title="Formula: Present / (Present + Absent) * 100">
                  Present ÷ (Present + Absent) × 100
                </span>
              </div>
            </div>

            <div className="px-4 py-2 rounded-xl bg-slate-950/40 border border-emerald-500/10 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <div>
                Auditing: <strong className="text-white">{studentHistoryData.fullName}</strong> (<span className="text-[#00ff88] font-mono">{studentHistoryData.rollNumber}</span>) • {studentHistoryData.yearName} • Section {studentHistoryData.sectionName}
              </div>
              <div className="text-[10px] text-slate-400">
                Formula complies with University eligibility norms. Unconducted slots are strictly excluded from the denominator.
              </div>
            </div>
          </div>
        )}

        {/* History Records Table / States */}
        {isLoadingHistory ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#00ff88] animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold">Querying complete attendance history from Supabase...</p>
          </div>
        ) : !drillDownStudentId ? (
          <div className="p-10 rounded-2xl bg-slate-950/40 border border-emerald-500/10 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[#00ff88] flex items-center justify-center mx-auto">
              <History className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">Select a Student to View History</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Choose an Academic Year, Section, and Student above, or click "View History" on any student in the roster table above.
            </p>
          </div>
        ) : studentHistoryData && studentHistoryData.records.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-950/40 border border-emerald-500/10 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">
              {quickDateFilter === 'today' ? 'No attendance data for today' : 'No Lecture Records Found'}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {quickDateFilter === 'today'
                ? 'No attendance sessions have been conducted or saved for this student today.'
                : 'There are no attendance sessions recorded for this student in the chosen date range.'}
            </p>
          </div>
        ) : studentHistoryData ? (
          <div className="overflow-x-auto rounded-2xl border border-emerald-500/15">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/90 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-4 py-3">Session Date</th>
                  <th className="px-4 py-3">Time Slot</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Assigned Faculty</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Claim Discrepancy & Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10 bg-slate-950/40">
                {studentHistoryData.records.map((r) => (
                  <tr key={r.recordId} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-white">
                      {r.sessionDate}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-300">
                      {r.startTime ? `${r.startTime} – ${r.endTime || ''}` : 'Official Slot'}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white">{r.subjectName}</div>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">{r.subjectCode}</span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-300 font-medium">
                      {r.facultyName}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className={clsx(
                        'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border',
                        r.status === 'Present'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                          : r.status === 'Absent'
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                            : r.status === 'Cancelled'
                              ? 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                              : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      )}>
                        ● {r.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {r.claimStatus ? (
                        <div className="space-y-0.5">
                          <span className={clsx(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border',
                            r.claimStatus === 'approved'
                              ? 'bg-emerald-500/20 text-[#00ff88] border-emerald-500/30'
                              : r.claimStatus === 'rejected'
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          )}>
                            Claim {r.claimStatus.toUpperCase()}
                          </span>
                          {r.claimReason && (
                            <p className="text-[10px] text-slate-300 italic truncate max-w-xs" title={r.claimReason}>
                              "{r.claimReason}"
                            </p>
                          )}
                          {r.claimRemarks && (
                            <p className="text-[9px] text-slate-400 font-sans" title={r.claimRemarks}>
                              Review: {r.claimRemarks}
                            </p>
                          )}
                        </div>
                      ) : r.remarks ? (
                        <span className="text-[10px] text-slate-400 italic">{r.remarks}</span>
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>


    </div>
  );
};


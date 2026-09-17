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
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { exportToCSV, exportAttendanceReportPDF } from '../../lib/utils/exportUtils';
import { getISTTodayDate, formatDateDisplay } from '../../lib/utils/dateUtils';
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
    refreshData 
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

  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');

  // ---------------------------------------------------------------------------
  // Dedicated Student Attendance History & Drill-Down State
  // ---------------------------------------------------------------------------
  const [drillDownYearId, setDrillDownYearId] = useState<string>('');
  const [drillDownSectionId, setDrillDownSectionId] = useState<string>('');
  const [drillDownStudentId, setDrillDownStudentId] = useState<string>('');
  const [drillDownStartDate, setDrillDownStartDate] = useState<string>('');
  const [drillDownEndDate, setDrillDownEndDate] = useState<string>('');
  const [studentHistoryData, setStudentHistoryData] = useState<StudentAttendanceHistorySummary | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

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

  // Reactive fetch for selected student's attendance history
  useEffect(() => {
    if (!drillDownStudentId) {
      setStudentHistoryData(null);
      return;
    }
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
  }, [drillDownStudentId, drillDownStartDate, drillDownEndDate, corrections, attendanceRecords]);

  // Jump from roster row directly into drill-down
  const handleSelectStudentForHistory = (sId: string) => {
    const stud = students.find(s => s.id === sId);
    if (stud) {
      if (stud.academic_year_id) setDrillDownYearId(stud.academic_year_id);
      if (stud.section_id) setDrillDownSectionId(stud.section_id);
      setDrillDownStudentId(stud.id);
      setTimeout(() => {
        const elem = document.getElementById('student-attendance-history-section');
        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Export Student Lecture-by-Lecture Attendance History to CSV
  const handleExportStudentHistoryCSV = () => {
    if (!studentHistoryData || studentHistoryData.records.length === 0) return;
    const exportRows = studentHistoryData.records.map(r => ({
      'Roll Number': studentHistoryData.rollNumber,
      'Student Name': studentHistoryData.fullName,
      'Academic Year': studentHistoryData.yearName,
      'Section': studentHistoryData.sectionName,
      'Session Date': r.sessionDate,
      'Time Slot': r.startTime ? `${r.startTime} - ${r.endTime || ''}` : 'Scheduled Slot',
      'Subject Code': r.subjectCode,
      'Subject Name': r.subjectName,
      'Faculty Member': r.facultyName,
      'Recorded Status': r.status,
      'Claim Status': r.claimStatus ? r.claimStatus.toUpperCase() : 'None',
      'Claim Reason': r.claimReason || '',
      'Claim Remarks': r.claimRemarks || '',
      'Session Remarks': r.remarks || '',
    }));
    exportToCSV(exportRows, `Attendance_History_${studentHistoryData.rollNumber}_${getISTTodayDate()}`);
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
      'Eligibility Status': s.isDefaulter ? 'Defaulter (<75%)' : 'Eligible',
    }));
    exportToCSV(exportRows, `Section_Report_${sec?.name || 'Section'}_${getISTTodayDate()}`);
  };

  // Dynamic sections based on selectedYearFilter
  const dynamicSections = useMemo(() => {
    if (selectedYearFilter === 'ALL') {
      return sections.filter(s => s.active);
    }
    const matchingSemIds = semesters.filter(s => s.academic_year_id === selectedYearFilter).map(s => s.id);
    return sections.filter(s => s.active && matchingSemIds.includes(s.semester_id));
  }, [sections, semesters, selectedYearFilter]);

  // Unique section names available for the filter pills
  const availableSectionNames = useMemo(() => {
    const names = Array.from(new Set(dynamicSections.map(s => s.name)));
    return ['ALL', ...names.sort()];
  }, [dynamicSections]);

  // Compute stats for department students, scoped by selectedYearFilter
  const studentStats: StudentOverallAttendance[] = useMemo(() => {
    return students
      .filter(s => {
        if (s.department_id !== dept?.id || !s.active) return false;
        if (selectedYearFilter !== 'ALL' && s.academic_year_id !== selectedYearFilter) return false;
        return true;
      })
      .map(s => getStudentAttendance(s.id));
  }, [students, dept?.id, selectedYearFilter, getStudentAttendance]);

  const filteredStats = useMemo(() => {
    if (selectedSectionFilter === 'ALL') return studentStats;
    return studentStats.filter(s => s.sectionName === selectedSectionFilter);
  }, [studentStats, selectedSectionFilter]);

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

      {/* KPI Cards */}
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
              {defaulters.length}
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
              <h3 className="text-xl sm:text-2xl font-black text-slate-300 mt-1">No records yet</h3>
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

      {/* Department Attendance Roster Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-emerald-500/15 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#00ff88]" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Department Attendance Ledger & Defaulter Tracking
            </h3>
          </div>

          {/* Section Filter Pills — Only displayed after a specific academic year is selected */}
          {selectedYearFilter !== 'ALL' && availableSectionNames.length > 1 && (
            <div className="bg-slate-950/80 p-1 rounded-xl border border-emerald-500/20 flex items-center text-xs font-bold">
              <span className="text-slate-400 font-bold uppercase text-[10px] px-2 hidden sm:inline">Section:</span>
              {availableSectionNames.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSelectedSectionFilter(sec)}
                  className={clsx(
                    'px-3 py-1 rounded-lg transition-all',
                    selectedSectionFilter === sec
                      ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_10px_rgba(0,255,136,0.3)]'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  {sec === 'ALL' ? 'All Sections' : `Section ${sec}`}
                </button>
              ))}
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
              {filteredStats.map((s) => {
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
              })}
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
        <div className="bg-slate-950/70 border border-emerald-500/20 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Year Selector */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              1. Academic Year (Strictly No 1st Year)
            </label>
            <select
              value={drillDownYearId}
              onChange={(e) => {
                setDrillDownYearId(e.target.value);
                setDrillDownSectionId('');
                setDrillDownStudentId('');
              }}
              className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00ff88] cursor-pointer"
            >
              <option value="">Select Academic Year...</option>
              {supportedYears.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          {/* Section Selector */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              2. Section ({drillDownSections.length})
            </label>
            <select
              value={drillDownSectionId}
              disabled={!drillDownYearId}
              onChange={(e) => {
                setDrillDownSectionId(e.target.value);
                setDrillDownStudentId('');
              }}
              className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00ff88] cursor-pointer disabled:opacity-40"
            >
              <option value="">Select Section...</option>
              {drillDownSections.map(s => (
                <option key={s.id} value={s.id}>Section {s.name}</option>
              ))}
            </select>
          </div>

          {/* Student Selector */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              3. Student ({drillDownStudents.length})
            </label>
            <select
              value={drillDownStudentId}
              disabled={!drillDownSectionId}
              onChange={(e) => setDrillDownStudentId(e.target.value)}
              className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs font-bold text-[#00ff88] focus:outline-none focus:border-[#00ff88] cursor-pointer disabled:opacity-40"
            >
              <option value="">Select Student...</option>
              {drillDownStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.roll_number} — {s.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: Start */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Start Date (Optional)
            </label>
            <input
              type="date"
              value={drillDownStartDate}
              onChange={(e) => setDrillDownStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-[#00ff88] cursor-pointer"
            />
          </div>

          {/* Date Range: End */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={drillDownEndDate}
              onChange={(e) => setDrillDownEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-[#00ff88] cursor-pointer"
            />
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
                  {studentHistoryData.attendancePercentage !== null ? `${studentHistoryData.attendancePercentage}%` : 'N/A'}
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
            <h4 className="text-sm font-bold text-white">No Lecture Records Found</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              There are no attendance sessions recorded for this student in the chosen date range.
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


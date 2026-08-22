import React, { useState, useMemo } from 'react';
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
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { exportToCSV, exportAttendanceReportPDF } from '../../lib/utils/exportUtils';
import { StudentOverallAttendance } from '../../types/academic.types';
import { clsx } from 'clsx';

export const HODDashboard: React.FC = () => {
  const { user } = useAuth();
  const { 
    departments, 
    faculty, 
    sections, 
    students, 
    subjects, 
    assignments, 
    getStudentAttendance 
  } = useAcademic();

  const dept = departments.find(d => d.code === 'CSE') || departments[0];
  const hodFaculty = faculty.find(f => f.id === dept.hod_faculty_id) || faculty[0];

  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');

  // Compute stats for all students
  const studentStats: StudentOverallAttendance[] = useMemo(() => {
    return students
      .filter(s => s.department_id === dept.id && s.active)
      .map(s => getStudentAttendance(s.id));
  }, [students, dept.id, getStudentAttendance]);

  const filteredStats = useMemo(() => {
    if (selectedSectionFilter === 'ALL') return studentStats;
    return studentStats.filter(s => s.sectionName === selectedSectionFilter);
  }, [studentStats, selectedSectionFilter]);

  const defaulters = studentStats.filter(s => s.isDefaulter || s.percentage < 75);

  const handleExportDefaultersCSV = () => {
    const data = defaulters.map(d => ({
      Roll_Number: d.rollNumber,
      Full_Name: d.fullName,
      Section: d.sectionName,
      Total_Lectures: d.totalLectures,
      Present_Lectures: d.presentLectures,
      Attendance_Percentage: `${d.percentage}%`,
      Status: 'Defaulter (<75%)',
    }));
    exportToCSV(data, `VCTM_CSE_Defaulters_Report_${new Date().toISOString().substring(0, 10)}`);
  };

  const handleExportDefaultersPDF = () => {
    const headers = ['Roll No.', 'Student Name', 'Section', 'Held', 'Present', 'Percentage', 'Status'];
    const rows = defaulters.map(d => [
      d.rollNumber,
      d.fullName,
      d.sectionName,
      d.totalLectures,
      d.presentLectures,
      `${d.percentage}%`,
      'Defaulter (<75%)'
    ]);

    exportAttendanceReportPDF({
      title: 'DEPARTMENT OF CSE — ATTENDANCE DEFAULTER REPORT (<75%)',
      subtitle: 'Official Academic Audit Report — VCTM Aligarh',
      department: 'Computer Science & Engineering',
      section: selectedSectionFilter === 'ALL' ? 'Sections A & B' : `Section ${selectedSectionFilter}`,
      academicYear: 'B.Tech 2nd Year (2026-2027)',
      tableHeaders: headers,
      tableRows: rows,
      filename: `VCTM_CSE_Defaulters_${new Date().toISOString().substring(0, 10)}`,
    });
  };

  const avgAttendance = studentStats.length > 0
    ? Math.round(studentStats.reduce((acc, s) => acc + s.percentage, 0) / studentStats.length)
    : 85;

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
              Head of Department: <strong className="text-white">{hodFaculty.full_name}</strong> • VCTM Aligarh (340)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
            onClick={handleExportDefaultersCSV}
          >
            Export CSV
          </Button>
          <Button
            variant="neon"
            size="sm"
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-slate-950" />}
            onClick={handleExportDefaultersPDF}
          >
            PDF Defaulter Audit
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total CSE Students</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {students.length}
            </h3>
            <span className="text-[10px] text-emerald-400 font-semibold">53 Sec A • 53 Sec B</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Department Faculty</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {faculty.length}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">100% Workload Assigned</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Defaulters (&lt;75%)</p>
            <h3 className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">
              {defaulters.length}
            </h3>
            <span className="text-[10px] text-rose-400 font-bold">Action Recommended</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Avg Attendance</p>
            <h3 className="text-2xl sm:text-3xl font-black text-[#00ff88] mt-1">
              {avgAttendance}%
            </h3>
            <span className="text-[10px] text-emerald-400 font-semibold">Across All Subjects</span>
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

          {/* Section Filter Pills */}
          <div className="bg-slate-950/80 p-1 rounded-xl border border-emerald-500/20 flex items-center text-xs font-bold">
            {['ALL', 'A', 'B'].map((sec) => (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {filteredStats.map((s) => {
                const isDefaulter = s.percentage < 75;
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
                        {s.percentage}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={clsx(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold border',
                        isDefaulter
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                      )}>
                        {isDefaulter ? 'Defaulter (<75%)' : 'Eligible'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Search,
  BookOpen
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { exportToCSV, exportAttendanceReportPDF } from '../../lib/utils/exportUtils';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { StudentOverallAttendance } from '../../types/academic.types';
import { clsx } from 'clsx';

export const ReportsPage: React.FC = () => {
  const { 
    departments, 
    sections, 
    subjects, 
    students, 
    faculty, 
    getStudentAttendance 
  } = useAcademic();

  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'DEFAULTER'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate stats for all students
  const allStats: StudentOverallAttendance[] = useMemo(() => {
    return students.map(s => getStudentAttendance(s.id));
  }, [students, getStudentAttendance]);

  const filteredStats = useMemo(() => {
    return allStats.filter(s => {
      const matchesSection = selectedSection === 'ALL' || s.sectionName === selectedSection;
      const matchesStatus = 
        selectedStatusFilter === 'ALL' ? true :
        selectedStatusFilter === 'DEFAULTER' ? s.isDefaulter || s.percentage < 75 :
        s.percentage >= 75;
      const matchesSearch = 
        s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSection && matchesStatus && matchesSearch;
    });
  }, [allStats, selectedSection, selectedStatusFilter, searchTerm]);

  const handleExportCSV = () => {
    const data = filteredStats.map(s => ({
      Roll_Number: s.rollNumber,
      Full_Name: s.fullName,
      Section: s.sectionName,
      Total_Lectures_Held: s.totalLectures,
      Present_Count: s.presentLectures,
      Absent_Count: s.totalLectures - s.presentLectures,
      Attendance_Percentage: `${s.percentage}%`,
      Audit_Status: s.percentage >= 75 ? 'Eligible for Exams' : 'Defaulter (<75%)',
    }));
    exportToCSV(data, `VCTM_College_Attendance_Audit_${getISTTodayDate()}`);
  };

  const handleExportPDF = () => {
    const headers = ['Roll No.', 'Student Name', 'Section', 'Held', 'Present', 'Percentage', 'Status'];
    const rows = filteredStats.map(s => [
      s.rollNumber,
      s.fullName,
      s.sectionName,
      s.totalLectures,
      s.presentLectures,
      `${s.percentage}%`,
      s.percentage >= 75 ? 'Eligible' : 'Defaulter'
    ]);

    exportAttendanceReportPDF({
      title: 'COLLEGE ATTENDANCE AUDIT & ELIGIBILITY REPORT',
      subtitle: 'Vivekananda College of Technology & Management, Aligarh (340)',
      department: departments[0]?.name || 'Academic Department',
      section: selectedSection === 'ALL' ? 'All Sections' : `Section ${selectedSection}`,
      academicYear: 'Academic Session 2026-2027',
      tableHeaders: headers,
      tableRows: rows,
      filename: `VCTM_Attendance_Report_${getISTTodayDate()}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-[#00ff88]" />
            Reports & Analytics Hub
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate official attendance ledgers, defaulter lists, and PDF audit summaries
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
          >
            Export CSV
          </Button>
          <Button
            variant="neon"
            size="sm"
            onClick={handleExportPDF}
            leftIcon={<Printer className="w-4 h-4 text-slate-950" />}
          >
            Generate PDF Report
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Section Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold">Section:</span>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              <option value="ALL">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold">Eligibility:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              <option value="ALL">All Students</option>
              <option value="ELIGIBLE">Eligible (&ge;75%)</option>
              <option value="DEFAULTER">Defaulters (&lt;75%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Data Container (Dual-View: Cards on mobile, Table on desktop) */}
      <div>
        {filteredStats.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20">
            <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300">No attendance records found</p>
            <p className="text-xs text-slate-500 mt-1">Audit statistics will populate once faculty mark lecture attendance</p>
          </div>
        ) : (
          <>
            {/* MOBILE VIEW: Student Attendance Report Cards */}
            <div className="space-y-3 md:hidden">
              {filteredStats.map((s) => {
                const isDefaulter = s.percentage < 75;
                return (
                  <div
                    key={s.studentId}
                    className="glass-card rounded-2xl p-4 border border-emerald-500/20 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-black text-emerald-400">{s.rollNumber}</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{s.fullName}</h4>
                      </div>
                      <span className={clsx(
                        'px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                        isDefaulter
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                      )}>
                        {isDefaulter ? '<75% Defaulter' : 'Eligible'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/10 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-950/60">
                        <span className="text-[10px] text-slate-400 block">Section</span>
                        <span className="font-bold text-white">Sec {s.sectionName}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60">
                        <span className="text-[10px] text-slate-400 block">Attended</span>
                        <span className="font-bold text-emerald-400">{s.presentLectures}/{s.totalLectures}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60">
                        <span className="text-[10px] text-slate-400 block">Percentage</span>
                        <span className="font-black font-mono text-[#00ff88]">{s.percentage}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW: Data Table */}
            <div className="hidden md:block glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                    <tr>
                      <th className="px-5 py-3.5">Roll Number</th>
                      <th className="px-5 py-3.5">Student Name</th>
                      <th className="px-5 py-3.5 text-center">Section</th>
                      <th className="px-5 py-3.5 text-center">Lectures Held</th>
                      <th className="px-5 py-3.5 text-center">Attended</th>
                      <th className="px-5 py-3.5 text-center">Percentage</th>
                      <th className="px-5 py-3.5 text-right">Audit Status</th>
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
                          <td className="px-5 py-3.5 text-center font-mono font-black text-sm text-[#00ff88]">
                            {s.percentage}%
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={clsx(
                              'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                              isDefaulter
                                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                : 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                            )}>
                              {isDefaulter ? 'Defaulter (<75%)' : 'Eligible for Exams'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

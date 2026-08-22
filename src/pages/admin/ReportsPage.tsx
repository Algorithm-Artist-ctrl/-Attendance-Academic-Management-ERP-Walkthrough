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
import { StudentOverallAttendance } from '../../types/academic.types';

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
      Eligibility_Status: s.percentage >= 75 ? 'Eligible' : 'Defaulter (<75%)',
    }));
    exportToCSV(data, `VCTM_Attendance_Report_${selectedSection}_${new Date().toISOString().substring(0, 10)}`);
  };

  const handleExportPDF = () => {
    const headers = ['Roll No.', 'Student Name', 'Section', 'Held', 'Present', 'Absent', 'Percentage', 'Status'];
    const rows = filteredStats.map(s => [
      s.rollNumber,
      s.fullName,
      s.sectionName,
      s.totalLectures,
      s.presentLectures,
      s.totalLectures - s.presentLectures,
      `${s.percentage}%`,
      s.percentage >= 75 ? 'Eligible' : 'Defaulter (<75%)'
    ]);

    exportAttendanceReportPDF({
      title: 'INSTITUTIONAL ATTENDANCE AUDIT & ELIGIBILITY REPORT',
      subtitle: 'Official Academic Audit Report — VCTM Aligarh (Code: 340)',
      department: 'Computer Science & Engineering',
      section: selectedSection === 'ALL' ? 'Sections A & B' : `Section ${selectedSection}`,
      academicYear: 'B.Tech 2nd Year (Odd Semester 2026-2027)',
      tableHeaders: headers,
      tableRows: rows,
      filename: `VCTM_Attendance_Audit_${new Date().toISOString().substring(0, 10)}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance Reports & Analytics Center</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Institutional attendance auditing, defaulter list generation, and board compliance reports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Download className="w-4 h-4 text-vctm-navy-700" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="maroon"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handleExportPDF}
          >
            Generate Official PDF
          </Button>
        </div>
      </div>

      {/* Multi-Dimensional Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vctm-navy-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Section:</span>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 focus:ring-1 focus:ring-vctm-navy-500"
          >
            <option value="ALL">All Sections (A & B)</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Compliance:</span>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 focus:ring-1 focus:ring-vctm-navy-500"
          >
            <option value="ALL">All Students ({allStats.length})</option>
            <option value="ELIGIBLE">Eligible Only ( $\ge 75\%$ )</option>
            <option value="DEFAULTER">Defaulters Only ( $&lt; 75\%$ )</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Roll Number</th>
                <th className="px-4 py-3">Student Full Name</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Lectures Held</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Absent</th>
                <th className="px-4 py-3">Attendance %</th>
                <th className="px-4 py-3 text-right">AKTU Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStats.map((st, idx) => (
                <tr key={st.studentId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono font-bold text-vctm-navy-800 text-xs">
                    {st.rollNumber}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {st.fullName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                      Sec {st.sectionName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{st.totalLectures}</td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-600">{st.presentLectures}</td>
                  <td className="px-4 py-3 text-xs font-bold text-rose-600">{st.totalLectures - st.presentLectures}</td>
                  <td className="px-4 py-3 w-40">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-10 ${st.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {st.percentage}%
                      </span>
                      <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${st.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(st.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {st.percentage >= 75 ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Eligible
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Defaulter (&lt;75%)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

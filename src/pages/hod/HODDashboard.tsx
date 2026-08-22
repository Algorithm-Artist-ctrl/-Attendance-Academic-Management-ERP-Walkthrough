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
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { exportToCSV, exportAttendanceReportPDF } from '../../lib/utils/exportUtils';
import { StudentOverallAttendance } from '../../types/academic.types';

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

  return (
    <div className="space-y-6">
      {/* Department Header */}
      <div className="bg-gradient-to-r from-vctm-navy-950 via-vctm-navy-900 to-vctm-navy-800 rounded-2xl p-6 text-white shadow-md border border-vctm-navy-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-400 text-vctm-navy-950 font-black text-2xl flex items-center justify-center shadow-md shrink-0">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{dept.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  HOD Portal
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Head of Department: <strong className="text-white">{hodFaculty.full_name}</strong> • VCTM Aligarh (340)
              </p>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                <span>Total Enrolled: <strong className="text-white">{students.length} Students</strong></span>
                <span>•</span>
                <span>Faculty Members: <strong className="text-white">{faculty.length}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-vctm-navy-800 text-white border-vctm-navy-700 hover:bg-vctm-navy-700"
              leftIcon={<Download className="w-4 h-4 text-amber-400" />}
              onClick={handleExportDefaultersCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="maroon"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={handleExportDefaultersPDF}
            >
              Print PDF Audit Report
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total CSE Students</span>
            <GraduationCap className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900">{students.length}</span>
            <span className="text-xs text-slate-500 ml-2">2nd Year (A & B)</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">53 Sec A • 53 Sec B</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department Faculty</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-600">{faculty.length}</span>
            <span className="text-xs text-slate-500 ml-2">Active Faculty</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">100% Workload Assigned</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Defaulters (&lt;75%)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-600">{defaulters.length}</span>
            <span className="text-xs text-slate-500 ml-2">Students at Risk</span>
          </div>
          <p className="text-xs text-rose-600 mt-2 font-medium">Action recommended</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Attendance</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-vctm-navy-800">
              {Math.round(studentStats.reduce((acc, s) => acc + s.percentage, 0) / (studentStats.length || 1))}%
            </span>
            <span className="text-xs text-slate-500 ml-2">Dept Average</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Across all recorded subjects</p>
        </Card>
      </div>

      {/* Attendance & Defaulters Roster */}
      <Card
        title={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-vctm-navy-700" />
              <span>Department Attendance Roster & Defaulter Tracking</span>
            </div>

            {/* Section filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter Section:</span>
              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                className="text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 focus:ring-1 focus:ring-vctm-navy-500"
              >
                <option value="ALL">All Sections (A & B)</option>
                <option value="A">Section A Only</option>
                <option value="B">Section B Only</option>
              </select>
            </div>
          </div>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Roll Number</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Lectures Held</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Percentage</th>
                <th className="px-4 py-3 text-right">Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStats.map((st) => (
                <tr key={st.studentId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 text-xs">
                    {st.rollNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {st.fullName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                      Section {st.sectionName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{st.totalLectures}</td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-600">{st.presentLectures}</td>
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
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                        Eligible
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 animate-pulse">
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

      {/* Faculty Workload Overview */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-vctm-navy-700" />
            <span>CSE Faculty Directory & Assigned Course Workload</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {faculty.map((f) => {
            const facAssignments = assignments.filter(a => a.faculty_id === f.id && a.active);
            return (
              <div key={f.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{f.full_name}</h4>
                    <p className="text-xs text-slate-500">{f.designation}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-100 text-amber-800">
                    {f.faculty_code}
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/80 text-xs space-y-1">
                  <div className="text-slate-600">
                    Emp Code: <strong className="text-slate-800">{f.employee_code}</strong>
                  </div>
                  <div className="text-slate-600">
                    Teaching: <strong className="text-vctm-navy-800">{facAssignments.length} course sections</strong>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {facAssignments.map(a => (
                      <span key={a.id} className="px-1.5 py-0.2 rounded text-[10px] bg-white border border-slate-200 font-semibold text-slate-700">
                        {a.subject?.subject_code} (Sec {a.section?.name})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

import React from 'react';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  CheckSquare, 
  RotateCcw, 
  FileSpreadsheet, 
  ShieldCheck,
  Layers,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { 
    institution, 
    departments, 
    programs, 
    sections, 
    faculty, 
    students, 
    subjects, 
    timetable, 
    attendanceSessions, 
    corrections, 
    auditLogs 
  } = useAcademic();

  const pendingCorrections = corrections.filter(c => c.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Hero Welcome Card */}
      <div className="bg-gradient-to-r from-vctm-navy-950 via-vctm-navy-900 to-vctm-navy-800 rounded-2xl p-6 text-white shadow-md border border-vctm-navy-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                Super Admin Console
              </span>
              <span className="text-xs text-slate-300">
                Institutional Administration & Compliance
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-2">
              {institution.name}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Centralized Attendance & Academic Management ERP • Odd Semester Session 2026–2027
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="maroon"
              size="md"
              leftIcon={<CheckSquare className="w-4 h-4" />}
              onClick={() => onNavigate('take_attendance')}
              className="font-bold shadow-md"
            >
              Take Attendance
            </Button>
            <Button
              variant="outline"
              size="md"
              className="bg-vctm-navy-800 text-white border-vctm-navy-700 hover:bg-vctm-navy-700"
              leftIcon={<FileSpreadsheet className="w-4 h-4 text-amber-400" />}
              onClick={() => onNavigate('csv_import')}
            >
              Bulk Import CSV
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => onNavigate('students')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-vctm-navy-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Students</span>
            <GraduationCap className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{students.length}</div>
          <span className="text-[10px] text-slate-400 block mt-1">Sec A (53) & Sec B (53)</span>
        </div>

        <div 
          onClick={() => onNavigate('faculty')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-vctm-navy-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Faculty</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{faculty.length}</div>
          <span className="text-[10px] text-slate-400 block mt-1">Full mapped roster</span>
        </div>

        <div 
          onClick={() => onNavigate('academic_setup')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-vctm-navy-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Departments</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{departments.length}</div>
          <span className="text-[10px] text-slate-400 block mt-1">CSE, EE, ME, MBA</span>
        </div>

        <div 
          onClick={() => onNavigate('subjects')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-vctm-navy-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Subjects</span>
            <BookOpen className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{subjects.length}</div>
          <span className="text-[10px] text-slate-400 block mt-1">Theory, Lab & WS</span>
        </div>

        <div 
          onClick={() => onNavigate('timetable')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-vctm-navy-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Timetable</span>
            <Calendar className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{timetable.length}</div>
          <span className="text-[10px] text-slate-400 block mt-1">Periods (Mon-Sat)</span>
        </div>

        <div 
          onClick={() => onNavigate('corrections')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-vctm-navy-400 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Corrections</span>
            <RotateCcw className="w-4 h-4 text-amber-600" />
          </div>
          <div className={`text-2xl font-black mt-2 ${pendingCorrections.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {pendingCorrections.length}
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Pending review</span>
        </div>
      </div>

      {/* Quick Action Hubs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card
          title="Academic Master Control"
          subtitle="Configure branches, courses, sections, and subjects"
        >
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('academic_setup')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>Manage Departments & Programs</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('subjects')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>Manage Subjects & Credits</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('assignments')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>Assign Faculty to Subjects & Sections</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </Card>

        <Card
          title="Scheduling & Attendance"
          subtitle="Real-time conflict detection and lecture recording"
        >
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('timetable')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>Timetable Matrix (A-007 & A-006)</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('take_attendance')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>Take Live Attendance</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>Attendance Reports & Defaulter List</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </Card>

        <Card
          title="Student & Security Governance"
          subtitle="Cohorts management, CSV import, and audit logs"
        >
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('students')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>Student Directory (106 Records)</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('csv_import')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>Import Student List CSV</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('audit_logs')}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span>View System Audit Trail</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </Card>
      </div>

      {/* Recent System Activity / Audit Logs */}
      <Card
        title="Recent System Actions & Audit Events"
        headerAction={
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate('audit_logs')}
          >
            View All Logs
          </Button>
        }
        noPadding
      >
        <div className="divide-y divide-slate-100 font-mono text-xs">
          {auditLogs.slice(0, 6).map((log) => (
            <div key={log.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="font-sans font-bold text-slate-900">{log.action}</span>
                <span className="text-slate-500 font-sans">by {log.actor_name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-sans">
                  {log.actor_role}
                </span>
              </div>
              <span className="text-slate-400 text-[11px]">
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

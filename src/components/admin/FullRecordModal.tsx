import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, 
  GraduationCap, 
  Calendar, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  BarChart3, 
  CheckSquare, 
  Award, 
  History, 
  Loader2, 
  X, 
  ChevronRight,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { 
  StudentFullHistoricalRecord, 
  FacultyFullHistoricalRecord,
  AccountStatus 
} from '../../types/database.types';
import { supabaseService } from '../../lib/services/supabaseService';

export interface FullRecordTarget {
  id: string;
  name: string;
  role: 'student' | 'faculty';
  identifier?: string;
  status?: AccountStatus;
}

interface FullRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: FullRecordTarget | null;
}

export const FullRecordModal: React.FC<FullRecordModalProps> = ({
  isOpen,
  onClose,
  target
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studentRecord, setStudentRecord] = useState<StudentFullHistoricalRecord | null>(null);
  const [facultyRecord, setFacultyRecord] = useState<FacultyFullHistoricalRecord | null>(null);

  const loadRecord = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      if (target.role === 'student') {
        const data = await supabaseService.fetchStudentHistoricalRecord(target.id);
        if (data) {
          setStudentRecord(data);
        } else {
          setError('Could not retrieve full historical dossier for this student.');
        }
      } else {
        const data = await supabaseService.fetchFacultyHistoricalRecord(target.id);
        if (data) {
          setFacultyRecord(data);
        } else {
          setError('Could not retrieve full historical dossier for this faculty member.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading institutional record.');
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (isOpen && target) {
      setActiveTab('overview');
      setStudentRecord(null);
      setFacultyRecord(null);
      loadRecord();
    }
  }, [isOpen, target, loadRecord]);

  if (!isOpen || !target) return null;

  const studentTabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'academic', label: 'Academic History', icon: GraduationCap },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'marks', label: 'Marks & Assessments', icon: Award },
    { id: 'leaves', label: 'Leaves', icon: Calendar },
    { id: 'timetable', label: 'Timetable', icon: Clock },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  const facultyTabs = [
    { id: 'overview', label: 'Overview', icon: Briefcase },
    { id: 'subjects', label: 'Subject Assignments', icon: BookOpen },
    { id: 'classes', label: 'Class Teacher', icon: Layers },
    { id: 'attendance', label: 'Sessions Conducted', icon: CheckSquare },
    { id: 'marks', label: 'Assessments Managed', icon: Award },
    { id: 'timetable', label: 'Timetable Schedule', icon: Clock },
    { id: 'leaves', label: 'Leaves', icon: Calendar },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  const tabs = target.role === 'student' ? studentTabs : facultyTabs;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Institutional Dossier — ${target.name}`}
      maxWidth="2xl"
    >
      <div className="flex flex-col h-[75vh] max-h-[850px] -m-6">
        {/* Top Header Card */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-bold text-xl shadow-xs">
              {target.role === 'student' ? (
                <GraduationCap className="w-7 h-7 text-white" />
              ) : (
                <Briefcase className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{target.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  target.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {target.status || 'ARCHIVED'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                  {target.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Identifier: <span className="text-slate-900 font-bold">{target.identifier || 'N/A'}</span>
                {' • '}
                Dossier Status: <span className="text-slate-900 font-semibold">Permanently Preserved</span>
              </p>
            </div>
          </div>

          {/* Quick Stat Pill */}
          {target.role === 'student' && studentRecord && (
            <div className="flex items-center gap-3">
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-2xs">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Attendance</div>
                <div className="text-sm font-bold text-emerald-700 font-mono">
                  {studentRecord.attendance.percentage}%
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-2xs">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Conducted / Attended</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {studentRecord.attendance.total_attended}/{studentRecord.attendance.total_conducted}
                </div>
              </div>
            </div>
          )}
          {target.role === 'faculty' && facultyRecord && (
            <div className="flex items-center gap-3">
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-2xs">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Sessions Conducted</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {facultyRecord.attendance_sessions.total_conducted}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-2xs">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Subjects Taught</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {facultyRecord.subject_assignments.length}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-slate-50 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-slate-900 text-slate-900 font-bold bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
              <p className="text-xs text-slate-400 font-mono">Querying historical database records...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* STUDENT VIEWS */}
              {target.role === 'student' && studentRecord && (
                <>
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-slate-900" />
                            Academic Enrollment
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Roll Number</span>
                              <span className="font-mono text-white font-semibold">{studentRecord.student.roll_number}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Admission / Reg No</span>
                              <span className="font-mono text-slate-900">{studentRecord.student.admission_number || '—'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Department</span>
                              <span className="text-slate-900">{(studentRecord.student as any).department?.name || 'Engineering'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Program</span>
                              <span className="text-slate-900">{(studentRecord.student as any).program?.name || 'B.Tech'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Section</span>
                              <span className="text-slate-900">{(studentRecord.student as any).section?.name || '—'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                            Institutional Lifecycle
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Record Status</span>
                              <span className="font-bold text-amber-400">{studentRecord.student.status || 'ARCHIVED'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Exit Date</span>
                              <span className="text-slate-900 font-mono">{studentRecord.student.exit_date || '—'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Archived Date</span>
                              <span className="text-slate-900 font-mono">{studentRecord.student.archived_at ? new Date(studentRecord.student.archived_at).toLocaleDateString() : '—'}</span>
                            </div>
                            <div className="flex flex-col py-1">
                              <span className="text-slate-400 mb-1">Exit Reason / Note:</span>
                              <p className="text-slate-800 bg-white p-2 rounded border border-slate-100 italic">
                                {studentRecord.student.exit_reason || 'No specific departure reason documented.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-900" />
                          Contact & Identity Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Email Address</span>
                            <span className="text-slate-900 font-mono">{studentRecord.student.email || studentRecord.profile?.email || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Phone Number</span>
                            <span className="text-slate-900 font-mono">{studentRecord.student.phone || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Last Login</span>
                            <span className="text-slate-900 font-mono">{studentRecord.profile?.last_sign_in_at ? new Date(studentRecord.profile.last_sign_in_at).toLocaleString() : 'Never logged in'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'academic' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                        Semester & Progression History ({studentRecord.academic_history.length})
                      </h4>
                      {studentRecord.academic_history.length === 0 ? (
                        <div className="text-center py-10 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                          No historical semester progression snapshots archived for this student.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {studentRecord.academic_history.map((hist: any, i: number) => (
                            <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold text-white">Semester {hist.semester || i + 1}</span>
                                <p className="text-slate-400 text-[11px]">Academic Year: {hist.academic_year || 'Historical'}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-900 font-mono font-bold">SGPA: {hist.sgpa || '—'}</span>
                                <p className="text-slate-400 text-[11px]">Credits: {hist.credits_earned || '—'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'attendance' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <span className="text-[10px] text-emerald-300 uppercase font-semibold">Lifetime Attendance</span>
                          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{studentRecord.attendance.percentage}%</p>
                        </div>
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                          <span className="text-[10px] text-blue-300 uppercase font-semibold">Classes Attended</span>
                          <p className="text-2xl font-bold font-mono text-blue-400 mt-1">{studentRecord.attendance.total_attended}</p>
                        </div>
                        <div className="p-4 bg-slate-800/40 border border-slate-200 rounded-xl">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Classes Conducted</span>
                          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{studentRecord.attendance.total_conducted}</p>
                        </div>
                      </div>

                      {/* Subject-Wise Attendance */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                          Subject-Wise Attendance Breakdown
                        </h4>
                        {studentRecord.attendance.subject_wise.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                            No subject-wise attendance recorded.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-200">
                                <tr>
                                  <th className="p-3">Subject</th>
                                  <th className="p-3">Code</th>
                                  <th className="p-3 text-center">Conducted</th>
                                  <th className="p-3 text-center">Attended</th>
                                  <th className="p-3 text-right">Percentage</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {studentRecord.attendance.subject_wise.map((sub, i) => (
                                  <tr key={i} className="hover:bg-white">
                                    <td className="p-3 font-medium text-white">{sub.subject_name}</td>
                                    <td className="p-3 font-mono text-slate-400">{sub.subject_code}</td>
                                    <td className="p-3 text-center font-mono text-slate-800">{sub.conducted}</td>
                                    <td className="p-3 text-center font-mono text-emerald-400">{sub.attended}</td>
                                    <td className="p-3 text-right font-mono font-bold">
                                      <span className={sub.percentage >= 75 ? 'text-emerald-400' : 'text-amber-400'}>
                                        {sub.percentage}%
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'marks' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                        Sessional Assessments & Marks ({studentRecord.marks.sessional_assessments.length})
                      </h4>
                      {studentRecord.marks.sessional_assessments.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                          No assessment marks on record for this student.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-200">
                              <tr>
                                <th className="p-3">Assessment</th>
                                <th className="p-3">Subject</th>
                                <th className="p-3 text-center">Marks Obtained</th>
                                <th className="p-3 text-center">Max Marks</th>
                                <th className="p-3 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {studentRecord.marks.sessional_assessments.map((m: any, i: number) => {
                                const assess = m.assessment;
                                const sub = assess?.subject;
                                return (
                                  <tr key={i} className="hover:bg-white">
                                    <td className="p-3 font-medium text-white">{assess?.name || 'Sessional Exam'}</td>
                                    <td className="p-3 text-slate-800">{sub?.subject_name || 'Subject'}</td>
                                    <td className="p-3 text-center font-mono font-bold text-slate-900">{m.marks_obtained}</td>
                                    <td className="p-3 text-center font-mono text-slate-400">{assess?.max_marks || 100}</td>
                                    <td className="p-3 text-right">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-slate-800 border border-slate-200">
                                        {m.status || 'RECORDED'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'leaves' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                        Leave Applications History ({studentRecord.leaves.length})
                      </h4>
                      {studentRecord.leaves.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                          No leave applications filed by this student.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {studentRecord.leaves.map((l: any, i: number) => (
                            <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-xs flex justify-between items-center">
                              <div>
                                <span className="font-semibold text-white">{l.leave_type || 'Casual Leave'}</span>
                                <p className="text-slate-400 text-[11px] mt-0.5 font-mono">
                                  {l.start_date} to {l.end_date} • {l.reason || 'No reason provided'}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                l.status === 'APPROVED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : l.status === 'REJECTED'
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {l.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'timetable' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                        Assigned Class Timetable ({studentRecord.timetable.length} Periods)
                      </h4>
                      {studentRecord.timetable.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                          No active or historical timetable periods recorded for this student's section.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-200">
                              <tr>
                                <th className="p-3">Day</th>
                                <th className="p-3">Period</th>
                                <th className="p-3">Subject</th>
                                <th className="p-3">Faculty</th>
                                <th className="p-3">Time</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {studentRecord.timetable.map((t: any, i: number) => (
                                <tr key={i} className="hover:bg-white">
                                  <td className="p-3 font-semibold text-white">{t.day_of_week}</td>
                                  <td className="p-3 font-mono text-slate-400">Period {t.period_number}</td>
                                  <td className="p-3 text-slate-900">{t.subject?.subject_name || 'Subject'}</td>
                                  <td className="p-3 text-slate-800">{t.faculty?.full_name || 'Faculty'}</td>
                                  <td className="p-3 font-mono text-slate-400">{t.start_time || '—'} - {t.end_time || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'audit' && (
                    <div className="space-y-6">
                      {/* Account Lifecycle Events */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <History className="w-4 h-4 text-slate-900" />
                          Account Lifecycle History ({studentRecord.lifecycle_history.length})
                        </h4>
                        {studentRecord.lifecycle_history.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                            No lifecycle transitions logged yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {studentRecord.lifecycle_history.map((lc, i) => (
                              <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-white">
                                    Transition: <span className="font-mono text-amber-400">{lc.old_status || lc.previous_status || 'ACTIVE'}</span> → <span className="font-mono text-emerald-400">{lc.new_status}</span>
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {new Date(lc.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-slate-400 text-[11px]">
                                  Reason: <span className="text-slate-800">{lc.reason || 'Administrative action'}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Raw Audit Logs */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                          General Audit Logs ({studentRecord.audit_logs.length})
                        </h4>
                        {studentRecord.audit_logs.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                            No audit log records associated with this student entity.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-60 overflow-y-auto">
                            {studentRecord.audit_logs.map((al, i) => (
                              <div key={i} className="p-2.5 bg-white/[0.01] border border-slate-100 rounded-lg text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-mono text-slate-900 font-medium">{al.action}</span>
                                  <p className="text-[11px] text-slate-400">Target: {al.entity_type || 'student'}</p>
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {new Date(al.created_at).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* FACULTY VIEWS */}
              {target.role === 'faculty' && facultyRecord && (
                <>
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-slate-900" />
                            Professional Profile
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Employee Code</span>
                              <span className="font-mono text-white font-semibold">{facultyRecord.faculty.employee_code}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Designation</span>
                              <span className="text-slate-900">{facultyRecord.faculty.designation}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Department</span>
                              <span className="text-slate-900">{(facultyRecord.faculty as any).department?.name || 'Academic Dept'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                            Tenure & Departure
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Status</span>
                              <span className="font-bold text-amber-400">{facultyRecord.faculty.status || 'RESIGNED'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Date of Relieving</span>
                              <span className="text-slate-900 font-mono">{facultyRecord.faculty.exit_date || '—'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-400">Archived Date</span>
                              <span className="text-slate-900 font-mono">{facultyRecord.faculty.archived_at ? new Date(facultyRecord.faculty.archived_at).toLocaleDateString() : '—'}</span>
                            </div>
                            <div className="flex flex-col py-1">
                              <span className="text-slate-400 mb-1">Departure Reason:</span>
                              <p className="text-slate-800 bg-white p-2 rounded border border-slate-100 italic">
                                {facultyRecord.faculty.exit_reason || 'No departure notes specified.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-900" />
                          Contact & Access
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Official Email</span>
                            <span className="text-slate-900 font-mono">{facultyRecord.faculty.email || facultyRecord.profile?.email || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Phone</span>
                            <span className="text-slate-900 font-mono">{facultyRecord.faculty.phone || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Last Sign-In</span>
                            <span className="text-slate-900 font-mono">{facultyRecord.profile?.last_sign_in_at ? new Date(facultyRecord.profile.last_sign_in_at).toLocaleString() : 'Never logged in'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'subjects' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                        All Subject Assignments ({facultyRecord.subject_assignments.length})
                      </h4>
                      {facultyRecord.subject_assignments.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                          No historical subject teaching assignments recorded.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-200">
                              <tr>
                                <th className="p-3">Subject</th>
                                <th className="p-3">Code</th>
                                <th className="p-3">Section</th>
                                <th className="p-3">Session</th>
                                <th className="p-3 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {facultyRecord.subject_assignments.map((fsa: any, i: number) => (
                                <tr key={i} className="hover:bg-white">
                                  <td className="p-3 font-medium text-white">{fsa.subject?.subject_name || 'Subject'}</td>
                                  <td className="p-3 font-mono text-slate-400">{fsa.subject?.subject_code || '—'}</td>
                                  <td className="p-3 text-slate-800">{fsa.section?.name || 'All'}</td>
                                  <td className="p-3 text-slate-400">{fsa.session?.name || 'Historical'}</td>
                                  <td className="p-3 text-right">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      fsa.is_active
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-white/5 text-slate-400 border border-slate-200'
                                    }`}>
                                      {fsa.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'classes' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                        Class Coordinator / Mentor History ({facultyRecord.class_coordinator_assignments.length})
                      </h4>
                      {facultyRecord.class_coordinator_assignments.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                          No class coordinator records found for this faculty member.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {facultyRecord.class_coordinator_assignments.map((cca: any, i: number) => (
                            <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-xs flex justify-between items-center">
                              <div>
                                <span className="font-semibold text-white">Section: {cca.section?.name || 'Section'}</span>
                                <p className="text-slate-400 text-[11px] mt-0.5">Assigned Date: {new Date(cca.created_at).toLocaleDateString()}</p>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-slate-800 border border-slate-200">
                                {cca.is_active ? 'Active Mentor' : 'Past Mentor'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'attendance' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-primary-300 uppercase font-semibold">Total Attendance Sessions Marked</span>
                          <p className="text-2xl font-bold font-mono text-slate-900 mt-0.5">{facultyRecord.attendance_sessions.total_conducted}</p>
                        </div>
                        <CheckSquare className="w-8 h-8 text-slate-900/40" />
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                          Recent Attendance Sessions
                        </h4>
                        {facultyRecord.attendance_sessions.recent_sessions.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                            No attendance marking sessions recorded by this faculty member.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-200">
                                <tr>
                                  <th className="p-3">Date</th>
                                  <th className="p-3">Subject</th>
                                  <th className="p-3">Section</th>
                                  <th className="p-3 text-right">Session Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {facultyRecord.attendance_sessions.recent_sessions.map((sess: any, i: number) => (
                                  <tr key={i} className="hover:bg-white">
                                    <td className="p-3 font-mono text-slate-800">{sess.session_date}</td>
                                    <td className="p-3 font-medium text-white">{sess.subject?.subject_name || 'Subject'}</td>
                                    <td className="p-3 text-slate-400">{sess.section?.name || 'Section'}</td>
                                    <td className="p-3 text-right font-mono text-xs text-slate-800">
                                      Period {sess.period_number || 1}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'marks' && (() => {
                    const assessments = facultyRecord.assessments_managed || facultyRecord.assessments_created || [];
                    return (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                          Assessments Managed ({assessments.length})
                        </h4>
                        {assessments.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                            No assessment examinations created or managed by this faculty member.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {assessments.map((ass: any, i: number) => (
                              <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-semibold text-white">{ass.name}</span>
                                  <p className="text-slate-400 text-[11px] mt-0.5">
                                    {ass.subject?.subject_name || 'Subject'} • Section: {ass.section?.name || 'All'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-slate-900">Max: {ass.max_marks}</span>
                                  <p className="text-[10px] text-slate-500">{ass.is_published ? 'Published' : 'Draft'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {activeTab === 'timetable' && (() => {
                    const timetable = facultyRecord.timetable || facultyRecord.timetable_entries || [];
                    return (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                          Assigned Periods Schedule ({timetable.length})
                        </h4>
                        {timetable.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                            No timetable periods currently assigned.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-200">
                                <tr>
                                  <th className="p-3">Day</th>
                                  <th className="p-3">Period</th>
                                  <th className="p-3">Subject</th>
                                  <th className="p-3">Section</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {timetable.map((t: any, i: number) => (
                                  <tr key={i} className="hover:bg-white">
                                    <td className="p-3 font-semibold text-white">{t.day_of_week}</td>
                                    <td className="p-3 font-mono text-slate-400">Period {t.period_number}</td>
                                    <td className="p-3 text-slate-900">{t.subject?.subject_name || 'Subject'}</td>
                                    <td className="p-3 text-slate-800">{t.section?.name || 'Section'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {activeTab === 'leaves' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                        Faculty Leave History ({facultyRecord.leaves.length})
                      </h4>
                      {facultyRecord.leaves.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                          No leave applications on file for this faculty member.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {facultyRecord.leaves.map((l: any, i: number) => (
                            <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-xs flex justify-between items-center">
                              <div>
                                <span className="font-semibold text-white">{l.leave_type || 'Casual Leave'}</span>
                                <p className="text-slate-400 text-[11px] mt-0.5 font-mono">
                                  {l.start_date} to {l.end_date} • {l.reason || 'No reason specified'}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                l.status === 'APPROVED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {l.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'audit' && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <History className="w-4 h-4 text-slate-900" />
                          Account Lifecycle History ({facultyRecord.lifecycle_history.length})
                        </h4>
                        {facultyRecord.lifecycle_history.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                            No lifecycle transitions logged yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {facultyRecord.lifecycle_history.map((lc, i) => (
                              <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-xs text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-white">
                                    Transition: <span className="font-mono text-amber-400">{lc.old_status || lc.previous_status || 'ACTIVE'}</span> → <span className="font-mono text-emerald-400">{lc.new_status}</span>
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {new Date(lc.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-slate-400 text-[11px]">
                                  Reason: <span className="text-slate-800">{lc.reason || 'Administrative departure'}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                          General Audit Logs ({facultyRecord.audit_logs.length})
                        </h4>
                        {facultyRecord.audit_logs.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-500 bg-white/[0.01] border border-slate-100 rounded-xl">
                            No audit log records associated with this faculty entity.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-60 overflow-y-auto">
                            {facultyRecord.audit_logs.map((al, i) => (
                              <div key={i} className="p-2.5 bg-white/[0.01] border border-slate-100 rounded-lg text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-mono text-slate-900 font-medium">{al.action}</span>
                                  <p className="text-[11px] text-slate-400">Target: {al.entity_type || 'faculty'}</p>
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {new Date(al.created_at).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

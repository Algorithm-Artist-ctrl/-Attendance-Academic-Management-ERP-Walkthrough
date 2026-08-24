import React, { useState, useMemo } from 'react';
import { 
  Award, 
  FileText, 
  Sparkles, 
  Users, 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  Search, 
  Filter, 
  Clock, 
  BookOpen,
  Calendar
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

export const HODAcademicOversightPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    courseAssignments, 
    assignmentSubmissions, 
    quizzes, 
    quizResults, 
    sessionalMarks, 
    subjects, 
    sections, 
    faculty, 
    students 
  } = useAcademic();

  const [selectedSectionFilter, setSelectedSectionFilter] = useState('ALL');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'assignments' | 'quizzes' | 'sessional'>('assignments');

  const filteredAssignments = useMemo(() => {
    return courseAssignments.filter(a => {
      const matchSec = selectedSectionFilter === 'ALL' || a.section_id === selectedSectionFilter;
      const matchSub = selectedSubjectFilter === 'ALL' || a.subject_id === selectedSubjectFilter;
      return matchSec && matchSub;
    });
  }, [courseAssignments, selectedSectionFilter, selectedSubjectFilter]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => {
      const matchSec = selectedSectionFilter === 'ALL' || q.section_id === selectedSectionFilter;
      const matchSub = selectedSubjectFilter === 'ALL' || q.subject_id === selectedSubjectFilter;
      return matchSec && matchSub;
    });
  }, [quizzes, selectedSectionFilter, selectedSubjectFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Academic Oversight & Assessment Analytics</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Departmental monitoring for assignments, continuous quizzes, sessional records, and grading rates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-center">
            <div className="text-2xl font-bold text-white">{courseAssignments.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Total Assignments</div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-center">
            <div className="text-2xl font-bold text-purple-400">{quizzes.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Active Quizzes</div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-center">
            <div className="text-2xl font-bold text-blue-400">{assignmentSubmissions.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Total Submissions</div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-center">
            <div className="text-2xl font-bold text-emerald-400">{sessionalMarks.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Sessional Entries</div>
          </div>
        </div>
      </div>

      {/* Filters and Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('assignments')}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all",
              activeTab === 'assignments' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            )}
          >
            <FileText className="w-3.5 h-3.5" /> Assignments ({filteredAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all",
              activeTab === 'quizzes' ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" /> Quizzes ({filteredQuizzes.length})
          </button>
          <button
            onClick={() => setActiveTab('sessional')}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all",
              activeTab === 'sessional' ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            )}
          >
            <Award className="w-3.5 h-3.5" /> Sessional Ledger
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>Section {s.name}</option>
            ))}
          </select>
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.subject_code} - {s.subject_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab 1: Assignments Table */}
      {activeTab === 'assignments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4">Assignment Title</th>
                  <th className="py-3 px-4">Faculty Incharge</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Submissions</th>
                  <th className="py-3 px-4 text-center">Graded Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No assignments found matching selection.
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map(a => {
                    const subs = assignmentSubmissions.filter(s => s.assignment_id === a.id);
                    const graded = subs.filter(s => s.status === 'graded').length;
                    const secStudents = students.filter(s => s.section_id === a.section_id).length;
                    const pct = secStudents > 0 ? Math.round((subs.length / secStudents) * 100) : 0;

                    return (
                      <tr key={a.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-blue-400">{a.subject?.subject_code}</td>
                        <td className="py-3 px-4 font-medium text-white">Section {a.section?.name}</td>
                        <td className="py-3 px-4 font-medium text-white">{a.title}</td>
                        <td className="py-3 px-4 text-slate-300">{a.faculty?.full_name}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-white">
                          {subs.length} / {secStudents} ({pct}%)
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-400">
                          {graded} / {subs.length}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Quizzes Table */}
      {activeTab === 'quizzes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4">Quiz Title</th>
                  <th className="py-3 px-4">Faculty Incharge</th>
                  <th className="py-3 px-4">Max Marks</th>
                  <th className="py-3 px-4">Date Window</th>
                  <th className="py-3 px-4 text-center">Scores Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredQuizzes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No quizzes found matching selection.
                    </td>
                  </tr>
                ) : (
                  filteredQuizzes.map(q => {
                    const results = quizResults.filter(r => r.quiz_id === q.id);
                    const secStudents = students.filter(s => s.section_id === q.section_id).length;

                    return (
                      <tr key={q.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-semibold text-purple-400">{q.subject?.subject_code}</td>
                        <td className="py-3 px-4 font-medium text-white">Section {q.section?.name}</td>
                        <td className="py-3 px-4 font-medium text-white">{q.title}</td>
                        <td className="py-3 px-4 text-slate-300">{q.faculty?.full_name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{q.max_marks}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {new Date(q.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(q.end_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-white">
                          {results.length} / {secStudents}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Sessional Ledger Summary */}
      {activeTab === 'sessional' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Sessional Examination Records Count by Subject</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {subjects.map(sub => {
              const subEntries = sessionalMarks.filter(sm => sm.subject_id === sub.id);
              const s1Count = subEntries.filter(s => s.sessional_type === 'Sessional 1').length;
              const s2Count = subEntries.filter(s => s.sessional_type === 'Sessional 2').length;
              const putCount = subEntries.filter(s => s.sessional_type === 'Pre-University Test').length;

              return (
                <div key={sub.id} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-blue-400">{sub.subject_code}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{subEntries.length} entries</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate">{sub.subject_name}</h4>

                  <div className="pt-2 border-t border-slate-800/80 text-xs space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Sessional 1 Recorded:</span>
                      <span className="font-mono text-white">{s1Count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sessional 2 Recorded:</span>
                      <span className="font-mono text-white">{s2Count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PUT Recorded:</span>
                      <span className="font-mono text-white">{putCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

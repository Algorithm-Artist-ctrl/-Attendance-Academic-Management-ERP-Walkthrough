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
    sessionalAssessments,
    sessionalMarks, 
    subjects, 
    sections, 
    faculty, 
    students,
    years,
    semesters
  } = useAcademic();

  const [selectedYearFilter, setSelectedYearFilter] = useState('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('ALL');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'assignments' | 'quizzes' | 'sessional'>('assignments');

  const dynamicSections = useMemo(() => {
    if (selectedYearFilter === 'ALL') return sections.filter(s => s.active);
    const matchingSemIds = semesters.filter(s => s.academic_year_id === selectedYearFilter).map(s => s.id);
    return sections.filter(s => s.active && matchingSemIds.includes(s.semester_id));
  }, [sections, semesters, selectedYearFilter]);

  const filteredAssignments = useMemo(() => {
    return courseAssignments.filter(a => {
      const sec = sections.find(s => s.id === a.section_id);
      const sem = semesters.find(s => s.id === sec?.semester_id);
      const matchYr = selectedYearFilter === 'ALL' || sem?.academic_year_id === selectedYearFilter;
      const matchSec = selectedSectionFilter === 'ALL' || a.section_id === selectedSectionFilter;
      const matchSub = selectedSubjectFilter === 'ALL' || a.subject_id === selectedSubjectFilter;
      return matchYr && matchSec && matchSub;
    });
  }, [courseAssignments, sections, semesters, selectedYearFilter, selectedSectionFilter, selectedSubjectFilter]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => {
      const sec = sections.find(s => s.id === q.section_id);
      const sem = semesters.find(s => s.id === sec?.semester_id);
      const matchYr = selectedYearFilter === 'ALL' || sem?.academic_year_id === selectedYearFilter;
      const matchSec = selectedSectionFilter === 'ALL' || q.section_id === selectedSectionFilter;
      const matchSub = selectedSubjectFilter === 'ALL' || q.subject_id === selectedSubjectFilter;
      return matchYr && matchSec && matchSub;
    });
  }, [quizzes, sections, semesters, selectedYearFilter, selectedSectionFilter, selectedSubjectFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shadow-xs">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-serif-institutional text-slate-900 tracking-tight">Academic Oversight & Assessment Analytics</h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  Departmental monitoring for assignments, continuous quizzes, sessional records, and grading rates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-center">
            <div className="text-2xl font-bold font-serif-institutional text-slate-900">{courseAssignments.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Total Assignments</div>
          </div>
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-center">
            <div className="text-2xl font-bold font-serif-institutional text-slate-900">{quizzes.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Active Quizzes</div>
          </div>
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-center">
            <div className="text-2xl font-bold font-serif-institutional text-slate-900">{assignmentSubmissions.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Total Submissions</div>
          </div>
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-center">
            <div className="text-2xl font-bold font-serif-institutional text-slate-900">{sessionalMarks.length}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">Sessional Entries</div>
          </div>
        </div>
      </div>

      {/* Filters and Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-slate-100 border border-slate-200/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('assignments')}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all",
              activeTab === 'assignments' ? "bg-[#0f172a] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <FileText className="w-3.5 h-3.5" /> Assignments ({filteredAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all",
              activeTab === 'quizzes' ? "bg-[#0f172a] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" /> Quizzes ({filteredQuizzes.length})
          </button>
          <button
            onClick={() => setActiveTab('sessional')}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all",
              activeTab === 'sessional' ? "bg-[#0f172a] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Award className="w-3.5 h-3.5" /> Sessional Ledger
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedYearFilter}
            onChange={(e) => {
              setSelectedYearFilter(e.target.value);
              setSelectedSectionFilter('ALL');
            }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
          >
            <option value="ALL">All Years</option>
            {years.filter(y => y.active && y.year_number !== 1).map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
          <select
            value={selectedSectionFilter}
            onChange={(e) => setSelectedSectionFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
          >
            <option value="ALL">All Sections</option>
            {dynamicSections.map(s => (
              <option key={s.id} value={s.id}>Section {s.name}</option>
            ))}
          </select>
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
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
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4">Assignment Title</th>
                  <th className="py-3 px-4">Faculty Incharge</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Submissions</th>
                  <th className="py-3 px-4 text-center">Graded Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
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
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{a.subject?.subject_code}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">Section {a.section?.name}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{a.title}</td>
                        <td className="py-3 px-4 text-slate-600">{a.faculty?.full_name}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                          {subs.length} / {secStudents} ({pct}%)
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-700">
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
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4">Quiz Title</th>
                  <th className="py-3 px-4">Faculty Incharge</th>
                  <th className="py-3 px-4">Max Marks</th>
                  <th className="py-3 px-4">Date Window</th>
                  <th className="py-3 px-4 text-center">Scores Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredQuizzes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No quizzes found matching selection.
                    </td>
                  </tr>
                ) : (
                  filteredQuizzes.map(q => {
                    const results = quizResults.filter(r => r.quiz_id === q.id);
                    const secStudents = students.filter(s => s.section_id === q.section_id).length;

                    return (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{q.subject?.subject_code}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">Section {q.section?.name}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{q.title}</td>
                        <td className="py-3 px-4 text-slate-600">{q.faculty?.full_name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{q.max_marks}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(q.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(q.end_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
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
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4">Sessional Assessment</th>
                  <th className="py-3 px-4">Faculty Incharge</th>
                  <th className="py-3 px-4">Max Marks</th>
                  <th className="py-3 px-4">Exam Date</th>
                  <th className="py-3 px-4 text-center">Evaluation Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sessionalAssessments
                  .filter(sa => {
                    const matchSec = selectedSectionFilter === 'ALL' || sa.section_id === selectedSectionFilter;
                    const matchSub = selectedSubjectFilter === 'ALL' || sa.subject_id === selectedSubjectFilter;
                    return matchSec && matchSub;
                  })
                  .map(sa => {
                    const marksList = sessionalMarks.filter(sm => sm.sessional_assessment_id === sa.id);
                    const secStudents = students.filter(s => s.section_id === sa.section_id).length;
                    const pct = secStudents > 0 ? Math.round((marksList.length / secStudents) * 100) : 0;

                    return (
                      <tr key={sa.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{sa.subject?.subject_code}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">Section {sa.section?.name}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{sa.title}</td>
                        <td className="py-3 px-4 text-slate-600">{sa.faculty?.full_name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{sa.max_marks}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(sa.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                          {marksList.length} / {secStudents} ({pct}%)
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

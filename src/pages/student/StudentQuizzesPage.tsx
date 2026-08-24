import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  Clock, 
  Calendar, 
  Award, 
  Search, 
  Filter, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Quiz } from '../../types/database.types';
import { clsx } from 'clsx';

export const StudentQuizzesPage: React.FC = () => {
  const { user } = useAuth();
  const { quizzes, quizResults, subjects, students } = useAcademic();

  const currentStudent = useMemo(() => {
    return students.find(s => s.id === user?.student_id || s.id === user?.id);
  }, [students, user]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');

  // Filter quizzes strictly applicable to student's section
  const myQuizzes = useMemo(() => {
    if (!currentStudent?.section_id) return [];
    return quizzes.filter(q => q.section_id === currentStudent.section_id && q.active);
  }, [quizzes, currentStudent]);

  const filteredQuizzes = useMemo(() => {
    return myQuizzes.filter(q => {
      const matchesSearch = (q.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (q.subject?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (q.subject?.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = selectedSubjectFilter === 'ALL' || q.subject_id === selectedSubjectFilter;
      return matchesSearch && matchesSubject;
    });
  }, [myQuizzes, searchTerm, selectedSubjectFilter]);

  // Distinct enrolled subjects
  const enrolledSubjects = useMemo(() => {
    const map = new Map<string, typeof subjects[0]>();
    for (const q of myQuizzes) {
      if (q.subject && !map.has(q.subject.id)) {
        map.set(q.subject.id, q.subject);
      }
    }
    return Array.from(map.values());
  }, [myQuizzes]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Academic Quizzes & Assessments</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Access Google Form quizzes assigned for your section and track your evaluated scores.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search quizzes by title or subject code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Enrolled Subjects</option>
              {enrolledSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_code} - {s.subject_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quiz Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredQuizzes.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900/50 border border-slate-800/60 rounded-2xl">
            <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-slate-300">No Active Quizzes</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              There are currently no quizzes scheduled for your section. Check back periodically!
            </p>
          </div>
        ) : (
          filteredQuizzes.map(quiz => {
            const myResult = currentStudent ? quizResults.find(qr => qr.quiz_id === quiz.id && qr.student_id === currentStudent.id) : null;
            const now = new Date();
            const start = new Date(quiz.start_time);
            const end = new Date(quiz.end_time);
            const isUpcoming = now < start;
            const isExpired = now > end;
            const isActive = !isUpcoming && !isExpired;

            return (
              <div 
                key={quiz.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {quiz.subject?.subject_code || 'Course'} • Section {quiz.section?.name || 'A'}
                    </span>
                    <span className={clsx(
                      "px-2.5 py-0.5 rounded text-[11px] font-semibold",
                      isActive ? "bg-emerald-500/20 text-emerald-300" : isUpcoming ? "bg-blue-500/20 text-blue-300" : "bg-slate-800 text-slate-400"
                    )}>
                      {isActive ? 'Available' : isUpcoming ? 'Upcoming' : 'Expired'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{quiz.title}</h3>
                  <p className="text-xs text-slate-300 mb-2 font-medium">
                    {quiz.subject?.subject_name}
                  </p>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                    {quiz.description || quiz.instructions || 'Click below to launch the online Google Form quiz.'}
                  </p>

                  <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Maximum Marks:</span>
                      <span className="font-semibold text-emerald-400">{quiz.max_marks} Marks</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Window:</span>
                      <span className="font-medium text-slate-300 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Evaluated Score Card */}
                  {myResult && (
                    <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-300">Evaluated Score:</span>
                      </div>
                      <span className="text-sm font-bold font-mono text-white">
                        {myResult.marks_obtained} / {quiz.max_marks}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3">
                  <a
                    href={quiz.google_form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      "w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md",
                      isActive 
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    )}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {isActive ? 'OPEN QUIZ (GOOGLE FORM)' : 'VIEW QUIZ LINK'}
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

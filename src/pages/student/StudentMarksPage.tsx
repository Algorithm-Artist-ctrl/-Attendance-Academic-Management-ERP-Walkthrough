import React, { useMemo } from 'react';
import { 
  Award, 
  BookOpen, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  TrendingUp, 
  Calendar, 
  BarChart3, 
  GraduationCap,
  ShieldAlert
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

export const StudentMarksPage: React.FC = () => {
  const { user } = useAuth();
  const { students, getStudentAcademicScorecard } = useAcademic();

  const currentStudent = useMemo(() => {
    return students.find(s => s.id === user?.student_id || s.id === user?.student?.id || s.roll_number === user?.student?.roll_number || s.id === user?.id) || user?.student;
  }, [students, user]);

  const scorecard = useMemo(() => {
    if (!currentStudent) return [];
    return getStudentAcademicScorecard(currentStudent.id);
  }, [currentStudent, getStudentAcademicScorecard]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Academic Performance & Marks Scorecard</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Official continuous assessment ledger: Sessional examinations, quizzes, assignments, and internal scores.
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-right">
            <div className="text-xs text-slate-400">Enrolled Student</div>
            <div className="text-sm font-bold text-white">{currentStudent?.full_name}</div>
            <div className="text-xs font-mono text-emerald-400">{currentStudent?.roll_number}</div>
          </div>
        </div>
      </div>

      {/* Scorecard Subject Cards */}
      <div className="space-y-5">
        {scorecard.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/50 border border-slate-800/60 rounded-2xl">
            <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-slate-300">No Assessment Records Yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Your sessional and assignment evaluations will appear here once published by faculty.
            </p>
          </div>
        ) : (
          scorecard.map(item => (
            <div 
              key={item.subjectId} 
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-lg space-y-4"
            >
              {/* Subject Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {item.subjectCode}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-white">{item.subjectName}</h3>
                    <p className="text-xs text-slate-400">Faculty In-charge: {item.facultyName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">Attendance</div>
                    <div className={clsx(
                      "text-sm font-bold font-mono",
                      item.attendancePercentage >= 75 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {item.attendancePercentage}%
                    </div>
                  </div>
                  <div className="text-right pl-4 border-l border-slate-800">
                    <div className="text-[11px] text-slate-400">Internal Score</div>
                    <div className="text-sm font-bold font-mono text-emerald-400">
                      {item.totalInternalScore} <span className="text-xs text-slate-500">/ {item.maxInternalScore || 100}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                {/* 1. Sessional Examinations */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-400" /> Sessional Examinations
                  </h4>
                  <div className="space-y-2 text-xs">
                    {/* Sessional 1 */}
                    <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                      <span className="text-slate-400">Sessional 1:</span>
                      <span className="font-mono font-bold text-white">
                        {item.sessionalMarks.sessional1?.obtained !== undefined 
                          ? `${item.sessionalMarks.sessional1.obtained} / ${item.sessionalMarks.sessional1.max}` 
                          : '—'}
                      </span>
                    </div>

                    {/* Sessional 2 */}
                    <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                      <span className="text-slate-400">Sessional 2:</span>
                      <span className="font-mono font-bold text-white">
                        {item.sessionalMarks.sessional2?.obtained !== undefined 
                          ? `${item.sessionalMarks.sessional2.obtained} / ${item.sessionalMarks.sessional2.max}` 
                          : '—'}
                      </span>
                    </div>

                    {/* Pre-University Test */}
                    <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                      <span className="text-slate-400">Pre-University Test:</span>
                      <span className="font-mono font-bold text-white">
                        {item.sessionalMarks.put?.obtained !== undefined 
                          ? `${item.sessionalMarks.put.obtained} / ${item.sessionalMarks.put.max}` 
                          : '—'}
                      </span>
                    </div>

                    {/* Additional Custom Sessionals (if any created by teacher) */}
                    {item.sessionalMarks.otherSessionals && item.sessionalMarks.otherSessionals.map(s => (
                      <div key={s.assessmentId} className="flex justify-between items-center py-1 border-b border-slate-800/40">
                        <span className="text-slate-400 truncate max-w-[140px]">{s.title}:</span>
                        <span className="font-mono font-bold text-white">
                          {s.obtainedMarks !== undefined ? `${s.obtainedMarks} / ${s.maxMarks}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Quizzes */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Quizzes
                  </h4>
                  <div className="space-y-2 text-xs">
                    {item.quizMarks.length === 0 ? (
                      <p className="text-slate-500 py-3 text-center">No quizzes conducted.</p>
                    ) : (
                      item.quizMarks.map(q => (
                        <div key={q.quizId} className="flex justify-between items-center py-1 border-b border-slate-800/40">
                          <span className="text-slate-400 truncate max-w-[140px]">{q.title}:</span>
                          <span className="font-mono font-bold text-white">
                            {q.obtainedMarks !== undefined ? `${q.obtainedMarks} / ${q.maxMarks}` : 'Pending'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. Assignments */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" /> Assignments
                  </h4>
                  <div className="space-y-2 text-xs">
                    {item.assignmentMarks.length === 0 ? (
                      <p className="text-slate-500 py-3 text-center">No assignments assigned.</p>
                    ) : (
                      item.assignmentMarks.map(a => (
                        <div key={a.assignmentId} className="flex justify-between items-center py-1 border-b border-slate-800/40">
                          <span className="text-slate-400 truncate max-w-[140px]">{a.title}:</span>
                          <span className="font-mono font-bold text-white">
                            {a.obtainedMarks !== undefined ? `${a.obtainedMarks} / ${a.maxMarks}` : 'Submitted'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

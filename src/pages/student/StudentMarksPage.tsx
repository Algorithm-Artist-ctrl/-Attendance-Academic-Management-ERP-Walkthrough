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
import { MarksSkeleton } from '../../components/common/SkeletonLoader';
import { clsx } from 'clsx';

export const StudentMarksPage: React.FC = () => {
  const { user } = useAuth();
  const { students, getStudentAcademicScorecard, getStudentAttendance, isLoading } = useAcademic();

  const currentStudent = useMemo(() => {
    return students.find(s => s.id === user?.student_id || s.id === user?.student?.id || s.roll_number === user?.student?.roll_number || s.id === user?.id) || user?.student;
  }, [students, user]);

  const scorecard = useMemo(() => {
    if (!currentStudent) return [];
    return getStudentAcademicScorecard(currentStudent.id);
  }, [currentStudent, getStudentAcademicScorecard]);

  // Enrolled subjects with no published marks yet
  const unpublishedSubjects = useMemo(() => {
    if (!currentStudent) return [];
    const att = getStudentAttendance(currentStudent.id);
    const publishedIds = new Set(scorecard.map(s => s.subjectId));
    return att.subjectStats.filter(stat => !publishedIds.has(stat.subjectId));
  }, [currentStudent, getStudentAttendance, scorecard]);

  // Total published marks calculation (strictly only published assessments)
  const statsSummary = useMemo(() => {
    let totalObtained = 0;
    let totalMax = 0;
    for (const item of scorecard) {
      totalObtained += item.totalInternalScore;
      totalMax += item.maxInternalScore;
    }
    const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;
    return {
      totalObtained,
      totalMax,
      percentage,
      publishedCount: scorecard.length,
      unpublishedCount: unpublishedSubjects.length,
    };
  }, [scorecard, unpublishedSubjects]);

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

        {/* Quick Stats Summary Bar (Strictly Published Marks) */}
        {!isLoading && (scorecard.length > 0 || unpublishedSubjects.length > 0) && (
          <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10.5px] text-slate-400 block">Published Scorecards</span>
              <span className="text-base font-bold text-white mt-0.5 block font-mono">
                {statsSummary.publishedCount} <span className="text-xs font-normal text-slate-400">Subject{statsSummary.publishedCount !== 1 ? 's' : ''}</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10.5px] text-slate-400 block">Awaiting Publication</span>
              <span className="text-base font-bold text-amber-300 mt-0.5 block font-mono">
                {statsSummary.unpublishedCount} <span className="text-xs font-normal text-slate-400">Subject{statsSummary.unpublishedCount !== 1 ? 's' : ''}</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10.5px] text-slate-400 block">Total Internal Score</span>
              <span className="text-base font-bold text-[#00ff88] mt-0.5 block font-mono">
                {statsSummary.totalObtained} <span className="text-xs font-normal text-slate-400">/ {statsSummary.totalMax}</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10.5px] text-slate-400 block">Overall Percentage</span>
              <span className="text-base font-bold text-cyan-300 mt-0.5 block font-mono">
                {statsSummary.percentage !== null ? `${statsSummary.percentage}%` : 'Pending'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Scorecard Subject Cards */}
      <div className="space-y-5">
        {isLoading ? (
          <MarksSkeleton count={3} />
        ) : scorecard.length === 0 && unpublishedSubjects.length === 0 ? (
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
                      item.attendancePercentage === null
                        ? "text-slate-400"
                        : item.attendancePercentage >= 75 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {item.attendancePercentage === null ? 'No data' : `${item.attendancePercentage}%`}
                    </div>
                  </div>
                  <div className="text-right pl-4 border-l border-slate-800">
                    <div className="text-[11px] text-slate-400">Internal Score</div>
                    <div className="text-sm font-bold font-mono text-emerald-400">
                      {item.totalInternalScore} <span className="text-xs text-slate-500">/ {item.maxInternalScore}</span>
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
                    {item.sessionalMarks.sessionals.length === 0 ? (
                      <p className="text-slate-500 py-3 text-center">No sessional marks published yet.</p>
                    ) : (
                      item.sessionalMarks.sessionals.map((s, idx) => (
                        <div key={s.assessmentId || idx} className="flex justify-between items-center py-1 border-b border-slate-800/40">
                          <span className="text-slate-400 truncate max-w-[140px]">{s.title}:</span>
                          <span className="font-mono font-bold text-white">
                            {s.obtainedMarks !== undefined ? `${s.obtainedMarks} / ${s.maxMarks}` : 'Pending'}
                          </span>
                        </div>
                      ))
                    )}
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

        {/* Enrolled Subjects Awaiting Marks Publication */}
        {!isLoading && unpublishedSubjects.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Enrolled Subjects Awaiting Evaluation ({unpublishedSubjects.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unpublishedSubjects.map(sub => (
                <div
                  key={sub.subjectId}
                  className="bg-slate-900/60 border border-slate-800/70 rounded-2xl p-4.5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {sub.subjectCode}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1.5">{sub.subjectName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Faculty: {sub.facultyName}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 border border-amber-500/25 text-amber-300 shrink-0">
                      Evaluation in Progress
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/50 text-[11.5px] text-slate-400 flex items-center justify-between">
                    <span>Attendance: <strong className={sub.percentage !== null && sub.percentage >= 75 ? 'text-emerald-400' : 'text-slate-300'}>{sub.percentage !== null ? `${sub.percentage}%` : 'No data'}</strong></span>
                    <span className="text-slate-500 italic">Continuous assessment pending faculty publication</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

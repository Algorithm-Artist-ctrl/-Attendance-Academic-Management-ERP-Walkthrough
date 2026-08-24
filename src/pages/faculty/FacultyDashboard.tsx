import React from 'react';
import { 
  Calendar, 
  CheckSquare, 
  Users, 
  BookOpen, 
  RotateCcw, 
  ArrowRight, 
  TrendingUp, 
  Clock, 
  Layers, 
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { getISTDayOfWeek } from '../../lib/utils/dateUtils';

interface FacultyDashboardProps {
  onNavigate: (tab: string, params?: any) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    timetable, 
    assignments, 
    subjects, 
    sections, 
    corrections, 
    departments,
    students,
    courseAssignments,
    quizzes,
    sessionalAssessments,
    faculty: facultyList,
    getFacultyCorrectionRequests
  } = useAcademic();

  const currentFaculty = facultyList.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;

  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';

  const todayDay = getISTDayOfWeek();

  // Today's classes for this faculty strictly from Supabase timetable
  const todaySchedule = todayDay === 'SUN' 
    ? [] 
    : timetable
        .filter(t => t.faculty_id === facultyId && t.day_of_week === todayDay)
        .sort((a, b) => a.period_number - b.period_number);

  // Assigned subjects and sections strictly from faculty_subject_assignments
  const myAssignments = assignments.filter(fa => fa.faculty_id === facultyId);
  const mySubjects = subjects.filter(s => myAssignments.some(fa => fa.subject_id === s.id));
  const mySections = sections.filter(sec => myAssignments.some(fa => fa.section_id === sec.id));

  // Pending correction requests assigned strictly to this faculty
  const myPendingCorrections = getFacultyCorrectionRequests(facultyId).filter(c => c.status === 'pending');
  const dept = departments.find(d => d.id === currentFaculty?.department_id) || departments[0];

  return (
    <div className="space-y-6">
      {/* 1. WELCOME BANNER */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Welcome back, {currentFaculty?.full_name || user?.full_name || 'Faculty Member'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            {currentFaculty?.designation || 'Faculty'} • {dept?.name || 'Academic Department'} • Code: <span className="text-[#00ff88] font-bold">{currentFaculty?.faculty_code || currentFaculty?.employee_code || 'FACULTY'}</span>
          </p>
        </div>

        <div className="z-10 flex items-center gap-3">
          <Button
            variant="neon"
            size="sm"
            onClick={() => onNavigate('take_attendance')}
            leftIcon={<CheckSquare className="w-3.5 h-3.5 text-slate-950" />}
          >
            Mark Live Attendance
          </Button>
        </div>
      </div>

      {/* 2. STATS KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Classes */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Today's Classes</p>
            <h3 className="text-2xl sm:text-3xl font-black text-[#00ff88] mt-1">
              {todaySchedule.length}
            </h3>
            <span className="text-[10px] text-emerald-400 font-medium">{todayDay} Timetable</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Assigned Subjects */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Assigned Subjects</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {mySubjects.length}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Theory & Labs</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Assigned Sections */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Assigned Sections</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {mySections.length}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Active Sections</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Requests */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Pending Requests</p>
            <h3 className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
              {myPendingCorrections.length}
            </h3>
            <span className="text-[10px] text-amber-400/80 font-medium">Requires Review</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2.5 MY TEACHING PORTFOLIO & SECTION WORKSPACES */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/25 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#00ff88]" />
              My Teaching Portfolio & Section Workspaces
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Select a dedicated Section Workspace to manage assignments, quizzes, sessionals, attendance & student rosters
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mySubjects.map((sub) => {
            const assignedSectionsForSub = sections.filter(sec => 
              myAssignments.some(fa => fa.subject_id === sub.id && fa.section_id === sec.id)
            );

            return (
              <div
                key={sub.id}
                className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/20 hover:border-emerald-500/40 transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-900 border border-emerald-500/30 text-emerald-400 font-mono">
                      {sub.subject_code}
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-white mt-1">
                      {sub.subject_name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {sub.credits || 4} Credits • {sub.lecture_type || 'Theory'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Assigned Sections:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {assignedSectionsForSub.map((sec) => {
                      const studCount = students.filter(s => s.section_id === sec.id && s.active).length;
                      const asgnCount = courseAssignments.filter(a => a.subject_id === sub.id && a.section_id === sec.id).length;
                      const quizCount = quizzes.filter(q => q.subject_id === sub.id && q.section_id === sec.id).length;
                      const sessCount = sessionalAssessments.filter(sa => sa.subject_id === sub.id && sa.section_id === sec.id).length;

                      return (
                        <div
                          key={sec.id}
                          className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/20 hover:border-[#00ff88] transition-all group flex flex-col justify-between space-y-2"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-500/20 text-[#00ff88]">
                                Section {sec.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {sec.room_number || 'Room TBD'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-1 mt-2 text-[10px] text-slate-300">
                              <div>Students: <strong className="text-white">{studCount}</strong></div>
                              <div>Assgn: <strong className="text-blue-400">{asgnCount}</strong></div>
                              <div>Quizzes: <strong className="text-purple-400">{quizCount}</strong></div>
                              <div>Sess: <strong className="text-amber-400">{sessCount}</strong></div>
                            </div>
                          </div>

                          <Button
                            variant="neon"
                            size="sm"
                            onClick={() => onNavigate('section_workspace', { subjectId: sub.id, sectionId: sec.id })}
                            className="w-full text-xs py-1.5 justify-center font-bold"
                          >
                            Open Workspace →
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2.6 CLASS COORDINATOR PORTAL (IF DESIGNATED) */}
      {(() => {
        const coordinatedSection = sections.find(sec => sec.class_coordinator_id === facultyId);
        if (!coordinatedSection) return null;

        const secStudents = students.filter(s => s.section_id === coordinatedSection.id && s.active);
        const secTotalLectures = timetable.filter(t => t.section_id === coordinatedSection.id && t.active);

        return (
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/25 space-y-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00ff88]">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30">
                      OFFICIAL CLASS COORDINATOR
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Room {coordinatedSection.room_number || 'A007'}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white mt-1">
                    Class Coordinator Portal — Section {coordinatedSection.name} (B.Tech CSE 2nd Year)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Coordinating {secStudents.length} enrolled students and complete weekly timetable oversight
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="neon"
                  size="sm"
                  onClick={() => onNavigate('timetable')}
                  leftIcon={<Calendar className="w-3.5 h-3.5 text-slate-950" />}
                >
                  View Complete Section Timetable
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('students')}
                  leftIcon={<Users className="w-3.5 h-3.5" />}
                >
                  Section Students
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-emerald-500/15 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/15">
                <span className="text-slate-400 text-[10px] block font-semibold">Enrolled Section Students</span>
                <span className="text-lg font-black text-white block mt-0.5">{secStudents.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/15">
                <span className="text-slate-400 text-[10px] block font-semibold">Weekly Lecture Periods</span>
                <span className="text-lg font-black text-[#00ff88] block mt-0.5">{secTotalLectures.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/15">
                <span className="text-slate-400 text-[10px] block font-semibold">Department & Year</span>
                <span className="text-sm font-bold text-white block mt-0.5 truncate">{dept?.name || 'CSE'} (2nd Yr)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/15">
                <span className="text-slate-400 text-[10px] block font-semibold">Coordinator Role</span>
                <span className="text-sm font-bold text-emerald-400 block mt-0.5">Section {coordinatedSection.name} Lead</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. TODAY'S SCHEDULE & RECENT REQUESTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Today's Schedule with "Take Attendance" button */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Today's Schedule
              </h3>
              <p className="text-xs text-slate-400">{todayDay} Lecture Schedule • Odd Semester</p>
            </div>
            <button
              onClick={() => onNavigate('timetable')}
              className="text-xs font-bold text-[#00ff88] hover:underline cursor-pointer"
            >
              Full Schedule →
            </button>
          </div>

          <div className="space-y-3">
            {todaySchedule.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-emerald-500/10">
                <Calendar className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="font-bold text-white text-sm">
                  {todayDay === 'SUN' ? 'Today is Sunday (Weekend / Holiday)' : 'No scheduled lectures for today in your timetable'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {todayDay === 'SUN' ? 'College academic classes are not held on Sundays.' : 'Check your full timetable schedule for weekly lecture distribution.'}
                </p>
              </div>
            ) : (
              todaySchedule.map((entry) => {
                const sec = sections.find(s => s.id === entry.section_id);
                const sub = subjects.find(s => s.id === entry.subject_id);

                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 hover:border-emerald-500/35 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/20 text-[#00ff88] font-mono text-xs font-bold shrink-0">
                        {entry.start_time?.substring(0, 5) || '09:00'} – {entry.end_time?.substring(0, 5) || '09:50'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">
                          {sub?.subject_name || 'Subject'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">
                          Section {sec?.name} • {entry.room_number || sec?.room_number} • {entry.lecture_type || 'Theory'}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="neon"
                      size="sm"
                      onClick={() => onNavigate('take_attendance', { timetableEntryId: entry.id })}
                      leftIcon={<CheckSquare className="w-3.5 h-3.5 text-slate-950" />}
                      className="shrink-0 text-xs font-bold"
                    >
                      Take Attendance
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Card: Recent Student Correction Requests & Assessment Actions */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Academic & Marks Shortcuts
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={() => onNavigate('faculty_assignments')}
                className="p-3 rounded-2xl bg-slate-950/80 border border-blue-500/20 hover:border-blue-500/50 text-left transition-all group"
              >
                <div className="text-xs font-bold text-white group-hover:text-blue-400">Assignments</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Create & Grade</div>
              </button>

              <button
                onClick={() => onNavigate('quizzes')}
                className="p-3 rounded-2xl bg-slate-950/80 border border-purple-500/20 hover:border-purple-500/50 text-left transition-all group"
              >
                <div className="text-xs font-bold text-white group-hover:text-purple-400">Quizzes</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Google Form Quizzes</div>
              </button>

              <button
                onClick={() => onNavigate('sessional_marks')}
                className="col-span-2 p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/50 text-left transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400">Sessional Marks Ledger</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Enter Sessional 1, 2, PUT & Internal Scores</div>
                </div>
                <span className="text-xs font-bold text-emerald-400">Enter Marks →</span>
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-400">Pending Correction Requests</h4>
              <button
                onClick={() => onNavigate('corrections')}
                className="text-[11px] font-bold text-[#00ff88] hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>

            <div className="space-y-2">
              {myPendingCorrections.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl">
                  No pending correction requests from students.
                </div>
              ) : (
                myPendingCorrections.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/15 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-white">
                        {c.student?.full_name || 'Student'}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Roll: {c.student?.roll_number} • {c.reason}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate('corrections')}
                      className="text-[10px] py-1 px-2 shrink-0"
                    >
                      Review
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

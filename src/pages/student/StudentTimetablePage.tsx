import React from 'react';
import { Calendar, Clock, User, MapPin, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { AcademicTimetableGrid } from '../../components/timetable/AcademicTimetableGrid';

export const StudentTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const { 
    getStudentTimetable, 
    faculty, 
    sections, 
    programs, 
    departments,
    years, 
    semesters, 
    sessions,
    students,
    isLoading 
  } = useAcademic();

  // Authoritative student identity resolved from database
  const currentStudent = students.find(
    s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number
  ) || user?.student;
  
  const currentSection = sections.find(s => s.id === currentStudent?.section_id);

  const program = programs.find(p => p.id === currentStudent?.program_id);
  const dept = departments.find(d => d.id === currentStudent?.department_id);
  const year = years.find(y => y.id === currentStudent?.academic_year_id);
  const sem = semesters.find(s => s.id === currentStudent?.semester_id);
  const session = sessions.find(s => s.id === currentStudent?.academic_session_id) || sessions[0];

  // Shared single source of truth for the student's active published timetable
  const sectionEntries = getStudentTimetable(currentStudent?.id || '');

  const classIncharge = faculty.find(f => f.id === currentSection?.class_coordinator_id)?.full_name || 
                        currentSection?.class_coordinator?.full_name || 
                        'Class Coordinator';
  const displayRoom = currentSection?.room_number || 'Assigned Classroom';

  return (
    <div className="space-y-6">
      {/* Top Header with Strict Section Authority & Academic Scope */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800 uppercase tracking-wider">
                STUDENT PORTAL • OFFICIAL SCHEDULE
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Timetable
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] font-serif-institutional tracking-tight flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-[#0F172A]" />
              Official Academic Timetable
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Complete weekly lecture schedule for {program?.name || 'B.Tech'}{year?.name ? ` • ${year.name}` : ''}{sem?.name ? ` (${sem.name})` : ''} • Section <strong className="text-slate-900">{currentSection?.name || 'Assigned'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-800 shrink-0 self-start sm:self-auto font-mono shadow-2xs">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>{session?.name || 'Academic Session 2026–2027'}</span>
          </div>
        </div>

        {/* Academic Details Pill Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Program & Year</span>
            <span className="font-bold text-slate-900 mt-0.5 block truncate">
              {program?.code || 'B.Tech'}{year?.name ? ` • ${year.name}` : ''}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Section & Room</span>
            <span className="font-bold text-slate-900 mt-0.5 block truncate">
              Section {currentSection?.name || 'A'} • {displayRoom}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Class Coordinator</span>
            <span className="font-bold text-slate-900 mt-0.5 block truncate" title={classIncharge}>
              {classIncharge}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Weekly Classes</span>
            <span className="font-bold text-slate-900 mt-0.5 block">
              {sectionEntries.length} Periods Scheduled
            </span>
          </div>
        </div>
      </div>

      {/* Reusable High-Contrast Responsive Timetable Grid */}
      <AcademicTimetableGrid
        entries={sectionEntries}
        isLoading={isLoading}
        emptyTitle={`No published timetable for Section ${currentSection?.name || 'Assigned'}`}
        emptySubtitle={`The official academic timetable for Section ${currentSection?.name || 'Assigned'} has not been published yet. Please check back later or contact your Class Coordinator (${classIncharge}).`}
        activeSectionName={currentSection?.name}
        activeRoomNumber={displayRoom}
      />
    </div>
  );
};

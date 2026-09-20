import React from 'react';
import { Calendar, Clock } from 'lucide-react';
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
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-serif-institutional tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-slate-900" />
            Official Academic Timetable
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {program?.name || 'B.Tech'}{year?.name ? ` • ${year.name}` : ''}{sem?.name ? ` • ${sem.name}` : ''} • Section <span className="text-slate-900 font-bold">{currentSection?.name || 'Assigned'}</span> ({displayRoom}) • Class Coordinator: <span className="text-slate-900 font-semibold">{classIncharge}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-slate-800 shrink-0 self-start sm:self-auto font-mono shadow-2xs">
          <Clock className="w-4 h-4 text-slate-500" />
          <span>{session?.name || 'Academic Session 2026–2027'}</span>
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

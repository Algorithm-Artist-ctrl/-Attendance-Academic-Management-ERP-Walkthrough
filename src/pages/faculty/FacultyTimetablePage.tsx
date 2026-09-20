import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { AcademicTimetableGrid } from '../../components/timetable/AcademicTimetableGrid';

interface FacultyTimetablePageProps {
  onTakeAttendance?: (timetableEntryId: string) => void;
}

export const FacultyTimetablePage: React.FC<FacultyTimetablePageProps> = ({ onTakeAttendance }) => {
  const { user } = useAuth();
  const { 
    subjects, 
    sections, 
    departments, 
    years, 
    semesters,
    faculty,
    getFacultyTimetable,
    getPublishedTimetable,
    isLoading
  } = useAcademic();

  // 1. Authoritative faculty identification
  const currentFaculty = faculty.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;
  
  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';

  // Class Coordinator resolution
  const coordinatedSection = sections.find(s => s.class_coordinator_id === facultyId);
  const [activeScheduleTab, setActiveScheduleTab] = useState<'my_teaching' | 'coordinator'>('my_teaching');

  // 2. Query all published timetable records
  const facultyEntries = getFacultyTimetable(facultyId);
  const coordinatorEntries = coordinatedSection 
    ? getPublishedTimetable({ sectionId: coordinatedSection.id })
    : [];

  const currentActiveEntries = (activeScheduleTab === 'coordinator' && coordinatedSection)
    ? coordinatorEntries
    : facultyEntries;

  // 3. Dynamic context resolution (all sections, subjects, and programs this faculty teaches)
  const uniqueSectionIds = Array.from(new Set(facultyEntries.map(e => e.section_id).filter(Boolean)));
  const uniqueSubjectIds = Array.from(new Set(facultyEntries.map(e => e.subject_id).filter(Boolean)));

  const taughtSections = sections.filter(s => uniqueSectionIds.includes(s.id));
  const taughtSubjects = subjects.filter(s => uniqueSubjectIds.includes(s.id));
  const dept = departments.find(d => d.id === currentFaculty?.department_id) || departments[0];

  const sectionNames = taughtSections.map(s => {
    const sem = semesters.find(sm => sm.id === s.semester_id);
    const yr = years.find(y => y.id === sem?.academic_year_id);
    return `${yr?.name ? `${yr.name} ` : ''}Sec ${s.name}`;
  }).join(', ') || 'Assigned Sections';
  const subjectCodes = taughtSubjects.map(s => s.subject_code).join(', ');

  return (
    <div className="space-y-6">
      {/* View Switcher Tabs (If Faculty is also a Class Coordinator) */}
      {coordinatedSection && (
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 max-w-fit">
          <button
            type="button"
            onClick={() => setActiveScheduleTab('my_teaching')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeScheduleTab === 'my_teaching'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>My Teaching Schedule ({facultyEntries.length} Lectures)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScheduleTab('coordinator')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeScheduleTab === 'coordinator'
                ? 'bg-[#0f172a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Section {coordinatedSection.name} Master Schedule (Class Coordinator)</span>
          </button>
        </div>
      )}

      {/* Top Header with Dynamic Multi-Section Faculty Teaching Context */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800">
              {activeScheduleTab === 'coordinator' ? `CLASS COORDINATOR VIEW — SECTION ${coordinatedSection?.name}` : 'TEACHING PORTFOLIO VIEW'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif-institutional flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-slate-900" />
            {activeScheduleTab === 'coordinator' 
              ? `Complete Timetable — Section ${coordinatedSection?.name} (${coordinatedSection?.room_number || 'Classroom'})`
              : 'Official Faculty Teaching Schedule'
            }
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            {activeScheduleTab === 'coordinator'
              ? `Displaying all ${coordinatorEntries.length} weekly scheduled periods across all department faculty for Section ${coordinatedSection?.name}`
              : <>Faculty: <span className="text-slate-900 font-bold">{currentFaculty?.full_name}</span> ({currentFaculty?.faculty_code || 'Faculty'}) • {dept?.name || 'Academic Department'}</>
            }
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-600">
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-semibold">
              {activeScheduleTab === 'coordinator' ? `Section ${coordinatedSection?.name} (${coordinatedSection?.room_number || 'Classroom'})` : sectionNames}
            </span>
            <span>•</span>
            <span>{dept?.name || 'Engineering'}</span>
            <span>•</span>
            <span>Subjects: <strong className="text-slate-900">{activeScheduleTab === 'coordinator' ? 'All Section Courses' : (subjectCodes || 'All Assigned')}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
          <div className="text-xs font-semibold bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Academic Session 2026–2027</span>
          </div>
        </div>
      </div>

      {/* Stats KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            {activeScheduleTab === 'coordinator' ? 'Section Weekly Classes' : 'Weekly Teaching Load'}
          </span>
          <span className="text-xl font-black text-slate-900 font-serif-institutional block mt-0.5">{currentActiveEntries.length} Periods</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            {activeScheduleTab === 'coordinator' ? 'Classroom Venue' : 'Assigned Subjects'}
          </span>
          <span className="text-xl font-black text-slate-900 font-serif-institutional block mt-0.5">
            {activeScheduleTab === 'coordinator' ? (coordinatedSection?.room_number || 'Classroom') : `${taughtSubjects.length} Courses`}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            {activeScheduleTab === 'coordinator' ? 'Academic Department' : 'Sections Covered'}
          </span>
          <span className="text-xl font-black text-slate-900 font-serif-institutional block mt-0.5 truncate">
            {activeScheduleTab === 'coordinator' ? (dept?.name || 'Department') : `${taughtSections.length} Sections`}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">Timetable Status</span>
          {currentActiveEntries.length > 0 ? (
            <span className="text-xs font-semibold text-emerald-700 block mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Published & Active
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-500 block mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              No Timetable Published
            </span>
          )}
        </div>
      </div>

      {/* Reusable High-Contrast Responsive Timetable Grid */}
      <AcademicTimetableGrid
        entries={currentActiveEntries}
        isLoading={isLoading}
        isFacultyView={true}
        currentFacultyId={facultyId}
        onTakeAttendance={onTakeAttendance}
        emptyTitle={
          activeScheduleTab === 'coordinator'
            ? `No published timetable for Section ${coordinatedSection?.name}`
            : 'No lectures assigned in published timetable'
        }
        emptySubtitle={
          activeScheduleTab === 'coordinator'
            ? `No weekly schedule has been published yet for Section ${coordinatedSection?.name}.`
            : 'When the department HOD publishes your timetable schedule, your teaching periods, classrooms, and weekly grid will appear here automatically.'
        }
        activeSectionName={coordinatedSection?.name}
        activeRoomNumber={coordinatedSection?.room_number}
      />
    </div>
  );
};

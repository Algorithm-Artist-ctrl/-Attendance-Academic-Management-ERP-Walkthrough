import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  BookOpen, 
  CheckSquare, 
  GraduationCap, 
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { getISTDayOfWeek } from '../../lib/utils/dateUtils';
import { DEFAULT_INSTITUTIONAL_PERIODS } from '../../config/academicConfig';
import { clsx } from 'clsx';

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
    getPublishedTimetable
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

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
  const dayLabels = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
  };

  const timeSlots = DEFAULT_INSTITUTIONAL_PERIODS.map(p => ({
    period: p.period_number,
    label: p.is_break ? p.name : `Period ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][p.period_number - 1] || p.period_number}`,
    time: `${p.start_time} – ${p.end_time}`,
    isLunch: !!p.is_break,
  }));

  const todayDay = getISTDayOfWeek();
  const defaultDay = (days.includes(todayDay as any) ? todayDay : 'MON') as typeof days[number];
  const [selectedMobileDay, setSelectedMobileDay] = useState<typeof days[number]>(defaultDay);

  return (
    <div className="space-y-6">
      {/* View Switcher Tabs (If Faculty is also a Class Coordinator) */}
      {coordinatedSection && (
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 max-w-fit">
          <button
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
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            {activeScheduleTab === 'coordinator' ? 'Section Weekly Classes' : 'Weekly Teaching Load'}
          </span>
          <span className="text-xl font-black text-slate-900 font-serif-institutional block mt-0.5">{currentActiveEntries.length} Periods</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            {activeScheduleTab === 'coordinator' ? 'Classroom Venue' : 'Assigned Subjects'}
          </span>
          <span className="text-xl font-black text-slate-900 font-serif-institutional block mt-0.5">
            {activeScheduleTab === 'coordinator' ? (coordinatedSection?.room_number || 'Classroom') : `${taughtSubjects.length} Courses`}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs text-slate-500 block font-medium">
            {activeScheduleTab === 'coordinator' ? 'Academic Department' : 'Sections Covered'}
          </span>
          <span className="text-xl font-black text-slate-900 font-serif-institutional block mt-0.5 truncate">
            {activeScheduleTab === 'coordinator' ? (dept?.name || 'Department') : `${taughtSections.length} Sections`}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
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

      {/* EMPTY STATE BANNER WHEN NO TIMETABLE IS PUBLISHED */}
      {currentActiveEntries.length === 0 && (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            No published timetable is available for your teaching assignments
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {activeScheduleTab === 'coordinator' 
              ? `No weekly schedule has been published yet for Section ${coordinatedSection?.name}.`
              : 'When the department HOD publishes your timetable schedule, your teaching periods, classrooms, and weekly grid will appear here automatically.'}
          </p>
        </div>
      )}

      {/* MOBILE VIEW: Day Selector Tab Bar & Vertical Period Cards */}
      <div className="block lg:hidden space-y-4">
        {/* Day Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto no-scrollbar">
          {days.map(d => (
            <button
              key={d}
              onClick={() => setSelectedMobileDay(d)}
              className={clsx(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center cursor-pointer touch-target',
                selectedMobileDay === d
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              )}
            >
              {d} • {dayLabels[d]}
            </button>
          ))}
        </div>

        {/* Schedule Cards for Selected Day */}
        <div className="space-y-3">
          {timeSlots.map(slot => {
            if (slot.isLunch) {
              return (
                <div 
                  key={slot.period}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-slate-600 font-semibold">{slot.time}</span>
                  <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold tracking-wider">
                    LUNCH BREAK
                  </span>
                </div>
              );
            }

            const entry = currentActiveEntries.find(
              e => e.day_of_week === selectedMobileDay && e.period_number === slot.period
            );

            if (!entry) {
              return (
                <div 
                  key={slot.period}
                  className="p-3.5 rounded-2xl bg-slate-50/50 border border-slate-200/60 flex items-center justify-between text-xs text-slate-400"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-600">{slot.label}</span>
                    <span>({slot.time})</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">No Lecture Assigned</span>
                </div>
              );
            }

            const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
            const sec = sections.find(s => s.id === entry.section_id) || entry.section;
            const teacher = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;
            const isMyLecture = entry.faculty_id === facultyId;

            return (
              <div 
                key={slot.period}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3 hover:border-slate-300 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {slot.label}
                    </span>
                    <span className="text-xs font-mono text-slate-600 font-semibold">{slot.time}</span>
                  </div>
                  {(() => {
                    const sem = semesters.find(s => s.id === sec?.semester_id);
                    const yr = years.find(y => y.id === sem?.academic_year_id);
                    return (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                        {yr?.name ? `${yr.name} • ` : ''}Section {sec?.name}
                      </span>
                    );
                  })()}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">{sub?.subject_name}</h4>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">{sub?.subject_code} • {entry.lecture_type || 'Theory'}</p>
                  {activeScheduleTab === 'coordinator' && teacher && (
                    <p className="text-[11px] text-slate-600 font-medium mt-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-500" />
                      <span>Faculty: <strong className="text-slate-900">{teacher.full_name}</strong> ({teacher.faculty_code || 'FAC'})</span>
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-semibold text-slate-900">{entry.room_number || sec?.room_number || 'Room TBD'}</span>
                  </div>

                  {onTakeAttendance && isMyLecture && (
                    <button
                      onClick={() => onTakeAttendance(entry.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#0f172a] text-white text-xs font-bold hover:bg-black flex items-center gap-1.5 cursor-pointer touch-target shadow-xs"
                      title="Take Attendance for this lecture"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Take Attendance</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DESKTOP/TABLET VIEW: Grid Timetable Table */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-700 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4 text-left w-32 border-r border-slate-200">Day / Period</th>
                {timeSlots.map(slot => (
                  <th key={slot.period} className="p-3 min-w-[160px] border-r border-slate-200 last:border-r-0">
                    <span className="block text-slate-900 font-mono text-xs font-bold">{slot.time}</span>
                    <span className="text-[10px] text-slate-600 font-semibold">
                      {slot.isLunch ? 'LUNCH RECESS' : slot.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {days.map(day => (
                <tr key={day} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 text-left font-bold text-slate-900 bg-slate-50/40 border-r border-slate-200">
                    <span className="text-sm text-slate-900">{dayLabels[day]}</span>
                  </td>
                  {timeSlots.map(slot => {
                    if (slot.isLunch) {
                      return (
                        <td key={slot.period} className="p-3 bg-slate-50 text-slate-400 font-semibold border-r border-slate-200 text-[11px]">
                          LUNCH BREAK
                        </td>
                      );
                    }

                    // Find timetable entry for this day, and period
                    const entry = currentActiveEntries.find(
                      e => e.day_of_week === day && e.period_number === slot.period
                    );

                    if (!entry) {
                      return (
                        <td key={slot.period} className="p-3 text-slate-400 border-r border-slate-200">
                          <span className="text-[11px] font-mono text-slate-300">—</span>
                        </td>
                      );
                    }

                    const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
                    const sec = sections.find(s => s.id === entry.section_id) || entry.section;
                    const teacher = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;
                    const isMyLecture = entry.faculty_id === facultyId;

                    return (
                      <td key={slot.period} className="p-2.5 border-r border-slate-200 last:border-r-0 text-left">
                        <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                {sub?.subject_code}
                              </span>
                              {(() => {
                                const sem = semesters.find(s => s.id === sec?.semester_id);
                                const yr = years.find(y => y.id === sem?.academic_year_id);
                                return (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    {yr?.name ? `${yr.name} ` : ''}Sec {sec?.name}
                                  </span>
                                );
                              })()}
                            </div>

                            <p className="font-bold text-slate-900 text-xs leading-snug tracking-tight line-clamp-2" title={sub?.subject_name}>
                              {sub?.subject_name}
                            </p>

                            {activeScheduleTab === 'coordinator' && teacher && (
                              <p className="text-[10px] text-slate-600 font-medium mt-1 truncate">
                                Teacher: <span className="text-slate-900 font-semibold">{teacher.faculty_code || teacher.full_name.substring(0, 12)}</span>
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {entry.room_number || sec?.room_number || 'Room TBD'}
                            </span>

                            {onTakeAttendance && isMyLecture && (
                              <button
                                onClick={() => onTakeAttendance(entry.id)}
                                className="text-[10px] font-bold text-slate-900 hover:text-black hover:underline flex items-center gap-0.5 cursor-pointer"
                                title="Mark Attendance for this lecture"
                              >
                                <span>Mark</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

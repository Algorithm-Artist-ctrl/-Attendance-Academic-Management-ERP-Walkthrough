import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  BookOpen, 
  CheckSquare, 
  Layers, 
  GraduationCap, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { getISTDayOfWeek } from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';

interface FacultyTimetablePageProps {
  onTakeAttendance?: (timetableEntryId: string) => void;
}

export const FacultyTimetablePage: React.FC<FacultyTimetablePageProps> = ({ onTakeAttendance }) => {
  const { user } = useAuth();
  const { 
    timetable, 
    subjects, 
    sections, 
    departments, 
    programs, 
    years, 
    faculty 
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
  const facultyEntries = timetable.filter(t => t.faculty_id === facultyId && t.active);
  const coordinatorEntries = coordinatedSection 
    ? timetable.filter(t => t.section_id === coordinatedSection.id && t.active)
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

  const sectionNames = taughtSections.map(s => `Section ${s.name}`).join(' & ') || 'Assigned Sections';
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

  const timeSlots = [
    { period: 1, label: 'Period I', time: '09:00 – 09:50' },
    { period: 2, label: 'Period II', time: '09:50 – 10:40' },
    { period: 3, label: 'Period III', time: '10:40 – 11:30' },
    { period: 4, label: 'Period IV', time: '11:30 – 12:20' },
    { period: 5, label: 'Lunch Break', time: '12:20 – 01:10', isLunch: true },
    { period: 6, label: 'Period VI', time: '01:10 – 02:00' },
    { period: 7, label: 'Period VII', time: '02:00 – 02:50' },
    { period: 8, label: 'Period VIII', time: '02:50 – 03:40' },
  ];

  const todayDay = getISTDayOfWeek();
  const defaultDay = (days.includes(todayDay as any) ? todayDay : 'MON') as typeof days[number];
  const [selectedMobileDay, setSelectedMobileDay] = useState<typeof days[number]>(defaultDay);

  return (
    <div className="space-y-6">
      {/* View Switcher Tabs (If Faculty is also a Class Coordinator) */}
      {coordinatedSection && (
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-emerald-500/25 max-w-fit">
          <button
            onClick={() => setActiveScheduleTab('my_teaching')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeScheduleTab === 'my_teaching'
                ? 'bg-gradient-to-r from-emerald-500 to-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>My Teaching Schedule ({facultyEntries.length} Lectures)</span>
          </button>

          <button
            onClick={() => setActiveScheduleTab('coordinator')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeScheduleTab === 'coordinator'
                ? 'bg-gradient-to-r from-emerald-500 to-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Section {coordinatedSection.name} Master Schedule (Class Coordinator)</span>
          </button>
        </div>
      )}

      {/* Top Header with Dynamic Multi-Section Faculty Teaching Context */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-900 border border-emerald-500/30 text-emerald-400">
              {activeScheduleTab === 'coordinator' ? `CLASS COORDINATOR VIEW — SECTION ${coordinatedSection?.name}` : 'TEACHING PORTFOLIO VIEW'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-[#00ff88]" />
            {activeScheduleTab === 'coordinator' 
              ? `Complete Timetable — Section ${coordinatedSection?.name} (${coordinatedSection?.room_number || 'A007'})`
              : 'Official Faculty Teaching Schedule'
            }
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            {activeScheduleTab === 'coordinator'
              ? `Displaying all 42 weekly scheduled periods across all department faculty for Section ${coordinatedSection?.name}`
              : <>Faculty: <span className="text-[#00ff88] font-bold">{currentFaculty?.full_name}</span> ({currentFaculty?.faculty_code || 'Faculty'}) • {dept?.name || 'Academic Department'}</>
            }
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-950 border border-emerald-500/25 text-[#00ff88] font-bold">
              {activeScheduleTab === 'coordinator' ? `Section ${coordinatedSection?.name} (${coordinatedSection?.room_number})` : sectionNames}
            </span>
            <span>•</span>
            <span>B.Tech 2nd Year (CSE / CSE+IT)</span>
            <span>•</span>
            <span>Subjects: <strong className="text-slate-200">{activeScheduleTab === 'coordinator' ? 'All Section Courses' : (subjectCodes || 'All Assigned')}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
          <div className="text-xs font-semibold bg-slate-950/80 px-4 py-2 rounded-xl border border-emerald-500/20 text-[#00ff88] flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Odd Semester 2026–2027</span>
          </div>
        </div>
      </div>

      {/* Stats KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-emerald-500/15">
          <span className="text-[10px] text-slate-400 block font-semibold">
            {activeScheduleTab === 'coordinator' ? 'Section Weekly Classes' : 'Weekly Teaching Load'}
          </span>
          <span className="text-xl font-black text-[#00ff88] block mt-0.5">{currentActiveEntries.length} Periods</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-emerald-500/15">
          <span className="text-[10px] text-slate-400 block font-semibold">
            {activeScheduleTab === 'coordinator' ? 'Classroom Venue' : 'Assigned Subjects'}
          </span>
          <span className="text-xl font-black text-white block mt-0.5">
            {activeScheduleTab === 'coordinator' ? (coordinatedSection?.room_number || 'A007') : `${taughtSubjects.length} Courses`}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-emerald-500/15">
          <span className="text-[10px] text-slate-400 block font-semibold">
            {activeScheduleTab === 'coordinator' ? 'Academic Program' : 'Sections Covered'}
          </span>
          <span className="text-xl font-black text-white block mt-0.5 truncate">
            {activeScheduleTab === 'coordinator' ? 'B.Tech CSE' : `${taughtSections.length} Sections`}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-emerald-500/15">
          <span className="text-[10px] text-slate-400 block font-semibold">Timetable Status</span>
          <span className="text-xs font-bold text-emerald-400 block mt-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            Published & Active
          </span>
        </div>
      </div>

      {/* MOBILE VIEW: Day Selector Tab Bar & Vertical Period Cards */}
      <div className="block lg:hidden space-y-4">
        {/* Day Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-emerald-500/20 overflow-x-auto no-scrollbar">
          {days.map(d => (
            <button
              key={d}
              onClick={() => setSelectedMobileDay(d)}
              className={clsx(
                'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center cursor-pointer touch-target',
                selectedMobileDay === d
                  ? 'bg-[#00ff88] text-slate-950 font-black shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
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
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/10 text-center flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-slate-500 font-bold">{slot.time}</span>
                  <span className="px-3 py-1 rounded-full bg-slate-900 text-[#00ff88] text-[11px] font-black tracking-wider">
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
                  className="p-3.5 rounded-2xl bg-slate-950/40 border border-emerald-500/10 flex items-center justify-between text-xs text-slate-500"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-400">{slot.label}</span>
                    <span>({slot.time})</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-600">No Lecture Assigned</span>
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
                className="glass-card rounded-2xl p-4 border border-emerald-500/25 space-y-3 hover:border-emerald-500/40 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-black bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30">
                      {slot.label}
                    </span>
                    <span className="text-xs font-mono text-slate-300 font-bold">{slot.time}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                    Section {sec?.name}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">{sub?.subject_name}</h4>
                  <p className="text-xs text-emerald-400 font-mono mt-0.5">{sub?.subject_code} • {entry.lecture_type || 'Theory'}</p>
                  {activeScheduleTab === 'coordinator' && teacher && (
                    <p className="text-[11px] text-slate-300 font-medium mt-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-[#00ff88]" />
                      <span>Faculty: <strong className="text-white">{teacher.full_name}</strong> ({teacher.faculty_code || 'FAC'})</span>
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-emerald-500/10 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-[#00ff88]">{entry.room_number || sec?.room_number || 'Room TBD'}</span>
                  </div>

                  {onTakeAttendance && isMyLecture && (
                    <button
                      onClick={() => onTakeAttendance(entry.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-[#00ff88] border border-emerald-500/40 text-xs font-bold hover:bg-emerald-500/30 flex items-center gap-1 cursor-pointer touch-target"
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
      <div className="hidden lg:block glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-950/90 text-slate-300 border-b border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 text-left w-32 border-r border-emerald-500/10">Day / Period</th>
                {timeSlots.map(slot => (
                  <th key={slot.period} className="p-3 min-w-[160px] border-r border-emerald-500/10 last:border-r-0">
                    <span className="block text-white font-mono text-xs">{slot.time}</span>
                    <span className="text-[10px] text-[#00ff88] font-semibold">
                      {slot.isLunch ? 'LUNCH RECESS' : slot.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10 text-xs">
              {days.map(day => (
                <tr key={day} className="hover:bg-emerald-500/5 transition-colors">
                  <td className="p-4 text-left font-black text-white bg-slate-950/50 border-r border-emerald-500/10">
                    <span className="text-sm text-[#00ff88]">{dayLabels[day]}</span>
                  </td>
                  {timeSlots.map(slot => {
                    if (slot.isLunch) {
                      return (
                        <td key={slot.period} className="p-3 bg-slate-950/80 text-slate-500 font-bold border-r border-emerald-500/10 text-[11px]">
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
                        <td key={slot.period} className="p-3 text-slate-600 border-r border-emerald-500/10">
                          <span className="text-[11px] font-mono text-slate-600">—</span>
                        </td>
                      );
                    }

                    const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
                    const sec = sections.find(s => s.id === entry.section_id) || entry.section;
                    const teacher = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;
                    const isMyLecture = entry.faculty_id === facultyId;

                    return (
                      <td key={slot.period} className="p-2.5 border-r border-emerald-500/10 last:border-r-0 text-left">
                        <div className="p-2.5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 hover:border-[#00ff88] transition-all group flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-[#00ff88] border border-emerald-500/25">
                                {sub?.subject_code}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-slate-300 border border-emerald-500/15">
                                Sec {sec?.name}
                              </span>
                            </div>

                            <p className="font-bold text-white text-xs leading-snug tracking-tight line-clamp-2" title={sub?.subject_name}>
                              {sub?.subject_name}
                            </p>

                            {activeScheduleTab === 'coordinator' && teacher && (
                              <p className="text-[10px] text-slate-300 font-medium mt-1 truncate">
                                Teacher: <span className="text-[#00ff88] font-bold">{teacher.faculty_code || teacher.full_name.substring(0, 12)}</span>
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1 font-semibold text-slate-300">
                              <MapPin className="w-3 h-3 text-[#00ff88]" />
                              {entry.room_number || sec?.room_number || 'Room TBD'}
                            </span>

                            {onTakeAttendance && isMyLecture && (
                              <button
                                onClick={() => onTakeAttendance(entry.id)}
                                className="text-[10px] font-bold text-[#00ff88] hover:underline flex items-center gap-0.5 cursor-pointer"
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

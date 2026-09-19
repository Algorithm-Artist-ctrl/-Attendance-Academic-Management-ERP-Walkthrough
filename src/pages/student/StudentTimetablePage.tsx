import React, { useState } from 'react';
import { Calendar, Clock, MapPin, User, BookOpen, Sparkles, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { getISTDayOfWeek } from '../../lib/utils/dateUtils';
import { DayOfWeek } from '../../types/database.types';
import { DEFAULT_INSTITUTIONAL_PERIODS } from '../../config/academicConfig';
import { clsx } from 'clsx';

export const StudentTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const { 
    getStudentTimetable, 
    subjects, 
    faculty, 
    sections, 
    programs, 
    departments,
    years, 
    semesters, 
    sessions,
    students 
  } = useAcademic();

  // Authoritative student identity resolved from database
  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const currentSection = sections.find(s => s.id === currentStudent?.section_id);

  const program = programs.find(p => p.id === currentStudent?.program_id);
  const dept = departments.find(d => d.id === currentStudent?.department_id);
  const year = years.find(y => y.id === currentStudent?.academic_year_id);
  const sem = semesters.find(s => s.id === currentStudent?.semester_id);
  const session = sessions.find(s => s.id === currentStudent?.academic_session_id) || sessions[0];

  // Shared single source of truth for the student's active published timetable
  const sectionEntries = getStudentTimetable(currentStudent?.id || '');

  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayLabels: Record<DayOfWeek, string> = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
    SUN: 'Sunday',
  };

  const todayDay = getISTDayOfWeek();
  const defaultDay = (days.includes(todayDay as any) ? todayDay : 'MON') as DayOfWeek;
  const [selectedMobileDay, setSelectedMobileDay] = useState<DayOfWeek>(defaultDay);

  const timeSlots = DEFAULT_INSTITUTIONAL_PERIODS.map(p => ({
    period: p.period_number,
    label: p.is_break ? p.name : `Period ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][p.period_number - 1] || p.period_number}`,
    time: `${p.start_time} – ${p.end_time}`,
    isLunch: !!p.is_break,
  }));

  const branchName = dept?.name || program?.name || 'Computer Science & Engineering';
  const classIncharge = faculty.find(f => f.id === currentSection?.class_coordinator_id)?.full_name || 
                        currentSection?.class_coordinator?.full_name || 
                        'Class Coordinator';
  const displayRoom = currentSection?.room_number || 'Assigned Classroom';

  return (
    <div className="space-y-6">
      {/* Top Header with Strict Section Authority & Academic Scope */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          <Clock className="w-4 h-4" />
          <span>{session?.name || 'Academic Session 2026–2027'}</span>
        </div>
      </div>

      {sectionEntries.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-500 border border-slate-200/80 space-y-3 shadow-xs">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-1" />
          <h3 className="text-base font-bold text-slate-900 font-serif-institutional">No published timetable is available for your class.</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The official academic timetable for Section {currentSection?.name || 'Assigned'} has not been published yet. Please check back later or contact your Class Coordinator ({classIncharge}).
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW: Day Selector Tab Bar & Vertical Period Cards */}
          <div className="block lg:hidden space-y-4">
            {/* Day Selector Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-x-auto no-scrollbar">
              {days.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedMobileDay(d)}
                  className={clsx(
                    'px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center cursor-pointer touch-target',
                    selectedMobileDay === d ? 'bg-[#0f172a] text-white font-black shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                      className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-center flex items-center justify-between text-xs"
                    >
                      <span className="font-mono text-slate-500 font-bold">{slot.time}</span>
                      <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold tracking-wider">
                        LUNCH RECESS
                      </span>
                    </div>
                  );
                }

                const entry = sectionEntries.find(
                  e => e.day_of_week === selectedMobileDay && e.period_number === slot.period
                );

                const sub = entry ? (subjects.find(s => s.id === entry.subject_id) || entry.subject) : null;
                const fac = entry ? (faculty.find(f => f.id === entry.faculty_id) || entry.faculty) : null;

                if (!entry) {
                  return (
                    <div 
                      key={slot.period}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs text-slate-500"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">{slot.label}</span>
                        <span>({slot.time})</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-600">Free Period</span>
                    </div>
                  );
                }

                return (
                  <div 
                    key={slot.period}
                    className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-2.5 hover:border-slate-300 transition-all shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-black bg-slate-100 text-slate-800 border border-slate-200">
                          {slot.label}
                        </span>
                        <span className="text-xs font-mono text-slate-600 font-bold">{slot.time}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-700">
                        {entry.lecture_type || 'Theory'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          {sub?.subject_code}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 tracking-tight">{sub?.subject_name}</h4>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                        <User className={clsx("w-3.5 h-3.5 shrink-0", fac?.full_name ? "text-slate-500" : "text-slate-500")} />
                        <span className={clsx("truncate", !fac?.full_name && "text-slate-500 italic")}>
                          {fac?.full_name || 'Unassigned Faculty'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-bold text-slate-900">{entry.room_number || currentSection?.room_number || 'Room'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DESKTOP/TABLET VIEW: Full Master Grid Timetable Table */}
          <div className="hidden lg:block bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                    <th className="p-4 text-left w-32 border-r border-slate-200">Day / Period</th>
                    {timeSlots.map(slot => (
                      <th key={slot.period} className="p-3 min-w-[140px] border-r border-slate-200 last:border-r-0">
                        <span className="block text-slate-900 font-mono text-xs">{slot.time}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {slot.isLunch ? 'LUNCH RECESS' : slot.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {days.map(day => (
                    <tr key={day} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 text-left font-black text-slate-900 bg-slate-50/60 border-r border-slate-200">
                        <span className="text-sm text-slate-900 font-serif-institutional">{dayLabels[day]}</span>
                      </td>
                      {timeSlots.map(slot => {
                        if (slot.isLunch) {
                          return (
                            <td key={slot.period} className="p-3 bg-slate-100/60 text-slate-500 font-bold border-r border-slate-200 text-[11px]">
                              LUNCH
                            </td>
                          );
                        }

                        const entry = sectionEntries.find(e => e.day_of_week === day && e.period_number === slot.period);
                        if (!entry) {
                          return (
                            <td key={slot.period} className="p-3 text-slate-600 border-r border-slate-200">
                              —
                            </td>
                          );
                        }

                        const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
                        const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;

                        return (
                          <td key={slot.period} className="p-2 border-r border-slate-200">
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-400 hover:bg-white transition-all text-left space-y-1 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-900 font-mono font-black">
                                  {sub?.subject_code}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  {entry.room_number || currentSection?.room_number || 'Room'}
                                </span>
                              </div>
                              <span className="font-bold text-slate-900 block text-xs truncate" title={sub?.subject_name}>
                                {sub?.subject_name || 'Subject'}
                              </span>
                              <span className={clsx("text-[11px] font-medium block truncate", fac?.full_name ? "text-slate-300" : "text-slate-500 italic")} title={fac?.full_name}>
                                {fac?.full_name || 'Unassigned Faculty'}
                              </span>
                              <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-slate-200">
                                <span className="text-slate-400">{entry.lecture_type || 'Theory'}</span>
                                <span className="text-slate-500 font-mono">{slot.time}</span>
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
        </>
      )}
    </div>
  );
};

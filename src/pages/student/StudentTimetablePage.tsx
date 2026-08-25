import React, { useState } from 'react';
import { Calendar, Clock, MapPin, User, BookOpen, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { getISTDayOfWeek } from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';

export const StudentTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const { timetable, subjects, faculty, sections, programs, years, students } = useAcademic();

  // Authoritative student record and section from database
  const currentStudent = students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number) || user?.student;
  const currentSection = sections.find(s => s.id === currentStudent?.section_id) || 
                         sections.find(s => s.name === currentStudent?.section?.name);

  const program = programs.find(p => p.id === currentStudent?.program_id);
  const year = years.find(y => y.id === currentStudent?.academic_year_id);

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
  const dayLabels = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
  };

  const todayDay = getISTDayOfWeek();
  const defaultDay = (days.includes(todayDay as any) ? todayDay : 'MON') as typeof days[number];
  const [selectedMobileDay, setSelectedMobileDay] = useState<typeof days[number]>(defaultDay);

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

  const sectionEntries = currentSection 
    ? timetable.filter(t => (t.section_id === currentSection.id || t.section?.id === currentSection.id) && t.active) 
    : [];

  const isSectionB = currentSection?.name === 'B';
  const branchName = currentSection ? (isSectionB ? 'CSE + IT' : 'CSE') : 'Curriculum';
  const classIncharge = currentSection?.class_coordinator?.full_name || 'Academic Incharge';

  return (
    <div className="space-y-6">
      {/* Top Header with Strict Section Authority */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-[#00ff88]" />
            Official Academic Timetable
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            {program?.name || 'Academic Program'}{year?.name ? ` • ${year.name}` : ''} • Section <span className="text-[#00ff88] font-bold">{currentSection?.name || 'Assigned'}</span> • {currentSection?.room_number || 'Room TBD'} • Class Coordinator: <span className="text-white font-semibold">{classIncharge}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold bg-slate-950/80 px-4 py-2 rounded-xl border border-emerald-500/20 text-[#00ff88] shrink-0 self-start sm:self-auto">
          <Clock className="w-4 h-4" />
          <span>Odd Semester 2026–2027</span>
        </div>
      </div>

      {sectionEntries.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20 space-y-3">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-1" />
          <h3 className="text-base font-bold text-white">No timetable published for your section.</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The official academic timetable for Section {currentSection?.name || 'Assigned'} has not been published yet. Please check back later or contact your Class Coordinator.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW: Day Selector Tab Bar & Vertical Period Cards */}
          <div className="block lg:hidden space-y-4">
            {/* Day Selector Pills */}
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
                  className="p-3.5 rounded-2xl bg-slate-950/40 border border-emerald-500/10 flex items-center justify-between text-xs text-slate-500"
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
                className="glass-card rounded-2xl p-4 border border-emerald-500/25 space-y-2 hover:border-emerald-500/40 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-black bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30">
                      {slot.label}
                    </span>
                    <span className="text-xs font-mono text-slate-300 font-bold">{slot.time}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-emerald-500/20 text-slate-300">
                    {entry.lecture_type || 'Theory'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">{sub?.subject_name}</h4>
                  <p className="text-xs text-emerald-400 font-mono mt-0.5">{sub?.subject_code}</p>
                </div>

                <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                    <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{fac?.full_name || 'Faculty'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-[#00ff88]">{entry.room_number || currentSection?.room_number}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DESKTOP/TABLET VIEW: Full Master Grid Timetable Table */}
      <div className="hidden lg:block glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-950/90 text-slate-300 border-b border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 text-left w-32 border-r border-emerald-500/10">Day / Period</th>
                {timeSlots.map(slot => (
                  <th key={slot.period} className="p-3 min-w-[140px] border-r border-emerald-500/10 last:border-r-0">
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
                          LUNCH
                        </td>
                      );
                    }

                    const entry = sectionEntries.find(e => e.day_of_week === day && e.period_number === slot.period);
                    if (!entry) {
                      return (
                        <td key={slot.period} className="p-3 text-slate-600 border-r border-emerald-500/10">
                          —
                        </td>
                      );
                    }

                    const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
                    const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;

                    return (
                      <td key={slot.period} className="p-2 border-r border-emerald-500/10">
                        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left space-y-1">
                          <span className="font-bold text-white block text-xs truncate" title={sub?.subject_name}>
                            {sub?.subject_name || 'Subject'}
                          </span>
                          <span className="text-[11px] text-emerald-400 font-medium block truncate" title={fac?.full_name}>
                            {fac?.full_name || 'Faculty Member'}
                          </span>
                          <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-emerald-500/10">
                            <span className="text-slate-300 font-semibold">{entry.room_number || currentSection?.room_number}</span>
                            <span className="text-slate-500 font-medium">{entry.lecture_type || 'Theory'}</span>
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

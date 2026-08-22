import React from 'react';
import { Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';

export const StudentTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const { timetable, subjects, faculty, sections, programs, years } = useAcademic();

  const student = user?.student;
  const currentSection = sections.find(s => s.id === student?.section_id) || sections[0];
  const program = programs.find(p => p.id === student?.program_id);
  const year = years.find(y => y.id === student?.academic_year_id);

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

  const sectionEntries = timetable.filter(t => t.section_id === currentSection?.id);

  const isSectionB = currentSection?.name === 'B';
  const branchName = isSectionB ? 'CSE + IT' : 'CSE';
  const classIncharge = isSectionB ? 'Mr. Imran Raza Khan' : 'Ms. Hemlata Chaudhary';

  return (
    <div className="space-y-6">
      {/* Top Header with Strict Section Authority */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-[#00ff88]" />
            Official Academic Timetable
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            B.Tech <span className="text-[#00ff88] font-bold">{branchName}</span> 2nd Year • Section <span className="text-[#00ff88] font-bold">{currentSection?.name || 'A'}</span> • {currentSection?.room_number || 'Room No. A 007'} • Class Incharge: <span className="text-white font-semibold">{classIncharge}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold bg-slate-950/80 px-4 py-2 rounded-xl border border-emerald-500/20 text-[#00ff88]">
          <Clock className="w-4 h-4" />
          <span>Odd Semester 2026–2027</span>
        </div>
      </div>

      {/* Grid Timetable Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
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
    </div>
  );
};

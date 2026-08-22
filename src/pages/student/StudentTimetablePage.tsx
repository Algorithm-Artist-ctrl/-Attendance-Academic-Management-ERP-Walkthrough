import React from 'react';
import { Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';

export const StudentTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const { timetable, subjects, faculty, sections } = useAcademic();

  const student = user?.student;
  const sectionId = student?.section_id || 'sec-cse-2a-01';
  const currentSection = sections.find(s => s.id === sectionId);

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
    { period: 1, time: '09:00 - 09:50' },
    { period: 2, time: '09:50 - 10:40' },
    { period: 3, time: '10:40 - 11:30' },
    { period: 4, time: '11:30 - 12:20' },
    { period: 5, time: '12:20 - 13:10', isLunch: true },
    { period: 6, time: '13:10 - 14:00' },
    { period: 7, time: '14:00 - 14:50' },
    { period: 8, time: '14:50 - 15:40' },
  ];

  const sectionEntries = timetable.filter(t => t.section_id === sectionId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-[#00ff88]" />
            Official Academic Timetable
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            B.Tech CSE 2nd Year • Section {currentSection?.name || 'A'} • Room {currentSection?.room_number || 'A-007'}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold bg-slate-950/80 px-4 py-2 rounded-xl border border-emerald-500/20 text-[#00ff88]">
          <Clock className="w-4 h-4" />
          <span>Odd Semester 2026-2027</span>
        </div>
      </div>

      {/* Grid Timetable Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-950/90 text-slate-300 border-b border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 text-left w-32 border-r border-emerald-500/10">Day / Time</th>
                {timeSlots.map(slot => (
                  <th key={slot.period} className="p-3.5 min-w-[130px] border-r border-emerald-500/10 last:border-r-0">
                    <span className="block text-white font-mono">{slot.time}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      {slot.isLunch ? 'LUNCH BREAK' : `Period ${slot.period}`}
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
                        <td key={slot.period} className="p-3 bg-slate-950/80 text-slate-500 font-bold border-r border-emerald-500/10">
                          Recess
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

                    return (
                      <td key={slot.period} className="p-2.5 border-r border-emerald-500/10">
                        <div className="p-2 rounded-xl bg-slate-950/70 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left space-y-1">
                          <span className="font-bold text-white block text-xs truncate" title={entry.subject?.subject_name}>
                            {entry.subject?.subject_name || 'Subject'}
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate" title={entry.faculty?.full_name}>
                            {entry.faculty?.full_name || 'Faculty'}
                          </span>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-emerald-400 font-semibold">{entry.room_number || 'Room'}</span>
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

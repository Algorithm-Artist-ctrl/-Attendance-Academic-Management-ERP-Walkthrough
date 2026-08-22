import React from 'react';
import { Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { formatTime12H } from '../../lib/utils/dateUtils';
import { DayOfWeek } from '../../types/database.types';

export const StudentTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const { students, timetable } = useAcademic();

  const student = students.find(s => s.id === user?.student_id) || students[0];
  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const sectionTimetable = timetable.filter(
    t => t.section_id === student.section_id && t.active
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Weekly Timetable — Section {student.section?.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            B.Tech CSE 2nd Year • {student.section?.room_number} • Coordinator: {student.section?.class_coordinator?.full_name}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
          <Clock className="w-4 h-4" />
          <span>Periods: 9:00 AM to 3:40 PM</span>
        </div>
      </div>

      {/* Days Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {days.map((day) => {
          const dayLectures = sectionTimetable
            .filter(t => t.day_of_week === day)
            .sort((a, b) => a.period_number - b.period_number);

          return (
            <Card
              key={day}
              title={
                <div className="flex items-center justify-between">
                  <span className="font-bold text-vctm-navy-900">
                    {day === 'MON' && 'Monday'}
                    {day === 'TUE' && 'Tuesday'}
                    {day === 'WED' && 'Wednesday'}
                    {day === 'THU' && 'Thursday'}
                    {day === 'FRI' && 'Friday'}
                    {day === 'SAT' && 'Saturday'}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {dayLectures.length} Lectures
                  </span>
                </div>
              }
              noPadding
            >
              <div className="divide-y divide-slate-100">
                {dayLectures.map((lec) => (
                  <div key={lec.id} className="p-3.5 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-vctm-navy-800">
                          Period {lec.period_number}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900 mt-0.5">
                          {lec.subject?.subject_name}
                        </h4>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        {formatTime12H(lec.start_time)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{lec.faculty?.full_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3 h-3" />
                        <span>{lec.room_number}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Calendar, Clock, Plus, AlertTriangle, CheckCircle2, User, MapPin } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { DayOfWeek, LectureType } from '../../types/database.types';
import { formatTime12H } from '../../lib/utils/dateUtils';
import { TimetableConflict } from '../../types/academic.types';
import { clsx } from 'clsx';

export const TimetableManagerPage: React.FC = () => {
  const { 
    sections, 
    subjects, 
    faculty, 
    timetable, 
    addTimetableEntry, 
    checkTimetableConflict 
  } = useAcademic();

  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || 'sec-btech-cse-2-a');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Lecture Form state
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('MON');
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id || '');
  const [facultyId, setFacultyId] = useState<string>(faculty[0]?.id || '');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('09:50');
  const [roomNumber, setRoomNumber] = useState<string>('Room A-007');
  const [lectureType, setLectureType] = useState<LectureType>('Theory');
  const [detectedConflict, setDetectedConflict] = useState<TimetableConflict | null>(null);

  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayLabels = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
  };

  const periods = [1, 2, 3, 4, 6, 7, 8];

  const sectionTimetable = timetable.filter(t => t.section_id === selectedSectionId && t.active);
  const currentSection = sections.find(s => s.id === selectedSectionId);

  const handlePeriodChange = (period: number) => {
    setPeriodNumber(period);
    switch (period) {
      case 1: setStartTime('09:00'); setEndTime('09:50'); break;
      case 2: setStartTime('09:50'); setEndTime('10:40'); break;
      case 3: setStartTime('10:40'); setEndTime('11:30'); break;
      case 4: setStartTime('11:30'); setEndTime('12:20'); break;
      case 6: setStartTime('13:10'); setEndTime('14:00'); break;
      case 7: setStartTime('14:00'); setEndTime('14:50'); break;
      case 8: setStartTime('14:50'); setEndTime('15:40'); break;
    }
  };

  const handleValidateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setDetectedConflict(null);

    const newEntry = {
      section_id: selectedSectionId,
      subject_id: subjectId,
      faculty_id: facultyId,
      day_of_week: dayOfWeek,
      period_number: periodNumber,
      start_time: startTime,
      end_time: endTime,
      room_number: roomNumber,
      lecture_type: lectureType,
      active: true,
    };

    const conflict = checkTimetableConflict(newEntry);
    if (conflict) {
      setDetectedConflict(conflict);
      return;
    }

    addTimetableEntry(newEntry);
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-[#00ff88]" />
            Timetable Engine & Conflict Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage section schedules with automatic double-booking and room collision prevention
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#00ff88]"
          >
            {sections.map(s => (
              <option key={s.id} value={s.id}>Section {s.name} ({s.room_number || 'Room A-007'})</option>
            ))}
          </select>

          <Button
            variant="neon"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
          >
            Add Period Slot
          </Button>
        </div>
      </div>

      {/* Grid Timetable Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-950/90 text-slate-300 border-b border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                <th className="p-4 text-left w-32 border-r border-emerald-500/10">Day / Period</th>
                {periods.map(p => (
                  <th key={p} className="p-3.5 min-w-[130px] border-r border-emerald-500/10 last:border-r-0">
                    <span className="block text-white font-mono">Period {p}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      {p === 1 ? '09:00 - 09:50' : p === 2 ? '09:50 - 10:40' : p === 3 ? '10:40 - 11:30' : p === 4 ? '11:30 - 12:20' : p === 6 ? '13:10 - 14:00' : p === 7 ? '14:00 - 14:50' : '14:50 - 15:40'}
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
                  {periods.map(period => {
                    const entry = sectionTimetable.find(e => e.day_of_week === day && e.period_number === period);
                    if (!entry) {
                      return (
                        <td key={period} className="p-3 text-slate-600 border-r border-emerald-500/10">
                          —
                        </td>
                      );
                    }

                    return (
                      <td key={period} className="p-2.5 border-r border-emerald-500/10">
                        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-emerald-500/20 hover:border-[#00ff88] transition-all text-left space-y-1">
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

      {/* Add Slot Modal with Conflict Detection */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule Timetable Period"
        description={`Add a lecture slot to Section ${currentSection?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleValidateAndAdd} className="space-y-4">
          {detectedConflict && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 space-y-1 animate-in zoom-in-95">
              <div className="flex items-center gap-2 font-bold text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Schedule Conflict Detected!</span>
              </div>
              <p>{detectedConflict.message}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                <option value="MON">Monday</option>
                <option value="TUE">Tuesday</option>
                <option value="WED">Wednesday</option>
                <option value="THU">Thursday</option>
                <option value="FRI">Friday</option>
                <option value="SAT">Saturday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Period Number</label>
              <select
                value={periodNumber}
                onChange={(e) => handlePeriodChange(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                {periods.map(p => (
                  <option key={p} value={p}>Period {p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty Professor</label>
            <select
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code || f.designation})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Room Number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Lecture Format</label>
              <select
                value={lectureType}
                onChange={(e) => setLectureType(e.target.value as LectureType)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                <option value="Theory">Theory</option>
                <option value="Practical">Practical Lab</option>
                <option value="Workshop">Workshop</option>
                <option value="Project">Project</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="neon" size="sm">
              Validate & Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

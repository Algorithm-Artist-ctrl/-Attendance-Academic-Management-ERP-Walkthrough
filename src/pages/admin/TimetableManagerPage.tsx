import React, { useState } from 'react';
import { Calendar, Clock, Plus, AlertTriangle, CheckCircle2, User, MapPin } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { DayOfWeek, LectureType } from '../../types/database.types';
import { formatTime12H } from '../../lib/utils/dateUtils';
import { TimetableConflict } from '../../types/academic.types';

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
  const [roomNumber, setRoomNumber] = useState<string>('Room A 007');
  const [lectureType, setLectureType] = useState<LectureType>('Theory');
  const [detectedConflict, setDetectedConflict] = useState<TimetableConflict | null>(null);

  const days: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const periods = [1, 2, 3, 4, 6, 7, 8]; // Period 5 is lunch (12:20 - 1:10 PM)

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
      period_number: Number(periodNumber),
      start_time: startTime,
      end_time: endTime,
      room_number: roomNumber.trim(),
      lecture_type: lectureType,
      active: true,
    };

    // Run conflict detection engine
    const conflict = checkTimetableConflict(newEntry);
    if (conflict) {
      setDetectedConflict(conflict);
      return;
    }

    try {
      addTimetableEntry(newEntry);
      setIsAddModalOpen(false);
      setDetectedConflict(null);
    } catch (err: any) {
      alert(`Error saving timetable: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Academic Timetable Manager</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Database-driven schedule editor with automatic conflict detection for faculty, rooms, and sections
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Select Section:</span>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="text-xs font-bold border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 focus:ring-1 focus:ring-vctm-navy-500"
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  Section {s.name} ({s.room_number})
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            variant="navy"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setRoomNumber(currentSection?.room_number || 'Room A 007');
              setDetectedConflict(null);
              setIsAddModalOpen(true);
            }}
          >
            Add Lecture
          </Button>
        </div>
      </div>

      {/* Timetable Weekly Matrix Table */}
      <Card
        title={`Weekly Schedule — Section ${currentSection?.name} (${currentSection?.room_number})`}
        subtitle="Monday to Saturday • Periods 1 to 8 • Coordinator: Ms. Hemlata Chaudhary (Sec A) / Mr. Imran Raza Khan (Sec B)"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                <th className="p-3 border-r border-slate-200 w-24">Day</th>
                <th className="p-2.5 border-r border-slate-200">I (9:00-9:50)</th>
                <th className="p-2.5 border-r border-slate-200">II (9:50-10:40)</th>
                <th className="p-2.5 border-r border-slate-200">III (10:40-11:30)</th>
                <th className="p-2.5 border-r border-slate-200">IV (11:30-12:20)</th>
                <th className="p-2.5 border-r border-slate-200 bg-amber-50/70 text-amber-800 w-20">LUNCH (12:20-1:10)</th>
                <th className="p-2.5 border-r border-slate-200">VI (1:10-2:00)</th>
                <th className="p-2.5 border-r border-slate-200">VII (2:00-2:50)</th>
                <th className="p-2.5">VIII (2:50-3:40)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {days.map((day) => (
                <tr key={day} className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-vctm-navy-900 bg-slate-50/80 border-r border-slate-200 text-left">
                    {day}
                  </td>
                  {periods.map((pNum) => {
                    const lecture = sectionTimetable.find(t => t.day_of_week === day && t.period_number === pNum);
                    
                    return (
                      <React.Fragment key={pNum}>
                        {pNum === 6 && (
                          <td className="p-2 bg-amber-50/50 border-r border-slate-200 text-[10px] font-semibold text-amber-800">
                            Lunch
                          </td>
                        )}
                        <td className="p-2 border-r border-slate-200 min-w-[110px] align-top">
                          {lecture ? (
                            <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200/80 text-left space-y-0.5">
                              <span className="font-bold text-slate-900 block truncate">
                                {lecture.subject?.subject_name.split('(')[0]}
                              </span>
                              <span className="text-[10px] text-blue-700 font-semibold block">
                                {lecture.faculty?.full_name} ({lecture.faculty?.faculty_code})
                              </span>
                              <span className="text-[9px] text-slate-400 block">
                                {lecture.room_number}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">—</span>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Lecture with Real-Time Conflict Detection Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Schedule New Lecture"
        description="Assign a subject, faculty, and room with automatic overlap prevention"
        maxWidth="lg"
      >
        <form onSubmit={handleValidateAndAdd} className="space-y-4">
          {detectedConflict && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 space-y-1 animate-in shake">
              <div className="flex items-center gap-1.5 font-bold text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Timetable Conflict Detected!</span>
              </div>
              <p>{detectedConflict.message}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Day of Week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Period Slot
              </label>
              <select
                value={periodNumber}
                onChange={(e) => handlePeriodChange(Number(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500 font-semibold"
              >
                <option value={1}>Period 1 (09:00 – 09:50)</option>
                <option value={2}>Period 2 (09:50 – 10:40)</option>
                <option value={3}>Period 3 (10:40 – 11:30)</option>
                <option value={4}>Period 4 (11:30 – 12:20)</option>
                <option value={6}>Period 6 (01:10 – 02:00)</option>
                <option value={7}>Period 7 (02:00 – 02:50)</option>
                <option value={8}>Period 8 (02:50 – 03:40)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.subject_code} — {s.subject_name} ({s.lecture_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Faculty Member (Full Name)
            </label>
            <select
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              {faculty.map(f => (
                <option key={f.id} value={f.id}>
                  {f.full_name} ({f.faculty_code}) — {f.designation}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room / Lab Number
              </label>
              <input
                type="text"
                required
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. Room A 007 or DS Lab"
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lecture Type
              </label>
              <select
                value={lectureType}
                onChange={(e) => setLectureType(e.target.value as LectureType)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              >
                <option value="Theory">Theory</option>
                <option value="Practical">Practical (Lab)</option>
                <option value="Workshop">Workshop</option>
                <option value="Project">Project</option>
                <option value="Sports">Sports</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy">
              Validate & Schedule Lecture
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

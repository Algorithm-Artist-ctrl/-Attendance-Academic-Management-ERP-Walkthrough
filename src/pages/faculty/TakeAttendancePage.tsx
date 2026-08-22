import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Users, 
  Save, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { AttendanceStatus } from '../../types/database.types';
import { clsx } from 'clsx';

interface TakeAttendancePageProps {
  initialTimetableEntryId?: string;
  onFinished?: () => void;
}

export const TakeAttendancePage: React.FC<TakeAttendancePageProps> = ({ 
  initialTimetableEntryId, 
  onFinished 
}) => {
  const { user } = useAuth();
  const { 
    subjects, 
    sections, 
    students, 
    timetable, 
    saveAttendance 
  } = useAcademic();

  const facultyId = user?.faculty?.id || 'fac-hemlata-02';

  // State for session parameters
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || 'sec-cse-2a-01');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || 'sub-ds-01');
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState<string>('09:00 - 09:50');
  const [roomNumber, setRoomNumber] = useState<string>('Room A-007');

  // Attendance state: Map of student_id -> 'Present' | 'Absent'
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Filter students for current section
  const sectionStudents = students.filter(s => s.section_id === selectedSectionId && s.active);

  // Initialize attendance (default all Present)
  useEffect(() => {
    const initialMap: Record<string, AttendanceStatus> = {};
    sectionStudents.forEach(s => {
      initialMap[s.id] = 'Present';
    });
    setAttendanceMap(initialMap);
  }, [selectedSectionId, students]);

  const handleToggleStatus = (studentId: string) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'Present' ? 'Absent' : 'Present',
    }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    sectionStudents.forEach(s => {
      updated[s.id] = 'Present';
    });
    setAttendanceMap(updated);
  };

  const handleClearAll = () => {
    const updated: Record<string, AttendanceStatus> = {};
    sectionStudents.forEach(s => {
      updated[s.id] = 'Absent';
    });
    setAttendanceMap(updated);
  };

  const presentCount = Object.values(attendanceMap).filter(st => st === 'Present').length;
  const absentCount = sectionStudents.length - presentCount;

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const [startTime, endTime] = timeSlot.split(' - ');

      await saveAttendance({
        timetableEntryId: initialTimetableEntryId,
        facultyId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        sessionDate,
        startTime: startTime || '09:00',
        endTime: endTime || '09:50',
        studentRecords: sectionStudents.map(s => ({
          studentId: s.id,
          status: attendanceMap[s.id] || ('Present' as AttendanceStatus),
        })),
      });

      setIsConfirmOpen(false);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        if (onFinished) onFinished();
      }, 2000);
    } catch (err) {
      console.error('Failed to save attendance', err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const currentSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="space-y-6">
      {/* Top Header & Session Selector Matching Screen 7 */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-[#00ff88]" />
            Live Lecture Attendance Marking
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Official real-time attendance ledger synchronized with Supabase cloud database
          </p>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>Attendance Saved to Supabase!</span>
          </div>
        )}
      </div>

      {/* Session Controls Grid (Subject, Section, Room, Date, Time) */}
      <div className="glass-card rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Section</label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
          >
            {sections.map(sec => (
              <option key={sec.id} value={sec.id}>Section {sec.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Room</label>
          <input
            type="text"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Date</label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Lecture Time</label>
          <select
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-white font-bold focus:outline-none focus:border-[#00ff88]"
          >
            <option value="09:00 - 09:50">09:00 - 09:50</option>
            <option value="09:50 - 10:40">09:50 - 10:40</option>
            <option value="10:40 - 11:30">10:40 - 11:30</option>
            <option value="11:30 - 12:20">11:30 - 12:20</option>
            <option value="13:10 - 14:00">13:10 - 14:00</option>
            <option value="14:00 - 14:50">14:00 - 14:50</option>
            <option value="14:50 - 15:40">14:50 - 15:40</option>
          </select>
        </div>
      </div>

      {/* Quick Action Toolbar Matching Screen 7 */}
      <div className="glass-panel rounded-2xl p-4 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkAllPresent}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88]" />}
          >
            Mark All Present
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            leftIcon={<XCircle className="w-3.5 h-3.5 text-rose-400" />}
          >
            Clear All
          </Button>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 text-xs font-bold">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Present: {presentCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
            <XCircle className="w-3.5 h-3.5" />
            <span>Absent: {absentCount}</span>
          </div>
          <div className="text-slate-400 font-medium">
            Total: {sectionStudents.length} Students
          </div>
        </div>
      </div>

      {/* Student Roster Table & Touch Toggles Matching Screen 7 */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
              <tr>
                <th className="px-6 py-4">Roll Number</th>
                <th className="px-6 py-4">Student Full Name</th>
                <th className="px-6 py-4 text-center">Status Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {sectionStudents.map((s) => {
                const isPresent = attendanceMap[s.id] === 'Present';
                return (
                  <tr key={s.id} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-bold text-emerald-400 text-sm">
                      {s.roll_number}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-white text-sm">
                      {s.full_name}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {/* Mobile & Desktop Touch Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(s.id)}
                        className={clsx(
                          'inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-extrabold text-xs transition-all cursor-pointer select-none border',
                          isPresent
                            ? 'bg-emerald-500/20 text-[#00ff88] border-emerald-500/40 shadow-[0_0_12px_rgba(0,255,136,0.25)]'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                        )}
                      >
                        {isPresent ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Present</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            <span>Absent</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Sticky Save Bar Matching Screen 7 */}
      <div className="sticky bottom-4 z-20 glass-panel rounded-2xl p-4 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
        <div>
          <span className="text-xs text-slate-400 font-medium">Ready to record: </span>
          <span className="text-xs font-bold text-white">
            {presentCount} Present, {absentCount} Absent for Section {currentSection?.name}
          </span>
        </div>

        <Button
          type="button"
          variant="neon"
          size="lg"
          onClick={() => setIsConfirmOpen(true)}
          leftIcon={<Save className="w-4 h-4 text-slate-950" />}
          className="shadow-[0_0_20px_rgba(0,255,136,0.4)]"
        >
          Save Attendance
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSaveAttendance}
        isLoading={isSaving}
        title="Confirm Attendance Submission"
        confirmText="Save to Cloud Database"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to commit this attendance record for{' '}
              <strong className="text-white">{currentSubject?.subject_name}</strong> (Section{' '}
              {currentSection?.name}) on <strong className="text-emerald-400">{sessionDate}</strong>?
            </p>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-xs font-semibold text-slate-300">
              Present: <span className="text-[#00ff88]">{presentCount}</span> • Absent:{' '}
              <span className="text-rose-400">{absentCount}</span>
            </div>
          </div>
        }
      />
    </div>
  );
};

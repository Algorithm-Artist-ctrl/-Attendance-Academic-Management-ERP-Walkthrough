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
  ArrowRight,
  ShieldAlert,
  GraduationCap
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
  const { user, role } = useAuth();
  const { 
    subjects, 
    sections, 
    students, 
    timetable, 
    faculty,
    saveAttendance 
  } = useAcademic();

  // 1. Authorize: Only faculty can mark daily attendance
  const isAuthorized = role === 'faculty' || role === 'hod';
  const currentFaculty = faculty.find(f => f.id === user?.faculty_id || f.employee_code === user?.faculty?.employee_code) || user?.faculty;
  const facultyId = currentFaculty?.id || '';

  // 2. Filter classes assigned STRICTLY to this faculty member
  const assignedClasses = timetable.filter(t => t.faculty_id === facultyId && t.active);

  // Selected Class from faculty's assigned timetable
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Attendance state: Map of student_id -> 'Present' | 'Absent'
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize selected class
  useEffect(() => {
    if (initialTimetableEntryId) {
      setSelectedClassId(initialTimetableEntryId);
    } else if (assignedClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(assignedClasses[0].id);
    }
  }, [initialTimetableEntryId, assignedClasses]);

  // Derive class context strictly from assigned timetable
  const selectedClass = assignedClasses.find(c => c.id === selectedClassId) || assignedClasses[0];

  const selectedSubject = subjects.find(s => s.id === selectedClass?.subject_id) || selectedClass?.subject;
  const selectedSection = sections.find(s => s.id === selectedClass?.section_id) || selectedClass?.section;
  const roomNumber = selectedClass?.room_number || selectedSection?.room_number || 'Room TBD';
  const timeSlot = selectedClass ? `${selectedClass.start_time?.substring(0, 5) || '09:00'} – ${selectedClass.end_time?.substring(0, 5) || '09:50'}` : '09:00 – 09:50';

  // 3. Load students strictly belonging to the class's section
  const sectionStudents = selectedSection
    ? students.filter(s => s.section_id === selectedSection.id && s.active)
    : [];

  // Reset/Initialize attendance (default all Present) when class changes
  useEffect(() => {
    const initialMap: Record<string, AttendanceStatus> = {};
    sectionStudents.forEach(s => {
      initialMap[s.id] = 'Present';
    });
    setAttendanceMap(initialMap);
  }, [selectedClassId, selectedSection?.id, students]);

  // Access Denied for unauthorized roles
  if (!isAuthorized) {
    return (
      <div className="glass-panel rounded-3xl p-8 border border-rose-500/30 text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-slate-300">
          Live lecture attendance marking is reserved strictly for authenticated teaching faculty. Administrative staff and students cannot take daily attendance.
        </p>
      </div>
    );
  }

  // No assigned classes state
  if (assignedClasses.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-8 border border-amber-500/30 text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">No Assigned Classes Found</h2>
        <p className="text-xs text-slate-300">
          Your faculty profile (<span className="text-[#00ff88] font-semibold">{currentFaculty?.full_name || user?.full_name}</span>) has no active teaching lectures assigned in the academic timetable.
        </p>
      </div>
    );
  }

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
    if (!selectedClass || !selectedSection || !selectedSubject) {
      setSaveError('Please select a valid assigned class to take attendance.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const [startTime, endTime] = timeSlot.split(' – ');

      await saveAttendance({
        timetableEntryId: selectedClass.id,
        facultyId,
        sectionId: selectedSection.id,
        subjectId: selectedSubject.id,
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
    } catch (err: any) {
      console.error('Failed to save attendance', err);
      setSaveError(err?.message || 'Failed to record attendance in database.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-[#00ff88]" />
            Live Lecture Attendance Marking
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Faculty: <span className="text-[#00ff88] font-bold">{currentFaculty?.full_name}</span> ({currentFaculty?.faculty_code || 'Faculty'}) • Department of CSE
          </p>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>Attendance Saved to Supabase!</span>
          </div>
        )}
      </div>

      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Assigned Lecture Context Card */}
      <div className="glass-panel rounded-3xl p-5 border border-emerald-500/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/15 pb-4">
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Your Assigned Lecture
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-emerald-500/30 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              {assignedClasses.map(ac => {
                const sub = subjects.find(s => s.id === ac.subject_id) || ac.subject;
                const sec = sections.find(s => s.id === ac.section_id) || ac.section;
                return (
                  <option key={ac.id} value={ac.id}>
                    {sub?.subject_name} ({sub?.subject_code}) • Section {sec?.name} • {ac.day_of_week} Period {ac.period_number} ({ac.start_time} - {ac.end_time})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Session Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-emerald-500/30 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            />
          </div>
        </div>

        {/* Auto-Derived Context Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/15">
            <span className="text-[10px] text-slate-400 block font-semibold">Subject & Code</span>
            <span className="font-bold text-white block mt-0.5 truncate">{selectedSubject?.subject_name}</span>
            <span className="text-[10px] text-[#00ff88] font-mono">{selectedSubject?.subject_code}</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/15">
            <span className="text-[10px] text-slate-400 block font-semibold">Target Section</span>
            <span className="font-bold text-white block mt-0.5">Section {selectedSection?.name}</span>
            <span className="text-[10px] text-slate-400">{selectedSection?.name === 'B' ? 'CSE + IT' : 'CSE'} 2nd Year</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/15">
            <span className="text-[10px] text-slate-400 block font-semibold">Room Number</span>
            <span className="font-bold text-white block mt-0.5">{roomNumber}</span>
            <span className="text-[10px] text-slate-400">Classroom</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/15">
            <span className="text-[10px] text-slate-400 block font-semibold">Lecture Period</span>
            <span className="font-bold text-white block mt-0.5">{timeSlot}</span>
            <span className="text-[10px] text-[#00ff88] font-semibold">{selectedClass?.lecture_type || 'Theory'}</span>
          </div>
        </div>
      </div>

      {/* Attendance Stats & Quick Actions Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-slate-300">
            Enrolled in Section {selectedSection?.name}: <strong className="text-white">{sectionStudents.length}</strong>
          </span>
          <span className="text-emerald-400">
            Present: <strong className="text-white">{presentCount}</strong>
          </span>
          <span className="text-rose-400">
            Absent: <strong className="text-white">{absentCount}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleMarkAllPresent}>
            Mark All Present
          </Button>
          <Button size="sm" variant="outline" onClick={handleClearAll}>
            Clear (All Absent)
          </Button>
          <Button 
            size="sm" 
            variant="neon" 
            leftIcon={<Save className="w-4 h-4 text-slate-950" />}
            onClick={() => setIsConfirmOpen(true)}
            disabled={sectionStudents.length === 0 || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Attendance'}
          </Button>
        </div>
      </div>

      {/* Student List Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
              <tr>
                <th className="px-5 py-3.5 w-16">#</th>
                <th className="px-5 py-3.5">Roll Number</th>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5">Admission Type</th>
                <th className="px-5 py-3.5 text-center">Status Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10 font-medium">
              {sectionStudents.map((stud, idx) => {
                const status = attendanceMap[stud.id] || 'Present';
                const isPresent = status === 'Present';

                return (
                  <tr 
                    key={stud.id}
                    onClick={() => handleToggleStatus(stud.id)}
                    className={clsx(
                      'cursor-pointer transition-colors',
                      isPresent ? 'hover:bg-emerald-500/5' : 'bg-rose-500/5 hover:bg-rose-500/10'
                    )}
                  >
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-white">{stud.roll_number}</td>
                    <td className="px-5 py-3.5 font-bold text-white">{stud.full_name}</td>
                    <td className="px-5 py-3.5 text-slate-400">{stud.admission_type}</td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(stud.id);
                        }}
                        className={clsx(
                          'px-4 py-1.5 rounded-xl font-black text-xs transition-all shadow-sm',
                          isPresent
                            ? 'bg-emerald-500/20 text-[#00ff88] border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                        )}
                      >
                        {isPresent ? '● PRESENT' : '○ ABSENT'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSaveAttendance}
        title="Confirm Attendance Submission"
        message={`Are you sure you want to record attendance for Section ${selectedSection?.name} (${selectedSubject?.subject_name}) on ${sessionDate}? Total Students: ${sectionStudents.length} (Present: ${presentCount}, Absent: ${absentCount}).`}
        confirmText={isSaving ? 'Submitting...' : 'Confirm & Save to Supabase'}
        variant="neon"
        isLoading={isSaving}
      />
    </div>
  );
};

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
  ArrowLeft,
  ShieldAlert,
  GraduationCap,
  MapPin,
  BookOpen
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
    attendanceSessions,
    attendanceRecords,
    saveAttendance 
  } = useAcademic();

  // 1. Authorize: Only teaching faculty or HOD
  const isAuthorized = role === 'faculty' || role === 'hod';
  const currentFaculty = faculty.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;
  
  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';

  // 2. Filter classes assigned STRICTLY to this faculty member
  const assignedClasses = timetable.filter(t => t.faculty_id === facultyId && t.active);

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
  const todayDay = days[new Date().getDay()];
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>(todayDay);

  // Selected Class ID for active attendance marking session
  const [activeClassId, setActiveClassId] = useState<string | null>(initialTimetableEntryId || null);
  
  // Today's date (max date locked to today)
  const todayISO = new Date().toISOString().split('T')[0];
  const [sessionDate, setSessionDate] = useState<string>(todayISO);

  // Attendance state: Map of student_id -> 'Present' | 'Absent'
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // If initialTimetableEntryId is passed in props, open that class directly
  useEffect(() => {
    if (initialTimetableEntryId) {
      setActiveClassId(initialTimetableEntryId);
    }
  }, [initialTimetableEntryId]);

  // Derive class context strictly from assigned timetable
  const activeClass = assignedClasses.find(c => c.id === activeClassId);
  const activeSubject = subjects.find(s => s.id === activeClass?.subject_id) || activeClass?.subject;
  const activeSection = sections.find(s => s.id === activeClass?.section_id) || activeClass?.section;
  const roomNumber = activeClass?.room_number || activeSection?.room_number || 'Room TBD';
  const timeSlot = activeClass ? `${activeClass.start_time?.substring(0, 5) || '09:00'} – ${activeClass.end_time?.substring(0, 5) || '09:50'}` : '09:00 – 09:50';

  // 3. Load students strictly belonging to the active class's section
  const sectionStudents = activeSection
    ? students.filter(s => s.section_id === activeSection.id && s.active)
    : [];

  // Initialize attendance when an active class is selected
  useEffect(() => {
    if (!activeClass || !activeSection) return;

    // Check if attendance already exists in database for this class/section/date
    const existingSession = attendanceSessions.find(
      s => s.section_id === activeSection.id && 
           s.subject_id === activeClass.subject_id && 
           s.session_date === sessionDate
    );

    const initialMap: Record<string, AttendanceStatus> = {};
    if (existingSession) {
      const records = attendanceRecords.filter(r => r.attendance_session_id === existingSession.id);
      sectionStudents.forEach(s => {
        const found = records.find(r => r.student_id === s.id);
        initialMap[s.id] = found ? (found.status as AttendanceStatus) : 'Present';
      });
    } else {
      sectionStudents.forEach(s => {
        initialMap[s.id] = 'Present';
      });
    }
    setAttendanceMap(initialMap);
  }, [activeClassId, sessionDate, activeSection?.id, attendanceSessions, attendanceRecords]);

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
    if (!activeClass || !activeSection || !activeSubject) {
      setSaveError('Please select a valid assigned class to take attendance.');
      return;
    }

    if (sessionDate > todayISO) {
      setSaveError('Invalid attendance date. Attendance cannot be marked for future dates.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const [startTime, endTime] = timeSlot.split(' – ');

      await saveAttendance({
        timetableEntryId: activeClass.id,
        facultyId,
        sectionId: activeSection.id,
        subjectId: activeSubject.id,
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
        setActiveClassId(null);
        if (onFinished) onFinished();
      }, 1800);
    } catch (err: any) {
      console.error('Failed to save attendance', err);
      setSaveError(err?.message || 'Failed to record attendance in database.');
    } finally {
      setIsSaving(false);
    }
  };

  // =========================================================================
  // VIEW 1: TODAY'S ASSIGNED CLASSES CARD LIST
  // =========================================================================
  if (!activeClassId) {
    const dayClasses = assignedClasses
      .filter(t => t.day_of_week === selectedDayFilter)
      .sort((a, b) => a.period_number - b.period_number);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <CheckSquare className="w-6 h-6 text-[#00ff88]" />
              Today's Assigned Classes
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Faculty: <span className="text-[#00ff88] font-bold">{currentFaculty?.full_name}</span> ({currentFaculty?.faculty_code || 'Faculty'}) • Department of CSE
            </p>
          </div>

          {/* Day Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
            {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const).map(d => (
              <button
                key={d}
                onClick={() => setSelectedDayFilter(d)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  selectedDayFilter === d
                    ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Classes Cards Grid */}
        {dayClasses.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 border border-emerald-500/20 text-center space-y-3">
            <Calendar className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="font-bold text-white text-sm">
              {selectedDayFilter === 'SUN' ? 'Today is Sunday (Weekend / Holiday)' : `No teaching lectures scheduled for ${selectedDayFilter}`}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {selectedDayFilter === 'SUN' 
                ? 'College academic lectures are not held on Sundays. Classes resume on Monday. You can select Monday–Saturday tabs to review weekly assignments.'
                : `No active teaching periods are assigned to you on ${selectedDayFilter} in the published timetable.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dayClasses.map(cls => {
              const sub = subjects.find(s => s.id === cls.subject_id) || cls.subject;
              const sec = sections.find(s => s.id === cls.section_id) || cls.section;
              const enrolledStudents = students.filter(s => s.section_id === sec?.id && s.active);

              // Check if already recorded today
              const existingSess = attendanceSessions.find(
                s => s.section_id === sec?.id && 
                     s.subject_id === cls.subject_id && 
                     s.session_date === todayISO
              );

              const records = existingSess 
                ? attendanceRecords.filter(r => r.attendance_session_id === existingSess.id)
                : [];
              const presentCount = records.filter(r => r.status === 'Present').length;

              return (
                <div
                  key={cls.id}
                  className="glass-card rounded-3xl p-5 flex flex-col justify-between space-y-4 border border-emerald-500/20 hover:border-emerald-500/40 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.1)]"
                >
                  <div className="space-y-3">
                    {/* Top Row: Time & Section */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-slate-950 border border-emerald-500/30 text-[#00ff88]">
                        {cls.start_time?.substring(0, 5)} – {cls.end_time?.substring(0, 5)} (P{cls.period_number})
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                        Section {sec?.name}
                      </span>
                    </div>

                    {/* Subject Details */}
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                        {sub?.subject_name}
                      </h3>
                      <p className="text-xs font-mono text-[#00ff88] mt-0.5">
                        {sub?.subject_code} • {cls.lecture_type || 'Theory'}
                      </p>
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-2 border-t border-emerald-500/10">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{cls.room_number || sec?.room_number || 'Room TBD'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{enrolledStudents.length} Students</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Status & Action */}
                  <div className="pt-3 border-t border-emerald-500/15 flex items-center justify-between gap-2">
                    {existingSess ? (
                      <div className="text-[11px] font-bold text-[#00ff88] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marked ({presentCount}/{records.length})</span>
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Not Recorded</span>
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant={existingSess ? 'outline' : 'neon'}
                      onClick={() => setActiveClassId(cls.id)}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      {existingSess ? 'Update' : 'Take Attendance'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE LECTURE ATTENDANCE MARKING SHEET
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveClassId(null)}
            className="p-2 rounded-2xl bg-slate-950 border border-emerald-500/30 text-[#00ff88] hover:bg-emerald-500/10 transition-all shrink-0"
            title="Back to Assigned Classes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <CheckSquare className="w-6 h-6 text-[#00ff88]" />
              {activeSubject?.subject_name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeSubject?.subject_code} • Section {activeSection?.name} • Room: <span className="text-[#00ff88] font-bold">{roomNumber}</span> • {timeSlot}
            </p>
          </div>
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

      {/* Date and Context Lock */}
      <div className="glass-panel rounded-3xl p-5 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
            <span className="text-slate-400 block text-[10px]">Faculty</span>
            <span className="font-bold text-white">{currentFaculty?.full_name}</span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
            <span className="text-slate-400 block text-[10px]">Target Section</span>
            <span className="font-bold text-[#00ff88]">Section {activeSection?.name}</span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-slate-950/80 border border-emerald-500/20">
            <span className="text-slate-400 block text-[10px]">Room Number</span>
            <span className="font-bold text-white">{roomNumber}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap">Session Date:</label>
          <input
            type="date"
            max={todayISO}
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="px-3.5 py-2 bg-slate-950/90 border border-emerald-500/30 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
          />
        </div>
      </div>

      {/* Attendance Stats & Quick Actions Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-slate-300">
            Enrolled in Section {activeSection?.name}: <strong className="text-white">{sectionStudents.length}</strong>
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
        message={`Are you sure you want to record attendance for Section ${activeSection?.name} (${activeSubject?.subject_name}) on ${sessionDate}? Total Students: ${sectionStudents.length} (Present: ${presentCount}, Absent: ${absentCount}).`}
        confirmText={isSaving ? 'Submitting...' : 'Confirm & Save to Supabase'}
        variant="neon"
        isLoading={isSaving}
      />
    </div>
  );
};

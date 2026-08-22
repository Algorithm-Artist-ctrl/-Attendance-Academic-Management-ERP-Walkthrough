import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Save, 
  Filter,
  Search,
  Sparkles,
  MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getISTTodayDate, getISTDayOfWeek, formatTime12H } from '../../lib/utils/dateUtils';
import { AttendanceStatus, DayOfWeek, Student } from '../../types/database.types';

interface TakeAttendancePageProps {
  initialTimetableEntryId?: string;
  onFinished?: () => void;
}

export const TakeAttendancePage: React.FC<TakeAttendancePageProps> = ({
  initialTimetableEntryId,
  onFinished,
}) => {
  const { user } = useAuth();
  const { 
    faculty, 
    sections, 
    subjects, 
    assignments, 
    students, 
    timetable, 
    saveAttendance, 
    attendanceSessions,
    attendanceRecords 
  } = useAcademic();

  const currentFaculty = faculty.find(f => f.id === user?.faculty_id) || faculty[1]; // Default to Ms. Hemlata if admin testing
  const todayDateStr = getISTTodayDate();
  const todayDay = getISTDayOfWeek(todayDateStr);

  // Faculty's assigned sections & subjects
  const myAssignments = assignments.filter(a => a.faculty_id === currentFaculty.id && a.active);
  const myTimetable = timetable.filter(t => t.faculty_id === currentFaculty.id && t.active);

  // Selection states
  const [selectedSectionId, setSelectedSectionId] = useState<string>(() => {
    if (initialTimetableEntryId) {
      const entry = timetable.find(t => t.id === initialTimetableEntryId);
      if (entry) return entry.section_id;
    }
    return myAssignments[0]?.section_id || sections[0]?.id || '';
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialTimetableEntryId) {
      const entry = timetable.find(t => t.id === initialTimetableEntryId);
      if (entry) return entry.subject_id;
    }
    return myAssignments[0]?.subject_id || subjects[0]?.id || '';
  });

  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentAttendanceMap, setStudentAttendanceMap] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Get students in the selected section
  const sectionStudents = useMemo(() => {
    return students
      .filter(s => s.section_id === selectedSectionId && s.active)
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number));
  }, [students, selectedSectionId]);

  // Load existing attendance if already taken for this date/subject/section
  useEffect(() => {
    const existingSession = attendanceSessions.find(
      s => s.section_id === selectedSectionId &&
           s.subject_id === selectedSubjectId &&
           s.session_date === selectedDate
    );

    const initialMap: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    
    if (existingSession) {
      const existingRecs = attendanceRecords.filter(r => r.attendance_session_id === existingSession.id);
      sectionStudents.forEach(s => {
        const rec = existingRecs.find(r => r.student_id === s.id);
        initialMap[s.id] = {
          status: rec ? rec.status : 'Present',
          remarks: rec?.remarks || '',
        };
      });
    } else {
      // Default all to Present for rapid 1-click marking
      sectionStudents.forEach(s => {
        initialMap[s.id] = {
          status: 'Present',
          remarks: '',
        };
      });
    }
    setStudentAttendanceMap(initialMap);
  }, [selectedSectionId, selectedSubjectId, selectedDate, sectionStudents, attendanceSessions, attendanceRecords]);

  // Quick batch actions
  const markAll = (status: AttendanceStatus) => {
    const updated: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    sectionStudents.forEach(s => {
      updated[s.id] = {
        status,
        remarks: studentAttendanceMap[s.id]?.remarks || '',
      };
    });
    setStudentAttendanceMap(updated);
  };

  const toggleStudent = (studentId: string) => {
    setStudentAttendanceMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: prev[studentId]?.status === 'Present' ? 'Absent' : 'Present',
      }
    }));
  };

  const updateRemark = (studentId: string, remarks: string) => {
    setStudentAttendanceMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks,
      }
    }));
  };

  // Stats calculation
  const totalCount = sectionStudents.length;
  const presentCount = Object.values(studentAttendanceMap).filter(v => v.status === 'Present').length;
  const absentCount = totalCount - presentCount;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Filtered students for search
  const filteredStudents = sectionStudents.filter(
    s => s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         s.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    setIsSaving(true);
    try {
      const recordsToSave = Object.entries(studentAttendanceMap).map(([studentId, data]) => ({
        studentId,
        status: data.status,
        remarks: data.remarks || undefined,
      }));

      // Find matching timetable entry if exists
      const matchedTimetableEntry = myTimetable.find(
        t => t.section_id === selectedSectionId && t.subject_id === selectedSubjectId
      );

      saveAttendance({
        timetableEntryId: matchedTimetableEntry?.id,
        facultyId: currentFaculty.id,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        sessionDate: selectedDate,
        startTime: matchedTimetableEntry?.start_time || '09:00',
        endTime: matchedTimetableEntry?.end_time || '09:50',
        studentRecords: recordsToSave,
      });

      setIsConfirmOpen(false);
      setSaveSuccessMessage(`Attendance saved successfully for ${presentCount} Present & ${absentCount} Absent students!`);
      setTimeout(() => {
        setSaveSuccessMessage(null);
        if (onFinished) onFinished();
      }, 2500);
    } catch (err: any) {
      alert(`Failed to save attendance: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const currentSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Live Attendance Entry
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Faculty: <strong className="text-slate-800">{currentFaculty.full_name}</strong>
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            {currentSubject?.subject_name} ({currentSubject?.subject_code})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
            <span>Section: <strong>{currentSection?.name}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {currentSection?.room_number}</span>
            <span>•</span>
            <span>Odd Semester 2026-2027</span>
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
          <Calendar className="w-4 h-4 text-vctm-navy-700" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent font-semibold text-slate-800 focus:outline-none"
          />
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center gap-2 animate-in zoom-in-95 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Class & Subject Selector Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Select Section:
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full text-sm font-medium border border-slate-200 rounded-lg p-2 bg-slate-50 focus:ring-2 focus:ring-vctm-navy-500"
          >
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                Section {s.name} ({s.room_number})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Select Subject:
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full text-sm font-medium border border-slate-200 rounded-lg p-2 bg-slate-50 focus:ring-2 focus:ring-vctm-navy-500"
          >
            {subjects.map(sub => (
              <option key={sub.id} value={sub.id}>
                {sub.subject_code} — {sub.subject_name} ({sub.lecture_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Action & Stats Summary Bar (Sticky on mobile) */}
      <div className="sticky top-16 z-30 bg-vctm-navy-900 text-white p-4 rounded-xl shadow-lg border border-vctm-navy-700 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Real-time counters */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-300" />
            <span>Total: <strong>{totalCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Present: <strong>{presentCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>Absent: <strong>{absentCount}</strong></span>
          </div>
          <div className="hidden md:block font-bold text-amber-400">
            {percentage}% Attendance
          </div>
        </div>

        {/* Batch buttons & Save */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            size="sm"
            variant="outline"
            className="text-xs bg-vctm-navy-800 text-slate-200 border-vctm-navy-700 hover:bg-vctm-navy-700"
            onClick={() => markAll('Present')}
          >
            Mark All Present
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs bg-vctm-navy-800 text-slate-200 border-vctm-navy-700 hover:bg-vctm-navy-700"
            onClick={() => markAll('Absent')}
          >
            Clear All (Absent)
          </Button>
          <Button
            size="sm"
            variant="success"
            className="font-bold shadow-md"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={() => setIsConfirmOpen(true)}
          >
            Save Attendance
          </Button>
        </div>
      </div>

      {/* Student Roster List / Grid */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <span>Student Roster (Section {currentSection?.name} • {sectionStudents.length} Students)</span>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name or roll no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vctm-navy-500"
              />
            </div>
          </div>
        }
        noPadding
      >
        <div className="divide-y divide-slate-100">
          {filteredStudents.map((stud, idx) => {
            const currentStatus = studentAttendanceMap[stud.id]?.status || 'Present';
            const isPresent = currentStatus === 'Present';

            return (
              <div 
                key={stud.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isPresent ? 'bg-white hover:bg-emerald-50/20' : 'bg-rose-50/40 hover:bg-rose-50/60'
                }`}
              >
                {/* Student Info */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-6 text-right">
                    {idx + 1}.
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {stud.full_name}
                      </span>
                      {stud.admission_type === 'Lateral Entry' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
                          Lateral Entry
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-500">
                      Roll No: <strong className="text-slate-700">{stud.roll_number}</strong>
                    </div>
                  </div>
                </div>

                {/* Status Toggle Button + Remark */}
                <div className="flex items-center gap-3 ml-9 sm:ml-0">
                  <input
                    type="text"
                    placeholder="Remark (optional)"
                    value={studentAttendanceMap[stud.id]?.remarks || ''}
                    onChange={(e) => updateRemark(stud.id, e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 w-36 sm:w-44 focus:ring-1 focus:ring-vctm-navy-500 bg-white"
                  />

                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={() => toggleStudent(stud.id)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-xs select-none ${
                      isPresent
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/20'
                        : 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500/20'
                    }`}
                  >
                    {isPresent ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>PRESENT</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        <span>ABSENT</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Confirmation Dialog before saving */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSave}
        title="Confirm Attendance Submission"
        isLoading={isSaving}
        confirmText="Confirm & Save"
        message={
          <div className="space-y-3">
            <p>
              Are you sure you want to submit attendance for <strong>{currentSubject?.subject_name}</strong> (Section {currentSection?.name}) on <strong>{selectedDate}</strong>?
            </p>
            <div className="p-3 bg-slate-100 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Total Students:</span>
                <strong className="text-slate-900">{totalCount}</strong>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Present:</span>
                <span>{presentCount} Students</span>
              </div>
              <div className="flex justify-between text-rose-700 font-bold">
                <span>Absent:</span>
                <span>{absentCount} Students</span>
              </div>
              <div className="flex justify-between text-vctm-navy-800 font-bold border-t border-slate-200 pt-1">
                <span>Calculated Attendance:</span>
                <span>{percentage}%</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Submitted attendance will be immediately visible to all students in this section.
            </p>
          </div>
        }
      />
    </div>
  );
};

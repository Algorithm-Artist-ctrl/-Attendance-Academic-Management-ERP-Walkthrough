import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  CheckSquare, 
  Users, 
  Save, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  AlertTriangle,
  Trash2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  GraduationCap,
  MapPin,
  BookOpen,
  Search,
  RotateCcw,
  CheckCheck,
  Filter,
  Keyboard,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { AttendanceStatus, DayOfWeek } from '../../types/database.types';
import { 
  getISTTodayDate, 
  getISTDayOfWeek, 
  getDateForWeekdayInCurrentWeek, 
  formatDateFull, 
  getRelativeDate, 
  isDateInFuture, 
  isDateToday, 
  isDateInPast 
} from '../../lib/utils/dateUtils';
import { supabaseService } from '../../lib/services/supabaseService';
import { clsx } from 'clsx';

interface TakeAttendancePageProps {
  initialTimetableEntryId?: string;
  initialSessionDate?: string;
  onFinished?: () => void;
}

type MarkState = 'Present' | 'Absent' | 'Unmarked';
type StatusFilter = 'ALL' | 'UNMARKED' | 'PRESENT' | 'ABSENT';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DAY_FULL_NAMES: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export const TakeAttendancePage: React.FC<TakeAttendancePageProps> = ({ 
  initialTimetableEntryId, 
  initialSessionDate,
  onFinished 
}) => {
  const { user, role } = useAuth();
  const { 
    subjects, 
    sections, 
    years,
    semesters,
    students, 
    timetable, 
    faculty,
    attendanceSessions,
    attendanceRecords,
    saveAttendance,
    deleteAttendanceSession,
    getFacultyTimetable 
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
  const assignedClasses = getFacultyTimetable(facultyId);

  const todayISO = getISTTodayDate();
  const todayDay = getISTDayOfWeek();
  const [sessionDate, setSessionDate] = useState<string>(initialSessionDate || todayISO);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>(
    initialSessionDate ? getISTDayOfWeek(initialSessionDate) : todayDay
  );

  // Selected Class ID for active attendance marking session
  const [activeClassId, setActiveClassId] = useState<string | null>(initialTimetableEntryId || null);

  // Formatted date for human-readable display (e.g. "16 Sep 2026")
  const formattedSessionDate = useMemo(() => {
    try {
      const d = new Date(`${sessionDate}T00:00:00`);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return sessionDate;
    }
  }, [sessionDate]);

  // Attendance state: Map of student_id -> 'Present' | 'Absent' | 'Unmarked'
  const [attendanceMap, setAttendanceMap] = useState<Record<string, MarkState>>({});
  // Baseline saved attendance map from Supabase for dirty checking
  const [savedAttendanceMap, setSavedAttendanceMap] = useState<Record<string, MarkState>>({});
  // Undo history stack
  const [history, setHistory] = useState<Array<Record<string, MarkState>>>([]);

  // Search & Filter
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Modals & Save State
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isUnmarkedReviewOpen, setIsUnmarkedReviewOpen] = useState<boolean>(false);
  const [isNavConfirmOpen, setIsNavConfirmOpen] = useState<boolean>(false);
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [isDeletingSession, setIsDeletingSession] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

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
  const sectionStudents = useMemo(() => {
    if (!activeSection) return [];
    return students.filter(s => s.section_id === activeSection.id && s.active);
  }, [activeSection, students]);

  // Find existing session in database strictly for this sessionDate and class/slot
  const existingSession = useMemo(() => {
    if (!activeClass || !activeSection) return undefined;
    return attendanceSessions.find(
      s => (s.session_date?.split('T')[0] || s.session_date) === sessionDate &&
           (s.timetable_entry_id === activeClass.id || 
            (s.section_id === activeSection.id && 
             s.subject_id === activeClass.subject_id && 
             (s.start_time?.substring(0, 5) === activeClass.start_time?.substring(0, 5) || !activeClass.start_time)))
    );
  }, [activeClass, activeSection, attendanceSessions, sessionDate]);

  // Track selection to prevent resetting in-progress marking on background updates
  const currentSelectionKey = `${activeClassId || ''}_${sessionDate}`;
  const prevSelectionKeyRef = useRef<string>('');
  const hasUnsavedChangesRef = useRef<boolean>(false);
  const isSavingRef = useRef<boolean>(false);

  // Initialize attendance when an active class or date is selected
  useEffect(() => {
    if (!activeClass || !activeSection) return;

    const isNewSelection = currentSelectionKey !== prevSelectionKeyRef.current;

    // If it's not a new selection and user has unsaved changes, do not overwrite in-progress marks
    if (!isNewSelection && hasUnsavedChangesRef.current) {
      return;
    }

    const records = existingSession
      ? attendanceRecords.filter(r => r.attendance_session_id === existingSession.id)
      : [];
    const hasAnySavedRecords = records.length > 0;

    // Defensive: If not a new selection and we already have marks in savedAttendanceMap, but background records are temporarily empty, do NOT overwrite with Unmarked
    if (!isNewSelection && !hasAnySavedRecords && Object.values(savedAttendanceMap).some(st => st === 'Present' || st === 'Absent')) {
      return;
    }

    const initialMap: Record<string, MarkState> = {};
    sectionStudents.forEach(s => {
      const found = records.find(r => r.student_id === s.id);
      initialMap[s.id] = found ? (found.status as MarkState) : 'Unmarked';
    });

    setAttendanceMap(initialMap);
    setSavedAttendanceMap(initialMap);

    if (isNewSelection) {
      prevSelectionKeyRef.current = currentSelectionKey;
      setHistory([]);
      setFocusedIndex(0);
      setStatusFilter('ALL');
      setSaveError(null);
    }

    setSaveStatus(hasAnySavedRecords ? 'saved' : 'idle');
  }, [activeClassId, sessionDate, activeSection?.id, existingSession, attendanceRecords, sectionStudents, currentSelectionKey]);

  // Fallback: If session exists in DB but attendanceRecords does not contain records for it yet, fetch directly
  useEffect(() => {
    let isCancelled = false;
    if (existingSession?.id && activeClass && activeSection) {
      const records = attendanceRecords.filter(r => r.attendance_session_id === existingSession.id);
      if (records.length === 0) {
        supabaseService.fetchSessionAttendanceRecords(existingSession.id).then(directRecords => {
          if (isCancelled || !directRecords || directRecords.length === 0) return;
          const directMap: Record<string, MarkState> = {};
          sectionStudents.forEach(s => {
            const found = directRecords.find(r => r.student_id === s.id);
            directMap[s.id] = found ? (found.status as MarkState) : 'Unmarked';
          });
          setAttendanceMap(directMap);
          setSavedAttendanceMap(directMap);
          setSaveStatus('saved');
        }).catch(err => {
          console.warn('Error fetching session attendance directly:', err);
        });
      }
    }
    return () => { isCancelled = true; };
  }, [existingSession?.id, sectionStudents]);

  // Undo helper
  const pushState = useCallback((newMap: Record<string, MarkState>) => {
    setHistory(prev => [...prev.slice(-20), attendanceMap]);
    setAttendanceMap(newMap);
  }, [attendanceMap]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setAttendanceMap(previous);
  };

  // State stats
  const { presentCount, absentCount, unmarkedCount, completionPercent } = useMemo(() => {
    let p = 0;
    let a = 0;
    let u = 0;
    sectionStudents.forEach(s => {
      const st = attendanceMap[s.id] || 'Unmarked';
      if (st === 'Present') p++;
      else if (st === 'Absent') a++;
      else u++;
    });
    const total = sectionStudents.length;
    const percent = total > 0 ? Math.round(((p + a) / total) * 100) : 0;
    return { presentCount: p, absentCount: a, unmarkedCount: u, completionPercent: percent };
  }, [sectionStudents, attendanceMap]);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return sectionStudents.filter(s => {
      const matchesSearch = 
        s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.roll_number.toLowerCase().includes(studentSearch.toLowerCase());
      if (!matchesSearch) return false;

      const st = attendanceMap[s.id] || 'Unmarked';
      if (statusFilter === 'UNMARKED' && st !== 'Unmarked') return false;
      if (statusFilter === 'PRESENT' && st !== 'Present') return false;
      if (statusFilter === 'ABSENT' && st !== 'Absent') return false;
      return true;
    });
  }, [sectionStudents, studentSearch, statusFilter, attendanceMap]);

  // Mark single student
  const setStudentStatus = (studentId: string, status: MarkState) => {
    const next = { ...attendanceMap, [studentId]: status };
    setSaveStatus('idle');
    setSaveError(null);
    pushState(next);
  };

  // Bulk actions
  const handleMarkAllPresent = () => {
    const updated: Record<string, MarkState> = {};
    sectionStudents.forEach(s => { updated[s.id] = 'Present'; });
    setSaveStatus('idle');
    setSaveError(null);
    pushState(updated);
  };

  const handleMarkAllAbsent = () => {
    const updated: Record<string, MarkState> = {};
    sectionStudents.forEach(s => { updated[s.id] = 'Absent'; });
    setSaveStatus('idle');
    setSaveError(null);
    pushState(updated);
  };

  const handleMarkRemainingPresent = () => {
    const updated: Record<string, MarkState> = { ...attendanceMap };
    sectionStudents.forEach(s => {
      if ((updated[s.id] || 'Unmarked') === 'Unmarked') {
        updated[s.id] = 'Present';
      }
    });
    setSaveStatus('idle');
    setSaveError(null);
    pushState(updated);
  };

  const handleMarkRemainingAbsent = () => {
    const updated: Record<string, MarkState> = { ...attendanceMap };
    sectionStudents.forEach(s => {
      if ((updated[s.id] || 'Unmarked') === 'Unmarked') {
        updated[s.id] = 'Absent';
      }
    });
    setSaveStatus('idle');
    setSaveError(null);
    pushState(updated);
  };

  // Track changes against database baseline
  const { hasUnsavedChanges, changedCount } = useMemo(() => {
    let diff = 0;
    sectionStudents.forEach(s => {
      const curr = attendanceMap[s.id] || 'Unmarked';
      const base = savedAttendanceMap[s.id] || 'Unmarked';
      if (curr !== base) diff++;
    });
    return {
      hasUnsavedChanges: diff > 0,
      changedCount: diff,
    };
  }, [sectionStudents, attendanceMap, savedAttendanceMap]);

  hasUnsavedChangesRef.current = hasUnsavedChanges;

  // Safe navigation interceptor
  const safelyNavigate = useCallback((action: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavAction(() => action);
      setIsNavConfirmOpen(true);
    } else {
      action();
    }
  }, [hasUnsavedChanges]);

  const handleResetToSaved = () => {
    const reverted: Record<string, MarkState> = {};
    sectionStudents.forEach(s => {
      reverted[s.id] = savedAttendanceMap[s.id] || 'Unmarked';
    });
    setAttendanceMap(reverted);
    setHistory([]);
    setSaveStatus('idle');
    setSaveError(null);
    setIsClearModalOpen(false);
  };

  const handleDeleteSavedSession = async () => {
    if (!existingSession) return;
    setIsDeletingSession(true);
    try {
      const res = await deleteAttendanceSession(existingSession.id);
      if (res?.success) {
        const reset: Record<string, MarkState> = {};
        sectionStudents.forEach(s => {
          reset[s.id] = 'Unmarked';
        });
        setAttendanceMap(reset);
        setSavedAttendanceMap({});
        setHistory([]);
        setSaveStatus('idle');
        setSaveSuccess(false);
        setIsClearModalOpen(false);
        setIsDeleteConfirmOpen(false);
      } else {
        setSaveError('Failed to delete saved attendance session from Supabase.');
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Error deleting session');
    } finally {
      setIsDeletingSession(false);
    }
  };

  const handleDiscardAndLeave = () => {
    setIsNavConfirmOpen(false);
    const action = pendingNavAction;
    setPendingNavAction(null);
    if (action) action();
  };

  const handleSaveAndLeave = async () => {
    setIsNavConfirmOpen(false);
    const finalMap = { ...attendanceMap };
    sectionStudents.forEach(s => {
      if ((finalMap[s.id] || 'Unmarked') === 'Unmarked') {
        finalMap[s.id] = 'Absent';
      }
    });
    await executeSave(finalMap);
    const action = pendingNavAction;
    setPendingNavAction(null);
    if (action) action();
  };

  // Warn on browser tab close / reload if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Dynamic Save button configuration matching States A - E
  const saveButtonConfig = useMemo(() => {
    if (saveStatus === 'saving') {
      return {
        label: 'Saving...',
        icon: <RotateCcw className="w-4 h-4 text-slate-950 animate-spin" />,
        variant: 'neon' as const,
        disabled: true,
        className: 'font-black opacity-80 cursor-not-allowed',
      };
    }
    if (saveStatus === 'error') {
      return {
        label: 'Save Failed — Retry',
        icon: <AlertCircle className="w-4 h-4 text-white" />,
        variant: 'outline' as const,
        disabled: false,
        className: 'font-black text-rose-300 border-rose-500 bg-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.4)] hover:bg-rose-500/30',
      };
    }
    if (saveStatus === 'saved' && !hasUnsavedChanges && (presentCount > 0 || absentCount > 0)) {
      return {
        label: 'Attendance Saved',
        icon: <CheckCheck className="w-4 h-4 text-[#00ff88]" />,
        variant: 'outline' as const,
        disabled: false,
        className: 'font-black text-[#00ff88] border-[#00ff88]/50 bg-[#00ff88]/10 shadow-[0_0_15px_rgba(0,255,136,0.2)]',
      };
    }
    if (hasUnsavedChanges) {
      return {
        label: `Save Attendance (${changedCount})`,
        icon: <CheckCircle2 className="w-4 h-4 text-slate-950" />,
        variant: 'neon' as const,
        disabled: false,
        className: 'font-black shadow-[0_0_20px_rgba(0,255,136,0.35)]',
      };
    }
    return {
      label: 'Save Attendance',
      icon: <CheckCircle2 className="w-4 h-4 text-slate-950" />,
      variant: 'neon' as const,
      disabled: false,
      className: 'font-black shadow-[0_0_15px_rgba(0,255,136,0.25)]',
    };
  }, [saveStatus, hasUnsavedChanges, changedCount, presentCount, absentCount]);

  // Keyboard navigation
  useEffect(() => {
    if (!activeClassId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if inside search input
      if (document.activeElement === searchInputRef.current) {
        if (e.key === 'Escape') {
          searchInputRef.current?.blur();
        }
        return;
      }

      // Hotkey to focus search: '/'
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (filteredStudents.length === 0) return;

      const currStudent = filteredStudents[focusedIndex];

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filteredStudents.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (currStudent) {
          setStudentStatus(currStudent.id, 'Present');
          setFocusedIndex(prev => Math.min(prev + 1, filteredStudents.length - 1));
        }
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (currStudent) {
          setStudentStatus(currStudent.id, 'Absent');
          setFocusedIndex(prev => Math.min(prev + 1, filteredStudents.length - 1));
        }
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        if (currStudent) {
          setStudentStatus(currStudent.id, 'Unmarked');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeClassId, filteredStudents, focusedIndex, attendanceMap]);

  // Validate and trigger save
  const handleInitiateSave = () => {
    if (unmarkedCount > 0) {
      setIsUnmarkedReviewOpen(true);
      return;
    }
    setIsConfirmOpen(true);
  };

  const executeSave = async (finalMap: Record<string, MarkState>) => {
    if (isSavingRef.current) return;

    if (!activeClass || !activeSection || !activeSubject) {
      setSaveError('Please select a valid assigned class to take attendance.');
      setSaveStatus('error');
      return;
    }

    if (sessionDate > todayISO) {
      setSaveError('Invalid attendance date. Attendance cannot be marked for future dates.');
      setSaveStatus('error');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');
    setSaveError(null);

    try {
      const [startTime, endTime] = timeSlot.split(' – ');

      const result = await saveAttendance({
        timetableEntryId: activeClass.id,
        facultyId,
        sectionId: activeSection.id,
        subjectId: activeSubject.id,
        sessionDate,
        startTime: startTime || '09:00',
        endTime: endTime || '09:50',
        studentRecords: sectionStudents.map(s => ({
          studentId: s.id,
          status: (finalMap[s.id] || 'Unmarked') as (AttendanceStatus | 'Unmarked'),
        })),
      });

      const expectedRecordCount = Object.values(finalMap).filter(st => st === 'Present' || st === 'Absent').length;
      // Strict Verification: Database must return valid session and records matching all Present/Absent marks
      if (!result?.session?.id || (result?.records?.length ?? 0) !== expectedRecordCount) {
        throw new Error(`Database verification mismatch: Expected ${expectedRecordCount} saved records, but received ${result?.records?.length || 0}.`);
      }

      setSavedAttendanceMap({ ...finalMap });
      setAttendanceMap({ ...finalMap });
      setSaveStatus(expectedRecordCount > 0 ? 'saved' : 'idle');
      setIsConfirmOpen(false);
      setIsUnmarkedReviewOpen(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save attendance', err);
      setSaveStatus('error');
      setSaveError(err?.message || 'Attendance could not be saved. Check connection and retry.');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // Access Denied for unauthorized roles
  if (!isAuthorized) {
    return (
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-rose-500/30 text-center space-y-4 max-w-xl mx-auto my-12">
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
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-amber-500/30 text-center space-y-4 max-w-xl mx-auto my-12">
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

  // =========================================================================
  // VIEW 1: ASSIGNED CLASSES CARD LIST (SCHEDULE BROWSER)
  // =========================================================================
  if (!activeClassId) {
    const dayClasses = assignedClasses
      .filter(t => t.day_of_week === selectedDayFilter)
      .sort((a, b) => a.period_number - b.period_number);

    const isFuture = isDateInFuture(sessionDate, todayISO);
    const isToday = isDateToday(sessionDate, todayISO);
    const isPast = isDateInPast(sessionDate, todayISO);

    return (
      <div className="space-y-6">
        {/* Header with Date Navigation & Quick Filters */}
        <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 flex-wrap">
              <CheckSquare className="w-6 h-6 text-[#00ff88]" />
              <span>
                {isToday
                  ? `Today's Assigned Classes (${todayDay})`
                  : `Assigned Classes — ${formatDateFull(sessionDate)}`}
              </span>
              {isToday && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-[#00ff88] border border-emerald-500/40">
                  TODAY
                </span>
              )}
              {isFuture && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  UPCOMING
                </span>
              )}
              {isPast && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  HISTORICAL
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {formatDateFull(sessionDate)} • Faculty: <span className="text-white font-bold">{currentFaculty?.full_name}</span> ({currentFaculty?.faculty_code || 'Faculty'}) • Department of CSE
            </p>
          </div>

          {/* Date Picker & Quick Selectors */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Quick Presets */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-emerald-500/20">
              <button
                type="button"
                onClick={() => {
                  const prev = getRelativeDate(sessionDate, -1);
                  setSessionDate(prev);
                  setSelectedDayFilter(getISTDayOfWeek(prev));
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
                title="Previous Day"
              >
                ◀ Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  setSessionDate(todayISO);
                  setSelectedDayFilter(getISTDayOfWeek(todayISO));
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  isToday
                    ? 'bg-[#00ff88] text-slate-950 font-black shadow-[0_0_10px_rgba(0,255,136,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = getRelativeDate(sessionDate, 1);
                  setSessionDate(next);
                  setSelectedDayFilter(getISTDayOfWeek(next));
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
                title="Next Day"
              >
                Next ▶
              </button>
            </div>

            {/* Date Input */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1.5 rounded-2xl border border-emerald-500/20">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => {
                  const d = e.target.value;
                  if (d) {
                    setSessionDate(d);
                    setSelectedDayFilter(getISTDayOfWeek(d));
                  }
                }}
                className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Weekday Selector Bar */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20 overflow-x-auto no-scrollbar max-w-full">
          {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const).map(d => {
            const dayDate = getDateForWeekdayInCurrentWeek(d, todayISO);
            const isDaySelected = selectedDayFilter === d;
            const isDayToday = d === todayDay;

            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSelectedDayFilter(d);
                  setSessionDate(dayDate);
                }}
                className={clsx(
                  'px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5',
                  isDaySelected
                    ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)] font-black'
                    : isDayToday
                      ? 'text-emerald-400 border border-emerald-500/30 hover:text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                )}
                title={formatDateFull(dayDate)}
              >
                <span>{d}</span>
                <span className={clsx(
                  'text-[10px] opacity-75 font-mono',
                  isDaySelected ? 'text-slate-900' : 'text-slate-500'
                )}>
                  {dayDate.substring(8)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Classes Cards Grid */}
        {dayClasses.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-emerald-500/20 text-center space-y-3">
            <Calendar className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="font-bold text-white text-sm">
              {selectedDayFilter === 'SUN'
                ? 'Today is Sunday (Weekend / Holiday)'
                : `No teaching lectures scheduled for ${selectedDayFilter} (${formatDateFull(sessionDate)})`}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {selectedDayFilter === 'SUN' 
                ? 'College academic lectures are not held on Sundays. Classes resume on Monday. You can select Monday–Saturday tabs to review weekly assignments.'
                : `No active teaching periods are assigned to you on ${selectedDayFilter} in the published timetable.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dayClasses.map(cls => {
              const sub = subjects.find(s => s.id === cls.subject_id) || cls.subject;
              const sec = sections.find(s => s.id === cls.section_id) || cls.section;
              const enrolledStudents = students.filter(s => s.section_id === sec?.id && s.active);

              // Look up live session strictly for sessionDate and class/slot
              const existingSess = attendanceSessions.find(
                s => (s.session_date?.split('T')[0] || s.session_date) === sessionDate && 
                     (s.timetable_entry_id === cls.id || 
                      (s.section_id === sec?.id && 
                       s.subject_id === cls.subject_id && 
                       (s.start_time?.substring(0, 5) === cls.start_time?.substring(0, 5) || !cls.start_time)))
              );

              const records = existingSess 
                ? attendanceRecords.filter(r => r.attendance_session_id === existingSess.id)
                : [];
              const classPresentCount = records.filter(r => r.status === 'Present').length;
              const enrolledCount = enrolledStudents.length;
              const totalCount = records.length > 0 ? records.length : enrolledCount;

              return (
                <div
                  key={cls.id}
                  className="glass-card rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-4 border border-emerald-500/20 hover:border-emerald-500/40 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.1)]"
                >
                  <div className="space-y-3">
                    {/* Top Row: Time & Section */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-slate-950 border border-emerald-500/30 text-[#00ff88]">
                        {cls.start_time?.substring(0, 5)} – {cls.end_time?.substring(0, 5)} (P{cls.period_number})
                      </span>
                      {(() => {
                        const sem = semesters.find(s => s.id === sec?.semester_id);
                        const yr = years.find(y => y.id === sem?.academic_year_id);
                        return (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                            {yr?.name ? `${yr.name} • ` : ''}Section {sec?.name}
                          </span>
                        );
                      })()}
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
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{cls.room_number || sec?.room_number || 'Room TBD'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{enrolledCount} Students</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Status & Action */}
                  <div className="pt-3 border-t border-emerald-500/15 flex items-center justify-between gap-2">
                    {isFuture ? (
                      <>
                        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>Upcoming</span>
                        </div>
                        <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700/60 text-slate-500">
                          Not Available Yet
                        </span>
                      </>
                    ) : existingSess ? (
                      <>
                        <div className="text-[11px] font-bold text-[#00ff88] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>✓ Marked ({classPresentCount}/{totalCount})</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSessionDate(sessionDate);
                            setActiveClassId(cls.id);
                          }}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          className="touch-target font-bold border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                        >
                          {isToday ? 'View / Update' : 'View Attendance'}
                        </Button>
                      </>
                    ) : isToday ? (
                      <>
                        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Not Recorded</span>
                        </div>
                        <Button
                          size="sm"
                          variant="neon"
                          onClick={() => {
                            setSessionDate(sessionDate);
                            setActiveClassId(cls.id);
                          }}
                          leftIcon={<CheckSquare className="w-3.5 h-3.5 text-slate-950" />}
                          className="touch-target font-black"
                        >
                          Take Attendance
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Not Marked</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSessionDate(sessionDate);
                            setActiveClassId(cls.id);
                          }}
                          className="touch-target border-slate-800 text-slate-400 hover:text-white text-xs"
                        >
                          Mark Historical
                        </Button>
                      </>
                    )}
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
  // VIEW 2: ACTIVE LECTURE ATTENDANCE MARKING SHEET (REDESIGNED FAST UI)
  // =========================================================================
  return (
    <div className="space-y-4 pb-80 md:pb-36">
      {/* 1. Class Context Header Bar */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => safelyNavigate(() => setActiveClassId(null))}
            className="p-2.5 rounded-2xl bg-slate-950 border border-emerald-500/30 text-[#00ff88] hover:bg-emerald-500/10 transition-all shrink-0 cursor-pointer flex items-center justify-center min-h-[44px] min-w-[44px]"
            title="Back to Assigned Schedule"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 font-mono text-xs font-bold text-[#00ff88]">
                {activeSubject?.subject_code}
              </span>
              {(() => {
                const sem = semesters.find(s => s.id === activeSection?.semester_id);
                const yr = years.find(y => y.id === sem?.academic_year_id);
                return (
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-emerald-500/20 text-xs font-bold text-white">
                    {yr?.name ? `${yr.name} • ` : ''}Section {activeSection?.name}
                  </span>
                );
              })()}
              <span className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-700 text-xs font-mono text-slate-300">
                {roomNumber}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1 truncate">
              {activeSubject?.subject_name}
            </h1>
          </div>
        </div>

        {/* Date Selector & Session Status & Mobile Save Action */}
        <div className="flex items-center gap-2 sm:gap-3 self-end md:self-auto">
          <div className="flex items-center gap-2 bg-slate-950/90 border border-emerald-500/30 px-3 py-1.5 rounded-2xl text-xs">
            <Calendar className="w-4 h-4 text-[#00ff88]" />
            <input
              type="date"
              max={todayISO}
              value={sessionDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (newDate !== sessionDate) {
                  safelyNavigate(() => setSessionDate(newDate));
                }
              }}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
            />
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-950/80 border border-emerald-500/20 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-[#00ff88]" />
            <span className="font-mono">{timeSlot}</span>
          </div>

          {/* Mobile Direct Header Save Button */}
          <Button
            size="sm"
            variant={saveButtonConfig.variant}
            leftIcon={saveButtonConfig.icon}
            onClick={handleInitiateSave}
            disabled={sectionStudents.length === 0 || saveButtonConfig.disabled}
            className={clsx('md:hidden font-black text-xs py-1.5 px-3 min-h-[44px]', saveButtonConfig.className)}
          >
            {saveButtonConfig.label}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Attendance recorded and synced to Supabase database successfully!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* 2. Progress & Live Summary Bar */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-emerald-500/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/50 font-bold text-slate-300">
              Total: <strong className="text-white text-sm ml-1">{sectionStudents.length}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 font-bold text-emerald-400">
              Present: <strong className="text-white text-sm ml-1">{presentCount}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 font-bold text-rose-400">
              Absent: <strong className="text-white text-sm ml-1">{absentCount}</strong>
            </span>
            {unmarkedCount > 0 ? (
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/35 font-bold text-amber-300 animate-pulse">
                Not Marked: <strong className="text-white text-sm ml-1">{unmarkedCount}</strong>
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 font-bold text-[#00ff88] flex items-center gap-1.5">
                <CheckCheck className="w-3.5 h-3.5" />
                All Students Marked
              </span>
            )}
          </div>

          <div className="text-xs font-mono font-bold text-slate-400">
            Progress: <span className="text-[#00ff88] text-sm">{completionPercent}%</span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-slate-950/90 rounded-full h-2 overflow-hidden border border-emerald-500/20">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-[#00ff88] transition-all duration-300 shadow-[0_0_10px_rgba(0,255,136,0.5)]"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* 3. Dedicated Attendance Actions Section */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-emerald-500/25 bg-slate-900/90 shadow-xl space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/15 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_8px_rgba(0,255,136,0.6)]" />
            <h3 className="text-sm font-black text-white tracking-wide uppercase font-mono">
              Attendance Actions
            </h3>
            <span className="text-slate-500 text-xs hidden sm:inline">•</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              {sectionStudents.length} Enrolled ({hasUnsavedChanges ? `${changedCount} Pending` : (existingSession && (presentCount > 0 || absentCount > 0) ? 'Saved' : 'Ready')})
            </span>
          </div>

          {/* Desktop Keyboard Shortcuts Hint */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-emerald-500/15 font-mono">
            <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
            <span><strong className="text-white">P</strong> = Present</span>
            <span>•</span>
            <span><strong className="text-white">A</strong> = Absent</span>
            <span>•</span>
            <span><strong className="text-white">↑/↓</strong> = Navigate</span>
            <span>•</span>
            <span><strong className="text-white">/</strong> = Search</span>
            <span>•</span>
            <span><strong className="text-white">Ctrl+Z</strong> = Undo</span>
          </div>
        </div>

        {/* Action Rows Container */}
        <div className="space-y-3">
          {/* ROW / GROUP 1: Bulk Marking & History */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block sm:hidden">
              Bulk Marking
            </span>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <Button 
                size="md" 
                variant="outline" 
                onClick={handleMarkAllPresent}
                leftIcon={<CheckCircle2 className="w-4 h-4 text-[#00ff88]" />}
                className="w-full sm:w-auto min-h-[48px] sm:min-h-[40px] text-xs font-bold border-emerald-500/30 hover:border-[#00ff88] hover:bg-emerald-500/10 text-white"
              >
                Mark All Present
              </Button>
              <Button 
                size="md" 
                variant="outline" 
                onClick={handleMarkAllAbsent}
                leftIcon={<XCircle className="w-4 h-4 text-rose-400" />}
                className="w-full sm:w-auto min-h-[48px] sm:min-h-[40px] text-xs font-bold border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10 text-white"
              >
                Mark All Absent
              </Button>
              {unmarkedCount > 0 && (
                <Button 
                  size="md" 
                  variant="outline" 
                  onClick={handleMarkRemainingPresent}
                  className="col-span-2 sm:col-span-1 min-h-[48px] sm:min-h-[40px] text-xs font-bold text-amber-300 border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10"
                >
                  Remaining → Present ({unmarkedCount})
                </Button>
              )}
              <Button 
                size="md" 
                variant="ghost" 
                onClick={handleUndo}
                disabled={history.length === 0}
                leftIcon={<RotateCcw className="w-4 h-4" />}
                className={clsx(
                  'col-span-2 sm:col-span-1 min-h-[48px] sm:min-h-[40px] text-xs font-bold border border-slate-700/50 hover:bg-slate-800',
                  history.length === 0 ? 'opacity-40 cursor-not-allowed text-slate-500' : 'text-slate-300 hover:text-white'
                )}
                title="Undo last change (Ctrl+Z / ⌘Z)"
              >
                Undo {history.length > 0 ? `(${history.length})` : ''}
              </Button>
            </div>
          </div>

          {/* ROW / GROUP 2: Reset & Clear Controls */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block sm:hidden">
              Reset & Clear
            </span>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <Button 
                size="md" 
                variant="outline" 
                onClick={handleResetToSaved}
                disabled={!hasUnsavedChanges}
                leftIcon={<RotateCcw className="w-4 h-4 text-amber-400" />}
                className={clsx(
                  'w-full sm:w-auto min-h-[48px] sm:min-h-[40px] text-xs font-bold border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/10 text-amber-300',
                  !hasUnsavedChanges && 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500 hover:bg-transparent'
                )}
                title="Revert modified marks to database baseline"
              >
                Reset Unsaved Marks
              </Button>
              <Button 
                size="md" 
                variant="outline" 
                onClick={() => setIsClearModalOpen(true)}
                leftIcon={<Trash2 className="w-4 h-4 text-rose-400" />}
                className="w-full sm:w-auto min-h-[48px] sm:min-h-[40px] text-xs font-bold text-rose-300 border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10"
                title="Open Clear Attendance dialog"
              >
                Clear Attendance
              </Button>
            </div>
          </div>

          {/* ROW / GROUP 3: Primary Save Attendance */}
          <div className="pt-2 border-t border-emerald-500/15 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-400 hidden sm:block">
              {hasUnsavedChanges ? (
                <span className="text-amber-300 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {changedCount} unsaved mark(s) ready to commit to Supabase
                </span>
              ) : existingSession && (presentCount > 0 || absentCount > 0) && !hasUnsavedChanges ? (
                <span className="text-[#00ff88] flex items-center gap-1.5 font-medium">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Attendance synchronized with Supabase
                </span>
              ) : (
                <span>Mark attendance above and click Save Attendance to commit.</span>
              )}
            </div>
            <Button
              size="lg"
              variant={saveButtonConfig.variant}
              leftIcon={saveButtonConfig.icon}
              onClick={handleInitiateSave}
              disabled={sectionStudents.length === 0 || saveButtonConfig.disabled}
              className={clsx(
                'w-full sm:w-auto min-h-[48px] px-6 text-sm font-black tracking-wide shadow-lg cursor-pointer',
                saveButtonConfig.className
              )}
            >
              {saveButtonConfig.label}
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Search and Status Filter Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search student by name or roll number... (Press / to focus)"
            value={studentSearch}
            onChange={(e) => {
              setStudentSearch(e.target.value);
              setFocusedIndex(0);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/90 border border-emerald-500/25 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-emerald-500/20 text-xs font-bold shrink-0">
          <button
            onClick={() => { setStatusFilter('ALL'); setFocusedIndex(0); }}
            className={clsx(
              'px-3 py-1.5 rounded-xl transition-all cursor-pointer',
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            All ({sectionStudents.length})
          </button>
          <button
            onClick={() => { setStatusFilter('UNMARKED'); setFocusedIndex(0); }}
            className={clsx(
              'px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1',
              statusFilter === 'UNMARKED'
                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                : 'text-amber-400/80 hover:text-amber-300'
            )}
          >
            Unmarked ({unmarkedCount})
          </button>
          <button
            onClick={() => { setStatusFilter('PRESENT'); setFocusedIndex(0); }}
            className={clsx(
              'px-3 py-1.5 rounded-xl transition-all cursor-pointer',
              statusFilter === 'PRESENT'
                ? 'bg-emerald-500/25 text-[#00ff88] border border-emerald-500/40'
                : 'text-emerald-400/80 hover:text-emerald-300'
            )}
          >
            Present ({presentCount})
          </button>
          <button
            onClick={() => { setStatusFilter('ABSENT'); setFocusedIndex(0); }}
            className={clsx(
              'px-3 py-1.5 rounded-xl transition-all cursor-pointer',
              statusFilter === 'ABSENT'
                ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                : 'text-rose-400/80 hover:text-rose-300'
            )}
          >
            Absent ({absentCount})
          </button>
        </div>
      </div>

      {/* 5. Student List (Optimized Fast Dual-Pill Rows) */}
      <div className="space-y-2">
        {filteredStudents.length === 0 ? (
          <div className="glass-panel p-10 text-center text-xs text-slate-400 rounded-3xl border border-emerald-500/15 space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-bold text-white text-sm">No students match current filter</p>
            <p className="text-slate-500">Try adjusting your search query or status filter above</p>
          </div>
        ) : (
          filteredStudents.map((stud, idx) => {
            const status = attendanceMap[stud.id] || 'Unmarked';
            const isFocused = idx === focusedIndex;

            return (
              <div
                key={stud.id}
                onClick={() => setFocusedIndex(idx)}
                className={clsx(
                  'p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3',
                  isFocused 
                    ? 'border-[#00ff88]/60 bg-slate-900/90 shadow-[0_0_15px_rgba(0,255,136,0.1)] ring-1 ring-[#00ff88]/40' 
                    : 'border-emerald-500/15 bg-slate-950/70 hover:border-emerald-500/35 hover:bg-slate-900/50',
                  status === 'Present' && 'border-l-4 border-l-[#00ff88]',
                  status === 'Absent' && 'border-l-4 border-l-rose-500',
                  status === 'Unmarked' && 'border-l-4 border-l-amber-400'
                )}
              >
                {/* Left: Index, Roll, Name */}
                <div className="min-w-0 flex-1 flex items-center gap-3">
                  <span className="w-7 text-right font-mono text-[11px] font-bold text-slate-500 shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#00ff88] tracking-wider">
                        {stud.roll_number}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                        {stud.admission_type || 'Regular'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white truncate mt-0.5">
                      {stud.full_name}
                    </h4>
                  </div>
                </div>

                {/* Right: Dual-Pill Toggle [P] [A] */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* PRESENT PILL */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStudentStatus(stud.id, status === 'Present' ? 'Unmarked' : 'Present');
                      setFocusedIndex(idx);
                    }}
                    className={clsx(
                      'px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                      status === 'Present'
                        ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.4)] scale-105'
                        : 'bg-slate-900 text-slate-400 border border-emerald-500/20 hover:border-[#00ff88]/50 hover:text-emerald-300'
                    )}
                    title="Mark Present (P)"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>P</span>
                    <span className="hidden sm:inline text-[11px]">RESENT</span>
                  </button>

                  {/* ABSENT PILL */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStudentStatus(stud.id, status === 'Absent' ? 'Unmarked' : 'Absent');
                      setFocusedIndex(idx);
                    }}
                    className={clsx(
                      'px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                      status === 'Absent'
                        ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)] scale-105'
                        : 'bg-slate-900 text-slate-400 border border-rose-500/20 hover:border-rose-500/50 hover:text-rose-300'
                    )}
                    title="Mark Absent (A)"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>A</span>
                    <span className="hidden sm:inline text-[11px]">BSENT</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5b. Mobile & Tablet In-Flow Attendance Action Bar (Architecture Component 6) */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-emerald-500/25 bg-slate-900/90 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/15 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse" />
            <h4 className="text-xs font-black uppercase tracking-wider text-white font-mono">
              Attendance Action Bar • End of Roster
            </h4>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold">
            {sectionStudents.length} Students ({hasUnsavedChanges ? `${changedCount} Pending` : (existingSession && (presentCount > 0 || absentCount > 0) ? 'All Synced' : 'Ready')})
          </span>
        </div>

        {/* Responsive 3-Row Stacked Grid (Section 3 of Specification) */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
          {/* Row 1: Bulk Marking */}
          <Button
            size="md"
            variant="outline"
            onClick={handleMarkAllPresent}
            leftIcon={<CheckCircle2 className="w-4 h-4 text-[#00ff88]" />}
            className="w-full sm:w-auto min-h-[48px] text-xs font-bold border-emerald-500/30 hover:border-[#00ff88] hover:bg-emerald-500/10 text-white"
          >
            Mark All Present
          </Button>
          <Button
            size="md"
            variant="outline"
            onClick={handleMarkAllAbsent}
            leftIcon={<XCircle className="w-4 h-4 text-rose-400" />}
            className="w-full sm:w-auto min-h-[48px] text-xs font-bold border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10 text-white"
          >
            Mark All Absent
          </Button>

          {/* Row 2: Clear & Save */}
          <Button
            size="md"
            variant="outline"
            onClick={() => setIsClearModalOpen(true)}
            leftIcon={<Trash2 className="w-4 h-4 text-rose-400" />}
            className="w-full sm:w-auto min-h-[48px] text-xs font-bold text-rose-300 border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10"
          >
            Clear Attendance
          </Button>
          <Button
            size="md"
            variant={saveButtonConfig.variant}
            leftIcon={saveButtonConfig.icon}
            onClick={handleInitiateSave}
            disabled={sectionStudents.length === 0 || saveButtonConfig.disabled}
            className={clsx(
              'w-full sm:w-auto min-h-[48px] px-6 text-xs sm:text-sm font-black tracking-wide shadow-lg',
              saveButtonConfig.className
            )}
          >
            {saveButtonConfig.label}
          </Button>

          {/* Row 3: Remaining & Undo / Reset */}
          {unmarkedCount > 0 ? (
            <Button
              size="md"
              variant="outline"
              onClick={handleMarkRemainingPresent}
              className="w-full sm:w-auto min-h-[48px] text-xs font-bold text-amber-300 border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10"
            >
              Remaining → Present ({unmarkedCount})
            </Button>
          ) : (
            <Button
              size="md"
              variant="outline"
              onClick={handleResetToSaved}
              disabled={!hasUnsavedChanges}
              leftIcon={<RotateCcw className="w-4 h-4 text-amber-400" />}
              className={clsx(
                'w-full sm:w-auto min-h-[48px] text-xs font-bold border-amber-500/30 text-amber-300',
                !hasUnsavedChanges && 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
              )}
            >
              Reset Unsaved Marks
            </Button>
          )}
          <Button
            size="md"
            variant="ghost"
            onClick={handleUndo}
            disabled={history.length === 0}
            leftIcon={<RotateCcw className="w-4 h-4" />}
            className={clsx(
              'w-full sm:w-auto min-h-[48px] text-xs font-bold border border-slate-700/50 hover:bg-slate-800',
              history.length === 0 ? 'opacity-40 cursor-not-allowed text-slate-500' : 'text-slate-300 hover:text-white'
            )}
            title="Undo last change (Ctrl+Z / ⌘Z)"
          >
            Undo {history.length > 0 ? `(${history.length})` : ''}
          </Button>
        </div>
      </div>

      {/* 6. Sticky Floating Bottom Action Bar (Positioned strictly ABOVE mobile bottom nav) */}
      <div className="fixed bottom-[var(--app-bottom-nav-height,calc(4.25rem+max(env(safe-area-inset-bottom,0px),16px)))] md:bottom-0 left-0 right-0 md:left-64 z-40 bg-slate-950/95 border-t border-emerald-500/30 backdrop-blur-2xl p-2.5 sm:p-3.5 px-3 sm:px-6 shadow-[0_-8px_30px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
          {/* Top Line on Mobile / Left on Desktop: Realtime Attendance Metrics & Controls */}
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 text-xs font-bold">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00ff88]" />
                <span>{presentCount}</span>
                <span className="text-[10px] sm:text-[11px]">P</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-rose-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>{absentCount}</span>
                <span className="text-[10px] sm:text-[11px]">A</span>
              </span>
              {unmarkedCount > 0 ? (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-300 flex items-center gap-1 font-mono">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>{unmarkedCount}</span>
                    <span className="text-[10px] sm:text-[11px]">Unmarked</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-slate-600 hidden xs:inline">•</span>
                  <span className="text-[#00ff88] hidden xs:flex items-center gap-1 text-[11px]">
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>All Marked</span>
                  </span>
                </>
              )}
            </div>

            {/* Mobile Quick Action Buttons (Undo & Clear) */}
            <div className="flex items-center gap-1.5 sm:hidden">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 min-h-[36px]"
                  title="Undo last mark"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-[11px] font-bold flex items-center gap-1 min-h-[36px]"
                title="Clear attendance"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Bottom Line on Mobile (Full Width) / Right on Desktop: Primary Save Action */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              size="md"
              variant={saveButtonConfig.variant}
              leftIcon={saveButtonConfig.icon}
              onClick={handleInitiateSave}
              disabled={sectionStudents.length === 0 || saveButtonConfig.disabled}
              className={clsx(
                'font-black text-xs sm:text-sm py-2 sm:py-2.5 px-4 sm:px-6 min-h-[48px] sm:min-h-[44px] w-full sm:w-auto justify-center shadow-lg',
                saveButtonConfig.className
              )}
            >
              {saveButtonConfig.label}
            </Button>
          </div>
        </div>
      </div>

      {/* 7. Unmarked Students Review Modal */}
      <Modal
        isOpen={isUnmarkedReviewOpen}
        onClose={() => setIsUnmarkedReviewOpen(false)}
        title="Unmarked Students Remaining"
        description={`There are ${unmarkedCount} student(s) in Section ${activeSection?.name} currently unmarked.`}
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Attendance Submission Options</p>
              <p className="text-slate-400 mt-0.5">
                You can save partial attendance now, mark all remaining students before submitting, or return to the sheet.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="neon"
              size="sm"
              className="w-full justify-start text-xs font-bold"
              leftIcon={<Save className="w-4 h-4 text-slate-950" />}
              onClick={() => {
                executeSave(attendanceMap);
              }}
            >
              Save Partial Attendance ({presentCount} Present, {absentCount} Absent, {unmarkedCount} Unmarked)
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs border-rose-500/30 hover:border-rose-500 text-rose-300"
              leftIcon={<XCircle className="w-4 h-4 text-rose-400" />}
              onClick={() => {
                const final = { ...attendanceMap };
                sectionStudents.forEach(s => {
                  if ((final[s.id] || 'Unmarked') === 'Unmarked') final[s.id] = 'Absent';
                });
                executeSave(final);
              }}
            >
              Mark Remaining {unmarkedCount} as Absent & Save Now
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs border-emerald-500/30 hover:border-emerald-500 text-emerald-300"
              leftIcon={<CheckCircle2 className="w-4 h-4 text-[#00ff88]" />}
              onClick={() => {
                const final = { ...attendanceMap };
                sectionStudents.forEach(s => {
                  if ((final[s.id] || 'Unmarked') === 'Unmarked') final[s.id] = 'Present';
                });
                executeSave(final);
              }}
            >
              Mark Remaining {unmarkedCount} as Present & Save Now
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-slate-400 hover:text-white"
              onClick={() => {
                setIsUnmarkedReviewOpen(false);
                setStatusFilter('UNMARKED');
                setFocusedIndex(0);
              }}
            >
              Cancel & Review Unmarked Students
            </Button>
          </div>
        </div>
      </Modal>

      {/* 8. Standard Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => executeSave(attendanceMap)}
        title="Confirm Attendance Submission"
        message={`Save attendance for Section ${activeSection?.name} (${activeSubject?.subject_name}) on ${sessionDate}? Total: ${sectionStudents.length} (Present: ${presentCount}, Absent: ${absentCount}${unmarkedCount > 0 ? `, Unmarked: ${unmarkedCount}` : ''}).`}
        confirmText={isSaving ? 'Submitting...' : 'Confirm & Save to Supabase'}
        variant="neon"
        isLoading={isSaving}
      />

      {/* 9. Unsaved Changes Navigation Guard Modal */}
      <Modal
        isOpen={isNavConfirmOpen}
        onClose={() => {
          setIsNavConfirmOpen(false);
          setPendingNavAction(null);
        }}
        title="Unsaved Attendance Changes"
        description="You have unsaved marks on this sheet. If you navigate away now, these modifications will be lost."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Changes will not be saved to Supabase</p>
              <p className="text-slate-400 mt-0.5">
                {changedCount} student mark(s) have been modified. Choose whether to save or discard your changes before leaving this session.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsNavConfirmOpen(false);
                setPendingNavAction(null);
              }}
              className="w-full sm:w-auto text-xs"
            >
              Stay on Page
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscardAndLeave}
              className="w-full sm:w-auto text-xs border-rose-500/30 hover:border-rose-500 text-rose-300"
            >
              Discard & Proceed
            </Button>
            <Button
              variant="neon"
              size="sm"
              onClick={handleSaveAndLeave}
              isLoading={isSaving}
              className="w-full sm:w-auto text-xs font-black"
            >
              Save & Proceed
            </Button>
          </div>
        </div>
      </Modal>

      {/* 10. Clear Attendance Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="Clear Attendance"
        description="Select how you wish to clear or reset the attendance marks for this lecture session."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          {/* Option 1: Reset Unsaved Marks */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Reset Unsaved Marks
              </h4>
              {hasUnsavedChanges && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                  {changedCount} unsaved
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reverts all marks on screen back to the last saved database state ({existingSession ? 'previously saved session' : 'all unmarked'}) without altering database history.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasUnsavedChanges}
              onClick={handleResetToSaved}
              className={clsx(
                'w-full min-h-[44px] text-xs font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/10',
                !hasUnsavedChanges && 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
              )}
            >
              Revert to Database Baseline
            </Button>
          </div>

          {/* Option 2: Delete Saved Attendance */}
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Delete Saved Attendance
              </h4>
              {existingSession && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold">
                  Active in DB
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Permanently delete this saved lecture session and all student attendance records from Supabase. Requires explicit confirmation.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!existingSession}
              onClick={() => {
                setIsClearModalOpen(false);
                setIsDeleteConfirmOpen(true);
              }}
              className={clsx(
                'w-full min-h-[44px] text-xs font-bold text-rose-300 border-rose-500/40 hover:bg-rose-500/20 hover:border-rose-500',
                !existingSession && 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
              )}
            >
              {existingSession ? 'Delete Saved Attendance Session...' : 'No Saved Session in Database'}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-slate-400 hover:text-white"
            onClick={() => setIsClearModalOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {/* 11. Delete Saved Attendance Session Confirmation Dialog */}
      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          if (!isDeletingSession) setIsDeleteConfirmOpen(false);
        }}
        title="Delete Saved Attendance?"
        description="This action will permanently delete this lecture session and all associated attendance marks from Supabase."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-300">Permanent Database Deletion</p>
              <p className="text-slate-300 mt-0.5">
                This will remove the lecture record for all {sectionStudents.length} students. HOD and student dashboards will no longer reflect this session.
              </p>
            </div>
          </div>

          {/* Session Details Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Date:</span>
              <span className="text-white font-bold">{formattedSessionDate}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Subject:</span>
              <span className="text-emerald-400 font-bold text-right truncate max-w-[200px]">
                {activeSubject?.subject_code} — {activeSubject?.subject_name}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Section:</span>
              <span className="text-white font-bold">Section {activeSection?.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Lecture Time:</span>
              <span className="text-amber-300 font-bold">{timeSlot}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Faculty:</span>
              <span className="text-white font-bold">{currentFaculty?.full_name || user?.full_name || 'Assigned Faculty'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isDeletingSession}
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="w-full sm:w-auto min-h-[44px] text-xs text-slate-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSavedSession}
              isLoading={isDeletingSession}
              className="w-full sm:w-auto min-h-[44px] text-xs font-bold border-rose-500 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 hover:border-rose-400"
            >
              {isDeletingSession ? 'Deleting from Supabase...' : '🗑 Delete Attendance'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  Award, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  ArrowRight,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Layers,
  GraduationCap,
  Loader2,
  X,
  MessageSquare
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { CardSkeleton, TimetableSkeleton } from '../../components/common/SkeletonLoader';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { 
  getISTDayOfWeek, 
  getISTTodayDate, 
  getDateForWeekdayInCurrentWeek, 
  formatDateFull, 
  isDateInFuture, 
  isDateToday, 
  isDateInPast 
} from '../../lib/utils/dateUtils';
import { DayOfWeek, FacultyDashboardPayload, AttendanceCorrection } from '../../types/database.types';
import { supabaseService } from '../../lib/services/supabaseService';
import { supabase } from '../../lib/supabase/supabaseClient';

interface FacultyDashboardProps {
  onNavigate: (tab: string, params?: any) => void;
}

const DAY_FULL_NAMES: Record<DayOfWeek, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { 
    timetable, 
    assignments, 
    subjects, 
    sections, 
    years,
    semesters,
    corrections, 
    departments,
    students,
    courseAssignments,
    quizzes,
    sessionalAssessments,
    faculty: facultyList,
    attendanceSessions,
    attendanceRecords,
    getAttendanceSummary,
    ensureSessionAttendanceLoaded,
    getFacultyCorrectionRequests,
    getPublishedTimetable,
    getFacultyTimetable,
    classCoordinatorAssignments,
    getFacultyCoordinatorAssignments,
    refreshCoordinatorAssignments,
    reviewCorrectionRequest,
    refreshData
  } = useAcademic();

  const currentFaculty = facultyList.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;

  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';

  // Fast-loading scoped faculty dashboard payload from Supabase
  const [scopedDashboardData, setScopedDashboardData] = useState<FacultyDashboardPayload | null>(null);
  const [isScopedLoading, setIsScopedLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    if (!facultyId) {
      setIsScopedLoading(false);
      return;
    }

    const loadScoped = async () => {
      try {
        const payload = await supabaseService.fetchFacultyDashboardData(facultyId);
        if (isMounted && payload) {
          setScopedDashboardData(payload);
        }
      } catch (err) {
        console.error('Failed to load scoped faculty dashboard data:', err);
      } finally {
        if (isMounted) setIsScopedLoading(false);
      }
    };

    loadScoped();

    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadScoped();
      }, 150);
    };

    // Subscribe to realtime updates for this faculty member
    const channel = supabase
      .channel(`faculty-dashboard-${facultyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_entries', filter: `faculty_id=eq.${facultyId}` }, () => {
        debouncedLoad();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_coordinator_assignments', filter: `faculty_id=eq.${facultyId}` }, () => {
        debouncedLoad();
        refreshCoordinatorAssignments(facultyId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: `faculty_id=eq.${facultyId}` }, () => {
        debouncedLoad();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_corrections' }, () => {
        debouncedLoad();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        debouncedLoad();
      })
      .subscribe();

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [facultyId, refreshCoordinatorAssignments]);

  const todayDay = getISTDayOfWeek();
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<DayOfWeek>(
    todayDay === 'SUN' ? 'MON' : todayDay
  );

  // Authoritative timetable entries for this faculty (filtering out breaks and entries without subject)
  const myTt = useMemo(() => {
    if (scopedDashboardData?.timetable && scopedDashboardData.timetable.length > 0) {
      return scopedDashboardData.timetable;
    }
    return getFacultyTimetable(facultyId).filter(t => !t.is_break && t.subject_id);
  }, [scopedDashboardData, getFacultyTimetable, facultyId]);

  // Today's classes for this faculty strictly from Supabase timetable
  const todaySchedule = useMemo(() => {
    if (scopedDashboardData?.todaySchedule) {
      return scopedDashboardData.todaySchedule;
    }
    return todayDay === 'SUN' 
      ? [] 
      : myTt
          .filter(t => t.day_of_week === todayDay)
          .sort((a, b) => a.period_number - b.period_number);
  }, [scopedDashboardData, myTt, todayDay]);

  // Schedule for the selected day filter
  const displayedSchedule = useMemo(() => {
    return myTt
      .filter(t => t.day_of_week === selectedScheduleDay)
      .sort((a, b) => a.period_number - b.period_number);
  }, [myTt, selectedScheduleDay]);

  const todayISO = getISTTodayDate();
  const selectedScheduleDate = useMemo(() => {
    return getDateForWeekdayInCurrentWeek(selectedScheduleDay, todayISO);
  }, [selectedScheduleDay, todayISO]);

  // Authoritative assigned sections: distinct sections where this faculty actually teaches or is assigned
  const mySectionIds = useMemo(() => {
    const fromTt = myTt.map(t => t.section_id).filter(Boolean);
    const fromAssignments = (assignments || [])
      .filter(a => a.faculty_id === facultyId && a.active)
      .map(a => a.section_id)
      .filter(Boolean);
    return Array.from(new Set([...fromTt, ...fromAssignments]));
  }, [myTt, assignments, facultyId]);

  // Enriched section details with authoritative academic year from database hierarchy
  const enrichedAssignedSections = useMemo(() => {
    if (scopedDashboardData?.sections && scopedDashboardData.sections.length > 0) {
      return scopedDashboardData.sections;
    }
    return mySectionIds
      .map(secId => {
        const sec = sections.find(s => s.id === secId);
        if (!sec || !sec.active) return null;

        const sem = semesters.find(s => s.id === sec.semester_id);
        const yr = years.find(y => y.id === sem?.academic_year_id);

        // Strictly exclude 1st Year (year_number === 1)
        if (yr?.year_number === 1) return null;

        const secStudents = students.filter(s => s.section_id === sec.id && s.active);

        // Subjects taught or assigned to this faculty for this specific section
        const fromTtSubs = myTt.filter(t => t.section_id === sec.id).map(t => t.subject_id);
        const fromAsgnSubs = (assignments || [])
          .filter(a => a.faculty_id === facultyId && a.section_id === sec.id && a.active)
          .map(a => a.subject_id);
        const secSubjectIds = Array.from(new Set([...fromTtSubs, ...fromAsgnSubs].filter(Boolean)));
        const subjectsInSec = subjects.filter(sub => secSubjectIds.includes(sub.id) && sub.active);

        const cleanSecName = (sec.name || '').replace(/^section\s*/i, '').trim();
        const rawRoom = sec.room_number || '';
        const cleanRoom = rawRoom ? rawRoom.replace(/^Room\s*(No\.?\s*)?/i, '').trim() : 'Room TBD';

        return {
          sec,
          sem,
          year: yr,
          yearName: yr?.name || 'Academic Year',
          yearNumber: yr?.year_number || 0,
          cleanSecName,
          cleanRoom: cleanRoom || 'Room TBD',
          studentCount: secStudents.length,
          subjectsInSec,
        };
      })
      .filter(Boolean) as Array<{
        sec: (typeof sections)[0];
        sem?: (typeof semesters)[0];
        year?: (typeof years)[0];
        yearName: string;
        yearNumber: number;
        cleanSecName: string;
        cleanRoom: string;
        studentCount: number;
        subjectsInSec: typeof subjects;
      }>;
  }, [scopedDashboardData, mySectionIds, sections, semesters, years, students, myTt, assignments, facultyId, subjects]);

  // Distinct academic years for filtering (only years where faculty is actually assigned)
  const distinctAssignedYears = useMemo(() => {
    const yearMap = new Map<string, { id: string; name: string; year_number: number; count: number }>();
    enrichedAssignedSections.forEach(item => {
      if (item.year) {
        const existing = yearMap.get(item.year.id);
        if (existing) {
          existing.count += 1;
        } else {
          yearMap.set(item.year.id, {
            id: item.year.id,
            name: item.year.name,
            year_number: item.year.year_number,
            count: 1,
          });
        }
      }
    });
    return Array.from(yearMap.values()).sort((a, b) => a.year_number - b.year_number);
  }, [enrichedAssignedSections]);

  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');

  // Filtered assigned sections based on selected academic year tab
  const displayedAssignedSections = useMemo(() => {
    const filtered = selectedYearFilter === 'ALL'
      ? enrichedAssignedSections
      : enrichedAssignedSections.filter(item => item.year?.id === selectedYearFilter);

    // Sort by Year Number ascending, then Section Name
    return [...filtered].sort((a, b) => {
      if (a.yearNumber !== b.yearNumber) {
        return a.yearNumber - b.yearNumber;
      }
      return a.cleanSecName.localeCompare(b.cleanSecName);
    });
  }, [enrichedAssignedSections, selectedYearFilter]);

  const mySections = useMemo(() => {
    return enrichedAssignedSections.map(item => item.sec);
  }, [enrichedAssignedSections]);

  // Authoritative assigned subjects: distinct subjects taught across these sections
  const mySubjects = useMemo(() => {
    if (scopedDashboardData?.subjects && scopedDashboardData.subjects.length > 0) {
      return scopedDashboardData.subjects;
    }
    const subIds = new Set<string>();
    enrichedAssignedSections.forEach(item => {
      item.subjectsInSec.forEach(s => subIds.add(s.id));
    });
    return subjects.filter(s => subIds.has(s.id) && s.active);
  }, [scopedDashboardData, enrichedAssignedSections, subjects]);

  // Pending correction requests assigned strictly to this faculty
  const myPendingCorrections = useMemo(() => {
    if (scopedDashboardData?.pendingCorrections) {
      return scopedDashboardData.pendingCorrections.filter(c => c.status === 'pending');
    }
    return getFacultyCorrectionRequests(facultyId).filter(c => c.status === 'pending');
  }, [scopedDashboardData, getFacultyCorrectionRequests, facultyId]);

  const todayClassesCount = scopedDashboardData?.todayClassesCount ?? todaySchedule.length;
  const weeklyLoadCount = scopedDashboardData?.weeklyLoad ?? myTt.length;
  const assignedSubjectsCount = scopedDashboardData?.assignedSubjectsCount ?? mySubjects.length;
  const assignedSectionsCount = scopedDashboardData?.assignedSectionsCount ?? enrichedAssignedSections.length;
  const pendingCorrectionsCount = scopedDashboardData?.pendingCorrectionsCount ?? myPendingCorrections.length;

  // Review Modal State
  const [selectedCorrectionForReview, setSelectedCorrectionForReview] = useState<AttendanceCorrection | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState<string>('Attendance verified from register; marked Present.');
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  const handleReviewAction = async (status: 'approved' | 'rejected') => {
    if (!selectedCorrectionForReview) return;
    setIsReviewing(true);
    setReviewError(null);
    try {
      await reviewCorrectionRequest({
        correctionId: selectedCorrectionForReview.id,
        status,
        reviewerFacultyId: facultyId,
        reviewRemarks: reviewRemarks.trim() || (status === 'approved' ? 'Attendance verified from register; marked Present.' : 'Attendance record verified; absence confirmed.')
      });
      // Optimistically update scopedDashboardData
      setScopedDashboardData(prev => {
        if (!prev) return prev;
        const updated = (prev.pendingCorrections || []).filter(c => c.id !== selectedCorrectionForReview.id);
        return {
          ...prev,
          pendingCorrections: updated,
          pendingCorrectionsCount: updated.length
        };
      });
      setReviewSuccessMsg(`Claim successfully ${status === 'approved' ? 'approved and student marked Present' : 'rejected'}.`);
      setTimeout(() => {
        setSelectedCorrectionForReview(null);
        setReviewSuccessMsg(null);
      }, 1200);
      // Reload fresh data from Supabase in background
      const payload = await supabaseService.fetchFacultyDashboardData(facultyId);
      if (payload) setScopedDashboardData(payload);
    } catch (err: any) {
      setReviewError(err?.message || `Failed to ${status} correction request.`);
    } finally {
      setIsReviewing(false);
    }
  };

  const dept = departments.find(d => d.id === currentFaculty?.department_id) || departments[0];

  return (
    <div className="space-y-6">
      {/* 1. WELCOME BANNER */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1 z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-serif-institutional tracking-tight">
            Welcome back, {currentFaculty?.full_name || user?.full_name || 'Faculty Member'} 👋
          </h1>
          <p className="text-[15px] text-[#475569] font-medium leading-relaxed">
            {currentFaculty?.designation || 'Faculty'} • {dept?.name || 'Academic Department'} • Code: <span className="text-[#0f172a] font-bold font-mono bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">{currentFaculty?.faculty_code || currentFaculty?.employee_code || 'FACULTY'}</span>
          </p>
        </div>

        <div className="z-10 flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate('take_attendance')}
            leftIcon={<CheckSquare className="w-4 h-4 text-white" />}
          >
            Mark Live Attendance
          </Button>
        </div>
      </div>

      {/* 2. STATS KPI CARDS */}
      {isScopedLoading && !scopedDashboardData && myTt.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <CardSkeleton count={5} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Today's Classes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs hover:border-slate-300 transition-all">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">Today's Classes</p>
              <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] mt-1 font-mono">
                {todayClassesCount}
              </h3>
              <span className="text-xs text-[#475569] font-medium">{todayDay} Timetable</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f172a]">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          {/* Weekly Teaching Load */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs hover:border-slate-300 transition-all">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">Weekly Teaching Load</p>
              <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] mt-1 font-mono">
                {weeklyLoadCount}
              </h3>
              <span className="text-xs text-[#475569] font-medium">Lectures / Week</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f172a]">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Assigned Subjects */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs hover:border-slate-300 transition-all">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">Assigned Subjects</p>
              <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] mt-1 font-mono">
                {assignedSubjectsCount}
              </h3>
              <span className="text-xs text-[#475569] font-medium">Theory & Labs</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f172a]">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>

          {/* Assigned Sections */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs hover:border-slate-300 transition-all">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">Assigned Sections</p>
              <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] mt-1 font-mono">
                {assignedSectionsCount}
              </h3>
              <span className="text-xs text-[#475569] font-medium">Active Sections</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f172a]">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          {/* Pending Requests */}
          <div 
            onClick={() => onNavigate('corrections')}
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between col-span-2 sm:col-span-1 shadow-xs hover:border-slate-300 transition-all cursor-pointer hover:shadow-sm group"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">Pending Requests</p>
              <h3 className="text-2xl sm:text-3xl font-black text-amber-900 mt-1 font-mono group-hover:text-amber-950">
                {pendingCorrectionsCount}
              </h3>
              <span className="text-xs text-amber-800 font-semibold">Requires Review →</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 group-hover:bg-amber-100 transition-all">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* 2.5 MY ASSIGNED CLASSES (SECTION-WISE SEPARATION) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a] font-serif-institutional tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-[#0f172a]" />
              MY ASSIGNED CLASSES
            </h3>
            <p className="text-[15px] sm:text-base text-[#475569] mt-1 font-medium leading-relaxed">
              Classes and subjects assigned to your teaching portfolio across sections
            </p>
          </div>
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 border border-slate-300 text-[#0f172a] self-start sm:self-auto font-mono">
            {enrichedAssignedSections.length} Assigned Sections
          </span>
        </div>

        {/* Multi-Year Filter Tabs (when faculty teaches across multiple academic years) */}
        {distinctAssignedYears.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
            <span className="text-sm font-bold text-[#334155] shrink-0">Filter by Year:</span>
            <button
              onClick={() => setSelectedYearFilter('ALL')}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0',
                selectedYearFilter === 'ALL'
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-[#475569] hover:text-[#0f172a] hover:bg-slate-50'
              )}
            >
              All Years ({enrichedAssignedSections.length})
            </button>
            {distinctAssignedYears.map(yr => (
              <button
                key={yr.id}
                onClick={() => setSelectedYearFilter(yr.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0',
                  selectedYearFilter === yr.id
                    ? 'bg-[#0f172a] text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-[#475569] hover:text-[#0f172a] hover:bg-slate-50'
                )}
              >
                {yr.name} ({yr.count})
              </button>
            ))}
          </div>
        )}

        {enrichedAssignedSections.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <BookOpen className="w-8 h-8 text-[#475569] mx-auto opacity-50" />
            <h4 className="text-base font-bold text-[#0f172a]">No published timetable or teaching assignments available</h4>
            <p className="text-[15px] text-[#475569] font-medium leading-relaxed">
              When teaching assignments or published timetable schedules are configured for your profile, your assigned classes, sections, and subjects will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedAssignedSections.map(({ sec, sem, year, yearName, cleanSecName, cleanRoom, studentCount, subjectsInSec }) => {
              return (
                <div
                  key={sec.id}
                  className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4 shadow-xs relative overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  {/* Section Banner Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#0f172a] text-white font-black flex items-center justify-center text-base shadow-xs">
                        {cleanSecName}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-[#0f172a] tracking-tight">
                            SECTION {cleanSecName}
                          </h4>
                          {yearName && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-[#0f172a] border border-slate-300">
                              {yearName}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#475569] font-mono mt-0.5 font-semibold">
                          {yearName} • {cleanRoom} • {studentCount} Students
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white border border-slate-300 text-[#0f172a] shadow-xs">
                      {subjectsInSec.length} Subjects
                    </span>
                  </div>

                  {/* Assigned Subjects in This Section */}
                  <div className="space-y-3 flex-1">
                    {subjectsInSec.length === 0 ? (
                      <div className="p-3 text-center text-sm text-[#475569] font-medium bg-white rounded-xl border border-slate-200">
                        Section allocated • Subject curriculum pending assignment
                      </div>
                    ) : (
                      subjectsInSec.map(sub => {
                        const asgnCount = courseAssignments.filter(a => a.subject_id === sub.id && a.section_id === sec.id).length;
                        const quizCount = quizzes.filter(q => q.subject_id === sub.id && q.section_id === sec.id).length;
                        const sessCount = sessionalAssessments.filter(sa => sa.subject_id === sub.id && sa.section_id === sec.id).length;

                        return (
                          <div
                            key={sub.id}
                            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-2.5 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-[#0f172a] border border-slate-300">
                                  {sub.subject_code}
                                </span>
                                <h5 className="text-base font-bold text-[#0f172a] mt-1">
                                  {sub.subject_name}
                                </h5>
                                <span className="text-xs text-[#475569] font-medium">
                                  {sub.lecture_type || 'Theory'} • {sub.credits || 4} Credits
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-[#475569]">
                              <div className="flex items-center gap-2.5 text-xs font-medium">
                                <span>Assgn: <strong className="text-[#0f172a] font-black">{asgnCount}</strong></span>
                                <span>Quizzes: <strong className="text-[#0f172a] font-black">{quizCount}</strong></span>
                                <span>Sess: <strong className="text-[#0f172a] font-black">{sessCount}</strong></span>
                              </div>

                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => onNavigate('section_workspace', { subjectId: sub.id, sectionId: sec.id })}
                                className="text-xs py-1 px-3 font-bold"
                              >
                                Workspace →
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2.6 CLASS COORDINATOR PORTAL (IF DESIGNATED) */}
      {(() => {
        // Collect coordinator assignments strictly from relational table or scoped payload
        const rawCoordinatorList = (scopedDashboardData?.coordinatorAssignments && scopedDashboardData.coordinatorAssignments.length > 0)
          ? scopedDashboardData.coordinatorAssignments
          : getFacultyCoordinatorAssignments(facultyId);

        // Map and hydrate coordinator items
        const coordinatorItems = rawCoordinatorList.length > 0
          ? rawCoordinatorList.map(c => {
              const secObj = sections.find(s => s.id === c.section_id) || (c.section as any);
              const semObj = semesters.find(s => s.id === secObj?.semester_id) || (c.section as any)?.semester;
              const yrObj = years.find(y => y.id === semObj?.academic_year_id) || (c.section as any)?.semester?.academic_year;
              const yrName = (c as any).academic_year_name || yrObj?.name || 'Academic Year';
              const yrNumber = (c as any).academic_year_number || yrObj?.year_number || 0;
              const secName = (c as any).section_name || secObj?.name || '';
              const secId = c.section_id || secObj?.id || '';
              const rawRoom = (c as any).room_number || secObj?.room_number || '';
              const cleanCoordRoom = rawRoom 
                ? rawRoom.replace(/^Room\s*(No\.?\s*)?/i, '').trim()
                : `Section ${secName}`;
              const secStudentsCount = (c as any).student_count ?? students.filter(s => s.section_id === secId && s.active).length;
              const weeklyLecturesCount = (c as any).weekly_lectures ?? getPublishedTimetable({ sectionId: secId }).length;

              return {
                id: c.id,
                secId,
                secName,
                yrName,
                yrNumber,
                cleanCoordRoom,
                secStudentsCount,
                weeklyLecturesCount,
              };
            }).filter(item => item.yrNumber !== 1) // Strictly exclude 1st year
          : sections
              .filter(sec => sec.class_coordinator_id === facultyId && sec.active)
              .map(sec => {
                const coordSem = semesters.find(s => s.id === sec.semester_id);
                const coordYear = years.find(y => y.id === coordSem?.academic_year_id);
                if (coordYear?.year_number === 1) return null;
                const coordYearName = coordYear?.name || 'Academic Year';
                const secStudents = students.filter(s => s.section_id === sec.id && s.active);
                const secTotalLectures = getPublishedTimetable({ sectionId: sec.id });
                const cleanCoordRoom = sec.room_number 
                  ? sec.room_number.replace(/^Room\s*(No\.?\s*)?/i, '').trim()
                  : `Section ${sec.name}`;

                return {
                  id: sec.id,
                  secId: sec.id,
                  secName: sec.name,
                  yrName: coordYearName,
                  yrNumber: coordYear?.year_number || 0,
                  cleanCoordRoom,
                  secStudentsCount: secStudents.length,
                  weeklyLecturesCount: secTotalLectures.length,
                };
              })
              .filter(Boolean) as Array<{
                id: string;
                secId: string;
                secName: string;
                yrName: string;
                yrNumber: number;
                cleanCoordRoom: string;
                secStudentsCount: number;
                weeklyLecturesCount: number;
              }>;

        if (coordinatorItems.length === 0) return null;

        return (
          <div className="space-y-4">
            {coordinatorItems.map(item => (
              <div 
                key={item.id} 
                className="bg-white rounded-3xl p-6 border border-slate-200/80 space-y-4 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f172a]">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-[#0f172a] border border-slate-300">
                          OFFICIAL CLASS COORDINATOR
                        </span>
                        <span className="text-xs text-[#475569] font-mono font-medium">
                          {item.yrName} • {item.cleanCoordRoom}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-[#0f172a] font-serif-institutional mt-1">
                        Class Coordinator Portal — {item.yrName} Section {item.secName}
                      </h3>
                      <p className="text-[15px] text-[#475569] mt-0.5 font-medium leading-relaxed">
                        Coordinating {item.secStudentsCount} enrolled students and complete weekly timetable oversight ({item.weeklyLecturesCount} weekly periods)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigate('timetable')}
                      leftIcon={<Calendar className="w-3.5 h-3.5 text-white" />}
                    >
                      View Complete Section Timetable
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate('students')}
                      leftIcon={<Users className="w-3.5 h-3.5 text-[#0f172a]" />}
                      className="text-[#0f172a] font-bold border-slate-300"
                    >
                      Section Students
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-sm">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[#475569] text-xs block font-bold uppercase tracking-wider">Enrolled Section Students</span>
                    <span className="text-2xl font-black text-[#0f172a] block mt-0.5 font-mono">{item.secStudentsCount}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[#475569] text-xs block font-bold uppercase tracking-wider">Weekly Lecture Periods</span>
                    <span className="text-2xl font-black text-[#0f172a] block mt-0.5 font-mono">{item.weeklyLecturesCount}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[#475569] text-xs block font-bold uppercase tracking-wider">Department & Year</span>
                    <span className="text-sm font-bold text-[#0f172a] block mt-0.5 truncate">{dept?.name || 'CSE'} ({item.yrName})</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[#475569] text-xs block font-bold uppercase tracking-wider">Coordinator Role</span>
                    <span className="text-sm font-bold text-[#0f172a] block mt-0.5">{item.yrName} Sec {item.secName} Lead</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 2.7 ATTENDANCE CORRECTION REQUESTS COMPONENT */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a] font-serif-institutional tracking-tight">
                ATTENDANCE CORRECTION REQUESTS
              </h3>
              <p className="text-[15px] sm:text-base text-[#475569] mt-0.5 font-medium leading-relaxed">
                Student attendance claims and discrepancy review for your assigned classes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {myPendingCorrections.length > 0 ? (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 border border-amber-300 text-amber-900 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                {myPendingCorrections.length} Requires Review
              </span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-900 font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                All Up To Date
              </span>
            )}
          </div>
        </div>

        {myPendingCorrections.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-[#0f172a]">
              No pending correction requests
            </h4>
            <p className="text-[15px] text-[#475569] font-medium leading-relaxed max-w-md mx-auto">
              All student attendance correction requests for your assigned classes and sections have been reviewed. New claims submitted by students during the claim window will appear here instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myPendingCorrections.map((claim, index) => {
                const rec = claim.record;
                const sess = rec?.session;
                const sub = sess?.subject;
                const sec = sess?.section;
                const studentName = claim.student?.full_name || 'Student';
                const rollNumber = claim.student?.roll_number || 'Roll N/A';
                const subjectName = sub?.subject_name || 'Subject Class';
                const subjectCode = sub?.subject_code || 'CODE';
                const sectionName = sec?.name ? `Section ${sec.name}` : 'Assigned Section';
                const sessionDate = sess?.session_date ? formatDateFull(sess.session_date) : 'Scheduled Date';
                const sessionTime = (sess?.start_time && sess?.end_time) 
                  ? `${sess.start_time.slice(0, 5)} - ${sess.end_time.slice(0, 5)}`
                  : 'Scheduled Period';

                return (
                  <div
                    key={claim.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between gap-4 shadow-xs"
                  >
                    <div className="space-y-3">
                      {/* Top Bar: # Number and Subject Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-[#0f172a] text-white text-xs font-black flex items-center justify-center font-mono">
                            #{index + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-white border border-slate-300 text-[#0f172a]">
                            {subjectCode}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 font-mono">
                          Pending Review
                        </span>
                      </div>

                      {/* Student & Class Details */}
                      <div>
                        <h4 className="text-base font-bold text-[#0f172a] tracking-tight">
                          {studentName}
                        </h4>
                        <p className="text-xs text-[#334155] font-mono font-semibold mt-0.5">
                          Roll: {rollNumber} • {sectionName}
                        </p>
                        <p className="text-xs text-[#475569] font-medium mt-0.5">
                          {subjectName} • {sessionDate} ({sessionTime})
                        </p>
                      </div>

                      {/* Student Stated Reason */}
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] block mb-0.5">
                          Student Reason
                        </span>
                        <p className="text-sm font-medium text-[#0f172a] italic">
                          "{claim.reason || 'Attendance discrepancy reported.'}"
                        </p>
                      </div>
                    </div>

                    {/* Card Footer: Review Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                      <span className="text-xs text-[#475569] font-mono">
                        Claimed {new Date(claim.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedCorrectionForReview(claim);
                          setReviewRemarks('Attendance verified from register; marked Present.');
                          setReviewError(null);
                          setReviewSuccessMsg(null);
                        }}
                        className="text-xs font-bold py-1 px-3"
                      >
                        Review Request →
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Navigation Link */}
            <div className="pt-2 text-right">
              <button
                onClick={() => onNavigate('corrections')}
                className="text-xs font-bold text-[#0f172a] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                View All Correction Requests & Review History →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. TODAY'S SCHEDULE & RECENT REQUESTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Dynamic Day Schedule with "Take Attendance" button */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#0f172a] tracking-tight flex items-center gap-2">
                <span>{selectedScheduleDay === todayDay 
                  ? `Today's Schedule (${todayDay})` 
                  : `${DAY_FULL_NAMES[selectedScheduleDay] || selectedScheduleDay} Schedule (${selectedScheduleDay})`}</span>
                {isDateToday(selectedScheduleDate, todayISO) && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0f172a] text-white">
                    TODAY
                  </span>
                )}
                {isDateInFuture(selectedScheduleDate, todayISO) && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    UPCOMING
                  </span>
                )}
              </h3>
              <p className="text-[15px] text-[#475569] mt-0.5 font-medium leading-relaxed">
                {formatDateFull(selectedScheduleDate)} • Odd Semester
              </p>
            </div>

            {/* Day Selector Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 overflow-x-auto no-scrollbar">
              {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const).map(d => {
                const dayDate = getDateForWeekdayInCurrentWeek(d, todayISO);
                const isDayToday = d === todayDay;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedScheduleDay(d)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0',
                      selectedScheduleDay === d
                        ? 'bg-[#0f172a] text-white shadow-xs'
                        : isDayToday
                          ? 'text-[#0f172a] bg-white border border-slate-300 font-bold'
                          : 'text-[#475569] hover:text-[#0f172a] hover:bg-white'
                    )}
                    title={formatDateFull(dayDate)}
                  >
                    {d}
                  </button>
                );
              })}
              <button
                onClick={() => onNavigate('timetable')}
                className="text-xs font-bold text-[#0f172a] hover:underline cursor-pointer px-2 py-1 shrink-0 ml-1"
              >
                Full →
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {isScopedLoading && displayedSchedule.length === 0 ? (
              <TimetableSkeleton slots={3} />
            ) : displayedSchedule.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#475569] bg-slate-50 rounded-2xl border border-slate-200">
                <Calendar className="w-8 h-8 text-[#475569] mx-auto mb-2 opacity-50" />
                <p className="font-bold text-[#0f172a] text-base">
                  {myTt.length === 0
                    ? 'No published timetable is available for your teaching assignments'
                    : selectedScheduleDay === todayDay && todayDay === 'SUN' 
                      ? 'Today is Sunday (Weekend / Holiday)' 
                      : `No scheduled lectures for ${DAY_FULL_NAMES[selectedScheduleDay] || selectedScheduleDay} (${formatDateFull(selectedScheduleDate)})`}
                </p>
                <p className="text-xs text-[#475569] mt-1 font-medium">
                  {myTt.length === 0
                    ? 'When the department HOD publishes your timetable schedule, your lectures will appear here automatically.'
                    : todayDay === 'SUN' && selectedScheduleDay === 'SUN' 
                      ? 'College academic classes are not held on Sundays.' 
                      : 'Check your full timetable schedule for weekly lecture distribution.'}
                </p>
              </div>
            ) : (
              displayedSchedule.map((entry) => {
                const sub = subjects.find(s => s.id === entry.subject_id);
                const sec = sections.find(s => s.id === entry.section_id);
                const sem = semesters.find(s => s.id === sec?.semester_id);
                const yr = years.find(y => y.id === sem?.academic_year_id);
                const yrName = (yr?.year_number && yr?.year_number > 0) ? `${yr.year_number} Year` : yr?.name;
                const summary = getAttendanceSummary({
                  timetableEntryId: entry.id,
                  sessionDate: selectedScheduleDate,
                  sectionId: entry.section_id,
                  subjectId: entry.subject_id ?? undefined,
                  startTime: entry.start_time,
                });
                const isToday = selectedScheduleDate === todayISO;
                const isFuture = isDateInFuture(selectedScheduleDate, todayISO);
                const cleanRoom = entry.room_number ? entry.room_number.replace(/^Room\s*(No\.?\s*)?/i, '').trim() : '';

                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-300 text-[#0f172a] font-mono text-xs font-black shrink-0 shadow-xs">
                        {entry.start_time?.substring(0, 5) || '09:00'} – {entry.end_time?.substring(0, 5) || '09:50'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[#0f172a] leading-tight">
                          {sub?.subject_name || 'Subject'}
                        </h4>
                        <p className="text-sm text-[#475569] mt-0.5 font-medium">
                          {yrName ? `${yrName} • ` : ''}Section {sec?.name} • {cleanRoom || 'Room TBD'} • {entry.lecture_type || 'Theory'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      {isFuture ? (
                        <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-[#475569]">
                          Upcoming • Attendance not available yet
                        </span>
                      ) : summary.status === 'FULLY_MARKED' ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>✓ Marked ({summary.total}/{summary.total})</span>
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigate('take_attendance', { timetableEntryId: entry.id, sessionDate: selectedScheduleDate })}
                            className="shrink-0 text-xs font-bold text-[#0f172a] border-slate-300"
                          >
                            View / Update →
                          </Button>
                        </div>
                      ) : summary.status === 'PARTIALLY_MARKED' ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                            <span>Marked ({summary.marked}/{summary.total})</span>
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigate('take_attendance', { timetableEntryId: entry.id, sessionDate: selectedScheduleDate })}
                            className="shrink-0 text-xs font-bold text-amber-900 border-amber-300 hover:bg-amber-50"
                          >
                            View / Update →
                          </Button>
                        </div>
                      ) : isToday ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300">
                            Not Recorded
                          </span>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onNavigate('take_attendance', { timetableEntryId: entry.id, sessionDate: selectedScheduleDate })}
                            leftIcon={<CheckSquare className="w-3.5 h-3.5 text-white" />}
                            className="shrink-0 text-xs font-bold"
                          >
                            Take Attendance
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 border border-slate-300 text-[#475569]">
                            Not Marked (Past)
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigate('take_attendance', { timetableEntryId: entry.id, sessionDate: selectedScheduleDate })}
                            className="shrink-0 text-xs font-bold text-[#0f172a] border-slate-300"
                          >
                            View Details →
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Card: Recent Student Correction Requests & Assessment Actions */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 flex flex-col justify-between space-y-4 shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#0f172a] tracking-tight">
                Academic & Marks Shortcuts
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={() => onNavigate('faculty_assignments')}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 text-left transition-all group shadow-xs cursor-pointer"
              >
                <div className="text-sm font-bold text-[#0f172a] group-hover:text-black">Assignments</div>
                <div className="text-xs text-[#475569] mt-0.5 font-medium">Create & Grade</div>
              </button>

              <button
                onClick={() => onNavigate('quizzes')}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 text-left transition-all group shadow-xs cursor-pointer"
              >
                <div className="text-sm font-bold text-[#0f172a] group-hover:text-black">Quizzes</div>
                <div className="text-xs text-[#475569] mt-0.5 font-medium">Google Form Quizzes</div>
              </button>

              <button
                onClick={() => onNavigate('marks_and_assessments')}
                className="col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 text-left transition-all group flex items-center justify-between shadow-xs cursor-pointer"
              >
                <div>
                  <div className="text-sm font-bold text-[#0f172a] group-hover:text-black">Marks & Assessment Management</div>
                  <div className="text-xs text-[#475569] mt-0.5 font-medium">Sessional 1, 2, Quizzes, CSV Import/Export & PDF Scorecards</div>
                </div>
                <span className="text-xs font-bold text-[#0f172a] shrink-0 ml-2">Manage Marks →</span>
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">Pending Correction Requests</h4>
              <button
                onClick={() => onNavigate('corrections')}
                className="text-xs font-bold text-[#0f172a] hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>

            <div className="space-y-2">
              {myPendingCorrections.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#475569] font-medium bg-slate-50 rounded-xl border border-slate-200">
                  No pending correction requests from students.
                </div>
              ) : (
                myPendingCorrections.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-[#0f172a] text-sm">
                        {c.student?.full_name || 'Student'}
                      </h4>
                      <p className="text-xs text-[#475569] mt-0.5 font-medium">
                        Roll: {c.student?.roll_number} • {c.reason}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCorrectionForReview(c);
                        setReviewRemarks('Attendance verified from register; marked Present.');
                        setReviewError(null);
                        setReviewSuccessMsg(null);
                      }}
                      className="text-xs py-1 px-2.5 shrink-0 text-[#0f172a] font-bold border-slate-300"
                    >
                      Review
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* REVIEW CORRECTION MODAL */}
      {selectedCorrectionForReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a] tracking-tight">
                    Review Attendance Claim
                  </h3>
                  <p className="text-xs text-[#475569] font-medium">
                    Institutional Attendance Discrepancy Verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCorrectionForReview(null)}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student & Class Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] block">Student Details</span>
                  <p className="text-sm font-bold text-[#0f172a]">
                    {selectedCorrectionForReview.student?.full_name || 'Student'}
                  </p>
                  <p className="font-mono text-[#334155] font-semibold">
                    Roll: {selectedCorrectionForReview.student?.roll_number || 'N/A'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 border border-amber-300 text-amber-900 font-mono">
                  Requested: Present
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] block">Class & Subject</span>
                <p className="text-sm font-semibold text-[#0f172a]">
                  {selectedCorrectionForReview.record?.session?.subject?.subject_name || 'Subject'} ({selectedCorrectionForReview.record?.session?.subject?.subject_code})
                </p>
                <p className="text-[#475569] font-mono">
                  Section {selectedCorrectionForReview.record?.session?.section?.name || 'A'} • {selectedCorrectionForReview.record?.session?.session_date ? formatDateFull(selectedCorrectionForReview.record.session.session_date) : 'Scheduled Date'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] block mb-0.5">Student Reason for Claim</span>
                <p className="text-sm font-medium text-[#0f172a] italic bg-white p-2.5 rounded-xl border border-slate-200">
                  "{selectedCorrectionForReview.reason || 'Attendance discrepancy.'}"
                </p>
              </div>
            </div>

            {/* Faculty Remarks Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#334155]">
                Faculty Review Remarks
              </label>
              <input
                type="text"
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="e.g. Attendance verified from register; marked Present."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-300 text-[#0f172a] font-medium focus:outline-none focus:border-slate-500 focus:bg-white transition-all"
              />
            </div>

            {/* Error & Success Feedback */}
            {reviewError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{reviewError}</span>
              </div>
            )}
            {reviewSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{reviewSuccessMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCorrectionForReview(null)}
                disabled={isReviewing}
                className="text-xs font-bold border-slate-300 text-[#475569]"
              >
                Cancel
              </Button>

              <button
                type="button"
                onClick={() => handleReviewAction('rejected')}
                disabled={isReviewing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-50"
              >
                Reject Request
              </button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleReviewAction('approved')}
                isLoading={isReviewing}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 border-emerald-800 text-white"
              >
                Approve & Mark Present
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

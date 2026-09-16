import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Search,
  Trash2,
  Eye,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  GraduationCap
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { exportToCSV, exportAttendanceReportPDF } from '../../lib/utils/exportUtils';
import { getISTTodayDate, getISTDayOfWeek, getRelativeDate } from '../../lib/utils/dateUtils';
import { StudentOverallAttendance } from '../../types/academic.types';
import { AttendanceSession } from '../../types/database.types';
import { ATTENDANCE_ELIGIBILITY_THRESHOLD } from '../../config/academicConfig';
import { clsx } from 'clsx';

export const ReportsPage: React.FC = () => {
  const { role, user } = useAuth();
  const { 
    departments, 
    years,
    semesters,
    sections, 
    subjects,
    faculty,
    students, 
    timetable,
    sessions,
    assignments,
    attendanceSessions,
    attendanceRecords,
    deleteAttendanceSession,
    getStudentAttendance 
  } = useAcademic();

  // Resolve logged-in faculty (if user is faculty)
  const currentFaculty = useMemo(() => {
    if (role !== 'faculty') return null;
    return faculty.find(
      f => f.id === user?.faculty_id || 
           f.id === user?.faculty?.id || 
           f.id === user?.id ||
           (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
           (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
           (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
    ) || user?.faculty || null;
  }, [role, user, faculty]);

  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';

  // Sections assigned to this faculty (from timetable & assignments)
  const facultySectionIds = useMemo(() => {
    if (role !== 'faculty' || !facultyId) return null;
    const fromTimetable = timetable.filter(t => t.faculty_id === facultyId && t.section_id).map(t => t.section_id);
    const fromAssignments = (assignments || []).filter(a => a.faculty_id === facultyId && a.section_id).map(a => a.section_id);
    return new Set([...fromTimetable, ...fromAssignments]);
  }, [role, facultyId, timetable, assignments]);

  // Tab State: 'lectures' (Lecture Attendance Management) vs 'cumulative' (Audit & Ledgers)
  const [activeTab, setActiveTab] = useState<'lectures' | 'cumulative'>('lectures');

  // =========================================================================
  // TAB 1: LECTURE ATTENDANCE MANAGEMENT FILTERS & STATE
  // =========================================================================
  const [lectureSearch, setLectureSearch] = useState('');
  const [lectureYearFilter, setLectureYearFilter] = useState<string>('ALL');
  const [lectureSectionFilter, setLectureSectionFilter] = useState<string>('ALL');
  const [lectureDateFilter, setLectureDateFilter] = useState<string>('');
  const [lectureFacultyFilter, setLectureFacultyFilter] = useState<string>('ALL');
  const [lectureSubjectFilter, setLectureSubjectFilter] = useState<string>('ALL');

  // Modals for Lecture Tab
  const [rosterSession, setRosterSession] = useState<AttendanceSession | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<AttendanceSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return attendanceSessions.filter(sess => {
      // Role Scoping: Faculty only sees their own sessions
      if (role === 'faculty' && facultyId && sess.faculty_id !== facultyId) {
        return false;
      }

      const sec = sections.find(s => s.id === sess.section_id);
      const sem = semesters.find(s => s.id === sec?.semester_id);
      const yr = years.find(y => y.id === sem?.academic_year_id);
      const sub = subjects.find(s => s.id === sess.subject_id);
      const fac = faculty.find(f => f.id === sess.faculty_id);
      const entry = timetable.find(t => t.id === sess.timetable_entry_id);
      const room = entry?.room_number || sec?.room_number || '';

      // Year Filter
      if (lectureYearFilter !== 'ALL' && yr?.id !== lectureYearFilter && String(yr?.year_number) !== lectureYearFilter) {
        return false;
      }

      // Section Filter
      if (lectureSectionFilter !== 'ALL' && sess.section_id !== lectureSectionFilter) {
        return false;
      }

      // Date Filter
      if (lectureDateFilter && sess.session_date !== lectureDateFilter) {
        return false;
      }

      // Faculty Filter (for Admin/HOD)
      if (role !== 'faculty' && lectureFacultyFilter !== 'ALL' && sess.faculty_id !== lectureFacultyFilter) {
        return false;
      }

      // Subject Filter
      if (lectureSubjectFilter !== 'ALL' && sess.subject_id !== lectureSubjectFilter) {
        return false;
      }

      // Free Search
      if (lectureSearch.trim()) {
        const query = lectureSearch.toLowerCase();
        const matchesSubject = sub?.subject_name?.toLowerCase().includes(query) || sub?.subject_code?.toLowerCase().includes(query);
        const matchesFaculty = fac?.full_name?.toLowerCase().includes(query) || fac?.faculty_code?.toLowerCase().includes(query);
        const matchesSection = sec?.name?.toLowerCase().includes(query);
        const matchesRoom = room.toLowerCase().includes(query);
        if (!matchesSubject && !matchesFaculty && !matchesSection && !matchesRoom) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort newest date first, then time
      if (b.session_date !== a.session_date) {
        return b.session_date.localeCompare(a.session_date);
      }
      return (b.start_time || '').localeCompare(a.start_time || '');
    });
  }, [attendanceSessions, sections, semesters, years, subjects, faculty, timetable, lectureYearFilter, lectureSectionFilter, lectureDateFilter, lectureFacultyFilter, lectureSubjectFilter, lectureSearch, role, facultyId]);

  // Lecture KPIs
  const lectureKPIs = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    const sessionIds = new Set(filteredSessions.map(s => s.id));

    attendanceRecords.forEach(rec => {
      if (sessionIds.has(rec.attendance_session_id)) {
        if (rec.status === 'Present') totalPresent++;
        else if (rec.status === 'Absent') totalAbsent++;
      }
    });

    const totalRecords = totalPresent + totalAbsent;
    const percentage = totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : '0.0';

    return {
      totalSessions: filteredSessions.length,
      totalRecords,
      totalPresent,
      totalAbsent,
      percentage
    };
  }, [filteredSessions, attendanceRecords]);

  // Handle 15-Column CSV Export
  const handleExportLecturesCSV = () => {
    if (filteredSessions.length === 0) {
      alert('No lecture sessions match the current filters.');
      return;
    }

    const rows = filteredSessions.flatMap(session => {
      const sessRecords = attendanceRecords.filter(r => r.attendance_session_id === session.id);
      const sec = sections.find(s => s.id === session.section_id);
      const sem = semesters.find(s => s.id === sec?.semester_id);
      const yr = years.find(y => y.id === sem?.academic_year_id);
      const sub = subjects.find(s => s.id === session.subject_id);
      const fac = faculty.find(f => f.id === session.faculty_id);
      const entry = timetable.find(t => t.id === session.timetable_entry_id);
      const day = getISTDayOfWeek(session.session_date) || entry?.day_of_week || 'MON';
      const room = entry?.room_number || sec?.room_number || 'Room TBD';

      return sessRecords.map(rec => {
        const stud = students.find(s => s.id === rec.student_id);
        return {
          'Date': session.session_date,
          'Day': day,
          'Year': yr?.name || (yr?.year_number ? `Year ${yr.year_number}` : 'N/A'),
          'Section': sec?.name || 'N/A',
          'Subject Code': sub?.subject_code || 'N/A',
          'Subject Name': sub?.subject_name || 'N/A',
          'Faculty Name': fac?.full_name || 'N/A',
          'Faculty ID': fac?.employee_code || fac?.faculty_code || fac?.id || 'N/A',
          'Room': room,
          'Lecture Start': session.start_time || '09:00',
          'Lecture End': session.end_time || '09:50',
          'Student Roll Number': stud?.roll_number || 'N/A',
          'Student Name': stud?.full_name || 'N/A',
          'Attendance Status': rec.status,
          'Saved At': rec.marked_at || rec.created_at || (session as any).marked_at || session.session_date,
        };
      });
    });

    if (rows.length === 0) {
      alert('No student attendance records found for the selected lecture sessions.');
      return;
    }

    exportToCSV(rows, `VCTM_Lecture_Attendance_15Col_Ledger_${getISTTodayDate()}`);
  };

  // Handle Delete Session
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteAttendanceSession(sessionToDelete.id);
      if (res?.success) {
        setActionMessage(`Lecture session on ${sessionToDelete.session_date} was deleted successfully.`);
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert('Failed to delete attendance session from database.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting session');
    } finally {
      setIsDeleting(false);
      setSessionToDelete(null);
    }
  };

  // =========================================================================
  // TAB 2: CUMULATIVE ELIGIBILITY & DEFAULTER AUDIT
  // =========================================================================
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'DEFAULTER'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Available Sections scoped for faculty or all active for admin/HOD
  const availableSections = useMemo(() => {
    const activeSecs = sections.filter(s => s.active);
    if (role === 'faculty' && facultySectionIds && facultySectionIds.size > 0) {
      return activeSecs.filter(s => facultySectionIds.has(s.id));
    }
    return activeSecs;
  }, [sections, role, facultySectionIds]);

  // Calculate stats for all students (scoped to assigned sections if faculty)
  const allStats: StudentOverallAttendance[] = useMemo(() => {
    const studentList = (role === 'faculty' && facultySectionIds && facultySectionIds.size > 0)
      ? students.filter(s => facultySectionIds.has(s.section_id || s.section?.id || ''))
      : students;
    return studentList.map(s => getStudentAttendance(s.id));
  }, [students, getStudentAttendance, role, facultySectionIds]);

  const filteredStats = useMemo(() => {
    return allStats.filter(s => {
      const matchesSection = selectedSection === 'ALL' || s.sectionName === selectedSection;
      const hasData = s.totalLectures > 0 && s.percentage !== null;
      const matchesStatus = 
        selectedStatusFilter === 'ALL' ? true :
        selectedStatusFilter === 'DEFAULTER' ? (hasData && (s.isDefaulter || (s.percentage !== null && s.percentage < ATTENDANCE_ELIGIBILITY_THRESHOLD))) :
        (hasData && s.percentage !== null && s.percentage >= ATTENDANCE_ELIGIBILITY_THRESHOLD);
      const matchesSearch = 
        s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSection && matchesStatus && matchesSearch;
    });
  }, [allStats, selectedSection, selectedStatusFilter, searchTerm]);

  const handleExportCSV = () => {
    const data = filteredStats.map(s => ({
      Roll_Number: s.rollNumber,
      Full_Name: s.fullName,
      Section: s.sectionName,
      Total_Lectures_Held: s.totalLectures,
      Present_Count: s.presentLectures,
      Absent_Count: s.totalLectures - s.presentLectures,
      Attendance_Percentage: s.totalLectures > 0 && s.percentage !== null ? `${s.percentage}%` : 'No data',
      Audit_Status: s.totalLectures === 0 || s.percentage === null ? 'No attendance recorded' : s.percentage >= ATTENDANCE_ELIGIBILITY_THRESHOLD ? 'Eligible for Exams' : 'Defaulter (<75%)',
    }));
    exportToCSV(data, `VCTM_College_Attendance_Audit_${getISTTodayDate()}`);
  };

  const handleExportPDF = () => {
    const headers = ['Roll No.', 'Student Name', 'Section', 'Held', 'Present', 'Percentage', 'Status'];
    const rows = filteredStats.map(s => [
      s.rollNumber,
      s.fullName,
      s.sectionName,
      s.totalLectures,
      s.presentLectures,
      s.totalLectures > 0 && s.percentage !== null ? `${s.percentage}%` : 'No data',
      s.totalLectures === 0 || s.percentage === null ? 'No attendance recorded' : s.percentage >= ATTENDANCE_ELIGIBILITY_THRESHOLD ? 'Eligible' : 'Defaulter'
    ]);

    const activeSession = sessions.find(s => s.is_current);
    const sessionLabel = activeSession?.name ? `Academic Session ${activeSession.name}` : 'Academic Session';

    exportAttendanceReportPDF({
      title: 'COLLEGE ATTENDANCE AUDIT & ELIGIBILITY REPORT',
      subtitle: 'Vivekananda College of Technology & Management, Aligarh (340)',
      department: departments[0]?.name || 'Academic Department',
      section: selectedSection === 'ALL' ? 'All Sections' : `Section ${selectedSection}`,
      academicYear: sessionLabel,
      tableHeaders: headers,
      tableRows: rows,
      filename: `VCTM_Attendance_Report_${getISTTodayDate()}`,
    });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* 1. Header & Tab Navigation */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-[#00ff88]" />
            {role === 'faculty' ? 'Attendance Reports' : 'Reports & Academic Audits'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {role === 'faculty'
              ? 'View attendance history, rosters, and audit records for your assigned classes'
              : 'Live lecture registers, 15-column master attendance exports & exam eligibility ledgers'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 bg-slate-950/80 rounded-2xl border border-emerald-500/20">
            <button
              onClick={() => setActiveTab('lectures')}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'lectures'
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              Lecture Attendance
            </button>
            <button
              onClick={() => setActiveTab('cumulative')}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'cumulative'
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Eligibility & Defaulters
            </button>
          </div>

          {activeTab === 'lectures' ? (
            <Button
              variant="neon"
              size="sm"
              onClick={handleExportLecturesCSV}
              leftIcon={<Download className="w-4 h-4 text-slate-950" />}
              className="font-black text-xs"
            >
              Export 15-Col CSV
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                leftIcon={<Download className="w-4 h-4 text-[#00ff88]" />}
              >
                Export CSV
              </Button>
              <Button
                variant="neon"
                size="sm"
                onClick={handleExportPDF}
                leftIcon={<Printer className="w-4 h-4 text-slate-950" />}
              >
                Generate PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Flash Action Message */}
      {actionMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {actionMessage}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: LECTURE ATTENDANCE MANAGEMENT VIEW                             */}
      {/* ===================================================================== */}
      {activeTab === 'lectures' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Total Lectures</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white mt-1.5">{lectureKPIs.totalSessions}</p>
              <span className="text-[10px] text-slate-500">Saved sessions matching filter</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Total Records</span>
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-black text-white mt-1.5">{lectureKPIs.totalRecords}</p>
              <span className="text-[10px] text-slate-500">Individual student attendances</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Present Marks</span>
                <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
              </div>
              <p className="text-2xl font-black text-[#00ff88] mt-1.5">{lectureKPIs.totalPresent}</p>
              <span className="text-[10px] text-slate-500">Attended lectures</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-rose-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Absent Marks</span>
                <XCircle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-black text-rose-400 mt-1.5">{lectureKPIs.totalAbsent}</p>
              <span className="text-[10px] text-slate-500">Missed lectures</span>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Attendance Rate</span>
                <GraduationCap className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black font-mono text-[#00ff88] mt-1.5">{lectureKPIs.percentage}%</p>
              <span className="text-[10px] text-slate-500">Benchmark: &ge;75%</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="glass-card rounded-2xl p-4 space-y-3 border border-emerald-500/20">
            <div className={clsx(
              "grid grid-cols-1 sm:grid-cols-2 gap-3",
              role === 'faculty' ? "lg:grid-cols-6" : "lg:grid-cols-7"
            )}>
              {/* Search */}
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search subject, faculty, room..."
                  value={lectureSearch}
                  onChange={(e) => setLectureSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
                />
              </div>

              {/* Year Filter */}
              <select
                value={lectureYearFilter}
                onChange={(e) => setLectureYearFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                <option value="ALL">All Academic Years</option>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>

              {/* Section Filter */}
              <select
                value={lectureSectionFilter}
                onChange={(e) => setLectureSectionFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                <option value="ALL">All Sections</option>
                {availableSections.map(sec => (
                  <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                ))}
              </select>

              {/* Faculty Filter (Admin/HOD Only) */}
              {role !== 'faculty' && (
                <select
                  value={lectureFacultyFilter}
                  onChange={(e) => setLectureFacultyFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
                >
                  <option value="ALL">All Faculty</option>
                  {faculty.filter(f => f.active).map(fac => (
                    <option key={fac.id} value={fac.id}>{fac.full_name}</option>
                  ))}
                </select>
              )}

              {/* Subject Filter */}
              <select
                value={lectureSubjectFilter}
                onChange={(e) => setLectureSubjectFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                <option value="ALL">All Subjects</option>
                {subjects.filter(s => s.active).map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.subject_code}</option>
                ))}
              </select>

              {/* Date Filter & Presets */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={lectureDateFilter}
                    onChange={(e) => setLectureDateFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88] cursor-pointer"
                  />
                  {lectureDateFilter && (
                    <button
                      onClick={() => setLectureDateFilter('')}
                      className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white text-xs cursor-pointer"
                      title="Clear Date"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setLectureDateFilter(prev => getRelativeDate(prev || getISTTodayDate(), -1))}
                    className="flex-1 py-1 px-1 rounded-lg bg-slate-900/90 border border-emerald-500/20 text-[10px] font-bold text-slate-300 hover:text-white hover:border-emerald-500/40 transition-colors cursor-pointer"
                  >
                    ◀ Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setLectureDateFilter(getISTTodayDate())}
                    className={clsx(
                      "flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer",
                      lectureDateFilter === getISTTodayDate()
                        ? "bg-emerald-500 text-slate-950 font-black shadow-[0_0_8px_rgba(0,255,136,0.3)]"
                        : "bg-slate-900/90 border border-emerald-500/20 text-slate-300 hover:text-white hover:border-emerald-500/40"
                    )}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setLectureDateFilter(prev => getRelativeDate(prev || getISTTodayDate(), 1))}
                    className="flex-1 py-1 px-1 rounded-lg bg-slate-900/90 border border-emerald-500/20 text-[10px] font-bold text-slate-300 hover:text-white hover:border-emerald-500/40 transition-colors cursor-pointer"
                  >
                    Next ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => setLectureDateFilter('')}
                    className={clsx(
                      "flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer",
                      !lectureDateFilter
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88]"
                        : "bg-slate-900/90 border border-slate-700/60 text-slate-400 hover:text-white"
                    )}
                  >
                    All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sessions List (Desktop Table + Mobile Cards) */}
          {filteredSessions.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">No lecture attendance sessions match the filter criteria</p>
              <p className="text-xs text-slate-500 mt-1">Adjust your filters or verify that faculty have saved attendance for these lectures</p>
            </div>
          ) : (
            <>
              {/* MOBILE VIEW */}
              <div className="space-y-3 md:hidden">
                {filteredSessions.map(session => {
                  const sec = sections.find(s => s.id === session.section_id);
                  const sem = semesters.find(s => s.id === sec?.semester_id);
                  const yr = years.find(y => y.id === sem?.academic_year_id);
                  const sub = subjects.find(s => s.id === session.subject_id);
                  const fac = faculty.find(f => f.id === session.faculty_id);
                  const entry = timetable.find(t => t.id === session.timetable_entry_id);
                  const room = entry?.room_number || sec?.room_number || 'Room TBD';

                  const records = attendanceRecords.filter(r => r.attendance_session_id === session.id);
                  const presentCount = records.filter(r => r.status === 'Present').length;
                  const totalCount = records.length;
                  const percent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                  return (
                    <div key={session.id} className="glass-card rounded-2xl p-4 border border-emerald-500/20 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black text-emerald-400">{sub?.subject_code}</span>
                            <span className="text-xs text-slate-500">•</span>
                            <span className="text-xs font-bold text-white">Sec {sec?.name}</span>
                            <span className="text-[10px] text-slate-400">({yr?.name || 'Year'})</span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-0.5">{sub?.subject_name}</h4>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>{fac?.full_name}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{room}</span>
                          </p>
                        </div>

                        <span className={clsx(
                          'px-2.5 py-1 rounded-xl text-xs font-black border font-mono shrink-0',
                          percent >= 75
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        )}>
                          {presentCount}/{totalCount} ({percent}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-emerald-500/10 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{session.session_date}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {session.start_time?.substring(0, 5)} - {session.end_time?.substring(0, 5)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRosterSession(session)}
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            className="text-xs py-1 px-2.5"
                          >
                            Roster
                          </Button>
                          {(role === 'super_admin' || role === 'hod') && (
                            <button
                              onClick={() => setSessionToDelete(session)}
                              className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                              title="Delete lecture session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP VIEW */}
              <div className="hidden md:block glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                      <tr>
                        <th className="px-5 py-3.5">Date & Slot</th>
                        <th className="px-5 py-3.5">Subject</th>
                        <th className="px-5 py-3.5 text-center">Section</th>
                        <th className="px-5 py-3.5">Faculty</th>
                        <th className="px-5 py-3.5 text-center">Room</th>
                        <th className="px-5 py-3.5 text-center">Attendance</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-500/10">
                      {filteredSessions.map(session => {
                        const sec = sections.find(s => s.id === session.section_id);
                        const sem = semesters.find(s => s.id === sec?.semester_id);
                        const yr = years.find(y => y.id === sem?.academic_year_id);
                        const sub = subjects.find(s => s.id === session.subject_id);
                        const fac = faculty.find(f => f.id === session.faculty_id);
                        const entry = timetable.find(t => t.id === session.timetable_entry_id);
                        const room = entry?.room_number || sec?.room_number || 'Room TBD';

                        const records = attendanceRecords.filter(r => r.attendance_session_id === session.id);
                        const presentCount = records.filter(r => r.status === 'Present').length;
                        const totalCount = records.length;
                        const percent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                        return (
                          <tr key={session.id} className="hover:bg-emerald-500/5 transition-colors">
                            <td className="px-5 py-3.5 font-mono">
                              <span className="font-bold text-white block">{session.session_date}</span>
                              <span className="text-[11px] text-slate-400">
                                {session.start_time?.substring(0, 5)} – {session.end_time?.substring(0, 5)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-mono font-bold text-emerald-400 block">{sub?.subject_code}</span>
                              <span className="font-bold text-white">{sub?.subject_name}</span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="font-bold text-white block">Sec {sec?.name}</span>
                              <span className="text-[10px] text-slate-400">{yr?.name || 'Year'}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-white block">{fac?.full_name}</span>
                              <span className="font-mono text-[10px] text-slate-500">{fac?.employee_code || fac?.faculty_code || ''}</span>
                            </td>
                            <td className="px-5 py-3.5 text-center font-mono font-bold text-slate-300">
                              {room}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={clsx(
                                'px-2.5 py-1 rounded-xl text-xs font-black border font-mono inline-block',
                                percent >= 75
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                              )}>
                                {presentCount} / {totalCount} ({percent}%)
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRosterSession(session)}
                                  leftIcon={<Eye className="w-3.5 h-3.5" />}
                                  className="text-xs"
                                >
                                  View Roster
                                </Button>
                                {(role === 'super_admin' || role === 'hod') && (
                                  <button
                                    onClick={() => setSessionToDelete(session)}
                                    className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                    title="Delete lecture session and student records"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CUMULATIVE ELIGIBILITY & DEFAULTER AUDIT                       */}
      {/* ===================================================================== */}
      {activeTab === 'cumulative' && (
        <div className="space-y-6">
          {/* Filter Toolbar */}
          <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student or roll number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Section Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-semibold">Section:</span>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
                >
                  <option value="ALL">All Sections</option>
                  {availableSections.map(sec => (
                    <option key={sec.id} value={sec.name}>Section {sec.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-semibold">Eligibility:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
                >
                  <option value="ALL">All Students</option>
                  <option value="ELIGIBLE">Eligible (&ge;75%)</option>
                  <option value="DEFAULTER">Defaulters (&lt;75%)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reports Data Container */}
          <div>
            {filteredStats.length === 0 ? (
              <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="font-semibold text-slate-300">No attendance records found</p>
                <p className="text-xs text-slate-500 mt-1">Audit statistics will populate once faculty mark lecture attendance</p>
              </div>
            ) : (
              <>
                {/* MOBILE VIEW */}
                <div className="space-y-3 md:hidden">
                  {filteredStats.map((s) => {
                    const hasData = s.totalLectures > 0 && s.percentage !== null;
                    const isDefaulter = hasData && s.percentage !== null && s.percentage < 75;
                    return (
                      <div
                        key={s.studentId}
                        className="glass-card rounded-2xl p-4 border border-emerald-500/20 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-black text-emerald-400">{s.rollNumber}</span>
                            <h4 className="text-sm font-bold text-white mt-0.5">{s.fullName}</h4>
                          </div>
                          <span className={clsx(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                            !hasData
                              ? 'bg-slate-800 border-slate-700 text-slate-400'
                              : isDefaulter
                                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                : 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                          )}>
                            {!hasData ? 'No attendance recorded' : isDefaulter ? '<75% Defaulter' : 'Eligible'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/10 text-center text-xs">
                          <div className="p-2 rounded-xl bg-slate-950/60">
                            <span className="text-[10px] text-slate-400 block">Section</span>
                            <span className="font-bold text-white">Sec {s.sectionName}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-950/60">
                            <span className="text-[10px] text-slate-400 block">Attended</span>
                            <span className="font-bold text-emerald-400">{s.presentLectures}/{s.totalLectures}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-950/60">
                            <span className="text-[10px] text-slate-400 block">Percentage</span>
                            <span className="font-black font-mono text-[#00ff88]">
                              {hasData ? `${s.percentage}%` : 'No data'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP VIEW */}
                <div className="hidden md:block glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                        <tr>
                          <th className="px-5 py-3.5">Roll Number</th>
                          <th className="px-5 py-3.5">Student Name</th>
                          <th className="px-5 py-3.5 text-center">Section</th>
                          <th className="px-5 py-3.5 text-center">Lectures Held</th>
                          <th className="px-5 py-3.5 text-center">Attended</th>
                          <th className="px-5 py-3.5 text-center">Percentage</th>
                          <th className="px-5 py-3.5 text-right">Audit Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-500/10">
                        {filteredStats.map((s) => {
                          const hasData = s.totalLectures > 0 && s.percentage !== null;
                          const isDefaulter = hasData && s.percentage !== null && s.percentage < 75;
                          return (
                            <tr key={s.studentId} className="hover:bg-emerald-500/5 transition-colors">
                              <td className="px-5 py-3.5 font-mono font-bold text-emerald-400">
                                {s.rollNumber}
                              </td>
                              <td className="px-5 py-3.5 font-bold text-white">
                                {s.fullName}
                              </td>
                              <td className="px-5 py-3.5 text-center font-bold text-slate-300">
                                Section {s.sectionName}
                              </td>
                              <td className="px-5 py-3.5 text-center text-slate-300">
                                {s.totalLectures}
                              </td>
                              <td className="px-5 py-3.5 text-center font-bold text-emerald-400">
                                {s.presentLectures}
                              </td>
                              <td className="px-5 py-3.5 text-center font-mono font-black text-sm text-[#00ff88]">
                                {hasData ? `${s.percentage}%` : 'No data'}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className={clsx(
                                  'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                                  !hasData
                                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                                    : isDefaulter
                                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                      : 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                                )}>
                                  {!hasData ? 'No attendance recorded' : isDefaulter ? 'Defaulter (<75%)' : 'Eligible for Exams'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: VIEW SESSION STUDENT ROSTER                                  */}
      {/* ===================================================================== */}
      <Modal
        isOpen={!!rosterSession}
        onClose={() => {
          setRosterSession(null);
          setRosterSearch('');
        }}
        title="Lecture Session Roster"
        description="Detailed student attendance records for this lecture session"
        maxWidth="2xl"
      >
        {rosterSession && (() => {
          const sec = sections.find(s => s.id === rosterSession.section_id);
          const sub = subjects.find(s => s.id === rosterSession.subject_id);
          const fac = faculty.find(f => f.id === rosterSession.faculty_id);
          const records = attendanceRecords.filter(r => r.attendance_session_id === rosterSession.id);
          const presentCount = records.filter(r => r.status === 'Present').length;
          const absentCount = records.filter(r => r.status === 'Absent').length;

          const filteredRosterRecords = records.filter(rec => {
            const stud = students.find(s => s.id === rec.student_id);
            if (!rosterSearch.trim()) return true;
            const q = rosterSearch.toLowerCase();
            return (
              stud?.full_name?.toLowerCase().includes(q) ||
              stud?.roll_number?.toLowerCase().includes(q)
            );
          });

          return (
            <div className="space-y-4 pt-2">
              {/* Session Context Banner */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-emerald-400">{sub?.subject_code}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs font-bold text-white">Section {sec?.name}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-0.5">{sub?.subject_name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Faculty: {fac?.full_name}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-[#00ff88]">
                    {presentCount} Present
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-bold text-rose-400">
                    {absentCount} Absent
                  </span>
                </div>
              </div>

              {/* Search Inside Roster */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter roster by student name or roll number..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
                />
              </div>

              {/* Roster Items */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-emerald-500/10">
                {filteredRosterRecords.map((rec) => {
                  const stud = students.find(s => s.id === rec.student_id);
                  const isPresent = rec.status === 'Present';
                  return (
                    <div key={rec.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-mono font-bold text-emerald-400">{stud?.roll_number}</span>
                        <p className="font-bold text-white">{stud?.full_name}</p>
                      </div>
                      <span className={clsx(
                        'px-2.5 py-1 rounded-xl text-[11px] font-black border flex items-center gap-1.5 shrink-0',
                        isPresent
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                          : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      )}>
                        {isPresent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {rec.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRosterSession(null);
                    setRosterSearch('');
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close Roster
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 2: CONFIRM DELETE SESSION DIALOG                                */}
      {/* ===================================================================== */}
      <ConfirmDialog
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={confirmDeleteSession}
        title="Delete Lecture Attendance Session?"
        message={`Are you sure you want to delete the attendance session on ${sessionToDelete?.session_date}? This will permanently remove all associated student attendance records from Supabase.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Session from Database'}
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

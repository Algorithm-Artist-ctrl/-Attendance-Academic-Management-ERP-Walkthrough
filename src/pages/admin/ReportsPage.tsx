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

interface ReportsPageProps {
  forceFacultyMode?: boolean;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ forceFacultyMode = false }) => {
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

  const isFacultyMode = forceFacultyMode || role === 'faculty';

  // Resolve logged-in faculty (if user is faculty or in faculty mode)
  const currentFaculty = useMemo(() => {
    if (!isFacultyMode) return null;
    return faculty.find(
      f => f.id === user?.faculty_id || 
           f.id === user?.faculty?.id || 
           f.id === user?.id ||
           (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
           (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
           (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
    ) || user?.faculty || null;
  }, [isFacultyMode, user, faculty]);

  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';

  // Sections assigned to this faculty (from timetable & assignments)
  const facultySectionIds = useMemo(() => {
    if (!isFacultyMode || !facultyId) return null;
    const fromTimetable = timetable.filter(t => t.faculty_id === facultyId && t.section_id).map(t => t.section_id);
    const fromAssignments = (assignments || []).filter(a => a.faculty_id === facultyId && a.section_id).map(a => a.section_id);
    return new Set([...fromTimetable, ...fromAssignments]);
  }, [isFacultyMode, facultyId, timetable, assignments]);

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
      if (isFacultyMode && facultyId && sess.faculty_id !== facultyId) {
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
      if (!isFacultyMode && lectureFacultyFilter !== 'ALL' && sess.faculty_id !== lectureFacultyFilter) {
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
  }, [attendanceSessions, sections, semesters, years, subjects, faculty, timetable, lectureYearFilter, lectureSectionFilter, lectureDateFilter, lectureFacultyFilter, lectureSubjectFilter, lectureSearch, isFacultyMode, facultyId]);

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
    if (isFacultyMode && facultySectionIds && facultySectionIds.size > 0) {
      return activeSecs.filter(s => facultySectionIds.has(s.id));
    }
    return activeSecs;
  }, [sections, isFacultyMode, facultySectionIds]);

  // Calculate stats for all students (scoped to assigned sections if faculty)
  const allStats: StudentOverallAttendance[] = useMemo(() => {
    const studentList = (isFacultyMode && facultySectionIds && facultySectionIds.size > 0)
      ? students.filter(s => facultySectionIds.has(s.section_id || s.section?.id || ''))
      : students;
    return studentList.map(s => getStudentAttendance(s.id));
  }, [students, getStudentAttendance, isFacultyMode, facultySectionIds]);

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
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif-institutional font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-slate-900" />
            {isFacultyMode ? 'Attendance Reports' : 'Reports & Academic Audits'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isFacultyMode
              ? 'View attendance history, rosters, and audit records for your assigned classes'
              : 'Live lecture registers, 15-column master attendance exports & exam eligibility ledgers'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab('lectures')}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'lectures'
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
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
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Eligibility & Defaulters
            </button>
          </div>

          {activeTab === 'lectures' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportLecturesCSV}
              leftIcon={<Download className="w-4 h-4 text-white" />}
              className="font-semibold text-xs rounded-xl shadow-xs"
            >
              Export 15-Col CSV
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                leftIcon={<Download className="w-4 h-4 text-slate-700" />}
              >
                Export CSV
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExportPDF}
                leftIcon={<Printer className="w-4 h-4 text-white" />}
                className="font-semibold text-xs rounded-xl shadow-xs"
              >
                Generate PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Flash Action Message */}
      {actionMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
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
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Total Lectures</span>
                <Calendar className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-2xl font-serif-institutional font-bold text-slate-900 mt-1.5">{lectureKPIs.totalSessions}</p>
              <span className="text-[10px] text-slate-500">Saved sessions matching filter</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Total Records</span>
                <Users className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-2xl font-serif-institutional font-bold text-slate-900 mt-1.5">{lectureKPIs.totalRecords}</p>
              <span className="text-[10px] text-slate-500">Individual student attendances</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Present Marks</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-serif-institutional font-bold text-emerald-700 mt-1.5">{lectureKPIs.totalPresent}</p>
              <span className="text-[10px] text-slate-500">Attended lectures</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Absent Marks</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-serif-institutional font-bold text-rose-700 mt-1.5">{lectureKPIs.totalAbsent}</p>
              <span className="text-[10px] text-slate-500">Missed lectures</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Attendance Rate</span>
                <GraduationCap className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-2xl font-serif-institutional font-bold text-slate-900 mt-1.5">{lectureKPIs.percentage}%</p>
              <span className="text-[10px] text-slate-500">Benchmark: &ge;75%</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 space-y-3 border border-slate-200/80 shadow-xs">
            <div className={clsx(
              "grid grid-cols-1 sm:grid-cols-2 gap-3",
              isFacultyMode ? "lg:grid-cols-6" : "lg:grid-cols-7"
            )}>
              {/* Search */}
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search subject, faculty, room..."
                  value={lectureSearch}
                  onChange={(e) => setLectureSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                />
              </div>

              {/* Year Filter */}
              <select
                value={lectureYearFilter}
                onChange={(e) => setLectureYearFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
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
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              >
                <option value="ALL">All Sections</option>
                {availableSections.map(sec => (
                  <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                ))}
              </select>

              {/* Faculty Filter (Admin/HOD Only) */}
              {!isFacultyMode && (
                <select
                  value={lectureFacultyFilter}
                  onChange={(e) => setLectureFacultyFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                >
                  <option value="ALL">All Faculty</option>
                  {faculty.map(f => (
                    <option key={f.id} value={f.id}>{f.full_name}</option>
                  ))}
                </select>
              )}

              {/* Subject Filter */}
              <select
                value={lectureSubjectFilter}
                onChange={(e) => setLectureSubjectFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
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
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
                  />
                  {lectureDateFilter && (
                    <button
                      onClick={() => setLectureDateFilter('')}
                      className="p-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs cursor-pointer"
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
                    className="flex-1 py-1 px-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    ◀ Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setLectureDateFilter(getISTTodayDate())}
                    className={clsx(
                      "flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer",
                      lectureDateFilter === getISTTodayDate()
                        ? "bg-[#0f172a] text-white font-bold shadow-xs"
                        : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setLectureDateFilter(prev => getRelativeDate(prev || getISTTodayDate(), 1))}
                    className="flex-1 py-1 px-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Next ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => setLectureDateFilter('')}
                    className={clsx(
                      "flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer",
                      !lectureDateFilter
                        ? "bg-[#0f172a] text-white font-bold shadow-xs"
                        : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
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
            <div className="bg-white rounded-3xl p-12 text-center text-slate-500 border border-slate-200/80 shadow-xs">
              <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">No lecture attendance sessions match the filter criteria</p>
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
                    <div key={session.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-slate-900">{sub?.subject_code}</span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs font-bold text-slate-900">Sec {sec?.name}</span>
                            <span className="text-[10px] text-slate-400">({yr?.name || 'Year'})</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-0.5">{sub?.subject_name}</h4>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>{fac?.full_name}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{room}</span>
                          </p>
                        </div>

                        <span className={clsx(
                          'px-2.5 py-1 rounded-xl text-xs font-black border font-mono shrink-0',
                          percent >= 75
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        )}>
                          {presentCount}/{totalCount} ({percent}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{session.session_date}</span>
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
                          {!isFacultyMode && (role === 'super_admin' || role === 'hod') && (
                            <button
                              onClick={() => setSessionToDelete(session)}
                              className="p-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
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
              <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
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
                    <tbody className="divide-y divide-slate-100 bg-white">
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
                          <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5 font-mono">
                              <span className="font-bold text-slate-900 block">{session.session_date}</span>
                              <span className="text-[11px] text-slate-400">
                                {session.start_time?.substring(0, 5)} – {session.end_time?.substring(0, 5)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-mono font-bold text-slate-900 block">{sub?.subject_code}</span>
                              <span className="font-semibold text-slate-800">{sub?.subject_name}</span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="font-bold text-slate-900 block">Sec {sec?.name}</span>
                              <span className="text-[10px] text-slate-400">{yr?.name || 'Year'}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-slate-900 block">{fac?.full_name}</span>
                              <span className="font-mono text-[10px] text-slate-500">{fac?.employee_code || fac?.faculty_code || ''}</span>
                            </td>
                            <td className="px-5 py-3.5 text-center font-mono font-bold text-slate-700">
                              {room}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={clsx(
                                'px-2.5 py-1 rounded-xl text-xs font-black border font-mono inline-block',
                                percent >= 75
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
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
                                {!isFacultyMode && (role === 'super_admin' || role === 'hod') && (
                                  <button
                                    onClick={() => setSessionToDelete(session)}
                                    className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
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
          <div className="bg-white rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-200/80 shadow-xs">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student or roll number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Section Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-semibold">Section:</span>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                >
                  <option value="ALL">All Sections</option>
                  {availableSections.map(sec => (
                    <option key={sec.id} value={sec.name}>Section {sec.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-semibold">Eligibility:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
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
              <div className="bg-white rounded-3xl p-12 text-center text-slate-500 border border-slate-200/80 shadow-xs">
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="font-semibold text-slate-800">No attendance records found</p>
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
                        className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-900">{s.rollNumber}</span>
                            <h4 className="text-sm font-bold text-slate-900 mt-0.5">{s.fullName}</h4>
                          </div>
                          <span className={clsx(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                            !hasData
                              ? 'bg-slate-100 border-slate-200 text-slate-600'
                              : isDefaulter
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          )}>
                            {!hasData ? 'No attendance recorded' : isDefaulter ? '<75% Defaulter' : 'Eligible'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block">Section</span>
                            <span className="font-bold text-slate-900">Sec {s.sectionName}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block">Attended</span>
                            <span className="font-bold text-slate-900">{s.presentLectures}/{s.totalLectures}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-400 block">Percentage</span>
                            <span className="font-bold font-mono text-slate-900">
                              {hasData ? `${s.percentage}%` : 'No data'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP VIEW */}
                <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
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
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredStats.map((s) => {
                          const hasData = s.totalLectures > 0 && s.percentage !== null;
                          const isDefaulter = hasData && s.percentage !== null && s.percentage < 75;
                          return (
                            <tr key={s.studentId} className="hover:bg-emerald-500/5 transition-colors">
                              <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                                {s.rollNumber}
                              </td>
                              <td className="px-5 py-3.5 font-bold text-slate-900">
                                {s.fullName}
                              </td>
                              <td className="px-5 py-3.5 text-center font-bold text-slate-700">
                                Section {s.sectionName}
                              </td>
                              <td className="px-5 py-3.5 text-center text-slate-600">
                                {s.totalLectures}
                              </td>
                              <td className="px-5 py-3.5 text-center font-bold text-slate-900">
                                {s.presentLectures}
                              </td>
                              <td className="px-5 py-3.5 text-center font-mono font-bold text-sm text-slate-900">
                                {hasData ? `${s.percentage}%` : 'No data'}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className={clsx(
                                  'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                                  !hasData
                                    ? 'bg-slate-100 border-slate-200 text-slate-600'
                                    : isDefaulter
                                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
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
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{sub?.subject_code}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-bold text-slate-900">Section {sec?.name}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">{sub?.subject_name}</h4>
                  <p className="text-xs text-slate-500 mt-1">Faculty: {fac?.full_name}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                    {presentCount} Present
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
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
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                />
              </div>

              {/* Roster Items */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                {filteredRosterRecords.map((rec) => {
                  const stud = students.find(s => s.id === rec.student_id);
                  const isPresent = rec.status === 'Present';
                  return (
                    <div key={rec.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{stud?.roll_number}</span>
                        <p className="font-bold text-slate-900">{stud?.full_name}</p>
                      </div>
                      <span className={clsx(
                        'px-2.5 py-1 rounded-xl text-[11px] font-black border flex items-center gap-1.5 shrink-0',
                        isPresent
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
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
                  className="text-xs text-slate-600 hover:text-slate-900"
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

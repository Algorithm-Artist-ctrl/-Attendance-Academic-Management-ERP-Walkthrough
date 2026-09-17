import React, { useState, useRef, useEffect } from 'react';
import { 
  GraduationCap, 
  Search, 
  Plus, 
  Filter, 
  UserCheck, 
  Mail, 
  Phone, 
  BookOpen, 
  Layers, 
  Trash2,
  FileSpreadsheet,
  Download,
  UploadCloud,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AdmissionType, Student } from '../../types/database.types';
import { studentSyncService, StudentSyncResult } from '../../lib/services/studentSyncService';
import { clsx } from 'clsx';

interface StudentDirectoryPageProps {
  forceFacultyScope?: boolean;
}

export const StudentDirectoryPage: React.FC<StudentDirectoryPageProps> = ({ forceFacultyScope = false }) => {
  const { user, role } = useAuth();
  const { 
    institution, 
    departments, 
    programs, 
    sessions, 
    years, 
    semesters, 
    sections, 
    faculty, 
    students,
    assignments,
    timetable,
    addStudent,
    deleteStudent,
    refreshData
  } = useAcademic();

  const isSuperAdmin = !forceFacultyScope && role === 'super_admin';
  const isHOD = !forceFacultyScope && role === 'hod';
  const isFaculty = forceFacultyScope || role === 'faculty';

  // Google Sheet Sync State for Super Admin
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<StudentSyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem('vctm_last_student_sync') || '';
  });
  const [showErrors, setShowErrors] = useState(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSyncStudents = async () => {
    if (!googleSheetUrl.trim()) {
      alert('Please enter a valid Google Sheet CSV URL.');
      return;
    }
    setIsSyncing(true);
    setSyncSuccessToast(null);
    try {
      const result = await studentSyncService.syncStudents(
        { url: googleSheetUrl },
        { 
          performedBy: user?.full_name || (isSuperAdmin ? 'Tarun Kushwah (Super Admin)' : 'HOD'),
          userRole: role || undefined,
          userDepartmentId: isHOD ? user?.department_id : undefined,
        }
      );
      setSyncResult(result);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString();
      setLastSyncTime(timeStr);
      localStorage.setItem('vctm_last_student_sync', timeStr);
      setSyncSuccessToast(`✓ Student synchronization complete — ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged${result.errorCount > 0 ? `, ${result.errorCount} rejected` : ''}`);
      await refreshData(true);
    } catch (err: any) {
      alert(`Student Sync Failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    setSyncSuccessToast(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const result = await studentSyncService.syncStudents(
          { csvContent: content },
          { 
            performedBy: user?.full_name || (isSuperAdmin ? 'Tarun Kushwah (Super Admin)' : 'HOD'),
            userRole: role || undefined,
            userDepartmentId: isHOD ? user?.department_id : undefined,
          }
        );
        setSyncResult(result);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString();
        setLastSyncTime(timeStr);
        localStorage.setItem('vctm_last_student_sync', timeStr);
        setSyncSuccessToast(`✓ File synchronization complete — ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged${result.errorCount > 0 ? `, ${result.errorCount} rejected` : ''}`);
        await refreshData(true);
      } catch (err: any) {
        alert(`File Sync Failed: ${err.message}`);
      } finally {
        setIsSyncing(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Role-based student filtering
  const accessibleStudents = React.useMemo(() => {
    if (isFaculty) {
      const currentFaculty = faculty.find(
        f => f.id === user?.faculty_id || 
             f.id === user?.faculty?.id || 
             f.id === user?.id ||
             (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
             (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
             (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
      ) || user?.faculty;
      const currentFacultyId = currentFaculty?.id || user?.faculty_id || user?.id || '';

      const taughtSectionIds = new Set<string>();
      assignments
        .filter(fsa => fsa.faculty_id === currentFacultyId && fsa.active)
        .forEach(fsa => taughtSectionIds.add(fsa.section_id));
      (timetable || [])
        .filter(t => t.faculty_id === currentFacultyId && t.active && !t.is_break && t.section_id)
        .forEach(t => taughtSectionIds.add(t.section_id));

      return students.filter(s => taughtSectionIds.has(s.section_id));
    }
    if (isSuperAdmin) return students;
    if (isHOD) return students.filter(s => s.department_id === user?.department_id);
    return students;
  }, [students, isSuperAdmin, isHOD, isFaculty, user, assignments, timetable, faculty]);

  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [admissionFilter, setAdmissionFilter] = useState<string>('ALL');

  // Dynamic sections based on yearFilter
  const availableSections = React.useMemo(() => {
    let baseSections = sections.filter(s => s.active);
    if (isFaculty) {
      const currentFaculty = faculty.find(
        f => f.id === user?.faculty_id || 
             f.id === user?.faculty?.id || 
             f.id === user?.id ||
             (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
             (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
             (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
      ) || user?.faculty;
      const currentFacultyId = currentFaculty?.id || user?.faculty_id || user?.id || '';

      const taughtSectionIds = new Set<string>();
      assignments
        .filter(fsa => fsa.faculty_id === currentFacultyId && fsa.active)
        .forEach(fsa => taughtSectionIds.add(fsa.section_id));
      (timetable || [])
        .filter(t => t.faculty_id === currentFacultyId && t.active && !t.is_break && t.section_id)
        .forEach(t => taughtSectionIds.add(t.section_id));

      baseSections = baseSections.filter(s => taughtSectionIds.has(s.id));
    }
    if (yearFilter === 'ALL') return baseSections;
    const matchingSemIds = semesters.filter(sem => sem.academic_year_id === yearFilter).map(sem => sem.id);
    return baseSections.filter(s => matchingSemIds.includes(s.semester_id));
  }, [sections, semesters, yearFilter, isFaculty, faculty, user, assignments, timetable]);

  // Add Student modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [newAdmissionType, setNewAdmissionType] = useState<AdmissionType>('Regular');
  const [newStudentYearId, setNewStudentYearId] = useState<string>('');
  const [newSectionId, setNewSectionId] = useState<string>('');
  const [newMentorId, setNewMentorId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Semesters & sections for Add Modal
  const addModalSemesters = React.useMemo(() => {
    return semesters.filter(sem => sem.academic_year_id === newStudentYearId);
  }, [semesters, newStudentYearId]);

  const addModalSections = React.useMemo(() => {
    const semIds = addModalSemesters.map(s => s.id);
    return sections.filter(sec => semIds.includes(sec.semester_id) && sec.active);
  }, [sections, addModalSemesters]);

  const handleOpenAddModal = () => {
    setModalError(null);
    setNewRoll('');
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewMentorId('');
    setNewAdmissionType('Regular');

    // Context-aware initialization:
    // If yearFilter is set to a specific year, use that year
    const targetYearId = yearFilter !== 'ALL' ? yearFilter : (years[0]?.id || '');
    setNewStudentYearId(targetYearId);

    const matchingSems = semesters.filter(s => s.academic_year_id === targetYearId).map(s => s.id);
    const yearSections = sections.filter(sec => matchingSems.includes(sec.semester_id) && sec.active);

    if (sectionFilter !== 'ALL' && yearSections.some(sec => sec.id === sectionFilter)) {
      setNewSectionId(sectionFilter);
    } else {
      setNewSectionId(yearSections[0]?.id || '');
    }
    setIsAddModalOpen(true);
  };

  const handleModalYearChange = (yearId: string) => {
    setNewStudentYearId(yearId);
    const matchingSems = semesters.filter(s => s.academic_year_id === yearId).map(s => s.id);
    const matchingSecs = sections.filter(sec => matchingSems.includes(sec.semester_id) && sec.active);
    setNewSectionId(matchingSecs[0]?.id || '');
  };

  const filteredStudents = accessibleStudents.filter(s => {
    const matchesSearch = 
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = yearFilter === 'ALL' || s.academic_year_id === yearFilter;
    const matchesSection = sectionFilter === 'ALL' || s.section_id === sectionFilter;
    const matchesAdmission = admissionFilter === 'ALL' || s.admission_type === admissionFilter;

    return matchesSearch && matchesYear && matchesSection && matchesAdmission;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, yearFilter, sectionFilter, admissionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove student "${name}" from the database?`)) {
      try {
        await deleteStudent(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete student');
      }
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newRoll.trim() || !newName.trim()) {
      setModalError('Roll Number and Student Name are required.');
      return;
    }

    if (!newStudentYearId) {
      setModalError('Please select an Academic Year.');
      return;
    }

    if (!newSectionId) {
      setModalError('Please select a valid Target Section.');
      return;
    }

    const selectedSec = sections.find(s => s.id === newSectionId);
    if (!selectedSec) {
      setModalError('Selected Section is invalid.');
      return;
    }

    const secSemester = semesters.find(s => s.id === selectedSec.semester_id);
    const secYear = years.find(y => y.id === secSemester?.academic_year_id);

    // Strict validation: section must belong to the selected academic year
    if (!secSemester || !secYear || secYear.id !== newStudentYearId) {
      setModalError('Please select a valid Academic Year and Section.');
      return;
    }

    const selectedProgram = programs.find(p => p.id === secYear.program_id) || programs[0];
    const selectedDept = departments.find(d => d.id === selectedProgram?.department_id) ||
      departments.find(d => d.id === user?.department_id) ||
      departments[0];
    const activeSession = sessions.find(s => s.is_current) || sessions[0];

    try {
      await addStudent({
        institution_id: institution?.id || '22398afa-8679-4d2c-87fc-312152a276e2',
        department_id: selectedDept?.id || '',
        program_id: selectedProgram?.id || '',
        academic_session_id: activeSession?.id || '',
        academic_year_id: secYear.id,
        semester_id: secSemester.id,
        section_id: selectedSec.id,
        roll_number: newRoll.trim(),
        full_name: newName.trim().toUpperCase(),
        admission_type: newAdmissionType,
        mentor_faculty_id: newMentorId || undefined,
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        active: true,
      });

      setIsAddModalOpen(false);
      setNewRoll('');
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewMentorId('');
      setNewAdmissionType('Regular');
      await refreshData(true);
    } catch (err: any) {
      setModalError(err.message || 'Failed to add student');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-[#00ff88]" />
            Student Master Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isFaculty 
              ? `My Assigned Class Students • Showing ${filteredStudents.length} Students`
              : `Official institutional enrollment records • Total ${students.length} Students`}
          </p>
        </div>

        {(isSuperAdmin || isHOD) && (
          <Button
            variant="neon"
            size="sm"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
          >
            Add New Student
          </Button>
        )}
      </div>

      {/* Student Data Source Panel for Super Admin & HOD */}
      {(isSuperAdmin || isHOD) && (
        <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/25 space-y-4 shadow-[0_0_20px_rgba(0,255,136,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  Student Data Source
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30 font-bold">
                    {isSuperAdmin ? 'Super Admin Master Sync' : `HOD Department Sync (${departments.find(d => d.id === user?.department_id)?.code || 'Dept'})`}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isSuperAdmin 
                    ? 'Synchronize students across all college departments from a Google Sheet CSV URL or file (Upsert by Roll No.)'
                    : 'Synchronize students for your department from a Google Sheet CSV URL or file (Upsert by Roll No.)'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<UploadCloud className="w-4 h-4 text-emerald-400" />}
                className="text-xs font-bold border-emerald-500/30 text-white hover:bg-emerald-500/10"
              >
                Upload CSV File
              </Button>
            </div>
          </div>

          {/* URL Input Bar & Sync Button */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <input
                type="url"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="Paste Google Sheet CSV URL (e.g. https://docs.google.com/spreadsheets/d/.../export?format=csv)..."
                className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-emerald-500/30 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00ff88] font-mono shadow-inner"
              />
            </div>
            <Button
              variant="neon"
              size="sm"
              onClick={handleSyncStudents}
              isLoading={isSyncing}
              leftIcon={<Download className="w-4 h-4 text-slate-950" />}
              className="w-full sm:w-auto font-black shadow-[0_0_15px_rgba(0,255,136,0.25)] shrink-0"
            >
              SYNC STUDENTS
            </Button>
          </div>

          {/* Last Sync & Result Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-500/10 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Last Sync: <strong className="text-slate-200">{lastSyncTime || 'Never'}</strong></span>
            </div>

            {syncResult && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Sync Result:</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] font-bold">
                  {syncResult.added} added
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold">
                  {syncResult.updated} updated
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                  {syncResult.unchanged} unchanged
                </span>
                {syncResult.errorCount > 0 && (
                  <button 
                    onClick={() => setShowErrors(!showErrors)}
                    className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold hover:bg-rose-500/25 transition-colors cursor-pointer"
                  >
                    {syncResult.errorCount} errors {showErrors ? '▲' : '▼'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Expandable Errors List */}
          {showErrors && syncResult && syncResult.errors.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1.5 animate-in fade-in">
              <div className="font-bold flex items-center gap-1.5 text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Rows Rejected During Sync ({syncResult.errors.length}):</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-300/90 font-mono max-h-40 overflow-y-auto">
                {syncResult.errors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}{err.rollNumber ? ` (${err.rollNumber})` : ''}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {syncSuccessToast && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{syncSuccessToast}</span>
              </div>
              <button onClick={() => setSyncSuccessToast(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Roll Number or Name..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold">Year:</span>
            <select
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setSectionFilter('ALL');
              }}
              className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-[#00ff88] font-bold focus:outline-none focus:border-[#00ff88] cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All Years</option>
              {years.map(y => (
                <option key={y.id} value={y.id} className="bg-slate-950 text-white">{y.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold">Section:</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88] cursor-pointer"
            >
              <option value="ALL">All Sections</option>
              {availableSections.map(sec => (
                <option key={sec.id} value={sec.id}>Section {sec.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold">Type:</span>
            <select
              value={admissionFilter}
              onChange={(e) => setAdmissionFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88] cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="Regular">Regular</option>
              <option value="Lateral Entry">Lateral Entry</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student List Container (Dual-View: Cards on mobile, Table on desktop) */}
      <div>
        {filteredStudents.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20">
            <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300">No student records found</p>
            <p className="text-xs text-slate-500 mt-1">Enroll students using "Add Student" or upload a batch CSV</p>
          </div>
        ) : (
          <>
            {/* MOBILE VIEW: Touch-Friendly Student Cards */}
            <div className="space-y-3 md:hidden">
              {paginatedStudents.map((stud, idx) => (
                <div 
                  key={stud.id}
                  className="glass-card rounded-2xl p-4 border border-emerald-500/20 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500">#{(currentPage - 1) * pageSize + idx + 1}</span>
                        <span className="font-mono text-xs font-black text-emerald-400">{stud.roll_number}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5">{stud.full_name}</h3>
                    </div>

                    {(isSuperAdmin || isHOD) && (
                      <button
                        onClick={() => handleDelete(stud.id, stud.full_name)}
                        className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer touch-target flex items-center justify-center"
                        title="Delete Student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/10 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                      Section {stud.section?.name}
                    </span>
                    <span className={clsx(
                      'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                      stud.admission_type === 'Lateral Entry'
                        ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                        : 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                    )}>
                      {stud.admission_type}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                      Active
                    </span>
                  </div>

                  {stud.mentor?.full_name && (
                    <div className="text-[11px] text-slate-400">
                      Mentor: <span className="text-slate-200 font-semibold">{stud.mentor.full_name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW: Data Table */}
            <div className="hidden md:block glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                    <tr>
                      <th className="px-5 py-3.5">#</th>
                      <th className="px-5 py-3.5">Roll Number</th>
                      <th className="px-5 py-3.5">Student Name</th>
                      <th className="px-5 py-3.5 text-center">Year</th>
                      <th className="px-5 py-3.5 text-center">Section</th>
                      <th className="px-5 py-3.5 text-center">Admission Type</th>
                      <th className="px-5 py-3.5">Assigned Mentor</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-500/10">
                    {paginatedStudents.map((stud, idx) => {
                      const yr = years.find(y => y.id === stud.academic_year_id);
                      return (
                        <tr key={stud.id} className="hover:bg-emerald-500/5 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                          <td className="px-5 py-3.5 font-mono font-bold text-emerald-400 text-sm">
                            {stud.roll_number}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-white text-sm">
                            {stud.full_name}
                          </td>
                          <td className="px-5 py-3.5 text-center font-semibold text-slate-300">
                            {yr?.name || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                              Sec {stud.section?.name}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={clsx(
                              'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                              stud.admission_type === 'Lateral Entry'
                                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                                : 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                            )}>
                              {stud.admission_type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-300 font-medium">
                            {stud.mentor?.full_name || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                              Active
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => handleDelete(stud.id, stud.full_name)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {filteredStudents.length > pageSize && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 glass-panel rounded-2xl border border-emerald-500/20 text-xs text-slate-400 mt-4">
                <div>
                  Showing <span className="font-semibold text-white">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-semibold text-white">{Math.min(currentPage * pageSize, filteredStudents.length)}</span> of <span className="font-semibold text-white">{filteredStudents.length}</span> students
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-slate-950/60 hover:bg-emerald-500/10 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="px-3 py-1 font-semibold text-white">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-slate-950/60 hover:bg-emerald-500/10 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Student to College Roster"
        description="Official enrollment record into the institutional database"
        maxWidth="md"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Roll Number <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newRoll}
              onChange={(e) => setNewRoll(e.target.value)}
              placeholder="e.g. 2503400100099"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Name (Capital Letters) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. RAHUL SHARMA"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Academic Year <span className="text-rose-400">*</span>
              </label>
              <select
                value={newStudentYearId}
                onChange={(e) => handleModalYearChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Section <span className="text-rose-400">*</span>
              </label>
              <select
                value={newSectionId}
                onChange={(e) => setNewSectionId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                {addModalSections.length === 0 ? (
                  <option value="">No sections available</option>
                ) : (
                  addModalSections.map(s => {
                    const sem = semesters.find(sm => sm.id === s.semester_id);
                    return (
                      <option key={s.id} value={s.id}>
                        Section {s.name} ({s.room_number || 'TBD'}) {sem ? `• ${sem.name}` : ''}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. student@vctm.in"
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Admission Type</label>
              <select
                value={newAdmissionType}
                onChange={(e) => setNewAdmissionType(e.target.value as AdmissionType)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                <option value="Regular">Regular</option>
                <option value="Lateral Entry">Lateral Entry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mentor Faculty</label>
              <select
                value={newMentorId}
                onChange={(e) => setNewMentorId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                <option value="">None / Not Assigned</option>
                {faculty.filter(f => f.active).map(f => (
                  <option key={f.id} value={f.id}>{f.full_name} ({f.designation || 'Faculty'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="neon" size="sm">
              Save Student
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

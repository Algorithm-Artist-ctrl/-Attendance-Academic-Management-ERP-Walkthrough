import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  BookOpen, 
  Layers, 
  Plus, 
  CheckCircle2, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  Calendar, 
  Users, 
  Clock, 
  AlertTriangle
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AddSectionModal } from '../../components/academic/AddSectionModal';
import { SectionStudentManagementModal } from '../../components/academic/SectionStudentManagementModal';
import { Section, AcademicYear, Semester, Department, Program } from '../../types/database.types';
import { supabaseService } from '../../lib/services/supabaseService';
import { 
  suggestAcademicTerm, 
  getTermType, 
  getYearForSemester, 
  getYearName, 
  getSemestersForTerm 
} from '../../lib/utils/academicYearMapping';
import { clsx } from 'clsx';

export const AcademicSetupPage: React.FC = () => {
  const { user, role } = useAuth();
  const { 
    institution, 
    departments, 
    programs, 
    sessions,
    years,
    semesters, 
    sections, 
    students,
    faculty, 
    addDepartment,
    updateDepartment,
    deleteDepartment,
    checkDepartmentReferences,
    changeDepartmentHod,
    removeDepartmentHod,
    setCurrentAcademicTerm,
    updateSemesterDates,
    addProgram,
    updateProgram,
    deleteProgram, 
    addSection,
    updateSection,
    deleteSection,
    addAcademicYear,
    updateAcademicYear,
    deleteAcademicYear,
    addSemester,
    deleteSemester,
    claimWindowDays,
    setClaimWindowDays
  } = useAcademic();

  const isSuperAdmin = role === 'super_admin' || user?.role === 'super_admin';
  const isHod = role === 'hod' || user?.role === 'hod';

  const [activeTab, setActiveTab] = useState<'departments' | 'programs' | 'sessions' | 'semesters' | 'years' | 'sections' | 'policy'>(
    isHod ? 'sections' : 'departments'
  );
  const [tempClaimDays, setTempClaimDays] = useState(claimWindowDays);
  const [policySaved, setPolicySaved] = useState(false);

  // Section filtering states
  const [filterYearId, setFilterYearId] = useState<string>('ALL');
  const [filterSemesterId, setFilterSemesterId] = useState<string>('ALL');
  const [filterSectionName, setFilterSectionName] = useState<string>('ALL');
  const [managingStudentsSection, setManagingStudentsSection] = useState<Section | null>(null);
  const [sectionStudentCounts, setSectionStudentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabaseService.fetchSectionStudentCounts().then(counts => {
      setSectionStudentCounts(counts);
    });
  }, [sections]);

  // Department Management states
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptHodId, setNewDeptHodId] = useState('');

  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptCode, setEditDeptCode] = useState('');

  const [hodModalDept, setHodModalDept] = useState<Department | null>(null);
  const [selectedHodFacultyId, setSelectedHodFacultyId] = useState('');
  const [isSubmittingHod, setIsSubmittingHod] = useState(false);

  const [deptDepModal, setDeptDepModal] = useState<{
    dept: Department;
    check: {
      can_hard_delete: boolean;
      reason?: string;
      references: {
        programs: number;
        faculty: number;
        students: number;
        subjects: number;
        sections: number;
        timetables: number;
      };
    };
  } | null>(null);

  // Program Management states
  const [isProgModalOpen, setIsProgModalOpen] = useState(false);
  const [newProgName, setNewProgName] = useState('');
  const [newProgCode, setNewProgCode] = useState('');
  const [newProgDeptId, setNewProgDeptId] = useState(departments[0]?.id || '');
  const [newProgDuration, setNewProgDuration] = useState(4);

  const [editingProg, setEditingProg] = useState<Program | null>(null);
  const [editProgName, setEditProgName] = useState('');
  const [editProgCode, setEditProgCode] = useState('');
  const [editProgDuration, setEditProgDuration] = useState(4);

  // Year Modal state
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [newYearProgId, setNewYearProgId] = useState(programs[0]?.id || '');
  const [newYearNumber, setNewYearNumber] = useState(1);
  const [newYearName, setNewYearName] = useState('');

  // Semester Modal state
  const [isSemModalOpen, setIsSemModalOpen] = useState(false);
  const [newSemYearId, setNewSemYearId] = useState('');
  const [newSemNumber, setNewSemNumber] = useState(1);
  const [newSemName, setNewSemName] = useState('');

  // Term / Semester Controls State
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [selectedTermSessionId, setSelectedTermSessionId] = useState('');
  const [selectedTermType, setSelectedTermType] = useState<'ODD' | 'EVEN'>('ODD');
  const [selectedTermSemNumber, setSelectedTermSemNumber] = useState<number | ''>('');
  const [isSubmittingTerm, setIsSubmittingTerm] = useState(false);

  // Semester Dates Modal state
  const [editingSemesterDates, setEditingSemesterDates] = useState<Semester | null>(null);
  const [semStartDate, setSemStartDate] = useState('');
  const [semEndDate, setSemEndDate] = useState('');
  const [isSubmittingSemDates, setIsSubmittingSemDates] = useState(false);

  // Section Modal states
  const [isSecModalOpen, setIsSecModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editSecSemesterId, setEditSecSemesterId] = useState('');
  const [editSecName, setEditSecName] = useState('');
  const [editSecRoom, setEditSecRoom] = useState('');
  const [editSecCoordinatorId, setEditSecCoordinatorId] = useState('');

  // Derived helpers
  const currentSession = useMemo(() => {
    return sessions.find(s => s.is_current) || sessions[0] || null;
  }, [sessions]);

  const termAdvisory = useMemo(() => {
    return suggestAcademicTerm();
  }, []);

  const eligibleFacultyForDept = useMemo(() => {
    if (!hodModalDept) return [];
    const deptFac = faculty.filter(f => f.department_id === hodModalDept.id && f.active);
    return deptFac.length > 0 ? deptFac : faculty.filter(f => f.active);
  }, [hodModalDept, faculty]);

  // Department Handlers
  const handleOpenEditDept = (dept: Department) => {
    setEditingDept(dept);
    setEditDeptName(dept.name);
    setEditDeptCode(dept.code);
  };

  const handleSaveEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editDeptName.trim() || !editDeptCode.trim()) return;
    try {
      await updateDepartment(editingDept.id, {
        name: editDeptName.trim(),
        code: editDeptCode.trim().toUpperCase(),
      });
      setEditingDept(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update department');
    }
  };

  const handleOpenHodModal = (dept: Department) => {
    setHodModalDept(dept);
    setSelectedHodFacultyId(dept.hod_faculty_id || '');
  };

  const handleAssignHod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hodModalDept || !selectedHodFacultyId) return;
    setIsSubmittingHod(true);
    try {
      await changeDepartmentHod(hodModalDept.id, selectedHodFacultyId);
      setHodModalDept(null);
    } catch (err: any) {
      alert(err.message || 'Failed to assign HOD');
    } finally {
      setIsSubmittingHod(false);
    }
  };

  const handleRemoveHod = async (dept: Department) => {
    const curHod = faculty.find(f => f.id === dept.hod_faculty_id);
    const hodName = curHod ? curHod.full_name : 'the appointed faculty member';
    if (window.confirm(`Are you sure you want to remove ${hodName} as Head of Department for "${dept.name}"?\n\nThe faculty member will remain active as regular faculty, but will no longer have HOD administrative privileges.`)) {
      try {
        await removeDepartmentHod(dept.id);
      } catch (err: any) {
        alert(err.message || 'Failed to remove HOD');
      }
    }
  };

  const handleToggleDeptActive = async (dept: Department) => {
    try {
      await updateDepartment(dept.id, { active: !dept.active });
    } catch (err: any) {
      alert(err.message || 'Failed to toggle department active state');
    }
  };

  const handleDeleteDeptWithCheck = async (dept: Department) => {
    try {
      const check = await checkDepartmentReferences(dept.id);
      if (!check.can_hard_delete) {
        setDeptDepModal({ dept, check });
        return;
      }
      if (window.confirm(`Are you sure you want to permanently delete department "${dept.name}"? It has no dependent records.`)) {
        await deleteDepartment(dept.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to check department dependencies');
    }
  };

  // Term and Semester Handlers
  const handleSetCurrentTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTermSessionId) return;
    setIsSubmittingTerm(true);
    try {
      await setCurrentAcademicTerm(
        selectedTermSessionId,
        selectedTermType,
        selectedTermSemNumber ? Number(selectedTermSemNumber) : undefined
      );
      setIsTermModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to set academic term');
    } finally {
      setIsSubmittingTerm(false);
    }
  };

  const handleOpenEditSemDates = (sem: Semester) => {
    setEditingSemesterDates(sem);
    setSemStartDate(sem.start_date ? sem.start_date.split('T')[0] : '');
    setSemEndDate(sem.end_date ? sem.end_date.split('T')[0] : '');
  };

  const handleSaveSemesterDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSemesterDates) return;
    setIsSubmittingSemDates(true);
    try {
      await updateSemesterDates(
        editingSemesterDates.id,
        semStartDate || null,
        semEndDate || null
      );
      setEditingSemesterDates(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update semester dates');
    } finally {
      setIsSubmittingSemDates(false);
    }
  };

  const handleSetSingleSemesterCurrent = async (sem: Semester) => {
    const sId = sem.academic_session_id || currentSession?.id || (sessions[0]?.id ?? '');
    const tType = (sem.term_type as 'ODD' | 'EVEN') || (getTermType(sem.semester_number));
    try {
      await setCurrentAcademicTerm(sId, tType, sem.semester_number);
    } catch (err: any) {
      alert(err.message || 'Failed to set semester as current');
    }
  };

  // Program Handlers
  const handleOpenEditProg = (prog: Program) => {
    setEditingProg(prog);
    setEditProgName(prog.name);
    setEditProgCode(prog.code);
    setEditProgDuration(prog.duration_years || 4);
  };

  const handleSaveEditProg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProg || !editProgName.trim() || !editProgCode.trim()) return;
    try {
      await updateProgram(editingProg.id, {
        name: editProgName.trim(),
        code: editProgCode.trim().toUpperCase(),
        duration_years: Number(editProgDuration),
      });
      setEditingProg(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update program');
    }
  };

  const handleDeleteProg = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete program "${name}"?`)) {
      try {
        await deleteProgram(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete program');
      }
    }
  };

  const handleDeleteSec = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove or archive section "${name}"?\nIf it has historical student attendance or timetable records, it will be safely archived without data loss.`)) {
      try {
        const result = await deleteSection(id);
        if (result && (result as any).archived) {
          alert(`Section "${name}" has historical records (students, timetables, or attendance) and was safely archived (deactivated) to preserve all historical data.`);
        }
      } catch (err: any) {
        alert(err.message || 'Failed to delete or archive section');
      }
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !newDeptCode.trim()) return;

    try {
      await addDepartment({
        institution_id: institution.id,
        name: newDeptName.trim(),
        code: newDeptCode.trim().toUpperCase(),
        hod_faculty_id: newDeptHodId || undefined,
        active: true,
      });

      setNewDeptName('');
      setNewDeptCode('');
      setIsDeptModalOpen(false);
    } catch (err) {
      console.error('Failed to add department:', err);
    }
  };

  const handleCreateProg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgName.trim() || !newProgCode.trim()) return;

    try {
      await addProgram({
        department_id: newProgDeptId,
        name: newProgName.trim(),
        code: newProgCode.trim().toUpperCase(),
        duration_years: Number(newProgDuration),
        active: true,
      });

      setNewProgName('');
      setNewProgCode('');
      setIsProgModalOpen(false);
    } catch (err) {
      console.error('Failed to add program:', err);
    }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearProgId || !newYearNumber) return;

    try {
      await addAcademicYear({
        program_id: newYearProgId,
        year_number: Number(newYearNumber),
        name: newYearName.trim() || `${newYearNumber}${newYearNumber === 1 ? 'st' : newYearNumber === 2 ? 'nd' : newYearNumber === 3 ? 'rd' : 'th'} Year`,
        active: true,
      });

      setNewYearName('');
      setNewYearNumber(1);
      setIsYearModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add academic year');
    }
  };

  const handleToggleYearActive = async (year: AcademicYear) => {
    try {
      await updateAcademicYear(year.id, { active: !year.active });
    } catch (err: any) {
      alert(err.message || 'Failed to update academic year');
    }
  };

  const handleDeleteYear = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete academic year "${name}"? This action cannot be undone.`)) {
      try {
        await deleteAcademicYear(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete academic year');
      }
    }
  };

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemYearId || !newSemNumber) return;

    try {
      await addSemester({
        academic_year_id: newSemYearId,
        semester_number: Number(newSemNumber),
        name: newSemName.trim() || `Semester ${newSemNumber}`,
        active: true,
      });

      setNewSemName('');
      setNewSemNumber(1);
      setIsSemModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add semester');
    }
  };

  const handleDeleteSem = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete semester "${name}"?`)) {
      try {
        await deleteSemester(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete semester');
      }
    }
  };

  const filteredSections = useMemo(() => {
    // If HOD, find allowed semester IDs for their department
    let allowedSemesterIds: Set<string> | null = null;
    if (isHod && user?.department_id) {
      const deptProgIds = new Set(programs.filter(p => p.department_id === user.department_id).map(p => p.id));
      const deptYearIds = new Set(years.filter(y => deptProgIds.has(y.program_id)).map(y => y.id));
      allowedSemesterIds = new Set(semesters.filter(s => deptYearIds.has(s.academic_year_id)).map(s => s.id));
    }

    return sections.filter(sec => {
      if (allowedSemesterIds && allowedSemesterIds.size > 0 && !allowedSemesterIds.has(sec.semester_id)) {
        return false;
      }
      const sem = semesters.find(s => s.id === sec.semester_id);
      if (filterYearId !== 'ALL' && sem?.academic_year_id !== filterYearId) {
        return false;
      }
      if (filterSemesterId !== 'ALL' && sec.semester_id !== filterSemesterId) {
        return false;
      }
      if (filterSectionName !== 'ALL' && sec.name.toUpperCase().trim() !== filterSectionName.toUpperCase().trim()) {
        return false;
      }
      return true;
    });
  }, [sections, semesters, programs, years, filterYearId, filterSemesterId, filterSectionName, isHod, user?.department_id]);

  const availableSemestersForFilter = useMemo(() => {
    if (filterYearId === 'ALL') return semesters;
    return semesters.filter(s => s.academic_year_id === filterYearId);
  }, [semesters, filterYearId]);

  const availableSectionNamesForFilter = useMemo(() => {
    const names = Array.from(new Set(sections.map(s => s.name)));
    return ['ALL', ...names.sort()];
  }, [sections]);



  const handleUpdateSec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection || !editSecName.trim()) return;

    try {
      await updateSection(editingSection.id, {
        semester_id: editSecSemesterId || editingSection.semester_id,
        name: editSecName.trim().toUpperCase(),
        room_number: editSecRoom.trim() || undefined,
        class_coordinator_id: editSecCoordinatorId ? editSecCoordinatorId : null,
      });
      setEditingSection(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update section');
    }
  };

  if (!isSuperAdmin && !isHod) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 max-w-xl mx-auto my-12 shadow-xs">
        <ShieldCheck className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold font-serif-institutional text-slate-900 mb-2">Access Restricted</h3>
        <p className="text-slate-500 text-sm">
          Only institutional Super Administrators and Heads of Department (HOD) have permission to configure academic sections and structure.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-serif-institutional text-slate-900 tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-slate-800" />
            Academic Hierarchy & Structure
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure departments, degree programs, semesters, and class sections dynamically
          </p>
        </div>

        {/* Tab switcher pills */}
        {isSuperAdmin ? (
          <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold gap-1">
            <button
              onClick={() => setActiveTab('departments')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeTab === 'departments'
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Departments ({departments.length})
            </button>
            <button
              onClick={() => setActiveTab('programs')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeTab === 'programs'
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Programs ({programs.length})
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeTab === 'sessions'
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Academic Sessions ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('semesters')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeTab === 'semesters'
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Semesters / Terms ({semesters.length})
            </button>
            <button
              onClick={() => setActiveTab('years')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeTab === 'years'
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Cohorts & Years ({years.length})
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeTab === 'sections'
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Class Sections ({sections.length})
            </button>
            <button
              onClick={() => setActiveTab('policy')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl transition-all cursor-pointer',
                activeTab === 'policy'
                  ? 'bg-[#0f172a] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Claim Policy & Settings
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
            <Building2 className="w-4 h-4 text-slate-700" />
            <span>Department:</span>
            <span className="text-slate-900 font-bold">
              {departments.find(d => d.id === user?.department_id)?.name || 'Computer Science & Engineering'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] text-emerald-800 border border-emerald-200 font-bold">
              HOD Access
            </span>
          </div>
        )}
      </div>

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-bold font-serif-institutional text-slate-900 tracking-wide">College Departments</h3>
              <p className="text-xs text-slate-400">Engineering and management branches, HOD assignments, and status</p>
            </div>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4 text-white" />}
              onClick={() => setIsDeptModalOpen(true)}
            >
              Add Department
            </Button>
          </div>

          {departments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">No departments configured</p>
              <p className="text-xs text-slate-500 mt-1">Create academic departments using the "Add Department" button</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Code</th>
                    <th className="px-5 py-3.5">Department Name</th>
                    <th className="px-5 py-3.5">Head of Department (HOD)</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {departments.map((dept) => {
                    const hod = faculty.find(f => f.id === dept.hod_faculty_id);
                    return (
                      <tr key={dept.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-slate-900 text-sm">{dept.code}</td>
                        <td className="px-5 py-4 font-bold text-slate-900 text-sm">{dept.name}</td>
                        <td className="px-5 py-4 text-slate-600 font-medium">
                          {hod ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-slate-900 font-bold">{hod.full_name}</span>
                              <span className="text-slate-500 text-[11px]">({hod.faculty_code || hod.employee_code || 'HOD'})</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Not Appointed</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                            dept.active
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-slate-100 border-slate-300 text-slate-500"
                          )}>
                            {dept.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditDept(dept)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 shadow-xs"
                              title="Edit Department"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenHodModal(dept)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                              title="Assign or Change Head of Department"
                            >
                              <Users className="w-3 h-3" />
                              <span>{dept.hod_faculty_id ? 'Change HOD' : 'Assign HOD'}</span>
                            </button>
                            {dept.hod_faculty_id && (
                              <button
                                onClick={() => handleRemoveHod(dept)}
                                className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer shadow-xs"
                                title="Remove HOD Assignment"
                              >
                                Remove HOD
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleDeptActive(dept)}
                              className={clsx(
                                "px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer shadow-xs",
                                dept.active
                                  ? "border-slate-200 text-slate-600 hover:bg-slate-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              )}
                              title={dept.active ? 'Deactivate Department' : 'Reactivate Department'}
                            >
                              {dept.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteDeptWithCheck(dept)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer shadow-xs"
                              title="Delete Department"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Programs Tab */}
      {activeTab === 'programs' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-bold font-serif-institutional text-slate-900 tracking-wide">Degree Programs</h3>
              <p className="text-xs text-slate-400">Undergraduate & postgraduate courses with dynamic duration</p>
            </div>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4 text-white" />}
              onClick={() => setIsProgModalOpen(true)}
            >
              Add Program
            </Button>
          </div>

          {programs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">No programs configured</p>
              <p className="text-xs text-slate-500 mt-1">Create degree courses using the "Add Program" button</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Code</th>
                    <th className="px-5 py-3.5">Degree Program</th>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5 text-center">Duration</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {programs.map((prog) => {
                    const dept = departments.find(d => d.id === prog.department_id);
                    return (
                      <tr key={prog.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-slate-900 text-sm">{prog.code}</td>
                        <td className="px-5 py-4 font-bold text-slate-900 text-sm">{prog.name}</td>
                        <td className="px-5 py-4 text-slate-600 font-medium">{dept?.name || 'CSE'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-bold font-mono text-xs">
                            {prog.duration_years || 4} Years
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                            prog.active
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-slate-100 border-slate-300 text-slate-500"
                          )}>
                            {prog.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditProg(prog)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 shadow-xs"
                              title="Edit Program"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProg(prog.id, prog.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Program"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Academic Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-bold font-serif-institutional text-slate-900 tracking-wide">Academic Sessions</h3>
              <p className="text-xs text-slate-400">Institutional academic calendar years and session boundaries</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Session Name</th>
                  <th className="px-5 py-3.5">Start Date</th>
                  <th className="px-5 py-3.5">End Date</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900 text-sm">
                      {sess.name}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600">
                      {sess.start_date ? new Date(sess.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600">
                      {sess.end_date ? new Date(sess.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {sess.is_current ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Current Active Session
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-300 text-slate-600">
                          {sess.active ? 'Active' : 'Closed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Semesters / Terms Tab */}
      {activeTab === 'semesters' && (
        <div className="space-y-6">
          {/* Dynamic Calendar Advisory Banner */}
          <div className="p-5 rounded-3xl bg-indigo-50/70 border border-indigo-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shrink-0 mt-0.5 shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-indigo-950 text-sm">Calendar Term Advisory</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-200/70 text-indigo-900 uppercase tracking-wide">
                    Suggested: {termAdvisory.termType} Term
                  </span>
                </div>
                <p className="text-xs text-indigo-900/80 mt-1 leading-relaxed max-w-2xl font-medium">
                  {termAdvisory.reason} Standard active cohort: {termAdvisory.activeSemesters.map(s => `Semester ${s}`).join(', ')}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="primary"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                onClick={() => {
                  setSelectedTermSessionId(currentSession?.id || sessions[0]?.id || '');
                  setSelectedTermType(termAdvisory.termType);
                  setSelectedTermSemNumber('');
                  setIsTermModalOpen(true);
                }}
              >
                Set Current Term
              </Button>
            </div>
          </div>

          {/* 8 Semesters List Grouped by Year */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold font-serif-institutional text-slate-900 tracking-wide">Academic Semesters & Term Configuration</h3>
                <p className="text-xs text-slate-400">8 standard semesters mapped to 4 academic years with ODD/EVEN term lifecycle</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Clock className="w-4 h-4 text-slate-700" />}
                  onClick={() => {
                    setSelectedTermSessionId(currentSession?.id || sessions[0]?.id || '');
                    setSelectedTermType('ODD');
                    setSelectedTermSemNumber('');
                    setIsTermModalOpen(true);
                  }}
                >
                  Configure Term Cycle
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Semester</th>
                    <th className="px-5 py-3.5">Academic Cohort</th>
                    <th className="px-5 py-3.5 text-center">Term Type</th>
                    <th className="px-5 py-3.5">Term Dates Window</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {semesters.slice().sort((a, b) => a.semester_number - b.semester_number).map((sem) => {
                    const yrNum = getYearForSemester(sem.semester_number);
                    const yrName = getYearName(yrNum);
                    const termType = sem.term_type || getTermType(sem.semester_number);
                    const isActive = sem.status === 'ACTIVE' || sem.is_current;

                    return (
                      <tr key={sem.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {sem.name || `Semester ${sem.semester_number}`}
                            </span>
                            {sem.is_current && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                Current
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-800">
                          {yrName}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx(
                            "px-2.5 py-1 rounded-lg text-[10.5px] font-black border",
                            termType === 'ODD'
                              ? "bg-amber-50 border-amber-300 text-amber-900"
                              : "bg-blue-50 border-blue-300 text-blue-900"
                          )}>
                            {termType} TERM
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-slate-700 font-medium">
                          {sem.start_date && sem.end_date ? (
                            <span>
                              {new Date(sem.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' — '}
                              {new Date(sem.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic font-sans text-xs">Dates not set</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                            isActive
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : sem.status === 'CLOSED'
                              ? "bg-slate-100 border-slate-300 text-slate-500"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          )}>
                            {sem.status || (isActive ? 'ACTIVE' : 'UPCOMING')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditSemDates(sem)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Edit Term Dates"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Dates</span>
                            </button>
                            {!sem.is_current && (
                              <button
                                onClick={() => handleSetSingleSemesterCurrent(sem)}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                                title="Set as Current Active Semester"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Set Current</span>
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
        </div>
      )}

      {/* Academic Years Tab */}
      {activeTab === 'years' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-bold font-serif-institutional text-slate-900 tracking-wide">Academic Cohorts & Years</h3>
              <p className="text-xs text-slate-400">Configure 1st, 2nd, 3rd, and 4th year tiers and associated semesters</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus className="w-4 h-4 text-slate-700" />}
                onClick={() => {
                  if (!newSemYearId && years.length > 0) setNewSemYearId(years[0].id);
                  setIsSemModalOpen(true);
                }}
              >
                Add Semester
              </Button>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4 text-white" />}
                onClick={() => {
                  if (!newYearProgId && programs.length > 0) setNewYearProgId(programs[0].id);
                  setIsYearModalOpen(true);
                }}
              >
                Add Academic Year
              </Button>
            </div>
          </div>

          {years.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">No academic years configured</p>
              <p className="text-xs text-slate-500 mt-1">Create academic cohorts using the "Add Academic Year" button</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Cohort</th>
                    <th className="px-5 py-3.5">Degree Program</th>
                    <th className="px-5 py-3.5 text-center">Year Level</th>
                    <th className="px-5 py-3.5">Semesters</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {years.slice().sort((a, b) => a.year_number - b.year_number).map((yr) => {
                    const prog = programs.find(p => p.id === yr.program_id);
                    const yearSems = semesters.filter(s => s.academic_year_id === yr.id).sort((a, b) => a.semester_number - b.semester_number);
                    return (
                      <tr key={yr.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-900 text-sm">{yr.name}</td>
                        <td className="px-5 py-4 text-slate-600 font-medium">
                          {prog ? `${prog.name} (${prog.code})` : 'Universal'}
                        </td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-slate-900">
                          Year {yr.year_number}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {yearSems.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">No semesters</span>
                            ) : (
                              yearSems.map(sem => (
                                <span
                                  key={sem.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold"
                                >
                                  {sem.name}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSem(sem.id, sem.name)}
                                    className="text-slate-400 hover:text-rose-500 ml-0.5"
                                    title={`Delete ${sem.name}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                            yr.active 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-slate-100 border-slate-300 text-slate-500"
                          )}>
                            {yr.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleYearActive(yr)}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                              title={yr.active ? 'Deactivate cohort' : 'Activate cohort'}
                            >
                              {yr.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteYear(yr.id, yr.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Academic Year"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
            <div>
              <h3 className="text-sm font-bold font-serif-institutional text-slate-900 tracking-wide">Class Sections & Multi-Year Academic Structure</h3>
              <p className="text-xs text-slate-400">Classrooms, semesters, and assigned coordinators across all academic years</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Year Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Year:</span>
                <select
                  value={filterYearId}
                  onChange={(e) => {
                    setFilterYearId(e.target.value);
                    setFilterSemesterId('ALL');
                  }}
                  className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" >All Years</option>
                  {years.map(y => (
                    <option key={y.id} value={y.id} >{y.name}</option>
                  ))}
                </select>
              </div>

              {/* Semester Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Semester:</span>
                <select
                  value={filterSemesterId}
                  onChange={(e) => setFilterSemesterId(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" >All Semesters</option>
                  {availableSemestersForFilter.map(s => (
                    <option key={s.id} value={s.id} >{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400">Section:</span>
                <select
                  value={filterSectionName}
                  onChange={(e) => setFilterSectionName(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" >All Sections</option>
                  {availableSectionNamesForFilter.filter(n => n !== 'ALL').map(name => (
                    <option key={name} value={name} >Section {name}</option>
                  ))}
                </select>
              </div>

              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4 text-white" />}
                onClick={() => setIsSecModalOpen(true)}
              >
                Add Section
              </Button>
            </div>
          </div>

          {filteredSections.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">No sections found for selected filters</p>
              <p className="text-xs text-slate-500 mt-1">Configure sections and room mappings with "Add Section"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Section</th>
                    <th className="px-5 py-3.5">Academic Year</th>
                    <th className="px-5 py-3.5">Semester</th>
                    <th className="px-5 py-3.5">Assigned Classroom</th>
                    <th className="px-5 py-3.5">Enrolled Students</th>
                    <th className="px-5 py-3.5">Class Coordinator / Incharge</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSections.map((sec) => {
                    const coordinator = faculty.find(f => f.id === sec.class_coordinator_id);
                    const sem = semesters.find(s => s.id === sec.semester_id);
                    const yr = years.find(y => y.id === sem?.academic_year_id);
                    const studentCount = sectionStudentCounts[sec.id] ?? students.filter(s => s.section_id === sec.id).length;

                    return (
                      <tr key={sec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-bold text-white text-sm">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-900 font-bold shadow-xs">
                            Section {sec.name}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-900">{yr?.name || '—'}</td>
                        <td className="px-5 py-4 text-slate-600">{sem?.name || '—'}</td>
                        <td className="px-5 py-4 font-mono text-slate-900 font-semibold">{sec.room_number || 'TBD'}</td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setManagingStudentsSection(sec)}
                            className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-bold hover:bg-slate-200 transition-all flex items-center gap-1.5 cursor-pointer text-xs shadow-xs"
                            title={`Manage ${studentCount} students in Section ${sec.name}`}
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>{studentCount} Students</span>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-slate-600 font-medium">
                          {coordinator ? `${coordinator.full_name} (${coordinator.faculty_code || 'Faculty'})` : '—'}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800">
                            Active
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setManagingStudentsSection(sec)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Manage Section Students"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingSection(sec);
                                setEditSecSemesterId(sec.semester_id);
                                setEditSecName(sec.name);
                                setEditSecRoom(sec.room_number || '');
                                setEditSecCoordinatorId(sec.class_coordinator_id || '');
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Section & Class Coordinator"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSec(sec.id, sec.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete Section"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Policy & Claim Window Tab */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold font-serif-institutional text-slate-900 tracking-wide">
                Institutional Attendance Policy & Rectification Rules
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure student claim periods, AKTU threshold, and audit requirements
              </p>
            </div>
            {policySaved && (
              <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-in zoom-in-95">
                Settings Saved Successfully!
              </span>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setClaimWindowDays(Number(tempClaimDays));
              setPolicySaved(true);
              setTimeout(() => setPolicySaved(false), 2500);
            }}
            className="space-y-5 max-w-2xl"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Attendance Claim Window (Days)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={tempClaimDays}
                    onChange={(e) => setTempClaimDays(Number(e.target.value))}
                    className="w-32 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                  />
                  <span className="text-xs text-slate-400">
                    Days allowed for students to report discrepancy after lecture date
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600 shadow-xs">
                <h4 className="font-bold text-slate-900">Active College Rules:</h4>
                <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px]">
                  <li>Minimum AKTU attendance eligibility requirement: <strong>75%</strong></li>
                  <li>Absence calculation formula: <code>Present ÷ (Present + Absent) × 100</code></li>
                  <li>Unconducted / Not Recorded lectures are strictly omitted from attendance denominator</li>
                  <li>Student claims are routed directly and exclusively to the subject's designated section faculty</li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" size="sm">
                Save Policy Configuration
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Add Department Modal */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Add College Department"
        maxWidth="md"
      >
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name</label>
            <input
              type="text"
              required
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="e.g. Electrical Engineering"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department Code</label>
            <input
              type="text"
              required
              value={newDeptCode}
              onChange={(e) => setNewDeptCode(e.target.value)}
              placeholder="e.g. EE"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 uppercase shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeptModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Save Department</Button>
          </div>
        </form>
      </Modal>

      {/* Add Program Modal */}
      <Modal
        isOpen={isProgModalOpen}
        onClose={() => setIsProgModalOpen(false)}
        title="Add Degree Program"
        maxWidth="md"
      >
        <form onSubmit={handleCreateProg} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Program Name</label>
            <input
              type="text"
              required
              value={newProgName}
              onChange={(e) => setNewProgName(e.target.value)}
              placeholder="e.g. Master of Business Administration"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Program Code</label>
            <input
              type="text"
              required
              value={newProgCode}
              onChange={(e) => setNewProgCode(e.target.value)}
              placeholder="e.g. MBA"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 uppercase shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsProgModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Save Program</Button>
          </div>
        </form>
      </Modal>

      {/* Add Academic Year Modal */}
      <Modal
        isOpen={isYearModalOpen}
        onClose={() => setIsYearModalOpen(false)}
        title="Add Academic Year Cohort"
        maxWidth="md"
      >
        <form onSubmit={handleCreateYear} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Degree Program</label>
            <select
              value={newYearProgId}
              onChange={(e) => setNewYearProgId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Year Level</label>
            <select
              value={newYearNumber}
              onChange={(e) => {
                const val = Number(e.target.value);
                setNewYearNumber(val);
                setNewYearName(`${val}${val === 1 ? 'st' : val === 2 ? 'nd' : val === 3 ? 'rd' : 'th'} Year`);
              }}
              required
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year</option>
              <option value={5}>5th Year</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
            <input
              type="text"
              required
              value={newYearName}
              onChange={(e) => setNewYearName(e.target.value)}
              placeholder="e.g. 1st Year"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsYearModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Save Academic Year</Button>
          </div>
        </form>
      </Modal>

      {/* Add Semester Modal */}
      <Modal
        isOpen={isSemModalOpen}
        onClose={() => setIsSemModalOpen(false)}
        title="Add Semester to Academic Year"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSemester} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Academic Year</label>
            <select
              value={newSemYearId}
              onChange={(e) => setNewSemYearId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value="" disabled>Select an Academic Year</option>
              {years.map(y => {
                const p = programs.find(pr => pr.id === y.program_id);
                return (
                  <option key={y.id} value={y.id}>{p ? `${p.code} - ` : ''}{y.name}</option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Semester Number</label>
            <input
              type="number"
              min={1}
              max={10}
              required
              value={newSemNumber}
              onChange={(e) => {
                const val = Number(e.target.value);
                setNewSemNumber(val);
                setNewSemName(`Semester ${val}`);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
            <input
              type="text"
              required
              value={newSemName}
              onChange={(e) => setNewSemName(e.target.value)}
              placeholder="e.g. Semester 1"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSemModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Save Semester</Button>
          </div>
        </form>
      </Modal>

      {/* Add Section Modal (Dynamic Department / Program / Year / Semester) */}
      <AddSectionModal
        isOpen={isSecModalOpen}
        onClose={() => setIsSecModalOpen(false)}
        initialDepartmentId={isHod ? user?.department_id : undefined}
        initialYearId={filterYearId !== 'ALL' ? filterYearId : undefined}
      />

      {/* Edit Section & Class Coordinator Modal */}
      <Modal
        isOpen={!!editingSection}
        onClose={() => setEditingSection(null)}
        title="Edit Section & Class Coordinator"
        description="Update classroom allocation, semester affiliation, and assign the official Class Coordinator"
        maxWidth="md"
      >
        <form onSubmit={handleUpdateSec} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Semester / Academic Cohort</label>
            <select
              value={editSecSemesterId}
              onChange={(e) => setEditSecSemesterId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              {semesters.map(s => {
                const yr = years.find(y => y.id === s.academic_year_id);
                return (
                  <option key={s.id} value={s.id}>{yr ? `${yr.name} • ` : ''}{s.name}</option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Section Identifier</label>
            <input
              type="text"
              required
              maxLength={2}
              value={editSecName}
              onChange={(e) => setEditSecName(e.target.value)}
              placeholder="e.g. A"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 uppercase shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Classroom</label>
            <input
              type="text"
              value={editSecRoom}
              onChange={(e) => setEditSecRoom(e.target.value)}
              placeholder="e.g. Room A007"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Class Coordinator</label>
            <select
              value={editSecCoordinatorId}
              onChange={(e) => setEditSecCoordinatorId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value="">None (Unassigned)</option>
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code || f.employee_code})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingSection(null)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Update Section</Button>
          </div>
        </form>
      </Modal>

      {/* Section Student Management Modal */}
      <SectionStudentManagementModal
        section={managingStudentsSection}
        isOpen={!!managingStudentsSection}
        onClose={() => setManagingStudentsSection(null)}
      />

      {/* Edit Department Modal */}
      <Modal
        isOpen={!!editingDept}
        onClose={() => setEditingDept(null)}
        title="Edit Department"
        description="Update department code and institutional name"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEditDept} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department Code</label>
            <input
              type="text"
              required
              value={editDeptCode}
              onChange={(e) => setEditDeptCode(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono uppercase shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department Full Name</label>
            <input
              type="text"
              required
              value={editDeptName}
              onChange={(e) => setEditDeptName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingDept(null)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Assign / Change HOD Modal */}
      <Modal
        isOpen={!!hodModalDept}
        onClose={() => setHodModalDept(null)}
        title={`Head of Department (HOD) — ${hodModalDept?.name}`}
        description="Select an active faculty member to appoint as the official Head of Department"
        maxWidth="md"
      >
        <form onSubmit={handleAssignHod} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
            <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono">
              {hodModalDept?.code} — {hodModalDept?.name}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Faculty Member</label>
            <select
              value={selectedHodFacultyId}
              onChange={(e) => setSelectedHodFacultyId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value="" disabled>Select faculty member</option>
              {eligibleFacultyForDept.map(f => (
                <option key={f.id} value={f.id}>
                  {f.full_name} ({f.designation || 'Faculty'} • {f.faculty_code || f.employee_code || f.email})
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
            <span className="font-bold block">Role Synchronization Notice:</span>
            <p className="text-blue-800 leading-relaxed font-medium">
              Assigning this faculty member as HOD immediately grants them administrative HOD privileges in the ERP portal for this department.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setHodModalDept(null)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingHod}>Confirm Assignment</Button>
          </div>
        </form>
      </Modal>

      {/* Department Dependency Safeguard Modal */}
      <Modal
        isOpen={!!deptDepModal}
        onClose={() => setDeptDepModal(null)}
        title="Cannot Delete Department"
        description="This department is linked to institutional academic records and cannot be permanently deleted."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Active Relationship Safeguard</span>
            </div>
            <p className="leading-relaxed">
              Department <strong className="font-bold text-amber-950">{deptDepModal?.dept.name}</strong> ({deptDepModal?.dept.code}) has the following associated records in the ERP database:
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                <span className="text-slate-500 block">Degree Programs:</span>
                <span className="font-bold text-slate-900">{deptDepModal?.check.references.programs}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                <span className="text-slate-500 block">Faculty Members:</span>
                <span className="font-bold text-slate-900">{deptDepModal?.check.references.faculty}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                <span className="text-slate-500 block">Enrolled Students:</span>
                <span className="font-bold text-slate-900">{deptDepModal?.check.references.students}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                <span className="text-slate-500 block">Subjects / Courses:</span>
                <span className="font-bold text-slate-900">{deptDepModal?.check.references.subjects}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                <span className="text-slate-500 block">Class Sections:</span>
                <span className="font-bold text-slate-900">{deptDepModal?.check.references.sections}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200">
                <span className="text-slate-500 block">Timetable Slots:</span>
                <span className="font-bold text-slate-900">{deptDepModal?.check.references.timetables}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            To preserve historical student transcripts, marks, and attendance data, you can safely <strong>Deactivate</strong> this department instead. Deactivated departments are hidden from active enrollment and scheduling flows without data loss.
          </p>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeptDepModal(null)}>Cancel</Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={async () => {
                if (deptDepModal) {
                  await updateDepartment(deptDepModal.dept.id, { active: false });
                  setDeptDepModal(null);
                }
              }}
            >
              Deactivate Department Instead
            </Button>
          </div>
        </div>
      </Modal>

      {/* Set Current Academic Term Modal */}
      <Modal
        isOpen={isTermModalOpen}
        onClose={() => setIsTermModalOpen(false)}
        title="Set Current Academic Term"
        description="Switch the institutional term cycle between ODD (Semesters 1, 3, 5, 7) and EVEN (Semesters 2, 4, 6, 8)"
        maxWidth="md"
      >
        <form onSubmit={handleSetCurrentTerm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Session</label>
            <select
              value={selectedTermSessionId}
              onChange={(e) => setSelectedTermSessionId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  Session {s.name} {s.is_current ? '(Current Active Session)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Term Cycle</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={clsx(
                "p-3 rounded-2xl border text-xs font-bold flex flex-col gap-1 cursor-pointer transition-all",
                selectedTermType === 'ODD'
                  ? "bg-amber-50 border-amber-400 text-amber-950 shadow-xs"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}>
                <input
                  type="radio"
                  name="termType"
                  value="ODD"
                  checked={selectedTermType === 'ODD'}
                  onChange={() => setSelectedTermType('ODD')}
                  className="sr-only"
                />
                <span className="text-sm font-black">ODD Term</span>
                <span className="text-[11px] font-normal text-amber-800">
                  Semesters 1, 3, 5, 7 (July–Dec)
                </span>
              </label>

              <label className={clsx(
                "p-3 rounded-2xl border text-xs font-bold flex flex-col gap-1 cursor-pointer transition-all",
                selectedTermType === 'EVEN'
                  ? "bg-blue-50 border-blue-400 text-blue-950 shadow-xs"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}>
                <input
                  type="radio"
                  name="termType"
                  value="EVEN"
                  checked={selectedTermType === 'EVEN'}
                  onChange={() => setSelectedTermType('EVEN')}
                  className="sr-only"
                />
                <span className="text-sm font-black">EVEN Term</span>
                <span className="text-[11px] font-normal text-blue-800">
                  Semesters 2, 4, 6, 8 (Jan–June)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Specific Semester Focus</label>
            <select
              value={selectedTermSemNumber}
              onChange={(e) => setSelectedTermSemNumber(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value="">All {selectedTermType} Semesters (Standard Full-Term Activation)</option>
              {getSemestersForTerm(selectedTermType).map(s => (
                <option key={s} value={s}>
                  Semester {s} ({getYearName(getYearForSemester(s))}) Only
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1 font-medium leading-relaxed">
            <span className="font-bold text-slate-900 block">Term Lifecycle Effect:</span>
            Applying this change sets the selected semesters as ACTIVE and CURRENT in the database, automatically updating all faculty marking, timetable filters, and student portals.
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsTermModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingTerm}>Apply Term Change</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Semester Dates Modal */}
      <Modal
        isOpen={!!editingSemesterDates}
        onClose={() => setEditingSemesterDates(null)}
        title={`Edit Dates — ${editingSemesterDates?.name}`}
        description="Set official start and end dates for this academic term semester"
        maxWidth="md"
      >
        <form onSubmit={handleSaveSemesterDates} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={semStartDate}
              onChange={(e) => setSemStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={semEndDate}
              onChange={(e) => setSemEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingSemesterDates(null)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingSemDates}>Save Dates</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Degree Program Modal */}
      <Modal
        isOpen={!!editingProg}
        onClose={() => setEditingProg(null)}
        title={`Edit Program — ${editingProg?.code}`}
        description="Update program name, code, and degree duration (e.g. MCA = 2 Years, B.Tech = 4 Years)"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEditProg} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Program Code</label>
            <input
              type="text"
              required
              value={editProgCode}
              onChange={(e) => setEditProgCode(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono uppercase shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Degree Program Name</label>
            <input
              type="text"
              required
              value={editProgName}
              onChange={(e) => setEditProgName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Years)</label>
            <select
              value={editProgDuration}
              onChange={(e) => setEditProgDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 shadow-xs focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value={1}>1 Year</option>
              <option value={2}>2 Years (e.g. MCA / MBA / M.Tech)</option>
              <option value={3}>3 Years (e.g. BCA / BBA / Diploma)</option>
              <option value={4}>4 Years (e.g. B.Tech)</option>
              <option value={5}>5 Years</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingProg(null)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Save Program</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

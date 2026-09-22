import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  ShieldAlert, 
  ShieldCheck, 
  Layers, 
  X, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Faculty } from '../../types/database.types';
import { ArchiveAccountModal, ArchiveTarget } from '../../components/admin/ArchiveAccountModal';

interface StagedAssignment {
  section_id: string;
  subject_id: string;
  academic_year_id: string;
  semester_id: string;
  year_name: string;
  section_name: string;
  subject_code: string;
  subject_name: string;
}

interface StagedCoordinator {
  section_id: string;
  academic_year_id: string;
  year_name: string;
  section_name: string;
}

export const FacultyDirectoryPage: React.FC = () => {
  const { user, role } = useAuth();
  const { 
    faculty, 
    departments, 
    subjects, 
    sections, 
    assignments, 
    timetable,
    years,
    semesters,
    classCoordinatorAssignments,
    classrooms,
    createFacultyWithAssignments,
    updateFacultyWithAssignments,
    setFacultyStatus,
    safeDeleteFaculty,
    refreshData,
  } = useAcademic();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'ARCHIVED'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);

  const isSuperAdmin = role === 'super_admin';
  const isHOD = role === 'hod';

  // Helper to resolve all active Class Coordinator assignments for a faculty member
  const getFacultyCoordinations = (fId: string) => {
    const coordMap = new Map<string, {
      sectionId: string;
      yearName: string;
      sectionName: string;
      room?: string;
    }>();

    // 1. Check direct classCoordinatorAssignments from relational table
    const directAssignments = (classCoordinatorAssignments || []).filter(
      cca => cca.active && cca.faculty_id === fId
    );

    // 2. Check direct sections.class_coordinator_id pointer
    const directSecs = (sections || []).filter(
      s => s.active && s.class_coordinator_id === fId
    );

    const processSection = (secId: string, fallbackSec?: any) => {
      if (!secId || coordMap.has(secId)) return;
      const sec = sections.find(s => s.id === secId) || fallbackSec;
      if (!sec) return;

      // 1. Resolve Semester and Academic Year via UUID relations
      const sem = semesters.find(sm => sm.id === sec.semester_id) || sec.semester;
      const yr = sem ? (years.find(y => y.id === sem.academic_year_id) || sem.academic_year) : undefined;
      
      // Fallback: check assignments if semester/year was not directly linked
      const fallbackYr = !yr ? (
        assignments.find(a => a.section_id === sec.id && a.academic_year)?.academic_year ||
        years.find(y => y.id === assignments.find(a => a.section_id === sec.id)?.academic_year_id)
      ) : undefined;

      const finalYr = yr || fallbackYr;
      const yearName = finalYr?.name || (finalYr?.year_number ? `${finalYr.year_number} Year` : 'Academic Year');
      const cleanSecName = (sec.name || '').replace(/^section\s*/i, '').trim() || 'A';

      // 2. Resolve Room (only if an actual room exists in database)
      let rawRoom = sec.room_number ? sec.room_number.trim() : '';
      if (!rawRoom && sec.classroom_id) {
        const cr = classrooms?.find(c => c.id === sec.classroom_id);
        if (cr?.room_number) rawRoom = cr.room_number.trim();
      }
      if (!rawRoom && (sec.classroom as any)?.room_number) {
        rawRoom = (sec.classroom as any).room_number.trim();
      }
      if (!rawRoom) {
        const ttWithRoom = timetable?.find(t => t.section_id === sec.id && t.room_number);
        if (ttWithRoom?.room_number) rawRoom = ttWithRoom.room_number.trim();
      }

      // Format room: e.g. "Room A-302"
      let room: string | undefined = undefined;
      if (rawRoom) {
        room = rawRoom.toLowerCase().startsWith('room') ? rawRoom : `Room ${rawRoom}`;
      }

      coordMap.set(sec.id, {
        sectionId: sec.id,
        yearName,
        sectionName: cleanSecName,
        room
      });
    };

    directAssignments.forEach(cca => {
      processSection(cca.section_id, cca.section);
    });

    directSecs.forEach(s => {
      processSection(s.id, s);
    });

    return Array.from(coordMap.values());
  };

  // Active academic years across all cohorts
  const activeCohorts = useMemo(() => {
    return years.filter(y => y.active);
  }, [years]);

  // ==========================================
  // Add Faculty Modal State
  // ==========================================
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const [facCode, setFacCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [deptId, setDeptId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addModalError, setAddModalError] = useState<string | null>(null);

  // Add Faculty - Assignment Builder State
  const [assignYearId, setAssignYearId] = useState('');
  const [assignSectionId, setAssignSectionId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [stagedAssignments, setStagedAssignments] = useState<StagedAssignment[]>([]);

  // Add Faculty - Class Coordinator Builder State
  const [assignCoordYearId, setAssignCoordYearId] = useState('');
  const [assignCoordSectionId, setAssignCoordSectionId] = useState('');
  const [stagedCoordinators, setStagedCoordinators] = useState<StagedCoordinator[]>([]);

  // ==========================================
  // Edit Faculty Modal State
  // ==========================================
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editFacCode, setEditFacCode] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAssignments, setEditAssignments] = useState<StagedAssignment[]>([]);
  const [editAssignYearId, setEditAssignYearId] = useState('');
  const [editAssignSectionId, setEditAssignSectionId] = useState('');
  const [editAssignSubjectId, setEditAssignSubjectId] = useState('');
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Edit Faculty - Class Coordinator State
  const [editAssignCoordYearId, setEditAssignCoordYearId] = useState('');
  const [editAssignCoordSectionId, setEditAssignCoordSectionId] = useState('');
  const [editCoordinators, setEditCoordinators] = useState<StagedCoordinator[]>([]);

  // Duplicate Coordinator Replacement Confirmation Modal
  const [confirmReplacementModal, setConfirmReplacementModal] = useState<{
    isOpen: boolean;
    sectionName: string;
    yearName: string;
    currentFacultyName: string;
    newFacultyName: string;
    onConfirm: () => void;
  } | null>(null);

  // Initialize deptId when departments load
  React.useEffect(() => {
    if (departments.length > 0 && !deptId) {
      setDeptId(departments[0].id);
    }
  }, [departments, deptId]);

  // Cascading helpers for Add Modal
  const availableAddSections = useMemo(() => {
    if (!assignYearId) return [];
    return sections.filter(s => {
      if (!s.active) return false;
      const sem = semesters.find(sm => sm.id === s.semester_id);
      return sem?.academic_year_id === assignYearId;
    });
  }, [sections, semesters, assignYearId]);

  const availableAddSubjects = useMemo(() => {
    if (!assignSectionId) return [];
    const sec = sections.find(s => s.id === assignSectionId);
    const targetSemId = sec?.semester_id;
    if (!targetSemId) return [];
    return subjects.filter(s => s.active && s.semester_id === targetSemId);
  }, [subjects, sections, assignSectionId]);

  // Cascading helpers for Edit Modal
  const availableEditSections = useMemo(() => {
    if (!editAssignYearId) return [];
    return sections.filter(s => {
      if (!s.active) return false;
      const sem = semesters.find(sm => sm.id === s.semester_id);
      return sem?.academic_year_id === editAssignYearId;
    });
  }, [sections, semesters, editAssignYearId]);

  const availableEditSubjects = useMemo(() => {
    if (!editAssignSectionId) return [];
    const sec = sections.find(s => s.id === editAssignSectionId);
    const targetSemId = sec?.semester_id;
    if (!targetSemId) return [];
    return subjects.filter(s => s.active && s.semester_id === targetSemId);
  }, [subjects, sections, editAssignSectionId]);

  // Coordinator Cascading helpers for Add Modal
  const availableAddCoordSections = useMemo(() => {
    if (!assignCoordYearId) return [];
    return sections.filter(s => {
      if (!s.active) return false;
      const sem = semesters.find(sm => sm.id === s.semester_id);
      return sem?.academic_year_id === assignCoordYearId;
    });
  }, [sections, semesters, assignCoordYearId]);

  // Coordinator Cascading helpers for Edit Modal
  const availableEditCoordSections = useMemo(() => {
    if (!editAssignCoordYearId) return [];
    return sections.filter(s => {
      if (!s.active) return false;
      const sem = semesters.find(sm => sm.id === s.semester_id);
      return sem?.academic_year_id === editAssignCoordYearId;
    });
  }, [sections, semesters, editAssignCoordYearId]);

  // Add staged assignment to Add Modal
  const handleAddStagedAssignment = () => {
    setAddModalError(null);
    if (!assignYearId || !assignSectionId || !assignSubjectId) {
      setAddModalError('Please select Academic Year, Section, and Subject to add an assignment.');
      return;
    }

    const exists = stagedAssignments.some(
      a => a.section_id === assignSectionId && a.subject_id === assignSubjectId
    );
    if (exists) {
      setAddModalError('This Subject and Section assignment is already added.');
      return;
    }

    const yr = years.find(y => y.id === assignYearId);
    const sec = sections.find(s => s.id === assignSectionId);
    const sub = subjects.find(s => s.id === assignSubjectId);

    setStagedAssignments(prev => [
      ...prev,
      {
        section_id: assignSectionId,
        subject_id: assignSubjectId,
        academic_year_id: assignYearId,
        semester_id: sec?.semester_id || '',
        year_name: yr?.name || 'Year',
        section_name: sec?.name || 'Section',
        subject_code: sub?.subject_code || 'Subject',
        subject_name: sub?.subject_name || '',
      },
    ]);

    setAssignSubjectId('');
  };

  // Add staged coordinator to Add Modal
  const handleAddStagedCoordinator = () => {
    setAddModalError(null);
    if (!assignCoordYearId || !assignCoordSectionId) {
      setAddModalError('Please select Academic Year and Section to assign as Class Coordinator.');
      return;
    }

    const exists = stagedCoordinators.some(c => c.section_id === assignCoordSectionId);
    if (exists) {
      setAddModalError('This Section is already assigned as a Coordinator role.');
      return;
    }

    const yr = years.find(y => y.id === assignCoordYearId);
    const sec = sections.find(s => s.id === assignCoordSectionId);
    const yearName = yr?.name || 'Academic Year';
    const secName = (sec?.name || '').replace(/^section\s*/i, '').trim() || 'A';

    // Check if section already has an active coordinator in database
    const existingCoord = (classCoordinatorAssignments || []).find(
      ca => ca.active && ca.section_id === assignCoordSectionId
    );
    const existingFacId = existingCoord?.faculty_id || (sec?.class_coordinator_id || null);
    const existingFac = existingFacId ? faculty.find(f => f.id === existingFacId) : null;

    const doAdd = () => {
      setStagedCoordinators(prev => [
        ...prev,
        {
          section_id: assignCoordSectionId,
          academic_year_id: assignCoordYearId,
          year_name: yearName,
          section_name: secName,
        }
      ]);
      setAssignCoordSectionId('');
    };

    if (existingFac && existingFac.id !== '') {
      setConfirmReplacementModal({
        isOpen: true,
        sectionName: `Section ${secName}`,
        yearName,
        currentFacultyName: existingFac.full_name,
        newFacultyName: fullName.trim() || 'New Faculty',
        onConfirm: () => {
          doAdd();
          setConfirmReplacementModal(null);
        }
      });
    } else {
      doAdd();
    }
  };

  // Add staged assignment to Edit Modal
  const handleAddEditAssignment = () => {
    setEditModalError(null);
    if (!editAssignYearId || !editAssignSectionId || !editAssignSubjectId) {
      setEditModalError('Please select Academic Year, Section, and Subject to add an assignment.');
      return;
    }

    const exists = editAssignments.some(
      a => a.section_id === editAssignSectionId && a.subject_id === editAssignSubjectId
    );
    if (exists) {
      setEditModalError('This Subject and Section assignment is already assigned.');
      return;
    }

    const yr = years.find(y => y.id === editAssignYearId);
    const sec = sections.find(s => s.id === editAssignSectionId);
    const sub = subjects.find(s => s.id === editAssignSubjectId);

    setEditAssignments(prev => [
      ...prev,
      {
        section_id: editAssignSectionId,
        subject_id: editAssignSubjectId,
        academic_year_id: editAssignYearId,
        semester_id: sec?.semester_id || '',
        year_name: yr?.name || 'Year',
        section_name: sec?.name || 'Section',
        subject_code: sub?.subject_code || 'Subject',
        subject_name: sub?.subject_name || '',
      },
    ]);

    setEditAssignSubjectId('');
  };

  // Add coordinator to Edit Modal
  const handleAddEditCoordinator = () => {
    setEditModalError(null);
    if (!editAssignCoordYearId || !editAssignCoordSectionId) {
      setEditModalError('Please select Academic Year and Section to assign as Class Coordinator.');
      return;
    }

    const exists = editCoordinators.some(c => c.section_id === editAssignCoordSectionId);
    if (exists) {
      setEditModalError('This Section is already assigned as a Coordinator role.');
      return;
    }

    const yr = years.find(y => y.id === editAssignCoordYearId);
    const sec = sections.find(s => s.id === editAssignCoordSectionId);
    const yearName = yr?.name || 'Academic Year';
    const secName = (sec?.name || '').replace(/^section\s*/i, '').trim() || 'A';

    // Check if section already has an active coordinator in database other than this faculty
    const existingCoord = (classCoordinatorAssignments || []).find(
      ca => ca.active && ca.section_id === editAssignCoordSectionId && ca.faculty_id !== editingFaculty?.id
    );
    const existingFacId = existingCoord?.faculty_id || (sec?.class_coordinator_id !== editingFaculty?.id ? sec?.class_coordinator_id : null);
    const existingFac = existingFacId ? faculty.find(f => f.id === existingFacId) : null;

    const doAdd = () => {
      setEditCoordinators(prev => [
        ...prev,
        {
          section_id: editAssignCoordSectionId,
          academic_year_id: editAssignCoordYearId,
          year_name: yearName,
          section_name: secName,
        }
      ]);
      setEditAssignCoordSectionId('');
    };

    if (existingFac) {
      setConfirmReplacementModal({
        isOpen: true,
        sectionName: `Section ${secName}`,
        yearName,
        currentFacultyName: existingFac.full_name,
        newFacultyName: editFullName.trim() || editingFaculty?.full_name || 'Faculty',
        onConfirm: () => {
          doAdd();
          setConfirmReplacementModal(null);
        }
      });
    } else {
      doAdd();
    }
  };

  // Open Edit Modal and prefill existing assignments
  const handleOpenEditModal = (f: Faculty) => {
    setEditingFaculty(f);
    setEditFullName(f.full_name);
    setEditFacCode(f.faculty_code || '');
    setEditDesignation(f.designation);
    setEditDeptId(f.department_id || departments[0]?.id || '');
    setEditEmail(f.email || '');
    setEditPhone(f.phone || '');
    setEditModalError(null);

    // Populate active database assignments
    const currentFsa = (assignments || []).filter(a => a.faculty_id === f.id && a.active);
    const mapped = currentFsa.map(a => {
      const sec = sections.find(s => s.id === a.section_id);
      const sub = subjects.find(s => s.id === a.subject_id);
      const sem = semesters.find(s => s.id === (a.semester_id || sec?.semester_id));
      const yr = years.find(y => y.id === (a.academic_year_id || sem?.academic_year_id));
      return {
        section_id: a.section_id,
        subject_id: a.subject_id,
        academic_year_id: yr?.id || a.academic_year_id || '',
        semester_id: sem?.id || a.semester_id || '',
        year_name: yr?.name || a.academic_year?.name || 'Year',
        section_name: sec?.name || a.section?.name || 'Section',
        subject_code: sub?.subject_code || a.subject?.subject_code || 'Subject',
        subject_name: sub?.subject_name || a.subject?.subject_name || '',
      };
    });
    setEditAssignments(mapped);
    setEditAssignYearId(activeCohorts[0]?.id || '');
    setEditAssignSectionId('');
    setEditAssignSubjectId('');

    // Populate active database coordinator assignments
    const coords = getFacultyCoordinations(f.id);
    const mappedCoords = coords.map(c => {
      const sec = sections.find(s => s.id === c.sectionId);
      const sem = semesters.find(sm => sm.id === sec?.semester_id);
      const yr = years.find(y => y.id === sem?.academic_year_id);
      return {
        section_id: c.sectionId,
        academic_year_id: yr?.id || '',
        year_name: c.yearName,
        section_name: c.sectionName,
      };
    });
    setEditCoordinators(mappedCoords);
    setEditAssignCoordYearId(activeCohorts[0]?.id || '');
    setEditAssignCoordSectionId('');
  };

  // Submit Add Faculty
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddModalError(null);
    if (!empCode.trim() || !fullName.trim() || !email.trim()) {
      setAddModalError('Employee code, full name, and official email are required.');
      return;
    }

    try {
      setActionLoading('creating');
      await createFacultyWithAssignments({
        faculty: {
          department_id: deptId,
          employee_code: empCode.trim().toUpperCase(),
          faculty_code: facCode.trim().toUpperCase() || undefined,
          full_name: fullName.trim(),
          designation: designation.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          active: true,
          status: 'ACTIVE',
        },
        assignments: stagedAssignments.map(a => ({
          section_id: a.section_id,
          subject_id: a.subject_id,
          academic_year_id: a.academic_year_id,
          semester_id: a.semester_id,
        })),
        coordinatorAssignments: stagedCoordinators.map(c => ({
          section_id: c.section_id,
          academic_year_id: c.academic_year_id,
        })),
        actorName: user?.full_name || 'Administrator',
      });

      // Reset
      setEmpCode('');
      setFacCode('');
      setFullName('');
      setEmail('');
      setPhone('');
      setStagedAssignments([]);
      setStagedCoordinators([]);
      setAssignCoordYearId('');
      setAssignCoordSectionId('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Failed to add faculty:', err);
      setAddModalError(err.message || 'Failed to add faculty member');
    } finally {
      setActionLoading(null);
    }
  };

  // Submit Edit Faculty
  const handleUpdateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setEditModalError(null);

    if (!editFullName.trim() || !editEmail.trim()) {
      setEditModalError('Full name and email are required.');
      return;
    }

    try {
      setActionLoading('updating');
      await updateFacultyWithAssignments({
        facultyId: editingFaculty.id,
        updates: {
          full_name: editFullName.trim(),
          faculty_code: editFacCode.trim().toUpperCase() || undefined,
          designation: editDesignation.trim(),
          department_id: editDeptId,
          email: editEmail.trim().toLowerCase(),
          phone: editPhone.trim() || undefined,
        },
        assignments: editAssignments.map(a => ({
          section_id: a.section_id,
          subject_id: a.subject_id,
          academic_year_id: a.academic_year_id,
          semester_id: a.semester_id,
        })),
        coordinatorAssignments: editCoordinators.map(c => ({
          section_id: c.section_id,
          academic_year_id: c.academic_year_id,
        })),
        actorName: user?.full_name || 'Administrator',
      });

      setEditingFaculty(null);
    } catch (err: any) {
      console.error('Failed to update faculty:', err);
      setEditModalError(err.message || 'Failed to update faculty credentials and assignments');
    } finally {
      setActionLoading(null);
    }
  };

  // Status Toggle (Block / Unblock)
  const handleToggleStatus = async (f: Faculty) => {
    const isCurrentlyBlocked = f.status === 'BLOCKED';
    const targetStatus = isCurrentlyBlocked ? 'ACTIVE' : 'BLOCKED';
    const promptMsg = isCurrentlyBlocked
      ? `Unblock ${f.full_name}? This will restore portal login and teaching operations.`
      : `Block ${f.full_name}? This will prevent portal login and attendance operations while preserving all historical records.`;

    if (window.confirm(promptMsg)) {
      try {
        setActionLoading(`status_${f.id}`);
        await setFacultyStatus(f.id, targetStatus, undefined, user?.full_name || 'Administrator');
      } catch (err: any) {
        alert(err.message || 'Failed to update faculty status');
      } finally {
        setActionLoading(null);
      }
    }
  };

  // Safe Delete / Archive
  const handleSafeDelete = (f: Faculty) => {
    setArchiveTarget({
      id: f.id,
      name: f.full_name,
      role: 'faculty',
      identifier: f.employee_code,
      currentStatus: f.status,
      email: f.email,
    });
  };

  // Filtered Faculty List
  const filteredFaculty = useMemo(() => {
    return faculty.filter(f => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const currentStatus = f.status || (f.active ? 'ACTIVE' : 'BLOCKED');
        if (currentStatus !== statusFilter) return false;
      }

      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        f.full_name.toLowerCase().includes(term) ||
        f.employee_code.toLowerCase().includes(term) ||
        (f.faculty_code && f.faculty_code.toLowerCase().includes(term)) ||
        (f.email && f.email.toLowerCase().includes(term)) ||
        f.designation.toLowerCase().includes(term)
      );
    });
  }, [faculty, statusFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif-institutional font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-slate-900" />
            Faculty Master Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative faculty management, subject-section assignments, and authentication status
          </p>
        </div>

        {(isSuperAdmin || isHOD) && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setIsAddModalOpen(true);
              setAssignYearId(activeCohorts[0]?.id || '');
              setAssignSectionId('');
              setAssignSubjectId('');
              setStagedAssignments([]);
              setAddModalError(null);
            }}
            leftIcon={<Plus className="w-4 h-4 text-white" />}
            className="rounded-xl shadow-xs"
          >
            Add Faculty Member
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, code, or email..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="BLOCKED">Blocked Only</option>
            <option value="ARCHIVED">Archived Only</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
          Showing {filteredFaculty.length} of {faculty.length} Faculty
        </span>
      </div>

      {/* Faculty Cards Grid */}
      {filteredFaculty.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-500 border border-slate-200/80 shadow-xs">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="font-semibold text-slate-800">No faculty members found</p>
          <p className="text-xs text-slate-500 mt-1">Register faculty using the "Add Faculty Member" button</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFaculty.map((f) => {
            const dept = departments.find(d => d.id === f.department_id);
            const isFacultyHOD = f.designation.toLowerCase().includes('hod');
            const currentStatus = f.status || (f.active ? 'ACTIVE' : 'BLOCKED');

            // Resolve real assignments
            const myFsa = (assignments || []).filter(a => a.faculty_id === f.id && a.active);
            const myTt = (timetable || []).filter(t => t.faculty_id === f.id && t.active);

            // Real subject codes
            const subCodes = Array.from(new Set([
              ...myFsa.map(a => {
                const s = subjects.find(sub => sub.id === a.subject_id);
                return s?.subject_code || a.subject?.subject_code;
              }),
              ...myTt.map(t => {
                const s = subjects.find(sub => sub.id === t.subject_id);
                return s?.subject_code || t.subject?.subject_code;
              }),
            ].filter(Boolean)));

            // Real assigned sections with academic year
            const sectionYearSet = new Set<string>();
            myFsa.forEach(a => {
              const sec = sections.find(s => s.id === a.section_id);
              const sem = semesters.find(sm => sm.id === (a.semester_id || sec?.semester_id));
              const yr = years.find(y => y.id === (a.academic_year_id || sem?.academic_year_id));
              const yrName = yr?.name || a.academic_year?.name || '';
              const secName = (sec?.name || a.section?.name || '').replace(/^section\s*/i, '').trim();
              if (secName) {
                sectionYearSet.add(yrName ? `${yrName} • Sec ${secName}` : `Sec ${secName}`);
              }
            });
            myTt.forEach(t => {
              const sec = sections.find(s => s.id === t.section_id);
              const sem = semesters.find(sm => sm.id === sec?.semester_id);
              const yr = years.find(y => y.id === sem?.academic_year_id);
              const yrName = yr?.name || '';
              const secName = (sec?.name || '').replace(/^section\s*/i, '').trim();
              if (secName) {
                sectionYearSet.add(yrName ? `${yrName} • Sec ${secName}` : `Sec ${secName}`);
              }
            });
            const assignedSecList = Array.from(sectionYearSet);

            const coordinatedAssignments = getFacultyCoordinations(f.id);

            return (
              <div
                key={f.id}
                className={`bg-white rounded-3xl p-5 border transition-all space-y-3 relative overflow-hidden shadow-xs hover:border-slate-300 hover:shadow-sm ${
                  currentStatus === 'BLOCKED'
                    ? 'border-rose-200 bg-rose-50/20'
                    : currentStatus === 'ARCHIVED'
                    ? 'border-slate-200 bg-slate-50 opacity-75'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Top Badges & Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Status Badge */}
                    {currentStatus === 'ACTIVE' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> ACTIVE
                      </span>
                    )}
                    {currentStatus === 'BLOCKED' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <ShieldAlert className="w-2.5 h-2.5" /> BLOCKED
                      </span>
                    )}
                    {currentStatus === 'ARCHIVED' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        ARCHIVED
                      </span>
                    )}

                    {isFacultyHOD && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
                        HOD
                      </span>
                    )}
                  </div>

                  {(isSuperAdmin || isHOD) && (
                    <div className="flex items-center gap-1">
                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEditModal(f)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit Faculty & Assignments"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Block / Unblock Button */}
                      <button
                        onClick={() => handleToggleStatus(f)}
                        disabled={actionLoading === `status_${f.id}`}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          currentStatus === 'BLOCKED'
                            ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                        }`}
                        title={currentStatus === 'BLOCKED' ? 'Unblock Faculty' : 'Block Faculty'}
                      >
                        {currentStatus === 'BLOCKED' ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          <ShieldAlert className="w-4 h-4" />
                        )}
                      </button>

                      {/* Safe Delete / Archive Button */}
                      <button
                        onClick={() => handleSafeDelete(f)}
                        disabled={actionLoading === `delete_${f.id}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Safe Delete / Archive Faculty"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Identity Header */}
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shadow-xs ${
                    currentStatus === 'BLOCKED'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-[#0f172a] text-white'
                  }`}>
                    {f.faculty_code || f.full_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">
                      {f.full_name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                      {f.designation}
                    </p>
                  </div>
                </div>

                {/* Academic Metadata & Assignments */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee Code:</span>
                    <span className="font-mono font-bold text-slate-900">{f.employee_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timetable Code:</span>
                    <span className="font-mono font-bold text-slate-900">{f.faculty_code || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-semibold text-slate-800">{dept?.name || 'CSE'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Official Email:</span>
                    <span className="text-slate-700 font-mono text-[11px] truncate max-w-[170px]" title={f.email}>
                      {f.email}
                    </span>
                  </div>
                  {f.phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className="text-slate-700 font-mono text-[11px]">{f.phone}</span>
                    </div>
                  )}

                  {/* Real Database Assigned Subjects */}
                  <div className="flex justify-between items-start gap-1 pt-1 border-t border-slate-100">
                    <span className="text-slate-500 shrink-0">Assigned Subjects:</span>
                    <span className="text-slate-900 font-mono font-bold text-[11px] text-right truncate max-w-[180px]" title={subCodes.join(', ')}>
                      {subCodes.length > 0 ? subCodes.join(', ') : 'None'}
                    </span>
                  </div>

                  {/* Real Database Assigned Sections */}
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-slate-500 shrink-0">Assigned Sections:</span>
                    <span className="text-slate-800 font-semibold text-[11px] text-right">
                      {assignedSecList.length > 0 ? assignedSecList.join(', ') : 'None'}
                    </span>
                  </div>

                  {/* Class Coordinator Badge */}
                  {coordinatedAssignments.length > 0 && (
                    <div className="mt-2.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold text-[11px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                        <span>Class Coordinator</span>
                      </div>
                      <div className="space-y-1.5">
                        {coordinatedAssignments.map(coord => (
                          <div 
                            key={coord.sectionId} 
                            className="flex flex-wrap items-center justify-between gap-1 text-xs pt-1 border-t border-slate-200/60 first:border-0 first:pt-0"
                          >
                            <span className="text-slate-900 font-bold">
                              {coord.yearName} • Section {coord.sectionName}
                            </span>
                            {coord.room && (
                              <span className="text-slate-800 font-mono text-[11px] font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                                {coord.room}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. ADD FACULTY MEMBER MODAL WITH ASSIGNMENT BUILDER */}
      {/* ======================================================== */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Faculty Member & Assignments"
        description="Register a teaching faculty member with verified academic assignments across cohorts"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateFaculty} className="space-y-4">
          {addModalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addModalError}</span>
            </div>
          )}

          {/* Master Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Employee Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                placeholder="e.g. FAC-CSE-015"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Timetable Code (3-4 letters)
              </label>
              <input
                type="text"
                maxLength={4}
                value={facCode}
                onChange={(e) => setFacCode(e.target.value)}
                placeholder="e.g. RKS"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 uppercase font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Legal Name with Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Rajesh Kumar Sharma"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Email (Portal Login) <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. rajesh.cse@vctm.in"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          {/* ======================================================== */}
          {/* ASSIGNMENT BUILDER (YEAR -> SECTION -> SUBJECT) */}
          {/* ======================================================== */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Academic Subject & Section Assignments
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Assign teaching subjects across active cohorts (1st Year strictly excluded)
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                {stagedAssignments.length} Staged
              </span>
            </div>

            {/* Cascading Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {/* Year */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Academic Year</label>
                <select
                  value={assignYearId}
                  onChange={(e) => {
                    setAssignYearId(e.target.value);
                    setAssignSectionId('');
                    setAssignSubjectId('');
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs"
                >
                  <option value="">— Select Year —</option>
                  {activeCohorts.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section</label>
                <select
                  value={assignSectionId}
                  disabled={!assignYearId}
                  onChange={(e) => {
                    setAssignSectionId(e.target.value);
                    setAssignSubjectId('');
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs disabled:opacity-50"
                >
                  <option value="">— Select Section —</option>
                  {availableAddSections.map(s => (
                    <option key={s.id} value={s.id}>Section {s.name}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Subject</label>
                <select
                  value={assignSubjectId}
                  disabled={!assignSectionId}
                  onChange={(e) => setAssignSubjectId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs disabled:opacity-50"
                >
                  <option value="">— Select Subject —</option>
                  {availableAddSubjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.subject_code} - {s.subject_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStagedAssignment}
                disabled={!assignYearId || !assignSectionId || !assignSubjectId}
                className="text-xs"
              >
                + Add Assignment
              </Button>
            </div>

            {/* Staged Assignments List */}
            {stagedAssignments.length > 0 ? (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                {stagedAssignments.map((a, idx) => (
                  <div
                    key={`${a.section_id}_${a.subject_id}_${idx}`}
                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[10px]">
                        {a.year_name} • Sec {a.section_name}
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-[11px]">
                        {a.subject_code}
                      </span>
                      <span className="text-slate-600 text-[11px] truncate max-w-[200px]">
                        {a.subject_name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStagedAssignments(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-rose-500 p-1 cursor-pointer"
                      title="Remove assignment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic text-center py-1">
                No assignments staged. You can add assignments now or assign later.
              </p>
            )}
          </div>

          {/* ======================================================== */}
          {/* CLASS COORDINATOR ASSIGNMENT (YEAR -> SECTION) */}
          {/* ======================================================== */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
                  Class Coordinator Role Assignment
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Assign this faculty member as Class Coordinator for a specific section
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                {stagedCoordinators.length} Staged
              </span>
            </div>

            {/* Cascading Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Academic Year</label>
                <select
                  value={assignCoordYearId}
                  onChange={(e) => {
                    setAssignCoordYearId(e.target.value);
                    setAssignCoordSectionId('');
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs"
                >
                  <option value="">— Select Year —</option>
                  {activeCohorts.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section</label>
                <select
                  value={assignCoordSectionId}
                  disabled={!assignCoordYearId}
                  onChange={(e) => setAssignCoordSectionId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs disabled:opacity-50"
                >
                  <option value="">— Select Section —</option>
                  {availableAddCoordSections.map(s => (
                    <option key={s.id} value={s.id}>Section {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStagedCoordinator}
                disabled={!assignCoordYearId || !assignCoordSectionId}
                className="text-xs"
              >
                + Assign Coordinator Role
              </Button>
            </div>

            {/* Staged Coordinators List */}
            {stagedCoordinators.length > 0 ? (
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                {stagedCoordinators.map((c, idx) => (
                  <div
                    key={`${c.section_id}_${idx}`}
                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-[10px]">
                        Class Coordinator
                      </span>
                      <span className="font-bold text-slate-900 text-xs">
                        {c.year_name} • Section {c.section_name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStagedCoordinators(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-rose-500 p-1 cursor-pointer"
                      title="Remove coordinator role"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic text-center py-1">
                No coordinator role assigned (optional).
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={actionLoading === 'creating'}
              className="rounded-xl shadow-xs"
            >
              {actionLoading === 'creating' ? 'Saving Faculty...' : 'Save Faculty & Assignments'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* 2. EDIT FACULTY & ASSIGNMENT MANAGER MODAL */}
      {/* ======================================================== */}
      {editingFaculty && (
        <Modal
          isOpen={Boolean(editingFaculty)}
          onClose={() => setEditingFaculty(null)}
          title={`Edit Faculty — ${editingFaculty.full_name}`}
          description="Update faculty profile and reconcile teaching assignments synchronized with Supabase"
          maxWidth="lg"
        >
          <form onSubmit={handleUpdateFaculty} className="space-y-4 text-xs">
            {editModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editModalError}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Timetable Code</label>
                <input
                  type="text"
                  maxLength={4}
                  value={editFacCode}
                  onChange={(e) => setEditFacCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 uppercase font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Department</label>
                <select
                  value={editDeptId}
                  onChange={(e) => setEditDeptId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Official / Login Email *
              </label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>

            {/* Assignments Manager inside Edit Modal */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Manage Subject & Section Assignments
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Active teaching assignments for this faculty member
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                  {editAssignments.length} Assigned
                </span>
              </div>

              {/* Existing / Staged Assignments */}
              {editAssignments.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {editAssignments.map((a, idx) => (
                    <div
                      key={`${a.section_id}_${a.subject_id}_${idx}`}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[10px]">
                          {a.year_name} • Sec {a.section_name}
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-[11px]">
                          {a.subject_code}
                        </span>
                        <span className="text-slate-600 text-[11px] truncate max-w-[180px]">
                          {a.subject_name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditAssignments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-rose-500 p-1 cursor-pointer"
                        title="Remove assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic text-center py-1">
                  No active assignments. Add one below to grant attendance and timetable rights.
                </p>
              )}

              {/* Add New Assignment to Edit List */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">Add New Assignment</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={editAssignYearId}
                    onChange={(e) => {
                      setEditAssignYearId(e.target.value);
                      setEditAssignSectionId('');
                      setEditAssignSubjectId('');
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs"
                  >
                    <option value="">— Select Year —</option>
                    {activeCohorts.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>

                  <select
                    value={editAssignSectionId}
                    disabled={!editAssignYearId}
                    onChange={(e) => {
                      setEditAssignSectionId(e.target.value);
                      setEditAssignSubjectId('');
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs disabled:opacity-50"
                  >
                    <option value="">— Select Section —</option>
                    {availableEditSections.map(s => (
                      <option key={s.id} value={s.id}>Section {s.name}</option>
                    ))}
                  </select>

                  <select
                    value={editAssignSubjectId}
                    disabled={!editAssignSectionId}
                    onChange={(e) => setEditAssignSubjectId(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs disabled:opacity-50"
                  >
                    <option value="">— Select Subject —</option>
                    {availableEditSubjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.subject_code} - {s.subject_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddEditAssignment}
                    disabled={!editAssignYearId || !editAssignSectionId || !editAssignSubjectId}
                    className="text-xs"
                  >
                    + Add to Assignments
                  </Button>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* CLASS COORDINATOR ASSIGNMENTS (YEAR -> SECTION) */}
            {/* ======================================================== */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
                    Class Coordinator Role Assignments
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Manage active class coordinator assignments for this faculty member
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                  {editCoordinators.length} Assigned
                </span>
              </div>

              {/* Current Coordinator Assignments */}
              {editCoordinators.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {editCoordinators.map((c, idx) => (
                    <div
                      key={`${c.section_id}_${idx}`}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-[10px]">
                          Class Coordinator
                        </span>
                        <span className="font-bold text-slate-900 text-xs">
                          {c.year_name} • Section {c.section_name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditCoordinators(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-rose-500 p-1 cursor-pointer"
                        title="Remove coordinator role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic text-center py-1">
                  No active class coordinator role assigned to this faculty member.
                </p>
              )}

              {/* Add New Coordinator to Edit List */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">Assign New Class Coordinator Role</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={editAssignCoordYearId}
                    onChange={(e) => {
                      setEditAssignCoordYearId(e.target.value);
                      setEditAssignCoordSectionId('');
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs"
                  >
                    <option value="">— Select Year —</option>
                    {activeCohorts.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>

                  <select
                    value={editAssignCoordSectionId}
                    disabled={!editAssignCoordYearId}
                    onChange={(e) => setEditAssignCoordSectionId(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-slate-400 shadow-xs disabled:opacity-50"
                  >
                    <option value="">— Select Section —</option>
                    {availableEditCoordSections.map(s => (
                      <option key={s.id} value={s.id}>Section {s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddEditCoordinator}
                    disabled={!editAssignCoordYearId || !editAssignCoordSectionId}
                    className="text-xs"
                  >
                    + Assign Coordinator Role
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingFaculty(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={actionLoading === 'updating'}
                className="rounded-xl shadow-xs"
              >
                {actionLoading === 'updating' ? 'Saving...' : 'Save & Synchronize All Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Duplicate Coordinator Replacement Confirmation Modal */}
      {confirmReplacementModal && confirmReplacementModal.isOpen && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmReplacementModal(null)}
          title="Confirm Coordinator Replacement"
          description="A section can have only one active Class Coordinator"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <p className="font-semibold text-sm text-slate-900">
                Replace existing class coordinator?
              </p>
              <p className="text-slate-700 leading-relaxed">
                <strong>{confirmReplacementModal.sectionName}</strong> ({confirmReplacementModal.yearName}) currently has{' '}
                <strong className="text-slate-900">{confirmReplacementModal.currentFacultyName}</strong> as Class Coordinator.
              </p>
              <p className="text-slate-700 leading-relaxed">
                Do you want to replace them with <strong className="text-slate-900">{confirmReplacementModal.newFacultyName}</strong>?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmReplacementModal(null)}
                className="border-slate-200 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmReplacementModal.onConfirm}
                className="bg-[#0f172a] hover:bg-black text-white rounded-xl shadow-xs font-bold"
              >
                Confirm Replacement
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Archive / Departure Modal */}
      <ArchiveAccountModal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        target={archiveTarget}
        onSuccess={() => {
          setArchiveTarget(null);
          refreshData(true);
        }}
      />
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Search,
  ArrowRightLeft,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  GraduationCap,
  Calendar,
  Layers,
  DoorOpen,
  UserCheck,
  X,
  FileDown
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Section, Student, AdmissionType } from '../../types/database.types';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { exportToCSV } from '../../lib/utils/exportUtils';
import { fetchCSVContent } from '../../lib/utils/urlUtils';
import Papa from 'papaparse';
import { clsx } from 'clsx';

interface SectionStudentManagementModalProps {
  section: Section | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SectionStudentManagementModal: React.FC<SectionStudentManagementModalProps> = ({
  section,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const {
    students,
    semesters,
    years,
    departments,
    programs,
    faculty,
    sections,
    sessions,
    addStudent,
    updateStudent,
    transferStudentSection,
    batchImportSectionStudents,
    refreshStudents,
  } = useAcademic();

  // Ensure section students are loaded on modal open
  useEffect(() => {
    if (section?.id) {
      refreshStudents(section.id);
    }
  }, [section?.id, refreshStudents]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Sub-modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [transferStudent, setTransferStudent] = useState<Student | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRollNumber, setEditRollNumber] = useState('');
  const [editEnrollmentNumber, setEditEnrollmentNumber] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAdmissionType, setEditAdmissionType] = useState<AdmissionType>('Regular');
  const [editMentorFacultyId, setEditMentorFacultyId] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add Student form state
  const [addFullName, setAddFullName] = useState('');
  const [addRollNumber, setAddRollNumber] = useState('');
  const [addEnrollmentNumber, setAddEnrollmentNumber] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAdmissionType, setAddAdmissionType] = useState<AdmissionType>('Regular');
  const [addMentorFacultyId, setAddMentorFacultyId] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Import sub-modal state
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [importUrl, setImportUrl] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [parsedImportRows, setParsedImportRows] = useState<Array<{
    roll_number: string;
    full_name: string;
    email?: string;
    phone?: string;
    admission_type?: AdmissionType;
    status: 'NEW' | 'UPDATE' | 'INVALID';
    reason?: string;
  }>>([]);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Derive academic hierarchy metadata for the active section
  const sectionSemester = useMemo(() => {
    return semesters.find(s => s.id === section?.semester_id);
  }, [semesters, section?.semester_id]);

  const sectionYear = useMemo(() => {
    return years.find(y => y.id === sectionSemester?.academic_year_id);
  }, [years, sectionSemester?.academic_year_id]);

  const sectionProgram = useMemo(() => {
    return programs.find(p => p.id === sectionYear?.program_id);
  }, [programs, sectionYear?.program_id]);

  const sectionDept = useMemo(() => {
    return departments.find(d => d.id === sectionProgram?.department_id) ||
      departments.find(d => d.id === user?.department_id) ||
      departments[0];
  }, [departments, sectionProgram?.department_id, user?.department_id]);

  const coordinator = useMemo(() => {
    return faculty.find(f => f.id === section?.class_coordinator_id);
  }, [faculty, section?.class_coordinator_id]);

  // Section-scoped students
  const sectionStudents = useMemo(() => {
    if (!section) return [];
    return students.filter(s => s.section_id === section.id);
  }, [students, section?.id]);

  // Filtered students for display
  const filteredStudents = useMemo(() => {
    return sectionStudents.filter(s => {
      // Status filter
      if (statusFilter === 'ACTIVE' && !s.active) return false;
      if (statusFilter === 'INACTIVE' && s.active) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchRoll = s.roll_number.toLowerCase().includes(term);
        const matchName = s.full_name.toLowerCase().includes(term);
        const matchEmail = s.email?.toLowerCase().includes(term);
        if (!matchRoll && !matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [sectionStudents, statusFilter, searchTerm]);

  // KPIs
  const totalStudentsCount = sectionStudents.length;
  const activeStudentsCount = sectionStudents.filter(s => s.active).length;
  const inactiveStudentsCount = totalStudentsCount - activeStudentsCount;

  // Available target sections for transfer (same department or institution)
  const availableTargetSections = useMemo(() => {
    if (!section) return [];
    return sections.filter(s => s.id !== section.id && s.active);
  }, [sections, section?.id]);

  // Handlers
  const handleToggleStudentStatus = async (student: Student) => {
    const action = student.active ? 'deactivate' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${student.full_name} (${student.roll_number})? All historical attendance and grade records will remain completely intact.`)) {
      return;
    }
    try {
      await updateStudent(student.id, { active: !student.active });
      await refreshStudents();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} student.`);
    }
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setEditFullName(student.full_name);
    setEditRollNumber(student.roll_number);
    setEditEnrollmentNumber(student.enrollment_number || '');
    setEditEmail(student.email || '');
    setEditPhone(student.phone || '');
    setEditAdmissionType(student.admission_type || 'Regular');
    setEditMentorFacultyId(student.mentor_faculty_id || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editFullName.trim() || !editRollNumber.trim()) {
      setEditError('Full Name and University Roll Number are required.');
      return;
    }

    // Check roll number uniqueness if changed
    const duplicate = students.find(
      s => s.id !== editingStudent.id && s.roll_number.toLowerCase().trim() === editRollNumber.toLowerCase().trim()
    );
    if (duplicate) {
      setEditError(`Roll number "${editRollNumber}" is already assigned to ${duplicate.full_name}.`);
      return;
    }

    // Check enrollment number uniqueness if changed
    if (editEnrollmentNumber.trim()) {
      const dupEnroll = students.find(
        s => s.id !== editingStudent.id && s.enrollment_number && s.enrollment_number.toLowerCase().trim() === editEnrollmentNumber.toLowerCase().trim()
      );
      if (dupEnroll) {
        setEditError(`Enrollment number "${editEnrollmentNumber}" is already assigned to ${dupEnroll.full_name}.`);
        return;
      }
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      await updateStudent(editingStudent.id, {
        full_name: editFullName.trim(),
        roll_number: editRollNumber.trim(),
        enrollment_number: editEnrollmentNumber.trim() || undefined,
        email: editEmail.trim() || `${editRollNumber.trim()}@vctm.in`,
        phone: editPhone.trim() || undefined,
        admission_type: editAdmissionType,
        mentor_faculty_id: editMentorFacultyId || undefined,
      });
      await refreshStudents();
      setEditingStudent(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update student details.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenTransfer = (student: Student) => {
    setTransferStudent(student);
    setTargetSectionId('');
    setTransferError(null);
  };

  const handleExecuteTransfer = async () => {
    if (!transferStudent || !targetSectionId) {
      setTransferError('Please select a target section.');
      return;
    }

    const targetSec = sections.find(s => s.id === targetSectionId);
    if (!targetSec) {
      setTransferError('Target section not found.');
      return;
    }

    setIsTransferring(true);
    setTransferError(null);
    try {
      await transferStudentSection({
        studentId: transferStudent.id,
        newSectionId: targetSectionId,
        transferredBy: user?.full_name || 'Administrator',
      });
      await refreshStudents();
      setTransferStudent(null);
    } catch (err: any) {
      setTransferError(err.message || 'Failed to transfer student.');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!section) return;

    if (!addFullName.trim() || !addRollNumber.trim()) {
      setAddError('Full Name and University Roll Number are required.');
      return;
    }

    // Check duplicate roll number
    const duplicate = students.find(
      s => s.roll_number.toLowerCase().trim() === addRollNumber.toLowerCase().trim()
    );
    if (duplicate) {
      setAddError(`Roll number "${addRollNumber}" already exists for student "${duplicate.full_name}".`);
      return;
    }

    // Check duplicate enrollment number if provided
    if (addEnrollmentNumber.trim()) {
      const dupEnroll = students.find(
        s => s.enrollment_number && s.enrollment_number.toLowerCase().trim() === addEnrollmentNumber.toLowerCase().trim()
      );
      if (dupEnroll) {
        setAddError(`Enrollment number "${addEnrollmentNumber}" already exists for student "${dupEnroll.full_name}".`);
        return;
      }
    }

    setIsAdding(true);
    setAddError(null);
    try {
      if (!sectionYear || !sectionSemester) {
        throw new Error('Cannot determine academic year or semester for this section.');
      }

      const activeSession = sessions.find(s => s.is_current) || sessions[0];
      await addStudent({
        institution_id: sectionDept?.institution_id || '22398afa-8679-4d2c-87fc-312152a276e2',
        department_id: sectionDept?.id || '',
        program_id: sectionProgram?.id || '',
        academic_session_id: activeSession?.id || '',
        academic_year_id: sectionYear.id,
        semester_id: sectionSemester.id,
        section_id: section.id,
        roll_number: addRollNumber.trim(),
        enrollment_number: addEnrollmentNumber.trim() || undefined,
        full_name: addFullName.trim(),
        admission_type: addAdmissionType,
        email: addEmail.trim() || `${addRollNumber.trim()}@vctm.in`,
        phone: addPhone.trim() || undefined,
        mentor_faculty_id: addMentorFacultyId || undefined,
        active: true,
      });

      await refreshStudents();
      setAddFullName('');
      setAddRollNumber('');
      setAddEnrollmentNumber('');
      setAddEmail('');
      setAddPhone('');
      setAddAdmissionType('Regular');
      setAddMentorFacultyId('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add student to section.');
    } finally {
      setIsAdding(false);
    }
  };

  // CSV / Google Sheet Import Parsing Logic
  const processRawCsvContent = (csvContent: string) => {
    setIsParsingImport(true);
    setImportError(null);
    setImportSuccessMsg(null);

    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        if (!rows || rows.length === 0) {
          setImportError('No readable rows found in the CSV source.');
          setIsParsingImport(false);
          return;
        }

        const existingRollMap = new Map(
          students.map(s => [s.roll_number.toLowerCase().trim(), s])
        );

        const analyzed = rows.map((r) => {
          // Normalize column headers
          const getVal = (...keys: string[]) => {
            for (const k of keys) {
              const found = Object.keys(r).find(col => col.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, ''));
              if (found && r[found]) return r[found].trim();
            }
            return '';
          };

          const roll = getVal('rollnumber', 'rollno', 'roll_number', 'roll');
          const name = getVal('fullname', 'studentname', 'name', 'full_name');
          const email = getVal('email', 'emailid', 'studentemail');
          const phone = getVal('phone', 'mobileno', 'contact', 'phonenumber');
          const rawAdmission = getVal('admissiontype', 'admission', 'admission_type');

          let admission_type: AdmissionType = 'Regular';
          if (rawAdmission.toLowerCase().includes('lateral')) {
            admission_type = 'Lateral Entry';
          }

          if (!roll || !name) {
            return {
              roll_number: roll || 'N/A',
              full_name: name || 'N/A',
              email,
              phone,
              admission_type,
              status: 'INVALID' as const,
              reason: 'Missing Roll Number or Student Name',
            };
          }

          const existing = existingRollMap.get(roll.toLowerCase());
          if (existing) {
            return {
              roll_number: roll,
              full_name: name,
              email: email || existing.email || `${roll}@vctm.in`,
              phone: phone || existing.phone || undefined,
              admission_type,
              status: 'UPDATE' as const,
              reason: `Will update existing student & bind to Section ${section?.name}`,
            };
          }

          return {
            roll_number: roll,
            full_name: name,
            email: email || `${roll}@vctm.in`,
            phone: phone || undefined,
            admission_type,
            status: 'NEW' as const,
            reason: `Will add new student to Section ${section?.name}`,
          };
        });

        setParsedImportRows(analyzed);
        setIsParsingImport(false);
      },
      error: (err: any) => {
        setImportError(err.message || 'Failed to parse CSV data.');
        setIsParsingImport(false);
      }
    });
  };

  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) processRawCsvContent(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportUrlFetch = async () => {
    if (!importUrl.trim()) {
      setImportError('Please enter a valid Google Sheet CSV or published URL.');
      return;
    }
    setIsParsingImport(true);
    setImportError(null);
    try {
      const content = await fetchCSVContent(importUrl.trim());
      processRawCsvContent(content);
    } catch (err: any) {
      setImportError(err.message || 'Failed to fetch CSV from provided URL. Ensure link is public.');
      setIsParsingImport(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!section || parsedImportRows.length === 0) return;
    const validRows = parsedImportRows.filter(r => r.status !== 'INVALID');
    if (validRows.length === 0) {
      setImportError('No valid student rows to import.');
      return;
    }

    setIsExecutingImport(true);
    setImportError(null);
    try {
      const result = await batchImportSectionStudents({
        sectionId: section.id,
        students: validRows.map(r => ({
          roll_number: r.roll_number,
          full_name: r.full_name,
          email: r.email,
          phone: r.phone,
          admission_type: r.admission_type,
        })),
        importedBy: user?.full_name || 'Administrator',
      });

      await refreshStudents();
      setImportSuccessMsg(
        `Successfully synchronized Section ${section.name}! Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}.`
      );
      setParsedImportRows([]);
      setImportFileName('');
      setImportUrl('');
    } catch (err: any) {
      setImportError(err.message || 'Failed to execute student batch import.');
    } finally {
      setIsExecutingImport(false);
    }
  };

  const handleDownloadSampleCSV = () => {
    const sample = [
      {
        'Roll Number': '2503400100091',
        'Student Name': 'SAMPLE STUDENT ONE',
        'Email': '2503400100091@vctm.in',
        'Phone': '9876543210',
        'Admission Type': 'Regular'
      },
      {
        'Roll Number': '2503400100092',
        'Student Name': 'SAMPLE STUDENT TWO',
        'Email': '2503400100092@vctm.in',
        'Phone': '9876543211',
        'Admission Type': 'Lateral Entry'
      }
    ];
    exportToCSV(sample, `VCTM_Section_${section?.name || 'Students'}_Import_Template`);
  };

  const handleExportRosterCSV = () => {
    const data = filteredStudents.map((s, idx) => ({
      '#': idx + 1,
      'Roll Number': s.roll_number,
      'Student Name': s.full_name,
      'Department': sectionDept?.code || 'CSE',
      'Year': sectionYear?.name || '—',
      'Semester': sectionSemester?.name || '—',
      'Section': section?.name || '—',
      'Room': section?.room_number || '—',
      'Email': s.email || '—',
      'Phone': s.phone || '—',
      'Admission Type': s.admission_type,
      'Status': s.active ? 'Active' : 'Inactive',
    }));
    exportToCSV(data, `VCTM_Section_${section?.name || 'Roster'}_Students_${new Date().toISOString().split('T')[0]}`);
  };

  if (!isOpen || !section) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl rounded-3xl bg-white border border-slate-200/80 shadow-2xl text-slate-900 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header & Academic Context Banner */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-white flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black tracking-wider uppercase">
                  Section Management
                </span>
                <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
                  {sectionDept?.name} ({sectionDept?.code})
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5 flex items-center gap-2">
                Section {section.name} — Enrolled Student Directory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Section-scoped student enrollment, transfers, CSV synchronization, and profile administration.
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Academic Hierarchy Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
              <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
              <span>Program:</span>
              <span className="text-slate-900 font-bold">{sectionProgram?.name || 'B.Tech'}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Academic Year:</span>
              <span className="text-slate-900 font-bold">{sectionYear?.name || '2nd Year'}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Semester:</span>
              <span className="text-slate-900 font-bold">{sectionSemester?.name || '3rd Semester'}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
              <DoorOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>Classroom:</span>
              <span className="text-slate-900 font-mono font-bold">{section.room_number || 'Unassigned'}</span>
            </div>

            {coordinator && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Coordinator:</span>
                <span className="text-slate-900 font-bold">{coordinator.full_name}</span>
              </div>
            )}
          </div>

          {/* Real Live Student Count Metric Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-800 font-bold">
              <Users className="w-4 h-4 text-slate-600" />
              <span>Total Enrolled: {totalStudentsCount} Students</span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Active: {activeStudentsCount}</span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-bold">
              <XCircle className="w-4 h-4 text-slate-400" />
              <span>Inactive: {inactiveStudentsCount}</span>
            </div>
          </div>
        </div>

        {/* Action Controls & Filtering Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Roll No or Student Name..."
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center text-xs font-bold shadow-xs">
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg transition-all capitalize cursor-pointer',
                    statusFilter === filter
                      ? 'bg-[#0f172a] text-white font-bold shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  {filter.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Download className="w-3.5 h-3.5 text-slate-500" />}
              onClick={handleExportRosterCSV}
              className="text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Export Roster
            </Button>

            <Button
              size="sm"
              variant="outline"
              leftIcon={<UploadCloud className="w-3.5 h-3.5 text-slate-500" />}
              onClick={() => {
                setImportSuccessMsg(null);
                setImportError(null);
                setParsedImportRows([]);
                setIsImportModalOpen(true);
              }}
              className="text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Import Students
            </Button>

            <Button
              size="sm"
              variant="neon"
              leftIcon={<UserPlus className="w-3.5 h-3.5 text-white" />}
              onClick={() => {
                setAddError(null);
                setIsAddModalOpen(true);
              }}
              className="text-xs font-bold"
            >
              Add Student
            </Button>
          </div>
        </div>

        {/* Student Roster Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-900">
                {sectionStudents.length === 0
                  ? `No students currently enrolled in Section ${section.name}`
                  : 'No students match your search criteria'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {sectionStudents.length === 0
                  ? 'Use "Add Student" or "Import Students" to enroll students directly into this section.'
                  : 'Try adjusting the search query or status filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">University Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Contact & Email</th>
                    <th className="px-4 py-3">Admission</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((stud, idx) => (
                    <tr key={stud.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <div>{stud.roll_number}</div>
                        {stud.enrollment_number && (
                          <div className="text-[10px] text-slate-500 font-normal">{stud.enrollment_number}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-black text-xs">
                            {stud.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span>{stud.full_name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <div>
                          <p className="text-slate-800">{stud.email || '—'}</p>
                          {stud.phone && <p className="text-[11px] text-slate-400">{stud.phone}</p>}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={clsx(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          stud.admission_type === 'Lateral Entry'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-slate-100 border-slate-200 text-slate-700'
                        )}>
                          {stud.admission_type || 'Regular'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleStudentStatus(stud)}
                          className={clsx(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border',
                            stud.active
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                          )}
                          title="Click to toggle active/inactive status"
                        >
                          {stud.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenTransfer(stud)}
                            className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="Transfer student to another section"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Change Sec</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(stud)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edit Student Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="text-slate-900 font-bold">{filteredStudents.length}</span> of <span className="text-slate-900 font-bold">{totalStudentsCount}</span> students in Section {section.name}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* SUB-MODAL 1: ADD STUDENT (LOCKED TO SECTION) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={`Add Student to Section ${section.name}`}
        description={`Enroll a new student directly into ${sectionYear?.name || ''} Section ${section.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleAddStudentSubmit} className="space-y-4">
          {addError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">University Roll Number *</label>
              <input
                type="text"
                required
                value={addRollNumber}
                onChange={(e) => setAddRollNumber(e.target.value)}
                placeholder="e.g. 2503400100054"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Enrollment Number</label>
              <input
                type="text"
                value={addEnrollmentNumber}
                onChange={(e) => setAddEnrollmentNumber(e.target.value)}
                placeholder="e.g. EN2503400100054"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Student Name *</label>
            <input
              type="text"
              required
              value={addFullName}
              onChange={(e) => setAddFullName(e.target.value)}
              placeholder="e.g. RAHUL SHARMA"
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="Optional (defaults to roll@vctm.in)"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admission Type</label>
              <select
                value={addAdmissionType}
                onChange={(e) => setAddAdmissionType(e.target.value as AdmissionType)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
              >
                <option value="Regular">Regular</option>
                <option value="Lateral Entry">Lateral Entry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Section</label>
              <input
                type="text"
                disabled
                value={`Section ${section.name} (Locked)`}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Faculty Mentor (Optional)</label>
            <select
              value={addMentorFacultyId}
              onChange={(e) => setAddMentorFacultyId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
            >
              <option value="">No Mentor Assigned</option>
              {faculty
                .filter(f => f.active && f.department_id === sectionDept?.id)
                .map(f => (
                  <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code})</option>
                ))}
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="neon"
              size="sm"
              isLoading={isAdding}
            >
              Enroll Student
            </Button>
          </div>
        </form>
      </Modal>

      {/* SUB-MODAL 2: IMPORT STUDENTS (CSV / GOOGLE SHEET) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={`Import Students to Section ${section.name}`}
        description={`Synchronize students from CSV file or Google Sheet directly into Section ${section.name}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {importError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {importSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {/* Import Source Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportMode('file')}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  importMode === 'file'
                    ? 'bg-[#0f172a] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                CSV File Upload
              </button>
              <button
                onClick={() => setImportMode('url')}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  importMode === 'url'
                    ? 'bg-[#0f172a] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                Google Sheet CSV URL
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              leftIcon={<FileDown className="w-3.5 h-3.5 text-slate-500" />}
              onClick={handleDownloadSampleCSV}
              className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Download Template
            </Button>
          </div>

          {/* Import Inputs */}
          {importMode === 'file' ? (
            <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/60 text-center space-y-3 transition-colors">
              <UploadCloud className="w-8 h-8 text-slate-500 mx-auto" />
              <div>
                <p className="text-xs font-bold text-slate-900">Select or drag CSV student file</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Required headers: Roll Number, Student Name</p>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFileUpload}
                className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#0f172a] file:text-white hover:file:bg-black cursor-pointer"
              />
              {importFileName && (
                <p className="text-xs font-mono text-slate-700">Selected: {importFileName}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Public Google Sheet URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                />
                <Button
                  variant="neon"
                  size="sm"
                  onClick={handleImportUrlFetch}
                  isLoading={isParsingImport}
                >
                  Fetch & Preview
                </Button>
              </div>
            </div>
          )}

          {/* Validation & Preview Summary */}
          {parsedImportRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900">
                    Total: {parsedImportRows.length} Rows
                  </span>
                  <span className="text-emerald-700 font-bold">
                    {parsedImportRows.filter(r => r.status === 'NEW').length} New
                  </span>
                  <span className="text-blue-700 font-bold">
                    {parsedImportRows.filter(r => r.status === 'UPDATE').length} Update
                  </span>
                  {parsedImportRows.filter(r => r.status === 'INVALID').length > 0 && (
                    <span className="text-rose-700 font-bold">
                      {parsedImportRows.filter(r => r.status === 'INVALID').length} Invalid
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Target: Section {section.name}
                </span>
              </div>

              {/* Preview Table (First 8 rows) */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Roll No</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Admission</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedImportRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-900 font-semibold">{r.roll_number}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{r.full_name}</td>
                        <td className="px-3 py-2 text-slate-600">{r.admission_type}</td>
                        <td className="px-3 py-2">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            r.status === 'NEW' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
                            r.status === 'UPDATE' && 'bg-blue-50 border-blue-200 text-blue-800',
                            r.status === 'INVALID' && 'bg-rose-50 border-rose-200 text-rose-800',
                          )}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="neon"
              size="sm"
              disabled={parsedImportRows.length === 0 || parsedImportRows.every(r => r.status === 'INVALID')}
              isLoading={isExecutingImport}
              onClick={handleExecuteImport}
            >
              Import {parsedImportRows.filter(r => r.status !== 'INVALID').length} Students
            </Button>
          </div>
        </div>
      </Modal>

      {/* SUB-MODAL 3: CHANGE SECTION (TRANSFER STUDENT) */}
      <Modal
        isOpen={!!transferStudent}
        onClose={() => setTransferStudent(null)}
        title="Student Section Transfer"
        description="Transfer student to another section while completely preserving historical attendance"
        maxWidth="md"
      >
        <div className="space-y-4">
          {transferError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <p className="text-xs text-slate-500">Student to Transfer:</p>
            <h4 className="text-base font-black text-slate-900">{transferStudent?.full_name}</h4>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
              <span>Roll No: {transferStudent?.roll_number}</span>
              <span>•</span>
              <span>Current: Section {section.name}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Target Section *</label>
            <select
              value={targetSectionId}
              onChange={(e) => setTargetSectionId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
            >
              <option value="">-- Choose New Section --</option>
              {availableTargetSections.map(s => {
                const sSem = semesters.find(sem => sem.id === s.semester_id);
                const sYr = years.find(y => y.id === sSem?.academic_year_id);
                return (
                  <option key={s.id} value={s.id}>
                    Section {s.name} ({sYr?.name || 'Year'} • {sSem?.name || 'Sem'}) - Room {s.room_number || 'TBD'}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-slate-900">
              <CheckCircle2 className="w-4 h-4 text-slate-600" />
              Data Integrity Guarantee
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              100% of attendance records, date stamps, internal test marks, assignment submissions, and ERP login credentials remain completely intact and linked to the student.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTransferStudent(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="neon"
              size="sm"
              disabled={!targetSectionId}
              isLoading={isTransferring}
              onClick={handleExecuteTransfer}
            >
              Confirm Transfer
            </Button>
          </div>
        </div>
      </Modal>

      {/* SUB-MODAL 4: EDIT STUDENT */}
      <Modal
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title="Edit Student Information"
        description="Update student profile details"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">University Roll Number *</label>
              <input
                type="text"
                required
                value={editRollNumber}
                onChange={(e) => setEditRollNumber(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Enrollment Number</label>
              <input
                type="text"
                value={editEnrollmentNumber}
                onChange={(e) => setEditEnrollmentNumber(e.target.value)}
                placeholder="e.g. EN2503400100054"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admission Type</label>
              <select
                value={editAdmissionType}
                onChange={(e) => setEditAdmissionType(e.target.value as AdmissionType)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
              >
                <option value="Regular">Regular</option>
                <option value="Lateral Entry">Lateral Entry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Faculty Mentor</label>
              <select
                value={editMentorFacultyId}
                onChange={(e) => setEditMentorFacultyId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
              >
                <option value="">No Mentor Assigned</option>
                {faculty
                  .filter(f => f.active && f.department_id === sectionDept?.id)
                  .map(f => (
                    <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code})</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingStudent(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="neon"
              size="sm"
              isLoading={isSavingEdit}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

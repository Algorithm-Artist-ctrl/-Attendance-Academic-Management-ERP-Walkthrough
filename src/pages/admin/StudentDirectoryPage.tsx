import React, { useState } from 'react';
import { GraduationCap, Search, Plus, Filter, UserCheck, Mail, Phone, BookOpen, Layers, Trash2 } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AdmissionType, Student } from '../../types/database.types';
import { clsx } from 'clsx';

export const StudentDirectoryPage: React.FC = () => {
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
    addStudent,
    deleteStudent
  } = useAcademic();

  const isSuperAdmin = role === 'super_admin';
  const isHOD = role === 'hod';
  const isFaculty = role === 'faculty';

  // Role-based student filtering
  const accessibleStudents = React.useMemo(() => {
    if (isSuperAdmin) return students;
    if (isHOD) return students.filter(s => s.department_id === user?.department_id);
    if (isFaculty) {
      const currentFacultyId = user?.faculty_id || user?.id || '';
      const mySectionIds = assignments
        .filter(fsa => fsa.faculty_id === currentFacultyId && fsa.active)
        .map(fsa => fsa.section_id);
      return students.filter(s => mySectionIds.includes(s.section_id));
    }
    return students;
  }, [students, isSuperAdmin, isHOD, isFaculty, user, assignments]);

  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [admissionFilter, setAdmissionFilter] = useState<string>('ALL');

  // Add Student modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [newAdmissionType, setNewAdmissionType] = useState<AdmissionType>('Regular');
  const [newSectionId, setNewSectionId] = useState(sections[0]?.id || '');
  const [newMentorId, setNewMentorId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const filteredStudents = accessibleStudents.filter(s => {
    const matchesSearch = 
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = sectionFilter === 'ALL' || s.section?.name === sectionFilter;
    const matchesAdmission = admissionFilter === 'ALL' || s.admission_type === admissionFilter;

    return matchesSearch && matchesSection && matchesAdmission;
  });

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

    try {
      await addStudent({
        institution_id: institution.id,
        department_id: departments[0]?.id || 'dept-cse-01',
        program_id: programs[0]?.id || 'prog-btech-cse-01',
        academic_session_id: sessions[0]?.id || 'session-2026-2027',
        academic_year_id: years[1]?.id || 'year-2nd',
        semester_id: semesters[0]?.id || 'sem-3rd',
        section_id: newSectionId,
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
            Official institutional enrollment records • Total {students.length} Students
          </p>
        </div>

        {(isSuperAdmin || isHOD) && (
          <Button
            variant="neon"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
          >
            Add New Student
          </Button>
        )}
      </div>

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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold">Section:</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              <option value="ALL">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold">Type:</span>
            <select
              value={admissionFilter}
              onChange={(e) => setAdmissionFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
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
              {filteredStudents.map((stud, idx) => (
                <div 
                  key={stud.id}
                  className="glass-card rounded-2xl p-4 border border-emerald-500/20 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
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
                      <th className="px-5 py-3.5 text-center">Section</th>
                      <th className="px-5 py-3.5 text-center">Admission Type</th>
                      <th className="px-5 py-3.5">Assigned Mentor</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-500/10">
                    {filteredStudents.map((stud, idx) => (
                      <tr key={stud.id} className="hover:bg-emerald-500/5 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-emerald-400 text-sm">
                          {stud.roll_number}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-white text-sm">
                          {stud.full_name}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Single Student Record"
        description="Insert an individual student record directly into the college database"
        maxWidth="md"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Section</label>
              <select
                value={newSectionId}
                onChange={(e) => setNewSectionId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>Section {s.name}</option>
                ))}
              </select>
            </div>

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

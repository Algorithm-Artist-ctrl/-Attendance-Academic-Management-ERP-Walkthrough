import React, { useState } from 'react';
import { Layers, Plus, Search, User, BookOpen, Trash2, Edit3, AlertCircle } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FacultySubjectAssignment } from '../../types/database.types';

export const FacultyAssignmentsPage: React.FC = () => {
  const { 
    assignments, 
    faculty, 
    subjects, 
    sections, 
    sessions, 
    years,
    semesters,
    addAssignment,
    updateFacultyAssignment,
    deleteAssignment
  } = useAcademic();

  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  // Form state
  const [selectedFacultyId, setSelectedFacultyId] = useState(faculty[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id || '');
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = assignments.filter(a => {
    const fac = faculty.find(f => f.id === a.faculty_id);
    const sub = subjects.find(s => s.id === a.subject_id);
    const sec = sections.find(s => s.id === a.section_id);
    const sem = semesters.find(s => s.id === sec?.semester_id);

    const matchesYear = yearFilter === 'ALL' || sem?.academic_year_id === yearFilter;
    const matchesSection = sectionFilter === 'ALL' || a.section_id === sectionFilter;

    const matchesSearch = 
      (fac?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub?.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sec?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesYear && matchesSection && matchesSearch;
  });

  const handleOpenCreateModal = () => {
    setEditingAssignmentId(null);
    setFormError(null);
    setSelectedFacultyId(faculty[0]?.id || '');
    setSelectedSubjectId(subjects[0]?.id || '');
    setSelectedSectionId(sections[0]?.id || '');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (fa: FacultySubjectAssignment) => {
    setEditingAssignmentId(fa.id);
    setFormError(null);
    setSelectedFacultyId(fa.faculty_id);
    setSelectedSubjectId(fa.subject_id);
    setSelectedSectionId(fa.section_id);
    setIsModalOpen(true);
  };

  const handleDeleteAllocation = async (id: string, facultyName: string, subjectCode: string) => {
    if (window.confirm(`Are you sure you want to remove teaching allocation for "${facultyName}" on "${subjectCode}"?`)) {
      try {
        await deleteAssignment(id);
      } catch (err: any) {
        alert(err.message || 'Failed to remove allocation');
      }
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate duplicate allocation for same subject in same section
    const existing = assignments.find(a => 
      a.subject_id === selectedSubjectId && 
      a.section_id === selectedSectionId && 
      a.active &&
      (!editingAssignmentId || a.id !== editingAssignmentId)
    );

    if (existing) {
      const facName = faculty.find(f => f.id === existing.faculty_id)?.full_name || 'Another faculty';
      const subCode = subjects.find(s => s.id === selectedSubjectId)?.subject_code || 'Subject';
      setFormError(`Duplicate Allocation: ${subCode} is already assigned to ${facName} in this section. Please edit the existing allocation or choose another.`);
      return;
    }

    const activeSession = sessions.find(s => s.is_current) || sessions[0];

    try {
      if (editingAssignmentId) {
        await updateFacultyAssignment(editingAssignmentId, {
          faculty_id: selectedFacultyId,
          subject_id: selectedSubjectId,
          section_id: selectedSectionId,
        });
      } else {
        await addAssignment({
          faculty_id: selectedFacultyId,
          subject_id: selectedSubjectId,
          section_id: selectedSectionId,
          academic_session_id: activeSession?.id || '',
          active: true,
        });
      }
      setIsModalOpen(false);
      setEditingAssignmentId(null);
    } catch (err: any) {
      setFormError(`Assignment Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#00ff88]" />
            Faculty Teaching Allocations
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Map professors to specific subjects and sections for academic session 2026–2027
          </p>
        </div>

        <Button
          variant="neon"
          size="sm"
          onClick={handleOpenCreateModal}
          leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
        >
          Assign Subject
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by faculty, subject, or section..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold">Year:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
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
              className="px-3 py-1.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-[#00ff88] font-bold focus:outline-none focus:border-[#00ff88] cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950 text-white">All Sections</option>
              {sections.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-950 text-white">
                  Sec {s.name} ({s.room_number || 'Room TBD'})
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
            {filtered.length} Workloads
          </span>
        </div>
      </div>

      {/* Allocations Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
              <tr>
                <th className="px-5 py-3.5">Faculty Full Name</th>
                <th className="px-5 py-3.5">Subject</th>
                <th className="px-5 py-3.5 text-center">Section / Cohort</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {filtered.map((fa) => {
                const fac = faculty.find(f => f.id === fa.faculty_id);
                const sub = subjects.find(s => s.id === fa.subject_id);
                const sec = sections.find(s => s.id === fa.section_id);
                const sem = semesters.find(s => s.id === sec?.semester_id);
                const yr = years.find(y => y.id === sem?.academic_year_id);

                return (
                  <tr key={fa.id} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="px-5 py-4 font-bold text-white text-sm">
                      {fac?.full_name || 'Faculty'}
                      <span className="block text-[10px] text-emerald-400 font-mono">
                        Code: {fac?.faculty_code || fac?.employee_code || 'FAC'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-200">
                      {sub?.subject_name} ({sub?.subject_code})
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                        {yr ? `${yr.name} • ` : ''}Sec {sec?.name}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                        Assigned
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(fa)}
                          className="p-1.5 text-slate-400 hover:text-[#00ff88] rounded-lg hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          title="Edit Allocation"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAllocation(fa.id, fac?.full_name || 'Faculty', sub?.subject_code || 'Subject')}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove Allocation"
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
      </div>

      {/* Add / Edit Allocation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAssignmentId(null);
          setFormError(null);
        }}
        title={editingAssignmentId ? "Edit Faculty Teaching Allocation" : "Assign Faculty to Subject"}
        description={editingAssignmentId ? "Modify the allocated professor, subject, or section" : "Allocate teaching responsibility for a subject & section"}
        maxWidth="md"
      >
        <form onSubmit={handleAssign} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty Member</label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code || f.designation})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Section / Cohort</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              {sections.map(sec => {
                const sem = semesters.find(s => s.id === sec.semester_id);
                const yr = years.find(y => y.id === sem?.academic_year_id);
                return (
                  <option key={sec.id} value={sec.id}>
                    {yr ? `${yr.name} • ` : ''}Section {sec.name} ({sec.room_number || 'TBD'})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setIsModalOpen(false);
                setEditingAssignmentId(null);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="neon" size="sm">
              {editingAssignmentId ? "Update Allocation" : "Save Allocation"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

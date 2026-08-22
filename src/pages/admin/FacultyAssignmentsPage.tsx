import React, { useState } from 'react';
import { Layers, Plus, Search, User, BookOpen } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';

export const FacultyAssignmentsPage: React.FC = () => {
  const { 
    assignments, 
    faculty, 
    subjects, 
    sections, 
    sessions, 
    addAssignment 
  } = useAcademic();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [selectedFacultyId, setSelectedFacultyId] = useState(faculty[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id || '');

  const filtered = assignments.filter(a => {
    const fac = faculty.find(f => f.id === a.faculty_id);
    const sub = subjects.find(s => s.id === a.subject_id);
    const sec = sections.find(s => s.id === a.section_id);

    return (
      (fac?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub?.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sec?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      addAssignment({
        faculty_id: selectedFacultyId,
        subject_id: selectedSubjectId,
        section_id: selectedSectionId,
        academic_session_id: sessions[0]?.id || 'session-2026-2027',
        active: true,
      });
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Assignment Error: ${err.message}`);
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
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
        >
          Assign Subject
        </Button>
      </div>

      {/* Search Bar */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
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

        <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
          {filtered.length} Active Workload Allocations
        </span>
      </div>

      {/* Allocations Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
              <tr>
                <th className="px-5 py-3.5">Faculty Full Name</th>
                <th className="px-5 py-3.5">Subject</th>
                <th className="px-5 py-3.5 text-center">Section</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {filtered.map((fa) => {
                const fac = faculty.find(f => f.id === fa.faculty_id);
                const sub = subjects.find(s => s.id === fa.subject_id);
                const sec = sections.find(s => s.id === fa.section_id);

                return (
                  <tr key={fa.id} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="px-5 py-4 font-bold text-white text-sm">
                      {fac?.full_name || 'Faculty'}
                      <span className="block text-[10px] text-emerald-400 font-mono">
                        Code: {fac?.faculty_code || fac?.employee_code}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-200">
                      {sub?.subject_name} ({sub?.subject_code})
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                        Section {sec?.name}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                        Assigned
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Allocation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Assign Faculty to Subject"
        description="Allocate teaching responsibility for a subject & section"
        maxWidth="md"
      >
        <form onSubmit={handleAssign} className="space-y-4">
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>Section {sec.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="neon" size="sm">Save Allocation</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

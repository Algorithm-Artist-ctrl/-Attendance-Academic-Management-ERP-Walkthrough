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

  const filtered = assignments.filter(a =>
    a.faculty?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.subject?.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.subject?.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.section?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Faculty-Subject Assignments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Map faculty members to specific subjects and class sections for academic session 2026–2027
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search faculty or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vctm-navy-500"
            />
          </div>

          <Button
            size="sm"
            variant="navy"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsModalOpen(true)}
          >
            Assign Faculty
          </Button>
        </div>
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Faculty Member</th>
                <th className="px-4 py-3">Subject Code & Name</th>
                <th className="px-4 py-3">Assigned Section</th>
                <th className="px-4 py-3">Lecture Format</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-vctm-navy-800">
                        {a.faculty?.faculty_code || 'F'}
                      </span>
                      <span>{a.faculty?.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-800">{a.subject?.subject_name}</span>
                    <span className="text-xs text-slate-400 block">{a.subject?.subject_code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-vctm-navy-100 text-vctm-navy-800">
                      Section {a.section?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {a.subject?.lecture_type}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                    2026-2027
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Assign Faculty to Course & Section"
        maxWidth="md"
      >
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Faculty Member
            </label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_code} — {s.subject_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Class Section
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>Section {sec.name} ({sec.room_number})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy">
              Save Assignment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

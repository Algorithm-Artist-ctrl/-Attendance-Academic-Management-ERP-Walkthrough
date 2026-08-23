import React, { useState } from 'react';
import { BookOpen, Plus, Search, Layers, Trash2 } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LectureType } from '../../types/database.types';

export const SubjectsPage: React.FC = () => {
  const { subjects, departments, programs, semesters, addSubject, deleteSubject } = useAcademic();
  const [searchTerm, setSearchTerm] = useState('');

  // Add Subject modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [lectureType, setLectureType] = useState<LectureType>('Theory');
  const [credits, setCredits] = useState<number>(4.0);

  const filteredSubjects = subjects.filter(s =>
    (s.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove subject "${name}" from curriculum?`)) {
      try {
        await deleteSubject(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete subject');
      }
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectCode.trim() || !subjectName.trim()) return;

    try {
      await addSubject({
        program_id: programs[0]?.id || 'prog-btech-cse-01',
        department_id: departments[0]?.id || 'dept-cse-01',
        semester_id: semesters[0]?.id || 'sem-3rd-odd-01',
        subject_code: subjectCode.trim().toUpperCase(),
        subject_name: subjectName.trim(),
        lecture_type: lectureType,
        credits: Number(credits),
        active: true,
      });

      setSubjectCode('');
      setSubjectName('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to add subject:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#00ff88]" />
            Curriculum & Subjects Master
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage course codes, theory/practical formats, and academic credits
          </p>
        </div>

        <Button
          variant="neon"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
        >
          Add New Subject
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
            placeholder="Search by code or subject name..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
          {filteredSubjects.length} Curriculum Courses
        </span>
      </div>

      {/* Subjects Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        {filteredSubjects.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300">No curriculum subjects registered</p>
            <p className="text-xs text-slate-500 mt-1">Configure subjects using the "Add New Subject" button</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-5 py-3.5">Course Code</th>
                  <th className="px-5 py-3.5">Subject Full Title</th>
                  <th className="px-5 py-3.5 text-center">Format</th>
                  <th className="px-5 py-3.5 text-center">Credits</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {filteredSubjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-emerald-400 text-sm">
                      {sub.subject_code}
                    </td>
                    <td className="px-5 py-4 font-bold text-white text-sm">
                      {sub.subject_name}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                        {sub.lecture_type || 'Theory'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-white">
                      {sub.credits || 4.0}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDelete(sub.id, sub.subject_name)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Subject Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Curriculum Subject"
        description="Configure a new theory lecture, practical lab, or workshop"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Course Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="e.g. BCS-301"
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Credits
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Subject Full Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Data Structure"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Lecture Format</label>
            <select
              value={lectureType}
              onChange={(e) => setLectureType(e.target.value as LectureType)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            >
              <option value="Theory">Theory Lecture</option>
              <option value="Practical">Practical Lab</option>
              <option value="Workshop">Workshop</option>
              <option value="Project">Project / Seminar</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="neon" size="sm">
              Save Subject
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import { BookOpen, Plus, Search, Layers } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LectureType } from '../../types/database.types';

export const SubjectsPage: React.FC = () => {
  const { subjects, departments, programs, semesters, addSubject } = useAcademic();
  const [searchTerm, setSearchTerm] = useState('');

  // Add Subject modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [lectureType, setLectureType] = useState<LectureType>('Theory');
  const [credits, setCredits] = useState<number>(4.0);

  const filteredSubjects = subjects.filter(s =>
    s.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.subject_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectCode.trim() || !subjectName.trim()) return;

    addSubject({
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
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Courses & Subjects Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage curriculum subjects, course codes, lecture formats, and academic credits
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code or subject..."
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
            Add Subject
          </Button>
        </div>
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Subject Code</th>
                <th className="px-4 py-3">Subject Name</th>
                <th className="px-4 py-3">Lecture Type</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Semester</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubjects.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono font-bold text-vctm-navy-800 text-xs">
                    {s.subject_code}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {s.subject_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                      {s.lecture_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-700">
                    {s.credits}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    3rd Semester (Odd)
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

      {/* Add Subject Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Curriculum Subject"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. BCS304"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500 uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Database Management Systems"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lecture Type
              </label>
              <select
                value={lectureType}
                onChange={(e) => setLectureType(e.target.value as LectureType)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              >
                <option value="Theory">Theory</option>
                <option value="Practical">Practical (Lab)</option>
                <option value="Workshop">Workshop</option>
                <option value="Project">Project</option>
                <option value="Sports">Sports</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Credits
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500 font-semibold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy">
              Add Subject
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import { BookOpen, Plus, Search, Layers, Trash2 } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LectureType } from '../../types/database.types';

export const SubjectsPage: React.FC = () => {
  const { subjects, departments, programs, years, semesters, addSubject, deleteSubject } = useAcademic();
  const [searchTerm, setSearchTerm] = useState('');

  // Filters
  const [selectedYearId, setSelectedYearId] = useState<string>('ALL');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('ALL');

  // Add Subject modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalYearId, setModalYearId] = useState<string>(years[0]?.id || '');
  const [modalSemesterId, setModalSemesterId] = useState<string>('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [lectureType, setLectureType] = useState<LectureType>('Theory');
  const [credits, setCredits] = useState<number>(4.0);

  const availableSemestersForFilter = React.useMemo(() => {
    if (selectedYearId === 'ALL') return semesters;
    return semesters.filter(s => s.academic_year_id === selectedYearId);
  }, [semesters, selectedYearId]);

  const availableSemestersForModal = React.useMemo(() => {
    if (!modalYearId) return semesters;
    return semesters.filter(s => s.academic_year_id === modalYearId);
  }, [semesters, modalYearId]);

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch =
      (s.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase());
    const sem = semesters.find(sm => sm.id === s.semester_id);
    const matchesYear = selectedYearId === 'ALL' || sem?.academic_year_id === selectedYearId;
    const matchesSemester = selectedSemesterId === 'ALL' || s.semester_id === selectedSemesterId;
    return matchesSearch && matchesYear && matchesSemester;
  });

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

    const targetSemesterId = modalSemesterId || availableSemestersForModal[0]?.id || semesters[0]?.id;

    try {
      await addSubject({
        program_id: programs[0]?.id || '',
        department_id: departments[0]?.id || '',
        semester_id: targetSemesterId,
        subject_code: subjectCode.trim().toUpperCase(),
        subject_name: subjectName.trim(),
        lecture_type: lectureType,
        credits: Number(credits),
        active: true,
      });

      setSubjectCode('');
      setSubjectName('');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to add subject:', err);
      alert(err.message || 'Failed to add subject');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif-institutional font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-slate-900" />
            Curriculum & Subjects Master
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage course codes, theory/practical formats, and academic credits
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4 text-white" />}
          className="rounded-xl shadow-xs"
        >
          Add New Subject
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by code or subject name..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-600 font-semibold">Year:</span>
            <select
              value={selectedYearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value);
                setSelectedSemesterId('ALL');
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Years</option>
              {years.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-600 font-semibold">Semester:</span>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs cursor-pointer"
            >
              <option value="ALL">All Semesters</option>
              {availableSemestersForFilter.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-500 font-semibold hidden lg:inline">
            {filteredSubjects.length} Courses
          </span>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
        {filteredSubjects.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">No curriculum subjects found for selected filters</p>
            <p className="text-xs text-slate-500 mt-1">Configure subjects using the "Add New Subject" button</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Course Code</th>
                  <th className="px-5 py-3.5">Subject Full Title</th>
                  <th className="px-5 py-3.5">Academic Cohort</th>
                  <th className="px-5 py-3.5 text-center">Format</th>
                  <th className="px-5 py-3.5 text-center">Credits</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSubjects.map((sub) => {
                  const sem = semesters.find(s => s.id === sub.semester_id);
                  const yr = years.find(y => y.id === sem?.academic_year_id);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-900 text-sm">
                        {sub.subject_code}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 text-sm">
                        {sub.subject_name}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-medium">
                        {yr ? `${yr.name} • ` : ''}{sem?.name || '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                          {sub.lecture_type || 'Theory'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-slate-900">
                        {sub.credits || 4.0}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800">
                          Active
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDelete(sub.id, sub.subject_name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Subject"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Year</label>
              <select
                value={modalYearId}
                onChange={(e) => {
                  setModalYearId(e.target.value);
                  const sems = semesters.filter(s => s.academic_year_id === e.target.value);
                  setModalSemesterId(sems[0]?.id || '');
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              >
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
              <select
                value={modalSemesterId}
                onChange={(e) => setModalSemesterId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              >
                {availableSemestersForModal.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="e.g. BCS-301"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 uppercase font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Credits
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject Full Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Data Structure"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Lecture Format</label>
            <select
              value={lectureType}
              onChange={(e) => setLectureType(e.target.value as LectureType)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
            >
              <option value="Theory">Theory Lecture</option>
              <option value="Practical">Practical Lab</option>
              <option value="Workshop">Workshop</option>
              <option value="Project">Project / Seminar</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="rounded-xl shadow-xs">
              Save Subject
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

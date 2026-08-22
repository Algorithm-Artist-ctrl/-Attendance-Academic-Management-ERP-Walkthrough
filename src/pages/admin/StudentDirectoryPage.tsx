import React, { useState } from 'react';
import { GraduationCap, Search, Plus, Filter, UserCheck, Mail, Phone } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AdmissionType, Student } from '../../types/database.types';

export const StudentDirectoryPage: React.FC = () => {
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
    addStudent 
  } = useAcademic();

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

  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = sectionFilter === 'ALL' || s.section?.name === sectionFilter;
    const matchesAdmission = admissionFilter === 'ALL' || s.admission_type === admissionFilter;

    return matchesSearch && matchesSection && matchesAdmission;
  });

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newRoll.trim() || !newName.trim()) {
      setModalError('Roll Number and Student Name are required.');
      return;
    }

    try {
      addStudent({
        institution_id: institution.id,
        department_id: departments[0]?.id || 'dept-cse-01',
        program_id: programs[0]?.id || 'prog-btech-cse-01',
        academic_session_id: sessions[0]?.id || 'session-2026-2027',
        academic_year_id: years[1]?.id || 'year-2nd-btech-01',
        semester_id: semesters[0]?.id || 'sem-3rd-odd-01',
        section_id: newSectionId,
        roll_number: newRoll.trim(),
        full_name: newName.trim(),
        admission_type: newAdmissionType,
        mentor_faculty_id: newMentorId || undefined,
        email: newEmail.trim() || `${newRoll.trim()}@student.vctm.in`,
        phone: newPhone.trim(),
        active: true,
      });

      setNewRoll('');
      setNewName('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || 'Failed to add student');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Student Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage student records, roll numbers, sections, and mentor faculty assignments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="navy"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Student
          </Button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Roll Number or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vctm-navy-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Section:</span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-slate-50 font-semibold"
            >
              <option value="ALL">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Admission:</span>
            <select
              value={admissionFilter}
              onChange={(e) => setAdmissionFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-slate-50 font-semibold"
            >
              <option value="ALL">All Types</option>
              <option value="Regular">Regular</option>
              <option value="Lateral Entry">Lateral Entry</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student List Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Roll Number</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Admission Type</th>
                <th className="px-4 py-3">Assigned Mentor</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((stud, idx) => (
                <tr key={stud.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono font-bold text-vctm-navy-800 text-xs">
                    {stud.roll_number}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {stud.full_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                      Sec {stud.section?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-0.5 rounded font-semibold ${
                      stud.admission_type === 'Lateral Entry' 
                        ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {stud.admission_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                    {stud.mentor?.full_name || '—'}
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

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Single Student"
        description="Insert an individual student record into the college ERP"
        maxWidth="md"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Roll Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2503400100099"
              value={newRoll}
              onChange={(e) => setNewRoll(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Student Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ROHIT SHARMA"
              value={newName}
              onChange={(e) => setNewName(e.target.value.toUpperCase())}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white uppercase focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Section
              </label>
              <select
                value={newSectionId}
                onChange={(e) => setNewSectionId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>Section {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admission Type
              </label>
              <select
                value={newAdmissionType}
                onChange={(e) => setNewAdmissionType(e.target.value as AdmissionType)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              >
                <option value="Regular">Regular</option>
                <option value="Lateral Entry">Lateral Entry</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Faculty Mentor
            </label>
            <select
              value={newMentorId}
              onChange={(e) => setNewMentorId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              <option value="">-- Assign Faculty Mentor --</option>
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy">
              Add Student
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

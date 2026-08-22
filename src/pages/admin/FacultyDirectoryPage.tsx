import React, { useState } from 'react';
import { Users, Plus, Search, Mail, Phone, Building2 } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Faculty } from '../../types/database.types';

export const FacultyDirectoryPage: React.FC = () => {
  const { faculty, departments, addFaculty } = useAcademic();
  const [searchTerm, setSearchTerm] = useState('');

  // Add Faculty modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const [facCode, setFacCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [deptId, setDeptId] = useState(departments[0]?.id || 'dept-cse-01');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const filteredFaculty = faculty.filter(f =>
    f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.faculty_code && f.faculty_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode.trim() || !fullName.trim() || !email.trim()) return;

    addFaculty({
      department_id: deptId,
      employee_code: empCode.trim().toUpperCase(),
      faculty_code: facCode.trim().toUpperCase() || undefined,
      full_name: fullName.trim(),
      designation: designation.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      active: true,
    });

    setEmpCode('');
    setFacCode('');
    setFullName('');
    setEmail('');
    setPhone('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Faculty Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage teaching staff, designations, employee codes, and timetable shorthand mappings
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search faculty..."
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
            Add Faculty
          </Button>
        </div>
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Emp Code</th>
                <th className="px-4 py-3">Full Faculty Name</th>
                <th className="px-4 py-3">Timetable Code</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Contact Email</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFaculty.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono font-bold text-vctm-navy-800 text-xs">
                    {f.employee_code}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {f.full_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      {f.faculty_code || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 font-medium">
                    {f.designation}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {f.department?.name || 'CSE'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                    {f.email}
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

      {/* Add Faculty Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Faculty Member"
        description="Add a new professor or instructor to the college directory"
        maxWidth="md"
      >
        <form onSubmit={handleCreateFaculty} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Employee Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. FAC-CSE-012"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Timetable Code (Abbr.)
              </label>
              <input
                type="text"
                placeholder="e.g. RKS"
                value={facCode}
                onChange={(e) => setFacCode(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Faculty Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Rajesh Kumar Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Designation
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              >
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Professor">Professor</option>
                <option value="Head of Department">Head of Department</option>
                <option value="Lab Instructor">Lab Instructor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Official Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="e.g. rajesh.cse@vctm.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy">
              Add Faculty
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

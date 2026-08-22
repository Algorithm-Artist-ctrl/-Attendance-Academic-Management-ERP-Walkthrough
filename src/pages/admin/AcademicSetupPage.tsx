import React, { useState } from 'react';
import { Building2, BookOpen, Layers, Plus, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';

export const AcademicSetupPage: React.FC = () => {
  const { 
    institution, 
    departments, 
    programs, 
    sections, 
    faculty, 
    addDepartment, 
    addProgram, 
    addSection 
  } = useAcademic();

  const [activeTab, setActiveTab] = useState<'departments' | 'programs' | 'sections'>('departments');

  // New Department Modal state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptHodId, setNewDeptHodId] = useState('');

  // New Program Modal state
  const [isProgModalOpen, setIsProgModalOpen] = useState(false);
  const [newProgName, setNewProgName] = useState('');
  const [newProgCode, setNewProgCode] = useState('');
  const [newProgDeptId, setNewProgDeptId] = useState(departments[0]?.id || '');
  const [newProgDuration, setNewProgDuration] = useState(4);

  // New Section Modal state
  const [isSecModalOpen, setIsSecModalOpen] = useState(false);
  const [newSecName, setNewSecName] = useState('');
  const [newSecRoom, setNewSecRoom] = useState('');
  const [newSecCoordinatorId, setNewSecCoordinatorId] = useState('');

  const handleCreateDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !newDeptCode.trim()) return;

    addDepartment({
      institution_id: institution.id,
      name: newDeptName.trim(),
      code: newDeptCode.trim().toUpperCase(),
      hod_faculty_id: newDeptHodId || undefined,
      active: true,
    });

    setNewDeptName('');
    setNewDeptCode('');
    setIsDeptModalOpen(false);
  };

  const handleCreateProg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgName.trim() || !newProgCode.trim()) return;

    addProgram({
      department_id: newProgDeptId,
      name: newProgName.trim(),
      code: newProgCode.trim().toUpperCase(),
      duration_years: Number(newProgDuration),
      active: true,
    });

    setNewProgName('');
    setNewProgCode('');
    setIsProgModalOpen(false);
  };

  const handleCreateSec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecName.trim()) return;

    addSection({
      semester_id: 'sem-3rd-odd-01',
      name: newSecName.trim().toUpperCase(),
      room_number: newSecRoom.trim() || 'TBD',
      class_coordinator_id: newSecCoordinatorId || undefined,
      active: true,
    });

    setNewSecName('');
    setNewSecRoom('');
    setIsSecModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Academic Hierarchy & Master Setup</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage college departments, degree programs, semesters, and class sections without source code changes
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'departments' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Departments ({departments.length})
          </button>
          <button
            onClick={() => setActiveTab('programs')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'programs' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Programs ({programs.length})
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'sections' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Class Sections ({sections.length})
          </button>
        </div>
      </div>

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <Card
          title="College Departments"
          subtitle="Configure engineering and management branches"
          headerAction={
            <Button
              size="sm"
              variant="navy"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsDeptModalOpen(true)}
            >
              Add Department
            </Button>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Department Name</th>
                  <th className="px-4 py-3">Head of Department (HOD)</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-bold text-vctm-navy-800 text-xs">
                      {d.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{d.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {d.hod?.full_name || 'Not Assigned'}
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
      )}

      {/* Programs Tab */}
      {activeTab === 'programs' && (
        <Card
          title="Degree Programs & Courses"
          subtitle="Configure academic programs (B.Tech, MBA, MCA, Diploma)"
          headerAction={
            <Button
              size="sm"
              variant="navy"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsProgModalOpen(true)}
            >
              Add Program
            </Button>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Program Code</th>
                  <th className="px-4 py-3">Program Name</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-bold text-vctm-navy-800 text-xs">
                      {p.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                      {p.duration_years} Years
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
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <Card
          title="Class Sections"
          subtitle="Configure class sections, designated classrooms, and class coordinators"
          headerAction={
            <Button
              size="sm"
              variant="navy"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsSecModalOpen(true)}
            >
              Add Section
            </Button>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Designated Classroom</th>
                  <th className="px-4 py-3">Class Coordinator</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sections.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-vctm-navy-800 text-sm">
                      Section {s.name}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">
                      {s.room_number}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-semibold">
                      {s.class_coordinator?.full_name || 'Not Assigned'}
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
      )}

      {/* Add Department Modal */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Add New Department"
        maxWidth="md"
      >
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Electrical Engineering"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Code
            </label>
            <input
              type="text"
              required
              placeholder="e.g. EE"
              value={newDeptCode}
              onChange={(e) => setNewDeptCode(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white uppercase focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assign Head of Department (HOD)
            </label>
            <select
              value={newDeptHodId}
              onChange={(e) => setNewDeptHodId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              <option value="">-- Select Faculty Member --</option>
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsDeptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy">
              Create Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Program Modal */}
      <Modal
        isOpen={isProgModalOpen}
        onClose={() => setIsProgModalOpen(false)}
        title="Add Degree Program"
        maxWidth="md"
      >
        <form onSubmit={handleCreateProg} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Program / Degree Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Master of Business Administration"
              value={newProgName}
              onChange={(e) => setNewProgName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Program Code
            </label>
            <input
              type="text"
              required
              placeholder="e.g. MBA"
              value={newProgCode}
              onChange={(e) => setNewProgCode(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white uppercase focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <select
                value={newProgDeptId}
                onChange={(e) => setNewProgDeptId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration (Years)
              </label>
              <input
                type="number"
                min={1}
                max={6}
                value={newProgDuration}
                onChange={(e) => setNewProgDuration(Number(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsProgModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy">
              Create Program
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Section Modal */}
      <Modal
        isOpen={isSecModalOpen}
        onClose={() => setIsSecModalOpen(false)}
        title="Add Class Section"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSec} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Section Identifier
            </label>
            <input
              type="text"
              required
              placeholder="e.g. C or Section C"
              value={newSecName}
              onChange={(e) => setNewSecName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white uppercase focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Designated Room Number
            </label>
            <input
              type="text"
              placeholder="e.g. Room No. A 008"
              value={newSecRoom}
              onChange={(e) => setNewSecRoom(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Class Coordinator
            </label>
            <select
              value={newSecCoordinatorId}
              onChange={(e) => setNewSecCoordinatorId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-vctm-navy-500"
            >
              <option value="">-- Select Faculty Coordinator --</option>
              {faculty.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsSecModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="navy">
              Create Section
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import { Building2, BookOpen, Layers, Plus, CheckCircle2, ShieldCheck, Trash2 } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { clsx } from 'clsx';

export const AcademicSetupPage: React.FC = () => {
  const { 
    institution, 
    departments, 
    programs, 
    sections, 
    faculty, 
    addDepartment,
    deleteDepartment, 
    addProgram,
    deleteProgram, 
    addSection,
    deleteSection,
    claimWindowDays,
    setClaimWindowDays
  } = useAcademic();

  const [activeTab, setActiveTab] = useState<'departments' | 'programs' | 'sections' | 'policy'>('departments');
  const [tempClaimDays, setTempClaimDays] = useState(claimWindowDays);
  const [policySaved, setPolicySaved] = useState(false);

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

  const handleDeleteDept = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete department "${name}"?`)) {
      try {
        await deleteDepartment(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete department');
      }
    }
  };

  const handleDeleteProg = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete program "${name}"?`)) {
      try {
        await deleteProgram(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete program');
      }
    }
  };

  const handleDeleteSec = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete section "${name}"?`)) {
      try {
        await deleteSection(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete section');
      }
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !newDeptCode.trim()) return;

    try {
      await addDepartment({
        institution_id: institution.id,
        name: newDeptName.trim(),
        code: newDeptCode.trim().toUpperCase(),
        hod_faculty_id: newDeptHodId || undefined,
        active: true,
      });

      setNewDeptName('');
      setNewDeptCode('');
      setIsDeptModalOpen(false);
    } catch (err) {
      console.error('Failed to add department:', err);
    }
  };

  const handleCreateProg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgName.trim() || !newProgCode.trim()) return;

    try {
      await addProgram({
        department_id: newProgDeptId,
        name: newProgName.trim(),
        code: newProgCode.trim().toUpperCase(),
        duration_years: Number(newProgDuration),
        active: true,
      });

      setNewProgName('');
      setNewProgCode('');
      setIsProgModalOpen(false);
    } catch (err) {
      console.error('Failed to add program:', err);
    }
  };

  const handleCreateSec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecName.trim()) return;

    try {
      await addSection({
        semester_id: 'sem-3rd-odd-01',
        name: newSecName.trim().toUpperCase(),
        room_number: newSecRoom.trim() || 'TBD',
        class_coordinator_id: newSecCoordinatorId || undefined,
        active: true,
      });

      setNewSecName('');
      setNewSecRoom('');
      setIsSecModalOpen(false);
    } catch (err) {
      console.error('Failed to add section:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#00ff88]" />
            Academic Hierarchy & Structure
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure departments, degree programs, semesters, and class sections dynamically
          </p>
        </div>

        {/* Tab switcher pills */}
        <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-emerald-500/20 text-xs font-bold">
          <button
            onClick={() => setActiveTab('departments')}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl transition-all',
              activeTab === 'departments'
                ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Departments ({departments.length})
          </button>
          <button
            onClick={() => setActiveTab('programs')}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl transition-all',
              activeTab === 'programs'
                ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Programs ({programs.length})
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl transition-all',
              activeTab === 'sections'
                ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Class Sections ({sections.length})
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl transition-all',
              activeTab === 'policy'
                ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Claim Policy & Settings
          </button>
        </div>
      </div>

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-500/15 flex items-center justify-between bg-slate-950/40">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">College Departments</h3>
              <p className="text-xs text-slate-400">Engineering and management branches</p>
            </div>
            <Button
              size="sm"
              variant="neon"
              leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
              onClick={() => setIsDeptModalOpen(true)}
            >
              Add Department
            </Button>
          </div>

          {departments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">No departments configured</p>
              <p className="text-xs text-slate-500 mt-1">Create academic departments using the "Add Department" button</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                  <tr>
                    <th className="px-5 py-3.5">Code</th>
                    <th className="px-5 py-3.5">Department Name</th>
                    <th className="px-5 py-3.5">Head of Department (HOD)</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-500/10">
                  {departments.map((dept) => {
                    const hod = faculty.find(f => f.id === dept.hod_faculty_id);
                    return (
                      <tr key={dept.id} className="hover:bg-emerald-500/5 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-emerald-400 text-sm">{dept.code}</td>
                        <td className="px-5 py-4 font-bold text-white text-sm">{dept.name}</td>
                        <td className="px-5 py-4 text-slate-300 font-medium">
                          {hod ? (
                            <span className="text-white font-semibold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#00ff88]" />
                              {hod.full_name} ({hod.faculty_code || 'HOD'})
                            </span>
                          ) : 'Not Appointed'}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                            Active
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleDeleteDept(dept.id, dept.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Department"
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
      )}

      {/* Programs Tab */}
      {activeTab === 'programs' && (
        <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-500/15 flex items-center justify-between bg-slate-950/40">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Degree Programs</h3>
              <p className="text-xs text-slate-400">Undergraduate & postgraduate courses</p>
            </div>
            <Button
              size="sm"
              variant="neon"
              leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
              onClick={() => setIsProgModalOpen(true)}
            >
              Add Program
            </Button>
          </div>

          {programs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">No programs configured</p>
              <p className="text-xs text-slate-500 mt-1">Create degree courses using the "Add Program" button</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                  <tr>
                    <th className="px-5 py-3.5">Code</th>
                    <th className="px-5 py-3.5">Degree Program</th>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5 text-center">Duration</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-500/10">
                  {programs.map((prog) => {
                    const dept = departments.find(d => d.id === prog.department_id);
                    return (
                      <tr key={prog.id} className="hover:bg-emerald-500/5 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-emerald-400 text-sm">{prog.code}</td>
                        <td className="px-5 py-4 font-bold text-white text-sm">{prog.name}</td>
                        <td className="px-5 py-4 text-slate-300 font-medium">{dept?.name || 'CSE'}</td>
                        <td className="px-5 py-4 text-center font-bold text-white">{prog.duration_years} Years</td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                            Active
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleDeleteProg(prog.id, prog.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Program"
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
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-emerald-500/15 flex items-center justify-between bg-slate-950/40">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Class Sections & Room Allocation</h3>
              <p className="text-xs text-slate-400">Classrooms and assigned coordinators</p>
            </div>
            <Button
              size="sm"
              variant="neon"
              leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
              onClick={() => setIsSecModalOpen(true)}
            >
              Add Section
            </Button>
          </div>

          {sections.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-300">No sections configured</p>
              <p className="text-xs text-slate-500 mt-1">Configure sections and room mappings with "Add Section"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                  <tr>
                    <th className="px-5 py-3.5">Section Name</th>
                    <th className="px-5 py-3.5">Assigned Classroom</th>
                    <th className="px-5 py-3.5">Class Coordinator / Incharge</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-500/10">
                  {sections.map((sec) => {
                    const coordinator = faculty.find(f => f.id === sec.class_coordinator_id);
                    return (
                      <tr key={sec.id} className="hover:bg-emerald-500/5 transition-colors">
                        <td className="px-5 py-4 font-bold text-white text-sm">Section {sec.name}</td>
                        <td className="px-5 py-4 font-mono text-emerald-400 font-semibold">{sec.room_number || 'Room A-007'}</td>
                        <td className="px-5 py-4 text-slate-300 font-medium">
                          {coordinator ? `${coordinator.full_name} (${coordinator.faculty_code || 'Faculty'})` : '—'}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                            Active
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleDeleteSec(sec.id, sec.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Section"
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
      )}

      {/* Policy & Claim Window Tab */}
      {activeTab === 'policy' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/20 space-y-6">
          <div className="flex items-center justify-between border-b border-emerald-500/15 pb-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Institutional Attendance Policy & Rectification Rules
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure student claim periods, AKTU threshold, and audit requirements
              </p>
            </div>
            {policySaved && (
              <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold animate-in zoom-in-95">
                Settings Saved Successfully!
              </span>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setClaimWindowDays(Number(tempClaimDays));
              setPolicySaved(true);
              setTimeout(() => setPolicySaved(false), 2500);
            }}
            className="space-y-5 max-w-2xl"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Attendance Claim Window (Days)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={tempClaimDays}
                    onChange={(e) => setTempClaimDays(Number(e.target.value))}
                    className="w-32 px-3.5 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-sm font-black text-[#00ff88] focus:outline-none focus:border-[#00ff88]"
                  />
                  <span className="text-xs text-slate-400">
                    Days allowed for students to report discrepancy after lecture date
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 space-y-2 text-xs">
                <h4 className="font-bold text-white">Active College Rules:</h4>
                <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
                  <li>Minimum AKTU attendance eligibility requirement: <strong>75%</strong></li>
                  <li>Absence calculation formula: <code>Present ÷ (Present + Absent) × 100</code></li>
                  <li>Unconducted / Not Recorded lectures are strictly omitted from attendance denominator</li>
                  <li>Student claims are routed directly and exclusively to the subject's designated section faculty</li>
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="neon" size="sm">
                Save Policy Configuration
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Add Department Modal */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Add College Department"
        maxWidth="md"
      >
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Department Name</label>
            <input
              type="text"
              required
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="e.g. Electrical Engineering"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Department Code</label>
            <input
              type="text"
              required
              value={newDeptCode}
              onChange={(e) => setNewDeptCode(e.target.value)}
              placeholder="e.g. EE"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-[#00ff88]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeptModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="neon" size="sm">Save Department</Button>
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">Program Name</label>
            <input
              type="text"
              required
              value={newProgName}
              onChange={(e) => setNewProgName(e.target.value)}
              placeholder="e.g. Master of Business Administration"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Program Code</label>
            <input
              type="text"
              required
              value={newProgCode}
              onChange={(e) => setNewProgCode(e.target.value)}
              placeholder="e.g. MBA"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-[#00ff88]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsProgModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="neon" size="sm">Save Program</Button>
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">Section Identifier (e.g. C)</label>
            <input
              type="text"
              required
              maxLength={2}
              value={newSecName}
              onChange={(e) => setNewSecName(e.target.value)}
              placeholder="e.g. C"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-[#00ff88]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Classroom Number</label>
            <input
              type="text"
              value={newSecRoom}
              onChange={(e) => setNewSecRoom(e.target.value)}
              placeholder="e.g. Room A-008"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSecModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="neon" size="sm">Save Section</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import { Users, Plus, Search, Mail, Phone, Building2, UserCheck, Trash2 } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Faculty } from '../../types/database.types';

export const FacultyDirectoryPage: React.FC = () => {
  const { faculty, departments, addFaculty, deleteFaculty } = useAcademic();
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

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove faculty member "${name}" from the database?`)) {
      try {
        await deleteFaculty(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete faculty member');
      }
    }
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode.trim() || !fullName.trim() || !email.trim()) return;

    try {
      await addFaculty({
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
    } catch (err) {
      console.error('Failed to add faculty:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#00ff88]" />
            Faculty Master Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Teaching staff, designations, employee codes, and timetable shorthand codes
          </p>
        </div>

        <Button
          variant="neon"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
        >
          Add Faculty Member
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
            placeholder="Search faculty by name, code, or employee ID..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
          Showing {filteredFaculty.length} of {faculty.length} Faculty
        </span>
      </div>

      {/* Faculty Cards Grid */}
      {filteredFaculty.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="font-semibold text-slate-300">No faculty members found</p>
          <p className="text-xs text-slate-500 mt-1">Register faculty using the "Add Faculty Member" button</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFaculty.map((f) => {
            const dept = departments.find(d => d.id === f.department_id);
            const isHOD = f.designation.toLowerCase().includes('hod') || f.faculty_code === 'WSM';

            return (
              <div
                key={f.id}
                className="glass-panel rounded-3xl p-5 border border-emerald-500/15 hover:border-emerald-500/35 transition-all space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  {isHOD ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 border border-amber-500/40 text-amber-300">
                      HOD
                    </span>
                  ) : <span />}
                  <button
                    onClick={() => handleDelete(f.id, f.full_name)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete Faculty"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#00ff88] text-slate-950 font-black flex items-center justify-center text-sm shadow-[0_0_12px_rgba(0,255,136,0.3)]">
                    {f.faculty_code || f.full_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {f.full_name}
                    </h3>
                    <p className="text-xs text-emerald-400 font-medium mt-0.5">
                      {f.designation}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-emerald-500/10 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee Code:</span>
                    <span className="font-mono font-bold text-white">{f.employee_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timetable Code:</span>
                    <span className="font-mono font-bold text-[#00ff88]">{f.faculty_code || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-semibold text-slate-300">{dept?.name || 'CSE'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Official Email:</span>
                    <span className="text-slate-300 font-mono text-[11px] truncate max-w-[170px]">{f.email}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Faculty Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Faculty Member"
        description="Register a teaching faculty member into the institution directory"
        maxWidth="md"
      >
        <form onSubmit={handleCreateFaculty} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Employee Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                placeholder="e.g. FAC-CSE-012"
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Timetable Code (3 letters)
              </label>
              <input
                type="text"
                maxLength={4}
                value={facCode}
                onChange={(e) => setFacCode(e.target.value)}
                placeholder="e.g. RKS"
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Name with Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Rajesh Kumar Sharma"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Official Email <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rajesh.cse@vctm.in"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="neon" size="sm">
              Save Faculty Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

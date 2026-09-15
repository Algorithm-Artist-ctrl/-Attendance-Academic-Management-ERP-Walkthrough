import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Section } from '../../types/database.types';
import { Layers, Building2, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (newSection: Section) => void;
  initialDepartmentId?: string;
  initialYearId?: string;
}

export const AddSectionModal: React.FC<AddSectionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  initialDepartmentId,
  initialYearId,
}) => {
  const { role, user } = useAuth();
  const { 
    departments, 
    programs, 
    years, 
    semesters, 
    classrooms, 
    faculty, 
    addSection 
  } = useAcademic();

  const isHOD = role === 'hod';
  const hodDeptId = isHOD ? (user?.department_id || departments[0]?.id || '') : '';

  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDepartmentId || hodDeptId || departments[0]?.id || '');
  const [selectedProgId, setSelectedProgId] = useState<string>('');
  const [selectedYearId, setSelectedYearId] = useState<string>(initialYearId || years[0]?.id || '');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [sectionName, setSectionName] = useState<string>('A');
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [coordinatorId, setCoordinatorId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      const deptId = initialDepartmentId || hodDeptId || departments[0]?.id || '';
      setSelectedDeptId(deptId);

      const matchingProg = programs.find(p => p.department_id === deptId) || programs[0];
      if (matchingProg) setSelectedProgId(matchingProg.id);

      const yrId = initialYearId || years[0]?.id || '';
      setSelectedYearId(yrId);

      const matchingSem = semesters.find(s => s.academic_year_id === yrId);
      if (matchingSem) setSelectedSemesterId(matchingSem.id);

      setSectionName('A');
      setRoomNumber('');
      setCoordinatorId('');
    }
  }, [isOpen, initialDepartmentId, initialYearId, hodDeptId, departments, programs, years, semesters]);

  // Available programs for the selected department
  const availablePrograms = programs.filter(p => !selectedDeptId || p.department_id === selectedDeptId);

  // Available semesters for the selected academic year
  const availableSemesters = semesters.filter(s => !selectedYearId || s.academic_year_id === selectedYearId);

  // Update semester when academic year changes
  const handleYearChange = (yearId: string) => {
    setSelectedYearId(yearId);
    const matchingSems = semesters.filter(s => s.academic_year_id === yearId);
    if (matchingSems.length > 0) {
      setSelectedSemesterId(matchingSems[0].id);
    } else {
      setSelectedSemesterId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = sectionName.trim().toUpperCase();
    if (!cleanName) {
      setErrorMsg('Please specify a section name (e.g., A, B, C).');
      return;
    }

    if (!selectedSemesterId) {
      setErrorMsg('Please select an active semester for this section.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedClassroom = classrooms.find(c => c.room_number === roomNumber);

      const created = await addSection({
        semester_id: selectedSemesterId,
        name: cleanName,
        room_number: roomNumber.trim() || 'Room Unassigned',
        classroom_id: selectedClassroom?.id,
        class_coordinator_id: coordinatorId || undefined,
        active: true,
      });

      setSuccessMsg(`Section ${cleanName} created successfully in database!`);
      if (onCreated) onCreated(created);

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create section.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-white">
          <Layers className="w-5 h-5 text-[#00ff88]" />
          <span>Add Academic Section</span>
        </div>
      }
      description="Create a dynamic academic section. Sections are database-backed and immediately available for timetables and student rosters."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Department (locked if HOD) */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">Academic Department</label>
          {isHOD ? (
            <div className="px-3 py-2 bg-slate-950/80 border border-emerald-500/20 rounded-xl text-xs font-bold text-white">
              {departments.find(d => d.id === hodDeptId)?.name || 'Computer Science & Engineering'}
            </div>
          ) : (
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/20 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#00ff88]"
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          )}
        </div>

        {/* Academic Year & Semester */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/20 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#00ff88]"
            >
              {years.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Semester</label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/20 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#00ff88]"
            >
              {availableSemesters.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Section Name & Room Number */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Section Identifier</label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value.toUpperCase())}
              placeholder="e.g. A, B, C, D"
              maxLength={10}
              required
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/20 rounded-xl text-xs font-black text-white focus:outline-none focus:border-[#00ff88]"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Not restricted to A/B/C.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Default Room / Classroom</label>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. A006, A007"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/20 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>
        </div>

        {/* Class Coordinator (Optional) */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">Class Coordinator (Optional)</label>
          <select
            value={coordinatorId}
            onChange={(e) => setCoordinatorId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/20 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-[#00ff88]"
          >
            <option value="">-- None Assigned --</option>
            {faculty
              .filter(f => f.active && (!selectedDeptId || f.department_id === selectedDeptId))
              .map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code || f.employee_code})</option>
              ))}
          </select>
        </div>

        <div className="pt-3 border-t border-emerald-500/10 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="neon"
            size="sm"
            isLoading={isSubmitting}
          >
            Create Section
          </Button>
        </div>
      </form>
    </Modal>
  );
};

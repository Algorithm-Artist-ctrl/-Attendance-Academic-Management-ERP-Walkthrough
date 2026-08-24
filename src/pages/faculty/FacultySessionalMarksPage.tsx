import React, { useState, useMemo, useEffect } from 'react';
import { 
  Award, 
  Plus, 
  Search, 
  Save, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  BookOpen, 
  Users, 
  Layers, 
  Calendar,
  Clock,
  Trash2,
  Edit3,
  Sparkles,
  FileCheck,
  Eye
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { SessionalAssessment, SessionalMark } from '../../types/database.types';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';

export const FacultySessionalMarksPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    sessionalAssessments,
    sessionalMarks, 
    marksHistory, 
    subjects, 
    sections, 
    students,
    assignments: facultySubjectAssignments,
    createSessionalAssessment,
    updateSessionalAssessment,
    deleteSessionalAssessment,
    saveSessionalMarks 
  } = useAcademic();

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'hod';
  const currentFacultyId = user?.faculty_id || user?.id || '';

  // Assigned subjects & sections for current faculty
  const myAssignedSubjects = useMemo(() => {
    if (isSuperAdmin) {
      return subjects.map(s => ({
        subject: s,
        sections: sections
      }));
    }
    const myFsa = facultySubjectAssignments.filter(fsa => fsa.faculty_id === currentFacultyId && fsa.active);
    const subMap = new Map<string, { subject: typeof subjects[0]; sections: typeof sections }>();
    
    for (const fsa of myFsa) {
      const sub = subjects.find(s => s.id === fsa.subject_id);
      const sec = sections.find(s => s.id === fsa.section_id);
      if (sub && sec) {
        if (!subMap.has(sub.id)) {
          subMap.set(sub.id, { subject: sub, sections: [sec] });
        } else {
          const existing = subMap.get(sub.id)!;
          if (!existing.sections.some(s => s.id === sec.id)) {
            existing.sections.push(sec);
          }
        }
      }
    }
    return Array.from(subMap.values());
  }, [isSuperAdmin, subjects, sections, facultySubjectAssignments, currentFacultyId]);

  // Selections
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize selection
  useEffect(() => {
    if (myAssignedSubjects.length > 0 && !selectedSubjectId) {
      const first = myAssignedSubjects[0];
      setSelectedSubjectId(first.subject.id);
      if (first.sections.length > 0) {
        setSelectedSectionId(first.sections[0].id);
      }
    }
  }, [myAssignedSubjects, selectedSubjectId]);

  // Filtered Assessments for the selected Subject & Section
  const filteredAssessments = useMemo(() => {
    return sessionalAssessments.filter(sa => {
      const matchSubject = !selectedSubjectId || sa.subject_id === selectedSubjectId;
      const matchSection = !selectedSectionId || sa.section_id === selectedSectionId;
      const matchSearch = !searchTerm || sa.title.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSubject && matchSection && matchSearch;
    });
  }, [sessionalAssessments, selectedSubjectId, selectedSectionId, searchTerm]);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMaxMarks, setNewMaxMarks] = useState<number>(30);
  const [newExamDate, setNewExamDate] = useState(getISTTodayDate());
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [modalError, setModalError] = useState('');

  // Marks Entry Modal State
  const [activeAssessmentForMarks, setActiveAssessmentForMarks] = useState<SessionalAssessment | null>(null);
  const [marksRoster, setMarksRoster] = useState<Record<string, { marks: number | ''; remarks: string; oldMarks?: number; updatedAt?: string }>>({});
  const [isSavingMarks, setIsSavingMarks] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  const handleSubjectChange = (subId: string) => {
    setSelectedSubjectId(subId);
    const subObj = myAssignedSubjects.find(s => s.subject.id === subId);
    if (subObj && subObj.sections.length > 0) {
      setSelectedSectionId(subObj.sections[0].id);
    }
  };

  const handleOpenAddModal = () => {
    setModalError('');
    setNewTitle(`Sessional ${filteredAssessments.length + 1}`);
    setNewMaxMarks(30);
    setNewExamDate(getISTTodayDate());
    setNewDescription('');
    setIsAddModalOpen(true);
  };

  const handleCreateSessional = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!newTitle.trim()) {
      setModalError('Please enter a sessional name/title.');
      return;
    }
    if (!selectedSubjectId || !selectedSectionId) {
      setModalError('Please select a subject and section.');
      return;
    }
    if (newMaxMarks <= 0) {
      setModalError('Maximum marks must be greater than 0.');
      return;
    }

    try {
      setIsCreating(true);
      await createSessionalAssessment({
        faculty_id: currentFacultyId,
        subject_id: selectedSubjectId,
        section_id: selectedSectionId,
        title: newTitle.trim(),
        max_marks: Number(newMaxMarks),
        exam_date: newExamDate,
        description: newDescription.trim() || undefined,
        status: 'published',
      });

      setIsAddModalOpen(false);
      setSuccessToast(`Created assessment "${newTitle.trim()}" successfully!`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to create assessment.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAssessment = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete assessment "${title}" and all its student marks?`)) {
      await deleteSessionalAssessment(id);
      setSuccessToast(`Deleted assessment "${title}".`);
      setTimeout(() => setSuccessToast(''), 4000);
    }
  };

  // Open Marks Entry Roster for an Assessment
  const handleOpenMarksEntry = (assessment: SessionalAssessment) => {
    setActiveAssessmentForMarks(assessment);
    const sectionStudents = students.filter(s => s.section_id === assessment.section_id);
    const existingMarks = sessionalMarks.filter(
      sm => sm.sessional_assessment_id === assessment.id ||
            (sm.subject_id === assessment.subject_id && sm.section_id === assessment.section_id && sm.sessional_type === assessment.title)
    );

    const initial: Record<string, { marks: number | ''; remarks: string; oldMarks?: number; updatedAt?: string }> = {};
    for (const st of sectionStudents) {
      const match = existingMarks.find(m => m.student_id === st.id);
      initial[st.id] = {
        marks: match !== undefined ? match.marks_obtained : '',
        remarks: match?.remarks || '',
        oldMarks: match?.marks_obtained,
        updatedAt: match?.updated_at,
      };
    }
    setMarksRoster(initial);
    setRosterSearch('');
  };

  const handleSaveMarksRoster = async () => {
    if (!activeAssessmentForMarks) return;

    const studentList: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }> = [];

    for (const [studentId, data] of Object.entries(marksRoster)) {
      if (data.marks !== '' && !isNaN(Number(data.marks))) {
        const val = Number(data.marks);
        if (val < 0 || val > activeAssessmentForMarks.max_marks) {
          alert(`Marks for student must be between 0 and ${activeAssessmentForMarks.max_marks}.`);
          return;
        }
        studentList.push({
          studentId,
          marksObtained: val,
          remarks: data.remarks || undefined,
          oldMarks: data.oldMarks,
        });
      }
    }

    if (studentList.length === 0) {
      alert('Please enter marks for at least one student before saving.');
      return;
    }

    try {
      setIsSavingMarks(true);
      await saveSessionalMarks({
        sessionalAssessmentId: activeAssessmentForMarks.id,
        facultyId: currentFacultyId,
        subjectId: activeAssessmentForMarks.subject_id,
        sectionId: activeAssessmentForMarks.section_id,
        sessionalType: activeAssessmentForMarks.title,
        maxMarks: activeAssessmentForMarks.max_marks,
        studentMarks: studentList,
      });

      setActiveAssessmentForMarks(null);
      setSuccessToast(`Saved marks for ${studentList.length} students in "${activeAssessmentForMarks.title}"!`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save sessional marks.');
    } finally {
      setIsSavingMarks(false);
    }
  };

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const selectedSection = sections.find(s => s.id === selectedSectionId);

  // Subject audit history
  const subjectHistory = useMemo(() => {
    return marksHistory.filter(mh => mh.subject_id === selectedSubjectId && mh.entity_type === 'sessional');
  }, [marksHistory, selectedSubjectId]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Sessional Assessments & Marks Ledger</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Create multiple dynamic sessionals (Sessional 1, 2, 3, 4, PUT), record scores, and modify marks live.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsHistoryModalOpen(true)}
              className="border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              <History className="w-4 h-4 text-blue-400" /> Audit History
            </Button>
            <Button
              onClick={handleOpenAddModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> + Add Sessional
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {myAssignedSubjects.map(s => (
                <option key={s.subject.id} value={s.subject.id}>
                  {s.subject.subject_code} - {s.subject.subject_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {myAssignedSubjects
                .find(s => s.subject.id === selectedSubjectId)
                ?.sections.map(sec => (
                  <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Search Assessments</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search sessional title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast Notification */}
      {successToast && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Active Class & Section Context Banner */}
      {selectedSubject && selectedSection && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-xs text-slate-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-semibold">Active Managing Context:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-[#00ff88] font-bold font-mono">
              {selectedSubject.subject_code} — {selectedSubject.subject_name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-bold border border-emerald-500/20">
              Section {selectedSection.name}
            </span>
            <span className="text-slate-400">
              • Odd Semester 2026–2027 (Second Year)
            </span>
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold hidden sm:inline">
            ✓ Section-Specific Marks Isolation Active
          </span>
        </div>
      )}

      {/* Dynamic Sessionals Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAssessments.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900/50 border border-slate-800/60 rounded-2xl">
            <Award className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-slate-300">No Sessionals Created Yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Click &quot;+ Add Sessional&quot; to dynamically add Sessional 1, Sessional 2, Sessional 3, PUT or custom tests.
            </p>
            <Button
              onClick={handleOpenAddModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> + Add Sessional
            </Button>
          </div>
        ) : (
          filteredAssessments.map(assessment => {
            const assessmentMarksList = sessionalMarks.filter(sm => sm.sessional_assessment_id === assessment.id);
            const totalSectionStudents = students.filter(s => s.section_id === assessment.section_id).length;
            const scoredCount = assessmentMarksList.length;

            return (
              <div 
                key={assessment.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {assessment.subject?.subject_code || selectedSubject?.subject_code} • Section {assessment.section?.name || selectedSection?.name}
                    </span>
                    <button 
                      onClick={() => handleDeleteAssessment(assessment.id, assessment.title)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete Sessional"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{assessment.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                    {assessment.description || 'Continuous internal assessment examination.'}
                  </p>

                  <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Maximum Marks:</span>
                      <span className="font-semibold text-emerald-400">{assessment.max_marks} Marks</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Exam Date:</span>
                      <span className="font-medium text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(assessment.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Evaluation Status:</span>
                      <span className="font-mono font-bold text-white">
                        {scoredCount} / {totalSectionStudents} Students Evaluated
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3">
                  <Button
                    onClick={() => handleOpenMarksEntry(assessment)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                  >
                    <Edit3 className="w-4 h-4" />
                    {scoredCount > 0 ? 'Edit / Update Marks' : 'Enter Student Marks'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* + ADD SESSIONAL ASSESSMENT MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Dynamic Sessional Assessment"
      >
        <form onSubmit={handleCreateSessional} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Sessional Name / Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Sessional 1, Sessional 2, Sessional 3, PUT, Unit Test 1"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                disabled
                value={`${selectedSubject?.subject_code} - ${selectedSubject?.subject_name}`}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Section</label>
              <input
                type="text"
                disabled
                value={`Section ${selectedSection?.name}`}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Maximum Marks *</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={newMaxMarks}
                onChange={(e) => setNewMaxMarks(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Exam Date *</label>
              <input
                type="date"
                required
                value={newExamDate}
                onChange={(e) => setNewExamDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description / Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Unit 1 & Unit 2 syllabus coverage"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isCreating ? 'Creating...' : '+ Create Sessional'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ENTER / EDIT MARKS ROSTER MODAL */}
      <Modal
        isOpen={!!activeAssessmentForMarks}
        onClose={() => setActiveAssessmentForMarks(null)}
        title={`Marks Entry — ${activeAssessmentForMarks?.title || ''}`}
      >
        <div className="space-y-4">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400">Subject: </span>
              <span className="text-white font-medium">{activeAssessmentForMarks?.subject?.subject_name}</span>
            </div>
            <div>
              <span className="text-slate-400">Max Marks: </span>
              <span className="text-emerald-400 font-bold font-mono">{activeAssessmentForMarks?.max_marks}</span>
            </div>
            <div>
              <span className="text-slate-400">Section: </span>
              <span className="text-blue-400 font-medium">Section {activeAssessmentForMarks?.section?.name}</span>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search student by name or roll..."
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Student Roster Table */}
          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80 sticky top-0">
                  <th className="py-2.5 px-3">Roll No.</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3 w-32">Marks (/{activeAssessmentForMarks?.max_marks})</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {students
                  .filter(s => s.section_id === activeAssessmentForMarks?.section_id)
                  .filter(s => 
                    s.full_name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
                    s.roll_number.includes(rosterSearch)
                  )
                  .map(student => {
                    const current = marksRoster[student.id] || { marks: '', remarks: '' };

                    return (
                      <tr key={student.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-slate-300">{student.roll_number}</td>
                        <td className="py-2.5 px-3 font-medium text-white">{student.full_name}</td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0"
                            max={activeAssessmentForMarks?.max_marks || 100}
                            placeholder="—"
                            value={current.marks}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setMarksRoster(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], marks: val }
                              }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="Note..."
                            value={current.remarks}
                            onChange={(e) => {
                              const text = e.target.value;
                              setMarksRoster(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], remarks: text }
                              }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {current.updatedAt ? new Date(current.updatedAt).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="outline"
              onClick={() => setActiveAssessmentForMarks(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMarksRoster}
              disabled={isSavingMarks}
              className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              {isSavingMarks ? 'Saving...' : 'Save & Update Marks'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MARKS AUDIT HISTORY MODAL */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Sessional Marks Modification Audit Log"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Authoritative audit trail of all sessional marks adjustments for {selectedSubject?.subject_name || 'this subject'}.
          </p>

          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80 sticky top-0">
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Old Marks</th>
                  <th className="py-2.5 px-3">New Marks</th>
                  <th className="py-2.5 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subjectHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No marks modification history recorded for this course yet.
                    </td>
                  </tr>
                ) : (
                  subjectHistory.map(mh => {
                    const st = students.find(s => s.id === mh.student_id);
                    return (
                      <tr key={mh.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          {new Date(mh.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white">
                          {st?.full_name || 'Student'} ({st?.roll_number})
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          {mh.old_marks !== undefined ? mh.old_marks : 'None'}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold font-mono">
                          {mh.new_marks}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {mh.reason || 'Sessional Marks Update'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
};

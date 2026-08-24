import React, { useState, useMemo, useEffect } from 'react';
import { 
  Award, 
  Search, 
  Save, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  BookOpen, 
  Users, 
  Layers, 
  Calendar,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { SessionalType, SessionalMark } from '../../types/database.types';
import { clsx } from 'clsx';

export const FacultySessionalMarksPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    sessionalMarks, 
    marksHistory, 
    subjects, 
    sections, 
    students,
    assignments: facultySubjectAssignments,
    saveSessionalMarks 
  } = useAcademic();

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'hod';
  const currentFacultyId = user?.faculty_id || user?.id || '';

  // Assigned subjects & sections
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
  const [sessionalType, setSessionalType] = useState<SessionalType>('Sessional 1');
  const [maxMarks, setMaxMarks] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState('');

  // Marks roster state
  const [marksState, setMarksState] = useState<Record<string, { marks: number | ''; remarks: string; oldMarks?: number }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

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

  // Default max marks per sessional type
  useEffect(() => {
    if (sessionalType === 'Pre-University Test') {
      setMaxMarks(100);
    } else if (sessionalType === 'Internal Assessment') {
      setMaxMarks(50);
    } else {
      setMaxMarks(30);
    }
  }, [sessionalType]);

  // Sync roster with existing Supabase records
  useEffect(() => {
    if (!selectedSubjectId || !selectedSectionId) return;

    const sectionStudents = students.filter(s => s.section_id === selectedSectionId);
    const existing = sessionalMarks.filter(
      sm => sm.subject_id === selectedSubjectId &&
            sm.section_id === selectedSectionId &&
            sm.sessional_type === sessionalType
    );

    const initial: Record<string, { marks: number | ''; remarks: string; oldMarks?: number }> = {};
    for (const st of sectionStudents) {
      const match = existing.find(sm => sm.student_id === st.id);
      initial[st.id] = {
        marks: match !== undefined ? match.marks_obtained : '',
        remarks: match?.remarks || '',
        oldMarks: match?.marks_obtained,
      };
    }
    setMarksState(initial);
    setSuccessMsg('');
  }, [selectedSubjectId, selectedSectionId, sessionalType, students, sessionalMarks]);

  const activeSectionStudents = useMemo(() => {
    if (!selectedSectionId) return [];
    return students
      .filter(s => s.section_id === selectedSectionId)
      .filter(s => 
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.roll_number.includes(searchTerm)
      )
      .sort((a, b) => a.roll_number.localeCompare(b.roll_number));
  }, [selectedSectionId, students, searchTerm]);

  const handleSubjectChange = (subId: string) => {
    setSelectedSubjectId(subId);
    const subObj = myAssignedSubjects.find(s => s.subject.id === subId);
    if (subObj && subObj.sections.length > 0) {
      setSelectedSectionId(subObj.sections[0].id);
    }
  };

  const handleSaveMarks = async () => {
    if (!selectedSubjectId || !selectedSectionId) return;
    setSuccessMsg('');

    const studentList: Array<{ studentId: string; marksObtained: number; remarks?: string; oldMarks?: number }> = [];

    for (const [studentId, data] of Object.entries(marksState)) {
      if (data.marks !== '' && !isNaN(Number(data.marks))) {
        const val = Number(data.marks);
        if (val < 0 || val > maxMarks) {
          alert(`Marks for student must be between 0 and ${maxMarks}.`);
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
      setIsSaving(true);
      await saveSessionalMarks({
        facultyId: currentFacultyId,
        subjectId: selectedSubjectId,
        sectionId: selectedSectionId,
        sessionalType,
        maxMarks: Number(maxMarks),
        studentMarks: studentList,
      });

      setSuccessMsg(`Successfully saved ${studentList.length} student scores for ${sessionalType}!`);
    } catch (err: any) {
      alert(err.message || 'Failed to save sessional marks.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const selectedSection = sections.find(s => s.id === selectedSectionId);

  // Filter history for this subject
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
                <h1 className="text-2xl font-bold text-white tracking-tight">Sessional & Internal Marks Entry</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Record and update Sessional 1, Sessional 2, PUT, and Internal Assessment marks with audit logging.
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
              onClick={handleSaveMarks}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Sessional Marks'}
            </Button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
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
            <label className="block text-xs font-medium text-slate-400 mb-1">Sessional Assessment Type</label>
            <select
              value={sessionalType}
              onChange={(e) => setSessionalType(e.target.value as SessionalType)}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Sessional 1">Sessional 1 (Max 30)</option>
              <option value="Sessional 2">Sessional 2 (Max 30)</option>
              <option value="Pre-University Test">Pre-University Test (PUT - Max 100)</option>
              <option value="Final Sessional">Final Sessional (Max 30)</option>
              <option value="Internal Assessment">Internal Assessment (Max 50)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Max Marks</label>
            <input
              type="number"
              min="1"
              max="100"
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value))}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Student Roster Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Enrolled Students ({activeSectionStudents.length})</span>
            <span className="text-xs text-slate-400 font-normal">
              • {selectedSubject?.subject_code} • Section {selectedSection?.name}
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by student or roll..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4 w-36">Marks (/{maxMarks})</th>
                <th className="py-3 px-4">Percentage</th>
                <th className="py-3 px-4">Remarks / Evaluation Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {activeSectionStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                activeSectionStudents.map((student, idx) => {
                  const current = marksState[student.id] || { marks: '', remarks: '' };
                  const numVal = current.marks !== '' ? Number(current.marks) : null;
                  const pct = numVal !== null ? Math.round((numVal / maxMarks) * 100) : null;

                  return (
                    <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-300">{student.roll_number}</td>
                      <td className="py-3 px-4 font-medium text-white">{student.full_name}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          max={maxMarks}
                          placeholder="—"
                          value={current.marks}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setMarksState(prev => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], marks: val }
                            }));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                        />
                      </td>
                      <td className="py-3 px-4">
                        {pct !== null ? (
                          <span className={clsx(
                            "px-2 py-0.5 rounded text-xs font-semibold font-mono",
                            pct >= 75 ? "bg-emerald-500/20 text-emerald-400" : pct >= 50 ? "bg-blue-500/20 text-blue-400" : "bg-rose-500/20 text-rose-400"
                          )}>
                            {pct}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Optional comments..."
                          value={current.remarks}
                          onChange={(e) => {
                            const text = e.target.value;
                            setMarksState(prev => ({
                              ...prev,
                              [student.id]: { ...prev[student.id], remarks: text }
                            }));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Changes will be committed directly to the central Supabase database.
          </span>
          <Button
            onClick={handleSaveMarks}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Sessional Marks'}
          </Button>
        </div>
      </div>

      {/* MARKS AUDIT HISTORY MODAL */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Sessional Marks Change Audit Log"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Chronological audit trail of all sessional marks adjustments for {selectedSubject?.subject_name || 'this subject'}.
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

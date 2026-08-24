import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Calendar, 
  ExternalLink, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Users, 
  Award, 
  Trash2, 
  Edit3, 
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Quiz, QuizResult } from '../../types/database.types';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';

export const FacultyQuizzesPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    quizzes, 
    quizResults, 
    subjects, 
    sections, 
    students,
    assignments: facultySubjectAssignments,
    createQuiz,
    deleteQuiz,
    saveQuizMarks
  } = useAcademic();

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'hod';
  const currentFacultyId = user?.faculty_id || user?.id || '';

  // Filter quizzes created by this faculty (or all for HOD/Admin)
  const myQuizzes = useMemo(() => {
    if (isSuperAdmin) return quizzes;
    return quizzes.filter(q => q.faculty_id === currentFacultyId);
  }, [quizzes, isSuperAdmin, currentFacultyId]);

  // Allowed subjects & sections for creating new quiz
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

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');

  // Create Quiz Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [maxMarks, setMaxMarks] = useState<number>(20);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Roster Marks Entry Modal State
  const [activeQuizForMarks, setActiveQuizForMarks] = useState<Quiz | null>(null);
  const [marksRoster, setMarksRoster] = useState<Record<string, { marks: number | ''; remarks: string }>>({});
  const [isSavingMarks, setIsSavingMarks] = useState(false);

  const filteredQuizzes = useMemo(() => {
    return myQuizzes.filter(q => {
      const matchesSearch = (q.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (q.subject?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (q.subject?.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = selectedSubjectFilter === 'ALL' || q.subject_id === selectedSubjectFilter;
      return matchesSearch && matchesSubject;
    });
  }, [myQuizzes, searchTerm, selectedSubjectFilter]);

  const handleOpenCreateModal = () => {
    setErrorMsg('');
    setTitle('');
    setDescription('');
    setGoogleFormUrl('');
    setMaxMarks(20);
    setStartTime('');
    setEndTime('');
    setInstructions('');
    if (myAssignedSubjects.length > 0) {
      setSelectedSubjectId(myAssignedSubjects[0].subject.id);
      setSelectedSectionId(myAssignedSubjects[0].sections[0]?.id || '');
    }
    setIsCreateModalOpen(true);
  };

  const handleSubjectChange = (subId: string) => {
    setSelectedSubjectId(subId);
    const subObj = myAssignedSubjects.find(s => s.subject.id === subId);
    if (subObj && subObj.sections.length > 0) {
      setSelectedSectionId(subObj.sections[0].id);
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Please enter a quiz title.');
      return;
    }
    if (!selectedSubjectId || !selectedSectionId) {
      setErrorMsg('Please select a valid subject and section.');
      return;
    }
    if (!googleFormUrl.startsWith('http')) {
      setErrorMsg('Please enter a valid Google Forms URL (starting with https://).');
      return;
    }
    if (!startTime || !endTime) {
      setErrorMsg('Please select start and end dates/times.');
      return;
    }
    if (maxMarks <= 0) {
      setErrorMsg('Maximum marks must be greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createQuiz({
        faculty_id: currentFacultyId,
        subject_id: selectedSubjectId,
        section_id: selectedSectionId,
        title: title.trim(),
        description: description.trim(),
        google_form_url: googleFormUrl.trim(),
        max_marks: Number(maxMarks),
        quiz_date: getISTTodayDate(),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        instructions: instructions.trim(),
        active: true,
      });

      setIsCreateModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create quiz.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete quiz "${name}"?`)) {
      await deleteQuiz(id);
    }
  };

  // Open Marks Roster
  const handleOpenMarksRoster = (quiz: Quiz) => {
    setActiveQuizForMarks(quiz);
    const sectionStudents = students.filter(s => s.section_id === quiz.section_id);
    const existingResults = quizResults.filter(qr => qr.quiz_id === quiz.id);

    const initial: Record<string, { marks: number | ''; remarks: string }> = {};
    for (const st of sectionStudents) {
      const res = existingResults.find(r => r.student_id === st.id);
      initial[st.id] = {
        marks: res ? res.marks_obtained : '',
        remarks: res?.remarks || '',
      };
    }
    setMarksRoster(initial);
  };

  const handleSaveMarksRoster = async () => {
    if (!activeQuizForMarks) return;
    const studentList: Array<{ studentId: string; marksObtained: number; remarks?: string }> = [];

    for (const [studentId, data] of Object.entries(marksRoster)) {
      if (data.marks !== '' && !isNaN(Number(data.marks))) {
        const val = Number(data.marks);
        if (val < 0 || val > activeQuizForMarks.max_marks) {
          alert(`Marks for student must be between 0 and ${activeQuizForMarks.max_marks}`);
          return;
        }
        studentList.push({
          studentId,
          marksObtained: val,
          remarks: data.remarks || undefined,
        });
      }
    }

    if (studentList.length === 0) {
      alert('Please enter marks for at least one student.');
      return;
    }

    try {
      setIsSavingMarks(true);
      await saveQuizMarks({
        quizId: activeQuizForMarks.id,
        facultyId: currentFacultyId,
        studentMarks: studentList,
      });
      setActiveQuizForMarks(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save quiz marks.');
    } finally {
      setIsSavingMarks(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Quiz Management & Scoring</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Publish Google Form quizzes, share external assessment links, and record student marks.
                </p>
              </div>
            </div>
          </div>
          <Button 
            onClick={handleOpenCreateModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create New Quiz
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search quizzes by title or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Assigned Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_code} - {s.subject_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quiz Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredQuizzes.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900/50 border border-slate-800/60 rounded-2xl">
            <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-slate-300">No Quizzes Created Yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Click &quot;Create New Quiz&quot; to link a Google Form quiz with maximum marks and duration.
            </p>
          </div>
        ) : (
          filteredQuizzes.map(quiz => {
            const results = quizResults.filter(qr => qr.quiz_id === quiz.id);
            const isExpired = new Date() > new Date(quiz.end_time);

            return (
              <div 
                key={quiz.id} 
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {quiz.subject?.subject_code || 'Subject'} • Section {quiz.section?.name || 'A'}
                    </span>
                    <button 
                      onClick={() => handleDelete(quiz.id, quiz.title)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete Quiz"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{quiz.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                    {quiz.description || quiz.instructions || 'Online Google Form Assessment.'}
                  </p>

                  <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Max Marks:</span>
                      <span className="font-semibold text-emerald-400">{quiz.max_marks} Marks</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Status:</span>
                      <span className={clsx("px-2 py-0.5 rounded text-[11px] font-semibold", isExpired ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300")}>
                        {isExpired ? 'Expired' : 'Active / Available'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Window:</span>
                      <span className="font-medium text-slate-300 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(quiz.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(quiz.end_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  {/* Scored Students Count */}
                  <div className="mt-4 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 text-center">
                    <div className="text-lg font-bold text-white">{results.length}</div>
                    <div className="text-[11px] text-slate-400">Students Scored Recorded</div>
                  </div>
                </div>

                <div className="mt-5 pt-3 flex items-center gap-2">
                  <a
                    href={quiz.google_form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-400" /> Form Link
                  </a>
                  <Button
                    onClick={() => handleOpenMarksRoster(quiz)}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20"
                  >
                    <Award className="w-3.5 h-3.5" /> Enter / Edit Marks
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE QUIZ MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Google Form Quiz"
      >
        <form onSubmit={handleCreateQuiz} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Quiz Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Unit 1 Data Structure Assessment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Subject *</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {myAssignedSubjects.map(s => (
                  <option key={s.subject.id} value={s.subject.id}>
                    {s.subject.subject_code} - {s.subject.subject_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Section *</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {myAssignedSubjects
                  .find(s => s.subject.id === selectedSubjectId)
                  ?.sections.map(sec => (
                    <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Google Form Link *</label>
            <input
              type="url"
              required
              placeholder="https://forms.google.com/..."
              value={googleFormUrl}
              onChange={(e) => setGoogleFormUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Students will access and submit the quiz via this Google Form.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Max Marks *</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Time *</label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">End Time *</label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Optional Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. 20 MCQ questions. Each question carries 1 mark. Negative marking: None."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSubmitting ? 'Publishing...' : 'Publish Quiz'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* BATCH MARKS ROSTER MODAL */}
      <Modal
        isOpen={!!activeQuizForMarks}
        onClose={() => setActiveQuizForMarks(null)}
        title={`Record Quiz Marks — ${activeQuizForMarks?.title || ''}`}
      >
        <div className="space-y-4">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Subject: </span>
              <span className="text-white font-medium">{activeQuizForMarks?.subject?.subject_name}</span>
            </div>
            <div>
              <span className="text-slate-400">Max Marks: </span>
              <span className="text-emerald-400 font-bold">{activeQuizForMarks?.max_marks}</span>
            </div>
            <div>
              <span className="text-slate-400">Section: </span>
              <span className="text-purple-400 font-medium">Section {activeQuizForMarks?.section?.name}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Enter marks evaluated from the Google Form responses. All updates are logged in the audit ledger.
          </p>

          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80 sticky top-0">
                  <th className="py-2.5 px-3">Roll No.</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3 w-28">Marks (/{activeQuizForMarks?.max_marks})</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {students
                  .filter(s => s.section_id === activeQuizForMarks?.section_id)
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
                            max={activeQuizForMarks?.max_marks || 100}
                            placeholder="—"
                            value={current.marks}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setMarksRoster(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], marks: val }
                              }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="Optional note..."
                            value={current.remarks}
                            onChange={(e) => {
                              const text = e.target.value;
                              setMarksRoster(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], remarks: text }
                              }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
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
              onClick={() => setActiveQuizForMarks(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMarksRoster}
              disabled={isSavingMarks}
              className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              {isSavingMarks ? 'Saving Records...' : 'Save & Record All Marks'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

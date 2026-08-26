import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Calendar, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Users, 
  Award, 
  Trash2, 
  Edit3, 
  Eye,
  FileCheck,
  Sparkles,
  Layers
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Assignment, AssignmentSubmission, SubmissionType } from '../../types/database.types';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { clsx } from 'clsx';

export const FacultyAssignmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    institution,
    courseAssignments, 
    assignmentSubmissions, 
    subjects, 
    sections, 
    faculty, 
    students,
    timetable,
    assignments: facultySubjectAssignments,
    createAssignment,
    deleteCourseAssignment,
    gradeAssignmentSubmission
  } = useAcademic();

  const currentFaculty = faculty.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;

  const currentFacultyId = currentFaculty?.id || user?.faculty_id || user?.id || '';
  const isSuperAdmin = (user?.role === 'super_admin' || user?.role === 'hod') && !currentFacultyId;

  // Filter assignments created by this faculty (or all for HOD/Admin)
  const myAssignments = useMemo(() => {
    if (isSuperAdmin) return courseAssignments;
    return courseAssignments.filter(a => a.faculty_id === currentFacultyId);
  }, [courseAssignments, isSuperAdmin, currentFacultyId]);

  // Allowed subjects & sections dynamically resolved from database relationships
  const myAssignedSubjects = useMemo(() => {
    // 1. Determine subjects taught by this faculty (FSA, Timetable, or Department curriculum)
    const taughtSubjectIds = new Set<string>();
    for (const fsa of facultySubjectAssignments) {
      if (fsa.faculty_id === currentFacultyId && fsa.active) {
        taughtSubjectIds.add(fsa.subject_id);
      }
    }
    for (const t of timetable) {
      if (t.faculty_id === currentFacultyId && t.active) {
        taughtSubjectIds.add(t.subject_id);
      }
    }

    const relevantSubjects = (taughtSubjectIds.size > 0 && !isSuperAdmin)
      ? subjects.filter(s => taughtSubjectIds.has(s.id) && s.active)
      : (currentFaculty?.department_id 
          ? subjects.filter(s => (s.department_id === currentFaculty.department_id || !s.department_id) && s.active) 
          : subjects.filter(s => s.active));

    return relevantSubjects.map(sub => {
      // Find all active sections for this subject's semester and department
      const matchingSections = sections.filter(sec => {
        if (!sec.active) return false;
        if (sub.semester_id) return sec.semester_id === sub.semester_id;
        return true;
      });

      const sortedSections = (matchingSections.length > 0 ? matchingSections : sections.filter(s => s.active))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      return {
        subject: sub,
        sections: sortedSections,
      };
    });
  }, [isSuperAdmin, subjects, sections, facultySubjectAssignments, timetable, currentFacultyId, currentFaculty]);

  const myAssignedSections = useMemo(() => {
    if (isSuperAdmin) return sections.filter(s => s.active);
    const secSet = new Set<string>();
    for (const item of myAssignedSubjects) {
      for (const sec of item.sections) {
        secSet.add(sec.id);
      }
    }
    return sections.filter(sec => secSet.has(sec.id) && sec.active);
  }, [isSuperAdmin, myAssignedSubjects, sections]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('ALL');

  // Create Assignment Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [submissionType, setSubmissionType] = useState<SubmissionType>('both');
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [maxMarks, setMaxMarks] = useState<number>(10);
  const [dueDate, setDueDate] = useState('');
  const [allowLateSubmission, setAllowLateSubmission] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // View Submissions Drawer State
  const [activeAssignmentForGrading, setActiveAssignmentForGrading] = useState<Assignment | null>(null);
  const [selectedStudentForGrading, setSelectedStudentForGrading] = useState<typeof students[0] | null>(null);
  const [gradeMarks, setGradeMarks] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const filteredAssignments = useMemo(() => {
    return myAssignments.filter(a => {
      const matchesSearch = (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.subject?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.subject?.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = selectedSubjectFilter === 'ALL' || a.subject_id === selectedSubjectFilter;
      const matchesSection = selectedSectionFilter === 'ALL' || a.section_id === selectedSectionFilter;
      return matchesSearch && matchesSubject && matchesSection;
    });
  }, [myAssignments, searchTerm, selectedSubjectFilter, selectedSectionFilter]);

  const handleOpenCreateModal = () => {
    setErrorMsg('');
    setTitle('');
    setDescription('');
    setGoogleFormUrl('');
    setMaxMarks(10);
    setDueDate('');
    setSubmissionType('both');
    setAllowLateSubmission(true);
    if (myAssignedSubjects.length > 0) {
      const firstSub = myAssignedSubjects[0];
      setSelectedSubjectId(firstSub.subject.id);
      setSelectedSectionId(firstSub.sections[0]?.id || '');
    }
    setIsCreateModalOpen(true);
  };

  const handleSubjectChange = (subId: string) => {
    setSelectedSubjectId(subId);
    const subObj = myAssignedSubjects.find(s => s.subject.id === subId);
    if (subObj && subObj.sections.length > 0) {
      if (!subObj.sections.some(sec => sec.id === selectedSectionId)) {
        setSelectedSectionId(subObj.sections[0].id);
      }
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Please enter an assignment title.');
      return;
    }
    if (!selectedSubjectId || !selectedSectionId) {
      setErrorMsg('Please select a valid subject and section.');
      return;
    }
    if (!dueDate) {
      setErrorMsg('Please specify a due date.');
      return;
    }
    if ((submissionType === 'google_form' || submissionType === 'both') && !googleFormUrl.startsWith('http')) {
      setErrorMsg('Please enter a valid Google Forms URL (starting with https://).');
      return;
    }
    if (maxMarks <= 0) {
      setErrorMsg('Maximum marks must be greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createAssignment({
        faculty_id: currentFacultyId,
        subject_id: selectedSubjectId,
        section_id: selectedSectionId,
        title: title.trim(),
        description: description.trim(),
        submission_type: submissionType,
        google_form_url: googleFormUrl.trim() || undefined,
        max_marks: Number(maxMarks),
        assigned_date: getISTTodayDate(),
        due_date: new Date(dueDate).toISOString(),
        allow_late_submission: allowLateSubmission,
        active: true,
      });

      setIsCreateModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete assignment "${name}"?`)) {
      await deleteCourseAssignment(id);
    }
  };

  // Submissions calculation for active grading assignment
  const activeSectionStudents = useMemo(() => {
    if (!activeAssignmentForGrading) return [];
    return students.filter(s => s.section_id === activeAssignmentForGrading.section_id);
  }, [activeAssignmentForGrading, students]);

  const activeSubmissionsMap = useMemo(() => {
    if (!activeAssignmentForGrading) return new Map<string, AssignmentSubmission>();
    const map = new Map<string, AssignmentSubmission>();
    const subs = assignmentSubmissions.filter(s => s.assignment_id === activeAssignmentForGrading.id);
    for (const sub of subs) {
      map.set(sub.student_id, sub);
    }
    return map;
  }, [activeAssignmentForGrading, assignmentSubmissions]);

  const handleOpenGradingForStudent = (student: typeof students[0]) => {
    setSelectedStudentForGrading(student);
    const existingSub = activeSubmissionsMap.get(student.id);
    setGradeMarks(existingSub?.marks_obtained ?? activeAssignmentForGrading?.max_marks ?? 10);
    setGradeFeedback(existingSub?.feedback || '');
  };

  const handleSaveGrade = async () => {
    if (!activeAssignmentForGrading || !selectedStudentForGrading) return;
    const existingSub = activeSubmissionsMap.get(selectedStudentForGrading.id);

    try {
      setIsSavingGrade(true);
      if (existingSub) {
        await gradeAssignmentSubmission({
          submissionId: existingSub.id,
          marksObtained: Number(gradeMarks),
          feedback: gradeFeedback,
          facultyId: currentFacultyId,
        });
      }
      setSelectedStudentForGrading(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save grade.');
    } finally {
      setIsSavingGrade(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Assignment Management & Grading</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Create Google Form & file upload assignments, evaluate student submissions, and record marks.
                </p>
              </div>
            </div>
          </div>
          <Button 
            onClick={handleOpenCreateModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create New Assignment
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search assignments by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Assigned Subjects ({myAssignedSubjects.length})</option>
              {myAssignedSubjects.map(s => (
                <option key={s.subject.id} value={s.subject.id}>{s.subject.subject_code} - {s.subject.subject_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Assigned Sections ({myAssignedSections.length})</option>
              {myAssignedSections.map(sec => (
                <option key={sec.id} value={sec.id}>Section {sec.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Class & Section Context Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-blue-500/30 text-xs text-slate-300">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 font-semibold">Active Managing Context:</span>
          <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold font-mono">
            {selectedSubjectFilter === 'ALL' ? 'All Assigned Subjects' : subjects.find(s => s.id === selectedSubjectFilter)?.subject_code + ' — ' + subjects.find(s => s.id === selectedSubjectFilter)?.subject_name}
          </span>
          <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-bold border border-blue-500/20">
            {selectedSectionFilter === 'ALL' ? 'All Assigned Sections' : 'Section ' + sections.find(s => s.id === selectedSectionFilter)?.name}
          </span>
          <span className="text-slate-400">
            • Odd Semester 2026–2027 (Second Year)
          </span>
        </div>
        <span className="text-[11px] text-blue-400 font-semibold hidden sm:inline">
          ✓ Section-Specific Isolation Active
        </span>
      </div>

      {/* Assignment List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAssignments.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900/50 border border-slate-800/60 rounded-2xl">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-slate-300">No Assignments Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Click "Create New Assignment" to publish an academic task with a Google Form or file upload requirement.
            </p>
          </div>
        ) : (
          filteredAssignments.map(assignment => {
            const subs = assignmentSubmissions.filter(s => s.assignment_id === assignment.id);
            const gradedCount = subs.filter(s => s.status === 'graded').length;
            const isDuePassed = new Date() > new Date(assignment.due_date);

            return (
              <div 
                key={assignment.id} 
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {assignment.subject?.subject_code || 'Subject'} • Section {assignment.section?.name || ''} • Odd Semester 2026–27
                    </span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleDelete(assignment.id, assignment.title)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Delete Assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{assignment.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                    {assignment.description || 'No specific instructions provided.'}
                  </p>

                  <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Max Marks:</span>
                      <span className="font-semibold text-emerald-400">{assignment.max_marks} Marks</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Submission Type:</span>
                      <span className="font-semibold text-slate-200 capitalize">
                        {assignment.submission_type === 'google_form' ? 'Google Form' : assignment.submission_type === 'file_upload' ? 'File Upload' : 'Google Form + File'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Due Date:</span>
                      <span className={clsx("font-semibold flex items-center gap-1", isDuePassed ? "text-amber-400" : "text-slate-300")}>
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(assignment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Submission Statistics */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-lg font-bold text-white">{subs.length}</div>
                      <div className="text-[11px] text-slate-400">Submitted</div>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-lg font-bold text-emerald-400">{gradedCount}</div>
                      <div className="text-[11px] text-slate-400">Graded</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 flex items-center gap-2">
                  {assignment.google_form_url && (
                    <a
                      href={assignment.google_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Form
                    </a>
                  )}
                  <Button
                    onClick={() => setActiveAssignmentForGrading(assignment)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <Eye className="w-3.5 h-3.5" /> View & Grade
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE ASSIGNMENT MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Academic Assignment"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assignment Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Unit 2 Tree Traversal Assignment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Subject *</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
              >
                {myAssignedSubjects
                  .find(s => s.subject.id === selectedSubjectId)
                  ?.sections.map(sec => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name} {sec.room_number ? `(${sec.room_number})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Target Audience Scope Preview */}
          {(() => {
            const currentSubObj = myAssignedSubjects.find(s => s.subject.id === selectedSubjectId);
            const currentSecObj = currentSubObj?.sections.find(sec => sec.id === selectedSectionId) || sections.find(s => s.id === selectedSectionId);
            if (!currentSecObj) return null;
            return (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300 flex items-start gap-2.5">
                <Users className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Target Scope: Section {currentSecObj.name} {currentSecObj.room_number ? `(Room ${currentSecObj.room_number})` : ''}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    This assignment will be published strictly to students enrolled in Section {currentSecObj.name}. Other sections will not have access.
                  </p>
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Instructions / Description</label>
            <textarea
              rows={3}
              placeholder="Specify requirements, reference pages, or formatting rules..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Submission Type *</label>
              <select
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value as SubmissionType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="both">Google Form + File Upload</option>
                <option value="google_form">Google Form Only</option>
                <option value="file_upload">Direct File Upload Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Maximum Marks *</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {(submissionType === 'google_form' || submissionType === 'both') && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Google Form Link *</label>
              <input
                type="url"
                required={submissionType === 'google_form'}
                placeholder="https://forms.google.com/..."
                value={googleFormUrl}
                onChange={(e) => setGoogleFormUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Students will be redirected to this secure external link.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Due Date & Time *</label>
            <input
              type="datetime-local"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="lateSub"
              checked={allowLateSubmission}
              onChange={(e) => setAllowLateSubmission(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
            />
            <label htmlFor="lateSub" className="text-xs text-slate-300">
              Allow late submissions (flagged as "Late Submission" in portal)
            </label>
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
              {isSubmitting ? 'Publishing...' : 'Publish Assignment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW SUBMISSIONS & GRADING MODAL */}
      <Modal
        isOpen={!!activeAssignmentForGrading}
        onClose={() => {
          setActiveAssignmentForGrading(null);
          setSelectedStudentForGrading(null);
        }}
        title={`Submissions & Grading — ${activeAssignmentForGrading?.title || ''}`}
      >
        <div className="space-y-4">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Subject: </span>
              <span className="text-white font-medium">{activeAssignmentForGrading?.subject?.subject_name}</span>
            </div>
            <div>
              <span className="text-slate-400">Max Marks: </span>
              <span className="text-emerald-400 font-bold">{activeAssignmentForGrading?.max_marks}</span>
            </div>
            <div>
              <span className="text-slate-400">Section: </span>
              <span className="text-blue-400 font-medium">Section {activeAssignmentForGrading?.section?.name}</span>
            </div>
          </div>

          {/* Student Submissions Table */}
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80 sticky top-0">
                  <th className="py-2.5 px-3">Roll No.</th>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">File / Link</th>
                  <th className="py-2.5 px-3 text-right">Marks</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeSectionStudents.map(student => {
                  const sub = activeSubmissionsMap.get(student.id);
                  const isSubmitted = !!sub;

                  return (
                    <tr key={student.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-slate-300">{student.roll_number}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{student.full_name}</td>
                      <td className="py-2.5 px-3">
                        {!isSubmitted ? (
                          <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400">Not Submitted</span>
                        ) : sub.status === 'graded' ? (
                          <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/20 text-emerald-300 font-semibold">Graded</span>
                        ) : sub.status === 'late_submission' ? (
                          <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/20 text-amber-300 font-medium">Late Submission</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] bg-blue-500/20 text-blue-300 font-medium">Submitted</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {sub?.file_path ? (
                          <a
                            href={sub.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {sub.file_name || 'Download File'}
                          </a>
                        ) : sub?.google_form_submitted ? (
                          <span className="text-slate-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Google Form
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        {sub?.marks_obtained !== undefined && sub?.marks_obtained !== null 
                          ? `${sub.marks_obtained} / ${activeAssignmentForGrading?.max_marks}` 
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenGradingForStudent(student)}
                          className="text-blue-400 hover:text-blue-300 p-1 text-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" /> Grade
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick Grading Drawer for single student */}
          {selectedStudentForGrading && (
            <div className="p-4 bg-slate-950 border border-blue-500/30 rounded-2xl space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-400" />
                  Grading: {selectedStudentForGrading.full_name} ({selectedStudentForGrading.roll_number})
                </h4>
                <button
                  onClick={() => setSelectedStudentForGrading(null)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Marks Obtained (Max: {activeAssignmentForGrading?.max_marks})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={activeAssignmentForGrading?.max_marks || 100}
                    value={gradeMarks}
                    onChange={(e) => setGradeMarks(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Feedback Comments</label>
                  <input
                    type="text"
                    placeholder="e.g. Excellent work, detailed explanation"
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={handleSaveGrade}
                  disabled={isSavingGrade}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5"
                >
                  {isSavingGrade ? 'Saving...' : 'Save & Record Grade'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

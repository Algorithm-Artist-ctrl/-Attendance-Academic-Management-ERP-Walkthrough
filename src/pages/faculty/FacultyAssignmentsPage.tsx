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
  Layers,
  Loader2
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Assignment, AssignmentSubmission, SubmissionType } from '../../types/database.types';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { sanitizeExternalUrl } from '../../lib/utils/urlUtils';
import { clsx } from 'clsx';

export const FacultyAssignmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    institution,
    courseAssignments, 
    assignmentSubmissions, 
    subjects, 
    sections, 
    years,
    semesters,
    faculty, 
    students,
    timetable,
    assignments: facultySubjectAssignments,
    getFacultyTeachingScope,
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

  const facultyScope = useMemo(() => {
    return getFacultyTeachingScope(currentFacultyId, isSuperAdmin);
  }, [getFacultyTeachingScope, currentFacultyId, isSuperAdmin]);

  // Filter assignments created by this faculty (or all for HOD/Admin)
  const myAssignments = useMemo(() => {
    const rawList = isSuperAdmin ? courseAssignments : courseAssignments.filter(a => a.faculty_id === currentFacultyId);
    return rawList.filter(a => a.active !== false && !a.deleted_at);
  }, [courseAssignments, isSuperAdmin, currentFacultyId]);

  // Allowed subjects & sections dynamically resolved strictly from database relationships
  const myAssignedSubjects = useMemo(() => {
    if (isSuperAdmin) {
      return subjects.filter(s => s.active !== false).map(sub => {
        const matchingSections = sections.filter(sec => {
          if (!sec.active) return false;
          if (sub.semester_id) return sec.semester_id === sub.semester_id;
          return true;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        return {
          subject: sub,
          sections: matchingSections,
        };
      });
    }

    // Group assigned sections by subject
    const subMap = new Map<string, { subject: typeof subjects[0]; sections: Array<typeof sections[0]> }>();
    for (const a of facultyScope.allAssignments) {
      if (!a.subject || !a.section) continue;
      if (!subMap.has(a.subject.id)) {
        subMap.set(a.subject.id, {
          subject: a.subject,
          sections: [],
        });
      }
      const entry = subMap.get(a.subject.id)!;
      if (!entry.sections.some(s => s.id === a.section!.id)) {
        entry.sections.push(a.section);
      }
    }

    return Array.from(subMap.values()).map(item => ({
      subject: item.subject,
      sections: item.sections.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    }));
  }, [isSuperAdmin, subjects, sections, facultyScope]);

  const myAssignedSections = useMemo(() => {
    if (isSuperAdmin) return sections.filter(s => s.active);
    return facultyScope.assignedSections;
  }, [isSuperAdmin, sections, facultyScope]);

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
  const [createSuccess, setCreateSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // View Submissions Drawer State
  const [activeAssignmentForGrading, setActiveAssignmentForGrading] = useState<Assignment | null>(null);
  const [selectedStudentForGrading, setSelectedStudentForGrading] = useState<typeof students[0] | null>(null);
  const [gradeMarks, setGradeMarks] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [saveGradeSuccess, setSaveGradeSuccess] = useState(false);

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
      setCreateSuccess(false);
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

      setCreateSuccess(true);
      setTimeout(() => {
        setCreateSuccess(false);
        setIsCreateModalOpen(false);
      }, 500);
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
      setSaveGradeSuccess(false);
      if (existingSub) {
        await gradeAssignmentSubmission({
          submissionId: existingSub.id,
          marksObtained: Number(gradeMarks),
          feedback: gradeFeedback,
          facultyId: currentFacultyId,
        });
      }
      setSaveGradeSuccess(true);
      setTimeout(() => {
        setSaveGradeSuccess(false);
        setSelectedStudentForGrading(null);
      }, 500);
    } catch (err: any) {
      alert(err.message || 'Failed to save grade. Your entered score and feedback have been preserved.');
    } finally {
      setIsSavingGrade(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 font-serif-institutional tracking-tight">Assignment Management & Grading</h1>
                <p className="text-slate-600 text-sm mt-0.5">
                  Create Google Form & file upload assignments, evaluate student submissions, and record marks.
                </p>
              </div>
            </div>
          </div>
          <Button 
            onClick={handleOpenCreateModal}
            className="bg-[#0f172a] hover:bg-black text-white shadow-xs font-bold rounded-xl flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create New Assignment
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search assignments by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
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
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value="ALL">All Assigned Sections ({myAssignedSections.length})</option>
              {myAssignedSections.map(sec => {
                const sem = semesters.find(s => s.id === sec.semester_id);
                const yr = years.find(y => y.id === sem?.academic_year_id);
                return (
                  <option key={sec.id} value={sec.id}>
                    {yr?.name ? `${yr.name} • ` : ''}Section {sec.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Active Class & Section Context Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 font-semibold">Active Managing Context:</span>
          <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold font-mono border border-slate-200">
            {selectedSubjectFilter === 'ALL' ? 'All Assigned Subjects' : subjects.find(s => s.id === selectedSubjectFilter)?.subject_code + ' — ' + subjects.find(s => s.id === selectedSubjectFilter)?.subject_name}
          </span>
          <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold border border-slate-200">
            {selectedSectionFilter === 'ALL' ? 'All Assigned Sections' : 'Section ' + sections.find(s => s.id === selectedSectionFilter)?.name}
          </span>
          {(() => {
            const activeSec = selectedSectionFilter !== 'ALL' 
              ? sections.find(s => s.id === selectedSectionFilter) 
              : myAssignedSections[0];
            const sem = semesters.find(s => s.id === activeSec?.semester_id);
            const yr = years.find(y => y.id === sem?.academic_year_id);
            return (
              <span className="text-slate-500 font-medium">
                • {sem?.name || 'Odd Semester 2026–2027'} {yr?.name ? `(${yr.name})` : ''}
              </span>
            );
          })()}
        </div>
        <span className="text-[11px] text-slate-600 font-semibold hidden sm:inline">
          ✓ Section-Specific Isolation Active
        </span>
      </div>

      {/* Assignment List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAssignments.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800 font-serif-institutional">No Assignments Found</h3>
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
                className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {assignment.subject?.subject_code || 'Subject'} • Section {assignment.section?.name || ''} • Odd Semester 2026–27
                    </span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleDelete(assignment.id, assignment.title)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Delete Assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{assignment.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                    {assignment.description || 'No specific instructions provided.'}
                  </p>

                  <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Max Marks:</span>
                      <span className="font-semibold text-emerald-800">{assignment.max_marks} Marks</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Submission Type:</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {assignment.submission_type === 'google_form' ? 'Google Form' : assignment.submission_type === 'file_upload' ? 'File Upload' : 'Google Form + File'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Due Date:</span>
                      <span className={clsx("font-semibold flex items-center gap-1", isDuePassed ? "text-amber-800" : "text-slate-700")}>
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(assignment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Submission Statistics */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-lg font-bold text-slate-900">{subs.length}</div>
                      <div className="text-[11px] text-slate-500">Submitted</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-lg font-bold text-emerald-800">{gradedCount}</div>
                      <div className="text-[11px] text-slate-500">Graded</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 flex items-center gap-2">
                  {assignment.google_form_url && (
                    <a
                      href={sanitizeExternalUrl(assignment.google_form_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-300 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600" /> Form
                    </a>
                  )}
                  <Button
                    onClick={() => setActiveAssignmentForGrading(assignment)}
                    className="flex-1 bg-[#0f172a] hover:bg-black text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Unit 2 Tree Traversal Assignment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              >
                {myAssignedSubjects.map(s => (
                  <option key={s.subject.id} value={s.subject.id}>
                    {s.subject.subject_code} - {s.subject.subject_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Section *</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 font-medium"
              >
                {myAssignedSubjects
                  .find(s => s.subject.id === selectedSubjectId)
                  ?.sections.map(sec => {
                    const sem = semesters.find(s => s.id === sec.semester_id);
                    const yr = years.find(y => y.id === sem?.academic_year_id);
                    return (
                      <option key={sec.id} value={sec.id}>
                        {yr?.name ? `${yr.name} • ` : ''}Section {sec.name} {sec.room_number ? `(${sec.room_number})` : ''}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          {/* Target Audience Scope Preview */}
          {(() => {
            const currentSubObj = myAssignedSubjects.find(s => s.subject.id === selectedSubjectId);
            const currentSecObj = currentSubObj?.sections.find(sec => sec.id === selectedSectionId) || sections.find(s => s.id === selectedSectionId);
            if (!currentSecObj) return null;
            return (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                <Users className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">Target Scope: Section {currentSecObj.name} {currentSecObj.room_number ? `(Room ${currentSecObj.room_number})` : ''}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    This assignment will be published strictly to students enrolled in Section {currentSecObj.name}. Other sections will not have access.
                  </p>
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions / Description</label>
            <textarea
              rows={3}
              placeholder="Specify requirements, reference pages, or formatting rules..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Submission Type *</label>
              <select
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value as SubmissionType)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              >
                <option value="both">Google Form + File Upload</option>
                <option value="google_form">Google Form Only</option>
                <option value="file_upload">Direct File Upload Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Maximum Marks *</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          {(submissionType === 'google_form' || submissionType === 'both') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Google Form Link *</label>
              <input
                type="url"
                required={submissionType === 'google_form'}
                placeholder="https://forms.google.com/..."
                value={googleFormUrl}
                onChange={(e) => setGoogleFormUrl(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
              <p className="text-[11px] text-slate-500 mt-1">Students will be redirected to this secure external link.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date & Time *</label>
            <input
              type="datetime-local"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="lateSub"
              checked={allowLateSubmission}
              onChange={(e) => setAllowLateSubmission(e.target.checked)}
              className="rounded bg-white border-slate-300 text-slate-900 focus:ring-0"
            />
            <label htmlFor="lateSub" className="text-xs text-slate-700">
              Allow late submissions (flagged as "Late Submission" in portal)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createSuccess}
              className="bg-[#0f172a] hover:bg-black text-white font-bold rounded-xl shadow-xs"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Publishing...
                </span>
              ) : createSuccess ? (
                <span className="flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Published ✓
                </span>
              ) : (
                'Publish Assignment'
              )}
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
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-700">
            <div>
              <span className="text-slate-500">Subject: </span>
              <span className="text-slate-900 font-semibold">{activeAssignmentForGrading?.subject?.subject_name}</span>
            </div>
            <div>
              <span className="text-slate-500">Max Marks: </span>
              <span className="text-emerald-800 font-bold">{activeAssignmentForGrading?.max_marks}</span>
            </div>
            <div>
              <span className="text-slate-500">Section: </span>
              <span className="text-slate-900 font-semibold">Section {activeAssignmentForGrading?.section?.name}</span>
            </div>
          </div>

          {/* Student Submissions Table */}
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/90 sticky top-0 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Roll No.</th>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">File / Link</th>
                  <th className="py-2.5 px-3 text-right">Marks</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeSectionStudents.map(student => {
                  const sub = activeSubmissionsMap.get(student.id);
                  const isSubmitted = !!sub;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-700">{student.roll_number}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{student.full_name}</td>
                      <td className="py-2.5 px-3">
                        {!isSubmitted ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-600 border border-slate-200">Not Submitted</span>
                        ) : sub.status === 'graded' ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">Graded</span>
                        ) : sub.status === 'late_submission' ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-amber-50 text-amber-800 border border-amber-200 font-semibold">Late Submission</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-800 border border-slate-200 font-semibold">Submitted</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {sub?.file_path ? (
                          <a
                            href={sanitizeExternalUrl(sub.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-900 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-600" />
                            {sub.file_name || 'Download File'}
                          </a>
                        ) : sub?.google_form_submitted ? (
                          <span className="text-slate-700 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Google Form
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {sub?.marks_obtained !== undefined && sub?.marks_obtained !== null 
                          ? `${sub.marks_obtained} / ${activeAssignmentForGrading?.max_marks}` 
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenGradingForStudent(student)}
                          className="text-slate-800 hover:text-slate-950 p-1 text-xs font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-600" /> Grade
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
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-slate-700" />
                  Grading: {selectedStudentForGrading.full_name} ({selectedStudentForGrading.roll_number})
                </h4>
                <button
                  onClick={() => setSelectedStudentForGrading(null)}
                  className="text-slate-500 hover:text-slate-800 text-xs font-medium"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 font-semibold mb-1">
                    Marks Obtained (Max: {activeAssignmentForGrading?.max_marks})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={activeAssignmentForGrading?.max_marks || 100}
                    value={gradeMarks}
                    onChange={(e) => setGradeMarks(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 font-semibold mb-1">Feedback Comments</label>
                  <input
                    type="text"
                    placeholder="e.g. Excellent work, detailed explanation"
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={handleSaveGrade}
                  disabled={isSavingGrade || saveGradeSuccess}
                  className="bg-[#0f172a] hover:bg-black text-white text-xs py-1.5 px-4 rounded-xl font-bold shadow-xs flex items-center gap-1.5"
                >
                  {isSavingGrade ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : saveGradeSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Saved ✓
                    </>
                  ) : (
                    'Save & Record Grade'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

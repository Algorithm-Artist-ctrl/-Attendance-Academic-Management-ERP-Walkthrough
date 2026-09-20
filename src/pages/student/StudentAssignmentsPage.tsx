import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  ExternalLink, 
  Clock, 
  Calendar, 
  Award, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  MessageSquare,
  FileCheck
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Assignment, AssignmentSubmission } from '../../types/database.types';
import { clsx } from 'clsx';

export const StudentAssignmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    courseAssignments, 
    assignmentSubmissions, 
    subjects, 
    students,
    assignments,
    timetable,
    submitAssignment 
  } = useAcademic();

  const currentStudent = useMemo(() => {
    return students.find(s => s.id === user?.student_id || s.id === user?.student?.id || s.roll_number === user?.student?.roll_number || s.id === user?.id) || user?.student;
  }, [students, user]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');

  const mySectionId = currentStudent?.section_id || currentStudent?.section?.id;

  // Active submission modal state
  const [uploadModalAssignment, setUploadModalAssignment] = useState<Assignment | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Filter assignments strictly applicable to student's section
  const myAssignments = useMemo(() => {
    if (!mySectionId) return [];
    return courseAssignments.filter(a => a.section_id === mySectionId && a.active);
  }, [courseAssignments, mySectionId]);

  const filteredAssignments = useMemo(() => {
    return myAssignments.filter(a => {
      const matchesSearch = (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.subject?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (a.subject?.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = selectedSubjectFilter === 'ALL' || a.subject_id === selectedSubjectFilter;
      return matchesSearch && matchesSubject;
    });
  }, [myAssignments, searchTerm, selectedSubjectFilter]);

  // Distinct enrolled subjects for student's section
  const enrolledSubjects = useMemo(() => {
    if (!mySectionId) return [];
    const secSubIds = new Set([
      ...myAssignments.map(a => a.subject_id),
      ...timetable.filter(t => t.section_id === mySectionId && t.active).map(t => t.subject_id),
      ...assignments.filter(a => a.section_id === mySectionId && a.active !== false).map(a => a.subject_id)
    ]);
    return subjects.filter(s => secSubIds.has(s.id));
  }, [myAssignments, timetable, assignments, subjects, mySectionId]);

  const mySubmissionsMap = useMemo(() => {
    if (!currentStudent) return new Map<string, AssignmentSubmission>();
    const map = new Map<string, AssignmentSubmission>();
    const subs = assignmentSubmissions.filter(s => s.student_id === currentStudent.id);
    for (const s of subs) {
      map.set(s.assignment_id, s);
    }
    return map;
  }, [assignmentSubmissions, currentStudent]);

  const handleOpenUploadModal = (assignment: Assignment) => {
    setUploadModalAssignment(assignment);
    setSelectedFile(null);
    setUploadError('');
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModalAssignment || !currentStudent) return;
    setUploadError('');

    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    try {
      setIsUploading(true);

      // Convert file to Base64 data URL for storage
      const reader = new FileReader();
      const fileDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await submitAssignment({
        assignmentId: uploadModalAssignment.id,
        studentId: currentStudent.id,
        submissionType: 'file_upload',
        filePath: fileDataUrl,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
      });

      setUploadModalAssignment(null);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to submit assignment.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMarkGoogleFormSubmitted = async (assignment: Assignment) => {
    if (!currentStudent) return;
    try {
      await submitAssignment({
        assignmentId: assignment.id,
        studentId: currentStudent.id,
        submissionType: 'google_form',
        googleFormSubmitted: true,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to record Google Form submission.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs relative overflow-hidden">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 font-serif-institutional tracking-tight">Course Assignments</h1>
                <p className="text-slate-600 text-sm mt-0.5">
                  Submit Google Form assignments, upload files, and view awarded grades and teacher feedback.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search assignments by title or code..."
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
              <option value="ALL">All Enrolled Subjects</option>
              {enrolledSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.subject_code} - {s.subject_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Assignment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAssignments.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-50 border border-slate-200 rounded-2xl">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-bold text-[#0f172a]">No Assignments Found</h3>
            <p className="text-sm text-[#475569] font-medium max-w-md mx-auto mt-1">
              Your faculty has not published any assignments for your section yet.
            </p>
          </div>
        ) : (
          filteredAssignments.map(assignment => {
            const submission = mySubmissionsMap.get(assignment.id);
            const isDuePassed = new Date() > new Date(assignment.due_date);

            return (
              <div 
                key={assignment.id} 
                className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-[#0f172a] border border-slate-300">
                      {assignment.subject?.subject_code || 'Subject'} • Section {assignment.section?.name || ''}
                    </span>
                    <span className={clsx(
                      "px-2.5 py-0.5 rounded text-[11px] font-bold",
                      !submission ? "bg-slate-100 text-[#334155] border border-slate-300" : submission.status === 'graded' ? "bg-emerald-50 text-emerald-800 border border-emerald-300" : submission.status === 'late_submission' ? "bg-amber-50 text-amber-900 border border-amber-300" : "bg-slate-100 text-[#0f172a] border border-slate-300"
                    )}>
                      {!submission ? 'Not Submitted' : submission.status === 'graded' ? 'Graded' : submission.status === 'late_submission' ? 'Late Submission' : 'Submitted'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[#0f172a] mb-1">{assignment.title}</h3>
                  <p className="text-xs text-[#334155] mb-2 font-semibold">
                    {assignment.subject?.subject_name}
                  </p>
                  <p className="text-xs text-[#475569] font-medium line-clamp-2 mb-4">
                    {assignment.description || 'No specific instructions provided.'}
                  </p>

                  <div className="space-y-2 py-3 border-y border-slate-200 text-xs">
                    <div className="flex items-center justify-between text-[#475569] font-medium">
                      <span>Maximum Marks:</span>
                      <span className="font-bold text-[#0f172a]">{assignment.max_marks} Marks</span>
                    </div>
                    <div className="flex items-center justify-between text-[#475569] font-medium">
                      <span>Due Date:</span>
                      <span className={clsx("font-bold flex items-center gap-1", isDuePassed ? "text-amber-800" : "text-[#0f172a]")}>
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(assignment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Submission Evaluation / Feedback */}
                  {submission && (
                    <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#475569] font-medium">Awarded Marks:</span>
                        <span className="font-mono font-bold text-[#0f172a] text-sm">
                          {submission.marks_obtained !== undefined && submission.marks_obtained !== null 
                            ? `${submission.marks_obtained} / ${assignment.max_marks}` 
                            : 'Pending Evaluation'}
                        </span>
                      </div>
                      {submission.feedback && (
                        <div className="pt-2 border-t border-slate-200 flex items-start gap-1.5 text-slate-700">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                          <span>{submission.feedback}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3 space-y-2">
                  {assignment.google_form_url && (
                    <a
                      href={assignment.google_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleMarkGoogleFormSubmitted(assignment)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <ExternalLink className="w-4 h-4" /> Open Google Form
                    </a>
                  )}

                  {(assignment.submission_type === 'file_upload' || assignment.submission_type === 'both') && (
                    <Button
                      onClick={() => handleOpenUploadModal(assignment)}
                      className="w-full bg-[#0f172a] hover:bg-black text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Upload className="w-4 h-4" />
                      {submission ? 'Re-upload / Update File' : 'Upload Assignment File'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* UPLOAD FILE MODAL */}
      <Modal
        isOpen={!!uploadModalAssignment}
        onClose={() => setUploadModalAssignment(null)}
        title={`Submit Assignment — ${uploadModalAssignment?.title || ''}`}
      >
        <form onSubmit={handleFileSubmit} className="space-y-4">
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {uploadError}
            </div>
          )}

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <div className="flex justify-between text-[#475569] font-medium">
              <span>Subject:</span>
              <span className="text-[#0f172a] font-bold">{uploadModalAssignment?.subject?.subject_name}</span>
            </div>
            <div className="flex justify-between text-[#475569] font-medium">
              <span>Due Date:</span>
              <span className="text-amber-800 font-bold">
                {uploadModalAssignment && new Date(uploadModalAssignment.due_date).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between text-[#475569] font-medium">
              <span>Accepted Formats:</span>
              <span className="text-[#0f172a] font-semibold">PDF, DOCX, PPT, XLSX, ZIP, JPG, PNG</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#334155] mb-2">Select Assignment File *</label>
            <input
              type="file"
              required
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png"
              onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-xs text-[#334155] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0f172a] file:text-white hover:file:bg-black cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUploadModalAssignment(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUploading}
              className="bg-[#0f172a] hover:bg-black text-white flex items-center gap-1.5 shadow-xs"
            >
              <FileCheck className="w-4 h-4" />
              {isUploading ? 'Uploading...' : 'Submit File'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

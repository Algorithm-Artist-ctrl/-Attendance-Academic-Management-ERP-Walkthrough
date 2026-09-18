import React, { useState, useMemo, useRef } from 'react';
import { 
  Send, 
  Paperclip, 
  X, 
  AlertCircle, 
  Loader2, 
  GraduationCap, 
  Layers, 
  BookOpen, 
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  FileText,
  UploadCloud
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';

interface NewGroupMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

export const NewGroupMessageModal: React.FC<NewGroupMessageModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, role } = useAuth();
  const { 
    years, 
    semesters,
    sections, 
    subjects, 
    assignments, 
    timetable,
    sendGroupMessage 
  } = useAcademic();

  const isFaculty = role === 'faculty';
  const isHOD = role === 'hod';
  const isSuperAdmin = role === 'super_admin';

  // Guided dropdown states
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Composer fields
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [allowStudentReplies, setAllowStudentReplies] = useState(false);
  const [attachment, setAttachment] = useState<{
    file: File;
    dataUrl: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Calculate Faculty's Assigned Academic Matrix
  const facultyId = user?.faculty_id || user?.faculty?.id || user?.id;

  // Filter assigned teaching pairs
  const facultyAssignments = useMemo(() => {
    if (isSuperAdmin || isHOD) {
      // HOD and Super Admin have oversight over their assigned departments/all
      return assignments.filter(a => a.active);
    }
    return assignments.filter(a => a.faculty_id === facultyId && a.active);
  }, [assignments, facultyId, isSuperAdmin, isHOD]);

  // Timetable fallback pairs
  const facultyTimetableSlots = useMemo(() => {
    if (isSuperAdmin || isHOD) {
      return timetable.filter(t => t.active && t.subject_id);
    }
    return timetable.filter(t => t.faculty_id === facultyId && t.active && t.subject_id);
  }, [timetable, facultyId, isSuperAdmin, isHOD]);

  // Map of valid (sectionId, subjectId)
  const validSectionSubjectMap = useMemo(() => {
    const map = new Map<string, Set<string>>(); // sectionId -> Set of subjectIds
    facultyAssignments.forEach(a => {
      if (!map.has(a.section_id)) map.set(a.section_id, new Set());
      map.get(a.section_id)!.add(a.subject_id);
    });
    facultyTimetableSlots.forEach(t => {
      if (t.section_id && t.subject_id) {
        if (!map.has(t.section_id)) map.set(t.section_id, new Set());
        map.get(t.section_id)!.add(t.subject_id);
      }
    });
    return map;
  }, [facultyAssignments, facultyTimetableSlots]);

  // Available assigned sections
  const assignedSectionIds = useMemo(() => {
    return new Set(validSectionSubjectMap.keys());
  }, [validSectionSubjectMap]);

  // Step 1: Available Academic Years where Faculty teaches
  const eligibleYears = useMemo(() => {
    return years.filter(y => {
      // Check if any section of this year is in assignedSectionIds
      return sections.some(s => {
        const sem = semesters.find(sm => sm.id === s.semester_id);
        const secYearId = sem?.academic_year_id;
        return (secYearId === y.id) && assignedSectionIds.has(s.id);
      });
    }).sort((a, b) => a.year_number - b.year_number);
  }, [years, semesters, sections, assignedSectionIds]);

  // Step 2: Available Sections for the chosen Academic Year
  const eligibleSections = useMemo(() => {
    if (!selectedYearId) return [];
    return sections.filter(s => {
      const sem = semesters.find(sm => sm.id === s.semester_id);
      const secYearId = sem?.academic_year_id;
      return secYearId === selectedYearId && assignedSectionIds.has(s.id);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [sections, semesters, selectedYearId, assignedSectionIds]);

  // Step 3: Available Subjects for the chosen Section
  const eligibleSubjects = useMemo(() => {
    if (!selectedSectionId) return [];
    const validSubjectIds = validSectionSubjectMap.get(selectedSectionId) || new Set<string>();
    return subjects.filter(sub => validSubjectIds.has(sub.id))
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
  }, [subjects, selectedSectionId, validSectionSubjectMap]);

  const handleYearChange = (yearId: string) => {
    setSelectedYearId(yearId);
    setSelectedSectionId('');
    setSelectedSubjectId('');
    setError(null);
  };

  const handleSectionChange = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedSubjectId('');
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Attachment file size must be less than 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        file,
        dataUrl: reader.result as string
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedYearId || !selectedSectionId || !selectedSubjectId) {
      setError('Please select Academic Year, Section, and Subject.');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message for the class.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendGroupMessage({
        academicYearId: selectedYearId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        message: message.trim(),
        title: title.trim() || undefined,
        attachmentUrl: attachment?.dataUrl,
        attachmentName: attachment?.file.name,
        attachmentType: attachment?.file.type,
        attachmentSize: attachment?.file.size,
        allowStudentReplies
      });

      if (res.error) {
        setError(res.error.message || 'Failed to dispatch group message.');
      } else {
        const groupId = res.data?.group_id;
        if (onSuccess && groupId) {
          onSuccess(groupId);
        }
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while sending.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Class / Subject Group Announcement"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* Guided 3-Step Selection */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Target Class Group (Role Authorized)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Step 1: Academic Year */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                1. Academic Year *
              </label>
              <select
                value={selectedYearId}
                onChange={(e) => handleYearChange(e.target.value)}
                required
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select Year...</option>
                {eligibleYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.year_number}th Year ({y.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Section */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                2. Section *
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                disabled={!selectedYearId || eligibleSections.length === 0}
                required
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Select Section...</option>
                {eligibleSections.map(s => (
                  <option key={s.id} value={s.id}>
                    Section {s.name} {s.room_number ? `(${s.room_number})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Subject */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                3. Subject *
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={!selectedSectionId || eligibleSubjects.length === 0}
                required
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Select Subject...</option>
                {eligibleSubjects.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.subject_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-normal">
            Only classes and subjects assigned to you in the official VCTM timetable are selectable.
          </p>
        </div>

        {/* Message Title (Optional) */}
        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1 block">
            Announcement Title (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g., Tomorrow's Class Schedule Update / Assignment Submission"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Message Body */}
        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1 block">
            Message Content *
          </label>
          <textarea
            rows={4}
            placeholder="Write your announcement or instructions for the entire class..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Attachment & Reply Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          {/* File Attachment */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            {attachment ? (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-800 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[160px] font-medium">{attachment.file.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="hover:text-red-600 transition-colors ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 font-medium px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Add Attachment</span>
              </button>
            )}
          </div>

          {/* Student Replies Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowStudentReplies}
              onChange={(e) => setAllowStudentReplies(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-slate-700">
              Allow student replies
            </span>
          </label>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !selectedSubjectId || !message.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Broadcasting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send to Group</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

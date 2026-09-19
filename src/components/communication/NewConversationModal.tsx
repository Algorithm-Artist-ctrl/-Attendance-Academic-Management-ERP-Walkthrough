import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Send, 
  Paperclip, 
  AlertCircle, 
  User, 
  BookOpen, 
  Tag, 
  FileText, 
  Loader2, 
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { 
  Conversation, 
  ConversationCategory, 
  EligibleFacultyForStudent,
  EligibleStudentForFaculty
} from '../../types/database.types';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: Conversation) => void;
}

const CATEGORIES: ConversationCategory[] = [
  'General',
  'Attendance',
  'Timetable',
  'Assignment',
  'Subject',
  'Class',
  'Other'
];

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  onConversationCreated,
}) => {
  const { user } = useAuth();
  const { 
    students, 
    faculty,
    fetchEligibleFacultyForStudent, 
    fetchEligibleStudentsForFaculty,
    getOrCreateConversation,
    sendMessage 
  } = useAcademic();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Student mode options
  const [eligibleFaculty, setEligibleFaculty] = useState<EligibleFacultyForStudent[]>([]);
  const [selectedFacultySubject, setSelectedFacultySubject] = useState<string>('');

  // Faculty mode: deduplicated students & search/filter state
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudentForFaculty[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYearId, setFilterYearId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');

  // Common form fields
  const [category, setCategory] = useState<ConversationCategory>('General');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');

  // Attachment
  const [attachment, setAttachment] = useState<{
    file: File;
    dataUrl: string;
  } | null>(null);

  const role = user?.role;
  const isStudent = role === 'student';

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }

    const loadEligibleContacts = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isStudent) {
          const studentId = user?.student_id || user?.student?.id || (students.find(s => s.id === user?.student?.id || s.roll_number === user?.student?.roll_number)?.id);
          if (studentId) {
            const list = await fetchEligibleFacultyForStudent(studentId);
            setEligibleFaculty(list);
            if (list.length > 0) {
              setSelectedFacultySubject(`${list[0].faculty_id}_${list[0].subject_id}`);
            }
          }
        } else {
          const facultyId = user?.faculty_id || user?.faculty?.id || (faculty.find(f => f.id === user?.faculty_id || f.id === user?.id)?.id);
          if (facultyId) {
            const list = await fetchEligibleStudentsForFaculty(facultyId);
            setEligibleStudents(list);
            if (list.length > 0) {
              setSelectedStudentId(list[0].student_id);
              setSelectedSubjectId(list[0].subjects?.[0]?.id || list[0].subject_id || '');
            }
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load assigned contacts');
      } finally {
        setLoading(false);
      }
    };

    loadEligibleContacts();
  }, [isOpen, isStudent, students, faculty, user, fetchEligibleFacultyForStudent, fetchEligibleStudentsForFaculty]);

  const resetForm = () => {
    setCategory('General');
    setTopic('');
    setMessage('');
    setAttachment(null);
    setError(null);
    setSubmitting(false);
    setSearchQuery('');
    setFilterYearId('');
    setFilterSectionId('');
  };

  // Distinct academic years available to this faculty
  const availableYears = useMemo(() => {
    const map = new Map<string, string>();
    eligibleStudents.forEach(s => {
      if (s.academic_year_id && s.year_name) {
        map.set(s.academic_year_id, s.year_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [eligibleStudents]);

  // Distinct sections available for selected year
  const availableSections = useMemo(() => {
    const map = new Map<string, string>();
    eligibleStudents.forEach(s => {
      if (!filterYearId || s.academic_year_id === filterYearId) {
        if (s.section_id && s.section_name) {
          map.set(s.section_id, s.section_name);
        }
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [eligibleStudents, filterYearId]);

  // Filtered and searched student list
  const displayedStudents = useMemo(() => {
    return eligibleStudents.filter(s => {
      if (filterYearId && s.academic_year_id !== filterYearId) return false;
      if (filterSectionId && s.section_id !== filterSectionId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.student_name.toLowerCase().includes(q);
        const matchRoll = (s.roll_number || s.admission_number || '').toLowerCase().includes(q);
        if (!matchName && !matchRoll) return false;
      }
      return true;
    });
  }, [eligibleStudents, filterYearId, filterSectionId, searchQuery]);

  // Currently selected student object
  const selectedStudent = useMemo(() => {
    return eligibleStudents.find(s => s.student_id === selectedStudentId);
  }, [eligibleStudents, selectedStudentId]);

  // Available subjects for currently selected student
  const availableSubjectsForStudent = useMemo(() => {
    if (!selectedStudent || !selectedStudent.subjects) return [];
    return selectedStudent.subjects;
  }, [selectedStudent]);

  const handleSelectStudent = (student: EligibleStudentForFaculty) => {
    setSelectedStudentId(student.student_id);
    if (student.subjects && student.subjects.length > 0) {
      setSelectedSubjectId(student.subjects[0].id);
    } else {
      setSelectedSubjectId(student.subject_id || '');
    }
    setError(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB');
      return;
    }

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setAttachment({ file, dataUrl });
      setError(null);
    } catch {
      setError('Failed to read selected file');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please type an initial message.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let convRes;

      if (isStudent) {
        if (!selectedFacultySubject) {
          throw new Error('Please select an assigned faculty and subject.');
        }
        const [fId, sId] = selectedFacultySubject.split('_');
        convRes = await getOrCreateConversation({
          facultyId: fId,
          subjectId: sId,
          category,
          topic: topic.trim() || undefined,
        });
      } else {
        if (!selectedStudentId) {
          throw new Error('Please select a student.');
        }
        const fId = user?.faculty_id || user?.faculty?.id || (faculty.find(f => f.id === user?.faculty_id || f.id === user?.id)?.id) || '';
        convRes = await getOrCreateConversation({
          studentId: selectedStudentId,
          facultyId: fId,
          subjectId: selectedSubjectId || undefined,
          category,
          topic: topic.trim() || undefined,
        });
      }

      if (convRes.error || !convRes.data) {
        throw new Error(convRes.error?.message || 'Failed to start conversation.');
      }

      const conversation = convRes.data;

      // Send the initial message
      const msgRes = await sendMessage({
        conversationId: conversation.id,
        message: message.trim(),
        attachmentUrl: attachment?.dataUrl,
        attachmentName: attachment?.file.name,
        attachmentType: attachment?.file.type,
        attachmentSize: attachment?.file.size,
      });

      if (msgRes.error) {
        throw new Error(msgRes.error.message || 'Conversation created but message could not be sent.');
      }

      onConversationCreated(conversation);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#0e1726] border border-emerald-500/25 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/15 bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88]">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {isStudent ? 'Start Discussion with Faculty' : 'Start Direct Discussion with Student'}
              </h2>
              <p className="text-xs text-slate-400">
                {isStudent 
                  ? 'Send a direct academic inquiry or report an issue to your assigned teacher' 
                  : 'Search and message a student enrolled in your assigned sections'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#00ff88] animate-spin" />
              <p className="text-xs text-slate-400">
                {isStudent ? 'Loading your assigned subjects and teachers...' : 'Loading enrolled students from your assigned classes...'}
              </p>
            </div>
          ) : (
            <>
              {/* Recipient Selection */}
              {isStudent ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-2">
                    <User className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span>Assigned Faculty & Subject</span>
                  </label>

                  {eligibleFaculty.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                      No assigned faculty found for your enrolled section and subjects.
                    </div>
                  ) : (
                    <select
                      value={selectedFacultySubject}
                      onChange={(e) => setSelectedFacultySubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/40 border border-emerald-500/30 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#00ff88] transition-colors"
                      required
                    >
                      {eligibleFaculty.map((item) => (
                        <option 
                          key={`${item.faculty_id}_${item.subject_id}`} 
                          value={`${item.faculty_id}_${item.subject_id}`}
                          className="bg-[#0e1726] text-white"
                        >
                          {item.faculty_name} — {item.subject_name} ({item.subject_code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                /* FACULTY VIEW: Searchable, Filtered, Deduplicated Student Selector */
                <div className="space-y-3 p-3.5 bg-slate-900/80 border border-emerald-500/20 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-[#00ff88]" />
                      <span>Select Student (Single Identity)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {displayedStudents.length} {displayedStudents.length === 1 ? 'student' : 'students'} found
                    </span>
                  </div>

                  {/* Filter Bar: Academic Year & Section & Search */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Academic Year Filter */}
                    <div className="relative">
                      <select
                        value={filterYearId}
                        onChange={(e) => {
                          setFilterYearId(e.target.value);
                          setFilterSectionId('');
                        }}
                        className="w-full text-xs bg-slate-950/90 border border-emerald-500/30 text-white rounded-xl px-2.5 py-2 font-medium focus:ring-2 focus:ring-[#00ff88] focus:outline-none transition-all"
                      >
                        <option value="">All Academic Years</option>
                        {availableYears.map(y => (
                          <option key={y.id} value={y.id} className="bg-slate-950 text-white">
                            {y.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Section Filter */}
                    <div className="relative">
                      <select
                        value={filterSectionId}
                        onChange={(e) => setFilterSectionId(e.target.value)}
                        className="w-full text-xs bg-slate-950/90 border border-emerald-500/30 text-white rounded-xl px-2.5 py-2 font-medium focus:ring-2 focus:ring-[#00ff88] focus:outline-none transition-all"
                      >
                        <option value="">All Sections</option>
                        {availableSections.map(s => (
                          <option key={s.id} value={s.id} className="bg-slate-950 text-white">
                            Section {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search student or roll no..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs pl-8 pr-3 py-2 bg-slate-950/90 border border-emerald-500/30 text-white placeholder-slate-500 rounded-xl focus:ring-2 focus:ring-[#00ff88] focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Student List (Deduplicated, scrollable) */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-xl p-1 bg-slate-950/60">
                    {displayedStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No students match your filter or search criteria.
                      </div>
                    ) : (
                      displayedStudents.map((s) => {
                        const isSelected = s.student_id === selectedStudentId;
                        return (
                          <div
                            key={s.student_id}
                            onClick={() => handleSelectStudent(s)}
                            className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs ${
                              isSelected
                                ? 'bg-emerald-500/20 border border-[#00ff88] shadow-[0_0_12px_rgba(0,255,136,0.2)]'
                                : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-emerald-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                isSelected ? 'bg-[#00ff88] text-slate-950' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {s.student_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate flex items-center gap-1.5">
                                  <span>{s.student_name}</span>
                                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88] shrink-0" />}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span className="text-[#00ff88] font-mono font-semibold">
                                    {s.roll_number || s.admission_number || 'Roll N/A'}
                                  </span>
                                  <span>•</span>
                                  <span>{s.year_name || 'Year'}</span>
                                  <span>•</span>
                                  <span>Sec {s.section_name}</span>
                                </div>
                              </div>
                            </div>

                            {/* Subjects count badge */}
                            <div className="text-[10px] text-slate-400 shrink-0 font-medium px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                              {s.subjects && s.subjects.length > 0 
                                ? `${s.subjects.length} assigned ${s.subjects.length === 1 ? 'subject' : 'subjects'}`
                                : 'Class student'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Optional Subject for Selected Student */}
                  {selectedStudent && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                        <span>Subject Context (Optional)</span>
                        <span className="text-[10px] text-[#00ff88]">Optional</span>
                      </label>
                      <select
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950/90 border border-emerald-500/30 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#00ff88] transition-colors"
                      >
                        <option value="" className="bg-slate-950 text-[#00ff88] font-semibold">
                          General Academic Discussion (No specific subject)
                        </option>
                        {availableSubjectsForStudent.map(sub => (
                          <option key={sub.id} value={sub.id} className="bg-slate-950 text-white">
                            {sub.name} {sub.code ? `(${sub.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Category & Topic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-2">
                    <Tag className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span>Inquiry Category</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ConversationCategory)}
                    className="w-full px-3 py-2 bg-slate-950/90 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#00ff88] transition-colors"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#0e1726] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-2">
                    <FileText className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span>Topic / Title (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Unit 3 doubts, Project progress, Attendance query"
                    className="w-full px-3 py-2 bg-slate-950/90 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00ff88] transition-colors"
                  />
                </div>
              </div>

              {/* Initial Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-2">
                  <BookOpen className="w-3.5 h-3.5 text-[#00ff88]" />
                  <span>Message Content *</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your inquiry, instructions, or message clearly..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-slate-950/90 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00ff88] transition-colors resize-none leading-relaxed"
                  required
                />
              </div>

              {/* Attachment Preview */}
              {attachment && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <Paperclip className="w-4 h-4 text-[#00ff88] shrink-0" />
                    <span className="text-xs text-slate-200 truncate">{attachment.file.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      ({(attachment.file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="p-1 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-emerald-500/15">
            <div>
              <label className="cursor-pointer inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors">
                <Paperclip className="w-3.5 h-3.5 text-[#00ff88]" />
                <span>{attachment ? 'Change Attachment' : 'Add Attachment'}</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
              </label>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loading || (isStudent && eligibleFaculty.length === 0) || (!isStudent && !selectedStudentId) || !message.trim()}
                className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#00ff88] hover:bg-[#00e67a] text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-[#00ff88]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Start Discussion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

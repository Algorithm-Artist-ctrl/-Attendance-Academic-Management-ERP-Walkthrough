import React, { useState, useEffect } from 'react';
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
  Trash2
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

  // Faculty mode options
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudentForFaculty[]>([]);
  const [selectedStudentSubject, setSelectedStudentSubject] = useState<string>('');

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
              setSelectedStudentSubject(`${list[0].student_id}_${list[0].subject_id}`);
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
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB');
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
      let facultyId = '';
      let subjectId = '';

      if (isStudent) {
        if (!selectedFacultySubject) {
          throw new Error('Please select an assigned faculty and subject.');
        }
        const [fId, sId] = selectedFacultySubject.split('_');
        facultyId = fId;
        subjectId = sId;
      } else {
        if (!selectedStudentSubject) {
          throw new Error('Please select a student and subject.');
        }
        const [, sId] = selectedStudentSubject.split('_');
        facultyId = user?.faculty_id || user?.faculty?.id || (faculty.find(f => f.id === user?.faculty_id || f.id === user?.id)?.id) || '';
        subjectId = sId;
      }

      // 1. Get or create the conversation
      const convRes = await getOrCreateConversation({
        facultyId,
        subjectId,
        category,
        topic: topic.trim() || undefined,
      });

      if (convRes.error || !convRes.data) {
        throw new Error(convRes.error?.message || 'Failed to start conversation.');
      }

      const conversation = convRes.data;

      // 2. Send the initial message
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
      <div className="relative w-full max-w-xl bg-[#0e1726] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88]">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {isStudent ? 'Start Discussion with Faculty' : 'Start Discussion with Student'}
              </h2>
              <p className="text-xs text-slate-400">
                {isStudent 
                  ? 'Send a direct inquiry or report an issue to your assigned teacher' 
                  : 'Communicate directly with students in your assigned classes'}
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
            <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#00ff88] animate-spin" />
              <p className="text-xs text-slate-400">Loading your assigned subjects and teachers...</p>
            </div>
          ) : (
            <>
              {/* Recipient / Subject Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-[#00ff88]" />
                  <span>{isStudent ? 'Assigned Faculty & Subject' : 'Select Student & Subject'}</span>
                </label>

                {isStudent ? (
                  eligibleFaculty.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                      No assigned faculty found for your enrolled section and subjects.
                    </div>
                  ) : (
                    <select
                      value={selectedFacultySubject}
                      onChange={(e) => setSelectedFacultySubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#00ff88] transition-colors"
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
                  )
                ) : (
                  eligibleStudents.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                      No active students found in your assigned sections.
                    </div>
                  ) : (
                    <select
                      value={selectedStudentSubject}
                      onChange={(e) => setSelectedStudentSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#00ff88] transition-colors"
                      required
                    >
                      {eligibleStudents.map((item) => (
                        <option 
                          key={`${item.student_id}_${item.subject_id}`} 
                          value={`${item.student_id}_${item.subject_id}`}
                          className="bg-[#0e1726] text-white"
                        >
                          {item.student_name} ({item.roll_number || item.admission_number || 'ID'}) — {item.subject_name} ({item.section_name})
                        </option>
                      ))}
                    </select>
                  )
                )}
              </div>

              {/* Category & Topic */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-2">
                    <Tag className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span>Issue Category</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ConversationCategory)}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#00ff88] transition-colors"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#0e1726] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-2">
                    <FileText className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span>Topic / Title (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Attendance on Monday, Unit 2 doubts"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] transition-colors"
                  />
                </div>
              </div>

              {/* Initial Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-2">
                  <BookOpen className="w-3.5 h-3.5 text-[#00ff88]" />
                  <span>Message Content</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question, request, or issue clearly..."
                  rows={4}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] transition-colors resize-none"
                  required
                />
              </div>

              {/* Attachment Preview */}
              {attachment && (
                <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/10 rounded-xl">
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
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div>
              <label className="cursor-pointer inline-flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-colors">
                <Paperclip className="w-4 h-4 text-[#00ff88]" />
                <span>{attachment ? 'Change Attachment' : 'Add Attachment'}</span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loading || (isStudent && eligibleFaculty.length === 0)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#00ff88] text-black font-semibold text-xs tracking-wide shadow-lg shadow-[#00ff88]/20 hover:bg-[#00ff88]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message</span>
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

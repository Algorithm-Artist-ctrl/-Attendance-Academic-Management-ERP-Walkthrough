import React, { useState } from 'react';
import { 
  MessageSquare, 
  Star, 
  Send, 
  CheckCircle2, 
  ShieldCheck, 
  User, 
  BookOpen,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';

import { erpStorage } from '../../lib/storage/erpStorage';

export const FeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const { subjects, faculty, assignments, timetable, students } = useAcademic();
  const student = students.find(s => s.id === user?.student_id || s.id === user?.student?.id || s.roll_number === user?.student?.roll_number || s.id === user?.id) || user?.student;

  const mySectionId = student?.section_id || student?.section?.id;

  // Filter subjects enrolled in student's section
  const enrolledSubjects = React.useMemo(() => {
    if (!mySectionId) return [];
    const sectionSubjectIds = new Set([
      ...assignments.filter(a => a.section_id === mySectionId && a.active !== false).map(a => a.subject_id),
      ...timetable.filter(t => t.section_id === mySectionId && t.active).map(t => t.subject_id)
    ]);
    return subjects.filter(s => sectionSubjectIds.has(s.id));
  }, [subjects, assignments, timetable, mySectionId]);

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');

  // Auto-sync assigned faculty when subject changes
  React.useEffect(() => {
    if (selectedSubjectId) {
      const match = assignments.find(
        a => a.subject_id === selectedSubjectId && a.section_id === mySectionId
      ) || timetable.find(
        t => t.subject_id === selectedSubjectId && t.section_id === mySectionId && t.active
      );

      if (match) {
        setSelectedFacultyId(match.faculty_id);
      } else {
        setSelectedFacultyId('');
      }
    } else {
      setSelectedFacultyId('');
    }
  }, [selectedSubjectId, assignments, timetable, mySectionId]);
  
  // Rating categories (start unrated at 0)
  const [ratingKnowledge, setRatingKnowledge] = useState(0);
  const [ratingClarity, setRatingClarity] = useState(0);
  const [ratingPunctuality, setRatingPunctuality] = useState(0);
  const [ratingDoubtSolving, setRatingDoubtSolving] = useState(0);
  const [suggestions, setSuggestions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedSubjectId) {
      setFormError('Please select an enrolled subject to evaluate.');
      return;
    }
    if (ratingKnowledge === 0 || ratingClarity === 0 || ratingPunctuality === 0 || ratingDoubtSolving === 0) {
      setFormError('Please provide star ratings for all 4 evaluation criteria.');
      return;
    }

    setIsSubmitting(true);
    erpStorage.addAuditLog(
      'FEEDBACK_SUBMITTED',
      'feedback',
      undefined,
      undefined,
      {
        subjectId: selectedSubjectId,
        facultyId: selectedFacultyId,
        ratings: {
          knowledge: ratingKnowledge,
          clarity: ratingClarity,
          punctuality: ratingPunctuality,
          doubtSolving: ratingDoubtSolving
        },
        hasSuggestions: !!suggestions.trim()
      }
    );
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setSuggestions('');
      setSelectedSubjectId('');
      setSelectedFacultyId('');
      setRatingKnowledge(0);
      setRatingClarity(0);
      setRatingPunctuality(0);
      setRatingDoubtSolving(0);
      setTimeout(() => setIsSubmitted(false), 3000);
    }, 800);
  };

  const renderStarRating = (rating: number, setRating: (val: number) => void) => {
    return (
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className="p-1 text-slate-600 hover:text-amber-400 focus:outline-none transition-colors cursor-pointer"
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
              }`}
            />
          </button>
        ))}
        <span className="text-xs font-bold text-[#00ff88] ml-2">
          {rating > 0 ? `${rating} / 5` : <span className="text-slate-500 font-normal">Unrated</span>}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-[#00ff88]" />
            Faculty Evaluation & Course Feedback
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Confidential and 100% anonymous student evaluation for academic quality enhancement
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[#00ff88] text-xs font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>Anonymous Encryption Active</span>
        </div>
      </div>

      {isSubmitted && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
          <span>Thank you! Your feedback has been securely submitted to the Academic Quality Cell.</span>
        </div>
      )}

      {/* Feedback Form */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-emerald-500/20 max-w-3xl">
        {enrolledSubjects.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300">No subjects registered for evaluation</p>
            <p className="text-xs text-slate-500 mt-1">Course evaluations will open when curriculum subjects are enrolled</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
                >
                  <option value="">-- Choose Enrolled Course --</option>
                  {enrolledSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
                  ))}
                </select>
              </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty Professor</label>
              <select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                <option value="">-- Choose Faculty --</option>
                {faculty.map(f => (
                  <option key={f.id} value={f.id}>{f.full_name} ({f.faculty_code || f.designation})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rating Matrix */}
          <div className="space-y-4 pt-2 border-t border-emerald-500/15">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Evaluation Criteria
            </h3>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white">Subject Knowledge & Depth</h4>
                <p className="text-[11px] text-slate-400">Mastery over the curriculum topics and real-world examples</p>
              </div>
              {renderStarRating(ratingKnowledge, setRatingKnowledge)}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white">Lecture Delivery & Communication</h4>
                <p className="text-[11px] text-slate-400">Clarity of explanation, board/slides work, and pace of teaching</p>
              </div>
              {renderStarRating(ratingClarity, setRatingClarity)}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white">Punctuality & Class Engagement</h4>
                <p className="text-[11px] text-slate-400">Regularity of lectures and interactive discussions</p>
              </div>
              {renderStarRating(ratingPunctuality, setRatingPunctuality)}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-white">Doubt Resolution & Helpfulness</h4>
                <p className="text-[11px] text-slate-400">Approachability for student queries and guidance</p>
              </div>
              {renderStarRating(ratingDoubtSolving, setRatingDoubtSolving)}
            </div>
          </div>

          {/* Qualitative comments */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Constructive Suggestions & Comments (Optional)
            </label>
            <textarea
              rows={3}
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              placeholder="Share any suggestions to improve course delivery, practical lab sessions, or study notes..."
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-emerald-500/15">
            <span className="text-[11px] text-slate-400 font-semibold">
              🔒 Student identity is stripped before storing
            </span>
            <Button
              type="submit"
              variant="neon"
              size="md"
              isLoading={isSubmitting}
              rightIcon={<Send className="w-4 h-4 text-slate-950" />}
            >
              Submit Anonymous Review
            </Button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
};

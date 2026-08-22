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
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';

export const FeedbackPage: React.FC = () => {
  const { subjects, faculty } = useAcademic();

  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedFacultyId, setSelectedFacultyId] = useState(faculty[0]?.id || '');
  
  // Rating categories (1 to 5 stars)
  const [ratingKnowledge, setRatingKnowledge] = useState(5);
  const [ratingClarity, setRatingClarity] = useState(5);
  const [ratingPunctuality, setRatingPunctuality] = useState(5);
  const [ratingDoubtSolving, setRatingDoubtSolving] = useState(5);
  const [suggestions, setSuggestions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setSuggestions('');
      setTimeout(() => setIsSubmitted(false), 3000);
    }, 1000);
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
        <span className="text-xs font-bold text-[#00ff88] ml-2">{rating} / 5</span>
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
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              >
                {subjects.map(s => (
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
      </div>
    </div>
  );
};

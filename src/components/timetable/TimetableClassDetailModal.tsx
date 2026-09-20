import React from 'react';
import { 
  X, 
  BookOpen, 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  GraduationCap, 
  Tag, 
  CheckSquare 
} from 'lucide-react';
import { TimetableEntry } from '../../types/database.types';

interface TimetableClassDetailModalProps {
  entry: TimetableEntry | null;
  isOpen: boolean;
  onClose: () => void;
  dayLabel?: string;
  formattedTime?: string;
  periodLabel?: string;
  onTakeAttendance?: (entryId: string) => void;
  isFacultyUser?: boolean;
}

export const TimetableClassDetailModal: React.FC<TimetableClassDetailModalProps> = ({
  entry,
  isOpen,
  onClose,
  dayLabel,
  formattedTime,
  periodLabel,
  onTakeAttendance,
  isFacultyUser = false,
}) => {
  if (!isOpen || !entry) return null;

  const subject = entry.subject;
  const faculty = entry.faculty;
  const section = entry.section;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Subject Code Badge and Close Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-mono font-black bg-[#0f172a] text-white tracking-wider shadow-xs">
                {subject?.subject_code || 'CODE'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                {entry.lecture_type || 'Theory'}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug font-serif-institutional pt-1">
              {subject?.subject_name || 'Class Details'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs">
          {/* Faculty / Instructor */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Faculty Member
            </span>
            <p className="font-bold text-slate-900 text-sm">
              {faculty?.full_name || 'Faculty Member'}
            </p>
            {faculty?.faculty_code && (
              <p className="text-[11px] font-mono text-slate-600 font-medium">
                Code: {faculty.faculty_code}
              </p>
            )}
          </div>

          {/* Section & Class */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              Target Class
            </span>
            <p className="font-bold text-slate-900 text-sm">
              Section {section?.name || 'Assigned'}
            </p>
            <p className="text-[11px] text-slate-600 font-medium">
              Vivekananda College of Tech & Mgmt
            </p>
          </div>

          {/* Time & Period */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Schedule & Timing
            </span>
            <p className="font-bold text-slate-900 text-sm">
              {periodLabel || `Period ${entry.period_number}`}
            </p>
            <p className="text-[11px] font-mono text-slate-700 font-bold">
              {formattedTime || `${entry.start_time} – ${entry.end_time}`}
            </p>
          </div>

          {/* Day & Venue */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Day & Classroom
            </span>
            <p className="font-bold text-slate-900 text-sm">
              {dayLabel || entry.day_of_week}
            </p>
            <p className="text-[11px] text-slate-800 font-bold">
              Room: {entry.room_number || section?.room_number || 'Main Academic Block'}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>

          {isFacultyUser && onTakeAttendance && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onTakeAttendance(entry.id);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0f172a] hover:bg-black rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Take Attendance</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

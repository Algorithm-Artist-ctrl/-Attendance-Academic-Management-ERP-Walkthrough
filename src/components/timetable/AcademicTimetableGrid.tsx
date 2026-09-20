import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Users,
  GraduationCap,
  CheckSquare, 
  ExternalLink,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { DayOfWeek, TimetableEntry } from '../../types/database.types';
import { DEFAULT_INSTITUTIONAL_PERIODS, ACADEMIC_DAYS } from '../../config/academicConfig';
import { getISTDayOfWeek } from '../../lib/utils/dateUtils';
import { useAcademic } from '../../context/AcademicContext';
import { TimetableClassDetailModal } from './TimetableClassDetailModal';
import { clsx } from 'clsx';

export interface AcademicTimetableGridProps {
  entries: TimetableEntry[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  onTakeAttendance?: (entryId: string) => void;
  isFacultyView?: boolean;
  currentFacultyId?: string;
  activeSectionName?: string;
  activeRoomNumber?: string;
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

// Strips trailing seconds (:00) from time strings (e.g. 09:00:00 -> 09:00)
function cleanTime(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return timeStr;
}

export const AcademicTimetableGrid: React.FC<AcademicTimetableGridProps> = ({
  entries,
  isLoading = false,
  emptyTitle = 'No timetable published yet',
  emptySubtitle = 'The weekly academic timetable for this schedule has not been published yet.',
  onTakeAttendance,
  isFacultyView = false,
  currentFacultyId,
  activeSectionName,
  activeRoomNumber,
}) => {
  const { subjects, faculty, sections, semesters, years } = useAcademic();

  // Selected entry for Class Detail Modal (optional deeper detail)
  const [selectedEntry, setSelectedEntry] = useState<TimetableEntry | null>(null);
  const [modalDayLabel, setModalDayLabel] = useState<string>('');
  const [modalTimeLabel, setModalTimeLabel] = useState<string>('');
  const [modalPeriodLabel, setModalPeriodLabel] = useState<string>('');

  // Mobile selected day
  const todayDay = getISTDayOfWeek();
  const defaultDay = (ACADEMIC_DAYS.includes(todayDay as DayOfWeek) ? todayDay : 'MON') as DayOfWeek;
  const [selectedMobileDay, setSelectedMobileDay] = useState<DayOfWeek>(defaultDay);

  // Time slot configurations
  const periodSlots = useMemo(() => {
    return DEFAULT_INSTITUTIONAL_PERIODS.map(p => ({
      period: p.period_number,
      label: p.is_break ? p.name : `Period ${p.period_number}`,
      headerLabel: p.is_break ? 'LUNCH RECESS' : `PERIOD ${p.period_number}`,
      time: `${cleanTime(p.start_time)} – ${cleanTime(p.end_time)}`,
      isLunch: !!p.is_break,
    }));
  }, []);

  // Hydrate selected entry with full relational objects from context if missing
  const fullSelectedEntry = useMemo(() => {
    if (!selectedEntry) return null;
    return {
      ...selectedEntry,
      subject: selectedEntry.subject || subjects.find(s => s.id === selectedEntry.subject_id),
      faculty: selectedEntry.faculty || faculty.find(f => f.id === selectedEntry.faculty_id),
      section: selectedEntry.section || sections.find(s => s.id === selectedEntry.section_id),
    };
  }, [selectedEntry, subjects, faculty, sections]);

  const handleCardClick = (
    entry: TimetableEntry, 
    day: DayOfWeek, 
    periodLabel: string, 
    timeStr: string
  ) => {
    setSelectedEntry(entry);
    setModalDayLabel(DAY_LABELS[day] || day);
    setModalPeriodLabel(periodLabel);
    setModalTimeLabel(timeStr);
  };

  // 1. Loading Skeleton State
  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4 animate-pulse">
        <div className="h-7 bg-slate-200 rounded-xl w-48 mb-6" />
        <div className="grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl border border-slate-200/60" />
          ))}
        </div>
        <div className="grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl border border-slate-200/60" />
          ))}
        </div>
      </div>
    );
  }

  // 2. Empty State
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200/90 shadow-xs space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center mx-auto">
          <Calendar className="w-7 h-7" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] font-serif-institutional">
            {emptyTitle}
          </h3>
          <p className="text-sm text-[#475569] font-medium leading-relaxed">
            {emptySubtitle}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ======================================================== */}
      {/* MOBILE / TABLET VIEW (< lg): Day Selector + Vertical Cards*/}
      {/* ======================================================== */}
      <div className="block lg:hidden space-y-4">
        {/* Day Selector Pill Bar */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-x-auto no-scrollbar">
          {ACADEMIC_DAYS.map(day => {
            const isSelected = selectedMobileDay === day;
            const dayEntriesCount = entries.filter(e => e.day_of_week === day).length;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedMobileDay(day)}
                className={clsx(
                  'px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer touch-target',
                  isSelected
                    ? 'bg-[#0F172A] text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )}
              >
                <span>{DAY_LABELS[day]}</span>
                <span className={clsx("text-[10px] px-1.5 py-0.2 rounded-full font-mono", isSelected ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600")}>
                  {dayEntriesCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Schedule Cards for Selected Mobile Day */}
        <div className="space-y-3">
          {periodSlots.map(slot => {
            // Lunch Break Row
            if (slot.isLunch) {
              return (
                <div
                  key={slot.period}
                  className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-center flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-amber-900 font-bold">{slot.time}</span>
                  <span className="px-3 py-1 rounded-full bg-amber-200/70 text-amber-950 text-[11px] font-bold tracking-wider uppercase font-mono">
                    LUNCH RECESS
                  </span>
                </div>
              );
            }

            const entry = entries.find(
              e => e.day_of_week === selectedMobileDay && e.period_number === slot.period
            );

            // Free Period Row
            if (!entry) {
              return (
                <div
                  key={slot.period}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#334155]">{slot.label}</span>
                    <span className="text-[#475569] font-medium font-mono">({slot.time})</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-medium">Free Period</span>
                </div>
              );
            }

            // Hydrate entry relations
            const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
            const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;
            const sec = sections.find(s => s.id === entry.section_id) || entry.section;
            const sem = semesters.find(s => s.id === sec?.semester_id);
            const yr = years.find(y => y.id === sem?.academic_year_id);
            const sectionFormatted = sec ? `${yr?.name ? `${yr.name} • ` : ''}Section ${sec.name}` : (activeSectionName ? `Section ${activeSectionName}` : 'Assigned Section');

            return (
              <div
                key={slot.period}
                onClick={() => handleCardClick(entry, selectedMobileDay, slot.label, slot.time)}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-slate-400 hover:shadow-xs transition-all space-y-3 cursor-pointer"
              >
                {/* Header: Period, Time, Subject Code, Lecture Type */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-[#0F172A] text-white tracking-wider">
                      {sub?.subject_code || 'CODE'}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#334155]">{slot.time}</span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-700 uppercase tracking-wider">
                    {entry.lecture_type || 'Theory'}
                  </span>
                </div>

                {/* Subject Title (Untruncated) */}
                <div>
                  <h4 className="text-[15px] font-bold text-[#0F172A] tracking-tight leading-snug font-serif-institutional break-words">
                    {sub?.subject_name || 'Class Subject'}
                  </h4>
                </div>

                {/* Footer Info: Faculty or Section, Room, Actions */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs gap-2 flex-wrap">
                  {!isFacultyView ? (
                    <div className="flex items-center gap-1.5 text-[#334155] font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="break-words">{fac?.full_name || 'Unassigned Faculty'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="break-words">{sectionFormatted}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 ml-auto">
                    <div className="flex items-center gap-1 text-slate-800 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{entry.room_number || sec?.room_number || activeRoomNumber || 'Room TBD'}</span>
                    </div>

                    {isFacultyView && onTakeAttendance && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTakeAttendance(entry.id);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-[#0F172A] text-white text-[11px] font-bold hover:bg-black flex items-center gap-1 shadow-2xs cursor-pointer touch-target shrink-0"
                        title="Take Attendance"
                      >
                        <CheckSquare className="w-3 h-3" />
                        <span>Attendance</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* DESKTOP VIEW (>= lg): Sticky Day Column Master Grid       */}
      {/* ======================================================== */}
      <div className="hidden lg:block w-full overflow-x-auto rounded-3xl border border-slate-200/90 bg-white shadow-xs focus:outline-none">
        <table className="w-full text-center border-collapse">
          {/* Header Row: Corner Cell + Periods 1 to 8 */}
          <thead>
            <tr className="sticky top-0 z-20 bg-[#F8FAFC] border-b border-slate-200">
              {/* Corner Cell: Sticky Top-Left */}
              <th className="sticky top-0 left-0 z-30 bg-[#F1F5F9] border-r border-b border-slate-200 min-w-[140px] w-[140px] p-4 text-center text-xs font-black text-[#0F172A] tracking-wider uppercase shadow-xs">
                DAY / PERIOD
              </th>

              {/* Period Headers with 240px-260px minimum width */}
              {periodSlots.map(slot => (
                <th
                  key={slot.period}
                  className={clsx(
                    "p-3.5 border-r border-b border-slate-200 last:border-r-0 min-w-[240px] xl:min-w-[260px]",
                    slot.isLunch ? "bg-amber-50/50 w-[140px] min-w-[140px]" : "bg-[#F8FAFC]"
                  )}
                >
                  <span className="block text-[14px] font-bold text-[#0F172A] tracking-wide">
                    {slot.headerLabel}
                  </span>
                  <span className="block text-[13px] font-semibold text-[#334155] mt-0.5 font-mono">
                    {slot.time}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body Rows: Days (Monday to Saturday) */}
          <tbody className="divide-y divide-slate-100 text-xs">
            {ACADEMIC_DAYS.map(day => (
              <tr key={day} className="hover:bg-slate-50/40 transition-colors">
                {/* Sticky Left Day Column */}
                <td className="sticky left-0 z-10 bg-[#F1F5F9] border-r border-b border-slate-200 p-4 min-w-[140px] w-[140px] text-left border-l-4 border-l-[#0F172A] shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  <div className="space-y-0.5">
                    <span className="block text-[17px] sm:text-[18px] font-bold text-[#0F172A] font-serif-institutional tracking-tight leading-tight">
                      {DAY_LABELS[day]}
                    </span>
                    <span className="block text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      {day}
                    </span>
                  </div>
                </td>

                {/* Period Slot Columns */}
                {periodSlots.map(slot => {
                  // Lunch Break Column
                  if (slot.isLunch) {
                    return (
                      <td
                        key={slot.period}
                        className="p-3 bg-amber-50/40 border-r border-b border-slate-200 text-center align-middle w-[140px] min-w-[140px]"
                      >
                        <div className="flex flex-col items-center justify-center space-y-1.5 py-4">
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold tracking-wider uppercase font-mono border border-amber-200">
                            RECESS
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono font-semibold">
                            {slot.time}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  // Find Timetable Entry for this (Day, Period)
                  const entry = entries.find(
                    e => e.day_of_week === day && e.period_number === slot.period
                  );

                  // Free Slot Cell
                  if (!entry) {
                    return (
                      <td
                        key={slot.period}
                        className="p-3 text-center border-r border-b border-slate-100 text-slate-300 font-mono text-sm align-middle min-w-[240px] xl:min-w-[260px]"
                      >
                        <span className="text-slate-300 font-mono text-sm font-bold select-none">—</span>
                      </td>
                    );
                  }

                  // Hydrate relations
                  const sub = subjects.find(s => s.id === entry.subject_id) || entry.subject;
                  const fac = faculty.find(f => f.id === entry.faculty_id) || entry.faculty;
                  const sec = sections.find(s => s.id === entry.section_id) || entry.section;
                  const sem = semesters.find(s => s.id === sec?.semester_id);
                  const yr = years.find(y => y.id === sem?.academic_year_id);
                  const sectionFormatted = sec ? `${yr?.name ? `${yr.name} • ` : ''}Section ${sec.name}` : (activeSectionName ? `Section ${activeSectionName}` : 'Assigned Section');

                  return (
                    <td
                      key={slot.period}
                      className="p-2.5 border-r border-b border-slate-100 last:border-r-0 align-top min-w-[240px] xl:min-w-[260px]"
                    >
                      <div
                        onClick={() => handleCardClick(entry, day, slot.label, slot.time)}
                        className="group relative p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-400 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 h-full text-left"
                      >
                        {/* Top: Badges */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-[#0F172A] text-white tracking-wider shadow-2xs shrink-0">
                            {sub?.subject_code || 'CODE'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-700 uppercase tracking-wide shrink-0">
                            {entry.lecture_type || 'Theory'}
                          </span>
                        </div>

                        {/* Middle: Subject Name (Untruncated, natural wrap) & Secondary Entity */}
                        <div className="space-y-1.5 flex-1">
                          <h4
                            className="text-[15px] font-bold text-[#0F172A] leading-snug group-hover:text-black transition-colors font-serif-institutional break-words"
                          >
                            {sub?.subject_name || 'Subject Name'}
                          </h4>

                          {/* Student View: Full Faculty Name */}
                          {!isFacultyView && (
                            <div className="text-[13px] font-medium text-[#334155] flex items-center gap-1.5 pt-0.5">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="break-words font-medium">
                                {fac?.full_name || 'Unassigned Faculty'}
                              </span>
                            </div>
                          )}

                          {/* Faculty View: Assigned Section */}
                          {isFacultyView && (
                            <div className="text-[13px] font-semibold text-slate-800 flex items-center gap-1.5 pt-0.5">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="break-words">
                                {sectionFormatted}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Bottom: Divider & Room + Optional Attendance Action */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {entry.room_number || sec?.room_number || activeRoomNumber || 'Room TBD'}
                            </span>
                          </div>

                          {isFacultyView && onTakeAttendance && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTakeAttendance(entry.id);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-[#0F172A] hover:bg-black transition-colors flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                              title="Take Attendance"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span>Attendance</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interactive Class Detail Modal (Optional deep-dive) */}
      <TimetableClassDetailModal
        entry={fullSelectedEntry}
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        dayLabel={modalDayLabel}
        periodLabel={modalPeriodLabel}
        formattedTime={modalTimeLabel}
        onTakeAttendance={onTakeAttendance}
        isFacultyUser={isFacultyView}
      />
    </>
  );
};

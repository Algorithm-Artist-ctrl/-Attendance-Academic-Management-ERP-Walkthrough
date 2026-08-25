import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Calendar, 
  Download, 
  Pin, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Info, 
  Award, 
  Tag, 
  Clock, 
  Sparkles,
  Users,
  Building2,
  Layers
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { supabaseService } from '../../lib/services/supabaseService';
import { supabase } from '../../lib/supabase/supabaseClient';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { NoticeItem } from '../../types/academic.types';
import { clsx } from 'clsx';

export const NoticesPage: React.FC = () => {
  const { user } = useAuth();
  const { students, faculty, sections, departments, assignments, timetable } = useAcademic();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // New Notice Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<NoticeItem['category']>('Academic');
  const [newAuthor, setNewAuthor] = useState(user?.full_name || 'Academic Administration');
  const [newContent, setNewContent] = useState('');
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newTargetScope, setNewTargetScope] = useState<'ALL' | 'STUDENTS' | 'FACULTY' | 'SECTION' | 'DEPARTMENT'>('ALL');
  const [newTargetSectionId, setNewTargetSectionId] = useState<string>('');
  const [newTargetDepartmentId, setNewTargetDepartmentId] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);

  const canPublish = user?.role === 'super_admin' || user?.role === 'hod';

  // Resolved user identities for strict section & role isolation
  const currentStudent = user?.role === 'student' 
    ? (students.find(s => s.id === user.student?.id || s.roll_number === user.student?.roll_number) || user.student)
    : null;
  const currentFaculty = user?.role === 'faculty'
    ? (faculty.find(f => f.id === user.faculty?.id || f.email === user.email) || user.faculty)
    : null;

  const mySectionId = currentStudent?.section_id || currentStudent?.section?.id;
  const mySectionName = currentStudent?.section?.name;
  const mySection = sections.find(s => s.id === mySectionId) || (mySectionName ? sections.find(s => s.name === mySectionName) : undefined);
  const myDepartmentId = currentStudent?.department_id || currentStudent?.department?.id;

  const myAssignedSectionIds = currentFaculty ? new Set([
    ...assignments.filter(a => a.faculty_id === currentFaculty.id && a.active).map(a => a.section_id),
    ...timetable.filter(t => t.faculty_id === currentFaculty.id && t.active).map(t => t.section_id)
  ]) : new Set<string>();

  const loadNotices = async () => {
    setIsLoading(true);
    try {
      const data = await supabaseService.fetchNotices();
      setNotices((data || []) as NoticeItem[]);
    } catch (err) {
      console.error('Error fetching notices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();

    const channel = supabase
      .channel('vctm-notices-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_logs' },
        (payload: any) => {
          if ((payload.new as any)?.action === 'NOTICE_PUBLISHED' || payload.eventType === 'DELETE') {
            loadNotices();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsPublishing(true);
    try {
      let targetAudience = 'ALL';
      let targetSectionId: string | null = null;
      let targetDepartmentId: string | null = null;
      let targetRole: string | null = null;

      if (newTargetScope === 'STUDENTS') {
        targetAudience = 'Students';
        targetRole = 'student';
      } else if (newTargetScope === 'FACULTY') {
        targetAudience = 'Faculty';
        targetRole = 'faculty';
      } else if (newTargetScope === 'SECTION') {
        const sec = sections.find(s => s.id === newTargetSectionId);
        targetAudience = `Section ${sec?.name || 'A'}`;
        targetSectionId = newTargetSectionId || null;
      } else if (newTargetScope === 'DEPARTMENT') {
        const dept = departments.find(d => d.id === newTargetDepartmentId);
        targetAudience = dept?.name || 'Department';
        targetDepartmentId = newTargetDepartmentId || null;
      }

      await supabaseService.publishNotice({
        title: newTitle.trim(),
        category: newCategory,
        author: newAuthor.trim() || user?.full_name || 'Administration',
        content: newContent.trim(),
        isPinned: newIsPinned,
        targetAudience,
        targetSectionId,
        targetDepartmentId,
        targetRole,
        actorId: user?.id,
        actorName: user?.full_name
      });

      setIsModalOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewIsPinned(false);
      setNewTargetScope('ALL');
      setNewTargetSectionId('');
      setNewTargetDepartmentId('');
      await loadNotices();
    } catch (err) {
      console.error('Failed to publish notice:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this official circular?')) return;
    try {
      await supabaseService.deleteNotice(id);
      setNotices(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notice:', err);
    }
  };

  // Strict Section-Wise & Role-Aware Notice Filtering
  const visibleNotices = notices.filter(n => {
    // 1. Super Admin sees all notices
    if (user?.role === 'super_admin') return true;

    // 2. HOD sees notices for their department, sections in their department, or institution-wide
    if (user?.role === 'hod') {
      if (!n.targetDepartmentId && !n.targetSectionId) return true;
      if (n.targetDepartmentId && user.department_id && n.targetDepartmentId !== user.department_id) return false;
      return true;
    }

    // 3. Student filtering (Strict Section & Department boundary)
    if (user?.role === 'student') {
      // Exclude faculty-only notices
      if (n.targetRole === 'faculty' || n.targetAudience === 'Faculty') return false;

      // If notice has a specific targetSectionId, student MUST belong to that section
      if (n.targetSectionId) {
        if (n.targetSectionId !== mySectionId && n.targetSectionId !== mySection?.id) return false;
      }

      // If targetAudience explicitly names a section like "Section A" or "Section B"
      if (n.targetAudience && n.targetAudience.startsWith('Section ')) {
        const targetSecName = n.targetAudience.replace('Section ', '').trim().toUpperCase();
        if (mySection?.name && mySection.name.toUpperCase() !== targetSecName) return false;
      }

      // If notice has targetDepartmentId, student must belong to that department
      if (n.targetDepartmentId && myDepartmentId && n.targetDepartmentId !== myDepartmentId) {
        return false;
      }

      return true;
    }

    // 4. Faculty filtering (Assigned Sections & Department)
    if (user?.role === 'faculty') {
      // If notice has a targetSectionId, faculty must be assigned to that section
      if (n.targetSectionId) {
        if (!myAssignedSectionIds.has(n.targetSectionId)) return false;
      }

      // If targetAudience explicitly names a section
      if (n.targetAudience && n.targetAudience.startsWith('Section ')) {
        const targetSecName = n.targetAudience.replace('Section ', '').trim().toUpperCase();
        const teachesInThisSection = Array.from(myAssignedSectionIds).some(secId => {
          const sec = sections.find(s => s.id === secId);
          return sec?.name?.toUpperCase() === targetSecName;
        });
        if (!teachesInThisSection) return false;
      }

      // If notice has targetDepartmentId, faculty must belong to that department
      if (n.targetDepartmentId && currentFaculty?.department_id && n.targetDepartmentId !== currentFaculty.department_id) {
        return false;
      }

      return true;
    }

    return true;
  });

  // Deduplicate timetable version circulars if not showing archived versions
  const activeNotices = React.useMemo(() => {
    if (showArchived) return visibleNotices;
    const seenSectionTimetable = new Set<string>();
    return visibleNotices.filter(n => {
      if (n.title.startsWith('Official Timetable Updated — Section ')) {
        const secMatch = n.title.match(/Section ([A-Z0-9]+)/i);
        const secKey = secMatch ? secMatch[1].toUpperCase() : 'ALL';
        if (seenSectionTimetable.has(secKey)) {
          return false; // Suppress older superseded version circulars
        }
        seenSectionTimetable.add(secKey);
      }
      return true;
    });
  }, [visibleNotices, showArchived]);

  const archivedCount = visibleNotices.length - activeNotices.length;

  const filteredNotices = activeNotices.filter(n => {
    const matchesSearch = 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || n.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeClass = (cat: NoticeItem['category']) => {
    switch (cat) {
      case 'Urgent': return 'bg-rose-500/15 border-rose-500/30 text-rose-400';
      case 'Examination': return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
      case 'Events': return 'bg-purple-500/15 border-purple-500/30 text-purple-300';
      case 'Holidays': return 'bg-blue-500/15 border-blue-500/30 text-blue-300';
      case 'Academic':
      default:
        return 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-[#00ff88]" />
            Official Notices & Circulars
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Vivekananda College of Technology & Management, Aligarh bulletin board
            {user?.role === 'student' && mySection?.name ? ` • Section ${mySection.name}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canPublish && (
            <Button
              variant="neon"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
            >
              Publish Notice
            </Button>
          )}
        </div>
      </div>

      {/* Category Filter Pills & Search */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search circulars, exams, or notices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        {/* Category Filter Pills & Archive Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold bg-slate-950/80 p-1.5 rounded-2xl border border-emerald-500/20">
            {['ALL', 'Urgent', 'Examination', 'Academic', 'Events', 'Holidays'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={clsx(
                  'px-3 py-1 rounded-xl transition-all cursor-pointer text-[11px]',
                  selectedCategory === cat
                    ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)] font-black'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer',
                showArchived
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
              )}
            >
              {showArchived ? 'Hide Old Versions' : `Show Archived Versions (${archivedCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {filteredNotices.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-emerald-500/20 space-y-2">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-2" />
            <p className="font-bold text-white text-base">
              {user?.role === 'student' ? 'No notices for your section.' : 'No circulars or notices found'}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {user?.role === 'student'
                ? `You are up to date! There are no published notices or circulars for Section ${mySection?.name || 'Assigned'} at this time.`
                : 'There are no published notices matching your active filters.'}
            </p>
          </div>
        ) : (
          filteredNotices.map((n) => (
            <div
              key={n.id}
              className={clsx(
                'glass-panel rounded-3xl p-6 border transition-all space-y-3.5',
                n.isPinned
                  ? 'border-emerald-500/40 bg-slate-950/90 shadow-[0_0_20px_rgba(0,255,136,0.08)]'
                  : 'border-emerald-500/20 hover:border-emerald-500/35'
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {n.isPinned && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#00ff88] bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                  <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-bold border', getCategoryBadgeClass(n.category))}>
                    {n.category}
                  </span>
                  {n.targetAudience && n.targetAudience !== 'ALL' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-emerald-500/30 text-emerald-400">
                      {n.targetAudience}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {n.date}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Issued by: <strong className="text-white">{n.author}</strong>
                  </span>
                  {canPublish && (
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Notice"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                {n.title}
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed">
                {n.content}
              </p>

              {n.attachment && (
                <div className="pt-3 border-t border-emerald-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                    <Download className="w-3.5 h-3.5" />
                    <span>{n.attachment}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => alert(`Downloading official document: ${n.attachment}`)}
                    className="text-xs"
                  >
                    Download PDF
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Publish Notice Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Publish Official Notice"
        description="Publish a verified academic circular to the institutional bulletin board"
      >
        <form onSubmit={handlePublish} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Circular Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Mandatory 75% Attendance Requirement for AKTU Exams"
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              >
                <option value="Academic">Academic</option>
                <option value="Urgent">Urgent</option>
                <option value="Examination">Examination</option>
                <option value="Events">Events</option>
                <option value="Holidays">Holidays</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Author / Office
              </label>
              <input
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="Office of Dean Academics"
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Notice Content <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Enter full announcement details, directives, guidelines..."
              className="w-full p-3 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          {/* Target Audience Scope */}
          <div className="space-y-2 pt-1 border-t border-emerald-500/15">
            <label className="block text-xs font-semibold text-slate-300">
              Notice Target Audience / Scope <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'ALL', label: 'All Institution' },
                { id: 'STUDENTS', label: 'All Students' },
                { id: 'FACULTY', label: 'All Faculty' },
                { id: 'SECTION', label: 'Specific Section' },
              ].map((scope) => (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setNewTargetScope(scope.id as any)}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer',
                    newTargetScope === scope.id
                      ? 'bg-[#00ff88] text-slate-950 border-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.3)]'
                      : 'bg-slate-950/80 border-emerald-500/25 text-slate-300 hover:text-white'
                  )}
                >
                  {scope.label}
                </button>
              ))}
            </div>

            {newTargetScope === 'SECTION' && (
              <div className="animate-in fade-in duration-150 pt-1">
                <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                  Select Target Section
                </label>
                <select
                  value={newTargetSectionId}
                  onChange={(e) => setNewTargetSectionId(e.target.value)}
                  required={newTargetScope === 'SECTION'}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/35 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
                >
                  <option value="">-- Choose Section --</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name} ({sec.room_number || 'Room TBD'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPinnedCheck"
              checked={newIsPinned}
              onChange={(e) => setNewIsPinned(e.target.checked)}
              className="rounded bg-slate-950 border-emerald-500/30 text-[#00ff88] focus:ring-0"
            />
            <label htmlFor="isPinnedCheck" className="text-xs text-slate-300 font-semibold cursor-pointer">
              Pin to Top of Bulletin Board
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-emerald-500/15">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="neon"
              size="sm"
              type="submit"
              isLoading={isPublishing}
            >
              Publish Circular
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

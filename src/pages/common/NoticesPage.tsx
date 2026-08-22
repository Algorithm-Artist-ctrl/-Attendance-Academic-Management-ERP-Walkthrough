import React, { useState } from 'react';
import { 
  Bell, 
  Search, 
  Calendar, 
  Download, 
  Pin, 
  AlertTriangle, 
  Info, 
  Award, 
  Tag,
  Clock,
  Sparkles
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { clsx } from 'clsx';

interface NoticeItem {
  id: string;
  title: string;
  category: 'Academic' | 'Examination' | 'Events' | 'Urgent' | 'Holidays';
  date: string;
  author: string;
  isPinned: boolean;
  content: string;
  attachment?: string;
}

export const NoticesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const notices: NoticeItem[] = [
    {
      id: 'not-01',
      title: 'Mandatory 75% Attendance Requirement for Odd Semester Examinations (AKTU)',
      category: 'Urgent',
      date: '20 Aug 2026',
      author: 'Office of the Dean Academics',
      isPinned: true,
      content: 'All students are strictly informed that as per AKTU ordinances, minimum 75% aggregate attendance is mandatory across all registered subjects to be eligible for the upcoming End Semester Theory and Practical Examinations.',
      attachment: 'AKTU_Attendance_Mandate_Circular.pdf'
    },
    {
      id: 'not-02',
      title: 'AKTU Odd Semester Examination Schedule & Admit Card Distribution',
      category: 'Examination',
      date: '18 Aug 2026',
      author: 'Controller of Examinations',
      isPinned: true,
      content: 'The tentative datesheet for B.Tech 2nd Year (Semester III) examinations has been released on the official portal. Eligible students can collect exam verification slips after clearance.',
      attachment: 'Datesheet_Odd_Sem_2026.pdf'
    },
    {
      id: 'not-03',
      title: 'Annual Technical Symposium & Hackathon "TECH-FEST VCTM 2026"',
      category: 'Events',
      date: '15 Aug 2026',
      author: 'Computer Science Department',
      isPinned: false,
      content: 'The Department of Computer Science & Engineering invites students to register for the 24-hour National Level Hackathon. Exciting cash prizes and internship opportunities await top performers.',
      attachment: 'Hackathon_Rulebook.pdf'
    },
    {
      id: 'not-04',
      title: 'Holiday Notice: College Closed on Account of Raksha Bandhan / Janmashtami',
      category: 'Holidays',
      date: '10 Aug 2026',
      author: 'Registrar Office',
      isPinned: false,
      content: 'The college campus and academic departments will remain closed on upcoming gazetted festival holidays. Normal lecture schedules resume the following working day.',
    },
    {
      id: 'not-05',
      title: 'Guest Lecture on Cloud Infrastructure & Distributed Systems',
      category: 'Academic',
      date: '05 Aug 2026',
      author: 'Training & Placement Cell',
      isPinned: false,
      content: 'An industry session by senior cloud architect on Kubernetes, Microservices, and Cloud Native development is scheduled in the Central Auditorium for 2nd and 3rd year CSE students.',
    },
  ];

  const filteredNotices = notices.filter(n => {
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
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold bg-slate-950/80 p-1.5 rounded-2xl border border-emerald-500/20">
          {['ALL', 'Urgent', 'Examination', 'Academic', 'Events', 'Holidays'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'px-3 py-1.5 rounded-xl transition-all cursor-pointer',
                selectedCategory === cat
                  ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
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

        <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
          {filteredNotices.length} Published Circulars
        </span>
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {filteredNotices.map((n) => (
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
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {n.date}
                </span>
              </div>

              <span className="text-[11px] font-semibold text-slate-400">
                Issued by: <strong className="text-white">{n.author}</strong>
              </span>
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
        ))}
      </div>
    </div>
  );
};

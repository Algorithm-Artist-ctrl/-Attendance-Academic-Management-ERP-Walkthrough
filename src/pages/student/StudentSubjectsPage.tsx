import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Layers, 
  Clock, 
  User, 
  GraduationCap, 
  FileText, 
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { clsx } from 'clsx';

export const StudentSubjectsPage: React.FC = () => {
  const { subjects, faculty, assignments, sections } = useAcademic();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Theory' | 'Practical'>('all');
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  const student = user?.student;

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch = 
      s.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subject_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || s.lecture_type === filterType;
    return matchesSearch && matchesType;
  });

  const getAssignedFaculty = (subjectId: string) => {
    const assignment = assignments.find(a => a.subject_id === subjectId && (student?.section_id ? a.section_id === student.section_id : true));
    if (assignment?.faculty) return assignment.faculty;
    return faculty.find(f => f.department_id === subjects[0]?.department_id) || faculty[0];
  };

  const syllabusModules = [
    { unit: 'Unit I', title: 'Introduction to Data Structures, Arrays & Sparse Matrices', hours: '8 Hours' },
    { unit: 'Unit II', title: 'Stacks, Queues, Recursion & Application Problems', hours: '10 Hours' },
    { unit: 'Unit III', title: 'Linked Lists (Singly, Doubly, Circular) & Pointer Ops', hours: '10 Hours' },
    { unit: 'Unit IV', title: 'Trees, Binary Search Trees, AVL Trees & Heaps', hours: '12 Hours' },
    { unit: 'Unit V', title: 'Graphs, Traversal (BFS/DFS), Minimum Spanning Tree & Shortest Paths', hours: '10 Hours' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#00ff88]" />
            Academic Courses & Curriculum Syllabus
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Registered subjects, course credits, assigned professors, and syllabus modules
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold bg-slate-950/80 p-1.5 rounded-2xl border border-emerald-500/20">
          <button
            onClick={() => setFilterType('all')}
            className={clsx(
              'px-3 py-1.5 rounded-xl transition-all cursor-pointer',
              filterType === 'all'
                ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            All Courses ({subjects.length})
          </button>
          <button
            onClick={() => setFilterType('Theory')}
            className={clsx(
              'px-3 py-1.5 rounded-xl transition-all cursor-pointer',
              filterType === 'Theory'
                ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Theory
          </button>
          <button
            onClick={() => setFilterType('Practical')}
            className={clsx(
              'px-3 py-1.5 rounded-xl transition-all cursor-pointer',
              filterType === 'Practical'
                ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Labs & Practical
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by course code or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>

        <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
          B.Tech CSE • Odd Semester 2026-2027
        </span>
      </div>

      {/* Subjects Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSubjects.map((sub) => {
          const assignedProf = getAssignedFaculty(sub.id);
          const isExpanded = expandedSubjectId === sub.id;

          return (
            <div
              key={sub.id}
              className="glass-panel rounded-3xl p-6 border border-emerald-500/20 hover:border-emerald-500/40 transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                      {sub.subject_code}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900 border border-emerald-500/20 text-slate-300">
                      {sub.lecture_type}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white leading-snug">
                    {sub.subject_name}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xl font-black text-white">{sub.credits}</span>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Credits</span>
                </div>
              </div>

              {/* Faculty & Classroom Box */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-emerald-500/15 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 border border-emerald-500/25 flex items-center justify-center text-[#00ff88] font-bold">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-white font-bold block">{assignedProf?.full_name || 'Faculty Member'}</span>
                    <span className="text-slate-400 text-[11px] block">{assignedProf?.designation || 'Assistant Professor'}</span>
                  </div>
                </div>

                <span className="text-emerald-400 font-mono font-semibold text-[11px]">
                  Room A-007
                </span>
              </div>

              {/* Syllabus Toggle */}
              <div>
                <button
                  onClick={() => setExpandedSubjectId(isExpanded ? null : sub.id)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-[#00ff88] pt-2 border-t border-emerald-500/10 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{isExpanded ? 'Hide Course Syllabus' : 'View Course Units & Topics'}</span>
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2 pt-2 animate-in fade-in">
                    {syllabusModules.map((mod, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/15 text-xs flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="font-mono text-[10px] text-emerald-400 font-bold uppercase">{mod.unit}</span>
                          <p className="text-white font-medium text-[11px]">{mod.title}</p>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px] shrink-0 ml-2">{mod.hours}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

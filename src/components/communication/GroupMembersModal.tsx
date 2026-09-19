import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Search, 
  User, 
  GraduationCap, 
  ChevronRight, 
  Loader2, 
  X,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { GroupMember } from '../../types/database.types';
import { useAcademic } from '../../context/AcademicContext';
import { StudentProfileModal } from '../student/StudentProfileModal';

interface GroupMembersModalProps {
  groupId: string | null;
  groupTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  groupId,
  groupTitle = 'Class Group',
  isOpen,
  onClose
}) => {
  const { fetchGroupMembers } = useAcademic();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Student profile preview state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !groupId) {
      setMembers([]);
      setSearch('');
      setError(null);
      return;
    }

    let isMounted = true;
    const loadMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGroupMembers(groupId);
        if (isMounted) {
          setMembers(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Unable to retrieve group member roster.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, [groupId, isOpen, fetchGroupMembers]);

  const filteredMembers = members.filter(m => 
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  const handleRowClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsProfileOpen(true);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${groupTitle} — Enrolled Members (${members.length})`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Official class roster derived from academic section enrollment. Click any student row to inspect their institutional profile and contact records.
          </p>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs transition-all font-medium"
            />
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Fetching enrolled students...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              {search ? 'No students found matching your search.' : 'No enrolled students found in this section.'}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-96 overflow-y-auto bg-white shadow-xs">
              {filteredMembers.map((student, idx) => (
                <div
                  key={student.id}
                  onClick={() => handleRowClick(student.id)}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-slate-400 w-6 text-right shrink-0">
                      {idx + 1}.
                    </span>

                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                      {student.full_name
                        .split(' ')
                        .map(n => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-black truncate block transition-colors">
                          {student.full_name}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                          (student.status || 'ACTIVE').toUpperCase() === 'ACTIVE' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {(student.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'Enrolled / Active' : (student.status || 'ACTIVE').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                        <span>Roll: {student.roll_number}</span>
                        {student.section_name && (
                          <span>• Sec {student.section_name}</span>
                        )}
                        {student.year_number && (
                          <span>• Year {student.year_number}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-700 shrink-0">
                    <span className="text-[11px] font-medium hidden sm:inline">View Profile</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Embedded Student Profile Modal */}
      <StudentProfileModal
        studentId={selectedStudentId}
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setSelectedStudentId(null);
        }}
      />
    </>
  );
};

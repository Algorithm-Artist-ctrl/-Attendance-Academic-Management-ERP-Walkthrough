import React, { useState } from 'react';
import { History, Calendar, CheckSquare, Users, Search, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

interface AttendanceHistoryProps {
  onTakeAttendance: (timetableEntryId?: string) => void;
}

export const AttendanceHistoryPage: React.FC<AttendanceHistoryProps> = ({ onTakeAttendance }) => {
  const { user } = useAuth();
  const { faculty, attendanceSessions, attendanceRecords } = useAcademic();
  const currentFaculty = faculty.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;
  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';
  const [searchTerm, setSearchTerm] = useState('');

  // Filter sessions marked strictly by current faculty
  const facultySessions = attendanceSessions
    .filter(s => (facultyId ? s.faculty_id === facultyId : false) || user?.role === 'super_admin')
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  const filtered = facultySessions.filter(s =>
    (s.subject?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.subject?.subject_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.session_date.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-[#00ff88]" />
            Lecture Attendance History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Archive of attendance sessions recorded by <span className="text-[#00ff88] font-bold">{currentFaculty?.full_name || user?.full_name}</span>
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search date, code, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No historical attendance sessions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-5 py-3.5">Session Date</th>
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5 text-center">Section</th>
                  <th className="px-5 py-3.5 text-center">Time Slot</th>
                  <th className="px-5 py-3.5 text-center">Tally</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {filtered.map((s) => {
                  const records = attendanceRecords.filter(r => r.attendance_session_id === s.id);
                  const presentCount = records.filter(r => r.status === 'Present').length;
                  const absentCount = records.length - presentCount;

                  return (
                    <tr key={s.id} className="hover:bg-emerald-500/5 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-white text-sm">
                        {s.session_date}
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-400 text-sm">
                        {s.subject?.subject_name}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {s.subject?.subject_code}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-emerald-500/20 text-slate-200">
                          Section {s.section?.name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-slate-300">
                        {s.start_time} - {s.end_time}
                      </td>
                      <td className="px-5 py-4 text-center font-semibold">
                        <span className="text-[#00ff88]">{presentCount} Present</span> /{' '}
                        <span className="text-rose-400">{absentCount} Absent</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                          Committed
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

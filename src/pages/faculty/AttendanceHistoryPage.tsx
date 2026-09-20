import React, { useState } from 'react';
import { History, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';

interface AttendanceHistoryProps {
  onTakeAttendance: (timetableEntryId?: string) => void;
}

export const AttendanceHistoryPage: React.FC<AttendanceHistoryProps> = () => {
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
  const facultySessions = React.useMemo(() => {
    return attendanceSessions
      .filter(s => (facultyId ? s.faculty_id === facultyId : false) || user?.role === 'super_admin')
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
  }, [attendanceSessions, facultyId, user?.role]);

  const filtered = React.useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return facultySessions;
    return facultySessions.filter(s =>
      (s.subject?.subject_name || '').toLowerCase().includes(term) ||
      (s.subject?.subject_code || '').toLowerCase().includes(term) ||
      s.session_date.includes(term)
    );
  }, [facultySessions, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-serif-institutional flex items-center gap-2.5">
            <History className="w-6 h-6 text-slate-900" />
            Lecture Attendance History
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Archive of attendance sessions recorded by <span className="text-slate-900 font-bold">{currentFaculty?.full_name || user?.full_name}</span>
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search date, code, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No historical attendance sessions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-5 py-3.5">Session Date</th>
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5 text-center">Section</th>
                  <th className="px-5 py-3.5 text-center">Time Slot</th>
                  <th className="px-5 py-3.5 text-center">Tally</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const records = attendanceRecords.filter(r => r.attendance_session_id === s.id);
                  const presentCount = records.filter(r => r.status === 'Present').length;
                  const absentCount = records.length - presentCount;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-semibold text-slate-900 text-sm">
                        {s.session_date}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 text-sm">
                        {s.subject?.subject_name}
                        <span className="block text-[11px] text-slate-500 font-mono font-normal">
                          {s.subject?.subject_code}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                          Section {s.section?.name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-slate-600">
                        {s.start_time} - {s.end_time}
                      </td>
                      <td className="px-5 py-4 text-center font-semibold">
                        <span className="text-emerald-700">{presentCount} Present</span> /{' '}
                        <span className="text-rose-700">{absentCount} Absent</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800">
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

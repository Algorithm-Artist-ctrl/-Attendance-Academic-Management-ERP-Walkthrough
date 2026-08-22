import React, { useState } from 'react';
import { History, Calendar, CheckSquare, Users, Search, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { formatDateDisplay } from '../../lib/utils/dateUtils';

interface AttendanceHistoryProps {
  onTakeAttendance: (timetableEntryId?: string) => void;
}

export const AttendanceHistoryPage: React.FC<AttendanceHistoryProps> = ({ onTakeAttendance }) => {
  const { user } = useAuth();
  const { faculty, attendanceSessions, attendanceRecords } = useAcademic();

  const currentFaculty = faculty.find(f => f.id === user?.faculty_id) || faculty[0];
  const [searchTerm, setSearchTerm] = useState('');

  // Filter sessions marked by current faculty or all if admin
  const facultySessions = attendanceSessions
    .filter(s => s.faculty_id === currentFaculty.id || user?.role === 'super_admin')
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  const filtered = facultySessions.filter(s =>
    s.subject?.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.subject?.subject_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.session_date.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance History Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View all recorded attendance sessions and review historical logs
          </p>
        </div>
        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search date, code, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vctm-navy-500"
          />
        </div>
      </div>

      <Card noPadding>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <History className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
            <h4 className="text-sm font-semibold text-slate-700">No Attendance Records</h4>
            <p className="text-xs text-slate-500">No historical sessions match your search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Faculty</th>
                  <th className="px-4 py-3">Students Present</th>
                  <th className="px-4 py-3">Recorded At</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const records = attendanceRecords.filter(r => r.attendance_session_id === s.id);
                  const presentCount = records.filter(r => r.status === 'Present').length;
                  const totalCount = records.length;
                  const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-900 text-xs">
                        {formatDateDisplay(s.session_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">{s.subject?.subject_name}</span>
                        <span className="text-xs text-slate-400 block">{s.subject?.subject_code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-vctm-navy-100 text-vctm-navy-800">
                          Section {s.section?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {s.faculty?.full_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-emerald-600">
                          {presentCount} / {totalCount}
                        </span>{' '}
                        <span className="text-xs text-slate-400">({pct}%)</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {s.marked_at ? new Date(s.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onTakeAttendance(s.timetable_entry_id)}
                        >
                          View / Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

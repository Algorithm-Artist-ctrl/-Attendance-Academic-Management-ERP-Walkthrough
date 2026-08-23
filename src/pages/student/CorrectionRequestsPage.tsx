import React, { useState } from 'react';
import { RotateCcw, Plus, Clock, CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { CorrectionRequestModal } from '../../components/correction/CorrectionRequestModal';

export const CorrectionRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { corrections, attendanceRecords, attendanceSessions } = useAcademic();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const student = user?.student;
  const studentId = student?.id || '';
  const myRequests = corrections.filter(c => c.student_id === studentId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-6 h-6 text-[#00ff88]" />
            Attendance Correction Requests
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Submit and monitor your rectification requests sent to faculty coordinators
          </p>
        </div>

        <Button
          variant="neon"
          size="sm"
          onClick={() => setIsNewModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
        >
          New Correction Request
        </Button>
      </div>

      {/* Requests History List / Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-emerald-500/15 flex items-center justify-between bg-slate-950/40">
          <h3 className="text-sm font-bold text-white tracking-wide">
            Submitted Requests History ({myRequests.length})
          </h3>
          <span className="text-xs text-emerald-400 font-semibold">Real-Time Sync</span>
        </div>

        {myRequests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00ff88] mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No Pending Correction Requests</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              All your recorded lecture attendance is in order. If you were marked absent mistakenly, click "New Correction Request".
            </p>
            <Button
              variant="neon"
              size="sm"
              onClick={() => setIsNewModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="mt-2"
            >
              Request Rectification
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5">Faculty Coordinator</th>
                  <th className="px-5 py-3.5">Student Reason</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Submitted On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {myRequests.map((req) => {
                  const record = attendanceRecords.find(r => r.id === req.attendance_record_id);
                  const session = attendanceSessions.find(s => s.id === record?.attendance_session_id);
                  return (
                    <tr key={req.id} className="hover:bg-emerald-500/5 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-white">
                        {session?.session_date || req.created_at?.split('T')[0] || '—'}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {session?.start_time ? `${session.start_time.substring(0, 5)} – ${session.end_time?.substring(0, 5) || ''}` : 'Class Session'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-400">
                        {session?.subject?.subject_name || 'Subject'}
                      </td>
                      <td className="px-5 py-4 text-slate-300 font-medium">
                        {session?.faculty?.full_name || 'Faculty Coordinator'}
                      </td>
                      <td className="px-5 py-4 text-slate-300 italic max-w-xs truncate">
                        "{req.reason}"
                      </td>
                      <td className="px-5 py-4 text-center">
                        <AttendanceStatusBadge status={req.status} />
                      </td>
                      <td className="px-5 py-4 text-center text-slate-400 font-mono">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Correction Request Stepper Modal */}
      <CorrectionRequestModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
      />
    </div>
  );
};

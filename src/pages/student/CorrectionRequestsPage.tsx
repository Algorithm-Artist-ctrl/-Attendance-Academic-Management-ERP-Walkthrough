import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, Clock, CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { CorrectionRequestModal } from '../../components/correction/CorrectionRequestModal';
import { getClaimWindowStatus, ClaimWindowStatus } from '../../lib/utils/dateUtils';

export const CorrectionRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { corrections, attendanceRecords, attendanceSessions } = useAcademic();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Reactive Claim Window Status (09:00:00 AM - 03:40:00 PM IST)
  const [claimWindowStatus, setClaimWindowStatus] = useState<ClaimWindowStatus>(() => getClaimWindowStatus());

  useEffect(() => {
    const checkStatus = () => {
      setClaimWindowStatus(getClaimWindowStatus());
    };
    const timer = setInterval(checkStatus, 10000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkStatus();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const student = user?.student;
  const studentId = student?.id || '';
  const myRequests = corrections.filter(c => c.student_id === studentId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-serif-institutional tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-6 h-6 text-slate-800" />
            Attendance Correction Requests
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Submit and monitor your rectification requests sent to faculty coordinators
          </p>
        </div>

        <div className="flex items-center gap-3">
          {claimWindowStatus === 'OPEN' ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Claim Window Open (09:00 AM – 03:40 PM IST)
            </span>
          ) : claimWindowStatus === 'BEFORE_WINDOW' ? (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 shadow-xs">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Opens at 09:00 AM IST
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 shadow-xs">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Claim Window Closed (3:40 PM)
            </span>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4 text-white" />}
          >
            New Correction Request
          </Button>
        </div>
      </div>

      {/* Requests History List / Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <h3 className="text-sm font-bold text-slate-900 tracking-wide">
            Submitted Requests History ({myRequests.length})
          </h3>
          <span className="text-xs text-slate-500 font-semibold">Real-Time Sync</span>
        </div>

        {myRequests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">No Pending Correction Requests</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All your recorded lecture attendance is in order. If you were marked absent mistakenly, click "New Correction Request".
            </p>
            <Button
              variant="primary"
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
              <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5">Faculty Coordinator</th>
                  <th className="px-5 py-3.5">Student Reason</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Submitted On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myRequests.map((req) => {
                  const record = attendanceRecords.find(r => r.id === req.attendance_record_id);
                  const session = attendanceSessions.find(s => s.id === record?.attendance_session_id);
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">
                        {session?.session_date || req.created_at?.split('T')[0] || '—'}
                        <span className="block text-[10px] text-slate-500 font-normal">
                          {session?.start_time ? `${session.start_time.substring(0, 5)} – ${session.end_time?.substring(0, 5) || ''}` : 'Class Session'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {session?.subject?.subject_name || 'Subject'}
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-medium">
                        {session?.faculty?.full_name || 'Faculty Coordinator'}
                      </td>
                      <td className="px-5 py-4 text-slate-600 italic max-w-xs truncate">
                        "{req.reason}"
                      </td>
                      <td className="px-5 py-4 text-center">
                        <AttendanceStatusBadge status={req.status} />
                      </td>
                      <td className="px-5 py-4 text-center text-slate-500 font-mono">
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

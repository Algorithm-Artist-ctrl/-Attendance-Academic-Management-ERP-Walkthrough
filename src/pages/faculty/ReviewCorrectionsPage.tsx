import React, { useState } from 'react';
import { 
  RotateCcw, 
  Check, 
  X, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  FileText,
  User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { clsx } from 'clsx';

export const ReviewCorrectionsPage: React.FC = () => {
  const { user } = useAuth();
  const { corrections, reviewCorrectionRequest } = useAcademic();
  const facultyId = user?.faculty?.id || 'fac-hemlata-02';

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingList = corrections.filter(c => c.status === 'pending');
  const approvedList = corrections.filter(c => c.status === 'approved');
  const rejectedList = corrections.filter(c => c.status === 'rejected');

  const currentList = activeTab === 'pending' 
    ? pendingList 
    : activeTab === 'approved' 
    ? approvedList 
    : rejectedList;

  const handleApprove = async (correctionId: string) => {
    setProcessingId(correctionId);
    try {
      await reviewCorrectionRequest({
        correctionId,
        status: 'approved',
        reviewerFacultyId: facultyId,
        reviewRemarks: 'Approved after verification.',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (correctionId: string) => {
    setProcessingId(correctionId);
    try {
      await reviewCorrectionRequest({
        correctionId,
        status: 'rejected',
        reviewerFacultyId: facultyId,
        reviewRemarks: 'Verification failed / record confirmed accurate.',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

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
            Review and adjudicate attendance discrepancy claims submitted by students
          </p>
        </div>
      </div>

      {/* Tabs Row Matching Screen 8 */}
      <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-emerald-500/20 w-fit text-xs font-bold">
        <button
          onClick={() => setActiveTab('pending')}
          className={clsx(
            'px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'pending'
              ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <span>Pending</span>
          <span className={clsx('px-1.5 py-0.2 rounded-full text-[10px]', activeTab === 'pending' ? 'bg-slate-950 text-[#00ff88]' : 'bg-amber-500/20 text-amber-300')}>
            {pendingList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('approved')}
          className={clsx(
            'px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'approved'
              ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <span>Approved</span>
          <span className={clsx('px-1.5 py-0.2 rounded-full text-[10px]', activeTab === 'approved' ? 'bg-slate-950 text-[#00ff88]' : 'bg-emerald-500/20 text-emerald-300')}>
            {approvedList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rejected')}
          className={clsx(
            'px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'rejected'
              ? 'bg-[#00ff88] text-slate-950 shadow-[0_0_15px_rgba(0,255,136,0.35)]'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <span>Rejected</span>
          <span className={clsx('px-1.5 py-0.2 rounded-full text-[10px]', activeTab === 'rejected' ? 'bg-slate-950 text-[#00ff88]' : 'bg-rose-500/20 text-rose-300')}>
            {rejectedList.length}
          </span>
        </button>
      </div>

      {/* Requests Table Matching Screen 8 */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        {currentList.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No {activeTab} correction requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-5 py-3.5">Student Name</th>
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Lecture Time</th>
                  <th className="px-5 py-3.5 text-center">From</th>
                  <th className="px-5 py-3.5 text-center">To</th>
                  <th className="px-5 py-3.5">Reason</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {currentList.map((req) => {
                  const student = req.student;

                  return (
                    <tr key={req.id} className="hover:bg-emerald-500/5 transition-colors">
                      <td className="px-5 py-4 font-bold text-white">
                        {student?.full_name || 'Tarun Kushwah'}
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {student?.roll_number || '2503400100057'}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-bold text-emerald-400">
                        Data Structure
                      </td>

                      <td className="px-5 py-4 font-mono font-semibold text-slate-300">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4 font-mono text-slate-400">
                        10:40 - 11:30
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                          Absent
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
                          {req.requested_status || 'Present'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-300 italic max-w-xs truncate" title={req.reason}>
                        "{req.reason}"
                      </td>

                      <td className="px-5 py-4 text-center">
                        {req.status === 'pending' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={processingId === req.id}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-[#00ff88] border border-emerald-500/30 hover:bg-emerald-500/40 transition-colors cursor-pointer"
                              title="Approve Rectification"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={processingId === req.id}
                              className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/40 transition-colors cursor-pointer"
                              title="Reject Request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <AttendanceStatusBadge status={req.status} size="sm" />
                        )}
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

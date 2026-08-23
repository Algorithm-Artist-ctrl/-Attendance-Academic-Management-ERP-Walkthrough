import React, { useState } from 'react';
import { 
  FileText, 
  Calendar, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  UserCheck, 
  Sparkles 
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

interface LeaveRequest {
  id: string;
  leaveType: 'Medical Leave' | 'Duty Leave (OD)' | 'Casual Leave';
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: 'Pending Mentor' | 'Approved' | 'Rejected';
  appliedAt: string;
  documentName?: string;
}

export const LeaveApplicationPage: React.FC = () => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Application list state
  const storageKey = `vctm_leave_requests_${user?.id || 'guest'}`;
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveRequest['leaveType']>('Medical Leave');
  const [fromDate, setFromDate] = useState('2026-08-25');
  const [toDate, setToDate] = useState('2026-08-26');
  const [reason, setReason] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const newLeave: LeaveRequest = {
        id: `lv-${Date.now().toString().slice(-4)}`,
        leaveType,
        fromDate,
        toDate,
        days: 2,
        reason: reason.trim(),
        status: 'Pending Mentor',
        appliedAt: new Date().toISOString().split('T')[0],
        documentName: fileName || undefined
      };

      setLeaveRequests(prev => {
        const updated = [newLeave, ...prev];
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setIsSubmitting(false);
      setIsModalOpen(false);
      setReason('');
      setFileName(null);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    }, 800);
  };

  const getStatusBadge = (status: LeaveRequest['status']) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">Approved</span>;
      case 'Rejected':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">Rejected</span>;
      case 'Pending Mentor':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">Pending Review</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-[#00ff88]" />
            Student Leave & OD Application Portal
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Submit medical leaves and on-duty permissions for official attendance condonation
          </p>
        </div>

        <Button
          variant="neon"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
        >
          Apply for Leave
        </Button>
      </div>

      {submitSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
          <span>Leave application dispatched to Mentor & HOD for verification!</span>
        </div>
      )}

      {/* Leave Ledger Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        {leaveRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300">No leave applications submitted yet</p>
            <p className="text-xs text-slate-500 mt-1">Submit a medical leave or duty permission (OD) whenever needed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-5 py-3.5">Leave Type</th>
                  <th className="px-5 py-3.5">Duration (From - To)</th>
                  <th className="px-5 py-3.5 text-center">Days</th>
                  <th className="px-5 py-3.5">Reason / Justification</th>
                  <th className="px-5 py-3.5">Supporting Document</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {leaveRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="px-5 py-4 font-bold text-white text-sm">
                      {req.leaveType}
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-emerald-400">
                      {req.fromDate} to {req.toDate}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-white">
                      {req.days} {req.days === 1 ? 'Day' : 'Days'}
                    </td>
                    <td className="px-5 py-4 text-slate-300 italic max-w-xs truncate" title={req.reason}>
                      "{req.reason}"
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">
                      {req.documentName ? `📎 ${req.documentName}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getStatusBadge(req.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit Leave Application"
        description="Formal request routed to Class Coordinator & HOD"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Leave Category</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
            >
              <option value="Medical Leave">Medical Leave (Health / Illness)</option>
              <option value="Duty Leave (OD)">On-Duty Leave (Sports / Hackathon / Events)</option>
              <option value="Casual Leave">Casual Leave (Personal Emergency)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">From Date</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">To Date</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Explanation</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clear purpose of leave..."
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Attach Certificate / Proof (Optional)</label>
            <input
              type="file"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-slate-300 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="neon" size="sm" isLoading={isSubmitting}>Submit Application</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

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
  User,
  Send,
  MessageSquare,
  MapPin,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { clsx } from 'clsx';
import { AttendanceCorrection } from '../../types/database.types';

export const ReviewCorrectionsPage: React.FC = () => {
  const { user, role } = useAuth();
  const { 
    getFacultyCorrectionRequests, 
    corrections, 
    reviewCorrectionRequest,
    attendanceRecords,
    attendanceSessions,
    subjects,
    sections,
    students,
    faculty
  } = useAcademic();

  const currentFaculty = faculty.find(f => f.id === user?.faculty_id || f.id === user?.faculty?.id || f.employee_code === user?.faculty?.employee_code) || user?.faculty;
  const facultyId = currentFaculty?.id || '';

  // Filter requests strictly assigned to this faculty (or all for admin/hod)
  const myClaims = role === 'super_admin' ? corrections : getFacultyCorrectionRequests(facultyId);

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reject Modal State
  const [rejectModalItem, setRejectModalItem] = useState<AttendanceCorrection | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState<string>('Attendance record verified; absence confirmed.');

  const pendingList = myClaims.filter(c => c.status === 'pending');
  const approvedList = myClaims.filter(c => c.status === 'approved');
  const rejectedList = myClaims.filter(c => c.status === 'rejected');

  const currentList = activeTab === 'pending' 
    ? pendingList 
    : activeTab === 'approved' 
    ? approvedList 
    : rejectedList;

  const handleApprove = async (item: AttendanceCorrection) => {
    setProcessingId(item.id);
    setActionError(null);
    try {
      await reviewCorrectionRequest({
        correctionId: item.id,
        status: 'approved',
        reviewerFacultyId: facultyId,
        reviewRemarks: 'Attendance discrepancy verified and rectified in database.',
      });
      setSuccessToast(`Attendance claim for ${item.student?.full_name || 'student'} APPROVED successfully! Record updated to Present.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to approve claim:', err);
      setActionError(err?.message || 'Failed to approve attendance claim in database.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    setProcessingId(rejectModalItem.id);
    setActionError(null);
    try {
      await reviewCorrectionRequest({
        correctionId: rejectModalItem.id,
        status: 'rejected',
        reviewerFacultyId: facultyId,
        reviewRemarks: rejectRemarks.trim() || 'Claim rejected after attendance verification.',
      });
      setSuccessToast(`Attendance claim for ${rejectModalItem.student?.full_name || 'student'} REJECTED.`);
      setRejectModalItem(null);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to reject claim:', err);
      setActionError(err?.message || 'Failed to reject attendance claim in database.');
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
            Student Attendance Claims & Rectifications
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Review and adjudicate attendance claims submitted for your assigned lectures
          </p>
        </div>

        <div className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/25 text-[#00ff88]">
          Reviewer: <strong className="text-white">{currentFaculty?.full_name || user?.full_name || 'Faculty Member'}</strong>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Notification */}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tabs Row */}
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
          <span>Pending Claims</span>
          <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-black', activeTab === 'pending' ? 'bg-slate-950 text-[#00ff88]' : 'bg-amber-500/20 text-amber-300')}>
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
          <span>Approved ({approvedList.length})</span>
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
          <span>Rejected ({rejectedList.length})</span>
        </button>
      </div>

      {/* Claims List Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
        {currentList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00ff88] mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No {activeTab} attendance claims</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {activeTab === 'pending' 
                ? 'All student attendance claims for your classes have been reviewed.' 
                : `No ${activeTab} claims found in this category.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
                <tr>
                  <th className="px-5 py-3.5">Student Details</th>
                  <th className="px-5 py-3.5">Subject & Lecture</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Status Change</th>
                  <th className="px-5 py-3.5">Student Reason</th>
                  <th className="px-5 py-3.5 text-center">Action / Review Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {currentList.map((item) => {
                  const record = item.record || attendanceRecords.find(r => r.id === item.attendance_record_id);
                  const session = attendanceSessions.find(s => s.id === record?.attendance_session_id);
                  const sub = subjects.find(s => s.id === session?.subject_id);
                  const sec = sections.find(s => s.id === session?.section_id);
                  const stud = item.student || students.find(s => s.id === item.student_id);

                  const isProcessing = processingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-emerald-500/5 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-white">
                          {stud?.full_name || 'Student'}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono font-semibold">
                          Roll: {stud?.roll_number} • Sec {sec?.name || stud?.section?.name || 'A'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold text-white">
                          {sub?.subject_name || 'Subject'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {sub?.subject_code} • Room {sec?.room_number || 'A-007'}
                        </div>
                      </td>

                      <td className="px-5 py-4 font-mono">
                        <div className="font-bold text-slate-200">
                          {session?.session_date || '2026-08-22'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {session?.start_time?.substring(0, 5) || '09:00'} – {session?.end_time?.substring(0, 5) || '09:50'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold">
                          <span className="text-rose-400">Absent</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-[#00ff88]">Present</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-300 italic max-w-xs truncate" title={item.reason}>
                        "{item.reason}"
                      </td>

                      <td className="px-5 py-4 text-center">
                        {item.status === 'pending' ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="neon"
                              size="sm"
                              disabled={isProcessing}
                              onClick={() => handleApprove(item)}
                              leftIcon={<Check className="w-3.5 h-3.5 text-slate-950" />}
                              className="text-xs font-bold py-1 px-3"
                            >
                              {isProcessing ? 'Saving...' : 'Approve'}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isProcessing}
                              onClick={() => {
                                setRejectModalItem(item);
                                setRejectRemarks('Attendance record verified; absence confirmed.');
                              }}
                              leftIcon={<X className="w-3.5 h-3.5 text-rose-400" />}
                              className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 py-1 px-3"
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="text-left max-w-xs">
                            <span className={clsx(
                              'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border inline-block mb-1',
                              item.status === 'approved' 
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                            )}>
                              {item.status.toUpperCase()}
                            </span>
                            {item.review_remarks && (
                              <p className="text-[11px] text-slate-400 truncate" title={item.review_remarks}>
                                {item.review_remarks}
                              </p>
                            )}
                          </div>
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

      {/* Reject Remarks Modal */}
      {rejectModalItem && (
        <Modal
          isOpen={true}
          onClose={() => setRejectModalItem(null)}
          title={
            <div className="flex items-center gap-2 text-white">
              <XCircle className="w-5 h-5 text-rose-400" />
              <span>Reject Attendance Claim</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              You are rejecting the claim by <strong>{rejectModalItem.student?.full_name || 'Student'}</strong> (Roll: {rejectModalItem.student?.roll_number}) for lecture on {rejectModalItem.created_at?.split('T')[0]}.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason / Remarks for Rejection
              </label>
              <textarea
                rows={3}
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                className="w-full p-3 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88]"
                placeholder="State why this claim is being rejected..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-emerald-500/15">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectModalItem(null)}
              >
                Cancel
              </Button>
              <Button
                variant="neon"
                size="sm"
                onClick={handleConfirmReject}
                disabled={processingId === rejectModalItem.id}
                className="bg-rose-500 hover:bg-rose-400 text-white border-rose-500"
              >
                {processingId === rejectModalItem.id ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

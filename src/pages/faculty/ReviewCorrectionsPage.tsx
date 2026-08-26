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

  const currentFaculty = faculty.find(
    f => f.id === user?.faculty_id || 
         f.id === user?.faculty?.id || 
         f.id === user?.id ||
         (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
         (user?.full_name && f.full_name.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
         (user?.email && f.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || user?.faculty;
  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || '';

  // Filter requests strictly assigned to this faculty (or department-wide for HOD, or all for admin)
  const myClaims = React.useMemo(() => {
    if (role === 'super_admin') {
      return corrections;
    }
    if (role === 'hod') {
      const deptId = user?.department_id || currentFaculty?.department_id;
      if (!deptId) return corrections;
      return corrections.filter(c => {
        const rec = c.record || attendanceRecords.find(r => r.id === c.attendance_record_id);
        const sess = rec?.session || attendanceSessions.find(s => s.id === rec?.attendance_session_id);
        const sub = sess?.subject || subjects.find(s => s.id === sess?.subject_id);
        const fac = sess?.faculty || faculty.find(f => f.id === sess?.faculty_id);
        return sub?.department_id === deptId || fac?.department_id === deptId || !sub?.department_id;
      });
    }
    return getFacultyCorrectionRequests(facultyId);
  }, [role, user, currentFaculty, corrections, attendanceRecords, attendanceSessions, subjects, faculty, facultyId, getFacultyCorrectionRequests]);

  const reviewerTitle = React.useMemo(() => {
    if (role === 'hod') {
      return `${currentFaculty?.full_name || user?.full_name || 'HOD'} (HOD)`;
    }
    if (role === 'super_admin') {
      return `${user?.full_name || 'Super Admin'} (Admin)`;
    }
    return currentFaculty?.full_name || user?.full_name || 'Faculty Member';
  }, [role, currentFaculty, user]);

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
          Reviewer: <strong className="text-white">{reviewerTitle}</strong>
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

      {/* Claims List Container (Dual-View: Cards on mobile, Table on desktop) */}
      <div>
        {currentList.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center space-y-3 border border-emerald-500/20">
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
          <>
            {/* MOBILE VIEW: Touch-Friendly Claim Cards */}
            <div className="space-y-3 md:hidden">
              {currentList.map((item) => {
                const record = item.record || attendanceRecords.find(r => r.id === item.attendance_record_id);
                const session = attendanceSessions.find(s => s.id === record?.attendance_session_id);
                const sub = subjects.find(s => s.id === session?.subject_id);
                const sec = sections.find(s => s.id === session?.section_id);
                const stud = item.student || students.find(s => s.id === item.student_id);
                const isProcessing = processingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="glass-card rounded-2xl p-4 border border-emerald-500/20 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-black text-emerald-400">{stud?.roll_number}</span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{stud?.full_name || 'Student'}</h4>
                        <span className="text-[10px] text-slate-400">Section {sec?.name || stud?.section?.name || ''}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-950/80 border border-emerald-500/20 shrink-0">
                        <span className="text-rose-400">Absent</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-[#00ff88]">Present</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs pt-2 border-t border-emerald-500/10">
                      <div className="text-white font-semibold">{sub?.subject_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Date: {session?.session_date || item.created_at?.split('T')[0] || '—'} {session?.start_time ? `(${session.start_time.substring(0, 5)} - ${session.end_time?.substring(0, 5) || ''})` : ''}
                      </div>
                      <div className="text-slate-300 italic text-[11px] bg-slate-950/50 p-2 rounded-xl mt-1.5 border border-emerald-500/10">
                        "{item.reason}"
                      </div>
                    </div>

                    {item.status === 'pending' ? (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/10">
                        <Button
                          variant="neon"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleApprove(item)}
                          leftIcon={<Check className="w-3.5 h-3.5 text-slate-950" />}
                          className="touch-target font-black"
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
                          className="touch-target text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-xs">
                        <span className={clsx(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                          item.status === 'approved' 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00ff88]'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                        )}>
                          {item.status.toUpperCase()}
                        </span>
                        {item.review_remarks && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[60%]">
                            {item.review_remarks}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW: Claims List Table */}
            <div className="hidden md:block glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
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
                              Roll: {stud?.roll_number} • Sec {sec?.name || stud?.section?.name || ''}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-bold text-white">
                              {sub?.subject_name || 'Subject'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {sub?.subject_code} {sec?.room_number ? `• Room ${sec.room_number}` : ''}
                            </div>
                          </td>

                          <td className="px-5 py-4 font-mono">
                            <div className="font-bold text-slate-200">
                              {session?.session_date || item.created_at?.split('T')[0] || '—'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {session?.start_time ? `${session.start_time.substring(0, 5)} – ${session.end_time?.substring(0, 5) || ''}` : 'Official Lecture'}
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
                                  className="text-xs font-bold py-1 px-3 touch-target"
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
                                  className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 py-1 px-3 touch-target"
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
            </div>
          </>
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

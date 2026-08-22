import React, { useState } from 'react';
import { RotateCcw, CheckCircle2, XCircle, Clock, Search, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { formatDateDisplay } from '../../lib/utils/dateUtils';
import { AttendanceCorrection } from '../../types/database.types';

export const ReviewCorrectionsPage: React.FC = () => {
  const { user } = useAuth();
  const { faculty, corrections, reviewCorrectionRequest } = useAcademic();

  const currentFaculty = faculty.find(f => f.id === user?.faculty_id) || faculty[0];

  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [selectedCorrection, setSelectedCorrection] = useState<AttendanceCorrection | null>(null);
  const [decisionType, setDecisionType] = useState<'approved' | 'rejected'>('approved');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingList = corrections.filter(c => c.status === 'pending');
  const reviewedList = corrections.filter(c => c.status !== 'pending');

  const openDecisionModal = (correction: AttendanceCorrection, decision: 'approved' | 'rejected') => {
    setSelectedCorrection(correction);
    setDecisionType(decision);
    setReviewRemarks(decision === 'approved' ? 'Verified in classroom' : 'Absence confirmed');
    setIsModalOpen(true);
  };

  const handleConfirmDecision = () => {
    if (!selectedCorrection) return;
    setIsSubmitting(true);
    try {
      reviewCorrectionRequest({
        correctionId: selectedCorrection.id,
        status: decisionType,
        reviewerFacultyId: currentFaculty.id,
        reviewRemarks: reviewRemarks.trim(),
      });
      setIsModalOpen(false);
      setSelectedCorrection(null);
    } catch (err: any) {
      alert(`Error updating correction: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentList = activeTab === 'pending' ? pendingList : reviewedList;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance Correction Requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review and rectify recorded attendance submitted by students with audit trail logging
          </p>
        </div>

        {/* Tab Filter */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'pending' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Pending Review</span>
            {pendingList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {pendingList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reviewed')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'reviewed' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reviewed History ({reviewedList.length})
          </button>
        </div>
      </div>

      {/* Main List */}
      <Card noPadding>
        {currentList.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
            <h4 className="text-sm font-semibold text-slate-700">
              {activeTab === 'pending' ? 'All Caught Up!' : 'No History Yet'}
            </h4>
            <p className="text-xs text-slate-500">
              {activeTab === 'pending' 
                ? 'There are no pending attendance correction requests to review.' 
                : 'No past reviewed requests found.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {currentList.map((c) => (
              <div key={c.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                {/* Left Info */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">
                      {c.student?.full_name}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      Roll No: <strong className="text-slate-800">{c.student?.roll_number}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      Section {c.student?.section?.name}
                    </span>
                    <AttendanceStatusBadge status={c.status} size="sm" />
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                    <span>Subject: <strong className="text-slate-800">{c.record?.session?.subject?.subject_name}</strong></span>
                    <span>•</span>
                    <span>Date: <strong className="text-slate-800">{c.record?.session?.session_date}</strong></span>
                    <span>•</span>
                    <span>Current: <strong className="text-rose-600">{c.record?.status || 'Absent'}</strong> $\rightarrow$ Requested: <strong className="text-emerald-600">{c.requested_status}</strong></span>
                  </div>

                  {/* Student Reason */}
                  <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200/80 mt-2">
                    <span className="font-semibold text-slate-900 block mb-0.5">Student Reason:</span>
                    "{c.reason}"
                  </div>

                  {c.review_remarks && (
                    <div className="text-xs text-slate-500 italic mt-1">
                      Faculty Decision Remark: "{c.review_remarks}" (by {c.reviewer?.full_name || 'Faculty'})
                    </div>
                  )}
                </div>

                {/* Right Actions for Pending */}
                {c.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => openDecisionModal(c, 'rejected')}
                      leftIcon={<XCircle className="w-3.5 h-3.5" />}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => openDecisionModal(c, 'approved')}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Approve & Correct
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Decision Review Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            {decisionType === 'approved' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>
              {decisionType === 'approved' ? 'Approve Attendance Rectification' : 'Reject Correction Request'}
            </span>
          </div>
        }
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant={decisionType === 'approved' ? 'success' : 'danger'}
              onClick={handleConfirmDecision}
              isLoading={isSubmitting}
            >
              {decisionType === 'approved' ? 'Confirm & Update Record' : 'Confirm Rejection'}
            </Button>
          </>
        }
      >
        {selectedCorrection && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              You are about to {decisionType === 'approved' ? 'APPROVE' : 'REJECT'} the attendance correction request for{' '}
              <strong className="text-slate-900">{selectedCorrection.student?.full_name}</strong> (Roll: {selectedCorrection.student?.roll_number}).
            </p>

            {decisionType === 'approved' && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                <strong>Database Effect:</strong> This student's attendance record for <strong>{selectedCorrection.record?.session?.subject?.subject_name}</strong> on {selectedCorrection.record?.session?.session_date} will be changed from <strong>Absent</strong> to <strong>Present</strong>, recalculating their attendance percentage automatically.
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Faculty Review Remark (Audit Log):
              </label>
              <textarea
                rows={2}
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-vctm-navy-500"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

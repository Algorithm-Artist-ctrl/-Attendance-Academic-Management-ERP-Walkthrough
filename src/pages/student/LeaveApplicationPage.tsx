import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Calendar, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  UserCheck, 
  Sparkles,
  Download,
  ShieldCheck,
  Building,
  User,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { supabaseService } from '../../lib/services/supabaseService';
import { supabase } from '../../lib/supabase/supabaseClient';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { generateApprovedLeavePdf } from '../../lib/utils/leavePdfGenerator';
import { LeaveApplication, LeaveType, LeaveStatus } from '../../types/database.types';

export const LeaveApplicationPage: React.FC = () => {
  const { user } = useAuth();
  const { refreshLeaveApplications, notifications, markNotificationAsRead } = useAcademic();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Student Relational Metadata
  const [hierarchyData, setHierarchyData] = useState<{
    coordinator?: { id: string; name: string; designation?: string; email?: string } | null;
    hod?: { id: string; name: string; designation?: string; email?: string } | null;
    sectionName?: string;
    yearName?: string;
    departmentName?: string;
  }>({});

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>('Medical Leave');
  const [fromDate, setFromDate] = useState(() => getISTTodayDate());
  const [toDate, setToDate] = useState(() => getISTTodayDate());
  const [reason, setReason] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Resolved student ID
  const studentId = useMemo(() => {
    return user?.student_id || user?.student?.id || (user?.role === 'student' ? user?.id : null);
  }, [user]);

  // Compute number of days between fromDate and toDate
  const calculatedDays = useMemo(() => {
    if (!fromDate || !toDate) return 1;
    const start = new Date(fromDate).getTime();
    const end = new Date(toDate).getTime();
    if (isNaN(start) || isNaN(end)) return 1;
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [fromDate, toDate]);

  // Fetch applications & hierarchy info
  const loadApplications = useCallback(async (showLoading = true) => {
    if (!studentId) return;
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [apps, meta] = await Promise.all([
        supabaseService.fetchStudentLeaveApplications(studentId),
        supabaseService.resolveStudentCoordinatorAndHOD(studentId)
      ]);
      setLeaveApplications(apps);
      setHierarchyData(meta);
    } catch (err) {
      console.error('Failed to load leave applications:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadApplications(true);
  }, [loadApplications]);

  // Real-time listener for leave applications
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`student_leaves_${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_applications',
          filter: `student_id=eq.${studentId}`
        },
        () => {
          loadApplications(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, loadApplications]);

  // Acknowledge/clear unread leave notifications when student views this page
  useEffect(() => {
    const unreadLeaveNotifs = notifications.filter(
      n => !n.is_read && (n.type?.startsWith('LEAVE_') || n.reference_type === 'leave_application')
    );
    for (const notif of unreadLeaveNotifs) {
      markNotificationAsRead(notif.id);
    }
  }, [notifications, markNotificationAsRead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setSubmitError('Please enter a clear reason for your leave request.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await supabaseService.submitLeaveApplication({
      leaveType,
      fromDate,
      toDate,
      numberOfDays: calculatedDays,
      reason: reason.trim(),
      attachmentName: fileName || null
    });

    setIsSubmitting(false);

    if (!result.success) {
      setSubmitError(result.error || 'Failed to submit leave application.');
      return;
    }

    setIsModalOpen(false);
    setReason('');
    setFileName(null);
    setSubmitSuccess(`Leave application ${result.data?.application_number || ''} submitted and routed to your Class Coordinator!`);
    setTimeout(() => setSubmitSuccess(null), 5000);
    loadApplications(false);
    refreshLeaveApplications();
  };

  const handleDownloadPdf = (app: LeaveApplication) => {
    if (app.status !== 'APPROVED') {
      console.warn('Cannot download PDF: leave application is not approved yet.');
      return;
    }
    generateApprovedLeavePdf({
      application: app,
      studentName: app.student?.full_name || user?.full_name || 'Student',
      rollNumber: app.student?.roll_number || (user as any)?.roll_number || user?.student?.roll_number || 'N/A',
      departmentName: app.department?.name || hierarchyData.departmentName || 'Computer Science & Engineering',
      yearName: app.academic_year?.name || hierarchyData.yearName || 'Academic Year',
      sectionName: app.section?.name || hierarchyData.sectionName || 'A',
      coordinatorName: app.coordinator_approver?.full_name || app.coordinator?.full_name || hierarchyData.coordinator?.name || 'Class Coordinator',
      coordinatorDesignation: app.coordinator_approver?.designation || app.coordinator?.designation || hierarchyData.coordinator?.designation || 'Class Coordinator',
      hodName: app.hod_approver?.full_name || app.hod?.full_name || hierarchyData.hod?.name || 'Head of Department',
      hodDesignation: app.hod_approver?.designation || app.hod?.designation || hierarchyData.hod?.designation || 'Associate Professor & HOD'
    });
  };

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case 'PENDING_HOD':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Pending HOD Review
          </span>
        );
      case 'PENDING_COORDINATOR':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Coordinator Review
          </span>
        );
      case 'REJECTED_BY_COORDINATOR':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1.5 shadow-xs" title="Rejected by Class Coordinator">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>
        );
      case 'REJECTED_BY_HOD':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1.5 shadow-xs" title="Rejected by Head of Department">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-serif-institutional tracking-tight">
                Student Leave & OD Application Portal
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Two-tier institutional approval workflow: Class Coordinator ➔ Head of Department
              </p>
            </div>
          </div>

          {/* Academic Scoping Details */}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
            <div className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-1.5 font-medium">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Coordinator: <strong className="text-slate-900">{hierarchyData.coordinator?.name || 'Assigned Coordinator'}</strong></span>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-1.5 font-medium">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              <span>HOD: <strong className="text-slate-900">{hierarchyData.hod?.name || 'Head of Department'}</strong></span>
            </div>
            {hierarchyData.sectionName && (
              <div className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium">
                Section: <strong className="text-slate-900">{hierarchyData.sectionName}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadApplications(false)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSubmitError(null);
              setIsModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4 text-white" />}
          >
            Apply for Leave
          </Button>
        </div>
      </div>

      {submitSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {/* Applications List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Submitted Applications ({leaveApplications.length})
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Real-time sync active</span>
        </div>

        {isLoading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center text-slate-500 space-y-3 shadow-xs">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-700" />
            <p className="text-xs font-medium">Loading your leave records from database...</p>
          </div>
        ) : leaveApplications.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500 shadow-xs">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="font-bold text-slate-900">No leave applications submitted yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Submit a medical leave or duty permission (OD) whenever needed. Requests are automatically dispatched to your Class Coordinator for approval.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-5"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4 text-white" />}
            >
              Submit First Application
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {leaveApplications.map((app) => {
              const isApproved = app.status === 'APPROVED';
              const isRejected = app.status.startsWith('REJECTED');
              const isPendingHod = app.status === 'PENDING_HOD';
              const isPendingCoord = app.status === 'PENDING_COORDINATOR';

              return (
                <div 
                  key={app.id} 
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 hover:border-slate-300 transition-all space-y-5 shadow-xs"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                          {app.application_number}
                        </span>
                        <span className="font-black text-slate-900 text-base">
                          {app.leave_type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Submitted on: {new Date(app.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(app.status)}
                      
                      {isApproved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPdf(app)}
                          leftIcon={<Download className="w-3.5 h-3.5 text-slate-700" />}
                          className="shadow-xs text-slate-800"
                        >
                          Download Approved PDF
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Core Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-slate-500 font-semibold block text-[11px]">Period of Absence</span>
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        {new Date(app.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="text-slate-400 mx-1.5">➔</span>
                        {new Date(app.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <span className="text-[11px] text-slate-700 font-semibold">
                        Total: {app.number_of_days} Day(s)
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 md:col-span-2">
                      <span className="text-slate-500 font-semibold block text-[11px]">Purpose / Explanation</span>
                      <p className="text-slate-700 italic leading-relaxed">
                        "{app.reason}"
                      </p>
                      {app.attachment_name && (
                        <span className="inline-block text-[11px] text-slate-500 font-mono mt-1">
                          📎 Attached document: {app.attachment_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-Stage Visual Timeline */}
                  <div className="pt-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Application Review Timeline
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Step 1: Submission */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            1. Application Submitted
                          </span>
                          <span className="text-[10px] text-slate-500">Completed</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Dispatched to Class Coordinator
                        </p>
                      </div>

                      {/* Step 2: Class Coordinator */}
                      <div className={`p-3.5 rounded-2xl border space-y-1 ${
                        isPendingCoord
                          ? 'bg-amber-50 border-amber-200'
                          : app.status === 'REJECTED_BY_COORDINATOR'
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={`flex items-center gap-1.5 ${
                            isPendingCoord 
                              ? 'text-amber-800' 
                              : app.status === 'REJECTED_BY_COORDINATOR' 
                              ? 'text-rose-700' 
                              : 'text-slate-900'
                          }`}>
                            {isPendingCoord && <Clock className="w-4 h-4 text-amber-600 animate-spin" />}
                            {app.status === 'REJECTED_BY_COORDINATOR' && <XCircle className="w-4 h-4 text-rose-600" />}
                            {!isPendingCoord && app.status !== 'REJECTED_BY_COORDINATOR' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            2. Class Coordinator
                          </span>
                          <span className="text-[10px] font-mono">
                            {isPendingCoord ? 'Pending' : app.status === 'REJECTED_BY_COORDINATOR' ? 'Rejected' : 'Approved ✓'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 font-medium">
                          {app.coordinator_approver?.full_name || app.coordinator?.full_name || hierarchyData.coordinator?.name || 'Class Coordinator'}
                        </p>
                        {app.coordinator_approved_at && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            {new Date(app.coordinator_approved_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {app.status === 'REJECTED_BY_COORDINATOR' && app.rejection_reason && (
                          <p className="text-[11px] text-rose-700 font-semibold mt-1">
                            Reason: {app.rejection_reason}
                          </p>
                        )}
                      </div>

                      {/* Step 3: HOD Review */}
                      <div className={`p-3.5 rounded-2xl border space-y-1 ${
                        isApproved
                          ? 'bg-slate-50 border-slate-200'
                          : isPendingHod
                          ? 'bg-blue-50 border-blue-200'
                          : app.status === 'REJECTED_BY_HOD'
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-slate-50/50 border-slate-100 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={`flex items-center gap-1.5 ${
                            isApproved
                              ? 'text-slate-900'
                              : isPendingHod
                              ? 'text-blue-700'
                              : app.status === 'REJECTED_BY_HOD'
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }`}>
                            {isApproved && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            {isPendingHod && <Clock className="w-4 h-4 text-blue-600 animate-spin" />}
                            {app.status === 'REJECTED_BY_HOD' && <XCircle className="w-4 h-4 text-rose-600" />}
                            {!isApproved && !isPendingHod && app.status !== 'REJECTED_BY_HOD' && <ShieldCheck className="w-4 h-4 text-slate-400" />}
                            3. Head of Department
                          </span>
                          <span className="text-[10px] font-mono">
                            {isApproved ? 'Approved ✓' : isPendingHod ? 'Pending' : app.status === 'REJECTED_BY_HOD' ? 'Rejected' : 'Waiting'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 font-medium">
                          {app.hod_approver?.full_name || app.hod?.full_name || hierarchyData.hod?.name || 'Head of Department'}
                        </p>
                        {app.hod_approved_at && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            {new Date(app.hod_approved_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {app.status === 'REJECTED_BY_HOD' && app.rejection_reason && (
                          <p className="text-[11px] text-rose-700 font-semibold mt-1">
                            Reason: {app.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Submit Leave Application"
        description="Formal multi-tier application routed to Class Coordinator and HOD"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Category</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              <option value="Medical Leave">Medical Leave (Health / Illness)</option>
              <option value="Duty Leave (OD)">On-Duty Leave (Sports / Hackathon / College Events)</option>
              <option value="Casual Leave">Casual Leave (Personal Emergency)</option>
              <option value="Semester Break">Semester Break / Special Academic Leave</option>
              <option value="Other">Other Academic Absence</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">From Date</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">To Date</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
            <span>Calculated Duration:</span>
            <strong className="text-slate-900 font-mono text-sm">{calculatedDays} Day(s)</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Purpose of Leave</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clear purpose of leave (e.g., severe viral fever with doctor advised rest)..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supporting Document / Certificate (Optional)</label>
            <input
              type="file"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
            />
          </div>

          {/* Workflow Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-900 block">Approval Hierarchy Routing:</span>
            <p className="leading-relaxed">
              Your request will be routed to Class Coordinator <strong>{hierarchyData.coordinator?.name || 'Assigned Coordinator'}</strong>, and upon their recommendation, will be forwarded to HOD <strong>{hierarchyData.hod?.name || 'Head of Department'}</strong> for final sanction.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

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
import { supabaseService } from '../../lib/services/supabaseService';
import { supabase } from '../../lib/supabase/supabaseClient';
import { getISTTodayDate } from '../../lib/utils/dateUtils';
import { generateApprovedLeavePdf } from '../../lib/utils/leavePdfGenerator';
import { LeaveApplication, LeaveType, LeaveStatus } from '../../types/database.types';

export const LeaveApplicationPage: React.FC = () => {
  const { user } = useAuth();
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
  };

  const handleDownloadPdf = (app: LeaveApplication) => {
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
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88] flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
            APPROVED
          </span>
        );
      case 'PENDING_HOD':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            PENDING HOD
          </span>
        );
      case 'PENDING_COORDINATOR':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            PENDING COORDINATOR
          </span>
        );
      case 'REJECTED_BY_COORDINATOR':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-1.5 shadow-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            REJECTED BY COORDINATOR
          </span>
        );
      case 'REJECTED_BY_HOD':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-1.5 shadow-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            REJECTED BY HOD
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Student Leave & OD Application Portal
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Two-tier institutional approval workflow: Class Coordinator ➔ Head of Department
              </p>
            </div>
          </div>

          {/* Academic Scoping Details */}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
            <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#00ff88]" />
              <span>Coordinator: <strong className="text-white">{hierarchyData.coordinator?.name || 'Assigned Coordinator'}</strong></span>
            </div>
            <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-cyan-400" />
              <span>HOD: <strong className="text-white">{hierarchyData.hod?.name || 'Head of Department'}</strong></span>
            </div>
            {hierarchyData.sectionName && (
              <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300">
                Section: <strong className="text-emerald-400">{hierarchyData.sectionName}</strong>
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
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-400" />}
          >
            Refresh
          </Button>

          <Button
            variant="neon"
            size="sm"
            onClick={() => {
              setSubmitError(null);
              setIsModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
          >
            Apply for Leave
          </Button>
        </div>
      </div>

      {submitSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-[#00ff88] shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {/* Applications List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Submitted Applications ({leaveApplications.length})
          </h2>
          <span className="text-[11px] text-slate-500">Real-time sync active</span>
        </div>

        {isLoading ? (
          <div className="glass-panel p-12 rounded-3xl border border-emerald-500/15 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
            <p className="text-xs font-medium">Loading your leave records from database...</p>
          </div>
        ) : leaveApplications.length === 0 ? (
          <div className="glass-panel rounded-3xl border border-emerald-500/15 p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-bold text-slate-200">No leave applications submitted yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Submit a medical leave or duty permission (OD) whenever needed. Requests are automatically dispatched to your Class Coordinator for approval.
            </p>
            <Button
              variant="neon"
              size="sm"
              className="mt-5"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4 text-slate-950" />}
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
                  className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/20 bg-slate-900/70 hover:border-emerald-500/40 transition-all space-y-5 shadow-lg"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/25">
                          {app.application_number}
                        </span>
                        <span className="font-black text-white text-base">
                          {app.leave_type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Submitted on: {new Date(app.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(app.status)}
                      
                      {isApproved && (
                        <Button
                          variant="neon"
                          size="sm"
                          onClick={() => handleDownloadPdf(app)}
                          leftIcon={<Download className="w-3.5 h-3.5 text-slate-950" />}
                          className="shadow-sm"
                        >
                          Download Approved PDF
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Core Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                      <span className="text-slate-400 font-semibold block text-[11px]">Period of Absence</span>
                      <div className="font-mono font-bold text-white text-sm">
                        {new Date(app.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="text-slate-500 mx-1.5">➔</span>
                        {new Date(app.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <span className="text-[11px] text-emerald-400 font-semibold">
                        Total: {app.number_of_days} Day(s)
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1 md:col-span-2">
                      <span className="text-slate-400 font-semibold block text-[11px]">Purpose / Explanation</span>
                      <p className="text-slate-200 italic leading-relaxed">
                        "{app.reason}"
                      </p>
                      {app.attachment_name && (
                        <span className="inline-block text-[11px] text-slate-400 font-mono mt-1">
                          📎 Attached document: {app.attachment_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-Stage Visual Timeline */}
                  <div className="pt-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                      Application Review Timeline
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Step 1: Submission */}
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-emerald-500/30 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
                            1. Application Submitted
                          </span>
                          <span className="text-[10px] text-slate-400">Completed</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Dispatched to Class Coordinator
                        </p>
                      </div>

                      {/* Step 2: Class Coordinator */}
                      <div className={`p-3.5 rounded-2xl border space-y-1 ${
                        isPendingCoord
                          ? 'bg-amber-500/10 border-amber-500/40'
                          : app.status === 'REJECTED_BY_COORDINATOR'
                          ? 'bg-rose-500/10 border-rose-500/40'
                          : 'bg-slate-950/70 border-emerald-500/30'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={`flex items-center gap-1.5 ${
                            isPendingCoord 
                              ? 'text-amber-300' 
                              : app.status === 'REJECTED_BY_COORDINATOR' 
                              ? 'text-rose-400' 
                              : 'text-emerald-400'
                          }`}>
                            {isPendingCoord && <Clock className="w-4 h-4 text-amber-400 animate-spin" />}
                            {app.status === 'REJECTED_BY_COORDINATOR' && <XCircle className="w-4 h-4 text-rose-400" />}
                            {!isPendingCoord && app.status !== 'REJECTED_BY_COORDINATOR' && <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />}
                            2. Class Coordinator
                          </span>
                          <span className="text-[10px] font-mono">
                            {isPendingCoord ? 'Pending' : app.status === 'REJECTED_BY_COORDINATOR' ? 'Rejected' : 'Approved ✓'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {app.coordinator_approver?.full_name || app.coordinator?.full_name || hierarchyData.coordinator?.name || 'Class Coordinator'}
                        </p>
                        {app.coordinator_approved_at && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            {new Date(app.coordinator_approved_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {app.status === 'REJECTED_BY_COORDINATOR' && app.rejection_reason && (
                          <p className="text-[11px] text-rose-300 font-semibold mt-1">
                            Reason: {app.rejection_reason}
                          </p>
                        )}
                      </div>

                      {/* Step 3: HOD Review */}
                      <div className={`p-3.5 rounded-2xl border space-y-1 ${
                        isApproved
                          ? 'bg-slate-950/70 border-emerald-500/30'
                          : isPendingHod
                          ? 'bg-cyan-500/10 border-cyan-500/40'
                          : app.status === 'REJECTED_BY_HOD'
                          ? 'bg-rose-500/10 border-rose-500/40'
                          : 'bg-slate-950/40 border-slate-800 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={`flex items-center gap-1.5 ${
                            isApproved
                              ? 'text-emerald-400'
                              : isPendingHod
                              ? 'text-cyan-300'
                              : app.status === 'REJECTED_BY_HOD'
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}>
                            {isApproved && <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />}
                            {isPendingHod && <Clock className="w-4 h-4 text-cyan-400 animate-spin" />}
                            {app.status === 'REJECTED_BY_HOD' && <XCircle className="w-4 h-4 text-rose-400" />}
                            {!isApproved && !isPendingHod && app.status !== 'REJECTED_BY_HOD' && <ShieldCheck className="w-4 h-4 text-slate-500" />}
                            3. Head of Department
                          </span>
                          <span className="text-[10px] font-mono">
                            {isApproved ? 'Approved ✓' : isPendingHod ? 'Pending' : app.status === 'REJECTED_BY_HOD' ? 'Rejected' : 'Waiting'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {app.hod_approver?.full_name || app.hod?.full_name || hierarchyData.hod?.name || 'Head of Department'}
                        </p>
                        {app.hod_approved_at && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            {new Date(app.hod_approved_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {app.status === 'REJECTED_BY_HOD' && app.rejection_reason && (
                          <p className="text-[11px] text-rose-300 font-semibold mt-1">
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
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Leave Category</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-[#00ff88]"
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

          <div className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span>Calculated Duration:</span>
            <strong className="text-emerald-400 font-mono text-sm">{calculatedDays} Day(s)</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Purpose of Leave</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clear purpose of leave (e.g., severe viral fever with doctor advised rest)..."
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Supporting Document / Certificate (Optional)</label>
            <input
              type="file"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-slate-300 focus:outline-none"
            />
          </div>

          {/* Workflow Notice */}
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-slate-300 space-y-1">
            <span className="font-bold text-[#00ff88] block">Approval Hierarchy Routing:</span>
            <p className="leading-relaxed">
              Your request will be routed to Class Coordinator <strong>{hierarchyData.coordinator?.name || 'Assigned Coordinator'}</strong>, and upon their recommendation, will be forwarded to HOD <strong>{hierarchyData.hod?.name || 'Head of Department'}</strong> for final sanction.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-emerald-500/15">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="neon" size="sm" isLoading={isSubmitting}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

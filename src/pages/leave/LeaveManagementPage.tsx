import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  Search,
  Filter,
  Download,
  XCircle,
  Eye,
  Building,
  User,
  ShieldCheck,
  RefreshCw,
  Send,
  Layers
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { supabaseService } from '../../lib/services/supabaseService';
import { supabase } from '../../lib/supabase/supabaseClient';
import { generateApprovedLeavePdf } from '../../lib/utils/leavePdfGenerator';
import { LeaveApplication, LeaveStatus, Section, AcademicYear } from '../../types/database.types';

export const LeaveManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    sections, 
    departments, 
    programs,
    years, 
    semesters, 
    faculty, 
    classCoordinatorAssignments 
  } = useAcademic();

  const role = user?.role || 'faculty';
  
  // Resolve effective faculty record from auth user
  const currentFaculty = useMemo(() => {
    return faculty.find(
      f => f.id === user?.faculty_id || 
           f.id === user?.faculty?.id || 
           f.id === user?.id ||
           (user?.faculty?.employee_code && f.employee_code === user.faculty.employee_code) ||
           (user?.full_name && f.full_name?.toLowerCase().trim() === user.full_name.toLowerCase().trim()) ||
           (user?.email && f.email?.toLowerCase().trim() === user.email.toLowerCase().trim())
    ) || user?.faculty;
  }, [faculty, user]);

  const facultyId = currentFaculty?.id || user?.faculty_id || user?.faculty?.id || (role === 'faculty' ? user?.id : null);
  const departmentId = user?.department_id || user?.faculty?.department_id || currentFaculty?.department_id;

  // Applications list state
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  // Review Modal State
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load applications based on role
  const loadApplications = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      let data: LeaveApplication[] = [];
      if (role === 'hod') {
        data = await supabaseService.fetchHODLeaveApplications(departmentId || undefined);
      } else if (role === 'super_admin') {
        data = await supabaseService.fetchHODLeaveApplications(undefined);
      } else {
        // Faculty / Class Coordinator
        data = await supabaseService.fetchCoordinatorLeaveApplications(facultyId || undefined);
      }
      setApplications(data);
    } catch (err) {
      console.error('Error loading leave applications:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [role, facultyId, departmentId]);

  useEffect(() => {
    loadApplications(true);
  }, [loadApplications]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('leave_management_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_applications' },
        () => {
          loadApplications(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadApplications]);

  // Categorize counts
  const pendingCount = useMemo(() => {
    if (role === 'hod') {
      return applications.filter(a => a.status === 'PENDING_HOD').length;
    }
    return applications.filter(a => a.status === 'PENDING_COORDINATOR').length;
  }, [applications, role]);

  const approvedCount = useMemo(() => {
    return applications.filter(a => a.status === 'APPROVED' || (role === 'faculty' && a.status === 'PENDING_HOD')).length;
  }, [applications, role]);

  const rejectedCount = useMemo(() => {
    return applications.filter(a => a.status.startsWith('REJECTED')).length;
  }, [applications]);

  // Helper to resolve an AcademicYear for any section
  const getSectionYear = useCallback((section: Section): AcademicYear | undefined => {
    // 1. Resolve via semester -> academic_year_id
    if (section.semester_id) {
      const sem = semesters.find(s => s.id === section.semester_id);
      if (sem?.academic_year_id) {
        const yr = years.find(y => y.id === sem.academic_year_id);
        if (yr) return yr;
      }
    }
    // 2. Resolve via leave application records that already matched this section
    const appWithSec = applications.find(a => a.section_id === section.id && (a.academic_year || a.academic_year_id));
    if (appWithSec?.academic_year) {
      return appWithSec.academic_year as AcademicYear;
    }
    if (appWithSec?.academic_year_id) {
      const yr = years.find(y => y.id === appWithSec.academic_year_id);
      if (yr) return yr;
    }
    return undefined;
  }, [semesters, years, applications]);

  // Identify coordinator's assigned/relevant section IDs
  const coordinatorSectionIds = useMemo(() => {
    const ids = new Set<string>();
    if (role === 'faculty' && facultyId) {
      // Direct class coordinator assignments table
      classCoordinatorAssignments
        .filter(cca => cca.active && (cca.faculty_id === facultyId || cca.faculty?.auth_user_id === user?.id))
        .forEach(cca => {
          if (cca.section_id) ids.add(cca.section_id);
        });

      // Sections table direct class_coordinator_id pointer
      sections
        .filter(s => s.class_coordinator_id === facultyId)
        .forEach(s => ids.add(s.id));

      // Leave applications assigned to or fetched for this coordinator
      applications.forEach(app => {
        if (app.section_id) ids.add(app.section_id);
      });
    }
    return ids;
  }, [role, facultyId, classCoordinatorAssignments, sections, applications, user?.id]);

  // Scoped sections based on user role and institutional context
  const scopedBaseSections = useMemo(() => {
    let pool: Section[] = [];

    if (role === 'faculty') {
      if (coordinatorSectionIds.size > 0) {
        pool = sections.filter(s => coordinatorSectionIds.has(s.id));
        // Add any section present in applications that might not be in the global sections array
        applications.forEach(app => {
          if (app.section_id && !pool.some(s => s.id === app.section_id)) {
            pool.push({
              id: app.section_id,
              name: app.section?.name || 'Section',
              semester_id: '',
              room_number: '',
              active: true
            });
          }
        });
      } else {
        // Fallback if no specific coordinator assignments exist
        pool = sections.filter(s => s.active);
      }
    } else if (role === 'hod') {
      if (departmentId) {
        const deptProgramIds = new Set(programs.filter(p => p.department_id === departmentId).map(p => p.id));
        const deptYearIds = new Set(years.filter(y => deptProgramIds.has(y.program_id)).map(y => y.id));
        const deptSemesterIds = new Set(semesters.filter(sm => deptYearIds.has(sm.academic_year_id)).map(sm => sm.id));

        pool = sections.filter(s => 
          deptSemesterIds.has(s.semester_id) || 
          applications.some(a => a.section_id === s.id)
        );
      } else {
        pool = sections.filter(s => s.active);
      }
    } else {
      // super_admin
      pool = sections.filter(s => s.active);
    }

    return pool;
  }, [role, coordinatorSectionIds, sections, applications, departmentId, programs, years, semesters]);

  // Scoped & Deduplicated Academic Years
  const availableYears = useMemo(() => {
    const yearMap = new Map<string, AcademicYear>();

    // 1. Years present in scoped base sections
    scopedBaseSections.forEach(sec => {
      const yr = getSectionYear(sec);
      if (yr?.id && !yearMap.has(yr.id)) {
        yearMap.set(yr.id, yr);
      }
    });

    // 2. Years present in fetched applications
    applications.forEach(app => {
      if (app.academic_year?.id && !yearMap.has(app.academic_year.id)) {
        yearMap.set(app.academic_year.id, app.academic_year as AcademicYear);
      } else if (app.academic_year_id && !yearMap.has(app.academic_year_id)) {
        const yr = years.find(y => y.id === app.academic_year_id);
        if (yr && !yearMap.has(yr.id)) {
          yearMap.set(yr.id, yr);
        }
      }
    });

    // 3. Fallback to all active years if nothing gathered
    if (yearMap.size === 0) {
      years.filter(y => y.active).forEach(y => {
        if (!yearMap.has(y.id)) {
          yearMap.set(y.id, y);
        }
      });
    }

    return Array.from(yearMap.values()).sort((a, b) => (a.year_number || 0) - (b.year_number || 0));
  }, [scopedBaseSections, applications, getSectionYear, years]);

  // Scoped, Filtered by Year, and Strictly Deduplicated Sections
  const availableSectionOptions = useMemo(() => {
    let list = scopedBaseSections;

    // Filter by selected year if active
    if (selectedYear !== 'ALL') {
      list = list.filter(sec => {
        const secYear = getSectionYear(sec);
        if (secYear?.id) {
          return secYear.id === selectedYear;
        }
        return applications.some(a => a.section_id === sec.id && (a.academic_year_id === selectedYear || a.academic_year?.id === selectedYear));
      });
    }

    // Strictly deduplicate by section.id (UUID)
    const uniqueMap = new Map<string, Section>();
    for (const sec of list) {
      if (sec?.id && !uniqueMap.has(sec.id)) {
        uniqueMap.set(sec.id, sec);
      }
    }

    // Sort options: by year (if across all years) then alphanumeric by section name
    return Array.from(uniqueMap.values()).sort((a, b) => {
      if (selectedYear === 'ALL') {
        const yearA = getSectionYear(a)?.year_number || 0;
        const yearB = getSectionYear(b)?.year_number || 0;
        if (yearA !== yearB) return yearA - yearB;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [scopedBaseSections, selectedYear, getSectionYear, applications]);

  // Auto-reset section filter when selectedYear changes and previous section is no longer available
  useEffect(() => {
    if (selectedSection === 'ALL') return;
    const isStillValid = availableSectionOptions.some(s => s.id === selectedSection);
    if (!isStillValid) {
      setSelectedSection('ALL');
    }
  }, [selectedYear, availableSectionOptions, selectedSection]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      // Tab filter
      if (activeTab === 'pending') {
        if (role === 'hod' && app.status !== 'PENDING_HOD') return false;
        if (role === 'faculty' && app.status !== 'PENDING_COORDINATOR') return false;
        if (role === 'super_admin' && !app.status.startsWith('PENDING')) return false;
      } else if (activeTab === 'approved') {
        if (role === 'faculty') {
          if (app.status !== 'PENDING_HOD' && app.status !== 'APPROVED') return false;
        } else {
          if (app.status !== 'APPROVED') return false;
        }
      } else if (activeTab === 'rejected') {
        if (!app.status.startsWith('REJECTED')) return false;
      }

      // Section filter
      if (selectedSection !== 'ALL' && app.section_id !== selectedSection) {
        return false;
      }

      // Year filter
      if (selectedYear !== 'ALL') {
        const appYrId = app.academic_year_id || app.academic_year?.id;
        if (appYrId) {
          if (appYrId !== selectedYear) return false;
        } else {
          const sec = sections.find(s => s.id === app.section_id);
          const secYr = sec ? getSectionYear(sec) : undefined;
          if (secYr?.id !== selectedYear) {
            return false;
          }
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const studentName = app.student?.full_name?.toLowerCase() || '';
        const rollNum = app.student?.roll_number?.toLowerCase() || '';
        const appNum = app.application_number?.toLowerCase() || '';
        const reason = app.reason?.toLowerCase() || '';
        if (!studentName.includes(term) && !rollNum.includes(term) && !appNum.includes(term) && !reason.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [applications, activeTab, role, selectedSection, selectedYear, searchTerm, sections, getSectionYear]);

  // Execute Approve or Reject
  const handleExecuteReview = async () => {
    if (!selectedApp || !actionType) return;
    if (actionType === 'REJECT' && !remarks.trim()) {
      setActionError('A rejection reason is strictly required.');
      return;
    }

    setIsProcessingAction(true);
    setActionError(null);

    let res: { success: boolean; data?: LeaveApplication; error?: string };

    if (role === 'hod' || (role === 'super_admin' && selectedApp.status === 'PENDING_HOD')) {
      res = await supabaseService.hodReviewLeave({
        applicationId: selectedApp.id,
        action: actionType,
        remarks: remarks.trim() || undefined
      });
    } else {
      res = await supabaseService.coordinatorReviewLeave({
        applicationId: selectedApp.id,
        action: actionType,
        remarks: remarks.trim() || undefined
      });
    }

    setIsProcessingAction(false);

    if (!res.success) {
      setActionError(res.error || 'Failed to process leave review.');
      return;
    }

    const message = actionType === 'APPROVE'
      ? role === 'hod'
        ? `Application ${selectedApp.application_number} finally APPROVED! Certificate is now generated.`
        : `Application ${selectedApp.application_number} approved and forwarded to HOD for final sanction.`
      : `Application ${selectedApp.application_number} rejected.`;

    setActionSuccess(message);
    setTimeout(() => setActionSuccess(null), 5000);

    setIsDetailModalOpen(false);
    setSelectedApp(null);
    setActionType(null);
    setRemarks('');
    loadApplications(false);
  };

  const handleDownloadPdf = (app: LeaveApplication) => {
    if (app.status !== 'APPROVED') {
      console.warn('Cannot download PDF: leave application is not approved yet.');
      return;
    }
    generateApprovedLeavePdf({
      application: app,
      studentName: app.student?.full_name || 'Student',
      rollNumber: app.student?.roll_number || 'N/A',
      departmentName: app.department?.name || 'Computer Science & Engineering',
      yearName: app.academic_year?.name || 'Academic Year',
      sectionName: app.section?.name || 'A',
      coordinatorName: app.coordinator_approver?.full_name || app.coordinator?.full_name || 'Class Coordinator',
      coordinatorDesignation: app.coordinator_approver?.designation || app.coordinator?.designation || 'Class Coordinator',
      hodName: app.hod_approver?.full_name || app.hod?.full_name || 'Head of Department',
      hodDesignation: app.hod_approver?.designation || app.hod?.designation || 'Associate Professor & HOD'
    });
  };

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]">
            Approved
          </span>
        );
      case 'PENDING_HOD':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
            Pending HOD Review
          </span>
        );
      case 'PENDING_COORDINATOR':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/15 border border-amber-500/30 text-amber-300">
            Pending Coordinator Review
          </span>
        );
      case 'REJECTED_BY_COORDINATOR':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/15 border border-rose-500/30 text-rose-400" title="Rejected by Class Coordinator">
            Rejected
          </span>
        );
      case 'REJECTED_BY_HOD':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/15 border border-rose-500/30 text-rose-400" title="Rejected by Head of Department">
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
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {role === 'hod' 
                  ? 'Department Leave Approvals' 
                  : role === 'super_admin' 
                  ? 'All Institutional Leave Applications' 
                  : 'Class Coordinator Leave Review'}
              </h1>
              <p className="text-xs text-slate-400">
                {role === 'hod' 
                  ? 'Final sanction authority for forwarded leave applications' 
                  : 'Screening and endorsement of student leave applications for your coordinated classes'}
              </p>
            </div>
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
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2.5 animate-in zoom-in-95 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-[#00ff88] shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs & Controls */}
      <div className="glass-panel rounded-3xl p-4 border border-emerald-500/20 bg-slate-900/70 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-950/70 text-slate-300 hover:bg-slate-950 border border-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Action</span>
              {pendingCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'pending' ? 'bg-slate-950 text-amber-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'approved'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-950/70 text-slate-300 hover:bg-slate-950 border border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{role === 'faculty' ? 'Approved & Forwarded' : 'Approved Leaves'}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'approved' ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {approvedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'rejected'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-slate-950/70 text-slate-300 hover:bg-slate-950 border border-slate-800'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'rejected' ? 'bg-slate-950 text-rose-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {rejectedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-700 text-white shadow-md'
                  : 'bg-slate-950/70 text-slate-300 hover:bg-slate-950 border border-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All ({applications.length})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student, roll, ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
            />
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Academic Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-[#00ff88] transition-colors"
          >
            <option value="ALL" className="bg-slate-950 text-white">All Academic Years</option>
            {availableYears.map(y => (
              <option key={y.id} value={y.id} className="bg-slate-950 text-white">
                {y.name || `${y.year_number} Year`}
              </option>
            ))}
          </select>

          {/* Section Filter - Scoped to Coordinator & Strictly Deduplicated */}
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-[#00ff88] transition-colors"
          >
            <option value="ALL" className="bg-slate-950 text-white">All Sections</option>
            {availableSectionOptions.map(s => {
              const secYear = getSectionYear(s);
              const label = selectedYear === 'ALL' && secYear?.name
                ? `Section ${s.name} (${secYear.name})`
                : `Section ${s.name}`;
              return (
                <option key={s.id} value={s.id} className="bg-slate-950 text-white">
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="glass-panel p-12 rounded-3xl border border-emerald-500/15 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
            <p className="text-xs font-medium">Fetching leave applications from database...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="glass-panel rounded-3xl border border-emerald-500/15 p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-bold text-slate-200">No applications matching current filters</p>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'pending' 
                ? 'All pending leave requests have been reviewed!' 
                : 'No historical leave records found in this category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredApplications.map((app) => {
              const canAct = (role === 'faculty' && app.status === 'PENDING_COORDINATOR') ||
                             (role === 'hod' && app.status === 'PENDING_HOD') ||
                             (role === 'super_admin' && app.status.startsWith('PENDING'));
              const isApproved = app.status === 'APPROVED';

              return (
                <div
                  key={app.id}
                  className="glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/20 bg-slate-900/70 hover:border-emerald-500/40 transition-all space-y-4 shadow-lg"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/25">
                          {app.application_number}
                        </span>
                        <span className="font-black text-white text-base">
                          {app.student?.full_name || 'Student Name'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          ({app.student?.roll_number || 'No Roll'})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{app.department?.name || 'CSE'}</span>
                        <span>•</span>
                        <span>{app.academic_year?.name || 'Year'}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">Section {app.section?.name || 'A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(app.status)}

                      {isApproved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPdf(app)}
                          leftIcon={<Download className="w-3.5 h-3.5 text-emerald-400" />}
                        >
                          Certificate PDF
                        </Button>
                      )}

                      <Button
                        variant={canAct ? 'neon' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setSelectedApp(app);
                          setActionType(null);
                          setRemarks('');
                          setActionError(null);
                          setIsDetailModalOpen(true);
                        }}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        {canAct ? 'Review Application' : 'View Details'}
                      </Button>
                    </div>
                  </div>

                  {/* Summary Row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400 block text-[11px]">Leave Type</span>
                      <strong className="text-white text-xs">{app.leave_type}</strong>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400 block text-[11px]">Period</span>
                      <span className="font-mono text-white text-xs font-bold">
                        {new Date(app.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        {' - '}
                        {new Date(app.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-emerald-400 block text-[10px] mt-0.5">
                        {app.number_of_days} Day(s)
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 md:col-span-2">
                      <span className="text-slate-400 block text-[11px]">Reason / Justification</span>
                      <p className="text-slate-200 italic line-clamp-2">
                        "{app.reason}"
                      </p>
                    </div>
                  </div>

                  {/* Coordinator & HOD Endorsement Status Footer */}
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">Coordinator:</span>
                      <strong className="text-white">{app.coordinator_approver?.full_name || app.coordinator?.full_name || 'Class Coordinator'}</strong>
                      {app.coordinator_approved_at ? (
                        <span className="text-emerald-400 font-mono text-[10px]">
                          (Approved: {new Date(app.coordinator_approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                        </span>
                      ) : (
                        <span className="text-amber-400 font-mono text-[10px]">(Pending)</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">HOD:</span>
                      <strong className="text-white">{app.hod_approver?.full_name || app.hod?.full_name || 'HOD'}</strong>
                      {app.hod_approved_at ? (
                        <span className="text-emerald-400 font-mono text-[10px]">
                          (Approved: {new Date(app.hod_approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">(Waiting)</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review / Details Modal */}
      {selectedApp && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedApp(null);
            setActionType(null);
          }}
          title={`Leave Application Review — ${selectedApp.application_number}`}
          description={`Student: ${selectedApp.student?.full_name || 'Student'} (${selectedApp.student?.roll_number || 'N/A'})`}
          maxWidth="lg"
        >
          <div className="space-y-5">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Student & Academic Context */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Student Name</span>
                <strong className="text-white">{selectedApp.student?.full_name}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Roll Number</span>
                <strong className="text-emerald-400 font-mono">{selectedApp.student?.roll_number}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Section</span>
                <strong className="text-white">Section {selectedApp.section?.name}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Current Status</span>
                <div className="mt-0.5">{getStatusBadge(selectedApp.status)}</div>
              </div>
            </div>

            {/* Leave Duration & Reason */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <span className="text-slate-400 text-[11px]">Leave Category: </span>
                  <strong className="text-white">{selectedApp.leave_type}</strong>
                </div>
                <div className="font-mono text-emerald-400 font-bold">
                  {new Date(selectedApp.from_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' to '}
                  {new Date(selectedApp.to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' '}({selectedApp.number_of_days} Day(s))
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block text-[11px] mb-1">Reason Submitted by Student:</span>
                <p className="text-slate-200 italic leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                  "{selectedApp.reason}"
                </p>
              </div>

              {selectedApp.attachment_name && (
                <div className="text-[11px] text-slate-400 font-mono">
                  📎 Attached document: <strong>{selectedApp.attachment_name}</strong>
                </div>
              )}
            </div>

            {/* Endorsement Audit History */}
            <div className="space-y-2 text-xs">
              <span className="font-bold uppercase text-slate-400 text-[11px] block">Approval Hierarchy Audit Trail</span>
              
              <div className="space-y-2">
                {/* Level 1: Coordinator */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Level 1: Class Coordinator</span>
                    <strong className="text-white">{selectedApp.coordinator_approver?.full_name || selectedApp.coordinator?.full_name || 'Class Coordinator'}</strong>
                    {selectedApp.coordinator_remarks && (
                      <p className="text-[11px] text-slate-300 italic mt-0.5">Remarks: "{selectedApp.coordinator_remarks}"</p>
                    )}
                  </div>
                  <div className="text-right font-mono">
                    {selectedApp.coordinator_approved_at ? (
                      <span className="text-emerald-400 font-bold block">Approved ✓</span>
                    ) : selectedApp.status === 'REJECTED_BY_COORDINATOR' ? (
                      <span className="text-rose-400 font-bold block">Rejected ✗</span>
                    ) : (
                      <span className="text-amber-400 font-bold block">Pending Review</span>
                    )}
                  </div>
                </div>

                {/* Level 2: HOD */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Level 2: Head of Department (HOD)</span>
                    <strong className="text-white">{selectedApp.hod_approver?.full_name || selectedApp.hod?.full_name || 'Head of Department'}</strong>
                    {selectedApp.hod_remarks && (
                      <p className="text-[11px] text-slate-300 italic mt-0.5">Remarks: "{selectedApp.hod_remarks}"</p>
                    )}
                  </div>
                  <div className="text-right font-mono">
                    {selectedApp.hod_approved_at ? (
                      <span className="text-emerald-400 font-bold block">Final Sanctioned ✓</span>
                    ) : selectedApp.status === 'REJECTED_BY_HOD' ? (
                      <span className="text-rose-400 font-bold block">Rejected ✗</span>
                    ) : selectedApp.status === 'PENDING_HOD' ? (
                      <span className="text-cyan-400 font-bold block">Awaiting HOD Sanction</span>
                    ) : (
                      <span className="text-slate-500 font-bold block">Waiting Level 1</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Decision Action Box if actionable */}
            {((role === 'faculty' && selectedApp.status === 'PENDING_COORDINATOR') ||
              (role === 'hod' && selectedApp.status === 'PENDING_HOD') ||
              (role === 'super_admin' && selectedApp.status.startsWith('PENDING'))) && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3 pt-4">
                <span className="font-bold text-xs text-white block">
                  {role === 'hod' 
                    ? 'Head of Department Final Decision' 
                    : 'Class Coordinator Verification Decision'}
                </span>

                <div className="space-y-2">
                  <label className="block text-[11px] text-slate-400">
                    Remarks / Justification {actionType === 'REJECT' ? '<span className="text-rose-400">* (Mandatory for rejection)</span>' : '(Optional)'}
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={actionType === 'REJECT' ? 'State clear reason for rejecting leave application...' : 'Add any official remarks or conditions...'}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActionType('REJECT');
                      if (!remarks.trim()) {
                        setActionError('Please enter a rejection reason above before confirming rejection.');
                        return;
                      }
                      handleExecuteReview();
                    }}
                    isLoading={isProcessingAction && actionType === 'REJECT'}
                    className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                    leftIcon={<XCircle className="w-3.5 h-3.5 text-rose-400" />}
                  >
                    Reject Application
                  </Button>

                  <Button
                    variant="neon"
                    size="sm"
                    onClick={() => {
                      setActionType('APPROVE');
                      handleExecuteReview();
                    }}
                    isLoading={isProcessingAction && actionType === 'APPROVE'}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />}
                  >
                    {role === 'hod' ? 'Approve & Sanction Leave' : 'Approve & Forward to HOD'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedApp(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

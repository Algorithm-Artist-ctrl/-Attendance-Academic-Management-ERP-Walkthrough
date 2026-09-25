import React, { useState, useMemo, useEffect } from 'react';
import { 
  GraduationCap, 
  Search, 
  Mail, 
  Phone, 
  Building2, 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  Lock, 
  Unlock, 
  Archive, 
  CheckCircle2, 
  Clock, 
  Filter, 
  RefreshCw, 
  EyeOff, 
  Eye,
  Save,
  Check,
  Sparkles,
  AlertTriangle,
  Layers,
  BookOpen
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AccountStatus } from '../../types/database.types';
import { formatTimeAgo } from '../../lib/utils/dateUtils';
import { supabaseService } from '../../lib/services/supabaseService';
import { StudentProfileModal } from '../../components/student/StudentProfileModal';
import { ArchiveAccountModal } from '../../components/admin/ArchiveAccountModal';

export const StudentAccountsPage: React.FC = () => {
  const { user: currentSessionUser } = useAuth();
  const { 
    students, 
    sections,
    years,
    departments, 
    adminAccounts, 
    refreshAdminAccounts, 
    updateAccountStatus, 
    updateAccountCredentials,
    refreshStudents
  } = useAcademic();

  useEffect(() => {
    if (adminAccounts.length === 0) {
      refreshAdminAccounts();
    }
    if (students.length === 0) {
      refreshStudents();
    }
  }, [adminAccounts.length, refreshAdminAccounts, students.length, refreshStudents]);

  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountStatus>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconcileResult(null);
    try {
      const res = await supabaseService.reconcileAuthAccounts();
      setReconcileResult({
        type: 'success',
        message: `Successfully reconciled ${res.reconciled_students} student(s) and ${res.reconciled_faculty} faculty account(s).`,
      });
      await Promise.all([refreshAdminAccounts(), refreshStudents()]);
      setTimeout(() => setReconcileResult(null), 7000);
    } catch (err: any) {
      setReconcileResult({
        type: 'error',
        message: `Reconciliation failed: ${err?.message || 'Unknown error'}`,
      });
      setTimeout(() => setReconcileResult(null), 7000);
    } finally {
      setIsReconciling(false);
    }
  };

  // Selected student account for management modal
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveModalTarget, setArchiveModalTarget] = useState<any | null>(null);

  // Credential management local state
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSettingDefaultPass, setIsSettingDefaultPass] = useState(false);
  const [showDefaultPassConfirm, setShowDefaultPassConfirm] = useState(false);

  // Combine unified directory data with students data
  const accountsData = useMemo(() => {
    return students.map(s => {
      const dirEntry = adminAccounts.find(a => 
        (s.auth_user_id && a.user_id === s.auth_user_id) || 
        (s.email && a.email.toLowerCase() === s.email.toLowerCase()) ||
        (a.roll_number && a.roll_number.toLowerCase() === s.roll_number.toLowerCase())
      );

      const sec = sections.find(sc => sc.id === s.section_id);
      const yr = years.find(y => y.id === s.academic_year_id);
      const dept = departments.find(d => d.id === s.department_id);

      const status: AccountStatus = dirEntry?.status || s.status || (s.active ? 'ACTIVE' : 'BLOCKED');
      const lastLogin = dirEntry?.last_sign_in_at || null;

      return {
        id: s.id,
        auth_user_id: s.auth_user_id || dirEntry?.user_id || s.id,
        full_name: s.full_name,
        roll_number: s.roll_number,
        email: s.email || `${s.roll_number.toLowerCase()}@vctm.in`,
        admission_type: s.admission_type,
        academic_year_id: s.academic_year_id,
        year_name: yr?.name || (yr?.year_number ? `${yr.year_number} Year` : 'Enrolled'),
        year_number: yr?.year_number || dirEntry?.year_number || null,
        section_id: s.section_id,
        section_name: sec?.name || dirEntry?.section_name || 'Unassigned',
        department_id: s.department_id,
        department_name: dept?.name || 'Computer Science',
        department_code: dept?.code || 'CSE',
        phone: s.phone,
        status,
        last_sign_in_at: lastLogin,
        created_at: dirEntry?.created_at || s.created_at || new Date().toISOString(),
      };
    });
  }, [students, adminAccounts, sections, years, departments]);

  const filteredAccounts = useMemo(() => {
    return accountsData.filter(acc => {
      const matchesSearch = 
        acc.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.section_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesYear = yearFilter === 'ALL' || acc.academic_year_id === yearFilter;
      const matchesSection = sectionFilter === 'ALL' || acc.section_id === sectionFilter;
      const matchesStatus = statusFilter === 'ALL' || acc.status === statusFilter;

      return matchesSearch && matchesYear && matchesSection && matchesStatus;
    });
  }, [accountsData, searchTerm, yearFilter, sectionFilter, statusFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshAdminAccounts(),
        refreshStudents(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenManage = (account: any) => {
    setSelectedAccount(account);
    setEditEmail(account.email || '');
    setEditPassword('');
    setShowPassword(false);
    setActionMessage(null);
    setBlockReason('');
    setShowBlockConfirm(false);
    setShowArchiveConfirm(false);
    setShowDefaultPassConfirm(false);
  };

  const handleUpdateEmail = async () => {
    if (!selectedAccount || !editEmail) return;
    const clean = editEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setActionMessage({
        type: 'error',
        text: 'Please enter a valid email address (e.g. rollnumber@student.vctm.in).'
      });
      return;
    }

    setIsUpdatingEmail(true);
    setActionMessage(null);
    try {
      const targetId = selectedAccount.auth_user_id || selectedAccount.id;
      const res = await updateAccountCredentials(targetId, {
        email: clean,
      });

      if (res.success) {
        setSelectedAccount((prev: any) => prev ? { ...prev, email: clean } : null);
        setActionMessage({
          type: 'success',
          text: `Login email successfully updated to "${clean}". Supabase Auth identity, profile, and student records are synchronized. Student can log in immediately.`
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to update login email.'
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'An error occurred while updating email.'
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleSetCustomPassword = async () => {
    if (!selectedAccount || !editPassword) return;
    const cleanPass = editPassword.trim();
    if (cleanPass.length < 6) {
      setActionMessage({
        type: 'error',
        text: 'Password must be at least 6 characters in length.'
      });
      return;
    }

    setIsUpdatingPassword(true);
    setActionMessage(null);
    try {
      const targetId = selectedAccount.auth_user_id || selectedAccount.id;
      const res = await updateAccountCredentials(targetId, {
        password: cleanPass,
        isDefaultPassword: false,
      });

      if (res.success) {
        setEditPassword('');
        setShowPassword(false);
        setActionMessage({
          type: 'success',
          text: 'Custom password updated successfully in Supabase Auth. Student can log in immediately.'
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to set custom password.'
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'An error occurred while updating password.'
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSetDefaultPassword = async () => {
    if (!selectedAccount) return;
    setIsSettingDefaultPass(true);
    setActionMessage(null);
    try {
      const targetId = selectedAccount.auth_user_id || selectedAccount.id;
      const res = await updateAccountCredentials(targetId, {
        password: 'VctmStudent@2026',
        isDefaultPassword: true,
      });

      if (res.success) {
        setEditPassword('');
        setActionMessage({
          type: 'success',
          text: 'Institution default password ("VctmStudent@2026") set in Supabase Auth. Student can log in immediately.'
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to apply default password.'
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'An error occurred while setting default password.'
      });
    } finally {
      setIsSettingDefaultPass(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedAccount) return;
    setActionLoading(true);
    setActionMessage(null);

    const isCurrentlyBlocked = selectedAccount.status === 'BLOCKED';
    const newStatus: AccountStatus = isCurrentlyBlocked ? 'ACTIVE' : 'BLOCKED';

    try {
      const res = await updateAccountStatus(
        selectedAccount.auth_user_id,
        newStatus,
        blockReason || (isCurrentlyBlocked ? 'Unblocked by Super Admin' : 'Administrative account restriction')
      );

      if (res.success) {
        setSelectedAccount((prev: any) => prev ? { ...prev, status: newStatus } : null);
        setActionMessage({
          type: 'success',
          text: isCurrentlyBlocked 
            ? 'Student account unblocked. Access restored.' 
            : 'Student account blocked. Immediate session termination and RLS restriction applied.'
        });
        setShowBlockConfirm(false);
        setBlockReason('');
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to update account status.'
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'An error occurred.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedAccount) return;
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await updateAccountStatus(
        selectedAccount.auth_user_id,
        'ARCHIVED',
        'Student soft-archived by Super Admin. Historical records preserved.'
      );

      if (res.success) {
        setSelectedAccount((prev: any) => prev ? { ...prev, status: 'ARCHIVED' } : null);
        setActionMessage({
          type: 'success',
          text: 'Account safely archived. Historical attendance, marks, and submissions remain fully intact.'
        });
        setShowArchiveConfirm(false);
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to archive account.'
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'An error occurred.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#0f172a] tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-[#0f172a]" />
            Student Account & Security Directory
          </h1>
          <p className="text-[15px] text-[#475569] font-medium leading-relaxed mt-1">
            Student portal credentials, enrollment authentication, account locks, and security audit records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconcile}
            isLoading={isReconciling}
            leftIcon={<ShieldCheck className={`w-4 h-4 text-[#0f172a] ${isReconciling ? 'animate-spin' : ''}`} />}
            className="border-slate-200 hover:bg-slate-50 text-[#0f172a] font-semibold shadow-xs"
          >
            Reconcile Auth Accounts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
            className="border-slate-200 hover:bg-slate-50 text-[#0f172a] font-semibold"
          >
            Refresh Directory
          </Button>
        </div>
      </div>

      {reconcileResult && (
        <div className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between transition-all ${
          reconcileResult.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {reconcileResult.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{reconcileResult.message}</span>
          </div>
          <button onClick={() => setReconcileResult(null)} className="text-[#475569] hover:text-[#0f172a] text-sm ml-4 font-bold">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between border border-slate-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, roll number, email, section..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-[#0f172a] placeholder-slate-500 font-medium focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#0f172a] shadow-xs">
            <Layers className="w-4 h-4 text-[#475569]" />
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="bg-transparent border-none text-sm text-[#0f172a] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Years</option>
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#0f172a] shadow-xs">
            <BookOpen className="w-4 h-4 text-[#475569]" />
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              className="bg-transparent border-none text-sm text-[#0f172a] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Sections</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#0f172a] shadow-xs">
            <Filter className="w-4 h-4 text-[#475569]" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-transparent border-none text-sm text-[#0f172a] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="BLOCKED">Blocked Only</option>
              <option value="ARCHIVED">Archived Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Roll Number</th>
                <th className="py-3.5 px-4">Year & Section</th>
                <th className="py-3.5 px-4">Email / Login ID</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm bg-white">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#475569]">
                    <GraduationCap className="w-8 h-8 text-[#475569] mx-auto mb-2 opacity-50" />
                    <p className="font-bold text-[#0f172a] text-base">No student accounts found matching criteria</p>
                    <p className="text-xs text-[#475569] mt-0.5 font-medium">Try adjusting your search terms or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => {
                  const isBlocked = acc.status === 'BLOCKED';
                  const isArchived = acc.status === 'ARCHIVED';

                  return (
                    <tr 
                      key={acc.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${isBlocked ? 'bg-amber-50/40' : isArchived ? 'opacity-60 bg-slate-50' : ''}`}
                    >
                      {/* Name & Admission Type */}
                      <td className="py-3.5 px-4">
                        <div 
                          className="font-bold text-[#0f172a] flex items-center gap-2 cursor-pointer group"
                          onClick={() => {
                            setProfileStudentId(acc.id);
                            setIsProfileModalOpen(true);
                          }}
                        >
                          <span className="text-sm font-bold text-[#0f172a] group-hover:text-blue-600 transition-colors">{acc.full_name}</span>
                          {acc.admission_type && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-xs text-[#475569] font-bold border border-slate-200">
                              {acc.admission_type}
                            </span>
                          )}
                          <span className="text-xs text-[#475569] opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                            Profile →
                          </span>
                        </div>
                        <p className="text-xs text-[#475569] font-medium mt-0.5">{acc.department_name}</p>
                      </td>

                      {/* Roll Number */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileStudentId(acc.id);
                            setIsProfileModalOpen(true);
                          }}
                          className="font-mono text-xs text-[#0f172a] bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-200 font-bold transition-colors cursor-pointer"
                          title="View detailed student profile"
                        >
                          {acc.roll_number}
                        </button>
                      </td>

                      {/* Year & Section */}
                      <td className="py-3.5 px-4">
                        <span className="text-sm text-[#0f172a] font-bold block">{acc.section_name}</span>
                        <span className="text-xs text-[#475569] block font-medium">({acc.year_name})</span>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#334155] font-mono text-xs font-medium flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#475569] shrink-0" />
                          <span>{acc.email}</span>
                        </div>
                        {acc.phone && (
                          <div className="text-[#475569] text-xs font-medium flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3 h-3 text-[#475569] shrink-0" />
                            <span>{acc.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {acc.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active
                          </span>
                        )}
                        {acc.status === 'BLOCKED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Lock className="w-3.5 h-3.5" />
                            Blocked
                          </span>
                        )}
                        {acc.status === 'ARCHIVED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <Archive className="w-3.5 h-3.5" />
                            Archived
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-xs text-[#475569] font-mono font-medium">
                        {acc.last_sign_in_at ? (
                          <span className="flex items-center gap-1.5 text-[#475569]">
                            <Clock className="w-3.5 h-3.5 text-[#475569]" />
                            {formatTimeAgo(acc.last_sign_in_at)}
                          </span>
                        ) : (
                          <span className="text-[#475569] italic">Never logged in</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenManage(acc)}
                          className="text-xs font-bold text-[#0f172a] hover:bg-slate-100"
                          leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-[#0f172a]" />}
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Account Management & Security Modal */}
      {selectedAccount && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAccount(null)}
          title={`Student Account: ${selectedAccount.full_name}`}
        >
          <div className="space-y-5">
            {/* Status Alert Message */}
            {actionMessage && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                actionMessage.type === 'success' 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{actionMessage.text}</span>
              </div>
            )}

            {/* Profile Overview */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-[#0f172a]">{selectedAccount.full_name}</h4>
                  <p className="text-xs text-[#475569] font-medium">{selectedAccount.year_name} • {selectedAccount.section_name} • {selectedAccount.department_name}</p>
                </div>
                <div>
                  {selectedAccount.status === 'ACTIVE' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Active Account
                    </span>
                  )}
                  {selectedAccount.status === 'BLOCKED' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Account Blocked
                    </span>
                  )}
                  {selectedAccount.status === 'ARCHIVED' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      Archived
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200">
                <div>
                  <span className="text-[#475569] block text-[11px] uppercase font-bold">Roll Number</span>
                  <span className="text-[#0f172a] font-mono font-bold text-sm">{selectedAccount.roll_number}</span>
                </div>
                <div>
                  <span className="text-[#475569] block text-[11px] uppercase font-bold">Official Email</span>
                  <span className="text-[#0f172a] font-mono font-bold text-sm">{selectedAccount.email}</span>
                </div>
                <div>
                  <span className="text-[#475569] block text-[11px] uppercase font-bold">Admission Type</span>
                  <span className="text-[#0f172a] font-semibold text-xs">{selectedAccount.admission_type || 'Regular'}</span>
                </div>
                <div>
                  <span className="text-[#475569] block text-[11px] uppercase font-bold">Last Login</span>
                  <span className="text-[#0f172a] font-mono font-bold text-xs">
                    {selectedAccount.last_sign_in_at ? formatTimeAgo(selectedAccount.last_sign_in_at) : 'Never logged in'}
                  </span>
                </div>
              </div>
            </div>

            {/* Super Admin Credential Management Panel */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#0f172a]" />
                  <div>
                    <h4 className="text-sm font-bold text-[#0f172a] tracking-wide">Account Credential Management</h4>
                    <p className="text-xs text-[#475569] font-medium">Direct Super Admin Auth Controls • Active Immediately</p>
                  </div>
                </div>
                <span className="text-xs text-[#0f172a] font-mono font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Confirmed Identity
                </span>
              </div>

              {/* 1. Login Email (Identity) Control */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#475569]" />
                    Login Email (Supabase Auth Identity)
                  </label>
                  {selectedAccount.email && (
                    <span className="text-xs text-[#475569] font-mono font-medium">
                      Current: {selectedAccount.email}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    placeholder="student.roll@student.vctm.in"
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#0f172a] placeholder-slate-500 font-mono font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateEmail}
                    isLoading={isUpdatingEmail}
                    disabled={!editEmail || editEmail.trim().toLowerCase() === selectedAccount.email.toLowerCase()}
                    leftIcon={<Save className="w-3.5 h-3.5 text-emerald-600" />}
                    className="text-xs shrink-0 font-semibold text-[#0f172a]"
                  >
                    Save Email
                  </Button>
                </div>
                <p className="text-xs text-[#475569] font-medium">
                  Changing email updates Supabase Auth, profile, and student records atomically. Existing UUIDs and enrollment data remain untouched.
                </p>
              </div>

              {/* 2. Password Management Controls */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#475569]" />
                  Set / Reset Password
                </label>
                
                {/* Custom Password Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="Enter new custom password (min 6 characters)..."
                      className="w-full px-3 py-2 pr-9 bg-white border border-slate-200 rounded-xl text-xs text-[#0f172a] placeholder-slate-500 font-mono font-semibold focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0f172a]"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSetCustomPassword}
                    isLoading={isUpdatingPassword}
                    disabled={!editPassword || editPassword.trim().length < 6}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                    className="text-xs shrink-0 font-semibold"
                  >
                    Set Password
                  </Button>
                </div>

                {/* Default Password Reset with Confirmation */}
                {showDefaultPassConfirm ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Confirm Password Reset</span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                      Are you sure you want to reset the password for <strong className="text-[#0f172a] font-bold">{selectedAccount.full_name}</strong> to institutional default (<code className="text-amber-900 font-mono font-bold">VctmStudent@2026</code>)?
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDefaultPassConfirm(false)}
                        className="text-xs text-[#475569] hover:text-[#0f172a] font-semibold"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await handleSetDefaultPassword();
                          setShowDefaultPassConfirm(false);
                        }}
                        isLoading={isSettingDefaultPass}
                        className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold"
                      >
                        Confirm Reset to Default
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-start gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDefaultPassConfirm(true)}
                      className="text-xs border-slate-200 text-[#0f172a] hover:bg-slate-50 font-semibold"
                      leftIcon={<Sparkles className="w-3.5 h-3.5 text-blue-600" />}
                    >
                      Reset to Default ("VctmStudent@2026")
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-[#334155] space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Immediate Login Enabled
                </div>
                <p className="font-medium text-[#475569]">
                  Super Admin updates are confirmed immediately without requiring the student to click an email link. Passwords are encrypted with bcrypt and never stored in plaintext.
                </p>
              </div>
            </div>

            {/* Account Status Controls */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <h4 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Access & Status Enforcement
              </h4>

              {selectedAccount.status === 'ACTIVE' ? (
                <div>
                  {!showBlockConfirm ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#0f172a]">Block Student Access</p>
                        <p className="text-xs text-[#475569] font-medium">Terminates active sessions and prevents ERP portal login.</p>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowBlockConfirm(true)}
                        leftIcon={<Lock className="w-3.5 h-3.5" />}
                        className="font-semibold text-xs"
                      >
                        Block Account
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                      <p className="text-xs text-rose-900 font-bold">
                        Confirm: Are you sure you want to block student {selectedAccount.full_name} ({selectedAccount.roll_number})?
                      </p>
                      <input
                        type="text"
                        placeholder="Reason for blocking (e.g. Fees pending, disciplinary action, leave of absence)..."
                        value={blockReason}
                        onChange={e => setBlockReason(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs text-[#0f172a] placeholder-slate-500 font-medium focus:outline-none focus:ring-1 focus:ring-rose-400"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBlockConfirm(false)}
                          className="text-xs text-[#475569] hover:text-[#0f172a] font-semibold"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleToggleBlock}
                          isLoading={actionLoading}
                          className="text-xs font-semibold"
                        >
                          Confirm Block
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedAccount.status === 'BLOCKED' ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-900">Account Currently Blocked</p>
                    <p className="text-xs text-[#475569] font-medium">Restore portal access and enable authentication for this student.</p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleToggleBlock}
                    isLoading={actionLoading}
                    leftIcon={<Unlock className="w-3.5 h-3.5 text-white" />}
                    className="rounded-xl shadow-xs font-semibold"
                  >
                    Unblock Account
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-[#475569] italic font-medium">
                  This student account is archived. Archival retains past attendance records, assignment marks, and test results.
                </p>
              )}

              {/* Soft Archive Option */}
              {selectedAccount.status !== 'ARCHIVED' && (
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0f172a]">Archive / Record Departure</p>
                      <p className="text-xs text-[#475569] font-medium">Graduation, withdrawal, or transfer. Permanently preserves attendance and grades.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setArchiveModalTarget({
                          id: selectedAccount.id,
                          name: selectedAccount.full_name,
                          role: 'student',
                          identifier: selectedAccount.roll_number,
                          currentStatus: selectedAccount.status,
                          email: selectedAccount.email,
                        });
                      }}
                      className="text-xs text-amber-800 hover:text-amber-900 border-amber-300 hover:bg-amber-50 font-semibold"
                      leftIcon={<Archive className="w-3.5 h-3.5 text-amber-700" />}
                    >
                      Archive / Exit
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAccount(null)}
                className="text-xs font-semibold text-[#475569] hover:text-[#0f172a]"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Student Profile Modal */}
      <StudentProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setProfileStudentId(null);
        }}
        studentId={profileStudentId}
      />

      {/* Archive / Departure Modal */}
      <ArchiveAccountModal
        isOpen={!!archiveModalTarget}
        onClose={() => setArchiveModalTarget(null)}
        target={archiveModalTarget}
        onSuccess={() => {
          setArchiveModalTarget(null);
          setSelectedAccount(null);
          refreshAdminAccounts();
          refreshStudents();
        }}
      />
    </div>
  );
};

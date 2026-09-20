import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
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
  AlertTriangle
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AccountStatus } from '../../types/database.types';
import { formatTimeAgo } from '../../lib/utils/dateUtils';
import { supabaseService } from '../../lib/services/supabaseService';
import { ArchiveAccountModal } from '../../components/admin/ArchiveAccountModal';

export const FacultyAccountsPage: React.FC = () => {
  const { user: currentSessionUser } = useAuth();
  const { 
    faculty, 
    departments, 
    adminAccounts, 
    refreshAdminAccounts, 
    updateAccountStatus, 
    updateAccountCredentials,
    requestPasswordReset,
    refreshFaculty
  } = useAcademic();

  useEffect(() => {
    if (adminAccounts.length === 0) {
      refreshAdminAccounts();
    }
  }, [adminAccounts.length, refreshAdminAccounts]);

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountStatus>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconcileResult(null);
    try {
      const res = await supabaseService.reconcileAuthAccounts();
      setReconcileResult({
        type: 'success',
        message: `Successfully reconciled ${res.reconciled_students} student(s) and ${res.reconciled_faculty} faculty account(s).`,
      });
      await Promise.all([refreshAdminAccounts(), refreshFaculty()]);
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

  // Selected faculty account for management modal
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

  // Combine unified directory data with faculty data
  const accountsData = useMemo(() => {
    return faculty.map(f => {
      const dirEntry = adminAccounts.find(a => 
        (f.auth_user_id && a.user_id === f.auth_user_id) || 
        a.email.toLowerCase() === f.email.toLowerCase()
      );

      const dept = departments.find(d => d.id === f.department_id);

      const status: AccountStatus = dirEntry?.status || f.status || (f.active ? 'ACTIVE' : 'BLOCKED');
      const lastLogin = dirEntry?.last_sign_in_at || null;

      return {
        id: f.id,
        auth_user_id: f.auth_user_id || dirEntry?.user_id || f.id,
        full_name: f.full_name,
        email: f.email,
        employee_code: f.employee_code,
        faculty_code: f.faculty_code,
        designation: f.designation,
        department_id: f.department_id,
        department_name: dept?.name || 'General Faculty',
        department_code: dept?.code || 'GEN',
        phone: f.phone,
        status,
        last_sign_in_at: lastLogin,
        created_at: dirEntry?.created_at || (f as any).created_at || new Date().toISOString(),
      };
    });
  }, [faculty, adminAccounts, departments]);

  const filteredAccounts = useMemo(() => {
    return accountsData.filter(acc => {
      const matchesSearch = 
        acc.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (acc.faculty_code && acc.faculty_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        acc.designation.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = departmentFilter === 'ALL' || acc.department_id === departmentFilter;
      const matchesStatus = statusFilter === 'ALL' || acc.status === statusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [accountsData, searchTerm, departmentFilter, statusFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshAdminAccounts(),
        refreshFaculty(),
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
        text: 'Please enter a valid official email address (e.g. name@vctm.in).'
      });
      return;
    }

    setIsUpdatingEmail(true);
    setActionMessage(null);
    try {
      const res = await updateAccountCredentials(selectedAccount.auth_user_id, {
        email: clean,
      });

      if (res.success) {
        setSelectedAccount((prev: any) => prev ? { ...prev, email: clean } : null);
        setActionMessage({
          type: 'success',
          text: `Official email successfully updated to "${clean}". Supabase Auth identity, profile, and faculty records are synchronized. Faculty member can log in immediately.`
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to update official email.'
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
      const res = await updateAccountCredentials(selectedAccount.auth_user_id, {
        password: cleanPass,
        isDefaultPassword: false,
      });

      if (res.success) {
        setEditPassword('');
        setShowPassword(false);
        setActionMessage({
          type: 'success',
          text: 'Custom password updated successfully in Supabase Auth. Faculty can log in immediately.'
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
      const res = await updateAccountCredentials(selectedAccount.auth_user_id, {
        password: 'faculty@123',
        isDefaultPassword: true,
      });

      if (res.success) {
        setEditPassword('');
        setActionMessage({
          type: 'success',
          text: 'Institution default password ("faculty@123") set in Supabase Auth. Faculty can log in immediately.'
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

  const handlePasswordReset = async () => {
    if (!selectedAccount) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await requestPasswordReset(selectedAccount.email, selectedAccount.auth_user_id);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Password reset instructions dispatched to ${selectedAccount.email}. Audit log recorded.`
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.error || 'Failed to dispatch password reset instructions.'
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.message || 'Error executing password reset.'
      });
    } finally {
      setActionLoading(false);
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
            ? 'Account has been unblocked. Access restored.' 
            : 'Account has been blocked. Immediate session termination and RLS restriction applied.'
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
        'Account soft-archived by Super Admin. Historical records preserved.'
      );

      if (res.success) {
        setSelectedAccount((prev: any) => prev ? { ...prev, status: 'ARCHIVED' } : null);
        setActionMessage({
          type: 'success',
          text: 'Account has been safely archived. All historical timetables and attendance remain intact.'
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
            <Users className="w-7 h-7 text-[#0f172a]" />
            Faculty Account & Security Directory
          </h1>
          <p className="text-[15px] text-[#475569] font-medium leading-relaxed mt-1">
            Centralized credential management, account status control, session revocation, and security audit trails
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
      <div className="bg-white rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between border border-slate-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by faculty name, employee code, email, designation..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-[#0f172a] placeholder-slate-500 font-medium focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-xs transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#0f172a] shadow-xs">
            <Building2 className="w-4 h-4 text-[#475569]" />
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="bg-transparent border-none text-sm text-[#0f172a] font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
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
                <th className="py-3.5 px-4">Faculty Member</th>
                <th className="py-3.5 px-4">Employee Code</th>
                <th className="py-3.5 px-4">Email / Auth ID</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm bg-white">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#475569]">
                    <Users className="w-8 h-8 text-[#475569] mx-auto mb-2 opacity-50" />
                    <p className="font-bold text-[#0f172a] text-base">No faculty accounts found matching criteria</p>
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
                      {/* Name & Designation */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0f172a] flex items-center gap-2">
                          <span className="text-sm font-bold text-[#0f172a]">{acc.full_name}</span>
                          {acc.faculty_code && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-xs text-[#0f172a] font-mono font-bold border border-slate-200">
                              {acc.faculty_code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#475569] font-medium mt-0.5">{acc.designation}</p>
                      </td>

                      {/* Employee Code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs text-[#0f172a] bg-slate-100 px-2.5 py-1 rounded border border-slate-200 font-bold">
                          {acc.employee_code}
                        </span>
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

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span className="text-sm text-[#0f172a] font-bold block">{acc.department_name}</span>
                        <span className="text-xs text-[#475569] block font-mono font-medium">({acc.department_code})</span>
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

      {/* Account Management & Security Modal */}
      {selectedAccount && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAccount(null)}
          title={`Faculty Account: ${selectedAccount.full_name}`}
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
                  <p className="text-xs text-[#475569] font-medium">{selectedAccount.designation} • {selectedAccount.department_name}</p>
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
                  <span className="text-[#475569] block text-[11px] uppercase font-bold">Official Email</span>
                  <span className="text-[#0f172a] font-mono font-bold text-sm">{selectedAccount.email}</span>
                </div>
                <div>
                  <span className="text-[#475569] block text-[11px] uppercase font-bold">Employee Code</span>
                  <span className="text-[#0f172a] font-mono font-bold text-sm">{selectedAccount.employee_code}</span>
                </div>
                <div>
                  <span className="text-[#475569] block text-[11px] uppercase font-bold">Faculty Shorthand</span>
                  <span className="text-[#0f172a] font-mono font-bold text-xs">{selectedAccount.faculty_code || 'None'}</span>
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

              {/* 1. Official Login Email (Identity) Control */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#475569]" />
                    Official Login Email (Supabase Auth Identity)
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
                    placeholder="faculty.name@vctm.in"
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
                  Changing email updates Supabase Auth, profile, and faculty records atomically. Subject assignments, timetable, and department mapping remain fully intact.
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
                      Are you sure you want to reset the password for <strong className="text-[#0f172a] font-bold">{selectedAccount.full_name}</strong> to institutional default (<code className="text-amber-900 font-mono font-bold">faculty@123</code>)?
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
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDefaultPassConfirm(true)}
                      className="text-xs border-slate-200 text-[#0f172a] hover:bg-slate-50 font-semibold"
                      leftIcon={<Sparkles className="w-3.5 h-3.5 text-blue-600" />}
                    >
                      Reset to Default ("faculty@123")
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePasswordReset}
                      isLoading={actionLoading}
                      className="text-xs text-[#475569] hover:text-[#0f172a] font-semibold"
                      leftIcon={<Mail className="w-3.5 h-3.5 text-[#475569]" />}
                    >
                      Send Reset Link
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
                  Super Admin updates are confirmed immediately without requiring the faculty member to click an email link. Passwords are cryptographically salted and hashed with bcrypt.
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
                        <p className="text-xs font-bold text-[#0f172a]">Block Account Access</p>
                        <p className="text-xs text-[#475569] font-medium">Immediately revokes session and blocks portal login.</p>
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
                        Confirm: Are you sure you want to block {selectedAccount.full_name}'s account?
                      </p>
                      <input
                        type="text"
                        placeholder="Reason for blocking (e.g. Inactive faculty / Administrative request)..."
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
                    <p className="text-xs text-[#475569] font-medium">Restore access and enable authentication for this faculty member.</p>
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
                  This account is archived. Archival preserves historical timetable and attendance records.
                </p>
              )}

              {/* Soft Archive Option */}
              {selectedAccount.status !== 'ARCHIVED' && (
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0f172a]">Archive / Record Departure</p>
                      <p className="text-xs text-[#475569] font-medium">Resignation, retirement, or relieving. Preserves all past teaching and attendance logs.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setArchiveModalTarget({
                          id: selectedAccount.id,
                          name: selectedAccount.full_name,
                          role: 'faculty',
                          identifier: selectedAccount.employee_code,
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

      {/* Archive / Departure Modal */}
      <ArchiveAccountModal
        isOpen={!!archiveModalTarget}
        onClose={() => setArchiveModalTarget(null)}
        target={archiveModalTarget}
        onSuccess={() => {
          setArchiveModalTarget(null);
          setSelectedAccount(null);
          refreshAdminAccounts();
          refreshFaculty();
        }}
      />
    </div>
  );
};

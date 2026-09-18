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
  }, [adminAccounts.length, refreshAdminAccounts]);

  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
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
      const res = await updateAccountCredentials(selectedAccount.auth_user_id, {
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
      const res = await updateAccountCredentials(selectedAccount.auth_user_id, {
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
      const res = await updateAccountCredentials(selectedAccount.auth_user_id, {
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
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-[#00ff88]" />
            Student Account & Security Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Student portal credentials, enrollment authentication, account locks, and security audit records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconcile}
            isLoading={isReconciling}
            leftIcon={<ShieldCheck className={`w-3.5 h-3.5 text-emerald-400 ${isReconciling ? 'animate-spin' : ''}`} />}
            className="border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-300"
          >
            Reconcile Auth Accounts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh Directory
          </Button>
        </div>
      </div>

      {reconcileResult && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
          reconcileResult.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {reconcileResult.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{reconcileResult.message}</span>
          </div>
          <button onClick={() => setReconcileResult(null)} className="text-slate-400 hover:text-white text-xs ml-4">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, roll number, email, section..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">All Years</option>
              {years.map(y => (
                <option key={y.id} value={y.id} className="bg-slate-900 text-white">
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">All Sections</option>
              {sections.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-900 text-emerald-400">Active Only</option>
              <option value="BLOCKED" className="bg-slate-900 text-amber-400">Blocked Only</option>
              <option value="ARCHIVED" className="bg-slate-900 text-slate-400">Archived Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-emerald-500/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Roll Number</th>
                <th className="py-3.5 px-4">Year & Section</th>
                <th className="py-3.5 px-4">Email / Login ID</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <GraduationCap className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-300">No student accounts found matching criteria</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Try adjusting your search terms or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => {
                  const isBlocked = acc.status === 'BLOCKED';
                  const isArchived = acc.status === 'ARCHIVED';

                  return (
                    <tr 
                      key={acc.id} 
                      className={`hover:bg-slate-900/50 transition-colors ${isBlocked ? 'bg-amber-950/10' : isArchived ? 'opacity-60 bg-slate-950/20' : ''}`}
                    >
                      {/* Name & Admission Type */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{acc.full_name}</span>
                          {acc.admission_type && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                              {acc.admission_type}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{acc.department_name}</p>
                      </td>

                      {/* Roll Number */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-[#00ff88] bg-[#00ff88]/10 px-2 py-0.5 rounded border border-[#00ff88]/30 font-bold">
                          {acc.roll_number}
                        </span>
                      </td>

                      {/* Year & Section */}
                      <td className="py-3 px-4">
                        <span className="text-slate-200 font-semibold">{acc.section_name}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">({acc.year_name})</span>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4">
                        <div className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{acc.email}</span>
                        </div>
                        {acc.phone && (
                          <div className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{acc.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        {acc.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        {acc.status === 'BLOCKED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Lock className="w-3 h-3" />
                            Blocked
                          </span>
                        )}
                        {acc.status === 'ARCHIVED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <Archive className="w-3 h-3" />
                            Archived
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-4 text-[11px] text-slate-400 font-mono">
                        {acc.last_sign_in_at ? (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatTimeAgo(acc.last_sign_in_at)}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">Never logged in</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenManage(acc)}
                          className="text-xs hover:text-[#00ff88]"
                          leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
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
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                actionMessage.type === 'success' 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}>
                {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{actionMessage.text}</span>
              </div>
            )}

            {/* Profile Overview */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white">{selectedAccount.full_name}</h4>
                  <p className="text-xs text-slate-400">{selectedAccount.year_name} • {selectedAccount.section_name} • {selectedAccount.department_name}</p>
                </div>
                <div>
                  {selectedAccount.status === 'ACTIVE' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Active Account
                    </span>
                  )}
                  {selectedAccount.status === 'BLOCKED' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Account Blocked
                    </span>
                  )}
                  {selectedAccount.status === 'ARCHIVED' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                      Archived
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Roll Number</span>
                  <span className="text-[#00ff88] font-mono font-bold">{selectedAccount.roll_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Official Email</span>
                  <span className="text-slate-200 font-mono">{selectedAccount.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Admission Type</span>
                  <span className="text-slate-200">{selectedAccount.admission_type || 'Regular'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Last Login</span>
                  <span className="text-slate-200 font-mono">
                    {selectedAccount.last_sign_in_at ? formatTimeAgo(selectedAccount.last_sign_in_at) : 'Never logged in'}
                  </span>
                </div>
              </div>
            </div>

            {/* Super Admin Credential Management Panel */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/25 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/10">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">Account Credential Management</h4>
                    <p className="text-[10px] text-slate-400">Direct Super Admin Auth Controls • Active Immediately</p>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Confirmed Identity
                </span>
              </div>

              {/* 1. Login Email (Identity) Control */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Login Email (Supabase Auth Identity)
                  </label>
                  {selectedAccount.email && (
                    <span className="text-[10px] text-slate-500 font-mono">
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
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateEmail}
                    isLoading={isUpdatingEmail}
                    disabled={!editEmail || editEmail.trim().toLowerCase() === selectedAccount.email.toLowerCase()}
                    leftIcon={<Save className="w-3.5 h-3.5 text-emerald-400" />}
                    className="text-xs shrink-0"
                  >
                    Save Email
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Changing email updates Supabase Auth, profile, and student records atomically. Existing UUIDs and enrollment data remain untouched.
                </p>
              </div>

              {/* 2. Password Management Controls */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
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
                      className="w-full px-3 py-2 pr-9 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
                    className="text-xs shrink-0"
                  >
                    Set Password
                  </Button>
                </div>

                {/* Default Password Reset with Confirmation */}
                {showDefaultPassConfirm ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Confirm Password Reset</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Are you sure you want to reset the password for <strong className="text-white">{selectedAccount.full_name}</strong> to institutional default (<code className="text-cyan-300 font-mono">VctmStudent@2026</code>)?
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDefaultPassConfirm(false)}
                        className="text-xs text-slate-400 hover:text-white"
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
                        className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-950/40"
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
                      className="text-xs border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/40"
                      leftIcon={<Sparkles className="w-3 h-3 text-cyan-400" />}
                    >
                      Reset to Default ("VctmStudent@2026")
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Immediate Login Enabled
                </div>
                <p>
                  Super Admin updates are confirmed immediately without requiring the student to click an email link. Passwords are encrypted with bcrypt and never stored in plaintext.
                </p>
              </div>
            </div>

            {/* Account Status Controls */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Access & Status Enforcement
              </h4>

              {selectedAccount.status === 'ACTIVE' ? (
                <div>
                  {!showBlockConfirm ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">Block Student Access</p>
                        <p className="text-[11px] text-slate-400">Terminates active sessions and prevents ERP portal login.</p>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowBlockConfirm(true)}
                        leftIcon={<Lock className="w-3.5 h-3.5" />}
                      >
                        Block Account
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 p-3 rounded-xl bg-red-950/30 border border-red-500/30">
                      <p className="text-xs text-red-200 font-semibold">
                        Confirm: Are you sure you want to block student {selectedAccount.full_name} ({selectedAccount.roll_number})?
                      </p>
                      <input
                        type="text"
                        placeholder="Reason for blocking (e.g. Fees pending, disciplinary action, leave of absence)..."
                        value={blockReason}
                        onChange={e => setBlockReason(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-red-500/40 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBlockConfirm(false)}
                          className="text-xs text-slate-400"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleToggleBlock}
                          isLoading={actionLoading}
                          className="text-xs"
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
                    <p className="text-xs font-semibold text-amber-300">Account Currently Blocked</p>
                    <p className="text-[11px] text-slate-400">Restore portal access and enable authentication for this student.</p>
                  </div>
                  <Button
                    variant="neon"
                    size="sm"
                    onClick={handleToggleBlock}
                    isLoading={actionLoading}
                    leftIcon={<Unlock className="w-3.5 h-3.5 text-slate-950" />}
                  >
                    Unblock Account
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  This student account is archived. Archival retains past attendance records, assignment marks, and test results.
                </p>
              )}

              {/* Soft Archive Option */}
              {selectedAccount.status !== 'ARCHIVED' && (
                <div className="pt-3 border-t border-slate-800">
                  {!showArchiveConfirm ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-300">Archive Student Account</p>
                        <p className="text-[11px] text-slate-500">Soft-delete while preserving past grades, attendance, and audit history.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowArchiveConfirm(true)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                        leftIcon={<Archive className="w-3.5 h-3.5" />}
                      >
                        Archive
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3 rounded-xl bg-slate-900 border border-slate-700">
                      <p className="text-xs text-slate-300">
                        Archive student {selectedAccount.full_name} ({selectedAccount.roll_number})? All attendance and sessional mark records are permanently retained.
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowArchiveConfirm(false)}
                          className="text-xs text-slate-400"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleArchive}
                          isLoading={actionLoading}
                          className="text-xs"
                        >
                          Confirm Archive
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAccount(null)}
                className="text-xs text-slate-400"
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

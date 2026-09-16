import React, { useState, useMemo } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { AccountStatus } from '../../types/database.types';
import { formatTimeAgo } from '../../lib/utils/dateUtils';

export const FacultyAccountsPage: React.FC = () => {
  const { user: currentSessionUser } = useAuth();
  const { 
    faculty, 
    departments, 
    adminAccounts, 
    refreshAdminAccounts, 
    updateAccountStatus, 
    requestPasswordReset,
    refreshFaculty
  } = useAcademic();

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountStatus>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected faculty account for management modal
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

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
    setActionMessage(null);
    setBlockReason('');
    setShowBlockConfirm(false);
    setShowArchiveConfirm(false);
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
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#00ff88]" />
            Faculty Account & Security Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Centralized credential management, account status control, session revocation, and security audit trails
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Filter and Search Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by faculty name, employee code, email, designation..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                  {d.name} ({d.code})
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
                <th className="py-3.5 px-4">Faculty Member</th>
                <th className="py-3.5 px-4">Employee Code</th>
                <th className="py-3.5 px-4">Email / Auth ID</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-300">No faculty accounts found matching criteria</p>
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
                      {/* Name & Designation */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{acc.full_name}</span>
                          {acc.faculty_code && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                              {acc.faculty_code}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{acc.designation}</p>
                      </td>

                      {/* Employee Code */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {acc.employee_code}
                        </span>
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

                      {/* Department */}
                      <td className="py-3 px-4">
                        <span className="text-slate-300 font-medium">{acc.department_name}</span>
                        <span className="text-[10px] text-slate-500 block font-mono">({acc.department_code})</span>
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
                  <p className="text-xs text-slate-400">{selectedAccount.designation} • {selectedAccount.department_name}</p>
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
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Official Email</span>
                  <span className="text-slate-200 font-mono">{selectedAccount.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Employee Code</span>
                  <span className="text-slate-200 font-mono">{selectedAccount.employee_code}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Faculty Shorthand</span>
                  <span className="text-slate-200 font-mono">{selectedAccount.faculty_code || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Last Login</span>
                  <span className="text-slate-200 font-mono">
                    {selectedAccount.last_sign_in_at ? formatTimeAgo(selectedAccount.last_sign_in_at) : 'Never logged in'}
                  </span>
                </div>
              </div>
            </div>

            {/* Credential Security Panel (Strict Protection Rule: No Plaintext Passwords) */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white">Credential & Password Security</h4>
                </div>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <EyeOff className="w-3 h-3 text-emerald-400" />
                  Protected & Encrypted
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Password State</span>
                  <span className="text-base font-black tracking-widest text-slate-300">••••••••••••</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasswordReset}
                  isLoading={actionLoading}
                  className="text-xs"
                  leftIcon={<KeyRound className="w-3 h-3 text-emerald-400" />}
                >
                  Send Reset Link
                </Button>
              </div>

              <p className="text-[11px] text-slate-400">
                In compliance with institution security policies, passwords are cryptographically salted and hashed. Clicking "Send Reset Link" immediately emails secure password reset instructions to <span className="text-white font-mono">{selectedAccount.email}</span> and writes to the audit log.
              </p>
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
                        <p className="text-xs font-semibold text-white">Block Account Access</p>
                        <p className="text-[11px] text-slate-400">Immediately revokes session and blocks portal login.</p>
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
                        Confirm: Are you sure you want to block {selectedAccount.full_name}'s account?
                      </p>
                      <input
                        type="text"
                        placeholder="Reason for blocking (e.g. Inactive faculty / Administrative request)..."
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
                    <p className="text-[11px] text-slate-400">Restore access and enable authentication for this faculty member.</p>
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
                  This account is archived. Archival preserves historical timetable and attendance records.
                </p>
              )}

              {/* Soft Archive Option */}
              {selectedAccount.status !== 'ARCHIVED' && (
                <div className="pt-3 border-t border-slate-800">
                  {!showArchiveConfirm ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-300">Archive Faculty Member</p>
                        <p className="text-[11px] text-slate-500">Soft-delete while preserving past attendance & mark records.</p>
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
                        Archive {selectedAccount.full_name}? This deactivates the account while keeping all historical lecture entries and attendance records intact.
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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Archive, 
  GraduationCap, 
  Briefcase, 
  Award, 
  Calendar, 
  Search, 
  Filter, 
  RefreshCw, 
  Download, 
  UserPlus, 
  Eye, 
  RotateCcw, 
  History, 
  ShieldCheck, 
  FileDown, 
  UserCheck, 
  UserX, 
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Clock,
  CheckCircle2,
  Database
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { supabaseService } from '../../lib/services/supabaseService';
import { supabase } from '../../lib/supabase/supabaseClient';
import { 
  ArchivedStats, 
  ArchivedRecordItem, 
  AccountStatus,
  AccountLifecycleEntry
} from '../../types/database.types';
import { Button } from '../../components/common/Button';
import { ArchiveAccountModal, ArchiveTarget } from '../../components/admin/ArchiveAccountModal';
import { RestoreAccountModal, RestoreTarget } from '../../components/admin/RestoreAccountModal';
import { FullRecordModal, FullRecordTarget } from '../../components/admin/FullRecordModal';

export const RecordsArchivePage: React.FC = () => {
  const { departments, programs, students, faculty } = useAcademic();

  const [stats, setStats] = useState<ArchivedStats>({
    total_archived: 0,
    former_students: 0,
    former_faculty: 0,
    graduated_students: 0,
    graduated_alumni: 0,
    withdrawn_students: 0,
    transferred_students: 0,
    dropped_out_students: 0,
    resigned_faculty: 0,
    departures_this_year: 0,
  });
  const [records, setRecords] = useState<ArchivedRecordItem[]>([]);
  const [lifecycleLogs, setLifecycleLogs] = useState<AccountLifecycleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'all' | 'students' | 'faculty' | 'alumni' | 'compliance'>('all');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Modal States
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);

  const [fullRecordModalOpen, setFullRecordModalOpen] = useState(false);
  const [fullRecordTarget, setFullRecordTarget] = useState<FullRecordTarget | null>(null);

  // Fetch all archived data
  const loadData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) setIsRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, recordsData, lifecycleData] = await Promise.all([
        supabaseService.fetchArchivedStats(),
        supabaseService.fetchArchivedRecords(),
        supabase
          .from('account_lifecycle')
          .select('*, performer:profiles(full_name, role)')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      setStats(statsData);
      setRecords(recordsData);
      if (lifecycleData.data) {
        setLifecycleLogs(lifecycleData.data as AccountLifecycleEntry[]);
      }
    } catch (err) {
      console.error('Error loading archive data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Setup realtime subscription on account_lifecycle
    const channel = supabase
      .channel('records-archive-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'account_lifecycle' },
        () => {
          loadData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Filtered Records based on tab and inputs
  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      // Tab filter
      if (activeTab === 'students' && item.role !== 'student') return false;
      if (activeTab === 'faculty' && item.role !== 'faculty') return false;
      if (activeTab === 'alumni') {
        if (item.role !== 'student' || (item.status !== 'GRADUATED' && item.status !== 'ALUMNI')) return false;
      }

      // Status dropdown filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      // Department dropdown filter
      if (deptFilter !== 'ALL' && item.department_id !== deptFilter) return false;

      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesId = item.identifier?.toLowerCase().includes(q);
        const matchesEmail = item.email?.toLowerCase().includes(q);
        const matchesPhone = item.phone?.toLowerCase().includes(q);
        const matchesDept = item.department_name?.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesEmail && !matchesPhone && !matchesDept) {
          return false;
        }
      }

      return true;
    });
  }, [records, activeTab, statusFilter, deptFilter, searchTerm]);

  // Export Filtered Records as CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;

    const headers = ['Type', 'Identifier', 'Name', 'Department', 'Program', 'Status', 'Exit Date', 'Archived Date', 'Archived By', 'Reason'];
    const rows = filteredRecords.map(r => [
      r.role.toUpperCase(),
      `"${r.identifier || ''}"`,
      `"${r.name}"`,
      `"${r.department_name || ''}"`,
      `"${r.program_name || ''}"`,
      r.status,
      r.exit_date || '',
      r.archived_at ? r.archived_at.split('T')[0] : '',
      `"${r.archived_by_name || ''}"`,
      `"${(r.exit_reason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vctm_records_archive_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Helper
  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'GRADUATED':
      case 'ALUMNI':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'WITHDRAWN':
      case 'TRANSFERRED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'DROPPED_OUT':
      case 'TERMINATED':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'RESIGNED':
      case 'RETIRED':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'SUSPENDED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center text-primary-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Records & Archive
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/30 font-medium">
                  Super Admin
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Institutional Records Management — Permanent Academic & Personnel Historical Dossiers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary-400' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="ghost"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="text-xs flex items-center gap-2 border border-white/10 text-slate-300 hover:text-white"
          >
            <Download className="w-3.5 h-3.5" />
            Export Archive CSV
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Archived</span>
            <Archive className="w-4 h-4 text-primary-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {stats.total_archived}
          </div>
          <p className="text-[11px] text-slate-500">Historical institutional records</p>
        </div>

        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Former Students</span>
            <GraduationCap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400 tracking-tight">
            {stats.former_students}
          </div>
          <p className="text-[11px] text-slate-500">Withdrawn, alumni & departures</p>
        </div>

        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Former Faculty</span>
            <Briefcase className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            {stats.former_faculty}
          </div>
          <p className="text-[11px] text-slate-500">Resigned, retired & relieved</p>
        </div>

        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Graduated / Alumni</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400 tracking-tight">
            {stats.graduated_alumni}
          </div>
          <p className="text-[11px] text-slate-500">Completed degree programs</p>
        </div>

        <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">This Year's Departures</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
            {stats.departures_this_year}
          </div>
          <p className="text-[11px] text-slate-500">Academic year departures</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('all')}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-primary-400 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          All Archived Records ({records.length})
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'students'
              ? 'border-primary-400 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Archived Students ({stats.former_students})
        </button>

        <button
          onClick={() => setActiveTab('faculty')}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'faculty'
              ? 'border-primary-400 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Archived Faculty ({stats.former_faculty})
        </button>

        <button
          onClick={() => setActiveTab('alumni')}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'alumni'
              ? 'border-primary-400 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          Academic Batches & Alumni ({stats.graduated_alumni})
        </button>

        <button
          onClick={() => setActiveTab('compliance')}
          className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'compliance'
              ? 'border-primary-400 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Retention & Compliance Logs
        </button>
      </div>

      {/* TAB CONTENT: Records Table vs Retention Logs */}
      {activeTab !== 'compliance' ? (
        <div className="space-y-4">
          {/* Search and Filters Bar */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, roll no, emp code, phone, email..."
                className="w-full pl-10 pr-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-primary-500/50"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="GRADUATED">Graduated / Alumni</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                  <option value="TRANSFERRED">Transferred</option>
                  <option value="DROPPED_OUT">Dropped Out</option>
                  <option value="RESIGNED">Resigned</option>
                  <option value="RETIRED">Retired</option>
                  <option value="TERMINATED">Terminated</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="ARCHIVED">General Archive</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Department:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-primary-500/50 max-w-[180px]"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {(searchTerm || statusFilter !== 'ALL' || deptFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                    setDeptFilter('ALL');
                  }}
                  className="text-xs text-primary-400 hover:text-primary-300 underline underline-offset-2 ml-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
                <span>Loading institutional archive...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-500 space-y-3">
                <Archive className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm font-medium">No archived records match your criteria.</p>
                <p className="text-slate-600 max-w-sm mx-auto">
                  When students graduate or faculty resign, archiving their profile moves them here with 100% of their historical data preserved.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="p-4">Entity & Name</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Identifier</th>
                      <th className="p-4">Department & Program</th>
                      <th className="p-4">Departure Status</th>
                      <th className="p-4">Exit Date</th>
                      <th className="p-4">Archived By</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRecords.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center font-bold text-white uppercase text-xs">
                              {item.name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-white text-xs">{item.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{item.email || 'No email registered'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            item.role === 'student'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {item.role}
                          </span>
                        </td>

                        <td className="p-4 font-mono text-slate-300">
                          {item.identifier || '—'}
                        </td>

                        <td className="p-4">
                          <div className="text-slate-200 font-medium">{item.department_name}</div>
                          <div className="text-[11px] text-slate-400">{item.program_name || item.designation || '—'}</div>
                        </td>

                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </td>

                        <td className="p-4 font-mono text-slate-300">
                          {item.exit_date || (item.archived_at ? item.archived_at.split('T')[0] : '—')}
                        </td>

                        <td className="p-4">
                          <div className="text-slate-300">{item.archived_by_name || 'Super Admin'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.archived_at ? new Date(item.archived_at).toLocaleDateString() : '—'}
                          </div>
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setFullRecordTarget({
                                  id: item.id,
                                  name: item.name,
                                  role: item.role,
                                  identifier: item.identifier,
                                  status: item.status,
                                });
                                setFullRecordModalOpen(true);
                              }}
                              title="View Full Historical Record Dossier"
                              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setFullRecordTarget({
                                  id: item.id,
                                  name: item.name,
                                  role: item.role,
                                  identifier: item.identifier,
                                  status: item.status,
                                });
                                setFullRecordModalOpen(true);
                              }}
                              title="Audit Trail"
                              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-primary-400 transition-colors"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setRestoreTarget({
                                  id: item.id,
                                  name: item.name,
                                  role: item.role,
                                  identifier: item.identifier,
                                  currentStatus: item.status,
                                  email: item.email,
                                  exitReason: item.exit_reason || undefined,
                                  exitDate: item.exit_date || undefined,
                                });
                                setRestoreModalOpen(true);
                              }}
                              title="Restore Account to Active"
                              className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* RETENTION & COMPLIANCE LOGS TAB */
        <div className="space-y-6">
          {/* Institutional Compliance Notice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-3 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Institutional Data Retention Policy
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                In strict compliance with statutory university and higher education regulations, institutional records for former students and resigned faculty are permanently preserved. Deletions are forbidden by ERP policy; departure events trigger state transitions into immutable archives.
              </p>
              <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Student Academic & Attendance Records</span>
                  <span className="text-emerald-400 font-semibold font-mono">Permanent (Indefinite)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Faculty Teaching & Marking Logs</span>
                  <span className="text-emerald-400 font-semibold font-mono">Permanent (Indefinite)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Security & Authentication Ban Status</span>
                  <span className="text-emerald-400 font-semibold font-mono">Immediate Session Revocation</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-3 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-primary-400" />
                Audited Lifecycle Operations
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Every state transition, archival procedure, and restoration event is permanently journaled to the <span className="text-primary-400 font-mono">account_lifecycle</span> ledger and cross-referenced against the system audit registry.
              </p>
              <div className="pt-2 border-t border-white/5 text-xs text-slate-400">
                Total journaled transitions: <span className="font-mono text-white font-bold">{lifecycleLogs.length}</span>
              </div>
            </div>
          </div>

          {/* Account Lifecycle Event Ledger */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-primary-400" />
                Account Lifecycle Transitions
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Real-time Stream</span>
            </div>

            {lifecycleLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No lifecycle transitions logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="p-3.5">Timestamp</th>
                      <th className="p-3.5">Entity Type</th>
                      <th className="p-3.5">Action & Transition</th>
                      <th className="p-3.5">Reason / Administrative Remarks</th>
                      <th className="p-3.5">Performed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {lifecycleLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="p-3.5 font-mono text-slate-300 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-white/5 text-slate-300 border border-white/10">
                            {log.entity_type}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold text-white">
                            <span className="text-amber-400 font-mono">{log.old_status || log.previous_status || 'ACTIVE'}</span>
                            {' → '}
                            <span className="text-emerald-400 font-mono">{log.new_status}</span>
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300 max-w-xs truncate">
                          {log.reason || '—'}
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {log.performer?.full_name || 'Super Admin'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <ArchiveAccountModal
        isOpen={archiveModalOpen}
        onClose={() => {
          setArchiveModalOpen(false);
          setArchiveTarget(null);
        }}
        target={archiveTarget}
        onSuccess={() => loadData(true)}
      />

      <RestoreAccountModal
        isOpen={restoreModalOpen}
        onClose={() => {
          setRestoreModalOpen(false);
          setRestoreTarget(null);
        }}
        target={restoreTarget}
        onSuccess={() => loadData(true)}
      />

      <FullRecordModal
        isOpen={fullRecordModalOpen}
        onClose={() => {
          setFullRecordModalOpen(false);
          setFullRecordTarget(null);
        }}
        target={fullRecordTarget}
      />
    </div>
  );
};
export default RecordsArchivePage;

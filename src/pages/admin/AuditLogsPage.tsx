import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  User, 
  FileText, 
  Database, 
  Filter, 
  RefreshCw, 
  KeyRound, 
  Lock, 
  UserX, 
  UserCheck, 
  Eye, 
  Calendar, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { AuditLog } from '../../types/database.types';
import { supabase } from '../../lib/supabase/supabaseClient';

export const AuditLogsPage: React.FC = () => {
  const { auditLogs } = useAcademic();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'AUTH' | 'ACCOUNTS' | 'ACADEMIC' | 'ATTENDANCE'>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [liveLogs, setLiveLogs] = useState<AuditLog[]>(auditLogs);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with context if liveLogs is empty
  React.useEffect(() => {
    setLiveLogs(auditLogs);
  }, [auditLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) {
        setLiveLogs(data as AuditLog[]);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return liveLogs.filter(log => {
      const matchesSearch = 
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.actor_name && log.actor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.actor_role && log.actor_role.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.entity_type.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (categoryFilter === 'ALL') return true;

      const act = log.action.toUpperCase();
      const entity = log.entity_type?.toUpperCase() || '';

      if (categoryFilter === 'AUTH') {
        return act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('PASSWORD') || act.includes('EMAIL') || act.includes('AUTH');
      }
      if (categoryFilter === 'ACCOUNTS') {
        return act.includes('ACCOUNT') || act.includes('BLOCK') || act.includes('UNBLOCK') || act.includes('ARCHIVE') || act.includes('STATUS');
      }
      if (categoryFilter === 'ACADEMIC') {
        return entity.includes('TIMETABLE') || entity.includes('SECTION') || entity.includes('SUBJECT') || entity.includes('DEPARTMENT');
      }
      if (categoryFilter === 'ATTENDANCE') {
        return entity.includes('ATTENDANCE') || act.includes('ATTENDANCE') || act.includes('CORRECTION') || act.includes('CLAIM');
      }

      return true;
    });
  }, [liveLogs, searchTerm, categoryFilter]);

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('BLOCKED') || act.includes('REJECTED')) {
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    }
    if (act.includes('UNBLOCKED') || act.includes('APPROVED') || act.includes('ACTIVE')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (act.includes('PASSWORD') || act.includes('EMAIL') || act.includes('RESET')) {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
    if (act.includes('ARCHIVED')) {
      return 'bg-slate-800 text-slate-400 border-slate-700';
    }
    return 'bg-emerald-500/10 text-[#00ff88] border-emerald-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#00ff88]" />
            Security & System Audit Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable database compliance trail recording authentication events, account status changes, and academic operations
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
            Refresh Ledger
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action event, actor name, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88] transition-colors"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'AUTH', 'ACCOUNTS', 'ACADEMIC', 'ATTENDANCE'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-[#00ff88] text-slate-950 shadow-sm'
                  : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'All Events' :
               cat === 'AUTH' ? 'Auth & Security' :
               cat === 'ACCOUNTS' ? 'Account Admin' :
               cat === 'ACADEMIC' ? 'Academic / Timetable' : 'Attendance'}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-slate-950/90 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Actor / Initiator</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Action Event</th>
                <th className="px-5 py-3.5">Entity Type</th>
                <th className="px-5 py-3.5">Payload Preview</th>
                <th className="px-5 py-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-300">No audit records matching criteria</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">System actions and authentication changes will be recorded here.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 font-bold text-white font-sans">
                      {log.actor_name || (log.actor_role === 'faculty' ? 'Faculty Member' : log.actor_role === 'student' ? 'Student' : log.actor_role === 'hod' ? 'HOD' : 'Central Admin')}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300 uppercase">
                        {log.actor_role || 'SYSTEM'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] border ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300">
                      {log.entity_type}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-[11px] max-w-xs truncate" title={JSON.stringify(log.new_values || log.old_values || {})}>
                      {JSON.stringify(log.new_values || log.old_values || {})}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs hover:text-[#00ff88]"
                        leftIcon={<Eye className="w-3.5 h-3.5 text-emerald-400" />}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log Record: ${selectedLog.action}`}
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">Action Event:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono ${getActionBadge(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Actor:</span>
                <span className="text-white font-bold">{selectedLog.actor_name || 'System'} ({selectedLog.actor_role || 'system'})</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Target Entity:</span>
                <span className="text-white font-mono">{selectedLog.entity_type} {selectedLog.entity_id ? `(${selectedLog.entity_id})` : ''}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-300 font-mono">{new Date(selectedLog.created_at).toISOString()}</span>
              </div>
            </div>

            {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
              <div>
                <span className="text-slate-400 block mb-1 font-bold text-[11px] font-sans">Previous State (old_values):</span>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-amber-300 overflow-x-auto">
                  {JSON.stringify(selectedLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
              <div>
                <span className="text-slate-400 block mb-1 font-bold text-[11px] font-sans">Applied State / Payload (new_values):</span>
                <pre className="p-3 rounded-xl bg-slate-950 border border-emerald-500/20 text-[11px] text-emerald-300 overflow-x-auto">
                  {JSON.stringify(selectedLog.new_values, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLog(null)}
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


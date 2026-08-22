import React, { useState } from 'react';
import { ShieldCheck, Search, Clock, User, FileText, Database } from 'lucide-react';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { formatDateDisplay } from '../../lib/utils/dateUtils';

export const AuditLogsPage: React.FC = () => {
  const { auditLogs } = useAcademic();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.actor_name && log.actor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    log.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#00ff88]" />
            Security & System Audit Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable compliance log tracking attendance marking, rectification approvals, and admin events
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action or actor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff88]"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-3xl border border-emerald-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/90 text-slate-300 font-bold uppercase tracking-wider border-b border-emerald-500/15">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Actor / User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Action Event</th>
                <th className="px-5 py-3.5">Target Entity</th>
                <th className="px-5 py-3.5">Payload Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-emerald-500/5 transition-colors">
                  <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3.5 font-bold text-white">
                    {log.actor_name || (log.actor_role === 'faculty' ? 'Faculty Member' : log.actor_role === 'student' ? 'Student' : log.actor_role === 'hod' ? 'HOD' : 'Central Admin')}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-emerald-500/20 text-emerald-400 uppercase">
                      {log.actor_role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-[#00ff88]">
                    {log.action}
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">
                    {log.entity_type}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-[11px] max-w-xs truncate" title={JSON.stringify(log.new_values || log.old_values || {})}>
                    {JSON.stringify(log.new_values || log.old_values || {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

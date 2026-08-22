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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">System Audit Trail & Security Logs</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable compliance log tracking attendance mutations, rectification approvals, and administrative actions
          </p>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action or actor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vctm-navy-500"
          />
        </div>
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor / Performed By</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Action Event</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Event Payload / Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 font-sans font-semibold text-slate-900">
                    {log.actor_name || 'System Auto-Engine'}
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.actor_role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                      log.actor_role === 'faculty' ? 'bg-blue-100 text-blue-800' :
                      log.actor_role === 'hod' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {log.actor_role || 'system'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-vctm-navy-800">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.entity_type}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-sm truncate font-mono text-[11px]">
                    {log.new_values ? JSON.stringify(log.new_values) : log.old_values ? JSON.stringify(log.old_values) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

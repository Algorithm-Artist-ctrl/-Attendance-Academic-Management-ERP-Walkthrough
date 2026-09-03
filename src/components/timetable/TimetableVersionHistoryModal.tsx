import React, { useEffect, useState } from 'react';
import { 
  History, 
  CheckCircle2, 
  Calendar, 
  User, 
  Clock, 
  FileText, 
  Layers, 
  ArrowRight, 
  ShieldCheck,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TimetableVersion } from '../../types/database.types';
import { timetableIngestionService } from '../../lib/services/timetableIngestionService';
import { useAcademic } from '../../context/AcademicContext';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

interface TimetableVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionId?: string;
  sectionName?: string;
}

export const TimetableVersionHistoryModal: React.FC<TimetableVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  sectionId,
  sectionName,
}) => {
  const { user } = useAuth();
  const { rollbackToVersion, refreshData } = useAcademic();
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadVersions = () => {
    setIsLoading(true);
    timetableIngestionService.fetchTimetableVersions(sectionId)
      .then((data) => setVersions(data))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
      setStatusMsg(null);
    }
  }, [isOpen, sectionId]);

  const handleRollback = async (ver: TimetableVersion) => {
    if (!window.confirm(`Are you sure you want to restore Section ${sectionName || ''} timetable to Version ${ver.version_number}? This will replace the current active timetable with this snapshot.`)) {
      return;
    }

    setRestoringVersionId(ver.id);
    setStatusMsg(null);

    try {
      await rollbackToVersion({
        versionId: ver.id,
        restoredBy: user?.full_name || 'HOD',
      });
      setStatusMsg({
        type: 'success',
        text: `Successfully restored Section ${sectionName || ''} to Version ${ver.version_number}! Live dashboards updated.`,
      });
      await refreshData(true);
      loadVersions();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to restore timetable version.',
      });
    } finally {
      setRestoringVersionId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-white">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[#00ff88]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">
              Timetable Version History
            </h2>
            <p className="text-xs text-slate-400 font-normal">
              Auditable record of published academic schedule versions {sectionName ? `• Section ${sectionName}` : ''}
            </p>
          </div>
        </div>
      }
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Status Notification */}
        {statusMsg && (
          <div className={clsx(
            'p-3 rounded-2xl border text-xs flex items-center gap-2 font-bold animate-in fade-in',
            statusMsg.type === 'success' 
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          )}>
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-bold">
            Loading version logs from Supabase Cloud...
          </div>
        ) : versions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-950/40 border border-emerald-500/15 text-center text-xs text-slate-400 space-y-1">
            <History className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <p className="font-bold text-white">Initial Timetable Active</p>
            <p>No historical revision snapshots have been published yet.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className={clsx(
                  'p-4 rounded-2xl border transition-all text-xs space-y-2',
                  ver.status === 'active'
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(0,255,136,0.1)]'
                    : 'bg-slate-950/80 border-emerald-500/10 hover:border-emerald-500/30'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-emerald-500/30 font-black text-white text-[11px]">
                      Version {ver.version_number}
                    </span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                      ver.status === 'active'
                        ? 'bg-emerald-500/20 text-[#00ff88]'
                        : ver.status === 'superseded'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                    )}>
                      {ver.status === 'active' ? 'Active Schedule' : ver.status === 'superseded' ? 'Superseded' : 'Archived'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-mono">
                      W.E.F. <strong className="text-emerald-300">{ver.effective_from}</strong>
                    </span>

                    {ver.status !== 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRollback(ver)}
                        isLoading={restoringVersionId === ver.id}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
                        className="text-[11px] font-bold border-amber-500/30 text-amber-300 hover:bg-amber-500/10 py-1 px-2.5 h-auto"
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Approved by: <strong className="text-white">{ver.approved_by || 'HOD'}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(ver.approved_at || ver.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {ver.changes_summary && (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/10 text-[11px] text-slate-300 flex items-center justify-between">
                    <div>
                      <span>Summary: </span>
                      <span className="font-semibold text-emerald-400">
                        {ver.changes_summary.total_slots 
                          ? `${ver.changes_summary.total_slots} slots (${ver.changes_summary.source_type || 'Published'})` 
                          : ver.changes_summary.stats 
                          ? `${ver.changes_summary.stats.totalSlots} slots published` 
                          : 'Schedule revision'}
                      </span>
                      {ver.changes_summary.room && (
                        <span className="text-slate-400 ml-2">• Room: {ver.changes_summary.room}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

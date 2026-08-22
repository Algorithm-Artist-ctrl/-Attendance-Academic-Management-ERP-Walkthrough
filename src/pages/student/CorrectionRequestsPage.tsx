import React from 'react';
import { RotateCcw, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademic } from '../../context/AcademicContext';
import { Card } from '../../components/common/Card';
import { AttendanceStatusBadge } from '../../components/common/AttendanceStatusBadge';
import { formatDateDisplay } from '../../lib/utils/dateUtils';

export const CorrectionRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { students, corrections } = useAcademic();

  const student = students.find(s => s.id === user?.student_id) || students[0];
  const myCorrections = corrections.filter(c => c.student_id === student.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance Correction Requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track status of your attendance rectification requests submitted to faculty members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
            Pending: {myCorrections.filter(c => c.status === 'pending').length}
          </span>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
            Approved: {myCorrections.filter(c => c.status === 'approved').length}
          </span>
        </div>
      </div>

      <Card>
        {myCorrections.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <RotateCcw className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
            <h4 className="text-sm font-semibold text-slate-700">No Correction Requests</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven't submitted any attendance correction requests. You can submit requests from your recent lectures table on the dashboard.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Submission Date</th>
                  <th className="px-4 py-3">Lecture Subject</th>
                  <th className="px-4 py-3">Requested Status</th>
                  <th className="px-4 py-3">Reason Provided</th>
                  <th className="px-4 py-3">Review Status</th>
                  <th className="px-4 py-3">Faculty Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myCorrections.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                      {formatDateDisplay(c.created_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {c.record?.session?.subject?.subject_name || 'Subject'}
                      <span className="block text-xs font-normal text-slate-400">
                        Date: {c.record?.session?.session_date}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-emerald-600 text-xs">{c.requested_status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-xs">
                      {c.reason}
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 italic">
                      {c.review_remarks ? (
                        <span>"{c.review_remarks}" — <strong className="not-italic text-slate-700">{c.reviewer?.full_name || 'Faculty'}</strong></span>
                      ) : (
                        <span className="text-slate-400">Awaiting faculty review</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

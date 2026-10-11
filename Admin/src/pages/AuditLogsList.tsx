import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export const AuditLogsList: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await adminFetch<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/v2/admin/audit-logs?page=${page}&limit=30`);

      if (res.success) {
        setLogs(res.data);
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" />
          <span>Administrative Audit Logs</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Immutable, transactional records of all mutating administrative operations ({totalCount} total)
        </p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                <th className="px-4 py-3.5 font-semibold">Staff Actor</th>
                <th className="px-4 py-3.5 font-semibold">Action</th>
                <th className="px-4 py-3.5 font-semibold">Target</th>
                <th className="px-4 py-3.5 font-semibold">Mandatory Reason</th>
                <th className="px-4 py-3.5 font-semibold">Client IP & Request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <div className="h-5 w-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{log.staffEmail}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-mono">{log.staffRole}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-300 truncate max-w-xs">
                      {log.targetType}: {log.targetId}
                    </td>
                    <td className="px-4 py-3.5 text-slate-200 max-w-sm">
                      <p className="truncate" title={log.reason}>{log.reason}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">
                      <div>IP: {log.ip || 'internal'}</div>
                      <div className="truncate max-w-xs" title={log.requestId}>Req: {log.requestId || 'N/A'}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalCount} logs)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

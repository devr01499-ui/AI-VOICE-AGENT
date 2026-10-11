import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PhoneCall, Search, Filter, Play, ChevronLeft, ChevronRight, Shield } from 'lucide-react';

interface CallsListProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const CallsList: React.FC<CallsListProps> = ({ onSelectCustomer }) => {
  const { staff } = useAuth();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        status: statusFilter,
        direction: directionFilter,
      });
      if (search.trim()) params.set('q', search.trim());

      const res = await adminFetch<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/v2/admin/calls?${params.toString()}`);

      if (res.success) {
        setCalls(res.data);
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } catch (err) {
      console.error('Failed to load calls', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [page, statusFilter, directionFilter]);

  const isOwner = staff?.role === 'owner';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-white" />
          <span>Platform Calls & Telephony</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time and historic call sessions across all customer agents ({totalCount} total)
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            fetchCalls();
          }}
          className="flex-1 w-full relative"
        >
          <Search className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipient phone, call ID, or user email..."
            className="w-full pl-10 pr-4 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent focus:outline-none text-xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent focus:outline-none text-xs cursor-pointer"
            >
              <option value="all">All Directions</option>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Recipient Phone</th>
                <th className="px-4 py-3.5 font-semibold">Direction</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Duration</th>
                <th className="px-4 py-3.5 font-semibold">Customer</th>
                <th className="px-4 py-3.5 font-semibold">Agent</th>
                <th className="px-4 py-3.5 font-semibold">Timestamp</th>
                <th className="px-4 py-3.5 font-semibold text-right">Recording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading calls history...</span>
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No calls match the search criteria.
                  </td>
                </tr>
              ) : (
                calls.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-white font-medium">
                      {c.recipientPhoneNumber}
                    </td>
                    <td className="px-4 py-3.5 uppercase font-mono text-[10px] text-slate-400">
                      {c.callDirection || 'outbound'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                          c.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.status === 'in-progress'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-200">
                      {Math.floor((c.durationSeconds || 0) / 60)}m {(c.durationSeconds || 0) % 60}s
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => c.userId && onSelectCustomer?.(c.userId)}
                        className={`text-left text-white font-medium truncate max-w-xs block ${
                          onSelectCustomer && c.userId ? 'cursor-pointer hover:text-white hover:underline' : ''
                        }`}
                      >
                        {c.user?.fullName || 'User'}
                      </button>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">{c.user?.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 truncate max-w-xs">{c.agent?.name || 'Default Agent'}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {isOwner ? (
                        c.recordingUrl ? (
                          <button
                            onClick={() => setPlaybackUrl(c.recordingUrl)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="h-3 w-3" />
                            <span>Play</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">No audio</span>
                        )
                      ) : (
                        <span
                          title="Restricted strictly to Owner per Founder Decision #4"
                          className="text-[10px] text-slate-600 font-mono inline-flex items-center gap-1"
                        >
                          <Shield className="h-3 w-3 text-slate-600" />
                          <span>Owner Only</span>
                        </span>
                      )}
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
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalCount} calls)
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

      {/* Audio Playback Modal for Owner */}
      {playbackUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase">Call Audio Recording</h3>
            <audio controls autoPlay src={playbackUrl} className="w-full" />
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPlaybackUrl(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

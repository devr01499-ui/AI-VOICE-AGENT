import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  PhoneCall,
  Search,
  Filter,
  Play,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle,
  Megaphone,
} from 'lucide-react';

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

  // Identify stale in-progress/ringing calls (> 2 hours old)
  const staleCalls = calls.filter((c) => {
    if (c.status !== 'in_progress' && c.status !== 'ringing') return false;
    const createdAt = new Date(c.createdAt).getTime();
    return Date.now() - createdAt > 2 * 60 * 60 * 1000;
  });

  const getStatusBadge = (status: string, isStale: boolean) => {
    if (isStale) {
      return 'bg-amber-950/80 text-amber-300 border-amber-600 font-bold animate-pulse';
    }
    switch (status) {
      case 'completed':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
      case 'in_progress':
      case 'in-progress':
        return 'bg-blue-950/60 text-blue-400 border-blue-800/60 animate-pulse';
      case 'ringing':
      case 'queued':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/60';
      case 'failed':
      case 'no_answer':
      case 'busy':
        return 'bg-red-950/60 text-red-400 border-red-800/60';
      case 'canceled':
      case 'cancelled':
        return 'bg-zinc-900 text-zinc-400 border-zinc-800';
      default:
        return 'bg-zinc-900 text-zinc-300 border-zinc-800';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-white" />
          <span>Platform Calls & Telephony</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Real-time and historic call sessions across all customer agents and batch campaigns ({totalCount} total)
        </p>
      </div>

      {/* Stale Calls Alert Banner */}
      {staleCalls.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Telephony Warning:</strong> {staleCalls.length} call session(s) in this page have been stuck in &apos;in_progress&apos; or &apos;ringing&apos; for over 2 hours without completion webhooks.
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded border border-amber-700">
            Reconciliation Recommended
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            fetchCalls();
          }}
          className="flex-1 w-full relative"
        >
          <Search className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipient phone, call ID, or user email..."
            className="w-full pl-10 pr-4 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-zinc-300">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent focus:outline-none text-xs cursor-pointer text-zinc-300"
            >
              <option value="all" className="bg-zinc-950">All Statuses</option>
              <option value="completed" className="bg-zinc-950">Completed</option>
              <option value="in_progress" className="bg-zinc-950">In Progress</option>
              <option value="ringing" className="bg-zinc-950">Ringing</option>
              <option value="queued" className="bg-zinc-950">Queued</option>
              <option value="failed" className="bg-zinc-950">Failed</option>
              <option value="no_answer" className="bg-zinc-950">No Answer</option>
              <option value="busy" className="bg-zinc-950">Busy</option>
              <option value="canceled" className="bg-zinc-950">Canceled</option>
            </select>
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-zinc-300">
            <select
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent focus:outline-none text-xs cursor-pointer text-zinc-300"
            >
              <option value="all" className="bg-zinc-950">All Directions</option>
              <option value="outbound" className="bg-zinc-950">Outbound</option>
              <option value="inbound" className="bg-zinc-950">Inbound</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Recipient Phone</th>
                <th className="px-3 py-3.5 font-semibold">Direction</th>
                <th className="px-3 py-3.5 font-semibold">Status</th>
                <th className="px-3 py-3.5 font-semibold">End Reason</th>
                <th className="px-3 py-3.5 font-semibold">Duration</th>
                <th className="px-4 py-3.5 font-semibold">Customer</th>
                <th className="px-4 py-3.5 font-semibold">Agent</th>
                <th className="px-4 py-3.5 font-semibold">Campaign</th>
                <th className="px-4 py-3.5 font-semibold">Timestamp</th>
                <th className="px-4 py-3.5 font-semibold text-right">Recording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-zinc-500">
                    <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading calls history...</span>
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-zinc-500">
                    No calls match the search criteria.
                  </td>
                </tr>
              ) : (
                calls.map((c) => {
                  const isStale = (c.status === 'in_progress' || c.status === 'ringing') &&
                    Date.now() - new Date(c.createdAt).getTime() > 2 * 60 * 60 * 1000;

                  return (
                    <tr key={c.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-white font-medium">
                        {c.recipientPhoneNumber}
                      </td>
                      <td className="px-3 py-3.5 uppercase font-mono text-[10px] text-zinc-400">
                        {c.callDirection || 'outbound'}
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${getStatusBadge(
                            c.status,
                            isStale
                          )}`}
                        >
                          {c.status} {isStale ? '(STALE)' : ''}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        {c.endReason ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-mono font-medium border border-zinc-700 bg-zinc-900 text-zinc-300 inline-block max-w-[120px] truncate"
                            title={c.endDetail ? `${c.endReason}: ${c.endDetail}` : c.endReason}
                          >
                            {c.endReason}
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[10px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-zinc-200">
                        {Math.floor((c.durationSeconds || 0) / 60)}m {(c.durationSeconds || 0) % 60}s
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => c.userId && onSelectCustomer?.(c.userId)}
                          className={`text-left text-white font-medium truncate max-w-xs block ${
                            onSelectCustomer && c.userId ? 'cursor-pointer hover:underline' : ''
                          }`}
                        >
                          {c.user?.fullName || 'User'}
                        </button>
                        <div className="text-[11px] text-zinc-400 font-mono truncate max-w-xs">{c.user?.email}</div>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-300 truncate max-w-xs">{c.agent?.name || 'Default Agent'}</td>
                      
                      {/* Campaign Column */}
                      <td className="px-4 py-3.5 text-zinc-400">
                        {c.batch?.name ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-zinc-200">
                            <Megaphone className="h-3 w-3 text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[120px]">{c.batch.name}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[10px]">Individual Call</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-400">
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
                            <span className="text-[10px] text-zinc-600 font-mono">No audio</span>
                          )
                        ) : (
                          <span
                            title="Restricted strictly to Owner per Founder Decision #4"
                            className="text-[10px] text-zinc-600 font-mono inline-flex items-center gap-1"
                          >
                            <Shield className="h-3 w-3 text-zinc-600" />
                            <span>Owner Only</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3.5 bg-black border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <span>
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalCount} calls)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Audio Playback Modal for Owner */}
      {playbackUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono uppercase">Call Audio Recording</h3>
            <audio controls autoPlay src={playbackUrl} className="w-full" />
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPlaybackUrl(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs rounded-xl cursor-pointer border border-zinc-800"
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

import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { CustomerSummary } from '../types/admin';
import {
  Search,
  User,
  Filter,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Phone,
  Eye,
  ArrowUpDown,
} from 'lucide-react';

interface CustomersListProps {
  onSelectCustomer: (id: string) => void;
}

export const CustomersList: React.FC<CustomersListProps> = ({ onSelectCustomer }) => {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'minutes' | 'calls'>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: statusFilter,
        risk: riskFilter,
      });
      if (search.trim()) params.set('q', search.trim());

      const res = await adminFetch<{
        success: boolean;
        data: CustomerSummary[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/v2/admin/customers?${params.toString()}`);

      if (res.success) {
        let sorted = [...res.data];
        if (sortBy === 'oldest') {
          sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (sortBy === 'minutes') {
          sorted.sort((a, b) => (b.minutesRemainingSeconds || 0) - (a.minutesRemainingSeconds || 0));
        } else if (sortBy === 'calls') {
          sorted.sort((a, b) => (b.callsCount || 0) - (a.callsCount || 0));
        }
        setCustomers(sorted);
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load customers list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, statusFilter, riskFilter, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const getPlanBadge = (type: string) => {
    const t = (type || 'free').toLowerCase();
    switch (t) {
      case 'enterprise':
        return 'bg-purple-900/40 text-purple-300 border-purple-700/50';
      case 'professional':
        return 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50';
      case 'developer':
        return 'bg-blue-900/40 text-blue-300 border-blue-700/50';
      case 'admin':
        return 'bg-amber-900/40 text-amber-300 border-amber-700/50';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="h-5 w-5 text-white" />
            <span>Customers Directory</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Browse, search, inspect balances, track campaigns, and manage all customer accounts ({totalCount} total)
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col lg:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
          <Search className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer email, name, phone, or ID..."
            className="w-full pl-10 pr-4 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-zinc-300 shrink-0">
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
              <option value="active" className="bg-zinc-950">Active Only</option>
              <option value="restricted" className="bg-zinc-950">Restricted</option>
              <option value="suspended" className="bg-zinc-950">Suspended</option>
            </select>
          </div>

          {/* Risk Filter */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-zinc-300 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={riskFilter}
              onChange={(e) => {
                setRiskFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent focus:outline-none text-xs cursor-pointer text-zinc-300"
            >
              <option value="all" className="bg-zinc-950">All Risk Levels</option>
              <option value="none" className="bg-zinc-950">Normal (None)</option>
              <option value="watch" className="bg-zinc-950">Watch</option>
              <option value="high" className="bg-zinc-950">High Risk</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-zinc-300 shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
              }}
              className="bg-transparent focus:outline-none text-xs cursor-pointer text-zinc-300"
            >
              <option value="newest" className="bg-zinc-950">Newest First</option>
              <option value="oldest" className="bg-zinc-950">Oldest First</option>
              <option value="minutes" className="bg-zinc-950">Highest Minutes</option>
              <option value="calls" className="bg-zinc-950">Most Calls</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-white" />
          <span>{error}</span>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-black text-[11px] uppercase tracking-wider text-zinc-400 font-mono border-b border-zinc-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Customer</th>
                <th className="px-3 py-3.5 font-semibold">Plan</th>
                <th className="px-3 py-3.5 font-semibold">Status</th>
                <th className="px-3 py-3.5 font-semibold">Risk</th>
                <th className="px-4 py-3.5 font-semibold">Minutes Balance</th>
                <th className="px-4 py-3.5 font-semibold">Legacy Credits</th>
                <th className="px-4 py-3.5 font-semibold">Usage & Campaigns</th>
                <th className="px-3 py-3.5 font-semibold">Last Seen</th>
                <th className="px-3 py-3.5 font-semibold">Joined</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-zinc-500">
                    <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading customers directory...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-zinc-500">
                    No customers found matching the query.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const minutesLeft = Math.round((c.minutesRemainingSeconds || 0) / 60);
                  const statusColors: Record<string, string> = {
                    active: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
                    restricted: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
                    suspended: 'bg-red-950/80 text-red-300 border-red-800 font-bold',
                  };

                  const riskColors: Record<string, string> = {
                    none: 'bg-zinc-900 text-zinc-400 border-zinc-800',
                    watch: 'bg-amber-950/50 text-amber-300 border-amber-800/60',
                    high: 'bg-red-950/80 text-red-300 border-red-800 font-bold',
                  };

                  const risk = c.adminProfile?.riskLevel || 'none';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCustomer(c.id)}
                      className="hover:bg-zinc-900/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white group-hover:underline transition-colors flex items-center gap-1.5">
                          {c.fullName || 'Anonymous User'}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{c.email}</div>
                        {c.contactNumber && (
                          <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                            <Phone className="h-2.5 w-2.5" />
                            <span>{c.contactNumber}</span>
                          </div>
                        )}
                      </td>

                      {/* Plan Column */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${getPlanBadge(
                            c.accountType
                          )}`}
                        >
                          {c.accountType || 'free'}
                        </span>
                      </td>

                      {/* Status Column */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                            statusColors[c.accountStatus] || 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          {c.accountStatus}
                        </span>
                      </td>

                      {/* Risk Column */}
                      <td className="px-3 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-medium border ${
                            riskColors[risk] || riskColors.none
                          }`}
                        >
                          {risk}
                        </span>
                      </td>

                      {/* Minutes Balance */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-white font-semibold flex items-baseline gap-1">
                          <span className={minutesLeft > 0 ? 'text-emerald-400' : 'text-zinc-400'}>
                            {minutesLeft}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-normal">min remaining</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {c.callingBalanceMinutes.toFixed(1)} cached
                        </div>
                      </td>

                      {/* Legacy Credits */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-zinc-200">
                          ₹{c.billingBalance.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-zinc-500 font-mono uppercase">LEGACY CREDITS</div>
                      </td>

                      {/* Usage & Campaigns */}
                      <td className="px-4 py-3.5">
                        <div className="text-zinc-200 flex items-center gap-1 font-mono text-[11px]">
                          <span>{c.callsCount || 0} calls</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{c.agentsCount || 0} agents</span>
                          <span>•</span>
                          <span>{c.campaignsCount || 0} campaigns</span>
                        </div>
                      </td>

                      {/* Last Seen */}
                      <td className="px-3 py-3.5 font-mono text-[10px] text-zinc-400">
                        {c.lastSeenAt ? (
                          <span>{new Date(c.lastSeenAt).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-zinc-600">Never</span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-3 py-3.5 font-mono text-[11px] text-zinc-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCustomer(c.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Customer 360</span>
                        </button>
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
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalCount} total)
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
    </div>
  );
};

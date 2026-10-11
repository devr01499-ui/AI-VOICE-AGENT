import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { CustomerSummary } from '../types/admin';
import { Search, User, Filter, AlertTriangle, ShieldAlert, ChevronLeft, ChevronRight, Phone, Eye } from 'lucide-react';

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
        setCustomers(res.data);
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
  }, [page, statusFilter, riskFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-400" />
            <span>Customers Directory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse, search, inspect balances, and manage all customer accounts ({totalCount} total)
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
          <Search className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer email, name, phone, or ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 shrink-0">
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
              <option value="active">Active Only</option>
              <option value="restricted">Restricted</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={riskFilter}
              onChange={(e) => {
                setRiskFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent focus:outline-none text-xs cursor-pointer"
            >
              <option value="all">All Risk Levels</option>
              <option value="none">Normal (None)</option>
              <option value="watch">Watch</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Customer</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Risk</th>
                <th className="px-4 py-3.5 font-semibold">Minutes Balance</th>
                <th className="px-4 py-3.5 font-semibold">Legacy Credits</th>
                <th className="px-4 py-3.5 font-semibold">Usage</th>
                <th className="px-4 py-3.5 font-semibold">Joined</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <div className="h-5 w-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading customers directory...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No customers found matching the query.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const minutesLeft = Math.round((c.minutesRemainingSeconds || 0) / 60);
                  const statusColors: Record<string, string> = {
                    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    restricted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
                  };

                  const riskColors: Record<string, string> = {
                    none: 'bg-slate-800 text-slate-400 border-slate-700',
                    watch: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    high: 'bg-red-500/10 text-red-400 border-red-500/20',
                  };

                  const risk = c.adminProfile?.riskLevel || 'none';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCustomer(c.id)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                          {c.fullName || 'Anonymous User'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{c.email}</div>
                        {c.contactNumber && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="h-2.5 w-2.5" />
                            <span>{c.contactNumber}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                            statusColors[c.accountStatus] || 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {c.accountStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-medium border ${
                            riskColors[risk] || riskColors.none
                          }`}
                        >
                          {risk}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono text-white font-semibold">
                          {minutesLeft} <span className="text-[10px] text-slate-400">min</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ({c.callingBalanceMinutes.toFixed(1)} cached)
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono text-slate-300">
                          ₹{c.billingBalance.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono uppercase">LEGACY CREDITS</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-slate-300">
                          {c.callsCount || 0} calls
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {c.agentsCount || 0} agents
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCustomer(c.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[11px] font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
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
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalCount} total)
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

import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { CreditCard, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface PaymentsListProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const PaymentsList: React.FC<PaymentsListProps> = ({ onSelectCustomer }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await adminFetch<{
        success: boolean;
        data: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/v2/admin/payments?page=${page}&limit=25`);

      if (res.success) {
        setPayments(res.data);
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-400" />
          <span>Payments & GST Invoices</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Razorpay payment transactions, minute pack purchases, and tax invoices ({totalCount} total)
        </p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Payment / Order ID</th>
                <th className="px-4 py-3.5 font-semibold">Customer</th>
                <th className="px-4 py-3.5 font-semibold">Plan</th>
                <th className="px-4 py-3.5 font-semibold">Amount</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">GST Invoice</th>
                <th className="px-4 py-3.5 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="h-5 w-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading payment transactions...</span>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-white text-[11px]">{p.paymentId}</div>
                      <div className="font-mono text-slate-500 text-[10px] mt-0.5">{p.orderId}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => p.userId && onSelectCustomer?.(p.userId)}
                        className={`text-left text-white font-medium block ${
                          onSelectCustomer && p.userId ? 'cursor-pointer hover:text-indigo-400 hover:underline' : ''
                        }`}
                      >
                        {p.user?.fullName || 'User'}
                      </button>
                      <div className="text-[11px] text-slate-400 font-mono">{p.user?.email}</div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-200 capitalize">
                      {p.planName}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-white font-bold">
                      ₹{(p.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                          p.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {p.invoice ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-indigo-400">
                            {p.invoice.invoiceNumber}
                          </span>
                          {p.invoice.pdfUrl && (
                            <a
                              href={p.invoice.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-white"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">Pending PDF</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                      {new Date(p.createdAt).toLocaleDateString()}
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
            Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalCount} transactions)
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

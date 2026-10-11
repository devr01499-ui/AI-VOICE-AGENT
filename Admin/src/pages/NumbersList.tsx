import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { Hash, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface NumbersListProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const NumbersList: React.FC<NumbersListProps> = ({ onSelectCustomer }) => {
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNumbers() {
      try {
        setLoading(true);
        const res = await adminFetch<{ success: boolean; data: any[] }>('/api/v2/admin/numbers');
        if (res.success) setNumbers(res.data);
      } catch (err) {
        console.error('Failed to load numbers', err);
      } finally {
        setLoading(false);
      }
    }
    loadNumbers();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Hash className="h-5 w-5 text-indigo-400" />
          <span>Provisioned Phone Numbers</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Carrier inventory, Vobiz numbers, and telephony binding ({numbers.length} numbers)
        </p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Phone Number</th>
                <th className="px-4 py-3.5 font-semibold">Provider</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">KYC Verification</th>
                <th className="px-4 py-3.5 font-semibold">Assigned Customer</th>
                <th className="px-4 py-3.5 font-semibold">Assigned Agent</th>
                <th className="px-4 py-3.5 font-semibold">Purchased</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="h-5 w-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading phone numbers...</span>
                  </td>
                </tr>
              ) : numbers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No phone numbers provisioned on the platform.
                  </td>
                </tr>
              ) : (
                numbers.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-white font-semibold">
                      {n.phoneNumber}
                    </td>
                    <td className="px-4 py-3.5 font-mono uppercase text-slate-400">
                      {n.telephonyProvider}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold ${
                          n.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold inline-flex items-center gap-1 ${
                          n.kycStatus === 'verified'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : n.kycStatus === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {n.kycStatus === 'verified' && <CheckCircle2 className="h-3 w-3" />}
                        {n.kycStatus === 'pending' && <Clock className="h-3 w-3" />}
                        {n.kycStatus === 'failed' && <AlertCircle className="h-3 w-3" />}
                        <span>{n.kycStatus}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => n.userId && onSelectCustomer?.(n.userId)}
                        className={`text-left text-white font-medium block ${
                          onSelectCustomer && n.userId ? 'cursor-pointer hover:text-indigo-400 hover:underline' : ''
                        }`}
                      >
                        {n.user?.fullName || 'User'}
                      </button>
                      <div className="text-[11px] text-slate-400 font-mono">{n.user?.email}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      {n.agent?.name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                      {new Date(n.purchasedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone, Plus, RefreshCw, CheckCircle2, AlertCircle,
  ShieldAlert, Clock, Calendar, Loader2, Mic,
} from 'lucide-react';

interface PhoneNumberRecord {
  id: string;
  phoneNumber: string;
  assignedAgentId: string | null;
  countryCode: string;
  region: string | null;
  type: string;
  status: string;
  kycStatus: string;
  monthlyCost: number;
  setupFee: number;
  currency: string;
  capabilities: string;
  aadhaarRequired: boolean;
  telephonyProvider: string;
  nextBillingDate: string | null;
  purchasedAt: string;
}

function StatusBadge({ status, kycStatus, aadhaarRequired }: { status: string; kycStatus: string; aadhaarRequired: boolean }) {
  if (aadhaarRequired && kycStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <ShieldAlert className="w-3.5 h-3.5" /> KYC Pending
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" /> Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
      <AlertCircle className="w-3.5 h-3.5" /> {status}
    </span>
  );
}

export default function MyNumbersPage() {
  const getRuntimeUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    return envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
  };

  const [numbers, setNumbers] = useState<PhoneNumberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNumbers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/numbers/mine`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load numbers');
      setNumbers(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your numbers. Please refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNumbers(); }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-1">My Numbers</h1>
            <p className="text-sm text-gray-400">Phone numbers provisioned to your workspace via Vobiz.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="refresh-numbers-btn"
              onClick={() => fetchNumbers(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Sync
            </button>
            <a
              id="buy-number-btn"
              href="/dashboard/numbers/buy"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-lg shadow-emerald-200"
            >
              <Plus className="w-4 h-4" /> Buy Number
            </a>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm">Loading your numbers…</p>
          </div>
        ) : numbers.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center mb-6">
              <Phone className="w-9 h-9 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No numbers yet</h2>
            <p className="text-gray-400 mb-8 max-w-sm text-sm">
              Purchase your first phone number to start making outbound calls with your AI agents.
            </p>
            <a
              href="/dashboard/numbers/buy"
              className="flex items-center gap-2 px-7 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-lg shadow-emerald-200"
            >
              <Plus className="w-4 h-4" /> Buy Your First Number
            </a>
          </div>
        ) : (
          /* Numbers List */
          <div className="space-y-4">
            {numbers.map(num => (
              <div
                key={num.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                  {/* Left: number info */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Phone className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-gray-900 tracking-tight">{num.phoneNumber}</p>
                      <p className="text-sm text-gray-400">
                        {num.region || 'Unknown region'} · {num.countryCode} · {num.type}
                      </p>
                    </div>
                  </div>

                  {/* Right: status + meta */}
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={num.status} kycStatus={num.kycStatus} aadhaarRequired={num.aadhaarRequired} />
                    {num.assignedAgentId ? (
                      <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full font-medium">
                        <Mic className="w-3 h-3" /> Agent linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                        No agent
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer row */}
                <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-6 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Purchased: {formatDate(num.purchasedAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Next renewal: {formatDate(num.nextBillingDate)}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-gray-600">
                    {num.currency} {num.monthlyCost?.toFixed(2)}/mo
                    {(num.setupFee || 0) > 0 && ` (+${num.currency} ${num.setupFee?.toFixed(2)} setup)`}
                  </span>
                  <span className="capitalize">{num.telephonyProvider}</span>
                </div>

                {num.aadhaarRequired && num.kycStatus === 'pending' && (
                  <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Aadhaar/KYC verification required to activate this number. Contact support to complete.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

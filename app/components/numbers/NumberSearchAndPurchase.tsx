'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, X, Loader2, AlertCircle, CheckCircle2,
  Phone, Globe, ShieldAlert, Info, ChevronDown, UserCheck, Sparkles,
  ArrowLeft, CreditCard, ShoppingBag, SlidersHorizontal
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';

declare global {
  interface Window { Razorpay: any; }
}

const COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
];

const NUMBER_TYPES = [
  { code: 'local', name: 'Local' },
  { code: 'tollfree', name: 'Toll-Free' },
];

interface VobizNumber {
  id: string;
  e164: string;
  country: string;
  region: string;
  status: string;
  setup_fee: number;
  monthly_fee: number;
  currency: string;
  capabilities?: { voice?: boolean; sms?: boolean; fax?: boolean };
  aadhaar_verification_required?: boolean;
}

interface AgentOption {
  id: string;
  name: string;
}

function CapabilityBadge({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
      active
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-gray-50 text-gray-400 border-gray-200 line-through'
    }`}>
      {label}
    </span>
  );
}

export function NumberSearchAndPurchase() {
  const getRuntimeUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    return envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
  };

  // Filters (Country & Type ONLY per Section 7 — Region/Code input removed)
  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [selectedType, setSelectedType] = useState('local');
  const [countryOpen, setCountryOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  // Search & Pagination State
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [results, setResults] = useState<VobizNumber[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Order Summary Checkout Step State (Section 2)
  const [selectedNumber, setSelectedNumber] = useState<VobizNumber | null>(null);

  // Agent Assignment State
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // Purchase Execution State
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedData, setPurchasedData] = useState<{ id: string; number: string; status: string; nextBillingDate?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refunded, setRefunded] = useState(false);

  // Load available agents for assignment dropdown
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const apiBase = getRuntimeUrl();
        const res = await fetch(`${apiBase}/api/v2/agents`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setAgents(data.data.map((ag: any) => ({ id: ag.id, name: ag.name })));
        }
      } catch {
        // Non-critical fallback
      }
    };
    fetchAgents();
  }, []);

  const handleSearch = useCallback(async (country: string, type: string, targetPage: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const qParams = new URLSearchParams({
        country,
        type,
        page: targetPage.toString(),
        per_page: '15',
      });

      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/numbers/search?${qParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Failed to fetch available numbers');

      const items: VobizNumber[] = data.data.results || [];
      const total = data.data.total || items.length;
      const moreAvailable = data.data.hasMore ?? (items.length === 15);

      if (append) {
        setResults((prev) => [...prev, ...items]);
      } else {
        setResults(items);
      }

      setTotalCount(total);
      setPage(targetPage);
      setHasMore(moreAvailable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    handleSearch(selectedCountry, selectedType, 1, false);
  }, [selectedCountry, selectedType]);

  const loadRazorpay = () => new Promise<boolean>((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handleExecutePurchase = async () => {
    if (!selectedNumber) return;

    setRefunded(false);
    setError(null);
    setPurchasing(true);

    const setupFee = selectedNumber.setup_fee || 0;
    const monthlyFee = selectedNumber.monthly_fee || 0;
    const totalExpectedCost = setupFee + monthlyFee;
    const currency = selectedNumber.currency || 'INR';

    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded) throw new Error('Payment system failed to load. Please check your internet connection.');

      const apiBase = getRuntimeUrl();
      const orderRes = await fetch(`${apiBase}/api/v2/numbers/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          baseCost: monthlyFee,
          setupFee: setupFee,
          currency: currency,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderData.success) {
        throw new Error(typeof orderData.error === 'object' ? orderData.error?.message : orderData.error || 'Order creation failed');
      }
      if (orderData.data?.mock === true || String(orderData.data?.id).startsWith('order_mock_')) {
        throw new Error('Payment system is running in mock mode. Please configure production Razorpay credentials.');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.data.amount,
        currency: 'INR',
        name: 'Claritiy Voice',
        description: `Phone Number Purchase: ${selectedNumber.e164}`,
        order_id: orderData.data.id,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(`${getRuntimeUrl()}/api/v2/numbers/purchase`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
              },
              body: JSON.stringify({
                vobizNumberId: selectedNumber.id,
                expectedPrice: totalExpectedCost,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature || 'mock_signature',
                agentId: selectedAgentId || undefined,
              }),
            });
            const verifyData = await verifyRes.json();
            setPurchasing(false);
            if (!verifyData.success) {
              setRefunded(verifyData.refunded === true);
              setError(verifyData.error || 'Provisioning failed.');
            } else {
              setPurchasedData({
                id: verifyData.data.phoneNumberId,
                number: verifyData.data.number,
                status: verifyData.data.status,
                nextBillingDate: verifyData.data.nextBillingDate,
              });
              setSelectedNumber(null);
            }
          } catch {
            setPurchasing(false);
            setError('Verification failed. If you were charged, your payment will be automatically refunded.');
          }
        },
        modal: {
          ondismiss: () => {
            setPurchasing(false);
          },
        },
        theme: { color: '#059669' },
      };

      const paymentObj = new window.Razorpay(options);
      paymentObj.on('payment.failed', (response: any) => {
        setError(`Payment failed: ${response.error?.description || 'Unknown error'}. No charge was made.`);
        setPurchasing(false);
      });
      paymentObj.open();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during payment processing.');
      setPurchasing(false);
    }
  };

  // ── Success Screen ────────────────────────────────────────────────────────────
  if (purchasedData) {
    return (
      <div className="min-h-screen bg-gray-50/60 p-6 md:p-12 flex items-center justify-center font-sans">
        <div className="bg-white p-8 md:p-10 rounded-[36px] w-full max-w-[540px] shadow-xl border border-gray-100 text-center animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Number Secured!</h2>
          <p className="text-gray-500 mb-2">
            <span className="font-mono font-bold text-gray-900 text-xl">{purchasedData.number}</span>
          </p>
          <p className="text-xs text-gray-400 mb-6">Provisioned to your Claritiy Voice workspace.</p>

          {purchasedData.nextBillingDate && (
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6 text-sm text-gray-600 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Next Renewal Date</span>
              <span className="font-semibold text-gray-800">
                {new Date(purchasedData.nextBillingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}

          {purchasedData.status === 'KYC Required' ? (
            <div className="text-left bg-amber-50 p-4.5 rounded-2xl border border-amber-200 mb-6">
              <div className="flex items-center gap-2 mb-1.5 text-amber-800 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" /> Aadhaar Verification Required
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                This number requires mandatory KYC before outbound calls can be routed. Please contact support to submit document proof.
              </p>
            </div>
          ) : (
            <p className="text-sm text-emerald-600 font-bold mb-6 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Active and ready for call routing.
            </p>
          )}

          <button
            id="go-to-numbers-btn"
            onClick={() => window.location.href = '/dashboard/numbers'}
            className="w-full bg-emerald-600 text-white py-4 rounded-full font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30"
          >
            View My Numbers
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Order Summary Checkout Screen (Section 2 & 4) ────────────────────
  if (selectedNumber) {
    const setupFee = selectedNumber.setup_fee || 0;
    const monthlyFee = selectedNumber.monthly_fee || 0;
    const totalCost = setupFee + monthlyFee;
    const currency = selectedNumber.currency || 'INR';

    return (
      <div className="min-h-screen bg-gray-50/60 p-4 md:p-10 font-sans">
        <div className="max-w-2xl mx-auto bg-white rounded-[36px] p-8 md:p-10 shadow-sm border border-gray-100">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
            <button
              onClick={() => setSelectedNumber(null)}
              disabled={purchasing}
              className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Inventory
            </button>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" /> Order Summary
            </span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 border ${
              refunded
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}>
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="text-sm font-semibold">{error}</p>
                {refunded && (
                  <p className="text-xs mt-1 text-amber-700 font-medium">Your payment has been automatically refunded via Razorpay. It will reflect in 5-7 business days.</p>
                )}
              </div>
            </div>
          )}

          {/* Number Summary Card */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 rounded-3xl p-6 mb-8 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-mono text-2xl font-black text-gray-900 tracking-tight">{selectedNumber.e164}</p>
                  <p className="text-xs font-semibold text-emerald-800 mt-0.5">{selectedNumber.region || selectedNumber.country} · {selectedNumber.country}</p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-white/80 text-emerald-700 rounded-full border border-emerald-200">
                {selectedNumber.status || 'Available'}
              </span>
            </div>
          </div>

          {/* Itemized Pricing Breakdown (Section 2 & 4) */}
          <div className="mb-8 bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Itemized Billing Details</h3>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 font-medium">First Month Service Fee</span>
              <span className="font-bold text-gray-900">{formatCurrency(monthlyFee, currency)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 font-medium">One-Time Activation / Setup Fee</span>
              <span className="font-bold text-gray-900">
                {setupFee > 0 ? formatCurrency(setupFee, currency) : <span className="text-emerald-600 font-bold">Free</span>}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
              <div>
                <span className="text-gray-900 font-extrabold text-base block">Total Due Today</span>
                <span className="text-[11px] text-gray-400 font-normal">Monthly renewal after 30 days</span>
              </div>
              <span className="text-3xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalCost, currency)}</span>
            </div>
          </div>

          {/* Optional Agent Assignment */}
          <div className="mb-8">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" /> Assign to Agent (Optional)
            </label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              disabled={purchasing}
              className="w-full bg-white border-2 border-gray-200 focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-800 focus:outline-none transition-colors"
            >
              <option value="">Unassigned (Route calls manually later)</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>{ag.name}</option>
              ))}
            </select>
          </div>

          {/* KYC Warning */}
          {selectedNumber.aadhaar_verification_required && (
            <div className="mb-8 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>This number requires Aadhaar/KYC submission before outbound calls can be placed. Support will assist you post-purchase.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setSelectedNumber(null)}
              disabled={purchasing}
              className="flex-1 py-4 rounded-full border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="confirm-checkout-btn"
              onClick={handleExecutePurchase}
              disabled={purchasing}
              className="flex-1 py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {purchasing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing Payment…</>
              ) : (
                <><CreditCard className="w-4 h-4" /> Pay {formatCurrency(totalCost, currency)}</>
              )}
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-4 font-medium">
            Secured by Razorpay in INR. Immediate assignment upon payment confirmation.
          </p>

        </div>
      </div>
    );
  }

  // ── Skeleton Loader Component ────────────────────────────────────────────────
  const Skeletons = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-6 rounded-3xl border border-gray-100 bg-white animate-pulse space-y-4">
          <div className="w-48 h-6 bg-gray-200 rounded-lg" />
          <div className="w-32 h-4 bg-gray-100 rounded-md" />
          <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
            <div className="w-28 h-6 bg-gray-200 rounded-lg" />
            <div className="w-24 h-10 bg-gray-200 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );

  const currentCountry = COUNTRIES.find((c) => c.code === selectedCountry) || COUNTRIES[0];
  const currentType = NUMBER_TYPES.find((t) => t.code === selectedType) || NUMBER_TYPES[0];

  // ── Step 1: Full-Page Search & Inventory Grid ─────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/60 p-4 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[36px] border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => window.location.href = '/dashboard/numbers'}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> My Numbers
              </button>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Buy a Phone Number</h1>
            <p className="text-sm text-gray-400 mt-0.5">Explore available numbers powered by Claritiy Voice. Instant setup in INR.</p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Direct Vobiz Inventory
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Filters Top Bar (Country & Type ONLY per Section 7 — Region/Code input REMOVED) */}
        <div className="bg-white p-4 md:p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" /> Filters
          </div>

          {/* Country Dropdown */}
          <div className="relative">
            <button
              id="country-picker-btn"
              onClick={() => { setCountryOpen((o) => !o); setTypeOpen(false); }}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl border-2 border-gray-200 hover:border-emerald-500 bg-white text-sm font-bold text-gray-800 transition-colors shadow-sm"
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>{currentCountry.flag} {currentCountry.name}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${countryOpen ? 'rotate-180' : ''}`} />
            </button>
            {countryOpen && (
              <div className="absolute top-full left-0 mt-2 z-30 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 min-w-[200px]">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setSelectedCountry(c.code); setCountryOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-left transition-colors ${
                      c.code === selectedCountry ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type Dropdown */}
          <div className="relative">
            <button
              id="type-picker-btn"
              onClick={() => { setTypeOpen((o) => !o); setCountryOpen(false); }}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl border-2 border-gray-200 hover:border-emerald-500 bg-white text-sm font-bold text-gray-800 transition-colors shadow-sm"
            >
              <span>Type: {currentType.name}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${typeOpen ? 'rotate-180' : ''}`} />
            </button>
            {typeOpen && (
              <div className="absolute top-full left-0 mt-2 z-30 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 min-w-[180px]">
                {NUMBER_TYPES.map((t) => (
                  <button
                    key={t.code}
                    onClick={() => { setSelectedType(t.code); setTypeOpen(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-left transition-colors ${
                      t.code === selectedType ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results Card Grid */}
        <div>
          {loading ? (
            <Skeletons />
          ) : results.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-[36px] p-16 text-center border border-gray-100 shadow-sm">
              <Globe className="w-12 h-12 mx-auto mb-4 text-emerald-600/40" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">No numbers found</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                No phone numbers match the selected criteria. Try changing your country or number type filters.
              </p>
            </div>
          ) : (
            /* Number Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((num, idx) => {
                const isAadhaar = !!num.aadhaar_verification_required;
                const caps = num.capabilities;
                const currency = num.currency || 'INR';
                const setupFee = num.setup_fee || 0;
                const monthlyFee = num.monthly_fee || 0;

                return (
                  <div
                    key={num.id || idx}
                    className="bg-white rounded-3xl p-6 border border-gray-100 hover:border-emerald-300 transition-all shadow-sm hover:shadow-md flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Row: E.164 and Region/Country */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-mono text-xl font-black text-gray-900 tracking-tight">{num.e164}</div>
                          <div className="text-xs font-semibold text-gray-400 mt-0.5">{num.region || 'National'} · {num.country}</div>
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                          {num.status || 'Available'}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-4">
                        {caps && (
                          <>
                            <CapabilityBadge label="Voice" active={caps.voice !== false} />
                            <CapabilityBadge label="SMS" active={caps.sms === true} />
                          </>
                        )}
                        {isAadhaar && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <ShieldAlert className="w-3 h-3 text-amber-600" /> Aadhaar KYC
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Itemized Pricing & Select Button */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-base font-extrabold text-gray-900">
                          {formatCurrency(monthlyFee, currency)}<span className="text-xs text-gray-400 font-normal">/mo</span>
                        </div>
                        <div className="text-xs font-medium text-gray-400">
                          {setupFee > 0 ? (
                            `+${formatCurrency(setupFee, currency)} setup`
                          ) : (
                            <span className="text-emerald-600 font-semibold">Free setup</span>
                          )}
                        </div>
                      </div>

                      {isAadhaar ? (
                        <div className="relative group/aadhaar">
                          <button
                            disabled
                            className="px-4 py-2.5 rounded-full bg-gray-100 text-gray-400 font-semibold text-xs cursor-not-allowed flex items-center gap-1.5"
                          >
                            <Info className="w-3.5 h-3.5" /> Verification required
                          </button>
                          <div className="absolute bottom-full right-0 mb-2 w-60 bg-gray-900 text-white text-xs rounded-xl p-3 opacity-0 group-hover/aadhaar:opacity-100 pointer-events-none transition-opacity z-20 shadow-xl">
                            This number requires Aadhaar/KYC submission. Contact support to purchase.
                          </div>
                        </div>
                      ) : (
                        <button
                          id={`select-btn-${num.id || idx}`}
                          onClick={() => { setError(null); setSelectedNumber(num); }}
                          className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30"
                        >
                          Select Number
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination & Total Inventory Count (Section 6) */}
        {results.length > 0 && !loading && (
          <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-semibold text-gray-400">
              Showing <span className="font-bold text-gray-800">{results.length}</span> of <span className="font-bold text-gray-800">{totalCount}</span> available numbers
            </p>

            {hasMore && (
              <button
                id="load-more-numbers-btn"
                onClick={() => handleSearch(selectedCountry, selectedType, page + 1, true)}
                disabled={loadingMore}
                className="px-6 py-3 rounded-full border-2 border-emerald-600 text-emerald-700 font-bold text-xs hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading Numbers…</>
                ) : (
                  `Load More Numbers (${totalCount - results.length} remaining)`
                )}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

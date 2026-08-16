'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, X, Loader2, AlertCircle, CheckCircle2,
  Phone, Globe, ShieldAlert, Info, ChevronDown,
} from 'lucide-react';

declare global {
  interface Window { Razorpay: any; }
}

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
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

interface ConfirmModalProps {
  number: VobizNumber;
  onConfirm: () => void;
  onCancel: () => void;
  purchasing: boolean;
}

function ConfirmModal({ number, onConfirm, onCancel, purchasing }: ConfirmModalProps) {
  const total = (number.setup_fee || 0) + (number.monthly_fee || 0);
  const currency = number.currency || 'USD';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-[28px] w-full max-w-[440px] p-8 shadow-2xl animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Confirm Purchase</h2>
          <button
            onClick={onCancel}
            disabled={purchasing}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 mb-6 border border-emerald-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-gray-900">{number.e164}</p>
              <p className="text-sm text-gray-500">{number.region || number.country} · {number.country}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white rounded-xl p-3 border border-emerald-100">
              <p className="text-xs text-gray-400 mb-1">Monthly Fee</p>
              <p className="font-bold text-gray-900">{currency} {number.monthly_fee?.toFixed(2) ?? '—'}/mo</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-emerald-100">
              <p className="text-xs text-gray-400 mb-1">Setup Fee</p>
              <p className="font-bold text-gray-900">{currency} {number.setup_fee?.toFixed(2) ?? '0.00'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6 px-1">
          <span className="text-gray-500 text-sm">Charged today</span>
          <span className="text-2xl font-extrabold text-gray-900">{currency} {total.toFixed(2)}</span>
        </div>

        {number.aadhaar_verification_required && (
          <div className="mb-5 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>This number requires Aadhaar/KYC verification before it can be activated. Contact support after purchase.</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={purchasing}
            className="flex-1 py-3 rounded-full border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="confirm-purchase-btn"
            onClick={onConfirm}
            disabled={purchasing}
            className="flex-1 py-3 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
          >
            {purchasing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
            ) : (
              'Buy Number'
            )}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Payments secured by Razorpay. You won't be charged twice.
        </p>
      </div>
    </div>
  );
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

  const [selectedCountry, setSelectedCountry] = useState('US');
  const [countryOpen, setCountryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VobizNumber[]>([]);
  const [confirmingNumber, setConfirmingNumber] = useState<VobizNumber | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedData, setPurchasedData] = useState<{ id: string; number: string; status: string; nextBillingDate?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refunded, setRefunded] = useState(false);

  const handleSearch = useCallback(async (country: string, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const qParams = new URLSearchParams({ country, type: 'local' });
      if (query) qParams.append('region', query);
      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/numbers/search?${qParams}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch numbers');
      setResults(data.data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { handleSearch(selectedCountry, ''); }, [selectedCountry]);

  useEffect(() => {
    const t = setTimeout(() => handleSearch(selectedCountry, searchQuery), 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadRazorpay = () => new Promise<boolean>((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handleProvision = async (num: VobizNumber) => {
    setRefunded(false);
    setError(null);
    setPurchasing(true);

    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded) throw new Error('Payment system failed to load. Please disable your ad blocker and try again.');

      const apiBase = getRuntimeUrl();
      const orderRes = await fetch(`${apiBase}/api/v2/numbers/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ baseCost: num.monthly_fee || 2.0, setupFee: num.setup_fee || 0 }),
      });
      const orderData = await orderRes.json();
      if (!orderData.success) {
        throw new Error(typeof orderData.error === 'object' ? orderData.error?.message : orderData.error || 'Order creation failed');
      }
      if (orderData.data?.mock === true || String(orderData.data?.id).startsWith('order_mock_')) {
        throw new Error('Payment system is not configured. Please contact support.');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.data.amount,
        currency: orderData.data.currency,
        name: 'Claritiy Voice',
        description: `Phone number: ${num.e164}`,
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
                vobizNumberId: num.id,
                expectedPrice: num.monthly_fee || 2.0,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature || 'mock_signature',
              }),
            });
            const verifyData = await verifyRes.json();
            setPurchasing(false);
            setConfirmingNumber(null);
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
            }
          } catch {
            setPurchasing(false);
            setConfirmingNumber(null);
            setError('Verification failed. If you were charged, please contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            setPurchasing(false);
            setConfirmingNumber(null);
          },
        },
        theme: { color: '#059669' },
      };

      const paymentObj = new window.Razorpay(options);
      paymentObj.on('payment.failed', (response: any) => {
        setError(`Payment failed: ${response.error?.description || 'Unknown error'}. No charge was made.`);
        setPurchasing(false);
        setConfirmingNumber(null);
      });
      paymentObj.open();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
      setPurchasing(false);
      setConfirmingNumber(null);
    }
  };

  // ── Success State ────────────────────────────────────────────────────────────
  if (purchasedData) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <div className="bg-white p-8 rounded-[32px] w-full max-w-[520px] shadow-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight">Number Secured!</h2>
          <p className="text-gray-500 mb-1">
            <span className="font-bold text-gray-900">{purchasedData.number}</span> is now in your workspace.
          </p>
          {purchasedData.nextBillingDate && (
            <p className="text-sm text-gray-400 mb-6">
              Next billing: {new Date(purchasedData.nextBillingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          {purchasedData.status === 'KYC Required' ? (
            <div className="text-left bg-amber-50 p-5 rounded-2xl border border-amber-200 mb-6">
              <div className="flex items-center gap-2 mb-2 text-amber-800 font-semibold">
                <ShieldAlert className="w-4 h-4" /> Aadhaar Verification Required
              </div>
              <p className="text-sm text-amber-700">
                This number requires KYC verification before it can be activated for outbound calls. Please contact support to complete the process.
              </p>
            </div>
          ) : (
            <p className="text-sm text-emerald-600 font-semibold mb-6">✓ Active and ready for outbound calls.</p>
          )}
          <button
            id="go-to-numbers-btn"
            onClick={() => window.location.href = '/dashboard/numbers'}
            className="bg-emerald-600 text-white px-8 py-3 rounded-full font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
          >
            View My Numbers
          </button>
        </div>
      </div>
    );
  }

  // ── Skeleton Loader ──────────────────────────────────────────────────────────
  const Skeletons = () => (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-white animate-pulse">
          <div className="flex flex-col gap-2">
            <div className="w-36 h-5 bg-gray-200 rounded-md" />
            <div className="w-24 h-3.5 bg-gray-100 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-4 bg-gray-200 rounded-md" />
            <div className="w-24 h-9 bg-gray-200 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );

  const currentCountry = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];

  // ── Main UI ──────────────────────────────────────────────────────────────────
  return (
    <>
      {confirmingNumber && (
        <ConfirmModal
          number={confirmingNumber}
          onConfirm={() => handleProvision(confirmingNumber)}
          onCancel={() => { setConfirmingNumber(null); setPurchasing(false); }}
          purchasing={purchasing}
        />
      )}

      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 font-sans">
        <div className="bg-white w-full max-w-[640px] rounded-[32px] p-8 shadow-sm border border-gray-100">

          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-1">Buy a Phone Number</h1>
              <p className="text-sm text-gray-400">Live inventory from Claritiy Voice. Prices in real-time.</p>
            </div>
            <button
              id="close-buy-number"
              className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors shrink-0"
              onClick={() => window.history.back()}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className={`mb-5 p-4 rounded-2xl flex items-start gap-3 border ${
              refunded
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}>
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">{error}</p>
                {refunded && (
                  <p className="text-xs mt-1 text-amber-600">Your payment has been refunded automatically. It may take 5–7 business days to reflect.</p>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 mb-6">
            {/* Country Dropdown */}
            <div className="relative">
              <button
                id="country-dropdown-btn"
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-gray-200 hover:border-emerald-400 focus:border-emerald-500 focus:outline-none transition-colors bg-white text-sm font-semibold text-gray-700"
                onClick={() => setCountryOpen(o => !o)}
              >
                <Globe className="w-4 h-4 text-gray-400" />
                <span>{currentCountry.flag} {currentCountry.code}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${countryOpen ? 'rotate-180' : ''}`} />
              </button>
              {countryOpen && (
                <div className="absolute top-full left-0 mt-2 z-20 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 min-w-[200px]">
                  {COUNTRIES.map(c => (
                    <button
                      key={c.code}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                        c.code === selectedCountry ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                      onClick={() => { setSelectedCountry(c.code); setCountryOpen(false); setSearchQuery(''); }}
                    >
                      <span className="text-base">{c.flag}</span>
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="number-search-input"
                type="text"
                placeholder="Area code or region…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border-2 border-gray-200 focus:border-emerald-500 rounded-2xl py-3 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors text-sm"
              />
            </div>
          </div>

          {/* Results */}
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {loading ? (
              <Skeletons />
            ) : results.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <Globe className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No numbers found for {currentCountry.name}</p>
                <p className="text-sm mt-1">Try a different country or clear the region filter.</p>
              </div>
            ) : (
              results.map((num, idx) => {
                const isAadhaar = !!num.aadhaar_verification_required;
                const caps = num.capabilities;
                const currency = num.currency || 'USD';
                return (
                  <div
                    key={num.id || idx}
                    className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-gray-200 bg-white transition-all group"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="font-mono text-base font-semibold text-gray-900 tracking-tight">{num.e164}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">{num.region || 'Unknown region'} · {num.country}</span>
                        {caps && (
                          <>
                            <CapabilityBadge label="Voice" active={caps.voice !== false} />
                            <CapabilityBadge label="SMS" active={caps.sms === true} />
                          </>
                        )}
                        {isAadhaar && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <ShieldAlert className="w-3 h-3" /> Requires KYC
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{currency} {num.monthly_fee?.toFixed(2)}/mo</p>
                        {(num.setup_fee || 0) > 0 && (
                          <p className="text-xs text-gray-400">+{currency} {num.setup_fee?.toFixed(2)} setup</p>
                        )}
                      </div>
                      {isAadhaar ? (
                        <div className="relative group/aadhaar">
                          <button
                            disabled
                            className="px-4 py-2 rounded-full bg-gray-100 text-gray-400 font-semibold text-sm cursor-not-allowed flex items-center gap-1.5"
                          >
                            <Info className="w-3.5 h-3.5" /> Verification required
                          </button>
                          <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-900 text-white text-xs rounded-xl p-3 opacity-0 group-hover/aadhaar:opacity-100 pointer-events-none transition-opacity z-10">
                            This number requires Aadhaar/KYC verification. Contact support to purchase.
                          </div>
                        </div>
                      ) : (
                        <button
                          id={`provision-btn-${num.id || idx}`}
                          onClick={() => { setError(null); setConfirmingNumber(num); }}
                          disabled={purchasing}
                          className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm shadow-emerald-200 disabled:opacity-50"
                        >
                          Buy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {results.length > 0 && !loading && (
            <p className="text-center text-xs text-gray-400 mt-4">{results.length} number{results.length !== 1 ? 's' : ''} available</p>
          )}

        </div>
      </div>
    </>
  );
}

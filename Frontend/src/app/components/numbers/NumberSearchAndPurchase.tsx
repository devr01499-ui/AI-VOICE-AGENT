'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, CheckCircle2,
  Phone, Globe, ShieldAlert, ShieldCheck, Info, ChevronDown, UserCheck, Sparkles,
  ArrowLeft, Check, SlidersHorizontal, Lock
} from 'lucide-react';
import { formatCurrency } from '../../../lib/formatCurrency';
import { API_BASE } from '../../api';

const COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
];

const NUMBER_TYPES = [
  { code: 'local', name: 'Local' },
  { code: 'tollfree', name: 'Toll-Free' },
];

interface CarrierPhoneNumber {
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
  taxes?: number;
  kyc_requirement?: string;
  provider?: 'vobiz' | 'plivo';
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

interface NumberSearchAndPurchaseProps {
  onBack?: () => void;
  onNavigateToKyc?: () => void;
}

export function NumberSearchAndPurchase({ onBack, onNavigateToKyc }: NumberSearchAndPurchaseProps = {}) {
  const getRuntimeUrl = () => API_BASE;

  // Locked State
  const [checkingLocked, setCheckingLocked] = useState(true);
  const [numberLocked, setNumberLocked] = useState(false);
  const [userNumber, setUserNumber] = useState<string | null>(null);

  // KYC Verification State
  const [accountKycStatus, setAccountKycStatus] = useState<string>('none');
  const [isKycVerified, setIsKycVerified] = useState<boolean>(false);
  const [isKycBlocked, setIsKycBlocked] = useState<boolean>(false);

  // Provider Selection State ('vobiz' | 'plivo')
  const [provider, setProvider] = useState<'vobiz' | 'plivo'>('vobiz');
  const [plivoRegion, setPlivoRegion] = useState('');
  const [plivoSubaccountMapped, setPlivoSubaccountMapped] = useState(false);

  // Filters
  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [selectedType, setSelectedType] = useState('local');
  const [countryOpen, setCountryOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  // Search & Pagination State
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [results, setResults] = useState<CarrierPhoneNumber[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Selection & Confirmation State
  const [selectedNumber, setSelectedNumber] = useState<CarrierPhoneNumber | null>(null);
  const [confirmedWarning, setConfirmedWarning] = useState(false);

  // Agent Assignment State
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // Purchase/Claim Execution State
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedData, setPurchasedData] = useState<{ id: string; number: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimFailure, setClaimFailure] = useState<{
    code: string;
    message: string;
    orderId?: string | null;
    retryable?: boolean;
  } | null>(null);

  // Fetch account-level KYC status
  const fetchKycStatus = useCallback(async () => {
    try {
      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/kyc/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAccountKycStatus(data.data.kycStatus || 'none');
        setIsKycVerified(data.data.isVerified === true || data.data.kycStatus === 'verified');
      }
    } catch {
      // Non-critical check fallback
    }
  }, []);

  // Initial status check for numberLocked and KYC status
  useEffect(() => {
    const checkStatus = async () => {
      setCheckingLocked(true);
      try {
        const apiBase = getRuntimeUrl();
        const res = await fetch(`${apiBase}/api/v2/numbers/status`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        });
        const data = await res.json();
        if (data.success && data.data) {
          if (data.data.numberLocked) {
            setNumberLocked(true);
            setUserNumber(data.data.number);
          }
        }
      } catch {
        // Non-critical check failure fallback
      } finally {
        setCheckingLocked(false);
      }
    };
    checkStatus();
    fetchKycStatus();
  }, [fetchKycStatus]);

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

  // Trigger Plivo subaccount onboarding transparently in background
  const triggerPlivoOnboard = useCallback(async () => {
    try {
      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/numbers/plivo/onboard`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await res.json();
      if (data.success) {
        setPlivoSubaccountMapped(true);
      }
    } catch {
      // Non-critical background call
    }
  }, []);

  const handleSearch = useCallback(async (
    country: string,
    type: string,
    targetPage: number = 1,
    append: boolean = false,
    activeProvider: 'vobiz' | 'plivo' = provider,
    regionFilter: string = plivoRegion
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const apiBase = getRuntimeUrl();

      if (activeProvider === 'plivo') {
        const qParams = new URLSearchParams({
          page: targetPage.toString(),
          per_page: '15',
        });
        if (regionFilter && regionFilter !== 'all') {
          qParams.append('region', regionFilter);
        }

        const res = await fetch(`${apiBase}/api/v2/numbers/plivo/search?${qParams}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.error || 'Failed to fetch Plivo Indian numbers');

        const items: CarrierPhoneNumber[] = (data.data.results || []).map((p: any) => ({
          id: p.id || p.number,
          e164: p.number,
          country: 'India',
          region: p.region,
          status: p.status || 'available',
          setup_fee: p.setupFee || 0,
          monthly_fee: p.monthlyRental || 450,
          currency: p.currency || 'INR',
          taxes: p.taxes || 81,
          kyc_requirement: p.kycRequirement || 'Identity & Address Proof required',
          capabilities: p.capabilities || { voice: true, sms: false, fax: false },
          aadhaar_verification_required: true,
          provider: 'plivo',
        }));

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
      } else {
        // Vobiz Flow — 100% UNCHANGED
        const qParams = new URLSearchParams({
          country,
          type,
          page: targetPage.toString(),
          per_page: '15',
        });

        const res = await fetch(`${apiBase}/api/v2/numbers/search?${qParams}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.error || 'Failed to fetch available numbers');

        const items: CarrierPhoneNumber[] = (data.data.results || []).map((v: any) => ({
          ...v,
          provider: 'vobiz',
        }));
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [provider, plivoRegion]);

  const handleProviderChange = (newProvider: 'vobiz' | 'plivo') => {
    if (newProvider === provider) return;
    setProvider(newProvider);
    setSelectedNumber(null);
    setConfirmedWarning(false);
    setResults([]);
    setPage(1);

    if (newProvider === 'plivo') {
      setSelectedCountry('IN');
      setSelectedType('local');
      triggerPlivoOnboard();
      handleSearch('IN', 'local', 1, false, 'plivo', plivoRegion);
    } else {
      handleSearch(selectedCountry, selectedType, 1, false, 'vobiz', '');
    }
  };

  const handlePlivoRegionFilter = (region: string) => {
    setPlivoRegion(region);
    setPage(1);
    handleSearch('IN', 'local', 1, false, 'plivo', region);
  };

  useEffect(() => {
    if (!numberLocked) {
      handleSearch(selectedCountry, selectedType, 1, false, provider, plivoRegion);
    }
  }, [selectedCountry, selectedType, numberLocked, handleSearch]);

  const handleTriggerKyc = () => {
    if (onNavigateToKyc) {
      onNavigateToKyc();
    } else {
      localStorage.setItem('open_settings_tab', 'kyc');
      window.location.hash = 'kyc';
      window.dispatchEvent(new CustomEvent('navigate_section', { detail: 'settings' }));
    }
  };

  const handleExecuteClaim = async () => {
    if (!selectedNumber || !confirmedWarning) return;

    setError(null);
    setIsKycBlocked(false);
    setPurchasing(true);

    try {
      const apiBase = getRuntimeUrl();
      const isPlivo = selectedNumber.provider === 'plivo' || provider === 'plivo';

      const endpoint = isPlivo
        ? `${apiBase}/api/v2/numbers/plivo/claim`
        : `${apiBase}/api/v2/numbers/claim`;

      const reqBody = isPlivo
        ? {
            number: selectedNumber.e164,
            region: selectedNumber.region,
            agentId: selectedAgentId || undefined,
          }
        : {
            vobizNumberId: selectedNumber.id,
            agentId: selectedAgentId || undefined,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify(reqBody),
      });

      const data = await res.json();
      setPurchasing(false);

      if (!data.success) {
        setError(data.message || data.error || 'Failed to claim phone number.');
        setClaimFailure({
          code: data.code || 'PROVIDER_ERROR',
          message: data.message || data.error || 'Failed to claim phone number.',
          orderId: data.orderId || null,
          retryable: data.retryable !== false,
        });
        if (data.code === 'KYC_NOT_VERIFIED' || data.kycRequired || (data.error && data.error.toLowerCase().includes('kyc'))) {
          setIsKycBlocked(true);
        }
        if (data.numberLocked) {
          setNumberLocked(true);
        }
      } else {
        setPurchasedData({
          id: data.data.phoneNumberId || selectedNumber.id,
          number: data.data.number || selectedNumber.e164,
          status: data.data.status || 'Active',
        });
        setNumberLocked(true);
        setUserNumber(data.data.number || selectedNumber.e164);
        setSelectedNumber(null);
      }
    } catch (err) {
      setPurchasing(false);
      setError(err instanceof Error ? err.message : 'An error occurred during number claim.');
    }
  };

  // ── Loading Locked Check Screen ──────────────────────────────────────────────
  if (checkingLocked) {
    return (
      <div className="min-h-screen bg-gray-50/60 p-6 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-emerald-700 font-bold">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span>Verifying phone number account status…</span>
        </div>
      </div>
    );
  }

  // ── Permanent Locked State View ─────────────────────────────────────────────
  if (numberLocked && !purchasedData) {
    return (
      <div className="min-h-screen bg-gray-50/60 p-6 md:p-12 flex items-center justify-center font-sans">
        <div className="bg-white p-8 md:p-10 rounded-[36px] w-full max-w-[560px] shadow-xl border border-gray-100 text-center animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-inner">
            <Lock className="w-10 h-10 text-emerald-600" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full mb-4 inline-block">
            1 Free Bundled Line Active
          </span>
          <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Phone Number Locked</h2>
          <p className="text-gray-500 mb-4">Your permanent phone number for this account:</p>
          <p className="mb-6">
            <span className="font-mono font-black text-3xl text-emerald-600 tracking-tight">{userNumber || 'Active Phone Number'}</span>
          </p>

          <div className="bg-emerald-50/60 border border-emerald-100 p-5 rounded-2xl text-left mb-8 space-y-2">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" /> Number Active & Verified
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              This number is permanent for your workspace and is bundled into your active subscription. You will not be able to change or re-select this number. Any number updates require manual founder-handled exceptions.
            </p>
          </div>

          <button
            onClick={() => { if (onBack) onBack(); else window.location.href = '/dashboard'; }}
            className="w-full bg-emerald-600 text-white py-4 rounded-full font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

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
            <span className="font-mono font-bold text-gray-900 text-2xl">{purchasedData.number}</span>
          </p>
          <p className="text-xs text-gray-400 mb-6">Provisioned to your Claritiy Voice telephony workspace.</p>

          <div className="text-left bg-emerald-50 p-4.5 rounded-2xl border border-emerald-200 mb-6">
            <div className="flex items-center gap-2 mb-1.5 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Number Active
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Your 1 free bundled number is active and ready to make and receive calls.
            </p>
          </div>

          <button
            id="go-to-numbers-btn"
            onClick={() => { if (onBack) onBack(); else window.location.href = '/dashboard'; }}
            className="w-full bg-emerald-600 text-white py-4 rounded-full font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Confirmation Warning Screen ─────────────────────
  if (selectedNumber) {
    return (
      <div className="min-h-screen bg-gray-50/60 p-4 md:p-10 font-sans">
        <div className="max-w-2xl mx-auto bg-white rounded-[36px] p-8 md:p-10 shadow-sm border border-gray-100">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
            <button
              onClick={() => { setSelectedNumber(null); setConfirmedWarning(false); }}
              disabled={purchasing}
              className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Inventory
            </button>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> 1 Free Bundled Number Selection
            </span>
          </div>

          {/* Structured Failure Card */}
          {claimFailure && (
            <div className="mb-6 p-6 rounded-2xl border bg-red-50/90 text-red-900 border-red-200/80 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-200/60 text-red-800">
                        {claimFailure.code}
                      </span>
                      {claimFailure.retryable && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Retryable
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-red-950">{claimFailure.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setClaimFailure(null); setError(null); }}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Next Steps Card */}
              <div className="p-4 bg-white/80 rounded-xl border border-red-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-gray-900 block mb-0.5">Recommended Next Step:</span>
                  <span className="text-gray-600">
                    {claimFailure.code === 'KYC_NOT_VERIFIED'
                      ? 'Submit required business and identity documents in Compliance Settings.'
                      : claimFailure.code === 'NUMBER_UNAVAILABLE'
                      ? 'Return to the carrier inventory catalogue to select an alternative number.'
                      : claimFailure.retryable
                      ? 'Verify your network connectivity and retry the claim.'
                      : 'Please review account balance and subscription state.'}
                  </span>
                </div>

                {claimFailure.code === 'KYC_NOT_VERIFIED' ? (
                  <button
                    onClick={handleTriggerKyc}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" /> Complete KYC in Settings →
                  </button>
                ) : claimFailure.code === 'NUMBER_UNAVAILABLE' ? (
                  <button
                    onClick={() => { setSelectedNumber(null); setClaimFailure(null); }}
                    className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                  >
                    Choose Another Number
                  </button>
                ) : claimFailure.retryable ? (
                  <button
                    onClick={handleExecuteClaim}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                  >
                    Retry Claim
                  </button>
                ) : null}
              </div>

              {/* Reference ID and Support Link */}
              {claimFailure.orderId && (
                <div className="pt-2 border-t border-red-200/50 flex flex-wrap items-center justify-between gap-2 text-xs text-red-800 font-mono">
                  <span>
                    Reference ID: <strong className="font-bold">{claimFailure.orderId}</strong>
                  </span>
                  <a
                    href={`mailto:support@claritiy.com?subject=Number Claim Assistance: ${claimFailure.orderId}&body=Hello Support, my number claim failed with code ${claimFailure.code} for reference order ${claimFailure.orderId}.`}
                    className="font-bold underline hover:text-red-950 font-sans"
                  >
                    Contact Support with Reference →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Fallback simple error banner if no structured claim failure */}
          {error && !claimFailure && (
            <div className="mb-6 p-4 rounded-2xl flex flex-col gap-2 border bg-red-50 text-red-700 border-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Selected Number Card */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 rounded-3xl p-6 mb-6 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-mono text-2xl font-black text-gray-900 tracking-tight">{selectedNumber.e164}</p>
                  <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                    {selectedNumber.region || selectedNumber.country} · {selectedNumber.country}
                    {selectedNumber.provider === 'plivo' && (
                      <span className="ml-2 font-bold text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Plivo Subaccount
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-white/80 text-emerald-700 rounded-full border border-emerald-200">
                Covered by Plan
              </span>
            </div>

            {/* Provider-Specific Transparency Breakdown */}
            {selectedNumber.provider === 'plivo' && (
              <div className="pt-4 border-t border-emerald-500/10 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Customer Monthly Rental:</span>
                  <span className="font-bold text-gray-800">₹{selectedNumber.monthly_fee || 450}.00 / month</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Applicable Indian Taxes (18% GST):</span>
                  <span className="font-bold text-gray-800">₹{selectedNumber.taxes || 81}.00</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Carrier Setup Fee:</span>
                  <span className="font-bold text-emerald-700">₹{selectedNumber.setup_fee || 0}.00 (Waived)</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>KYC Compliance:</span>
                  <span className="font-semibold text-amber-700">DoT Statutory ID & Address Verification</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Activation Status:</span>
                  <span className="font-bold text-emerald-700">Immediate Assignment upon Claim</span>
                </div>
                <div className="pt-2 border-t border-emerald-500/10 flex justify-between font-bold text-emerald-900">
                  <span>Billed to Customer Today:</span>
                  <span className="text-emerald-700 font-black">₹0 (Included in Platform Plan)</span>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Permanent Lock Warning Box */}
          <div className="mb-8 p-6 rounded-3xl bg-amber-50 border-2 border-amber-200 text-amber-900 space-y-3">
            <div className="flex items-center gap-2 font-black text-base text-amber-950">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" /> Permanent Number Selection Warning
            </div>
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
              "This number is permanent once selected — you will not be able to change it later. Choose carefully."
            </p>
            <p className="text-[11px] text-amber-800/80 leading-normal">
              Your plan includes exactly 1 free bundled phone number. Selecting this number locks your choice permanently.
            </p>
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

          {/* Explicit Checkbox Requirement */}
          <div className="mb-8 bg-gray-50 p-4 rounded-2xl border border-gray-200 flex items-start gap-3">
            <input
              type="checkbox"
              id="confirm-permanent-checkbox"
              checked={confirmedWarning}
              onChange={(e) => setConfirmedWarning(e.target.checked)}
              disabled={purchasing}
              className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
            />
            <label htmlFor="confirm-permanent-checkbox" className="text-xs text-gray-700 font-semibold cursor-pointer leading-snug">
              I understand that this number selection is permanent and cannot be changed later.
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => { setSelectedNumber(null); setConfirmedWarning(false); }}
              disabled={purchasing}
              className="flex-1 py-4 rounded-full border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="confirm-claim-btn"
              onClick={handleExecuteClaim}
              disabled={purchasing || !confirmedWarning}
              className="flex-1 py-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {purchasing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Provisioning Number…</>
              ) : (
                <><Check className="w-4 h-4" /> Confirm & Claim My Bundled Number</>
              )}
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-4 font-medium">
            Covered 100% by your active plan payment. Immediate assignment & locking.
          </p>

        </div>
      </div>
    );
  }

  // ── Skeleton Loader Component ────────────────────────────────────────────────
  const Skeletons = () => (
    <div className="bg-white rounded-[28px] border border-gray-100 overflow-hidden shadow-sm p-6 space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse w-full" />
      ))}
    </div>
  );

  const currentCountry = COUNTRIES.find((c) => c.code === selectedCountry) || COUNTRIES[0];
  const currentType = NUMBER_TYPES.find((t) => t.code === selectedType) || NUMBER_TYPES[0];

  // ── Step 1: Full-Page Search & Inventory List View ─────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/60 p-4 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[36px] border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => { if (onBack) onBack(); else window.location.href = '/dashboard'; }}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
              </button>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Select Your Bundled Phone Number</h1>
            <p className="text-sm text-gray-400 mt-0.5">Your plan includes 1 free phone number. Choose your number carefully below.</p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full flex items-center gap-1.5 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> 1 Free Line Included
            </span>
          </div>
        </div>

        {/* Provider Selection Tabs */}
        <div className="bg-white p-4 md:p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">Telephony Provider</span>
            <div className="flex items-center gap-2 p-1.5 bg-gray-100 rounded-2xl border border-gray-200/80 w-fit">
              <button
                type="button"
                id="provider-vobiz-btn"
                onClick={() => handleProviderChange('vobiz')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  provider === 'vobiz'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>Vobiz Network</span>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">Standard</span>
              </button>
              <button
                type="button"
                id="provider-plivo-btn"
                onClick={() => handleProviderChange('plivo')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  provider === 'plivo'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>Plivo Carrier</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${provider === 'plivo' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  India Local Only
                </span>
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500 flex items-center gap-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-100 max-w-md">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {provider === 'plivo'
                ? 'Plivo integration provisions Indian local (+91) numbers into dedicated, customer-isolated subaccounts with centralized parent billing.'
                : 'Vobiz provides high-throughput SIP trunks and global voice routing. Unchanged and fully active.'}
            </span>
          </div>
        </div>

        {/* KYC Account Verification Prompt Banner */}
        {!isKycVerified && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Account KYC Verification Required
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Complete account KYC verification once to claim phone numbers requiring identity verification.
                </p>
              </div>
            </div>
            <button
              onClick={handleTriggerKyc}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              Complete KYC in Settings
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2 text-red-700 text-sm font-semibold">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
            {(isKycBlocked || error.toLowerCase().includes('kyc')) && (
              <div className="pt-1 pl-8">
                <button
                  onClick={handleTriggerKyc}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer w-fit"
                >
                  <ShieldCheck className="w-4 h-4" /> Complete KYC & Compliance in Settings →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filters Top Bar */}
        <div className="bg-white p-4 md:p-6 rounded-[28px] border border-gray-100 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" /> Filters
          </div>

          {provider === 'plivo' ? (
            /* Plivo-specific Filters: Locked to India Local Only + City Filter */
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 text-sm font-bold text-emerald-800 shadow-sm">
                <span>🇮🇳 India (Local Only)</span>
              </div>

              {/* Plivo City/Region Quick Selector */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl border border-gray-200">
                {[
                  { label: 'All Cities', value: '' },
                  { label: 'Bengaluru', value: 'Bengaluru' },
                  { label: 'Mumbai', value: 'Mumbai' },
                  { label: 'Delhi', value: 'Delhi' },
                  { label: 'Hyderabad', value: 'Hyderabad' },
                  { label: 'Chennai', value: 'Chennai' },
                ].map((reg) => (
                  <button
                    key={reg.label}
                    onClick={() => handlePlivoRegionFilter(reg.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      plivoRegion === reg.value
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {reg.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Existing Vobiz Country & Type Dropdowns - UNCHANGED */
            <>
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
            </>
          )}
        </div>

        {/* Results Compact Table Layout */}
        <div>
          {loading ? (
            <Skeletons />
          ) : results.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-[36px] p-16 text-center border border-gray-100 shadow-sm">
              <Globe className="w-12 h-12 mx-auto mb-4 text-emerald-600/40" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">No numbers found</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                {provider === 'plivo'
                  ? 'No Indian local numbers match your region filter. Try selecting "All Cities" or clearing filters.'
                  : 'No phone numbers match the selected criteria. Try changing your country or number type filters.'}
              </p>
            </div>
          ) : (
            /* Compact Table Layout (Fits 15+ numbers without scrolling) */
            <div className="bg-white rounded-[28px] border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="text-left px-6 py-4 font-bold">Phone Number</th>
                      <th className="text-left px-5 py-4 font-bold">Region & Provider</th>
                      <th className="text-left px-5 py-4 font-bold">Capabilities</th>
                      <th className="text-left px-5 py-4 font-bold">Customer Rate & Taxes</th>
                      <th className="text-left px-5 py-4 font-bold">Requirements</th>
                      <th className="text-right px-6 py-4 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((num, idx) => {
                      const isAadhaar = !!num.aadhaar_verification_required;
                      const caps = num.capabilities;
                      const isPlivo = num.provider === 'plivo' || provider === 'plivo';

                      return (
                        <tr key={num.id || idx} className="hover:bg-emerald-50/30 transition-all">
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <div className="font-mono text-base font-black text-gray-900 tracking-tight">{num.e164}</div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="text-xs font-semibold text-gray-700">{num.region || 'National'}</div>
                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                              <span>{num.country}</span>
                              <span>·</span>
                              <span className={`font-semibold ${isPlivo ? 'text-emerald-700' : 'text-gray-500'}`}>
                                {isPlivo ? 'Plivo Carrier' : 'Vobiz Network'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {caps && (
                                <>
                                  <CapabilityBadge label="Voice" active={caps.voice !== false} />
                                  <CapabilityBadge label="SMS" active={caps.sms === true} />
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {isPlivo ? (
                              <div>
                                <div className="text-xs font-extrabold text-emerald-600">Included in Plan</div>
                                <div className="text-[10px] text-gray-500 font-medium">₹450/mo + ₹81 GST (Waived)</div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-xs font-extrabold text-emerald-600">Included in Plan</div>
                                <div className="text-[10px] text-gray-400">₹0 additional charge</div>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {isPlivo ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <ShieldAlert className="w-3 h-3 text-amber-600" /> Statutory DoT KYC
                              </span>
                            ) : isAadhaar ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <ShieldAlert className="w-3 h-3 text-amber-600" /> Aadhaar KYC
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Bundled Free
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap text-right">
                            {(isAadhaar || isPlivo) && !isKycVerified ? (
                              <button
                                onClick={handleTriggerKyc}
                                className="px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1 ml-auto cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" /> Complete KYC to Claim
                              </button>
                            ) : (
                              <button
                                id={`select-btn-${num.id || idx}`}
                                onClick={() => { setError(null); setSelectedNumber(num); setConfirmedWarning(false); }}
                                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm hover:shadow-md ml-auto cursor-pointer"
                              >
                                Select Number
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Pagination & Total Inventory Count */}
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
                className="px-6 py-3 rounded-full border-2 border-emerald-600 text-emerald-700 font-bold text-xs hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, CheckCircle2,
  Phone, Globe, ShieldAlert, Info, ChevronDown, UserCheck, Sparkles,
  ArrowLeft, Check, SlidersHorizontal, Lock
} from 'lucide-react';
import { formatCurrency } from '../../../lib/formatCurrency';

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

interface NumberSearchAndPurchaseProps {
  onBack?: () => void;
}

export function NumberSearchAndPurchase({ onBack }: NumberSearchAndPurchaseProps = {}) {
  const getRuntimeUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    return envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
  };

  // Locked State
  const [checkingLocked, setCheckingLocked] = useState(true);
  const [numberLocked, setNumberLocked] = useState(false);
  const [userNumber, setUserNumber] = useState<string | null>(null);

  // Filters
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

  // Selection & Confirmation State
  const [selectedNumber, setSelectedNumber] = useState<VobizNumber | null>(null);
  const [confirmedWarning, setConfirmedWarning] = useState(false);

  // Agent Assignment State
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  // Purchase/Claim Execution State
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedData, setPurchasedData] = useState<{ id: string; number: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial status check for numberLocked
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
  }, []);

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
    if (!numberLocked) {
      handleSearch(selectedCountry, selectedType, 1, false);
    }
  }, [selectedCountry, selectedType, numberLocked]);

  const handleExecuteClaim = async () => {
    if (!selectedNumber || !confirmedWarning) return;

    setError(null);
    setPurchasing(true);

    try {
      const apiBase = getRuntimeUrl();
      const res = await fetch(`${apiBase}/api/v2/numbers/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          vobizNumberId: selectedNumber.id,
          agentId: selectedAgentId || undefined,
        }),
      });

      const data = await res.json();
      setPurchasing(false);

      if (!data.success) {
        setError(data.error || 'Failed to claim phone number.');
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

  // ── Permanent Locked State View (Section 4 & Section 6) ─────────────────────
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
          <p className="text-xs text-gray-400 mb-6">Provisioned to your Vobiz sub-account & Claritiy Voice workspace.</p>

          {purchasedData.status === 'KYC Required' ? (
            <div className="text-left bg-amber-50 p-4.5 rounded-2xl border border-amber-200 mb-6">
              <div className="flex items-center gap-2 mb-1.5 text-amber-800 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" /> Aadhaar Verification Required
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                This number requires mandatory KYC before outbound calls can be routed. Support will contact you to confirm documentation.
              </p>
            </div>
          ) : (
            <div className="text-left bg-emerald-50 p-4.5 rounded-2xl border border-emerald-200 mb-6">
              <div className="flex items-center gap-2 mb-1.5 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Number Active
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                Your 1 free bundled number is active and ready to make and receive calls.
              </p>
            </div>
          )}

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

  // ── Step 2: Explicit Confirmation Warning Modal/Screen (Section 3 Step 4) ─────
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

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl flex items-start gap-3 border bg-red-50 text-red-700 border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="text-sm font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Selected Number Card */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 rounded-3xl p-6 mb-6 border border-emerald-500/20">
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
                Covered by Plan
              </span>
            </div>
          </div>

          {/* Mandatory Permanent Lock Warning Box (Section 3 Step 4) */}
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

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Filters Top Bar */}
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
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                          Bundled Free
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

                    {/* Bottom Row: Bundled Plan Status & Select Button */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-emerald-600">
                          Included in Plan
                        </div>
                        <div className="text-xs font-medium text-gray-400">
                          ₹0 additional charge
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
                          onClick={() => { setError(null); setSelectedNumber(num); setConfirmedWarning(false); }}
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

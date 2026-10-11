import React, { useEffect, useState } from 'react';
import { adminFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard,
  Plus,
  Link as LinkIcon,
  Download,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

export const PlansList: React.FC = () => {
  const { hasPermission } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom Plan Modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [customPlan, setCustomPlan] = useState({
    name: '',
    priceInr: 2999,
    minutes: 1000,
    accountType: 'growth',
    customerUserId: '',
    validityDays: 30,
    discountPercent: 0,
  });

  // Payment Link Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [paymentLinkData, setPaymentLinkData] = useState({
    customerUserId: '',
    planKey: '',
    amountInr: 2999,
    minutes: 1000,
    discountPercent: 0,
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminFetch<{ success: boolean; data: any[] }>('/api/v2/admin/plans');
      if (res.success) setPlans(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setActionError(null);
      await adminFetch('/api/v2/admin/plans/custom', {
        method: 'POST',
        body: JSON.stringify(customPlan),
      });
      setPlanModalOpen(false);
      setCustomPlan({
        name: '',
        priceInr: 2999,
        minutes: 1000,
        accountType: 'growth',
        customerUserId: '',
        validityDays: 30,
        discountPercent: 0,
      });
      fetchPlans();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setActionError(null);
      const res = await adminFetch<{ success: boolean; data: { shortUrl: string } }>(
        '/api/v2/admin/payments/create-link',
        {
          method: 'POST',
          body: JSON.stringify(paymentLinkData),
        }
      );
      if (res.success && res.data) {
        setGeneratedLink(res.data.shortUrl);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExport = (type: 'customers' | 'calls' | 'payments') => {
    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
    window.open(`${apiBase}/api/v2/admin/exports/${type}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-400" />
            <span>Plan Catalog & Payment Links</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pricing catalog, custom enterprise plans, and discounted payment links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasPermission('payment_links:create') && (
            <button
              onClick={() => {
                setGeneratedLink(null);
                setActionError(null);
                setLinkModalOpen(true);
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LinkIcon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Generate Payment Link</span>
            </button>
          )}

          {hasPermission('plans:manage') && (
            <button
              onClick={() => {
                setActionError(null);
                setPlanModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Custom Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* CSV Export Bar */}
      {hasPermission('exports:csv') && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Download className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">
              Operational CSV Data Exports:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('customers')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono cursor-pointer border border-slate-700"
            >
              Customers CSV
            </button>
            <button
              onClick={() => handleExport('calls')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono cursor-pointer border border-slate-700"
            >
              Calls CSV
            </button>
            <button
              onClick={() => handleExport('payments')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono cursor-pointer border border-slate-700"
            >
              Payments CSV
            </button>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <div className="h-6 w-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
          <span>Loading catalog...</span>
        </div>
      ) : plans.length === 0 ? (
        <div className="p-10 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500">
          No plans registered in catalog. Click "Create Custom Plan" above to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-semibold border ${
                      p.isPublic
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}
                  >
                    {p.isPublic ? 'Public Catalog' : 'Private Custom Plan'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {p.accountType}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white tracking-tight">{p.name}</h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{p.key}</p>

                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price (INR)</span>
                    <span className="font-mono font-bold text-white">₹{p.priceInr.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Included Minutes</span>
                    <span className="font-mono font-bold text-emerald-400">{p.minutes} mins</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rate per min</span>
                    <span className="font-mono text-slate-300">
                      ₹{(p.priceInr / (p.minutes || 1)).toFixed(2)}
                    </span>
                  </div>
                  {p.validityDays && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Validity</span>
                      <span className="font-mono text-slate-400">{p.validityDays} days</span>
                    </div>
                  )}
                  {p.customerUserId && (
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Target User</span>
                      <span className="font-mono text-[10px] text-purple-400 truncate max-w-[140px]">
                        {p.customerUserId}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>By: {p.createdBy || 'System'}</span>
                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Custom Plan */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Create Custom Private Plan</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Create a custom negotiated plan with role discount cap enforcement.
            </p>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Plan Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise VIP Bundle (5k mins)"
                  value={customPlan.name}
                  onChange={(e) => setCustomPlan({ ...customPlan, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Minutes</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={customPlan.minutes}
                    onChange={(e) =>
                      setCustomPlan({ ...customPlan, minutes: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Price (₹ INR)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={customPlan.priceInr}
                    onChange={(e) =>
                      setCustomPlan({ ...customPlan, priceInr: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Discount % Applied</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={customPlan.discountPercent}
                    onChange={(e) =>
                      setCustomPlan({
                        ...customPlan,
                        discountPercent: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Validity (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={customPlan.validityDays}
                    onChange={(e) =>
                      setCustomPlan({
                        ...customPlan,
                        validityDays: parseInt(e.target.value, 10) || 30,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Customer User ID (Optional)</label>
                <input
                  type="text"
                  placeholder="UUID of target customer"
                  value={customPlan.customerUserId}
                  onChange={(e) =>
                    setCustomPlan({ ...customPlan, customerUserId: e.target.value.trim() })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generate Payment Link */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon className="h-5 w-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Generate Razorpay Payment Link</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Sends an instant checkout URL to the customer.
            </p>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {generatedLink ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/20 space-y-2">
                  <p className="text-xs font-semibold text-emerald-400">Payment Link Generated Successfully!</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={generatedLink}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setLinkModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreatePaymentLink} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Customer User ID</label>
                  <input
                    type="text"
                    required
                    placeholder="User ID UUID"
                    value={paymentLinkData.customerUserId}
                    onChange={(e) =>
                      setPaymentLinkData({
                        ...paymentLinkData,
                        customerUserId: e.target.value.trim(),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Amount (₹ INR)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={paymentLinkData.amountInr}
                      onChange={(e) =>
                        setPaymentLinkData({
                          ...paymentLinkData,
                          amountInr: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Minutes Included</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={paymentLinkData.minutes}
                      onChange={(e) =>
                        setPaymentLinkData({
                          ...paymentLinkData,
                          minutes: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Discount %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={paymentLinkData.discountPercent}
                    onChange={(e) =>
                      setPaymentLinkData({
                        ...paymentLinkData,
                        discountPercent: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setLinkModalOpen(false)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Generating...' : 'Generate Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

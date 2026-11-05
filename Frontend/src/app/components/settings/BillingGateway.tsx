import React, { useState, useEffect } from "react";
import { fetchProfile, updateBillingConfig, apiClient } from "../../api";
import { Key, CreditCard, ShieldAlert, CheckCircle2, RefreshCw, Zap } from "lucide-react";

export default function BillingGateway() {
  const [geminiKey, setGeminiKey] = useState("");
  const [obscureKey, setObscureKey] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("trial");
  const [purchasingPlan, setPurchasingPlan] = useState(false);

  const handlePurchasePlan = async () => {
    try {
      setPurchasingPlan(true);
      setErrorMsg("");
      setSuccessMsg("");

      const res = await apiClient.post('/api/v2/billing/create-plan-order', {
        planName: selectedPlan,
      });

      const orderData = res.data?.data || res.data;
      if (!orderData) throw new Error("Could not initialize plan order.");

      if (orderData.mock) {
        await apiClient.post('/api/v2/billing/verify-plan', {
          planName: selectedPlan,
          orderId: orderData.id || orderData.orderId,
          paymentId: `pay_mock_${Date.now()}`,
          signature: 'mock_signature',
        });
        setSuccessMsg(`Successfully subscribed to ${selectedPlan.toUpperCase()} plan! Minutes credited.`);
        await loadProfile();
        return;
      }

      if (!(window as any).Razorpay) {
        throw new Error("Razorpay payment gateway script not loaded. Please disable ad-blockers and refresh.");
      }

      const razorpayKey =
        orderData.keyId ||
        orderData.key ||
        (import.meta as any).env?.VITE_RAZORPAY_KEY_ID ||
        'rzp_test_TO7mXkVkl4AFCy';

      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Claritiy Voice',
        description: `${selectedPlan.toUpperCase()} Plan Subscription`,
        order_id: orderData.orderId || orderData.id,
        prefill: { email: '' },
        handler: async function (response: any) {
          try {
            await apiClient.post('/api/v2/billing/verify-plan', {
              planName: selectedPlan,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            setSuccessMsg(`Payment confirmed! ${selectedPlan.toUpperCase()} plan minutes credited to your balance.`);
            await loadProfile();
          } catch (err: any) {
            setErrorMsg("Payment verification error: " + (err?.message || "Verification failed"));
          }
        },
        theme: { color: '#059669' }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to initiate plan purchase");
    } finally {
      setPurchasingPlan(false);
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profile = await fetchProfile();
      if (profile) {
        setGeminiKey(profile.geminiApiKey || "");
        setBalance(profile.callingBalanceMinutes ?? 0.0);
      }
    } catch (err) {
      setErrorMsg("Failed to retrieve operational workspace profile parameters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const trimmedKey = geminiKey.trim();
      await updateBillingConfig(trimmedKey || null);
      if (trimmedKey) {
        setSuccessMsg("Gemini Live API Custom Key updated successfully.");
      } else {
        setSuccessMsg("Custom key removed. Workspace reverted to shared platform allowance.");
      }
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg("Failed to write updated key to database. Confirm auth session.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          COMPILING WALLET PARAMETERS...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Figtree', sans-serif" }}>
          Billing & Wallet Gateway
        </h2>
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
          Manage your Gemini Live APIs and voice calling minutes balance allowance.
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 nm-pressed text-[var(--nm-accent)] px-4 py-3 rounded-xl text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 nm-pressed text-red-500 px-4 py-3 rounded-xl text-sm font-bold">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: BYOK */}
        <div className="nm-card p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 nm-pressed rounded-xl">
                <Key className="w-6 h-6 text-[var(--nm-text)]" />
              </div>
              <div>
                <p className="text-base font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  Option A: Bring Your Own Key (BYOK)
                </p>
                <p className="text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  Direct connections. Completely cost-free to platform balance.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--nm-text)] block mb-2 uppercase" style={{ fontFamily: "'DM Mono', monospace" }}>
                  GOOGLE GEMINI LIVE API KEY
                </label>
                <div className="relative">
                  <input
                    type={obscureKey ? "password" : "text"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-3 nm-input rounded-xl text-sm focus:outline-none pr-16 font-bold text-[var(--nm-text)]"
                    style={{ fontFamily: obscureKey ? "password" : "'DM Mono', monospace" }}
                  />
                  <button
                    type="button"
                    onClick={() => setObscureKey(!obscureKey)}
                    className="absolute right-4 top-3 text-sm font-bold text-[var(--nm-text)] hover:text-[var(--nm-accent)]"
                    style={{ fontFamily: "'Figtree', sans-serif" }}
                  >
                    {obscureKey ? "Show" : "Hide"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full nm-button nm-state-success text-sm font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                {saving ? "Saving Custom Key..." : "Save Custom Key"}
              </button>
            </form>
          </div>
        </div>

        {/* CARD 2: Platform Account Balance */}
        <div className="nm-card p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 nm-pressed rounded-xl">
                <CreditCard className="w-6 h-6 text-[var(--nm-text)]" />
              </div>
              <div>
                <p className="text-base font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  Option B: Platform Balance
                </p>
                <p className="text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  Uses Claritiy Voice shared keys. Subtracts balance minutes.
                </p>
              </div>
            </div>

            <div className="nm-pressed rounded-2xl p-6 text-center">
              <p className="text-xs font-bold text-[var(--nm-text)] mb-2 uppercase tracking-wider" style={{ fontFamily: "'DM Mono', monospace" }}>
                ACCOUNT CREDITS
              </p>
              <p className={`text-4xl font-bold tracking-tight ${(balance ?? 0) < 100 ? 'text-amber-500' : 'text-[var(--nm-text)]'}`} style={{ fontFamily: "'Instrument Serif', serif" }}>
                {balance !== null ? `${Math.max(0, balance).toFixed(0)} Credits` : "0 Credits"}
              </p>
              <p className="text-sm font-bold text-[var(--nm-text)] mt-2 flex items-center justify-center gap-1.5" style={{ fontFamily: "'Figtree', sans-serif" }}>
                <span>credits remaining in your account</span>
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold cursor-help"
                  title="1 credit = 1 call minute"
                >
                  ?
                </span>
              </p>
              {(balance ?? 0) < 100 && (
                <p className="text-xs font-semibold text-amber-500 mt-2">
                  ⚠️ Low balance alert: remaining credits below 10%
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-[var(--nm-text)] block uppercase tracking-wider" style={{ fontFamily: "'DM Mono', monospace" }}>
                SELECT PLAN / TOP-UP
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full px-4 py-3 nm-input rounded-xl text-sm font-bold text-[var(--nm-text)] focus:outline-none"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                <option value="trial">Trial Plan — ₹1 (20 Bundled Mins)</option>
                <option value="starter">Starter Plan — ₹800 (500 Bundled Mins)</option>
                <option value="startup">Startup Plan — ₹3,799 (750 Bundled Mins)</option>
                <option value="growth">Growth Plan — ₹10,799 (2,865 Bundled Mins)</option>
                <option value="enterprise">Enterprise Plan — ₹30,799 (10,000 Bundled Mins)</option>
              </select>

              <button
                type="button"
                onClick={handlePurchasePlan}
                disabled={purchasingPlan}
                className="w-full nm-button nm-state-success text-sm font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                {purchasingPlan ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Processing Order…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Purchase Minutes with Razorpay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

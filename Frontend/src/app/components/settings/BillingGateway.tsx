import React, { useState, useEffect } from "react";
import { fetchProfile, updateBillingConfig } from "../../api";
import { Key, CreditCard, ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";

export default function BillingGateway() {
  const [geminiKey, setGeminiKey] = useState("");
  const [obscureKey, setObscureKey] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profile = await fetchProfile();
      if (profile) {
        setGeminiKey(profile.geminiApiKey || "");
        setBalance(profile.callingBalanceMinutes ?? 10.0);
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
      await updateBillingConfig(geminiKey || null);
      setSuccessMsg("Gemini Live API Custom Key updated successfully.");
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
                ACCOUNT BALANCE
              </p>
              <p className="text-4xl font-bold tracking-tight text-[var(--nm-text)]" style={{ fontFamily: "'Instrument Serif', serif" }}>
                {balance !== null ? `${balance.toFixed(1)} Minutes` : "0.0 Minutes"}
              </p>
              <p className="text-sm font-bold text-[var(--nm-text)] mt-2" style={{ fontFamily: "'Figtree', sans-serif" }}>
                Remaining allowed platform minutes
              </p>
            </div>

            <button
              disabled
              className="w-full nm-raised text-sm font-bold py-3 rounded-xl cursor-not-allowed text-[var(--nm-text)] opacity-50"
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              Purchase Calling Credits (Stripe Launching Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

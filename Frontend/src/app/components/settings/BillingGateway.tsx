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
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: BYOK */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Key className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  Option A: Bring Your Own Key (BYOK)
                </p>
                <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  Direct connections. Completely cost-free to platform balance.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5" style={{ fontFamily: "'DM Mono', monospace" }}>
                  GOOGLE GEMINI LIVE API KEY
                </label>
                <div className="relative">
                  <input
                    type={obscureKey ? "password" : "text"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none pr-16"
                    style={{ fontFamily: obscureKey ? "password" : "'DM Mono', monospace" }}
                  />
                  <button
                    type="button"
                    onClick={() => setObscureKey(!obscureKey)}
                    className="absolute right-3 top-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    style={{ fontFamily: "'Figtree', sans-serif" }}
                  >
                    {obscureKey ? "Show" : "Hide"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-foreground text-background text-xs font-semibold py-2 rounded-lg hover:bg-foreground/90 transition-all active:scale-98 disabled:opacity-50"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                {saving ? "Saving Custom Key..." : "Save Custom Key"}
              </button>
            </form>
          </div>
        </div>

        {/* CARD 2: Platform Account Balance */}
        <div className="bg-white border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <CreditCard className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  Option B: Platform Balance
                </p>
                <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  Uses Clarity Voice shared keys. Subtracts balance minutes.
                </p>
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-xl p-4 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                FREE TRIAL BALANCE
              </p>
              <p className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Instrument Serif', serif" }}>
                {balance !== null ? `${balance.toFixed(1)} Minutes` : "0.0 Minutes"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1" style={{ fontFamily: "'Figtree', sans-serif" }}>
                Remaining allowed platform minutes
              </p>
            </div>

            <button
              disabled
              className="w-full bg-muted text-muted-foreground text-xs font-semibold py-2 rounded-lg cursor-not-allowed border border-border"
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

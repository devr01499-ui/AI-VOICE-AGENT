import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, KeyRound, ArrowRight, Loader2, LogOut, CheckCircle2 } from 'lucide-react';

interface MfaEnrollProps {
  onVerified?: () => void;
}

export const MfaEnroll: React.FC<MfaEnrollProps> = ({ onVerified }) => {
  const { user, signOut, refreshStaff } = useAuth();
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [isEnrollingNew, setIsEnrollingNew] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkFactors() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;

        const totpFactors = data?.totp || [];
        const verifiedFactor = totpFactors.find((f: any) => f.status === 'verified');

        if (verifiedFactor) {
          if (mounted) {
            setFactorId(verifiedFactor.id);
            setIsEnrollingNew(false);
          }
        } else {
          // No verified factor, initiate enrollment
          const enrollRes = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'Claritiy Voice Admin',
            friendlyName: user?.email || 'Staff TOTP',
          });
          if (enrollRes.error) throw enrollRes.error;

          if (mounted && enrollRes.data) {
            setFactorId(enrollRes.data.id);
            setQrCode(enrollRes.data.totp.qr_code);
            setSecret(enrollRes.data.totp.secret);
            setIsEnrollingNew(true);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Failed to initialize MFA.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkFactors();

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.trim().length < 6 || !factorId) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Challenge and verify code
      const challengeRes = await supabase.auth.mfa.challenge({ factorId });
      if (challengeRes.error) throw challengeRes.error;

      const verifyRes = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeRes.data.id,
        code: totpCode.trim(),
      });
      if (verifyRes.error) throw verifyRes.error;

      await refreshStaff();
      if (onVerified) {
        onVerified();
      } else {
        window.location.replace('/overview');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid two-factor authentication code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4 antialiased text-white font-sans selection:bg-zinc-800">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-white text-black flex items-center justify-center font-extrabold text-xl shadow-lg ring-1 ring-white/20">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white pt-1">
            Claritiy Voice Security Gateway
          </h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] font-mono tracking-widest uppercase text-amber-400 bg-amber-950/40 border border-amber-900/50 px-2 py-0.5 rounded flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              AAL2 Authentication Mandatory
            </span>
          </div>
        </div>

        {/* Security Card */}
        <div className="bg-zinc-950 border border-zinc-800/90 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          {loading ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
              <p className="text-xs text-zinc-500 font-mono">Checking authenticator assurance level...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start gap-2.5 text-xs text-red-300">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{error}</div>
                </div>
              )}

              {isEnrollingNew && (
                <div className="space-y-4 mb-5 text-center">
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-left space-y-1">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Enroll Authenticator App
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Scan the QR code below using Google Authenticator, 1Password, or Authy to configure your staff credentials.
                    </p>
                  </div>

                  {qrCode && (
                    <div className="flex justify-center p-3 bg-white rounded-xl inline-block mx-auto shadow-inner">
                      <img src={qrCode} alt="TOTP QR Code" className="w-44 h-44" />
                    </div>
                  )}

                  {secret && (
                    <div className="text-left bg-zinc-900/70 p-2.5 rounded-lg border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 font-mono uppercase">Manual Setup Key:</div>
                      <div className="font-mono text-xs text-amber-300 select-all break-all">{secret}</div>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    {isEnrollingNew ? 'Enter 6-digit code to complete enrollment' : '6-Digit TOTP Security Code'}
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      autoFocus
                      required
                      autoComplete="one-time-code"
                      className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-base tracking-widest font-mono text-center text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || totpCode.length < 6}
                  className="w-full py-2.5 px-4 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-[0.99]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Token...</span>
                    </>
                  ) : (
                    <>
                      <span>{isEnrollingNew ? 'Confirm & Enter Console' : 'Verify & Enter Console'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                  Logged in as <span className="text-zinc-300 font-mono">{user?.email}</span>
                </span>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Security Notice */}
        <div className="text-center space-y-1">
          <p className="text-[11px] text-zinc-400">
            Administrative Access Restricted &bull; Claritiy Voice Internal
          </p>
        </div>
      </div>
    </div>
  );
};

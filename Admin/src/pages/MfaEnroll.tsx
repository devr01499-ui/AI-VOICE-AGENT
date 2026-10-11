import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, KeyRound, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export const MfaEnroll: React.FC = () => {
  const { refreshStaff } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if user already has an enrolled TOTP factor, or enroll a new one
    async function initMfa() {
      try {
        setLoading(true);
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;

        const totp = factors.totp.find((f) => f.status === 'verified');
        if (totp) {
          // Already enrolled, just challenge
          setFactorId(totp.id);
        } else {
          // Enroll new factor
          const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'Claritiy Voice Admin',
          });
          if (enrollError) throw enrollError;

          setFactorId(enrollData.id);
          setQrCode(enrollData.totp.qr_code);
          setSecret(enrollData.totp.secret);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize MFA factor.');
      } finally {
        setLoading(false);
      }
    }

    initMfa();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !verifyCode.trim()) return;

    try {
      setLoading(true);
      setError(null);

      // Challenge and verify TOTP code
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode.trim(),
      });
      if (verifyError) throw verifyError;

      setSuccess(true);
      // Refresh staff state to acknowledge AAL2
      await refreshStaff();
    } catch (err: any) {
      setError(err.message || 'Invalid authentication code. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4 border border-amber-400/20">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Two-Factor Authentication
          </h1>
          <p className="text-sm text-slate-400 mt-1 text-center">
            AAL2 Security Verification is strictly mandated for all administrative console access.
          </p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/20 flex items-start gap-3 text-red-200 text-sm">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-300">Verification Error</p>
                <p className="text-xs text-red-400/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {success ? (
            <div className="text-center py-6">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">MFA Verified Successfully</h2>
              <p className="text-sm text-slate-400 mt-1">
                Elevating session to AAL2 and redirecting to the administrative dashboard...
              </p>
            </div>
          ) : (
            <>
              {qrCode && (
                <div className="mb-6 text-center">
                  <p className="text-xs text-slate-400 mb-3 font-medium">
                    Scan this QR code with Google Authenticator, 1Password, or Authy:
                  </p>
                  <div className="bg-white p-3 rounded-xl inline-block shadow-md">
                    <img src={qrCode} alt="TOTP QR Code" className="h-44 w-44 object-contain" />
                  </div>
                  {secret && (
                    <div className="mt-3">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Manual Secret Key</p>
                      <code className="text-xs text-indigo-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 font-mono select-all">
                        {secret}
                      </code>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || verifyCode.length < 6}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Access Console</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
            <span>Encrypted Time-Based One-Time Password Standard (RFC 6238)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

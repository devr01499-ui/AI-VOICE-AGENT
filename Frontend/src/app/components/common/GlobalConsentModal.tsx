import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CheckCircle2, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api';

interface GlobalConsentModalProps {
  userEmail?: string;
  userFullName?: string;
}

export function GlobalConsentModal({ userEmail, userFullName }: GlobalConsentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOfUseAccepted, setTermsOfUseAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check consent status from database
    let isMounted = true;
    const checkConsent = async () => {
      try {
        const res = await apiClient.get('/api/v2/user/consent-status');
        if (isMounted && res.data?.success && res.data.data?.hasConsented === false) {
          setIsOpen(true);
        }
      } catch (err) {
        // If unauthenticated or network error, skip
      }
    };

    checkConsent();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAgree = async () => {
    if (!termsAccepted || !termsOfUseAccepted) {
      setError('Please review and check both consent agreements to proceed.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const email = userEmail || '';
      const res = await apiClient.post('/api/v2/user/consent', {
        email,
        fullName: userFullName || null,
        termsAndConditions: true,
        termsOfUse: true,
        privacyPolicy: true,
        consentVersion: 'v1.0',
      });

      if (res.data?.success) {
        setIsOpen(false);
      } else {
        setError((res.data as any)?.error || 'Failed to record consent. Please try again.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Consent recording failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          {/* Header */}
          <div
            className="p-6 text-center border-b border-emerald-100"
            style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h3
              className="text-lg font-extrabold text-slate-900"
              style={{ fontFamily: "'Clash Display', 'Outfit', sans-serif" }}
            >
              Claritiy Voice Terms & Regulatory Consent
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Mandatory agreement to platform terms and telecommunications compliance policies.
            </p>
          </div>

          {/* Content summary */}
          <div className="p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2.5 max-h-48 overflow-y-auto leading-relaxed text-slate-600">
              <p className="font-bold text-slate-800">Please review our key regulatory commitments:</p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>
                  <strong>Acceptable Telephony Use:</strong> All conversational voice agents must strictly adhere to telecommunications regulations, DoT and TRAI anti-spam mandates, and national Do-Not-Call (DND) directories.
                </li>
                <li>
                  <strong>Authentic Identity:</strong> Users warrant that all identity, tax, and KYC documents provided belong legitimately to the entity and authorized signatory.
                </li>
                <li>
                  <strong>Caller Consent & Audio Privacy:</strong> Calls and voice transcriptions must be conducted in compliance with relevant privacy and consent laws.
                </li>
                <li>
                  <strong>Zero Harassment / Fraud Policy:</strong> Robocalling harassment, spoofing, fraud, or unlawful solicitation is strictly prohibited and subject to immediate account termination.
                </li>
              </ul>
              <div className="pt-2 flex gap-4 text-[11px] font-bold text-emerald-700">
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                  Read Full Terms of Service <ExternalLink className="w-3 h-3" />
                </a>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                  Privacy Policy <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 leading-normal">
                  I have read, understood, and accept the <strong>Claritiy Voice Terms and Conditions</strong>.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={termsOfUseAccepted}
                  onChange={(e) => setTermsOfUseAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 leading-normal">
                  I agree to the <strong>Terms of Use</strong> and give my explicit consent to follow all platform regulations and calling policies.
                </span>
              </label>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleAgree}
              disabled={!termsAccepted || !termsOfUseAccepted || submitting}
              className="py-2.5 px-6 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recording Consent…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> I Agree & Continue
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, KycDigiLockerInitiateData } from '../../api';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileCheck,
  ExternalLink,
  RefreshCw,
  Building,
  CreditCard,
  UserCheck,
  X,
} from 'lucide-react';

export interface KycDocData {
  documentType: 'pan' | 'gst' | 'aadhaar';
  label: string;
  description: string;
  required: boolean;
  status: 'verified' | 'pending' | 'failed' | 'not_submitted';
  panNumber?: string | null;
  panType?: 'personal' | 'company' | null;
  fullName?: string | null;
  dob?: string | null;
  gstin?: string | null;
  gstCertUrl?: string | null;
  aadhaarNumber?: string | null;
  aadhaarDocUrl?: string | null;
  vobizReference?: string | null;
  failureReason?: string | null;
  verifiedAt?: string | null;
  updatedAt?: string | null;
}

export function KycComplianceSettings({ onStatusChange }: { onStatusChange?: (status: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<KycDocData[]>([]);
  const [overallStatus, setOverallStatus] = useState<string>('not_submitted');
  const [isFullyVerified, setIsFullyVerified] = useState<boolean>(false);
  const [subAccountAuthId, setSubAccountAuthId] = useState<string | null>(null);

  // Form states: PAN
  const [panType, setPanType] = useState<'personal' | 'company'>('personal');
  const [panNumber, setPanNumber] = useState('');
  const [panFullName, setPanFullName] = useState('');
  const [submittingPan, setSubmittingPan] = useState(false);
  const [panError, setPanError] = useState<string | null>(null);

  // Form states: GST
  const [gstin, setGstin] = useState('');
  const [gstFile, setGstFile] = useState<{ name: string; base64: string } | null>(null);
  const [submittingGst, setSubmittingGst] = useState(false);
  const [gstError, setGstError] = useState<string | null>(null);

  // Form states: DigiLocker Aadhaar
  const [accessRequestId, setAccessRequestId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('kyc_access_request_id') || null; } catch { return null; }
  });
  const [initiatingDigiLocker, setInitiatingDigiLocker] = useState(false);
  const [verifyingDigiLocker, setVerifyingDigiLocker] = useState(false);
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [kycCallsBlocked, setKycCallsBlocked] = useState<boolean | null>(null);
  const [liveVerifications, setLiveVerifications] = useState<{ pan?: string; gst?: string; aadhaar?: string; cin?: string } | null>(null);
  const [businessType, setBusinessType] = useState<'individual' | 'company'>('individual');
  const [systemErrorMessage, setSystemErrorMessage] = useState<string | null>(null);
  const [initiatingHosted, setInitiatingHosted] = useState<boolean>(false);
  const [showHostedFallback, setShowHostedFallback] = useState<boolean>(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleContinueHosted = async () => {
    setInitiatingHosted(true);
    try {
      const res = await apiClient.post('/api/v2/kyc/initiate-session');
      if (res.data?.success && res.data.data?.redirectUrl) {
        window.location.href = res.data.data.redirectUrl;
      } else {
        setPanError('Unable to generate hosted verification session link. Please contact support.');
      }
    } catch (err: any) {
      setPanError(err?.response?.data?.error || 'Failed to start hosted verification.');
    } finally {
      setInitiatingHosted(false);
    }
  };

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const [docRes, statusRes] = await Promise.allSettled([
        apiClient.get('/api/v2/kyc/documents'),
        apiClient.get('/api/v2/kyc/status'),
      ]);

      if (docRes.status === 'fulfilled' && docRes.value.data?.success && docRes.value.data.data) {
        const data = docRes.value.data.data;
        setDocuments(data.documents || []);
        setOverallStatus(data.overallStatus || 'not_submitted');
        setIsFullyVerified(data.isFullyVerified || false);
        setSubAccountAuthId(data.subAccountAuthId || null);
        if (data.businessType) setBusinessType(data.businessType);

        if (onStatusChange) {
          onStatusChange(data.overallStatus || 'not_submitted');
        }

        // Hydrate existing fields if available
        const panDoc = data.documents?.find((d: KycDocData) => d.documentType === 'pan');
        if (panDoc) {
          if (panDoc.panNumber) setPanNumber(panDoc.panNumber);
          if (panDoc.fullName) setPanFullName(panDoc.fullName);
          if (panDoc.panType) setPanType(panDoc.panType);
        }
        const gstDoc = data.documents?.find((d: KycDocData) => d.documentType === 'gst');
        if (gstDoc && gstDoc.gstin) {
          setGstin(gstDoc.gstin);
        }
        const aadhaarDoc = data.documents?.find((d: KycDocData) => d.documentType === 'aadhaar');
        if (aadhaarDoc?.vobizReference && !accessRequestId) {
          setAccessRequestId(aadhaarDoc.vobizReference);
        }
      }

      if (statusRes.status === 'fulfilled' && statusRes.value.data?.success && statusRes.value.data.data) {
        const sData = statusRes.value.data.data;
        if (sData.kycCallsBlocked !== undefined) {
          setKycCallsBlocked(sData.kycCallsBlocked);
        }
        if (sData.verifications) {
          setLiveVerifications(sData.verifications);
        }
        if (sData.overallStatus) {
          setOverallStatus(sData.overallStatus);
        }
        if (sData.businessType) {
          setBusinessType(sData.businessType);
        }
      }
    } catch (err: any) {
      console.error('Failed to load KYC documents:', err);
    } finally {
      setLoading(false);
    }
  }, [onStatusChange, accessRequestId]);

  const hasAutoVerifiedRef = useRef(false);

  useEffect(() => {
    loadDocuments();

    // Auto-verify returning DigiLocker session on mount
    if (typeof window !== 'undefined' && !hasAutoVerifiedRef.current) {
      const pendingReqId = sessionStorage.getItem('kyc_access_request_id');
      if (pendingReqId) {
        hasAutoVerifiedRef.current = true;
        handleVerifyDigiLocker(pendingReqId);
      }
    }
  }, [loadDocuments]);

  // Handle GST File upload selection
  const handleGstFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setGstError('File size exceeds 8MB limit. Please upload a smaller document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setGstFile({
        name: file.name,
        base64,
      });
      setGstError(null);
    };
    reader.readAsDataURL(file);
  };


  // Submit PAN Verification (Supports Personal and Company PAN, No DOB)
  const handleSubmitPan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPanError(null);
    setNotification(null);

    const cleanPan = panNumber.trim().toUpperCase();
    if (!cleanPan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      setPanError('Please enter a valid 10-character PAN number (e.g. ABCDE1234F).');
      return;
    }
    if (!panFullName.trim()) {
      setPanError(
        panType === 'company'
          ? 'Please enter the registered company/entity name as per PAN card.'
          : 'Please enter the full name as appearing on the PAN card.'
      );
      return;
    }

    setSubmittingPan(true);
    setSystemErrorMessage(null);
    try {
      const res = await apiClient.post('/api/v2/kyc/verify-document', {
        documentType: 'pan',
        panNumber: cleanPan,
        panType,
        fullName: panFullName.trim(),
      });

      if (res.data?.success) {
        setNotification({
          type: res.data.data.status === 'verified' ? 'success' : 'error',
          message:
            res.data.data.status === 'verified'
              ? 'PAN verification approved successfully!'
              : `PAN verification rejected: ${res.data.data.failureReason || 'Details could not be verified'}`,
        });
        await loadDocuments();
      } else {
        setPanError((res.data as any)?.error || 'Verification failed. Please try again.');
      }
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData?.outcome === 'error' || err?.response?.status === 502 || err?.response?.status === 503) {
        setSystemErrorMessage(
          errData?.error || 'Verification is temporarily undergoing maintenance. Please retry shortly or proceed with Vobiz hosted verification.'
        );
        setShowHostedFallback(true);
      } else {
        setPanError(errData?.error || err.message || 'PAN verification request failed.');
      }
    } finally {
      setSubmittingPan(false);
    }
  };

  // Submit GST Verification
  const handleSubmitGst = async (e: React.FormEvent) => {
    e.preventDefault();
    setGstError(null);
    setNotification(null);

    const cleanGst = gstin.trim().toUpperCase();
    if (!cleanGst || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGst)) {
      setGstError('Please enter a valid 15-character GSTIN (e.g. 29ABCDE1234F1Z5).');
      return;
    }

    const currentGstDoc = documents.find((d) => d.documentType === 'gst');
    if (!gstFile && !currentGstDoc?.gstCertUrl) {
      setGstError('Please upload your GST Registration Certificate PDF or image.');
      return;
    }

    setSubmittingGst(true);
    try {
      const res = await apiClient.post('/api/v2/kyc/verify-document', {
        documentType: 'gst',
        gstin: cleanGst,
        gstCertFile: gstFile?.base64,
        gstCertName: gstFile?.name,
      });

      if (res.data?.success) {
        setNotification({
          type: res.data.data.status === 'verified' ? 'success' : 'error',
          message:
            res.data.data.status === 'verified'
              ? 'GST verification approved successfully!'
              : `GST verification rejected: ${res.data.data.failureReason || 'Registration details could not be verified'}`,
        });
        setGstFile(null);
        await loadDocuments();
      } else {
        setGstError((res.data as any)?.error || 'GST verification failed.');
      }
    } catch (err: any) {
      setGstError(err?.response?.data?.error || err.message || 'GST verification request failed.');
    } finally {
      setSubmittingGst(false);
    }
  };

  // Initiate DigiLocker Aadhaar Verification (Top-level redirect flow)
  const handleInitiateDigiLocker = async () => {
    setInitiatingDigiLocker(true);
    setAadhaarError(null);
    setNotification(null);
    try {
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/compliance?tab=kyc`
        : 'https://claritiy.com/compliance?tab=kyc';

      const res = await apiClient.post<KycDigiLockerInitiateData>('/api/v2/kyc/digilocker/initiate', {
        redirect_url: redirectUrl,
      });
      if (res.data?.success) {
        const authUrl = (res.data as any)?.data?.auth_url || (res.data as any)?.data?.link;
        const reqId = (res.data as any)?.data?.access_request_id;
        if (reqId) {
          setAccessRequestId(reqId);
          try { sessionStorage.setItem('kyc_access_request_id', reqId); } catch {}
        }
        if (authUrl) {
          // Top-level navigation — UIDAI consent portals block iframe embedding via CSP frame-ancestors
          window.location.href = authUrl;
          return;
        }
        await loadDocuments();
      } else {
        setAadhaarError((res.data as any)?.error || 'Unable to start DigiLocker session.');
      }
    } catch (err: any) {
      setAadhaarError(err?.response?.data?.error || err.message || 'Failed to initiate DigiLocker session.');
    } finally {
      setInitiatingDigiLocker(false);
    }
  };

  // Verify DigiLocker Consent Status
  const handleVerifyDigiLocker = async (reqIdOverride?: string) => {
    const targetId = reqIdOverride || accessRequestId || (typeof window !== 'undefined' ? sessionStorage.getItem('kyc_access_request_id') : null);
    if (!targetId) {
      setAadhaarError('No active DigiLocker session found. Please click "Start DigiLocker Verification" to begin.');
      return;
    }
    setVerifyingDigiLocker(true);
    setAadhaarError(null);
    try {
      const res = await apiClient.post('/api/v2/kyc/digilocker/verify', {
        access_request_id: targetId,
      });
      if (res.data?.success) {
        const status = res.data.data?.status;
        if (status === 'verified') {
          try { sessionStorage.removeItem('kyc_access_request_id'); } catch {}
          setNotification({
            type: 'success',
            message: 'Aadhaar identity verified successfully via DigiLocker!',
          });
        } else if (status === 'failed') {
          setNotification({
            type: 'error',
            message: 'Aadhaar verification not verified. Please complete OTP authorization on DigiLocker and retry.',
          });
        } else {
          setNotification({
            type: 'info',
            message: 'Aadhaar verification is pending. Please complete authorization on DigiLocker.',
          });
        }
        await loadDocuments();
      } else {
        setAadhaarError((res.data as any)?.error || 'DigiLocker verification failed.');
      }
    } catch (err: any) {
      setAadhaarError(err?.response?.data?.error || err.message || 'Verification request failed.');
    } finally {
      setVerifyingDigiLocker(false);
    }
  };

  const panDoc = documents.find((d) => d.documentType === 'pan');
  const gstDoc = documents.find((d) => d.documentType === 'gst');
  const aadhaarDoc = documents.find((d) => d.documentType === 'aadhaar');

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Review
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Action Required
          </span>
        );
      case 'not_started':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-500 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" /> Not Started
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
            Pending Upload
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="nm-card p-12 text-center flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Loading KYC & Compliance Status…
        </p>
      </div>
    );
  }

  const isAadhaarVerified = liveVerifications?.aadhaar === 'verified' || aadhaarDoc?.status === 'verified';
  const isPanVerified = liveVerifications?.pan === 'verified' || panDoc?.status === 'verified';
  const isGstVerified = liveVerifications?.gst === 'verified' || gstDoc?.status === 'verified';

  const requiredTotal = 2;
  const verifiedCount = businessType === 'company'
    ? [isPanVerified, isGstVerified].filter(Boolean).length
    : [isPanVerified, isAadhaarVerified].filter(Boolean).length;

  return (
    <div className="w-full space-y-8 font-sans">
      {/* Top Banner & Overall Status */}
      <div className="nm-card p-6 md:p-8 space-y-6 border border-slate-200/60 shadow-sm rounded-3xl bg-gradient-to-br from-white via-white to-slate-50/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[var(--nm-text)] flex items-center gap-3" style={{ fontFamily: "'Clash Display', 'Outfit', sans-serif" }}>
                KYC & Regulatory Compliance
              </h2>
              <p className="text-xs text-slate-500 mt-0.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Mandatory Indian Department of Telecommunications (DoT) sub-account identity compliance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Account Status</span>
              {renderStatusBadge(overallStatus)}
            </div>
          </div>
        </div>

        {/* Live Progress Bar & Telephony Status */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-7 bg-slate-50/90 rounded-2xl p-4 border border-slate-200/60">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-700">
                Sub-Account Compliance ({businessType === 'company' ? 'Company Entity' : 'Individual / Sole Proprietor'})
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {verifiedCount} of {requiredTotal} Documents Verified
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${(verifiedCount / requiredTotal) * 100}%` }}
              />
            </div>
          </div>
          <div className="md:col-span-5 bg-slate-50/90 rounded-2xl p-4 border border-slate-200/60 flex items-start gap-2.5">
            {kycCallsBlocked === false ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <strong className={kycCallsBlocked === false ? 'text-emerald-700' : 'text-amber-800'}>
                {kycCallsBlocked === false ? 'Telephony Active' : 'Outbound Calling Blocked'}:
              </strong>{' '}
              {kycCallsBlocked === false
                ? 'Sub-account KYC approved. Outbound voice calling and number provisioning active.'
                : 'Telephony calls blocked per TRAI/DoT regulation until required identity documents are verified.'}
            </p>
          </div>
        </div>

        {notification && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : notification.type === 'info'
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'info' ? (
              <InfoIcon className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}
      </div>

      {/* Grid of Document Verification Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* ── CARD 1: PAN Verification (Personal or Company, No DOB) ── */}
        <div className="nm-card p-6 rounded-3xl border border-slate-200/70 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Permanent Account Number (PAN)
                  </h3>
                  <p className="text-[11px] text-slate-400">Government of India Tax Identity</p>
                </div>
              </div>
              {renderStatusBadge(panDoc?.status || 'not_submitted')}
            </div>

            {/* Plain-Language Rejection Reason */}
            {panDoc?.status === 'failed' && panDoc.failureReason && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Verification Rejected
                </div>
                <p className="text-[11px] leading-relaxed text-red-700">{panDoc.failureReason}</p>
              </div>
            )}

            {panDoc?.status === 'verified' && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified On-Record
                </p>
                <p className="text-[11px] text-emerald-700">
                  PAN: <span className="font-mono font-bold">{panDoc.panNumber}</span> · {panDoc.fullName}
                </p>
                {panDoc.panType && (
                  <p className="text-[10px] text-emerald-600 uppercase font-mono font-bold">
                    Type: {panDoc.panType === 'company' ? 'Company PAN' : 'Personal PAN'}
                  </p>
                )}
                {panDoc.verifiedAt && (
                  <p className="text-[10px] text-emerald-600/80">
                    Verified on: {new Date(panDoc.verifiedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {panError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
                {panError}
              </div>
            )}

            {/* Form */}
            {panDoc?.status !== 'verified' && (
              <form onSubmit={handleSubmitPan} className="space-y-3.5 text-xs">
                {/* System Error & Hosted Verification Fallback Banner */}
                {systemErrorMessage && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Temporary Verification Notice</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      {systemErrorMessage} Your form data has been retained so you can retry directly.
                    </p>
                    <button
                      type="button"
                      onClick={handleContinueHosted}
                      disabled={initiatingHosted}
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {initiatingHosted ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      Continue with Vobiz Verification
                    </button>
                  </div>
                )}
                {/* Options: Personal PAN vs Company PAN */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1.5">Select PAN Card Type</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPanType('personal')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        panType === 'personal'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Personal PAN Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanType('company')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        panType === 'company'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Company PAN Card
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    {panType === 'company' ? 'Company PAN Number (10 characters)' : 'PAN Number (10 characters)'}
                  </label>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setPanNumber(val);
                      if (val.length >= 4) {
                        const fourth = val.charAt(3);
                        if (fourth === 'P' || fourth === 'H') {
                          setPanType('personal');
                        } else if (['C', 'F', 'A', 'T', 'B', 'L', 'J', 'G'].includes(fourth)) {
                          setPanType('company');
                        }
                      }
                    }}
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    disabled={submittingPan}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold tracking-wider uppercase text-slate-900"
                  />
                  {panNumber.length >= 4 && (
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Entity category (from 4th character &quot;{panNumber.charAt(3)}&quot;):{' '}
                      <span className="font-bold text-slate-800">
                        {panNumber.charAt(3) === 'P' || panNumber.charAt(3) === 'H' ? 'Individual / Personal PAN' : 'Company / Business Entity PAN'}
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    {panType === 'company' ? 'Company / Business Legal Name' : 'Full Name (as per PAN Card)'}
                  </label>
                  <input
                    type="text"
                    value={panFullName}
                    onChange={(e) => setPanFullName(e.target.value)}
                    placeholder={panType === 'company' ? 'e.g. Acme Innovations Pvt Ltd' : 'e.g. Rajesh Kumar Sharma'}
                    disabled={submittingPan}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingPan}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {submittingPan ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying PAN Details…
                    </>
                  ) : panDoc?.status === 'failed' ? (
                    'Re-submit PAN Verification'
                  ) : (
                    'Verify PAN Card'
                  )}
                </button>
              </form>
            )}
          </div>
          <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
            <span>Tax Identity Compliance</span>
            <span>Automated instant verification</span>
          </div>
        </div>

        {/* ── CARD 2: GST Verification ── */}
        <div className="nm-card p-6 rounded-3xl border border-slate-200/70 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    GST Certificate (GSTIN)
                  </h3>
                  <p className="text-[11px] text-slate-400">Business Goods & Services Tax ID</p>
                </div>
              </div>
              {renderStatusBadge(gstDoc?.status || 'not_submitted')}
            </div>

            {/* Plain-Language Rejection Reason */}
            {gstDoc?.status === 'failed' && gstDoc.failureReason && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Verification Rejected
                </div>
                <p className="text-[11px] leading-relaxed text-red-700">{gstDoc.failureReason}</p>
              </div>
            )}

            {gstDoc?.status === 'verified' && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified On-Record
                </p>
                <p className="text-[11px] text-emerald-700">
                  GSTIN: <span className="font-mono font-bold">{gstDoc.gstin}</span>
                </p>
                {gstDoc.gstCertUrl && (
                  <a
                    href={gstDoc.gstCertUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline"
                  >
                    <ExternalLink className="w-3 h-3" /> View Uploaded Certificate
                  </a>
                )}
              </div>
            )}

            {gstError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
                {gstError}
              </div>
            )}

            {/* Form */}
            {gstDoc?.status !== 'verified' && (
              <form onSubmit={handleSubmitGst} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">GSTIN (15 characters)</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    maxLength={15}
                    disabled={submittingGst}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold tracking-wider uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    GST Certificate Document (PDF or PNG/JPG)
                  </label>
                  <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-white">
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/jpg"
                      onChange={handleGstFileChange}
                      disabled={submittingGst}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                    {gstFile ? (
                      <p className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                        <FileCheck className="w-3.5 h-3.5" /> {gstFile.name}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-medium">
                        Drag or click to attach GST certificate
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submittingGst}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {submittingGst ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying GST Registration…
                    </>
                  ) : gstDoc?.status === 'failed' ? (
                    'Re-submit GST Verification'
                  ) : (
                    'Upload & Verify GST Certificate'
                  )}
                </button>
              </form>
            )}
          </div>
          <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
            <span>Commercial Entity Compliance</span>
            <span>Secure Verification</span>
          </div>
        </div>

        {/* ── CARD 3: Aadhaar Verification (DigiLocker) ── */}
        <div className={`nm-card p-6 rounded-3xl border border-slate-200/70 shadow-xs space-y-5 flex flex-col justify-between ${
          businessType === 'company' ? 'opacity-70 bg-slate-50/50' : ''
        }`}>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Aadhaar Verification (DigiLocker)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    UIDAI Government Identity Verification
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {businessType === 'company' ? (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Optional (Company)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200">
                    Mandatory (Individual)
                  </span>
                )}
                {renderStatusBadge(liveVerifications?.aadhaar || aadhaarDoc?.status || 'not_started')}
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Instant OTP verification via Government of India DigiLocker portal. No raw Aadhaar number or document files required.
            </p>

            {(liveVerifications?.aadhaar === 'failed' || aadhaarDoc?.status === 'failed') && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Aadhaar Verification Not Verified
                </p>
                <p className="text-[11px] text-red-700">
                  Consent verification was not completed or failed on DigiLocker. Please restart verification below.
                </p>
              </div>
            )}

            {(liveVerifications?.aadhaar === 'verified' || aadhaarDoc?.status === 'verified') && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Aadhaar Verified via DigiLocker
                </p>
                <p className="text-[11px] text-emerald-700">
                  UIDAI digital authorization confirmed on-record for this telephony sub-account.
                </p>
              </div>
            )}

            {aadhaarError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
                {aadhaarError}
              </div>
            )}

            {liveVerifications?.aadhaar !== 'verified' && aadhaarDoc?.status !== 'verified' && (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleInitiateDigiLocker}
                  disabled={initiatingDigiLocker || verifyingDigiLocker}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs text-xs"
                >
                  {initiatingDigiLocker ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting to DigiLocker…
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" /> Start DigiLocker Verification
                    </>
                  )}
                </button>

                {accessRequestId && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5 text-xs text-amber-900">
                    <p className="font-semibold text-[11px] leading-relaxed">
                      DigiLocker authorization in progress. Once you return from DigiLocker, status check runs automatically. You can also manually check status below.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleVerifyDigiLocker()}
                      disabled={verifyingDigiLocker}
                      className="w-full py-2 px-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                    >
                      {verifyingDigiLocker ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking Status…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Check DigiLocker Status
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
            <span>Identity Document Compliance</span>
            <span>Department of Telecommunications Verification</span>
          </div>
        </div>

      </div>

      {/* ── Telephony Readiness & Carrier Isolation Deck ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div className="nm-card p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-3 bg-gradient-to-br from-white to-slate-50/60">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
            DoT Sub-Account Isolation
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            In accordance with Indian telecom regulations, every enterprise tenant operates within an isolated cryptographic sub-account namespace with sovereign data residency.
          </p>
        </div>

        <div className="nm-card p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-3 bg-gradient-to-br from-white to-slate-50/60">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Unrestricted Calling Throughput
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Once identity verification completes, all automated voice agents gain immediate access to dedicated Indian DIDs, unlimited outbound PSTN concurrency, and high-quality carrier trunking.
          </p>
        </div>

        <div className="nm-card p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-3 bg-gradient-to-br from-white to-slate-50/60">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
            <Building className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Automated Audit Readiness
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            All document verification timestamps, cryptographic hashes, and compliance tokens are automatically synchronized with carrier gateways for regulatory audit trail compliance.
          </p>
        </div>
      </div>


    </div>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={16} x2={12} y2={12} />
      <line x1={12} y1={8} x2={12.01} y2={8} />
    </svg>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldAlert, Clock, Upload } from 'lucide-react';
import { API_BASE } from '../../api';

/**
 * Business verification for business (GST-registered) numbers. The carrier only rents these
 * numbers to verified businesses: GST registration certificate plus Certificate of Incorporation
 * or Udyam certificate, reviewed by the carrier itself. The server enforces this; this panel only
 * collects the documents and shows the review state.
 */
export type BusinessVerificationStatus = 'loading' | 'not_started' | 'submitted' | 'accepted' | 'rejected' | 'suspended' | 'expired' | 'draft';

const MAX_BYTES = 3 * 1024 * 1024;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').replace(/^data:[^;]+;base64,/, ''));
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
}

export default function BusinessVerificationPanel({ onStatus }: { onStatus?: (s: BusinessVerificationStatus) => void }) {
  const [status, setStatus] = useState<BusinessVerificationStatus>('loading');
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ businessName: '', registrationNumber: '', email: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '' });
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [gstFile, setGstFile] = useState<File | null>(null);

  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v2/numbers/plivo/compliance`, { headers: headers() });
      const body = await res.json();
      const s = (body?.data?.status || 'not_started') as BusinessVerificationStatus;
      setStatus(s);
      setReason(body?.data?.rejectionReason || null);
      onStatus?.(s);
    } catch {
      setStatus('not_started');
      onStatus?.('not_started');
    }
  }, [onStatus]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!registrationFile || !gstFile) { setError('Please attach both documents.'); return; }
    for (const f of [registrationFile, gstFile]) {
      if (f.size > MAX_BYTES) { setError(`${f.name} is larger than 3 MB.`); return; }
    }
    setBusy(true);
    try {
      const [reg, gst] = await Promise.all([toBase64(registrationFile), toBase64(gstFile)]);
      const res = await fetch(`${API_BASE}/api/v2/numbers/plivo/compliance`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          ...form,
          registrationCertificate: { name: registrationFile.name, contentBase64: reg },
          gstCertificate: { name: gstFile.name, contentBase64: gst },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.success) throw new Error(body?.error || 'Submission failed. Please try again.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="bg-white border border-gray-100 rounded-3xl p-5 flex items-center gap-2 text-sm text-gray-500" data-testid="business-verification-loading">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking business verification…
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex items-center gap-3" data-testid="business-verification-accepted">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
        <div className="text-sm text-emerald-900"><strong>Business verified.</strong> You can pick a business number below.</div>
      </div>
    );
  }

  if (status === 'submitted' || status === 'draft') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="business-verification-review">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-700 shrink-0" />
          <div className="text-sm text-blue-900"><strong>Documents under review by the carrier.</strong> This usually takes a few minutes; we will notify you.</div>
        </div>
        <button type="button" onClick={load} className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-blue-200 text-blue-800">Check again</button>
      </div>
    );
  }

  const field = (key: keyof typeof form, label: string, opts: { required?: boolean; placeholder?: string; maxLength?: number } = {}) => (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}{opts.required === false ? ' (optional)' : ''}</span>
      <input
        className="px-3 py-2 rounded-xl border border-gray-200 text-sm min-w-0"
        value={form[key]}
        required={opts.required !== false}
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        data-testid={`bv-${key}`}
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="bg-white border border-gray-100 rounded-3xl p-5 md:p-6 space-y-4" data-testid="business-verification-form">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-700 min-w-0">
          <strong className="text-gray-900">Business numbers are for GST-registered businesses.</strong>{' '}
          Upload your GST registration certificate and your Certificate of Incorporation or Udyam certificate (PDF, PNG or JPEG, up to 3 MB each).
          The business name must match both documents. Individuals can use the standard network instead.
          {(status === 'rejected' || status === 'expired' || status === 'suspended') && (
            <p className="mt-2 text-red-700" data-testid="business-verification-rejected">
              Your previous submission was {status}{reason ? `: ${reason}` : ''}. Please correct it and submit again.
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {field('businessName', 'Legal business name', { placeholder: 'As on the certificates', maxLength: 255 })}
        {field('registrationNumber', 'CIN or Udyam number', { required: false, maxLength: 50 })}
        {field('email', 'Business email', { required: false, maxLength: 200 })}
        {field('addressLine1', 'Address line 1', { maxLength: 200 })}
        {field('addressLine2', 'Address line 2', { required: false, maxLength: 200 })}
        {field('city', 'City', { maxLength: 100 })}
        {field('state', 'State', { maxLength: 100 })}
        {field('postalCode', 'PIN code', { maxLength: 6, placeholder: '560001' })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Certificate of Incorporation or Udyam</span>
          <input type="file" accept="application/pdf,image/png,image/jpeg" required onChange={(e) => setRegistrationFile(e.target.files?.[0] || null)} data-testid="bv-registration-file" className="text-xs min-w-0" />
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">GST registration certificate</span>
          <input type="file" accept="application/pdf,image/png,image/jpeg" required onChange={(e) => setGstFile(e.target.files?.[0] || null)} data-testid="bv-gst-file" className="text-xs min-w-0" />
        </label>
      </div>
      {error && <p className="text-sm text-red-700" data-testid="business-verification-error">{error}</p>}
      <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gray-900 text-white flex items-center gap-2 disabled:opacity-60" data-testid="bv-submit">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Submit for verification
      </button>
    </form>
  );
}

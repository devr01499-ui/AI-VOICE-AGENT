'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { KycVerificationBanner } from './KycVerificationBanner';

interface KycVerificationFormProps {
  phoneNumberId: string;
  initialStatus?: 'pending' | 'verified' | 'failed' | null;
  onSuccess?: () => void;
}

export function KycVerificationForm({ phoneNumberId, initialStatus, onSuccess }: KycVerificationFormProps) {
  const getRuntimeUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    return envUrl || (isLocal ? 'http://localhost:3001' : 'https://ai-voice-agent-backend-mv32.onrender.com');
  };

  const [documentType, setDocumentType] = useState('PAN');
  const [documentNumber, setDocumentNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(initialStatus || null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentNumber.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const apiBase = getRuntimeUrl();
      // Simulate API call to our own backend which calls Vobiz API
      const res = await fetch(`${apiBase}/api/v2/kyc/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          phoneNumberId,
          documentType,
          documentData: { documentNumber }
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to submit documents');
      }

      setStatus('pending');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'verified' || status === 'pending') {
    return <KycVerificationBanner status={status} />;
  }

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm max-w-md w-full">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Identity Verification (eKYC)</h2>
      <p className="text-sm text-gray-500 mb-6">
        As per telecom regulations, you must verify your identity to activate this phone number.
      </p>

      {status === 'failed' && <KycVerificationBanner status="failed" reason="Document rejected. Please try again." />}
      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
          <select 
            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            <option value="PAN">PAN (India)</option>
            <option value="GST">GST (India)</option>
            <option value="CIN">CIN (India)</option>
            <option value="INTERNATIONAL" disabled>International (Coming Soon)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Number</label>
          <input 
            type="text" 
            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
            placeholder={`Enter ${documentType} number`}
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !documentNumber.trim()}
          className="w-full bg-blue-600 text-white rounded-md py-2 px-4 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex justify-center items-center"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Submit for Verification
        </button>
      </form>
    </div>
  );
}

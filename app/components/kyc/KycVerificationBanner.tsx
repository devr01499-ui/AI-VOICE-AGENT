'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface KycVerificationBannerProps {
  status: 'pending' | 'verified' | 'failed' | null;
  reason?: string;
}

export function KycVerificationBanner({ status, reason }: KycVerificationBannerProps) {
  if (!status) return null;

  if (status === 'verified') {
    return (
      <div className="flex items-center p-4 mb-4 text-green-800 rounded-lg bg-green-50">
        <CheckCircle className="w-5 h-5 mr-3" />
        <span className="font-medium">Verified — number active</span>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center p-4 mb-4 text-yellow-800 rounded-lg bg-yellow-50">
        <Clock className="w-5 h-5 mr-3" />
        <span className="font-medium">Verification pending. Our telecom partner (Vobiz) is reviewing your documents.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center p-4 mb-4 text-red-800 rounded-lg bg-red-50">
      <AlertCircle className="w-5 h-5 mr-3" />
      <div>
        <span className="font-medium block">Verification failed</span>
        {reason && <span className="text-sm mt-1 block">{reason}</span>}
      </div>
    </div>
  );
}

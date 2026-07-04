'use client';

import React from 'react';
import { Eye, ShieldAlert } from 'lucide-react';

export default function LiveMonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Live Calls Monitoring</h1>
        <p className="text-xs text-slate-400">Spy or intercept active telephony sessions on the fly.</p>
      </div>

      <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="p-12 text-center space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Eye className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">No active calls running</h4>
          <p className="text-[11px] text-slate-400">All outbound and inbound carrier lines are currently idle.</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Eye, ShieldCheck, Activity, Phone } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function LiveMonitoringPage() {
  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Eye className="h-5 w-5 text-emerald-600" /> Live Audio Channels
        </h1>
        <p className="text-xs text-slate-400 mt-1">Intervene, monitor, and audit live active calls in progress across the telephone lines.</p>
      </div>

      <div className="border border-slate-200 bg-white rounded-3xl p-12 text-center space-y-3 shadow-sm max-w-2xl">
        <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
          <Activity className="h-5 w-5 animate-pulse text-emerald-600" />
        </div>
        <h4 className="text-xs font-bold text-slate-850">No active calls in progress</h4>
        <p className="text-[11px] text-slate-400">When outbound or inbound calls connect, they will populate here in real-time with barge-in triggers.</p>
      </div>
    </div>
  );
}

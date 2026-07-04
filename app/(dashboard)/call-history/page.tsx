'use client';

import React from 'react';
import { History, Search, PhoneCall } from 'lucide-react';

export default function CallHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Call History Logs</h1>
        <p className="text-xs text-slate-400">View complete details, transcripts, recording files, and token usage for all sessions.</p>
      </div>

      <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50/50">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-64 text-slate-400 text-xs">
            <Search className="h-4 w-4 mr-2 text-slate-400" />
            <input type="text" placeholder="Filter by phone number..." className="bg-transparent border-none text-xs focus:outline-none w-full text-slate-700" />
          </div>
        </div>
        
        <div className="p-12 text-center space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <History className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">No calls matching query found</h4>
          <p className="text-[11px] text-slate-400">Initiate calls from the Agent playground to start recording telemetry logs.</p>
        </div>
      </div>
    </div>
  );
}

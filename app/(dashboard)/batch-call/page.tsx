'use client';

import React from 'react';
import { FileSpreadsheet, Upload, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BatchCallPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Batch Call Campaigns</h1>
        <p className="text-xs text-slate-400">Trigger outbound voice dial actions concurrently using parsed spreadsheet rosters.</p>
      </div>

      <div className="border-2 border-dashed border-slate-200 bg-white p-12 rounded-3xl text-center space-y-4 max-w-xl mx-auto">
        <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mx-auto">
          <Upload className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800">Upload CSV Roster</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Upload your campaign contact sheets. Ensure your files contain E.164 phone numbers and associated template tags.
          </p>
        </div>
        <div className="pt-2">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-555 text-white font-bold rounded-xl text-xs h-9 px-6">
            Choose CSV File
          </Button>
        </div>
      </div>
    </div>
  );
}

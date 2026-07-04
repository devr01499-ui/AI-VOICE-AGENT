'use client';

import React from 'react';
import { CheckSquare, Star } from 'lucide-react';

export default function AiQaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">AI Quality Assurance</h1>
        <p className="text-xs text-slate-400">Evaluate agent responses against semantic benchmarks, tone rules, and compliance checklists.</p>
      </div>

      <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="p-12 text-center space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <CheckSquare className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">No QA runs processed</h4>
          <p className="text-[11px] text-slate-400">Select candidate logs to evaluate acoustic tone and protocol checklist completion.</p>
        </div>
      </div>
    </div>
  );
}

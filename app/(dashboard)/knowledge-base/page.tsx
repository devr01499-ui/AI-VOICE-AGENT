'use client';

import React from 'react';
import { Database, Search, ArrowUpRight, Plus, Link as LinkIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function KnowledgeBasePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Knowledge Base</h1>
          <p className="text-xs text-slate-400">Manage documents, URLs, and QA context indexing to optimize LLM RAG performance.</p>
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-555 text-white font-bold rounded-xl text-xs h-9 px-4">
          <Plus className="h-4 w-4 mr-1.5" /> Add Data Source
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-slate-200 bg-white p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Static Documents</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">Upload PDF, TXT, or markdown documentation to seed agent contexts.</p>
          </div>
          <span className="text-[10px] text-slate-400 font-bold block pt-2 border-t border-slate-100">0 Files Processed</span>
        </div>

        <div className="border border-slate-200 bg-white p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
              <LinkIcon className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">URL Scraping</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">Scrape product URLs or directories periodically to sync documentation.</p>
          </div>
          <span className="text-[10px] text-slate-400 font-bold block pt-2 border-t border-slate-100">0 Links Connected</span>
        </div>

        <div className="border border-slate-200 bg-white p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <Database className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">Q&A Knowledge Base</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">Insert explicit query-answer strings to resolve hard-coded instructions.</p>
          </div>
          <span className="text-[10px] text-slate-400 font-bold block pt-2 border-t border-slate-100">0 Q&A Pairs Configured</span>
        </div>
      </div>
    </div>
  );
}

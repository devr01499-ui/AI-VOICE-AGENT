'use client';

import React from 'react';
import { Database, Plus, Upload, Link2, FileText, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function KnowledgeBasePage() {
  const documents = [
    { id: 'doc-1', title: 'IndiCorp Returns Dispatch Guideline', type: 'PDF Document', size: '2.4 MB', status: 'Indexed' },
    { id: 'doc-2', title: 'Product FAQ list reference', type: 'URL Webpage', size: 'https://indicorp.in/faq', status: 'Indexed' }
  ];

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Database className="h-5 w-5 text-emerald-600" /> Knowledge Base RAG
        </h1>
        <p className="text-xs text-slate-400 mt-1">Upload flat-file documents or index web URLs to train your voice AI agent on internal knowledge bases.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden md:col-span-2">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800">Indexed Sources</CardTitle>
            <Database className="h-4.5 w-4.5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            {documents.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-400">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">{d.title}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{d.type} • {d.size}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> {d.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden md:col-span-1">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Add Source</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5">
            <Button className="w-full text-xs bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl py-5">
              <Upload className="h-4 w-4 mr-1.5" /> Upload File (PDF/TXT)
            </Button>
            <Button variant="outline" className="w-full text-xs border-slate-200 text-slate-700 bg-white rounded-xl py-5">
              <Link2 className="h-4 w-4 mr-1.5" /> Index Website URL
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

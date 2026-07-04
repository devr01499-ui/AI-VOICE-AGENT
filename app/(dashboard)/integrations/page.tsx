'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link2, ShieldCheck, CheckCircle2, AlertTriangle, Cpu, HelpCircle } from 'lucide-react';

export default function IntegrationsPage() {
  const providers = [
    { title: 'HubSpot CRM', category: 'CRM', desc: 'Sync qualified lead metadata, conversation logs, and recordings.', status: 'Connected' },
    { title: 'Salesforce', category: 'CRM', desc: 'Map CRM pipelines and capture customer responses automatically.', status: 'Configure' },
    { title: 'Zapier Actions', category: 'Workflow', desc: 'Trigger complex multi-step workflows on call completion events.', status: 'Connected' },
    { title: 'Stripe Payments', category: 'Payment', desc: 'Link invoices and trigger conversational payment collection flows.', status: 'Configure' },
  ];

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-emerald-600" /> Integrations Studio
        </h1>
        <p className="text-xs text-slate-400 mt-1">Connect your workspace to external databases, CRMs, workflow pipelines, and billing gateways.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {providers.map((p) => (
          <Card key={p.title} className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden hover:border-slate-350 transition-colors">
            <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {p.category}
                </span>
                <span className={`text-[10px] font-bold flex items-center gap-1 ${
                  p.status === 'Connected' ? 'text-emerald-700' : 'text-slate-400'
                }`}>
                  {p.status === 'Connected' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null} {p.status}
                </span>
              </div>
              <CardTitle className="text-sm font-bold text-slate-800 mt-2">{p.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <p className="text-slate-500 text-xs leading-relaxed">{p.desc}</p>
              <Button 
                variant={p.status === 'Connected' ? 'outline' : 'default'} 
                className={`w-full text-xs rounded-xl ${
                  p.status === 'Connected' 
                    ? 'border-slate-200 text-slate-700 bg-white' 
                    : 'bg-emerald-600 hover:bg-emerald-555 text-white'
                }`}
              >
                {p.status === 'Connected' ? 'Manage Connection' : 'Configure Integration'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

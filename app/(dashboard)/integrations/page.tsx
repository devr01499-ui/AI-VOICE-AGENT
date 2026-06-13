'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link2, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function IntegrationsPage() {
  const providers = [
    { title: 'HubSpot CRM', category: 'CRM', desc: 'Sync qualified lead metadata, conversation logs, and recordings.', status: 'Connected' },
    { title: 'Salesforce', category: 'CRM', desc: 'Map CRM pipelines and capture customer responses automatically.', status: 'Configure' },
    { title: 'Zapier Actions', category: 'Workflow', desc: 'Trigger complex multi-step workflows on call completion events.', status: 'Connected' },
    { title: 'Stripe Payments', category: 'Payment', desc: 'Link invoices and trigger conversational payment collection flows.', status: 'Configure' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Integrations</h1>
        <p className="text-slate-400 text-sm mt-1">Connect your workspace to external databases, CRMs, workflow pipelines, and billing gates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {providers.map((p) => (
          <Card key={p.title} className="border-slate-800 bg-slate-900/40 backdrop-blur hover:border-slate-700 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded uppercase tracking-wider">
                  {p.category}
                </span>
                <span className={`text-[10px] font-bold flex items-center gap-1 ${
                  p.status === 'Connected' ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  {p.status === 'Connected' ? <CheckCircle2 className="h-3 w-3" /> : null} {p.status}
                </span>
              </div>
              <CardTitle className="text-lg text-white mt-2">{p.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-400 text-xs leading-relaxed">{p.desc}</p>
              <Button className="w-full text-xs" variant={p.status === 'Connected' ? 'outline' : 'premium'}>
                {p.status === 'Connected' ? 'Manage Connection' : 'Configure Integration'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

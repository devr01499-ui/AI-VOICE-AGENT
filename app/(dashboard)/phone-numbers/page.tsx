'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhoneCall, Plus, HelpCircle, RefreshCw } from 'lucide-react';

export default function PhoneNumbersPage() {
  const dummyNumbers = [
    { id: 1, number: '+1 (555) 019-2834', status: 'Linked', agent: 'Customer Support Pro', provider: 'Twilio' },
    { id: 2, number: '+1 (555) 012-3849', status: 'Unassigned', agent: 'None', provider: 'Plivo' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Phone Numbers</h1>
          <p className="text-slate-400 text-sm mt-1">Claim inbound phone numbers or bind credentials endpoints to Twilio, Plivo and Exotel.</p>
        </div>
        <Button variant="premium">
          <Plus className="h-4 w-4 mr-1.5" /> Buy New Number
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {dummyNumbers.map((num) => (
          <Card key={num.id} className="border-slate-800 bg-slate-900/40 backdrop-blur hover:border-slate-700 transition-colors">
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-950 border border-blue-900/40 flex items-center justify-center text-blue-400 shrink-0">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{num.number}</div>
                  <div className="text-xs text-slate-400">Linked to: <span className="text-blue-400 font-medium">{num.agent}</span></div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-950/50 border border-slate-800/80 px-2 py-0.5 rounded uppercase tracking-wider">
                  {num.provider}
                </span>
                <span className={`px-2.5 py-0.5 border text-[10px] font-bold rounded uppercase tracking-wider ${
                  num.status === 'Linked' 
                    ? 'bg-emerald-950/50 border-emerald-900 text-emerald-400' 
                    : 'bg-amber-950/50 border-amber-900 text-amber-400'
                }`}>
                  {num.status}
                </span>
                <Button variant="outline" size="sm" className="text-xs bg-slate-950 border-slate-800 text-slate-400 hover:text-white">
                  Manage Routing
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

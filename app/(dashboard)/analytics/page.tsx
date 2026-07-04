'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart3, PhoneCall, Clock, CreditCard, Sparkles, TrendingUp } from 'lucide-react';

export default function AnalyticsPage() {
  const stats = [
    { title: 'Total Calls Dialed', value: '18,520', icon: PhoneCall, change: '+12.5%' },
    { title: 'Total Conversation Mins', value: '45,620m', icon: Clock, change: '+8.4%' },
    { title: 'Weighted Gemini Cost', value: '₹14,520.15', icon: Sparkles, change: '+14.2%' },
    { title: 'Vobiz Telephony Cost', value: '₹8,334.40', icon: CreditCard, change: '+6.1%' }
  ];

  return (
    <div className="space-y-6 bg-[#FDFBF7]">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-600" /> Platform Analytics
        </h1>
        <p className="text-xs text-slate-400 mt-1">Review operational performance metrics, conversational statistics, and overall cost distributions.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item) => (
          <Card key={item.title} className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 flex flex-row items-center justify-between">
              <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">{item.title}</span>
              <item.icon className="h-4 w-4 text-emerald-600 shrink-0" />
            </CardHeader>
            <CardContent className="p-5 space-y-2">
              <span className="text-2xl font-extrabold text-slate-800 block font-mono">{item.value}</span>
              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> {item.change} from last month
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

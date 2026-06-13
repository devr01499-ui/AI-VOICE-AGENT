'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Layers, ArrowRight, Shield } from 'lucide-react';

export default function TemplatesPage() {
  const categories = ['Sales', 'Customer Support', 'Healthcare', 'E-commerce', 'Operations'];

  const templates = [
    { title: 'Customer Support Agent', category: 'Customer Support', rate: '⭐ 4.9', desc: 'FAQ resolution, automated ticket compiling, and dynamic escalations.' },
    { title: 'Recruitment Screener', category: 'Operations', rate: '⭐ 4.8', desc: 'Pre-screening interview scoring and calendar booking link dispatching.' },
    { title: 'Dentist Booking Assistant', category: 'Healthcare', rate: '⭐ 4.7', desc: 'Check scheduling slots and record patient confirmation records.' },
    { title: 'Overdue Payment Collector', category: 'Sales', rate: '⭐ 4.9', desc: 'Negotiate payment timelines and share dynamic Razorpay links.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Templates Gallery</h1>
        <p className="text-slate-400 text-sm mt-1">Deploy production-ready workflows with pre-filled LLM and TTS prompts.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
        {categories.map((cat, idx) => (
          <Button key={cat} variant={idx === 0 ? 'premium' : 'outline'} className="text-xs whitespace-nowrap bg-slate-900 border-slate-800 text-slate-300">
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {templates.map((tpl) => (
          <Card key={tpl.title} className="border-slate-800 bg-slate-900/40 backdrop-blur hover:border-slate-700 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900/30 px-2 py-0.5 rounded uppercase tracking-wider">
                  {tpl.category}
                </span>
                <span className="text-xs text-amber-400 font-semibold">{tpl.rate}</span>
              </div>
              <CardTitle className="text-lg text-white mt-2">{tpl.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-400 text-xs leading-relaxed">{tpl.desc}</p>
              <Button className="w-full text-xs" variant="outline">
                Use Template <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { 
  CheckCircle, 
  Sparkles, 
  Calculator,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function SubscriptionPage() {
  const [minutes, setMinutes] = useState<number>(5000);

  // Consolidated All-inclusive Voice Engine Rate
  const VOICE_ENGINE_RATE = 0.0600; // $0.06 per minute
  const estimatedMonthlyBill = Number((minutes * VOICE_ENGINE_RATE).toFixed(2));

  const plans = [
    {
      name: 'Developer Sandbox',
      price: '$0',
      description: 'Perfect for sandbox testing and prototyping voice conversation paths.',
      features: [
        '1 active voice agent',
        'Inbound simulator widget',
        '100 monthly minutes',
        'Standard speech analytics history',
        'Secure CRM logging',
      ],
      cta: 'Start Free Sandbox',
      href: '/dashboard',
      premium: false
    },
    {
      name: 'Growth Plan',
      price: '$79',
      subtext: '/month',
      description: 'Ideal for scaling active campaigns and small outreach teams.',
      features: [
        'Up to 5 active voice agents',
        'Concurrent calls support',
        '10,000 monthly call minutes included',
        'Outbound custom telephone SIP routes',
        'Real-time conversation transcripts',
        'Primary edge hosting clusters',
      ],
      cta: 'Upgrade to Growth',
      href: '/dashboard',
      premium: true
    },
    {
      name: 'Enterprise Custom',
      price: 'Custom',
      description: 'For corporate operations requiring custom telephony SLA packages.',
      features: [
        'Unlimited active voice agents',
        'High concurrency limits (100+ channels)',
        'Private network deployment options',
        'Enterprise security audit alignment',
        'Custom fine-tuned agent guidelines',
        'Dedicated integration assistance',
      ],
      cta: 'Speak with Architects',
      href: '/contact',
      premium: false
    }
  ];

  return (
    <div className="space-y-16 py-16 px-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white">
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          Transparent Pricing
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
          Simple Plans For Scaling Voice AI
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          No hidden fees or complex margins. Choose a plan, load your keys, and deploy human-like voice agents instantly.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((p) => (
          <Card key={p.name} className={`bg-slate-900/20 border-white/5 backdrop-blur hover:border-white/10 transition-all flex flex-col justify-between relative overflow-hidden ${p.premium ? 'ring-1 ring-blue-500/50' : ''}`}>
            {p.premium && (
              <div className="absolute top-0 right-0 bg-white text-[10px] font-extrabold text-slate-950 px-3 py-1 rounded-bl uppercase tracking-wider">
                Popular
              </div>
            )}
            <CardHeader className="pb-6">
              <CardTitle className="text-base font-bold text-white">{p.name}</CardTitle>
              <CardDescription className="text-slate-400 text-xs min-h-[40px] mt-1.5">{p.description}</CardDescription>
              <div className="pt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white tracking-tight">{p.price}</span>
                {p.subtext && <span className="text-xs text-slate-500">{p.subtext}</span>}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pb-6 flex-grow">
              <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Included Features</h4>
              <ul className="space-y-2.5 text-xs text-slate-300">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-white shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardContent className="pt-4 pb-6 border-t border-white/5 mt-auto">
              <Link href={p.href}>
                <Button className={`w-full text-xs font-bold h-10 ${p.premium ? 'bg-white hover:bg-slate-200 text-slate-950' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/5'}`}>
                  {p.cta}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credit Estimator */}
      <section className="bg-slate-900/30 border border-white/5 rounded-2xl p-8 max-w-4xl mx-auto relative overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-white" />
            Live Usage Estimator
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Estimate your monthly conversation budget based on predicted minutes. Our system consolidates hosting, connectivity, and voice synthesis rates into a single clear figure.
          </p>
          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Est. Monthly Minutes</label>
            <Input
              type="number"
              min={100}
              max={1000000}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-slate-950/80 border-white/5 text-xs h-10 text-white focus:border-white/10 focus:ring-white/5"
            />
          </div>
        </div>

        <div className="bg-slate-950/50 p-6 rounded-lg border border-white/5 space-y-4">
          <div className="flex items-center justify-between text-xs border-b border-white/5 pb-3">
            <span className="text-slate-400">Total Minutes</span>
            <span className="text-white font-semibold">{minutes.toLocaleString()} min</span>
          </div>
          
          <div className="flex items-center justify-between text-xs border-b border-white/5 pb-3">
            <span className="text-slate-400">All-inclusive Rate</span>
            <span className="text-slate-300 font-medium">${VOICE_ENGINE_RATE.toFixed(4)} / min</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Est. Monthly Bill</span>
              <span className="text-[10px] text-slate-500">Calculated Conversation Rate</span>
            </div>
            <span className="text-2xl font-extrabold text-white">${estimatedMonthlyBill.toLocaleString()}</span>
          </div>
          
          <div className="flex gap-1.5 p-2.5 rounded bg-slate-900/40 border border-white/5 text-[10px] text-slate-500 items-start">
            <Info className="h-3.5 w-3.5 text-white shrink-0 mt-0.5" />
            <span>Estimates depend on outbound telephony route selections and active speaker duration patterns.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

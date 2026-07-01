'use client';

import React, { useState } from 'react';
import { 
  CheckCircle, 
  Sparkles, 
  HelpCircle, 
  CreditCard,
  Calculator,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function SubscriptionPage() {
  const [minutes, setMinutes] = useState<number>(5000);

  // Constants based on average provider billing
  const ASR_RATE = 0.0044; // Deepgram $0.0044 / min
  const LLM_RATE = 0.0150; // Gemini Flash $0.0150 / min
  const TTS_RATE = 0.0240; // ElevenLabs Turbo $0.0240 / min
  const TELEPHONY_RATE = 0.0180; // Vobiz $0.0180 / min
  const OVERHEAD_RATE = 0.0086; // Orchestration margin

  const totalCostPerMinute = ASR_RATE + LLM_RATE + TTS_RATE + TELEPHONY_RATE + OVERHEAD_RATE; // ~$0.07 / min
  const estimatedMonthlyBill = Number((minutes * totalCostPerMinute).toFixed(2));

  const plans = [
    {
      name: 'Developer Free',
      price: '$0',
      description: 'Perfect for sandbox testing and prototyping Voice AI configurations.',
      features: [
        '1 active agent setup',
        'Mock telephony simulator',
        '100 monthly call minutes',
        'Standard Google API Key support',
        'Local SQLite logging history',
      ],
      cta: 'Get Started Free',
      href: '/dashboard',
      premium: false
    },
    {
      name: 'Growth Plan',
      price: '$79',
      subtext: '/month',
      description: 'Ideal for scaling small campaigns and SMB support teams.',
      features: [
        'Up to 5 active voice agents',
        'Concurrent calls support',
        '10,000 monthly call minutes',
        'Custom Vobiz SIP integration',
        'Real-time transcription logs',
        'Standard edge latency clusters',
      ],
      cta: 'Upgrade to Growth',
      href: '/dashboard',
      premium: true
    },
    {
      name: 'Enterprise Custom',
      price: 'Custom',
      description: 'For corporate systems requiring dedicated hardware and security.',
      features: [
        'Unlimited active agents',
        'Dedicated concurrent lines (100+)',
        'VPC private cloud hosting',
        'ISO 27001 & SOC-2 compliance blueprints',
        'Custom fine-tuned LLM support',
        'Dedicated SLA & support architects',
      ],
      cta: 'Contact Sales',
      href: '/contact',
      premium: false
    }
  ];

  return (
    <div className="space-y-16 py-16 px-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/40 border border-blue-900/30 text-blue-400">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Transparent Pricing
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
          Simple Plans For Scaling Voice AI
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          No hidden fees or telephony margins. Choose a plan, connect your API keys, and start calling instantly.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((p) => (
          <Card key={p.name} className={`bg-slate-900/20 border-slate-900 backdrop-blur hover:border-slate-800 transition-all flex flex-col justify-between relative overflow-hidden ${p.premium ? 'ring-2 ring-blue-500/50' : ''}`}>
            {p.premium && (
              <div className="absolute top-0 right-0 bg-blue-600 text-[10px] font-extrabold text-white px-3 py-1 rounded-bl uppercase tracking-wider">
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
                    <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardContent className="pt-4 pb-6 border-t border-slate-900 mt-auto">
              <Link href={p.href}>
                <Button className={`w-full text-xs font-bold h-10 ${p.premium ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800'}`}>
                  {p.cta}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credit Estimator */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 max-w-4xl mx-auto relative overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-400" />
            Live Usage Estimator
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Estimate your monthly pipeline cost based on live minutes. Our engine aggregates raw provider rates without charging additional markup on TTS characters or ASR packages.
          </p>
          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Est. Monthly Minutes</label>
            <Input
              type="number"
              min={100}
              max={1000000}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-slate-950/80 border-slate-800 text-xs h-10 text-white focus:border-blue-500 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="bg-slate-950/50 p-6 rounded-lg border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between text-xs border-b border-slate-900/80 pb-3">
            <span className="text-slate-400">Total Minutes</span>
            <span className="text-white font-semibold">{minutes.toLocaleString()} min</span>
          </div>
          
          <div className="flex items-center justify-between text-xs border-b border-slate-900/80 pb-3">
            <span className="text-slate-400">Aggregated Rate</span>
            <span className="text-slate-300 font-medium">${totalCostPerMinute.toFixed(4)} / min</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Est. Monthly Bill</span>
              <span className="text-[10px] text-slate-500">ASR + LLM + TTS + Telephony</span>
            </div>
            <span className="text-2xl font-extrabold text-blue-400">${estimatedMonthlyBill.toLocaleString()}</span>
          </div>
          
          <div className="flex gap-1.5 p-2.5 rounded bg-slate-900/40 border border-slate-800 text-[10px] text-slate-500 items-start">
            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
            <span>Estimates depend on Gemini Flash input/output token counts and standard character usage inside ElevenLabs.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

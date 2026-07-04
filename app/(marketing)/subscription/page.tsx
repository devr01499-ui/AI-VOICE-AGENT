'use client';

import React from 'react';
import Link from 'next/link';
import { 
  CheckCircle, 
  HelpCircle, 
  Sparkles, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  Zap,
  PhoneCall
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function SubscriptionPage() {
  const plans = [
    {
      name: 'Starter',
      price: '$49',
      period: '/month',
      desc: 'Perfect for small firms automating initial intake screenings.',
      features: [
        '500 monthly calls included',
        '2 active agent configurations',
        'Sub-500ms voice turnaround latency',
        'Standard voice choices selection',
        'Standard API callback integrations',
        'Email customer support'
      ],
      cta: 'Choose Starter',
      badge: null,
      color: 'border-slate-200 bg-white'
    },
    {
      name: 'Professional',
      price: '$199',
      period: '/month',
      desc: 'Engineered for scaling mid-market campaigns across industries.',
      features: [
        '2,500 monthly calls included',
        '10 active agent configurations',
        'Sub-200ms ultra-low latency priority',
        'Auto-Schedule Calendar tool access',
        'All voice models (Fenrir, Kore, etc.)',
        'Priority Slack customer support',
        'Custom webhooks and API hooks'
      ],
      cta: 'Choose Professional',
      badge: 'Popular choice',
      color: 'border-emerald-555 bg-emerald-50/10'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      desc: 'Custom-tailored solutions for massive carrier-grade requirements.',
      features: [
        'Unlimited monthly calls',
        'Unlimited agent configurations',
        'Dedicated server-side edge clusters',
        'Full custom tool development support',
        'Dedicated account SLA commitments',
        'HIPAA / GDPR compliance packages',
        '24/7 priority phone support lines'
      ],
      cta: 'Contact Sales',
      badge: 'Tailored SLA',
      color: 'border-amber-250 bg-white'
    }
  ];

  return (
    <div className="space-y-20 py-16 px-6 max-w-7xl mx-auto bg-[#FDFBF7] text-slate-700">
      
      {/* Header section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          Transparent Performance-Driven Pricing
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight leading-tight">
          Select a pricing tier built to scale.
        </h1>
        <p className="text-slate-500 text-sm md:text-base leading-relaxed">
          Upgrade your communication capabilities with native audio-to-audio voice agents, custom scheduling features, and high-fidelity resampling.
        </p>
      </section>

      {/* Pricing plans cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((p) => (
          <Card key={p.name} className={`border rounded-3xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex flex-col justify-between ${p.color}`}>
            <CardContent className="p-8 space-y-6 flex-1 flex flex-col justify-between">
              
              <div className="space-y-4">
                {p.badge && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    {p.badge}
                  </span>
                )}
                
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800">{p.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                </div>

                <div className="pt-2">
                  <span className="text-4xl font-extrabold text-slate-800">{p.price}</span>
                  <span className="text-xs text-slate-400 font-semibold">{p.period}</span>
                </div>

                <ul className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-655 font-semibold">
                  {p.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                <Link href="/agents">
                  <Button className={`w-full font-bold text-xs tracking-wider uppercase py-5 rounded-2xl ${
                    p.name === 'Professional'
                      ? 'bg-emerald-600 hover:bg-emerald-555 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}>
                    {p.cta} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>

            </CardContent>
          </Card>
        ))}
      </section>

      {/* FAQ Quick Links */}
      <section className="space-y-8 bg-slate-50 p-8 rounded-3xl border border-slate-200">
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Billing Queries</span>
          <h3 className="text-xl md:text-2xl font-extrabold text-slate-800">Subscription FAQs</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
          <div className="space-y-1.5 bg-white p-5 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-800">Can I modify my subscription plan or cancel anytime?</h4>
            <p className="text-slate-500">
              Yes, you can upgrade, downgrade, or cancel your active subscription package directly inside the Console billing section. Adjustments will apply starting next billing cycle.
            </p>
          </div>

          <div className="space-y-1.5 bg-white p-5 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-800">What happens if I exhaust my monthly dial credit limits?</h4>
            <p className="text-slate-500">
              Professional and Starter users can purchase low-cost top-up credits at $0.08 per call minute directly inside their billing workspace to prevent any outbound line disruptions.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}

'use client';

import React from 'react';
import { 
  ShieldAlert, 
  ShoppingCart, 
  Home as HomeIcon, 
  Truck, 
  CreditCard,
  Briefcase,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function IndustriesPage() {
  const industries = [
    {
      title: 'Healthcare & Patient Intake',
      desc: 'Deliver human-like patience. Connect patients dynamically to scheduling engines, qualify symptoms on intake, and distribute prescription refill notifications under secure HIPAA-compliant voice clusters.',
      compliance: 'HIPAA & HITECH Compliant',
      metric: '92% Patient Engagement',
      icon: ShieldAlert,
      color: 'text-rose-400 bg-rose-950/40 border-rose-900/30'
    },
    {
      title: 'Retail & E-commerce',
      desc: 'Verify COD order confirmations, trigger outbound checkout recoveries, offer dynamic order dispatch tracking, and route complex claims straight to visual agent queues without delay.',
      compliance: 'PCI-DSS Compliant Pay-Nodes',
      metric: '18% Checkout Recovery Rate',
      icon: ShoppingCart,
      color: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30'
    },
    {
      title: 'Real Estate & Property Screening',
      desc: 'Prequalify buyers instantly. Automate inbound call routing to screen prospective tenant budgets, coordinate onsite tours, and transfer high-intent leads to human agents with transcription context.',
      compliance: 'Fair Housing Aligned Persona',
      metric: '3.4x Lead qualification Speed',
      icon: HomeIcon,
      color: 'text-blue-400 bg-blue-950/40 border-blue-900/30'
    },
    {
      title: 'Logistics & Supply Chain',
      desc: 'Manage fleet scheduling dynamically. AI agents coordinate live driver dispatch confirmations, check delivery window updates, and update carrier systems on route progress in real-time.',
      compliance: 'Continuous Carrier Logging',
      metric: '0% Dispatch Delay Gaps',
      icon: Truck,
      color: 'text-amber-400 bg-amber-950/40 border-amber-900/30'
    },
    {
      title: 'Financial Services',
      desc: 'Initiate account fraud alerts, coordinate payment reminders, qualify prospective credit card leads, and handle routine inquiries utilizing highly secure, encrypted voice gateways.',
      compliance: 'SOC-2 Type II Certified Node',
      metric: '99.9% Telephony Security Rate',
      icon: CreditCard,
      color: 'text-purple-400 bg-purple-950/40 border-purple-900/30'
    }
  ];

  return (
    <div className="space-y-16 py-16 px-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/40 border border-blue-900/30 text-blue-400">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Vertical Use Cases
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
          Tailored Voice AI Across Industries
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          Explore specialized configurations and compliant, sub-200ms latency voice assistants built for enterprise scale and compliant CRM database connections.
        </p>
      </div>

      {/* Industries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {industries.map((ind) => (
          <Card key={ind.title} className="bg-slate-900/20 border-slate-900 backdrop-blur hover:border-slate-800 transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-indigo-600/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <CardHeader className="pb-4">
                <div className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 mb-4 ${ind.color}`}>
                  <ind.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                  {ind.title}
                </CardTitle>
                <CardDescription className="text-slate-500 text-[10px] uppercase font-bold tracking-wider pt-1">
                  {ind.compliance}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 leading-relaxed pb-6">
                {ind.desc}
              </CardContent>
            </div>
            
            <CardContent className="pt-0 pb-6 border-t border-slate-900/60 mt-auto flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-semibold">{ind.metric}</span>
              <Link href="/contact" className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1">
                Request Demo <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA section */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 text-center space-y-6 max-w-4xl mx-auto relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <h3 className="text-xl md:text-2xl font-bold text-white">
          Need a Custom Compliance Blueprint?
        </h3>
        <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Our engineering team builds custom private network integrations (VPC), private SIP trunk mappings, and dedicated on-premise SQLite/PostgreSQL connectors.
        </p>
        <div className="pt-2">
          <Link href="/contact">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 px-6 shadow-lg shadow-blue-500/10">
              Speak with Voice Architects
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

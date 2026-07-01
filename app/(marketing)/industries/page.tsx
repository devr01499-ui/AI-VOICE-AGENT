'use client';

import React from 'react';
import { 
  ShieldAlert, 
  ShoppingCart, 
  Home as HomeIcon, 
  Truck, 
  CreditCard,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function IndustriesPage() {
  const industries = [
    {
      title: 'Healthcare Patient Outreach',
      desc: 'Deliver compassionate patient care. AI agents connect patients to scheduling platforms, verify registration details, and send appointment reminders securely.',
      compliance: 'Fully Encrypted Health Data Mappings',
      metric: '92% Care Plan Adherence',
      icon: ShieldAlert,
      color: 'text-white bg-slate-900 border-white/10'
    },
    {
      title: 'Retail & E-commerce Recovery',
      desc: 'Verify purchase details automatically, recover abandoned shopping carts, coordinate shipping window adjustments, and route inquiries dynamically.',
      compliance: 'Secure Payment Ledger Connections',
      metric: '18% Sales Recovery Boost',
      icon: ShoppingCart,
      color: 'text-white bg-slate-900 border-white/10'
    },
    {
      title: 'Real Estate Budgets & Screening',
      desc: 'Screen incoming leads instantly. AI assistants verify prospective buyer budgets, schedule walkthrough times, and log client contact data.',
      compliance: 'Fair Housing Policy Aligned Voice',
      metric: '3.4x Lead Intake Velocity',
      icon: HomeIcon,
      color: 'text-white bg-slate-900 border-white/10'
    },
    {
      title: 'Logistics Scheduling & Dispatch',
      desc: 'Optimize delivery pipelines. Agents confirm pickup notifications, coordinate driver status logs, and update shipping platforms natively.',
      compliance: 'Automated Status Synchronization',
      metric: '0% Uncoordinated Gaps',
      icon: Truck,
      color: 'text-white bg-slate-900 border-white/10'
    },
    {
      title: 'Financial Intake & Alerts',
      desc: 'Initiate critical alert notifications, coordinate billing schedule updates, verify account registration, and process inbound claims securely.',
      compliance: 'Verified Security Protocols Active',
      metric: '99.9% Communication Reliability',
      icon: CreditCard,
      color: 'text-white bg-slate-900 border-white/10'
    }
  ];

  return (
    <div className="space-y-16 py-16 px-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          Industry Use Cases
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
          Tailored Voice AI for Every Market
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          Deploy pre-configured voice agents designed to qualify leads, coordinate operations, and sync data natively with your existing tools.
        </p>
      </div>

      {/* Industries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {industries.map((ind) => (
          <Card key={ind.title} className="bg-slate-900/20 border-white/5 backdrop-blur hover:border-white/10 transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl pointer-events-none" />
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
            
            <CardContent className="pt-0 pb-6 border-t border-white/5 mt-auto flex items-center justify-between text-xs">
              <span className="text-blue-400 font-semibold">{ind.metric}</span>
              <Link href="/contact" className="text-slate-300 hover:text-white font-bold flex items-center gap-1">
                Request Demo <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA section */}
      <section className="bg-slate-900/30 border border-white/10 rounded-2xl p-8 text-center space-y-6 max-w-4xl mx-auto relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <h3 className="text-xl md:text-2xl font-bold text-white">
          Need a Custom Integration Blueprint?
        </h3>
        <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Our engineering team designs private networks, coordinates custom database syncing nodes, and links direct dial routes to meet your business needs.
        </p>
        <div className="pt-2">
          <Link href="/contact">
            <Button className="bg-white hover:bg-slate-200 text-slate-950 font-bold text-xs h-10 px-6 shadow-md">
              Speak with Voice Architects
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

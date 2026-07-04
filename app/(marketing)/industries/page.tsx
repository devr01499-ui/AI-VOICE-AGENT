'use client';

import React from 'react';
import Link from 'next/link';
import { 
  HeartHandshake, 
  ShoppingBag, 
  Building, 
  Truck, 
  Hotel, 
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function IndustriesPage() {
  const industries = [
    {
      title: 'Healthcare & Patient Intake',
      desc: 'Seamlessly schedule patient appointments, execute outbound post-op surveys, and route inquiries based on active speech triggers. Fully secured to guarantee compliance while providing warm, realistic voice dialogue.',
      highlights: ['Automated appointment scheduling', 'Post-discharge follow-ups', 'Medical screening scripts'],
      icon: HeartHandshake,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    },
    {
      title: 'Retail & E-Commerce Dialers',
      desc: 'Connect with shopping cart abandoners instantly, confirm large transactional bookings, and resolve logistics tracking inquiries using our responsive Catmull-Rom resampling voice streams.',
      highlights: ['Cart abandonment call follow-ups', 'High-value transactional safety check', 'Outbound delivery coordination'],
      icon: ShoppingBag,
      color: 'text-amber-700 bg-amber-50 border-amber-200/50'
    },
    {
      title: 'Real Estate Lead Qualification',
      desc: 'Qualify buyer intent automatically, capture scheduling bookings for open-house showings, and push lead metrics directly to agency databases in O(1) time.',
      highlights: ['Instant lead callback qualification', 'Property listing information dialers', 'Showing scheduling integrations'],
      icon: Building,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    },
    {
      title: 'Logistics & Dispatch Coordination',
      desc: 'Ensure continuous communication with drivers, coordinate dispatch timings, verify trailer numbers, and report load statuses dynamically over carrier lines.',
      highlights: ['Outbound load confirmation', 'Driver route status updates', 'Warehouse pickup booking alerts'],
      icon: Truck,
      color: 'text-amber-700 bg-amber-50 border-amber-200/50'
    },
    {
      title: 'Hospitality & Travel Bookings',
      desc: 'Upgrade room reservations, manage wake-up alarm calls, answer guest concierge queries, and handle checkout confirmations naturally.',
      highlights: ['Room upgrade offering campaigns', 'Checkout booking schedule checks', 'Guest support FAQs resolution'],
      icon: Hotel,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    }
  ];

  return (
    <div className="space-y-20 py-16 px-6 max-w-7xl mx-auto bg-[#FDFBF7] text-slate-700">
      
      {/* Header section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
          <Layers className="w-3.5 h-3.5 text-emerald-600" />
          Flexible Deployment Vectors
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight leading-tight">
          Tailored Voice AI for every industry vertical.
        </h1>
        <p className="text-slate-500 text-sm md:text-base leading-relaxed">
          Clarity combines sub-200ms latency, high-fidelity resampling, and native speech models to scale human-like voice conversations across diverse operational requirements.
        </p>
      </section>

      {/* Grid of detailed industries */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {industries.map((ind) => (
          <Card key={ind.title} className="border-slate-200 bg-white shadow-sm overflow-hidden rounded-3xl transition-all duration-300 hover:shadow-md hover:border-emerald-300">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl border flex items-center justify-center shrink-0 ${ind.color}`}>
                  <ind.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">{ind.title}</h3>
              </div>
              
              <p className="text-xs text-slate-500 leading-relaxed">
                {ind.desc}
              </p>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Key Capabilities</span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 font-semibold">
                  {ind.highlights.map((h, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* High-Impact CTA Dashboard Preview Card */}
      <section className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-8 shadow-sm">
        <div className="space-y-3 max-w-lg">
          <h3 className="text-xl md:text-2xl font-extrabold text-slate-800">
            Design Your Custom Workflows
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Instantly set up custom prompts, select voice identities, configure API callbacks, and start dialing.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full md:w-auto">
          <Link href="/subscription" className="w-full sm:w-auto">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-555 text-white font-extrabold text-xs h-10 px-6 shadow-sm rounded-2xl">
              Choose Pricing Plan
            </Button>
          </Link>
          <Link href="/agents" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full text-slate-700 border-slate-200 bg-white text-xs h-10 px-6 rounded-2xl">
              Go to Studio Console
            </Button>
          </Link>
        </div>
      </section>

    </div>
  );
}

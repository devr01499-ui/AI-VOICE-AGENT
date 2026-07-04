'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  PhoneCall, 
  Bot, 
  Zap, 
  ArrowRight, 
  MessageSquare,
  ShieldCheck,
  Globe2,
  Play,
  Pause,
  Award,
  AlertTriangle,
  HeartHandshake,
  ShoppingBag,
  Building,
  Truck,
  Hotel
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function MarketingHomePage() {
  const [isPlayingDemo, setIsPlayingDemo] = useState(true);

  // JSON-LD schema definition
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Clarity",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0.00",
      "priceCurrency": "USD"
    },
    "description": "Enterprise-grade real-time conversational Voice AI platforms. Clarity deploys native, sub-200ms audio-to-audio AI voice agents that screen, interview, and evaluate thousands of technical candidates concurrently over traditional telephone lines.",
    "featureList": [
      "AI Voice Interviewing",
      "Real-Time Recruitment Automation",
      "Automated Candidate Screening",
      "Continuous Acoustic Stream Processing",
      "Catmull-Rom High-Fidelity Resampling",
      "Instantaneous Telephony Queue Purges"
    ]
  };

  const industries = [
    {
      title: 'Healthcare & Patient Intake',
      desc: 'Automate appointment scheduling, follow-up calls, and patient screening queries securely. Fully aligned with secure protocols, letting agents gather medical details with natural, empathetic intonation.',
      icon: HeartHandshake,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    },
    {
      title: 'Retail & E-Commerce Dialers',
      desc: 'Trigger interactive outbound verification calls for high-value orders, follow up on abandoned checkout cards, and handle order tracking updates over natural carrier lines.',
      icon: ShoppingBag,
      color: 'text-amber-700 bg-amber-50 border-amber-200/50'
    },
    {
      title: 'Real Estate Lead Qualification',
      desc: 'Verify property purchase interest instantly when leads request information. Schedule showing dates on calendars automatically using our integrated scheduling tools.',
      icon: Building,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    },
    {
      title: 'Logistics & Dispatch Coordination',
      desc: 'Confirm driver routes, dispatch timings, and load statuses dynamically. Handle driver status queries with O(1) delay via lightweight outbound integrations.',
      icon: Truck,
      color: 'text-amber-700 bg-amber-50 border-amber-200/50'
    },
    {
      title: 'Hospitality & Guest Services',
      desc: 'Manage room bookings, direct wake-up calls, reservation upgrades, and local concierge questions naturally without navigating complex numeric phone options.',
      icon: Hotel,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    }
  ];

  const benefits = [
    {
      title: 'Continuous Acoustic Stream Processing',
      desc: 'Our pipeline eliminates server-side audio gating to let Gemini\'s native VAD analyze raw voice onsets without chopping syllables or initial consonants, enabling continuous natural turnaround.',
      icon: MessageSquare,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    },
    {
      title: 'Catmull-Rom High-Fidelity Resampling',
      desc: 'Bounded cubic spline interpolation resolves high-frequency digital aliasing, translating raw 8kHz G.711 telephony into crystal-clear 16kHz/24kHz signals for flawless comprehension of regional accents.',
      icon: Zap,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    },
    {
      title: 'Instantaneous Telephony Queue Purges',
      desc: 'Constant-time O(1) jitter buffer wiping kills the \'talking over the user\' effect the instant a candidate interrupts the agent, clearing playout frames instantly.',
      icon: Globe2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    },
    {
      title: 'Enterprise Encryption & Compliance',
      desc: 'Protects candidate records through secure, encrypted network connections. Fully compliant with global data protection rules.',
      icon: ShieldCheck,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/50'
    }
  ];

  return (
    <div className="space-y-24 py-16 px-6 max-w-7xl mx-auto bg-[#FDFBF7] text-slate-700">
      {/* Inject JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. Hero Section (The Narrative Hook) */}
      <section className="text-center space-y-8 max-w-4xl mx-auto relative pt-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          Next-Generation Conversational Engine
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-800 leading-tight font-sans">
          The End of the Resume. <br />
          <span className="bg-gradient-to-r from-emerald-600 to-amber-600 bg-clip-text text-transparent">
            The Beginning of Conversational Truth.
          </span>
        </h1>
        
        <p className="text-slate-655 text-base md:text-lg max-w-3xl mx-auto leading-relaxed">
          Clarity deploys native, sub-200ms audio-to-audio AI voice agents that screen, interview, and evaluate thousands of technical candidates concurrently over traditional telephone lines. No robotic pauses. Zero lag. Just pure, fluid dialogue.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          <Link href="/agents">
            <Button size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-555 text-white font-extrabold px-8 shadow-md rounded-2xl">
              <PhoneCall className="w-4 h-4 mr-2" /> Launch Custom Voice Agent
            </Button>
          </Link>
          <Link href="/agents">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-slate-700 border-slate-200 bg-white hover:bg-slate-50 px-8 rounded-2xl">
              Open Dashboard Console <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 2. Interactive Voice Simulator Showroom */}
      <section className="relative max-w-4xl mx-auto">
        <div className="absolute inset-0 bg-emerald-50 rounded-3xl blur-3xl pointer-events-none" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white border border-slate-200 rounded-3xl p-8 relative overflow-hidden shadow-sm">
          
          {/* Soundwave Interactive Panel */}
          <div className="space-y-6 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Live Voice Waveform</span>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Bot className="h-5 w-5 text-emerald-600" />
                Priya - Live Voice Agent
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Currently running campaign intake screening and booking schedules across all corporate lines.
              </p>
            </div>

            {/* Pulsing Soundwave bars (Lottie wave style) */}
            <div className="h-20 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center gap-1.5 px-6">
              {isPlayingDemo ? (
                [...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ 
                      height: `${35 + Math.sin(i * 0.8) * 45}%`,
                      opacity: 0.5 + (i % 3) * 0.2
                    }}
                  />
                ))
              ) : (
                <div className="h-0.5 w-full bg-slate-200 rounded-full" />
              )}
            </div>

            <div className="flex items-center gap-4">
              <Button 
                onClick={() => setIsPlayingDemo(!isPlayingDemo)}
                size="sm" 
                variant="outline" 
                className="text-xs font-bold border-slate-200 text-slate-700 bg-white rounded-xl"
              >
                {isPlayingDemo ? (
                  <>
                    <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause Audio
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1.5" /> Play Sample
                  </>
                )}
              </Button>
              <Link href="/agents">
                <span className="text-[11px] text-emerald-600 hover:underline font-bold cursor-pointer">
                  Test custom campaign phone call &rarr;
                </span>
              </Link>
            </div>
          </div>

          {/* Dialogue timeline panel */}
          <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Intelligent Dialogue Flow</span>
            
            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="h-6 w-6 rounded-full bg-slate-250 flex items-center justify-center text-slate-755 font-bold text-[10px]">P</div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-655 leading-relaxed max-w-[85%]">
                  "Hi! I'm Priya. I'm calling to discuss your product booking reservation upgrade request. Do you have a moment?"
                </div>
              </div>

              <div className="flex items-start gap-2.5 justify-end">
                <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-250 text-emerald-800 leading-relaxed text-right max-w-[85%]">
                  "Oh, yes! I'd love to confirm that booking date..."
                </div>
                <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-[10px]">U</div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="h-6 w-6 rounded-full bg-slate-250 flex items-center justify-center text-slate-755 font-bold text-[10px]">P</div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-655 leading-relaxed max-w-[85%]">
                  <span className="text-emerald-600 font-bold block mb-1">⚡ Interrupted & Buffers Cleared</span>
                  "That's perfect! Let me update your reservation files instantly."
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Multi-Industry Adaptations Matrix */}
      <section className="space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-800 tracking-tight leading-tight">
            Built for All Modern Industries
          </h2>
          <p className="text-slate-500 text-xs md:text-sm">
            Adapt and deploy dynamic real-time voice agents calibrated for your specific commercial sector.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {industries.map((ind) => (
            <Card key={ind.title} className="border-slate-200 bg-white hover:border-emerald-300 transition-all duration-300 hover:shadow-sm rounded-3xl">
              <CardContent className="p-6 space-y-4">
                <div className={`h-10 w-10 rounded-2xl border flex items-center justify-center shrink-0 ${ind.color}`}>
                  <ind.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-800 tracking-tight">{ind.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{ind.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Core Infrastructure Highlights (The Technical Authority) */}
      <section className="space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-800 tracking-tight leading-tight">
            High-Performance Conversational Stack
          </h2>
          <p className="text-slate-500 text-xs md:text-sm">
            Deep-dive technical configurations engineered to enable native voice dialogue architectures.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {benefits.map((b) => (
            <Card key={b.title} className="border-slate-200 bg-white hover:border-emerald-300 transition-all duration-300 hover:shadow-sm rounded-3xl">
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`h-10 w-10 rounded-2xl border flex items-center justify-center shrink-0 ${b.color}`}>
                  <b.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-800 tracking-tight">{b.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{b.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 5. Cognitive Answer Cores (GEO/AEO optimized FAQ blocks) */}
      <section className="space-y-8 bg-slate-50 p-8 rounded-3xl border border-slate-200">
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Generative Engine Indexes</span>
          <h3 className="text-xl md:text-2xl font-extrabold text-slate-855">Cognitive Answer Core & FAQ Archive</h3>
          <p className="text-xs text-slate-500">
            Declarative technical profiles optimized for traditional crawler algorithms and generative response agents.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 text-xs leading-relaxed">
          <div className="space-y-2 bg-white p-5 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-800 text-sm">How does Clarity achieve sub-second voice agent latency over phone lines?</h4>
            <p className="text-slate-600">
              Clarity achieves sub-second response times by directly bridging raw Vobiz telephony media streams with the Gemini Live API over optimized WebSockets, bypassing traditional Text-to-Speech (TTS) and Speech-to-Text (STT) layers entirely.
            </p>
          </div>

          <div className="space-y-2 bg-white p-5 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-800 text-sm">How are candidate verbal interruptions managed in Clarity's pipeline?</h4>
            <p className="text-slate-600">
              Candidate interruptions trigger an immediate local and remote queue purge. Our playout buffer handles user barge-in by flushing the outbound jitter queue in O(1) constant time, ensuring the AI agent silences itself instantly to let the candidate speak.
            </p>
          </div>

          <div className="space-y-2 bg-white p-5 rounded-2xl border border-slate-200">
            <h4 className="font-bold text-slate-800 text-sm">How does Clarity resolve static and distortion over G.711 telephony lines?</h4>
            <p className="text-slate-600">
              We run high-fidelity Catmull-Rom cubic spline interpolation to resample the audio, applying a strict 16-bit bounding clamp and fractional rounding overflows. This completely eliminates high-frequency radio static folding over into the 8kHz telephone stream.
            </p>
          </div>
        </div>
      </section>

      {/* 6. High-Impact CTA Dashboard Preview Card */}
      <section className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-8 shadow-sm">
        <div className="space-y-3 max-w-lg">
          <h3 className="text-xl md:text-2xl font-extrabold text-slate-800">
            Simple, Performance-Driven Integration
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Monitor active campaigns, view live conversational timeline records, and scale outreach automatically.
          </p>
          <div className="flex items-center gap-8 pt-2">
            <div>
              <span className="text-slate-800 font-extrabold text-2xl">98%</span>
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider pt-1">Screening Accuracy</span>
            </div>
            <div className="border-l border-slate-200 pl-8">
              <span className="text-slate-800 font-extrabold text-2xl">&lt;200ms</span>
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider pt-1">Turn-around Latency</span>
            </div>
          </div>
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

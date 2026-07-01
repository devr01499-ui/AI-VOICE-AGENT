'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  PhoneCall, 
  Bot, 
  Zap, 
  CheckCircle, 
  ArrowRight, 
  MessageSquare,
  ShieldCheck,
  Globe2,
  Play,
  Pause
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MarketingHomePage() {
  const [isPlayingDemo, setIsPlayingDemo] = useState(true);

  const benefits = [
    {
      title: 'Human-grade Conversation Flow',
      desc: 'Orchestrates natural, fluid turn-taking. Automatically starts and stops conversational streams based on active speaker energy without manual delays.',
      icon: MessageSquare,
      color: 'text-white bg-slate-900 border-white/10'
    },
    {
      title: 'Real-time Interruption Handling',
      desc: 'Instantly silences the AI agent the millisecond a candidate speaks, clearing the carrier audio stream mid-sentence so conversation flows naturally.',
      icon: Zap,
      color: 'text-blue-400 bg-slate-900 border-white/10'
    },
    {
      title: 'Universal Phone Mappings',
      desc: 'Seamlessly link standard corporate phone systems, customer management systems, and direct dial SIP trunks to launch conversational workflows.',
      icon: Globe2,
      color: 'text-white bg-slate-900 border-white/10'
    },
    {
      title: 'Enterprise Encryption & Compliance',
      desc: 'Protects candidate records and patient identifiers through secure, encrypted network connections. Compliant with top global privacy protocols.',
      icon: ShieldCheck,
      color: 'text-blue-400 bg-slate-900 border-white/10'
    }
  ];

  return (
    <div className="space-y-24 py-16 px-6 max-w-7xl mx-auto">
      {/* 1. Hero Showroom Section */}
      <section className="text-center space-y-8 max-w-4xl mx-auto relative pt-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white">
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
          Next-Generation Conversational Engine
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans">
          Conversational Voice Agents <br />
          <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            That Capture Human Intonation
          </span>
        </h1>
        
        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Clarity AI Voice orchestrates highly responsive voice assistants natively integrated into your phone network, reducing turn-taking latency below 200 milliseconds.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          <Link href="/test-hr">
            <Button size="lg" className="w-full sm:w-auto bg-white hover:bg-slate-200 text-slate-955 font-extrabold px-8 shadow-lg shadow-white/5">
              <PhoneCall className="w-4 h-4 mr-2" /> Call My Phone Now
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-white border-white/10 bg-slate-900/60 hover:bg-slate-900/80 hover:text-white px-8">
              Open Dashboard Console <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 2. Interactive Voice Simulator Showroom */}
      <section className="relative max-w-4xl mx-auto">
        <div className="absolute inset-0 bg-white/5 rounded-3xl blur-3xl pointer-events-none" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-900/30 border border-white/10 rounded-2xl p-8 backdrop-blur relative overflow-hidden shadow-2xl">
          
          {/* Soundwave Interactive Panel */}
          <div className="space-y-6 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Live Voice Waveform</span>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-400" />
                Priya - Live HR Recruiter
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Currently running outbound candidate intake screening campaigns for Delhi Tech Careers.
              </p>
            </div>

            {/* Pulsing Soundwave bars */}
            <div className="h-20 bg-slate-950/40 rounded-lg border border-white/5 flex items-center justify-center gap-1.5 px-6">
              {isPlayingDemo ? (
                [...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-white rounded-full transition-all duration-300 animate-pulse"
                    style={{ 
                      height: `${30 + Math.sin(i * 0.8) * 40}%`,
                      opacity: 0.3 + (i % 3) * 0.2
                    }}
                  />
                ))
              ) : (
                <div className="h-0.5 w-full bg-white/10 rounded-full" />
              )}
            </div>

            <div className="flex items-center gap-4">
              <Button 
                onClick={() => setIsPlayingDemo(!isPlayingDemo)}
                size="sm" 
                variant="outline" 
                className="text-xs font-bold border-white/10 text-white bg-slate-950/40"
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
              <Link href="/test-hr">
                <span className="text-[11px] text-blue-400 hover:underline font-bold cursor-pointer">
                  Test custom campaign phone call &rarr;
                </span>
              </Link>
            </div>
          </div>

          {/* Dialogue timeline panel */}
          <div className="space-y-4 bg-slate-950/50 p-5 rounded-xl border border-white/5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Intelligent Dialogue Flow</span>
            
            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center text-slate-950 font-bold text-[10px]">P</div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5 text-slate-300 leading-relaxed max-w-[85%]">
                  "Hi! I\'m Priya from Delhi Tech Careers. I\'m reviewing your software developer profile. Do you have a moment?"
                </div>
              </div>

              <div className="flex items-start gap-2.5 justify-end">
                <div className="bg-white/10 p-2.5 rounded-lg border border-white/10 text-white leading-relaxed text-right max-w-[85%]">
                  "Oh, yes! I actually have 3 years of React experience..."
                </div>
                <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-[10px]">U</div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center text-slate-950 font-bold text-[10px]">P</div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5 text-slate-300 leading-relaxed max-w-[85%]">
                  <span className="text-blue-400 font-bold block mb-1">⚡ Interrupted & Buffers Cleared</span>
                  "That\'s perfect! Can you tell me if you\'ve used TypeScript in production as well?"
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Benefit Showroom Section */}
      <section className="space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight leading-tight">
            Seamless Outbound Conversational Tech
          </h2>
          <p className="text-slate-400 text-xs md:text-sm">
            Everything your operations need to deploy natural, reliable customer screening agents.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {benefits.map((b) => (
            <Card key={b.title} className="border-white/5 bg-slate-900/10 backdrop-blur hover:border-white/10 transition-colors">
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${b.color}`}>
                  <b.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white tracking-tight">{b.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{b.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. High-Impact CTA Dashboard Preview Card */}
      <section className="bg-slate-900/30 border border-white/10 rounded-2xl p-8 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="space-y-3 max-w-lg">
          <h3 className="text-xl md:text-2xl font-bold text-white">
            Simple, Performance-Driven Integration
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Monitor active campaigns, view live conversational timeline records, and scale outreach automatically.
          </p>
          <div className="flex items-center gap-8 pt-2">
            <div>
              <span className="text-white font-extrabold text-2xl">98%</span>
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider pt-1">Screening Accuracy</span>
            </div>
            <div className="border-l border-white/10 pl-8">
              <span className="text-white font-extrabold text-2xl">&lt;200ms</span>
              <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider pt-1">Turn-around Latency</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full md:w-auto">
          <Link href="/subscription" className="w-full sm:w-auto">
            <Button className="w-full bg-white hover:bg-slate-200 text-slate-950 font-extrabold text-xs h-10 px-6 shadow-md">
              Choose Pricing Plan
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full text-white border-white/10 bg-slate-900/40 text-xs h-10 px-6">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  PhoneCall, 
  Bot, 
  Zap, 
  CheckCircle, 
  ArrowRight, 
  Volume2, 
  Clock, 
  Activity, 
  Users,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MarketingHomePage() {
  const features = [
    {
      title: 'Sub-200ms Response Latency',
      desc: 'Engineered using Gemini Live WebSockets (BidiGenerateContent), Deepgram stream decoders, and ElevenLabs Turbo pipelines for organic conversational flow.',
      icon: Clock,
      color: 'text-blue-400 bg-blue-950/40 border-blue-900/30'
    },
    {
      title: 'Explicit Server-Side VAD',
      desc: 'Active silence-detection protocols automatically commit conversational turns after 1.5s of candidate pauses, preventing deadlocks or silent hangs.',
      icon: Bot,
      color: 'text-indigo-400 bg-indigo-950/40 border-indigo-900/30'
    },
    {
      title: 'Real-time Interruption (Barge-In)',
      desc: 'Traps Google server content interruption flags instantly, issues a purge command to the Vobiz trunk, and flushes playback queues mid-syllable.',
      icon: Zap,
      color: 'text-amber-400 bg-amber-950/40 border-amber-900/30'
    },
    {
      title: 'Telephony Resampling Node',
      desc: 'Converts carrier-grade 8kHz G.711 mu-law audio to raw 16kHz PCM16 (Little-Endian) via linear interpolation, sending valid voice energy to the LLM.',
      icon: Activity,
      color: 'text-purple-400 bg-purple-950/40 border-purple-900/30'
    }
  ];

  return (
    <div className="space-y-24 py-16 px-6 max-w-7xl mx-auto">
      {/* 1. Hero Section */}
      <section className="text-center space-y-8 max-w-4xl mx-auto relative pt-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/40 border border-blue-900/30 text-blue-400">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          Next-Gen Conversational Engine
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans">
          Conversational Voice AI <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-500 bg-clip-text text-transparent">
            That Sounds Truly Human
          </span>
        </h1>
        
        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Clarity AI Voice orchestrates ultra-low latency, human-like voice agents natively integrated into global PSTN carrier routes, Plivo, and Vobiz SIP trunks.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          <Link href="/test-hr">
            <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-8 shadow-lg hover:shadow-blue-500/10">
              <PhoneCall className="w-4 h-4 mr-2" /> Call My Phone Now
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-slate-300 border-slate-800 bg-slate-900/60 hover:text-white px-8">
              Explore Console Dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 2. Featured Agent Use-Case Widget */}
      <section className="relative">
        <div className="absolute inset-0 bg-blue-500/5 rounded-3xl blur-3xl pointer-events-none" />
        <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur max-w-4xl mx-auto overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <CardHeader className="pb-4 border-b border-slate-800/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                  <Bot className="h-5 w-5 text-blue-400" />
                  Priya — Delhi Tech Careers Recruiter
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-1">
                  Active recruitment screening campaign currently routing live outbound calls.
                </CardDescription>
              </div>
              <Link href="/test-hr">
                <Button size="sm" className="bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold">
                  Test Priya Call
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
            <div className="space-y-4">
              <h4 className="text-slate-400 font-bold uppercase tracking-wider">AI Persona Guidelines</h4>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Warm, professional intro representing Delhi Tech Careers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Checks if candidate has experience with React and TypeScript.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Natively handles user interruption & silence turn transitions.</span>
                </li>
              </ul>
            </div>
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/80 space-y-3">
              <h4 className="text-slate-400 font-bold uppercase tracking-wider">Telephony Integrations</h4>
              <div className="space-y-2 leading-relaxed">
                <div>
                  <span className="text-slate-500 block">Outbound Carrier</span>
                  <span className="text-white font-medium">Vobiz Telephony (API Trunk)</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Codec Configuration</span>
                  <span className="text-white font-medium">audio/x-mulaw;rate=8000 (Bidirectional)</span>
                </div>
                <div>
                  <span className="text-slate-500 block">LLM Processing Rate</span>
                  <span className="text-white font-medium">Upsampled to 16kHz PCM16 Mono</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Core Features Section */}
      <section className="space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
            Designed for Carrier-Grade Voice Operations
          </h2>
          <p className="text-slate-400 text-xs md:text-sm">
            How we solve the turn-taking deadlock, voice jitter, and barge-in latency problems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="border-slate-900 bg-slate-900/20 backdrop-blur hover:border-slate-800 transition-colors">
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${f.color}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white tracking-tight">{f.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Telemetry Console Preview Card */}
      <section className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="space-y-3 max-w-lg">
          <h3 className="text-xl md:text-2xl font-bold text-white">
            Comprehensive Console Telemetry
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Monitor outbound SIP callbacks, ASR processing latency, LLM time-to-first-token (TTFT), and text-to-speech synthesized audio chunks live in our operations console.
          </p>
          <div className="flex items-center gap-6 pt-2">
            <div>
              <span className="text-white font-bold text-lg">142ms</span>
              <span className="text-[10px] text-slate-500 block uppercase">ASR Latency</span>
            </div>
            <div className="border-l border-slate-800 pl-6">
              <span className="text-white font-bold text-lg">182ms</span>
              <span className="text-[10px] text-slate-500 block uppercase">LLM TTFT</span>
            </div>
            <div className="border-l border-slate-800 pl-6">
              <span className="text-white font-bold text-lg">98ms</span>
              <span className="text-[10px] text-slate-500 block uppercase">TTS Synthesizer</span>
            </div>
          </div>
        </div>
        <Link href="/dashboard">
          <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 px-6 shrink-0 shadow-lg shadow-blue-500/10">
            Open Operations Dashboard
          </Button>
        </Link>
      </section>
    </div>
  );
}

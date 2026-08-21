'use client';

import React from 'react';
import { ArrowRight, ShieldCheck, Zap, PhoneCall, Globe, Lock, Play } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="bg-[#FAF8F5] text-[#0F172A] min-h-screen flex flex-col justify-between font-sans">
      
      {/* Header Bar */}
      <header className="px-6 py-5 border-b border-[#EADEC9] bg-white/80 backdrop-blur-md flex items-center justify-between max-w-7xl mx-auto w-full sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Claritiy Voice" className="h-8 w-auto object-contain" />
          <span className="text-xl font-black tracking-tight text-[#0F172A]">
            Claritiy <span className="text-[#059669]">Voice</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-[#059669] transition-colors"
          >
            Sign In
          </a>
          <a
            href="/dashboard"
            className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-extrabold rounded-full transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
          >
            Get Started <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-[#059669] text-xs font-mono font-bold tracking-wider uppercase mb-6">
          <Zap className="w-3.5 h-3.5" /> Enterprise Sub-180ms Voice Platform
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-[#0F172A] tracking-tight leading-tight mb-6">
          Human-Like AI Voice Agents for Outbound Sales, Support & RTO
        </h1>

        <p className="text-slate-600 text-base md:text-xl max-w-3xl mx-auto leading-relaxed mb-10 font-medium">
          Claritiy Voice automates customer phone calls with sub-second latency across 70+ languages. Fully authenticated enterprise workspace with zero setup overhead.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="/dashboard"
            className="px-8 py-4 bg-gradient-to-r from-[#059669] to-[#047857] text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 hover:scale-[1.02] transition-all flex items-center gap-2"
          >
            Sign In to Dashboard <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Security Strip */}
        <div className="mt-16 pt-8 border-t border-[#EADEC9] w-full flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-mono font-bold">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[#059669]" /> SOC 2 TYPE II</span>
          <span className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-[#059669]" /> HIPAA COMPLIANT</span>
          <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-[#059669]" /> 70+ LANGUAGES</span>
          <span className="flex items-center gap-1.5"><PhoneCall className="w-4 h-4 text-[#059669]" /> &lt; 180MS LATENCY</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-[#EADEC9] text-center text-xs text-slate-500">
        © 2026 Claritiy Voice. All rights reserved.
      </footer>

    </div>
  );
}

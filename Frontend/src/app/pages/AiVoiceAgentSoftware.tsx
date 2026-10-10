import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Phone, Zap, Shield, Sparkles, CheckCircle2, ArrowRight, Activity, 
  Layers, Volume2, Play, Pause, RefreshCw, Lock, Terminal, Sliders, 
  ChevronRight, Headphones, Radio, Network, Server, FileCode, Check,
  Bot, Clock, TrendingUp, Users, HeartPulse, ShoppingBag, Landmark, 
  Building2, MessageSquare, AlertCircle, HelpCircle, Code2, Globe2
} from "lucide-react";

type Page = any;

interface PageProps {
  setPage: (p: Page) => void;
}

// ── Interactive Voice Audio Simulator ──────────────────────────────────────────
function AudioDemoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 2.5;
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  return (
    <div className="bg-[#0D1117] border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-mono font-bold text-slate-300">LIVE AUDIO SIMULATOR</span>
        </div>
        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
          174ms WebRTC
        </span>
      </div>

      <div className="space-y-3 mb-5">
        <div className="flex items-start gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            AI
          </div>
          <div className="text-xs text-slate-200 leading-relaxed font-sans">
            "Namaste Rohan ji! Claritiy se calling. Aapka FabIndia linen shirt order ₹2,499 cash-on-delivery confirm karna tha. Kya delivery address Sector 62 Noida sahi hai?"
          </div>
        </div>

        <div className="flex items-start gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            You
          </div>
          <div className="text-xs text-slate-300 leading-relaxed font-sans italic">
            "Haan address sahi hai, lekin delivery Thursday ke baad ho payegi kya?"
          </div>
        </div>

        <div className="flex items-start gap-3 bg-slate-900/80 p-3 rounded-xl border border-emerald-900/30">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            AI
          </div>
          <div className="text-xs text-slate-200 leading-relaxed font-sans">
            "Bilkul! Maine delivery dispatch team ko Thursday note kar diya hai. Order dispatch hote hi tracking SMS mil jayega. Shubh din!"
          </div>
        </div>
      </div>

      {/* Progress Bar & Audio Player Controls */}
      <div className="space-y-2">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-100 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-black" />}
            {isPlaying ? "Pause Simulated Call" : "Listen to Sample Call"}
          </button>
          <span className="text-[11px] font-mono text-slate-400">
            Accents: Hindi-English Bilingual (Native Cadence)
          </span>
        </div>
      </div>
    </div>
  );
}

// ── ROI & Cost Savings Interactive Estimator ──────────────────────────────────
function SavingsCalculator() {
  const [monthlyCalls, setMonthlyCalls] = useState(5000);
  const avgDurationMins = 2.5;

  const claritiyCostPerMin = 3.99;
  const claritiyMonthlyCost = Math.round(monthlyCalls * avgDurationMins * claritiyCostPerMin);

  const humanCostPerMin = 18.5; // Average Indian BPO seat cost per productive minute
  const humanMonthlyCost = Math.round(monthlyCalls * avgDurationMins * humanCostPerMin);

  const totalMonthlySavings = humanMonthlyCost - claritiyMonthlyCost;
  const savingsPercent = Math.round((totalMonthlySavings / humanMonthlyCost) * 100);

  return (
    <div className="bg-white border border-[#E8E2D9] rounded-3xl p-6 md:p-8 shadow-sm">
      <div className="space-y-2 mb-6">
        <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
          LIVE COST RECOVERY CALCULATOR
        </span>
        <h3 className="text-2xl font-extrabold text-[#0D1117]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Compare Claritiy Voice vs. Traditional Call Centers
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          See exactly how much your organization saves every month by automating repetitive outbound verification and inbound phone calls.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex justify-between items-center text-sm font-semibold text-slate-800">
          <span>Estimated Monthly Call Volume:</span>
          <span className="text-emerald-700 font-mono text-base font-bold">{monthlyCalls.toLocaleString()} Calls</span>
        </div>
        <input 
          type="range" 
          min="1000" 
          max="50000" 
          step="1000"
          value={monthlyCalls} 
          onChange={(e) => setMonthlyCalls(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
        />
        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
          <span>1,000 calls/mo</span>
          <span>25,000 calls/mo</span>
          <span>50,000+ calls/mo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-[#FFFDF9] border border-[#E8E2D9]">
        <div className="space-y-1">
          <span className="text-xs text-slate-500 font-medium">Traditional Human BPO</span>
          <div className="text-xl md:text-2xl font-mono font-bold text-slate-700 line-through">
            ₹{humanMonthlyCost.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 block font-mono">₹18.50/min effective rate</span>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-emerald-800 font-semibold">Claritiy Voice AI</span>
          <div className="text-xl md:text-2xl font-mono font-extrabold text-emerald-600">
            ₹{claritiyMonthlyCost.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-700 block font-mono">₹3.99/min flat rate</span>
        </div>

        <div className="space-y-1 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl">
          <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider font-mono">Estimated Savings</span>
          <div className="text-xl md:text-2xl font-mono font-extrabold text-emerald-700">
            ₹{totalMonthlySavings.toLocaleString()}/mo
          </div>
          <span className="text-[11px] font-bold text-emerald-800 font-mono">
            {savingsPercent}% Lower Operating Cost
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AiVoiceAgentSoftware({ setPage }: PageProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-slate-800 font-plus-jakarta selection:bg-emerald-500/20 selection:text-emerald-900">
      
      {/* ── HERO SECTION ───────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 px-6 overflow-hidden border-b border-[#E8E2D9]/70">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              PRODUCTION-GRADE AI VOICE AGENT SOFTWARE
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0D1117] tracking-tight leading-[1.12]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Enterprise <span className="text-emerald-600">AI Voice Agent Software</span> Built for Real Conversations.
            </h1>

            <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl">
              Replace outdated IVR phone trees and high-turnover calling centers with autonomous conversational voice agents. Claritiy Voice delivers sub-180ms latency, native regional languages, and bidirectional CRM synchronization—at a predictable flat rate of ₹3.99 per minute.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button
                onClick={() => setPage("dashboard")}
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 group"
              >
                <span>Launch Free Sandbox</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setPage("contact")}
                className="px-8 py-4 bg-white hover:bg-slate-50 text-[#0D1117] font-semibold text-base rounded-2xl border border-[#E8E2D9] shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                Book Live Architecture Demo
              </button>
            </div>

            {/* Badges / Guarantees */}
            <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-mono text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero Audio Retained (DPDP Aligned)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Sub-180ms Turn-Taking Latency</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>70+ Languages & Regional Accents</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <AudioDemoPlayer />
          </div>

        </div>
      </section>

      {/* ── QUICK ANSWER / DEFINITION CALLOUT (AI OVERVIEW OPTIMIZED) ───────── */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <div className="p-8 rounded-3xl bg-[#F7F5F2] border border-[#E8E2D9] space-y-4">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-[#0D1117]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              What is AI Voice Agent Software?
            </h2>
          </div>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            <strong>AI Voice Agent Software</strong> is an autonomous conversational telephony solution that conducts realistic, two-way verbal phone calls with customers using speech-to-text (ASR), large language model reasoning (LLM), and speech synthesis (TTS). Unlike rigid, pre-recorded IVR systems that rely on keypad button clicks ("Press 1 for Sales"), modern AI voice software understands natural speech, listens empathetically, handles interruptions (barge-in), and executes back-office software functions like checking order statuses or updating calendar schedules in real time.
          </p>
        </div>
      </section>

      {/* ── WHY CLARITIY VOICE: 4 CORE ARCHITECTURAL PILLARS ─────────────────── */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-3 mb-16">
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
            TECHNICAL SUPERIORITY
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0D1117] tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Why Modern Teams Choose Claritiy Voice Agent Software
          </h2>
          <p className="text-slate-600 text-base max-w-2xl mx-auto">
            Traditional voice bots fail because chaining separate APIs across the open web creates awkward 1,200ms pauses. Claritiy Voice integrates every telephony layer natively.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-7 rounded-2xl border border-[#E8E2D9] shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#0D1117]">Sub-180ms Latency Engine</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We bypass HTTP REST proxies by connecting SIP telephony trunks directly to WebRTC media relays. Turn-taking is instantaneous, eliminating the awkward pauses common in other voice software.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-[#E8E2D9] shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Globe2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#0D1117]">Native Regional Dialects</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Trained on real conversational nuances across English, Hindi, and regional vernacular accents. The voice agents effortlessly switch between Hinglish, regional cadence, and formal business tones.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-[#E8E2D9] shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Network className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#0D1117]">Dynamic CRM Function Calling</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              The agent doesn't just talk—it executes. Connect Shopify, HubSpot, Zoho, or your custom REST endpoints to verify orders, cancel items, reschedule appointments, and write call logs mid-call.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-[#E8E2D9] shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#0D1117]">DPDP & Edge PII Redaction</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Engineered for strict telecom governance. Personal health information (PHI), bank account details, and phone numbers are scrubbed from audio transcripts before persistence to disk.
            </p>
          </div>
        </div>
      </section>

      {/* ── HIGH VALUE USE CASES SECTION ───────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#F7F5F2] border-y border-[#E8E2D9]/70">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
              ENTERPRISE DEPLOYMENTS
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0D1117] tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              How Enterprises Deploy Claritiy AI Voice Agent Software
            </h2>
            <p className="text-slate-600 text-base max-w-2xl mx-auto">
              From cash-on-delivery order verification to hospital intake scheduling, our specialized voice agent blueprints are ready to deploy in under 10 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Use Case 1 */}
            <div className="bg-white p-8 rounded-3xl border border-[#E8E2D9] space-y-5 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#0D1117]">E-Commerce COD Order Confirmation</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Automatically phone customers immediately after cash-on-delivery checkout. Verifies delivery addresses, catches incorrect contact numbers, and slashes Return-to-Origin (RTO) courier costs by up to 40%.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Calls placed within 60 seconds of checkout</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Direct Shopify & WooCommerce tag updates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Converts COD to UPI pre-paid with SMS link</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setPage("solutions")}
                className="w-full py-3 bg-slate-50 hover:bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-[#E8E2D9] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View E-Commerce Blueprint</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Use Case 2 */}
            <div className="bg-white p-8 rounded-3xl border border-[#E8E2D9] space-y-5 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#0D1117]">Clinic & Dental Appointment Intake</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Never miss an incoming patient call after hours. The agent books appointments, checks physician availability, answers pricing queries, and sends reminder calls that reduce no-show rates by 89%.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>24/7 zero-wait inbound patient reception</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Direct Google Calendar & EHR synchronization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Triage emergencies to on-call doctors instantly</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setPage("solutions")}
                className="w-full py-3 bg-slate-50 hover:bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-[#E8E2D9] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View Healthcare Blueprint</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Use Case 3 */}
            <div className="bg-white p-8 rounded-3xl border border-[#E8E2D9] space-y-5 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Landmark className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#0D1117]">BFSI & EMI Pre-Due Debt Recovery</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Deliver gentle, polite, and RBI-compliant automated payment reminders before due dates. Recovers overdue loan installments and insurance premiums without annoying customers or risking legal violations.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>100% compliant with RBI Fair Practices Code</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Logs Promise-to-Pay (PTP) dates directly to CRM</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Automated payment link delivery via WhatsApp</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setPage("solutions")}
                className="w-full py-3 bg-slate-50 hover:bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-[#E8E2D9] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View BFSI Blueprint</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALCULATOR & PRICING TRANSPARENCY ───────────────────────────────── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <SavingsCalculator />
      </section>

      {/* ── DEVELOPER API QUICKSTART SECTION ─────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#0D1117] text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-xs uppercase font-bold">
              <Terminal className="w-3.5 h-3.5" />
              DEVELOPER-FIRST TELEPHONY API
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Dispatch Outbound Calls with 3 Lines of Code
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Developers can trigger phone calls, pass dynamic personalization variables, and receive real-time webhooks with transcripts and sentiment scores upon call completion.
            </p>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Deterministic REST API & WebSocket audio streams</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>HMAC-SHA256 signature verification on all webhooks</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Zero infrastructure maintenance or SIP trunk setup</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl font-mono text-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400">
                <span>cURL Dispatch Example</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">v2/calls/outbound</span>
              </div>
              <pre className="text-emerald-400 leading-relaxed overflow-x-auto">
{`curl -X POST https://api.claritiy.com/api/v2/calls/outbound \\
  -H "Authorization: Bearer cv_live_token_9918" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "ag_cod_confirmation",
    "phoneNumber": "+919876543210",
    "variables": {
      "customer_name": "Rohan Sharma",
      "order_number": "#88912",
      "amount": "₹2,499",
      "delivery_city": "Noida"
    }
  }'`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION (SCHEMA OPTIMIZED) ─────────────────────────────────── */}
      <section className="py-20 px-6 max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-3xl font-extrabold text-[#0D1117]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Common Questions About AI Voice Agent Software
          </h2>
        </div>

        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-[#E8E2D9] space-y-2">
            <h3 className="font-bold text-[#0D1117] text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              How natural and human-like does Claritiy Voice agent software sound?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Claritiy Voice utilizes low-latency neural speech synthesis paired with regional acoustic models. Unlike synthetic robot voices, our agents breathe, pause naturally, match regional intonation, and immediately pause when interrupted (barge-in latency under 20ms). Over 92% of recipients assume they are conversing with an articulate human representative.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E8E2D9] space-y-2">
            <h3 className="font-bold text-[#0D1117] text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              How much does AI voice agent software cost compared to human agents?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Claritiy Voice charges a transparent flat fee of ₹3.99 per minute with no hidden setup or provider fees. By contrast, a traditional call center agent in India costs between ₹18.00 and ₹25.00 per productive minute once you account for base salary, training attrition, workstation licensing, and management overhead.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E8E2D9] space-y-2">
            <h3 className="font-bold text-[#0D1117] text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              Can Claritiy Voice integrate with our existing CRM and phone numbers?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Yes. Claritiy Voice connects bi-directionally with HubSpot, Salesforce, Zoho, Shopify, and custom REST API backends. You can either purchase dedicated virtual 10-digit phone numbers and toll-free lines directly inside our dashboard or route your existing SIP trunks to our platform.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E8E2D9] space-y-2">
            <h3 className="font-bold text-[#0D1117] text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              Is AI voice calling software compliant with Indian telecom and DPDP rules?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Yes. Claritiy Voice is fully aligned with India's Digital Personal Data Protection (DPDP) Act and TRAI guidelines. All call recordings can be set to zero-persistence, personal health identifiers and payment data are masked at the edge, and the software honors National Do Not Call (NDNC) registers.
            </p>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CONVERSION CTA ──────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#0D1117] text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-6 relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Ready to Automate Your Voice Operations?
          </h2>
          <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Test real-time conversational phone calls in our free interactive sandbox. No credit card required. Experience sub-180ms voice AI in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setPage("dashboard")}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-base rounded-2xl shadow-xl hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              <span>Start Free in Sandbox</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setPage("pricing")}
              className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base rounded-2xl border border-slate-700 transition-colors"
            >
              View Transparent ₹3.99/min Pricing
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}

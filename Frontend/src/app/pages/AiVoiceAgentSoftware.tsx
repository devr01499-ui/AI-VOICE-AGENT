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
    <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-5 relative overflow-hidden font-sans text-[#121212]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#121212] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#121212]" />
          </span>
          <span className="text-xs font-mono font-medium text-[#121212]">LIVE AUDIO SIMULATOR</span>
        </div>
        <span className="text-[11px] font-mono font-medium text-[#121212] bg-[#DFDCD4] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE]">
          174ms WebRTC
        </span>
      </div>

      <div className="space-y-3 mb-5">
        <div className="flex items-start gap-3 bg-[#DFDCD4] p-3 rounded-[2px] border border-[#CBC8BE]">
          <div className="w-7 h-7 rounded-[1px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] flex items-center justify-center font-bold text-xs flex-shrink-0 font-mono">
            AI
          </div>
          <div className="text-xs text-[#121212] leading-relaxed font-sans">
            "Namaste Rohan ji! Claritiy se calling. Aapka FabIndia linen shirt order ₹2,499 cash-on-delivery confirm karna tha. Kya delivery address Sector 62 Noida sahi hai?"
          </div>
        </div>

        <div className="flex items-start gap-3 bg-[#DFDCD4] p-3 rounded-[2px] border border-[#CBC8BE]">
          <div className="w-7 h-7 rounded-[1px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] flex items-center justify-center font-bold text-xs flex-shrink-0 font-mono">
            You
          </div>
          <div className="text-xs text-[#262523] leading-relaxed font-sans italic">
            "Haan address sahi hai, lekin delivery Thursday ke baad ho payegi kya?"
          </div>
        </div>

        <div className="flex items-start gap-3 bg-[#DFDCD4] p-3 rounded-[2px] border border-[#CBC8BE]">
          <div className="w-7 h-7 rounded-[1px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] flex items-center justify-center font-bold text-xs flex-shrink-0 font-mono">
            AI
          </div>
          <div className="text-xs text-[#121212] leading-relaxed font-sans">
            "Bilkul! Maine delivery dispatch team ko Thursday note kar diya hai. Order dispatch hote hi tracking SMS mil jayega. Shubh din!"
          </div>
        </div>
      </div>

      {/* Progress Bar & Audio Player Controls */}
      <div className="space-y-2">
        <div className="h-1.5 w-full bg-[#DFDCD4] border border-[#CBC8BE] rounded-[1px] overflow-hidden">
          <div 
            className="h-full bg-[#121212] transition-all duration-100 ease-linear rounded-[1px]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider cursor-pointer font-medium"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {isPlaying ? "Pause Simulated Call" : "Listen to Sample Call"}
          </button>
          <span className="text-[11px] font-mono text-[#262523]">
            Hindi-English Bilingual
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

  const humanCostPerMin = 18.5;
  const humanMonthlyCost = Math.round(monthlyCalls * avgDurationMins * humanCostPerMin);

  const totalMonthlySavings = humanMonthlyCost - claritiyMonthlyCost;
  const savingsPercent = Math.round((totalMonthlySavings / humanMonthlyCost) * 100);

  return (
    <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 md:p-8 font-sans text-[#121212]">
      <div className="space-y-2 mb-6">
        <span className="text-xs font-mono text-[#121212] uppercase tracking-wider">
          | LIVE COST RECOVERY CALCULATOR
        </span>
        <h3 className="text-2xl font-medium text-[#121212] font-sans tracking-tight">
          Compare Claritiy Voice vs. Traditional Call Centers
        </h3>
        <p className="text-xs sm:text-sm text-[#262523] leading-relaxed">
          See direct cost reductions by shifting repetitive inbound support and outbound confirmation calls to autonomous conversational voice agents.
        </p>
      </div>

      {/* Slider Controls */}
      <div className="space-y-3 mb-8 bg-[#DFDCD4] p-5 rounded-[2px] border border-[#CBC8BE]">
        <div className="flex justify-between items-center text-xs">
          <span className="font-mono uppercase text-[#262523]">Estimated Monthly Call Volume</span>
          <span className="text-[#121212] font-mono text-base font-bold">{monthlyCalls.toLocaleString()} Calls</span>
        </div>
        <input 
          type="range" 
          min="1000" 
          max="50000" 
          step="1000"
          value={monthlyCalls}
          onChange={(e) => setMonthlyCalls(Number(e.target.value))}
          className="w-full accent-[#121212] cursor-pointer"
        />
        <div className="flex justify-between text-[11px] font-mono text-[#262523]">
          <span>1,000 Calls</span>
          <span>25,000 Calls</span>
          <span>50,000 Calls</span>
        </div>
      </div>

      {/* Comparison Outcome Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE]">
        <div className="space-y-1">
          <span className="text-xs text-[#262523] font-mono uppercase">Traditional Human BPO</span>
          <div className="text-xl md:text-2xl font-mono font-bold text-[#121212]">
            ₹{humanMonthlyCost.toLocaleString()}
          </div>
          <span className="text-[11px] text-[#262523] block font-mono">₹18.50/min blended seat cost</span>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-[#121212] font-mono font-semibold uppercase">Claritiy Voice AI</span>
          <div className="text-xl md:text-2xl font-mono font-bold text-[#121212]">
            ₹{claritiyMonthlyCost.toLocaleString()}
          </div>
          <span className="text-[11px] text-[#121212] block font-mono">₹3.99/min flat rate</span>
        </div>

        <div className="space-y-1 bg-[#EBE9E2] border border-[#CBC8BE] p-3 rounded-[2px]">
          <span className="text-xs font-bold text-[#121212] uppercase tracking-wider font-mono">Estimated Savings</span>
          <div className="text-xl md:text-2xl font-mono font-bold text-[#121212]">
            ₹{totalMonthlySavings.toLocaleString()}/mo
          </div>
          <span className="text-[11px] font-bold text-[#121212] font-mono">
            {savingsPercent}% Direct Overhead Saved
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
    <div className="min-h-screen bg-[#E5E3DC] text-[#121212] font-sans">
      
      {/* ── HERO SECTION ───────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 px-6 border-b border-[#CBC8BE]">
        <div className="hatched-strip h-10 w-full mb-8 max-w-7xl mx-auto" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] font-mono text-xs uppercase tracking-wider">
              <span>|</span>
              <span>Production-Grade AI Voice Agent Software</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal md:font-medium text-[#121212] tracking-tight leading-[1.08] font-sans">
              Enterprise AI Voice Agent Software Built for Real Conversations.
            </h1>

            <p className="text-base sm:text-lg text-[#262523] leading-relaxed max-w-2xl font-sans">
              Replace outdated IVR phone trees and high-turnover calling centers with autonomous conversational voice agents. Claritiy Voice delivers sub-180ms latency, native regional languages, and bidirectional CRM synchronization—at a predictable flat rate of ₹3.99 per minute.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => setPage("dashboard")}
                className="px-6 py-3.5 bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center gap-2 font-medium cursor-pointer"
              >
                <span>Launch Free Sandbox</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setPage("contact")}
                className="px-6 py-3.5 bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] font-mono text-xs uppercase tracking-wider rounded-[2px] border border-[#CBC8BE] transition-colors flex items-center justify-center gap-2 font-medium cursor-pointer"
              >
                Book Live Architecture Demo
              </button>
            </div>

            {/* Badges / Guarantees */}
            <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-mono text-[#262523]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212]" />
                <span>Zero Audio Retained (DPDP Aligned)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212]" />
                <span>Sub-180ms Turn-Taking Latency</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212]" />
                <span>70+ Languages & Regional Accents</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <AudioDemoPlayer />
          </div>

        </div>
      </section>

      {/* ── QUICK ANSWER / DEFINITION CALLOUT ───────────────────────── */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <div className="p-8 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] space-y-3">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-[#121212]" />
            <h2 className="text-xl font-medium text-[#121212] font-sans">
              What is AI Voice Agent Software?
            </h2>
          </div>
          <p className="text-[#262523] text-sm md:text-base leading-relaxed font-sans">
            <strong>AI Voice Agent Software</strong> is an autonomous conversational telephony solution that conducts realistic, two-way verbal phone calls with customers using speech-to-text (ASR), large language model reasoning (LLM), and speech synthesis (TTS). Unlike rigid, pre-recorded IVR systems that rely on keypad button clicks ("Press 1 for Sales"), modern AI voice software understands natural speech, listens empathetically, handles interruptions (barge-in), and executes back-office software functions like checking order statuses or updating calendar schedules in real time.
          </p>
        </div>
      </section>

      {/* ── 4 CORE ARCHITECTURAL PILLARS ─────────────────── */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-3 mb-14">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-wider">
            | TECHNICAL SUPERIORITY
          </span>
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] tracking-tight font-sans">
            Why Modern Teams Choose Claritiy Voice Agent Software
          </h2>
          <p className="text-[#262523] text-sm sm:text-base max-w-2xl mx-auto font-sans">
            Traditional voice bots fail because chaining separate APIs across the open web creates awkward 1,200ms pauses. Claritiy Voice integrates every telephony layer natively.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#EBE9E2] p-6 rounded-[2px] border border-[#CBC8BE] hover:border-[#9C998F] transition-colors space-y-3">
            <div className="w-9 h-9 rounded-[2px] bg-[#DFDCD4] text-[#121212] border border-[#CBC8BE] flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-base font-medium text-[#121212] font-sans">Sub-180ms Latency Engine</h3>
            <p className="text-xs text-[#262523] leading-relaxed font-sans">
              We bypass HTTP REST proxies by connecting SIP telephony trunks directly to WebRTC media relays. Turn-taking is instantaneous, eliminating awkward pauses.
            </p>
          </div>

          <div className="bg-[#EBE9E2] p-6 rounded-[2px] border border-[#CBC8BE] hover:border-[#9C998F] transition-colors space-y-3">
            <div className="w-9 h-9 rounded-[2px] bg-[#DFDCD4] text-[#121212] border border-[#CBC8BE] flex items-center justify-center font-bold">
              <Globe2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-medium text-[#121212] font-sans">Native Regional Dialects</h3>
            <p className="text-xs text-[#262523] leading-relaxed font-sans">
              Trained on real conversational nuances across English, Hindi, and regional vernacular accents. The voice agents effortlessly handle colloquial switching.
            </p>
          </div>

          <div className="bg-[#EBE9E2] p-6 rounded-[2px] border border-[#CBC8BE] hover:border-[#9C998F] transition-colors space-y-3">
            <div className="w-9 h-9 rounded-[2px] bg-[#DFDCD4] text-[#121212] border border-[#CBC8BE] flex items-center justify-center font-bold">
              <Network className="w-4 h-4" />
            </div>
            <h3 className="text-base font-medium text-[#121212] font-sans">Dynamic CRM Function Calling</h3>
            <p className="text-xs text-[#262523] leading-relaxed font-sans">
              The agent doesn't just talk—it executes. Connect Shopify, HubSpot, Zoho, or custom endpoints to verify orders, cancel items, and log call records.
            </p>
          </div>

          <div className="bg-[#EBE9E2] p-6 rounded-[2px] border border-[#CBC8BE] hover:border-[#9C998F] transition-colors space-y-3">
            <div className="w-9 h-9 rounded-[2px] bg-[#DFDCD4] text-[#121212] border border-[#CBC8BE] flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-base font-medium text-[#121212] font-sans">DPDP & Edge PII Redaction</h3>
            <p className="text-xs text-[#262523] leading-relaxed font-sans">
              Engineered for strict telecom governance. Personal identifiers and bank details are scrubbed from audio transcripts before persistence.
            </p>
          </div>
        </div>
      </section>

      {/* ── HIGH VALUE USE CASES SECTION ───────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#EBE9E2] border-y border-[#CBC8BE]">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono text-[#121212] uppercase tracking-wider">
              | ENTERPRISE DEPLOYMENTS
            </span>
            <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] tracking-tight font-sans">
              How Enterprises Deploy Claritiy AI Voice Agent Software
            </h2>
            <p className="text-[#262523] text-sm sm:text-base max-w-2xl mx-auto font-sans">
              From cash-on-delivery order verification to hospital intake scheduling, our specialized voice agent blueprints are ready to deploy in under 10 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Use Case 1 */}
            <div className="bg-[#DFDCD4] p-6 rounded-[2px] border border-[#CBC8BE] space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-medium text-[#121212] font-sans">E-Commerce COD Order Confirmation</h3>
                <p className="text-xs sm:text-sm text-[#262523] leading-relaxed font-sans">
                  Automatically phone customers immediately after cash-on-delivery checkout. Verifies delivery addresses, catches incorrect contact numbers, and slashes Return-to-Origin (RTO) courier costs by up to 40%.
                </p>
                <ul className="space-y-2 text-xs text-[#121212] font-sans">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>Calls placed within 60 seconds of checkout</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>Direct Shopify & WooCommerce tag updates</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>Converts COD to UPI pre-paid with SMS link</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setPage("solutions")}
                className="w-full py-2.5 bg-[#EBE9E2] hover:bg-[#D5D1C7] text-[#121212] font-mono text-xs uppercase tracking-wider rounded-[2px] border border-[#CBC8BE] transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <span>View E-Commerce Blueprint</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Use Case 2 */}
            <div className="bg-[#DFDCD4] p-6 rounded-[2px] border border-[#CBC8BE] space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] flex items-center justify-center">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-medium text-[#121212] font-sans">Clinic & Dental Appointment Intake</h3>
                <p className="text-xs sm:text-sm text-[#262523] leading-relaxed font-sans">
                  Never miss an incoming patient call after hours. The agent books appointments, checks physician availability, answers pricing queries, and sends reminder calls that reduce no-show rates by 89%.
                </p>
                <ul className="space-y-2 text-xs text-[#121212] font-sans">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>24/7 zero-wait inbound patient reception</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>Direct Google Calendar & EHR synchronization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>Triage emergencies to on-call doctors instantly</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setPage("solutions")}
                className="w-full py-2.5 bg-[#EBE9E2] hover:bg-[#D5D1C7] text-[#121212] font-mono text-xs uppercase tracking-wider rounded-[2px] border border-[#CBC8BE] transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-medium"
              >
                <span>View Healthcare Blueprint</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Use Case 3 */}
            <div className="bg-[#DFDCD4] p-6 rounded-[2px] border border-[#CBC8BE] space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-medium text-[#121212] font-sans">BFSI & EMI Pre-Due Debt Recovery</h3>
                <p className="text-xs sm:text-sm text-[#262523] leading-relaxed font-sans">
                  Deliver gentle, polite, and RBI-compliant automated payment reminders before due dates. Recovers overdue loan installments and insurance premiums without annoying customers or risking legal violations.
                </p>
                <ul className="space-y-2 text-xs text-[#121212] font-sans">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>100% compliant with RBI Fair Practices Code</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>Logs Promise-to-Pay (PTP) dates directly to CRM</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#121212]" />
                    <span>Automated payment link delivery via WhatsApp</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setPage("solutions")}
                className="w-full py-2.5 bg-[#EBE9E2] hover:bg-[#D5D1C7] text-[#121212] font-mono text-xs uppercase tracking-wider rounded-[2px] border border-[#CBC8BE] transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-medium"
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
      <section className="py-20 px-6 bg-[#EBE9E2] text-[#121212] border-t border-[#CBC8BE]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] font-mono text-xs uppercase font-medium">
              <Terminal className="w-3.5 h-3.5" />
              DEVELOPER-FIRST TELEPHONY API
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight font-sans text-[#121212]">
              Dispatch Outbound Calls with 3 Lines of Code
            </h2>
            <p className="text-[#262523] text-sm md:text-base leading-relaxed font-sans">
              Developers can trigger phone calls, pass dynamic personalization variables, and receive real-time webhooks with transcripts and sentiment scores upon call completion.
            </p>
            <div className="space-y-2 pt-1 font-mono text-xs text-[#121212]">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212]" />
                <span>Deterministic REST API & WebSocket audio streams</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212]" />
                <span>HMAC-SHA256 signature verification on all webhooks</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212]" />
                <span>Zero infrastructure maintenance or SIP trunk setup</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-5 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#CBC8BE] text-[#262523]">
                <span>cURL Dispatch Example</span>
                <span className="text-[10px] text-[#121212] bg-[#EBE9E2] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE]">v2/calls/outbound</span>
              </div>
              <pre className="text-[#121212] leading-relaxed overflow-x-auto">
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
          <span className="text-xs font-mono text-[#121212] uppercase tracking-wider">
            | FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-3xl font-medium text-[#121212] font-sans tracking-tight">
            Common Questions About AI Voice Agent Software
          </h2>
        </div>

        <div className="space-y-4">
          <div className="p-6 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] space-y-2">
            <h3 className="font-medium text-[#121212] text-base flex items-center gap-2 font-sans">
              <HelpCircle className="w-4 h-4 text-[#121212] flex-shrink-0" />
              How natural and human-like does Claritiy Voice agent software sound?
            </h3>
            <p className="text-sm text-[#262523] leading-relaxed font-sans">
              Claritiy Voice utilizes low-latency neural speech synthesis paired with regional acoustic models. Unlike synthetic robot voices, our agents breathe, pause naturally, match regional intonation, and immediately pause when interrupted (barge-in latency under 20ms). Over 92% of recipients assume they are conversing with an articulate human representative.
            </p>
          </div>

          <div className="p-6 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] space-y-2">
            <h3 className="font-medium text-[#121212] text-base flex items-center gap-2 font-sans">
              <HelpCircle className="w-4 h-4 text-[#121212] flex-shrink-0" />
              How much does AI voice agent software cost compared to human agents?
            </h3>
            <p className="text-sm text-[#262523] leading-relaxed font-sans">
              Claritiy Voice charges a transparent flat fee of ₹3.99 per minute with no hidden setup or provider fees. By contrast, a traditional call center agent in India costs between ₹18.00 and ₹25.00 per productive minute once you account for base salary, training attrition, workstation licensing, and management overhead.
            </p>
          </div>

          <div className="p-6 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] space-y-2">
            <h3 className="font-medium text-[#121212] text-base flex items-center gap-2 font-sans">
              <HelpCircle className="w-4 h-4 text-[#121212] flex-shrink-0" />
              Can Claritiy Voice integrate with our existing CRM and phone numbers?
            </h3>
            <p className="text-sm text-[#262523] leading-relaxed font-sans">
              Yes. Claritiy Voice connects bi-directionally with HubSpot, Salesforce, Zoho, Shopify, and custom REST API backends. You can either purchase dedicated virtual 10-digit phone numbers and toll-free lines directly inside our dashboard or route your existing SIP trunks to our platform.
            </p>
          </div>

          <div className="p-6 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] space-y-2">
            <h3 className="font-medium text-[#121212] text-base flex items-center gap-2 font-sans">
              <HelpCircle className="w-4 h-4 text-[#121212] flex-shrink-0" />
              Is AI voice calling software compliant with Indian telecom and DPDP rules?
            </h3>
            <p className="text-sm text-[#262523] leading-relaxed font-sans">
              Yes. Claritiy Voice is fully aligned with India's Digital Personal Data Protection (DPDP) Act and TRAI guidelines. All call recordings can be set to zero-persistence, personal health identifiers and payment data are masked at the edge, and the software honors National Do Not Call (NDNC) registers.
            </p>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CONVERSION CTA ──────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto p-10 md:p-14 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] tracking-tight font-sans">
            Ready to Automate Your Voice Operations?
          </h2>
          <p className="text-[#262523] text-sm md:text-base max-w-2xl mx-auto leading-relaxed font-sans">
            Test real-time conversational phone calls in our free interactive sandbox. No credit card required. Experience sub-180ms voice AI in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage("dashboard")}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center gap-2 font-medium cursor-pointer"
            >
              <span>Start Free in Sandbox</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setPage("pricing")}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] font-mono text-xs uppercase tracking-wider rounded-[2px] border border-[#CBC8BE] transition-colors font-medium cursor-pointer"
            >
              View Transparent ₹3.99/min Pricing
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}

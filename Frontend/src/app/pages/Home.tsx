import { motion, useScroll, useTransform } from "motion/react";
import React, { useRef } from "react";
import Hero from "../components/hero/Hero";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import FeatureCapabilityGrid from "../components/showroom/FeatureCapabilityGrid";
import {
  ArrowRight, ShieldCheck, Zap, Bot, CheckCircle2, Lock, Cpu, Globe2,
  PhoneCall, TrendingUp, Star, Clock, Users, Headphones, Phone,
  BarChart3, Network, Mic2, Database, Radio, MessageSquare,
  FileText, RefreshCw, Webhook, Languages, Activity
} from "lucide-react";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import LottieVoiceOrb from "../components/animation/LottieVoiceOrb";

type Page = any;
interface HomeProps { setPage: (p: Page) => void; }

// ── Reusable section label (EdgeSkool Minimalist Style) ───────────────────────
function SectionLabel({ text }: { text: string; color?: "green" | "orange" }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#5E5D57]">
      <span className="text-[#121212] font-semibold">|</span>
      <span className="uppercase tracking-wider">{text}</span>
    </div>
  );
}

// ── EdgeSkool wireframe card wrapper ──────────────────────────────────────────
function TiltCard({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      className={`bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] transition-colors hover:border-[#9C998F] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// ── Animated counter ─────────────────────────────────────────────────────────
function StatNumber({ value, suffix = "" }: { value: string; suffix?: string }) {
  return (
    <span className="text-4xl lg:text-5xl font-extrabold text-white leading-none">
      {value}<span className="text-[#34D399]">{suffix}</span>
    </span>
  );
}

// ── Scroll progress line ─────────────────────────────────────────────────────
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-[999] origin-left bg-[#121212]"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

// ── Testimonials Section (Faithful to EdgeSkool Reference Image) ──────────────
function TestimonialsSection() {
  const testimonials = [
    {
      title: "Already winning",
      body: "Scaled outbound confirmation calls to 4,000 orders/day with zero staff overhead. Our RTO dropped from 28% to 14% in the very first week.",
      author: "- Sky (Rajesh K.)"
    },
    {
      title: "Sub-180ms makes all the difference",
      body: "Callers actually think they're speaking with a real receptionist. Interruption handling works flawlessly mid-sentence without lag or awkward pauses.",
      author: "- Jacob (Ananya M.)"
    },
    {
      title: "2 Trades for the day! 2,400 Leads qualified",
      body: "Dialed form submissions within 3 seconds of registration. Qualified budgets, collected GSTIN details, and scheduled 180 demo meetings automatically.",
      author: "- Muzher (Siddharth T.)"
    },
    {
      title: "First Payout & ROI in 48 Hours",
      body: "Replaced 6 manual calling agents with 1 Claritiy Voice agent. The dashboard gives us instant transcripts, sentiment breakdown, and recording replays.",
      author: "- Vikram B., Logistics"
    },
    {
      title: "Zero hallucination on policy details",
      body: "Attached our 60-page PDF policy guidelines to the knowledge base. It answers complex claims questions with 100% precision.",
      author: "- Neha S., Insurance"
    },
    {
      title: "Commodities are hot. Up 20k since Yesterday",
      body: "When high-value enterprise accounts call in, the agent seamlessly routes them to dedicated account managers with zero queue drop.",
      author: "- Amit P., Real Estate"
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Signature EdgeSkool Diagonal Hatched Decorative Banner */}
      <div className="hatched-strip h-12 w-full mb-10" />

      {/* Header with Monospace Tag */}
      <div className="text-left mb-10 space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono text-[#5E5D57]">
          <span className="text-[#121212] font-semibold">|</span>
          <span className="tracking-wider">Testimonials</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          What enterprise teams inside are seeing from day one.
        </h2>
      </div>

      {/* 3-Column Wireframe Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((t, idx) => (
          <div
            key={idx}
            className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 flex flex-col justify-between hover:border-[#9C998F] transition-colors"
          >
            <div>
              <h3 className="text-sm sm:text-base font-medium text-[#121212] mb-3 leading-snug font-sans">
                {t.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#5E5D57] leading-relaxed mb-6 font-sans">
                {t.body}
              </p>
            </div>
            <div className="pt-3 border-t border-[#CBC8BE]/60 text-xs font-mono text-[#5E5D57]">
              {t.author}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Horizontal Banner Features Section ──────────────────────────────────────────
function BentoCapabilitySection({ setPage }: { setPage: (p: Page) => void }) {
  const items = [
    {
      title: "Sub-180ms Real-Time Voice AI",
      desc: "Native multimodal pipeline — no stacked APIs. ASR + LLM + TTS vertically integrated for human-like phone conversations with zero lag.",
      icon: Zap,
    },
    {
      title: "Interruption & Barge-In Support",
      desc: "Full-duplex audio processing allows callers to interrupt naturally. The AI voice agent instantly adapts — real-time conversation that feels genuinely human.",
      icon: MessageSquare,
    },
    {
      title: "Multilingual Voice Support",
      desc: "Native speech recognition across English, Hindi, Bengali, Kannada, Mandarin, Arabic, and 64+ more. Accent support built in. No translation overhead.",
      icon: Languages,
    },
    {
      title: "RAG Knowledge Base Calling",
      desc: "Attach PDFs, URLs, and CRM data for 100% hallucination-free answers. Real-time retrieval during live calls — your AI receptionist knows everything about your business.",
      icon: Database,
    },
    {
      title: "Warm Transfer & Human Handoff",
      desc: "When escalation is needed, the AI voice agent executes a warm transfer with full call context and transcript — seamless hand-off to your human agent team.",
      icon: PhoneCall,
    },
    {
      title: "CRM & Webhook Automation",
      desc: "Bi-directional sync with Salesforce, HubSpot, Shopify, and custom REST webhooks. Automated call disposition, lead scoring, and pipeline updates in real-time.",
      icon: Webhook,
    },
    {
      title: "Batch Calling & Smart Retry",
      desc: "Launch 10,000+ simultaneous outbound AI calls with intelligent retry schedules for busy lines, voicemails, and unanswered calls. AI call automation at enterprise scale.",
      icon: RefreshCw,
    },
    {
      title: "Call Summarization & Sentiment",
      desc: "Automated post-call disposition, key phrase extraction, sentiment scoring, call recording, and transcription indexing — everything you need for AI call analytics.",
      icon: BarChart3,
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="hatched-strip h-10 w-full mb-10" />
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <SectionLabel text="Platform Capabilities" />
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          Every Feature Your Enterprise AI Voice Platform Needs
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-5 flex flex-col justify-between hover:border-[#9C998F] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-[#5E5D57] uppercase tracking-wider">
                    Feature 0{i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-[2px] bg-[#DFDCD4] flex items-center justify-center text-[#121212]">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-medium text-[#121212] mb-2 leading-snug font-sans">
                  {item.title}
                </h3>
                <p className="text-xs text-[#5E5D57] leading-relaxed font-sans">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Interlocking Clover Infographic Section ─────────────────────────────────────
function UseCaseSection({ setPage }: { setPage: (p: Page) => void }) {
  const useCases = [
    { step: "FIRST USE CASE", num: "01", title: "APPOINTMENTS", desc: "Automate booking, demo scheduling, and calendar integration. Reduce no-shows by 89%.", icon: Clock },
    { step: "SECOND USE CASE", num: "02", title: "QUALIFICATION", desc: "Contact leads within 3s of form submission. Qualify budgets and score intent.", icon: TrendingUp },
    { step: "THIRD USE CASE", num: "03", title: "INBOUND", desc: "Handle inbound calls, answer FAQs, and intelligently route to human agents.", icon: PhoneCall },
    { step: "FOURTH USE CASE", num: "04", title: "COLLECTIONS", desc: "Automate EMI reminders and debt outreach with secure data handling.", icon: Activity },
  ];

  // Colors from the design: Teal, Orange, Beige, Brown
  const colors = ["#5BC4BF", "#F58220", "#F4D09C", "#6D534A"];

  return (
    <section className="py-24 px-4 bg-[#FAF9F6] relative overflow-hidden">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <SectionLabel text="Use Cases" color="orange" />
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#2C3E50] leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          One Platform. Every High-Value<br />Call Automation Use Case.
        </h2>
      </div>

      <div className="max-w-[850px] mx-auto relative w-full aspect-square md:aspect-auto md:h-[850px] mt-10">
        
        {/* SVG Interlocking Ribbons */}
        <svg className="absolute inset-0 w-full h-full drop-shadow-xl" viewBox="-280 -280 560 560">
          <defs>
            <filter id="ribbon-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="6" stdDeviation="8" floodOpacity="0.25" floodColor="#000000" />
            </filter>
            
            <clipPath id="tr-head-clip">
              <rect x="0" y="0" width="280" height="280" />
            </clipPath>

            {/* Curved Text Paths (Radius 130, Center +/-110) */}
            <path id="text-tl" d="M -240 -110 A 130 130 0 0 1 -110 -240" fill="none" />
            <path id="text-tr" d="M 110 -240 A 130 130 0 0 1 240 -110" fill="none" />
            <path id="text-br" d="M 110 240 A 130 130 0 0 0 240 110" fill="none" />
            <path id="text-bl" d="M -240 110 A 130 130 0 0 0 -110 240" fill="none" />
            
            {/* The 4 Ribbon Paths (Thickness 40, Inner 110, Outer 150) */}
            {/* TR (Orange) */}
            <path id="path-tr" d="M -40 -110 A 150 150 0 1 1 110 40 L 90 20 L 110 0 A 110 110 0 1 0 0 -110 Z" />
            {/* TL (Teal) */}
            <path id="path-tl" d="M -110 40 A 150 150 0 1 1 40 -110 L 20 -90 L 0 -110 A 110 110 0 1 0 -110 0 Z" />
            {/* BL (Brown) */}
            <path id="path-bl" d="M 40 110 A 150 150 0 1 1 -110 -40 L -90 -20 L -110 0 A 110 110 0 1 0 0 110 Z" />
            {/* BR (Beige) */}
            <path id="path-br" d="M 110 -40 A 150 150 0 1 1 -40 110 L -20 90 L 0 110 A 110 110 0 1 0 110 0 Z" />
          </defs>

          {/* Draw Ribbons in Pinwheel Order */}
          <use href="#path-tr" fill={colors[1]} filter="url(#ribbon-shadow)" />
          <use href="#path-tl" fill={colors[0]} filter="url(#ribbon-shadow)" />
          <use href="#path-bl" fill={colors[3]} filter="url(#ribbon-shadow)" />
          <use href="#path-br" fill={colors[2]} filter="url(#ribbon-shadow)" />
          
          {/* Re-draw TR Head to complete the pinwheel overlap */}
          <use href="#path-tr" fill={colors[1]} clipPath="url(#tr-head-clip)" filter="url(#ribbon-shadow)" />

          {/* Curved Text */}
          <text fill="#ffffff" fontSize="14" fontWeight="bold" letterSpacing="2" fontFamily="'Plus Jakarta Sans', sans-serif">
            <textPath href="#text-tl" startOffset="50%" textAnchor="middle">
              {useCases[0].step} <tspan fontSize="22">{useCases[0].num}</tspan>
            </textPath>
          </text>
          
          <text fill="#ffffff" fontSize="14" fontWeight="bold" letterSpacing="2" fontFamily="'Plus Jakarta Sans', sans-serif">
            <textPath href="#text-tr" startOffset="50%" textAnchor="middle">
              {useCases[1].step} <tspan fontSize="22">{useCases[1].num}</tspan>
            </textPath>
          </text>

          <text fill="#6D534A" fontSize="14" fontWeight="bold" letterSpacing="2" fontFamily="'Plus Jakarta Sans', sans-serif">
            <textPath href="#text-br" startOffset="50%" textAnchor="middle">
              {useCases[2].step} <tspan fontSize="22">{useCases[2].num}</tspan>
            </textPath>
          </text>

          <text fill="#F4D09C" fontSize="14" fontWeight="bold" letterSpacing="2" fontFamily="'Plus Jakarta Sans', sans-serif">
            <textPath href="#text-bl" startOffset="50%" textAnchor="middle">
              {useCases[3].step} <tspan fontSize="22">{useCases[3].num}</tspan>
            </textPath>
          </text>
        </svg>

        {/* Central Hub Icon */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.1)] flex items-center justify-center border-4 border-slate-50 rotate-45 transform transition-transform hover:scale-110">
            <div className="rotate-[-45deg] flex flex-col items-center">
              <Bot className="w-6 h-6 md:w-10 md:h-10 text-indigo-600 mb-1" strokeWidth={1.5} />
              <span className="text-[8px] md:text-[10px] font-black tracking-widest text-slate-800">CORE</span>
            </div>
          </div>
        </div>

        {/* HTML Content placed perfectly in the center of each ring */}
        {useCases.map((uc, i) => {
          const Icon = uc.icon;
          // Centers: 30.3% and 69.6% based on SVG coordinates
          const posX = i === 0 || i === 3 ? "30.3%" : "69.6%";
          const posY = i === 0 || i === 1 ? "30.3%" : "69.6%";
          
          return (
            <div 
              key={i} 
              className="absolute flex flex-col items-center justify-center text-center w-48 md:w-64 px-2"
              style={{ left: posX, top: posY, transform: "translate(-50%, -50%)" }}
            >
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white flex items-center justify-center shadow-lg mb-4" style={{ color: colors[i] }}>
                <Icon className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2} />
              </div>
              <h3 className="font-black text-slate-900 text-sm md:text-xl mb-2 tracking-wide leading-tight drop-shadow-sm">{uc.title}</h3>
              <div className="w-12 h-1.5 mb-3 rounded-full opacity-80 shadow-sm" style={{ backgroundColor: colors[i] }}></div>
              <p className="text-[11px] md:text-sm text-slate-700 font-semibold leading-relaxed drop-shadow-sm">
                {uc.desc}
              </p>
            </div>
          )
        })}
        
      </div>
    </section>
  );
}

// ── Comparison Table ──────────────────────────────────────────────────────────
function ComparisonSection({ setPage }: { setPage: (p: Page) => void }) {
  const rows = [
    { feature: "Response Latency", claritiy: "< 180ms", vapi: "800ms–1.5s", legacy: "45+ min queue", highlight: true },
    { feature: "Native Audio Pipeline", claritiy: "✅ Vertically Integrated", vapi: "❌ Stacked STT+LLM+TTS", legacy: "❌ Human only" },
    { feature: "Multilingual Support", claritiy: "✅ 70+ Languages", vapi: "✅ Limited", legacy: "⚠️ Per hire" },
    { feature: "Concurrent Calls", claritiy: "✅ Unlimited", vapi: "⚠️ Rate limited", legacy: "❌ Team capacity" },
    { feature: "RAG Knowledge Base", claritiy: "✅ Built-in", vapi: "⚠️ Manual setup", legacy: "❌ Scripts only" },
    { feature: "MSME Registered", claritiy: "✅ Ministry Registered", vapi: "❌ N/A (US Only)", legacy: "⚠️ N/A" },
    { feature: "Pricing Model", claritiy: "✅ Flat ₹3.99/min", vapi: "❌ STT+LLM+TTS billed separately", legacy: "❌ ₹25K+/agent/mo" },
    { feature: "Setup Time", claritiy: "✅ < 10 minutes", vapi: "⚠️ Days of engineering", legacy: "❌ Weeks of hiring" },
  ];

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
        <SectionLabel text="Enterprise Architecture Comparison" color="orange" />
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A]"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          Claritiy Voice vs Chained Multi-Vendor Stacks<br />& Legacy Call Centers
        </h2>
        <p className="text-slate-500 leading-relaxed">
          See why enterprise teams choose Claritiy Voice for low-latency, unified pricing, and instant compliance.
        </p>
      </div>

      <div className="rounded-[2px] overflow-hidden border border-[#CBC8BE] bg-[#EBE9E2]">
        {/* Table header */}
        <div className="grid grid-cols-4 bg-[#121212] text-white text-xs font-mono uppercase tracking-wider">
          <div className="p-4 font-mono">Feature</div>
          <div className="p-4 font-mono text-white border-l border-white/20">
            ✦ Claritiy Voice
          </div>
          <div className="p-4 font-mono text-white/70 border-l border-white/20">Chained APIs</div>
          <div className="p-4 font-mono text-white/70 border-l border-white/20">Human Centers</div>
        </div>
        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-4 border-t border-[#CBC8BE] ${row.highlight ? "bg-[#DFDCD4]" : i % 2 === 0 ? "bg-[#EBE9E2]" : "bg-[#E5E3DC]"} transition-colors hover:bg-[#DFDCD4]`}
          >
            <div className="p-3.5 text-xs font-medium text-[#121212]">{row.feature}</div>
            <div className="p-3.5 text-xs font-semibold text-[#121212] border-l border-[#CBC8BE]">{row.claritiy}</div>
            <div className="p-3.5 text-xs text-[#5E5D57] border-l border-[#CBC8BE]">{row.vapi}</div>
            <div className="p-3.5 text-xs text-[#5E5D57] border-l border-[#CBC8BE]">{row.legacy}</div>
          </div>
        ))}
        {/* CTA row */}
        <div className="grid grid-cols-4 border-t border-[#CBC8BE] bg-[#DFDCD4] p-3.5 items-center">
          <div className="col-span-1 text-xs font-mono font-bold text-[#121212]">Ready to switch?</div>
          <div className="col-span-3 border-l border-[#CBC8BE] pl-4">
            <button
              onClick={() => setPage("dashboard")}
              className="btn-primary text-xs font-mono uppercase tracking-wider px-5 py-2"
            >
              Start Building Now <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}


// ── Full-bleed editorial CTA ──────────────────────────────────────────────────
function FinalCTA({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-[2px] bg-[#121212] border border-[#333333] text-white">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 items-center gap-10 p-10 lg:p-14">
            {/* Left */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 border border-white/20 rounded-[2px] px-3 py-1 font-mono text-xs uppercase tracking-wider text-neutral-300">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                <span>Now Live — Zero Setup</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-white leading-tight font-sans tracking-tight">
                Deploy Your First AI Voice Agent in Under 10 Minutes
              </h2>
              <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
                No engineering team. No call center overhead. Deploy conversational AI voice agents for appointment booking, lead qualification, COD verification, and more — instantly.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setPage("dashboard")}
                  className="bg-white text-black hover:bg-neutral-200 rounded-[2px] font-mono text-xs uppercase tracking-wider px-6 py-3 flex items-center gap-2 transition-colors font-medium"
                >
                  Build Your Agent Now <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage("pricing")}
                  className="border border-[#666666] text-white hover:bg-white/10 rounded-[2px] font-mono text-xs uppercase tracking-wider px-6 py-3 transition-colors"
                >
                  View Pricing Plans
                </button>
              </div>
            </div>

            {/* Right: Feature checklist */}
            <div className="grid grid-cols-2 gap-3">
              {[
                "AI voice calling agents",
                "AI outbound calling",
                "AI inbound calling",
                "Appointment booking",
                "Lead qualification",
                "COD confirmation",
                "Payment reminders",
                "Warm call transfer",
                "Multilingual voice AI",
                "MSME Certified Enterprise",
                "CRM integration",
                "Real-time analytics",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-white/80 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


// ── Main Home Page ──────────────────────────────────────────────────────────
export default function Home({ setPage }: HomeProps) {
  return (
    <div className="overflow-hidden" style={{ background: "#E5E3DC" }}>
      <ScrollProgress />

      {/* ── HERO ── */}
      <Hero setPage={setPage} />

      {/* ── TESTIMONIALS (EdgeSkool Reference) ── */}
      <TestimonialsSection />

      {/* ── INTERACTIVE LIVE VOICE AI LOTTIE SIMULATOR ── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <SectionLabel text="Interactive Voice Simulator" color="green" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
            Experience Sub-180ms Neural Voice AI in Real Time
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Watch our 60 FPS neural audio engine react on loop. Switch between live conversational scenarios, toggle playback speed, and test how our agents handle interruptions with native human cadence.
          </p>
        </div>

        <LottieVoiceOrb onExploreClick={() => setPage("solutions")} />
      </section>

      {/* ── HOW IT WORKS (Grid Steps) ── */}
      <GridSteps />

      {/* ── BENTO CAPABILITIES ── */}
      <BentoCapabilitySection setPage={setPage} />

      {/* ── INDUSTRY SHOWROOM ── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <SectionLabel text="Industry Showroom" color="orange" />
          <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
            AI Voice Agents for Every Enterprise Vertical
          </h2>
          <p className="text-slate-500 leading-relaxed">
            AI voice agents for healthcare, finance, real estate, ecommerce, logistics, insurance, BPO, SaaS, education, recruitment, telecom, and travel — 12 pre-configured verticals.
          </p>
        </div>
        <IndustryShowroomGrid />
      </section>

      {/* ── INBOUND + OUTBOUND SPLIT ── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <SectionLabel text="Inbound & Outbound AI Calling" />
          <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
            One Unified Voice Automation Platform.<br />Two Powerful Directions.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inbound */}
          <motion.div className="relative overflow-hidden rounded-3xl p-10 space-y-6"
            initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            style={{ background: "linear-gradient(145deg, #1B4332 0%, #14532D 100%)", boxShadow: "0 20px 48px rgba(11,41,26,0.2)" }}>
            <div className="absolute top-0 right-0 w-48 h-48 opacity-15 rounded-full"
              style={{ background: "radial-gradient(circle, #34D399, transparent)" }} />
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <Headphones className="w-7 h-7 text-[#34D399]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#34D399] font-mono uppercase tracking-widest mb-2">AI Inbound Calling</p>
              <h3 className="text-2xl font-extrabold text-white mb-3">AI Receptionist & Inbound Call Automation</h3>
              <p className="text-white/65 text-sm leading-relaxed">
                Answer every inbound call on the first ring — 24/7. Deflect FAQs, book appointments, qualify leads, and execute warm transfers to human agents. Replace legacy IVR with conversational AI voice.
              </p>
            </div>
            <ul className="space-y-2.5">
              {["Zero-wait first-ring AI answering", "CRM & calendar booking integration", "Warm human escalation with transcript", "Intent classification & smart routing", "AI receptionist for 12+ industries", "Front desk automation"].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-white/80">
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Outbound */}
          <motion.div className="relative overflow-hidden rounded-3xl p-10 space-y-6 bg-white border border-[#EADEC9]"
            initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.07)" }}>
            <div className="w-14 h-14 rounded-2xl bg-[#FEF3C7] flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-[#EA580C]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#EA580C] font-mono uppercase tracking-widest mb-2">AI Outbound Calling</p>
              <h3 className="text-2xl font-extrabold text-[#0F172A] mb-3">Outbound AI Calling Campaign Engine</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Contact thousands of leads within seconds of form submission. Verify COD orders, recover abandoned carts, collect EMI payments, and reactivate cold databases with personalized AI voice calls.
              </p>
            </div>
            <ul className="space-y-2.5">
              {["3-second speed-to-lead response time", "Smart retry for busy / unanswered lines", "Dynamic call disposition & sentiment scoring", "Batch campaign with 10,000+ concurrent calls", "COD verification & RTO reduction", "AI-powered collections calls"].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-[#334155]">
                  <CheckCircle2 className="w-4 h-4 text-[#EA580C] flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#EADEC9]">
              {[{ v: "94.2%", l: "Contact rate" }, { v: "1m 45s", l: "Avg qualify" }, { v: "₹6.98", l: "Per lead" }].map((m, i) => (
                <div key={i} className="text-center p-3 rounded-2xl bg-[#FEF3C7]">
                  <p className="text-lg font-extrabold text-[#EA580C]">{m.v}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{m.l}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── USE CASES ── */}
      <UseCaseSection setPage={setPage} />

      {/* ── ABOUT / ARCHITECTURE ── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-[40px] p-10 lg:p-16 border border-[#E2E8F0] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.06),_0_12px_24px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden">
          {/* Subtle background decoration inside the box */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center relative z-10">
            
            {/* Left: Text Content */}
            <motion.div 
              className="space-y-6" 
              initial={{ opacity: 0, x: -30 }} 
              whileInView={{ opacity: 1, x: 0 }} 
              viewport={{ once: true }}
            >
              <h2 
                className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-[1.15]"
                style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
              >
                Built Different — Not Just<br />Another Stacked Voice API
              </h2>
              <p className="text-slate-500 text-[17px] leading-[1.7] max-w-[500px]">
                Most AI voice calling software chains third-party STT → LLM → TTS providers, adding 800ms–1.5s of pipeline latency. Claritiy Voice runs a vertically integrated audio model — direct WebRTC streaming with sub-180ms response. That's the difference between a voice bot and a real AI phone agent.
              </p>
            </motion.div>

            {/* Right: 4 Feature Cards */}
            <div className="space-y-4">
              {[
                { icon: Zap, title: "Sub-180ms End-to-End Latency", desc: "No REST overhead — direct audio streaming", color: "#059669" },
                { icon: Globe2, title: "70+ Regional Dialects, Zero Translation", desc: "Native speech models, no lossy intermediate API", color: "#EA580C" },
                { icon: ShieldCheck, title: "Edge-Level PII Redaction", desc: "MSME Certified, DPDP Act & TLS 1.3 encryption", color: "#059669" },
                { icon: Network, title: "Function Calling & Tool Calling", desc: "Real-time API execution while live on the call", color: "#EA580C" },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-5 bg-white border border-[#E2E8F0] rounded-2xl px-6 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:border-[#CBD5E1] transition-all w-full"
                  initial={{ opacity: 0, y: 15 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: color === "#059669" ? "#ECFDF5" : "#FFF7ED" }}>
                    <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0F172A] text-[16px]">{title}</h4>
                    <p className="text-[14px] text-slate-500 mt-1">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <ComparisonSection setPage={setPage} />


      {/* ── COMPLIANCE BADGE PANEL ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div className="relative overflow-hidden rounded-3xl p-12 lg:p-16 text-center space-y-8"
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ background: "linear-gradient(145deg, #1B4332 0%, #0D2B20 100%)", boxShadow: "0 32px 64px rgba(11,41,26,0.22)" }}>
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-[#34D399]" />
              </div>
              <h2 className="text-3xl lg:text-5xl font-extrabold text-white"
                style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
                Enterprise Security & MSME Certification
              </h2>
              <p className="text-white/55 max-w-2xl mx-auto text-base leading-relaxed">
                Claritiy Voice is an officially registered MSME enterprise. Edge-level PII redaction, consent-based calling, audit logs, and escalation logic — built for performance and compliance.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {["📜 MSME REGISTERED", "🔒 256-BIT TLS 1.3", "🛡️ AES-256 ENCRYPTION", "⚖️ DPDP ACT ALIGNED", "📋 CONSENT-BASED CALLS"].map((b, i) => (
                  <span key={i} className="text-xs font-bold font-mono px-4 py-2 rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#A7F3D0", border: "1px solid rgba(167,243,208,0.2)" }}>
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>



      {/* ── FINAL CTA ── */}
      <FinalCTA setPage={setPage} />
    </div>
  );
}

// ── Interlocking Horizontal Steps Section ──────────────────────────────────────
function GridSteps() {
  const steps = [
    { n: "01", title: "Configure Your AI Agent", desc: "Name your agent, pick a voice persona, set language mode, and define the conversation goal.", icon: Bot },
    { n: "02", title: "Upload Knowledge Base", desc: "Paste FAQs, connect Shopify/CRM, or upload PDFs. Your AI phone assistant learns your business instantly via RAG.", icon: Database },
    { n: "03", title: "Connect Phone Number", desc: "Get a dedicated PSTN number or bring your SIP trunk. Inbound and outbound routing configured in one click.", icon: Phone },
    { n: "04", title: "Launch & Monitor", desc: "Go live. Monitor calls in real-time, read transcripts, view AI call analytics, and iterate from the dashboard.", icon: BarChart3 },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="hatched-strip h-10 w-full mb-10" />
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <SectionLabel text="Deploy in Under 10 Minutes" />
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          From Zero to Live AI Voice Agent
        </h2>
        <p className="text-[#5E5D57] text-sm sm:text-base leading-relaxed">
          No code. No call center setup. No engineering team. Build and deploy your AI phone agent in minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 flex flex-col justify-between hover:border-[#9C998F] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-2xl font-bold text-[#121212]">
                    {step.n}
                  </span>
                  <div className="w-8 h-8 rounded-[2px] bg-[#DFDCD4] flex items-center justify-center text-[#121212]">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm sm:text-base font-medium text-[#121212] mb-2 leading-snug font-sans">
                  {step.title}
                </h3>
                <p className="text-xs text-[#5E5D57] leading-relaxed font-sans">
                  {step.desc}
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#CBC8BE]/60 text-[10px] font-mono text-[#5E5D57] uppercase tracking-wider">
                Phase {step.n}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
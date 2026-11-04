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

// ── Technical Neo-Brutalist Use Cases Section ──────────────────────────────────
function UseCaseSection({ setPage }: { setPage: (p: Page) => void }) {
  const useCases = [
    { step: "FIRST USE CASE", num: "01", title: "APPOINTMENTS", desc: "Automate booking, demo scheduling, and calendar integration. Reduce no-shows by 89%.", icon: Clock, metric: "89% No-Show Reduction" },
    { step: "SECOND USE CASE", num: "02", title: "QUALIFICATION", desc: "Contact leads within 3s of form submission. Qualify budgets and score intent.", icon: TrendingUp, metric: "3s Response Window" },
    { step: "THIRD USE CASE", num: "03", title: "INBOUND", desc: "Handle inbound calls, answer FAQs, and intelligently route to human agents.", icon: PhoneCall, metric: "0ms First-Ring Answering" },
    { step: "FOURTH USE CASE", num: "04", title: "COLLECTIONS", desc: "Automate EMI reminders and debt outreach with secure data handling.", icon: Activity, metric: "42% Recovery Lift" },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="hatched-strip h-10 w-full mb-10" />
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <SectionLabel text="Use Cases" />
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          One Platform. Every High-Value Call Automation Use Case.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {useCases.map((uc, i) => {
          const Icon = uc.icon;
          return (
            <div
              key={i}
              className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 flex flex-col justify-between hover:border-[#9C998F] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[10px] font-mono text-[#5E5D57] uppercase tracking-wider">
                    [ {uc.num} ] · {uc.step}
                  </span>
                  <div className="w-8 h-8 rounded-[2px] bg-[#DFDCD4] flex items-center justify-center text-[#121212]">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-base font-medium text-[#121212] mb-2 font-sans tracking-tight">
                  {uc.title}
                </h3>
                <p className="text-xs text-[#5E5D57] leading-relaxed font-sans">
                  {uc.desc}
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#CBC8BE]/60 text-[11px] font-mono font-medium text-[#121212]">
                {uc.metric}
              </div>
            </div>
          );
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

      {/* ── INBOUND + OUTBOUND SPLIT (Technical Wireframe Style) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="hatched-strip h-10 w-full mb-10" />
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <SectionLabel text="Inbound & Outbound AI Calling" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
            One Unified Voice Automation Platform.<br />Two Powerful Directions.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inbound Technical Dark Card */}
          <div className="rounded-[2px] bg-[#121212] border border-[#2A2926] text-white p-8 lg:p-10 space-y-6 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-[2px] bg-[#222120] border border-[#333333] flex items-center justify-center text-white mb-4">
                <Headphones className="w-4 h-4" />
              </div>
              <p className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">AI Inbound Calling</p>
              <h3 className="text-2xl font-medium text-white mb-3 font-sans">AI Receptionist & Inbound Call Automation</h3>
              <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed font-sans">
                Answer every inbound call on the first ring — 24/7. Deflect FAQs, book appointments, qualify leads, and execute warm transfers to human agents. Replace legacy IVR with conversational AI voice.
              </p>
            </div>
            <ul className="space-y-2 border-t border-[#2A2926] pt-4">
              {["Zero-wait first-ring AI answering", "CRM & calendar booking integration", "Warm human escalation with transcript", "Intent classification & smart routing", "AI receptionist for 12+ industries", "Front desk automation"].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs font-mono text-neutral-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Outbound Technical Warm Stone Card */}
          <div className="rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] p-8 lg:p-10 space-y-6 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center text-[#121212] mb-4">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-xs font-mono uppercase tracking-wider text-[#5E5D57] mb-2">AI Outbound Calling</p>
              <h3 className="text-2xl font-medium text-[#121212] mb-3 font-sans">Outbound AI Calling Campaign Engine</h3>
              <p className="text-[#5E5D57] text-xs sm:text-sm leading-relaxed font-sans">
                Contact thousands of leads within seconds of form submission. Verify COD orders, recover abandoned carts, collect EMI payments, and reactivate cold databases with personalized AI voice calls.
              </p>
            </div>
            <ul className="space-y-2 border-t border-[#CBC8BE]/60 pt-4">
              {["3-second speed-to-lead response time", "Smart retry for busy / unanswered lines", "Dynamic call disposition & sentiment scoring", "Batch campaign with 10,000+ concurrent calls", "COD verification & RTO reduction", "AI-powered collections calls"].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs font-mono text-[#5E5D57]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#121212] flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#CBC8BE]">
              {[{ v: "94.2%", l: "Contact rate" }, { v: "1m 45s", l: "Avg qualify" }, { v: "₹6.98", l: "Per lead" }].map((m, i) => (
                <div key={i} className="text-center p-3 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE]">
                  <p className="text-base font-bold font-mono text-[#121212]">{m.v}</p>
                  <p className="text-[10px] font-mono text-[#5E5D57] mt-0.5">{m.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── USE CASES ── */}
      <UseCaseSection setPage={setPage} />

      {/* ── ABOUT / ARCHITECTURE (Wireframe Minimalist Style) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="hatched-strip h-10 w-full mb-10" />
        <div className="bg-[#EBE9E2] rounded-[2px] p-8 lg:p-12 border border-[#CBC8BE] relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left: Text Content */}
            <div className="space-y-4">
              <SectionLabel text="Architecture" />
              <h2 className="text-3xl sm:text-4xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
                Built Different — Not Just Another Stacked Voice API
              </h2>
              <p className="text-[#5E5D57] text-sm sm:text-base leading-relaxed font-sans">
                Most AI voice calling software chains third-party STT → LLM → TTS providers, adding 800ms–1.5s of pipeline latency. Claritiy Voice runs a vertically integrated audio model — direct WebRTC streaming with sub-180ms response. That's the difference between a voice bot and a real AI phone agent.
              </p>
            </div>

            {/* Right: 4 Wireframe Cards */}
            <div className="space-y-3">
              {[
                { icon: Zap, title: "Sub-180ms End-to-End Latency", desc: "No REST overhead — direct audio streaming" },
                { icon: Globe2, title: "70+ Regional Dialects, Zero Translation", desc: "Native speech models, no lossy intermediate API" },
                { icon: ShieldCheck, title: "Edge-Level PII Redaction", desc: "MSME Certified, DPDP Act & TLS 1.3 encryption" },
                { icon: Network, title: "Function Calling & Tool Calling", desc: "Real-time API execution while live on the call" },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-[#E5E3DC] border border-[#CBC8BE] rounded-[2px] px-5 py-4 hover:border-[#9C998F] transition-colors w-full"
                >
                  <div className="w-8 h-8 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center flex-shrink-0 text-[#121212]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[#121212] text-sm font-sans">{title}</h4>
                    <p className="text-xs text-[#5E5D57] mt-0.5 font-sans">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <ComparisonSection setPage={setPage} />


      {/* ── COMPLIANCE BADGE PANEL (Technical Wireframe Style) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[2px] bg-[#121212] border border-[#2A2926] p-10 lg:p-14 text-center space-y-6 text-white">
            <div className="w-10 h-10 rounded-[2px] bg-[#222120] border border-[#333333] flex items-center justify-center mx-auto text-white">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-2xl sm:text-4xl font-medium text-white tracking-tight font-sans">
              Enterprise Security & MSME Certification
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto text-xs sm:text-sm leading-relaxed font-sans">
              Claritiy Voice is an officially registered MSME enterprise. Edge-level PII redaction, consent-based calling, audit logs, and escalation logic — built for performance and compliance.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {["📜 MSME REGISTERED", "🔒 256-BIT TLS 1.3", "🛡️ AES-256 ENCRYPTION", "⚖️ DPDP ACT ALIGNED", "📋 CONSENT-BASED CALLS"].map((b, i) => (
                <span key={i} className="text-[11px] font-mono text-neutral-300 bg-[#1E1D1B] border border-[#333333] rounded-[2px] px-3 py-1.5 uppercase">
                  {b}
                </span>
              ))}
            </div>
          </div>
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
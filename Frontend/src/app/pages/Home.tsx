import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
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

type Page = any;
interface HomeProps { setPage: (p: Page) => void; }

// ── Reusable section label ───────────────────────────────────────────────────
function SectionLabel({ text, color = "green" }: { text: string; color?: "green" | "orange" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full font-mono ${color === "green"
      ? "bg-[#D1FAE5] text-[#059669] border border-[#059669]/20"
      : "bg-[#FEF3C7] text-[#EA580C] border border-[#EA580C]/20"
      }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color === "green" ? "bg-[#059669]" : "bg-[#EA580C]"}`} />
      {text}
    </span>
  );
}

// ── 3D tilt card wrapper ──────────────────────────────────────────────────────
function TiltCard({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      whileHover={{
        rotateX: -4,
        rotateY: 4,
        scale: 1.02,
        boxShadow: "0 28px 60px rgba(0,0,0,0.13), 0 8px 20px rgba(0,0,0,0.07)",
        transition: { duration: 0.25, ease: "easeOut" },
      }}
      initial={{ boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
      style={{ ...style, transformStyle: "preserve-3d", perspective: "800px" }}
    >
      {children}
    </motion.div>
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
      className="fixed top-0 left-0 right-0 h-[3px] z-[999] origin-left"
      style={{
        scaleX: scrollYProgress,
        background: "linear-gradient(90deg, #059669, #34D399, #EA580C)",
      }}
    />
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

  // The 4 specific colors from the reference image
  const bannerColors = ["#E88B27", "#6C6A7B", "#2574A9", "#C23030"];

  return (
    <section className="py-24 px-4 sm:px-6 max-w-5xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
        <SectionLabel text="Platform Capabilities" color="orange" />
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          Every Feature Your Enterprise<br />AI Voice Platform Needs
        </h2>
      </div>

      <div className="flex flex-col gap-10">
        {items.map((item, i) => {
          const Icon = item.icon;
          const bgColor = bannerColors[i % bannerColors.length];
          
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: (i % 4) * 0.1 }}
              className="relative w-full rounded-md shadow-[0_15px_30px_rgba(0,0,0,0.15)] overflow-hidden min-h-[160px] md:min-h-[180px] flex items-center group"
              style={{ backgroundColor: bgColor }}
            >
              {/* White Wavy Overlay Shape with Notch */}
              <svg 
                className="absolute right-0 top-0 w-full h-full z-0 drop-shadow-[-8px_0_12px_rgba(0,0,0,0.25)]" 
                preserveAspectRatio="none" 
                viewBox="0 0 1000 200"
              >
                <path 
                  d="M 1000 0 L 280 0 L 260 45 L 240 0 C 350 0, 350 200, 450 200 L 1000 200 Z" 
                  fill="#ffffff" 
                />
              </svg>

              {/* Content Container */}
              <div className="relative z-10 w-full h-full">
                
                {/* Left Side: Icon (Strictly bounded to left 25%) */}
                <div className="absolute left-0 top-0 bottom-0 w-[25%] flex justify-center items-center">
                  <div className="relative">
                    {/* Simulated Long Shadow for the Icon */}
                    <Icon 
                      className="w-10 h-10 sm:w-16 sm:h-16 text-white absolute top-1 left-1 opacity-20 blur-[2px]" 
                      strokeWidth={1.5} 
                    />
                    <Icon 
                      className="w-10 h-10 sm:w-16 sm:h-16 text-white relative z-10 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.1)]" 
                      strokeWidth={1.5} 
                    />
                  </div>
                </div>

                {/* Right Side: Text (Strictly bounded to right 55% so it's always on white) */}
                <div className="absolute right-0 top-0 bottom-0 w-[55%] flex flex-col justify-center pr-4 sm:pr-8 md:pr-12">
                  <span 
                    className="text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1"
                    style={{ color: bgColor }}
                  >
                    Feature 0{i + 1}
                  </span>
                  <h3 
                    className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 mb-1 sm:mb-2 leading-tight" 
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-[10px] sm:text-xs md:text-sm text-slate-700 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>

              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ── Use Case Infographic Section ───────────────────────────────────────────────
function UseCaseSection({ setPage }: { setPage: (p: Page) => void }) {
  const useCases = [
    {
      title: "AI Voice Agents for Appointment Booking",
      desc: "Automate appointment booking, demo scheduling, and calendar integration across healthcare clinics, real estate teams, and SaaS companies. Reduce no-shows by 89% with proactive reminders.",
      icon: Clock,
    },
    {
      title: "AI Outbound Calling for Lead Qualification",
      desc: "Deploy AI calling agents that contact leads within 3 seconds of form submission. Qualify budgets, score intent, and book sales calls automatically.",
      icon: TrendingUp,
    },
    {
      title: "AI Inbound Calling & Front Desk Automation",
      desc: "Replace legacy IVR systems with a human-like AI receptionist that handles inbound calls, answers FAQs, routes calls intelligently, and escalates to human agents with full context.",
      icon: PhoneCall,
    },
    {
      title: "Collections & Payment Reminder Calls",
      desc: "Automate ethical EMI payment reminders, debt collection outreach, and renewal campaigns with PCI-DSS compliant AI calling agents. 3.4× higher recovery rates vs manual teams.",
      icon: Activity,
    },
  ];

  const colors = ["#4F46E5", "#0CA5A5", "#9333EA", "#E11D48"];

  return (
    <section className="py-24 px-4 bg-[#F8F9FA] relative overflow-hidden">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <SectionLabel text="Use Cases" color="orange" />
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          One Platform. Every High-Value<br />Call Automation Use Case.
        </h2>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center relative lg:min-h-[650px] lg:py-10">
        
        {/* Deterministic CSS for absolute positioning on Desktop */}
        <style dangerouslySetInnerHTML={{__html: `
          @media (min-width: 1024px) {
            .usecase-node { position: absolute !important; margin-bottom: 0 !important; transform: translateY(-50%) !important; }
            .usecase-node-0 { top: 12.5%; }
            .usecase-node-1 { top: 37.5%; }
            .usecase-node-2 { top: 62.5%; }
            .usecase-node-3 { top: 87.5%; }
          }
        `}} />

        {/* Left Hub - Business Infographic Circle */}
        <div className="w-full lg:w-[35%] flex justify-center mb-16 lg:mb-0 relative z-20">
           <div className="w-56 h-56 md:w-64 md:h-64 rounded-full flex flex-col items-center justify-center relative shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-[8px] border-white group bg-[#0F172A]">
             <div className="absolute -inset-4 rounded-full border border-slate-200 pointer-events-none"></div>
             
             {/* Left Curved Accent Line */}
             <svg className="absolute -inset-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)] pointer-events-none" viewBox="0 0 100 100">
                <path d="M 15 15 A 45 45 0 0 0 15 85" fill="none" stroke="#1E293B" strokeWidth="0.5" />
                <circle cx="15" cy="15" r="1.5" fill="#1E293B" />
                <circle cx="15" cy="85" r="1.5" fill="#1E293B" />
             </svg>

             {/* Lottie Animation (Now visible against dark bg) */}
             <div className="absolute inset-0 p-8 flex items-center justify-center scale-125 opacity-90 group-hover:opacity-100 transition-all duration-500">
               <DotLottieReact
                 src="https://lottie.host/64d72863-7188-466d-a60d-2e6dd0f40d1e/bXw3YtZ2gZ.lottie"
                 loop
                 autoplay
                 className="w-full h-full object-contain"
               />
             </div>
           </div>
        </div>

        {/* Tree Connection Lines (SVG) - Desktop Only */}
        {/* SVG perfectly spans from hub center (17.5%) to cards left edge (40%) */}
        <svg className="hidden lg:block absolute left-[17.5%] right-[60%] top-10 bottom-10 z-10 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
          <path d="M 0 50 C 40 50, 60 12.5, 100 12.5" fill="none" stroke="#94A3B8" strokeWidth="0.4" />
          <path d="M 0 50 C 40 50, 60 37.5, 100 37.5" fill="none" stroke="#94A3B8" strokeWidth="0.4" />
          <path d="M 0 50 C 40 50, 60 62.5, 100 62.5" fill="none" stroke="#94A3B8" strokeWidth="0.4" />
          <path d="M 0 50 C 40 50, 60 87.5, 100 87.5" fill="none" stroke="#94A3B8" strokeWidth="0.4" />
          
          {/* Connector dots on the cards */}
          <circle cx="100" cy="12.5" r="1.5" fill="#475569" />
          <circle cx="100" cy="37.5" r="1.5" fill="#475569" />
          <circle cx="100" cy="62.5" r="1.5" fill="#475569" />
          <circle cx="100" cy="87.5" r="1.5" fill="#475569" />
          
          {/* Connector dot on the hub center */}
          <circle cx="0" cy="50" r="2" fill="#475569" />
        </svg>

        {/* Right List - 4 Nodes */}
        <div className="w-full lg:w-[60%] flex flex-col h-auto lg:absolute lg:right-0 lg:top-10 lg:bottom-10 z-20 pl-4 lg:pl-0 pr-4">
           {useCases.map((uc, i) => {
             const Icon = uc.icon;
             const color = colors[i];
             return (
               <div 
                 key={i} 
                 className={`flex items-center w-full relative group mb-6 lg:mb-0 usecase-node usecase-node-${i}`}
               >
                 {/* White Circle Icon */}
                 <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white flex flex-shrink-0 items-center justify-center z-20 relative group-hover:scale-105 transition-transform border-[6px] border-[#F8F9FA]"
                      style={{ boxShadow: "inset 0 -5px 10px rgba(0,0,0,0.05), 0 10px 20px rgba(0,0,0,0.08)" }}>
                   <Icon className="w-6 h-6 md:w-8 md:h-8 text-slate-700" strokeWidth={1.5} />
                 </div>
                 
                 {/* Colored Arrow Ribbon */}
                 <div 
                   className="flex-1 py-5 md:py-6 pl-12 md:pl-16 pr-8 md:pr-14 -ml-10 text-white relative z-10 transition-transform group-hover:translate-x-2"
                   style={{ 
                     backgroundColor: color,
                     clipPath: "polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%)",
                     boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                   }}
                 >
                   <div className="flex items-center gap-2 mb-1.5">
                     <span className="text-[10px] md:text-xs uppercase tracking-widest font-bold opacity-90">INFOGRAPHIC</span>
                     <span className="text-xl md:text-2xl font-black">{`0${i+1}`}</span>
                   </div>
                   <h3 className="font-extrabold text-sm md:text-base mb-1.5 leading-tight text-white">{uc.title}</h3>
                   <p className="text-xs md:text-sm text-white/90 leading-relaxed font-medium pr-4">{uc.desc}</p>
                 </div>
               </div>
             )
           })}
        </div>

      </div>
    </section>
  );
}

// ── Comparison Table ──────────────────────────────────────────────────────────
function ComparisonSection({ setPage }: { setPage: (p: Page) => void }) {
  const rows = [
    { feature: "Response Latency", clarity: "< 180ms", vapi: "800ms–1.5s", legacy: "45+ min queue", highlight: true },
    { feature: "Native Audio Pipeline", clarity: "✅ Vertically Integrated", vapi: "❌ Stacked STT+LLM+TTS", legacy: "❌ Human only" },
    { feature: "Multilingual Support", clarity: "✅ 70+ Languages", vapi: "✅ Limited", legacy: "⚠️ Per hire" },
    { feature: "Concurrent Calls", clarity: "✅ Unlimited", vapi: "⚠️ Rate limited", legacy: "❌ Team capacity" },
    { feature: "RAG Knowledge Base", clarity: "✅ Built-in", vapi: "⚠️ Manual setup", legacy: "❌ Scripts only" },
    { feature: "HIPAA / SOC 2", clarity: "✅ Full Compliance", vapi: "⚠️ Partial", legacy: "⚠️ Varies" },
    { feature: "Pricing Model", clarity: "✅ Flat ₹3.99/min", vapi: "❌ STT+LLM+TTS billed separately", legacy: "❌ ₹25K+/agent/mo" },
    { feature: "Setup Time", clarity: "✅ < 10 minutes", vapi: "⚠️ Days of engineering", legacy: "❌ Weeks of hiring" },
  ];

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
        <SectionLabel text="AI Voice Agents vs Competitors" color="orange" />
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A]"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          Clarity Voice vs Vapi, Retell AI,<br />Bland AI & Legacy Call Centers
        </h2>
        <p className="text-slate-500 leading-relaxed">
          See exactly why Clarity Voice is the best AI calling platform for enterprises who need speed, scale, and compliance.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-3xl overflow-hidden border border-[#EADEC9]"
        style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.07)" }}
      >
        {/* Table header */}
        <div className="grid grid-cols-4 bg-[#1B4332] text-white text-xs font-bold uppercase tracking-wider">
          <div className="p-5 font-mono">Feature</div>
          <div className="p-5 font-mono text-[#34D399] border-l border-white/10">
            ✦ Clarity Voice
          </div>
          <div className="p-5 font-mono text-white/60 border-l border-white/10">Vapi / Retell</div>
          <div className="p-5 font-mono text-white/60 border-l border-white/10">Human Centers</div>
        </div>
        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-4 border-t border-[#EADEC9] ${row.highlight ? "bg-[#F0FDF4]" : i % 2 === 0 ? "bg-white" : "bg-[#FAF8F5]"} transition-colors hover:bg-[#F0FDF4]`}
          >
            <div className="p-4 text-sm font-bold text-[#0F172A]">{row.feature}</div>
            <div className="p-4 text-sm font-semibold text-[#059669] border-l border-[#EADEC9]">{row.clarity}</div>
            <div className="p-4 text-sm text-slate-500 border-l border-[#EADEC9]">{row.vapi}</div>
            <div className="p-4 text-sm text-slate-500 border-l border-[#EADEC9]">{row.legacy}</div>
          </div>
        ))}
        {/* CTA row */}
        <div className="grid grid-cols-4 border-t border-[#EADEC9] bg-[#F0FDF4]">
          <div className="p-5 col-span-1 text-sm font-bold text-[#059669]">Ready to switch?</div>
          <div className="p-5 col-span-3 border-l border-[#EADEC9]">
            <button
              onClick={() => setPage("dashboard")}
              className="inline-flex items-center gap-2 text-sm font-bold text-white px-6 py-2.5 rounded-full"
              style={{ background: "linear-gradient(135deg, #059669, #10B981)", boxShadow: "0 4px 16px rgba(5,150,105,0.25)" }}
            >
              Start Building Now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}


// ── Full-bleed editorial CTA ──────────────────────────────────────────────────
function FinalCTA({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-[40px]"
          style={{ background: "linear-gradient(145deg, #0D2B20 0%, #1B4332 50%, #0A3622 100%)" }}>
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          {/* Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 opacity-20 rounded-full"
            style={{ background: "radial-gradient(circle, #34D399, transparent)" }} />
          <div className="absolute bottom-0 left-0 w-64 h-64 opacity-15 rounded-full"
            style={{ background: "radial-gradient(circle, #EA580C, transparent)" }} />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 items-center gap-10 p-12 lg:p-16">
            {/* Left */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-2">
                <span className="w-2 h-2 bg-[#34D399] rounded-full animate-pulse" />
                <span className="text-xs font-bold text-white/80 font-mono uppercase tracking-widest">Now Live — Zero Setup</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight"
                style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
                Deploy Your First AI Voice Agent in Under 10 Minutes
              </h2>
              <p className="text-white/60 text-base leading-relaxed">
                No engineering team. No call center overhead. Deploy conversational AI voice agents for appointment booking, lead qualification, COD verification, and more — instantly.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setPage("dashboard")}
                  className="inline-flex items-center gap-2 font-bold text-base text-[#1B4332] px-8 py-4 rounded-full transition-all hover:scale-105 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #34D399 0%, #10B981 100%)", boxShadow: "0 8px 24px rgba(52,211,153,0.4)" }}
                >
                  Build Your Agent Now <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage("pricing")}
                  className="inline-flex items-center gap-2 font-semibold text-sm text-white border border-white/25 px-7 py-4 rounded-full hover:bg-white/10 transition-all"
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
                "HIPAA & SOC 2",
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
    <div className="overflow-hidden" style={{ background: "#FAF8F5" }}>
      <ScrollProgress />

      {/* ── HERO ── */}
      <Hero setPage={setPage} />

      {/* ── METRICS BAND ── */}
      <section className="py-16 px-6">
        <motion.div
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            background: "linear-gradient(135deg, #1B4332 0%, #0D2B20 100%)",
            boxShadow: "0 24px 64px rgba(11,41,26,0.22)",
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {[
              { v: "10M+", l: "Calls Handled Monthly", s: "AI call automation at scale" },
              { v: "<180ms", l: "Voice Response Latency", s: "Native multimodal pipeline" },
              { v: "70+", l: "Languages Supported", s: "Accent-aware speech models" },
              { v: "99.9%", l: "Uptime SLA", s: "Enterprise-grade reliability" },
            ].map((m, i) => (
              <div key={i} className="flex flex-col items-center text-center p-8">
                <StatNumber value={m.v} />
                <span className="text-sm font-bold text-[#34D399] mt-2">{m.l}</span>
                <span className="text-xs text-white/35 mt-1 font-mono">{m.s}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── ABOUT / ARCHITECTURE ── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div className="space-y-6" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <SectionLabel text="Native Multimodal AI Pipeline" />
            <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
              style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
              Built Different — Not Just<br />Another Stacked Voice API
            </h2>
            <p className="text-slate-500 text-base leading-relaxed">
              Most AI voice calling software chains third-party STT → LLM → TTS providers, adding 800ms–1.5s of pipeline latency. Clarity Voice runs a vertically integrated audio model — direct WebRTC streaming with sub-180ms response. That's the difference between a voice bot and a real AI phone agent.
            </p>
            <div className="space-y-3">
              {[
                { icon: Zap, title: "Sub-180ms End-to-End Latency", desc: "No REST overhead — direct audio streaming", color: "#059669" },
                { icon: Globe2, title: "70+ Regional Dialects, Zero Translation", desc: "Native speech models, no lossy intermediate API", color: "#EA580C" },
                { icon: ShieldCheck, title: "Edge-Level PII/PHI Redaction", desc: "HIPAA, SOC 2, PCI-DSS compliance built-in", color: "#059669" },
                { icon: Network, title: "Function Calling & Tool Calling", desc: "Real-time API execution while live on the call", color: "#EA580C" },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <motion.div
                  key={i}
                  className="flex gap-4 items-start bg-white border border-[#EADEC9] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#059669]/30 transition-all"
                  initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: color === "#059669" ? "#D1FAE5" : "#FEF3C7" }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0F172A] text-sm">{title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Lottie Animation Panel */}
          <TiltCard className="rounded-3xl p-8 space-y-6 flex items-center justify-center">
            <div className="w-full h-[450px] rounded-3xl relative overflow-hidden flex items-center justify-center shadow-2xl"
              style={{
                background: "linear-gradient(145deg, #1B4332 0%, #0D2B20 100%)",
                boxShadow: "0 20px 48px rgba(11,41,26,0.20)",
              }}>
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
              
              <div className="relative z-10 w-full h-full flex items-center justify-center scale-125">
                <DotLottieReact
                  src="https://lottie.host/64d72863-7188-466d-a60d-2e6dd0f40d1e/bXw3YtZ2gZ.lottie"
                  loop
                  autoplay
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/30 backdrop-blur-md border border-white/10 px-6 py-2.5 rounded-full z-20 shadow-lg flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></div>
                 <span className="text-white/90 text-sm font-semibold tracking-wide font-mono">Live Sub-180ms Audio Stream</span>
              </div>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ── HOW IT WORKS (Grid Steps) ── */}
      <GridSteps />

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

      {/* ── BENTO CAPABILITIES ── */}
      <BentoCapabilitySection setPage={setPage} />

      {/* ── USE CASES ── */}
      <UseCaseSection setPage={setPage} />

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
                Enterprise-Grade Compliance & Secure Voice AI
              </h2>
              <p className="text-white/55 max-w-2xl mx-auto text-base leading-relaxed">
                Clarity Voice is the most compliance-ready AI voice platform available. Edge-level PII/PHI redaction, consent-based calling, audit logs, and escalation logic — built for regulated industries including healthcare, banking, insurance, and finance.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {["🔒 SOC 2 TYPE II", "🏥 HIPAA BAA READY", "🛡️ ISO 27001", "⚖️ GDPR & DPDP ACT", "💳 PCI-DSS COMPLIANT", "📋 CONSENT-BASED CALLS"].map((b, i) => (
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
    { n: "1", title: "Configure Your AI Agent", desc: "Name your agent, pick a voice persona, set language mode, and define the conversation goal.", icon: Bot, color: "#14532D" },
    { n: "2", title: "Upload Knowledge Base", desc: "Paste FAQs, connect Shopify/CRM, or upload PDFs. Your AI phone assistant learns your business instantly via RAG.", icon: Database, color: "#166534" },
    { n: "3", title: "Connect Phone Number", desc: "Get a dedicated PSTN number or bring your SIP trunk. Inbound and outbound routing configured in one click.", icon: Phone, color: "#15803D" },
    { n: "4", title: "Launch & Monitor", desc: "Go live. Monitor calls in real-time, read transcripts, view AI call analytics, and iterate from the dashboard.", icon: BarChart3, color: "#16A34A" },
  ];

  return (
    <section className="py-28 px-4 lg:px-8 relative overflow-hidden bg-[#F1F5F9]">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <SectionLabel text="Deploy in Under 10 Minutes" color="green" />
          <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
            From Zero to Live AI Voice Agent
          </h2>
          <p className="text-slate-500 leading-relaxed">
            No code. No call center setup. No engineering team. Build and deploy your AI phone agent in minutes.
          </p>
        </div>

        {/* Horizontal Interlocking Cards Container */}
        <div className="flex flex-col xl:flex-row items-stretch justify-center pl-0 xl:pl-16 gap-y-12 xl:gap-y-0 max-w-full overflow-hidden pb-12 pt-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            // z-index increases left to right so that right cards overlap left cards
            const zIndex = (i + 1) * 10;
            // The left margin creates the overlap on desktop
            const marginLeft = i === 0 ? "0" : "-ml-0 xl:-ml-12";
            // Extra right padding for cards 1, 2, 3 to prevent their text from being covered by the next card's overlapping number
            const paddingRight = i !== steps.length - 1 ? "xl:pr-32" : "";
            
            return (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={`relative flex-1 rounded-3xl p-8 lg:p-10 ${paddingRight} flex flex-col justify-between min-h-[380px] shadow-2xl ${marginLeft}`}
                style={{ 
                  backgroundColor: step.color, 
                  zIndex: zIndex,
                }}
              >
                {/* Large Interlocking Number (Hidden on very small mobile, visible mostly on tablet/desktop) */}
                <div 
                  className="absolute hidden sm:block top-1/2 -translate-y-1/2 font-black select-none pointer-events-none transition-transform"
                  style={{
                    left: "-3.5rem", // Protrudes to the left to overlap the previous card
                    fontSize: "240px",
                    lineHeight: "0.8",
                    color: step.color, // Exactly matches the card background to form a seamless extension
                    textShadow: "-12px 0px 20px rgba(0,0,0,0.35)", // Creates the 3D interlocking illusion
                    zIndex: -1 // Sits just behind the card content but above the previous card
                  }}
                >
                  {step.n}
                </div>

                {/* Mobile version of the number (Since horizontal overlap doesn't work well on vertical stack) */}
                <div className="sm:hidden absolute -top-8 left-8 text-7xl font-black text-white/20 select-none">
                  {step.n}
                </div>

                {/* Card Content */}
                <div className="relative z-10 flex flex-col h-full">
                  <div className="mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6 shadow-inner border border-white/5">
                      <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl font-extrabold text-white mb-4 leading-snug">
                      {step.title}
                    </h3>
                    <p className="text-white/80 leading-relaxed font-medium text-sm">
                      {step.desc}
                    </p>
                  </div>

                  <div className="mt-auto">
                    <div className="w-full h-[1px] bg-white/20 mb-4"></div>
                    <p className="text-xs font-bold text-white/60 uppercase tracking-widest font-mono">
                      Phase {step.n}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  );
}

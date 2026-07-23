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

// ── Bento Box Section ─────────────────────────────────────────────────────────
function BentoCapabilitySection({ setPage }: { setPage: (p: Page) => void }) {
  const items = [
    {
      title: "Sub-180ms Real-Time Voice AI",
      desc: "Native multimodal pipeline — no stacked APIs. ASR + LLM + TTS vertically integrated for human-like phone conversations with zero lag. The best low-latency voice AI available.",
      icon: Zap,
      accent: "#059669",
      bg: "#D1FAE5",
      span: "col-span-2",
      tall: true,
      badge: "< 180ms",
    },
    {
      title: "Interruption & Barge-In Support",
      desc: "Full-duplex audio processing allows callers to interrupt naturally. The AI voice agent instantly adapts — real-time conversation that feels genuinely human.",
      icon: MessageSquare,
      accent: "#EA580C",
      bg: "#FEF3C7",
      span: "col-span-1",
      tall: false,
      badge: "Full-Duplex",
    },
    {
      title: "Multilingual Voice Support — 70+ Languages",
      desc: "Native speech recognition across English, Hindi, Bengali, Kannada, Mandarin, Arabic, and 64+ more. Accent support built in. No translation overhead.",
      icon: Languages,
      accent: "#059669",
      bg: "#ECFDF5",
      span: "col-span-1",
      tall: false,
      badge: "70+ Dialects",
    },
    {
      title: "RAG Knowledge Base Calling",
      desc: "Attach PDFs, URLs, and CRM data for 100% hallucination-free answers. Real-time retrieval during live calls — your AI receptionist knows everything about your business.",
      icon: Database,
      accent: "#EA580C",
      bg: "#FEF3C7",
      span: "col-span-1",
      tall: false,
      badge: "Real-Time RAG",
    },
    {
      title: "Warm Transfer & Human Handoff",
      desc: "When escalation is needed, the AI voice agent executes a warm transfer with full call context and transcript — seamless hand-off to your human agent team.",
      icon: PhoneCall,
      accent: "#059669",
      bg: "#D1FAE5",
      span: "col-span-2",
      tall: false,
      badge: "Human Escalation",
    },
    {
      title: "CRM & Webhook Automation",
      desc: "Bi-directional sync with Salesforce, HubSpot, Shopify, and custom REST webhooks. Automated call disposition, lead scoring, and pipeline updates in real-time.",
      icon: Webhook,
      accent: "#EA580C",
      bg: "#FEF3C7",
      span: "col-span-1",
      tall: false,
      badge: "2-Way CRM Sync",
    },
    {
      title: "Batch Calling & Smart Retry Logic",
      desc: "Launch 10,000+ simultaneous outbound AI calls with intelligent retry schedules for busy lines, voicemails, and unanswered calls. AI call automation at enterprise scale.",
      icon: RefreshCw,
      accent: "#059669",
      bg: "#ECFDF5",
      span: "col-span-1",
      tall: false,
      badge: "10K+ Concurrent",
    },
    {
      title: "Call Summarization & Sentiment Analysis",
      desc: "Automated post-call disposition, key phrase extraction, sentiment scoring, call recording, and transcription indexing — everything you need for AI call analytics.",
      icon: BarChart3,
      accent: "#EA580C",
      bg: "#FEF3C7",
      span: "col-span-1",
      tall: false,
      badge: "Auto-Analytics",
    },
    {
      title: "Compliance Logging & PII Redaction",
      desc: "Edge-level PII/PHI redaction before any log storage. SOC 2 Type II, HIPAA BAA, PCI-DSS, and GDPR audit trails. The most secure voice AI platform available.",
      icon: ShieldCheck,
      accent: "#059669",
      bg: "#D1FAE5",
      span: "col-span-1",
      tall: false,
      badge: "SOC 2 / HIPAA",
    },
  ];

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <SectionLabel text="Platform Capabilities" />
        <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          Every Feature Your Enterprise<br />AI Voice Platform Needs
        </h2>
        <p className="text-slate-500 text-base leading-relaxed">
          From real-time ASR/TTS to RAG knowledge base calling, CRM integration, and compliance logging — one unified AI voice automation platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-auto">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className={`${item.span} relative bg-white border border-[#EADEC9] rounded-3xl p-7 flex flex-col gap-4 overflow-hidden group cursor-default transition-all`}
              style={{
                boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                minHeight: item.tall ? "280px" : "auto",
              }}
            >
              {/* Hover overlay */}
              <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, ${item.bg}80 0%, transparent 55%)` }}
              />
              {/* Badge */}
              <span
                className="absolute top-6 right-6 text-[9px] font-extrabold uppercase tracking-[0.15em] px-3 py-1 rounded-full font-mono"
                style={{ background: item.bg, color: item.accent, border: `1px solid ${item.accent}25` }}
              >
                {item.badge}
              </span>
              {/* Icon */}
              <div className="relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                style={{ background: item.bg }}>
                <Icon className="w-6 h-6" style={{ color: item.accent }} />
              </div>
              {/* Text */}
              <div className="relative z-10 flex-1">
                <h3 className="text-lg font-extrabold text-[#0F172A] mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {item.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ── Use Case Tabs Section ─────────────────────────────────────────────────────
function UseCaseSection({ setPage }: { setPage: (p: Page) => void }) {
  const useCases = [
    {
      title: "AI Voice Agents for Appointment Booking",
      desc: "Automate appointment booking, demo scheduling, and calendar integration across healthcare clinics, real estate teams, and SaaS companies. Reduce no-shows by 89% with proactive reminders and confirmation calls.",
      stats: [{ v: "89%", l: "No-show reduction" }, { v: "3s", l: "Speed to confirm" }, { v: "24/7", l: "Always available" }],
      keywords: ["appointment scheduling", "demo booking", "calendar integration", "AI receptionist"],
      icon: Clock,
      accent: "#059669",
    },
    {
      title: "AI Outbound Calling for Lead Qualification",
      desc: "Deploy AI calling agents that contact leads within 3 seconds of form submission. Qualify budgets, score intent, and book sales calls automatically. The highest-converting outbound voice AI platform.",
      stats: [{ v: "94%", l: "Contact rate" }, { v: "3×", l: "Pipeline growth" }, { v: "₹6.98", l: "Per qualified lead" }],
      keywords: ["lead qualification", "outbound sales calls", "AI outbound calling", "cold lead calling"],
      icon: TrendingUp,
      accent: "#EA580C",
    },
    {
      title: "AI Inbound Calling & Front Desk Automation",
      desc: "Replace legacy IVR systems with a human-like AI receptionist that handles inbound calls, answers FAQs, routes calls intelligently, and escalates to human agents with full context.",
      stats: [{ v: "100%", l: "First-ring answer" }, { v: "60%", l: "IVR deflection" }, { v: "4.9★", l: "CSAT score" }],
      keywords: ["AI receptionist", "inbound call automation", "front desk automation", "call routing"],
      icon: PhoneCall,
      accent: "#059669",
    },
    {
      title: "Collections & Payment Reminder Calls",
      desc: "Automate ethical EMI payment reminders, debt collection outreach, and renewal campaigns with PCI-DSS compliant AI calling agents. 3.4× higher recovery rates vs manual teams.",
      stats: [{ v: "3.4×", l: "Recovery rate" }, { v: "78%", l: "Handled end-to-end" }, { v: "0", l: "Human hours used" }],
      keywords: ["payment reminders", "collections calls", "renewal reminders", "AI collections"],
      icon: Activity,
      accent: "#EA580C",
    },
  ];

  return (
    <section className="py-24 px-6" style={{ background: "linear-gradient(180deg, #FAF8F5 0%, #F0FDF4 100%)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <SectionLabel text="Use Cases" color="orange" />
          <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
            One Platform. Every High-Value<br />Call Automation Use Case.
          </h2>
          <p className="text-slate-500 leading-relaxed">
            From appointment booking and lead qualification to collections and post-call follow-up — Clarity Voice handles every job-to-be-done.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map((uc, i) => {
            const Icon = uc.icon;
            const isGreen = uc.accent === "#059669";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative bg-white border border-[#EADEC9] rounded-3xl overflow-hidden group"
                style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}
              >
                {/* Top accent strip */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${uc.accent}, ${isGreen ? "#34D399" : "#D97706"})` }} />

                <div className="p-8">
                  {/* Icon + Title */}
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: isGreen ? "#D1FAE5" : "#FEF3C7" }}>
                      <Icon className="w-6 h-6" style={{ color: uc.accent }} />
                    </div>
                    <h3 className="text-lg font-extrabold text-[#0F172A] leading-snug pt-1"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {uc.title}
                    </h3>
                  </div>

                  <p className="text-sm text-slate-500 leading-relaxed mb-6">{uc.desc}</p>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-6 p-4 rounded-2xl"
                    style={{ background: isGreen ? "#F0FDF4" : "#FFFBEB" }}>
                    {uc.stats.map((s, j) => (
                      <div key={j} className="text-center">
                        <p className="text-xl font-extrabold" style={{ color: uc.accent }}>{s.v}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>

                  {/* Keyword pills */}
                  <div className="flex flex-wrap gap-2">
                    {uc.keywords.map((kw, j) => (
                      <span key={j} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full font-mono"
                        style={{ background: isGreen ? "#D1FAE5" : "#FEF3C7", color: uc.accent }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
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
              Start Free — No Credit Card <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ── Social proof / Testimonial band ──────────────────────────────────────────
function SocialProofSection() {
  const logos = [
    "Healthcare Clinic", "D2C Brand", "Real Estate Firm", "BPO Partner",
    "InsurTech Co.", "Edtech Platform", "Logistics Player", "Fintech Startup",
  ];
  const testimonials = [
    { text: "Clarity Voice cut our COD return rate by 38% in the first month. The Hindi agent sounds completely natural.", author: "VP Operations", company: "D2C Fashion Brand", stars: 5 },
    { text: "We replaced our entire IVR system. The AI receptionist handles 1,200 inbound calls daily without a single human agent.", author: "CTO", company: "Healthcare Network", stars: 5 },
    { text: "Our EMI collection rate jumped 42% after switching to AI outbound calling. ROI was clear in week two.", author: "Head of Recoveries", company: "NBFC Lender", stars: 5 },
  ];

  return (
    <section className="py-24 px-6" style={{ background: "#FAF8F5" }}>
      <div className="max-w-7xl mx-auto">
        {/* Logo strip */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-8">
            Trusted by 500+ enterprise teams across 12 industries
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {logos.map((l, i) => (
              <div key={i} className="bg-white border border-[#EADEC9] rounded-full px-5 py-2 text-xs font-bold text-slate-500">
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="bg-white border border-[#EADEC9] rounded-3xl p-7 space-y-4"
              style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                ))}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed italic">"{t.text}"</p>
              <div className="pt-3 border-t border-[#EADEC9]">
                <p className="text-sm font-bold text-[#0F172A]">{t.author}</p>
                <p className="text-xs text-slate-400">{t.company}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
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
                  Build Free Agent Now <ArrowRight className="w-5 h-5" />
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

// ── FAQ (rich, keyword dense) ─────────────────────────────────────────────────
const FAQS = [
  {
    q: "What are AI voice calling agents and how do they work?",
    a: "AI voice calling agents are autonomous, conversational software programs that place and receive phone calls using natural human language. Powered by real-time ASR (Automatic Speech Recognition), LLM (Large Language Model), and TTS (Text-to-Speech), Clarity Voice agents achieve sub-180ms latency — making them indistinguishable from human agents. Unlike legacy IVR systems, they understand intent, handle interruptions, and execute workflows dynamically.",
  },
  {
    q: "What is the difference between AI voice agents and IVR systems?",
    a: "Traditional IVR systems force callers through rigid press-key menus. AI voice agents like Clarity Voice converse naturally — they understand spoken language, answer complex questions, handle barge-in interruptions, route intelligently, and escalate with warm transfer. AI call automation replaces the frustrating experience of legacy phone trees.",
  },
  {
    q: "Can Clarity Voice handle outbound AI calling at scale?",
    a: "Yes. Clarity Voice's outbound voice AI platform can launch 10,000+ simultaneous outbound calls with smart retry logic for busy lines. Use cases include lead qualification, COD order verification, appointment reminders, payment collections, and reactivation campaigns — all automated without human agents.",
  },
  {
    q: "Is Clarity Voice HIPAA and PCI-DSS compliant?",
    a: "Yes. Clarity Voice implements edge-level PII/PHI data redaction before any log or transcript is stored. We are SOC 2 Type II audited, HIPAA BAA available on enterprise plans, and PCI-DSS compliant. Our compliance logging and audit trails meet GDPR, ISO 27001, and India's DPDP Act requirements.",
  },
  {
    q: "What languages does Clarity Voice AI phone agents support?",
    a: "Clarity Voice supports 70+ languages and regional dialects natively — including English, Hindi, Bengali, Kannada, Malayalam, Gujarati, Marathi, Tamil, Mandarin, Arabic, and more. Native accent support is built into the speech models, requiring no intermediate translation APIs.",
  },
  {
    q: "How is Clarity Voice priced compared to Vapi, Retell AI, or Bland AI?",
    a: "Clarity Voice offers transparent, flat-rate pricing: ₹3.99/minute pay-as-you-go or bundled plans starting at ₹1,799/month. Competitors like Vapi and Retell charge separately for STT, LLM, and TTS providers — which adds up. Our pricing includes everything in one bundled rate with no hidden costs.",
  },
  {
    q: "Can I integrate Clarity Voice with my CRM, Shopify, or HubSpot?",
    a: "Yes. Clarity Voice provides bi-directional CRM integration with Salesforce, HubSpot, Zoho, and Shopify via real-time REST webhooks. Call disposition, lead scores, appointment bookings, and transcripts sync automatically. We also support Twilio SIP trunking for enterprise telephony integration.",
  },
  {
    q: "What is the setup time for deploying an AI voice agent?",
    a: "Less than 10 minutes. Configure your agent's voice, language, and workflow through our no-code dashboard. Upload your knowledge base — FAQs, CRM data, or product docs. Connect a phone number. Launch. No engineering team required. Our white-label AI voice agent option is also available for agencies.",
  },
];

// ── Main Home Page ──────────────────────────────────────────────────────────
export default function Home({ setPage }: HomeProps) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQS.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  return (
    <div className="overflow-hidden" style={{ background: "#FAF8F5" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
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

          {/* Right: latency benchmark panel */}
          <TiltCard className="rounded-3xl p-8 space-y-6">
            <div className="p-8 space-y-6 rounded-3xl"
              style={{
                background: "linear-gradient(145deg, #1B4332 0%, #0D2B20 100%)",
                boxShadow: "0 20px 48px rgba(11,41,26,0.20)",
              }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#34D399] font-mono mb-1">Latency Benchmark</p>
                <h3 className="text-2xl font-extrabold text-white">AI Voice Agent vs Competitors</h3>
              </div>
              {[
                { label: "Clarity Voice — Native Multimodal AI", val: "180ms", pct: 18, color: "#10B981" },
                { label: "Vapi / Retell AI (Stacked API Pipeline)", val: "850ms", pct: 75, color: "#F59E0B" },
                { label: "Bland AI / Bolna (General Voice Bot)", val: "1,200ms", pct: 90, color: "#FB923C" },
                { label: "Legacy IVR / Human Call Centers", val: "45 min", pct: 100, color: "#EF4444" },
              ].map((row, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-white/75">{row.label}</span>
                    <span style={{ color: row.color }} className="font-mono">{row.val}</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: row.color }}
                      initial={{ width: 0 }} whileInView={{ width: `${row.pct}%` }} viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.15 }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-white/35 font-mono">* End-to-end measured from user audio-stop to first AI audio byte</p>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6" style={{ background: "#F0FDF4" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
            <SectionLabel text="Deploy in Under 10 Minutes" />
            <h2 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
              style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
              From Zero to Live AI Voice Agent — 4 Steps
            </h2>
            <p className="text-slate-500 leading-relaxed">
              No code. No call center setup. No engineering team. Build and deploy your AI phone agent in minutes using our no-code voice AI platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { n: "01", title: "Configure Your AI Agent", desc: "Name your agent, pick a voice persona, set language mode, and define the conversation goal — from the guided dashboard.", icon: Bot },
              { n: "02", title: "Upload Knowledge Base", desc: "Paste FAQs, connect Shopify/CRM, or upload PDFs. Your AI phone assistant learns your business instantly via RAG.", icon: Database },
              { n: "03", title: "Connect Phone Number", desc: "Get a dedicated PSTN number or bring your SIP trunk. Inbound and outbound routing configured in one click.", icon: Phone },
              { n: "04", title: "Launch & Monitor", desc: "Go live. Monitor calls in real-time, read transcripts, view AI call analytics, and iterate from the dashboard.", icon: BarChart3 },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative bg-white border border-[#EADEC9] rounded-3xl p-7 space-y-4 overflow-hidden group hover:shadow-lg transition-all"
                >
                  {/* Step number watermark */}
                  <span className="absolute -top-3 -right-2 text-[80px] font-extrabold text-[#059669]/5 leading-none select-none font-mono">
                    {s.n}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-[#D1FAE5] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#059669]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#059669] font-mono mb-1">Step {s.n}</p>
                    <h3 className="text-base font-extrabold text-[#0F172A] mb-2">{s.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
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

      {/* ── SOCIAL PROOF ── */}
      <SocialProofSection />

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

      {/* ── FAQ ── */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <SectionLabel text="FAQ" />
          <h2 className="text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
            Frequently Asked Questions About AI Voice Agents
          </h2>
          <p className="text-slate-500">Everything you need to know about deploying enterprise AI voice calling agents, pricing, compliance, and integrations.</p>
        </div>
        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <motion.div key={i}
              className="bg-white border border-[#EADEC9] rounded-2xl p-7 space-y-3 hover:border-[#059669]/30 hover:shadow-md transition-all"
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}>
              <h3 className="font-extrabold text-[#0F172A] text-base">{faq.q}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <FinalCTA setPage={setPage} />
    </div>
  );
}

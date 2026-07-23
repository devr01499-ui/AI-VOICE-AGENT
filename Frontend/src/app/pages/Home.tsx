import { motion } from "motion/react";
import Hero from "../components/hero/Hero";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import FeatureCapabilityGrid from "../components/showroom/FeatureCapabilityGrid";
import {
  ArrowRight, ShieldCheck, Zap, Bot, CheckCircle2, Lock, Cpu, Globe2,
  PhoneCall, TrendingUp, Star, Clock, Users, Headphones
} from "lucide-react";

type Page = any;

interface HomeProps {
  setPage: (p: Page) => void;
}

// ── Shared divider ──────────────────────────────────────────────────────────
function SectionLabel({ text, color = "green" }: { text: string; color?: "green" | "orange" }) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] px-4 py-1.5 rounded-full font-mono ${color === "green"
        ? "bg-[#D1FAE5] text-[#059669] border border-[#059669]/20"
        : "bg-[#FEF3C7] text-[#EA580C] border border-[#EA580C]/20"
        }`}
    >
      {text}
    </span>
  );
}

// ── Metrics panel ────────────────────────────────────────────────────────────
function MetricCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6">
      <span
        className="text-5xl font-extrabold text-transparent bg-clip-text mb-1"
        style={{ backgroundImage: "linear-gradient(135deg, #059669, #34D399)" }}
      >
        {value}
      </span>
      <span className="text-sm font-bold text-[#0F172A]">{label}</span>
      {sub && <span className="text-xs text-slate-400 mt-0.5">{sub}</span>}
    </div>
  );
}

// ── How It Works steps ──────────────────────────────────────────────────────
function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="flex gap-6 items-start"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-extrabold text-lg shadow-md"
        style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}
      >
        {n}
      </div>
      <div>
        <h3 className="font-extrabold text-[#0F172A] text-lg mb-1">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
      </div>
    </motion.div>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What are enterprise AI voice agents and how do they work?",
    a: "Enterprise AI voice agents are autonomous, conversational software programs that place and receive phone calls in natural human language. Using real-time speech recognition (ASR), large language models (LLM), and neural text-to-speech (TTS), Clarity Voice agents converse with callers under 180ms latency.",
  },
  {
    q: "How does Clarity Voice handle interruptions during a call?",
    a: "Clarity Voice utilizes full-duplex audio processing. If a caller speaks mid-sentence, the AI agent instantly pauses audio, listens, and dynamically adjusts its response without breaking conversation flow.",
  },
  {
    q: "Is Clarity Voice compliant with HIPAA, SOC 2, and PCI-DSS?",
    a: "Yes. Clarity Voice implements edge-based PII/PHI data redaction, scrubbing payment info and health details before storing call logs. We maintain SOC 2 Type II compliance and offer HIPAA Business Associate Agreements.",
  },
  {
    q: "What is the pricing model for Clarity Voice AI calling agents?",
    a: "Clarity Voice offers transparent bundled plans: Startup Plan at ₹1,799/month (500 minutes), Growth Plan at ₹4,999/month (1,500 minutes), and a pay-as-you-go rate of ₹3.99/minute with no hidden fees.",
  },
];

export default function Home({ setPage }: HomeProps) {
  return (
    <div className="overflow-hidden" style={{ background: "#FAF8F5" }}>

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <Hero setPage={setPage} />

      {/* ── SECTION 1: Metrics Band ──────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <motion.div
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            background: "linear-gradient(135deg, #1B4332 0%, #0D2B20 100%)",
            boxShadow: "0 24px 48px rgba(11,41,26,0.20)",
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {[
              { value: "10M+", label: "Calls Handled", sub: "Monthly capacity" },
              { value: "<180ms", label: "Response Time", sub: "Native audio pipeline" },
              { value: "70+", label: "Languages", sub: "Global & regional" },
              { value: "99.9%", label: "Uptime SLA", sub: "Enterprise grade" },
            ].map((m, i) => (
              <div key={i} className="flex flex-col items-center text-center p-8">
                <span className="text-4xl lg:text-5xl font-extrabold text-white leading-none mb-1">{m.value}</span>
                <span className="text-sm font-bold text-[#34D399] mt-1">{m.label}</span>
                <span className="text-xs text-white/40 mt-0.5">{m.sub}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── SECTION 2: About / Architecture ─────────────────────────────────── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <SectionLabel text="Native Multimodal Pipeline" />
            <h2
              className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
              style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
            >
              Built Different — Not Just Another Stacked API
            </h2>
            <p className="text-slate-500 leading-relaxed text-base">
              Most voice AI vendors chain third-party STT → LLM → TTS, introducing 800ms–1.5s pauses. Clarity Voice runs a vertically integrated, direct WebRTC audio pipeline — achieving sub-180ms conversational response at enterprise scale.
            </p>
            <div className="space-y-4 pt-2">
              {[
                { icon: Zap, title: "Sub-180ms End-to-End Latency", desc: "Direct audio streaming bypasses REST overhead entirely" },
                { icon: Globe2, title: "70+ Regional Dialects", desc: "Native speech models — no lossy intermediate text translation" },
                { icon: ShieldCheck, title: "Edge-Level PII Redaction", desc: "PHI, PCI, and personal data scrubbed before any log storage" },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={i}
                  className="flex gap-4 items-start bg-white border border-[#EADEC9] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#059669]/30 transition-all"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#D1FAE5] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#059669]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0F172A] text-sm">{title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Latency visual */}
          <motion.div
            className="rounded-3xl p-8 space-y-6"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: "linear-gradient(145deg, #1B4332 0%, #0D2B20 100%)",
              boxShadow: "0 20px 48px rgba(11,41,26,0.18)",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[#34D399] font-mono">Architecture Benchmark</p>
            <h3 className="text-2xl font-extrabold text-white">Latency Comparison</h3>
            {[
              { label: "Clarity Native Multimodal", val: "180ms", pct: 18, color: "#10B981" },
              { label: "Vapi / Retell (Stacked API)", val: "850ms", pct: 75, color: "#F59E0B" },
              { label: "Legacy Human Call Centers", val: "45 min queue", pct: 100, color: "#EF4444" },
            ].map((row, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-white/80">{row.label}</span>
                  <span style={{ color: row.color }}>{row.val}</span>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: row.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${row.pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: i * 0.15 }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-white/50 font-mono">* Measured end-to-end from user audio stop to first AI audio byte</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 3: How It Works ──────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: "#F0FDF4" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <SectionLabel text="Deploy in Minutes" color="green" />
            <h2
              className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] leading-tight"
              style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
            >
              From Zero to Enterprise<br />Voice Agent in 4 Steps
            </h2>
            <p className="text-slate-500 text-base leading-relaxed max-w-lg">
              No engineering team required. Configure your first AI calling agent from the dashboard, connect your phone number, and go live — in under 10 minutes.
            </p>
            <button
              onClick={() => setPage("how-it-works")}
              className="inline-flex items-center gap-2 font-bold text-white text-sm px-6 py-3 rounded-full transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #059669, #10B981)", boxShadow: "0 6px 20px rgba(5,150,105,0.25)" }}
            >
              View Full Platform Guide <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>

          <div className="space-y-6">
            {[
              { n: "1", title: "Configure Your Agent", body: "Define your agent's name, voice persona, language, and conversational workflow using our guided dashboard — no coding needed." },
              { n: "2", title: "Upload Your Knowledge Base", body: "Paste your FAQ doc, connect your CRM or Shopify store, or upload PDF scripts. The agent learns your business instantly." },
              { n: "3", title: "Connect a Phone Number", body: "Get a dedicated calling number or bring your own (SIP). Inbound and outbound routing configured in one click." },
              { n: "4", title: "Go Live & Monitor", body: "Launch campaigns, monitor live calls, read transcripts, and view analytics from the real-time dashboard. Iterate and improve continuously." },
            ].map((s, i) => (
              <StepCard key={i} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Inbound + Outbound split ──────────────────────────────── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <SectionLabel text="Inbound & Outbound Voice Automation" />
          <h2
            className="text-4xl lg:text-5xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
          >
            Two Directions. One Unified Platform.
          </h2>
          <p className="text-slate-500 leading-relaxed">
            Whether you're receiving customer calls or proactively reaching out, Clarity Voice handles both workflows natively.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inbound card */}
          <motion.div
            className="relative overflow-hidden rounded-3xl p-10 space-y-6"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: "linear-gradient(145deg, #1B4332 0%, #14532D 100%)",
              boxShadow: "0 20px 40px rgba(11,41,26,0.18)",
            }}
          >
            <div className="absolute top-0 right-0 w-48 h-48 opacity-10"
              style={{ background: "radial-gradient(circle, #34D399, transparent)" }} />
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <PhoneCall className="w-7 h-7 text-[#34D399]" />
            </div>
            <h3 className="text-2xl font-extrabold text-white">Inbound AI Receptionist</h3>
            <p className="text-white/70 leading-relaxed text-sm">
              Answer every call on the first ring. Handle FAQs, book appointments, qualify leads, and escalate edge cases to human agents — 24/7 with zero queue.
            </p>
            <ul className="space-y-2.5">
              {["Zero-wait first-ring answering", "CRM & calendar booking integration", "Warm human escalation with summary", "Intent classification & routing"].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-white/80">
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Outbound card */}
          <motion.div
            className="relative overflow-hidden rounded-3xl p-10 space-y-6 bg-white border border-[#EADEC9]"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.06)" }}
          >
            <div
              className="absolute top-0 right-0 w-48 h-48 opacity-8 rounded-full"
              style={{ background: "radial-gradient(circle, #FDE68A, transparent)" }}
            />
            <div className="w-14 h-14 rounded-2xl bg-[#FEF3C7] flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-[#EA580C]" />
            </div>
            <h3 className="text-2xl font-extrabold text-[#0F172A]">Outbound Campaign Engine</h3>
            <p className="text-slate-500 leading-relaxed text-sm">
              Contact thousands of leads within seconds. Verify COD orders, recover abandoned carts, collect EMI payments, and reactivate cold databases with personalized voice calls.
            </p>
            <ul className="space-y-2.5">
              {["3-second speed-to-lead response", "Smart retry for busy lines", "Dynamic disposition & sentiment score", "Batch campaign scheduling"].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-[#334155]">
                  <CheckCircle2 className="w-4 h-4 text-[#EA580C] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {/* Outbound metrics mini-card */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#EADEC9]">
              {[
                { v: "94.2%", l: "Contact rate" },
                { v: "1m 45s", l: "Avg qualify time" },
                { v: "₹6.98", l: "Per qualified lead" },
              ].map((m, i) => (
                <div key={i} className="text-center">
                  <p className="text-lg font-extrabold text-[#059669]">{m.v}</p>
                  <p className="text-[10px] text-slate-400">{m.l}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 5: Industry Showroom ─────────────────────────────────────── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <SectionLabel text="Industry Showroom" color="orange" />
          <h2
            className="text-4xl lg:text-5xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
          >
            Tailored Voice AI for Every Enterprise Sector
          </h2>
          <p className="text-slate-500 leading-relaxed">
            Explore 12 specialized industry verticals with pre-configured workflows, compliance profiles, and custom voice personas.
          </p>
        </div>
        <IndustryShowroomGrid />
      </section>

      {/* ── SECTION 6: Feature Capabilities ─────────────────────────────────── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <SectionLabel text="Platform Capabilities" />
          <h2
            className="text-4xl lg:text-5xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
          >
            12 Enterprise Voice AI Modules
          </h2>
          <p className="text-slate-500 leading-relaxed">
            From low-latency audio streaming to RAG knowledge bases and warm handoffs — inspect the full stack.
          </p>
        </div>
        <FeatureCapabilityGrid />
      </section>

      {/* ── SECTION 7: Compliance & Trust ───────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="relative overflow-hidden rounded-3xl p-12 lg:p-16 text-center space-y-8"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              background: "linear-gradient(145deg, #1B4332 0%, #0D2B20 100%)",
              boxShadow: "0 32px 64px rgba(11,41,26,0.22)",
            }}
          >
            {/* dot pattern */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                borderRadius: "inherit",
              }}
            />
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-[#34D399]" />
              </div>
              <h2
                className="text-3xl lg:text-5xl font-extrabold text-white leading-tight"
                style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
              >
                Enterprise-Grade Security & Compliance
              </h2>
              <p className="text-white/60 max-w-2xl mx-auto text-base leading-relaxed">
                Clarity Voice implements edge-based PII/PHI data redaction, scrubbing payment info and health credentials before any log storage. We are SOC 2 Type II audited and offer HIPAA BAA on enterprise plans.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {["🔒 SOC 2 TYPE II", "🏥 HIPAA BAA READY", "🛡️ ISO 27001", "⚖️ GDPR & DPDP ACT", "💳 PCI-DSS COMPLIANT"].map((badge, i) => (
                  <span
                    key={i}
                    className="text-xs font-bold font-mono px-4 py-2 rounded-full"
                    style={{ background: "rgba(255,255,255,0.1)", color: "#A7F3D0", border: "1px solid rgba(167,243,208,0.2)" }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 8: FAQ ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <SectionLabel text="FAQ" />
          <h2
            className="text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
          >
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500">Everything you need to know about deploying enterprise AI voice agents.</p>
        </div>
        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              className="bg-white border border-[#EADEC9] rounded-2xl p-7 space-y-3 hover:border-[#059669]/30 hover:shadow-md transition-all"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
            >
              <h3 className="font-extrabold text-[#0F172A] text-base">{faq.q}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── SECTION 9: CTA ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="relative overflow-hidden rounded-[40px] p-12 lg:p-20 text-center"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            style={{
              background: "#FAF8F5",
              border: "1px solid #EADEC9",
              boxShadow: "0 16px 48px rgba(0,0,0,0.05)",
            }}
          >
            {/* decorative blobs */}
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-30 -translate-x-1/2 -translate-y-1/2"
              style={{ background: "radial-gradient(circle, #D1FAE5, transparent)" }} />
            <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-20 translate-x-1/2 translate-y-1/2"
              style={{ background: "radial-gradient(circle, #FDE68A, transparent)" }} />

            <div className="relative z-10 space-y-6">
              <h2
                className="text-4xl lg:text-6xl font-extrabold text-[#0F172A] leading-tight"
                style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
              >
                Start Transforming Your<br />
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #059669, #34D399)" }}>
                  Phone Calls Today
                </span>
              </h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">
                Deploy human-like AI voice agents in under 10 minutes. No setup fees. No minimum contract. Cancel any time.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => setPage("dashboard")}
                  className="inline-flex items-center gap-2 font-bold text-lg text-white px-10 py-4 rounded-full transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
                    boxShadow: "0 8px 24px rgba(5,150,105,0.3)",
                  }}
                >
                  Build Your First Voice Agent (Free)
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage("pricing")}
                  className="inline-flex items-center gap-2 font-semibold text-base text-[#0F172A] bg-white border border-[#EADEC9] px-8 py-4 rounded-full hover:shadow-md transition-all"
                >
                  View Pricing Plans
                </button>
              </div>
              <p className="text-xs text-slate-400">Trusted by 500+ enterprises across 12 industries</p>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}

import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { 
  Zap, Cpu, Database, ShieldCheck, ArrowRight, Activity, 
  Layers, CheckCircle2, ChevronRight, Sparkles, RefreshCw, Lock, Terminal
} from "lucide-react";
import FeatureCapabilityGrid from "../components/showroom/FeatureCapabilityGrid";

type Page = any;

interface HowItWorksProps {
  setPage: (p: Page) => void;
}

// ── Interactive Pipeline Visualizer ──────────────────────────────────────────
function ArchitecturePipelineCanvas() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const pipelineSteps = [
    {
      id: "intake",
      stepNum: "01",
      name: "API & Webhook Trigger",
      badge: "Inbound / Outbound",
      desc: "Call jobs trigger automatically within < 50ms of events (e.g., Shopify COD checkout, EHR appointment request, web form submission).",
      metrics: "Sub-50ms Event Queueing",
      details: ["REST Webhooks & SDK Triggers", "E.164 Number Pre-Validation", "Automatic Retry & Throttling"]
    },
    {
      id: "telephony",
      stepNum: "02",
      name: "WebRTC Audio Pipeline",
      badge: "Sub-180ms Latency",
      desc: "Zero-copy UDP WebRTC stream connects telecom carriers directly to neural inference workers, completely bypassing HTTP REST proxy overhead.",
      metrics: "< 180ms Roundtrip Latency",
      details: ["UDP Audio Buffer Streaming", "Full-Duplex Barge-In Support", "Custom SIP Trunk Integration"]
    },
    {
      id: "reasoning",
      stepNum: "03",
      name: "Context & Tool Execution",
      badge: "Real-Time RAG & APIs",
      desc: "The agent checks vector knowledge bases for facts, evaluates prompt guardrails, and executes live tools (e.g., inventory lookup or CRM write) mid-sentence.",
      metrics: "100% Hallucination Guardrails",
      details: ["RAG Micro-Vector Lookups", "Dynamic Function Calling", "Multi-Turn Context Memory"]
    },
    {
      id: "disposition",
      stepNum: "04",
      name: "Edge Scrubbing & Sync",
      badge: "HIPAA & SOC 2",
      desc: "The moment the call ends, audio transcripts, sentiment scores, and outcome tags are PII-scrubbed at the edge and pushed to your database.",
      metrics: "Instant Webhook Payload",
      details: ["Edge PII Redaction", "Sentiment & Intent Scoring", "CRM & Webhook Sync"]
    }
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % pipelineSteps.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isPlaying, pipelineSteps.length]);

  const current = pipelineSteps[activeStep];

  return (
    <div className="bg-[#0F172A] text-white rounded-3xl p-6 md:p-10 shadow-2xl border border-slate-800 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#059669]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs font-bold tracking-wider text-emerald-400 uppercase">
            LIVE MULTIMODAL PIPELINE ENGINE
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPlaying ? "animate-spin" : ""}`} />
            {isPlaying ? "Auto-Advancing" : "Paused"}
          </button>
          <span className="px-3 py-1.5 rounded-lg text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-bold">
            STATUS: OPERATIONAL (178ms AVG)
          </span>
        </div>
      </div>

      {/* Step Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-8">
        {pipelineSteps.map((s, idx) => {
          const isActive = activeStep === idx;
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveStep(idx);
                setIsPlaying(false);
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                isActive
                  ? "bg-emerald-950/80 border-emerald-500 text-white shadow-[0_0_20px_rgba(5,150,105,0.25)]"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-emerald-400">{s.stepNum}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isActive ? "bg-emerald-500 text-black font-bold" : "bg-slate-800 text-slate-400"}`}>
                  {s.badge}
                </span>
              </div>
              <p className="font-bold text-sm text-white truncate">{s.name}</p>
              {isActive && (
                <motion.div
                  layoutId="activeBar"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Inspector Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center"
        >
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-sm">
                {current.stepNum}
              </span>
              <h3 className="text-xl md:text-2xl font-bold text-white">{current.name}</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed font-plus-jakarta">
              {current.desc}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {current.details.map((d) => (
                <div key={d} className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Live Simulation Box */}
          <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 flex flex-col justify-between h-full space-y-4">
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-2">
                TELEMETRY METRIC
              </span>
              <p className="font-mono text-xl font-bold text-emerald-400">{current.metrics}</p>
            </div>
            
            {/* Live Audio Wave visualizer */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>AUDIO STREAM</span>
                <span className="text-emerald-400">FULL DUPLEX</span>
              </div>
              <div className="flex items-center gap-1 h-10 bg-slate-900 rounded-xl px-4 justify-between overflow-hidden">
                {Array.from({ length: 24 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full"
                    animate={{ height: ["15%", `${20 + Math.sin(i + activeStep) * 70}%`, "15%"] }}
                    transition={{ duration: 0.8 + (i % 3) * 0.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))}
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-900 flex justify-between">
              <span>SECURITY: PII REDACTED</span>
              <span>ENCRYPTION: TLS 1.3</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function HowItWorks({ setPage }: HowItWorksProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does Claritiy Voice achieve sub-180ms response latency?",
      a: "Claritiy Voice bypasses traditional HTTP API REST chains. Audio streams travel over zero-copy UDP WebRTC connections directly from telecom gateways to neural inference models. Speech recognition, reasoning context, and voice generation run in an integrated memory buffer without intermediary network hops."
    },
    {
      q: "How does Claritiy Voice prevent AI hallucinations on customer phone calls?",
      a: "Every conversation is bound to strict system prompts and high-speed Retrieval-Augmented Generation (RAG) micro-vectors. If a customer asks a question outside your knowledge base, the agent relies on pre-programmed safety fallback policies rather than guessing."
    },
    {
      q: "Can Claritiy Voice handle mid-sentence interruptions (barge-in)?",
      a: "Yes. Our full-duplex DSP audio stack monitors incoming voice activity continuously. When the caller speaks while the agent is generating audio, the system halts playback within 20 milliseconds and processes the caller's new utterance immediately."
    },
    {
      q: "What CRM systems and webhooks does Claritiy Voice integrate with?",
      a: "Claritiy Voice provides native integrations and REST webhooks for Shopify, HubSpot, Salesforce, Zoho, Epic EHR, and custom databases. Call summaries, transcripts, and disposition codes post back automatically the instant a call terminates."
    },
    {
      q: "How are patient health records (HIPAA) and sensitive data secured?",
      a: "All raw audio streams undergo real-time PII and PHI redaction at the edge before transcription logs are saved. All data in transit is encrypted with TLS 1.3 and SRTP, and resting data is AES-256 encrypted."
    }
  ];

  return (
    <div className="space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen">
      
      {/* Hero Header */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          NATIVE MULTIMODAL SPEECH ARCHITECTURE
        </div>
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
        >
          How Claritiy Voice Powers Sub-180ms Conversational AI
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-600 text-lg md:text-xl max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          Discover the engineering behind our zero-copy WebRTC audio pipeline, real-time function execution, RAG knowledge bases, and enterprise SIP telephony.
        </motion.p>
      </section>

      {/* Interactive Architecture Pipeline Visualizer */}
      <section className="px-6 max-w-7xl mx-auto">
        <ArchitecturePipelineCanvas />
      </section>

      {/* 4 Core Pillars Grid */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest">
            FOUR ARCHITECTURAL PILLARS
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Engineered for Production Telephony
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Cpu,
              num: "01",
              title: "Sub-180ms Latency Engine",
              desc: "Zero-copy UDP WebRTC audio streaming bypasses chained REST API bottlenecks to match natural human response speeds."
            },
            {
              icon: Terminal,
              num: "02",
              title: "Prompt & Function Calling",
              desc: "The agent executes dynamic tools in real time — checking inventory, looking up CRM records, or booking appointments during live calls."
            },
            {
              icon: Database,
              num: "03",
              title: "Vector Knowledge Bases",
              desc: "RAG micro-vector lookups inject exact product specs, FAQs, or medical protocols into context within milliseconds without hallucinations."
            },
            {
              icon: ShieldCheck,
              num: "04",
              title: "Edge PII & HIPAA Scrubbing",
              desc: "Transcripts and recordings are automatically scrubbed for credit card numbers, SSNs, and medical records before storage."
            }
          ].map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white border border-[#EADEC9] rounded-3xl p-8 hover:shadow-xl hover:border-emerald-500/40 transition-all group relative"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="font-mono text-2xl font-bold text-slate-300 group-hover:text-emerald-500 transition-colors">
                    {pillar.num}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {pillar.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed font-plus-jakarta">
                  {pillar.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Deep-Dive Technical Modules */}
      <section className="px-6 max-w-7xl mx-auto space-y-12">
        
        {/* Module 1 */}
        <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-14 shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-3 text-emerald-600 font-mono text-xs font-bold uppercase tracking-wider">
              <Activity className="w-4 h-4" /> MODULE 1: ZERO-COPY AUDIO PIPELINE
            </div>
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Why Low Latency Matters for Enterprise Telephony
            </h2>
            <p className="text-slate-600 leading-relaxed font-plus-jakarta">
              Human conversation relies on tight response windows (~200ms). When legacy voice bots take 1 to 2 seconds to reply, customers experience awkward pauses, talk over each other, and drop off early.
            </p>
            <p className="text-slate-600 leading-relaxed font-plus-jakarta">
              Claritiy Voice processes raw audio packets directly through neural speech engines, achieving <strong>sub-180ms response times</strong>. Full-duplex DSP algorithms continuously listen during agent playback, allowing immediate barge-in whenever a customer interrupts.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 font-mono text-xs font-bold text-slate-700">
              <span className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-700">✓ WebRTC Zero-Copy</span>
              <span className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-700">✓ Full-Duplex Barge-In</span>
              <span className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-700">✓ UDP Packet Streaming</span>
            </div>
          </div>
          <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-6 font-mono text-xs space-y-4 border border-slate-800">
            <div className="text-emerald-400 font-bold border-b border-slate-800 pb-2">
              // TELEPHONY BENCHMARK DATA
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Carrier SIP Handshake:</span>
                <span className="text-white">32 ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Multimodal Neural Inference:</span>
                <span className="text-emerald-400 font-bold">114 ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Audio Buffer Egress:</span>
                <span className="text-white">28 ms</span>
              </div>
              <div className="border-t border-slate-800 pt-3 flex justify-between font-bold text-sm">
                <span>Total Latency:</span>
                <span className="text-emerald-400">174 ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 2 */}
        <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-14 shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 lg:order-1 order-2 bg-slate-900 text-white rounded-2xl p-6 font-mono text-xs space-y-4 border border-slate-800">
            <div className="text-amber-400 font-bold border-b border-slate-800 pb-2">
              // FUNCTION CALLING LOG SCHEMA
            </div>
            <pre className="text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`{
  "function": "verify_cod_order",
  "parameters": {
    "order_id": "ORD-98421",
    "pincode": "400001",
    "landmark": "Near Metro Gate 2"
  },
  "status": "EXECUTED",
  "execution_time_ms": 42
}`}
            </pre>
          </div>
          <div className="lg:col-span-7 lg:order-2 order-1 space-y-6">
            <div className="flex items-center gap-3 text-amber-600 font-mono text-xs font-bold uppercase tracking-wider">
              <Layers className="w-4 h-4" /> MODULE 2: DYNAMIC TOOL & FUNCTION EXECUTION
            </div>
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Real-Time Backend Actions During Live Calls
            </h2>
            <p className="text-slate-600 leading-relaxed font-plus-jakarta">
              Static decision-tree bots fail when callers stray from scripted paths. Claritiy Voice uses prompt-driven intent evaluation paired with real-time tool calling.
            </p>
            <p className="text-slate-600 leading-relaxed font-plus-jakarta">
              When a customer says, <em>"Can you change my delivery date to Friday and verify my landmark?"</em>, the voice AI agent dynamically executes a background function call, updates your Shopify or custom CRM, and confirms the updated status to the caller in real time.
            </p>
          </div>
        </div>

      </section>

      {/* Feature Capability Grid Section */}
      <section className="px-6 max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest">
            FEATURE MATRIX
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            12 Enterprise Capabilities Out Of The Box
          </h2>
        </div>
        <FeatureCapabilityGrid />
      </section>

      {/* FAQ Section */}
      <section className="px-6 max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Technical Architecture & Setup FAQ
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={faq.q}
                className="bg-white border border-[#EADEC9] rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-6 text-left font-bold text-slate-900 flex justify-between items-center gap-4 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-base">{faq.q}</span>
                  <ChevronRight className={`w-5 h-5 text-emerald-600 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-6 pb-6 text-slate-600 text-sm leading-relaxed font-plus-jakarta border-t border-slate-100 pt-4"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 max-w-5xl mx-auto">
        <div className="bg-[#0F172A] text-white rounded-3xl p-10 md:p-16 text-center space-y-6 relative overflow-hidden border border-slate-800">
          <h2 className="text-3xl md:text-5xl font-extrabold" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Experience Claritiy Voice Live
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto text-base leading-relaxed font-plus-jakarta">
            Test our sub-180ms voice AI agent in the sandbox right now. Build, configure, and launch outbound campaigns in minutes.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => setPage("dashboard")}
              className="btn-primary py-4 px-8 text-base bg-emerald-500 hover:bg-emerald-400 text-black font-bold flex items-center justify-center gap-2"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPage("pricing")}
              className="py-4 px-8 text-base bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-full transition-colors"
            >
              View Pricing Plans
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}


import { motion, AnimatePresence } from "motion/react";
import React, { useState, useEffect } from "react";
import { 
  Zap, Cpu, Database, ShieldCheck, ArrowRight, Activity, 
  Layers, CheckCircle2, ChevronRight, Sparkles, RefreshCw, Lock, Terminal,
  Sliders, Code2, Headphones, Radio, Network, Server, FileCode, Check,
  Volume2, PhoneCall, Mic, MessageSquare, Clock
} from "lucide-react";

type Page = any;

interface HowItWorksProps {
  setPage: (p: Page) => void;
}

// ── SVG Geometric Blueprint Background Accent ──────────────────────────────────
function GeometricGridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="grid-blueprint" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="2,2" />
            <circle cx="60" cy="0" r="1.5" fill="#059669" opacity="0.6" />
            <circle cx="0" cy="60" r="1.5" fill="#059669" opacity="0.6" />
          </pattern>
          <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#64748B" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-blueprint)" />
        <rect width="100%" height="100%" fill="url(#grid-dots)" />
      </svg>
    </div>
  );
}

// ── Interactive Pipeline Visualizer Component ──────────────────────────────────
function ArchitecturePipelineCanvas() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<"outcome" | "protocol">("outcome");

  const pipelineSteps = [
    {
      id: "intake",
      stepNum: "01",
      name: "API & Webhook Trigger",
      badge: "Sub-50ms Queue",
      humanizedSummary: "When a customer completes checkout on Shopify or books a clinic consultation online, your software instantly triggers Claritiy Voice to place or route the call within seconds.",
      techSummary: "Incoming REST webhooks or backend SDK events clear schema validation, standardize phone numbers into E.164 formats, and dispatch telephony workers with <50ms queue latency.",
      keyMetrics: "< 50ms Trigger Latency",
      businessHighlights: [
        "Instant outbound calling within 60s of checkout or web inquiry",
        "E.164 phone number formatting and regional route assignment",
        "Automated exponential backoff retries for busy lines"
      ],
      codeSnippet: `// Outbound Call Ingress Webhook
POST /api/v2/calls/outbound
Headers: { "Authorization": "Bearer cv_live_99...", "Content-Type": "application/json" }
Body: {
  "agentId": "ag_8921_cod",
  "phoneNumber": "+919876543210",
  "variables": { "orderId": "ORD-9912", "amount": 2499 }
}`
    },
    {
      id: "telephony",
      stepNum: "02",
      name: "WebRTC Zero-Copy Audio",
      badge: "Sub-180ms Latency",
      humanizedSummary: "The caller hears a fluid, warm human voice with zero awkward silence. If the caller interrupts mid-sentence, the AI pauses in 20 milliseconds to listen with empathy.",
      techSummary: "Full-duplex zero-copy UDP WebRTC streams bypass slow HTTP REST proxies. Telecom SIP trunks connect straight to neural speech engines with 20ms Voice Activity Detection (VAD) hardware interrupts.",
      keyMetrics: "< 175ms Roundtrip Turn-Taking",
      businessHighlights: [
        "Indistinguishable from a polite human agent",
        "Fluid barge-in interruption handling mid-sentence",
        "Native noise suppression for noisy outdoor caller environments"
      ],
      codeSnippet: `// WebRTC Audio Stream Specification
Protocol: SRTP / UDP (RFC 3711)
Codec: audio/x-l16; rate=16000 (16kHz PCM L16)
Jitter Buffer: Adaptive 8ms - 15ms
VAD Threshold: -42dB (20ms speech window)`
    },
    {
      id: "reasoning",
      stepNum: "03",
      name: "Multimodal RAG & Function Calling",
      badge: "100% Guardrails",
      humanizedSummary: "The agent adheres strictly to your company guidelines, checks appointment availability or product stock in real time, and never hallucinates made-up facts.",
      techSummary: "The engine queries localized HNSW vector databases in <15ms and executes dynamic JSON function schemas directly on your backend systems mid-call.",
      keyMetrics: "15ms Micro-Vector RAG Retrieval",
      businessHighlights: [
        "Reads and writes directly to Shopify, Epic EHR, or CRM",
        "Strict prompt boundaries eliminate hallucinations",
        "Multi-turn context retention across long conversations"
      ],
      codeSnippet: `// Real-Time Tool Execution Log
POST /api/v2/integrations/crm/confirm-address
{
  "function": "confirm_delivery_address",
  "parameters": { "orderId": "ORD-9912", "landmark": "Near Gate 2" },
  "execution_time_ms": 38,
  "status": "SUCCESS"
}`
    },
    {
      id: "disposition",
      stepNum: "04",
      name: "Edge Scrubbing & Sync",
      badge: "DPDP & MSME Compliant",
      humanizedSummary: "The moment the call ends, your team receives a structured summary, sentiment tag, and updated order status in your dashboard, CRM, and SMS alerts.",
      techSummary: "Edge telemetry redacts PII/PHI pattern data before saving audit transcripts. Signed HMAC webhooks post structured disposition payloads to your server instantly.",
      keyMetrics: "Instant Signed Webhook Dispatch",
      businessHighlights: [
        "Structured call disposition (Confirmed, Rescheduled, Escalated)",
        "Automated edge PII redaction for phone, card, and personal data",
        "Immediate sync to your database, Slack, and email"
      ],
      codeSnippet: `// Signed Post-Call Disposition Webhook
POST /webhooks/call-disposition
Headers: { "x-signature-sha256": "hmac_8a92..." }
Body: {
  "callId": "call_9812",
  "outcome": "CONFIRMED",
  "sentiment": "POSITIVE",
  "durationSeconds": 84,
  "transcript": "Buyer verified delivery [REDACTED_ADDRESS]."
}`
    }
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % pipelineSteps.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isPlaying, pipelineSteps.length]);

  const current = pipelineSteps[activeStep];

  return (
    <div className="bg-[#0B132B] text-white rounded-3xl p-6 md:p-10 shadow-2xl border border-slate-800 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_#34d399]" />
          <span className="font-mono text-xs font-bold tracking-wider text-emerald-400 uppercase">
            LIVE MULTIMODAL PIPELINE ENGINE • STAGE {current.stepNum} OF 04
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors flex items-center gap-2 border border-slate-700/60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPlaying ? "animate-spin text-emerald-400" : ""}`} />
            {isPlaying ? "Auto-Advancing" : "Paused"}
          </button>
        </div>
      </div>

      {/* 4 Steps Nav Selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-8 relative z-10">
        {pipelineSteps.map((s, idx) => {
          const isActive = idx === activeStep;
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveStep(idx);
                setIsPlaying(false);
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                isActive
                  ? "bg-emerald-950/90 border-emerald-500 text-white shadow-[0_0_25px_rgba(5,150,105,0.3)]"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-emerald-400">{s.stepNum}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isActive ? "bg-emerald-400 text-black font-bold" : "bg-slate-800 text-slate-400"}`}>
                  {s.badge}
                </span>
              </div>
              <p className="font-bold text-sm text-white truncate">{s.name}</p>
              {isActive && (
                <motion.div
                  layoutId="activePipelineBar"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Stage Inspector Canvas */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10"
        >
          {/* Left Column: Humanized Context & Details */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-mono font-bold text-sm">
                {current.stepNum}
              </span>
              <h3 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {current.name}
              </h3>
            </div>
            
            <p className="text-slate-300 text-sm md:text-base leading-relaxed font-plus-jakarta">
              {current.humanizedSummary}
            </p>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-400">
              <span className="text-emerald-400 font-bold block mb-1">UNDER THE HOOD:</span>
              {current.techSummary}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {current.businessHighlights.map((hl, i) => (
                <div key={i} className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 font-sans">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">{hl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Interactive Inspector (Outcome vs Protocol) */}
          <div className="lg:col-span-5 bg-slate-950 rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setInspectorTab("outcome")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    inspectorTab === "outcome"
                      ? "bg-emerald-500 text-black shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Key Impact
                </button>
                <button
                  onClick={() => setInspectorTab("protocol")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    inspectorTab === "protocol"
                      ? "bg-emerald-500 text-black shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Event Payload
                </button>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                {current.badge}
              </span>
            </div>

            {inspectorTab === "outcome" ? (
              <div className="space-y-4 py-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    BENCHMARK PERFORMANCE
                  </span>
                  <p className="font-mono text-2xl font-extrabold text-emerald-400">{current.keyMetrics}</p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-plus-jakarta">
                  Tested and verified on high-density telecom trunks with zero audio packet loss and sub-20ms interrupt response times.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <pre className="text-slate-300 font-mono text-[11px] bg-slate-900 p-3 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed max-h-48">
                  {current.codeSnippet}
                </pre>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>STATUS: OPERATIONAL</span>
              <span className="text-emerald-400">STAGE READY</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────────
export default function HowItWorks({ setPage }: HowItWorksProps) {
  const threeSteps = [
    {
      step: "01",
      icon: Mic,
      title: "1. The Caller Speaks",
      desc: "The caller speaks naturally in their native language or regional dialect. Our acoustic DSP suppresses outdoor background noise, traffic, and echoes in real time."
    },
    {
      step: "02",
      icon: Cpu,
      title: "2. The AI Thinks & Checks",
      desc: "In under 85ms, the agent cross-references your company rules, available calendar slots, or order details. It formulates an accurate answer without hallucination."
    },
    {
      step: "03",
      icon: Headphones,
      title: "3. The AI Responds Naturally",
      desc: "The agent replies in a warm human voice with natural pauses. If the caller interrupts mid-sentence, the AI immediately halts speech and listens politely."
    }
  ];

  const latencyBreakdown = [
    { phase: "Telecom Carrier SIP Handshake", target: "32 ms", tech: "G.711 / SRTP transport setup via Twilio, Exotel, or Plivo carrier trunks." },
    { phase: "Acoustic Noise Filter & VAD", target: "15 ms", tech: "Dual-microphone noise suppression and 20ms voice activity windowing." },
    { phase: "Neural Multimodal Audio Inference", target: "85 ms", tech: "Gemini Live native audio streaming pipeline with zero-copy memory buffers." },
    { phase: "RAG Micro-Vector & Tool Calling", target: "14 ms", tech: "HNSW vector search in SQLite/Prisma with dynamic JSON function calling." },
    { phase: "Audio Buffer Packet Egress", target: "28 ms", tech: "16kHz PCM L16 streaming packet egress over UDP zero-copy transport." }
  ];

  return (
    <div className="space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen relative font-plus-jakarta">
      <GeometricGridBackground />
      
      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          FULL-DUPLEX REAL-TIME VOICE ARCHITECTURE
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
        >
          How Claritiy Voice Achieves Sub-180ms Conversational Latency
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-600 text-lg md:text-xl max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          Experience how our unified zero-copy WebRTC pipeline eliminates legacy phone trees and transforms complex business phone calls into fluid, human conversations.
        </motion.p>
      </section>

      {/* ── Interactive Architecture Pipeline Visualizer ────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <ArchitecturePipelineCanvas />
      </section>

      {/* ── 3-Step Simple Conversational Journey ─────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-12 shadow-xl space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest">
              THE CALLER EXPERIENCE
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              How a Live Phone Call Flows from Start to Finish
            </h2>
            <p className="text-slate-600 text-sm font-plus-jakarta">
              No robotic touchtone menus or robotic delay. Here is how your customers experience Claritiy Voice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
            {threeSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 hover:shadow-lg transition-all">
                  <div className="flex justify-between items-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-bold shadow-sm">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-mono text-2xl font-bold text-slate-300">{step.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    {step.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed font-plus-jakarta">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Latency Budget & Protocol Telemetry ──────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              TELEMETRY BENCHMARK AUDIT
            </span>
            <h2 className="text-3xl font-extrabold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Sub-180ms Latency Budget & Audio Pipeline Specs
            </h2>
            <p className="text-slate-400 text-sm font-mono">
              Total roundtrip latency budget measured from caller utterance to synthesized audio playback.
            </p>
          </div>

          <div className="space-y-3.5 pt-2 max-w-4xl mx-auto">
            {latencyBreakdown.map((item, i) => (
              <div key={i} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono shadow-sm">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> {item.phase}
                  </span>
                  <p className="text-xs text-slate-400 font-sans">{item.tech}</p>
                </div>
                <div className="px-4 py-2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl font-bold text-sm text-right whitespace-nowrap">
                  {item.target}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl max-w-4xl mx-auto text-center font-mono text-xs text-emerald-300">
            TOTAL COMBINED BUDGET: 174ms (Bypasses traditional 1,200ms chained REST API lag)
          </div>
        </div>
      </section>

      {/* ── 4 Core Architectural Pillars ─────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
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
              title: "Edge PII Redaction",
              desc: "Transcripts and recordings are automatically scrubbed for sensitive numbers and personal identifiers before storage."
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
                <div className="flex justify-between items-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-300">{pillar.num}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {pillar.title}
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed font-plus-jakarta">
                  {pillar.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Bottom Callout ──────────────────────────────────────────────── */}
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-[#0B132B] text-white rounded-3xl p-10 md:p-16 text-center space-y-6 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute -left-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-3xl md:text-5xl font-extrabold" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Experience Sub-180ms Voice in Action
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto text-base font-plus-jakarta">
            Launch our interactive sandbox in your browser and test voice barge-in with your microphone now.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button
              onClick={() => setPage("dashboard")}
              className="py-4 px-8 text-base bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl inline-flex items-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              Test Live in Sandbox <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPage("solutions")}
              className="py-4 px-8 text-base bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl inline-flex items-center gap-2 transition-all border border-slate-700 cursor-pointer"
            >
              Explore Templates
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

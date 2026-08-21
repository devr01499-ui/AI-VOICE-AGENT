import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { 
  Zap, Cpu, Database, ShieldCheck, ArrowRight, Activity, 
  Layers, CheckCircle2, ChevronRight, Sparkles, RefreshCw, Lock, Terminal,
  Sliders, Eye, Code2, Headphones, Radio, Network, Server, FileCode, Check
} from "lucide-react";
import FeatureCapabilityGrid from "../components/showroom/FeatureCapabilityGrid";

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

// ── Interactive Pipeline Visualizer ──────────────────────────────────────────
function ArchitecturePipelineCanvas({ viewMode }: { viewMode: "non-tech" | "tech" }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const pipelineSteps = [
    {
      id: "intake",
      stepNum: "01",
      name: "API & Webhook Trigger",
      badge: "Sub-50ms Queue",
      nonTechDesc: "When a customer places a Cash on Delivery order on Shopify or books an appointment online, your system instantly sends a notification to Claritiy Voice to start a call within seconds.",
      techDesc: "Incoming REST webhooks or SDK events pass through edge payload validation, generating an E.164 normalized session identifier and queueing worker execution within < 50ms.",
      metrics: "Sub-50ms Trigger Queue",
      nonTechDetails: [
        "Automatic call trigger on order/booking",
        "Validates buyer phone number format",
        "Retries automatically if caller line is busy"
      ],
      techDetails: [
        "REST Webhook & Node/Python SDK Emitters",
        "E.164 Phone Format Standardization",
        "Exponential Backoff Retry Worker Queue"
      ],
      codeSnippet: `// Event Intake Webhook Payload
POST /api/v2/calls/outbound
Headers: { "x-api-key": "cv_live_99...", "Content-Type": "application/json" }
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
      nonTechDesc: "The caller hears a natural human voice instantaneously with zero lag or awkward silence. If the customer interrupts mid-sentence, the AI stops talking immediately to listen.",
      techDesc: "Full-duplex zero-copy UDP WebRTC streams bypass HTTP REST proxy overhead. Carrier SIP trunks connect straight to neural speech engines with 20ms VAD barge-in interception.",
      metrics: "< 175ms Roundtrip Latency",
      nonTechDetails: [
        "Instant human-like voice responses",
        "Listens while speaking (barge-in capability)",
        "Handles noisy background phone environments"
      ],
      techDetails: [
        "UDP RTP/SRTP Buffer Audio Streaming",
        "Full-Duplex VAD Signal Interruption",
        "Direct Carrier SIP Trunking Gateway"
      ],
      codeSnippet: `// WebRTC Audio Stream Spec
Protocol: SRTP / UDP (RFC 3711)
Codec: audio/x-l16; rate=16000 (16kHz PCM)
Jitter Buffer: Adaptive 8ms - 15ms
VAD Threshold: -42dB (20ms speech window)`
    },
    {
      id: "reasoning",
      stepNum: "03",
      name: "Multimodal RAG & Function Calling",
      badge: "100% Guardrails",
      nonTechDesc: "The AI agent checks your business guidelines, answers exact questions about products or appointments, and updates your software during the call.",
      techDesc: "Multimodal LLM reasoning executes dynamic JSON tool calls mid-dialogue, querying RAG micro-vector knowledge bases (<15ms HNSW vector lookup) with zero hallucinations.",
      metrics: "100% Guardrail Compliance",
      nonTechDetails: [
        "Answers exact business FAQs accurately",
        "Updates CRM/orders live during the call",
        "Never guesses or makes up fake facts"
      ],
      techDetails: [
        "HNSW Vector Knowledge Base Indexing",
        "Dynamic JSON Function Schema Execution",
        "Strict System Prompt Safety Boundary"
      ],
      codeSnippet: `// Live Function Execution Log
{
  "function": "confirm_delivery_address",
  "params": { "orderId": "ORD-9912", "landmark": "Near Gate 2" },
  "execution_time_ms": 38,
  "status": "SUCCESS"
}`
    },
    {
      id: "disposition",
      stepNum: "04",
      name: "Edge Scrubbing & Sync",
      badge: "HIPAA & SOC 2",
      nonTechDesc: "The instant the call ends, your team gets a text summary, sentiment report, and confirmation status in your dashboard and email.",
      techDesc: "Post-call telemetry triggers edge-based PII/PHI redaction algorithms, calculating sentiment scores and posting unified JSON webhooks back to your core database.",
      metrics: "Instant Webhook Sync",
      nonTechDetails: [
        "Instant call summaries & customer mood tag",
        "Protects sensitive credit card & personal info",
        "Updates your database automatically"
      ],
      techDetails: [
        "Edge Regex PII / PHI Redaction Engine",
        "NLP Sentiment & Intent Scoring",
        "Webhook Payload Post-Back with HMAC Sign"
      ],
      codeSnippet: `// Edge Redacted Post-Call Webhook
POST /webhooks/call-disposition
Payload: {
  "callId": "call_9812",
  "outcome": "CONFIRMED",
  "sentiment": "POSITIVE",
  "transcript": "Customer confirmed address [REDACTED_ADDRESS]."
}`
    }
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % pipelineSteps.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying, pipelineSteps.length]);

  const current = pipelineSteps[activeStep];

  return (
    <div className="bg-[#0B132B] text-white rounded-3xl p-6 md:p-10 shadow-2xl border border-slate-800 relative overflow-hidden">
      {/* Ambient glowing geometric highlights */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_#34d399]" />
          <span className="font-mono text-xs font-bold tracking-wider text-emerald-400 uppercase">
            LIVE MULTIMODAL PIPELINE ENGINE • {viewMode === "non-tech" ? "BUSINESS OVERVIEW" : "ENGINEERING SPECIFICATIONS"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors flex items-center gap-2 border border-slate-700/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPlaying ? "animate-spin text-emerald-400" : ""}`} />
            {isPlaying ? "Auto-Advancing" : "Paused"}
          </button>
          <span className="px-3.5 py-1.5 rounded-xl text-xs font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-bold">
            AVERAGE LATENCY: 174ms
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
          key={`${current.id}-${viewMode}`}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          {/* Main Description Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-mono font-bold text-sm">
                {current.stepNum}
              </span>
              <h3 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {current.name}
              </h3>
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed font-plus-jakarta">
              {viewMode === "non-tech" ? current.nonTechDesc : current.techDesc}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {(viewMode === "non-tech" ? current.nonTechDetails : current.techDetails).map((d) => (
                <div key={d} className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Simulation & Code/Telemetry Inspector */}
          <div className="lg:col-span-5 bg-slate-950 rounded-2xl p-6 border border-slate-800 flex flex-col justify-between h-full space-y-4">
            {viewMode === "tech" ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" /> TECHNICAL SCHEMA
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">JSON / PROTOCOL</span>
                </div>
                <pre className="text-slate-300 font-mono text-[11px] bg-slate-900 p-3 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed max-h-40">
                  {current.codeSnippet}
                </pre>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    KEY VALUE DELIVERED
                  </span>
                  <p className="font-mono text-xl font-bold text-emerald-400">{current.metrics}</p>
                </div>
                
                {/* Live Audio Wave Visualizer */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                    <span>LIVE VOICE CHANNEL</span>
                    <span className="text-emerald-400 font-bold">FULL DUPLEX</span>
                  </div>
                  <div className="flex items-center gap-1 h-10 bg-slate-900 rounded-xl px-4 justify-between overflow-hidden border border-slate-800">
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
              </div>
            )}

            <div className="text-[11px] font-mono text-slate-400 pt-3 border-t border-slate-900 flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Lock className="w-3 h-3 text-emerald-400" /> PII ENCRYPTED
              </span>
              <span className="text-emerald-400 font-bold">TLS 1.3 / SRTP</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function HowItWorks({ setPage }: HowItWorksProps) {
  const [viewMode, setViewMode] = useState<"non-tech" | "tech">("non-tech");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const nonTechSteps = [
    {
      step: "01",
      icon: Radio,
      title: "1. The AI Listens (Human Ear Analogy)",
      desc: "Just like an attentive human receptionist, Claritiy Voice listens to the caller's voice over the phone. It filters out background street noise, echoes, and pauses using advanced digital noise suppression."
    },
    {
      step: "02",
      icon: Cpu,
      title: "2. The AI Thinks (Smart Assistant)",
      desc: "The agent instantly checks your company guidelines, product catalogue, or appointment calendar. It decides the exact best response based on your exact business instructions — with 0 hallucinations."
    },
    {
      step: "03",
      icon: Headphones,
      title: "3. The AI Speaks (Natural Human Voice)",
      desc: "The agent responds in a warm, human voice with natural pauses and regional accents. If the customer interrupts or speaks over the agent, the AI pauses mid-sentence to listen politely."
    }
  ];

  const techLatencyBreakdown = [
    { phase: "Carrier Telecom SIP Handshake", target: "32 ms", tech: "G.711 / SRTP transport setup via Twilio/Plivo/Exotel carrier routes." },
    { phase: "Acoustic Noise Filter & VAD", target: "15 ms", tech: "Dual-microphone noise suppression and 20ms voice activity windowing." },
    { phase: "Neural Multimodal Inference", target: "85 ms", tech: "Gemini Live native audio streaming pipeline with zero-copy memory buffers." },
    { phase: "RAG Vector Lookup & Tool Execution", target: "14 ms", tech: "HNSW vector search in SQLite/Prisma with dynamic JSON function calling." },
    { phase: "Audio Buffer Egress to Telecom", target: "28 ms", tech: "16kHz PCM L16 streaming packet egress over UDP zero-copy transport." }
  ];

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
    <div className="space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen relative">
      <GeometricGridBackground />
      
      {/* Hero Header */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
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
          Whether you are an executive looking for clear business ROI or an engineer auditing zero-copy WebRTC architecture, explore how Claritiy Voice replaces legacy phone queues.
        </motion.p>

        {/* View Perspective Switcher */}
        <div className="pt-4 flex justify-center">
          <div className="bg-slate-900 text-white p-1.5 rounded-2xl inline-flex items-center gap-2 border border-slate-800 shadow-xl">
            <button
              onClick={() => setViewMode("non-tech")}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "non-tech"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-4 h-4" /> Non-Tech View (Business & Concepts)
            </button>
            <button
              onClick={() => setViewMode("tech")}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "tech"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Code2 className="w-4 h-4" /> Tech Deep-Dive (Developer Specs)
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Architecture Pipeline Visualizer */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <ArchitecturePipelineCanvas viewMode={viewMode} />
      </section>

      {/* Dynamic View Section: Non-Tech vs Tech Deep-Dive */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        {viewMode === "non-tech" ? (
          <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-12 shadow-xl space-y-8">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest">
                VOICE AI EXPLAINED SIMPLY
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                How Claritiy Voice Works in 3 Simple Steps
              </h2>
              <p className="text-slate-600 text-sm font-plus-jakarta">
                No complex technical jargon — here is how an AI voice call flows from start to finish.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
              {nonTechSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 hover:shadow-lg transition-all">
                    <div className="flex justify-between items-center">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-bold">
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
        ) : (
          <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-8 md:p-12 shadow-xl space-y-8">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                TELEMETRY BENCHMARK AUDIT
              </span>
              <h2 className="text-3xl font-extrabold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Sub-180ms Latency Budget & Protocol Spec
              </h2>
              <p className="text-slate-400 text-sm font-mono">
                Comprehensive engineering audit of packet roundtrip times across our audio pipeline.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {techLatencyBreakdown.map((item, i) => (
                <div key={i} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> {item.phase}
                    </span>
                    <p className="text-xs text-slate-400">{item.tech}</p>
                  </div>
                  <div className="px-4 py-2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl font-bold text-sm text-right whitespace-nowrap">
                    {item.target}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 4 Core Pillars Grid */}
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

      {/* Feature Capability Grid Section */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
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
      <section className="px-6 max-w-4xl mx-auto relative z-10 space-y-8">
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
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-[#0B132B] text-white rounded-3xl p-10 md:p-16 text-center space-y-6 relative overflow-hidden border border-slate-800">
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
              className="py-4 px-8 text-base bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full transition-colors border border-slate-700"
            >
              View Pricing Plans
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}

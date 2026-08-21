import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowRight, Zap, Shield, Globe, Phone, Play, 
  CheckCircle2, Cpu, Activity, Database, Lock, 
  Sparkles, Layers, RefreshCw, Volume2, ArrowUpRight,
  Radio, Server, ShieldCheck, FileText, FastForward, Sliders, Check
} from "lucide-react";

type Page = any;
interface HeroProps {
  setPage: (p: Page) => void;
}

// ── Real-Time Animated Equalizer Waveform ─────────────────────────────────────
function RealtimeAudioWaveform({ active, color = "#059669", barsCount = 28 }: {
  active: boolean; color?: string; barsCount?: number;
}) {
  const [heights, setHeights] = useState<number[]>(Array.from({ length: barsCount }, () => 0.2));
  const animFrame = useRef<number | null>(null);

  useEffect(() => {
    let t = 0;
    const animate = () => {
      t += 0.08;
      setHeights(Array.from({ length: barsCount }, (_, i) => {
        if (!active) return 0.15;
        const wave1 = Math.sin(t + i * 0.3) * 0.4 + 0.5;
        const wave2 = Math.cos(t * 1.7 + i * 0.5) * 0.3;
        const wave3 = Math.sin(t * 2.5 + i * 0.8) * 0.15;
        return Math.max(0.1, Math.min(1, wave1 + wave2 + wave3));
      }));
      animFrame.current = requestAnimationFrame(animate);
    };
    animFrame.current = requestAnimationFrame(animate);
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [active, barsCount]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {heights.map((h, idx) => (
        <div
          key={idx}
          className="w-[3px] rounded-full transition-all duration-75"
          style={{
            height: `${h * 100}%`,
            backgroundColor: color,
            opacity: 0.4 + h * 0.6,
          }}
        />
      ))}
    </div>
  );
}

// ── High-Definition Geometrical & Flow Architecture Animation Component ────────
function HdGeometricalArchitectureDiagram() {
  const [selectedNode, setSelectedNode] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simulatedLatency, setSimulatedLatency] = useState<number>(168);
  const [activeTab, setActiveTab] = useState<"flow" | "features">("flow");

  // Enterprise USPs mapped into high-definition architectural pipeline flow
  const nodes = [
    {
      id: 0,
      title: "Sub-180ms Latency Engine",
      badge: "< 180ms Latency",
      category: "CORE NATIVE ENGINE",
      desc: "Vertically integrated ASR + LLM + TTS speech pipeline streaming over WebRTC zero-copy buffers to eliminate REST API latency for instant human-like response.",
      icon: Zap,
      color: "#059669",
      accentBg: "#ECFDF5",
      borderColor: "rgba(5, 150, 105, 0.4)",
      stats: { primary: "168ms", label: "End-to-End Latency", detail: "0% REST API Lag" }
    },
    {
      id: 1,
      title: "70+ Languages & Dialects",
      badge: "Native Speech Models",
      category: "MULTILINGUAL",
      desc: "Direct neural speech recognition for Hindi, English, Spanish, Arabic, Bengali, Kannada & regional dialects without translation loss.",
      icon: Globe,
      color: "#D97706",
      accentBg: "#FEF3C7",
      borderColor: "rgba(217, 119, 6, 0.4)",
      stats: { primary: "70+", label: "Languages & Accents", detail: "Zero Translation Lag" }
    },
    {
      id: 2,
      title: "Full-Duplex Barge-In",
      badge: "99.9% Human Parity",
      category: "REAL-TIME MEDIA",
      desc: "Callers interrupt naturally mid-sentence. High-precision 20ms VAD audio monitors continuous voice activity to flush target queues instantly.",
      icon: Activity,
      color: "#047857",
      accentBg: "#D1FAE5",
      borderColor: "rgba(4, 120, 87, 0.4)",
      stats: { primary: "100%", label: "Duplex Audio Stream", detail: "Instant Queue Flush" }
    },
    {
      id: 3,
      title: "Enterprise Carrier SIP & PSTN",
      badge: "Carrier Telephony Gateway",
      category: "TELEPHONY GATEWAY",
      desc: "Provision PSTN local & toll-free virtual lines in 1 click or connect existing enterprise SIP trunk infrastructure with SRTP encryption.",
      icon: Phone,
      color: "#0284C7",
      accentBg: "#E0F2FE",
      borderColor: "rgba(2, 132, 199, 0.4)",
      stats: { primary: "1-Click", label: "Line Provisioning", detail: "Global Carrier Trunking" }
    },
    {
      id: 4,
      title: "100% Fact-Checked RAG",
      badge: "Zero Hallucination",
      category: "KNOWLEDGE RETRIEVAL",
      desc: "Ground AI voice agents with PDFs, website URLs, and CRM databases for 100% accurate factual responses during live phone calls.",
      icon: Database,
      color: "#059669",
      accentBg: "#F0FDF4",
      borderColor: "rgba(5, 150, 105, 0.4)",
      stats: { primary: "100%", label: "Fact-Checked Retrieval", detail: "Vector DB Grounded" }
    },
    {
      id: 5,
      title: "SOC 2 & HIPAA Security",
      badge: "Enterprise Guardrails",
      category: "COMPLIANCE",
      desc: "Edge-level PII/PHI redaction, TLS 1.3 encrypted WebRTC streams, PCI-DSS payment compliance, and automated call audit trails.",
      icon: Lock,
      color: "#D97706",
      accentBg: "#FEF3C7",
      borderColor: "rgba(217, 119, 6, 0.4)",
      stats: { primary: "SOC 2", label: "Type II Certified", detail: "HIPAA BAA Ready" }
    }
  ];

  // Auto rotate selected node every 4 seconds when playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSelectedNode((prev) => (prev + 1) % nodes.length);
      setSimulatedLatency(Math.floor(166 + Math.random() * 10));
    }, 4000);
    return () => clearInterval(interval);
  }, [isPlaying, nodes.length]);

  const activeData = nodes[selectedNode];
  const ActiveIcon = activeData.icon;

  return (
    <div className="w-full flex flex-col space-y-4 font-sans">
      
      {/* ── Top Telemetry & Control Bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#059669] animate-pulse shadow-[0_0_8px_#059669]" />
          <span className="text-xs font-extrabold text-[#0F172A] font-mono tracking-wider">
            PIPECAT NATIVE VOICE ENGINE
          </span>
          <span className="text-[11px] font-bold font-mono text-[#059669] bg-[#ECFDF5] px-2.5 py-0.5 rounded-md border border-[#059669]/20">
            {simulatedLatency}ms
          </span>
        </div>

        {/* Play/Pause & Mode Controls */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setActiveTab("flow")}
            className={`text-xs font-bold font-mono px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === "flow"
                ? "bg-[#059669] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Diagram Flow
          </button>
          <button
            onClick={() => setActiveTab("features")}
            className={`text-xs font-bold font-mono px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === "features"
                ? "bg-[#059669] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            USP Grid
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors ml-1"
            title={isPlaying ? "Pause Rotation" : "Play Rotation"}
          >
            {isPlaying ? (
              <div className="flex gap-0.5">
                <div className="w-1 h-3 rounded-sm bg-slate-700" />
                <div className="w-1 h-3 rounded-sm bg-slate-700" />
              </div>
            ) : (
              <Play className="w-3.5 h-3.5 ml-0.5 fill-slate-700 text-slate-700" />
            )}
          </button>
        </div>
      </div>

      {/* ── Main Canvas View: Interactive Architecture Diagram Flow ────────── */}
      {activeTab === "flow" ? (
        <div className="relative w-full rounded-3xl bg-white/95 backdrop-blur-xl p-5 md:p-6 border border-slate-200/90 shadow-[0_16px_40px_rgba(0,0,0,0.06)] overflow-hidden">
          
          {/* Background SVG Geometrical Grid & Laser Beams */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 650 360">
            <defs>
              <linearGradient id="beamGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0.9" />
              </linearGradient>
              <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#94A3B8" opacity="0.3" />
              </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#dot-grid)" />

            {/* Stage 1 (Gateway) -> Stage 2 (Hub) Laser Pulse Beam */}
            <path d="M 140 180 Q 210 180 280 180" fill="none" stroke="url(#beamGreen)" strokeWidth="3" strokeDasharray="8 4">
              <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite" />
            </path>

            {/* Stage 2 (Hub) -> Stage 3 (Right Nodes) Pulsing Connection Spoke Lines */}
            <path d="M 360 150 Q 440 85 510 85" fill="none" stroke={selectedNode === 1 ? "#D97706" : "#E2E8F0"} strokeWidth={selectedNode === 1 ? "3" : "1.5"} />
            <path d="M 360 170 Q 440 150 510 150" fill="none" stroke={selectedNode === 2 ? "#047857" : "#E2E8F0"} strokeWidth={selectedNode === 2 ? "3" : "1.5"} />
            <path d="M 360 190 Q 440 215 510 215" fill="none" stroke={selectedNode === 4 ? "#059669" : "#E2E8F0"} strokeWidth={selectedNode === 4 ? "3" : "1.5"} />
            <path d="M 360 210 Q 440 280 510 280" fill="none" stroke={selectedNode === 5 ? "#D97706" : "#E2E8F0"} strokeWidth={selectedNode === 5 ? "3" : "1.5"} />
          </svg>

          {/* 3-Stage Pipeline Diagram Flow (Left -> Center Hub -> Right Capabilities) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center relative z-10">
            
            {/* STAGE 1: Carrier Telephony & SIP Gateway (Left 3.5 cols) */}
            <div className="md:col-span-3 lg:col-span-3.5 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono block text-left">
                STAGE 01 · GATEWAY
              </span>
              
              <div 
                onClick={() => { setSelectedNode(3); setIsPlaying(false); }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                  selectedNode === 3 
                    ? "bg-sky-50/90 border-[#0284C7] shadow-md ring-2 ring-[#0284C7]/20" 
                    : "bg-slate-50/90 border-slate-200 hover:bg-slate-100/90"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-[#0284C7] flex items-center justify-center flex-shrink-0 font-bold">
                    <Phone className="w-4 h-4" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-extrabold text-[#0F172A] truncate">Carrier SIP & PSTN</h5>
                    <p className="text-[10px] text-slate-500 font-semibold truncate">Telephony Trunking</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60 text-[9px] font-mono font-bold text-sky-800">
                  <Radio className="w-3 h-3 animate-pulse text-[#0284C7]" />
                  <span className="truncate">Bi-Directional Audio Stream</span>
                </div>
              </div>
            </div>

            {/* STAGE 2: Central Claritiy Voice Core Engine (Center 5 cols) */}
            <div className="md:col-span-5 lg:col-span-5 flex flex-col items-center justify-center py-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#059669] font-mono block mb-2">
                STAGE 02 · NATIVE VOICE ENGINE
              </span>

              <motion.div
                whileHover={{ scale: 1.03 }}
                onClick={() => { setSelectedNode(0); setIsPlaying(false); }}
                className={`w-full p-4.5 rounded-3xl border text-center cursor-pointer transition-all ${
                  selectedNode === 0
                    ? "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-xl border-emerald-400 ring-4 ring-emerald-500/20"
                    : "bg-white border-emerald-200 shadow-md hover:border-emerald-400"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center mb-2 text-emerald-800 shadow-inner">
                  <Cpu className={`w-7 h-7 ${selectedNode === 0 ? "text-white" : "text-[#059669]"}`} />
                </div>
                <h4 className={`text-base font-black ${selectedNode === 0 ? "text-white" : "text-[#0F172A]"}`}>
                  Claritiy Voice AI
                </h4>
                <p className={`text-[10px] font-mono mt-0.5 font-bold ${selectedNode === 0 ? "text-emerald-100" : "text-emerald-700"}`}>
                  Sub-180ms Native Stream
                </p>

                {/* Animated Equalizer Waveform inside Core Hub */}
                <div className="mt-3 pt-2 border-t border-current/10">
                  <RealtimeAudioWaveform active={true} color={selectedNode === 0 ? "#FFFFFF" : "#059669"} barsCount={24} />
                </div>
              </motion.div>
            </div>

            {/* STAGE 3: Enterprise USPs & Outcomes (Right 3.5 cols - Full Readability) */}
            <div className="md:col-span-4 lg:col-span-3.5 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono block text-left">
                STAGE 03 · USPs & CAPABILITIES
              </span>

              {[1, 2, 4, 5].map((nodeIdx) => {
                const item = nodes[nodeIdx];
                const ItemIcon = item.icon;
                const isSelected = selectedNode === nodeIdx;

                return (
                  <div
                    key={nodeIdx}
                    onClick={() => { setSelectedNode(nodeIdx); setIsPlaying(false); }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left flex items-center gap-2.5 ${
                      isSelected
                        ? "bg-white shadow-md border-emerald-600 ring-2 ring-emerald-500/20"
                        : "bg-slate-50/80 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: item.accentBg, color: item.color }}
                    >
                      <ItemIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-[#0F172A] leading-snug">
                        {item.title}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500">
                        {item.badge}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* ── Active Node Telemetry Card Overlay (Bottom Panel - Spacious Fit) ── */}
          <div className="mt-4 pt-4 border-t border-slate-200/90 text-left">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedNode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div 
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: activeData.accentBg, color: activeData.color }}
                  >
                    <ActiveIcon className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-extrabold text-[#0F172A]">
                        {activeData.title}
                      </h4>
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        {activeData.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">
                      {activeData.desc}
                    </p>
                  </div>
                </div>

                {/* Key Metric Highlight */}
                <div className="flex items-center gap-3 sm:pl-4 sm:border-l border-slate-200 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-lg font-extrabold text-[#0F172A] font-mono block leading-none">
                      {activeData.stats.primary}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block mt-1">
                      {activeData.stats.label}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      ) : (
        /* ── Grid View Mode: 6 High-Definition USP Cards ────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {nodes.map((u, idx) => {
            const Icon = u.icon;
            const isSelected = selectedNode === idx;

            return (
              <motion.div
                key={u.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => { setSelectedNode(idx); setIsPlaying(false); }}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-white shadow-md border-emerald-600 ring-2 ring-emerald-500/20"
                    : "bg-white/80 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: u.accentBg, color: u.color }}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2.2} />
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {u.badge}
                    </span>
                  </div>
                  <h4 className="text-xs font-extrabold text-[#0F172A] mb-1">
                    {u.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    {u.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono font-bold text-emerald-700">
                  <span>{u.stats.label}</span>
                  <span>{u.stats.primary}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ── Main Hero Section ─────────────────────────────────────────────────────────
export default function Hero({ setPage }: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-12 lg:pb-24 bg-[#FBF9F4]">
      
      {/* Background Architectural Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035]" 
        style={{ 
          backgroundImage: "radial-gradient(circle, #0F172A 1px, transparent 1px)", 
          backgroundSize: "28px 28px" 
        }} 
      />

      {/* Warm Ambient Radial Glows (No blue, no black, no purple!) */}
      <div className="absolute top-10 left-8 w-80 h-80 bg-[#D1FAE5]/50 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[#FEF3C7]/50 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* ── LEFT COLUMN: Clear Enterprise Messaging & CTAs (6 Cols) ─────── */}
          <motion.div 
            className="lg:col-span-6 space-y-6 text-left"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-emerald-800/10 bg-emerald-500/10 backdrop-blur-md">
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669] animate-pulse" />
              <span className="text-xs font-extrabold text-[#059669] uppercase tracking-wider font-mono">
                #1 Enterprise AI Voice Platform · Claritiy Voice
              </span>
            </div>

            {/* Headline */}
            <h1 
              className="text-[#0F172A] text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08]"
              style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
            >
              Human-Like AI Voice Agents for Outbound Sales, Support & IVR
            </h1>

            {/* Clear Explanation of What We Do */}
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-medium font-plus-jakarta">
              Claritiy Voice builds sub-second (<span className="text-[#059669] font-bold">180ms</span>) conversational AI phone agents that place outbound sales calls, handle inbound customer support, qualify leads, and automate payment reminders across <span className="text-[#D97706] font-bold">70+ languages</span> with zero setup overhead.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => setPage("dashboard")}
                className="inline-flex items-center gap-2.5 text-white font-extrabold text-base px-8 py-4 rounded-2xl shadow-[0_10px_25px_rgba(5,150,105,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}
              >
                Build Your AI Agent
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => setPage("how-it-works")}
                className="inline-flex items-center gap-2.5 text-[#0F172A] font-bold text-base px-7 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
              >
                <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 text-[#059669] ml-0.5" />
                </div>
                Hear Sample AI Call
              </button>
            </div>

            {/* Platform Proof Metrics Bar */}
            <div className="pt-6 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Sub-Second Latency", value: "< 180ms" },
                { label: "Supported Languages", value: "70+ Dialects" },
                { label: "Human Voice Parity", value: "99.9%" },
                { label: "Security & PII", value: "SOC2 / HIPAA" }
              ].map((stat, idx) => (
                <div key={idx} className="space-y-0.5">
                  <p className="text-lg sm:text-xl font-extrabold text-[#0F172A] font-mono">
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-500 font-semibold">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

          </motion.div>

          {/* ── RIGHT COLUMN: HD Graphical Architecture Diagram (6 Cols) ─────── */}
          <motion.div 
            className="lg:col-span-6 relative w-full"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {/* The High-Definition Architecture & Animation Engine */}
            <HdGeometricalArchitectureDiagram />
          </motion.div>

        </div>
      </div>

    </section>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowRight, Zap, Shield, Globe, Phone, Play, 
  CheckCircle2, Cpu, Activity, Sparkles, Layers, 
  RefreshCw, MessageSquare, Lock, ArrowUpRight, Volume2, Database
} from "lucide-react";

type Page = any;
interface HeroProps {
  setPage: (p: Page) => void;
}

// ── Interactive Geometrical USP Diagram Component ─────────────────────────────
function GeometricalUspDiagram() {
  const [activeNode, setActiveNode] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // 6 Core USPs mapped into geometric diagram positions
  const usps = [
    {
      id: 0,
      title: "Sub-180ms Latency",
      subtitle: "Native Audio Stream",
      detail: "Vertically integrated ASR + LLM + TTS engine eliminate 800ms API lag for real human response times.",
      icon: Zap,
      color: "#059669",
      accentBg: "#ECFDF5",
      x: 50, // % from center
      y: 16,
      angle: -90,
      badge: "<180ms"
    },
    {
      id: 1,
      title: "70+ Languages & Accents",
      subtitle: "Native Speech Models",
      detail: "Direct Hindi, English, Spanish, Arabic, Bengali & regional dialect recognition without translation loss.",
      icon: Globe,
      color: "#D97706",
      accentBg: "#FEF3C7",
      x: 82,
      y: 35,
      angle: -30,
      badge: "70+ Languages"
    },
    {
      id: 2,
      title: "Full-Duplex Barge-In",
      subtitle: "99.9% Human Parity",
      detail: "Callers interrupt naturally mid-sentence. VAD flushes target queues instantly for realistic turn-taking.",
      icon: Activity,
      color: "#047857",
      accentBg: "#D1FAE5",
      x: 82,
      y: 72,
      angle: 30,
      badge: "Real-Time Interruption"
    },
    {
      id: 3,
      title: "Instant Telephony Sync",
      subtitle: "Vobiz & SIP Trunking",
      detail: "Provision PSTN local/tollfree phone numbers in 1 click or connect existing enterprise SIP infrastructure.",
      icon: Phone,
      color: "#D97706",
      accentBg: "#FFF7ED",
      x: 50,
      y: 88,
      angle: 90,
      badge: "Vobiz PSTN / SIP"
    },
    {
      id: 4,
      title: "100% Fact-Checked RAG",
      subtitle: "Zero Hallucination",
      detail: "Ground your AI agent with PDFs, FAQs, and CRM databases for instant factual retrieval live on phone calls.",
      icon: Database,
      color: "#059669",
      accentBg: "#F0FDF4",
      x: 18,
      y: 72,
      angle: 150,
      badge: "CRM & Document RAG"
    },
    {
      id: 5,
      title: "SOC 2 & HIPAA Security",
      subtitle: "Enterprise Grade",
      detail: "Edge-level PII/PHI redaction, TLS encryption, PCI-DSS compliance, and automated call audit trails.",
      icon: Lock,
      color: "#B45309",
      accentBg: "#FEF3C7",
      x: 18,
      y: 35,
      angle: 210,
      badge: "SOC2 & HIPAA Ready"
    }
  ];

  // Auto rotate active node highlight every 3 seconds
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveNode((prev) => (prev + 1) % usps.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isPlaying, usps.length]);

  const CurrentIcon = usps[activeNode].icon;

  return (
    <div className="relative w-full max-w-[540px] aspect-square mx-auto flex items-center justify-center p-2 sm:p-4 select-none">
      
      {/* Subtle Background Glow */}
      <div 
        className="absolute inset-4 rounded-full opacity-30 blur-[60px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(5,150,105,0.25) 0%, rgba(217,119,6,0.15) 50%, transparent 70%)"
        }}
      />

      {/* SVG Geometric Lattice & Beam Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 500 500">
        <defs>
          <linearGradient id="emeraldBeam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagonal Ring */}
        <polygon
          points="250,50 423,150 423,350 250,450 77,350 77,150"
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />

        {/* Inner Orbital Circle */}
        <circle
          cx="250"
          cy="250"
          r="135"
          fill="none"
          stroke="rgba(5, 150, 105, 0.15)"
          strokeWidth="1.5"
        />

        {/* Rotating Concentric Ring */}
        <g style={{ transformOrigin: "250px 250px", animation: "spin 40s linear infinite" }}>
          <circle
            cx="250"
            cy="250"
            r="175"
            fill="none"
            stroke="rgba(217, 119, 6, 0.2)"
            strokeWidth="1"
            strokeDasharray="12 12"
          />
        </g>

        {/* Connection Spoke Lines to Hub */}
        {usps.map((u, i) => {
          const isActive = activeNode === i;
          const px = (u.x / 100) * 500;
          const py = (u.y / 100) * 500;
          return (
            <g key={i}>
              <line
                x1="250"
                y1="250"
                x2={px}
                y2={py}
                stroke={isActive ? "url(#emeraldBeam)" : "rgba(226, 232, 240, 0.7)"}
                strokeWidth={isActive ? "2.5" : "1.2"}
                strokeDasharray={isActive ? "none" : "3 3"}
              />
              {/* Pulse particle along spoke line */}
              {isActive && (
                <circle cx={px} cy={py} r="5" fill="#059669" filter="url(#glow)">
                  <animate
                    attributeName="r"
                    values="3;7;3"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Central Hub Node: Claritiy Voice Core AI Engine */}
      <motion.div
        className="absolute z-20 w-32 h-32 rounded-3xl bg-white p-3 flex flex-col items-center justify-center text-center shadow-[0_16px_40px_rgba(5,150,105,0.18)] border-2 border-[#059669]/20 cursor-pointer"
        whileHover={{ scale: 1.05 }}
        onClick={() => setIsPlaying(!isPlaying)}
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#059669] to-[#047857] flex items-center justify-center shadow-md mb-1.5">
          <Cpu className="w-6 h-6 text-white" />
        </div>
        <span className="text-[11px] font-black text-[#0F172A] uppercase tracking-wider font-mono">
          Claritiy AI
        </span>
        <span className="text-[9px] font-semibold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full mt-0.5">
          Native Engine
        </span>
      </motion.div>

      {/* 6 Peripheral Geometrical USP Nodes */}
      {usps.map((u, i) => {
        const isActive = activeNode === i;
        const Icon = u.icon;
        const px = u.x;
        const py = u.y;

        return (
          <motion.div
            key={u.id}
            className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{ left: `${px}%`, top: `${py}%` }}
            onClick={() => {
              setActiveNode(i);
              setIsPlaying(false);
            }}
            whileHover={{ scale: 1.12 }}
            animate={{ scale: isActive ? 1.15 : 1.0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div 
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all ${
                isActive 
                  ? "bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)] border-[#059669] ring-2 ring-[#059669]/20" 
                  : "bg-white/90 shadow-md border-slate-200 hover:border-slate-300"
              }`}
            >
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: u.accentBg, color: u.color }}
              >
                <Icon className="w-4 h-4" strokeWidth={2.2} />
              </div>
              <div className="hidden sm:block text-left pr-1">
                <p className="text-[11px] font-bold text-[#0F172A] leading-none whitespace-nowrap">
                  {u.title}
                </p>
                <p className="text-[9px] font-medium text-slate-500 mt-0.5 whitespace-nowrap">
                  {u.subtitle}
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Dynamic Floating USP Highlight Card (Bottom Overlay) */}
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-[92%] sm:w-[86%] z-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeNode}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-emerald-100 shadow-[0_14px_36px_rgba(0,0,0,0.08)] flex items-start gap-3.5"
          >
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: usps[activeNode].accentBg, color: usps[activeNode].color }}
            >
              <CurrentIcon className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-extrabold text-[#0F172A]">
                  {usps[activeNode].title}
                </h4>
                <span 
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase"
                  style={{ backgroundColor: usps[activeNode].accentBg, color: usps[activeNode].color }}
                >
                  {usps[activeNode].badge}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">
                {usps[activeNode].detail}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}

// ── Main Hero Section ─────────────────────────────────────────────────────────
export default function Hero({ setPage }: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-12 lg:pb-24 bg-[#FBF9F4]">
      
      {/* Background Architectural Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{ 
          backgroundImage: "radial-gradient(circle, #0F172A 1px, transparent 1px)", 
          backgroundSize: "28px 28px" 
        }} 
      />

      {/* Decorative Organic Ambient Shapes (No blue, no black, no purple!) */}
      <div className="absolute top-12 left-8 w-72 h-72 bg-[#D1FAE5]/40 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-10 right-12 w-96 h-96 bg-[#FEF3C7]/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* ── LEFT COLUMN: Clear Enterprise Messaging & CTAs (7 Cols) ─────── */}
          <motion.div 
            className="lg:col-span-7 space-y-6 text-left"
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
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl font-medium">
              Claritiy Voice builds sub-second (<span className="text-[#059669] font-bold">180ms</span>) conversational AI phone agents that place outbound sales calls, handle inbound customer support, qualify leads, and automate payment reminders across <span className="text-[#D97706] font-bold">70+ languages</span> with zero setup overhead.
            </p>

            {/* Primary & Secondary Call to Actions */}
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

            {/* Key Platform Proof Metrics Bar */}
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

          {/* ── RIGHT COLUMN: Geometrical Lottie / SVG USP Diagram (5 Cols) ─── */}
          <motion.div 
            className="lg:col-span-5 relative"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="bg-white/80 backdrop-blur-xl rounded-[36px] p-4 sm:p-6 border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative overflow-hidden">
              
              {/* Header Label inside Diagram Card */}
              <div className="flex items-center justify-between px-3 pt-2 pb-1 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A]">
                    Platform Architecture & USPs
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  Interactive Diagram
                </span>
              </div>

              {/* The Geometrical Diagram Component */}
              <GeometricalUspDiagram />

            </div>
          </motion.div>

        </div>
      </div>

    </section>
  );
}

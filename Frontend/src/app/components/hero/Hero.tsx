import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowRight, Zap, Shield, Globe, Phone, Play, 
  CheckCircle2, Cpu, Activity, Database, Lock, 
  Sparkles, Layers, RefreshCw, Volume2, ArrowUpRight,
  Radio, Server, ShieldCheck, FileText, FastForward, Sliders, Check
} from "lucide-react";
import Lottie from "lottie-react";
import { voiceOrbLottieData } from "../animation/lottieVoiceData";

type Page = any;
interface HeroProps {
  setPage: (p: Page) => void;
}

// ── Real-Time Animated Equalizer Waveform ─────────────────────────────────────
function RealtimeAudioWaveform({ active, color = "#121212", barsCount = 28 }: {
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
      stats: { primary: "168ms", label: "End-to-End Latency", detail: "0% REST API Lag" }
    },
    {
      id: 1,
      title: "70+ Languages & Dialects",
      badge: "Native Speech Models",
      category: "MULTILINGUAL",
      desc: "Direct neural speech recognition for Hindi, English, Spanish, Arabic, Bengali, Kannada & regional dialects without translation loss.",
      icon: Globe,
      stats: { primary: "70+", label: "Languages & Accents", detail: "Zero Translation Lag" }
    },
    {
      id: 2,
      title: "Full-Duplex Barge-In",
      badge: "99.9% Human Parity",
      category: "REAL-TIME MEDIA",
      desc: "Callers interrupt naturally mid-sentence. High-precision 20ms VAD audio monitors continuous voice activity to flush target queues instantly.",
      icon: Activity,
      stats: { primary: "100%", label: "Duplex Audio Stream", detail: "Instant Queue Flush" }
    },
    {
      id: 3,
      title: "Enterprise Carrier SIP & PSTN",
      badge: "Carrier Telephony Gateway",
      category: "TELEPHONY GATEWAY",
      desc: "Provision PSTN local & toll-free virtual lines in 1 click or connect existing enterprise SIP trunk infrastructure with SRTP encryption.",
      icon: Phone,
      stats: { primary: "1-Click", label: "Line Provisioning", detail: "Global Carrier Trunking" }
    },
    {
      id: 4,
      title: "100% Fact-Checked RAG",
      badge: "Zero Hallucination",
      category: "KNOWLEDGE RETRIEVAL",
      desc: "Ground AI voice agents with PDFs, website URLs, and CRM databases for 100% accurate factual responses during live phone calls.",
      icon: Database,
      stats: { primary: "100%", label: "Fact-Checked Retrieval", detail: "Vector DB Grounded" }
    },
    {
      id: 5,
      title: "MSME Security Blueprint",
      badge: "Enterprise Guardrails",
      category: "COMPLIANCE",
      desc: "Edge-level PII redaction, TLS 1.3 encrypted WebRTC streams, DPDP privacy compliance, and automated call audit trails.",
      icon: Lock,
      stats: { primary: "MSME", label: "Registered Enterprise", detail: "DPDP Act Aligned" }
    }
  ];

  // Auto rotate selected node every 4 seconds when playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSelectedNode((prev) => (prev + 1) % nodes.length);
      setSimulatedLatency(Math.floor(164 + Math.random() * 12));
    }, 4000);
    return () => clearInterval(interval);
  }, [isPlaying, nodes.length]);

  const activeData = nodes[selectedNode];
  const ActiveIcon = activeData.icon;

  return (
    <div className="w-full flex flex-col space-y-4 font-sans">
      
      {/* ── Top Telemetry & Control Bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#EBE9E2] rounded-[2px] p-3.5 border border-[#CBC8BE]">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#121212] animate-pulse" />
          <span className="text-xs font-bold text-[#121212] font-mono tracking-wider">
            PIPECAT NATIVE VOICE ENGINE
          </span>
          <span className="text-[11px] font-bold font-mono text-[#121212] bg-[#DFDCD4] px-2 py-0.5 rounded-[2px] border border-[#CBC8BE]">
            {simulatedLatency}ms
          </span>
        </div>

        {/* Play/Pause & Mode Controls */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setActiveTab("flow")}
            className={`text-xs font-mono px-3 py-1 rounded-[2px] transition-all cursor-pointer ${
              activeTab === "flow"
                ? "bg-[#121212] text-white"
                : "bg-transparent border border-[#CBC8BE] text-[#262523] hover:text-[#121212]"
            }`}
          >
            Diagram Flow
          </button>
          <button
            onClick={() => setActiveTab("features")}
            className={`text-xs font-mono px-3 py-1 rounded-[2px] transition-all cursor-pointer ${
              activeTab === "features"
                ? "bg-[#121212] text-white"
                : "bg-transparent border border-[#CBC8BE] text-[#262523] hover:text-[#121212]"
            }`}
          >
            USP Grid
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-7 h-7 rounded-[2px] border border-[#CBC8BE] bg-transparent hover:bg-black/5 flex items-center justify-center text-[#121212] transition-colors ml-1 cursor-pointer"
            title={isPlaying ? "Pause Rotation" : "Play Rotation"}
          >
            {isPlaying ? (
              <div className="flex gap-0.5">
                <div className="w-1 h-2.5 bg-[#121212]" />
                <div className="w-1 h-2.5 bg-[#121212]" />
              </div>
            ) : (
              <Play className="w-3 h-3 ml-0.5 fill-[#121212] text-[#121212]" />
            )}
          </button>
        </div>
      </div>

      {/* ── Main Canvas View: Interactive Architecture Diagram Flow ────────── */}
      {activeTab === "flow" ? (
        <div className="relative w-full rounded-[2px] bg-[#EBE9E2] p-5 md:p-6 border border-[#CBC8BE] overflow-hidden">
          
          {/* Background SVG Geometrical Grid & Laser Beams */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" viewBox="0 0 650 360">
            <defs>
              <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#121212" opacity="0.3" />
              </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#dot-grid)" />

            {/* Stage 1 (Gateway) -> Stage 2 (Hub) Laser Pulse Beam */}
            <path d="M 140 180 Q 210 180 280 180" fill="none" stroke="#121212" strokeWidth="2" strokeDasharray="8 4">
              <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite" />
            </path>

            {/* Stage 2 (Hub) -> Stage 3 (Right Nodes) Pulsing Connection Spoke Lines */}
            <path d="M 360 150 Q 440 85 510 85" fill="none" stroke={selectedNode === 1 ? "#121212" : "#CBC8BE"} strokeWidth={selectedNode === 1 ? "2.5" : "1"} />
            <path d="M 360 170 Q 440 150 510 150" fill="none" stroke={selectedNode === 2 ? "#121212" : "#CBC8BE"} strokeWidth={selectedNode === 2 ? "2.5" : "1"} />
            <path d="M 360 190 Q 440 215 510 215" fill="none" stroke={selectedNode === 4 ? "#121212" : "#CBC8BE"} strokeWidth={selectedNode === 4 ? "2.5" : "1"} />
            <path d="M 360 210 Q 440 280 510 280" fill="none" stroke={selectedNode === 5 ? "#121212" : "#CBC8BE"} strokeWidth={selectedNode === 5 ? "2.5" : "1"} />
          </svg>

          {/* 3-Stage Pipeline Diagram Flow (Left -> Center Hub -> Right Capabilities) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center relative z-10">
            
            {/* STAGE 1: Carrier Telephony & SIP Gateway (Left 3.5 cols) */}
            <div className="md:col-span-3 lg:col-span-3.5 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#262523] font-mono block text-left">
                STAGE 01 · GATEWAY
              </span>
              
              <div 
                onClick={() => { setSelectedNode(3); setIsPlaying(false); }}
                className={`p-3.5 rounded-[2px] border transition-all cursor-pointer text-left ${
                  selectedNode === 3 
                    ? "bg-[#DFDCD4] border-[#121212] shadow-sm" 
                    : "bg-[#DFDCD4] border-[#CBC8BE] hover:bg-[#D5D1C7]"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-semibold text-[#121212] font-sans truncate">Carrier SIP & PSTN</h5>
                    <p className="text-[10px] text-[#262523] font-mono truncate">Telephony Trunking</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1 border-t border-[#CBC8BE] text-[9px] font-mono font-medium text-[#121212]">
                  <Radio className="w-3 h-3 text-[#121212]" />
                  <span className="truncate">Bi-Directional Audio Stream</span>
                </div>
              </div>
            </div>

            {/* STAGE 2: Central Claritiy Voice Core Engine (Center 5 cols) */}
            <div className="md:col-span-5 lg:col-span-5 flex flex-col items-center justify-center py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#121212] font-mono block mb-2">
                STAGE 02 · NATIVE VOICE ENGINE
              </span>

              <motion.div
                whileHover={{ scale: 1.02 }}
                onClick={() => { setSelectedNode(0); setIsPlaying(false); }}
                className={`w-full p-4.5 rounded-[2px] border text-center cursor-pointer transition-all ${
                  selectedNode === 0
                    ? "bg-[#DFDCD4] border-2 border-[#121212] shadow-sm"
                    : "bg-[#EBE9E2] border border-[#CBC8BE] hover:border-[#9C998F]"
                }`}
              >
                <div className="relative w-14 h-14 mx-auto mb-1 flex items-center justify-center">
                  <Lottie
                    animationData={voiceOrbLottieData}
                    loop={true}
                    autoplay={true}
                    className="w-full h-full"
                  />
                </div>
                <h4 className="text-base font-medium text-[#121212] font-sans">
                  Claritiy Voice AI
                </h4>
                <p className="text-[10px] font-mono mt-0.5 text-[#262523]">
                  Sub-180ms Native Stream
                </p>

                {/* Animated Equalizer Waveform inside Core Hub */}
                <div className="mt-3 pt-2 border-t border-[#CBC8BE]">
                  <RealtimeAudioWaveform active={true} color="#121212" barsCount={24} />
                </div>
              </motion.div>
            </div>

            {/* STAGE 3: Enterprise USPs & Outcomes (Right 3.5 cols) */}
            <div className="md:col-span-4 lg:col-span-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#262523] font-mono block text-left">
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
                    className={`p-2.5 rounded-[2px] border transition-all cursor-pointer text-left flex items-center gap-2.5 ${
                      isSelected
                        ? "bg-[#DFDCD4] border-[#121212] shadow-sm"
                        : "bg-[#EBE9E2] border-[#CBC8BE] hover:bg-[#DFDCD4]"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center flex-shrink-0 text-[#121212]">
                      <ItemIcon className="w-3.5 h-3.5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#121212] leading-snug font-sans">
                        {item.title}
                      </p>
                      <p className="text-[10px] font-mono text-[#262523]">
                        {item.badge}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* ── Active Node Telemetry Card Overlay ── */}
          <div className="mt-4 pt-4 border-t border-[#CBC8BE] text-left">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedNode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#DFDCD4] rounded-[2px] p-4 border border-[#CBC8BE]"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] flex items-center justify-center flex-shrink-0 text-[#121212]">
                    <ActiveIcon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-semibold text-[#121212] font-sans">
                        {activeData.title}
                      </h4>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212]">
                        {activeData.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#262523] leading-relaxed mt-1 font-sans">
                      {activeData.desc}
                    </p>
                  </div>
                </div>

                {/* Key Metric Highlight */}
                <div className="flex items-center gap-3 sm:pl-4 sm:border-l border-[#CBC8BE] flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-lg font-bold text-[#121212] font-mono block leading-none">
                      {activeData.stats.primary}
                    </span>
                    <span className="text-[10px] font-mono text-[#262523] block mt-1">
                      {activeData.stats.label}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      ) : (
        /* ── Grid View Mode: 6 Wireframe Cards ───────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {nodes.map((u, idx) => {
            const Icon = u.icon;
            const isSelected = selectedNode === idx;

            return (
              <motion.div
                key={u.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => { setSelectedNode(idx); setIsPlaying(false); }}
                className={`p-4 rounded-[2px] border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#DFDCD4] border-[#121212] shadow-sm"
                    : "bg-[#EBE9E2] border-[#CBC8BE] hover:border-[#9C998F]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center text-[#121212]">
                      <Icon className="w-4 h-4" strokeWidth={2} />
                    </div>
                    <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212]">
                      {u.badge}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#121212] mb-1 font-sans">
                    {u.title}
                  </h4>
                  <p className="text-[11px] text-[#262523] leading-relaxed font-sans">
                    {u.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-[#CBC8BE] flex items-center justify-between text-[10px] font-mono font-bold text-[#121212]">
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

// ── Main Hero Section (EdgeSkool Minimalist Wireframe Style) ─────────────────
export default function Hero({ setPage }: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-6 pb-16 lg:pt-8 lg:pb-20 bg-[#E5E3DC]">
      
      {/* Signature EdgeSkool Diagonal Hatched Decorative Banner */}
      <div className="hatched-strip h-12 w-full mb-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* ── LEFT COLUMN: Clear Enterprise Messaging & CTAs (6 Cols) ─────── */}
          <motion.div 
            className="lg:col-span-6 space-y-6 text-left"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Live Status Tag */}
            <div className="flex items-center gap-2 text-xs font-mono text-[#262523]">
              <span className="text-[#121212] font-bold">|</span>
              <span className="uppercase tracking-wider">Claritiy Voice · Enterprise Outbound, Support & IVR</span>
            </div>

            {/* Headline */}
            <h1 className="text-[#121212] text-4xl sm:text-5xl lg:text-6xl font-normal lg:font-medium tracking-tight leading-[1.08] font-sans">
              Human-Like AI Voice Agents for Outbound Sales, Support & IVR
            </h1>

            {/* Clear Explanation of What We Do */}
            <p className="text-[#262523] text-base sm:text-lg leading-relaxed font-normal">
              Claritiy Voice builds sub-second (<span className="text-[#121212] font-semibold">180ms</span>) conversational AI phone agents that place outbound sales calls, handle inbound customer support, qualify leads, and automate payment reminders across <span className="text-[#121212] font-semibold">70+ languages</span> with zero setup overhead.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setPage("dashboard")}
                className="btn-primary uppercase font-mono text-xs tracking-wider px-6 py-3"
              >
                Build Your AI Agent
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setPage("how-it-works")}
                className="btn-secondary uppercase font-mono text-xs tracking-wider px-6 py-3 flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-[#121212] text-[#121212]" />
                Hear Sample AI Call
              </button>
            </div>

            {/* Platform Proof Metrics Bar */}
            <div className="pt-6 border-t border-[#CBC8BE] grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Response Latency", value: "< 500ms" },
                { label: "Supported Languages", value: "70+ Dialects" },
                { label: "Human Voice Parity", value: "99.9%" },
                { label: "Security & Privacy", value: "256-Bit TLS" }
              ].map((stat, idx) => (
                <div key={idx} className="bg-[#EBE9E2] border border-[#CBC8BE] p-3 rounded-[2px] space-y-0.5">
                  <p className="text-base sm:text-lg font-bold text-[#121212] font-mono">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-[#262523] font-mono">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

          </motion.div>

          {/* ── RIGHT COLUMN: HD Graphical Architecture Diagram (6 Cols) ─────── */}
          <motion.div 
            className="lg:col-span-6 relative w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <HdGeometricalArchitectureDiagram />
          </motion.div>

        </div>
      </div>

    </section>
  );
}

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, Mic, Globe, Zap, Shield, Phone, Star, CheckCircle2, Play } from "lucide-react";

type Page = any;
interface HeroProps { setPage: (p: Page) => void; }

// ── Animated Waveform (requestAnimationFrame sine bars) ──────────────────────
function LiveWaveform({ active, color = "#34D399", barCount = 36 }: {
  active: boolean; color?: string; barCount?: number;
}) {
  const [bars, setBars] = useState<number[]>(Array.from({ length: barCount }, () => 0.1));
  const animRef = useRef<number | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setBars(Array.from({ length: barCount }, () => 0.08));
      return;
    }
    const animate = () => {
      tRef.current += 0.055;
      const t = tRef.current;
      setBars(Array.from({ length: barCount }, (_, i) => {
        const base = Math.sin(t + i * 0.28) * 0.45 + 0.5;
        const harmonic = Math.sin(t * 2.1 + i * 0.6) * 0.2;
        const micro = Math.sin(t * 3.7 + i * 1.1) * 0.08;
        return Math.max(0.06, Math.min(1, base + harmonic + micro));
      }));
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [active, barCount]);

  return (
    <div className="flex items-center justify-center gap-[2.5px]" style={{ height: 48 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${h * 100}%`,
            borderRadius: 999,
            background: color,
            opacity: 0.55 + h * 0.45,
            transition: active ? "none" : "height 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ── Orbiting Node ────────────────────────────────────────────────────────────
function OrbitNode({ label, icon: Icon, angle, radius, delay }: {
  label: string; icon: React.ElementType; angle: number; radius: number; delay: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;

  return (
    <motion.div
      className="absolute"
      style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: "translate(-50%, -50%)" }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, type: "spring", stiffness: 200 }}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-white/90 select-none"
        style={{
          background: "rgba(17,43,28,0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(52,211,153,0.25)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}
      >
        <Icon className="w-3 h-3 text-[#34D399]" />
        {label}
      </div>
    </motion.div>
  );
}

// ── The Hero Visual: Live Call Preview Card + Orb ────────────────────────────
function HeroVisual() {
  const [playing, setPlaying] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [transcriptIdx, setTranscriptIdx] = useState(0);
  const [callTime, setCallTime] = useState(47);

  const TRANSCRIPT_LINES = [
    "नमस्ते! मैं क्लेरिटी वॉयस AI से बोल रही हूँ।",
    "Hello! I'm calling to confirm your order #45821.",
    "Your appointment is confirmed for Friday, 3 PM.",
    "I can transfer you to our specialist right now.",
  ];

  useEffect(() => {
    let pos = 0;
    const line = TRANSCRIPT_LINES[transcriptIdx];
    setTranscript("");
    const t = setInterval(() => {
      pos++;
      setTranscript(line.slice(0, pos));
      if (pos >= line.length) {
        clearInterval(t);
        setTimeout(() => {
          setTranscriptIdx(p => (p + 1) % TRANSCRIPT_LINES.length);
        }, 1800);
      }
    }, 38);
    return () => clearInterval(t);
  }, [transcriptIdx]);

  useEffect(() => {
    const t = setInterval(() => setCallTime(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const orbitNodes = [
    { label: "< 180ms", icon: Zap, angle: -65, radius: 200, delay: 0.8 },
    { label: "SOC 2 CERT", icon: Shield, angle: -15, radius: 210, delay: 1.0 },
    { label: "Hindi · EN · AR", icon: Globe, angle: 38, radius: 200, delay: 1.2 },
    { label: "10M+ CALLS/MO", icon: Phone, angle: 95, radius: 215, delay: 1.4 },
    { label: "99.9% UPTIME", icon: Star, angle: 150, radius: 205, delay: 1.6 },
    { label: "HIPAA READY", icon: CheckCircle2, angle: 205, radius: 208, delay: 1.8 },
  ];

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: 560 }}>
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-[80px]"
        style={{ background: "radial-gradient(circle, rgba(5,150,105,0.4) 0%, rgba(17,43,28,0.2) 50%, transparent 70%)" }}
      />

      {/* Orbit rings */}
      <motion.div
        className="absolute w-[420px] h-[420px] rounded-full"
        style={{ border: "1px dashed rgba(52,211,153,0.12)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute w-[320px] h-[320px] rounded-full"
        style={{ border: "1px dashed rgba(52,211,153,0.18)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
      />

      {/* Orbit nodes */}
      {orbitNodes.map((n, i) => <OrbitNode key={i} {...n} />)}

      {/* Main card: Live Call UI */}
      <motion.div
        className="relative z-10 w-[340px] float-bob"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3, type: "spring", stiffness: 100 }}
        style={{
          borderRadius: 28,
          background: "linear-gradient(145deg, #0D2B1C 0%, #112B1C 50%, #0A1F14 100%)",
          border: "1px solid rgba(52,211,153,0.20)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(52,211,153,0.1), inset 0 1px 0 rgba(255,255,255,0.07)",
        }}
      >
        {/* Card top-edge shine */}
        <div className="absolute top-0 left-4 right-4 h-[1px] rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, rgba(52,211,153,0.5), transparent)" }} />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#34D399] live-dot" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#34D399] font-mono">
                LIVE CALL IN PROGRESS
              </span>
            </div>
            <span className="text-[10px] text-white/40 font-mono">{fmt(callTime)}</span>
          </div>

          {/* Caller info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">AR</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Arjun Rao</p>
              <p className="text-xs text-white/45 font-mono">+91 98765 43210 · COD Verification</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 bg-[#34D399]/10 border border-[#34D399]/20 rounded-full px-2.5 py-1">
              <Globe className="w-3 h-3 text-[#34D399]" />
              <span className="text-[9px] font-bold text-[#34D399] font-mono">HINDI</span>
            </div>
          </div>

          {/* Waveform */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4">
            <LiveWaveform active={playing} color="#34D399" barCount={44} />
          </div>

          {/* Transcript */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 font-mono">AI AGENT → LIVE TRANSCRIPT</p>
            <div className="bg-white/[0.04] rounded-xl px-3.5 py-3 border border-white/[0.06] min-h-[48px]">
              <p className="text-xs text-white/75 leading-relaxed">
                {transcript}<span className="animate-pulse">▌</span>
              </p>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-[10px] font-bold text-[#34D399] font-mono">Intent</p>
                <p className="text-[9px] text-white/40">Order Confirm 96%</p>
              </div>
              <div className="w-px h-7 bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] font-bold text-[#34D399] font-mono">Sentiment</p>
                <p className="text-[9px] text-white/40">Positive 😊</p>
              </div>
            </div>
            <button
              onClick={() => setPlaying(p => !p)}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              {playing
                ? <div className="flex gap-0.5"><div className="w-1 h-3 rounded-sm bg-white/80" /><div className="w-1 h-3 rounded-sm bg-white/80" /></div>
                : <Play className="w-3.5 h-3.5 text-white/80 ml-0.5" />
              }
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Rotating headline words ──────────────────────────────────────────────────
const ROTATE_WORDS = ["Human.", "Instant.", "Scalable.", "Compliant.", "Intelligent."];

// ── Main Hero ────────────────────────────────────────────────────────────────
export default function Hero({ setPage }: HeroProps) {
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setWordIdx(p => (p + 1) % ROTATE_WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section
      className="relative overflow-hidden pt-36 pb-16"
      style={{ background: "#F7F5F2" }}
    >
      {/* Mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 15% 8%, rgba(5,150,105,0.07) 0%, transparent 55%),
            radial-gradient(ellipse 55% 45% at 85% 85%, rgba(232,99,10,0.05) 0%, transparent 50%),
            radial-gradient(ellipse 40% 35% at 65% 15%, rgba(52,211,153,0.04) 0%, transparent 45%)
          `,
        }}
      />

      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(13,17,23,1) 1px, transparent 1px), linear-gradient(90deg, rgba(13,17,23,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-6 items-center">

          {/* ── LEFT: Text content ─────────────────────────────────────── */}
          <motion.div
            className="space-y-8 max-w-[600px]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Live badge */}
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border"
                style={{
                  background: "rgba(5,150,105,0.06)",
                  border: "1px solid rgba(5,150,105,0.2)",
                  backdropFilter: "blur(8px)",
                }}>
                <span className="w-2 h-2 rounded-full bg-[#059669] live-dot" />
                <span className="text-[11px] font-bold text-[#059669] uppercase tracking-[0.15em] font-mono">
                  #1 Enterprise AI Voice Platform · Live Now
                </span>
              </div>
            </motion.div>

            {/* Headline */}
            <motion.div variants={itemVariants} className="space-y-2">
              <h1
                className="text-[#0D1117] leading-[0.97]"
                style={{
                  fontFamily: "'Clash Display', sans-serif",
                  fontSize: "clamp(48px, 6.5vw, 84px)",
                  fontWeight: 700,
                  letterSpacing: "-0.035em",
                }}
              >
                AI Voice Agents<br />
                That Sound&nbsp;
              </h1>
              {/* Rotating word */}
              <div className="overflow-hidden" style={{ height: "clamp(52px, 7vw, 92px)" }}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={wordIdx}
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: "0%", opacity: 1 }}
                    exit={{ y: "-100%", opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="block gradient-text-green"
                    style={{
                      fontFamily: "'Clash Display', sans-serif",
                      fontSize: "clamp(48px, 6.5vw, 84px)",
                      fontWeight: 700,
                      letterSpacing: "-0.035em",
                      lineHeight: 1.0,
                    }}
                  >
                    {ROTATE_WORDS[wordIdx]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Body */}
            <motion.p
              variants={itemVariants}
              className="text-[#4B5563] leading-[1.65] max-w-[480px]"
              style={{ fontSize: 17 }}
            >
              The world's fastest AI voice calling platform — sub-180ms latency, 70+ languages, zero setup overhead. Replace your IVR, qualify leads, and handle collections automatically.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-4 items-center">
              <button onClick={() => setPage("dashboard")} className="btn-primary text-[15px] px-7 py-3.5">
                Build Your First AI Agent — Free
                <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => setPage("how-it-works")}
                className="flex items-center gap-2 text-[15px] font-semibold text-[#0D1117] hover:text-[#059669] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E8E2D9] flex items-center justify-center shadow-sm">
                  <Play className="w-3.5 h-3.5 text-[#059669] ml-0.5" />
                </div>
                Watch Platform Demo
              </button>
            </motion.div>

            {/* Trust stats */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-6 pt-2">
              {[
                { v: "10M+", l: "Calls monthly" },
                { v: "<180ms", l: "Voice latency" },
                { v: "500+", l: "Enterprises" },
                { v: "70+", l: "Languages" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[22px] font-extrabold text-[#0D1117] leading-none"
                    style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    {s.v}
                  </span>
                  <span className="text-[12px] text-[#9CA3AF] mt-1 font-medium">{s.l}</span>
                </div>
              ))}
            </motion.div>

            {/* Compliance strip */}
            <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
              {["SOC 2 TYPE II", "HIPAA BAA", "ISO 27001", "PCI-DSS", "GDPR"].map((b) => (
                <span key={b}
                  className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] font-mono">
                  <CheckCircle2 className="w-3 h-3 text-[#059669]" />
                  {b}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* ── RIGHT: Live Call Visual ────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <HeroVisual />
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="flex justify-center mt-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="flex flex-col items-center gap-2 text-[#9CA3AF]"
          style={{ animation: "scrollBounce 2s ease-in-out infinite" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] font-mono">Scroll to explore</span>
          <div className="w-px h-8 rounded-full bg-gradient-to-b from-[#9CA3AF] to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}

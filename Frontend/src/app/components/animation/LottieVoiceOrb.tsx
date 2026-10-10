import React, { useState, useEffect, useRef } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { voiceOrbLottieData } from "./lottieVoiceData";
import { 
  Play, Pause, Sparkles, Volume2, Radio, Zap, Shield, 
  MessageSquare, RefreshCw, Activity, ArrowRight, Mic, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LottieVoiceOrbProps {
  className?: string;
  onExploreClick?: () => void;
}

export default function LottieVoiceOrb({ className = "", onExploreClick }: LottieVoiceOrbProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeScenario, setActiveScenario] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const [dialogueIndex, setDialogueIndex] = useState(0);

  const scenarios = [
    {
      id: "cod",
      title: "COD Confirmation",
      tag: "E-COMMERCE · 174ms",
      caller: "Rohan (Customer)",
      agent: "Claritiy Voice Agent",
      dialogue: [
        { speaker: "agent", text: "Namaste Rohan ji! Claritiy se calling. Aapka linen shirt COD order ₹2,499 confirm karna tha?" },
        { speaker: "caller", text: "Haan confirm hai! But please Thursday ko deliver karna." },
        { speaker: "agent", text: "Done! Thursday delivery mark kar di hai. Tracking SMS bhej diya hai!" }
      ],
      metrics: { latency: "168ms", accuracy: "99.8%", vad: "18ms" }
    },
    {
      id: "clinic",
      title: "Clinic Receptionist",
      tag: "HEALTHCARE · 178ms",
      caller: "Dr. Sharma's Patient",
      agent: "Clinic Intake AI",
      dialogue: [
        { speaker: "caller", text: "Hi, do you have an opening for a root canal checkup tomorrow at 4 PM?" },
        { speaker: "agent", text: "Yes! Dr. Sharma has a 4:15 PM slot available. Shall I reserve that for you?" },
        { speaker: "caller", text: "Perfect, please book it under Ananya." }
      ],
      metrics: { latency: "178ms", accuracy: "99.9%", vad: "20ms" }
    },
    {
      id: "bfsi",
      title: "EMI Pre-Due Reminder",
      tag: "BFSI & FINTECH · 172ms",
      caller: "Priya (Borrower)",
      agent: "Recovery Specialist",
      dialogue: [
        { speaker: "agent", text: "Namaste Priya ji! Claritiy Finance se reminder hai, aapka ₹4,200 EMI due date 12th ko hai." },
        { speaker: "caller", text: "Main kal pay kar dungi. Can you send the UPI link on WhatsApp?" },
        { speaker: "agent", text: "Bilkul! Link abhi aapke WhatsApp par send kar diya hai. Thank you!" }
      ],
      metrics: { latency: "172ms", accuracy: "100%", vad: "15ms" }
    }
  ];

  // Rotate simulated dialogue turns smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setDialogueIndex((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeScenario]);

  const togglePlayback = () => {
    if (isPlaying) {
      lottieRef.current?.pause();
      setIsPlaying(false);
    } else {
      lottieRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleSpeedToggle = () => {
    const nextSpeed = speed === 1 ? 1.5 : 1;
    setSpeed(nextSpeed);
    lottieRef.current?.setSpeed(nextSpeed);
  };

  const current = scenarios[activeScenario];

  return (
    <div className={`relative rounded-3xl bg-[#0D1117] text-white p-6 md:p-8 border border-slate-800 shadow-2xl overflow-hidden font-plus-jakarta ${className}`}>
      
      {/* ── Background Glow Accents ───────────────────────────────────────── */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#059669]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[#F59E0B]/15 rounded-full blur-3xl pointer-events-none" />
      
      {/* ── Top Header Deck ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold tracking-tight text-white font-mono uppercase">
                Interactive Voice AI Simulator
              </h3>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                60 FPS LOTTIE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Live neural audio synthesis running on loop · Real-time sub-180ms WebRTC
            </p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleSpeedToggle}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono font-bold text-slate-300 border border-slate-700/60 transition-colors"
            title="Toggle playback speed"
          >
            {speed}x SPEED
          </button>
          
          <button
            onClick={togglePlayback}
            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all flex items-center justify-center"
            title={isPlaying ? "Pause animation loop" : "Play animation loop"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-emerald-400" />}
          </button>
        </div>
      </div>

      {/* ── Scenario Selection Chips ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-5 pb-4 overflow-x-auto no-scrollbar relative z-10">
        {scenarios.map((sc, idx) => (
          <button
            key={sc.id}
            onClick={() => {
              setActiveScenario(idx);
              setDialogueIndex(0);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 border ${
              activeScenario === idx
                ? "bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20"
                : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span>{sc.title}</span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
              activeScenario === idx ? "bg-black/20 text-black" : "bg-slate-800 text-slate-400"
            }`}>
              {sc.metrics.latency}
            </span>
          </button>
        ))}
      </div>

      {/* ── Main Animation Stage & Live Conversation Deck ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-4 relative z-10">
        
        {/* Left: The Beautiful Looping Lottie Voice Orb */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
            {/* Ambient Radial Bloom behind Orb */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-emerald-500/30 via-teal-500/20 to-amber-500/20 blur-2xl animate-pulse pointer-events-none" />
            
            {/* Lottie Animation Canvas */}
            <Lottie
              lottieRef={lottieRef}
              animationData={voiceOrbLottieData}
              loop={true}
              autoplay={true}
              className="w-full h-full relative z-10 cursor-pointer drop-shadow-[0_0_35px_rgba(5,150,105,0.4)]"
              onClick={togglePlayback}
            />

            {/* Center Floating Status Badge */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-slate-950/90 backdrop-blur-md border border-emerald-500/40 px-3 py-1 rounded-full text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1.5 shadow-lg whitespace-nowrap">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>{current.metrics.latency} Latency</span>
            </div>
          </div>

          <div className="text-center mt-2">
            <span className="text-[11px] font-mono text-slate-400">
              Interactive Neural Speech Sphere (Click to toggle)
            </span>
          </div>
        </div>

        {/* Right: Live Dialogue Simulator & Real-Time Telemetry */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Live Conversational Speech Bubble */}
          <div className="bg-slate-900/90 rounded-2xl p-4.5 border border-slate-800/80 space-y-3 min-h-[160px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-2 border-b border-slate-800">
              <span className="text-emerald-400 font-bold">{current.tag}</span>
              <span>Turn {dialogueIndex + 1} of 3</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeScenario}-${dialogueIndex}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-2 py-1"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                    current.dialogue[dialogueIndex].speaker === "agent"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                  }`}>
                    {current.dialogue[dialogueIndex].speaker === "agent" ? "AI" : "User"}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                    "{current.dialogue[dialogueIndex].text}"
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Turn Indicators */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    onClick={() => setDialogueIndex(i)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      dialogueIndex === i ? "w-6 bg-emerald-400" : "w-2 bg-slate-700"
                    }`}
                  />
                ))}
              </div>
              <span>Click bars to jump dialogue turn</span>
            </div>
          </div>

          {/* Real-Time Telemetry Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-[10px] font-mono text-slate-400 block">VAD BARGE-IN</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{current.metrics.vad}</span>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-[10px] font-mono text-slate-400 block">INTENT ACCURACY</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{current.metrics.accuracy}</span>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
              <span className="text-[10px] font-mono text-slate-400 block">TELEPHONY COST</span>
              <span className="text-sm font-mono font-bold text-amber-400">₹3.99/min</span>
            </div>
          </div>

        </div>

      </div>

      {/* ── Bottom Deck CTA Bar ─────────────────────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 relative z-10">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Indistinguishable from a polite human representative</span>
        </div>

        {onExploreClick && (
          <button
            onClick={onExploreClick}
            className="inline-flex items-center gap-1.5 font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>Explore All 15 Telephony Templates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

    </div>
  );
}

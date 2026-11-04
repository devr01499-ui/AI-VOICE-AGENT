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
    <div className={`relative rounded-[2px] bg-[#EBE9E2] text-[#121212] p-6 md:p-8 border border-[#CBC8BE] overflow-hidden font-sans ${className}`}>
      
      {/* ── Top Header Deck ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#CBC8BE] relative z-10">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#121212] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#121212]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-medium tracking-tight text-[#121212] font-mono uppercase">
                Interactive Voice AI Simulator
              </h3>
              <span className="text-[10px] font-mono font-medium text-[#121212] bg-[#DFDCD4] border border-[#CBC8BE] px-2 py-0.5 rounded-[2px]">
                60 FPS LOTTIE
              </span>
            </div>
            <p className="text-xs text-[#262523] font-sans mt-0.5">
              Live neural audio synthesis running on loop · Real-time sub-180ms WebRTC
            </p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleSpeedToggle}
            className="px-2.5 py-1.5 rounded-[2px] bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[11px] font-mono font-medium text-[#121212] border border-[#CBC8BE] transition-colors cursor-pointer"
            title="Toggle playback speed"
          >
            {speed}x SPEED
          </button>
          
          <button
            onClick={togglePlayback}
            className="p-2 rounded-[2px] bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] border border-[#CBC8BE] transition-all flex items-center justify-center cursor-pointer"
            title={isPlaying ? "Pause animation loop" : "Play animation loop"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-[#121212]" />}
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
            className={`px-3.5 py-2 rounded-[2px] text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 border cursor-pointer ${
              activeScenario === idx
                ? "bg-[#121212] text-white border-[#121212]"
                : "bg-[#DFDCD4] text-[#121212] border-[#CBC8BE] hover:bg-[#D5D1C7]"
            }`}
          >
            <span>{sc.title}</span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-[1px] ${
              activeScenario === idx ? "bg-[#262523] text-white" : "bg-[#CBC8BE] text-[#121212]"
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
            {/* Lottie Animation Canvas */}
            <Lottie
              lottieRef={lottieRef}
              animationData={voiceOrbLottieData}
              loop={true}
              autoplay={true}
              className="w-full h-full relative z-10 cursor-pointer"
              onClick={togglePlayback}
            />

            {/* Center Floating Status Badge */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-[#DFDCD4] border border-[#CBC8BE] px-2.5 py-1 rounded-[2px] text-[10px] font-mono text-[#121212] flex items-center gap-1.5 shadow-sm whitespace-nowrap">
              <Zap className="w-3 h-3 text-[#121212]" />
              <span>{current.metrics.latency} Latency</span>
            </div>
          </div>

          <div className="text-center mt-2">
            <span className="text-[11px] font-mono text-[#262523]">
              Interactive Neural Speech Sphere (Click to toggle)
            </span>
          </div>
        </div>

        {/* Right: Live Dialogue Simulator & Real-Time Telemetry */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Live Conversational Speech Bubble */}
          <div className="bg-[#DFDCD4] rounded-[2px] p-5 border border-[#CBC8BE] space-y-3 min-h-[160px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#262523] font-mono pb-2 border-b border-[#CBC8BE]">
              <span className="text-[#121212] font-bold">{current.tag}</span>
              <span>Turn {dialogueIndex + 1} of 3</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeScenario}-${dialogueIndex}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 py-1"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-[2px] flex items-center justify-center font-bold text-[10px] font-mono flex-shrink-0 bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212]">
                    {current.dialogue[dialogueIndex].speaker === "agent" ? "AI" : "User"}
                  </div>
                  <p className="text-xs sm:text-sm text-[#121212] leading-relaxed font-sans font-medium">
                    "{current.dialogue[dialogueIndex].text}"
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Turn Indicators */}
            <div className="flex items-center justify-between pt-2 border-t border-[#CBC8BE] text-[10px] font-mono text-[#262523]">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    onClick={() => setDialogueIndex(i)}
                    className={`h-1.5 rounded-[1px] transition-all cursor-pointer ${
                      dialogueIndex === i ? "w-6 bg-[#121212]" : "w-2 bg-[#CBC8BE]"
                    }`}
                  />
                ))}
              </div>
              <span>Click bars to jump dialogue turn</span>
            </div>
          </div>

          {/* Real-Time Telemetry Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#DFDCD4] p-3 rounded-[2px] border border-[#CBC8BE]">
              <span className="text-[10px] font-mono text-[#262523] block uppercase tracking-wider">VAD BARGE-IN</span>
              <span className="text-sm font-mono font-bold text-[#121212]">{current.metrics.vad}</span>
            </div>

            <div className="bg-[#DFDCD4] p-3 rounded-[2px] border border-[#CBC8BE]">
              <span className="text-[10px] font-mono text-[#262523] block uppercase tracking-wider">INTENT ACCURACY</span>
              <span className="text-sm font-mono font-bold text-[#121212]">{current.metrics.accuracy}</span>
            </div>

            <div className="bg-[#DFDCD4] p-3 rounded-[2px] border border-[#CBC8BE]">
              <span className="text-[10px] font-mono text-[#262523] block uppercase tracking-wider">TELEPHONY COST</span>
              <span className="text-sm font-mono font-bold text-[#121212]">₹3.99/min</span>
            </div>
          </div>

        </div>

      </div>

      {/* ── Bottom Deck CTA Bar ─────────────────────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-[#CBC8BE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#262523] relative z-10">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-[#121212]" />
          <span>Indistinguishable from a polite human representative</span>
        </div>

        {onExploreClick && (
          <button
            onClick={onExploreClick}
            className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#121212] underline hover:no-underline cursor-pointer"
          >
            <span>Explore All 15 Telephony Templates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

    </div>
  );
}

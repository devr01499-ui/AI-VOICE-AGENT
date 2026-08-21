import { motion } from "motion/react";
import { useState } from "react";
import VoiceGallery from "../components/audio/VoiceGallery";
import { 
  Mic, Globe, Sparkles, Volume2, AudioWaveform, ShieldCheck, ArrowRight,
  Eye, Code2, Cpu, Sliders, CheckCircle2
} from "lucide-react";

type Page = any;

interface VoicesProps {
  setPage: (p: Page) => void;
}

// ── SVG Geometric Background Accent ─────────────────────────────────────────────
function GeometricGridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="grid-voices" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="1,4" />
            <circle cx="20" cy="20" r="1.5" fill="#059669" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-voices)" />
      </svg>
    </div>
  );
}

export default function Voices({ setPage }: VoicesProps) {
  const [viewMode, setViewMode] = useState<"non-tech" | "tech">("non-tech");

  const acousticSpecs = [
    { label: "AUDIO FORMAT & CODEC", value: "audio/x-l16 (16kHz 16-bit PCM)", tech: "Uncompressed raw PCM buffer egress over SRTP zero-copy transport." },
    { label: "REGIONAL BCP-47 MATRICES", value: "70+ Dialects & Accents", tech: "Native phoneme alignment across hi-IN, bn-IN, gu-IN, kn-IN, ta-IN, mr-IN, en-US/IN." },
    { label: "VOICE CLONING TIME", value: "5 Seconds (Zero-Shot Diffusion)", tech: "Encoder vector embedding mapping acoustic timbre & prosody from 5s sample." },
    { label: "BARGE-IN DSP DURATION", value: "20ms Speech Interception Window", tech: "Full-duplex VAD window with adaptive energy thresholding at -42dB." }
  ];

  return (
    <div className="space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen relative">
      <GeometricGridBackground />
      
      {/* Hero Header */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase">
          <AudioWaveform className="w-3.5 h-3.5" />
          HD ACOUSTIC VOICE GALLERY
        </div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
        >
          26+ HD Voice Personas & 70+ Regional Dialects
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-600 text-lg md:text-xl max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          Experience hyper-realistic neural voice synthesis with native emotion, micro-pauses, pitch modulation, and regional accents across global and Indian markets.
        </motion.p>

        {/* View Switcher */}
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
              <Eye className="w-4 h-4" /> Non-Tech Sound Overview
            </button>
            <button
              onClick={() => setViewMode("tech")}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "tech"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Code2 className="w-4 h-4" /> Acoustic DSP Specs
            </button>
          </div>
        </div>
      </section>

      {/* Voice Player Gallery Component */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <VoiceGallery setPage={setPage} />
      </section>

      {/* Regional Dialects & Acoustic Specifications Grid */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-[#0B132B] text-white rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              NATIVE SPEECH SYNTHESIS ARCHITECTURE
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              BCP-47 Regional Dialects & Acoustic Precision
            </h2>
            <p className="text-slate-300 text-sm font-plus-jakarta">
              Claritiy Voice speech models are trained natively on regional speech matrices, eliminating awkward machine translations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-3">
              <Globe className="w-8 h-8 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">70+ Regional Languages</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-plus-jakarta">
                Native speech models for <code>hi-IN</code> (Hindi), <code>bn-IN</code> (Bengali), <code>gu-IN</code> (Gujarati), <code>kn-IN</code> (Kannada), <code>ml-IN</code> (Malayalam), <code>mr-IN</code> (Marathi), <code>ta-IN</code> (Tamil), English (US/UK/IN), Arabic, and Mandarin.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-3">
              <Sparkles className="w-8 h-8 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Emotional Pitch Cadence</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-plus-jakarta">
                Conversational tone modulates dynamically — reassuring for clinic receptionists, authoritative for security checks, or energetic for sales qualification calls.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-3">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">5-Second Voice Cloning</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-plus-jakarta">
                Enterprise teams can clone custom brand voices from a 5-second clean audio sample to maintain consistent vocal branding across all outbound campaigns.
              </p>
            </div>
          </div>

          {/* Technical Acoustic Specs Grid */}
          {viewMode === "tech" && (
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <h4 className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest">
                // ACOUSTIC DSP & TIMBRE SPECIFICATIONS
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {acousticSpecs.map((spec) => (
                  <div key={spec.label} className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">{spec.label}</span>
                    <p className="text-emerald-400 text-sm font-bold">{spec.value}</p>
                    <p className="text-slate-400 text-xs font-sans">{spec.tech}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 text-center border-t border-slate-800">
            <button
              onClick={() => setPage("dashboard")}
              className="btn-primary py-3.5 px-8 text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-bold inline-flex items-center gap-2"
            >
              Test Voice Personas In Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}

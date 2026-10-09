import { motion } from "motion/react";
import React, { useState } from "react";
import VoiceGallery from "../components/audio/VoiceGallery";
import { 
  Mic, Globe, Sparkles, Volume2, AudioWaveform, ShieldCheck, ArrowRight,
  Cpu, Sliders, CheckCircle2, Play, Radio, Activity, Music, Waves
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

// ── Animated Sound Wave Widget ─────────────────────────────────────────────────
function LiveSoundWaveVisualizer() {
  return (
    <div className="flex items-center justify-center gap-1.5 h-10 py-2">
      {[12, 24, 38, 18, 30, 42, 26, 34, 16, 28, 40, 22, 36, 14, 32, 20].map((height, i) => (
        <motion.div
          key={i}
          animate={{
            height: [height * 0.4, height, height * 0.3],
          }}
          transition={{
            duration: 1.2 + (i % 4) * 0.2,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
          className="w-1 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-full"
        />
      ))}
    </div>
  );
}

export default function Voices({ setPage }: VoicesProps) {
  const acousticSpecs = [
    { label: "AUDIO FORMAT & CODEC", value: "audio/x-l16 (16kHz 16-bit PCM)", tech: "Uncompressed raw PCM buffer egress over SRTP zero-copy transport." },
    { label: "REGIONAL BCP-47 MATRICES", value: "70+ Dialects & Accents", tech: "Native phoneme alignment across hi-IN, bn-IN, gu-IN, kn-IN, ta-IN, mr-IN, en-US/IN." },
    { label: "VOICE CLONING SPEED", value: "5 Seconds (Zero-Shot Diffusion)", tech: "Encoder vector embedding mapping acoustic timbre & prosody from 5s sample." },
    { label: "BARGE-IN DSP DURATION", value: "20ms Speech Interception Window", tech: "Full-duplex VAD window with adaptive energy thresholding at -42dB." }
  ];

  const tonePersonas = [
    {
      role: "Empathetic Healthcare & Dental",
      tone: "Calm, Gentle, Reassuring",
      desc: "Designed for clinic receptionists and pre-op reminders. Speaks slowly, provides clear triage instructions, and comforts anxious patients.",
      badge: "Medical Grade"
    },
    {
      role: "Executive B2B & Real Estate",
      tone: "Crisp, Articulate, Confident",
      desc: "Tailored for high-ticket property qualification and enterprise SDR calls. Commands attention without aggressive sales pressure.",
      badge: "Commercial SDR"
    },
    {
      role: "Ethical BFSI Payment Outreach",
      tone: "Respectful, Firm, Polite",
      desc: "Engineered strictly under RBI Fair Practices Code. Clarifies EMI dates and dispatches UPI payment links without shame or guilt tactics.",
      badge: "RBI Compliant"
    },
    {
      role: "Rapid E-Commerce COD Verification",
      tone: "Warm, Conversational, Friendly",
      desc: "Speaks local colloquial Hindi/Hinglish to verify courier landmarks within 60 seconds of checkout and encourage prepaid upgrades.",
      badge: "RTO Defense"
    }
  ];

  const languages = [
    { code: "hi-IN", name: "Hindi (हिंदी)", region: "North & Central India", sample: "नमस्ते, आपकी डिलीवरी के बारे में कॉल है..." },
    { code: "en-IN", name: "Indian English", region: "Pan-India Corporate", sample: "Hello, calling to confirm your appointment..." },
    { code: "bn-IN", name: "Bengali (বাংলা)", region: "West Bengal & East India", sample: "নমস্কার, আপনার অর্ডার নিশ্চিত করতে কল..." },
    { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)", region: "Karnataka & Bengaluru", sample: "ನಮಸ್ಕಾರ, ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬಗ್ಗೆ..." },
    { code: "ta-IN", name: "Tamil (தமிழ்)", region: "Tamil Nadu & Chennai", sample: "வணக்கம், உங்கள் ஆர்டர் விவரங்களை..." },
    { code: "gu-IN", name: "Gujarati (ગુજરાતી)", region: "Gujarat & Western Trade", sample: "નમસ્તે, તમારા ઓર્ડરની ચકાસણી માટે..." },
    { code: "mr-IN", name: "Marathi (मराठी)", region: "Maharashtra & Mumbai", sample: "नमस्कार, तुमच्या डिलिव्हरीच्या संदर्भात..." },
    { code: "ml-IN", name: "Malayalam (മലയാളം)", region: "Kerala", sample: "നമസ്കാരം, നിങ്ങളുടെ ഓർഡർ സംബന്ധിച്ച്..." }
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
          <AudioWaveform className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          HD ACOUSTIC VOICE GALLERY & DIALECTS
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
        >
          26+ HD Voice Personas & 70+ Regional Dialects
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-600 text-lg md:text-xl max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          Hyper-realistic neural voice synthesis with natural human breath pauses, pitch modulation, and dialect authenticity across global and regional Indian languages.
        </motion.p>

        {/* Live Soundwave Visualizer */}
        <div className="pt-2">
          <LiveSoundWaveVisualizer />
        </div>
      </section>

      {/* ── Voice Player Gallery ────────────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <VoiceGallery setPage={setPage} />
      </section>

      {/* ── Emotional Pitch & Persona Cadence ────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-widest">
            TONAL DYNAMICS & PERSONAS
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Emotionally Tuned For Each Business Scenario
          </h2>
          <p className="text-slate-500 text-sm">
            AI voices shouldn't sound like monotone robots. Claritiy Voice modulates pitch, speed, and warmth to match the gravity of the call.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tonePersonas.map((p, idx) => (
            <motion.div
              key={p.role}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl p-7 shadow-sm hover:shadow-xl hover:border-emerald-500/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md border border-emerald-200 uppercase">
                    {p.badge}
                  </span>
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-lg text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {p.role}
                </h3>
                <p className="text-xs font-mono text-emerald-700 font-semibold">{p.tone}</p>
                <p className="text-xs text-slate-500 leading-relaxed font-plus-jakarta">
                  {p.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Regional Indian Languages Matrix ─────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-widest">
            REGIONAL PHONEMIC AUTHENTICITY
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Native Accents Without Machine Translation Lag
          </h2>
          <p className="text-slate-500 text-sm">
            Speech models are trained natively on regional speech matrices, understanding local colloquialisms and pincodes effortlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {languages.map((lang) => (
            <div key={lang.code} className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm space-y-2 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-[#0D1117]">{lang.name}</span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{lang.code}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 block">{lang.region}</span>
              <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-plus-jakarta">
                "{lang.sample}"
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Integrated Acoustic DSP & Timbre Specifications ──────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-[#0B132B] text-white rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800 space-y-10 relative overflow-hidden">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              ACOUSTIC TIMBRE & HARDWARE SPECS
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Acoustic DSP Specifications
            </h2>
            <p className="text-slate-300 text-sm font-plus-jakarta">
              Full technical breakdown of packet format, jitter buffering, and speech interruption thresholds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acousticSpecs.map((spec) => (
              <div key={spec.label} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 font-mono space-y-1.5 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold block">{spec.label}</span>
                <p className="text-emerald-400 text-sm font-bold">{spec.value}</p>
                <p className="text-slate-400 text-xs font-sans leading-relaxed">{spec.tech}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 text-center border-t border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setPage("dashboard")}
              className="py-3.5 px-8 text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl inline-flex items-center gap-2 shadow-lg cursor-pointer"
            >
              Test Voice Personas in Sandbox <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage("contact")}
              className="py-3.5 px-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl inline-flex items-center gap-2 border border-slate-700 cursor-pointer"
            >
              Request Custom Voice Clone
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

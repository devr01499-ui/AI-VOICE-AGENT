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
    <div className="space-y-20 pb-32 pt-28 bg-[#E5E3DC] min-h-screen relative font-sans text-[#121212]">
      
      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
        <div className="hatched-strip h-10 w-full mb-8" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono uppercase tracking-wider">
          <span>|</span>
          <span>HD Acoustic Voice Gallery & Dialects</span>
        </div>

        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl lg:text-6xl font-normal md:font-medium text-[#121212] tracking-tight leading-[1.08] font-sans"
        >
          26+ HD Voice Personas & 70+ Regional Dialects
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[#262523] text-base md:text-lg max-w-3xl mx-auto font-sans leading-relaxed"
        >
          Hyper-realistic neural voice synthesis with natural human breath pauses, pitch modulation, and dialect authenticity across global and regional Indian languages.
        </motion.p>
      </section>

      {/* ── Voice Player Gallery ────────────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <VoiceGallery setPage={setPage} />
      </section>

      {/* ── Emotional Pitch & Persona Cadence ────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
            | TONAL DYNAMICS & PERSONAS
          </span>
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
            Emotionally Tuned For Each Business Scenario
          </h2>
          <p className="text-[#262523] text-sm font-sans">
            AI voices shouldn't sound like monotone robots. Claritiy Voice modulates pitch, speed, and warmth to match the gravity of the call.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tonePersonas.map((p) => (
            <div
              key={p.role}
              className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 hover:border-[#9C998F] transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-medium bg-[#DFDCD4] text-[#121212] px-2.5 py-1 rounded-[1px] border border-[#CBC8BE] uppercase">
                    {p.badge}
                  </span>
                  <Activity className="w-4 h-4 text-[#121212]" />
                </div>
                <h3 className="font-medium text-base text-[#121212] font-sans">
                  {p.role}
                </h3>
                <p className="text-xs font-mono text-[#121212] font-semibold">{p.tone}</p>
                <p className="text-xs text-[#262523] leading-relaxed font-sans">
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Regional Indian Languages Matrix ─────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
            | REGIONAL PHONEMIC AUTHENTICITY
          </span>
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
            Native Accents Without Machine Translation Lag
          </h2>
          <p className="text-[#262523] text-sm font-sans">
            Speech models are trained natively on regional speech matrices, understanding local colloquialisms and pincodes effortlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {languages.map((lang) => (
            <div key={lang.code} className="bg-[#EBE9E2] p-5 rounded-[2px] border border-[#CBC8BE] space-y-2 hover:border-[#9C998F] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-[#121212] font-sans">{lang.name}</span>
                <span className="text-[10px] font-mono text-[#121212] bg-[#DFDCD4] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE]">{lang.code}</span>
              </div>
              <span className="text-[11px] font-mono text-[#262523] block">{lang.region}</span>
              <p className="text-xs text-[#262523] italic bg-[#DFDCD4] p-2.5 rounded-[2px] border border-[#CBC8BE] font-sans">
                "{lang.sample}"
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Integrated Acoustic DSP & Timbre Specifications ──────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-8 md:p-12 border border-[#CBC8BE] space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
              | ACOUSTIC TIMBRE & HARDWARE SPECS
            </span>
            <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
              Acoustic DSP Specifications
            </h2>
            <p className="text-[#262523] text-sm font-sans">
              Full technical breakdown of packet format, jitter buffering, and speech interruption thresholds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acousticSpecs.map((spec) => (
              <div key={spec.label} className="bg-[#DFDCD4] p-5 rounded-[2px] border border-[#CBC8BE] font-mono space-y-1.5">
                <span className="text-[10px] text-[#262523] uppercase tracking-wider font-bold block">{spec.label}</span>
                <p className="text-[#121212] text-sm font-bold">{spec.value}</p>
                <p className="text-[#262523] text-xs font-sans leading-relaxed">{spec.tech}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 text-center border-t border-[#CBC8BE] flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setPage("dashboard")}
              className="py-3 px-8 text-xs font-mono uppercase tracking-wider bg-[#121212] hover:bg-black text-white font-medium rounded-[2px] inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              Test Voice Personas in Sandbox <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage("contact")}
              className="py-3 px-8 text-xs font-mono uppercase tracking-wider bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] font-medium rounded-[2px] inline-flex items-center gap-2 border border-[#CBC8BE] cursor-pointer transition-colors"
            >
              Request Custom Voice Clone
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

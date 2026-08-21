import { motion } from "motion/react";
import VoiceGallery from "../components/audio/VoiceGallery";
import { Mic, Globe, Sparkles, Volume2, AudioWaveform, ShieldCheck, ArrowRight } from "lucide-react";

type Page = any;

interface VoicesProps {
  setPage: (p: Page) => void;
}

export default function Voices({ setPage }: VoicesProps) {
  return (
    <div className="space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen">
      
      {/* Hero Header */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
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
      </section>

      {/* Voice Player Gallery Component */}
      <section className="px-6 max-w-7xl mx-auto">
        <VoiceGallery setPage={setPage} />
      </section>

      {/* Regional Dialects & Acoustic Specifications Grid */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-14 shadow-2xl border border-slate-800 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              NATIVE SPEECH SYNTHESIS
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


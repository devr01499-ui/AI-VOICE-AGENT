import { motion } from "motion/react";
import VoiceGallery from "../components/audio/VoiceGallery";

type Page = 
  | "home" 
  | "solutions" 
  | "how-it-works" 
  | "voices" 
  | "pricing" 
  | "compare" 
  | "blog" 
  | "blog-rto" 
  | "blog-healthcare" 
  | "blog-fintech" 
  | "docs" 
  | "dashboard" 
  | "industries";

interface VoicesProps {
  setPage: (p: Page) => void;
}

export default function Voices({ setPage }: VoicesProps) {
  return (
    <div className="space-y-12 pb-20 pt-10 text-slate-600">
      <section className="px-6 max-w-5xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs font-semibold text-cyan-600 tracking-widest uppercase mb-4 font-mono">
            Vocal Capabilities
          </p>
          <h1 className="font-sora text-5xl lg:text-6xl font-extrabold leading-tight text-[#0F172A] tracking-tight">
            Voices That Express Real Emotion, Natural Pauses, and Native Accents
          </h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto mt-6 leading-relaxed font-plus-jakarta font-semibold">
            Listen to native Gemini voice synthesis, and select the perfect conversational tone to connect with your callers.
          </p>
        </motion.div>
      </section>

      {/* Voice grid gallery switcher */}
      <section className="px-6 max-w-7xl mx-auto">
        <VoiceGallery setPage={setPage} />
      </section>
    </div>
  );
}

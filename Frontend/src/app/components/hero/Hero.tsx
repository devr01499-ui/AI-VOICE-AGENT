import { useState, useEffect, useRef } from "react";
import { Mic, ArrowRight, Bot, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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

interface HeroProps {
  setPage: (p: Page) => void;
}

// ─── Transcript Map ──────────────────────────────────────────────────────────
const TRANSCRIPT_MAP: Record<string, { agent: string; user: string }> = {
  en: { agent: "Hello, how are you, glad to see you here. I hope I will be useful for you.", user: "Yes, I am doing great! Thanks for calling." },
  hi: { agent: "नमस्ते, आप कैसे हैं? आपसे यहाँ मिलकर बहुत खुशी हुई। मुझे आशा है कि मैं आपके लिए उपयोगी रहूँगा।", user: "हाँ, मैं ठीक हूँ। ऑर्डर कन्फर्म कर दीजिए।" },
  bn: { agent: "হ্যালো, আপনি কেমন আছেন? এখানে আপনাকে দেখে খুব ভালো লাগলো। আশা করি আমি আপনার কাজে আসব।", user: "হ্যাঁ, আমি ভালো আছি। অর্ডার পাঠিয়ে দিন।" },
  kn: { agent: "ನಮಸ್ಕಾರ, ಹೇಗಿದ್ದೀರಾ? ನಿಮ್ಮನ್ನು ಇಲ್ಲಿ ನೋಡಿ ಸಂತೋಷವಾಯಿತು. ನಾನು ನಿಮಗೆ ಉಪಯುಕ್ತವಾಗಬಲ್ಲೆ ಎಂದು ಭಾವಿಸುತ್ತೇನೆ.", user: "ಹೌದು, ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ. ಧನ್ಯವಾದಗಳು।" },
  ml: { agent: "ഹലോ, സുഖമാണോ? നിങ്ങളെ ഇവിടെ കണ്ടതിൽ സന്തോഷം. ഞാൻ നിങ്ങൾക്ക് ഉപകാരപ്പെടുമെന്ന് പ്രതീക്ഷിക്കുന്നു.", user: "അതെ, സുഖമാണ്. ഓർഡർ സ്ഥിരീകരിക്കുക." },
  gu: { agent: "નમસ્તે, તમે કેમ છો? તમને અહીં મળીને આનંદ થયો. મને આશા છે કે હું તમારા માટે ઉપયોગી થઈશ.", user: "હા, હું મજામાં છું. ઓર્ડર મોકલી આપો." },
  zh: { agent: "您好，您怎么样？很高兴在这里见到您。希望我能对您有所帮助。", user: "您好，我很好。请确认我的订单。" },
  ar: { agent: "مرحباً، كيف حالك؟ يسعدني رؤيتك هنا. أتمنى أن أكون مفيداً لك.", user: "أهلاً بك، أنا بخير. يرجى تأكيد الطلب." }
};

// ─── Custom Animated Waveform to Checkmark (Simulating Lottie) ──────────────
function AnimatedWaveformCheck() {
  const [phase, setPhase] = useState<'wave' | 'check'>('wave');

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase(p => p === 'wave' ? 'check' : 'wave');
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-24 h-24 mx-auto relative flex items-center justify-center">
      <AnimatePresence mode="wait">
        {phase === 'wave' ? (
          <motion.div
            key="wave"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 h-12"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-mint-primary rounded-pill"
                animate={{
                  height: ["20%", "100%", "20%"],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="check"
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="w-12 h-12 bg-mint-primary rounded-full flex items-center justify-center text-forest-deep shadow-level-2"
          >
            <Check className="w-6 h-6 stroke-[3]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Pulsing Audio Sphere Component ──────────────────────────────────────────
function AudioSphere({ active }: { active: boolean }) {
  return (
    <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
      {/* Outer pulsing rings */}
      <motion.div
        animate={active ? { scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] } : { scale: 1, opacity: 0.1 }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-mint-primary blur-xl"
      />
      <motion.div
        animate={active ? { scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] } : { scale: 1, opacity: 0.2 }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        className="absolute inset-4 rounded-full bg-amber-cta blur-md"
      />
      {/* Center solid core */}
      <div className="absolute inset-10 rounded-full bg-surface-white flex items-center justify-center shadow-level-2 z-10">
        <Mic className={`w-7 h-7 ${active ? "text-amber-cta animate-pulse" : "text-ink-muted"} transition-colors`} />
      </div>
    </div>
  );
}

export default function Hero({ setPage }: HeroProps) {
  const [voice, setVoice] = useState("puck");
  const [lang, setLang] = useState("hi");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voicesList = [
    { id: "puck", name: "Wei (Puck)", desc: "Upbeat & Conversational" },
    { id: "charon", name: "Charon", desc: "Authoritative & Formal" },
    { id: "kore", name: "Mei (Kore)", desc: "Professional Female" },
    { id: "fenrir", name: "Fenrir", desc: "Warm & Reassuring" },
  ];

  const langsList = [
    { id: "hi", name: "Hindi" },
    { id: "en", name: "English" },
    { id: "bn", name: "Bengali" },
    { id: "kn", name: "Kannada" },
    { id: "ml", name: "Malayalam" },
    { id: "gu", name: "Gujarati" },
    { id: "zh", name: "Mandarin" },
    { id: "ar", name: "Arabic" },
  ];

  const getAudioUrl = (vId: string, lId: string) => {
    const validMatrixMap: Record<string, string[]> = {
      puck: ["en", "hi", "bn", "kn", "ml", "gu", "zh", "ar"],
      kore: ["en", "hi", "bn", "kn", "ml", "gu", "zh", "ar"],
      charon: ["en", "hi", "zh", "ar"],
      fenrir: ["en"]
    };

    const baseLang = lId.split('-')[0];
    const hasSpec = validMatrixMap[vId]?.includes(baseLang);
    const resolvedVoice = hasSpec ? vId : "puck";
    const resolvedLang = hasSpec ? baseLang : "en";
    return `/previews/${resolvedVoice}_${resolvedLang}.wav`;
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    } else {
      const url = getAudioUrl(voice, lang);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error("Audio play failed:", err);
        });
      }
    }
  };

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [voice, lang]);

  const transcript = TRANSCRIPT_MAP[lang] || TRANSCRIPT_MAP.en;

  return (
    <section className="pt-28 pb-32 px-6 max-w-[1400px] mx-auto relative overflow-hidden min-h-[90vh] flex items-center">
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />

      {/* Decorative Parallax Background Panels (Asymmetric Collage) */}
      <motion.div 
        className="absolute top-0 right-0 w-2/3 h-full panel-texture rounded-l-[48px] -z-10 hidden lg:block"
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.div 
        className="absolute -top-20 -right-10 w-96 h-96 bg-mint-soft rounded-[64px] rotate-12 -z-20 hidden lg:block"
        initial={{ opacity: 0, rotate: 0 }}
        animate={{ opacity: 1, rotate: 12 }}
        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center w-full">
        
        {/* Left Copy Content */}
        <motion.div
          className="lg:col-span-7 space-y-8 text-left z-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 border border-border-soft rounded-pill px-4 py-2 bg-surface-white/80 backdrop-blur-sm shadow-level-1">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-cta opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-cta"></span>
            </span>
            <span className="text-caption font-bold uppercase tracking-wider text-ink-muted">
              ✨ Powered by Gemini 2.5 Flash Native Multimodal Audio & Chirp 3
            </span>
          </div>

          <h1 className="text-display text-ink text-left">
            Human-Like AI Voice Agents That Speak, Listen, & Execute Enterprise Workflows in Real Time.
          </h1>

          <p className="text-body text-ink-muted max-w-xl text-left">
            Stop burning capital on manual call centers and missed leads. Clarity Voice deploys autonomous, multi-lingual AI voice agents across 70+ languages and regional dialects. From validating Cash-on-Delivery orders to scheduling medical intake and recovering overdue EMI payments—our voice agents converse naturally with under 180ms latency.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button
              onClick={() => setPage("dashboard")}
              className="btn-primary px-8 py-4 text-lg"
            >
              Build Your First Voice Agent (Free)
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <button
              onClick={() => setPage("voices")}
              className="btn-cta bg-surface-white text-ink border border-border-soft hover:bg-cream-bg"
            >
              Explore 26+ HD Voice Personas
            </button>
          </div>
          
          <div className="pt-8 mt-8 border-t border-border-soft flex flex-wrap items-center gap-x-8 gap-y-4">
            {["< 180ms Response Latency", "70+ Languages & Regional Dialects", "10M+ Monthly API Call Capacity", "Flat-Rate ROI Economics"].map((badge, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-mint-primary" />
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider font-mono">{badge}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right Collage / Interactive Widget */}
        <motion.div
          className="lg:col-span-5 relative z-10 lg:pl-10"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Asymmetric Offset Panel wrapping the tester */}
          <div className="relative">
            {/* Background offset card for 3D depth */}
            <div className="absolute inset-0 bg-mint-primary/20 rounded-md transform translate-x-6 translate-y-6 -z-10" />
            
            <div className="bg-surface-white border border-border-soft rounded-md p-8 shadow-level-3 relative z-10 glassmorphism">
              <div className="flex items-center justify-between border-b border-border-soft pb-4 mb-6">
                <span className="font-mono text-caption font-bold text-ink-muted tracking-wider">LIVE TEST AREA</span>
                <AnimatedWaveformCheck />
              </div>

              {/* Selector panels */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div>
                  <label className="block text-caption font-bold text-ink-muted mb-2 uppercase">Voice Persona</label>
                  <select 
                    value={voice} 
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full bg-cream-bg border border-border-soft text-sm font-semibold text-ink px-4 py-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-mint-primary"
                  >
                    {voicesList.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-caption font-bold text-ink-muted mb-2 uppercase">Language Mode</label>
                  <select 
                    value={lang} 
                    onChange={(e) => setLang(e.target.value)}
                    className="w-full bg-cream-bg border border-border-soft text-sm font-semibold text-ink px-4 py-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-mint-primary"
                  >
                    {langsList.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pulsing Visualizer Core */}
              <div className="my-8">
                <AudioSphere active={isPlaying} />
              </div>

              <div className="text-center mb-8">
                <button
                  onClick={handlePlayToggle}
                  className="btn-primary w-full shadow-level-2"
                >
                  {isPlaying ? "Stop Demonstration" : "Hear Selected Agent"}
                </button>
              </div>

              {/* Live transcript simulation block */}
              <div className="bg-cream-bg border border-border-soft rounded-sm p-5 space-y-4 max-h-40 overflow-y-auto">
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-forest-deep rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-level-1">
                    <Bot className="w-3.5 h-3.5 text-mint-primary" />
                  </div>
                  <div className="bg-surface-white border border-border-soft rounded-sm rounded-tl-none px-4 py-3 flex-1 shadow-level-1">
                    <p className="text-small text-ink font-medium">
                      {isPlaying ? transcript.agent : "Select a voice and click test to see speech transcript output."}
                    </p>
                  </div>
                </div>
                {isPlaying && (
                  <div className="flex gap-3 justify-end">
                    <div className="bg-mint-soft border border-mint-primary/20 rounded-sm rounded-tr-none px-4 py-3 max-w-[85%] shadow-level-1">
                      <p className="text-small text-forest-deep font-semibold">
                        {transcript.user}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

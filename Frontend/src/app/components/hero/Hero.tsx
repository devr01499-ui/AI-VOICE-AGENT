import { useState, useEffect, useRef } from "react";
import { Mic, ArrowRight, Bot, Check, Phone, Zap, Globe, Shield } from "lucide-react";
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

const TRANSCRIPT_MAP: Record<string, { agent: string; user: string }> = {
  en: { agent: "Hello! I'm calling about your recent order. Can I confirm the delivery address for you?", user: "Yes, that's correct. Please go ahead." },
  hi: { agent: "नमस्ते! मैं आपके हालिया ऑर्डर के बारे में कॉल कर रहा हूँ। क्या मैं डिलीवरी पता कन्फर्म कर सकता हूँ?", user: "हाँ, सही है। कृपया आगे बढ़ें।" },
  bn: { agent: "হ্যালো! আমি আপনার সাম্প্রতিক অর্ডার সম্পর্কে কল করছি। আমি কি ডেলিভারি ঠিকানা নিশ্চিত করতে পারি?", user: "হ্যাঁ, ঠিক আছে।" },
  kn: { agent: "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಆರ್ಡರ್ ಬಗ್ಗೆ ಕರೆ ಮಾಡುತ್ತಿದ್ದೇನೆ. ವಿತರಣಾ ವಿಳಾಸ ದೃಢಪಡಿಸಲಿ?", user: "ಹೌದು, ಮುಂದುವರಿಯಿರಿ।" },
  ml: { agent: "ഹലോ! നിങ്ങളുടെ ഓർഡർ സ്ഥിരീകരിക്കാൻ വിളിക്കുകയാണ്. വിലാസം ശരിയാണോ?", user: "അതെ, ശരിയാണ്।" },
  gu: { agent: "નમસ્તે! તમારા ઓર્ડર વિશે કૉલ કરી રહ્યો છું. ડિલિવરી સરનામું નક્કી કરી શકું?", user: "હા, બરાબર છે।" },
  zh: { agent: "您好！我致电确认您的最近订单。请问您的送货地址是否正确？", user: "是的，没问题。请继续。" },
  ar: { agent: "مرحباً! أتصل بشأن طلبك الأخير. هل يمكنني تأكيد عنوان التسليم؟", user: "نعم، صحيح. تفضل." },
};

function PulsingRing({ delay = 0, size = "full" }: { delay?: number; size?: string }) {
  return (
    <motion.div
      className={`absolute inset-${size} rounded-full border border-[#059669]/20`}
      animate={{ scale: [1, 1.4, 1.8], opacity: [0.5, 0.2, 0] }}
      transition={{ duration: 3, repeat: Infinity, delay, ease: "easeOut" }}
    />
  );
}

function AudioSphere({ active }: { active: boolean }) {
  return (
    <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
      {active && (
        <>
          <PulsingRing delay={0} />
          <PulsingRing delay={1} />
          <PulsingRing delay={2} />
        </>
      )}
      <motion.div
        animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-4 rounded-full"
        style={{
          background: active
            ? "radial-gradient(circle at 35% 35%, #10B981, #059669)"
            : "radial-gradient(circle at 35% 35%, #D1FAE5, #A7F3D0)",
          boxShadow: active ? "0 0 32px 8px rgba(5,150,105,0.25)" : "none",
        }}
      />
      <div className="relative z-10 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
        <Mic className={`w-6 h-6 ${active ? "text-[#059669]" : "text-slate-400"} transition-colors`} />
      </div>
    </div>
  );
}

export default function Hero({ setPage }: HeroProps) {
  const [voice, setVoice] = useState("puck");
  const [lang, setLang] = useState("en");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeWord, setActiveWord] = useState(0);

  const rotatingWords = ["Speak", "Listen", "Execute", "Convert", "Scale"];

  useEffect(() => {
    const t = setInterval(() => setActiveWord(w => (w + 1) % rotatingWords.length), 2000);
    return () => clearInterval(t);
  }, []);

  const voicesList = [
    { id: "puck", name: "Puck – Upbeat & Conversational" },
    { id: "charon", name: "Charon – Authoritative & Formal" },
    { id: "kore", name: "Kore – Professional Female" },
    { id: "fenrir", name: "Fenrir – Warm & Reassuring" },
  ];

  const langsList = [
    { id: "en", name: "English" },
    { id: "hi", name: "Hindi" },
    { id: "bn", name: "Bengali" },
    { id: "kn", name: "Kannada" },
    { id: "ml", name: "Malayalam" },
    { id: "gu", name: "Gujarati" },
    { id: "zh", name: "Mandarin" },
    { id: "ar", name: "Arabic" },
  ];

  const getAudioUrl = (vId: string, lId: string) => {
    const validMap: Record<string, string[]> = {
      puck: ["en", "hi", "bn", "kn", "ml", "gu", "zh", "ar"],
      kore: ["en", "hi", "bn", "kn", "ml", "gu", "zh", "ar"],
      charon: ["en", "hi", "zh", "ar"],
      fenrir: ["en"],
    };
    const base = lId.split("-")[0];
    const ok = validMap[vId]?.includes(base);
    return `/previews/${ok ? vId : "puck"}_${ok ? base : "en"}.wav`;
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.src = getAudioUrl(voice, lang);
        audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
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

  const statCards = [
    { value: "<180ms", label: "Response latency", icon: Zap, color: "#059669" },
    { value: "70+", label: "Languages & dialects", icon: Globe, color: "#EA580C" },
    { value: "10M+", label: "Monthly API calls", icon: Phone, color: "#059669" },
    { value: "SOC 2", label: "Type II Certified", icon: Shield, color: "#EA580C" },
  ];

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center" style={{ background: "#FAF8F5" }}>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />

      {/* ── Deep Forest Green Right Panel (the editorial "block") ─────────────── */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-[48%] hidden lg:block"
        initial={{ x: 120, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "linear-gradient(145deg, #1B4332 0%, #0D2B20 55%, #1B4332 100%)",
          borderRadius: "48px 0 0 48px",
        }}
      >
        {/* Inner texture dots */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            borderRadius: "inherit",
          }}
        />
        {/* Subtle radial glow */}
        <div
          className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #34D399, transparent)" }}
        />
      </motion.div>

      {/* ── Decorative mint blob top-left ─────────────────────────────────────── */}
      <motion.div
        className="absolute -top-24 -left-24 w-64 h-64 rounded-full hidden lg:block"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.12, scale: 1 }}
        transition={{ duration: 1.5, delay: 0.3 }}
        style={{ background: "radial-gradient(circle, #059669, transparent)" }}
      />

      {/* ── Main Content Grid ──────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 pt-36 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

        {/* ── LEFT: Hero Copy ──────────────────────────────────────────────────── */}
        <motion.div
          className="lg:col-span-6 space-y-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2 bg-white border border-[#EADEC9] rounded-full px-4 py-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
            <span className="text-xs font-bold text-[#059669] uppercase tracking-widest font-mono">
              Enterprise AI Voice Platform
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <h1
              className="text-[56px] md:text-[68px] lg:text-[72px] leading-[1.04] font-extrabold tracking-tight text-[#0F172A]"
              style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
            >
              AI Agents That{" "}
              <br />
              <span className="relative inline-block">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={activeWord}
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -24, opacity: 0 }}
                    transition={{ duration: 0.38 }}
                    className="inline-block text-transparent bg-clip-text"
                    style={{ backgroundImage: "linear-gradient(135deg, #059669 0%, #34D399 50%, #EA580C 100%)" }}
                  >
                    {rotatingWords[activeWord]}
                  </motion.span>
                </AnimatePresence>
              </span>
              <br />
              & Convert
            </h1>
          </div>

          {/* Body */}
          <p
            className="text-lg text-slate-500 leading-relaxed max-w-lg"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Deploy human-like, multilingual voice agents across 70+ languages. Confirm COD orders, qualify leads, schedule appointments — at sub-180ms latency with no call center overhead.
          </p>

          {/* CTA Row */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setPage("dashboard")}
              className="group inline-flex items-center gap-2 font-bold text-base text-white px-8 py-4 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
                boxShadow: "0 8px 24px rgba(5,150,105,0.3)",
              }}
            >
              Build Your First Agent — Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setPage("voices")}
              className="inline-flex items-center gap-2 font-semibold text-base text-[#0F172A] bg-white border border-[#EADEC9] px-8 py-4 rounded-full shadow-sm hover:shadow-md hover:border-[#059669]/30 transition-all"
            >
              <Mic className="w-4 h-4 text-[#059669]" />
              Hear 26+ HD Voices
            </button>
          </div>

          {/* Trust badges row */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2 border-t border-[#EADEC9]">
            {["No credit card required", "14-day free trial", "Cancel any time"].map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#059669]" />
                <span className="text-sm font-semibold text-slate-500">{t}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── RIGHT: Interactive Voice Tester (on green panel) ─────────────────── */}
        <motion.div
          className="lg:col-span-6 relative flex justify-center lg:justify-end"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Floating stat cards — scattered */}
          {statCards.map((s, i) => {
            const Icon = s.icon;
            const positions = [
              "absolute -top-10 -left-10 lg:-left-16",
              "absolute -top-10 right-6 lg:right-2",
              "absolute -bottom-8 -left-6 lg:-left-14",
              "absolute -bottom-8 right-0 lg:right-4",
            ];
            return (
              <motion.div
                key={i}
                className={`${positions[i]} hidden lg:flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-xl border border-[#EADEC9] z-20`}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.5 + i * 0.12 }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.color === "#059669" ? "#D1FAE5" : "#FEF3C7" }}
                >
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#0F172A] leading-none">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              </motion.div>
            );
          })}

          {/* Main white card — the voice tester */}
          <div
            className="relative w-full max-w-md rounded-[32px] p-8 z-10"
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 32px 64px rgba(11,41,26,0.22), 0 8px 20px rgba(11,41,26,0.10)",
            }}
          >
            {/* Card header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-widest text-[#059669]"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Live Voice Demo
                </p>
                <p className="text-sm font-semibold text-[#0F172A] mt-0.5">Try any agent & language</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              </div>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Voice
                </label>
                <select
                  value={voice}
                  onChange={e => setVoice(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#EADEC9] text-sm font-semibold text-[#0F172A] px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669]/40 cursor-pointer"
                >
                  {voicesList.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Language
                </label>
                <select
                  value={lang}
                  onChange={e => setLang(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#EADEC9] text-sm font-semibold text-[#0F172A] px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669]/40 cursor-pointer"
                >
                  {langsList.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Audio Sphere */}
            <div className="my-6">
              <AudioSphere active={isPlaying} />
            </div>

            {/* Play button */}
            <button
              onClick={handlePlayToggle}
              className="w-full font-bold text-sm py-3.5 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 mb-5"
              style={{
                background: isPlaying
                  ? "linear-gradient(135deg, #EF4444, #DC2626)"
                  : "linear-gradient(135deg, #059669 0%, #10B981 100%)",
                color: "#fff",
                boxShadow: isPlaying ? "0 6px 20px rgba(239,68,68,0.3)" : "0 6px 20px rgba(5,150,105,0.3)",
              }}
            >
              {isPlaying ? "⬛ Stop Demo" : "▶ Play Voice Sample"}
            </button>

            {/* Transcript bubble */}
            <div className="rounded-2xl overflow-hidden border border-[#EADEC9]">
              <div className="bg-[#FAF8F5] px-4 py-2 border-b border-[#EADEC9]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  Live Transcript
                </p>
              </div>
              <div className="bg-white p-4 space-y-3">
                <div className="flex gap-2.5 items-start">
                  <div className="w-6 h-6 rounded-full bg-[#1B4332] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-[#34D399]" />
                  </div>
                  <p className="text-sm text-[#0F172A] leading-relaxed">
                    {isPlaying ? transcript.agent : "Select a voice and click play to hear the agent speak…"}
                  </p>
                </div>
                <AnimatePresence>
                  {isPlaying && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-2.5 items-start justify-end"
                    >
                      <div
                        className="text-sm text-[#0F172A] leading-relaxed text-right max-w-[85%] px-4 py-2 rounded-2xl rounded-tr-sm"
                        style={{ background: "#D1FAE5" }}
                      >
                        {transcript.user}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom floating stats bar ─────────────────────────────────────────── */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 lg:hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
      >
        <div className="flex overflow-x-auto gap-4 px-6 pb-6 scrollbar-hide">
          {statCards.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-md border border-[#EADEC9] flex-shrink-0"
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: s.color === "#059669" ? "#D1FAE5" : "#FEF3C7" }}
                >
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#0F172A]">{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}

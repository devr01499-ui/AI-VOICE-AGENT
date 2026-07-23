import { useState, useEffect, useRef } from "react";
import { Mic, ArrowRight, Bot } from "lucide-react";
import { motion } from "motion/react";

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

// ─── Pulsing Audio Sphere Component ──────────────────────────────────────────
function AudioSphere({ active }: { active: boolean }) {
  return (
    <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
      {/* Outer pulsing rings */}
      <motion.div
        animate={active ? { scale: [1, 1.3, 1], opacity: [0.06, 0.22, 0.06] } : { scale: 1, opacity: 0.03 }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#059669] to-[#10B981] blur-lg"
      />
      <motion.div
        animate={active ? { scale: [1, 1.15, 1], opacity: [0.1, 0.35, 0.1] } : { scale: 1, opacity: 0.05 }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        className="absolute inset-4 rounded-full bg-gradient-to-tr from-[#D97706] to-[#EA580C] blur-md"
      />
      {/* Center solid core */}
      <div className="absolute inset-10 rounded-full bg-white border border-[#EADEC9] flex items-center justify-center shadow-md">
        <Mic className={`w-7 h-7 ${active ? "text-[#059669] animate-pulse" : "text-slate-400"} transition-colors`} />
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

    const hasSpec = validMatrixMap[vId]?.includes(lId);
    const resolvedVoice = hasSpec ? vId : "puck";
    const resolvedLang = hasSpec ? lId : "en";
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
    <section className="pt-28 pb-20 px-6 max-w-7xl mx-auto relative">
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        className="hidden" 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        <motion.div
          className="lg:col-span-7 space-y-6 text-left"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 border border-[#EADEC9] rounded-full px-3.5 py-1.5 bg-white shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#059669]"></span>
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Powered by Native Multimodal Audio (Gemini 2.5 &amp; Chirp 3)
            </span>
          </div>

          <h1 className="font-sora text-5xl lg:text-6xl xl:text-[68px] font-extrabold leading-[1.08] tracking-tight text-slate-900">
            AI Voice Agents That <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#059669] via-emerald-600 to-[#10B981]">Speak, Listen, and Think</span> Like Your Sharpest Employee.
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-xl font-plus-jakarta font-semibold">
            Stop losing deals to slow follow-ups and unhandled phone calls. Clarity Voice deploys human-sounding AI voice agents across 70+ languages and regional dialects.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => setPage("dashboard")}
              className="bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#10B981] hover:to-[#059669] text-white font-bold px-8 py-3.5 rounded-full hover:scale-[1.02] shadow-md shadow-emerald-500/10 active:scale-95 transition-all flex items-center gap-2 group font-plus-jakarta"
            >
              Build Your First Voice Agent in 2 Mins
              <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setPage("voices")}
              className="border border-[#EADEC9] bg-white hover:bg-slate-50 text-slate-700 font-bold px-8 py-3.5 rounded-full transition-all flex items-center gap-2 shadow-sm"
            >
              Listen to Live Audio Demos
            </button>
          </div>
        </motion.div>

        {/* Interactive Live Voice Tester Widget */}
        <motion.div
          className="lg:col-span-5 relative z-10"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <div className="bg-white border border-[#EADEC9] rounded-3xl p-6 shadow-md relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <span className="font-mono text-xs font-bold text-slate-400 tracking-wider">LIVE TEST AREA</span>
              <span className="flex items-center gap-1.5 bg-emerald-50 text-[#059669] border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                🟢 READY
              </span>
            </div>

            {/* Selector panels */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 mb-1.5 uppercase">Voice Persona</label>
                <select 
                  value={voice} 
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full bg-slate-50 border border-[#EADEC9] text-xs font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:border-[#059669]"
                >
                  {voicesList.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 mb-1.5 uppercase">Language Mode</label>
                <select 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full bg-slate-50 border border-[#EADEC9] text-xs font-bold text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:border-[#059669]"
                >
                  {langsList.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pulsing Visualizer Core */}
            <div className="my-6">
              <AudioSphere active={isPlaying} />
            </div>

            <div className="text-center mb-6">
              <button
                onClick={handlePlayToggle}
                className={`px-8 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 active:scale-95 ${
                  isPlaying 
                    ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" 
                    : "bg-emerald-50 text-[#059669] border border-emerald-200 hover:bg-emerald-100/50"
                }`}
              >
                {isPlaying ? "Stop Demonstration" : "Hear Selected Agent"}
              </button>
            </div>

            {/* Live transcript simulation block */}
            <div className="bg-slate-50 border border-[#EADEC9]/60 rounded-2xl p-4 space-y-3 max-h-36 overflow-y-auto">
              <div className="flex gap-2.5">
                <div className="w-5 h-5 bg-gradient-to-tr from-[#059669] to-[#10B981] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white border border-[#EADEC9]/60 rounded-2xl rounded-tl-none px-3.5 py-2.5 flex-1">
                  <p className="text-xs text-slate-700 leading-relaxed font-plus-jakarta font-semibold">
                    {isPlaying ? transcript.agent : "Select a voice and click test to see speech transcript output."}
                  </p>
                </div>
              </div>
              {isPlaying && (
                <div className="flex gap-2.5 justify-end">
                  <div className="bg-gradient-to-tr from-emerald-50 to-white border border-[#EADEC9]/60 rounded-2xl rounded-tr-none px-3.5 py-2.5 max-w-[80%]">
                    <p className="text-xs text-[#059669] leading-relaxed font-plus-jakarta font-bold">
                      {transcript.user}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

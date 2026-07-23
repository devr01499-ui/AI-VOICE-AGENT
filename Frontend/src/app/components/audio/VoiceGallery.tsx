import { useState, useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { motion } from "motion/react";

interface VoiceGalleryProps {
  setPage: (p: any) => void;
}

export default function VoiceGallery({ setPage }: VoiceGalleryProps) {
  const [selectedGender, setSelectedGender] = useState("All");
  const [selectedTone, setSelectedTone] = useState("All");
  const [selectedLang, setSelectedLang] = useState("hi");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voices = [
    { id: "puck", name: "Wei (Puck)", gender: "Male", tone: "Conversational", description: "Bright, energetic voice optimized for fast-paced confirmation calls.", quote: "Hey there! I'm calling from Clarity Voice to double-check your order details before we ship it out today." },
    { id: "kore", name: "Mei (Kore)", gender: "Female", tone: "Crisp", description: "Polite, clear, and reassuring female voice with excellent articulation.", quote: "Hello! Dr. Sharma's office is confirming your appointment scheduled for tomorrow at 10:00 AM." },
    { id: "charon", name: "Charon", gender: "Male", tone: "Authoritative", description: "Deeper male tone, ideal for formal business and logistics coordination.", quote: "Good afternoon. This is an automated security alert regarding a recent transaction on your account." },
    { id: "fenrir", name: "Fenrir", gender: "Male", tone: "Warm", description: "Friendly and comforting voice tone that establishes fast trust.", quote: "Hi! We noticed you checked out our property tour online and wanted to see if you had any quick questions." },
    { id: "zephyr", name: "Zephyr", gender: "Male", tone: "Crisp", description: "Neutral, crisp tone with perfectly transparent clarity.", quote: "Thank you for confirming your pickup time. Your driver will meet you at the loading dock." },
    { id: "aoede", name: "Aoede", gender: "Female", tone: "Conversational", description: "Clear, engaging female persona specialized in transactional call flows.", quote: "Hi there! I am your AI assistant. Let me verify your cash-on-delivery order." }
  ];

  const langs = [
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
      aoede: ["en", "hi", "bn", "zh", "ar"],
      charon: ["en", "hi", "zh", "ar"],
      fenrir: ["en"],
      zephyr: ["en"]
    };

    const hasSpec = validMatrixMap[vId]?.includes(lId);
    const resolvedVoice = hasSpec ? vId : "puck";
    const resolvedLang = hasSpec ? lId : "en";
    return `/previews/${resolvedVoice}_${resolvedLang}.wav`;
  };

  const handlePlayVoice = (vId: string) => {
    if (playingVoice === vId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoice(null);
    } else {
      const url = getAudioUrl(vId, selectedLang);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().then(() => {
          setPlayingVoice(vId);
        }).catch(err => {
          console.error("Audio playback error:", err);
        });
      }
    }
  };

  useEffect(() => {
    if (playingVoice && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoice(null);
    }
  }, [selectedLang]);

  const filteredVoices = voices.filter(v => {
    const matchGender = selectedGender === "All" || v.gender === selectedGender;
    const matchTone = selectedTone === "All" || v.tone === selectedTone;
    return matchGender && matchTone;
  });

  const codeSnippet = `// POST request configuration for Clarity Voice API
const payload = {
  agentId: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22",
  phoneNumber: "+919876543210",
  languageMode: "${selectedLang}",
  voiceId: "${playingVoice || 'kore'}"
};

const response = await fetch("https://api.insightclaritiysolution.com/v2/calls", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});`;

  return (
    <div className="space-y-12">
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingVoice(null)}
        className="hidden" 
      />

      {/* Filter Options */}
      <div className="bg-white border border-[#EADEC9] rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Gender:</span>
            {["All", "Male", "Female"].map(g => (
              <button
                key={g}
                onClick={() => setSelectedGender(g)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  selectedGender === g 
                    ? "bg-[#059669]/10 text-[#059669]" 
                    : "text-slate-500 hover:text-[#059669]"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Tone:</span>
            {["All", "Conversational", "Authoritative", "Warm", "Crisp"].map(t => (
              <button
                key={t}
                onClick={() => setSelectedTone(t)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  selectedTone === t 
                    ? "bg-[#059669]/10 text-[#059669]" 
                    : "text-slate-500 hover:text-[#059669]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-px bg-slate-100" />

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Select Dialect:</span>
          {langs.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLang(l.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                selectedLang === l.id 
                  ? "bg-slate-800 text-white border-slate-700" 
                  : "bg-transparent border-transparent text-slate-500 hover:text-[#059669]"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredVoices.map(v => (
          <div key={v.id} className="bg-white border border-[#EADEC9] rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <span className="text-[9px] font-mono font-bold text-[#059669] uppercase tracking-wider bg-[#059669]/10 px-2 py-0.5 rounded border border-[#059669]/20">
                {v.tone} · {v.gender}
              </span>
              <h3 className="font-sora text-lg font-bold text-slate-900 mt-4 mb-2">{v.name}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-plus-jakarta font-semibold mb-4">{v.description}</p>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-left">
                <p className="text-xs text-slate-600 italic font-semibold leading-relaxed">"{v.quote}"</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => handlePlayVoice(v.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${
                  playingVoice === v.id 
                    ? "bg-red-50 text-red-600 border border-red-200" 
                    : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {playingVoice === v.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {playingVoice === v.id ? "Pause" : "Preview"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* API sandbox code snippets */}
      <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 shadow-sm">
        <h2 className="font-sora text-2xl font-extrabold text-slate-900 mb-4">API Integration Sandbox</h2>
        <p className="text-xs text-slate-500 leading-relaxed mb-6 font-plus-jakarta font-semibold">
          Change selections above to dynamically generate the payload configuration for calling this voice persona.
        </p>
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto relative">
          <pre className="whitespace-pre">{codeSnippet}</pre>
        </div>
      </div>
    </div>
  );
}

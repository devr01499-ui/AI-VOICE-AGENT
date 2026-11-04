import { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, Sparkles, User, Check, ArrowRight, Mic } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VoiceGalleryProps {
  setPage: (p: any) => void;
}

interface VoicePersona {
  id: string;
  name: string;
  gender: "Male" | "Female";
  tone: "Conversational" | "Crisp" | "Warm" | "Authoritative";
  avatar: string;
  badge: string;
  pitch: string;
  accent: string;
  description: string;
  quote: string;
}

export default function VoiceGallery({ setPage }: VoiceGalleryProps) {
  const [selectedGender, setSelectedGender] = useState<string>("All");
  const [selectedTone, setSelectedTone] = useState<string>("All");
  const [selectedLang, setSelectedLang] = useState<string>("hi");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voices: VoicePersona[] = [
    {
      id: "puck",
      name: "Wei (Puck)",
      gender: "Male",
      tone: "Conversational",
      avatar: "/avatars/male_1.png",
      badge: "Fast Dispatch",
      pitch: "Tenor (128 Hz)",
      accent: "Indian English & Hindi",
      description: "Bright, energetic voice optimized for fast-paced confirmation calls and logistics coordination.",
      quote: "Hey there! I'm calling from Claritiy Voice to double-check your order details before we ship it out today."
    },
    {
      id: "kore",
      name: "Mei (Kore)",
      gender: "Female",
      tone: "Crisp",
      avatar: "/avatars/female_1.png",
      badge: "Patient Care",
      pitch: "Mezzo (218 Hz)",
      accent: "Pan-India Polite",
      description: "Polite, clear, and reassuring female voice with exceptional phoneme articulation for clinic desks.",
      quote: "Hello! Dr. Sharma's office is confirming your consultation scheduled for tomorrow at 10:00 AM."
    },
    {
      id: "charon",
      name: "Charon",
      gender: "Male",
      tone: "Authoritative",
      avatar: "/avatars/male_2.png",
      badge: "BFSI & Security",
      pitch: "Baritone (98 Hz)",
      accent: "Formal Corporate",
      description: "Deeper male tone engineered for security verification, financial updates, and executive dispatch.",
      quote: "Good afternoon. This is an automated security verification call regarding a recent transaction on your account."
    },
    {
      id: "fenrir",
      name: "Fenrir",
      gender: "Male",
      tone: "Warm",
      avatar: "/avatars/male_3.png",
      badge: "Real Estate SDR",
      pitch: "Baritone-Tenor (114 Hz)",
      accent: "Warm Consultative",
      description: "Friendly, empathetic tone that breaks cold call resistance and establishes rapid buyer rapport.",
      quote: "Hi! We noticed you checked out our luxury property brochure online and wanted to see if you had any quick questions."
    },
    {
      id: "zephyr",
      name: "Zephyr",
      gender: "Male",
      tone: "Crisp",
      avatar: "/avatars/male_1.png",
      badge: "Logistics Desk",
      pitch: "Neutral Baritone (120 Hz)",
      accent: "Clear Articulate",
      description: "Neutral, crystal-clear tone designed for high ambient noise delivery confirmation and OTP dispatch.",
      quote: "Thank you for confirming your pickup window. Your dedicated courier partner will arrive within 25 minutes."
    },
    {
      id: "aoede",
      name: "Aoede",
      gender: "Female",
      tone: "Conversational",
      avatar: "/avatars/female_2.png",
      badge: "COD Defense",
      pitch: "Soprano (234 Hz)",
      accent: "Energetic Conversational",
      description: "Clear, engaging female persona specialized in e-commerce verification and prepaid order upgrades.",
      quote: "Hi there! I am your AI assistant from Claritiy Voice. Let me verify your cash-on-delivery order landmark."
    }
  ];

  const langs = [
    { id: "hi", name: "Hindi (हिंदी)" },
    { id: "en", name: "English (Indian/US)" },
    { id: "bn", name: "Bengali (বাংলা)" },
    { id: "kn", name: "Kannada (ಕನ್ನಡ)" },
    { id: "ml", name: "Malayalam (മലയാളം)" },
    { id: "gu", name: "Gujarati (ગુજરાતી)" },
    { id: "zh", name: "Mandarin (中文)" },
    { id: "ar", name: "Arabic (العربية)" }
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

    const baseLang = lId.split("-")[0];
    const hasSpec = validMatrixMap[vId]?.includes(baseLang);
    const resolvedVoice = hasSpec ? vId : "puck";
    const resolvedLang = hasSpec ? baseLang : "en";
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
        }).catch((err) => {
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

  const filteredVoices = voices.filter((v) => {
    const matchGender = selectedGender === "All" || v.gender === selectedGender;
    const matchTone = selectedTone === "All" || v.tone === selectedTone;
    return matchGender && matchTone;
  });

  return (
    <div className="space-y-8 font-sans">
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingVoice(null)}
        className="hidden" 
      />

      {/* ── Filter Controls Card ────────────────────────────────────── */}
      <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 md:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#CBC8BE]">
          {/* Gender Filter */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[#121212] uppercase tracking-widest font-mono flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Filter By Gender
            </span>
            <div className="flex items-center gap-2">
              {["All", "Male", "Female"].map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGender(g)}
                  className={`px-3.5 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    selectedGender === g 
                      ? "bg-[#121212] text-white border border-[#121212]" 
                      : "bg-[#DFDCD4] text-[#121212] hover:bg-[#D5D1C7] border border-[#CBC8BE]"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Tone Filter */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[#121212] uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" /> Tonal Persona
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {["All", "Conversational", "Authoritative", "Warm", "Crisp"].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTone(t)}
                  className={`px-3 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    selectedTone === t 
                      ? "bg-[#121212] text-white border border-[#121212]" 
                      : "bg-[#DFDCD4] text-[#121212] hover:bg-[#D5D1C7] border border-[#CBC8BE]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dialect Selector */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#121212] uppercase tracking-widest font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Active Dialect Matrix
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {langs.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLang(l.id)}
                className={`px-3.5 py-1.5 rounded-[2px] text-xs font-mono border transition-all cursor-pointer ${
                  selectedLang === l.id 
                    ? "bg-[#121212] text-white border-[#121212]" 
                    : "bg-[#DFDCD4] border-[#CBC8BE] text-[#121212] hover:bg-[#D5D1C7]"
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Voice Persona Cards Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVoices.map((v) => {
          const isPlaying = playingVoice === v.id;

          return (
            <div 
              key={v.id} 
              className={`bg-[#EBE9E2] border rounded-[2px] p-6 flex flex-col justify-between transition-colors relative overflow-hidden ${
                isPlaying ? "border-[#121212] ring-1 ring-[#121212]" : "border-[#CBC8BE] hover:border-[#9C998F]"
              }`}
            >
              <div>
                {/* Header: DP Avatar + Name + Meta */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-[2px] overflow-hidden border border-[#CBC8BE] bg-[#DFDCD4]">
                      <img 
                        src={v.avatar} 
                        alt={`${v.name} - ${v.gender} Voice Avatar`} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${v.id}`;
                        }}
                      />
                    </div>
                  </div>

                  {/* Name and Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-medium text-base text-[#121212] font-sans truncate">
                        {v.name}
                      </h3>
                      <span className="text-[10px] font-mono font-medium text-[#121212] bg-[#DFDCD4] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE] flex-shrink-0">
                        {v.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-[#262523] font-mono">
                      <span>{v.gender}</span>
                      <span>·</span>
                      <span>{v.tone}</span>
                      <span>·</span>
                      <span className="text-[11px] text-[#262523]">{v.pitch}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[#262523] leading-relaxed font-sans mb-4">
                  {v.description}
                </p>

                {/* Audio Quote Box */}
                <div className="bg-[#DFDCD4] rounded-[2px] p-3.5 border border-[#CBC8BE] text-left relative mb-4">
                  <p className="text-xs text-[#121212] italic font-normal leading-relaxed font-sans">
                    "{v.quote}"
                  </p>
                </div>
              </div>

              {/* Bottom Interactive Area: Waveform + Preview Button */}
              <div className="space-y-3 pt-2">
                {/* Visualizer Wave Bar */}
                <div className="flex items-center gap-1.5 h-6 px-3 bg-[#DFDCD4] rounded-[2px] border border-[#CBC8BE]">
                  <span className="text-[10px] font-mono font-medium text-[#262523] mr-1">DSP</span>
                  {[8, 16, 24, 12, 20, 28, 14, 22, 10, 18, 26, 12, 16, 8, 20, 14].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={isPlaying ? {
                        height: [h * 0.3, h, h * 0.2]
                      } : {
                        height: 4
                      }}
                      transition={isPlaying ? {
                        duration: 0.6 + (i % 3) * 0.15,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut"
                      } : { duration: 0.2 }}
                      className={`w-1 rounded-[1px] ${
                        isPlaying ? "bg-[#121212]" : "bg-[#CBC8BE]"
                      }`}
                    />
                  ))}
                  <span className="text-[10px] font-mono font-medium ml-auto text-[#262523]">
                    {isPlaying ? "PLAYING" : "16kHz"}
                  </span>
                </div>

                {/* Buttons Row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlayVoice(v.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-[2px] text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer bg-[#121212] text-white hover:bg-black font-medium"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Pause Sample
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" /> Preview Voice
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setPage("dashboard")}
                    title="Select this voice persona in Agent Studio"
                    className="p-2.5 rounded-[2px] border border-[#CBC8BE] bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] transition-colors cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

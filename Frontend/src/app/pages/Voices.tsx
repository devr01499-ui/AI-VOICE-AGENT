import { motion } from "motion/react";
import VoiceGallery from "../components/audio/VoiceGallery";
import { 
  ArrowRight,
  Activity} from "lucide-react";

type Page = any;

interface VoicesProps {
  setPage: (p: Page) => void;
}

export default function Voices({ setPage }: VoicesProps) {
  const acousticSpecs = [
    { label: "AUDIO FORMAT & CODEC", value: "audio/x-l16 (16kHz 16-bit PCM)", tech: "Uncompressed PCM streamed to the carrier over a secure WebSocket." },
    { label: "LANGUAGES", value: "7 Indian Languages + Auto-Detect", tech: "English, Hindi, Bengali, Kannada, Malayalam, Gujarati and Tamil; Hinglish handled naturally." },
    { label: "VOICES", value: "30 Voices", tech: "Male and female voices with different tones, chosen per agent in the agent editor." },
    { label: "INTERRUPTIONS", value: "Caller Can Cut In", tech: "The agent stops talking as soon as the caller speaks, then answers the new question." }
  ];

  const tonePersonas = [
    {
      role: "Healthcare & Dental Reception",
      tone: "Calm, Gentle, Reassuring",
      desc: "For clinic receptionists and appointment reminders. Speaks at an easy pace, explains timings clearly and offers a call-back from the doctor instead of giving medical advice.",
      badge: "Clinics"
    },
    {
      role: "B2B & Real Estate Enquiries",
      tone: "Crisp, Articulate, Confident",
      desc: "For calling back property and business enquiries. Asks the qualifying questions you set, without pushy sales talk.",
      badge: "Lead Qualification"
    },
    {
      role: "EMI & Payment Reminders",
      tone: "Respectful, Firm, Polite",
      desc: "Confirms it is speaking to the borrower before mentioning any amount, states the due date clearly and never uses shame or pressure.",
      badge: "Lenders"
    },
    {
      role: "E-Commerce COD Confirmation",
      tone: "Warm, Conversational, Friendly",
      desc: "Speaks everyday Hindi or Hinglish to confirm the order, the delivery address and a good time to deliver before the parcel ships.",
      badge: "D2C Brands"
    }
  ];

  const languages = [
    { code: "hi-IN", name: "Hindi (हिंदी)", region: "North & Central India", sample: "नमस्ते, आपकी डिलीवरी के बारे में कॉल है..." },
    { code: "en-IN", name: "Indian English", region: "Pan-India Corporate", sample: "Hello, calling to confirm your appointment..." },
    { code: "bn-IN", name: "Bengali (বাংলা)", region: "West Bengal & East India", sample: "নমস্কার, আপনার অর্ডার নিশ্চিত করতে কল..." },
    { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)", region: "Karnataka & Bengaluru", sample: "ನಮಸ್ಕಾರ, ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬಗ್ಗೆ..." },
    { code: "ta-IN", name: "Tamil (தமிழ்)", region: "Tamil Nadu & Chennai", sample: "வணக்கம், உங்கள் ஆர்டர் விவரங்களை..." },
    { code: "gu-IN", name: "Gujarati (ગુજરાતી)", region: "Gujarat & Western Trade", sample: "નમસ્તે, તમારા ઓર્ડરની ચકાસણી માટે..." },
    { code: "ml-IN", name: "Malayalam (മലയാളം)", region: "Kerala", sample: "നമസ്കാരം, നിങ്ങളുടെ ഓർഡർ സംബന്ധിച്ച്..." }
  ];

  return (
    <div className="space-y-20 pb-32 pt-28 bg-[#E5E3DC] min-h-screen relative font-sans text-[#121212]">
      
      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
        <div className="hatched-strip h-10 w-full mb-8" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono uppercase tracking-wider">
          <span>|</span>
          <span>Voice Gallery & Languages</span>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl lg:text-6xl font-normal md:font-medium text-[#121212] tracking-tight leading-[1.08] font-sans"
        >
          30 AI Voices & 7 Indian Languages
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[#262523] text-base md:text-lg max-w-3xl mx-auto font-sans leading-relaxed"
        >
          Listen before you choose. Every agent can use any of 30 male and female voices, and speak English, Hindi, Bengali, Kannada, Malayalam, Gujarati or Tamil, or switch to the caller's language on its own.
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
            A reminder call and a sales call should not sound the same. Pick a voice and describe the tone in the agent's instructions to match the call.
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
            Spoken Directly, Not Translated
          </h2>
          <p className="text-[#262523] text-sm font-sans">
            The speech model hears and speaks each language itself, so there is no translation step in the middle of the call. Choose one language per agent, or let it follow the caller.
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

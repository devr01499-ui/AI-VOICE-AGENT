import { motion } from "motion/react";
import VoiceGallery from "../components/audio/VoiceGallery";
import { Mic, Globe, Sparkles, Volume2 } from "lucide-react";

type Page = any;

interface VoicesProps {
  setPage: (p: Page) => void;
}

export default function Voices({ setPage }: VoicesProps) {
  return (
    <div className="space-y-28 pb-32 pt-32 bg-cream-bg min-h-screen">
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
          ACOUSTIC DIGITAL SHOWROOM
        </span>
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display text-ink leading-tight"
        >
          26+ HD Voice Personas & Multilingual Dialect Gallery
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-body text-ink-muted max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          Explore native speech synthesis modeling emotion, micro-pauses, breath control, and regional accents across 70+ languages.
        </motion.p>
      </section>

      {/* Voice Player Gallery Component */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <VoiceGallery setPage={setPage} />
      </section>

      {/* ACOUSTIC PROFILE MATRIX GUIDE */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="font-sora text-3xl font-bold text-ink">
              BCP-47 Regional Dialect & Acoustic Profile Specifications
            </h2>
            <p className="text-body text-ink-muted font-plus-jakarta">
              Clarity Voice models speech dynamics directly from native acoustic datasets, ensuring hyper-realistic pronunciation across global and regional Indian dialects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-cream-bg border border-border-soft p-8 rounded-2xl space-y-4">
              <Globe className="w-8 h-8 text-mint-primary" />
              <h3 className="font-sora text-xl font-bold text-ink">Regional Indian Dialect Support</h3>
              <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
                Standard translation APIs struggle with code-switching (e.g. Hinglish or Tanglish) and localized phrasing. Clarity Voice models are trained natively on regional speech matrices including <code>hi-IN</code> (Hindi), <code>bn-IN</code> (Bengali), <code>gu-IN</code> (Gujarati), <code>kn-IN</code> (Kannada), <code>ml-IN</code> (Malayalam), <code>mr-IN</code> (Marathi), and <code>ta-IN</code> (Tamil).
              </p>
            </div>

            <div className="bg-cream-bg border border-border-soft p-8 rounded-2xl space-y-4">
              <Sparkles className="w-8 h-8 text-amber-cta" />
              <h3 className="font-sora text-xl font-bold text-ink">Emotional Cadence & Pitch Modulation</h3>
              <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
                Conversational intent dictates vocal tone. Our personas modulate pitch, stress, and cadence based on context—reassuring for medical appointment bookings, authoritative for security verifications, or energetic for sales leads.
              </p>
            </div>
          </div>

          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6 max-w-4xl mx-auto border-t border-[#EADEC9] pt-8">
            <h3 className="font-sora text-2xl font-bold text-ink">Enterprise Voice Customization & 5-Second Cloning</h3>
            <p>
              Beyond our standard library of 26+ HD voice personas, enterprise teams can synthesize custom brand voices using a simple 5-second audio sample. Custom voice cloning enables brands to maintain consistent vocal identity across every customer touchpoint, whether handling inbound support calls or conducting automated outbound appointment reminders.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

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
  | "privacy"
  | "terms"
  | "security"
  | "dashboard" 
  | "industries";

interface CompareProps {
  setPage: (p: Page) => void;
}

export default function Compare({ setPage }: CompareProps) {
  return (
    <div className="space-y-12 pb-32 pt-32 bg-cream-bg min-h-screen">
      <section className="px-6 max-w-4xl mx-auto text-center space-y-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-caption font-bold text-mint-primary tracking-widest uppercase mb-4 font-mono">
            Orchestration Comparison
          </p>
          <h1 className="text-display text-ink">
            Why High-Growth Companies Switch from Retell, Vapi, and Bolna
          </h1>
          <p className="text-body text-ink-muted max-w-2xl mx-auto mt-6 leading-relaxed">
            When scaling AI voice automation, the difference between a proof-of-concept and a production-ready system lies in latency, cost transparency, and native language understanding. Here is the operational reality of how Clarity Voice compares.
          </p>
        </motion.div>
      </section>

      <section className="px-6 max-w-3xl mx-auto space-y-16 relative z-10">
        
        {/* Section 1 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-4"
        >
          <h2 className="text-h2 text-ink">1. The Truth About Hidden AI Costs</h2>
          <p className="text-body text-ink-muted">
            Most general-purpose AI voice infrastructure providers advertise a low base rate, but fail to clearly communicate the stack required to actually place a call. You often end up paying separately for speech-to-text (STT), the large language model (LLM) reasoning, the text-to-speech (TTS) output, and the SIP telephony routing.
          </p>
          <p className="text-body text-ink-muted">
            Clarity Voice eliminates vendor stacking. We offer a single, transparent flat rate of ₹3.99/min that includes the complete pipeline—from STT and LLM processing to premium native voices and telephony routing. You model your ROI based on a predictable cost, without surprise overages.
          </p>
        </motion.div>

        {/* Section 2 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-4"
        >
          <h2 className="text-h2 text-ink">2. Latency & The Interruption Problem</h2>
          <p className="text-body text-ink-muted">
            A delay of 800 milliseconds in a voice conversation breaks human trust. When a user speaks, and the AI pauses to process, the user often repeats themselves, causing the AI to interrupt them. This overlapping creates a frustrating, robotic experience that drives high drop-off rates.
          </p>
          <p className="text-body text-ink-muted">
            By vertically integrating our orchestration layer and optimizing our WebRTC SIP trunking, Clarity Voice achieves sub-180ms response latencies. We also implement native interruption handling—if a user cuts off the AI, it immediately stops speaking and listens, just like a human operator would.
          </p>
        </motion.div>

        {/* Section 3 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-4"
        >
          <h2 className="text-h2 text-ink">3. Multilingual Nuance vs. Translation APIs</h2>
          <p className="text-body text-ink-muted">
            Competitors frequently rely on real-time translation APIs piped into English-centric LLMs. This approach fails to capture regional slang, cultural idioms, and the natural flow of languages like Hindi, Bengali, or Arabic.
          </p>
          <p className="text-body text-ink-muted">
            Clarity Voice leverages models natively trained on over 70 regional dialects. Our agents don't translate; they comprehend and reason in the native language directly. This results in perfect diction, natural pauses, and the ability to seamlessly switch languages mid-conversation if the customer changes their preference.
          </p>
        </motion.div>

        {/* Section 4 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-4"
        >
          <h2 className="text-h2 text-ink">4. Integration Reality</h2>
          <p className="text-body text-ink-muted">
            A voice agent is only as powerful as the systems it can access. While others offer rigid visual flow builders, they often struggle when requiring real-time CRM lookups or dynamic API calls mid-conversation.
          </p>
          <p className="text-body text-ink-muted">
            Clarity Voice is built for developers and operators alike. We offer robust webhook support and real-time tool calling, allowing your agent to fetch an order status, verify a patient record, or log a disposition code directly into your backend before the call even ends.
          </p>
        </motion.div>

      </section>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-border-soft p-4 flex justify-center z-50">
        <div className="flex items-center justify-between w-full max-w-4xl px-4 md:px-0">
          <div className="hidden md:block">
            <h4 className="text-small font-bold text-ink">Ready to migrate?</h4>
            <p className="text-caption text-ink-muted">Deploy your first agent in under 10 minutes.</p>
          </div>
          <button onClick={() => setPage("dashboard")} className="btn-primary w-full md:w-auto">
            Build Your First Voice Agent (Free)
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>

    </div>
  );
}

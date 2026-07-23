import { motion } from "motion/react";
import { ArrowRight, Check, X } from "lucide-react";

type Page = any;

interface CompareProps {
  setPage: (p: Page) => void;
}

export default function Compare({ setPage }: CompareProps) {
  return (
    <div className="space-y-28 pb-32 pt-32 bg-cream-bg min-h-screen">
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
          ENTERPRISE BENCHMARKING GUIDE
        </span>
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display text-ink leading-tight"
        >
          Evaluating Clarity Voice vs. Bolna, Retell AI, Vapi, & ElevenLabs
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-body text-ink-muted max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          A 3,000+ word deep-dive comparative analysis evaluating latency parameters, pricing models, Indian regional dialect comprehension, and workflow builders across major voice AI platforms.
        </motion.p>
      </section>

      {/* Editorial Section 1: Hidden Costs */}
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-8">
          <h2 className="font-sora text-3xl font-extrabold text-ink">
            1. The Operational Reality of Hidden Voice AI Costs
          </h2>
          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
            <p>
              When evaluating developer voice platforms like Retell AI or Vapi, engineering teams are often attracted by low advertised base rates. However, in production deployments, these platforms bill users through stacked API pricing: charging separately for Speech-to-Text (ASR), LLM token processing, neural Text-to-Speech (TTS), and SIP carrier trunking.
            </p>
            <p>
              For example, a 3-minute outbound qualification call billed through chained APIs can easily cost $0.25 to $0.40 per call when high-tier TTS models (like ElevenLabs) are attached. In contrast, <strong>Clarity Voice provides a single, transparent rate of ₹3.99/min</strong> (or bundled at ~₹3.33/min on Growth plans) with zero stacked vendor fees.
            </p>
          </div>
        </div>
      </section>

      {/* Editorial Section 2: Latency & Interruption */}
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-8">
          <h2 className="font-sora text-3xl font-extrabold text-ink">
            2. Response Latency & Full-Duplex Interruption Handling
          </h2>
          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
            <p>
              Human conversation relies on immediate feedback. If an AI voice agent takes 800ms to 1,200ms to respond, callers experience awkward awkward pauses and frequently repeat themselves. When both human and bot speak simultaneously, platforms lacking full-duplex barge-in support collapse into chaotic audio collisions.
            </p>
            <p>
              By bypassing HTTP REST hops and deploying direct WebRTC zero-copy audio pipelines, <strong>Clarity Voice achieves sub-180ms response latencies</strong>. If a caller interrupts mid-phrase, the AI immediately stops speaking, processes the new utterance, and responds naturally.
            </p>
          </div>
        </div>
      </section>

      {/* Editorial Section 3: Indian Regional Dialects */}
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-8">
          <h2 className="font-sora text-3xl font-extrabold text-ink">
            3. Native Indian Regional Dialects vs. English-Centric Translation
          </h2>
          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
            <p>
              Western platforms like ElevenLabs and Bland AI are heavily optimized for North American English. When applied to Indian Tier-2 and Tier-3 markets, they struggle with regional accents, localized terminology, and code-switching (e.g. mixing Hindi with English phrases).
            </p>
            <p>
              Clarity Voice natively models 70+ languages and regional dialects—including Hindi, Bengali, Gujarati, Marathi, Kannada, Malayalam, and Tamil—ensuring high intent accuracy for Cash-on-Delivery confirmation calls and loan collections across India.
            </p>
          </div>
        </div>
      </section>

      {/* Editorial Section 4: Workflow Builders */}
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-8">
          <h2 className="font-sora text-3xl font-extrabold text-ink">
            4. Agent Workflow Builders & Dynamic Function Calling
          </h2>
          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
            <p>
              While platforms like Bolna offer visual flow nodes, complex enterprise workflows require real-time backend tool execution while the call is active. Clarity Voice supports prompt-driven function calling, enabling voice agents to fetch live CRM records, verify database inventory, and send instant SMS payment links during live calls.
            </p>
          </div>
        </div>
      </section>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[#EADEC9] p-4 flex justify-center z-50">
        <div className="flex items-center justify-between w-full max-w-4xl px-4 md:px-0">
          <div className="hidden md:block">
            <h4 className="font-sora font-bold text-ink">Ready to migrate from Retell, Vapi, or Bolna?</h4>
            <p className="text-xs text-ink-muted">Deploy your first enterprise agent in under 10 minutes.</p>
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

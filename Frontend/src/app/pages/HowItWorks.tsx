import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { PhoneCall, Check, FileText, Cpu, Database, Languages, BarChart3, Radio, UserCheck, ShieldCheck } from "lucide-react";
import FeatureCapabilityGrid from "../components/showroom/FeatureCapabilityGrid";

type Page = any;

interface HowItWorksProps {
  setPage: (p: Page) => void;
}

function AnimatedCallSequence() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % 3);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-48 h-48 mx-auto relative flex items-center justify-center bg-surface-white rounded-full shadow-level-3">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center text-forest-deep"
          >
            <PhoneCall className="w-12 h-12 mb-2 text-amber-cta animate-pulse" />
            <span className="text-small font-bold">Connecting...</span>
          </motion.div>
        )}
        {step === 1 && (
          <motion.div
            key="wave"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2 h-12"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="w-2 bg-mint-primary rounded-pill"
                animate={{ height: ["20%", "100%", "20%"] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
              />
            ))}
          </motion.div>
        )}
        {step === 2 && (
          <motion.div
            key="document"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center text-forest-deep"
          >
            <div className="relative">
              <FileText className="w-12 h-12 text-mint-primary" />
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute -bottom-2 -right-2 bg-amber-cta text-surface-white rounded-full p-1"
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </motion.div>
            </div>
            <span className="text-small font-bold mt-2">Logged</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HowItWorks({ setPage }: HowItWorksProps) {
  const steps = [
    {
      num: "01",
      title: "API Trigger & Webhook Event Intake",
      desc: "Connect your CRM, store, or database via REST webhooks or direct integrations. Call jobs queue automatically when specific business events occur (e.g. order placed, form submitted, appointment requested)."
    },
    {
      num: "02",
      title: "Sub-180ms Audio Pipeline Initialization",
      desc: "Our native multimodal orchestration engine connects via WebRTC to SIP trunking providers, initializing natural bidirectional audio streams in under 180 milliseconds."
    },
    {
      num: "03",
      title: "Real-Time Prompt & Tool Execution",
      desc: "The voice AI agent converses naturally, executes real-time function calls (checking inventory, verifying identity, booking calendar slots), and seamlessly handles mid-sentence interruptions."
    },
    {
      num: "04",
      title: "Automated Disposition & CRM Sync",
      desc: "The moment the call ends, full audio transcripts, sentiment scores, and structured disposition data are scrubbed for PII at the edge and synced back to your database."
    }
  ];

  return (
    <div className="space-y-28 pb-32 pt-32 bg-cream-bg min-h-screen">
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
          DEEP TECHNICAL ARCHITECTURE
        </span>
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display text-ink"
        >
          Platform Architecture & Technical Specifications
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-body text-ink-muted max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          Discover how Clarity Voice orchestrates low-latency multimodal speech models, real-time function execution, RAG knowledge bases, and enterprise SIP trunking.
        </motion.p>
      </section>

      {/* Visual Animation Section */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <AnimatedCallSequence />
      </section>

      {/* 4 Core Sequential Steps */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <motion.div 
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="card-soft relative group hover:border-mint-primary/50 transition-colors bg-surface-white p-8"
            >
              <div className="text-[64px] font-display font-bold text-mint-soft absolute -top-4 -right-2 -z-10 group-hover:text-mint-primary/20 transition-colors">
                {step.num}
              </div>
              <h3 className="font-sora text-xl font-bold text-ink mb-3">{step.title}</h3>
              <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TECHNICAL MODULE 1: Real-Time Audio Engine */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
              <Cpu className="w-10 h-10 text-mint-primary" />
              <h2 className="font-sora text-3xl font-bold text-ink">
                1. Real-Time Audio Orchestration Engine & Low-Latency Telephony
              </h2>
            </div>
            <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
              <p>
                Conversational human speech occurs within tight latency windows. When a human speaks to another human, average response latency is approximately 200 milliseconds. If an automated phone system introduces 800ms to 1.5 seconds of delay, callers immediately detect the artificial delay, causing hesitation, conversational overlap, and high drop-off rates.
              </p>
              <p>
                Clarity Voice solves latency at the infrastructure layer. By employing zero-copy WebRTC audio buffer streaming directly to our multimodal reasoning core, we bypass traditional HTTP API proxy hops. Audio packets travel over UDP directly from telecom carriers to neural inference servers, reducing round-trip latency to sub-180 milliseconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TECHNICAL MODULE 2: Prompt-Based Agent Engine */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
              <Database className="w-10 h-10 text-amber-cta" />
              <h2 className="font-sora text-3xl font-bold text-ink">
                2. Prompt-Based Workflow Engine & Dynamic Tool Calling
              </h2>
            </div>
            <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
              <p>
                Unlike legacy rigid decision-tree bots, Clarity Voice utilizes a prompt-driven state engine. Operators configure system instructions, agent personas, conversation goals, and function call schemas using natural language.
              </p>
              <p>
                While live on a call, the voice AI agent dynamically decides when to invoke external APIs. For example, if a customer asks, "Can I reschedule my delivery to Friday afternoon?", the agent executes a background tool call to check courier availability, updates the database, and confirms the new time slot to the caller in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TECHNICAL MODULE 3: RAG Knowledge Base Calling */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
              <Languages className="w-10 h-10 text-mint-primary" />
              <h2 className="font-sora text-3xl font-bold text-ink">
                3. Retrieval-Augmented Generation (RAG) for Voice Knowledge Bases
              </h2>
            </div>
            <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
              <p>
                To eliminate hallucinations and guarantee 100% compliant responses, Clarity Voice integrates high-speed vector retrieval directly into the conversation stream.
              </p>
              <p>
                Enterprise teams can upload product documentation, medical protocols, financial terms, or warranty manuals. During a live phone call, incoming queries trigger micro-vector lookups, injecting exact factual chunks into the agent's context within milliseconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TECHNICAL MODULE 4: Feature Capability Grid */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="font-sora text-3xl md:text-4xl font-extrabold text-ink">
            Complete Architectural Feature Matrix
          </h2>
          <p className="text-body text-ink-muted font-plus-jakarta">
            Inspect all 12 core capability modules powering Clarity Voice enterprise deployments.
          </p>
        </div>

        <FeatureCapabilityGrid />
      </section>

      {/* CTA Section */}
      <section className="px-6 max-w-4xl mx-auto text-center py-10">
        <button onClick={() => setPage("dashboard")} className="btn-primary text-lg px-10 py-4">
          Test Live Sandbox Architecture
        </button>
      </section>
    </div>
  );
}

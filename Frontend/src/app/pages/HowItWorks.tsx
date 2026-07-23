import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { Network, Volume2, ShieldAlert, Cpu, PhoneCall, Check, FileText } from "lucide-react";

type Page = 
  | "home" 
  | "solutions" 
  | "how-it-works" 
  | "voices" 
  | "pricing" 
  | "compare" 
  | "blog" 
  | "docs" 
  | "dashboard";

interface HowItWorksProps {
  setPage: (p: Page) => void;
}

// ─── Custom Lottie Animation Sequence (Simulating the 4-step call connection)
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
      title: "Connect",
      desc: "Link your store or system, and every relevant conversation queues automatically, no manual work required."
    },
    {
      num: "02",
      title: "Call placed",
      desc: "Clarity places a real, natural call at the right moment, in the right language, sounding like your business."
    },
    {
      num: "03",
      title: "Outcome logged",
      desc: "The result and a full transcript land in your dashboard instantly, the moment the call ends."
    },
    {
      num: "04",
      title: "Act with confidence",
      desc: "Move forward only on what's actually confirmed, not on hope."
    }
  ];

  return (
    <div className="space-y-20 pb-20 pt-32 bg-cream-bg min-h-screen">
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display text-ink"
        >
          How it works
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-body text-ink-muted max-w-3xl mx-auto"
        >
          A fully automated workflow replacing manual calling queues.
        </motion.p>
      </section>

      {/* Visual Animation Section */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 py-10">
        <AnimatedCallSequence />
      </section>

      {/* Step panels sequence */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <motion.div 
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="card-soft relative group hover:border-mint-primary/50 transition-colors bg-surface-white"
            >
              <div className="text-[64px] font-display font-bold text-mint-soft absolute -top-4 -right-2 -z-10 group-hover:text-mint-primary/20 transition-colors">
                {step.num}
              </div>
              <h3 className="text-h3 text-ink mb-3">{step.title}</h3>
              <p className="text-body text-ink-muted">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 max-w-4xl mx-auto text-center py-10">
        <button onClick={() => setPage("dashboard")} className="btn-primary text-lg px-10 py-4">
          View Interactive Dashboard
        </button>
      </section>
    </div>
  );
}

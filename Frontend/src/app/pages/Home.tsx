import { motion } from "motion/react";
import Hero from "../components/hero/Hero";
import SolutionsTab from "../components/solutions/SolutionsTab";
import RoiCalculator from "../components/calculator/RoiCalculator";
import { Zap, Mic, BookOpen, Check, ArrowRight, Shield, Clock, TrendingUp } from "lucide-react";

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

interface HomeProps {
  setPage: (p: Page) => void;
}

export default function Home({ setPage }: HomeProps) {
  return (
    <div className="space-y-32 pb-32 overflow-hidden bg-cream-bg">
      <Hero setPage={setPage} />

      {/* Section: What Clarity Voice actually does */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <h2 className="text-h1 text-ink">
              What Clarity Voice <span className="text-forest-deep italic">actually</span> does
            </h2>
            <p className="text-body text-ink-muted">
              Most businesses either skip the phone call that would have caught a problem, or they hire people to make that call by hand — and hope it scales. Clarity Voice does that calling for you: automatically, at any volume, in the language your customer actually speaks.
            </p>
            <p className="text-body text-ink-muted">
              For online sellers, that means calling every cash-on-delivery customer before their order ships, to confirm the order and the address is right — catching a wrong number, a changed mind, or an outdated address before a courier is ever sent. 
            </p>
            <p className="text-body text-ink-muted font-medium text-ink">
              For any business with appointments, verifications, or time-sensitive conversations, the same underlying idea applies: a real, natural conversation happens automatically, at the exact moment it needs to, without a queue and without a hire.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            {/* Collage panels */}
            <div className="absolute inset-0 bg-mint-soft rounded-[32px] rotate-6 transform translate-x-4 translate-y-4 -z-10" />
            <div className="card-soft border-none rounded-[32px] p-10 space-y-8 bg-surface-white/90 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-forest-deep flex items-center justify-center text-mint-primary">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-h3 text-ink">Fewer costly mistakes</h4>
                  <p className="text-small text-ink-muted">A two-minute confirmation call catches problems early.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-cta flex items-center justify-center text-surface-white">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-h3 text-ink">No hiring, no burnout</h4>
                  <p className="text-small text-ink-muted">Capacity scales with volume, not headcount.</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-mint-primary flex items-center justify-center text-forest-deep">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-h3 text-ink">Complete visibility</h4>
                  <p className="text-small text-ink-muted">Instant transcripts land in your dashboard.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Section: How it works */}
      <section className="px-6 max-w-7xl mx-auto py-20 relative">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto space-y-4 mb-16"
        >
          <h2 className="text-h1 text-ink">How it works</h2>
          <p className="text-body text-ink-muted">A fully automated workflow replacing manual calling queues.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { num: "01", title: "Connect", desc: "Link your store or system, and every relevant conversation queues automatically, no manual work required." },
            { num: "02", title: "Call placed", desc: "Clarity places a real, natural call at the right moment, in the right language, sounding like your business." },
            { num: "03", title: "Outcome logged", desc: "The result and a full transcript land in your dashboard instantly, the moment the call ends." },
            { num: "04", title: "Act with confidence", desc: "Move forward only on what's actually confirmed, not on hope." }
          ].map((step, idx) => (
            <motion.div 
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="card-soft relative group hover:border-mint-primary/50 transition-colors"
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

      {/* Section: Why Clarity */}
      <section className="px-6 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="panel-texture p-12 md:p-20 flex flex-col md:flex-row items-center gap-12"
        >
          <div className="flex-1 space-y-6">
            <h2 className="text-h1 text-surface-white">
              Why Clarity, not a general-purpose AI platform
            </h2>
            <p className="text-body text-mint-soft">
              General voice AI infrastructure treats your specific workflow as one use case among dozens — you build the flow yourself, and you pay separately for speech-to-text, the language model, and the voice output. 
            </p>
            <p className="text-body text-mint-soft">
              Clarity Voice is built around getting you to a working, reliable voice agent quickly, with transparent, unified pricing, and a genuine focus on the conversations that actually matter to your business — not a generic platform that happens to also do what you need.
            </p>
          </div>
          <div className="flex-shrink-0 w-full md:w-auto">
            <div className="card-soft bg-surface-white/10 backdrop-blur-md border-surface-white/20 p-8">
              <h3 className="text-h3 text-surface-white mb-2">Transparent Pricing</h3>
              <p className="text-display text-mint-primary mb-1">₹3.99<span className="text-h3 text-mint-soft">/min</span></p>
              <p className="text-small text-mint-soft mb-6">No stacked fees. One clear price.</p>
              <button onClick={() => setPage("pricing")} className="btn-primary w-full bg-surface-white text-forest-deep hover:bg-cream-bg">
                View Plans
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 max-w-4xl mx-auto text-center py-20 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-h1 text-ink mb-6">
            Stop finding out about a problem after it's already cost you something.
          </h2>
          <p className="text-body text-ink-muted mb-10">
            Start automatically resolving the conversations that matter — free to try, no calling team required.
          </p>
          <button onClick={() => setPage("dashboard")} className="btn-cta bg-amber-cta text-surface-white hover:bg-[#d4742e]">
            Start Free Trial Today
            <ArrowRight className="w-5 h-5 ml-2 inline" />
          </button>
        </motion.div>
      </section>
    </div>
  );
}

import { motion } from "motion/react";
import { Check, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import RoiCalculator from "../components/calculator/RoiCalculator";

type Page = any;

interface PricingProps {
  setPage: (p: Page) => void;
}

export default function Pricing({ setPage }: PricingProps) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How is Clarity Voice pricing structured?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Clarity Voice offers transparent bundled plans: Startup Plan at ₹1,799/mo (500 minutes included), Growth Plan at ₹4,999/mo (1,500 minutes included), and a standalone pay-as-you-go flat rate of ₹3.99/minute with no stacked fees."
        }
      },
      {
        "@type": "Question",
        "name": "Are there hidden costs for Speech-to-Text (STT) or Text-to-Speech (TTS)?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Unlike general voice AI platforms like Vapi or Retell that charge separate fees for STT, LLM tokens, and TTS voices, Clarity Voice provides unified pricing covering the complete audio pipeline."
        }
      }
    ]
  };

  return (
    <div className="space-y-28 pb-32 pt-32 bg-cream-bg min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
          TRANSPARENT ENTERPRISE PRICING
        </span>
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display text-ink leading-tight"
        >
          Predictable Bundled Plans & Flat-Rate Economics
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-body text-ink-muted max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          One unified price per minute. No stacked fees for speech recognition, LLM reasoning, or neural voice synthesis.
        </motion.p>
      </section>

      {/* 3 Tier Pricing Cards */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Startup Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 flex flex-col justify-between shadow-level-2"
          >
            <div>
              <h3 className="font-sora text-2xl font-bold text-ink mb-2">Startup Plan</h3>
              <p className="text-small text-ink-muted mb-8 font-plus-jakarta">Ideal for growing businesses testing automated call campaigns.</p>
              <div className="mb-8">
                <span className="font-sora text-4xl font-extrabold text-ink">₹1,799</span>
                <span className="text-small text-ink-muted font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-mint-primary mt-2">Includes 500 Bundled Mins (₹3.59/min)</p>
              </div>
              <ul className="space-y-4 mb-10 text-small text-ink font-semibold">
                {['500 Bundled Call Minutes', '26+ HD Voice Personas', '70+ Languages & Dialects', 'Standard Webhooks & CRM Sync', 'Real-Time Transcripts', 'Community Support'].map(f => (
                  <li key={f} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-mint-primary flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => setPage("dashboard")} className="btn-cta bg-surface-white text-ink border border-border-soft hover:bg-cream-bg w-full">
              Get Started
            </button>
          </motion.div>

          {/* Growth Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="panel-texture p-10 flex flex-col justify-between relative shadow-level-4"
          >
            <div className="absolute top-6 right-6 bg-amber-cta text-white text-caption font-bold px-3 py-1 rounded-full">
              MOST POPULAR
            </div>
            <div>
              <h3 className="font-sora text-2xl font-bold text-white mb-2">Growth Plan</h3>
              <p className="text-small text-mint-soft mb-8 font-plus-jakarta">For high-volume operations scaling outbound/inbound workflows.</p>
              <div className="mb-8">
                <span className="font-sora text-4xl font-extrabold text-mint-primary">₹4,999</span>
                <span className="text-small text-mint-soft font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-mint-soft mt-2">Includes 1,500 Bundled Mins (₹3.33/min)</p>
              </div>
              <ul className="space-y-4 mb-10 text-small text-white font-semibold">
                {['1,500 Bundled Call Minutes', 'Everything in Startup', 'Priority Telephony Routing', '1 Custom Voice Clone', 'Sentiment Analytics & Scoring', 'Dedicated Phone Numbers', 'Priority Email & Chat Support'].map(f => (
                  <li key={f} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-mint-primary flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => setPage("dashboard")} className="btn-primary w-full bg-mint-primary text-forest-deep">
              Start Building Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </motion.div>

          {/* Enterprise Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 flex flex-col justify-between shadow-level-2"
          >
            <div>
              <h3 className="font-sora text-2xl font-bold text-ink mb-2">Enterprise Plan</h3>
              <p className="text-small text-ink-muted mb-8 font-plus-jakarta">For regulated enterprise contact centers requiring custom SLAs.</p>
              <div className="mb-8">
                <span className="font-sora text-4xl font-extrabold text-ink">Custom</span>
                <span className="text-small text-ink-muted font-bold"> volume</span>
                <p className="text-xs font-mono font-bold text-amber-cta mt-2">Dedicated IP & Custom Infrastructure</p>
              </div>
              <ul className="space-y-4 mb-10 text-small text-ink font-semibold">
                {['Unlimited Call Volume Capacity', 'Everything in Growth', 'Dedicated SIP IP Addresses', 'Custom Voice Personas & Cloning', 'HIPAA & SOC 2 BAA Agreement', '99.99% Uptime SLA', 'Dedicated 24/7 Account Manager'].map(f => (
                  <li key={f} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-mint-primary flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => window.location.href="mailto:support@claritiy.com"} className="btn-cta bg-surface-white text-ink border border-border-soft hover:bg-cream-bg w-full">
              Contact Enterprise Sales
            </button>
          </motion.div>

        </div>

        {/* Embedded ROI Calculator */}
        <div className="mt-20">
          <RoiCalculator />
        </div>
      </section>

      {/* Copy Section: Transparent Pricing Philosophy */}
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-8">
          <h2 className="font-sora text-3xl font-bold text-ink">
            Pay-As-You-Go Base Rate: Flat ₹3.99 / Minute
          </h2>
          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
            <p>
              If your calling volume fluctuates seasonally, you can utilize our standalone Pay-As-You-Go tier at a flat <strong>₹3.99 per minute</strong>.
            </p>
            <p>
              Unlike legacy telephony SaaS platforms that bill separately for Speech-to-Text ($0.02/min), LLM Tokens ($0.03/min), and Neural Text-to-Speech ($0.04/min), Clarity Voice unifies the entire stack into one transparent invoice. What you see is what you pay—with zero surprise overages.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

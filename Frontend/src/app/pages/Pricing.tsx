import { motion } from "motion/react";
import { Check, ArrowRight } from "lucide-react";

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

interface PricingProps {
  setPage: (p: Page) => void;
}

export default function Pricing({ setPage }: PricingProps) {
  return (
    <div className="space-y-32 pb-32 pt-32 bg-cream-bg min-h-screen">
      {/* JSON-LD for Pricing FAQ inside this page's head conceptually or via component */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How is pricing structured?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "One transparent price per minute, with monthly and annual plans available that include bundled minutes at a lower effective rate."
                }
              }
            ]
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Clarity Voice AI",
            "applicationCategory": "BusinessApplication",
            "offers": {
              "@type": "Offer",
              "price": "3.99",
              "priceCurrency": "INR"
            }
          })
        }}
      />

      <section className="px-6 max-w-4xl mx-auto text-center space-y-6">
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display text-ink"
        >
          Transparent, honest pricing
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-body text-ink-muted"
        >
          One clear price per minute. No stacked fees for speech recognition, the AI model, and the voice output separately, the way other platforms charge.
        </motion.p>
      </section>

      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Free Tier */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-soft relative p-10 flex flex-col"
          >
            <h3 className="text-h2 text-ink mb-2">Free Trial</h3>
            <p className="text-body text-ink-muted mb-8">Test the platform with no commitment.</p>
            <div className="mb-8">
              <span className="text-display text-ink">₹0</span>
              <span className="text-body text-ink-muted"> / forever</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {['10 free minutes included', 'Access to standard voices', 'Real-time transcripts', 'Community support'].map(f => (
                <li key={f} className="flex items-center gap-3 text-body text-ink font-medium">
                  <Check className="w-5 h-5 text-mint-primary" /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => setPage("dashboard")} className="btn-cta bg-surface-white text-ink border border-border-soft hover:bg-cream-bg w-full">
              Get Started Free
            </button>
          </motion.div>

          {/* Pay as you go */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="panel-texture p-10 flex flex-col"
          >
            <div className="absolute top-6 right-6 bg-amber-cta text-surface-white text-caption font-bold px-3 py-1 rounded-pill">
              MOST POPULAR
            </div>
            <h3 className="text-h2 text-surface-white mb-2">Pay as you go</h3>
            <p className="text-body text-mint-soft mb-8">Scale infinitely with unified pricing.</p>
            <div className="mb-8">
              <span className="text-display text-mint-primary">₹3.99</span>
              <span className="text-body text-mint-soft"> / minute</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {['Access to all premium voices', 'Multilingual support (Hindi, English, etc.)', 'Unlimited agents', 'Bring your own SIP trunk', 'Full API access', 'Priority email support'].map(f => (
                <li key={f} className="flex items-center gap-3 text-body text-surface-white font-medium">
                  <Check className="w-5 h-5 text-mint-primary" /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => setPage("dashboard")} className="btn-primary w-full bg-mint-primary text-forest-deep">
              Start Building Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </motion.div>

        </div>
      </section>
    </div>
  );
}

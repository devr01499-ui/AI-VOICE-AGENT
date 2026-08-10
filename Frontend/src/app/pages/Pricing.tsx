import { useState } from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, ShieldCheck, Zap, Loader2 } from "lucide-react";
import RoiCalculator from "../components/calculator/RoiCalculator";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Page = any;

interface PricingProps {
  setPage: (p: Page) => void;
}

export default function Pricing({ setPage }: PricingProps) {
  const [purchasingPlan, setPurchasingPlan] = useState<string | null>(null);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePurchase = async (planName: string, price: number) => {
    setPurchasingPlan(planName);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) throw new Error('Payment system failed to load.');

      const orderRes = await fetch('http://localhost:5000/api/v2/billing/create-plan-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ price })
      });
      const orderData = await orderRes.json();
      if (!orderData.success) throw new Error(orderData.error || 'Order creation failed');

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mock',
        amount: orderData.data.amount,
        currency: orderData.data.currency,
        name: 'Claritiy Voice',
        description: `${planName} Plan`,
        order_id: orderData.data.id,
        prefill: {
          email: '', // Let user fill it in
        },
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('http://localhost:5000/api/v2/billing/verify-plan', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                plan: planName,
                email: response.razorpay_customer_email || 'unknown@example.com',
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              alert(`Success! You have purchased the ${planName} Plan.`);
              setPage("dashboard");
            } else {
              alert(verifyData.error || 'Verification failed.');
            }
          } catch (verifyErr: any) {
             alert(verifyErr.message || 'Verification error');
          }
        },
        modal: {
          ondismiss: function() {
            setPurchasingPlan(null);
          }
        },
        theme: {
          color: '#059669' 
        }
      };

      const paymentObject = new window.Razorpay(options);
      
      paymentObject.on('payment.failed', function (response: any) {
        alert(`Payment failed: ${response.error.description || 'Unknown error'}`);
        setPurchasingPlan(null);
      });

      paymentObject.open();

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Provisioning failed');
      setPurchasingPlan(null);
    }
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How is Claritiy Voice pricing structured?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Claritiy Voice offers transparent bundled plans: Startup Plan at ₹2,999/mo (750 minutes included), Growth Plan at ₹9,999/mo (2,865 minutes included), Enterprise Plan at ₹29,999/mo (10,000 minutes included), and a standalone pay-as-you-go flat rate of ₹3.99/minute with no stacked fees."
        }
      },
      {
        "@type": "Question",
        "name": "Are there hidden costs for Speech-to-Text (STT) or Text-to-Speech (TTS)?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Unlike general voice AI platforms like Vapi or Retell that charge separate fees for STT, LLM tokens, and TTS voices, Claritiy Voice provides unified pricing covering the complete audio pipeline."
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
                <span className="font-sora text-4xl font-extrabold text-ink">₹2,999</span>
                <span className="text-small text-ink-muted font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-mint-primary mt-2">Includes 750 Bundled Mins (₹3.99/min)</p>
              </div>
              <ul className="space-y-4 mb-10 text-small text-ink font-semibold">
                {['750 Bundled Call Minutes', '26+ HD Voice Personas', '70+ Languages & Dialects', 'Standard Webhooks & CRM Sync', 'Real-Time Transcripts', 'Community Support'].map(f => (
                  <li key={f} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-mint-primary flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Startup", 2999)} 
              disabled={purchasingPlan === "Startup"}
              className="btn-cta bg-surface-white text-ink border border-border-soft hover:bg-cream-bg w-full flex items-center justify-center gap-2"
            >
              {purchasingPlan === "Startup" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Purchase Startup Plan"}
            </button>
          </motion.div>

          {/* Growth Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 flex flex-col justify-between relative shadow-level-4"
          >
            <div className="absolute top-6 right-6 bg-amber-cta text-white text-caption font-bold px-3 py-1 rounded-full">
              MOST POPULAR
            </div>
            <div>
              <h3 className="font-sora text-2xl font-bold text-ink mb-2">Growth Plan</h3>
              <p className="text-small text-ink-muted mb-8 font-plus-jakarta">For high-volume operations scaling outbound/inbound workflows.</p>
              <div className="mb-8">
                <span className="font-sora text-4xl font-extrabold text-ink">₹9,999</span>
                <span className="text-small text-ink-muted font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-mint-primary mt-2">Includes 2,865 Bundled Mins (₹3.49/min)</p>
              </div>
              <ul className="space-y-4 mb-10 text-small text-ink font-semibold">
                {['2,865 Bundled Call Minutes', 'Everything in Startup', 'Priority Telephony Routing', '1 Custom Voice Clone', 'Sentiment Analytics & Scoring', 'Dedicated Phone Numbers', 'Priority Email & Chat Support'].map(f => (
                  <li key={f} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-mint-primary flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Growth", 9999)} 
              disabled={purchasingPlan === "Growth"}
              className="btn-primary w-full bg-mint-primary text-forest-deep flex items-center justify-center"
            >
              {purchasingPlan === "Growth" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Purchase Growth Plan
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
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
                <span className="font-sora text-4xl font-extrabold text-ink">₹29,999</span>
                <span className="text-small text-ink-muted font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-mint-primary mt-2">Includes 10,000 Bundled Mins (₹2.99/min)</p>
              </div>
              <ul className="space-y-4 mb-10 text-small text-ink font-semibold">
                {['10,000 Bundled Call Minutes', 'Everything in Growth', 'Dedicated SIP IP Addresses', 'Custom Voice Personas & Cloning', 'HIPAA & SOC 2 BAA Agreement', '99.99% Uptime SLA', 'Dedicated 24/7 Account Manager'].map(f => (
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
              Unlike legacy telephony SaaS platforms that bill separately for Speech-to-Text ($0.02/min), LLM Tokens ($0.03/min), and Neural Text-to-Speech ($0.04/min), Claritiy Voice unifies the entire stack into one transparent invoice. What you see is what you pay—with zero surprise overages.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

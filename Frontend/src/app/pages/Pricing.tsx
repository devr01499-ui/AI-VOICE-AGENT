import { motion } from "motion/react";
import RoiCalculator from "../components/calculator/RoiCalculator";
import { Check } from "lucide-react";

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

interface PricingProps {
  setPage: (p: Page) => void;
}

export default function Pricing({ setPage }: PricingProps) {
  const tiers = [
    {
      title: "Pay-As-You-Go",
      price: "₹3.99",
      period: "per minute",
      description: "Ideal for startups, pilots, and scaling businesses testing voice automation.",
      features: [
        "Zero upfront commitments or monthly minimums",
        "Access to all 26+ HD voice personas",
        "70+ languages and regional dialects",
        "Native Webhook & API integrations",
        "Standard SIP & PSTN trunking"
      ],
      action: "Start Free Sandbox"
    },
    {
      title: "Growth Plan",
      price: "₹1,799",
      period: "per month",
      description: "Designed for growing D2C brands, clinics, and real estate teams.",
      features: [
        "Includes 500 bundled minutes (₹3.59/min effective rate)",
        "Priority call routing & low-latency servers",
        "Custom voice cloning (1 voice included)",
        "Advanced analytics & sentiment scoring",
        "Dedicated phone number reservation"
      ],
      action: "Upgrade to Growth",
      featured: true
    },
    {
      title: "Enterprise Custom",
      price: "Custom",
      period: "billing options",
      description: "For high-volume call centers, financial institutions, and global enterprises.",
      features: [
        "Unlimited concurrent channels",
        "On-premise deployment options",
        "Custom SLA guarantees (99.99% Uptime)",
        "Custom CRM integrations (Salesforce, SAP)",
        "Dedicated account manager & 24/7 phone support"
      ],
      action: "Contact Enterprise Sales"
    }
  ];

  return (
    <div className="space-y-20 pb-20 pt-10 text-slate-600">
      {/* Price Promise Section */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs font-semibold text-cyan-600 tracking-widest uppercase mb-4 font-mono">
            Platform Pricing
          </p>
          <h1 className="font-sora text-5xl lg:text-6xl font-extrabold leading-tight text-[#0F172A] tracking-tight">
            No Stacked Surcharges. No Hidden Math. <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#059669] to-[#10B981]">Just One Transparent Rate.</span>
          </h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto mt-6 leading-relaxed font-plus-jakarta font-semibold">
            Most voice AI vendors charge you separately for Speech-to-Text ($0.01/min), the Language Model ($0.03/min), and Text-to-Speech ($0.05/min), plus server overhead. With Clarity Voice, you pay one clean, predictable price of ₹3.99 per minute.
          </p>
        </motion.div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {tiers.map((t, idx) => (
            <div 
              key={idx} 
              className={`bg-white border rounded-3xl p-8 flex flex-col justify-between text-left shadow-sm relative ${
                t.featured ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-[#EADEC9]"
              }`}
            >
              {t.featured && (
                <span className="absolute top-4 right-4 text-[9px] font-mono font-bold text-[#059669] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                  Most Popular
                </span>
              )}
              <div className="space-y-6">
                <div>
                  <h3 className="font-sora text-xl font-bold text-slate-900">{t.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">{t.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-sora text-4xl font-extrabold text-slate-900">{t.price}</span>
                  <span className="text-xs text-slate-500 font-mono">/ {t.period}</span>
                </div>

                <div className="w-full h-px bg-slate-100" />

                <ul className="space-y-3">
                  {t.features.map((f, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold font-plus-jakarta">
                      <Check className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setPage("dashboard")}
                className={`mt-8 w-full font-bold text-xs py-3 rounded-full transition-all text-center ${
                  t.featured
                    ? "bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#10B981] hover:to-[#059669] text-white shadow-md shadow-emerald-500/10"
                    : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t.action}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ROI Savings Section */}
      <section className="px-6 max-w-7xl mx-auto space-y-4">
        <div className="text-center">
          <h2 className="font-sora text-3xl font-extrabold text-slate-900 tracking-tight">Calculate Your Savings Potential</h2>
          <p className="text-xs text-slate-500 font-semibold font-plus-jakarta mt-1">Review operational margins based on monthly metrics.</p>
        </div>
        <RoiCalculator />
      </section>
    </div>
  );
}

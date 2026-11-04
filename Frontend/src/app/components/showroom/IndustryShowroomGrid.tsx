import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2, Landmark, ShieldCheck, Home as HomeIcon, ShoppingBag,
  Truck, Headphones, Code, CheckCircle2, ArrowRight, TrendingUp
} from "lucide-react";

interface IndustryShowroomGridProps {
  setPage?: (p: any, topicId?: string) => void;
}

const INDUSTRIES = [
  {
    id: "healthcare", label: "Healthcare", icon: Building2,
    headline: "AI Voice Agents for Healthcare & Clinics",
    subhead: "Automate patient intake, appointment scheduling, and post-discharge follow-up with edge PII protection.",
    stats: [{ v: "85%", l: "Hold time reduction" }, { v: "24/7", l: "Patient coverage" }, { v: "0s", l: "Queue wait time" }],
    useCases: ["Pre-op call automation", "Appointment reminders & rescheduling", "Post-discharge symptom checks", "Patient intake & triage", "Insurance verification calls"],
    badge: "DPDP Aligned",
    visual: "🏥",
  },
  {
    id: "finance", label: "Finance & Banking", icon: Landmark,
    headline: "AI Voice Agents for Finance & Banking",
    subhead: "EMI collection outreach, KYC verification, fraud alerts, and loan qualification — fully compliant, always accurate.",
    stats: [{ v: "42%", l: "EMI recovery lift" }, { v: "3s", l: "Speed-to-contact" }, { v: "MSME", l: "Registered" }],
    useCases: ["EMI & loan payment reminders", "KYC document follow-up", "Fraud alert verification", "Account inquiry handling", "Loan application status updates"],
    badge: "MSME Registered",
    visual: "🏦",
  },
  {
    id: "ecommerce", label: "E-Commerce", icon: ShoppingBag,
    headline: "AI Voice Agents for E-Commerce & Retail",
    subhead: "Cut return-to-origin rates by 40% with pre-dispatch COD verification, address correction, and abandoned cart recovery.",
    stats: [{ v: "40%", l: "RTO reduction" }, { v: "3s", l: "Post-order call" }, { v: "94%", l: "Contact rate" }],
    useCases: ["COD order verification", "Address & delivery confirmation", "Abandoned cart recovery", "Return authorization", "Delivery slot rescheduling"],
    badge: "RTO Reduction Engine",
    visual: "🛒",
  },
  {
    id: "realestate", label: "Real Estate", icon: HomeIcon,
    headline: "AI Voice Agents for Real Estate Teams",
    subhead: "Speed-to-lead in 3 seconds. Qualify buyer intent, budget, and timeline — then auto-book property tours.",
    stats: [{ v: "3s", l: "Speed-to-lead" }, { v: "3×", l: "Pipeline growth" }, { v: "₹6.98", l: "Per qualified lead" }],
    useCases: ["Lead qualification & intent scoring", "Property tour booking", "Buyer budget & timeline verification", "Broker follow-up automation", "Project update broadcasts"],
    badge: "Speed-to-Lead",
    visual: "🏢",
  },
  {
    id: "insurance", label: "Insurance", icon: ShieldCheck,
    headline: "AI Voice Agents for Insurance Carriers",
    subhead: "FNOL claims intake, policy renewal reminders, and premium collection — reducing processing time by 3.5×.",
    stats: [{ v: "3.5×", l: "FNOL speed" }, { v: "78%", l: "Renewals automated" }, { v: "0", l: "Call queue" }],
    useCases: ["FNOL claims triage & intake", "Policy renewal reminders", "Premium payment collection", "Claim status updates", "Coverage verification calls"],
    badge: "Claims AI",
    visual: "🛡️",
  },
  {
    id: "logistics", label: "Logistics", icon: Truck,
    headline: "AI Voice Agents for Logistics & Supply Chain",
    subhead: "Driver dispatch, delivery confirmation, and exception alerts — achieving 98.5% first-attempt delivery rates.",
    stats: [{ v: "98.5%", l: "First attempt" }, { v: "∞", l: "Concurrent calls" }, { v: "Real-time", l: "Tracking updates" }],
    useCases: ["Driver dispatch coordination", "Delivery slot confirmation", "Failed delivery recovery", "Address clarification calls", "Shipment exception alerts"],
    badge: "Real-Time Dispatch",
    visual: "🚚",
  },
  {
    id: "bpo", label: "BPO / Call Centers", icon: Headphones,
    headline: "AI Voice Agents for BPO & Call Centers",
    subhead: "Handle 10,000+ concurrent calls with zero queue. Inbound triage, overflow handling, and warm escalation.",
    stats: [{ v: "10K+", l: "Concurrent calls" }, { v: "60%", l: "Cost reduction" }, { v: "4.9★", l: "CSAT maintained" }],
    useCases: ["Queue overflow deflection", "Tier-1 FAQ & script handling", "Warm agent handoff with context", "Batch outbound campaigns", "Compliance call logging"],
    badge: "Infinite Scale",
    visual: "🎧",
  },
  {
    id: "saas", label: "SaaS & Agencies", icon: Code,
    headline: "AI Voice Agents for SaaS & Digital Agencies",
    subhead: "White-label AI voice infrastructure for agencies. Demo booking, trial activation, and churn prevention.",
    stats: [{ v: "3×", l: "Trial-to-paid rate" }, { v: "White", l: "Label ready" }, { v: "API", l: "First design" }],
    useCases: ["Demo & trial activation calls", "Churn prediction outreach", "White-label voice AI deployment", "Agency client onboarding", "SaaS renewal reminders"],
    badge: "White-Label API",
    visual: "⚡",
  },
];

export const INDUSTRY_CARDS = INDUSTRIES;

export default function IndustryShowroomGrid({ setPage }: IndustryShowroomGridProps) {
  const [active, setActive] = useState(0);
  const current = INDUSTRIES[active];

  const handleExplore = () => {
    if (setPage) {
      setPage("use-cases", current.id);
    } else {
      window.history.pushState(null, "", `/use-cases/${current.id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Tab Pills (Technical Wireframe Style) ───────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {INDUSTRIES.map((ind, i) => {
          const Icon = ind.icon;
          const isActive = i === active;
          return (
            <button
              key={ind.id}
              onClick={() => setActive(i)}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-[2px] font-mono text-xs uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? "bg-[#121212] text-white border border-[#121212]"
                  : "bg-[#EBE9E2] text-[#121212] border border-[#CBC8BE] hover:bg-[#DFDCD4]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {ind.label}
            </button>
          );
        })}
      </div>

      {/* ── Content Panel (Technical Neo-Brutalist Wireframe Card) ──────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[2px] border border-[#CBC8BE] bg-[#EBE9E2] overflow-hidden shadow-none"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px]">
            {/* Left: Text content */}
            <div className="p-8 lg:p-12 space-y-6 bg-[#EBE9E2]">
              {/* Badge */}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-[2px] font-mono bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212]">
                {current.visual} {current.badge}
              </span>

              {/* Headline */}
              <h3 className="text-[#121212] font-medium leading-tight text-2xl sm:text-3xl lg:text-4xl font-sans tracking-tight">
                {current.headline}
              </h3>

              <p className="text-[#262523] text-sm sm:text-base leading-relaxed font-sans">
                {current.subhead}
              </p>

              {/* Use cases */}
              <ul className="space-y-2.5">
                {current.useCases.map((uc, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs sm:text-sm font-normal text-[#121212]">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#121212]" />
                    {uc}
                  </li>
                ))}
              </ul>

              <div className="pt-2">
                <button
                  onClick={handleExplore}
                  className="bg-[#121212] hover:bg-black text-white rounded-[2px] font-mono text-xs uppercase tracking-wider px-6 py-3.5 inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  Explore {current.label} Dedicated Use Case Page <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right: Stats + visual */}
            <div className="p-8 bg-[#DFDCD4] border-t lg:border-t-0 lg:border-l border-[#CBC8BE] flex flex-col justify-center gap-6">
              {/* Big emoji visual */}
              <div className="text-center">
                <div className="text-5xl mx-auto flex items-center justify-center w-20 h-20 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212]">
                  {current.visual}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                {current.stats.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center justify-between p-4 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE]"
                  >
                    <span className="text-[#262523] text-xs font-mono uppercase tracking-wider">{s.l}</span>
                    <span className="text-2xl font-bold font-mono text-[#121212]">
                      {s.v}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* ROI hint */}
              <div className="rounded-[2px] p-4 text-center bg-[#EBE9E2] border border-[#CBC8BE]">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#121212]" />
                  <span className="text-[10px] font-bold text-[#121212] font-mono uppercase tracking-wider">
                    Typical ROI
                  </span>
                </div>
                <p className="text-xs text-[#262523] font-sans">
                  Most clients see positive ROI within 2–3 weeks of deployment.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

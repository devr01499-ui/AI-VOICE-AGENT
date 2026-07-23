import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2, Landmark, ShieldCheck, Home as HomeIcon, ShoppingBag,
  Truck, Headphones, Code, CheckCircle2, ArrowRight, TrendingUp
} from "lucide-react";

const INDUSTRIES = [
  {
    id: "healthcare", label: "Healthcare", icon: Building2,
    headline: "AI Voice Agents for Healthcare & Clinics",
    subhead: "Automate patient intake, appointment scheduling, and post-discharge follow-up — HIPAA-compliant out of the box.",
    stats: [{ v: "85%", l: "Hold time reduction" }, { v: "24/7", l: "Patient coverage" }, { v: "0s", l: "Queue wait time" }],
    useCases: ["Pre-op call automation", "Appointment reminders & rescheduling", "Post-discharge symptom checks", "Patient intake & triage", "Insurance verification calls"],
    badge: "HIPAA BAA Available",
    accent: "#059669", bg: "#D1FAE5",
    visual: "🏥",
  },
  {
    id: "finance", label: "Finance & Banking", icon: Landmark,
    headline: "AI Voice Agents for Finance & Banking",
    subhead: "EMI collection outreach, KYC verification, fraud alerts, and loan qualification — fully compliant, always accurate.",
    stats: [{ v: "42%", l: "EMI recovery lift" }, { v: "3s", l: "Speed-to-contact" }, { v: "SOC 2", l: "Certified" }],
    useCases: ["EMI & loan payment reminders", "KYC document follow-up", "Fraud alert verification", "Account inquiry handling", "Loan application status updates"],
    badge: "SOC 2 Type II",
    accent: "#E8630A", bg: "#FEF3C7",
    visual: "🏦",
  },
  {
    id: "ecommerce", label: "E-Commerce", icon: ShoppingBag,
    headline: "AI Voice Agents for E-Commerce & Retail",
    subhead: "Cut return-to-origin rates by 40% with pre-dispatch COD verification, address correction, and abandoned cart recovery.",
    stats: [{ v: "40%", l: "RTO reduction" }, { v: "3s", l: "Post-order call" }, { v: "94%", l: "Contact rate" }],
    useCases: ["COD order verification", "Address & delivery confirmation", "Abandoned cart recovery", "Return authorization", "Delivery slot rescheduling"],
    badge: "RTO Reduction Engine",
    accent: "#059669", bg: "#D1FAE5",
    visual: "🛒",
  },
  {
    id: "realestate", label: "Real Estate", icon: HomeIcon,
    headline: "AI Voice Agents for Real Estate Teams",
    subhead: "Speed-to-lead in 3 seconds. Qualify buyer intent, budget, and timeline — then auto-book property tours.",
    stats: [{ v: "3s", l: "Speed-to-lead" }, { v: "3×", l: "Pipeline growth" }, { v: "₹6.98", l: "Per qualified lead" }],
    useCases: ["Lead qualification & intent scoring", "Property tour booking", "Buyer budget & timeline verification", "Broker follow-up automation", "Project update broadcasts"],
    badge: "Speed-to-Lead",
    accent: "#E8630A", bg: "#FEF3C7",
    visual: "🏢",
  },
  {
    id: "insurance", label: "Insurance", icon: ShieldCheck,
    headline: "AI Voice Agents for Insurance Carriers",
    subhead: "FNOL claims intake, policy renewal reminders, and premium collection — reducing processing time by 3.5×.",
    stats: [{ v: "3.5×", l: "FNOL speed" }, { v: "78%", l: "Renewals automated" }, { v: "0", l: "Call queue" }],
    useCases: ["FNOL claims triage & intake", "Policy renewal reminders", "Premium payment collection", "Claim status updates", "Coverage verification calls"],
    badge: "Claims AI",
    accent: "#059669", bg: "#D1FAE5",
    visual: "🛡️",
  },
  {
    id: "logistics", label: "Logistics", icon: Truck,
    headline: "AI Voice Agents for Logistics & Supply Chain",
    subhead: "Driver dispatch, delivery confirmation, and exception alerts — achieving 98.5% first-attempt delivery rates.",
    stats: [{ v: "98.5%", l: "First attempt" }, { v: "∞", l: "Concurrent calls" }, { v: "Real-time", l: "Tracking updates" }],
    useCases: ["Driver dispatch coordination", "Delivery slot confirmation", "Failed delivery recovery", "Address clarification calls", "Shipment exception alerts"],
    badge: "Real-Time Dispatch",
    accent: "#E8630A", bg: "#FEF3C7",
    visual: "🚚",
  },
  {
    id: "bpo", label: "BPO / Call Centers", icon: Headphones,
    headline: "AI Voice Agents for BPO & Call Centers",
    subhead: "Handle 10,000+ concurrent calls with zero queue. Inbound triage, overflow handling, and warm escalation.",
    stats: [{ v: "10K+", l: "Concurrent calls" }, { v: "60%", l: "Cost reduction" }, { v: "4.9★", l: "CSAT maintained" }],
    useCases: ["Queue overflow deflection", "Tier-1 FAQ & script handling", "Warm agent handoff with context", "Batch outbound campaigns", "Compliance call logging"],
    badge: "Infinite Scale",
    accent: "#059669", bg: "#D1FAE5",
    visual: "🎧",
  },
  {
    id: "saas", label: "SaaS & Agencies", icon: Code,
    headline: "AI Voice Agents for SaaS & Digital Agencies",
    subhead: "White-label AI voice infrastructure for agencies. Demo booking, trial activation, and churn prevention.",
    stats: [{ v: "3×", l: "Trial-to-paid rate" }, { v: "White", l: "Label ready" }, { v: "API", l: "First design" }],
    useCases: ["Demo & trial activation calls", "Churn prediction outreach", "White-label voice AI deployment", "Agency client onboarding", "SaaS renewal reminders"],
    badge: "White-Label API",
    accent: "#E8630A", bg: "#FEF3C7",
    visual: "⚡",
  },
];

export const INDUSTRY_CARDS = INDUSTRIES;

export default function IndustryShowroomGrid() {
  const [active, setActive] = useState(0);
  const current = INDUSTRIES[active];
  const isGreen = current.accent === "#059669";

  return (
    <div className="space-y-6">
      {/* ── Tab Pills ────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {INDUSTRIES.map((ind, i) => {
          const Icon = ind.icon;
          const isActive = i === active;
          return (
            <button
              key={ind.id}
              onClick={() => setActive(i)}
              className="relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: isActive ? (ind.accent === "#059669" ? "#D1FAE5" : "#FEF3C7") : "white",
                color: isActive ? ind.accent : "#6B7280",
                border: isActive ? `1.5px solid ${ind.accent}30` : "1.5px solid #E8E2D9",
                boxShadow: isActive ? `0 4px 16px ${ind.accent}20` : "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {ind.label}
            </button>
          );
        })}
      </div>

      {/* ── Content Panel ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden"
          style={{
            borderRadius: 32,
            border: `1px solid ${current.accent}20`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px ${current.accent}10`,
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
            {/* Left: Text content */}
            <div
              className="p-10 lg:p-14 space-y-7"
              style={{ background: isGreen ? "linear-gradient(145deg, #0B1F14 0%, #112B1C 100%)" : "linear-gradient(145deg, #1C0D00 0%, #2D1200 100%)" }}
            >
              {/* Badge */}
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] px-4 py-1.5 rounded-full font-mono"
                style={{ background: `${current.accent}20`, color: current.accent, border: `1px solid ${current.accent}30` }}
              >
                {current.visual} {current.badge}
              </span>

              {/* Headline */}
              <h3
                className="text-white font-extrabold leading-tight"
                style={{
                  fontFamily: "'Clash Display', sans-serif",
                  fontSize: "clamp(24px, 3vw, 36px)",
                  letterSpacing: "-0.02em",
                }}
              >
                {current.headline}
              </h3>

              <p className="text-white/60 leading-relaxed" style={{ fontSize: 15 }}>
                {current.subhead}
              </p>

              {/* Use cases */}
              <ul className="space-y-2.5">
                {current.useCases.map((uc, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-white/75">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: current.accent }} />
                    {uc}
                  </li>
                ))}
              </ul>

              <button
                className="inline-flex items-center gap-2 font-bold text-sm px-6 py-3 rounded-full transition-all hover:scale-[1.03] active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${current.accent}, ${isGreen ? "#10B981" : "#F59E0B"})`,
                  boxShadow: `0 6px 20px ${current.accent}40`,
                  color: "white",
                }}
              >
                Explore {current.label} Use Cases <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Stats + visual */}
            <div
              className="p-10 flex flex-col justify-center gap-8"
              style={{
                background: isGreen
                  ? "linear-gradient(145deg, #0F2E1E 0%, #0A1F14 100%)"
                  : "linear-gradient(145deg, #1F0F00 0%, #150A00 100%)",
                borderLeft: `1px solid ${current.accent}12`,
              }}
            >
              {/* Big emoji visual */}
              <div className="text-center">
                <div
                  className="text-7xl mx-auto flex items-center justify-center w-24 h-24 rounded-3xl"
                  style={{ background: `${current.accent}15`, border: `1px solid ${current.accent}25` }}
                >
                  {current.visual}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                {current.stats.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-2xl"
                    style={{ background: `${current.accent}10`, border: `1px solid ${current.accent}15` }}
                  >
                    <span className="text-white/60 text-sm font-medium">{s.l}</span>
                    <span
                      className="text-2xl font-extrabold font-mono"
                      style={{ color: current.accent, fontFamily: "'Clash Display', sans-serif" }}
                    >
                      {s.v}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* ROI hint */}
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#34D399]" />
                  <span className="text-[10px] font-bold text-[#34D399] font-mono uppercase tracking-wider">
                    Typical ROI
                  </span>
                </div>
                <p className="text-[11px] text-white/40">
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

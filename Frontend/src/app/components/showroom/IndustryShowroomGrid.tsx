import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2, Landmark, ShieldCheck, Home as HomeIcon, ShoppingBag,
  Truck, Headphones, Code, CheckCircle2, ArrowRight, TrendingUp
} from "lucide-react";

interface IndustryShowroomGridProps {
  setPage?: (p: any, topicId?: string) => void;
}

// What each industry setup does today (no unmeasured outcome figures: docs/COMPLIANCE_NOTES.md).
const INDUSTRIES = [
  {
    id: "healthcare", label: "Healthcare", icon: Building2,
    headline: "AI Voice Agents for Healthcare & Clinics",
    subhead: "Answer every patient call, book appointments on the doctor's Google Calendar and remind patients the day before, without giving medical advice.",
    stats: [{ v: "24×7", l: "Calls answered" }, { v: "Calendar", l: "Appointment booking" }, { v: "Optional", l: "PII redaction" }],
    useCases: ["Appointment booking & changes", "Day-before reminders", "Timings, fees and preparation questions", "Follow-up calls after a visit", "Call-back requests for the doctor"],
    badge: "Clinic Receptionist",
    visual: "🏥",
  },
  {
    id: "finance", label: "Finance & Banking", icon: Landmark,
    headline: "AI Voice Agents for Finance & Banking",
    subhead: "Polite EMI due-date reminders and KYC follow-ups that confirm identity before mentioning any amount, and record when the borrower will pay.",
    stats: [{ v: "Identity", l: "Checked first" }, { v: "Opt-out", l: "List honoured" }, { v: "Webhook", l: "Promise to pay" }],
    useCases: ["EMI due-date reminders", "KYC document follow-up", "Early overdue reminders", "Payment date capture", "Hardship call-back requests"],
    badge: "Courteous Reminders",
    visual: "🏦",
  },
  {
    id: "ecommerce", label: "E-Commerce", icon: ShoppingBag,
    headline: "AI Voice Agents for E-Commerce & Retail",
    subhead: "Call every cash-on-delivery buyer before dispatch to confirm the order, the address and a good delivery time, so fewer parcels come back as RTO.",
    stats: [{ v: "5,000", l: "Contacts per campaign" }, { v: "3", l: "Attempts per buyer" }, { v: "Hinglish", l: "Natural conversation" }],
    useCases: ["COD order confirmation", "Address & landmark check", "Delivery time preference", "Delivery rescheduling", "Return pickup confirmation"],
    badge: "COD Confirmation",
    visual: "🛒",
  },
  {
    id: "realestate", label: "Real Estate", icon: HomeIcon,
    headline: "AI Voice Agents for Real Estate Teams",
    subhead: "Call new property enquiries as they arrive, ask about budget, location and timeline, and book site visits on your calendar.",
    stats: [{ v: "API", l: "Leads from your forms" }, { v: "Calendar", l: "Site visits booked" }, { v: "CRM", l: "Answers by webhook" }],
    useCases: ["Enquiry call-back", "Budget & timeline qualification", "Site visit booking", "Visit reminders", "New launch announcements"],
    badge: "Speed to Lead",
    visual: "🏢",
  },
  {
    id: "insurance", label: "Insurance", icon: ShieldCheck,
    headline: "AI Voice Agents for Insurance",
    subhead: "Renewal reminders before a policy lapses, coverage answers from your own documents, and calm first calls that collect claim details.",
    stats: [{ v: "Renewals", l: "Reminded before expiry" }, { v: "Docs", l: "Coverage answers" }, { v: "Fields", l: "Claim details captured" }],
    useCases: ["Policy renewal reminders", "First notice of loss intake", "Coverage questions", "Claim status call-backs", "Document reminders"],
    badge: "Renewals & Claims",
    visual: "🛡️",
  },
  {
    id: "logistics", label: "Logistics", icon: Truck,
    headline: "AI Voice Agents for Logistics & Delivery",
    subhead: "Call recipients before the delivery attempt, collect drop-off instructions or a new date, and send them to your system for the driver.",
    stats: [{ v: "Before", l: "The delivery attempt" }, { v: "Fields", l: "Instructions captured" }, { v: "Webhook", l: "Back to your TMS" }],
    useCases: ["Delivery-day availability", "Drop-off instructions", "Failed delivery rescheduling", "Return pickup confirmation", "Address clarification"],
    badge: "Delivery Calls",
    visual: "🚚",
  },
  {
    id: "bpo", label: "BPO / Call Centers", icon: Headphones,
    headline: "AI Voice Agents for BPO & Call Centers",
    subhead: "Let an AI agent take routine questions, overflow and after-hours calls, and book call-backs, so your team handles the calls that need a person.",
    stats: [{ v: "1", l: "Call at a time per account" }, { v: "24×7", l: "Routine calls" }, { v: "QA", l: "Scores for every call" }],
    useCases: ["Overflow at peak times", "After-hours messages", "Routine FAQ answers", "Call-back booking", "Quality scoring of calls"],
    badge: "Overflow & After Hours",
    visual: "🎧",
  },
  {
    id: "saas", label: "SaaS & Agencies", icon: Code,
    headline: "AI Voice Agents for SaaS & Digital Agencies",
    subhead: "Place calls from your own product with the REST API, receive signed webhooks, and reuse agents across client workspaces with export and import.",
    stats: [{ v: "REST", l: "API for calls" }, { v: "HMAC", l: "Signed webhooks" }, { v: "Export", l: "Agents as files" }],
    useCases: ["Trial user onboarding calls", "Demo booking", "Renewal reminders", "Agents built for clients", "Results into your own database"],
    badge: "API & Webhooks",
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

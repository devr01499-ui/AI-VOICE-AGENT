import { motion } from "motion/react";
import {
  Building2, Landmark, ShieldCheck, Home as HomeIcon, ShoppingBag,
  Truck, Zap, Headphones, Code, GraduationCap, UserCheck, Plane,
} from "lucide-react";

export const INDUSTRY_CARDS = [
  {
    id: "healthcare", title: "AI Voice Agents for Healthcare", shortTitle: "Healthcare & Clinics",
    icon: Building2, badge: "HIPAA Compliant",
    description: "Automated patient intake, pre-op medical instructions, appointment scheduling, and post-discharge symptom checks. HIPAA BAA available.",
    useCases: ["Patient Intake & Triage", "Appointment Scheduling", "Pre-Op Call Automation", "Post-Discharge Follow-Up"],
    metrics: "85% Reduction in Hold Times", color: "#059669", size: "large",
  },
  {
    id: "finance", title: "AI Voice Agents for Finance & Banking", shortTitle: "Banking & Finance",
    icon: Landmark, badge: "SOC 2 Type II",
    description: "EMI collection outreach, fraud alerts, account inquiries, loan application updates, and KYC verification.",
    useCases: ["EMI Payment Reminders", "Fraud Alert Verification", "Loan Qualification", "KYC Verification"],
    metrics: "42% Higher EMI Recovery", color: "#EA580C", size: "small",
  },
  {
    id: "insurance", title: "AI Voice Agents for Insurance", shortTitle: "Insurance Carriers",
    icon: ShieldCheck, badge: "Claims Automation",
    description: "FNOL intake, policy renewal reminders, claim status updates, and premium payment verification.",
    useCases: ["FNOL Claims Triage", "Renewal Outreach", "Claim Status Calls"],
    metrics: "3.5× Faster FNOL Processing", color: "#059669", size: "small",
  },
  {
    id: "ecommerce", title: "AI Voice Agents for E-Commerce", shortTitle: "E-Commerce & Retail",
    icon: ShoppingBag, badge: "RTO Reduction",
    description: "Pre-dispatch COD order verification, delivery address correction, abandoned cart recovery, and post-purchase follow-up.",
    useCases: ["COD Confirmation Calls", "Abandoned Cart Recovery", "RTO Reduction", "Delivery Slot Booking"],
    metrics: "Up to 40% Lower Return-to-Origin", color: "#EA580C", size: "large",
  },
  {
    id: "realestate", title: "AI Voice Agents for Real Estate", shortTitle: "Real Estate",
    icon: HomeIcon, badge: "Speed-to-Lead",
    description: "Speed-to-lead qualification in 3 seconds, property tour booking, budget verification, and broker follow-up.",
    useCases: ["Lead Qualification", "Property Showing Booking", "Buyer Budget Verify"],
    metrics: "94% Speed-to-Lead Contact Rate", color: "#059669", size: "small",
  },
  {
    id: "logistics", title: "AI Voice Agents for Logistics", shortTitle: "Logistics & Supply Chain",
    icon: Truck, badge: "Real-Time Tracking",
    description: "Driver dispatch coordination, delivery slot confirmation, exception alerts, and customer address clarification.",
    useCases: ["Driver Dispatch Updates", "Failed Delivery Recovery", "Shipment Status Calls"],
    metrics: "98.5% First-Attempt Deliveries", color: "#EA580C", size: "small",
  },
  {
    id: "bpo", title: "AI Voice Agents for BPO & Call Centers", shortTitle: "BPO & Contact Centers",
    icon: Headphones, badge: "Infinite Scale",
    description: "Inbound triage, overflow handling, batch outbound campaigns, real-time sentiment scoring, and warm escalation.",
    useCases: ["Queue Overflow Deflection", "Tier-1 Script Execution", "Warm Agent Handoff"],
    metrics: "10,000+ Concurrent Calls Zero Wait", color: "#059669", size: "small",
  },
  {
    id: "telecom", title: "AI Voice Agents for Telecom & Utilities", shortTitle: "Telecom & Utilities",
    icon: Zap, badge: "IVR Deflection",
    description: "Outage broadcasts, bill payment help, subscription renewals, and tier-1 diagnostic troubleshooting.",
    useCases: ["Service Outage Broadcasts", "Bill Payment Reminders", "Plan Upgrade Calls"],
    metrics: "60% Deflected from Human Desk", color: "#EA580C", size: "small",
  },
  {
    id: "saas", title: "AI Voice Agents for SaaS & Agencies", shortTitle: "SaaS & Tech Agencies",
    icon: Code, badge: "White-Label AI",
    description: "Demo scheduling, trial onboarding calls, churn prevention outreach, and white-label AI voice agent infrastructure.",
    useCases: ["Trial Activation Calls", "Demo Calendar Booking", "Agency White-Labeling"],
    metrics: "3× Higher Trial-to-Paid Conversion", color: "#059669", size: "large",
  },
  {
    id: "education", title: "AI Voice Agents for Education", shortTitle: "Education & Academics",
    icon: GraduationCap, badge: "Student Outreach",
    description: "Prospective student follow-ups, admission reminders, fee notifications, and campus tour scheduling.",
    useCases: ["Admission Qualification", "Fee Deadline Reminders", "Campus Visit Booking"],
    metrics: "4.8× Higher Lead Engagement", color: "#EA580C", size: "small",
  },
  {
    id: "recruitment", title: "AI Voice Agents for Recruitment", shortTitle: "Recruitment & Staffing",
    icon: UserCheck, badge: "Pre-Screening AI",
    description: "Candidate pre-screening, resume verification, interview scheduling, and application status updates.",
    useCases: ["Candidate Pre-Screening", "Interview Booking", "Skill Verification"],
    metrics: "75% Reduction in Time-to-Interview", color: "#059669", size: "small",
  },
  {
    id: "travel", title: "AI Voice Agents for Travel & Hospitality", shortTitle: "Travel & Hospitality",
    icon: Plane, badge: "24/7 Concierge",
    description: "Reservation confirmation, dining booking, flight delay notifications, and post-stay feedback collection.",
    useCases: ["Reservation Confirmations", "Flight Update Calls", "Post-Stay Surveys"],
    metrics: "99% Reservation Accuracy Rate", color: "#EA580C", size: "small",
  },
];

// ── Card component ────────────────────────────────────────────────────────────
function IndustryCard({ card, delay }: { card: typeof INDUSTRY_CARDS[0]; delay: number }) {
  const Icon = card.icon;
  const isGreen = card.color === "#059669";
  const isLarge = card.size === "large";

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className={`relative bg-white border border-[#EADEC9] overflow-hidden group transition-all ${isLarge ? "rounded-[32px]" : "rounded-3xl"}`}
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}
    >
      {/* Gradient hover overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
        style={{
          background: isGreen
            ? "linear-gradient(135deg, rgba(209,250,229,0.5) 0%, transparent 60%)"
            : "linear-gradient(135deg, rgba(254,243,199,0.55) 0%, transparent 60%)",
        }}
      />

      {/* Top color stripe */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${card.color}, ${isGreen ? "#34D399" : "#D97706"})` }} />

      <div className={`relative z-10 ${isLarge ? "p-8" : "p-6"}`}>
        {/* Icon + badge row */}
        <div className="flex items-center justify-between mb-5">
          <div
            className="rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
            style={{
              width: isLarge ? "56px" : "48px",
              height: isLarge ? "56px" : "48px",
              background: isGreen ? "#D1FAE5" : "#FEF3C7",
            }}
          >
            <Icon style={{ width: isLarge ? "28px" : "24px", height: isLarge ? "28px" : "24px", color: card.color }} />
          </div>
          <span
            className="text-[9px] font-extrabold uppercase tracking-[0.15em] px-3 py-1 rounded-full font-mono"
            style={{ background: isGreen ? "#D1FAE5" : "#FEF3C7", color: card.color, border: `1px solid ${card.color}25` }}
          >
            {card.badge}
          </span>
        </div>

        {/* Title */}
        <h3
          className={`font-extrabold text-[#0F172A] group-hover:text-[#059669] transition-colors ${isLarge ? "text-xl mb-3" : "text-base mb-2"}`}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {card.title}
        </h3>

        {/* Description */}
        <p className={`text-slate-500 leading-relaxed ${isLarge ? "text-sm mb-5" : "text-xs mb-4"}`}>
          {card.description}
        </p>

        {/* Use cases */}
        {isLarge && (
          <div className="space-y-1.5 mb-5">
            {card.useCases.map((uc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-semibold text-[#334155]">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: card.color }} />
                {uc}
              </div>
            ))}
          </div>
        )}

        {/* Metric footer */}
        <div className={`pt-3 border-t border-[#EADEC9] ${isLarge ? "" : "mt-2"}`}>
          <p className="text-xs font-bold font-mono" style={{ color: card.color }}>
            📊 {card.metrics}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function IndustryShowroomGrid() {
  // Bento-style: row-1 [large, small, small], row-2 [small, small, large], row-3 [large, small, small], row-4 [small, small, large]
  const rows = [
    [INDUSTRY_CARDS[0], INDUSTRY_CARDS[1], INDUSTRY_CARDS[2]],   // large, small, small
    [INDUSTRY_CARDS[3], INDUSTRY_CARDS[4], INDUSTRY_CARDS[5]],   // large, small, small
    [INDUSTRY_CARDS[8], INDUSTRY_CARDS[6], INDUSTRY_CARDS[7]],   // large, small, small
    [INDUSTRY_CARDS[9], INDUSTRY_CARDS[10], INDUSTRY_CARDS[11]], // small, small, small
  ];

  return (
    <div className="space-y-5">
      {rows.map((row, ri) => {
        const hasLarge = row[0].size === "large";
        return (
          <div
            key={ri}
            className={`grid gap-5 ${hasLarge ? "grid-cols-1 md:grid-cols-[2fr_1fr_1fr]" : "grid-cols-1 md:grid-cols-3"}`}
          >
            {row.map((card, ci) => (
              <IndustryCard key={card.id} card={card} delay={ri * 0.08 + ci * 0.05} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

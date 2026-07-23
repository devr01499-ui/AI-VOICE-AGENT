import { motion } from "motion/react";
import {
  Building2, Landmark, ShieldCheck, Home as HomeIcon, ShoppingBag,
  Truck, Zap, Headphones, Code, GraduationCap, UserCheck, Plane,
} from "lucide-react";

export const INDUSTRY_CARDS = [
  { id: "healthcare", title: "Healthcare & Clinics", icon: Building2, badge: "HIPAA", description: "Automated patient intake, pre-op instructions, appointment reminders, and post-discharge checks.", metrics: "85% Reduction in Hold Times", color: "#059669" },
  { id: "finance", title: "Banking & Finance", icon: Landmark, badge: "SOC 2", description: "EMI collection outreach, fraud alerts, account inquiries, and credit application updates.", metrics: "42% Higher EMI Recovery", color: "#EA580C" },
  { id: "insurance", title: "Insurance Carriers", icon: ShieldCheck, badge: "Claims AI", description: "FNOL intake, policy renewal reminders, claim status tracking, and premium verification.", metrics: "3.5× Faster FNOL Processing", color: "#059669" },
  { id: "realestate", title: "Real Estate", icon: HomeIcon, badge: "Lead Qualify", description: "Speed-to-lead qualification within 3 seconds, tour booking, budget verification, and follow-up.", metrics: "94% Speed-to-Lead Contact Rate", color: "#EA580C" },
  { id: "ecommerce", title: "E-Commerce & Retail", icon: ShoppingBag, badge: "RTO Reduction", description: "Pre-dispatch COD verification, address correction, delivery confirmation, cart recovery.", metrics: "Up to 40% Lower Return-to-Origin", color: "#059669" },
  { id: "logistics", title: "Logistics & Supply Chain", icon: Truck, badge: "Real-Time", description: "Driver dispatch, delivery slot confirmation, exception alerts, and address clarification.", metrics: "98.5% First-Attempt Deliveries", color: "#EA580C" },
  { id: "telecom", title: "Telecom & Utilities", icon: Zap, badge: "IVR Deflect", description: "Outage broadcasts, bill payment help, subscription renewals, and tier-1 diagnostics.", metrics: "60% Deflected from Human Desk", color: "#059669" },
  { id: "bpo", title: "BPO & Contact Centers", icon: Headphones, badge: "∞ Scale", description: "Inbound triage, overflow handling, batch outbound campaigns, warm escalation.", metrics: "10,000+ Concurrent Calls Zero Wait", color: "#EA580C" },
  { id: "saas", title: "SaaS & Tech Agencies", icon: Code, badge: "White-Label", description: "Demo scheduling, trial onboarding, churn prevention, and white-label voice AI infra.", metrics: "3× Higher Trial-to-Paid Conversion", color: "#059669" },
  { id: "education", title: "Education & Academics", icon: GraduationCap, badge: "Student AI", description: "Prospective student follow-ups, admission reminders, fee notifications, tour scheduling.", metrics: "4.8× Higher Lead Engagement", color: "#EA580C" },
  { id: "recruitment", title: "Recruitment & Staffing", icon: UserCheck, badge: "Pre-Screen", description: "Candidate pre-screening, resume verification, interview scheduling, status updates.", metrics: "75% Reduction in Time-to-Interview", color: "#059669" },
  { id: "travel", title: "Travel & Hospitality", icon: Plane, badge: "24/7 AI", description: "Reservation confirmation, dining booking, flight delay notifications, post-stay feedback.", metrics: "99% Reservation Accuracy Rate", color: "#EA580C" },
];

export default function IndustryShowroomGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {INDUSTRY_CARDS.map((card, idx) => {
        const Icon = card.icon;
        const isGreen = card.color === "#059669";
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: idx * 0.04 }}
            whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.10)" }}
            className="group relative bg-white border border-[#EADEC9] rounded-3xl p-7 flex flex-col justify-between overflow-hidden cursor-default transition-all"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}
          >
            {/* Hover gradient overlay */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"
              style={{
                background: isGreen
                  ? "linear-gradient(135deg, rgba(209,250,229,0.4) 0%, transparent 60%)"
                  : "linear-gradient(135deg, rgba(254,243,199,0.5) 0%, transparent 60%)",
              }}
            />

            <div className="relative z-10">
              {/* Icon + badge row */}
              <div className="flex items-center justify-between mb-5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    background: isGreen ? "#D1FAE5" : "#FEF3C7",
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color: card.color }} />
                </div>
                <span
                  className="text-[9px] font-extrabold uppercase tracking-[0.15em] px-3 py-1 rounded-full font-mono"
                  style={{
                    background: isGreen ? "#D1FAE5" : "#FEF3C7",
                    color: card.color,
                    border: `1px solid ${card.color}30`,
                  }}
                >
                  {card.badge}
                </span>
              </div>

              {/* Title */}
              <h3
                className="text-lg font-extrabold text-[#0F172A] mb-2.5 group-hover:text-[#059669] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-500 leading-relaxed">
                {card.description}
              </p>
            </div>

            {/* Metrics footer */}
            <div
              className="relative z-10 mt-6 pt-4 border-t border-[#EADEC9]"
            >
              <p
                className="text-xs font-bold font-mono"
                style={{ color: card.color }}
              >
                📊 {card.metrics}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

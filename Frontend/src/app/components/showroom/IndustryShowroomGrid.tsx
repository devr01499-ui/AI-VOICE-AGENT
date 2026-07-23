import { motion } from "motion/react";
import { 
  Building2, 
  Landmark, 
  ShieldCheck, 
  Home as HomeIcon, 
  ShoppingBag, 
  Truck, 
  Zap, 
  Headphones, 
  Code, 
  GraduationCap, 
  UserCheck, 
  Plane 
} from "lucide-react";

export const INDUSTRY_CARDS = [
  {
    id: "healthcare",
    title: "Healthcare & Clinics",
    icon: Building2,
    badge: "HIPAA Compliant",
    description: "Automated patient intake, pre-op medical instructions, appointment reminders, and post-discharge symptom checks.",
    useCases: ["Patient Intake & Triage", "Appointment Scheduling", "Pre-Op Prep Call Automation", "HIPAA Compliance Log"],
    metrics: "85% Reduction in Receptionist Hold Times"
  },
  {
    id: "finance",
    title: "Banking & Financial Services",
    icon: Landmark,
    badge: "SOC 2 Type II",
    description: "Automated EMI collection outreach, fraud activity alerts, account balance inquiries, and credit application updates.",
    useCases: ["EMI Payment Reminders", "Fraud Alert Verification", "Loan Qualification", "PCI-DSS Data Redaction"],
    metrics: "42% Higher EMI Recovery Rate"
  },
  {
    id: "insurance",
    title: "Insurance Carriers & Brokers",
    icon: ShieldCheck,
    badge: "Automated Claims",
    description: "First Notice of Loss (FNOL) intake, policy renewal reminders, claim status tracking, and premium payment verification.",
    useCases: ["FNOL Claims Triage", "Policy Renewal Outreach", "Document Requirement Reminders", "Warm Adjuster Transfer"],
    metrics: "3.5x Faster First Notice Processing"
  },
  {
    id: "realestate",
    title: "Real Estate & Property Management",
    icon: HomeIcon,
    badge: "Instant Qualification",
    description: "Speed-to-lead qualification within 3 seconds of web form submission, tour booking, budget verification, and site visit follow-up.",
    useCases: ["Form Lead Qualification", "Property Showing Booking", "Buyer Budget Verification", "Broker Calendar Sync"],
    metrics: "94% Speed-to-Lead Contact Rate"
  },
  {
    id: "ecommerce",
    title: "E-Commerce & Retail Brands",
    icon: ShoppingBag,
    badge: "RTO Reduction",
    description: "Pre-dispatch Cash-On-Delivery order verification, address landmark check, delivery confirmation, and abandoned cart recovery.",
    useCases: ["COD Order Confirmation", "Landmark Correction", "RTO Reduction Calling", "Abandoned Cart Outreach"],
    metrics: "Up to 40% Lower Return-to-Origin"
  },
  {
    id: "logistics",
    title: "Logistics & Supply Chain",
    icon: Truck,
    badge: "Real-Time Tracking",
    description: "Driver dispatch coordination, delivery slot confirmation, delivery exception alerts, and customer address clarification.",
    useCases: ["Driver Dispatch Updates", "Delivery Appointment Scheduling", "Failed Delivery Recovery", "Shipment Status Calls"],
    metrics: "98.5% Successful First-Attempt Deliveries"
  },
  {
    id: "telecom",
    title: "Telecom & Utilities",
    icon: Zap,
    badge: "IVR Deflection",
    description: "Outage notification broadcasts, bill payment assistance, subscription renewal calls, and tier-1 diagnostic troubleshooting.",
    useCases: ["Service Outage Broadcasts", "Bill Payment Reminders", "Plan Upgrade Offers", "Router Reboot Guidance"],
    metrics: "60% Deflection from Human Desk"
  },
  {
    id: "bpo",
    title: "BPO & Contact Centers",
    icon: Headphones,
    badge: "Infinite Scaling",
    description: "Inbound ticket triage, overflow call handling, batch outbound campaigns, and seamless warm escalation to human agents.",
    useCases: ["Queue Overflow Deflection", "Tier-1 Script Execution", "Warm Agent Handoff", "Real-Time Sentiment Scoring"],
    metrics: "10,000+ Concurrent Calls Zero Wait"
  },
  {
    id: "saas",
    title: "SaaS & Tech Agencies",
    icon: Code,
    badge: "White-Label Ready",
    description: "Instant demo scheduling, trial user onboarding calls, churn prevention outreach, and white-label voice AI infrastructure.",
    useCases: ["Trial User Activation", "Demo Calendar Booking", "Agency White-Labeling", "API Webhook Triggering"],
    metrics: "3x Higher Trial-to-Paid Conversion"
  },
  {
    id: "education",
    title: "Education & Academics",
    icon: GraduationCap,
    badge: "Student Outreach",
    description: "Prospective student inquiry follow-up, admission document reminders, fee payment notifications, and campus tour scheduling.",
    useCases: ["Admission Inquiry Qualification", "Campus Visit Booking", "Fee Deadline Reminders", "Course Orientation Calls"],
    metrics: "4.8x Higher Lead Engagement"
  },
  {
    id: "recruitment",
    title: "Recruitment & Staffing",
    icon: UserCheck,
    badge: "Pre-Screening",
    description: "Automated candidate pre-screening calls, resume verification, interview availability scheduling, and application status updates.",
    useCases: ["Candidate Pre-Screening", "Interview Calendar Booking", "Skill Verification Calls", "Application Updates"],
    metrics: "75% Reduction in Time-to-Interview"
  },
  {
    id: "travel",
    title: "Travel & Hospitality",
    icon: Plane,
    badge: "24/7 Concierge",
    description: "Reservation confirmation, dining booking management, flight delay notifications, and post-stay feedback collection.",
    useCases: ["Table & Room Reservation", "Flight & Tour Confirmation", "Special Request Intake", "Post-Stay Survey Calls"],
    metrics: "99% Reservation Accuracy Rate"
  }
];

export default function IndustryShowroomGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {INDUSTRY_CARDS.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.05 }}
            className="bg-surface-white border border border-[#EADEC9] rounded-2xl p-8 shadow-level-2 hover:shadow-level-4 hover:border-mint-primary/40 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-mint-soft flex items-center justify-center text-mint-primary group-hover:bg-mint-primary group-hover:text-white transition-colors">
                  <IconComponent className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold text-mint-primary uppercase tracking-widest bg-mint-soft/50 border border-mint-primary/20 px-3 py-1 rounded-full">
                  {card.badge}
                </span>
              </div>
              <h3 className="font-sora text-xl font-bold text-ink mb-3 group-hover:text-mint-primary transition-colors">
                {card.title}
              </h3>
              <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta mb-6">
                {card.description}
              </p>
              <div className="space-y-2 mb-6">
                {card.useCases.map((uc, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-cta" />
                    <span>{uc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-[#EADEC9]/60">
              <span className="text-xs font-mono font-bold text-mint-primary">
                📊 {card.metrics}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

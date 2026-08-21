import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import RoiCalculator from "../components/calculator/RoiCalculator";
import { 
  ArrowRight, Building2, Landmark, Home as HomeIcon, 
  ShoppingBag, Truck, HeartPulse, CheckCircle2, Sparkles, Phone, MessageSquare
} from "lucide-react";

type Page = any;

interface SolutionsProps {
  setPage: (p: Page) => void;
}

export default function Solutions({ setPage }: SolutionsProps) {
  const [activeTab, setActiveTab] = useState("ecommerce");

  const solutions = [
    {
      id: "ecommerce",
      name: "E-Commerce COD & Logistics",
      icon: ShoppingBag,
      tagline: "Slash Return-To-Origin (RTO) Losses by 40%",
      metric: "40% RTO Reduction",
      summary: "In markets where Cash-on-Delivery (COD) represents up to 70% of transactions, unverified orders lead to shipping losses and product damage. Claritiy Voice places an automated verification call within 60 seconds of checkout, confirming landmarks, order items, and delivery readiness in the buyer's regional language.",
      triggers: ["Shopify / WooCommerce Checkout Webhook", "High-Risk Fraud Score Trigger"],
      integrations: ["Shopify", "WooCommerce", "Shiprocket", "Clickpost", "Custom REST APIs"],
      useCases: ["Address & Landmark Verification", "Pre-Dispatch Prepaid Conversion Incentives", "Order Cancellation Handling", "Delivery Exception Rescheduling"],
      transcript: [
        { speaker: "agent", text: "Namaste Rahul! Calling from Claritiy Footwear regarding your order #8941 for Running Shoes (₹2,499, Cash on Delivery). Can you confirm this delivery?" },
        { speaker: "customer", text: "Yes, I placed it! But can you ask the courier to deliver near the Blue Dart office in Bandra West?" },
        { speaker: "agent", text: "Absolutely! I have noted 'Near Blue Dart office, Bandra West' in the delivery instructions. Your package will ship today!" }
      ]
    },
    {
      id: "healthcare",
      name: "Healthcare & Dental Clinics",
      icon: HeartPulse,
      tagline: "HIPAA-Compliant Reception & Intake Automation",
      metric: "85% Shorter Queue Times",
      summary: "Clinic receptionists are overwhelmed with repetitive calls for booking appointments, checking clinic hours, and pre-op instructions. Claritiy Voice acts as a 24/7 HIPAA-compliant receptionist answering on the first ring, checking doctor availability, and writing bookings straight to your EHR system.",
      triggers: ["Inbound Patient Call", "Missed Appointment Alert", "Post-Op Follow-Up Schedule"],
      integrations: ["Epic", "Cerner", "AthenaHealth", "Kareo", "DrChrono"],
      useCases: ["Appointment Scheduling & Reminders", "Pre-Procedure Prep Instructions", "Insurance Verification Intake", "Post-Discharge Wellness Check"],
      transcript: [
        { speaker: "agent", text: "Hello! Thank you for calling Apollo Dental. How can I assist with your appointment today?" },
        { speaker: "customer", text: "Hi, I need to see Dr. Sharma for a root canal checkup this Thursday afternoon." },
        { speaker: "agent", text: "Dr. Sharma has open slots at 2:30 PM and 4:15 PM this Thursday. Which time works best for you?" }
      ]
    },
    {
      id: "finance",
      name: "Financial Services & Debt Recovery",
      icon: Landmark,
      tagline: "Ethical Payment Reminders & KYC Outreach",
      metric: "3.4× Recovery Rate",
      summary: "Traditional collection calls suffer from agent turnover, aggressive tone, and compliance risks. Claritiy Voice agents maintain a polite, respectful tone, guiding borrowers through EMI schedules, offering pre-approved payment plans, and sending instant SMS payment links during the call.",
      triggers: ["3-Day Pre-Due Reminder", "1-30 DPD Early Delinquency Queue"],
      integrations: ["Finacle", "T24", "Salesforce Financial Services Cloud", "Custom Core Banking"],
      useCases: ["Pre-Due EMI Payment Reminders", "Ethical Debt Restructuring Negotiations", "KYC Document Follow-up", "Credit Card Activation Intake"],
      transcript: [
        { speaker: "agent", text: "Good morning Ananya, this is Claritiy Credit calling regarding your loan EMI of ₹4,200 due tomorrow. Would you like me to send a direct UPI link to your phone now?" },
        { speaker: "customer", text: "Yes please, send it on WhatsApp or SMS." },
        { speaker: "agent", text: "Done! I have sent the secure payment link to your registered mobile number. Have a great day!" }
      ]
    },
    {
      id: "realestate",
      name: "Real Estate & Housing",
      icon: HomeIcon,
      tagline: "Qualify 10,000+ Inbound Leads Monthly",
      metric: "5× More Showings Booked",
      summary: "Web leads cold within 5 minutes. Claritiy Voice calls inbound inquiries immediately, qualifies buyer budget, location preference, and timeline, and schedules site visits directly onto your sales agents' calendars.",
      triggers: ["Web Lead Form Submission", "Property Listing Inquiry"],
      integrations: ["HubSpot", "Salesforce", "Zoho CRM", "Google Calendar"],
      useCases: ["Immediate Lead Qualification", "Site Visit Scheduling", "Listing Availability Check", "Mortgage Partner Referral Intake"],
      transcript: [
        { speaker: "agent", text: "Hi Vikram! Thank you for inquiring about Green Acres 3BHK apartments. Are you looking to buy within the next 3 months?" },
        { speaker: "customer", text: "Yes, looking for a 3BHK around Whitefield under 1.5 Crores." },
        { speaker: "agent", text: "Great! We have 2 corner units matching your budget in Whitefield. Can I book a site visit with our manager for Saturday morning?" }
      ]
    },
    {
      id: "logistics",
      name: "Logistics & Supply Chain",
      icon: Truck,
      tagline: "Proactive Delivery Updates & ETA Dispatch",
      metric: "62% Fewer Support Tickets",
      summary: "Delayed shipments flood call centers with 'Where is my order?' inquiries. Claritiy Voice calls recipients proactively with revised ETAs, resolves address bottlenecks, and coordinates driver dispatch.",
      triggers: ["Delivery Exception Event", "Address Unclear Flag"],
      integrations: ["FedEx", "DHL", "Delhivery", "Custom WMS / TMS"],
      useCases: ["Proactive Delivery Status Alerts", "Failed Delivery Rescheduling", "Driver Coordination Calling", "Return Pickup Verification"],
      transcript: [
        { speaker: "agent", text: "Hi Priya! Your delivery driver is 10 minutes away from your home address in Sector 62. Will someone be available to receive the shipment?" },
        { speaker: "customer", text: "I am out right now, please leave it with the security guard at Gate 1." },
        { speaker: "agent", text: "Understood! I have notified the delivery agent to drop the package with Security Guard at Gate 1." }
      ]
    }
  ];

  const currentSolution = solutions.find((s) => s.id === activeTab) || solutions[0];

  return (
    <div className="space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen">
      
      {/* Header Section */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          ENTERPRISE INDUSTRY SOLUTIONS
        </div>
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
        >
          Industry-Tailored AI Voice Calling Solutions
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-600 text-lg md:text-xl max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          Deploy pre-configured AI voice agents optimized for compliance, CRM workflows, regional dialects, and measurable ROI across key verticals.
        </motion.p>
      </section>

      {/* Interactive Industry Tab Switcher */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 overflow-x-auto pb-4 justify-start md:justify-center border-b border-slate-200">
          {solutions.map((s) => {
            const Icon = s.icon;
            const isActive = activeTab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2.5 whitespace-nowrap ${
                  isActive
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Solution Deep-Dive */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSolution.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="mt-8 bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-start"
          >
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs font-bold border border-emerald-200">
                <span>BENCHMARK METRIC: {currentSolution.metric}</span>
              </div>
              
              <h2 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {currentSolution.tagline}
              </h2>
              
              <p className="text-slate-600 leading-relaxed font-plus-jakarta text-base">
                {currentSolution.summary}
              </p>

              {/* Use cases */}
              <div className="space-y-3 pt-2">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
                  CORE AUTOMATED USE CASES
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentSolution.useCases.map((uc) => (
                    <div key={uc} className="flex items-center gap-2 text-xs font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-plus-jakarta">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{uc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrations & Triggers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">EVENT TRIGGERS:</span>
                  <div className="flex flex-wrap gap-1">
                    {currentSolution.triggers.map((t) => (
                      <span key={t} className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md">{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">COMPATIBLE INTEGRATIONS:</span>
                  <div className="flex flex-wrap gap-1">
                    {currentSolution.integrations.map((i) => (
                      <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200">{i}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Live Call Dialogue Simulator */}
            <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-xs font-bold text-white uppercase">LIVE DIALOGUE PREVIEW</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  LATENCY: 174ms
                </span>
              </div>

              <div className="space-y-3 font-sans text-xs">
                {currentSolution.transcript.map((line, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl space-y-1 ${
                      line.speaker === "agent"
                        ? "bg-slate-800 border border-slate-700 text-slate-200"
                        : "bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 ml-4"
                    }`}
                  >
                    <div className="flex justify-between items-center font-mono text-[10px] text-slate-400">
                      <span className={line.speaker === "agent" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                        {line.speaker === "agent" ? "Claritiy Voice Agent" : "Customer"}
                      </span>
                    </div>
                    <p className="leading-relaxed font-medium">{line.text}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setPage("dashboard")}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-sans rounded-xl transition-colors flex items-center justify-center gap-2 text-xs"
              >
                Test This Solution In Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ROI & Savings Calculator Section */}
      <section className="px-6 max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest">
            FINANCIAL MODELING
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Calculate Your Monthly Call Center Savings
          </h2>
        </div>
        <RoiCalculator />
      </section>

      {/* 12 Industry Showroom Grid */}
      <section className="px-6 max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest">
            ALL COVERED VERTICALS
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Pre-Built Agent Templates For 12 Verticals
          </h2>
        </div>
        <IndustryShowroomGrid />
      </section>

      {/* Bottom Callout */}
      <section className="px-6 max-w-5xl mx-auto">
        <div className="bg-[#0F172A] text-white rounded-3xl p-10 md:p-16 text-center space-y-6 border border-slate-800">
          <h2 className="text-3xl md:text-5xl font-extrabold" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Build Your Custom Solution Today
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto text-base font-plus-jakarta">
            Deploy your first industry agent in under 10 minutes. Zero engineering required.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setPage("dashboard")}
              className="btn-primary py-4 px-8 text-base bg-emerald-500 hover:bg-emerald-400 text-black font-bold inline-flex items-center gap-2"
            >
              Build Your Agent Now <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}


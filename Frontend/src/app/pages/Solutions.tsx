import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import RoiCalculator from "../components/calculator/RoiCalculator";
import { 
  ArrowRight, Building2, Landmark, Home as HomeIcon, 
  ShoppingBag, Truck, HeartPulse, CheckCircle2, Sparkles, Phone, MessageSquare,
  ShieldCheck, GraduationCap, Car, Code2, Eye, FileText, Check
} from "lucide-react";

type Page = any;

interface SolutionsProps {
  setPage: (p: Page) => void;
}

// ── SVG Geometric Blueprint Background Accent ──────────────────────────────────
function GeometricGridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="grid-solutions" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="3,3" />
            <rect x="48" y="48" width="4" height="4" fill="#059669" opacity="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-solutions)" />
      </svg>
    </div>
  );
}

export default function Solutions({ setPage }: SolutionsProps) {
  const [activeTab, setActiveTab] = useState("ecommerce");
  const [viewMode, setViewMode] = useState<"non-tech" | "tech">("non-tech");

  const solutions = [
    {
      id: "ecommerce",
      name: "E-Commerce COD & Logistics",
      icon: ShoppingBag,
      tagline: "Slash Return-To-Origin (RTO) Losses by 40%",
      metric: "40% RTO Reduction",
      nonTechSummary: "In markets where Cash-on-Delivery (COD) represents up to 70% of e-commerce orders, fake addresses and buyer mind-changes cause massive courier losses. Claritiy Voice calls buyers automatically within 60 seconds of checkout, verifying delivery landmarks and offering prepaid discount upgrades in their local language.",
      techSummary: "Webhooks emitted from Shopify/WooCommerce hit our edge ingress controller (<50ms queue latency). The agent executes dynamic order updates via REST APIs, standardizing landmark fields and flagging high-risk fraud scores.",
      triggers: ["Shopify / WooCommerce Checkout Webhook", "High-Risk Fraud Score Trigger"],
      integrations: ["Shopify", "WooCommerce", "Shiprocket", "Clickpost", "Custom REST APIs"],
      useCases: ["Address & Landmark Verification", "Pre-Dispatch Prepaid Conversion Incentives", "Order Cancellation Handling", "Delivery Exception Rescheduling"],
      transcript: [
        { speaker: "agent", text: "Namaste Rahul! Calling from Claritiy Footwear regarding your order #8941 for Running Shoes (₹2,499, Cash on Delivery). Can you confirm this delivery?" },
        { speaker: "customer", text: "Yes, I placed it! But can you ask the courier to deliver near the Blue Dart office in Bandra West?" },
        { speaker: "agent", text: "Absolutely! I have noted 'Near Blue Dart office, Bandra West' in the delivery instructions. Your package will ship today!" }
      ],
      techSchema: `// Webhook Response Schema
POST /api/v2/integrations/shopify/cod-verify
{
  "order_id": "ORD-8941",
  "verification_status": "VERIFIED",
  "landmark_added": "Near Blue Dart office, Bandra West",
  "confidence_score": 0.98,
  "execution_ms": 172
}`
    },
    {
      id: "healthcare",
      name: "Healthcare & Dental Intake",
      icon: HeartPulse,
      tagline: "HIPAA-Compliant Reception & Intake Automation",
      metric: "85% Shorter Queue Times",
      nonTechSummary: "Clinic receptionists spend hours answering repetitive phone calls for appointments, prep instructions, and clinic hours. Claritiy Voice acts as a 24/7 polite receptionist that answers on the first ring, books appointments directly onto the doctor's calendar, and reminds patients of pre-op guidelines.",
      techSummary: "Encrypted zero-retention WebRTC audio streaming with edge PII/PHI redaction. Directly reads and writes appointment availability using FHIR / Epic EHR / Cerner REST API contracts.",
      triggers: ["Inbound Patient Call", "Missed Appointment Alert", "Post-Op Follow-Up Schedule"],
      integrations: ["Epic EHR", "Cerner", "AthenaHealth", "Kareo", "DrChrono"],
      useCases: ["Appointment Scheduling & Reminders", "Pre-Procedure Prep Instructions", "Insurance Verification Intake", "Post-Discharge Wellness Check"],
      transcript: [
        { speaker: "agent", text: "Hello! Thank you for calling Apollo Dental. How can I assist with your appointment today?" },
        { speaker: "customer", text: "Hi, I need to see Dr. Sharma for a root canal checkup this Thursday afternoon." },
        { speaker: "agent", text: "Dr. Sharma has open slots at 2:30 PM and 4:15 PM this Thursday. Which time works best for you?" }
      ],
      techSchema: `// FHIR EHR Appointment Slot Write
POST /fhir/r4/Appointment
{
  "resourceType": "Appointment",
  "status": "booked",
  "patientId": "pat_9921",
  "practitionerId": "dr_sharma_01",
  "start": "2026-08-27T14:30:00Z",
  "phi_redacted": true
}`
    },
    {
      id: "finance",
      name: "Financial Services & EMI Collections",
      icon: Landmark,
      tagline: "Ethical Payment Reminders & KYC Outreach",
      metric: "3.4× Debt Recovery Rate",
      nonTechSummary: "Traditional collection calls suffer from agent turnover, aggressive tone, and high compliance risk. Claritiy Voice agents maintain a polite, respectful tone, guiding borrowers through EMI schedules, offering pre-approved payment plans, and sending instant SMS payment links during the call.",
      techSummary: "PCI-DSS compliant payment link emission via Razorpay/Stripe webhooks. Directly interfaces with core banking platforms (Finacle, T24) with atomic event logs for regulatory auditing.",
      triggers: ["3-Day Pre-Due Reminder", "1-30 DPD Early Delinquency Queue"],
      integrations: ["Finacle", "T24", "Salesforce Financial Services Cloud", "Custom Core Banking"],
      useCases: ["Pre-Due EMI Payment Reminders", "Ethical Debt Restructuring Negotiations", "KYC Document Follow-up", "Credit Card Activation Intake"],
      transcript: [
        { speaker: "agent", text: "Good morning Ananya, this is Claritiy Credit calling regarding your loan EMI of ₹4,200 due tomorrow. Would you like me to send a direct UPI link to your phone now?" },
        { speaker: "customer", text: "Yes please, send it on WhatsApp or SMS." },
        { speaker: "agent", text: "Done! I have sent the secure payment link to your registered mobile number. Have a great day!" }
      ],
      techSchema: `// Core Banking Payment Dispatch Payload
POST /api/v2/finance/emi-reminder
{
  "loan_account_id": "LN-481920",
  "due_amount": 4200,
  "payment_link_sent": true,
  "channel": "SMS_AND_WHATSAPP",
  "call_disposition": "PROMISE_TO_PAY"
}`
    },
    {
      id: "realestate",
      name: "Real Estate & Lead Qualification",
      icon: HomeIcon,
      tagline: "Qualify 10,000+ Inbound Leads Monthly",
      metric: "5× More Site Visits Booked",
      nonTechSummary: "Online property inquiries turn cold within 5 minutes. Claritiy Voice calls inbound web leads instantly, asks key qualification questions (budget, move-in timeline, location preference), and schedules site visits directly onto your sales agents' calendars.",
      techSummary: "Sub-3s speed-to-lead outbound triggering from Facebook Ads, Google Ads, or HubSpot webhooks. Parses caller intent using RAG vector indices and synchronizes site visit events to Google Calendar / CRM.",
      triggers: ["Web Lead Form Submission", "Property Listing Inquiry"],
      integrations: ["HubSpot", "Salesforce", "Zoho CRM", "Google Calendar"],
      useCases: ["Immediate Lead Qualification", "Site Visit Scheduling", "Listing Availability Check", "Mortgage Partner Referral Intake"],
      transcript: [
        { speaker: "agent", text: "Hi Vikram! Thank you for inquiring about Green Acres 3BHK apartments. Are you looking to buy within the next 3 months?" },
        { speaker: "customer", text: "Yes, looking for a 3BHK around Whitefield under 1.5 Crores." },
        { speaker: "agent", text: "Great! We have 2 corner units matching your budget in Whitefield. Can I book a site visit with our manager for Saturday morning?" }
      ],
      techSchema: `// Lead Qualification CRM Schema
POST /api/v2/crm/leads/qualify
{
  "lead_id": "ld_8841",
  "budget": "1.5_CR",
  "preferred_area": "Whitefield",
  "site_visit_timestamp": "2026-08-23T10:30:00Z",
  "status": "QUALIFIED"
}`
    },
    {
      id: "logistics",
      name: "Logistics & Supply Chain",
      icon: Truck,
      tagline: "Proactive Delivery Updates & Driver Coordination",
      metric: "62% Fewer WISMO Calls",
      nonTechSummary: "Shipment delays flood customer support lines with 'Where Is My Order?' (WISMO) calls. Claritiy Voice proactively calls recipients with revised delivery ETAs, clears up confusing delivery addresses, and coordinates driver pickups.",
      techSummary: "Subscribes to WMS / TMS exception webhooks (Delhivery, FedEx, Shiprocket). Emits automated speech dispatch notifications with voice-controlled address landmark recording.",
      triggers: ["Delivery Exception Event", "Address Unclear Flag"],
      integrations: ["FedEx", "DHL", "Delhivery", "Custom WMS / TMS"],
      useCases: ["Proactive Delivery Status Alerts", "Failed Delivery Rescheduling", "Driver Coordination Calling", "Return Pickup Verification"],
      transcript: [
        { speaker: "agent", text: "Hi Priya! Your delivery driver is 10 minutes away from your home address in Sector 62. Will someone be available to receive the shipment?" },
        { speaker: "customer", text: "I am out right now, please leave it with the security guard at Gate 1." },
        { speaker: "agent", text: "Understood! I have notified the delivery agent to drop the package with Security Guard at Gate 1." }
      ],
      techSchema: `// Logistics Driver Dispatch Dispatch
POST /tms/v1/driver/note
{
  "waybill": "WB-9012481",
  "driver_instruction": "Leave package with Gate 1 Security",
  "recipient_confirmed": true,
  "latency_ms": 145
}`
    },
    {
      id: "insurance",
      name: "Insurance Claims & FNOL Intake",
      icon: ShieldCheck,
      tagline: "First Notice of Loss Intake & Policy Renewal",
      metric: "78% Policy Renewal Rate",
      nonTechSummary: "Filing an insurance claim or renewing a policy during emergencies requires fast, calm assistance. Claritiy Voice collects initial loss details, records vehicle/home damage descriptions, and sends instant claim tracking numbers.",
      techSummary: "Compliant with state insurance guidelines and ISO 27001 data protection. Integrates with Guidewire and Duck Creek policy administration systems.",
      triggers: ["First Notice of Loss Call", "30-Day Policy Renewal Alert"],
      integrations: ["Guidewire", "Duck Creek", "Salesforce Financial Cloud", "Custom Policy DB"],
      useCases: ["FNOL Claims Intake", "Policy Renewal Outreach", "Claim Status Tracking", "Coverage Inquiry Handling"],
      transcript: [
        { speaker: "agent", text: "Hello Rohan! I am calling from Claritiy Insurance regarding your motor policy renewal expiring in 5 days. Would you like to renew today with your 20% No Claim Bonus?" },
        { speaker: "customer", text: "Yes, please confirm if my No Claim Bonus is applied." },
        { speaker: "agent", text: "Confirmed! Your 20% NCB discount brings your premium to ₹8,450. I have sent the payment link to your email now." }
      ],
      techSchema: `// FNOL Claims Intake Schema
POST /api/v2/insurance/fnol
{
  "policy_number": "POL-992140",
  "incident_type": "MOTOR_ACCIDENT",
  "ncb_discount_applied": true,
  "status": "CLAIM_FILE_INITIATED"
}`
    },
    {
      id: "education",
      name: "Education & Admissions Counseling",
      icon: GraduationCap,
      tagline: "Student Counseling & Enrollment Nurturing",
      metric: "41% Lift in Student Enrollment",
      nonTechSummary: "Universities and online learning platforms lose prospective students due to delayed follow-ups. Claritiy Voice calls applicants, answers course curriculum questions, guides them through tuition fee options, and schedules counselor video calls.",
      techSummary: "Parses applicant history from LeadSquared or Salesforce Education Cloud. Dynamically adapts tone for friendly academic guidance.",
      triggers: ["Application Submitted Webhook", "Course Inquiry Form"],
      integrations: ["LeadSquared", "Salesforce Education", "HubSpot", "Google Meet API"],
      useCases: ["Enrollment Confirmation", "Financial Aid Counseling", "Class Schedule Updates", "Alumni Outreach"],
      transcript: [
        { speaker: "agent", text: "Hi Sneha! Calling from Horizon University regarding your Master in Data Science application. Do you have any questions about the curriculum or scholarship options?" },
        { speaker: "customer", text: "Yes, I wanted to know if weekend lab sessions are mandatory?" },
        { speaker: "agent", text: "Great question! Weekend labs are recorded and optional for working professionals. Would you like to schedule a 10-minute call with our Academic Dean?" }
      ],
      techSchema: `// Education Counseling Event Payload
POST /api/v2/edu/admissions/nurture
{
  "applicant_id": "app_5541",
  "course": "M.Sc Data Science",
  "counselor_slot_booked": "2026-08-25T11:00:00Z"
}`
    },
    {
      id: "automotive",
      name: "Automotive & Service Centers",
      icon: Car,
      tagline: "Service Appointment & Test Drive Scheduling",
      metric: "4.8 / 5 Customer Rating",
      nonTechSummary: "Car dealerships and service centers lose revenue when customer service lines are busy. Claritiy Voice handles service reminder calls, confirms test drive slots, and sends pickup notifications automatically.",
      techSummary: "Interfaces directly with Dealer Management Systems (DMS) for real-time bay availability and loaner vehicle tracking.",
      triggers: ["Mileage Service Interval Due", "Test Drive Booking Webhook"],
      integrations: ["CDK Global", "Reynolds & Reynolds", "Salesforce Auto", "Custom DMS"],
      useCases: ["Periodic Service Reminders", "Test Drive Confirmations", "Vehicle Pickup Readiness Alerts", "Parts Availability Check"],
      transcript: [
        { speaker: "agent", text: "Hello Amit! Claritiy Auto calling to remind you that your SUV is due for its 20,000 km periodic service. Can we reserve a service bay for you this Saturday at 9 AM?" },
        { speaker: "customer", text: "Yes, Saturday 9 AM works. Will a loaner car be available?" },
        { speaker: "agent", text: "Yes! A complimentary sedan loaner car is reserved for you. See you Saturday at 9 AM!" }
      ],
      techSchema: `// DMS Service Bay Booking Schema
POST /dms/v2/service/book
{
  "vin": "MA1XY9821...",
  "service_type": "20K_PERIODIC",
  "bay_reserved": "BAY_04",
  "loaner_vehicle_assigned": true
}`
    }
  ];

  const currentSolution = solutions.find((s) => s.id === activeTab) || solutions[0];

  return (
    <div className="space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen relative">
      <GeometricGridBackground />
      
      {/* Header Section */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
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
          Deploy pre-configured AI voice agents built specifically for your industry — featuring regional accent support, enterprise CRM compliance, and instant measurable ROI.
        </motion.p>

        {/* View Perspective Switcher */}
        <div className="pt-4 flex justify-center">
          <div className="bg-slate-900 text-white p-1.5 rounded-2xl inline-flex items-center gap-2 border border-slate-800 shadow-xl">
            <button
              onClick={() => setViewMode("non-tech")}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "non-tech"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-4 h-4" /> Non-Tech Business View
            </button>
            <button
              onClick={() => setViewMode("tech")}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "tech"
                  ? "bg-emerald-500 text-black shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Code2 className="w-4 h-4" /> Tech Developer Specs
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Industry Tab Switcher */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="flex items-center gap-2 overflow-x-auto pb-4 justify-start md:justify-center border-b border-slate-200">
          {solutions.map((s) => {
            const Icon = s.icon;
            const isActive = activeTab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`px-4 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap border ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
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
            key={`${currentSolution.id}-${viewMode}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="mt-8 bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-start"
          >
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-mono text-xs font-bold border border-emerald-200">
                <span>BENCHMARK IMPACT: {currentSolution.metric}</span>
              </div>
              
              <h2 className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {currentSolution.tagline}
              </h2>
              
              <p className="text-slate-600 leading-relaxed font-plus-jakarta text-base">
                {viewMode === "non-tech" ? currentSolution.nonTechSummary : currentSolution.techSummary}
              </p>

              {/* Core Use Cases */}
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

            {/* Right Dialogue / Code Schema Inspector Column */}
            <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 space-y-4">
              {viewMode === "non-tech" ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-xs font-bold text-white uppercase">INTEGRATION JSON SCHEMA</span>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      REST / WEBHOOK
                    </span>
                  </div>

                  <pre className="text-slate-300 font-mono text-[11px] bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed max-h-72">
                    {currentSolution.techSchema}
                  </pre>
                </>
              )}

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
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
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

      {/* Industry Showroom Grid */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
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
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-[#0B132B] text-white rounded-3xl p-10 md:p-16 text-center space-y-6 border border-slate-800">
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

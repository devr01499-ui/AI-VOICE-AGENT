import { motion, AnimatePresence } from "motion/react";
import React, { useState } from "react";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import { 
  ArrowRight, Building2, Landmark, Home as HomeIcon, 
  ShoppingBag, Truck, HeartPulse, CheckCircle2, Sparkles, Phone, MessageSquare,
  ShieldCheck, GraduationCap, Car, Code2, Eye, FileText, Check, Bot, Zap,
  Clock, Shield, UserCheck, Stethoscope, ChevronRight, Play, Filter, Activity,
  Sliders, ArrowUpRight
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

// ── 15 Pre-Built Production Templates Showcase Data ────────────────────────────
interface ShowcaseTemplate {
  id: string;
  name: string;
  persona: string;
  category: "BFSI & Fintech" | "Healthcare & Clinics" | "E-Commerce & Logistics" | "Real Estate & Home Services" | "Sales & Lead Gen" | "Support & Front Desk";
  type: "Visual Flow Canvas" | "System Prompt Studio";
  problemSolved: string;
  guardrails: string[];
  sampleDialogue: { speaker: string; text: string }[];
  impactMetric: string;
}

const PRODUCTION_TEMPLATES: ShowcaseTemplate[] = [
  {
    id: "tpl-1",
    name: "Front Desk & Department Router",
    persona: "Alex • Executive Front Desk Assistant",
    category: "Support & Front Desk",
    type: "Visual Flow Canvas",
    problemSolved: "Human front desks get flooded during peak hours. Inquiries for sales, tech support, and billing wait in queues while VIP callers drop off.",
    guardrails: ["Detects angry/confused tone and initiates senior human transfer", "Dispatches self-service portal links via SMS for routine billing queries", "Emergency security issues escalate to priority contact"],
    sampleDialogue: [
      { speaker: "Alex (AI)", text: "Hello! Thank you for calling Claritiy Voice. My name is Alex, your front desk assistant. How can I direct your call today?" },
      { speaker: "Caller", text: "I need to discuss pricing for our 30-person sales team." },
      { speaker: "Alex (AI)", text: "Fantastic! I'll connect you directly with our enterprise sales engineering desk. May I have your name and company?" }
    ],
    impactMetric: "0s Front Desk Hold Time"
  },
  {
    id: "tpl-2",
    name: "Medical Clinic Receptionist & Triage",
    persona: "Sarah • Medical Assistant",
    category: "Healthcare & Clinics",
    type: "System Prompt Studio",
    problemSolved: "Clinics miss 25% of patient calls during clinic hours. Receptionists are tied up booking appointments instead of helping patients at the counter.",
    guardrails: ["Mandatory immediate 911 emergency interrupt protocol for chest pain or acute symptoms", "Zero medical diagnosis disclaimer", "Strict patient privacy compliance"],
    sampleDialogue: [
      { speaker: "Sarah (AI)", text: "Thank you for calling Pinecrest Medical Group. My name is Sarah. Are you calling to schedule an appointment or request a prescription refill?" },
      { speaker: "Patient", text: "I need to see Dr. Patel this Thursday afternoon for a routine annual follow-up." },
      { speaker: "Sarah (AI)", text: "Dr. Patel has openings at 2:00 PM and 4:15 PM this Thursday. Which slot suits you best?" }
    ],
    impactMetric: "85% Shorter Intake Hold"
  },
  {
    id: "tpl-3",
    name: "B2B Outbound SDR & Lead Qualifier",
    persona: "Jordan • AI Sales Development Rep",
    category: "Sales & Lead Gen",
    type: "Visual Flow Canvas",
    problemSolved: "Web leads decay by 80% if not called within 5 minutes. Human SDR teams struggle to dial hundreds of fresh MQLs promptly every morning.",
    guardrails: ["Sub-3s speed-to-lead trigger from CRM webhook", "Instant live-transfer to Account Executive if monthly call volume > 1,000", "Dispatches self-serve video demo if lead is exploratory"],
    sampleDialogue: [
      { speaker: "Jordan (AI)", text: "Hi! This is Jordan from Claritiy Voice following up on your demo request. Do you have 2 minutes to discuss automating your team's call volume?" },
      { speaker: "Prospect", text: "Sure. We handle about 5,000 outbound dials a month on HubSpot." },
      { speaker: "Jordan (AI)", text: "That qualifies directly for our enterprise volume tier. Let me transfer you live to our Senior Solutions Engineer right now." }
    ],
    impactMetric: "3-Second Speed-to-Lead"
  },
  {
    id: "tpl-4",
    name: "Win-Back & Churn Reactivation",
    persona: "Marcus • Customer Win-Back Specialist",
    category: "Sales & Lead Gen",
    type: "System Prompt Studio",
    problemSolved: "Canceled and churned accounts are rarely phoned systematically. Generic win-back emails land in spam filters without discovering why the customer left.",
    guardrails: ["Respects immediate opt-out and removes from calling cadence instantly", "Tailors pitch based on root cause (pricing, features, volume)", "Logs structured exit reasons into CRM"],
    sampleDialogue: [
      { speaker: "Marcus (AI)", text: "Hello! Marcus here from Claritiy Voice. I noticed your subscription was recently paused, and wanted to see what main factor contributed?" },
      { speaker: "Customer", text: "Our monthly volume dipped during the off-season so the fixed plan wasn't economical." },
      { speaker: "Marcus (AI)", text: "Understood! We recently launched a flexible pay-as-you-go tier with zero monthly minimums. Would you like me to switch your account to that?" }
    ],
    impactMetric: "22% Win-Back Reactivation"
  },
  {
    id: "tpl-5",
    name: "Dental Clinic Scheduler & Urgent Triage",
    persona: "Maya • Dental Office Scheduler",
    category: "Healthcare & Clinics",
    type: "Visual Flow Canvas",
    problemSolved: "Dental practices lose high-margin procedures when patients get voicemail. Staff get overwhelmed balancing chair-side care with constant telephone calls.",
    guardrails: ["Instant triage for facial swelling, broken teeth, or acute tooth pain to emergency desk", "Dispatches digital intake forms via SMS directly to caller's mobile", "Checks existing vs new patient status"],
    sampleDialogue: [
      { speaker: "Maya (AI)", text: "Bright Smiles Dental, Maya speaking! Are you calling for a routine cleaning, checkup, or experiencing any discomfort?" },
      { speaker: "Patient", text: "I have severe pain in my lower molar that started last night." },
      { speaker: "Maya (AI)", text: "I'm sorry to hear that. Because you are in acute pain, I am transferring you directly to our emergency triage desk right now." }
    ],
    impactMetric: "94% First-Call Booking Rate"
  },
  {
    id: "tpl-6",
    name: "Home Services Dispatch & Safety Triage",
    persona: "Mark • Field Dispatch Assistant",
    category: "Real Estate & Home Services",
    type: "System Prompt Studio",
    problemSolved: "HVAC, plumbing, and electrical contractors miss emergency repair jobs during nights and weekends, while dispatchers waste time negotiating basic call-out fees.",
    guardrails: ["Immediate gas leak safety intervention: instructs caller to evacuate building and call utility", "Flooding shutoff guidance before dispatching technician", "Transparent dispatch diagnostic fee disclosure"],
    sampleDialogue: [
      { speaker: "Mark (AI)", text: "Apex Home Services, Mark here! Can we help you with Plumbing, HVAC heating and cooling, or Electrical work today?" },
      { speaker: "Homeowner", text: "Our AC unit stopped blowing cold air this afternoon." },
      { speaker: "Mark (AI)", text: "We have technician arrival windows tomorrow between 8 AM and 12 PM. Our $49 diagnostic fee is completely waived if repairs are approved." }
    ],
    impactMetric: "24/7 After-Hours Dispatch"
  },
  {
    id: "tpl-7",
    name: "Real Estate Inbound Lead Qualifier",
    persona: "Taylor • Luxury Property Qualifier",
    category: "Real Estate & Home Services",
    type: "Visual Flow Canvas",
    problemSolved: "Real estate agents spend 60% of their day screening unqualified leads who lack mortgage pre-approvals or budget alignment for the listing.",
    guardrails: ["Collects preferred area, timeline, and budget parameters", "Live agent transfer for pre-approved or cash buyers", "Dispatches vetted mortgage lender partners link via SMS for unapproved buyers"],
    sampleDialogue: [
      { speaker: "Taylor (AI)", text: "Premier Heights Realty, Taylor speaking! Are you looking to purchase a new home, sell, or lease?" },
      { speaker: "Buyer", text: "Looking to buy a 3-bedroom apartment in the downtown corridor under $850k." },
      { speaker: "Taylor (AI)", text: "Wonderful. Are you purchasing with cash or pre-approved for a mortgage loan?" }
    ],
    impactMetric: "5× Site Visits Scheduled"
  },
  {
    id: "tpl-8",
    name: "SaaS Free Trial Onboarding Guide",
    persona: "Chris • Product Onboarding Specialist",
    category: "Sales & Lead Gen",
    type: "System Prompt Studio",
    problemSolved: "90% of free trial signups abandon software within 48 hours without configuring their first workflow or seeing product value.",
    guardrails: ["Greets trial user by name within 15 minutes of registration", "Guides them directly to the 5-minute quickstart workflow based on their goal", "Routes enterprise SLA inquiries to dedicated Account Executive"],
    sampleDialogue: [
      { speaker: "Chris (AI)", text: "Welcome to Claritiy Voice! Congratulations on starting your trial. I'm Chris, your onboarding guide. Are you building inbound support or outbound calling?" },
      { speaker: "User", text: "We need outbound COD order confirmation for our Shopify store." },
      { speaker: "Chris (AI)", text: "Perfect! I've sent our 3-minute Shopify webhook quickstart link to your phone so you can launch your first test call right away." }
    ],
    impactMetric: "3× Trial-to-Paid Lift"
  },
  {
    id: "tpl-9",
    name: "E-Commerce COD Order Verification & RTO Defense",
    persona: "Courier Intake Assistant",
    category: "E-Commerce & Logistics",
    type: "Visual Flow Canvas",
    problemSolved: "Cash on Delivery represents up to 70% of retail orders in high-growth markets. Fake addresses and impulse cancellations cause 30–40% return-to-origin courier losses.",
    guardrails: ["Calls customer within 60 seconds of checkout", "Confirms exact delivery landmark and recipient availability", "Incentivizes immediate prepaid UPI upgrade with instant discount link"],
    sampleDialogue: [
      { speaker: "Claritiy Agent", text: "Namaste Rahul! Calling from Claritiy Footwear regarding your COD order #8941 for Running Shoes. Can you confirm this delivery?" },
      { speaker: "Customer", text: "Yes, I confirmed! Please ask the delivery partner to leave it near the landmark gate." },
      { speaker: "Claritiy Agent", text: "Landmark recorded! If you pay now via UPI, you get ₹150 instant discount. Would you like me to send the payment link?" }
    ],
    impactMetric: "40% RTO Courier Reduction"
  },
  {
    id: "tpl-10",
    name: "PCI-Compliant Billing & Subscription Assistant",
    persona: "Morgan • Billing Specialist",
    category: "Support & Front Desk",
    type: "System Prompt Studio",
    problemSolved: "Support teams spend hours answering 'What is this line item on my invoice?' while risking severe PCI violations by handling credit card numbers on audio lines.",
    guardrails: ["Strict security rule: never requests full card numbers or CVV codes over voice", "Verifies last 4 digits only and dispatches secure self-service portal link via SMS", "Itemizes usage fees vs base plan subscription clearly"],
    sampleDialogue: [
      { speaker: "Morgan (AI)", text: "Claritiy Voice Billing Support, Morgan speaking. How can I assist with your invoice today?" },
      { speaker: "Customer", text: "I have a question about the extra usage minutes billed on last month's statement." },
      { speaker: "Morgan (AI)", text: "I'd be glad to explain that. Your base tier includes 2,000 minutes; your team utilized 2,420 minutes, billed at our flat rate of ₹3.99 per minute." }
    ],
    impactMetric: "100% PCI Compliance"
  },
  {
    id: "tpl-11",
    name: "24/7 Incident Response & P1 Outage Triage",
    persona: "Alex • Incident Response Dispatcher",
    category: "Support & Front Desk",
    type: "System Prompt Studio",
    problemSolved: "When production infrastructure crashes at 2 AM, angry clients dial support numbers and reach dead voicemails. Escalation takes hours instead of minutes.",
    guardrails: ["Identifies P1 downtime immediately and triggers on-call PagerDuty alert within 60 seconds", "Enforces 15-minute SLA engineer callback guarantee", "Collects impacted server region, error symptom, and caller contact"],
    sampleDialogue: [
      { speaker: "Alex (AI)", text: "Enterprise Cloud Support After-Hours. Is this call regarding an active production outage or general inquiry?" },
      { speaker: "DevOps Lead", text: "Our US-East database cluster is returning 500 errors and our checkout service is down." },
      { speaker: "Alex (AI)", text: "P1 Incident #4092 logged. Our on-call primary database engineer has been paged and will reach you at this number within 15 minutes." }
    ],
    impactMetric: "15-Min Guaranteed P1 SLA"
  },
  {
    id: "tpl-12",
    name: "Conference & Event Registration Desk",
    persona: "Sam • Event Coordinator",
    category: "Support & Front Desk",
    type: "Visual Flow Canvas",
    problemSolved: "Event attendees call incessantly asking about registration status, badging, and venue locations leading up to major summits.",
    guardrails: ["Verifies attendee email and registration status", "Dispatches digital QR badge pass directly via SMS", "Routes VIP keynote and group registrations to live event concierge"],
    sampleDialogue: [
      { speaker: "Sam (AI)", text: "Claritiy Voice Summit Registration Desk! Sam speaking. Are you calling to register or check your pass?" },
      { speaker: "Attendee", text: "I need to get my QR admission badge for tomorrow's keynote." },
      { speaker: "Sam (AI)", text: "Confirmed! I've just texted your digital admission badge and conference schedule directly to your phone." }
    ],
    impactMetric: "Instant QR Badge Dispatch"
  },
  {
    id: "tpl-13",
    name: "BFSI Pre-Due EMI Courtesy Reminder",
    persona: "Automated Courtesy Reminder",
    category: "BFSI & Fintech",
    type: "System Prompt Studio",
    problemSolved: "Borrowers miss due dates simply from forgetfulness, leading to late penalties and credit score hits. Human collection calls are expensive and prone to rude interactions.",
    guardrails: ["RBI Fair Practices Code compliant: operates strictly between 8:00 AM and 7:00 PM", "Clear disclosure: states upfront that this is a courtesy reminder, NOT a collections call", "Never uses pressure, threats, or words like 'default'"],
    sampleDialogue: [
      { speaker: "Claritiy Voice", text: "Good morning. This is an automated courtesy reminder from Apex Lending regarding your EMI of ₹4,200 due on October 12th." },
      { speaker: "Borrower", text: "Thanks for reminding me. Can you send me the payment link?" },
      { speaker: "Claritiy Voice", text: "Certainly! I have texted the secure UPI payment link to your registered mobile number right now. Have a wonderful day." }
    ],
    impactMetric: "42% On-Time Payment Lift"
  },
  {
    id: "tpl-14",
    name: "BFSI Early Overdue Reminder (1–30 DPD)",
    persona: "Empathy-First Collections Assistant",
    category: "BFSI & Fintech",
    type: "System Prompt Studio",
    problemSolved: "Early overdue borrowers (1–30 days) are alienated by aggressive recovery agents, leading to call avoidance and default escalation.",
    guardrails: ["Mandatory borrower identity verification before disclosing account details", "Zero harassment guarantee: max 1 call per day, respectful non-judgmental tone", "Instant escalation to hardship officer if borrower reports financial distress"],
    sampleDialogue: [
      { speaker: "Claritiy Voice", text: "Hello. This is an automated notification from Apex Lending for account ending in 8192. Am I speaking with Rahul Sharma?" },
      { speaker: "Rahul", text: "Yes, speaking." },
      { speaker: "Claritiy Voice", text: "Thank you for confirming Rahul. Your payment of ₹5,600 is currently 8 days past due. Would you like to confirm a payment date or set up a UPI link?" }
    ],
    impactMetric: "3.4× Debt Resolution Rate"
  },
  {
    id: "tpl-15",
    name: "Loan Recovery & Settlement Outreach (30+ DPD)",
    persona: "Resolution & Settlement Assistant",
    category: "BFSI & Fintech",
    type: "Visual Flow Canvas",
    problemSolved: "Late-stage debt collection is fraught with regulatory compliance risks, third-party disclosure breaches, and manual tracking errors.",
    guardrails: ["Strict third-party non-disclosure gate: terminates call immediately if person is not verified borrower", "RBI compliant settlement escalation to human restructuring officer", "Dispatches legal payment receipts via SMS and WhatsApp"],
    sampleDialogue: [
      { speaker: "Claritiy Voice", text: "This is an automated call from Apex Lending regarding loan account ending in 4102. Am I speaking with the account holder?" },
      { speaker: "Third Party", text: "No, he is not available right now." },
      { speaker: "Claritiy Voice", text: "I understand. I am unable to discuss account details with anyone other than the account holder. Thank you." }
    ],
    impactMetric: "100% RBI Audit Compliance"
  }
];

export default function Solutions({ setPage }: SolutionsProps) {
  const [activeTab, setActiveTab] = useState("ecommerce");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>("All");
  const [selectedTemplate, setSelectedTemplate] = useState<ShowcaseTemplate>(PRODUCTION_TEMPLATES[8]); // Default to COD
  const [inspectorMode, setInspectorMode] = useState<"dialogue" | "schema" | "metrics">("dialogue");

  const filteredTemplates = PRODUCTION_TEMPLATES.filter((tpl) => 
    templateCategoryFilter === "All" ? true : tpl.category === templateCategoryFilter
  );

  const solutions = [
    {
      id: "ecommerce",
      name: "E-Commerce COD & Logistics",
      icon: ShoppingBag,
      tagline: "Slash Return-To-Origin (RTO) Losses by 40%",
      metric: "40% RTO Reduction",
      summary: "In markets where Cash-on-Delivery (COD) represents up to 70% of e-commerce orders, fake addresses and buyer mind-changes cause massive courier losses. Claritiy Voice calls buyers automatically within 60 seconds of checkout, verifying delivery landmarks and offering prepaid discount upgrades in their local language.",
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
}`,
      metricsData: {
        latency: "174ms roundtrip",
        concurrency: "5,000+ calls/hr",
        successRate: "94.2% completed verification",
        format: "SRTP 16kHz PCM zero-copy"
      }
    },
    {
      id: "healthcare",
      name: "Healthcare & Dental Intake",
      icon: HeartPulse,
      tagline: "Secure Patient Intake & Appointment Automation",
      metric: "85% Shorter Queue Times",
      summary: "Clinic receptionists spend hours answering repetitive phone calls for appointments, prep instructions, and clinic hours. Claritiy Voice acts as a 24/7 polite receptionist that answers on the first ring, books appointments directly onto the doctor's calendar, and reminds patients of pre-op guidelines.",
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
}`,
      metricsData: {
        latency: "168ms roundtrip",
        concurrency: "1,200+ clinics active",
        successRate: "91.8% first-call booking",
        format: "Edge PII Scrubbed • FHIR R4"
      }
    },
    {
      id: "finance",
      name: "Financial Services & EMI Collections",
      icon: Landmark,
      tagline: "Ethical Payment Reminders & KYC Outreach",
      metric: "3.4× Debt Recovery Rate",
      summary: "Traditional collection calls suffer from agent turnover, aggressive tone, and high compliance risk. Claritiy Voice agents maintain a polite, respectful tone, guiding borrowers through EMI schedules, offering pre-approved payment plans, and sending instant SMS payment links during the call.",
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
}`,
      metricsData: {
        latency: "162ms roundtrip",
        concurrency: "10,000+ concurrent channels",
        successRate: "88.4% promise to pay",
        format: "RBI Fair Practices • TLS 1.3"
      }
    },
    {
      id: "realestate",
      name: "Real Estate & Lead Qualification",
      icon: HomeIcon,
      tagline: "Qualify 10,000+ Inbound Leads Monthly",
      metric: "5× More Site Visits Booked",
      summary: "Online property inquiries turn cold within 5 minutes. Claritiy Voice calls inbound web leads instantly, asks key qualification questions (budget, move-in timeline, location preference), and schedules site visits directly onto your sales agents' calendars.",
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
}`,
      metricsData: {
        latency: "171ms roundtrip",
        concurrency: "Instant sub-3s trigger",
        successRate: "68% tour schedule rate",
        format: "Bidirectional CRM Webhooks"
      }
    },
    {
      id: "logistics",
      name: "Logistics & Supply Chain",
      icon: Truck,
      tagline: "Proactive Delivery Updates & Driver Coordination",
      metric: "62% Fewer WISMO Calls",
      summary: "Shipment delays flood customer support lines with 'Where Is My Order?' (WISMO) calls. Claritiy Voice proactively calls recipients with revised delivery ETAs, clears up confusing delivery addresses, and coordinates driver pickups.",
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
}`,
      metricsData: {
        latency: "145ms roundtrip",
        concurrency: "High-volume batch routing",
        successRate: "98.5% first-attempt delivery",
        format: "REST Event Stream"
      }
    },
    {
      id: "insurance",
      name: "Insurance Claims & FNOL Intake",
      icon: ShieldCheck,
      tagline: "First Notice of Loss Intake & Policy Renewal",
      metric: "78% Policy Renewal Rate",
      summary: "Filing an insurance claim or renewing a policy during emergencies requires fast, calm assistance. Claritiy Voice collects initial loss details, records vehicle/home damage descriptions, and sends instant claim tracking numbers.",
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
}`,
      metricsData: {
        latency: "179ms roundtrip",
        concurrency: "24/7 disaster surge ready",
        successRate: "3.5× faster claims triage",
        format: "Zero Audio Retention Policy"
      }
    },
    {
      id: "education",
      name: "Education & Admissions Counseling",
      icon: GraduationCap,
      tagline: "Student Counseling & Enrollment Nurturing",
      metric: "41% Lift in Student Enrollment",
      summary: "Universities and online learning platforms lose prospective students due to delayed follow-ups. Claritiy Voice calls applicants, answers course curriculum questions, guides them through tuition fee options, and schedules counselor video calls.",
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
}`,
      metricsData: {
        latency: "170ms roundtrip",
        concurrency: "Scalable admissions queues",
        successRate: "41% enrollment acceleration",
        format: "LeadSquared & LMS APIs"
      }
    },
    {
      id: "automotive",
      name: "Automotive & Service Centers",
      icon: Car,
      tagline: "Service Appointment & Test Drive Scheduling",
      metric: "4.8 / 5 Customer Rating",
      summary: "Car dealerships and service centers lose revenue when customer service lines are busy. Claritiy Voice handles service reminder calls, confirms test drive slots, and sends pickup notifications automatically.",
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
}`,
      metricsData: {
        latency: "165ms roundtrip",
        concurrency: "Multi-dealership bay sync",
        successRate: "92% booking completion",
        format: "DMS Direct Bay Connector"
      }
    }
  ];

  const currentSolution = solutions.find((s) => s.id === activeTab) || solutions[0];

  return (
    <div className="space-y-20 pb-32 pt-28 bg-[#E5E3DC] min-h-screen relative font-sans text-[#121212]">
      
      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
        <div className="hatched-strip h-10 w-full mb-8" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono uppercase tracking-wider">
          <span>|</span>
          <span>Enterprise Industry Solutions & Templates</span>
        </div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl lg:text-6xl font-normal md:font-medium text-[#121212] tracking-tight leading-[1.08] font-sans"
        >
          Voice AI Engineered For Your Exact Business Operations
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[#262523] text-base md:text-lg max-w-3xl mx-auto font-sans leading-relaxed"
        >
          Stop losing revenue to missed calls, high courier returns, or slow lead follow-ups. Explore 15 pre-built production templates with native regional accents, built-in regulatory guardrails, and real-time CRM webhooks.
        </motion.p>

        {/* Operational Highlights Pill Grid */}
        <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-4 text-center">
            <span className="text-2xl font-bold text-[#121212] font-mono block">40%</span>
            <span className="text-xs text-[#262523] font-mono">COD RTO Reduction</span>
          </div>
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-4 text-center">
            <span className="text-2xl font-bold text-[#121212] font-mono block">&lt;180ms</span>
            <span className="text-xs text-[#262523] font-mono">Sub-Human Latency</span>
          </div>
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-4 text-center">
            <span className="text-2xl font-bold text-[#121212] font-mono block">70+</span>
            <span className="text-xs text-[#262523] font-mono">Regional Dialects</span>
          </div>
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-4 text-center">
            <span className="text-2xl font-bold text-[#121212] font-mono block">15</span>
            <span className="text-xs text-[#262523] font-mono">Production Templates</span>
          </div>
        </div>
      </section>

      {/* ── FEATURED: 15 Production Templates Interactive Explorer ────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#CBC8BE] pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#121212] uppercase tracking-widest">
              <Bot className="w-4 h-4" /> READY-TO-DEPLOY PRODUCTION TEMPLATES
            </div>
            <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
              Explore Pre-Configured Agent Architectures
            </h2>
            <p className="text-[#262523] text-sm max-w-2xl font-sans">
              Each template contains pre-tested conversational flowgraphs or system prompt guardrails designed for high-stakes business calls.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage("dashboard")}
              className="px-5 py-2.5 rounded-[2px] bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider text-xs flex items-center gap-2 transition-colors cursor-pointer font-medium"
            >
              Open Studio Builder <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {["All", "BFSI & Fintech", "Healthcare & Clinics", "E-Commerce & Logistics", "Real Estate & Home Services", "Sales & Lead Gen", "Support & Front Desk"].map((cat) => (
            <button
              key={cat}
              onClick={() => setTemplateCategoryFilter(cat)}
              className={`px-3.5 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                templateCategoryFilter === cat
                  ? "bg-[#121212] text-white border border-[#121212]"
                  : "bg-[#DFDCD4] text-[#121212] hover:bg-[#D5D1C7] border border-[#CBC8BE]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates Grid & Live Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Template Cards List */}
          <div className="lg:col-span-5 space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {filteredTemplates.map((tpl) => {
              const isSelected = selectedTemplate.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-5 rounded-[2px] border transition-all cursor-pointer text-left ${
                    isSelected
                      ? "bg-[#DFDCD4] border-[#121212] ring-1 ring-[#121212] shadow-sm"
                      : "bg-[#EBE9E2] border-[#CBC8BE] hover:border-[#9C998F]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-medium text-sm text-[#121212] font-sans">{tpl.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-[1px] font-bold bg-[#DFDCD4] text-[#121212] border border-[#CBC8BE] flex-shrink-0">
                      {tpl.impactMetric}
                    </span>
                  </div>

                  <p className="text-xs text-[#262523] line-clamp-2 leading-relaxed mb-3 font-sans">
                    {tpl.problemSolved}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono text-[#262523] border-t border-[#CBC8BE] pt-2.5">
                    <span className="text-[#121212] font-semibold">{tpl.persona.split("•")[0].trim()}</span>
                    <span>{tpl.type}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Template Detailed Inspector */}
          <div className="lg:col-span-7 bg-[#EBE9E2] rounded-[2px] border border-[#CBC8BE] p-7 md:p-9 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CBC8BE] pb-5">
              <div>
                <span className="text-[11px] font-mono font-medium text-[#121212] uppercase tracking-wider block">
                  {selectedTemplate.category} · {selectedTemplate.type}
                </span>
                <h3 className="text-2xl font-medium text-[#121212] mt-1 font-sans tracking-tight">
                  {selectedTemplate.name}
                </h3>
                <p className="text-xs text-[#262523] font-mono mt-0.5">{selectedTemplate.persona}</p>
              </div>

              <button
                onClick={() => setPage("dashboard")}
                className="px-4 py-2.5 bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider text-xs rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
              >
                Deploy in Studio <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Why This Matters / Problem Solved */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-medium text-[#121212] uppercase tracking-wider">
                OPERATIONAL PROBLEM SOLVED:
              </h4>
              <p className="text-sm text-[#262523] leading-relaxed bg-[#DFDCD4] p-3.5 rounded-[2px] border border-[#CBC8BE] font-sans">
                {selectedTemplate.problemSolved}
              </p>
            </div>

            {/* Operational Guardrails */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-mono font-medium text-[#121212] uppercase tracking-wider">
                BUILT-IN ENTERPRISE GUARDRAILS:
              </h4>
              <div className="space-y-1.5">
                {selectedTemplate.guardrails.map((gr, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-[#121212] font-sans">
                    <ShieldCheck className="w-4 h-4 text-[#121212] flex-shrink-0 mt-0.5" />
                    <span>{gr}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Conversation Simulation */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-medium text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#121212]" /> LIVE DIALOGUE SIMULATION:
                </h4>
                <span className="text-[10px] font-mono text-[#121212] font-medium bg-[#DFDCD4] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE]">
                  LATENCY &lt; 180MS
                </span>
              </div>

              <div className="space-y-2 bg-[#DFDCD4] text-[#121212] p-4 rounded-[2px] border border-[#CBC8BE] text-xs">
                {selectedTemplate.sampleDialogue.map((turn, idx) => {
                  const isAgent = turn.speaker.includes("AI") || turn.speaker.includes("Agent") || turn.speaker.includes("Voice");
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-[2px] space-y-1 ${
                        isAgent
                          ? "bg-[#EBE9E2] text-[#121212] border border-[#CBC8BE]"
                          : "bg-[#E5E3DC] text-[#121212] border border-[#CBC8BE] ml-4"
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold block text-[#121212]">
                        {turn.speaker}
                      </span>
                      <p className="leading-relaxed font-sans">{turn.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Industry Deep-Dive Section with Unified Inspector ───────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
            | INDUSTRY ARCHITECTURE & WORKFLOWS
          </span>
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
            Operational Blueprints Across Verticals
          </h2>
          <p className="text-[#262523] text-sm font-sans">
            Select an industry below to review how Claritiy Voice handles customer conversations, live event triggers, and backend CRM integration schemas.
          </p>
        </div>

        {/* Industry Switcher Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 justify-start md:justify-center border-b border-[#CBC8BE]">
          {solutions.map((s) => {
            const Icon = s.icon;
            const isActive = activeTab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveTab(s.id);
                  setInspectorMode("dialogue");
                }}
                className={`px-3.5 py-2 rounded-[2px] font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap border cursor-pointer ${
                  isActive
                    ? "bg-[#121212] text-white border-[#121212]"
                    : "bg-[#DFDCD4] text-[#121212] border-[#CBC8BE] hover:bg-[#D5D1C7]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Industry Card with Unified Multi-Tab Inspector */}
        <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Content Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#DFDCD4] text-[#121212] font-mono text-xs border border-[#CBC8BE]">
              <span>BENCHMARK IMPACT: {currentSolution.metric}</span>
            </div>
            
            <h2 className="text-3xl font-medium text-[#121212] font-sans tracking-tight">
              {currentSolution.tagline}
            </h2>
            
            <p className="text-[#262523] leading-relaxed font-sans text-base">
              {currentSolution.summary}
            </p>

            {/* Core Use Cases */}
            <div className="space-y-3 pt-2">
              <h4 className="font-mono text-xs uppercase tracking-wider text-[#121212]">
                CORE AUTOMATED USE CASES
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentSolution.useCases.map((uc) => (
                  <div key={uc} className="flex items-center gap-2 text-xs text-[#121212] bg-[#DFDCD4] p-2.5 rounded-[2px] border border-[#CBC8BE] font-sans">
                    <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0" />
                    <span>{uc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Integrations & Triggers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#CBC8BE] font-mono text-xs">
              <div>
                <span className="text-[#262523] block mb-1">EVENT TRIGGERS:</span>
                <div className="flex flex-wrap gap-1">
                  {currentSolution.triggers.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] rounded-[1px]">{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[#262523] block mb-1">COMPATIBLE INTEGRATIONS:</span>
                <div className="flex flex-wrap gap-1">
                  {currentSolution.integrations.map((i) => (
                    <span key={i} className="px-2 py-0.5 bg-[#DFDCD4] text-[#121212] rounded-[1px] border border-[#CBC8BE]">{i}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Interactive Inspector Column */}
          <div className="lg:col-span-5 bg-[#DFDCD4] text-[#121212] rounded-[2px] p-6 border border-[#CBC8BE] space-y-4">
            {/* Contextual Sub-Tab Switcher */}
            <div className="flex items-center justify-between border-b border-[#CBC8BE] pb-3">
              <div className="flex items-center gap-1.5 bg-[#EBE9E2] p-1 rounded-[2px] border border-[#CBC8BE]">
                <button
                  onClick={() => setInspectorMode("dialogue")}
                  className={`px-3 py-1 rounded-[1px] text-xs font-mono transition-all flex items-center gap-1 cursor-pointer ${
                    inspectorMode === "dialogue"
                      ? "bg-[#121212] text-white"
                      : "text-[#262523] hover:text-[#121212]"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Call Dialogue
                </button>
                <button
                  onClick={() => setInspectorMode("schema")}
                  className={`px-3 py-1 rounded-[1px] text-xs font-mono transition-all flex items-center gap-1 cursor-pointer ${
                    inspectorMode === "schema"
                      ? "bg-[#121212] text-white"
                      : "text-[#262523] hover:text-[#121212]"
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" /> API Schema
                </button>
                <button
                  onClick={() => setInspectorMode("metrics")}
                  className={`px-3 py-1 rounded-[1px] text-xs font-mono transition-all flex items-center gap-1 cursor-pointer ${
                    inspectorMode === "metrics"
                      ? "bg-[#121212] text-white"
                      : "text-[#262523] hover:text-[#121212]"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" /> Telemetry
                </button>
              </div>

              <span className="font-mono text-[10px] text-[#121212] bg-[#EBE9E2] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE]">
                LIVE DEMO
              </span>
            </div>

            {/* Sub-Tab 1: Dialogue Simulation */}
            {inspectorMode === "dialogue" && (
              <div className="space-y-3 font-sans text-xs">
                {currentSolution.transcript.map((line, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-[2px] space-y-1 ${
                      line.speaker === "agent"
                        ? "bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212]"
                        : "bg-[#E5E3DC] border border-[#CBC8BE] text-[#121212] ml-4"
                    }`}
                  >
                    <div className="flex justify-between items-center font-mono text-[10px] text-[#262523]">
                      <span className="font-bold text-[#121212]">
                        {line.speaker === "agent" ? "Claritiy Voice Agent" : "Customer"}
                      </span>
                    </div>
                    <p className="leading-relaxed font-sans">{line.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-Tab 2: Webhook Schema */}
            {inspectorMode === "schema" && (
              <div className="space-y-2">
                <pre className="text-[#121212] font-mono text-[11px] bg-[#EBE9E2] p-4 rounded-[2px] border border-[#CBC8BE] overflow-x-auto leading-relaxed max-h-72">
                  {currentSolution.techSchema}
                </pre>
                <p className="text-[11px] text-[#262523] font-mono">
                  Post-back webhook delivered via TLS 1.3 with HMAC cryptographic signature.
                </p>
              </div>
            )}

            {/* Sub-Tab 3: Telemetry & Latency */}
            {inspectorMode === "metrics" && (
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-[#EBE9E2] p-3.5 rounded-[2px] border border-[#CBC8BE] space-y-1">
                  <span className="text-[10px] text-[#262523] uppercase block">ROUNDTRIP LATENCY</span>
                  <span className="text-[#121212] font-bold text-sm block">{currentSolution.metricsData.latency}</span>
                  <span className="text-[10px] text-[#262523] block">Edge ingress node</span>
                </div>
                <div className="bg-[#EBE9E2] p-3.5 rounded-[2px] border border-[#CBC8BE] space-y-1">
                  <span className="text-[10px] text-[#262523] uppercase block">CONCURRENCY BUDGET</span>
                  <span className="text-[#121212] font-bold text-sm block">{currentSolution.metricsData.concurrency}</span>
                  <span className="text-[10px] text-[#262523] block">Auto-scaling SIP trunks</span>
                </div>
                <div className="bg-[#EBE9E2] p-3.5 rounded-[2px] border border-[#CBC8BE] space-y-1">
                  <span className="text-[10px] text-[#262523] uppercase block">RESOLUTION RATE</span>
                  <span className="text-[#121212] font-bold text-sm block">{currentSolution.metricsData.successRate}</span>
                  <span className="text-[10px] text-[#262523] block">Without human agent transfer</span>
                </div>
                <div className="bg-[#EBE9E2] p-3.5 rounded-[2px] border border-[#CBC8BE] space-y-1">
                  <span className="text-[10px] text-[#262523] uppercase block">AUDIO PROTOCOL</span>
                  <span className="text-[#121212] font-bold text-sm block">{currentSolution.metricsData.format}</span>
                  <span className="text-[10px] text-[#262523] block">Full duplex WebRTC</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setPage("dashboard")}
              className="w-full py-3 bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer font-medium"
            >
              Test This Solution In Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── All Covered Verticals Grid ──────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
            | ALL COVERED VERTICALS
          </span>
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
            Pre-Built Agent Templates For 12 Verticals
          </h2>
        </div>
        <IndustryShowroomGrid setPage={setPage} />
      </section>

      {/* ── Bottom Callout ──────────────────────────────────────────────── */}
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-8 md:p-12 text-center space-y-6 border border-[#CBC8BE]">
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
            Deploy Your First Production Agent in 10 Minutes
          </h2>
          <p className="text-[#262523] max-w-2xl mx-auto text-sm sm:text-base font-sans leading-relaxed">
            Connect your phone number, select a production template, and launch with zero upfront engineering overhead.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button
              onClick={() => setPage("dashboard")}
              className="py-3 px-8 text-xs font-mono uppercase tracking-wider bg-[#121212] hover:bg-black text-white font-medium rounded-[2px] inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              Start Free in Sandbox <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage("contact")}
              className="py-3 px-8 text-xs font-mono uppercase tracking-wider bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] font-medium rounded-[2px] inline-flex items-center gap-2 border border-[#CBC8BE] cursor-pointer transition-colors"
            >
              Book Architecture Review
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

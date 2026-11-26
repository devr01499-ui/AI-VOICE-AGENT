import { motion } from "motion/react";
import { useState } from "react";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import { concurrencyText, usePublicPlans } from "../lib/plans";
import { 
  ArrowRight, Landmark, Home as HomeIcon, 
  ShoppingBag, Truck, HeartPulse, CheckCircle2, MessageSquare,
  ShieldCheck, GraduationCap, Car, Code2, Bot, 
  Activity} from "lucide-react";

type Page = any;

interface SolutionsProps {
  setPage: (p: Page) => void;
}

// ── Template showcase ────────────────────────────────────────────────────────
// Every rule below is something the agent does on the call itself (its instructions), or through a
// Function / webhook the customer connects. No outcome figures: none have been measured
// (docs/COMPLIANCE_NOTES.md, "Marketing claims").
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
    persona: "Alex • Front Desk Assistant",
    category: "Support & Front Desk",
    type: "Visual Flow Canvas",
    problemSolved: "At busy times the front desk cannot pick up every call. Sales, support and billing questions wait in a queue, and some callers simply hang up.",
    guardrails: ["Works out whether the caller needs sales, support or billing, and collects name and company", "Offers a call-back from the right team when a person needs to follow up", "Records the reason for the call so your team can act on it"],
    sampleDialogue: [
      { speaker: "Alex (AI)", text: "Hello, thank you for calling. I'm Alex, the AI front desk assistant. How can I help you today?" },
      { speaker: "Caller", text: "I need to discuss pricing for our 30-person sales team." },
      { speaker: "Alex (AI)", text: "Happy to help. May I have your name and company? I'll ask our sales team to call you back today." }
    ],
    impactMetric: "Every call picked up"
  },
  {
    id: "tpl-2",
    name: "Medical Clinic Receptionist",
    persona: "Priya • Clinic Receptionist",
    category: "Healthcare & Clinics",
    type: "System Prompt Studio",
    problemSolved: "Receptionists juggle the phone and the patients in front of them. Calls go unanswered in busy hours, and appointment requests are lost.",
    guardrails: ["Tells callers with chest pain or other emergency symptoms to call 112 or go to the nearest hospital", "Never gives a diagnosis or medical advice; offers a call-back from the doctor instead", "Books appointments on the clinic's Google Calendar within its working hours"],
    sampleDialogue: [
      { speaker: "Priya (AI)", text: "Namaste, Lotus Clinic, this is Priya, the AI assistant. Would you like to book an appointment?" },
      { speaker: "Patient", text: "I need to see Dr. Patel on Thursday afternoon for a follow-up." },
      { speaker: "Priya (AI)", text: "Dr. Patel is free at 2 pm and 4:15 pm on Thursday. Which time suits you?" }
    ],
    impactMetric: "Google Calendar booking"
  },
  {
    id: "tpl-3",
    name: "B2B Outbound Lead Qualifier",
    persona: "Jordan • AI Sales Assistant",
    category: "Sales & Lead Gen",
    type: "Visual Flow Canvas",
    problemSolved: "New enquiries go cold while the sales team works through yesterday's list. Many are never called at all.",
    guardrails: ["Called as soon as your CRM sends the lead through the API", "Asks your qualifying questions: team size, call volume, timeline, budget", "Books a meeting on the calendar or marks the lead for follow-up, and sends the answers to your CRM by webhook"],
    sampleDialogue: [
      { speaker: "Jordan (AI)", text: "Hi, this is Jordan, an AI assistant, following up on your demo request. Do you have two minutes?" },
      { speaker: "Prospect", text: "Sure. We make about 5,000 outbound calls a month." },
      { speaker: "Jordan (AI)", text: "Thanks. That fits our larger plans. Shall I book a 30-minute call with our solutions team for tomorrow?" }
    ],
    impactMetric: "Leads called via API"
  },
  {
    id: "tpl-4",
    name: "Win-Back & Churn Reactivation",
    persona: "Marcus • Customer Win-Back Assistant",
    category: "Sales & Lead Gen",
    type: "System Prompt Studio",
    problemSolved: "Customers who cancel are rarely phoned. Win-back emails go unread, and nobody learns why they left.",
    guardrails: ["Stops and ends the call politely when the customer says they do not want calls", "Asks why they left: price, features or volume", "Sends the reason to your CRM as a structured field after the call"],
    sampleDialogue: [
      { speaker: "Marcus (AI)", text: "Hello, this is Marcus, an AI assistant. I noticed your subscription was paused. May I ask what led to that?" },
      { speaker: "Customer", text: "Our volume dropped in the off-season, so the plan wasn't worth it." },
      { speaker: "Marcus (AI)", text: "That makes sense. Would it help if someone from our team called you about a smaller plan?" }
    ],
    impactMetric: "Exit reasons captured"
  },
  {
    id: "tpl-5",
    name: "Dental Clinic Scheduler",
    persona: "Maya • Dental Clinic Assistant",
    category: "Healthcare & Clinics",
    type: "Visual Flow Canvas",
    problemSolved: "Dentists lose bookings when patients reach voicemail, and staff cannot leave the chair to answer every call.",
    guardrails: ["Asks whether the caller is a new or existing patient", "Flags severe pain or swelling as urgent and offers the earliest slot or a call-back from the dentist", "Books cleanings and check-ups on the clinic calendar"],
    sampleDialogue: [
      { speaker: "Maya (AI)", text: "Bright Smiles Dental, this is Maya, the AI assistant. Is this for a cleaning, a check-up, or are you in any pain?" },
      { speaker: "Patient", text: "I have bad pain in a lower tooth since last night." },
      { speaker: "Maya (AI)", text: "I'm sorry to hear that. I'm marking this as urgent. The earliest slot is today at 5 pm; shall I book it?" }
    ],
    impactMetric: "Urgent cases flagged"
  },
  {
    id: "tpl-6",
    name: "Home Services Booking & Safety",
    persona: "Mark • Service Booking Assistant",
    category: "Real Estate & Home Services",
    type: "System Prompt Studio",
    problemSolved: "AC, plumbing and electrical businesses miss jobs in the evening and on weekends, and spend staff time repeating the same visit-charge details.",
    guardrails: ["For a gas smell, tells the caller to leave the building and call the gas emergency line first", "States the visit charge clearly before booking", "Offers the next free technician window"],
    sampleDialogue: [
      { speaker: "Mark (AI)", text: "Apex Home Services, this is Mark, the AI assistant. Is it plumbing, AC or electrical work?" },
      { speaker: "Homeowner", text: "Our AC stopped cooling this afternoon." },
      { speaker: "Mark (AI)", text: "A technician can come tomorrow between 8 am and 12 pm. The visit charge is ₹399, adjusted against the repair. Shall I book it?" }
    ],
    impactMetric: "Bookings after hours"
  },
  {
    id: "tpl-7",
    name: "Real Estate Enquiry Qualifier",
    persona: "Taylor • Property Enquiry Assistant",
    category: "Real Estate & Home Services",
    type: "Visual Flow Canvas",
    problemSolved: "Property teams spend hours calling enquiries that turn out to be outside budget or location.",
    guardrails: ["Asks preferred location, budget, property type and timeline", "Asks whether the buyer has a home loan approved or is paying from savings", "Books a site visit or marks the lead for follow-up, and sends the answers to your CRM"],
    sampleDialogue: [
      { speaker: "Taylor (AI)", text: "Premier Heights Realty, this is Taylor, the AI assistant. Are you looking to buy, sell or rent?" },
      { speaker: "Buyer", text: "Buying a 3BHK in Baner, under 1.2 crore." },
      { speaker: "Taylor (AI)", text: "Great. Is a home loan already approved, or will you arrange one?" }
    ],
    impactMetric: "Site visits booked"
  },
  {
    id: "tpl-8",
    name: "SaaS Free Trial Onboarding",
    persona: "Chris • Onboarding Assistant",
    category: "Sales & Lead Gen",
    type: "System Prompt Studio",
    problemSolved: "Many trial users sign up and never finish setting up, so they never see what the product can do.",
    guardrails: ["Calls new trial users after sign-up, through the API", "Asks what they want to achieve and points them to the right first step", "Offers a call with the team for larger accounts"],
    sampleDialogue: [
      { speaker: "Chris (AI)", text: "Hi, this is Chris, an AI assistant. Thanks for starting your trial. Are you setting up inbound support or outbound calling?" },
      { speaker: "User", text: "Outbound COD order confirmation for our online store." },
      { speaker: "Chris (AI)", text: "Perfect. The COD confirmation template is the quickest start. Would a short setup call with our team help?" }
    ],
    impactMetric: "Trial users called"
  },
  {
    id: "tpl-9",
    name: "E-Commerce COD Order Confirmation",
    persona: "Order Confirmation Assistant",
    category: "E-Commerce & Logistics",
    type: "Visual Flow Canvas",
    problemSolved: "Cash-on-delivery orders with wrong addresses or second thoughts come back as RTO, and the brand pays shipping both ways.",
    guardrails: ["Triggered from your store or OMS through the API, or as a daily batch campaign", "Confirms the order, the delivery address and landmark, and a good delivery time", "Sends confirmed, cancelled and unreachable orders back to your system by webhook"],
    sampleDialogue: [
      { speaker: "AI Agent", text: "Namaste Rahul, main Kesar Naturals ki AI assistant bol rahi hoon. Aapke COD order ko confirm karna tha. Kya delivery confirm kar doon?" },
      { speaker: "Customer", text: "Haan, confirm hai. Gate ke paas wale landmark par chhod dena." },
      { speaker: "AI Agent", text: "Theek hai, landmark note kar liya. Order kal deliver hoga. Dhanyavaad!" }
    ],
    impactMetric: "Confirmed before dispatch"
  },
  {
    id: "tpl-10",
    name: "Billing & Subscription Assistant",
    persona: "Morgan • Billing Assistant",
    category: "Support & Front Desk",
    type: "System Prompt Studio",
    problemSolved: "Support teams spend hours explaining invoice line items, and card details should never be read out on a call.",
    guardrails: ["Never asks for a full card number, CVV or OTP", "Explains invoice items from your billing documents in the knowledge base", "Offers a call-back from the billing team for disputes"],
    sampleDialogue: [
      { speaker: "Morgan (AI)", text: "Billing support, this is Morgan, the AI assistant. How can I help with your invoice?" },
      { speaker: "Customer", text: "Why is last month's bill higher than usual?" },
      { speaker: "Morgan (AI)", text: "Your plan covers 2,000 minutes and your team used 2,420, so the extra 420 minutes were billed at your agreed rate." }
    ],
    impactMetric: "No card details on calls"
  },
  {
    id: "tpl-11",
    name: "After-Hours Incident Line",
    persona: "Alex • After-Hours Support Assistant",
    category: "Support & Front Desk",
    type: "System Prompt Studio",
    problemSolved: "When a client's system goes down at 2 am, they reach voicemail and nobody knows until morning.",
    guardrails: ["Asks whether it is an outage or a general question", "Collects the affected service, the symptoms and a call-back number", "Calls your own alerting tool through a Function so the on-call engineer is notified"],
    sampleDialogue: [
      { speaker: "Alex (AI)", text: "After-hours support, this is Alex, the AI assistant. Is this about an outage that is affecting you right now?" },
      { speaker: "Client", text: "Yes, our checkout page has been down for 10 minutes." },
      { speaker: "Alex (AI)", text: "Understood. I've logged it as urgent and alerted the on-call engineer, who will call you back on this number." }
    ],
    impactMetric: "On-call alerted via Functions"
  },
  {
    id: "tpl-12",
    name: "Event Registration Desk",
    persona: "Sam • Event Assistant",
    category: "Support & Front Desk",
    type: "Visual Flow Canvas",
    problemSolved: "Before a big event, the phones ring all day with the same questions about registration, timings and the venue.",
    guardrails: ["Checks the caller's registration through a Function connected to your system", "Answers timing, venue and parking questions from the event FAQ", "Passes group and VIP requests to your team for a call-back"],
    sampleDialogue: [
      { speaker: "Sam (AI)", text: "Summit registration desk, this is Sam, the AI assistant. Are you calling to register or about an existing pass?" },
      { speaker: "Attendee", text: "What time does tomorrow's keynote start, and where do I park?" },
      { speaker: "Sam (AI)", text: "The keynote starts at 10 am in Hall A. Parking is at Gate 3, free for registered attendees." }
    ],
    impactMetric: "Event FAQs answered"
  },
  {
    id: "tpl-13",
    name: "EMI Due-Date Courtesy Reminder",
    persona: "Courtesy Reminder Assistant",
    category: "BFSI & Fintech",
    type: "System Prompt Studio",
    problemSolved: "Many borrowers miss a due date simply because they forgot, and then face late fees and a credit score hit.",
    guardrails: ["Confirms it is speaking to the borrower before mentioning any amount", "Says clearly that it is a courtesy reminder from the lender, not a collections call", "Never uses pressure, threats or shaming words"],
    sampleDialogue: [
      { speaker: "AI Agent", text: "Good morning. This is an automated courtesy reminder from Apex Lending. Am I speaking with Rahul Sharma?" },
      { speaker: "Borrower", text: "Yes, speaking." },
      { speaker: "AI Agent", text: "Thank you. Your EMI of ₹4,200 is due on 12 October. You can pay through your usual app or bank. Have a good day." }
    ],
    impactMetric: "Identity check first"
  },
  {
    id: "tpl-14",
    name: "Early Overdue Reminder (1–30 DPD)",
    persona: "Empathy-First Reminder Assistant",
    category: "BFSI & Fintech",
    type: "System Prompt Studio",
    problemSolved: "Borrowers a few days late often avoid calls from aggressive recovery agents, and the problem grows.",
    guardrails: ["Verifies the borrower's identity before sharing any account detail", "Keeps a respectful, non-judgemental tone and asks for a payment date", "Offers a call-back from a hardship officer when the borrower reports difficulty"],
    sampleDialogue: [
      { speaker: "AI Agent", text: "Hello, this is an automated call from Apex Lending about the account ending 8192. Am I speaking with Rahul Sharma?" },
      { speaker: "Rahul", text: "Yes, speaking." },
      { speaker: "AI Agent", text: "Thank you, Rahul. Your payment of ₹5,600 is 8 days overdue. Could you share a date when you'll be able to pay?" }
    ],
    impactMetric: "Payment dates recorded"
  },
  {
    id: "tpl-15",
    name: "Late-Stage Recovery Outreach (30+ DPD)",
    persona: "Resolution Assistant",
    category: "BFSI & Fintech",
    type: "Visual Flow Canvas",
    problemSolved: "Late-stage collections carry real risk: sharing account details with the wrong person, or losing track of what was promised.",
    guardrails: ["Ends the call politely without any account detail if the person is not the verified borrower", "Offers a call-back from a restructuring officer for settlement questions", "Records every promise to pay as a structured field for your team"],
    sampleDialogue: [
      { speaker: "AI Agent", text: "This is an automated call from Apex Lending about the loan account ending 4102. Am I speaking with the account holder?" },
      { speaker: "Third Party", text: "No, he is not available right now." },
      { speaker: "AI Agent", text: "I understand. I can only discuss this with the account holder. Thank you for your time." }
    ],
    impactMetric: "Third-party disclosure blocked"
  }
];

export default function Solutions({ setPage }: SolutionsProps) {
  const plans = usePublicPlans();
  const [activeTab, setActiveTab] = useState("ecommerce");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>("All");
  const [selectedTemplate, setSelectedTemplate] = useState<ShowcaseTemplate>(PRODUCTION_TEMPLATES[8]); // Default to COD
  const [inspectorMode, setInspectorMode] = useState<"dialogue" | "schema" | "metrics">("dialogue");

  const filteredTemplates = PRODUCTION_TEMPLATES.filter((tpl) => 
    templateCategoryFilter === "All" ? true : tpl.category === templateCategoryFilter
  );

  // Industry walkthroughs. "integrations" lists how each one connects today (webhooks, API, Functions,
  // Google Calendar); named third-party systems are reached through those, not native connectors.
  const CONNECTS = ["Signed webhooks", "REST API", "Functions (your own API)"];
  const solutions = [
    {
      id: "ecommerce",
      name: "E-Commerce COD & Logistics",
      icon: ShoppingBag,
      tagline: "Confirm Every COD Order Before It Ships",
      metric: "Confirms order, address and delivery time",
      summary: "Cash-on-delivery orders with a wrong address or a buyer who changed their mind come back as RTO, and you pay shipping both ways. The agent calls each COD buyer before dispatch, in Hindi, English or Hinglish, confirms the order and the landmark, and sends the answer back to your store.",
      triggers: ["New COD order sent through the API", "Daily batch campaign from a CSV"],
      integrations: [...CONNECTS, "Your store / OMS via webhook"],
      useCases: ["Order confirmation before dispatch", "Address and landmark check", "Cancellation captured early", "Delivery time preference"],
      transcript: [
        { speaker: "agent", text: "Namaste Rahul, main Kesar Naturals ki AI assistant bol rahi hoon. Aapka ₹2,499 ka COD order confirm karna tha. Kya delivery confirm hai?" },
        { speaker: "customer", text: "Haan, confirm hai. Bandra West mein Blue Dart office ke paas deliver karna." },
        { speaker: "agent", text: "Theek hai, 'Blue Dart office ke paas, Bandra West' note kar liya. Order aaj dispatch hoga. Dhanyavaad!" }
      ],
      techSchema: `// Example: post-call data sent to YOUR webhook (fields are defined per agent
// in Post-Call Data Extraction; payloads are HMAC-signed)
POST https://your-system.example.com/claritiy-webhook
{
  "order_id": "ORD-8941",
  "verification_status": "VERIFIED",
  "landmark_added": "Near Blue Dart office, Bandra West",
  "preferred_delivery_time": "after 6 pm"
}`,
      metricsData: {
        latency: "Real-time",
        successRate: "Confirmed / cancelled / unreachable",
        format: "Recording optional"
      }
    },
    {
      id: "healthcare",
      name: "Healthcare & Dental Intake",
      icon: HeartPulse,
      tagline: "A Receptionist That Answers Every Call",
      metric: "Answers, books and reminds",
      summary: "Clinic receptionists spend the day answering the same questions about timings, fees and preparation. The agent answers every call from your clinic's documents, books appointments on the doctor's Google Calendar, and calls patients the day before as a reminder. It never gives medical advice.",
      triggers: ["Inbound patient call", "Reminder campaign for tomorrow's appointments"],
      integrations: ["Google Calendar", ...CONNECTS],
      useCases: ["Appointment booking and changes", "Timings, fees and preparation questions", "Day-before reminders", "Call-back request for the doctor"],
      transcript: [
        { speaker: "agent", text: "Namaste, Lotus Dental Clinic. I'm Priya, the AI assistant. How can I help you today?" },
        { speaker: "customer", text: "I need to see Dr. Sharma for a root canal check-up on Thursday afternoon." },
        { speaker: "agent", text: "Dr. Sharma is free at 2:30 pm and 4:15 pm on Thursday. Which time suits you?" }
      ],
      techSchema: `// Example: post-call data sent to YOUR webhook (fields are defined per agent
// in Post-Call Data Extraction; payloads are HMAC-signed)
POST https://your-system.example.com/claritiy-webhook
{
  "appointment_status": "booked",
  "patient_name": "Rahul",
  "doctor": "Dr. Sharma",
  "start": "2026-08-27T14:30:00+05:30"
}`,
      metricsData: {
        latency: "Real-time",
        successRate: "Booked / call-back / question answered",
        format: "PII redaction option"
      }
    },
    {
      id: "finance",
      name: "Financial Services & EMI Reminders",
      icon: Landmark,
      tagline: "Polite EMI Reminders With Identity Checks",
      metric: "Identity check before any amount",
      summary: "Most missed EMIs are simply forgotten. The agent confirms it is speaking to the borrower, reminds them of the amount and due date, asks when they will pay and records the answer. It stays polite, never threatens, and offers a call-back from your team for anything difficult.",
      triggers: ["3-day pre-due reminder campaign", "Early overdue list (1–30 DPD)"],
      integrations: [...CONNECTS, "Your loan system via webhook"],
      useCases: ["Pre-due EMI reminders", "Payment date (promise to pay) capture", "KYC document follow-up", "Hardship call-back requests"],
      transcript: [
        { speaker: "agent", text: "Good morning. This is an automated reminder from Apex Lending. Am I speaking with Ananya?" },
        { speaker: "customer", text: "Yes, this is Ananya." },
        { speaker: "agent", text: "Thank you. Your EMI of ₹4,200 is due tomorrow. Will you be able to pay it on time?" }
      ],
      techSchema: `// Example: post-call data sent to YOUR webhook (fields are defined per agent
// in Post-Call Data Extraction; payloads are HMAC-signed)
POST https://your-system.example.com/claritiy-webhook
{
  "loan_account_id": "LN-481920",
  "identity_confirmed": true,
  "promised_payment_date": "2026-10-12",
  "call_disposition": "PROMISE_TO_PAY"
}`,
      metricsData: {
        latency: "Real-time",
        successRate: "Promise to pay / call-back / unreachable",
        format: "Opt-out list honoured"
      }
    },
    {
      id: "realestate",
      name: "Real Estate & Lead Qualification",
      icon: HomeIcon,
      tagline: "Call Every Property Enquiry the Same Day",
      metric: "Qualifies and books site visits",
      summary: "Property enquiries go cold when nobody calls back quickly. Send each new enquiry to the agent through the API; it asks about budget, location and timeline, books a site visit on your calendar, and sends the answers to your CRM.",
      triggers: ["Web enquiry sent through the API", "Listing enquiry campaign"],
      integrations: ["Google Calendar", ...CONNECTS],
      useCases: ["Budget, location and timeline questions", "Site visit booking", "Home-loan status check", "Follow-up flag for your sales team"],
      transcript: [
        { speaker: "agent", text: "Hi Vikram, this is the AI assistant from Green Acres. Thanks for your enquiry about our 3BHK homes. Are you planning to buy in the next three months?" },
        { speaker: "customer", text: "Yes, a 3BHK around Whitefield under 1.5 crore." },
        { speaker: "agent", text: "That fits two of our units. Shall I book a site visit with our manager for Saturday morning?" }
      ],
      techSchema: `// Example: post-call data sent to YOUR webhook (fields are defined per agent
// in Post-Call Data Extraction; payloads are HMAC-signed)
POST https://your-system.example.com/claritiy-webhook
{
  "lead_id": "ld_8841",
  "budget": "1.5_CR",
  "preferred_area": "Whitefield",
  "site_visit_timestamp": "2026-08-23T10:30:00+05:30",
  "status": "QUALIFIED"
}`,
      metricsData: {
        latency: "Real-time",
        successRate: "Qualified / not now / visit booked",
        format: "Recording optional"
      }
    },
    {
      id: "logistics",
      name: "Logistics & Delivery",
      icon: Truck,
      tagline: "Delivery Calls Before the Driver Arrives",
      metric: "Fewer failed delivery attempts",
      summary: "Failed deliveries and 'where is my order' calls cost money on both sides. The agent calls the recipient before the attempt, confirms someone will be home or takes drop-off instructions, and sends them to your system for the driver.",
      triggers: ["Out-for-delivery event sent through the API", "Address-unclear flag"],
      integrations: [...CONNECTS, "Your TMS / WMS via webhook"],
      useCases: ["Availability check before delivery", "Drop-off instructions", "Failed delivery rescheduling", "Return pickup confirmation"],
      transcript: [
        { speaker: "agent", text: "Hi Priya, this is an AI assistant calling about your parcel, which is out for delivery to Sector 62 today. Will someone be home to receive it?" },
        { speaker: "customer", text: "I'm out. Please leave it with the security guard at Gate 1." },
        { speaker: "agent", text: "Understood. I've noted 'leave with security at Gate 1' for the delivery partner." }
      ],
      techSchema: `// Example: post-call data sent to YOUR webhook (fields are defined per agent
// in Post-Call Data Extraction; payloads are HMAC-signed)
POST https://your-system.example.com/claritiy-webhook
{
  "waybill": "WB-9012481",
  "driver_instruction": "Leave package with Gate 1 Security",
  "recipient_confirmed": true
}`,
      metricsData: {
        latency: "Real-time",
        successRate: "Available / instructions / reschedule",
        format: "Recording optional"
      }
    },
    {
      id: "insurance",
      name: "Insurance Renewals & Claims Intake",
      icon: ShieldCheck,
      tagline: "Renewal Reminders and First Claim Details",
      metric: "Renewal reminders and claim intake",
      summary: "Policies lapse because renewal reminders get missed, and claim callers need a calm first conversation. The agent reminds policyholders before expiry, answers coverage questions from your documents, and collects the first details of a claim for your team.",
      triggers: ["Renewal campaign before expiry", "Inbound claim call"],
      integrations: [...CONNECTS, "Your policy system via webhook"],
      useCases: ["Renewal reminders", "First notice of loss details", "Coverage questions from your policy FAQ", "Call-back for claim handlers"],
      transcript: [
        { speaker: "agent", text: "Hello Rohan, this is the AI assistant from Shield Insurance. Your motor policy expires in 5 days. Would you like to renew it?" },
        { speaker: "customer", text: "Yes. Is my No Claim Bonus applied?" },
        { speaker: "agent", text: "Yes, your 20% No Claim Bonus is applied. Our team will send the renewal link to your registered email today." }
      ],
      techSchema: `// Example: post-call data sent to YOUR webhook (fields are defined per agent
// in Post-Call Data Extraction; payloads are HMAC-signed)
POST https://your-system.example.com/claritiy-webhook
{
  "policy_number": "POL-992140",
  "renewal_intent": "YES",
  "ncb_confirmed": true,
  "status": "SEND_RENEWAL_LINK"
}`,
      metricsData: {
        latency: "Real-time",
        successRate: "Renew / not now / call-back",
        format: "Recording & retention you set"
      }
    },
    {
      id: "education",
      name: "Education & Admissions",
      icon: GraduationCap,
      tagline: "Call Every Applicant Back Quickly",
      metric: "Answers course questions, books counsellors",
      summary: "Applicants who wait days for a call often join another institute. The agent calls them back, answers course and fee questions from your prospectus, and books a call with a counsellor on your calendar.",
      triggers: ["Application or enquiry sent through the API", "Admissions campaign"],
      integrations: ["Google Calendar", ...CONNECTS],
      useCases: ["Course and fee questions", "Counsellor call booking", "Document reminders", "Batch start reminders"],
      transcript: [
        { speaker: "agent", text: "Hi Sneha, this is the AI assistant from Horizon Institute about your data science application. Do you have any questions about the course?" },
        { speaker: "customer", text: "Are the weekend lab sessions compulsory?" },
        { speaker: "agent", text: "They are recorded and optional for working professionals. Would you like a 10-minute call with a counsellor?" }
      ],
      techSchema: `// Example: post-call data sent to YOUR webhook (fields are defined per agent
// in Post-Call Data Extraction; payloads are HMAC-signed)
POST https://your-system.example.com/claritiy-webhook
{
  "applicant_id": "app_5541",
  "course": "Data Science",
  "counselor_slot_booked": "2026-08-25T11:00:00+05:30"
}`,
      metricsData: {
        latency: "Real-time",
        successRate: "Interested / booked / not now",
        format: "Recording optional"
      }
    },
    {
      id: "automotive",
      name: "Automotive & Service Centres",
      icon: Car,
      tagline: "Service Reminders and Test Drive Bookings",
      metric: "Reminds and books service slots",
      summary: "Service centres lose bookings when the phone is busy. The agent calls customers when a service is due, books a slot, confirms test drives and answers common questions from your documents.",
      triggers: ["Service-due list as a campaign", "Test drive enquiry sent through the API"],
      integrations: ["Google Calendar", ...CONNECTS],
      useCases: ["Periodic service reminders", "Test drive confirmation", "Pickup-ready calls", "Common service questions"],
      transcript: [
        { speaker: "agent", text: "Hello Amit, this is the AI assistant from Prime Motors. Your SUV is due for its 20,000 km service. Shall I book Saturday at 9 am?" },
        { speaker: "customer", text: "Saturday 9 am works." },
        { speaker: "agent", text: "Booked for Saturday at 9 am. See you then!" }
      ],
      techSchema: `// Example: post-call data sent to YOUR webhook (fields are defined per agent
// in Post-Call Data Extraction; payloads are HMAC-signed)
POST https://your-system.example.com/claritiy-webhook
{
  "vehicle_reg": "MH12AB1234",
  "service_type": "20K_PERIODIC",
  "slot": "2026-08-29T09:00:00+05:30"
}`,
      metricsData: {
        latency: "Real-time",
        successRate: "Booked / call-back / not now",
        format: "Recording optional"
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
          Missed calls, COD returns and slow lead follow-up all cost money. Explore 15 example templates for Indian businesses, each with the rules it gives the agent, a sample conversation and the data it sends to your systems.
        </motion.p>

        {/* Operational Highlights Pill Grid */}
        <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-4 text-center">
            <span className="text-2xl font-bold text-[#121212] font-mono block">30</span>
            <span className="text-xs text-[#262523] font-mono">AI Voices</span>
          </div>
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-4 text-center">
            <span className="text-2xl font-bold text-[#121212] font-mono block">Real-time</span>
            <span className="text-xs text-[#262523] font-mono">Replies</span>
          </div>
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-4 text-center">
            <span className="text-2xl font-bold text-[#121212] font-mono block">7</span>
            <span className="text-xs text-[#262523] font-mono">Indian Languages</span>
          </div>
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-4 text-center">
            <span className="text-2xl font-bold text-[#121212] font-mono block">15</span>
            <span className="text-xs text-[#262523] font-mono">Template Examples</span>
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
                RULES THE TEMPLATE GIVES THE AGENT:
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
                  REAL-TIME VOICE
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
              <span>WHAT IT DOES: {currentSolution.metric}</span>
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
                <span className="text-[#262523] block mb-1">CONNECTS THROUGH:</span>
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
                  Post-call webhook delivered over HTTPS with an HMAC signature you can verify.
                </p>
              </div>
            )}

            {/* Sub-Tab 3: Telemetry & Latency */}
            {inspectorMode === "metrics" && (
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-[#EBE9E2] p-3.5 rounded-[2px] border border-[#CBC8BE] space-y-1">
                  <span className="text-[10px] text-[#262523] uppercase block">REPLIES</span>
                  <span className="text-[#121212] font-bold text-sm block">{currentSolution.metricsData.latency}</span>
                  <span className="text-[10px] text-[#262523] block">One speech-to-speech model</span>
                </div>
                <div className="bg-[#EBE9E2] p-3.5 rounded-[2px] border border-[#CBC8BE] space-y-1">
                  <span className="text-[10px] text-[#262523] uppercase block">CALLS AT ONCE</span>
                  <span className="text-[#121212] font-bold text-sm block">{concurrencyText(plans)}</span>
                  <span className="text-[10px] text-[#262523] block">Same limit on every plan today</span>
                </div>
                <div className="bg-[#EBE9E2] p-3.5 rounded-[2px] border border-[#CBC8BE] space-y-1">
                  <span className="text-[10px] text-[#262523] uppercase block">OUTCOME LABELS</span>
                  <span className="text-[#121212] font-bold text-sm block">{currentSolution.metricsData.successRate}</span>
                  <span className="text-[10px] text-[#262523] block">One label per call in Call Reports</span>
                </div>
                <div className="bg-[#EBE9E2] p-3.5 rounded-[2px] border border-[#CBC8BE] space-y-1">
                  <span className="text-[10px] text-[#262523] uppercase block">PRIVACY</span>
                  <span className="text-[#121212] font-bold text-sm block">{currentSolution.metricsData.format}</span>
                  <span className="text-[10px] text-[#262523] block">Set per agent</span>
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
            Pick a template, adjust it in plain words, connect your +91 number and go live, without an engineering team.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button
              onClick={() => setPage("dashboard")}
              className="py-3 px-8 text-xs font-mono uppercase tracking-wider bg-[#121212] hover:bg-black text-white font-medium rounded-[2px] inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              Create a Free Account <ArrowRight className="w-4 h-4" />
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

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2, Landmark, ShoppingBag, Home as HomeIcon, ShieldCheck,
  Truck, Headphones, Code, ArrowRight, CheckCircle2, Play, Pause,
  Terminal, Code2, Sparkles, Layers, Activity, Volume2, Copy, Check,
  Workflow, GitBranch, Cpu, Database, MessageSquare, ChevronRight,
  ExternalLink, Zap, Clock, Shield, Sliders, RefreshCw
} from "lucide-react";

type Page = any;

interface UseCasesProps {
  setPage: (p: Page) => void;
  initialIndustryId?: string | null;
}

interface WiremapNode {
  id: string;
  stage: string;
  label: string;
  desc: string;
  latency: string;
  protocol: string;
  accent: string;
}

interface SubTopic {
  id: string;
  title: string;
  badge: string;
  problem: string;
  solution: string;
  metrics: string;
  templateId: string;
  templateName: string;
  templateCategory: string;
  dialogue: { speaker: string; text: string; time: string }[];
}

interface IndustryTopic {
  id: string;
  label: string;
  icon: any;
  visual: string;
  badge: string;
  accent: string;
  bgLight: string;
  headline: string;
  subhead: string;
  heroStat: { value: string; label: string };
  stats: { value: string; label: string }[];
  wiremap: WiremapNode[];
  subTopics: SubTopic[];
  jsonPayload: string;
}

const USE_CASE_TOPICS: IndustryTopic[] = [
  // ── 1. Healthcare & Clinical Practice ────────────────────────────────────
  {
    id: "healthcare",
    label: "Healthcare & Clinics",
    icon: Building2,
    visual: "🏥",
    badge: "DPDP & HIPAA Aligned",
    accent: "#059669",
    bgLight: "#D1FAE5",
    headline: "Autonomous Clinical Reception, Triage & Post-Op Recovery Telephony",
    subhead: "Replace overburdened clinic phone lines with zero-queue voice agents that converse naturally in regional Indian dialects, coordinate doctor calendars, and flag clinical symptoms.",
    heroStat: { value: "85%", label: "Hold Time Deflection" },
    stats: [
      { value: "0s", label: "Patient Queue Wait Time" },
      { value: "99.2%", label: "Appointment Slot Accuracy" },
      { value: "100%", label: "Zero-Retention PII Masking" }
    ],
    wiremap: [
      { id: "h1", stage: "STAGE 1", label: "EHR / Portal Trigger", desc: "Appointment request or inbound clinic call lands on telephony gateway.", latency: "12ms", protocol: "REST Webhook / SIP Trunk", accent: "#059669" },
      { id: "h2", stage: "STAGE 2", label: "16kHz Audio Codec Egress", desc: "Raw uncompressed PCM audio streaming with -42dB full-duplex VAD.", latency: "18ms", protocol: "WebRTC / SRTP Protocol", accent: "#10B981" },
      { id: "h3", stage: "STAGE 3", label: "Edge DPDP / HIPAA Sanitizer", desc: "Aadhaar, contact, and diagnostic details masked before audio ingestion.", latency: "15ms", protocol: "Zero-Retention DLP Filter", accent: "#34D399" },
      { id: "h4", stage: "STAGE 4", label: "Clinical Conversational Core", desc: "Contextual speech agent converses with doctor calendar constraints.", latency: "185ms", protocol: "Claritiy Multimodal Voice", accent: "#059669" },
      { id: "h5", stage: "STAGE 5", label: "EHR Slot Mutation & WhatsApp", desc: "Locks slot in Practo/EHR database and dispatches clinic prep guidelines.", latency: "75ms", protocol: "Authenticated JSON Relay", accent: "#10B981" }
    ],
    subTopics: [
      {
        id: "outpatient-intake",
        title: "Sub-Topic 01: Outpatient Intake & Automated Doctor Scheduling",
        badge: "Inbound & Outbound",
        problem: "Peak morning call volume causes a 45% abandonment rate, leaving costly doctor consult slots unbooked.",
        solution: "Voice agent handles hundreds of concurrent patient calls in Hindi/English, checks real-time doctor availability, and secures appointment slots in real time.",
        metrics: "85% reduction in hold time • 99.2% booking accuracy",
        templateId: "tpl-1",
        templateName: "Front Desk Receptionist & Clinic Scheduler",
        templateCategory: "Receptionist",
        dialogue: [
          { speaker: "Claritiy AI", text: "Namaste Mr. Verma! I am calling from Apollo Clinic regarding your ultrasound consultation tomorrow at 10:30 AM with Dr. Rao. Are you able to attend?", time: "00:03" },
          { speaker: "Patient", text: "Yes, I will be there. Do I need to fast before the test?", time: "00:09" },
          { speaker: "Claritiy AI", text: "Yes, Dr. Rao requires a 4-hour fast beforehand, and please drink 500ml of water 30 minutes before arriving. I have sent the clinic address and instructions to your WhatsApp.", time: "00:19" },
          { speaker: "Patient", text: "Thank you so much, that is very helpful.", time: "00:23" },
          { speaker: "Claritiy AI", text: "You are most welcome. We look forward to seeing you tomorrow at 10:30 AM. Have a wonderful day!", time: "00:28" }
        ]
      },
      {
        id: "pre-op-reminders",
        title: "Sub-Topic 02: Pre-Operative Fasting & Diagnostic Protocol Verification",
        badge: "Surgical Prep",
        problem: "15% of surgical procedures are delayed or cancelled due to patients arriving without proper fasting, costing hospitals ₹1.5L per stalled operating theater.",
        solution: "Voice agent calls patients 24 hours prior, confirms fasting adherence, explains medication hold instructions, and logs confirmations directly into the surgical roster.",
        metrics: "94% procedure adherence • 0 manual staff calls",
        templateId: "tpl-2",
        templateName: "Pre-Op Fasting & Diagnostic Protocol",
        templateCategory: "Appointment Booking",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Priya, calling from Fortis Surgical Desk regarding your laparoscopic procedure tomorrow morning at 8:00 AM. May I verify your pre-op fasting protocol?", time: "00:04" },
          { speaker: "Patient", text: "Yes, please confirm when I should stop drinking water.", time: "00:09" },
          { speaker: "Claritiy AI", text: "You must stop all solid food by 10:00 PM tonight. Clear water is allowed until 4:00 AM tomorrow morning. Please leave all jewelry and valuables at home. Did you have any questions about medications?", time: "00:21" },
          { speaker: "Patient", text: "No, Dr. Kapoor explained that. I am all set.", time: "00:26" },
          { speaker: "Claritiy AI", text: "Wonderful. Your surgical admission pass has been sent via SMS. See you tomorrow at 7:00 AM at Desk 4.", time: "00:32" }
        ]
      },
      {
        id: "post-discharge-triage",
        title: "Sub-Topic 03: Post-Discharge Recovery & Symptom Check",
        badge: "Clinical Triage",
        problem: "Readmissions surge when patients don't report fever, wound redness, or medication side effects until severe complications develop.",
        solution: "Checks recovery milestones on Day 2 and Day 5, evaluates pain score, and instantly escalates red flags to the on-call surgical registrar via warm SIP transfer.",
        metrics: "3.2× faster clinical escalations • 96% patient CSAT",
        templateId: "tpl-3",
        templateName: "Post-Discharge Triage & Recovery Check",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Mr. Sen, this is Claritiy Clinical Desk checking in on your recovery 48 hours post-discharge. How is your surgical incision feeling today?", time: "00:04" },
          { speaker: "Patient", text: "The incision feels a little warm and I have a slight fever of 100.4 degrees.", time: "00:11" },
          { speaker: "Claritiy AI", text: "Thank you for noting that. Because you have a fever above 100 degrees with localized warmth, I am initiating a priority transfer to Sister Mary on our on-call clinical team right now. Please hold for 5 seconds.", time: "00:24" }
        ]
      },
      {
        id: "insurance-tpa-desk",
        title: "Sub-Topic 04: Insurance TPA & Cashless Pre-Authorization",
        badge: "Cashless Desk",
        problem: "Patients and families wait 3+ hours at hospital billing counters during discharge waiting for insurance TPA pre-authorization status updates.",
        solution: "Autonomous voice agent authenticates policy number, queries claim sanction status with the TPA desk, and delivers instantaneous resolution with zero queue delay.",
        metrics: "60% less discharge wait time • Instant TPA transparency",
        templateId: "tpl-13",
        templateName: "First Notice of Loss & Policy Intake",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello! Calling from Manipal TPA Desk for patient Rahul Joshi. Your preliminary cashless pre-authorization of ₹85,000 has been sanctioned by Star Health.", time: "00:05" },
          { speaker: "Patient", text: "Does that cover the private room rent as well?", time: "00:10" },
          { speaker: "Claritiy AI", text: "Yes, your policy includes Single Private Room capping up to ₹7,000 per day without co-pay deductions. You can proceed directly to Billing Counter 2 for final discharge signing.", time: "00:22" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "clinic.appointment_scheduled",
  "patientId": "pt_ap_9821",
  "patientPhone": "+919876543210",
  "doctor": "Dr. S. Rao, MD",
  "specialty": "Radiology & Ultrasound",
  "appointmentSlot": "2026-10-11T10:30:00+05:30",
  "fastingInstructionsAcknowledged": true,
  "disposition": "CONFIRMED_PREP_SENT",
  "whatsappSummaryDispatched": true
}`
  },

  // ── 2. Finance & Banking ──────────────────────────────────────────────────
  {
    id: "finance",
    label: "Finance & Banking",
    icon: Landmark,
    visual: "🏦",
    badge: "RBI Fair Practices Aligned",
    accent: "#E8630A",
    bgLight: "#FEF3C7",
    headline: "Ethical Debt Recovery, KYC Verification & Fraud Response",
    subhead: "Replace aggressive third-party collection agencies with compliant, empathetic voice agents operating strictly within RBI Fair Practice Code guidelines.",
    heroStat: { value: "42%", label: "Digital EMI Recovery Lift" },
    stats: [
      { value: "100%", label: "RBI Fair Practice Code Compliance" },
      { value: "3s", label: "Speed-to-Contact Fraud Alerts" },
      { value: "₹6.50", label: "Cost Per Qualified Lead" }
    ],
    wiremap: [
      { id: "f1", stage: "STAGE 1", label: "Core Banking / LMS Export", desc: "Tranche of upcoming due loans received via secure banking API.", latency: "10ms", protocol: "Finacle / Mambu REST", accent: "#E8630A" },
      { id: "f2", stage: "STAGE 2", label: "RBI Regulatory Guardrail", desc: "Enforces 8 AM – 7 PM calling window and DNC number validation.", latency: "14ms", protocol: "Policy Rule Engine", accent: "#F59E0B" },
      { id: "f3", stage: "STAGE 3", label: "Ethical NLU Voice Agent", desc: "Speaks regional language, understands borrower hardship, and negotiates dates.", latency: "185ms", protocol: "Claritiy Voice Core", accent: "#E8630A" },
      { id: "f4", stage: "STAGE 4", label: "UPI Dynamic Deep-link", desc: "Generates personalized UPI QR and payment link via SMS/WhatsApp.", latency: "85ms", protocol: "Razorpay / Cashfree API", accent: "#F59E0B" },
      { id: "f5", stage: "STAGE 5", label: "Core Ledger Reconciliation", desc: "Reconciles promissory note or settlement status in core loan ledger.", latency: "30ms", protocol: "Real-time Banking Hook", accent: "#E8630A" }
    ],
    subTopics: [
      {
        id: "ethical-emi",
        title: "Sub-Topic 01: Ethical Soft EMI Due Reminders",
        badge: "Pre-Due & Due Date",
        problem: "Aggressive third-party collection agencies damage banking brand reputation and frequently trigger RBI regulatory scrutiny.",
        solution: "Polite, empathetic AI voice calls 3 days prior to due date, explains exact installment breakdown, and sends instant UPI payment links.",
        metrics: "42% lift in digital EMI collection • 100% RBI compliance",
        templateId: "tpl-7",
        templateName: "Ethical Pre-Due EMI Reminder",
        templateCategory: "BFSI Collections & Reminders",
        dialogue: [
          { speaker: "Claritiy AI", text: "Namaste Ms. Kapoor, calling from Apex Finance regarding your personal loan EMI of ₹14,200 due on October 15th. Would you like me to send a secure UPI link?", time: "00:03" },
          { speaker: "Borrower", text: "Can I pay by tomorrow evening instead? My salary gets credited tomorrow.", time: "00:10" },
          { speaker: "Claritiy AI", text: "Certainly, Ms. Kapoor. I have scheduled your payment reminder for tomorrow at 5:00 PM and sent the direct payment link via WhatsApp. No late fees will apply if completed then.", time: "00:20" },
          { speaker: "Borrower", text: "Okay, perfect. I will pay via UPI tomorrow.", time: "00:25" },
          { speaker: "Claritiy AI", text: "Thank you for banking with Apex Finance. Have a wonderful day ahead!", time: "00:29" }
        ]
      },
      {
        id: "kyc-document-clarification",
        title: "Sub-Topic 02: KYC Document Clarification & Video KYC Scheduling",
        badge: "Loan Onboarding",
        problem: "Loan application drop-off exceeds 50% when KYC documents have blurred signatures, cropped IDs, or mismatched names.",
        solution: "Voice agent dials applicant within 3 minutes of rejection, explains exact missing document, and sends re-upload portal link directly to their phone.",
        metrics: "3.5× faster loan disbursal • 68% drop-off recovered",
        templateId: "tpl-9",
        templateName: "High-Ticket Loan Prequalification",
        templateCategory: "Lead Qualification",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Ankit! Calling from FinGrow Capital regarding your business loan application. Your Aadhaar card upload was flagged because the QR code was cropped.", time: "00:04" },
          { speaker: "Applicant", text: "Oh, I see. Do I need to redo the entire form?", time: "00:08" },
          { speaker: "Claritiy AI", text: "Not at all! I have just texted you a direct one-click link to re-upload only the front and back of your Aadhaar card. Once uploaded, your loan approval will resume automatically.", time: "00:19" }
        ]
      },
      {
        id: "fraud-alert-verification",
        title: "Sub-Topic 03: Suspicious Debit & High-Ticket Fraud Alert",
        badge: "Security Response",
        problem: "SMS fraud alerts are overlooked by 70% of senior citizens, resulting in unrecoverable financial losses.",
        solution: "Sub-3-second voice call asks customer to verify high-ticket debit with a single voice confirmation or block card instantly.",
        metrics: "Sub-3-second contact rate • 98% fraud containment",
        templateId: "tpl-1",
        templateName: "Front Desk & Security Verification",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Urgent Security Alert from Indus Bank. A debit of ₹48,500 was just attempted at Electronic Merchant Dubai. Did you authorize this transaction?", time: "00:04" },
          { speaker: "Account Holder", text: "No! I did not do that! I am in Mumbai right now!", time: "00:08" },
          { speaker: "Claritiy AI", text: "I have immediately blocked your debit card ending in 4012 and declined the charge. A replacement card has been dispatched to your home address.", time: "00:18" }
        ]
      },
      {
        id: "pre-approved-line-qualification",
        title: "Sub-Topic 04: Pre-Approved Credit Line Prequalification",
        badge: "Credit Outreach",
        problem: "Human telemarketers spend 8 hours daily dialing cold numbers with only 2% conversion and high burn-out.",
        solution: "AI qualifies interest, explains interest rates and tenure, and transfers hot leads directly to banking officers.",
        metrics: "₹6.50 cost per qualified lead • Zero spam tactics",
        templateId: "tpl-8",
        templateName: "Overdue Debt Restructuring & Soft Recovery",
        templateCategory: "Outbound Sales & Reactivation",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Mr. Joshi, calling from Axis Credit. Based on your clean banking history, your pre-approved credit line of ₹5 Lakhs is active at 10.5% interest. Are you currently planning any home or business expansions?", time: "00:06" },
          { speaker: "Customer", text: "I was actually looking to renovate our shop next month.", time: "00:11" },
          { speaker: "Claritiy AI", text: "That is great timing. Your funds can be disbursed in 2 hours with zero paperwork. Let me connect you directly to our Senior Credit Officer Priya.", time: "00:22" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "emi.promissory_recorded",
  "loanId": "LN-2026-8812",
  "borrowerPhone": "+919811223344",
  "emiAmount": 14200,
  "originalDueDate": "2026-10-15",
  "committedPaymentDate": "2026-10-16T17:00:00+05:30",
  "disposition": "PROMISE_TO_PAY",
  "upiLinkDispatched": true
}`
  },

  // ── 3. E-Commerce & Retail ────────────────────────────────────────────────
  {
    id: "ecommerce",
    label: "E-Commerce & Retail",
    icon: ShoppingBag,
    visual: "🛒",
    badge: "RTO Defense Engine",
    accent: "#059669",
    bgLight: "#D1FAE5",
    headline: "Cash-on-Delivery (COD) Defense & 30-Second Verification",
    subhead: "Cut return-to-origin rates by 40% with pre-dispatch COD verification, address landmark correction, and instant prepaid upgrade incentives.",
    heroStat: { value: "40%", label: "RTO Rate Reduction" },
    stats: [
      { value: "30s", label: "Speed-to-Call Post Checkout" },
      { value: "94%", label: "Buyer Contact Rate" },
      { value: "18%", label: "Prepaid Conversion Rate" }
    ],
    wiremap: [
      { id: "e1", stage: "STAGE 1", label: "Shopify / WooCommerce Hook", desc: "Webhook fires upon new Cash-On-Delivery checkout completion.", latency: "8ms", protocol: "REST Webhook", accent: "#059669" },
      { id: "e2", stage: "STAGE 2", label: "30s Speed-to-Call Queue", desc: "Enqueues outbound telephony before buyer leaves order page.", latency: "14ms", protocol: "Redis BullMQ Queue", accent: "#10B981" },
      { id: "e3", stage: "STAGE 3", label: "Colloquial Hinglish Caller", desc: "Verifies address, confirms buyer intent, and captures missing landmarks.", latency: "195ms", protocol: "Claritiy Neural Voice", accent: "#34D399" },
      { id: "e4", stage: "STAGE 4", label: "Delhivery / Shiprocket Sync", desc: "Updates order tags as Confirmed, attaches delivery note, or cancels fake orders.", latency: "110ms", protocol: "Carrier Aggregator API", accent: "#059669" },
      { id: "e5", stage: "STAGE 5", label: "Prepaid Discount Incentive", desc: "Offers instant ₹50-₹100 discount to convert COD to instant UPI payment.", latency: "30ms", protocol: "Dynamic UPI Payment Link", accent: "#10B981" }
    ],
    subTopics: [
      {
        id: "cod-order-verification",
        title: "Sub-Topic 01: Cash-on-Delivery (COD) Order Verification",
        badge: "RTO Defense",
        problem: "Return-to-Origin (RTO) rates hover at 35-40% for Indian D2C brands, bleeding shipping costs and locking inventory.",
        solution: "Voice agent calls within 60 seconds of checkout, verifies intent, and flags fake/unresponsive numbers before dispatch.",
        metrics: "40% reduction in RTO • ₹45 per order saved on shipping",
        templateId: "tpl-4",
        templateName: "Cash-on-Delivery (COD) Order Verification",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Namaste Rohan ji! Claritiy Retail calling to confirm your Cash on Delivery order for Puma sneakers. Should we ship it to Flat 402, Green Glen Layout?", time: "00:03" },
          { speaker: "Customer", text: "Yes, Flat 402, but please tell the courier to come after 4 PM.", time: "00:09" },
          { speaker: "Claritiy AI", text: "Noted! Added evening delivery instruction after 4 PM with landmark near Gate 1. If you pay right now via UPI, you can get ₹50 cashback. Shall I text the link?", time: "00:20" },
          { speaker: "Customer", text: "Sure, text me the link, I will pay via Google Pay now.", time: "00:26" },
          { speaker: "Claritiy AI", text: "Done! Link sent. Your order is confirmed and shipping today. Thank you for shopping with us!", time: "00:31" }
        ]
      },
      {
        id: "rto-address-clarification",
        title: "Sub-Topic 02: Pincode & Landmark Address Correction",
        badge: "First-Attempt Delivery",
        problem: "Couriers fail delivery when address lacks colony gates, opposite landmarks, or building names.",
        solution: "Conversational AI prompts buyer for nearby landmarks and automatically appends them to shipping label.",
        metrics: "94% first-attempt delivery • 0 courier confusion",
        templateId: "tpl-5",
        templateName: "RTO Address Clarification & Landmark Capture",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Sneha, calling from Snitch regarding your order #SN-9912. Your delivery address mentions 'Near Main Road'. Could you provide a prominent building or shop landmark?", time: "00:05" },
          { speaker: "Buyer", text: "Yes, it is opposite the HDFC Bank ATM, blue gate.", time: "00:10" },
          { speaker: "Claritiy AI", text: "Perfect! I have updated your shipping label with 'Opposite HDFC Bank ATM, Blue Gate'. Your package will arrive tomorrow by 2 PM.", time: "00:20" }
        ]
      },
      {
        id: "prepaid-upgrade-incentive",
        title: "Sub-Topic 03: Instant Prepaid Conversion Incentive",
        badge: "Working Capital Lift",
        problem: "COD lockups delay merchant payouts by 10-15 days through courier remittance cycles.",
        solution: "Offers buyer an exclusive instant discount if they settle immediately via UPI payment link on call.",
        metrics: "18% of COD orders converted to prepaid • Zero risk",
        templateId: "tpl-6",
        templateName: "Cart Abandonment & Prepaid Upgrade Agent",
        templateCategory: "Outbound Sales & Reactivation",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hi Kunal! We have reserved your Noise Smartwatch COD order. If you switch to prepaid via UPI right now, our brand applies an instant ₹100 discount coupon.", time: "00:06" },
          { speaker: "Buyer", text: "Oh, so total becomes ₹1,899 instead of ₹1,999?", time: "00:10" },
          { speaker: "Claritiy AI", text: "Exactly! I have sent the discounted Razorpay UPI link to your WhatsApp. You can pay via PhonePe, Paytm, or GPay right now.", time: "00:20" }
        ]
      },
      {
        id: "delivery-rescheduling",
        title: "Sub-Topic 04: Out-for-Delivery Rescheduling & Safe Drop",
        badge: "Last-Mile Coordination",
        problem: "Buyers away from home result in non-delivery reports (NDR) and return shipments.",
        solution: "Calls before dispatch to confirm presence or re-schedule to a neighbor/security guard drop.",
        metrics: "65% failed deliveries rescued on same day",
        templateId: "tpl-14",
        templateName: "Pre-Delivery Consignee Presence Check",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Ananya, calling from Bluedart regarding your package arriving in 30 minutes. Are you available at Flat 301 to receive it?", time: "00:04" },
          { speaker: "Receiver", text: "I am at office right now. Can you ask the delivery person to leave it with the security guard at Tower B?", time: "00:11" },
          { speaker: "Claritiy AI", text: "Certainly. I have updated the driver's delivery note to leave the package with Tower B Security. We will text you a photo of the parcel upon drop-off.", time: "00:22" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "order.cod_verified",
  "orderId": "ORD-PUMA-991",
  "customerName": "Rohan Patel",
  "phoneNumber": "+919876543210",
  "deliveryPreference": "AFTER_1600_HRS",
  "additionalLandmark": "Gate 1, Green Glen Layout",
  "prepaidConversion": "LINK_SENT",
  "rtoRiskScore": 0.08
}`
  },

  // ── 4. Real Estate & Property ─────────────────────────────────────────────
  {
    id: "realestate",
    label: "Real Estate & Property",
    icon: HomeIcon,
    visual: "🏢",
    badge: "Speed-to-Lead Engine",
    accent: "#E8630A",
    bgLight: "#FEF3C7",
    headline: "Sub-3-Second Lead Contact, Intent Scoring & Tour Booking",
    subhead: "Qualify high-ticket buyers while interest is at its peak. Score budget, timeline, and configuration before routing to senior brokers.",
    heroStat: { value: "3s", label: "Speed to Lead" },
    stats: [
      { value: "3×", label: "Pipeline Velocity" },
      { value: "₹6.98", label: "Cost Per Qualified Lead" },
      { value: "78%", label: "Site Visit Attendance" }
    ],
    wiremap: [
      { id: "r1", stage: "STAGE 1", label: "Meta / Google Lead Hook", desc: "Lead form submission lands on marketing ingestion webhook.", latency: "6ms", protocol: "Graph API / Webhook", accent: "#E8630A" },
      { id: "r2", stage: "STAGE 2", label: "Sub-3s Telephony Dial", desc: "Outbound agent dials lead while intent is maximum.", latency: "12ms", protocol: "Claritiy Telephony Relay", accent: "#F59E0B" },
      { id: "r3", stage: "STAGE 3", label: "High-Ticket SDR Persona", desc: "Qualifies 2BHK/3BHK configuration, budget floor, and timeline.", latency: "180ms", protocol: "Multimodal Agent", accent: "#E8630A" },
      { id: "r4", stage: "STAGE 4", label: "Site Visit Slot Scheduler", desc: "Reserves tour slot with senior broker and books cab voucher.", latency: "90ms", protocol: "Salesforce / HubSpot API", accent: "#F59E0B" },
      { id: "r5", stage: "STAGE 5", label: "Senior Broker Dossier", desc: "Dispatches WhatsApp qualification dossier to sales director.", latency: "35ms", protocol: "CRM Webhook & SMS", accent: "#E8630A" }
    ],
    subTopics: [
      {
        id: "speed-to-lead",
        title: "Sub-Topic 01: Sub-3-Second Lead Contact & Qualification",
        badge: "Instant Contact",
        problem: "Lead conversion drops 8× after 5 minutes of form submission as buyers research competitors.",
        solution: "Voice agent calls lead immediately, introduces property developer, and qualifies intent in seconds.",
        metrics: "3s contact speed • 3× pipeline qualification rate",
        templateId: "tpl-10",
        templateName: "Instant Lead Qualification (Sub-3s Speed to Lead)",
        templateCategory: "Lead Qualification",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Mr. Sen, calling from Sobha Developers! You recently inquired about our 3BHK residences at Sobha Emerald. Are you looking for personal living or investment?", time: "00:03" },
          { speaker: "Buyer", text: "Looking for personal use for my family. What is the approximate starting price?", time: "00:09" },
          { speaker: "Claritiy AI", text: "The 3BHK residences start at ₹1.85 Crores with 1,800 sq ft carpet area. Are you looking to move in within the next 6 months?", time: "00:18" },
          { speaker: "Buyer", text: "Yes, exactly within 6 months. Can we visit this Saturday?", time: "00:23" },
          { speaker: "Claritiy AI", text: "Saturday at 11:30 AM is open. I have reserved your tour slot with our Senior Architect and sent a Google Maps pin to your phone. See you Saturday!", time: "00:32" }
        ]
      },
      {
        id: "budget-intent-scoring",
        title: "Sub-Topic 02: Budget & Timeline Intent Scoring",
        badge: "Pipeline Efficiency",
        problem: "Brokers waste 60% of their workday speaking to unvetted leads with unrealistic budgets.",
        solution: "AI filters out non-serious leads and tags High-Intent buyers for instant executive transfer.",
        metrics: "₹6.98 cost per qualified lead • Zero wasted broker hours",
        templateId: "tpl-11",
        templateName: "Property Tour & Site Visit Booking",
        templateCategory: "Appointment Booking",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hi Karan, calling from Prestige Estates regarding your villa inquiry on Sarjapur Road. May I verify your ideal budget range?", time: "00:05" },
          { speaker: "Buyer", text: "Our budget is between ₹3.5 to ₹4.5 Crores.", time: "00:09" },
          { speaker: "Claritiy AI", text: "Understood. Our 4BHK Courtyard Villas fall right in that bracket at ₹3.8 Crores. Would you like to review the floor plans over WhatsApp?", time: "00:19" }
        ]
      },
      {
        id: "site-visit-accelerator",
        title: "Sub-Topic 03: Property Tour & Cab Pickup Coordination",
        badge: "Tour Booking",
        problem: "Scheduled property visits have a 50% weekend no-show rate.",
        solution: "Confirms visit time, coordinates Ola/Uber pickup voucher, and sends property master layout.",
        metrics: "78% site visit attendance • 2.4× deal closure velocity",
        templateId: "tpl-12",
        templateName: "High-Net-Worth Investor Inventory Update",
        templateCategory: "Outbound Sales & Reactivation",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Rohit, confirming your site visit to Godrej Woodsman tomorrow at 11:00 AM. Would you like us to dispatch a complimentary executive cab to pick you up from Indiranagar?", time: "00:06" },
          { speaker: "Buyer", text: "Yes, that would be wonderful.", time: "00:09" },
          { speaker: "Claritiy AI", text: "Excellent! Your cab pickup is booked for 10:15 AM tomorrow. Your driver details and gate entry QR code have been texted to your mobile.", time: "00:20" }
        ]
      },
      {
        id: "database-reactivation",
        title: "Sub-Topic 04: Database Reactivation for New Tower Launches",
        badge: "Reactivation",
        problem: "Dormant buyer lists of 10,000+ past inquiries sit untouched in spreadsheets.",
        solution: "Batch calls entire database with natural tone announcing new inventory and exclusive pre-launch pricing.",
        metrics: "12% dormant lead reactivation • 10,000 calls in 30 mins",
        templateId: "tpl-10",
        templateName: "Instant Lead Qualification",
        templateCategory: "Outbound Sales & Reactivation",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Mr. Nair! Calling from Puravankara. You visited our Whitefield project last year. We just opened pre-launch bookings for Tower C with an exclusive 10% launch discount for past visitors. Would you like to review the new 3BHK pricing?", time: "00:09" },
          { speaker: "Buyer", text: "Yes, send me the price sheet on WhatsApp.", time: "00:13" },
          { speaker: "Claritiy AI", text: "Sent! I have also flagged your profile for priority allocation if you book before Sunday.", time: "00:20" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "lead.qualified_site_visit",
  "project": "Sobha Emerald 3BHK",
  "buyerName": "Arjun Sen",
  "buyerPhone": "+919822334455",
  "intent": "END_USER",
  "budgetMin": 18500000,
  "timelineMonths": 6,
  "siteVisitTime": "2026-10-17T11:30:00+05:30",
  "disposition": "HIGH_INTENT_BOOKED"
}`
  },

  // ── 5. Insurance Claims & Renewals ────────────────────────────────────────
  {
    id: "insurance",
    label: "Insurance Claims",
    icon: ShieldCheck,
    visual: "🛡️",
    badge: "Claims AI Engine",
    accent: "#059669",
    bgLight: "#D1FAE5",
    headline: "First Notice of Loss (FNOL) Claims & Policy Retention Network",
    subhead: "Provide 0-second emergency claim intake during accidents, verify coverage instantly, and coordinate roadside assistance without holding queues.",
    heroStat: { value: "3.5×", label: "FNOL Speed-to-Intake" },
    stats: [
      { value: "0", label: "Queue Hold Time" },
      { value: "78%", label: "Renewals Automated" },
      { value: "100%", label: "IRDAI Compliance Logging" }
    ],
    wiremap: [
      { id: "i1", stage: "STAGE 1", label: "Emergency Toll-Free Call", desc: "Policyholder dials toll-free line during breakdown or medical intake.", latency: "10ms", protocol: "SIP Inbound Trunk", accent: "#059669" },
      { id: "i2", stage: "STAGE 2", label: "First Notice of Loss (FNOL)", desc: "Assesses accident severity, confirms safety, and logs claim number.", latency: "160ms", protocol: "Claritiy Voice DSP", accent: "#10B981" },
      { id: "i3", stage: "STAGE 3", label: "Policy & Coverage Match", desc: "Validates active policy number, IDV, and zero-depreciation coverage clauses.", latency: "60ms", protocol: "Core Insurance API", accent: "#34D399" },
      { id: "i4", stage: "STAGE 4", label: "Tow Truck / Surveyor Dispatch", desc: "Transfers GPS coordinates to road assistance provider via real-time API.", latency: "80ms", protocol: "Roadside Fleet Hook", accent: "#059669" },
      { id: "i5", stage: "STAGE 5", label: "Regulated Audit Vault", desc: "Archives verbatim recording with cryptographic signature for IRDAI compliance.", latency: "25ms", protocol: "S3 Vault + SHA-256", accent: "#10B981" }
    ],
    subTopics: [
      {
        id: "fnol-claims-intake",
        title: "Sub-Topic 01: First Notice of Loss (FNOL) Claims Intake",
        badge: "Emergency Dispatch",
        problem: "Claim intake queues during natural disasters or rush hours take 25+ minutes of hold time.",
        solution: "Claritiy Voice picks up in 0 seconds, collects location, vehicle damage description, and logs claim number.",
        metrics: "3.5× faster FNOL intake • 0 queue hold time",
        templateId: "tpl-13",
        templateName: "First Notice of Loss (FNOL) Auto Claim Intake",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Emergency Insurance Assistance. Are you in a safe location, and does anyone require medical aid?", time: "00:03" },
          { speaker: "Caller", text: "Everyone is safe, but my car bumper is damaged after a collision near Electronic City.", time: "00:09" },
          { speaker: "Claritiy AI", text: "I am glad you are safe. I have pulled up your comprehensive policy for vehicle KA-05-MB-1234. Your claim ticket #CLM-8910 is active, and roadside towing has been dispatched to your location.", time: "00:22" },
          { speaker: "Caller", text: "What is the towing ETA?", time: "00:26" },
          { speaker: "Claritiy AI", text: "The flatbed tow truck is currently 12 minutes away. I have sent the driver's live GPS tracking link to your registered mobile number.", time: "00:34" }
        ]
      },
      {
        id: "policy-renewal-engine",
        title: "Sub-Topic 02: Automated Policy Renewal & Premium Collection",
        badge: "Retention Desk",
        problem: "22% of auto and health policies lapse due to forgotten renewal dates and ignored email alerts.",
        solution: "Voice agent calls 14 and 3 days before expiry, explains no-claim bonus (NCB), and sends one-click renewal link.",
        metrics: "78% renewal rate automated • ₹0 agent commission",
        templateId: "tpl-7",
        templateName: "Ethical Pre-Due EMI & Renewal Reminder",
        templateCategory: "BFSI Collections & Reminders",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Vikram, calling from HDFC ERGO. Your comprehensive car policy for Hyundai Creta expires on October 20th. You have earned a 35% No-Claim Bonus discount. Would you like to renew now for ₹11,200?", time: "00:08" },
          { speaker: "Policyholder", text: "Yes, please send the payment link.", time: "00:11" },
          { speaker: "Claritiy AI", text: "I have just sent your instant renewal link via SMS and WhatsApp. Once paid, your renewed policy PDF will download instantly.", time: "00:21" }
        ]
      },
      {
        id: "cashless-pre-auth",
        title: "Sub-Topic 03: Cashless Hospitalization Pre-Authorization",
        badge: "Health Desk",
        problem: "Patients wait hours at hospital billing desks for initial sanction approval.",
        solution: "Instant automated call verifies policy coverage limits, hospital room rent eligibility, and notifies billing team.",
        metrics: "Instant policy verification • 92% patient relief",
        templateId: "tpl-2",
        templateName: "Pre-Op Fasting & Diagnostic Protocol",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Good afternoon. Calling Apollo Hospital Billing Desk regarding cashless admission for patient S. Mehra. Policy #HL-9912 covers 100% of room rent and surgical procedures up to ₹5,00,000.", time: "00:08" },
          { speaker: "Desk Staff", text: "Confirming co-pay clauses.", time: "00:11" },
          { speaker: "Claritiy AI", text: "Zero co-pay applied. Sanction letter has been electronically stamped and delivered to your portal.", time: "00:19" }
        ]
      },
      {
        id: "claim-status-deflection",
        title: "Sub-Topic 04: Claim Status & Surveyor ETA Updates",
        badge: "Deflection Desk",
        problem: "60% of claim center inbound volume consists of repetitive 'Where is my claim?' inquiries.",
        solution: "AI authenticates claim ID, retrieves real-time surveyor notes, and gives precise status updates.",
        metrics: "65% call deflection • 4.8★ CSAT rating",
        templateId: "tpl-1",
        templateName: "Front Desk Receptionist",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Welcome to Bajaj Allianz Claims. May I have your 8-digit claim registration number?", time: "00:04" },
          { speaker: "Caller", text: "Claim number is CLM-8910.", time: "00:08" },
          { speaker: "Claritiy AI", text: "Thank you. Your vehicle inspection at Trident Hyundai has been completed by Surveyor Rajesh Kumar. Final settlement approval of ₹42,300 is scheduled for tomorrow at 3 PM.", time: "00:20" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "claim.fnol_logged",
  "policyNumber": "POL-AUTO-899120",
  "claimId": "CLM-8910",
  "insuredName": "Vikram Sethi",
  "accidentType": "REAR_COLLISION",
  "injuriesReported": false,
  "towingDispatched": true,
  "gpsTrackingSent": true,
  "disposition": "FNOL_PROCESSED"
}`
  },

  // ── 6. Logistics & Supply Chain ───────────────────────────────────────────
  {
    id: "logistics",
    label: "Logistics & Fleet",
    icon: Truck,
    visual: "🚚",
    badge: "Real-Time Dispatch",
    accent: "#E8630A",
    bgLight: "#FEF3C7",
    headline: "Hyper-Local Logistics, Gate Access & Driver Dispatch",
    subhead: "Achieve 98.5% first-attempt delivery rates with pre-arrival presence verification, gated community PIN capture, and automated freight driver scheduling.",
    heroStat: { value: "98.5%", label: "First-Attempt Delivery Rate" },
    stats: [
      { value: "∞", label: "Concurrent Outbound Calls" },
      { value: "25%", label: "Faster Route Completion" },
      { value: "0", label: "Gate Turnaround Delays" }
    ],
    wiremap: [
      { id: "l1", stage: "STAGE 1", label: "Warehouse Dispatch Queue", desc: "Batch of 5,000 packages assigned to local delivery hubs.", latency: "10ms", protocol: "WMS / Courier Core", accent: "#E8630A" },
      { id: "l2", stage: "STAGE 2", label: "Consignee Time-Window Call", desc: "Calls receiver 1 hour prior to confirm presence and Gate security instructions.", latency: "175ms", protocol: "Claritiy Voice DSP", accent: "#F59E0B" },
      { id: "l3", stage: "STAGE 3", label: "Security Gate OTP / Passcode", desc: "Captures building visitor PIN or asks for leave-with-security authorization.", latency: "65ms", protocol: "Speech-to-Digit Extraction", accent: "#E8630A" },
      { id: "l4", stage: "STAGE 4", label: "TMS Driver Handset Sync", desc: "Pushes optimized delivery sequence and gate passcodes to delivery app.", latency: "80ms", protocol: "Driver App WebSocket", accent: "#F59E0B" },
      { id: "l5", stage: "STAGE 5", label: "Failed Attempt Recovery", desc: "If receiver is away, instantly books neighbor drop or shifts slot to next day.", latency: "35ms", protocol: "Real-time Rescheduler", accent: "#E8630A" }
    ],
    subTopics: [
      {
        id: "consignee-presence",
        title: "Sub-Topic 01: Pre-Delivery Consignee Presence Verification",
        badge: "Last-Mile Efficiency",
        problem: "Delivery executives spend 20% of their workday waiting outside locked gates for unavailable recipients.",
        solution: "Voice agent calls 45 minutes prior to delivery, confirming presence and preventing wasted driver trips.",
        metrics: "98.5% first-attempt delivery rate • 25% faster routes",
        templateId: "tpl-14",
        templateName: "Pre-Delivery Consignee Presence Check",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Ananya, calling from Express Logistics regarding package #EXP-4402 arriving in 35 minutes. Are you available at Flat 301 to receive it?", time: "00:03" },
          { speaker: "Receiver", text: "I am at office right now. Can you ask the delivery person to leave it with the security guard at Tower B?", time: "00:11" },
          { speaker: "Claritiy AI", text: "Certainly. I have updated the driver's delivery note to leave the package with Tower B Security. We will text you a photo of the parcel upon drop-off.", time: "00:22" }
        ]
      },
      {
        id: "gate-security-pin",
        title: "Sub-Topic 02: Gate Security PIN & Access Code Collection",
        badge: "Gated Communities",
        problem: "Strict apartment societies deny courier entry without resident pre-approval, delaying deliveries.",
        solution: "AI prompts recipient to generate MyGate / NoBroker pass and relays code directly to courier app.",
        metrics: "Zero gate turnaround delays • Smooth delivery",
        templateId: "tpl-14",
        templateName: "Pre-Delivery Consignee Presence Check",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Rohan, your delivery partner has arrived at Sobha City Main Gate. May I have your 4-digit visitor PIN for security gate clearance?", time: "00:05" },
          { speaker: "Resident", text: "Yes, the MyGate PIN is 4491.", time: "00:08" },
          { speaker: "Claritiy AI", text: "PIN 4491 has been sent to your driver's app. Delivery to your doorstep is in progress.", time: "00:16" }
        ]
      },
      {
        id: "driver-availability-dispatch",
        title: "Sub-Topic 03: Driver Availability & Route Acceptance",
        badge: "Fleet Dispatch",
        problem: "Dispatchers spend hours calling truck drivers to confirm morning freight assignments.",
        solution: "Automated agent dials 500 drivers simultaneously, confirms truck capacity, and logs availability.",
        metrics: "100% route allocation in 15 mins • Zero dispatcher chaos",
        templateId: "tpl-10",
        templateName: "Instant Lead Qualification",
        templateCategory: "Lead Qualification",
        dialogue: [
          { speaker: "Claritiy AI", text: "Namaste Suresh ji, calling from FreightX. We have a 14-foot truck load from Bhiwandi to Pune leaving tomorrow at 6:00 AM at ₹8,500. Are you available to accept this route?", time: "00:07" },
          { speaker: "Driver", text: "Haanji, I will take it. What is the loading dock address?", time: "00:12" },
          { speaker: "Claritiy AI", text: "Route assigned! Dock 4, Warehouse 12, Bhiwandi. Google Maps navigation link sent via WhatsApp.", time: "00:21" }
        ]
      },
      {
        id: "delay-exception-alerts",
        title: "Sub-Topic 04: Shipment Delay & Exception Broadcast",
        badge: "Customer Care",
        problem: "Unexpected highway blockades or weather delays flood support desks with angry status calls.",
        solution: "Proactively calls consignees with revised delivery windows before they ever need to complain.",
        metrics: "80% reduction in inbound support calls • Proactive trust",
        templateId: "tpl-1",
        templateName: "Front Desk Receptionist",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello Maya, calling from Delhivery. Due to highway waterlogging, your parcel #DEL-9912 will be delivered tomorrow morning between 10 AM and 12 PM instead of tonight. Would you like it delivered to home or office?", time: "00:08" },
          { speaker: "Customer", text: "Office address please.", time: "00:11" },
          { speaker: "Claritiy AI", text: "Address updated to your office location. Thank you for your patience!", time: "00:18" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "delivery.rescheduled_guard",
  "trackingNumber": "EXP-4402",
  "consignee": "Ananya Roy",
  "phoneNumber": "+919933445566",
  "originalSlot": "2026-10-10T14:30:00",
  "resolution": "LEAVE_WITH_SECURITY_TOWER_B",
  "driverAppNotified": true
}`
  },

  // ── 7. BPO & Call Centers ─────────────────────────────────────────────────
  {
    id: "bpo",
    label: "BPO & Call Centers",
    icon: Headphones,
    visual: "🎧",
    badge: "Infinite Scale Engine",
    accent: "#059669",
    bgLight: "#D1FAE5",
    headline: "10,000+ Concurrent Call Queue Deflection & Warm Transfer",
    subhead: "Handle high-traffic surge events without queue hold times. Deflect repetitive Tier-1 volume autonomously and transfer complex issues with live context.",
    heroStat: { value: "10K+", label: "Concurrent Call Capacity" },
    stats: [
      { value: "60%", label: "Operational Cost Reduction" },
      { value: "4.9★", label: "CSAT Maintained" },
      { value: "45s", label: "AHT Reduction on Warm Transfer" }
    ],
    wiremap: [
      { id: "b1", stage: "STAGE 1", label: "SIP PBX Overflow Routing", desc: "Inbound queues exceeding 30s automatically divert to Claritiy Voice.", latency: "15ms", protocol: "FreeSWITCH / Asterisk SIP", accent: "#059669" },
      { id: "b2", stage: "STAGE 2", label: "Tier-1 Autonomous Deflection", desc: "Resolves FAQs, order lookups, and account resets without human intervention.", latency: "165ms", protocol: "Claritiy Core LLM", accent: "#10B981" },
      { id: "b3", stage: "STAGE 3", label: "Sentiment & Escalation Monitor", desc: "Detects caller frustration, urgent keywords, or VIP customer status.", latency: "25ms", protocol: "VAD + Sentiment Pipeline", accent: "#34D399" },
      { id: "b4", stage: "STAGE 4", label: "SIP-REFER Human Handover", desc: "Transfers audio stream to available human agent along with live screenpop notes.", latency: "120ms", protocol: "SIP REFER / WebRTC Bridge", accent: "#059669" },
      { id: "b5", stage: "STAGE 5", label: "100% Automated Call Auditing", desc: "Evaluates compliance, empathy, and accuracy scores across 10,000+ daily calls.", latency: "45ms", protocol: "Audit Vector Embeddings", accent: "#10B981" }
    ],
    subTopics: [
      {
        id: "surge-queue-deflection",
        title: "Sub-Topic 01: 10,000+ Concurrent Call Queue Deflection",
        badge: "Infinite Scalability",
        problem: "Surge events (outages, flash sales) create 45-minute wait times and sky-high abandonment rates.",
        solution: "Spins up thousands of concurrent AI agents in 20 milliseconds, providing instant answers with zero hold time.",
        metrics: "0-second wait times • 60% operational cost reduction",
        templateId: "tpl-15",
        templateName: "10,000+ Concurrent Call Queue Deflection",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Thank you for calling Skyward Support. I am your AI assistant. How may I help you today?", time: "00:03" },
          { speaker: "Customer", text: "My broadband has been down since morning, and I need it for an important work meeting.", time: "00:09" },
          { speaker: "Claritiy AI", text: "I understand how urgent that is. I have tested your optical line for account #ACC-7712. A local fiber cut is currently under repair near your node. Field engineers estimate restoration by 2:30 PM.", time: "00:22" },
          { speaker: "Customer", text: "Can you notify me once it is back up?", time: "00:26" },
          { speaker: "Claritiy AI", text: "I have enrolled your mobile for instant SMS and WhatsApp notification the moment the optical signal stabilizes. You will receive an alert automatically.", time: "00:35" }
        ]
      },
      {
        id: "warm-human-transfer",
        title: "Sub-Topic 02: Contextual Warm Transfer to Human Agents",
        badge: "Hybrid Operations",
        problem: "Callers get frustrated repeating their issue when transferred from IVR to human agents.",
        solution: "Claritiy Voice briefs the human agent with a 2-sentence summary and intent score before connecting audio.",
        metrics: "45-second reduction in Average Handle Time (AHT)",
        templateId: "tpl-1",
        templateName: "Front Desk Receptionist",
        templateCategory: "Receptionist",
        dialogue: [
          { speaker: "Claritiy AI (to Agent)", text: "[Internal Screenpop]: Caller is Priya Sharma, Account #8819. Disputed credit card annual fee of ₹1,500. High-value customer (Tier 1 Gold). Recommended action: Fee waiver.", time: "00:06" },
          { speaker: "Human Agent", text: "Hello Ms. Sharma, I see you are inquiring about the ₹1,500 annual fee. I would be happy to process an immediate waiver for your Gold account today.", time: "00:15" }
        ]
      },
      {
        id: "automated-call-qa",
        title: "Sub-Topic 03: 100% Automated Call QA & Compliance Auditing",
        badge: "Quality Assurance",
        problem: "BPO QA teams can only manually review 1-2% of recorded calls, missing compliance violations.",
        solution: "Transcribes and scores 100% of calls for regulatory compliance, script adherence, and sentiment trends.",
        metrics: "100% audit coverage • Zero compliance penalties",
        templateId: "tpl-15",
        templateName: "10,000+ Concurrent Call Queue Deflection",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy QA Engine", text: "Call ID #CL-9921 analyzed. Agent adherence: 98%. Mandatory disclaimer stated: YES. Customer sentiment trend: Neutral -> Positive. QA Score: 9.6/10.", time: "00:05" }
        ]
      },
      {
        id: "tier1-faq-automation",
        title: "Sub-Topic 04: Tier-1 FAQ & Transaction Automation",
        badge: "Self-Service Voice",
        problem: "Agents spend 70% of their shift answering repetitive questions like 'Where is my order?' or 'Reset password'.",
        solution: "Voice agent resolves routine inquiries directly from backend databases, freeing humans for complex sales.",
        metrics: "72% first-contact resolution • 4.9★ CSAT",
        templateId: "tpl-1",
        templateName: "Front Desk Receptionist",
        templateCategory: "Receptionist",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello! Claritiy Care Desk. How can I assist you with your account today?", time: "00:03" },
          { speaker: "Caller", text: "I need to reset my corporate account password.", time: "00:06" },
          { speaker: "Claritiy AI", text: "I have just triggered an encrypted password reset link to your registered email address on file ending in @company.com. The link is valid for 15 minutes.", time: "00:18" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "support.tier1_resolved",
  "customerId": "cust_8819",
  "serviceType": "Fiber Broadband",
  "incidentId": "INC-NODE-99",
  "intent": "OUTAGE_CHECK",
  "disposition": "AUTONOMOUSLY_RESOLVED",
  "humanEscalationRequired": false,
  "csatPrediction": 4.8
}`
  },

  // ── 8. SaaS & Digital Agencies ────────────────────────────────────────────
  {
    id: "saas",
    label: "SaaS & Agencies",
    icon: Code,
    visual: "⚡",
    badge: "White-Label API",
    accent: "#E8630A",
    bgLight: "#FEF3C7",
    headline: "White-Label Voice AI & Product Trial Activation",
    subhead: "Deliver voice AI infrastructure for marketing agencies and product-led SaaS companies. Activate new signups within 5 minutes and book executive demos.",
    heroStat: { value: "3×", label: "Trial-to-Paid Lift" },
    stats: [
      { value: "100%", label: "White-Label Custom Domain SIP" },
      { value: "45%", label: "Faster Onboarding Activation" },
      { value: "28%", label: "Churn Reduction" }
    ],
    wiremap: [
      { id: "s1", stage: "STAGE 1", label: "Product Signup Hook", desc: "User signs up for software trial or triggers high-value upgrade intent.", latency: "8ms", protocol: "PostHog / Segment Hook", accent: "#E8630A" },
      { id: "s2", stage: "STAGE 2", label: "Firmographic Enrichment", desc: "Enriches company size, LinkedIn tech stack, and ICP tier within 2 seconds.", latency: "45ms", protocol: "Clearbit / Apollo API", accent: "#F59E0B" },
      { id: "s3", stage: "STAGE 3", label: "White-Label Outbound SDR", desc: "Calls buyer representing the SaaS brand, answers setup doubts, qualifies demo.", latency: "180ms", protocol: "Custom Domain SIP Gateway", accent: "#E8630A" },
      { id: "s4", stage: "STAGE 4", label: "Executive Demo Slot Booking", desc: "Integrates with Calendly/ChiliPiper to schedule video walkthrough with AE.", latency: "90ms", protocol: "OAuth Calendar API", accent: "#F59E0B" },
      { id: "s5", stage: "STAGE 5", label: "CRM Deal Stage Advance", desc: "Updates HubSpot/Salesforce deal stage to 'Demo Scheduled' with call transcript.", latency: "35ms", protocol: "CRM REST API", accent: "#E8630A" }
    ],
    subTopics: [
      {
        id: "trial-activation",
        title: "Sub-Topic 01: Instant Trial Activation & Guided Onboarding",
        badge: "Product-Led Growth",
        problem: "65% of trial signups churn within 48 hours without completing their first core product setup.",
        solution: "Voice agent calls 5 minutes after signup, answers onboarding hurdles, and guides user to their first 'aha' moment.",
        metrics: "3× trial-to-paid conversion • 45% faster activation",
        templateId: "tpl-16",
        templateName: "Product Demo & Trial Activation Agent",
        templateCategory: "Outbound Sales & Reactivation",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hi Priya! This is Alex from CloudScale. I saw you just deployed your first Kubernetes cluster on our trial. Did everything connect smoothly for your team?", time: "00:04" },
          { speaker: "Founder", text: "Yes, it connected, but we had a question about connecting our private GitHub repo for auto-deploys.", time: "00:11" },
          { speaker: "Claritiy AI", text: "That is super common! You just need to paste your deploy key into Settings under Git Integrations. Our Solutions Engineer Mark has 15 minutes open tomorrow at 3 PM if you want him to walk you through it live.", time: "00:23" },
          { speaker: "Founder", text: "Tomorrow at 3 PM works great for me.", time: "00:27" },
          { speaker: "Claritiy AI", text: "Awesome! I have booked Mark's calendar and sent the Google Meet link to your inbox. Welcome to CloudScale!", time: "00:34" }
        ]
      },
      {
        id: "white-label-agency",
        title: "Sub-Topic 02: White-Label Voice AI for Digital Agencies",
        badge: "Agency Reseller",
        problem: "Agencies struggle to build proprietary AI voice infrastructure for their local business clients.",
        solution: "White-label Claritiy Voice with custom domains, client billing sub-accounts, and custom voice models.",
        metrics: "100% white-label ready • Multi-tenant client portals",
        templateId: "tpl-1",
        templateName: "Front Desk Receptionist",
        templateCategory: "Receptionist",
        dialogue: [
          { speaker: "Claritiy Agency Core", text: "White-label tenant created for Agency 'Apex Digital'. Brand domain: calling.apexdigital.io. Client sub-account quota allocated: 50,000 minutes.", time: "00:05" }
        ]
      },
      {
        id: "pre-churn-outreach",
        title: "Sub-Topic 03: Pre-Churn Risk Outreach & Feature Discovery",
        badge: "Customer Success",
        problem: "Accounts go silent for 3 weeks before cancelling, leaving CS teams blindsided.",
        solution: "Detects drop in platform usage and triggers friendly check-in call to address roadblocks.",
        metrics: "28% churn reduction • Proactive customer love",
        templateId: "tpl-16",
        templateName: "Product Demo & Trial Activation Agent",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Claritiy AI", text: "Hello David, checking in from DataSync. We noticed your team's API syncs paused over the weekend. Were there any schema changes we can assist you with?", time: "00:06" },
          { speaker: "User", text: "Yes, we upgraded our PostgreSQL version and were getting an auth handshake error.", time: "00:11" },
          { speaker: "Claritiy AI", text: "Got it! That just requires enabling SSL mode 'require' in the connector. I have sent the doc link and assigned our senior database specialist to review your logs.", time: "00:22" }
        ]
      },
      {
        id: "contract-renewals",
        title: "Sub-Topic 04: High-Tier Enterprise Contract Renewal Reminders",
        badge: "Revenue Operations",
        problem: "Annual contracts risk slipping into month-to-month delays when renewal managers miss follow-ups.",
        solution: "Conversational agent verifies procurement contact, confirms license count, and schedules review.",
        metrics: "94% on-time annual renewals • Clean CRM forecasting",
        templateId: "tpl-7",
        templateName: "Ethical Pre-Due EMI & Renewal Reminder",
        templateCategory: "BFSI Collections & Reminders",
        dialogue: [
          { speaker: "Claritiy AI", text: "Good afternoon Sarah, calling from WorkStream Revenue Operations. Your annual enterprise tier is up for renewal on November 15th. May we confirm your seat count for the upcoming year?", time: "00:08" },
          { speaker: "VP Eng", text: "We are expanding from 50 to 80 seats next month.", time: "00:11" },
          { speaker: "Claritiy AI", text: "Fantastic! I have scheduled your Account Executive Liam to send the tiered volume pricing contract today. Have a great afternoon!", time: "00:20" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "saas.demo_scheduled",
  "leadEmail": "priya@techstartup.io",
  "company": "TechStartup IO",
  "trialDay": 1,
  "assignedAE": "Mark Davis",
  "scheduledTime": "2026-10-11T15:00:00+05:30",
  "integrationDoubt": "GitHub Private Repo Deploy Keys",
  "disposition": "HIGH_VALUE_DEMO_BOOKED"
}`
  }
];

// ── SVG Interactive Background Pattern ─────────────────────────────────────────
function CleanWireframeGrid({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="usecase-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={accent} strokeWidth="0.5" strokeDasharray="1,4" />
            <circle cx="20" cy="20" r="1.5" fill={accent} opacity="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#usecase-grid)" />
      </svg>
    </div>
  );
}

export default function UseCases({ setPage, initialIndustryId }: UseCasesProps) {
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>(() => {
    return initialIndustryId || "healthcare";
  });

  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(0);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [playingDialogueSubTopic, setPlayingDialogueSubTopic] = useState<string | null>(null);

  const currentTopic = USE_CASE_TOPICS.find(t => t.id === selectedIndustryId) || USE_CASE_TOPICS[0];
  const isGreen = currentTopic.accent === "#059669";

  useEffect(() => {
    if (initialIndustryId) {
      setSelectedIndustryId(initialIndustryId);
    }
  }, [initialIndustryId]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(currentTopic.jsonPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleLaunchDashboardTemplate = (templateId: string) => {
    // Navigate directly into dashboard
    setPage("dashboard");
  };

  return (
    <div className="pb-36 pt-28 bg-[#FFFDF9] min-h-screen text-[#0D1117] relative font-plus-jakarta">
      <CleanWireframeGrid accent={currentTopic.accent} />

      {/* ── Top Vertical Navigation Bar ──────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-700 flex items-center gap-1.5 mb-1">
              <Workflow className="w-3.5 h-3.5 text-emerald-600" />
              ENTERPRISE VERTICAL ARCHITECTURES
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Production Use Case Blueprints
            </h1>
          </div>

          <button
            onClick={() => setPage("solutions")}
            className="self-start md:self-auto text-xs font-mono font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <span>← Back to All Solutions</span>
          </button>
        </div>

        {/* Industry Selector Tabs */}
        <div className="flex items-center gap-2 pt-6 overflow-x-auto pb-2">
          {USE_CASE_TOPICS.map((topic) => {
            const Icon = topic.icon;
            const isSelected = topic.id === currentTopic.id;
            return (
              <button
                key={topic.id}
                onClick={() => {
                  setSelectedIndustryId(topic.id);
                  setActiveNodeIndex(0);
                  setPlayingDialogueSubTopic(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-md scale-[1.02]"
                    : "bg-white border border-[#E8E2D9] text-slate-600 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <span>{topic.visual}</span>
                <span>{topic.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Topic Hero Section ───────────────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-16">
        <motion.div
          key={currentTopic.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-[#E8E2D9] rounded-3xl p-8 md:p-12 shadow-sm relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div 
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[100px] pointer-events-none opacity-20"
            style={{ background: currentTopic.accent }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span 
                  className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border inline-flex items-center gap-1.5"
                  style={{
                    background: isGreen ? "#D1FAE5" : "#FEF3C7",
                    color: currentTopic.accent,
                    borderColor: `${currentTopic.accent}40`
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {currentTopic.badge}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  TOPIC SPECIFICATION
                </span>
              </div>

              <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 leading-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {currentTopic.headline}
              </h2>

              <p className="text-slate-600 text-sm md:text-base leading-relaxed max-w-3xl font-plus-jakarta">
                {currentTopic.subhead}
              </p>
            </div>

            {/* Quick Metrics Card */}
            <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-2xl p-6 space-y-4">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                MEASURED IMPACT
              </span>
              <div className="space-y-1">
                <span className="text-4xl font-extrabold font-mono" style={{ color: currentTopic.accent, fontFamily: "'Clash Display', sans-serif" }}>
                  {currentTopic.heroStat.value}
                </span>
                <p className="text-xs font-bold text-slate-700 font-plus-jakarta">
                  {currentTopic.heroStat.label}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/80 space-y-2">
                {currentTopic.stats.map((st, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">{st.label}</span>
                    <span className="font-mono font-bold text-slate-900">{st.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Interactive Architecture Wiremap ─────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-20 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-emerald-600" />
              SYSTEM WIREMAP & FLOWGRAPH
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              End-to-End Latency & Telephony Dataflow
            </h2>
            <p className="text-xs text-slate-500 font-plus-jakarta max-w-2xl">
              Inspect each stage of the audio pipeline from network ingress to conversational reasoning and enterprise database mutation.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-600 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>End-to-End Target: &lt; 200ms</span>
          </div>
        </div>

        {/* Visual Wiremap Flowchart */}
        <div className="bg-[#0B132B] text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl space-y-6 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            {currentTopic.wiremap.map((node, idx) => {
              const isSelected = activeNodeIndex === idx;
              return (
                <div
                  key={node.id}
                  onClick={() => setActiveNodeIndex(idx)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected 
                      ? "bg-slate-900/90 border-emerald-400 ring-2 ring-emerald-400/20 shadow-lg" 
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Connecting Arrow for desktop */}
                  {idx < currentTopic.wiremap.length - 1 && (
                    <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-20 text-slate-600">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                        {node.stage}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                        {node.latency}
                      </span>
                    </div>

                    <h4 className="text-xs md:text-sm font-bold text-white leading-tight">
                      {node.label}
                    </h4>

                    <p className="text-[11px] text-slate-400 leading-relaxed font-plus-jakarta">
                      {node.desc}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-emerald-400/80 block truncate">
                      {node.protocol}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Node Telemetry Inspector */}
          {currentTopic.wiremap[activeNodeIndex] && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold text-slate-200 uppercase">
                    ACTIVE TELEMETRY: {currentTopic.wiremap[activeNodeIndex].label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-plus-jakarta">
                  {currentTopic.wiremap[activeNodeIndex].desc} Protocol transport: <code>{currentTopic.wiremap[activeNodeIndex].protocol}</code>.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-800">
                  Latency Budget: {currentTopic.wiremap[activeNodeIndex].latency}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 4 Dedicated Sub-Topic Cards with Dashboard Template Connectors ── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-20 space-y-12">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider">
            DEEP-DIVE IMPLEMENTATION MODULES
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Specific Topic Modules & Connected Dashboard Templates
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-plus-jakarta max-w-3xl">
            Each sub-topic is paired with a pre-configured production template from the Claritiy Agent Studio. Click to deploy directly into your account.
          </p>
        </div>

        <div className="space-y-10">
          {currentTopic.subTopics.map((sub, index) => {
            const isPlaying = playingDialogueSubTopic === sub.id;

            return (
              <div 
                key={sub.id}
                className="bg-white border border-[#E8E2D9] rounded-3xl p-6 md:p-10 shadow-sm space-y-8 hover:border-slate-300 transition-all relative overflow-hidden"
              >
                {/* Header & Sub-Topic Title */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                        {sub.badge}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        MODULE 0{index + 1}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      {sub.title}
                    </h3>
                  </div>

                  {/* Connected Dashboard Template Pill with 1-Click Action */}
                  <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-4 self-start lg:self-auto">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
                        CONNECTED AGENT TEMPLATE
                      </span>
                      <span className="text-xs font-bold text-slate-900 block font-mono">
                        {sub.templateId}: {sub.templateName}
                      </span>
                    </div>

                    <button
                      onClick={() => handleLaunchDashboardTemplate(sub.templateId)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                      title="Open and deploy this agent template inside the studio"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Launch In Studio</span>
                    </button>
                  </div>
                </div>

                {/* Problem vs Claritiy AI Solution Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-rose-50/60 border border-rose-200/60 rounded-2xl p-5 space-y-2">
                    <span className="text-[10px] font-mono font-bold text-rose-700 uppercase tracking-wider block">
                      LEGACY OPERATIONAL BOTTLENECK
                    </span>
                    <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-plus-jakarta">
                      {sub.problem}
                    </p>
                  </div>

                  <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-5 space-y-2">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">
                      CLARITIY VOICE AUTOMATION RESOLUTION
                    </span>
                    <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-plus-jakarta">
                      {sub.solution}
                    </p>
                  </div>
                </div>

                {/* Impact Metric Bar */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex items-center gap-2 text-xs font-mono font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{sub.metrics}</span>
                </div>

                {/* Verbatim Production Call Dialogue Simulation */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      SIMULATED CALL TRANSCRIPT ({sub.dialogue.length} TURNS)
                    </span>

                    <button
                      onClick={() => setPlayingDialogueSubTopic(isPlaying ? null : sub.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isPlaying 
                          ? "bg-rose-100 text-rose-700 border border-rose-200" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? "Pause Simulation" : "Play Dialogue"}</span>
                    </button>
                  </div>

                  <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-2xl p-4 md:p-6 space-y-3">
                    {sub.dialogue.map((turn, tIdx) => {
                      const isAi = turn.speaker.includes("AI") || turn.speaker.includes("Claritiy");
                      return (
                        <div 
                          key={tIdx}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                            isAi 
                              ? "bg-white border-emerald-200 text-slate-900 shadow-xs" 
                              : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <div className="space-y-1">
                            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${
                              isAi ? "text-emerald-700" : "text-slate-500"
                            }`}>
                              {turn.speaker}
                            </span>
                            <p className="text-xs md:text-sm font-plus-jakarta leading-relaxed">
                              "{turn.text}"
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 self-end sm:self-auto flex-shrink-0">
                            {turn.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Enterprise JSON Schema Specification ─────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-20 space-y-4">
        <div className="bg-white border border-[#E8E2D9] rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                ENTERPRISE WEBHOOK PAYLOAD SPECIFICATION
              </span>
              <h3 className="text-lg md:text-xl font-bold text-slate-900 mt-1" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Production JSON Output Schema ({currentTopic.label})
              </h3>
            </div>

            <button
              onClick={handleCopyJson}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPayload ? "Copied Schema" : "Copy JSON Payload"}</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto shadow-inner">
            <pre className="leading-relaxed">{currentTopic.jsonPayload}</pre>
          </div>
        </div>
      </section>

      {/* ── Bottom Call To Action ────────────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white rounded-3xl p-8 md:p-14 border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block">
              READY TO LAUNCH YOUR VOICE AGENT?
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white leading-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Deploy {currentTopic.label} Templates in Under 5 Minutes
            </h2>
            <p className="text-slate-400 text-xs md:text-sm font-plus-jakarta leading-relaxed">
              Connect your telephony numbers, adjust the conversational prompt guardrails, and begin placing live pilot calls today.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => setPage("dashboard")}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <span>Open Agent Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage("contact")}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
            >
              <span>Talk to Solution Architect</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

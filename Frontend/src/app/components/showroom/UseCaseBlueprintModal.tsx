import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, CheckCircle2, ArrowRight, Activity, Terminal, Code2,
  Workflow, GitBranch, Cpu, ShieldCheck, PhoneCall, Copy, Check,
  Sparkles, Layers, MessageSquare, Database, Share2, Compass
} from "lucide-react";

export interface IndustryData {
  id: string;
  label: string;
  icon: any;
  headline: string;
  subhead: string;
  stats: { v: string; l: string }[];
  useCases: string[];
  badge: string;
  accent: string;
  bg: string;
  visual: string;
}

interface UseCaseBlueprintModalProps {
  industry: IndustryData;
  isOpen: boolean;
  onClose: () => void;
  allIndustries: IndustryData[];
  onSelectIndustry: (ind: IndustryData) => void;
}

interface ArchitectureNode {
  id: string;
  stage: string;
  title: string;
  desc: string;
  latency: string;
  tech: string;
}

interface WorkflowCard {
  title: string;
  tag: string;
  problem: string;
  solution: string;
  metrics: string;
}

const INDUSTRY_BLUEPRINTS: Record<string, {
  pipeline: ArchitectureNode[];
  workflows: WorkflowCard[];
  transcript: { speaker: string; text: string; time: string }[];
  schemaExample: string;
}> = {
  healthcare: {
    pipeline: [
      { id: "1", stage: "01 INGRESS", title: "EHR Webhook / Inbound SIP", desc: "Patient triggers appointment request via clinic portal or inbound line.", latency: "12ms", tech: "REST / WebRTC SIP Trunk" },
      { id: "2", stage: "02 SECURITY", title: "DPDP / HIPAA PII Filter", desc: "Aadhaar, phone, and medical notes masked before audio buffer ingestion.", latency: "18ms", tech: "Edge Zero-Retention DLP" },
      { id: "3", stage: "03 REASONING", title: "Medical Triage Voice Agent", desc: "Contextual speech agent converses in local dialect with doctor calendar constraints.", latency: "190ms", tech: "Claritiy Multimodal Core" },
      { id: "4", stage: "04 TOOL CALL", title: "Calendar & Slot Locking", desc: "Locks slot in EHR/Practo database through authenticated JSON webhook.", latency: "85ms", tech: "Two-way Webhook Relay" },
      { id: "5", stage: "05 DISPATCH", title: "SMS & WhatsApp Confirmation", desc: "Dispatches clinic Google Maps link, prep checklist, and calendar invite.", latency: "40ms", tech: "Twilio / Gupshup Webhook" }
    ],
    workflows: [
      {
        title: "Outpatient Intake & Appointment Booking",
        tag: "Inbound & Outbound",
        problem: "Front desk staff misses 45% of peak-hour calls, resulting in unfilled doctor slots.",
        solution: "Voice agent handles concurrent calls in Hindi/English, checks doctor availability, and secures appointment slots in real time.",
        metrics: "85% reduction in hold time • 99.2% booking accuracy"
      },
      {
        title: "Pre-Operative Fasting & Prep Reminders",
        tag: "Automated Outbound",
        problem: "15% of surgical procedures are delayed or cancelled due to patients eating before surgery.",
        solution: "Automated conversational agent calls patients 24h prior, verifies fasting instructions, and answers prep doubts.",
        metrics: "94% procedure adherence • 0 manual staff calls"
      },
      {
        title: "Post-Discharge Recovery & Symptom Check",
        tag: "Clinical Follow-up",
        problem: "Readmissions surge when patients don't report fever or medication reactions in early stages.",
        solution: "Checks pain levels, medication adherence, and alerts on-call clinical nurse immediately if red flags occur.",
        metrics: "3.2× faster clinical escalations • 96% patient CSAT"
      },
      {
        title: "Insurance TPA & Cashless Pre-Approval",
        tag: "Verification Desk",
        problem: "Patients face 3+ hours delay at discharge waiting for TPA desk insurance status updates.",
        solution: "Voice agent queries policy number, cross-references claim pre-authorization, and provides instant status.",
        metrics: "60% less discharge wait time • Instant status"
      }
    ],
    transcript: [
      { speaker: "Claritiy AI", text: "Namaste Mr. Verma! I am calling from Apollo Clinic regarding your ultrasound consultation tomorrow at 10:30 AM with Dr. Rao. Are you able to make it?", time: "00:03" },
      { speaker: "Patient", text: "Haanji, I will come. Do I need to fast before this test?", time: "00:09" },
      { speaker: "Claritiy AI", text: "Yes, Dr. Rao requires a 4-hour fast beforehand, and please drink 500ml of water 30 minutes before arriving. I have sent the clinic address and instructions to your WhatsApp.", time: "00:18" },
      { speaker: "Patient", text: "That is very helpful. Thank you!", time: "00:23" },
      { speaker: "Claritiy AI", text: "You are most welcome. We look forward to seeing you tomorrow at 10:30 AM. Have a wonderful day!", time: "00:28" }
    ],
    schemaExample: `{
  "event": "appointment.confirmed",
  "patientId": "pt_99120",
  "patientPhone": "+919876543210",
  "doctor": "Dr. S. Rao, MD",
  "slot": "2026-10-11T10:30:00+05:30",
  "department": "Radiology",
  "prepInstructionsConfirmed": true,
  "disposition": "PATIENT_CONFIRMED"
}`
  },
  finance: {
    pipeline: [
      { id: "1", stage: "01 INGRESS", title: "Core Banking / LMS Trigger", desc: "Loan Management System exports due EMI tranche via authenticated API.", latency: "10ms", tech: "Finacle / Mambu REST" },
      { id: "2", stage: "02 GOVERNANCE", title: "RBI Fair Practice Check", desc: "Validates call time window (8 AM – 7 PM), DNC checks, and respectful tone prompts.", latency: "15ms", tech: "Regulatory Rule Engine" },
      { id: "3", stage: "03 CONVERSATION", title: "Ethical Collection Agent", desc: "Speaks regional language, understands borrower hardship, and negotiates pay date.", latency: "185ms", tech: "Claritiy Voice Core" },
      { id: "4", stage: "04 PAYMENT RELAY", title: "UPI Dynamic Deep-link", desc: "Dispatches SMS/WhatsApp payment link with pre-filled amount and virtual account.", latency: "90ms", tech: "Razorpay / Cashfree API" },
      { id: "5", stage: "05 SETTLEMENT", title: "Core Ledger Update", desc: "Updates promissory note or marks recovery settlement in LMS automatically.", latency: "35ms", tech: "Real-Time Webhook" }
    ],
    workflows: [
      {
        title: "Ethical Soft EMI Due Reminders",
        tag: "Pre-Due / Due Date",
        problem: "Aggressive third-party collection agencies damage banking brand reputation and violate RBI rules.",
        solution: "Polite, empathetic AI voice calls 3 days prior to due date, clarifying EMI amount and sharing instant UPI payment links.",
        metrics: "42% lift in digital EMI collection • 100% RBI compliance"
      },
      {
        title: "KYC Document Clarification & Video KYC",
        tag: "Onboarding Flow",
        problem: "Loan application drop-off exceeds 50% when KYC documents have blurred signatures or missing pages.",
        solution: "Voice agent dials applicant within 5 minutes of rejection, explains exact missing document, and sends re-upload portal link.",
        metrics: "3.5× faster loan disbursal • 68% drop-off recovered"
      },
      {
        title: "Suspicious Debit / Fraud Verification Alert",
        tag: "Security Response",
        problem: "SMS fraud alerts are ignored by 70% of senior citizens, leading to high financial loss.",
        solution: "Immediate voice call asks customer to verify high-ticket debit with a single voice confirmation or block card instantly.",
        metrics: "Sub-3-second contact rate • 98% fraud containment"
      },
      {
        title: "Pre-Approved Credit Line Prequalification",
        tag: "Credit Card / Top-Up",
        problem: "Human telemarketers spend 8 hours daily dialing cold numbers with only 2% conversion.",
        solution: "AI qualifies interest, explains interest rates and tenure, and transfers hot leads directly to banking officers.",
        metrics: "₹6.50 cost per qualified lead • Zero spam tactics"
      }
    ],
    transcript: [
      { speaker: "Claritiy AI", text: "Namaste Ms. Kapoor, calling from Apex Finance regarding your personal loan EMI of ₹14,200 due on October 15th. Would you like me to send a secure UPI link?", time: "00:03" },
      { speaker: "Borrower", text: "Can I pay by tomorrow evening instead? My salary gets credited tomorrow.", time: "00:10" },
      { speaker: "Claritiy AI", text: "Certainly, Ms. Kapoor. I have scheduled your payment reminder for tomorrow at 5:00 PM and sent the direct payment link via WhatsApp. No late fees will apply if completed then.", time: "00:20" },
      { speaker: "Borrower", text: "Okay, perfect. I will pay via UPI tomorrow.", time: "00:25" },
      { speaker: "Claritiy AI", text: "Thank you for banking with Apex Finance. Have a wonderful day ahead!", time: "00:29" }
    ],
    schemaExample: `{
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
  ecommerce: {
    pipeline: [
      { id: "1", stage: "01 INGRESS", title: "Shopify / Magento Order Hook", desc: "Webhook fires upon new Cash-On-Delivery checkout completion.", latency: "8ms", tech: "Shopify REST Webhooks" },
      { id: "2", stage: "02 QUEUE", title: "30-Second Speed-to-Call Worker", desc: "Enqueues outbound telephony before the buyer closes their browser.", latency: "14ms", tech: "Redis / BullMQ Queue" },
      { id: "3", stage: "03 SPEECH AGENT", title: "Colloquial Hinglish Caller", desc: "Verifies address, confirms buyer intent, and captures missing delivery landmarks.", latency: "195ms", tech: "Claritiy Neural Synthesis" },
      { id: "4", stage: "04 LOGISTICS SYNC", title: "Carrier API (Delhivery/Shiprocket)", desc: "Updates order tags as Confirmed, attaches delivery note, or cancels fake order.", latency: "110ms", tech: "Shipment Aggregator API" },
      { id: "5", stage: "05 UPGRADE HOOK", title: "Prepaid Discount Conversion", desc: "Offers instant ₹50-₹100 discount to convert COD to instant UPI payment.", latency: "30ms", tech: "Payment Gateway Link" }
    ],
    workflows: [
      {
        title: "Cash-on-Delivery (COD) Order Verification",
        tag: "RTO Defense Engine",
        problem: "Return-to-Origin (RTO) rates hover at 35-40% for Indian D2C brands, bleeding shipping costs.",
        solution: "Voice agent calls within 60 seconds of checkout, verifies intent, and flags fake/unresponsive numbers.",
        metrics: "40% reduction in RTO • ₹45 per order saved on shipping"
      },
      {
        title: "Pincode & Landmark Address Correction",
        tag: "First-Attempt Delivery",
        problem: "Couriers fail delivery when address lacks colony gates, opposite landmarks, or building names.",
        solution: "Conversational AI prompts buyer for nearby landmarks and automatically appends them to shipping label.",
        metrics: "94% first-attempt delivery • 0 courier confusion"
      },
      {
        title: "Instant Prepaid Conversion Incentive",
        tag: "Working Capital Lift",
        problem: "COD lockups delay merchant payouts by 10-15 days through courier remittance cycles.",
        solution: "Offers buyer an exclusive instant discount if they settle immediately via UPI payment link on call.",
        metrics: "18% of COD orders converted to prepaid • Zero risk"
      },
      {
        title: "Out-for-Delivery Rescheduling & Safe Drop",
        tag: "Last-Mile Coordination",
        problem: "Buyers away from home result in non-delivery reports (NDR) and return shipments.",
        solution: "Calls before dispatch to confirm presence or re-schedule to a neighbor/security guard drop.",
        metrics: "65% failed deliveries rescued on same day"
      }
    ],
    transcript: [
      { speaker: "Claritiy AI", text: "Namaste Rohan ji! Claritiy Retail calling to confirm your Cash on Delivery order for Puma sneakers. Should we ship it to Flat 402, Green Glen Layout?", time: "00:03" },
      { speaker: "Customer", text: "Yes, Flat 402, but please tell the courier to come after 4 PM.", time: "00:09" },
      { speaker: "Claritiy AI", text: "Noted! Added evening delivery instruction after 4 PM with landmark near Gate 1. If you pay right now via UPI, you can get ₹50 cashback. Shall I text the link?", time: "00:20" },
      { speaker: "Customer", text: "Sure, text me the link, I will pay via Google Pay now.", time: "00:26" },
      { speaker: "Claritiy AI", text: "Done! Link sent. Your order is confirmed and shipping today. Thank you for shopping with us!", time: "00:31" }
    ],
    schemaExample: `{
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
  realestate: {
    pipeline: [
      { id: "1", stage: "01 INGRESS", title: "Meta Ads / Google Form Hook", desc: "High-ticket property inquiry lands from digital campaign.", latency: "5ms", tech: "Facebook Graph API / Webhook" },
      { id: "2", stage: "02 INSTANT DIAL", title: "3-Second Speed-to-Lead", desc: "Outbound agent dials lead while interest and buyer attention are peak.", latency: "12ms", tech: "Claritiy Telephony Relay" },
      { id: "3", stage: "03 QUALIFICATION", title: "High-Ticket SDR Persona", desc: "Qualifies configuration (2BHK/3BHK), budget ceiling, and buy timeline.", latency: "180ms", tech: "Claritiy Multimodal Agent" },
      { id: "4", stage: "04 TOUR BOOKING", title: "Property Site Visit Scheduler", desc: "Books site tour slot and reserves complimentary cab pickup.", latency: "95ms", tech: "Salesforce / HubSpot API" },
      { id: "5", stage: "05 HANDOFF", title: "Senior Broker WhatsApp Dossier", desc: "Dispatches full qualification notes and budget transcript to sales director.", latency: "40ms", tech: "CRM Webhook & SMS" }
    ],
    workflows: [
      {
        title: "Sub-3-Second Lead Contact & Qualification",
        tag: "Inbound Speed-to-Lead",
        problem: "Lead conversion drops 8× after 5 minutes of form submission as buyers research competitors.",
        solution: "Voice agent calls lead immediately, introduces property developer, and qualifies intent in seconds.",
        metrics: "3s contact speed • 3× pipeline qualification rate"
      },
      {
        title: "Budget & Timeline Intent Scoring",
        tag: "Pipeline Efficiency",
        problem: "Brokers waste 60% of their workday speaking to unvetted tire-kickers with unrealistic budgets.",
        solution: "AI filters out non-serious leads and tags High-Intent buyers for instant executive transfer.",
        metrics: "₹6.98 cost per qualified lead • Zero wasted broker hours"
      },
      {
        title: "Property Tour & Cab Pickup Coordination",
        tag: "Site Visit Accelerator",
        problem: "Scheduled property visits have a 50% weekend no-show rate.",
        solution: "Confirms visit time, coordinates Ola/Uber pickup voucher, and sends property master layout.",
        metrics: "78% site visit attendance • 2.4× deal closure velocity"
      },
      {
        title: "Price Revision & New Tower Launch Broadcast",
        tag: "Database Reactivation",
        problem: "Dormant buyer lists of 10,000+ past inquiries sit untouched in spreadsheets.",
        solution: "Batch calls entire database with natural tone announcing new inventory and exclusive pre-launch pricing.",
        metrics: "12% dormant lead reactivation • 10,000 calls in 30 mins"
      }
    ],
    transcript: [
      { speaker: "Claritiy AI", text: "Hello Mr. Sen, calling from Sobha Developers! You recently inquired about our 3BHK residences at Sobha Emerald. Are you looking for personal living or investment?", time: "00:03" },
      { speaker: "Buyer", text: "Looking for self-use for my family. What is the approximate starting price?", time: "00:10" },
      { speaker: "Claritiy AI", text: "The 3BHK residences start at ₹1.85 Crores with 1,800 sq ft carpet area. Are you looking to move in within the next 6 months?", time: "00:19" },
      { speaker: "Buyer", text: "Yes, exactly within 6 months. Can we visit this Saturday?", time: "00:24" },
      { speaker: "Claritiy AI", text: "Saturday at 11:30 AM is open. I have reserved your tour slot with our Senior Architect and sent a Google Maps pin to your phone. See you Saturday!", time: "00:32" }
    ],
    schemaExample: `{
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
  insurance: {
    pipeline: [
      { id: "1", stage: "01 INGRESS", title: "Emergency Claim Inbound Call", desc: "Policyholder dials toll-free line during car breakdown or hospital intake.", latency: "10ms", tech: "SIP Inbound Trunk" },
      { id: "2", stage: "02 TRIAGE", title: "First Notice of Loss (FNOL)", desc: "Assesses accident severity, confirms driver safety, and checks emergency services.", latency: "160ms", tech: "Claritiy Voice DSP" },
      { id: "3", stage: "03 VALIDATION", title: "Policy & Coverage Match", desc: "Validates active policy number, IDV, and zero-depreciation coverage clauses.", latency: "60ms", tech: "Core Insurance API" },
      { id: "4", stage: "04 LOGISTICS", title: "Tow Truck / Surveyor Dispatch", desc: "Transfers GPS coordinates to road assistance provider via real-time API.", latency: "80ms", tech: "Roadside Fleet Hook" },
      { id: "5", stage: "05 AUDIT", title: "Regulated Voice Audit Log", desc: "Archives verbatim recording with cryptographic signature for IRDAI compliance.", latency: "25ms", tech: "S3 Vault + SHA-256" }
    ],
    workflows: [
      {
        title: "First Notice of Loss (FNOL) Claims Intake",
        tag: "Emergency Dispatch",
        problem: "Claim intake queues during natural disasters or rush hours take 25+ minutes of hold time.",
        solution: "Claritiy Voice picks up in 0 seconds, collects location, vehicle damage description, and logs claim number.",
        metrics: "3.5× faster FNOL intake • 0 queue hold time"
      },
      {
        title: "Automated Policy Renewal & Premium Collection",
        tag: "Retention Desk",
        problem: "22% of auto and health policies lapse due to forgotten renewal dates and ignored email alerts.",
        solution: "Voice agent calls 14 and 3 days before expiry, explains no-claim bonus (NCB), and sends one-click renewal link.",
        metrics: "78% renewal rate automated • ₹0 agent commission"
      },
      {
        title: "Cashless Hospitalization Pre-Authorization",
        tag: "Health Desk",
        problem: "Patients wait hours at hospital billing desks for initial sanction approval.",
        solution: "Instant automated call verifies policy coverage limits, hospital room rent eligibility, and notifies billing team.",
        metrics: "Instant policy verification • 92% patient relief"
      },
      {
        title: "Claim Status & Surveyor ETA Updates",
        tag: "Inbound Deflection",
        problem: "60% of claim center inbound volume consists of repetitive 'Where is my claim?' inquiries.",
        solution: "AI authenticates claim ID, retrieves real-time surveyor notes, and gives precise status updates.",
        metrics: "65% call deflection • 4.8★ CSAT rating"
      }
    ],
    transcript: [
      { speaker: "Claritiy AI", text: "Emergency Insurance Assistance. Are you in a safe location, and does anyone require medical aid?", time: "00:03" },
      { speaker: "Caller", text: "Everyone is safe, but my car bumper is damaged after a collision near Electronic City.", time: "00:09" },
      { speaker: "Claritiy AI", text: "I am glad you are safe. I have pulled up your comprehensive policy for vehicle KA-05-MB-1234. Your claim ticket #CLM-8910 is active, and roadside towing has been dispatched to your location.", time: "00:22" },
      { speaker: "Caller", text: "What is the towing ETA?", time: "00:26" },
      { speaker: "Claritiy AI", text: "The flatbed tow truck is currently 12 minutes away. I have sent the driver's live GPS tracking link to your registered mobile number.", time: "00:34" }
    ],
    schemaExample: `{
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
  logistics: {
    pipeline: [
      { id: "1", stage: "01 INGRESS", title: "Warehouse Out-for-Delivery Trigger", desc: "Batch list of 5,000 packages assigned to local delivery hubs.", latency: "10ms", tech: "WMS / Courier Core" },
      { id: "2", stage: "02 PRE-CALL", title: "Consignee Time-Window Call", desc: "Calls receiver 1 hour prior to confirm presence and Gate security instructions.", latency: "175ms", tech: "Claritiy Voice DSP" },
      { id: "3", stage: "03 PIN CAPTURE", title: "Security Gate OTP / Passcode", desc: "Captures building visitor PIN or asks for leave-with-security authorization.", latency: "65ms", tech: "Speech-to-Digit Extraction" },
      { id: "4", stage: "04 ROUTE UPDATE", title: "TMS Driver Handset Sync", desc: "Pushes optimized delivery sequence and gate passcodes to delivery app.", latency: "80ms", tech: "Driver App WebSocket" },
      { id: "5", stage: "05 EXCEPTION", title: "Failed Attempt Recovery", desc: "If receiver is away, instantly books neighbor drop or shifts slot to next day.", latency: "35ms", tech: "Real-time Rescheduler" }
    ],
    workflows: [
      {
        title: "Pre-Delivery Consignee Presence Verification",
        tag: "Last-Mile Efficiency",
        problem: "Delivery executives spend 20% of their workday waiting outside locked gates for unavailable recipients.",
        solution: "Voice agent calls 45 minutes prior to delivery, confirming presence and preventing wasted driver trips.",
        metrics: "98.5% first-attempt delivery rate • 25% faster routes"
      },
      {
        title: "Gate Security PIN & Access Code Collection",
        tag: "Gated Communities",
        problem: "Strict apartment societies deny courier entry without resident pre-approval, delaying deliveries.",
        solution: "AI prompts recipient to generate MyGate / NoBroker pass and relays code directly to courier app.",
        metrics: "Zero gate turnaround delays • Smooth delivery"
      },
      {
        title: "Driver Availability & Route Acceptance",
        tag: "Fleet Management",
        problem: "Dispatchers spend hours calling truck drivers to confirm morning freight assignments.",
        solution: "Automated agent dials 500 drivers simultaneously, confirms truck capacity, and logs availability.",
        metrics: "100% route allocation in 15 mins • Zero dispatcher chaos"
      },
      {
        title: "Shipment Delay & Exception Broadcast",
        tag: "Customer Care",
        problem: "Unexpected highway blockades or weather delays flood support desks with angry status calls.",
        solution: "Proactively calls consignees with revised delivery windows before they ever need to complain.",
        metrics: "80% reduction in inbound support calls • Proactive trust"
      }
    ],
    transcript: [
      { speaker: "Claritiy AI", text: "Hello Ananya, calling from Express Logistics regarding package #EXP-4402 arriving in 35 minutes. Are you available at Flat 301 to receive it?", time: "00:03" },
      { speaker: "Receiver", text: "I am at office right now. Can you ask the delivery person to leave it with the security guard at Tower B?", time: "00:11" },
      { speaker: "Claritiy AI", text: "Certainly. I have updated the driver's delivery note to leave the package with Tower B Security. We will text you a photo of the parcel upon drop-off.", time: "00:22" },
      { speaker: "Receiver", text: "Great, thank you so much!", time: "00:25" }
    ],
    schemaExample: `{
  "event": "delivery.rescheduled_guard",
  "trackingNumber": "EXP-4402",
  "consignee": "Ananya Roy",
  "phoneNumber": "+919933445566",
  "originalSlot": "2026-10-10T14:30:00",
  "resolution": "LEAVE_WITH_SECURITY_TOWER_B",
  "driverAppNotified": true
}`
  },
  bpo: {
    pipeline: [
      { id: "1", stage: "01 INGRESS", title: "SIP PBX Overflow Routing", desc: "Inbound call queues exceeding 30 seconds automatically divert to Claritiy Voice.", latency: "15ms", tech: "FreeSWITCH / Asterisk SIP" },
      { id: "2", stage: "02 DEFLECTION", title: "Tier-1 Autonomous Resolution", desc: "Resolves FAQs, order lookups, and account resets without human intervention.", latency: "165ms", tech: "Claritiy Core LLM" },
      { id: "3", stage: "03 INTENT SCORE", title: "Sentiment & Escalation Monitor", desc: "Detects caller frustration, urgent keywords, or VIP customer status in real-time.", latency: "25ms", tech: "VAD + Sentiment Pipeline" },
      { id: "4", stage: "04 WARM TRANSFER", title: "SIP-REFER Human Handover", desc: "Transfers audio stream to available human agent along with live transcript screenpop.", latency: "120ms", tech: "SIP REFER / WebRTC Bridge" },
      { id: "5", stage: "05 QA SCORING", title: "100% Automated Call Auditing", desc: "Evaluates compliance, empathy, and accuracy scores across 10,000+ daily calls.", latency: "45ms", tech: "Audit Vector Embeddings" }
    ],
    workflows: [
      {
        title: "10,000+ Concurrent Call Queue Deflection",
        tag: "Infinite Scalability",
        problem: "Surge events (product launches, outages) create 45-minute wait times and sky-high abandonment rates.",
        solution: "Spins up thousands of concurrent AI agents in 20 milliseconds, providing instant answers with zero hold time.",
        metrics: "0-second wait times • 60% operational cost reduction"
      },
      {
        title: "Contextual Warm Transfer to Human Agents",
        tag: "Hybrid Operations",
        problem: "Callers get frustrated repeating their issue when transferred from IVR to human agents.",
        solution: "Claritiy Voice briefs the human agent with a 2-sentence summary and intent score before connecting audio.",
        metrics: "45-second reduction in Average Handle Time (AHT)"
      },
      {
        title: "100% Automated Call QA & Compliance Auditing",
        tag: "Quality Assurance",
        problem: "BPO QA teams can only manually review 1-2% of recorded calls, missing compliance violations.",
        solution: "Transcribes and scores 100% of calls for regulatory compliance, script adherence, and sentiment trends.",
        metrics: "100% audit coverage • Zero compliance penalties"
      },
      {
        title: "Tier-1 FAQ & Transaction Automation",
        tag: "Self-Service Voice",
        problem: "Agents spend 70% of their shift answering repetitive questions like 'Where is my order?' or 'Reset password'.",
        solution: "Voice agent resolves routine inquiries directly from backend databases, freeing humans for complex sales.",
        metrics: "72% first-contact resolution • 4.9★ CSAT"
      }
    ],
    transcript: [
      { speaker: "Claritiy AI", text: "Thank you for calling Skyward Support. I am your AI assistant. How may I help you today?", time: "00:03" },
      { speaker: "Customer", text: "My broadband has been down since morning, and I need it for an important work meeting.", time: "00:09" },
      { speaker: "Claritiy AI", text: "I understand how urgent that is. I have tested your optical line for account #ACC-7712. A local fiber cut is currently under repair near your node. Field engineers estimate restoration by 2:30 PM.", time: "00:22" },
      { speaker: "Customer", text: "Can you notify me once it is back up?", time: "00:26" },
      { speaker: "Claritiy AI", text: "I have enrolled your mobile for instant SMS and WhatsApp notification the moment the optical signal stabilizes. You will receive an alert automatically.", time: "00:35" }
    ],
    schemaExample: `{
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
  saas: {
    pipeline: [
      { id: "1", stage: "01 INGRESS", title: "Product Signup Webhook", desc: "User signs up for software trial or triggers high-value upgrade intent in app.", latency: "8ms", tech: "Segment / PostHog Webhook" },
      { id: "2", stage: "02 INTELLIGENCE", title: "Firmographic Enrichment", desc: "Enriches company size, LinkedIn tech stack, and ICP tier within 2 seconds.", latency: "45ms", tech: "Clearbit / Apollo API" },
      { id: "3", stage: "03 OUTBOUND SDR", title: "White-Label Voice Caller", desc: "Calls buyer representing the SaaS brand, offers onboarding help, and qualifies demo.", latency: "180ms", tech: "Claritiy Custom Domain SIP" },
      { id: "4", stage: "04 CALENDAR", title: "Executive Demo Slot Booking", desc: "Integrates with Calendly/ChiliPiper to schedule video walkthrough with AE.", latency: "90ms", tech: "OAuth Calendar API" },
      { id: "5", stage: "05 CRM UPDATE", title: "Deal Pipeline Acceleration", desc: "Updates HubSpot/Salesforce deal stage to 'Demo Scheduled' with call recording link.", latency: "35ms", tech: "CRM REST API" }
    ],
    workflows: [
      {
        title: "Instant Trial Activation & Guided Onboarding",
        tag: "Product-Led Growth",
        problem: "65% of trial signups churn within 48 hours without completing their first core product setup.",
        solution: "Voice agent calls 5 minutes after signup, answers onboarding hurdles, and guides user to their first 'aha' moment.",
        metrics: "3× trial-to-paid conversion • 45% faster activation"
      },
      {
        title: "White-Label Voice AI for Digital Agencies",
        tag: "Agency Reseller",
        problem: "Agencies struggle to build proprietary AI voice infrastructure for their local business clients.",
        solution: "White-label Claritiy Voice with custom domains, client billing sub-accounts, and custom voice models.",
        metrics: "100% white-label ready • Multi-tenant client portals"
      },
      {
        title: "Pre-Churn Risk Outreach & Feature Discovery",
        tag: "Customer Success",
        problem: "Accounts go silent for 3 weeks before cancelling, leaving CS teams blindsided.",
        solution: "Detects drop in platform usage and triggers friendly check-in call to address roadblocks.",
        metrics: "28% churn reduction • Proactive customer love"
      },
      {
        title: "High-Tier Enterprise Contract Renewal Reminders",
        tag: "Revenue Operations",
        problem: "Annual contracts risk slipping into month-to-month delays when renewal managers miss follow-ups.",
        solution: "Conversational agent verifies procurement contact, confirms license count, and schedules review.",
        metrics: "94% on-time annual renewals • Clean CRM forecasting"
      }
    ],
    transcript: [
      { speaker: "Claritiy AI", text: "Hi Priya! This is Alex from CloudScale. I saw you just deployed your first Kubernetes cluster on our trial. Did everything connect smoothly for your team?", time: "00:04" },
      { speaker: "Founder", text: "Yes, it connected, but we had a question about connecting our private GitHub repo for auto-deploys.", time: "00:11" },
      { speaker: "Claritiy AI", text: "That is super common! You just need to paste your deploy key into Settings under Git Integrations. Our Solutions Engineer Mark has 15 minutes open tomorrow at 3 PM if you want him to walk you through it live.", time: "00:23" },
      { speaker: "Founder", text: "Tomorrow at 3 PM works great for me.", time: "00:27" },
      { speaker: "Claritiy AI", text: "Awesome! I have booked Mark's calendar and sent the Google Meet link to your inbox. Welcome to CloudScale!", time: "00:34" }
    ],
    schemaExample: `{
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
};

export default function UseCaseBlueprintModal({
  industry,
  isOpen,
  onClose,
  allIndustries,
  onSelectIndustry
}: UseCaseBlueprintModalProps) {
  const [activeTab, setActiveTab] = useState<"flowchart" | "workflows" | "transcript" | "schema">("flowchart");
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const blueprint = INDUSTRY_BLUEPRINTS[industry.id] || INDUSTRY_BLUEPRINTS.healthcare;
  const isGreen = industry.accent === "#059669";

  const handleCopySchema = () => {
    navigator.clipboard.writeText(blueprint.schemaExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop with Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-6xl max-h-[92vh] bg-[#0A0D14] text-white border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
          style={{
            boxShadow: `0 25px 80px -15px ${industry.accent}30`
          }}
        >
          {/* Interactive Geometric / Radial Background Accent */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
            <div 
              className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px]"
              style={{ background: industry.accent }}
            />
            <div 
              className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-[120px]"
              style={{ background: isGreen ? "#059669" : "#E8630A" }}
            />
            {/* SVG Wireframe Circuit Lines */}
            <svg className="w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="modal-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#FFFFFF" strokeWidth="0.5" strokeDasharray="2,4" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#modal-grid)" />
            </svg>
          </div>

          {/* ── Top Header Bar ───────────────────────────────────────── */}
          <div className="relative z-10 px-6 py-5 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border"
                style={{ 
                  background: `${industry.accent}20`,
                  borderColor: `${industry.accent}40`
                }}
              >
                {industry.visual}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span 
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                    style={{ 
                      background: `${industry.accent}15`, 
                      color: industry.accent,
                      borderColor: `${industry.accent}35`
                    }}
                  >
                    {industry.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ARCHITECTURE SPECIFICATION
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {industry.label} Operational Use Cases & Flowchart
                </h2>
              </div>
            </div>

            {/* Quick Switch Industries & Close */}
            <div className="flex items-center gap-2.5 self-end md:self-auto">
              <div className="hidden lg:flex items-center gap-1 bg-slate-900/80 border border-slate-800 p-1 rounded-2xl">
                {allIndustries.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => onSelectIndustry(ind)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                      ind.id === industry.id 
                        ? "bg-slate-800 text-white shadow-sm" 
                        : "text-slate-400 hover:text-white"
                    }`}
                    title={ind.label}
                  >
                    {ind.visual} {ind.label.split(" ")[0]}
                  </button>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Tabs Navigation ─────────────────────────────────────── */}
          <div className="relative z-10 px-6 py-3 border-b border-slate-800/60 bg-slate-950/40 flex items-center gap-2 overflow-x-auto">
            {[
              { id: "flowchart", label: "Architecture Flowchart & Wiregraph", icon: Workflow },
              { id: "workflows", label: "4 Production Use Case Cards", icon: Layers },
              { id: "transcript", label: "Live Call Dialogue Transcript", icon: MessageSquare },
              { id: "schema", label: "Enterprise JSON Webhook Payload", icon: Code2 }
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap ${
                    isActive 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Main Scrollable Body ─────────────────────────────────── */}
          <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
            {/* ── TAB 1: Architecture Flowchart & Wiregraph ──────────── */}
            {activeTab === "flowchart" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                      FULL-DUPLEX REAL-TIME PIPELINE (SUB-200MS END-TO-END)
                    </span>
                    <p className="text-xs text-slate-300 font-plus-jakarta mt-0.5">
                      Click any pipeline node to inspect low-latency DSP telemetry and transport protocols.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active Telephony Egress: 16kHz PCM</span>
                  </div>
                </div>

                {/* Interactive Node Flowgraph Diagram */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
                  {blueprint.pipeline.map((node, idx) => {
                    const isSelected = selectedNodeIndex === idx;
                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNodeIndex(idx)}
                        className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 relative flex flex-col justify-between ${
                          isSelected 
                            ? "bg-slate-900 border-emerald-500 shadow-lg ring-1 ring-emerald-500/30" 
                            : "bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/50"
                        }`}
                      >
                        {/* Connecting Arrow for desktop */}
                        {idx < blueprint.pipeline.length - 1 && (
                          <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-20 text-slate-600">
                            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                              {node.stage}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                              {node.latency}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white leading-tight">
                            {node.title}
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed font-plus-jakarta">
                            {node.desc}
                          </p>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-800/60">
                          <span className="text-[10px] font-mono text-slate-500 block truncate">
                            {node.tech}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Node Detailed Inspector */}
                {blueprint.pipeline[selectedNodeIndex] && (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono font-bold text-slate-200 uppercase">
                          NODE DEEP-DIVE: {blueprint.pipeline[selectedNodeIndex].title}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-emerald-400">
                        LATENCY BUDGET: {blueprint.pipeline[selectedNodeIndex].latency}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-plus-jakarta leading-relaxed">
                      {blueprint.pipeline[selectedNodeIndex].desc} Powered by {blueprint.pipeline[selectedNodeIndex].tech} with automatic retry fallbacks, edge TLS termination, and compliance logging.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: 4 Production Use Case Cards ──────────────────── */}
            {activeTab === "workflows" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {blueprint.workflows.map((wf, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                          {wf.tag}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          WORKFLOW #{idx + 1}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                        {wf.title}
                      </h3>

                      <div className="space-y-2 pt-1">
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                          <span className="text-[10px] font-mono font-bold text-rose-400 uppercase block mb-1">
                            LEGACY BOTTLENECK:
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed font-plus-jakarta">
                            {wf.problem}
                          </p>
                        </div>

                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                          <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase block mb-1">
                            CLARITIY VOICE DEPLOYMENT:
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed font-plus-jakarta">
                            {wf.solution}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-850 flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{wf.metrics}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB 3: Live Call Dialogue Transcript ─────────────────── */}
            {activeTab === "transcript" && (
              <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      SIMULATED PRODUCTION CALL TRANSCRIPT
                    </h3>
                    <p className="text-xs text-slate-400 font-plus-jakarta mt-0.5">
                      Verbatim conversation snippet recorded in 16kHz audio with full barge-in handling.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-lg border border-emerald-800">
                    CALL DURATION: ~35 SECONDS
                  </span>
                </div>

                <div className="space-y-3">
                  {blueprint.transcript.map((line, idx) => {
                    const isAi = line.speaker === "Claritiy AI";
                    return (
                      <div 
                        key={idx}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                          isAi 
                            ? "bg-slate-900/80 border-emerald-900/40 text-slate-200" 
                            : "bg-slate-900/30 border-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="space-y-1">
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${
                            isAi ? "text-emerald-400" : "text-sky-400"
                          }`}>
                            {line.speaker}
                          </span>
                          <p className="text-xs md:text-sm leading-relaxed font-plus-jakarta">
                            "{line.text}"
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 self-end sm:self-auto">
                          {line.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TAB 4: Enterprise JSON Webhook Payload ───────────────── */}
            {activeTab === "schema" && (
              <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      DISPATCH WEBHOOK SCHEMA ({industry.label.toUpperCase()})
                    </h3>
                    <p className="text-xs text-slate-400 font-plus-jakarta mt-0.5">
                      Real-time JSON telemetry dispatched to your CRM, ERP, or serverless endpoint upon call completion.
                    </p>
                  </div>

                  <button
                    onClick={handleCopySchema}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 text-slate-200"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy Payload"}</span>
                  </button>
                </div>

                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-850 font-mono text-xs text-emerald-300 overflow-x-auto">
                  <pre className="leading-relaxed">{blueprint.schemaExample}</pre>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer Action Bar ────────────────────────────────────── */}
          <div className="relative z-10 px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono">
                Ready to deploy this {industry.label} workflow?
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-300 transition-colors"
              >
                Close Blueprint
              </button>
              <button
                onClick={() => {
                  onClose();
                  window.location.href = "/dashboard";
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md cursor-pointer"
              >
                Launch in Agent Studio <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

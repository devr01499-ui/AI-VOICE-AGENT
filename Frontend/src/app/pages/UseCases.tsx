import { useState, useEffect } from "react";
import {
  Building2, Landmark, ShoppingBag, Home as HomeIcon, ShieldCheck,
  Truck, Headphones, Code, ArrowRight, CheckCircle2, Play, Pause,
  Terminal, Code2, Copy, Check,
  Workflow, GitBranch, MessageSquare, 
  Zap} from "lucide-react";

type Page = any;

interface UseCasesProps {
  setPage: (p: Page, extraId?: string) => void;
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

// Industry walkthroughs. Every statement describes what the product does today; there are no outcome
// figures because none have been measured (docs/COMPLIANCE_NOTES.md, "Marketing claims"). Third-party
// systems (CRMs, stores, loan systems) connect through signed webhooks, the REST API and Functions.
const USE_CASE_TOPICS: IndustryTopic[] = [
  // ── 1. Healthcare & Clinics ───────────────────────────────────────────────
  {
    id: "healthcare",
    label: "Healthcare & Clinics",
    icon: Building2,
    visual: "🏥",
    badge: "Privacy Controls Built In",
    accent: "#059669",
    bgLight: "#D1FAE5",
    headline: "AI Receptionist for Clinics: Answer Every Call, Book Every Slot",
    subhead: "An AI voice agent that picks up your clinic's calls in Hindi, English or the caller's language, answers questions from your own documents, books appointments on the doctor's Google Calendar and reminds patients the day before.",
    heroStat: { value: "24×7", label: "Every patient call answered" },
    stats: [
      { value: "7", label: "Indian languages + auto-detect" },
      { value: "Calendar", label: "Bookings on Google Calendar" },
      { value: "Optional", label: "PII redaction in transcripts" }
    ],
    wiremap: [
      { id: "h1", stage: "STAGE 1", label: "Patient Calls Your Number", desc: "A patient dials the clinic's +91 number, or a reminder campaign calls them.", latency: "Live", protocol: "Your +91 number", accent: "#059669" },
      { id: "h2", stage: "STAGE 2", label: "Agent Answers", desc: "The receptionist agent greets the caller in their language and listens; the caller can interrupt at any time.", latency: "Real-time", protocol: "Speech-to-speech model", accent: "#10B981" },
      { id: "h3", stage: "STAGE 3", label: "Answers From Your Documents", desc: "Timings, fees and preparation instructions come from the clinic's knowledge base, never from guesswork.", latency: "During the call", protocol: "Knowledge base", accent: "#34D399" },
      { id: "h4", stage: "STAGE 4", label: "Slot Booked", desc: "The agent checks the doctor's free slots and books the appointment within your working hours.", latency: "During the call", protocol: "Google Calendar", accent: "#059669" },
      { id: "h5", stage: "STAGE 5", label: "Summary Saved", desc: "Transcript, summary and booking details appear in Call History and can be sent to your system.", latency: "After the call", protocol: "Signed webhook", accent: "#10B981" }
    ],
    subTopics: [
      {
        id: "outpatient-intake",
        title: "Sub-Topic 01: Appointment Booking at the Front Desk",
        badge: "Inbound",
        problem: "In the morning rush the receptionist cannot answer the phone and help the patients at the counter at the same time, so calls go unanswered.",
        solution: "The agent answers every call, checks the doctor's calendar and books the slot, in Hindi or English, while the front desk looks after the people in the clinic.",
        metrics: "Calls answered • slots booked on Google Calendar • summary in Call History",
        templateId: "tpl-2",
        templateName: "Medical Clinic Receptionist",
        templateCategory: "Receptionist",
        dialogue: [
          { speaker: "AI Agent", text: "Namaste, Lotus Clinic. Main Priya, AI assistant, bol rahi hoon. Appointment book karna hai?", time: "00:03" },
          { speaker: "Patient", text: "Haan, Dr. Rao ke saath kal ka appointment chahiye.", time: "00:08" },
          { speaker: "AI Agent", text: "Kal Dr. Rao 10:30 am aur 12 baje free hain. Kaunsa time theek rahega?", time: "00:14" },
          { speaker: "Patient", text: "10:30 theek hai.", time: "00:17" },
          { speaker: "AI Agent", text: "Done. Kal 10:30 am, Dr. Rao ke saath aapka appointment book ho gaya hai.", time: "00:23" }
        ]
      },
      {
        id: "pre-op-reminders",
        title: "Sub-Topic 02: Day-Before Reminders and Preparation",
        badge: "Outbound Reminders",
        problem: "Patients forget appointments or arrive without following the preparation instructions, and the slot is wasted.",
        solution: "A reminder campaign calls each patient the day before, confirms they are coming and reads out the clinic's preparation instructions from the knowledge base.",
        metrics: "Attendance confirmed • preparation instructions read from your documents",
        templateId: "tpl-2",
        templateName: "Medical Clinic Receptionist",
        templateCategory: "Appointment Booking",
        dialogue: [
          { speaker: "AI Agent", text: "Hello Mr. Verma, this is the AI assistant from Apollo Clinic about your ultrasound tomorrow at 10:30 am with Dr. Rao. Will you be able to come?", time: "00:04" },
          { speaker: "Patient", text: "Yes. Do I need to fast?", time: "00:09" },
          { speaker: "AI Agent", text: "Yes, please don't eat for four hours before, and drink two glasses of water 30 minutes before you arrive. See you tomorrow!", time: "00:18" }
        ]
      },
      {
        id: "post-discharge-triage",
        title: "Sub-Topic 03: Follow-Up Calls After a Visit",
        badge: "Follow-Up",
        problem: "Clinics want to check on patients after a procedure, but the staff rarely have time to call everyone.",
        solution: "The agent calls patients a few days later, asks how they are, and flags anyone who reports a problem so the doctor's team can call them back. It never gives medical advice.",
        metrics: "Patients needing a call-back flagged for your team",
        templateId: "tpl-5",
        templateName: "Dental Clinic Scheduler",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "AI Agent", text: "Hello Mr. Sen, this is the AI assistant from City Dental, checking in two days after your treatment. How are you feeling?", time: "00:04" },
          { speaker: "Patient", text: "There's still some swelling and a little fever.", time: "00:10" },
          { speaker: "AI Agent", text: "Thank you for telling me. I'm marking this as urgent, and the doctor's team will call you back shortly. If it gets worse, please go to the nearest hospital.", time: "00:21" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "call_analyzed",
  "timestamp": "2026-10-10T11:42:08.000Z",
  "data": {
    "callId": "c_8f2a1d1",
    "resultLabel": "Booked",
    "confidence": 0.91,
    "sentiment": "positive",
    "summary": "Caller booked a consultation with Dr. Rao for 10:30 am.",
    "extractedFields": {
      "patient_name": "Rahul",
      "doctor": "Dr. Rao",
      "appointment_slot": "2026-10-11T10:30:00+05:30"
    },
    "status": "completed"
  }
}`
  },

  // ── 2. Finance & Banking ──────────────────────────────────────────────────
  {
    id: "finance",
    label: "Finance & Banking",
    icon: Landmark,
    visual: "🏦",
    badge: "Identity Check Before Details",
    accent: "#E8630A",
    bgLight: "#FEF3C7",
    headline: "Polite EMI Reminders and KYC Follow-Ups for Lenders",
    subhead: "AI voice agents that remind borrowers before their EMI is due, confirm identity before sharing any detail, record when they will pay, and offer a call-back from your team for anything difficult.",
    heroStat: { value: "Identity", label: "Confirmed before any amount" },
    stats: [
      { value: "Opt-out", label: "Do-not-call list honoured" },
      { value: "9–9", label: "IST campaign window (narrow it further)" },
      { value: "Webhook", label: "Promise-to-pay sent to your system" }
    ],
    wiremap: [
      { id: "f1", stage: "STAGE 1", label: "Due List Uploaded", desc: "Upcoming dues arrive as a CSV campaign or one call at a time through the API.", latency: "Before the call", protocol: "CSV / REST API", accent: "#E8630A" },
      { id: "f2", stage: "STAGE 2", label: "Calling Rules", desc: "Campaigns dial only inside 9 am–9 pm IST and skip your opt-out list. Lenders should keep recovery calls within RBI's expected hours.", latency: "Every call", protocol: "Campaign rules", accent: "#F59E0B" },
      { id: "f3", stage: "STAGE 3", label: "Identity Check", desc: "The agent confirms it is speaking to the borrower before mentioning any amount, and ends politely if not.", latency: "Real-time", protocol: "Agent instructions", accent: "#E8630A" },
      { id: "f4", stage: "STAGE 4", label: "Reminder and Payment Date", desc: "It states the amount and due date and asks when the borrower will pay.", latency: "Real-time", protocol: "Speech-to-speech model", accent: "#F59E0B" },
      { id: "f5", stage: "STAGE 5", label: "Result to Your Loan System", desc: "The promise to pay, or a call-back request, reaches your system after the call.", latency: "After the call", protocol: "Signed webhook", accent: "#E8630A" }
    ],
    subTopics: [
      {
        id: "pre-due-emi",
        title: "Sub-Topic 01: Pre-Due EMI Courtesy Reminders",
        badge: "Pre-Due",
        problem: "Many borrowers miss a due date simply because they forgot, and then pay a late fee and take a credit-score hit.",
        solution: "Three days before the due date the agent calls, confirms identity, states the EMI and the date, and records whether the borrower will pay on time.",
        metrics: "Identity confirmed • due date stated • reply recorded",
        templateId: "tpl-13",
        templateName: "EMI Due-Date Courtesy Reminder",
        templateCategory: "BFSI",
        dialogue: [
          { speaker: "AI Agent", text: "Good evening. This is an automated reminder from Apex Lending. Am I speaking with Ms. Kapoor?", time: "00:04" },
          { speaker: "Borrower", text: "Yes, speaking.", time: "00:07" },
          { speaker: "AI Agent", text: "Thank you. Your EMI of ₹6,250 is due on the 12th. Will you be able to pay it by then?", time: "00:14" },
          { speaker: "Borrower", text: "Yes, I'll pay tomorrow evening.", time: "00:18" },
          { speaker: "AI Agent", text: "Noted, tomorrow evening. Thank you, and have a good day.", time: "00:23" }
        ]
      },
      {
        id: "kyc-followup",
        title: "Sub-Topic 02: KYC Document Follow-Up",
        badge: "Onboarding",
        problem: "Loan applications stall when a document is blurred or missing, and applicants do not read the email asking for it again.",
        solution: "The agent calls the applicant, explains which document is missing and where to upload it, and records whether they will do it today.",
        metrics: "Missing document explained • follow-up recorded",
        templateId: "tpl-13",
        templateName: "EMI Due-Date Courtesy Reminder",
        templateCategory: "BFSI",
        dialogue: [
          { speaker: "AI Agent", text: "Hello, this is the AI assistant from Apex Lending about your loan application. Am I speaking with Arjun?", time: "00:04" },
          { speaker: "Applicant", text: "Yes, that's me.", time: "00:07" },
          { speaker: "AI Agent", text: "Thanks. The back of your Aadhaar card was not clear. Could you upload it again in the app under Documents today?", time: "00:16" }
        ]
      },
      {
        id: "early-overdue",
        title: "Sub-Topic 03: Early Overdue Reminders (1–30 DPD)",
        badge: "Early Overdue",
        problem: "Borrowers a few days late often avoid calls from aggressive recovery agents, and the problem grows.",
        solution: "The agent stays respectful, confirms identity first, asks for a payment date, and offers a call-back from a hardship officer when the borrower mentions difficulty.",
        metrics: "Payment date or hardship call-back recorded",
        templateId: "tpl-14",
        templateName: "Early Overdue Reminder (1–30 DPD)",
        templateCategory: "BFSI",
        dialogue: [
          { speaker: "AI Agent", text: "Hello, this is an automated call from Apex Lending. Am I speaking with Rahul Sharma?", time: "00:04" },
          { speaker: "Borrower", text: "Yes. I lost my job last month.", time: "00:09" },
          { speaker: "AI Agent", text: "I'm sorry to hear that. I'll ask a member of our team to call you to talk about options. Is this number the best one to reach you?", time: "00:19" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "call_analyzed",
  "timestamp": "2026-10-10T11:42:08.000Z",
  "data": {
    "callId": "c_8f2a1d2",
    "resultLabel": "Promise to Pay",
    "confidence": 0.91,
    "sentiment": "positive",
    "summary": "Outcome: Promise to Pay.",
    "extractedFields": {
      "identity_confirmed": true,
      "promised_payment_date": "2026-10-11",
      "hardship_callback": false
    },
    "status": "completed"
  }
}`
  },

  // ── 3. E-Commerce & Retail ────────────────────────────────────────────────
  {
    id: "ecommerce",
    label: "E-Commerce & Retail",
    icon: ShoppingBag,
    visual: "🛒",
    badge: "COD Confirmation",
    accent: "#059669",
    bgLight: "#D1FAE5",
    headline: "COD Order Confirmation Calls Before Dispatch",
    subhead: "Call every cash-on-delivery buyer before the parcel ships, in Hindi, English or Hinglish. Confirm the order, fix the address and landmark, and send confirmed, cancelled and unreachable orders back to your store.",
    heroStat: { value: "Pre-dispatch", label: "Every COD order confirmed" },
    stats: [
      { value: "5,000", label: "Contacts per campaign" },
      { value: "3", label: "Attempts for busy / no answer" },
      { value: "Webhook", label: "Result back to your store" }
    ],
    wiremap: [
      { id: "e1", stage: "STAGE 1", label: "New COD Order", desc: "Your store or OMS sends the order through the API, or you upload the day's COD orders as a campaign.", latency: "Before dispatch", protocol: "REST API / CSV", accent: "#059669" },
      { id: "e2", stage: "STAGE 2", label: "Call Placed", desc: "The agent calls the buyer from your +91 number, between 9 am and 9 pm IST.", latency: "Live", protocol: "Your +91 number", accent: "#10B981" },
      { id: "e3", stage: "STAGE 3", label: "Order and Address Confirmed", desc: "It confirms the order, the delivery address and landmark, and a good delivery time, in the buyer's language.", latency: "Real-time", protocol: "Speech-to-speech model", accent: "#34D399" },
      { id: "e4", stage: "STAGE 4", label: "Retries", desc: "Busy and unanswered numbers are retried automatically, up to 3 attempts, at least 10 minutes apart.", latency: "Same day", protocol: "Campaign rules", accent: "#059669" },
      { id: "e5", stage: "STAGE 5", label: "Result to Your Store", desc: "Confirmed, cancelled or unreachable, with any address note, goes back to your store or shipping tool.", latency: "After the call", protocol: "Signed webhook", accent: "#10B981" }
    ],
    subTopics: [
      {
        id: "cod-verification",
        title: "Sub-Topic 01: COD Order Confirmation",
        badge: "Pre-Dispatch",
        problem: "COD orders from buyers who changed their mind or gave a wrong number come back as RTO, and the brand pays shipping both ways.",
        solution: "The agent calls before dispatch, confirms the buyer still wants the order and flags numbers that never answer, so you can hold those parcels.",
        metrics: "Confirmed / cancelled / unreachable for every order",
        templateId: "tpl-9",
        templateName: "E-Commerce COD Order Confirmation",
        templateCategory: "E-Commerce",
        dialogue: [
          { speaker: "AI Agent", text: "Namaste Meera ji, main Kesar Naturals ki AI assistant hoon. Aapne ₹1,299 ka COD order kiya tha. Kya order confirm kar doon?", time: "00:04" },
          { speaker: "Buyer", text: "Haan, confirm hai.", time: "00:08" },
          { speaker: "AI Agent", text: "Dhanyavaad! Delivery ke liye koi achha time hai?", time: "00:12" },
          { speaker: "Buyer", text: "Shaam 6 baje ke baad.", time: "00:15" },
          { speaker: "AI Agent", text: "Theek hai, 6 baje ke baad note kar liya. Order aaj dispatch hoga.", time: "00:21" }
        ]
      },
      {
        id: "address-landmark",
        title: "Sub-Topic 02: Address and Landmark Correction",
        badge: "Delivery Quality",
        problem: "Couriers fail deliveries when the address has no landmark, gate or building name.",
        solution: "The agent asks for a nearby landmark when the address looks incomplete, and sends it back with the order so it can go on the shipping label.",
        metrics: "Landmark captured as a structured field",
        templateId: "tpl-9",
        templateName: "E-Commerce COD Order Confirmation",
        templateCategory: "E-Commerce",
        dialogue: [
          { speaker: "AI Agent", text: "Aapka address Sector 21 hai. Koi landmark bata sakte hain jisse delivery mein aasani ho?", time: "00:05" },
          { speaker: "Buyer", text: "Shiv Mandir ke saamne wali building, Gate 2.", time: "00:10" },
          { speaker: "AI Agent", text: "Shiv Mandir ke saamne, Gate 2. Note kar liya, dhanyavaad!", time: "00:15" }
        ]
      },
      {
        id: "ndr-rescue",
        title: "Sub-Topic 03: Delivery Rescheduling",
        badge: "Delivery Day",
        problem: "Buyers who are not home on delivery day lead to failed attempts and return shipments.",
        solution: "The agent calls before the attempt, checks someone will be there, or records a new date or a neighbour or guard who can receive it.",
        metrics: "New date or alternate receiver recorded",
        templateId: "tpl-9",
        templateName: "E-Commerce COD Order Confirmation",
        templateCategory: "E-Commerce",
        dialogue: [
          { speaker: "AI Agent", text: "Hello, your parcel is out for delivery today. Will someone be home to receive it?", time: "00:04" },
          { speaker: "Buyer", text: "No, please deliver tomorrow morning.", time: "00:08" },
          { speaker: "AI Agent", text: "Sure, tomorrow morning. I've noted that for the delivery team.", time: "00:13" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "call_analyzed",
  "timestamp": "2026-10-10T11:42:08.000Z",
  "data": {
    "callId": "c_8f2a1d3",
    "resultLabel": "Confirmed",
    "confidence": 0.91,
    "sentiment": "positive",
    "summary": "Outcome: Confirmed.",
    "extractedFields": {
      "order_id": "ORD-8941",
      "verification_status": "VERIFIED",
      "landmark": "Opposite Shiv Mandir, Gate 2",
      "preferred_delivery_time": "after 6 pm"
    },
    "status": "completed"
  }
}`
  },

  // ── 4. Real Estate & Property ─────────────────────────────────────────────
  {
    id: "realestate",
    label: "Real Estate & Property",
    icon: HomeIcon,
    visual: "🏢",
    badge: "Lead Qualification",
    accent: "#E8630A",
    bgLight: "#FEF3C7",
    headline: "Call Every Property Enquiry, Qualify It and Book the Site Visit",
    subhead: "Send each new enquiry from your website or ad forms to an AI agent through the API. It calls the buyer, asks about budget, location and timeline, books a site visit on your calendar and sends the answers to your CRM.",
    heroStat: { value: "Same day", label: "Every enquiry called back" },
    stats: [
      { value: "API", label: "Leads sent from your forms" },
      { value: "Calendar", label: "Site visits booked" },
      { value: "Webhook", label: "Answers sent to your CRM" }
    ],
    wiremap: [
      { id: "r1", stage: "STAGE 1", label: "New Enquiry", desc: "Your website or lead tool sends the enquiry to Claritiy Voice through the REST API.", latency: "As it arrives", protocol: "REST API", accent: "#E8630A" },
      { id: "r2", stage: "STAGE 2", label: "Call Placed", desc: "The outbound agent calls the buyer from your +91 number within calling hours.", latency: "Live", protocol: "Your +91 number", accent: "#F59E0B" },
      { id: "r3", stage: "STAGE 3", label: "Qualifying Questions", desc: "It asks your questions: configuration, location, budget, timeline, home-loan status.", latency: "Real-time", protocol: "Speech-to-speech model", accent: "#E8630A" },
      { id: "r4", stage: "STAGE 4", label: "Site Visit Booked", desc: "Interested buyers get a site-visit slot on your sales team's calendar.", latency: "During the call", protocol: "Google Calendar", accent: "#F59E0B" },
      { id: "r5", stage: "STAGE 5", label: "Answers to Your CRM", desc: "The answers and the outcome label reach your CRM, ready for your sales team.", latency: "After the call", protocol: "Signed webhook", accent: "#E8630A" }
    ],
    subTopics: [
      {
        id: "speed-to-lead",
        title: "Sub-Topic 01: Calling New Enquiries Quickly",
        badge: "Speed to Lead",
        problem: "Property enquiries go cold when nobody calls back for a day or two, and buyers move on to other projects.",
        solution: "Each enquiry is sent to the agent as it arrives, and the agent calls the buyer, introduces the project and asks what they are looking for.",
        metrics: "Enquiries called as they arrive, within calling hours",
        templateId: "tpl-7",
        templateName: "Real Estate Enquiry Qualifier",
        templateCategory: "Real Estate",
        dialogue: [
          { speaker: "AI Agent", text: "Hi Vikram, this is the AI assistant from Green Acres. You enquired about our 3BHK homes. Is now a good time?", time: "00:04" },
          { speaker: "Buyer", text: "Yes, go ahead.", time: "00:07" },
          { speaker: "AI Agent", text: "Great. Which area do you prefer, and what budget do you have in mind?", time: "00:12" },
          { speaker: "Buyer", text: "Whitefield, up to 1.5 crore.", time: "00:16" },
          { speaker: "AI Agent", text: "That fits two of our units. Would Saturday at 11:30 am work for a site visit?", time: "00:23" }
        ]
      },
      {
        id: "budget-qualification",
        title: "Sub-Topic 02: Budget and Timeline Qualification",
        badge: "Qualification",
        problem: "Sales teams spend hours on enquiries that do not match the project's budget or location.",
        solution: "The agent asks the same qualifying questions every time and labels each lead, so your team calls the right buyers first.",
        metrics: "Every lead labelled with budget, area and timeline",
        templateId: "tpl-7",
        templateName: "Real Estate Enquiry Qualifier",
        templateCategory: "Real Estate",
        dialogue: [
          { speaker: "AI Agent", text: "When are you planning to buy: in the next three months, or later?", time: "00:05" },
          { speaker: "Buyer", text: "Probably next year.", time: "00:08" },
          { speaker: "AI Agent", text: "Understood. I'll share that with our team, and they'll keep you posted on new launches.", time: "00:14" }
        ]
      },
      {
        id: "visit-reminders",
        title: "Sub-Topic 03: Site Visit Reminders",
        badge: "Visit Day",
        problem: "Booked site visits are missed when buyers forget or their plans change.",
        solution: "A reminder campaign calls buyers the day before to confirm the visit or record a new time.",
        metrics: "Visit confirmed or rescheduled",
        templateId: "tpl-7",
        templateName: "Real Estate Enquiry Qualifier",
        templateCategory: "Real Estate",
        dialogue: [
          { speaker: "AI Agent", text: "Hello Rohit, confirming your site visit tomorrow at 11 am. Are you still able to come?", time: "00:05" },
          { speaker: "Buyer", text: "Can we make it 4 pm instead?", time: "00:09" },
          { speaker: "AI Agent", text: "4 pm is free. I've moved your visit to tomorrow at 4 pm.", time: "00:15" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "call_analyzed",
  "timestamp": "2026-10-10T11:42:08.000Z",
  "data": {
    "callId": "c_8f2a1d4",
    "resultLabel": "Qualified",
    "confidence": 0.91,
    "sentiment": "positive",
    "summary": "Outcome: Qualified.",
    "extractedFields": {
      "budget": "1.5_CR",
      "preferred_area": "Whitefield",
      "timeline": "within 3 months",
      "site_visit": "2026-08-23T11:30:00+05:30"
    },
    "status": "completed"
  }
}`
  },

  // ── 5. Insurance ──────────────────────────────────────────────────────────
  {
    id: "insurance",
    label: "Insurance Claims",
    icon: ShieldCheck,
    visual: "🛡️",
    badge: "Renewals & Claims Intake",
    accent: "#059669",
    bgLight: "#D1FAE5",
    headline: "Renewal Reminders and Calm First Calls for Claims",
    subhead: "Remind policyholders before their policy lapses, answer coverage questions from your own policy documents, and collect the first details of a claim so your claims team starts with the facts.",
    heroStat: { value: "Before expiry", label: "Renewal reminders" },
    stats: [
      { value: "Docs", label: "Coverage answers from your FAQ" },
      { value: "Fields", label: "Claim details captured" },
      { value: "Webhook", label: "Sent to your policy system" }
    ],
    wiremap: [
      { id: "i1", stage: "STAGE 1", label: "Renewal List or Claim Call", desc: "A renewal campaign starts, or a policyholder calls your number to report a claim.", latency: "Live", protocol: "CSV / your +91 number", accent: "#059669" },
      { id: "i2", stage: "STAGE 2", label: "Identity Check", desc: "The agent confirms the policyholder before discussing the policy.", latency: "Real-time", protocol: "Agent instructions", accent: "#10B981" },
      { id: "i3", stage: "STAGE 3", label: "Questions Answered", desc: "Coverage and renewal questions are answered from your policy documents.", latency: "During the call", protocol: "Knowledge base", accent: "#34D399" },
      { id: "i4", stage: "STAGE 4", label: "Details Collected", desc: "For a claim: what happened, when, where, and the best number to call back.", latency: "During the call", protocol: "Post-call data extraction", accent: "#059669" },
      { id: "i5", stage: "STAGE 5", label: "Handed to Your Team", desc: "Renewal intent or claim details reach your system for the next step.", latency: "After the call", protocol: "Signed webhook", accent: "#10B981" }
    ],
    subTopics: [
      {
        id: "renewal-outreach",
        title: "Sub-Topic 01: Policy Renewal Reminders",
        badge: "Retention",
        problem: "Policies lapse because renewal emails and messages are ignored.",
        solution: "The agent calls before expiry, reminds the policyholder of the date, answers simple questions and records whether they want to renew.",
        metrics: "Renewal intent recorded for every policyholder",
        templateId: "tpl-10",
        templateName: "Billing & Subscription Assistant",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "AI Agent", text: "Hello Rohan, this is the AI assistant from Shield Insurance. Your motor policy expires in five days. Would you like to renew it?", time: "00:05" },
          { speaker: "Policyholder", text: "Yes. Is my no-claim bonus still there?", time: "00:10" },
          { speaker: "AI Agent", text: "Yes, your 20% no-claim bonus applies. Our team will email you the renewal link today.", time: "00:18" }
        ]
      },
      {
        id: "fnol-intake",
        title: "Sub-Topic 02: First Notice of Loss",
        badge: "Claims Intake",
        problem: "Claim callers are often stressed, and the first call is when key details get missed.",
        solution: "The agent stays calm, asks what happened, when and where, and records each answer as a field for the claims team.",
        metrics: "Incident type, date, place and call-back number captured",
        templateId: "tpl-10",
        templateName: "Billing & Subscription Assistant",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "AI Agent", text: "I'm sorry to hear about the accident. Is everyone safe?", time: "00:04" },
          { speaker: "Policyholder", text: "Yes, just damage to the car.", time: "00:08" },
          { speaker: "AI Agent", text: "Thank you. When and where did it happen? I'll pass the details to our claims team, who will call you back.", time: "00:16" }
        ]
      },
      {
        id: "coverage-questions",
        title: "Sub-Topic 03: Coverage Questions",
        badge: "Support",
        problem: "Support lines are busy with the same questions about what a policy covers.",
        solution: "The agent answers from your policy FAQ and offers a call-back from an advisor when a question is not covered by the document.",
        metrics: "Answers from your documents; call-back when unsure",
        templateId: "tpl-10",
        templateName: "Billing & Subscription Assistant",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Caller", text: "Does my health policy cover day-care procedures?", time: "00:04" },
          { speaker: "AI Agent", text: "Yes, your plan's document lists day-care procedures as covered, subject to the sum insured. Would you like an advisor to call you with the details?", time: "00:14" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "call_analyzed",
  "timestamp": "2026-10-10T11:42:08.000Z",
  "data": {
    "callId": "c_8f2a1d5",
    "resultLabel": "Will Renew",
    "confidence": 0.91,
    "sentiment": "positive",
    "summary": "Outcome: Will Renew.",
    "extractedFields": {
      "policy_number": "POL-992140",
      "renewal_intent": "YES",
      "ncb_confirmed": true
    },
    "status": "completed"
  }
}`
  },

  // ── 6. Logistics ──────────────────────────────────────────────────────────
  {
    id: "logistics",
    label: "Logistics & Fleet",
    icon: Truck,
    visual: "🚚",
    badge: "Delivery Coordination",
    accent: "#E8630A",
    bgLight: "#FEF3C7",
    headline: "Delivery Calls That Prevent Failed Attempts",
    subhead: "Call recipients before the delivery attempt, confirm someone will be there, collect drop-off instructions or a new date, and send them to your system for the driver.",
    heroStat: { value: "Before arrival", label: "Recipient availability checked" },
    stats: [
      { value: "API", label: "Triggered from your TMS" },
      { value: "Fields", label: "Instructions captured" },
      { value: "Webhook", label: "Sent back for the driver" }
    ],
    wiremap: [
      { id: "l1", stage: "STAGE 1", label: "Out-for-Delivery Event", desc: "Your TMS sends the shipment to the agent through the API.", latency: "Morning of delivery", protocol: "REST API", accent: "#E8630A" },
      { id: "l2", stage: "STAGE 2", label: "Recipient Called", desc: "The agent calls the recipient from your number within calling hours.", latency: "Live", protocol: "Your +91 number", accent: "#F59E0B" },
      { id: "l3", stage: "STAGE 3", label: "Availability Checked", desc: "It asks whether someone will be home and listens for instructions.", latency: "Real-time", protocol: "Speech-to-speech model", accent: "#E8630A" },
      { id: "l4", stage: "STAGE 4", label: "Instructions Captured", desc: "Drop-off instructions, a new date or an alternate receiver are saved as fields.", latency: "During the call", protocol: "Post-call data extraction", accent: "#F59E0B" },
      { id: "l5", stage: "STAGE 5", label: "Back to Your System", desc: "The instructions reach your TMS for the driver.", latency: "After the call", protocol: "Signed webhook", accent: "#E8630A" }
    ],
    subTopics: [
      {
        id: "delivery-confirmation",
        title: "Sub-Topic 01: Delivery-Day Availability",
        badge: "Last Mile",
        problem: "Drivers waste trips when nobody is home to receive the parcel.",
        solution: "The agent calls before the attempt and records whether someone will be there, or who can receive it instead.",
        metrics: "Availability or alternate receiver recorded",
        templateId: "tpl-9",
        templateName: "E-Commerce COD Order Confirmation",
        templateCategory: "Logistics",
        dialogue: [
          { speaker: "AI Agent", text: "Hi Priya, this is the AI assistant calling about your parcel out for delivery to Sector 62 today. Will someone be home?", time: "00:05" },
          { speaker: "Recipient", text: "I'm out. Leave it with the security guard at Gate 1.", time: "00:10" },
          { speaker: "AI Agent", text: "Understood: leave with security at Gate 1. I've noted it for the delivery partner.", time: "00:16" }
        ]
      },
      {
        id: "reschedule",
        title: "Sub-Topic 02: Rescheduling Failed Deliveries",
        badge: "Re-Attempt",
        problem: "After a failed attempt, recipients are hard to reach and parcels head back to the warehouse.",
        solution: "The agent calls after a failed attempt and records a new date and time that suits the recipient.",
        metrics: "New delivery slot recorded",
        templateId: "tpl-9",
        templateName: "E-Commerce COD Order Confirmation",
        templateCategory: "Logistics",
        dialogue: [
          { speaker: "AI Agent", text: "We tried to deliver your parcel today but couldn't reach you. When would be a good time tomorrow?", time: "00:05" },
          { speaker: "Recipient", text: "After 5 pm, please.", time: "00:08" },
          { speaker: "AI Agent", text: "Tomorrow after 5 pm. Noted, thank you.", time: "00:12" }
        ]
      },
      {
        id: "return-pickup",
        title: "Sub-Topic 03: Return Pickup Confirmation",
        badge: "Reverse Logistics",
        problem: "Return pickups fail when the customer is not ready or not home.",
        solution: "The agent confirms the pickup day and that the item is packed, or records a better day.",
        metrics: "Pickup confirmed or moved",
        templateId: "tpl-9",
        templateName: "E-Commerce COD Order Confirmation",
        templateCategory: "Logistics",
        dialogue: [
          { speaker: "AI Agent", text: "Hello, your return pickup is scheduled for tomorrow. Will the item be packed and ready?", time: "00:05" },
          { speaker: "Customer", text: "Yes, it's ready.", time: "00:08" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "call_analyzed",
  "timestamp": "2026-10-10T11:42:08.000Z",
  "data": {
    "callId": "c_8f2a1d6",
    "resultLabel": "Instructions Captured",
    "confidence": 0.91,
    "sentiment": "positive",
    "summary": "Outcome: Instructions Captured.",
    "extractedFields": {
      "waybill": "WB-9012481",
      "driver_instruction": "Leave with security at Gate 1",
      "recipient_confirmed": true
    },
    "status": "completed"
  }
}`
  },

  // ── 7. BPO & Call Centres ─────────────────────────────────────────────────
  {
    id: "bpo",
    label: "BPO & Call Centers",
    icon: Headphones,
    visual: "🎧",
    badge: "Overflow & After Hours",
    accent: "#059669",
    bgLight: "#D1FAE5",
    headline: "Take Routine and After-Hours Calls Off Your Agents",
    subhead: "Let an AI voice agent answer routine questions, take messages and collect details at night or when the queue is full, so your human team spends its time on the calls that need a person.",
    heroStat: { value: "24×7", label: "Routine calls answered" },
    stats: [
      { value: "7", label: "Indian languages + auto-detect" },
      { value: "Transcripts", label: "For every call" },
      { value: "Reports", label: "Outcome labels and QA scores" }
    ],
    wiremap: [
      { id: "b1", stage: "STAGE 1", label: "Customer Calls", desc: "The call reaches the +91 number connected to the agent.", latency: "Live", protocol: "Your +91 number", accent: "#059669" },
      { id: "b2", stage: "STAGE 2", label: "Reason for Calling", desc: "The agent finds out why the customer is calling.", latency: "Real-time", protocol: "Speech-to-speech model", accent: "#10B981" },
      { id: "b3", stage: "STAGE 3", label: "Routine Questions Answered", desc: "Order status, timings and policies come from your knowledge base or your API (Functions).", latency: "During the call", protocol: "Knowledge base / Functions", accent: "#34D399" },
      { id: "b4", stage: "STAGE 4", label: "Call-Back Requested", desc: "When a person is needed, the agent takes the details and books a call-back.", latency: "During the call", protocol: "Post-call data extraction", accent: "#059669" },
      { id: "b5", stage: "STAGE 5", label: "Ticket for Your Team", desc: "The summary and details reach your helpdesk for follow-up.", latency: "After the call", protocol: "Signed webhook", accent: "#10B981" }
    ],
    subTopics: [
      {
        id: "overflow",
        title: "Sub-Topic 01: Overflow at Peak Times",
        badge: "Overflow",
        problem: "When the queue is full, customers wait on hold or hang up.",
        solution: "Point a second number at the AI agent for overflow: it answers routine questions and books call-backs for the rest.",
        metrics: "Routine questions answered • call-backs booked",
        templateId: "tpl-1",
        templateName: "Front Desk & Department Router",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "AI Agent", text: "Thanks for calling. I'm the AI assistant. How can I help?", time: "00:03" },
          { speaker: "Customer", text: "What time does your Pune branch close today?", time: "00:07" },
          { speaker: "AI Agent", text: "The Pune branch is open until 7 pm today.", time: "00:11" }
        ]
      },
      {
        id: "after-hours",
        title: "Sub-Topic 02: After-Hours Messages",
        badge: "After Hours",
        problem: "Calls at night reach voicemail, and messages are incomplete or never returned.",
        solution: "The agent takes a complete message (name, number, reason, urgency) and your team sees it first thing in the morning.",
        metrics: "Complete message for every after-hours call",
        templateId: "tpl-11",
        templateName: "After-Hours Incident Line",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "AI Agent", text: "Our office is closed right now, but I can take a message. What is it about?", time: "00:04" },
          { speaker: "Customer", text: "My refund hasn't come yet.", time: "00:08" },
          { speaker: "AI Agent", text: "I'm sorry about that. May I have your order number? Our team will call you tomorrow morning.", time: "00:15" }
        ]
      },
      {
        id: "qa-review",
        title: "Sub-Topic 03: Quality Review Without Listening to Every Call",
        badge: "Quality",
        problem: "Supervisors cannot listen to every call to check quality.",
        solution: "Every call gets a transcript, an outcome label and a score; QA cohorts score groups of calls so supervisors review only the weak ones.",
        metrics: "Transcript, outcome label and score for every call",
        templateId: "tpl-1",
        templateName: "Front Desk & Department Router",
        templateCategory: "Customer Support",
        dialogue: [
          { speaker: "Supervisor", text: "Show me this week's calls that scored below 60.", time: "00:02" },
          { speaker: "Dashboard", text: "Call Reports → filter by score and Needs Review.", time: "00:05" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "call_analyzed",
  "timestamp": "2026-10-10T11:42:08.000Z",
  "data": {
    "callId": "c_8f2a1d7",
    "resultLabel": "Callback Requested",
    "confidence": 0.91,
    "sentiment": "positive",
    "summary": "Outcome: Callback Requested.",
    "extractedFields": {
      "caller_name": "Neha",
      "reason": "Refund status",
      "order_number": "A-55120",
      "urgency": "normal"
    },
    "status": "completed"
  }
}`
  },

  // ── 8. SaaS & Agencies ────────────────────────────────────────────────────
  {
    id: "saas",
    label: "SaaS & Agencies",
    icon: Code,
    visual: "⚡",
    badge: "API & Webhooks",
    accent: "#E8630A",
    bgLight: "#FEF3C7",
    headline: "Add AI Phone Calls to Your Product or Your Clients' Businesses",
    subhead: "Trigger calls from your own software with the REST API, receive every result on a signed webhook, and let agents call your APIs during the conversation. Agencies can build and export agents for each client.",
    heroStat: { value: "REST API", label: "Place calls from your code" },
    stats: [
      { value: "HMAC", label: "Signed webhooks" },
      { value: "Functions", label: "Your APIs during the call" },
      { value: "Export", label: "Agents as files for clients" }
    ],
    wiremap: [
      { id: "s1", stage: "STAGE 1", label: "Your App Calls the API", desc: "Create an API key in Settings and start a call with the REST API.", latency: "On demand", protocol: "REST API", accent: "#E8630A" },
      { id: "s2", stage: "STAGE 2", label: "Agent Talks", desc: "The agent you built in the dashboard handles the conversation.", latency: "Real-time", protocol: "Speech-to-speech model", accent: "#F59E0B" },
      { id: "s3", stage: "STAGE 3", label: "Functions", desc: "During the call the agent can call your endpoints, for example to look up an account.", latency: "During the call", protocol: "Functions (your API)", accent: "#E8630A" },
      { id: "s4", stage: "STAGE 4", label: "Data Extracted", desc: "The fields you defined are pulled out of the conversation.", latency: "After the call", protocol: "Post-call data extraction", accent: "#F59E0B" },
      { id: "s5", stage: "STAGE 5", label: "Webhook Delivered", desc: "Your server receives the result, signed with HMAC-SHA256 in X-Claritiy-Signature.", latency: "After the call", protocol: "Signed webhook", accent: "#E8630A" }
    ],
    subTopics: [
      {
        id: "trial-onboarding",
        title: "Sub-Topic 01: Calling New Sign-Ups",
        badge: "Onboarding",
        problem: "Many trial users never finish setting up and quietly leave.",
        solution: "Your app calls the API when someone signs up; the agent asks what they want to achieve and books a setup call for larger accounts.",
        metrics: "Goal and next step recorded for each sign-up",
        templateId: "tpl-8",
        templateName: "SaaS Free Trial Onboarding",
        templateCategory: "Sales",
        dialogue: [
          { speaker: "AI Agent", text: "Hi, this is Chris, an AI assistant. Thanks for signing up. What would you like to use the product for?", time: "00:04" },
          { speaker: "User", text: "Order confirmation calls for our online store.", time: "00:08" },
          { speaker: "AI Agent", text: "Great. Would a 15-minute setup call with our team tomorrow help?", time: "00:13" }
        ]
      },
      {
        id: "agency-clients",
        title: "Sub-Topic 02: Agencies Building Agents for Clients",
        badge: "Agencies",
        problem: "Agencies rebuild the same agent for every client by hand.",
        solution: "Build an agent once, Export it as a file and Import it into the client's workspace, then change the business details.",
        metrics: "Agents reused across workspaces",
        templateId: "tpl-3",
        templateName: "B2B Outbound Lead Qualifier",
        templateCategory: "Sales",
        dialogue: [
          { speaker: "Agency", text: "Export the receptionist agent and import it for the new clinic client.", time: "00:02" },
          { speaker: "Dashboard", text: "Agents → Export, then Import in the client's workspace.", time: "00:05" }
        ]
      },
      {
        id: "webhook-integration",
        title: "Sub-Topic 03: Results Into Your Own Database",
        badge: "Integration",
        problem: "Call results sit in yet another dashboard instead of your own system.",
        solution: "Every finished call is posted to your webhook with the outcome, the extracted fields and the transcript, signed so you can verify it.",
        metrics: "Signed post-call webhook for every call",
        templateId: "tpl-3",
        templateName: "B2B Outbound Lead Qualifier",
        templateCategory: "Sales",
        dialogue: [
          { speaker: "Your server", text: "POST /claritiy-webhook (X-Claritiy-Signature verified)", time: "00:00" }
        ]
      }
    ],
    jsonPayload: `{
  "event": "call_analyzed",
  "timestamp": "2026-10-10T11:42:08.000Z",
  "data": {
    "callId": "c_8f2a1d8",
    "resultLabel": "Qualified",
    "confidence": 0.91,
    "sentiment": "positive",
    "summary": "Outcome: Qualified.",
    "extractedFields": {
      "team_size": 30,
      "monthly_calls": 5000
    },
    "status": "completed"
  }
}`
  }
];

export default function UseCases({ setPage, initialIndustryId }: UseCasesProps) {
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>(() => {
    return initialIndustryId || "healthcare";
  });

  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(0);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [playingDialogueSubTopic, setPlayingDialogueSubTopic] = useState<string | null>(null);

  const currentTopic = USE_CASE_TOPICS.find(t => t.id === selectedIndustryId) || USE_CASE_TOPICS[0];

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
    <div className="pb-36 pt-28 bg-[#E5E3DC] min-h-screen text-[#121212] relative font-sans">
      
      {/* ── Top Vertical Navigation Bar ──────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-12">
        <div className="hatched-strip h-10 w-full mb-8" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#CBC8BE] pb-6">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#121212] flex items-center gap-1.5 mb-1">
              <Workflow className="w-3.5 h-3.5 text-[#121212]" />
              AI CALLING BY INDUSTRY
            </span>
            <h1 className="text-3xl md:text-5xl font-normal md:font-medium text-[#121212] tracking-tight font-sans">
              Production Use Case Blueprints
            </h1>
          </div>

          <button
            onClick={() => setPage("solutions")}
            className="self-start md:self-auto text-xs font-mono text-[#262523] hover:text-[#121212] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>← Back to All Solutions</span>
          </button>
        </div>

        {/* Industry Selector Tabs */}
        <div className="flex items-center gap-2 pt-6 overflow-x-auto pb-2">
          {USE_CASE_TOPICS.map((topic) => {
            const isSelected = topic.id === currentTopic.id;
            return (
              <button
                key={topic.id}
                onClick={() => {
                  setSelectedIndustryId(topic.id);
                  setActiveNodeIndex(0);
                  setPlayingDialogueSubTopic(null);
                  // A real navigation: the URL and canonical follow the industry shown (audit #131).
                  setPage("use-cases", topic.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-[2px] text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-[#121212] text-white border border-[#121212]"
                    : "bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] hover:bg-[#DFDCD4]"
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
        <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 md:p-12 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-[1px] text-xs font-mono uppercase tracking-wider border inline-flex items-center gap-1.5 bg-[#DFDCD4] border-[#CBC8BE] text-[#121212]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {currentTopic.badge}
                </span>
                <span className="text-xs font-mono text-[#262523]">
                  TOPIC SPECIFICATION
                </span>
              </div>

              <h2 className="text-2xl md:text-4xl font-medium text-[#121212] leading-tight font-sans tracking-tight">
                {currentTopic.headline}
              </h2>

              <p className="text-[#262523] text-sm md:text-base leading-relaxed max-w-3xl font-sans">
                {currentTopic.subhead}
              </p>
            </div>

            {/* Quick Metrics Card */}
            <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-6 space-y-4">
              <span className="text-[10px] font-mono text-[#262523] uppercase tracking-widest block">
                AT A GLANCE
              </span>
              <div className="space-y-1">
                <span className="text-4xl font-bold font-mono text-[#121212]">
                  {currentTopic.heroStat.value}
                </span>
                <p className="text-xs font-mono text-[#262523]">
                  {currentTopic.heroStat.label}
                </p>
              </div>

              <div className="pt-3 border-t border-[#CBC8BE] space-y-2">
                {currentTopic.stats.map((st, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-[#262523] font-mono">{st.label}</span>
                    <span className="font-mono font-bold text-[#121212]">{st.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive Architecture Wiremap ─────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-16 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#CBC8BE] pb-4">
          <div className="space-y-1">
            <span className="text-xs font-mono text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              SYSTEM WIREMAP & FLOWGRAPH
            </span>
            <h2 className="text-2xl md:text-3xl font-medium text-[#121212] font-sans tracking-tight">
              How the Call Flows, Stage by Stage
            </h2>
            <p className="text-xs text-[#262523] font-sans max-w-2xl">
              Inspect each stage of the audio pipeline from network ingress to conversational reasoning and enterprise database mutation.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#121212] bg-[#DFDCD4] px-3.5 py-1.5 rounded-[2px] border border-[#CBC8BE]">
            <span className="w-2 h-2 rounded-full bg-[#121212] animate-pulse" />
            <span>Real-time replies</span>
          </div>
        </div>

        {/* Visual Wiremap Flowchart */}
        <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-6 md:p-8 border border-[#CBC8BE] space-y-6 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            {currentTopic.wiremap.map((node, idx) => {
              const isSelected = activeNodeIndex === idx;
              return (
                <div
                  key={node.id}
                  onClick={() => setActiveNodeIndex(idx)}
                  className={`p-4 rounded-[2px] border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected 
                      ? "bg-[#DFDCD4] border-2 border-[#121212] shadow-sm" 
                      : "bg-[#DFDCD4] border-[#CBC8BE] hover:border-[#9C998F]"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-[#262523]">
                        {node.stage}
                      </span>
                      <span className="text-[10px] font-mono text-[#121212] bg-[#EBE9E2] px-1.5 py-0.5 rounded-[1px] border border-[#CBC8BE]">
                        {node.latency}
                      </span>
                    </div>

                    <h4 className="text-xs md:text-sm font-medium text-[#121212] leading-tight font-sans">
                      {node.label}
                    </h4>

                    <p className="text-[11px] text-[#262523] leading-relaxed font-sans">
                      {node.desc}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#CBC8BE]">
                    <span className="text-[10px] font-mono text-[#262523] block truncate">
                      {node.protocol}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Node Telemetry Inspector */}
          {currentTopic.wiremap[activeNodeIndex] && (
            <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#121212]" />
                  <span className="text-xs font-mono font-bold text-[#121212] uppercase">
                    STAGE: {currentTopic.wiremap[activeNodeIndex].label}
                  </span>
                </div>
                <p className="text-xs text-[#262523] font-sans">
                  {currentTopic.wiremap[activeNodeIndex].desc} Connects through: <code>{currentTopic.wiremap[activeNodeIndex].protocol}</code>.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[#121212] bg-[#EBE9E2] px-3 py-1.5 rounded-[2px] border border-[#CBC8BE]">
                  When: {currentTopic.wiremap[activeNodeIndex].latency}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 4 Dedicated Sub-Topic Cards with Dashboard Template Connectors ── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-16 space-y-8">
        <div className="space-y-2">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-wider">
            | DEEP-DIVE IMPLEMENTATION MODULES
          </span>
          <h2 className="text-2xl md:text-3xl font-medium text-[#121212] font-sans tracking-tight">
            Specific Topic Modules & Connected Dashboard Templates
          </h2>
          <p className="text-xs md:text-sm text-[#262523] font-sans max-w-3xl">
            Each sub-topic is paired with a pre-configured production template from the Claritiy Agent Studio. Click to deploy directly into your account.
          </p>
        </div>

        <div className="space-y-6">
          {currentTopic.subTopics.map((sub, index) => {
            const isPlaying = playingDialogueSubTopic === sub.id;

            return (
              <div 
                key={sub.id}
                className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 md:p-8 space-y-6 hover:border-[#9C998F] transition-colors"
              >
                {/* Header & Sub-Topic Title */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#CBC8BE] pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-[1px] bg-[#DFDCD4] text-[#121212] border border-[#CBC8BE] uppercase">
                        {sub.badge}
                      </span>
                      <span className="text-xs font-mono text-[#262523]">
                        MODULE 0{index + 1}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-medium text-[#121212] font-sans tracking-tight">
                      {sub.title}
                    </h3>
                  </div>

                  {/* Connected Dashboard Template Pill with 1-Click Action */}
                  <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-3 sm:p-4 flex items-center justify-between gap-4 self-start lg:self-auto">
                    <div>
                      <span className="text-[10px] font-mono text-[#262523] uppercase block">
                        CONNECTED AGENT TEMPLATE
                      </span>
                      <span className="text-xs font-medium text-[#121212] block font-mono">
                        {sub.templateId}: {sub.templateName}
                      </span>
                    </div>

                    <button
                      onClick={() => handleLaunchDashboardTemplate(sub.templateId)}
                      className="px-3.5 py-2 rounded-[2px] bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer font-medium"
                      title="Open and deploy this agent template inside the studio"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Launch In Studio</span>
                    </button>
                  </div>
                </div>

                {/* Problem vs Claritiy AI Solution Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-5 space-y-2">
                    <span className="text-[10px] font-mono text-[#121212] uppercase tracking-wider block font-medium">
                      LEGACY OPERATIONAL BOTTLENECK
                    </span>
                    <p className="text-xs md:text-sm text-[#262523] leading-relaxed font-sans">
                      {sub.problem}
                    </p>
                  </div>

                  <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-5 space-y-2">
                    <span className="text-[10px] font-mono text-[#121212] uppercase tracking-wider block font-medium">
                      HOW CLARITIY VOICE HANDLES IT
                    </span>
                    <p className="text-xs md:text-sm text-[#262523] leading-relaxed font-sans">
                      {sub.solution}
                    </p>
                  </div>
                </div>

                {/* Impact Metric Bar */}
                <div className="bg-[#DFDCD4] rounded-[2px] p-3.5 border border-[#CBC8BE] flex items-center gap-2 text-xs font-mono text-[#121212]">
                  <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0" />
                  <span>{sub.metrics}</span>
                </div>

                {/* Verbatim Production Call Dialogue Simulation */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#121212] uppercase flex items-center gap-1.5 font-medium">
                      <MessageSquare className="w-3.5 h-3.5 text-[#121212]" />
                      EXAMPLE CONVERSATION ({sub.dialogue.length} TURNS)
                    </span>

                    <button
                      onClick={() => setPlayingDialogueSubTopic(isPlaying ? null : sub.id)}
                      className="px-3 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] hover:bg-[#D5D1C7]"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? "Pause Simulation" : "Play Dialogue"}</span>
                    </button>
                  </div>

                  <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-4 md:p-5 space-y-2.5">
                    {sub.dialogue.map((turn, tIdx) => {
                      const isAi = turn.speaker.includes("AI") || turn.speaker.includes("Claritiy");
                      return (
                        <div 
                          key={tIdx}
                          className={`p-3 rounded-[2px] border flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                            isAi 
                              ? "bg-[#EBE9E2] border-[#CBC8BE] text-[#121212]" 
                              : "bg-[#E5E3DC] border-[#CBC8BE] text-[#121212]"
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider block text-[#121212]">
                              {turn.speaker}
                            </span>
                            <p className="text-xs md:text-sm font-sans leading-relaxed">
                              "{turn.text}"
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-[#262523] self-end sm:self-auto flex-shrink-0">
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
      <section className="px-6 max-w-7xl mx-auto relative z-10 mb-16 space-y-4">
        <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 md:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#CBC8BE] pb-4">
            <div>
              <span className="text-xs font-mono text-[#121212] uppercase flex items-center gap-1.5 font-medium">
                <Code2 className="w-3.5 h-3.5 text-[#121212]" />
                ENTERPRISE WEBHOOK PAYLOAD SPECIFICATION
              </span>
              <h3 className="text-lg md:text-xl font-medium text-[#121212] mt-1 font-sans tracking-tight">
                Production JSON Output Schema ({currentTopic.label})
              </h3>
            </div>

            <button
              onClick={handleCopyJson}
              className="px-3.5 py-2 rounded-[2px] bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer font-medium"
            >
              {copiedPayload ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPayload ? "Copied Schema" : "Copy JSON Payload"}</span>
            </button>
          </div>

          <div className="bg-[#DFDCD4] rounded-[2px] p-4 border border-[#CBC8BE] font-mono text-xs text-[#121212] overflow-x-auto">
            <pre className="leading-relaxed">{currentTopic.jsonPayload}</pre>
          </div>
        </div>
      </section>

      {/* ── Bottom Call To Action ────────────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-8 md:p-12 border border-[#CBC8BE] flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-mono text-[#121212] uppercase tracking-widest block font-medium">
              | READY TO LAUNCH YOUR VOICE AGENT?
            </span>
            <h2 className="text-2xl md:text-4xl font-normal md:font-medium text-[#121212] leading-tight font-sans tracking-tight">
              Deploy {currentTopic.label} Templates in Under 5 Minutes
            </h2>
            <p className="text-[#262523] text-xs md:text-sm font-sans leading-relaxed">
              Connect your telephony numbers, adjust the conversational prompt guardrails, and begin placing live pilot calls today.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => setPage("dashboard")}
              className="w-full sm:w-auto px-6 py-3.5 rounded-[2px] bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer font-medium"
            >
              <span>Open Agent Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage("contact")}
              className="w-full sm:w-auto px-6 py-3.5 rounded-[2px] bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] font-mono text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border border-[#CBC8BE] cursor-pointer font-medium"
            >
              <span>Talk to Solution Architect</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

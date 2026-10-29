/**
 * reportBlueprints.ts — Production Report Blueprints for all 15 Core Agent Templates
 *
 * Implements Section 5.2 Blueprint Quality Rules:
 * - Mutually exclusive & collectively exhaustive labels (at most ~8 labels + Unclear).
 * - Explicit priority order and tie-break rule.
 * - One-sentence definition per label + 2 positive and 2 negative examples.
 * - Typed fields, format/allowed values, plain definition, required flag, 'not stated' semantics.
 * - Rubrics for fact-based deterministic scoring.
 */

export interface BlueprintField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'currency' | 'duration';
  description: string;
  required: boolean;
  options?: string[];
  notStatedValue?: any;
}

export interface BlueprintLabel {
  label: string;
  definition: string;
  positiveExamples: [string, string];
  negativeExamples: [string, string];
  priority: number; // Lower number = higher precedence in tie-break
}

export interface BlueprintRubricItem {
  criterion: string;
  weight: number;
  evaluator: (fields: Record<string, any>) => number; // returns 0.0 to 1.0
}

export interface ReportBlueprint {
  templateId: string;
  templateName: string;
  category: string;
  version: string;
  tieBreakRule: string;
  labels: BlueprintLabel[];
  fields: BlueprintField[];
  rubric?: BlueprintRubricItem[];
}

export const REPORT_BLUEPRINTS: Record<string, ReportBlueprint> = {
  // ─────────────────────────────────────────────────────────────
  // 0. GENERAL CALL ANALYSIS (tpl-0)
  // ─────────────────────────────────────────────────────────────
  'tpl-0': {
    templateId: 'tpl-0',
    templateName: 'General Call Analysis',
    category: 'General',
    version: '1.0.0',
    tieBreakRule: 'Resolved beats Follow-up Required, beats Not Interested, beats Incomplete.',
    labels: [
      {
        label: 'Resolved',
        definition: 'Caller inquiry, request, or purpose was addressed successfully during the call.',
        positiveExamples: ['Thank you, that answers all my questions.', 'Great, I will proceed as advised.'],
        negativeExamples: ['I still need more information.', 'Please have someone call me back.'],
        priority: 1,
      },
      {
        label: 'Follow-up Required',
        definition: 'Conversation requires callback, escalation, or pending documentation.',
        positiveExamples: ['Please call me back tomorrow.', 'Can someone email me the details?'],
        negativeExamples: ['Everything is clear now, thank you.', 'Do not call me again.'],
        priority: 2,
      },
      {
        label: 'Not Interested',
        definition: 'Caller explicitly declined the offering or requested to end the interaction.',
        positiveExamples: ['I am not interested at this time.', 'No thank you, do not need this.'],
        negativeExamples: ['Yes please tell me more.', 'Let us talk tomorrow.'],
        priority: 3,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped or conversation was too brief or garbled to determine outcome.',
        positiveExamples: ['Hello, can you hear me? *hangup*', 'Static audio.'],
        negativeExamples: ['Yes, send me the details.', 'I am interested.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'callerName', type: 'string', description: 'Name of the caller if provided', required: false, notStatedValue: null },
      { name: 'primaryTopic', type: 'string', description: 'Primary subject or reason for the call', required: false, notStatedValue: null },
      { name: 'followUpDate', type: 'date', description: 'Agreed callback or follow-up date', required: false, notStatedValue: null },
      { name: 'satisfactionLevel', type: 'enum', description: 'Customer sentiment / satisfaction level', required: false, options: ['Satisfied', 'Neutral', 'Dissatisfied'], notStatedValue: null },
    ],
    rubric: [
      { criterion: 'Inquiry Addressed', weight: 50, evaluator: (f) => (f.primaryTopic ? 1.0 : 0.5) },
      { criterion: 'Clear Next Step', weight: 50, evaluator: (f) => (f.followUpDate ? 1.0 : 0.5) },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 1. FRONT DESK RECEPTIONIST (tpl-1)
  // ─────────────────────────────────────────────────────────────
  'tpl-1': {
    templateId: 'tpl-1',
    templateName: 'Front Desk Receptionist',
    category: 'Receptionist',
    version: '1.0.0',
    tieBreakRule: 'Safety/Outage escalations take first priority, followed by Sales inquiries, then routine Support.',
    labels: [
      {
        label: 'Priority Escalated',
        definition: 'Caller reported an active service outage or critical security concern requiring immediate tier-2 transfer.',
        positiveExamples: ['Our entire phone network is down right now.', 'System is throwing 500 errors across our production dashboard.'],
        negativeExamples: ['I just have a question about next month billing.', 'Can you show me a demo tomorrow?'],
        priority: 1,
      },
      {
        label: 'Sales Demo Scheduled',
        definition: 'Caller is exploring Claritiy Voice for their team and agreed to or requested a sales consultation.',
        positiveExamples: ['We have 50 agents and need automated calling.', 'Yes, please have your sales team call me tomorrow at 2 PM.'],
        negativeExamples: ['I want to cancel my account.', 'My password reset email is not arriving.'],
        priority: 2,
      },
      {
        label: 'Support Ticket Logged',
        definition: 'Caller reported a routine non-urgent technical question or support inquiry that was noted for engineering.',
        positiveExamples: ['How do I download call logs from last week?', 'Can someone help me configure my webhook URL?'],
        negativeExamples: ['Our entire call center is halted.', 'I want to purchase the enterprise plan.'],
        priority: 3,
      },
      {
        label: 'Self-Service Link Dispatched',
        definition: 'Caller asked for billing or self-service information and received an automated SMS portal link.',
        positiveExamples: ['Can you text me the invoice portal link?', 'I need to update my credit card on file.'],
        negativeExamples: ['Our servers are on fire.', 'I want to speak with sales right now.'],
        priority: 4,
      },
      {
        label: 'Information Provided',
        definition: 'Caller inquired about office hours, location, or general company details and received answers.',
        positiveExamples: ['What time does your office open on Mondays?', 'Where is your Bangalore headquarters located?'],
        negativeExamples: ['Transfer me to the CEO immediately.', 'I want to book 100 numbers.'],
        priority: 5,
      },
      {
        label: 'Unclear',
        definition: 'The call was dropped, silent, or the caller hung up without stating their requirement.',
        positiveExamples: ['Hello? Can you hear me? *click*', 'Static noise only.'],
        negativeExamples: ['I need help resetting my password.', 'Book a sales demo for our company.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'callerName', type: 'string', description: 'Full name of the caller', required: false, notStatedValue: null },
      { name: 'companyName', type: 'string', description: 'Caller company or organization name', required: false, notStatedValue: null },
      { name: 'departmentIntent', type: 'enum', description: 'Primary department requested', required: true, options: ['Sales', 'Technical Support', 'Billing', 'General'], notStatedValue: null },
      { name: 'urgencyLevel', type: 'enum', description: 'Urgency classification', required: true, options: ['Critical Outage', 'Routine', 'Informational'], notStatedValue: 'Routine' },
      { name: 'callbackRequested', type: 'boolean', description: 'Whether caller asked for a representative callback', required: true, notStatedValue: false },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 2. MEDICAL CLINIC RECEPTIONIST (tpl-2)
  // ─────────────────────────────────────────────────────────────
  'tpl-2': {
    templateId: 'tpl-2',
    templateName: 'Medical Clinic Receptionist',
    category: 'Receptionist',
    version: '1.0.0',
    tieBreakRule: 'Medical emergencies take first priority, followed by Appointment Booked, then Prescription Inquiries.',
    labels: [
      {
        label: 'Emergency Directed',
        definition: 'Caller reported acute medical distress and was immediately directed to emergency services.',
        positiveExamples: ['I have severe chest pains right now.', 'My child is having trouble breathing.'],
        negativeExamples: ['I need to refill my routine allergy pills.', 'Can I see the doctor on Thursday?'],
        priority: 1,
      },
      {
        label: 'Appointment Booked',
        definition: 'Patient selected an available consultation slot with a specific doctor or department.',
        positiveExamples: ['Book me for Dr. Sharma tomorrow at 10 AM.', 'Friday morning at 11 works great for me.'],
        negativeExamples: ['What are your consultation fees?', 'Do you accept Apollo insurance?'],
        priority: 2,
      },
      {
        label: 'Prescription Inquired',
        definition: 'Patient requested prescription refill, test report status, or medication dosage advice.',
        positiveExamples: ['Are my blood test results ready?', 'Can the doctor send a refill for my blood pressure medicine?'],
        negativeExamples: ['I am bleeding profusely.', 'Schedule me for next week.'],
        priority: 3,
      },
      {
        label: 'General Inquiry',
        definition: 'Inquired about doctor availability, clinic timings, or insurance acceptance.',
        positiveExamples: ['Which days is the pediatrician available?', 'Do you accept Star Health insurance?'],
        negativeExamples: ['Call an ambulance immediately.', 'Confirm my 10 AM appointment.'],
        priority: 4,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before health inquiry was determined.',
        positiveExamples: ['Hello? Hello? *line drops*', 'Incoherent muffled audio.'],
        negativeExamples: ['I want to book an appointment.', 'Is Dr. Mehta in today?'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'patientName', type: 'string', description: 'Name of the patient', required: false, notStatedValue: null },
      { name: 'patientStatus', type: 'enum', description: 'Existing or new patient', required: true, options: ['Existing Patient', 'New Patient', 'Unknown'], notStatedValue: 'Unknown' },
      { name: 'doctorSpecialty', type: 'string', description: 'Requested doctor name or specialty', required: false, notStatedValue: null },
      { name: 'preferredDate', type: 'date', description: 'Promised appointment date', required: false, notStatedValue: null },
      { name: 'isEmergency', type: 'boolean', description: 'Whether call was an emergency triage', required: true, notStatedValue: false },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 3. B2B LEAD QUALIFIER & SETTER (tpl-3)
  // ─────────────────────────────────────────────────────────────
  'tpl-3': {
    templateId: 'tpl-3',
    templateName: 'B2B Lead Qualifier & Setter',
    category: 'Outbound Sales & Reactivation',
    version: '1.0.0',
    tieBreakRule: 'Qualified Meeting Booked beats Nurture, Nurture beats Disqualified, Opt-out beats all.',
    labels: [
      {
        label: 'Meeting Booked',
        definition: 'Lead meets qualification criteria and agreed to a specific meeting time or calendar demo.',
        positiveExamples: ['Yes, let us connect tomorrow at 4 PM.', 'Send the calendar invite to rahul@acme.com.'],
        negativeExamples: ['We do not use phone calls at all.', 'Do not ever call this number again.'],
        priority: 1,
      },
      {
        label: 'Follow-up Requested',
        definition: 'Lead expressed interest but was busy or requested material sent via email/WhatsApp before booking.',
        positiveExamples: ['I am in a meeting, WhatsApp me your deck.', 'Email your pricing sheet and call me Friday.'],
        negativeExamples: ['Lock in tomorrow at 3 PM for our team.', 'We are shutting down our business.'],
        priority: 2,
      },
      {
        label: 'Disqualified',
        definition: 'Lead does not match ICP (e.g. call volume too low, no budget, wrong persona).',
        positiveExamples: ['We only receive 2 calls a month.', 'We do not have any budget for software this year.'],
        negativeExamples: ['We do 50,000 calls a day.', 'Yes, schedule a demo for our directors.'],
        priority: 3,
      },
      {
        label: 'Not Interested',
        definition: 'Lead declined the proposition politely without requesting follow-up.',
        positiveExamples: ['No thank you, we are happy with our current setup.', 'Not looking for any AI tools today.'],
        negativeExamples: ['Email me the brochure.', 'Put me on your do-not-call list immediately.'],
        priority: 4,
      },
      {
        label: 'Opted Out',
        definition: 'Lead explicitly stated Do-Not-Call or demanded number removal.',
        positiveExamples: ['Remove me from your database.', 'Do not call this phone number again.'],
        negativeExamples: ['I am busy right now, call back tomorrow.', 'What does your tool do?'],
        priority: 5,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before qualification began.',
        positiveExamples: ['Hello? *hangs up*', 'Wrong number.'],
        negativeExamples: ['We do 10,000 calls a day and need this.', 'Not interested thank you.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'monthlyCallVolume', type: 'number', description: 'Average monthly inbound/outbound calls', required: false, notStatedValue: null },
      { name: 'crmStack', type: 'string', description: 'Current telephony or CRM platform', required: false, notStatedValue: null },
      { name: 'timelineDays', type: 'duration', description: 'Deployment timeline in days', required: false, notStatedValue: null },
      { name: 'decisionMakerTitle', type: 'string', description: 'Job title of caller', required: false, notStatedValue: null },
      { name: 'budgetApproved', type: 'boolean', description: 'Whether budget has been allocated', required: false, notStatedValue: null },
    ],
    rubric: [
      { criterion: 'Call Volume > 2000', weight: 40, evaluator: (f) => (f.monthlyCallVolume && f.monthlyCallVolume >= 2000 ? 1.0 : (f.monthlyCallVolume ? 0.3 : 0.0)) },
      { criterion: 'Timeline < 30 days', weight: 30, evaluator: (f) => (f.timelineDays !== null && f.timelineDays !== undefined && f.timelineDays <= 30 ? 1.0 : 0.5) },
      { criterion: 'Budget Approved', weight: 30, evaluator: (f) => (f.budgetApproved === true ? 1.0 : (f.budgetApproved === false ? 0.0 : 0.5)) },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 4. WIN-BACK & CHURN REACTIVATION AGENT (tpl-4)
  // ─────────────────────────────────────────────────────────────
  'tpl-4': {
    templateId: 'tpl-4',
    templateName: 'Win-back & Churn Reactivation Agent',
    category: 'Outbound Sales & Reactivation',
    version: '1.0.0',
    tieBreakRule: 'Reactivated takes precedence, followed by Dispute, then Competitor Lost.',
    labels: [
      {
        label: 'Reactivated',
        definition: 'Customer agreed to reactivate subscription or accepted a renewal discount.',
        positiveExamples: ['Yes, with that 30% discount I will turn the subscription back on.', 'Reactivate my plan starting Monday.'],
        negativeExamples: ['I switched to your competitor and hate your tool.', 'Stop calling me.'],
        priority: 1,
      },
      {
        label: 'Feedback Captured',
        definition: 'Customer explained reason for churn (pricing, UX, competitor) without reactivating.',
        positiveExamples: ['We left because your billing dashboard was confusing.', 'We found an alternative that was half the price.'],
        negativeExamples: ['Yes please recharge my account.', 'Hello? Who is this?'],
        priority: 2,
      },
      {
        label: 'Billing Dispute',
        definition: 'Customer claimed wrongful charges or disputed refund.',
        positiveExamples: ['You charged me after I cancelled in August.', 'I want my 5,000 rupees refund before talking.'],
        negativeExamples: ['Everything was great just team moved to another project.', 'I will renew next month.'],
        priority: 3,
      },
      {
        label: 'Firm Decline',
        definition: 'Customer stated they will not return under any circumstances.',
        positiveExamples: ['No, we have permanently moved on.', 'Do not contact us regarding this tool.'],
        negativeExamples: ['Send me the new discount coupon.', 'Let me think about it.'],
        priority: 4,
      },
      {
        label: 'Unclear',
        definition: 'Call disconnected before churn reason could be determined.',
        positiveExamples: ['*Immediate hangup*', 'Wrong number.'],
        negativeExamples: ['I left because of your pricing.', 'Yes reactivate my service.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'churnReason', type: 'enum', description: 'Primary reason for churn', required: false, options: ['Pricing', 'Product Bugs', 'Switched Competitor', 'Downsizing', 'No Longer Needed', 'Billing Dispute'], notStatedValue: null },
      { name: 'offerAccepted', type: 'boolean', description: 'Whether the win-back offer was accepted', required: true, notStatedValue: false },
      { name: 'competitorName', type: 'string', description: 'Competitor platform chosen if mentioned', required: false, notStatedValue: null },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 5. DENTAL CLINIC SCHEDULER (tpl-5)
  // ─────────────────────────────────────────────────────────────
  'tpl-5': {
    templateId: 'tpl-5',
    templateName: 'Dental Clinic Scheduler',
    category: 'Appointment Booking',
    version: '1.0.0',
    tieBreakRule: 'Appointment Booked beats Inquired, Inquired beats Rescheduled, Cancelled is separate.',
    labels: [
      {
        label: 'Appointment Booked',
        definition: 'Patient confirmed a dental appointment time slot.',
        positiveExamples: ['Book my tooth cleaning for Wednesday 3 PM.', 'Yes, tomorrow 10 AM with Dr. Gupta is confirmed.'],
        negativeExamples: ['How much is a root canal?', 'I want to cancel my visit.'],
        priority: 1,
      },
      {
        label: 'Rescheduled',
        definition: 'Patient moved an existing appointment to a new date/time.',
        positiveExamples: ['I cannot make Tuesday, move it to Friday afternoon.', 'Reschedule my checkup to next week.'],
        negativeExamples: ['I am a new patient wanting to book.', 'Confirm my appointment for today.'],
        priority: 2,
      },
      {
        label: 'Cancelled',
        definition: 'Patient cancelled their appointment without rebooking.',
        positiveExamples: ['Please cancel my appointment tomorrow.', 'I cannot come this week, just cancel it.'],
        negativeExamples: ['Move it to Friday.', 'Confirm my Wednesday cleaning.'],
        priority: 3,
      },
      {
        label: 'Price Inquired',
        definition: 'Patient asked about costs of procedures without booking.',
        positiveExamples: ['How much do braces cost?', 'What is your consultation fee for tooth extraction?'],
        negativeExamples: ['Book me for tomorrow.', 'Cancel my appointment.'],
        priority: 4,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped or unintelligible.',
        positiveExamples: ['Hello? *silence*', 'Static audio.'],
        negativeExamples: ['Schedule my cleaning for 4 PM.', 'How much is root canal?'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'serviceType', type: 'enum', description: 'Dental treatment requested', required: false, options: ['Cleaning', 'Root Canal', 'Extraction', 'Braces/Invisalign', 'Consultation', 'Toothache Emergency'], notStatedValue: null },
      { name: 'scheduledDate', type: 'date', description: 'Confirmed appointment date', required: false, notStatedValue: null },
      { name: 'patientStatus', type: 'enum', description: 'New vs existing patient', required: true, options: ['New', 'Existing', 'Unknown'], notStatedValue: 'Unknown' },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 6. HOME SERVICES BOOKING AGENT (tpl-6)
  // ─────────────────────────────────────────────────────────────
  'tpl-6': {
    templateId: 'tpl-6',
    templateName: 'Home Services Booking Agent',
    category: 'Appointment Booking',
    version: '1.0.0',
    tieBreakRule: 'Service Scheduled beats Quote Requested, beats Outside Service Area.',
    labels: [
      {
        label: 'Service Scheduled',
        definition: 'Homeowner agreed to an inspection or repair service visit slot.',
        positiveExamples: ['Send the technician tomorrow between 2 and 4 PM.', 'Yes, Thursday morning for AC repair is confirmed.'],
        negativeExamples: ['Do you serve Whitefield?', 'What is your plumbing hourly rate?'],
        priority: 1,
      },
      {
        label: 'Quote Requested',
        definition: 'Caller asked for an estimate or pricing breakdown before scheduling.',
        positiveExamples: ['How much will it cost to service 3 split AC units?', 'What is your estimate for full house painting?'],
        negativeExamples: ['Confirmed, see you tomorrow at 10 AM.', 'We are outside your city.'],
        priority: 2,
      },
      {
        label: 'Outside Service Area',
        definition: 'Customer location is outside the operational service radius.',
        positiveExamples: ['We are in Hosur, can you send someone?', 'Do you service Panvel?'],
        negativeExamples: ['I am in Indiranagar, 2nd stage.', 'Confirm tomorrow visit.'],
        priority: 3,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before service requirement determined.',
        positiveExamples: ['Hello? *dropped*', 'Wrong number.'],
        negativeExamples: ['My AC is leaking water.', 'Send a plumber tomorrow.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'serviceCategory', type: 'enum', description: 'Type of trade', required: true, options: ['Plumbing', 'Electrical', 'AC Service', 'Painting', 'Appliance Repair', 'Carpentry', 'Other'], notStatedValue: 'Other' },
      { name: 'pinCode', type: 'string', description: '6-digit service location PIN code', required: false, notStatedValue: null },
      { name: 'preferredSlot', type: 'string', description: 'Requested time window', required: false, notStatedValue: null },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 7. REAL ESTATE INBOUND QUALIFIER (tpl-7)
  // ─────────────────────────────────────────────────────────────
  'tpl-7': {
    templateId: 'tpl-7',
    templateName: 'Real Estate Inbound Qualifier',
    category: 'Lead Qualification',
    version: '1.0.0',
    tieBreakRule: 'Site Visit Booked beats Qualified Buyer, beats Investor, beats Budget Mismatch.',
    labels: [
      {
        label: 'Site Visit Booked',
        definition: 'Prospect scheduled a specific date/time to visit property site.',
        positiveExamples: ['I will come for site visit this Saturday at 11 AM.', 'Book my visit for Prestige Heights on Sunday.'],
        negativeExamples: ['Just email me the brochure.', 'What is the price per square foot?'],
        priority: 1,
      },
      {
        label: 'Brochure Dispatched',
        definition: 'Prospect asked for floor plans and pricing deck sent via WhatsApp or email.',
        positiveExamples: ['WhatsApp me the 3 BHK floor plans and payment schedule.', 'Email the project brochure to amit@gmail.com.'],
        negativeExamples: ['I will visit the site tomorrow morning.', 'My budget is 10 lakhs for a 4 BHK.'],
        priority: 2,
      },
      {
        label: 'Budget Mismatch',
        definition: 'Prospect budget is significantly below project entry price.',
        positiveExamples: ['I want a luxury villa under 30 lakhs in central Bangalore.', 'My maximum budget is 25 lakhs.'],
        negativeExamples: ['My budget is 2.5 crore.', 'I will visit this weekend.'],
        priority: 3,
      },
      {
        label: 'Not Interested',
        definition: 'Prospect declined after hearing project location or possession date.',
        positiveExamples: ['2028 is too late for possession, I need ready-to-move.', 'The location is too far from my office.'],
        negativeExamples: ['Book a visit for Saturday.', 'Send the brochure to my WhatsApp.'],
        priority: 4,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before qualification.',
        positiveExamples: ['Hello? *click*', 'Blank audio.'],
        negativeExamples: ['Looking for 2 BHK near Electronic City.', 'Site visit on Sunday.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'configuration', type: 'enum', description: 'BHK type', required: false, options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK+', 'Villa', 'Plot'], notStatedValue: null },
      { name: 'buyerBudget', type: 'currency', description: 'Max budget in INR', required: false, notStatedValue: null },
      { name: 'possessionTimeline', type: 'enum', description: 'Timeline preference', required: false, options: ['Ready to Move', 'Under Construction < 1 Year', 'Under Construction > 1 Year', 'Any'], notStatedValue: null },
      { name: 'siteVisitDate', type: 'date', description: 'Promised site visit date', required: false, notStatedValue: null },
    ],
    rubric: [
      { criterion: 'Budget >= 1 Crore', weight: 50, evaluator: (f) => (f.buyerBudget && f.buyerBudget >= 10000000 ? 1.0 : (f.buyerBudget ? 0.4 : 0.0)) },
      { criterion: 'Site Visit Confirmed', weight: 50, evaluator: (f) => (f.siteVisitDate ? 1.0 : 0.0) },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 8. SAAS FREE TRIAL ONBOARDING AGENT (tpl-8)
  // ─────────────────────────────────────────────────────────────
  'tpl-8': {
    templateId: 'tpl-8',
    templateName: 'SaaS Free Trial Onboarding Agent',
    category: 'Lead Qualification',
    version: '1.0.0',
    tieBreakRule: 'Paid Upgrade beats Onboarding Demo Booked, beats Stuck Blocked.',
    labels: [
      {
        label: 'Onboarding Demo Booked',
        definition: 'Trial user agreed to a guided onboarding session with customer success.',
        positiveExamples: ['Yes, let us walk through the setup tomorrow at 3 PM.', 'Book my onboarding call for Friday.'],
        negativeExamples: ['I already upgraded to the Pro plan.', 'I cannot figure out how to invite team members.'],
        priority: 1,
      },
      {
        label: 'Technical Blocker Captured',
        definition: 'Trial user is stuck on a specific integration, API key, or setup issue.',
        positiveExamples: ['Our webhook keeps returning 401 unauthorized.', 'I cannot import our CSV contact list.'],
        negativeExamples: ['Everything is working great, love the tool.', 'Schedule our onboarding session.'],
        priority: 2,
      },
      {
        label: 'Self-Sufficient / Active',
        definition: 'Trial user confirmed they have successfully tested the tool and do not need assistance.',
        positiveExamples: ['We already made our first 100 test calls and it works smoothly.', 'All good, my developer finished the setup.'],
        negativeExamples: ['I cannot get this to work at all.', 'Book a call to teach me.'],
        priority: 3,
      },
      {
        label: 'Trial Dropped / Discontinued',
        definition: 'User decided not to move forward with the product.',
        positiveExamples: ['We decided to build this internally instead.', 'We chose another vendor for our needs.'],
        negativeExamples: ['We love the tool and are testing today.', 'Help me fix my webhook.'],
        priority: 4,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before status determination.',
        positiveExamples: ['Hello? *silence*', 'Busy right now *hangup*.'],
        negativeExamples: ['Our webhook is failing.', 'Book our demo for tomorrow.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'setupStatus', type: 'enum', description: 'Product adoption stage', required: true, options: ['Not Started', 'In Progress', 'Blocked', 'Fully Deployed'], notStatedValue: 'Not Started' },
      { name: 'blockerReason', type: 'string', description: 'Technical hurdle or feature gap', required: false, notStatedValue: null },
      { name: 'teamSeats', type: 'number', description: 'Expected active team members', required: false, notStatedValue: null },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 9. E-COMMERCE ORDER STATUS & RETURNS (tpl-9)
  // ─────────────────────────────────────────────────────────────
  'tpl-9': {
    templateId: 'tpl-9',
    templateName: 'E-commerce Order Status & Returns',
    category: 'Customer Support',
    version: '1.0.0',
    tieBreakRule: 'Return Initiated beats Tracking Provided, beats Refund Escalation.',
    labels: [
      {
        label: 'Return Initiated',
        definition: 'Customer requested return/replacement and pickup was scheduled.',
        positiveExamples: ['The shoe size is too small, I need a size 9 replacement.', 'Product arrived damaged, please initiate a return.'],
        negativeExamples: ['Where is my package right now?', 'Can you tell me your delivery charges?'],
        priority: 1,
      },
      {
        label: 'Tracking Provided',
        definition: 'Customer inquired about delivery timeline and received status update.',
        positiveExamples: ['When will order 88291 arrive at my house?', 'Has my shipment left the Delhi warehouse?'],
        negativeExamples: ['I want to return the damaged dress.', 'My refund was not processed.'],
        priority: 2,
      },
      {
        label: 'Refund Inquired',
        definition: 'Customer inquired about refund timeline for previously returned item.',
        positiveExamples: ['Pickup was done 3 days ago, where is my refund in bank?', 'When will my 1,299 rupees be credited back?'],
        negativeExamples: ['Schedule a pickup for tomorrow.', 'Track my new order.'],
        priority: 3,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before order number or intent was shared.',
        positiveExamples: ['Hello? *cut*', 'Muffled noise.'],
        negativeExamples: ['Where is order 12345?', 'I want to exchange my shirt.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'orderNumber', type: 'string', description: 'E-commerce order ID', required: false, notStatedValue: null },
      { name: 'supportIntent', type: 'enum', description: 'Primary request category', required: true, options: ['Tracking', 'Return / Exchange', 'Refund Status', 'Cancellation', 'Product Defect'], notStatedValue: 'Tracking' },
      { name: 'shippingZip', type: 'string', description: 'Delivery postal code', required: false, notStatedValue: null },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 10. RESTAURANT RESERVATION & TAKEOUT AGENT (tpl-10)
  // ─────────────────────────────────────────────────────────────
  'tpl-10': {
    templateId: 'tpl-10',
    templateName: 'Restaurant Reservation & Takeout Agent',
    category: 'Appointment Booking',
    version: '1.0.0',
    tieBreakRule: 'Reservation Confirmed beats Takeout Order, beats Fully Booked.',
    labels: [
      {
        label: 'Reservation Confirmed',
        definition: 'Table booking confirmed with party size and time slot.',
        positiveExamples: ['Table for 4 tonight at 8 PM under Sharma.', 'Book a booth for 6 people this Saturday.'],
        negativeExamples: ['Are you pure vegetarian?', 'Do you deliver to Koramangala?'],
        priority: 1,
      },
      {
        label: 'Fully Booked',
        definition: 'Requested time slot was unavailable and customer did not choose alternative.',
        positiveExamples: ['Sorry, 8 PM is completely booked, customer declined 9:30 PM.', 'No tables available for 10 people tonight.'],
        negativeExamples: ['Confirmed table for 4 at 8 PM.', 'We will take the 9 PM slot instead.'],
        priority: 2,
      },
      {
        label: 'Menu Inquired',
        definition: 'Caller asked about dietary options, alcohol policy, or timings.',
        positiveExamples: ['Do you serve Jain food?', 'Is outside liquor allowed for private parties?'],
        negativeExamples: ['Book a table for 2 right now.', 'We cannot accommodate your party.'],
        priority: 3,
      },
      {
        label: 'Unclear',
        definition: 'Call disconnected before booking details determined.',
        positiveExamples: ['Hello? *busy signal*', 'Background chatter only.'],
        negativeExamples: ['Book table for 2 at 7 PM.', 'Do you have vegan dishes?'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'partySize', type: 'number', description: 'Number of guests', required: false, notStatedValue: null },
      { name: 'reservationDate', type: 'date', description: 'Date of booking', required: false, notStatedValue: null },
      { name: 'reservationTime', type: 'string', description: 'Time of reservation', required: false, notStatedValue: null },
      { name: 'specialRequests', type: 'string', description: 'Dietary, seating, or occasion notes', required: false, notStatedValue: null },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 11. AUTOMOBILE SERVICE & TEST DRIVE BOOKING (tpl-11)
  // ─────────────────────────────────────────────────────────────
  'tpl-11': {
    templateId: 'tpl-11',
    templateName: 'Automobile Service & Test Drive Booking',
    category: 'Appointment Booking',
    version: '1.0.0',
    tieBreakRule: 'Test Drive Booked beats Service Slot Confirmed, beats General Inquiry.',
    labels: [
      {
        label: 'Test Drive Booked',
        definition: 'Customer scheduled a vehicle test drive appointment.',
        positiveExamples: ['Book a test drive for the new Creta this Sunday at 11 AM.', 'I want to test drive the EV model tomorrow.'],
        negativeExamples: ['My car brake pads need replacement.', 'What is the on-road price of the base model?'],
        priority: 1,
      },
      {
        label: 'Service Scheduled',
        definition: 'Vehicle maintenance or repair appointment confirmed with dealership.',
        positiveExamples: ['Book my 20,000 km periodic service for Friday morning.', 'Schedule pick up for oil change and wheel alignment.'],
        negativeExamples: ['I want to test drive the sedan.', 'What is the waiting period for delivery?'],
        priority: 2,
      },
      {
        label: 'Price Inquired',
        definition: 'Inquired about vehicle on-road pricing, variants, or exchange value.',
        positiveExamples: ['What is the on-road price for top variant in Mumbai?', 'Do you have exchange bonus for my 2018 Swift?'],
        negativeExamples: ['Book the test drive for Saturday.', 'Pick up my car for service.'],
        priority: 3,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before inquiry determined.',
        positiveExamples: ['Hello? *dropped*', 'Wrong number.'],
        negativeExamples: ['Book test drive for Sunday.', 'Schedule 30,000 km service.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'vehicleModel', type: 'string', description: 'Car model name', required: false, notStatedValue: null },
      { name: 'serviceType', type: 'enum', description: 'Test Drive vs Maintenance', required: true, options: ['Test Drive', 'Periodic Service', 'Repair / Breakdown', 'Insurance Renewal', 'Price Inquiry'], notStatedValue: 'Price Inquiry' },
      { name: 'appointmentDate', type: 'date', description: 'Promised appointment date', required: false, notStatedValue: null },
      { name: 'homePickupRequired', type: 'boolean', description: 'Whether home vehicle pickup was requested', required: false, notStatedValue: false },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 12. RECRUITMENT PRE-SCREENING & INTERVIEW SETTER (tpl-12)
  // ─────────────────────────────────────────────────────────────
  'tpl-12': {
    templateId: 'tpl-12',
    templateName: 'Recruitment Pre-screening & Interview Setter',
    category: 'Lead Qualification',
    version: '1.0.0',
    tieBreakRule: 'Interview Scheduled beats Strong Fit, beats Not Looking, beats Compensation Mismatch.',
    labels: [
      {
        label: 'Interview Scheduled',
        definition: 'Candidate agreed to a technical or manager interview slot.',
        positiveExamples: ['Tomorrow at 11 AM works for my technical round.', 'Yes, schedule the Google Meet with hiring manager for Friday.'],
        negativeExamples: ['I am not looking for a job switch right now.', 'My salary expectation is 50 LPA.'],
        priority: 1,
      },
      {
        label: 'Strong Fit',
        definition: 'Candidate meets all pre-screening criteria (experience, tech stack, notice period) and is interested.',
        positiveExamples: ['I have 4 years in React and Node, immediate joiner, interested in the role.', '6 years in voice engineering, 15 days notice.'],
        negativeExamples: ['I only have 6 months experience for senior role.', 'I just signed an offer with another company yesterday.'],
        priority: 2,
      },
      {
        label: 'Compensation Mismatch',
        definition: 'Candidate current or expected compensation exceeds the position budget.',
        positiveExamples: ['My current CTC is 35 LPA, I cannot take a cut for 20 LPA budget.', 'I am expecting minimum 40 LPA.'],
        negativeExamples: ['My expectation is 12 LPA, within your range.', 'Schedule my interview for Wednesday.'],
        priority: 3,
      },
      {
        label: 'Not Looking',
        definition: 'Candidate stated they are happy in current role or not seeking changes.',
        positiveExamples: ['I just got promoted, not exploring new roles.', 'Not looking for a job change at this moment.'],
        negativeExamples: ['Send me the JD on WhatsApp.', 'I am actively interviewing right now.'],
        priority: 4,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before screening questions completed.',
        positiveExamples: ['I am in the metro, cannot talk *cut*.', 'Static audio.'],
        negativeExamples: ['Yes I have 5 years experience.', 'Book my interview for tomorrow.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'yearsExperience', type: 'number', description: 'Total years of relevant experience', required: false, notStatedValue: null },
      { name: 'currentCtcLakhs', type: 'number', description: 'Current CTC in Lakhs Per Annum', required: false, notStatedValue: null },
      { name: 'expectedCtcLakhs', type: 'number', description: 'Expected CTC in Lakhs Per Annum', required: false, notStatedValue: null },
      { name: 'noticePeriodDays', type: 'duration', description: 'Notice period in days', required: false, notStatedValue: null },
      { name: 'primaryTechStack', type: 'string', description: 'Primary technical skills or domain', required: false, notStatedValue: null },
    ],
    rubric: [
      {
        criterion: 'Experience >= 3 years',
        weight: 40,
        evaluator: (f) => (
          f.yearsExperience && f.yearsExperience >= 8 ? 1.0 :
          (f.yearsExperience && f.yearsExperience >= 5 ? 0.8 :
          (f.yearsExperience && f.yearsExperience >= 3 ? 0.6 :
          (f.yearsExperience ? 0.3 : 0.0)))
        ),
      },
      { criterion: 'Notice Period <= 30 days', weight: 30, evaluator: (f) => (f.noticePeriodDays !== null && f.noticePeriodDays !== undefined && f.noticePeriodDays <= 30 ? 1.0 : 0.4) },
      { criterion: 'Salary Alignment', weight: 30, evaluator: (f) => (f.expectedCtcLakhs && f.expectedCtcLakhs <= 25 ? 1.0 : 0.5) },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 13. INSURANCE CLAIM INTAKE & POLICY RENEWAL (tpl-13)
  // ─────────────────────────────────────────────────────────────
  'tpl-13': {
    templateId: 'tpl-13',
    templateName: 'Insurance Claim Intake & Policy Renewal',
    category: 'BFSI Collections & Reminders',
    version: '1.0.0',
    tieBreakRule: 'Claim Initiated beats Renewal Payment Promised, beats Dispute.',
    labels: [
      {
        label: 'Claim Initiated',
        definition: 'Policyholder reported an incident, hospital admission, or damage to initiate a claim.',
        positiveExamples: ['My car met with an accident this morning on the highway.', 'Patient has been admitted to Manipal hospital for emergency surgery.'],
        negativeExamples: ['When is my car insurance premium due?', 'I want to renew my term policy.'],
        priority: 1,
      },
      {
        label: 'Renewal Payment Promised',
        definition: 'Policyholder agreed to renew policy and committed to a payment date.',
        positiveExamples: ['Send me the UPI link, I will pay the renewal today.', 'I will pay the premium on Friday when my salary credits.'],
        negativeExamples: ['I want to surrender my policy.', 'File a cashless hospitalization claim.'],
        priority: 2,
      },
      {
        label: 'Policy Lapsed / Cancelled',
        definition: 'Policyholder stated they have switched insurers or will not renew.',
        positiveExamples: ['I already bought health insurance from HDFC Ergo.', 'Do not renew, I am letting this policy lapse.'],
        negativeExamples: ['Send me the renewal discount quote.', 'Where is the nearest network hospital?'],
        priority: 3,
      },
      {
        label: 'Claim Status Inquired',
        definition: 'Inquired about reimbursement or cashless approval status.',
        positiveExamples: ['Has my claim number CLM9021 been approved yet?', 'Why was only 60,000 reimbursed out of 80,000?'],
        negativeExamples: ['File a new claim for my accident.', 'I will pay the renewal today.'],
        priority: 4,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before policy details determined.',
        positiveExamples: ['Hello? *line dead*', 'Wrong number.'],
        negativeExamples: ['My car was hit by a truck.', 'Send renewal payment link.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'policyNumber', type: 'string', description: 'Insurance policy identifier', required: false, notStatedValue: null },
      { name: 'insuranceType', type: 'enum', description: 'Category of insurance', required: true, options: ['Health', 'Motor', 'Life / Term', 'Home', 'Travel'], notStatedValue: 'Health' },
      { name: 'promisedPaymentDate', type: 'date', description: 'Promised renewal date', required: false, notStatedValue: null },
      { name: 'claimAmount', type: 'currency', description: 'Claim value in INR', required: false, notStatedValue: null },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 14. BANKING KYC & ACCOUNT VERIFICATION REMINDER (tpl-14)
  // ─────────────────────────────────────────────────────────────
  'tpl-14': {
    templateId: 'tpl-14',
    templateName: 'Banking KYC & Account Verification Reminder',
    category: 'BFSI Collections & Reminders',
    version: '1.0.0',
    tieBreakRule: 'Safety/Fraud flags take top priority, followed by Branch Visit Scheduled, then Online KYC Promised.',
    labels: [
      {
        label: 'Fraud / Phishing Alert',
        definition: 'Customer reported unauthorized debit, stolen card, or suspicious activity.',
        positiveExamples: ['I got an OTP message but I did not initiate any transaction!', 'Someone just withdrew 20,000 from my account in another city.'],
        negativeExamples: ['I will complete my Aadhaar KYC tomorrow.', 'Which branch is open on Saturday?'],
        priority: 1,
      },
      {
        label: 'Branch Visit Scheduled',
        definition: 'Customer agreed to visit physical branch with documents for biometric KYC.',
        positiveExamples: ['I will visit your Indiranagar branch on Thursday morning.', 'I will bring my PAN card to the bank on Saturday.'],
        negativeExamples: ['I already completed video KYC online.', 'Why did money deduct from my card?'],
        priority: 2,
      },
      {
        label: 'Online KYC Promised',
        definition: 'Customer committed to completing Video KYC via official mobile app or netbanking.',
        positiveExamples: ['I will do the video KYC on the app tonight.', 'Send the secure portal link on my registered mobile number.'],
        negativeExamples: ['I am closing my bank account.', 'Block my credit card immediately.'],
        priority: 3,
      },
      {
        label: 'Account Closed / Refused',
        definition: 'Customer stated they no longer use or want the bank account.',
        positiveExamples: ['I already closed this account last year.', 'I do not want this account, please close it.'],
        negativeExamples: ['I will visit the branch tomorrow.', 'Send me the app link.'],
        priority: 4,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before KYC status determined.',
        positiveExamples: ['Hello? *busy tone*', 'Wrong number.'],
        negativeExamples: ['I will do video KYC tonight.', 'Someone stole my card.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'kycMethod', type: 'enum', description: 'Planned verification mode', required: true, options: ['Video KYC App', 'Branch Visit', 'Doorstep Biometric', 'Already Completed', 'Refused'], notStatedValue: 'Video KYC App' },
      { name: 'promisedDate', type: 'date', description: 'Promised completion date', required: false, notStatedValue: null },
      { name: 'fraudReported', type: 'boolean', description: 'Whether customer reported unauthorized transaction', required: true, notStatedValue: false },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 15. LOAN EMI & DEBT COLLECTIONS RECOVERY (tpl-15)
  // ─────────────────────────────────────────────────────────────
  'tpl-15': {
    templateId: 'tpl-15',
    templateName: 'Loan EMI & Debt Collections Recovery',
    category: 'BFSI Collections & Reminders',
    version: '1.0.0',
    tieBreakRule: 'BFSI Safety: Severe Distress/Medical emergency takes first priority, followed by Dispute, Promise to Pay, then Refusal.',
    labels: [
      {
        label: 'Severe Distress / Emergency',
        definition: 'Borrower reported hospitalization, bereavement, or acute distress requiring compassionate pause per RBI/BFSI safety rules.',
        positiveExamples: ['I am in the ICU hospital with my mother, cannot talk.', 'There has been a death in my immediate family.'],
        negativeExamples: ['I will pay on the 5th when salary comes.', 'Your interest calculation is wrong.'],
        priority: 1,
      },
      {
        label: 'Promise to Pay',
        definition: 'Borrower committed to a specific payment date and amount for overdue EMI.',
        positiveExamples: ['I will pay 12,500 rupees on Friday 5th November.', 'My salary credits on 1st, I will clear the installment then.'],
        negativeExamples: ['I will never pay you back.', 'I am admitted in the hospital.'],
        priority: 2,
      },
      {
        label: 'Dispute / Already Paid',
        definition: 'Borrower claimed installment was already deducted or disputes statement.',
        positiveExamples: ['Money was already debited from my HDFC account on the 2nd.', 'Your collection agency is harassing me for a paid loan.'],
        negativeExamples: ['I will pay next Monday.', 'I lost my job and cannot pay.'],
        priority: 3,
      },
      {
        label: 'Financial Hardship',
        definition: 'Borrower expressed inability to pay due to job loss, illness, or business loss, requesting restructuring.',
        positiveExamples: ['I lost my job two months ago, I cannot afford 15,000 EMI.', 'My business shut down, can you restructure my loan tenure?'],
        negativeExamples: ['I will pay tomorrow morning.', 'Already paid via UPI.'],
        priority: 4,
      },
      {
        label: 'Refusal to Pay',
        definition: 'Borrower explicitly refused to clear dues or used abusive non-cooperative language.',
        positiveExamples: ['I will not pay a single rupee to your bank.', 'Do whatever legal action you want, I am not paying.'],
        negativeExamples: ['I am in the hospital.', 'I will pay on the 10th.'],
        priority: 5,
      },
      {
        label: 'Unclear',
        definition: 'Call dropped before collection status determined.',
        positiveExamples: ['Hello? *line cut*', 'Wrong number.'],
        negativeExamples: ['I will pay on Friday.', 'Already paid.'],
        priority: 99,
      },
    ],
    fields: [
      { name: 'promisedPaymentDate', type: 'date', description: 'Promised repayment date', required: false, notStatedValue: null },
      { name: 'promisedAmountInr', type: 'currency', description: 'Promised payment amount in INR', required: false, notStatedValue: null },
      { name: 'overdueReason', type: 'enum', description: 'Reason for non-payment', required: false, options: ['Salary Delay', 'Job Loss', 'Medical Emergency', 'Bank Server Glitch', 'Dispute', 'Willful Default'], notStatedValue: null },
      { name: 'alreadyPaidClaimed', type: 'boolean', description: 'Whether borrower claimed payment was already made', required: true, notStatedValue: false },
      { name: 'distressFlag', type: 'boolean', description: 'Compassionate hold required', required: true, notStatedValue: false },
    ],
  },
};

/**
 * Validates a blueprint against quality rules:
 * - Mutually exclusive & collectively exhaustive labels (at most 8 labels + Unclear).
 * - Explicit priority order without duplicates.
 * - 2 positive and 2 negative examples per label.
 * - Typed fields with required flag.
 */
export function validateBlueprintQuality(bp: ReportBlueprint): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!bp.templateId) errors.push('Missing templateId');
  if (!bp.labels || bp.labels.length === 0) errors.push('Blueprint declared no labels');
  if (bp.labels.length > 9) errors.push(`Too many labels (${bp.labels.length}). Maximum allowed is 8 labels + Unclear.`);

  const hasUnclear = bp.labels.some(l => l.label.toLowerCase() === 'unclear');
  if (!hasUnclear) errors.push("Blueprint must include an 'Unclear' fallback label.");

  const priorities = new Set<number>();
  for (const label of bp.labels) {
    if (!label.definition || label.definition.trim().length === 0) {
      errors.push(`Label '${label.label}' is missing a one-sentence definition.`);
    }
    if (!label.positiveExamples || label.positiveExamples.length < 2) {
      errors.push(`Label '${label.label}' requires at least 2 positive examples.`);
    }
    if (!label.negativeExamples || label.negativeExamples.length < 2) {
      errors.push(`Label '${label.label}' requires at least 2 negative examples.`);
    }
    if (priorities.has(label.priority)) {
      errors.push(`Duplicate label priority order '${label.priority}' found for '${label.label}'.`);
    }
    priorities.add(label.priority);
  }

  for (const field of bp.fields) {
    if (!field.name) errors.push('Field missing name');
    if (!field.type) errors.push(`Field '${field.name}' missing type`);
    if (field.required === undefined) errors.push(`Field '${field.name}' must declare required boolean`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

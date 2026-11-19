# Compliance notes

Conservative choices made in code, and items a qualified professional (CA / lawyer) must confirm. This is not legal advice.

## Payments, GST invoices (Phase 6, B13)
- **Seller GSTIN.** Invoices print the company GSTIN only from the `COMPANY_GSTIN` environment variable.
  - The old code printed a hard-coded GSTIN (`27AAACC…`) on every invoice when that variable was missing. That GSTIN is not known to be ours, so printing it would make the invoice a false tax document.
  - Without `COMPANY_GSTIN` the document is now titled "PAYMENT RECEIPT", not "TAX INVOICE".
  - **Owner:** set `COMPANY_GSTIN` on Render once GST registration exists. Check whether invoices already issued carried the wrong GSTIN; they may need credit notes or re-issue (ask your CA).
- **Invoice numbering.** New numbers are consecutive per Indian financial year (April–March, IST), for example `CLR-FY26-27-0001`, because GST rule 46 requires a unique consecutive serial per financial year.
  - Older invoices keep their `CLR-YYYY-NNNN` numbers.
  - A database lock prevents two purchases from getting the same number.
- **CGST/SGST vs IGST.** The invoice shows:
  - CGST 9% + SGST 9% when the supplier and customer GSTINs are in the same state;
  - IGST 18% when they are in different states;
  - "GST 18%" when the customer has no GSTIN (B2C, state unknown).
  - **CA to confirm:** the place-of-supply rule for B2C customers (we do not collect a billing address or state), and whether we should collect one.
- **SAC code.** Invoices print SAC 998413. **CA to confirm** the correct SAC for an AI voice-agent SaaS; it may be an IT or online-service code rather than a telecom one.
- **Prices include GST.** The invoice splits the plan price into taxable value + 18% GST. **Owner/CA to confirm** that published plan prices are meant to include GST.
- **Refunds.**
  - Each refund is now recorded once; the old webhook counted every refund twice.
  - Partial refunds show as `partially_refunded`.
  - Credit notes are not generated yet. **CA to confirm** whether refunded invoices need credit notes; this is logged for a later phase.

## Batch calling (Phase 8, B10)
- **Calling hours.** Commercial calls only 09:00–21:00 IST. A campaign may narrow this window but cannot switch it off or widen it (the old code let a campaign setting `ignoreCallingHours` or hours like 00–24 bypass it). The developer switch `ALLOW_OFFHOURS_BATCH_CALLS` is ignored in production. Paused campaigns resume automatically when hours reopen.
- **Retries.** At most 3 attempts per person per campaign, at least 10 minutes apart.
- **Opt-outs.** Contacts marked opted out are removed from every new campaign and skipped again before each dial; matching is on the normalised number (the old raw-digit match missed `+91…` vs 10-digit forms).
- **Destinations.** Campaigns accept Indian mobile numbers only (no international, landline or premium-rate numbers) — conservative toll-fraud protection. **Owner to decide** whether Indian landlines should be allowed.
- **National DND registry (TRAI NCPR / DLT).** NOT checked by this software. Commercial calling in India generally requires registration as a telemarketer on the DLT platform, a registered 140/160-series or permitted number, and scrubbing against the national preference register. **Owner/lawyer to confirm** the obligations for Claritiy Voice and for its customers before launch, and whether to integrate a DND scrubbing API.
- **Consent.** The customer must confirm consent for every campaign; who confirmed, when, and a hash of the list are stored.

## Call recording (Phase 10, B14)
- **Off by default, per agent.** Recording is switched on per agent ("Record calls" in Call Settings).
- **Notice first.** When on, every call starts with a spoken notice before recording begins (default: "This call is recorded for quality and training purposes."). A custom notice is accepted only if it mentions recording; the notice cannot be switched off while recording is on. **Lawyer to confirm** the wording and whether explicit consent (press a key / say yes) is needed for some uses or callers (DPDP Act, sector rules).
- **Access.** Recordings are played only by the account owner through 5-minute signed links to our server; the carrier link is never shown. Downloads are possible for the owner.
- **Retention.** Recordings are deleted after 90 days by default (`RECORDING_RETENTION_DAYS`), and with the call when a workspace retention period (`dataRetentionDays`) expires. Deletion happens at the carrier first; if the carrier does not confirm, the call is kept and an `[ADMIN_ALERT][DPDP]` log line is written. **Owner/lawyer to confirm** the retention period and add it to the Privacy Policy.
- **Plans.** No plan currently lists recording as a feature, so it is not plan-gated. **Owner to decide** whether recording is a paid feature.

## Marketing claims (Phase 11, launch gate §8)
- **Fixed:** all numeric latency claims ("sub-180ms", "verified 174ms", per-stage 45/65/90 ms timings, competitor latency figures) and "WebRTC" architecture claims were removed from the site, blog, FAQ and SEO pre-render; a test now blocks them. Publish a latency number only after measuring it on live calls (owner step 19).
- **Owner/lawyer to review (not changed by Claude — business or legal decisions):**
  - Pricing copy: "₹3.99/min pay-as-you-go", "from ₹1,799 per month", "750 Bundled Call Minutes (₹3.99/min after)" appear on Home, Pricing SEO, AiVoiceAgentSoftware, BlogIndex, FAQ and App.tsx structured data, but the product sells minute packs (₹1 / ₹800 / ₹3,799 / ₹10,799 / ₹30,799) with no pay-as-you-go or overage billing.
  - Competitor comparison pages naming Vapi and Retell with negative claims (Home comparison table, App.tsx comparison page, FAQ): comparative advertising needs evidence for every claim.
  - Unverified numbers: "99.8% / 99.9% accuracy" (LottieVoiceOrb), "70+ languages", "MSME registered", "TLS 1.3", "Delhivery / Shiprocket sync", "SIP-REFER human handover" (call transfer is marked "coming soon" in the product).

## Marketing claims, part 2 (Phase 14)
- **Fixed (claims the code proved false), guarded by `npm run test:marketing-claims`:**
  - SRTP/UDP "zero-copy" transport: audio runs over a TLS WebSocket.
  - "Zero audio retention": recording is opt-in per agent, with a spoken notice, and is deleted after the retention period.
  - National DND/NCPR registry filtering: not implemented. Pages now say customers must scrub lists; the batch screen says the same.
  - "10,000+ concurrent calls": plan and platform caps apply. Batches allow up to 5,000 contacts.
  - "HIPAA-compliant/aligned": there is no HIPAA programme or BAA.
  - FHIR and HNSW: not implemented.
  - Bring-your-own Twilio/Exotel/SIP trunk, toll-free and international numbers: not supported; the plan includes one local +91 number.
  - "TLS 1.3 everywhere": now worded as "TLS encryption".
  - Fictional `/api/v2/crm|edu|finance|insurance|integrations/shopify` endpoints and `execution_ms`/`latency_ms` samples: now an honest example of a signed post-call webhook.
  - Native Salesforce/HubSpot/Shopify sync: integrations are signed webhooks and custom API tools, plus Google Calendar.
- **Owner / lawyer to review (business or legal statements, not changed):**
  - Outcome and usage figures on Solutions/UseCases/Home (for example "40% RTO reduction", "1,200+ clinics active", "94.2% completed verification", "3.4× debt recovery") need evidence or removal.
  - "MSME registered" and "DPDP Act aligned" badges.
  - Solutions "integrations" chips (Finacle, Guidewire, LeadSquared, CDK and others): these are possible via webhooks/custom tools, not native connectors.
  - Scenario stories that mention toll-free lines or CRM deal-stage updates.
  - **Terms of Service §6** cites the US FTC Do Not Call Registry and US law. For an India-first service it should cite TRAI's TCCCPR 2018 / NCPR (DND), DLT registration and Indian law.
  - **Privacy Policy** lists "Twilio" as an example provider. The actual processors are Supabase (database/auth), Google (Gemini AI, Calendar), the two carriers, Razorpay, Render, Vercel and Resend (email).

## Plan validity and number release (owner decision 2026-11-19) — needs lawyer review
- New rule: a plan is valid 30 days from purchase; it ends when its minutes are used up or after 30 days, whichever comes first, and unused minutes lapse at the 30-day end. The included phone number is released 5 days after the plan ends unless a new plan is bought. The user is warned in the app when the plan ends.
- Conservative choice: plans bought **before 19 November 2026** were sold as "one-time, no expiry". They get no 30-day limit (their `planExpiresAt` stays empty) and end only when their minutes run out. Changing the terms of packs already sold would be risky under consumer law. Ask the lawyer before extending the rule to them.
- Terms §2.1 rewritten: it described monthly card billing, which the product never had. It now describes one-time packs, the validity, the number release and the refund sentence. Pricing page and llms.txt updated to match. Please have the lawyer confirm §2.1 and the refund wording (owner step 27).
- Vobiz charges the master account a monthly fee per number. A number in Vobiz's 15-day cool-off after its last call cannot be released until the cool-off ends; it is blocked meanwhile and retried hourly.

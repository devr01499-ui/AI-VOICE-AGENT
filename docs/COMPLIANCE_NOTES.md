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

## Website accuracy, part 3 (audit batch 11, 2026-11-20) — guarded by `npm run test:marketing-claims` and the build gate `Frontend/scripts/verify-seo-output.js`
- **Fixed** (claims the code proves false):
  - "Free sandbox / test live calls today, no credit card". The live sandbox needs a plan, minutes or the customer's own AI key. Copy now says the account and agents are free and live calls start with a plan from ₹3,799.
  - "Zero lag / zero-latency / sub-second call setup / zero queue latency": not measured.
  - "SIP streaming / encrypted SIP signalling / SIP schemas": audio runs over the carrier media stream, not SIP.
  - "Deep bi-directional CRM execution": integrations are signed webhooks and custom tools.
  - An internal model id in crawlable HTML.
  - The Voice AI Index topic pages:
    - Titles no longer imply certifications ("Compliant PCI…", "Compliant HIPAA…", "Compliant SOC 2…", "Audited GDPR / ISO 27001…", "Certified data privacy…").
    - The shared article text no longer claims that every transcript and recording is PII-scrubbed (redaction is a per-agent option; audio is not redacted).
    - It no longer claims "full alignment" with the DPDP Act, unlimited scale, or unverified outcome figures (40% / 89% / 60% / 100%).
  - FAQ structured data on Home and Pricing listed questions that were on neither page. It is removed; /faq carries the real questions.
  - The blog newsletter form sent the address nowhere and still said "subscribed". It is replaced by a contact link.
- **Owner / lawyer to review** (not changed): the outcome figures that remain on Solutions, UseCases, Home and the RTO blog title ("40%"), as listed in part 2 above.

## Terms of Service — governing law and telephony addendum (audit #126) — DRAFT for the owner's lawyer, NOT applied
The current Terms (pages/Terms.tsx):
- §16.4–16.7 choose California law and Delaware courts.
- The Telephony Compliance Addendum §3–§12 is written for US law: TCPA, FCC rulings, the FTC National Do Not Call Registry, US state laws, two-party-consent states, and the Truth in Caller ID Act.

The product is sold by an Indian business to Indian businesses calling Indian numbers. Claude did not change legal text. Proposed replacement, for a lawyer to adapt:
- **16.4 Governing law.** These Terms are governed by the laws of India.
- **16.5 Jurisdiction.** The courts at [city of the Company's registered office], India have exclusive jurisdiction. Optionally, add arbitration under the Arbitration and Conciliation Act, 1996, with the seat at that city, in English.
- **16.3 Jury trial waiver:** remove (not applicable in India).
- **Telephony addendum, India first.** Customers must comply with:
  - TRAI's Telecom Commercial Communications Customer Preference Regulations, 2018 (TCCCPR): DLT registration as required, headers/templates, and scrubbing against the National Customer Preference Register (DND);
  - commercial calls only between 09:00 and 21:00 IST. The product enforces this window for campaigns;
  - honouring opt-outs immediately. The product stores opt-outs and skips those numbers;
  - the Digital Personal Data Protection Act, 2023: notice and consent for personal data, and its purpose limits;
  - announcing call recording before it starts. The product plays the notice when recording is on;
  - not spoofing caller ID.
- **Keep the US sections** only as "If you call numbers outside India", or remove them if the product only allows Indian destinations (the batch campaign screen accepts Indian mobile numbers only).

## Website content pass (2026-11-22): guarded by `npm run test:marketing-claims` and the build gate
- **Removed** (no evidence, or the code proved them false):
  - six invented customer testimonials (replaced by clearly labelled example setups);
  - invented author bylines;
  - a random "164–176 ms" latency badge;
  - "99.9% human parity" and "100% accurate / zero hallucination";
  - every unmeasured outcome figure (40% RTO, 89% no-shows, 94.2% contact, 3.4× recovery, 1,200+ clinics, ...);
  - "MSME registered";
  - "RBI-compliant / 100% RBI audit";
  - warm transfer (the endpoint answers 501);
  - 10,000+ / unlimited concurrent calls;
  - native Shopify, Shiprocket, EHR and CRM sync;
  - the agent sending SMS or WhatsApp links;
  - white-label;
  - 5-second voice cloning;
  - Marathi as a supported language.
- **In-app templates**: four templates told agents to send links "via SMS" or to transfer calls. An agent could have told a caller "I've sent you the link" when nothing was sent. They now offer a call-back, or say the team will send it.
- **Owner decisions** (please answer; Claude will apply):
  1. **MSME**: if Claritiy has an Udyam registration, send the number. The badge can return with the number shown.
  2. **RBI calling hours**: RBI expects recovery calls between 8 am and 7 pm, while campaigns dial between 9 am and 9 pm IST. Recommendation: add a per-campaign narrower window (for example 9 am–7 pm) and default lending templates to it.
  3. **AI disclosure**: nothing makes an agent say it is an AI. Recommendation: add a default opening line ("I'm an AI assistant from …") that a workspace can only change, not remove, and have a lawyer confirm the wording.
  4. **Testimonials**: add real ones only with written permission from the customer (name, company, quote).

## WhatsApp and live transfers (2026-11-22) — implemented conservatively; lawyer review recommended
Owner decisions:
- Each customer connects their own WhatsApp Business account.
- After a hand-off to a person, the whole call is billed.
- WhatsApp and transfers are available on all paid plans.
- SMS is replaced by WhatsApp.

**WhatsApp (Meta Business Messaging policy)**
- **Sender:** messages come from the customer's own verified WhatsApp Business number, in its own name. Claritiy never sends from a shared number.
- **Opt-in before sending:**
  - The agent asks on the call, naming the business and WhatsApp. Meta lists phone/IVR as an accepted opt-in channel.
  - The agent sends only after a clear yes.
  - The opt-in (call, time, transcript excerpt) is stored before the message is sent.
- **Opt-out:** a "STOP"-type reply opts the person out, and later sends are refused.
  - Conservative choice: a person who opted out by reply is not re-opted in by a later verbal yes. They can message the business again ("START") to opt back in.
- **Templates:**
  - Only Meta-approved templates are sent; utility and marketing are allowed.
  - Not sent: authentication/OTP templates, media headers, variable buttons.
  - No free-form text: a caller has not opened a 24-hour service window.
- **Recipient and volume:**
  - Only to the caller's own number; the AI never chooses a recipient.
  - At most 3 messages per call and 5 per person per 24 hours.
  - No bulk or broadcast sending (the website guard forbids claiming it).
- **Open for the owner/lawyer:**
  - Whether marketing templates sent after a call need an extra DPDP consent notice.
  - Privacy-policy wording for Meta as a channel. A factual paragraph was added to /privacy.

**Live transfers**
- **Caller ID:** the business's own Claritiy number. The caller's number is not passed through.
- **Disclosure:** the agent says it is connecting the caller before the transfer.
- **Toll-fraud policy:** destinations must pass it: Indian numbers only by default, never 1900/1860.
- **Fixed targets:** the AI can only pick a target the customer saved.
- **Billing disclosure:** the whole call is billed per started minute. This is shown in the editor, Live Monitoring, the FAQ and the guide.
- **Recording:** if recording is on, the carrier recording may continue during the person-to-person part. The recording notice was given at the start of the call. Lawyer to confirm this is sufficient.

**Found during this work (needs the owner's lawyer, step 27):**
- /privacy section 5 ("Integration and Connector Data") ends with a placeholder: "[TEXT TRUNCATED HERE; PLEASE PROVIDE THE REMAINDER …]". It is visible on the live site.
- The same page names Twilio as a provider; Twilio is not used.
- The legal text was not rewritten here.

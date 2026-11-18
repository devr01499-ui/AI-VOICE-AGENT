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

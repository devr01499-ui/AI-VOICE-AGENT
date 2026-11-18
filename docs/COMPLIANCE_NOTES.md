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

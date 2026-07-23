export default function Privacy() {
  return (
    <div className="pt-32 px-6 max-w-4xl mx-auto pb-32 bg-cream-bg min-h-screen">
      <div className="space-y-4 mb-12">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-3 py-1 rounded-full font-mono">
          ATTORNEY-GRADE PRIVACY POLICY
        </span>
        <h1 className="font-sora text-4xl md:text-5xl font-extrabold text-ink leading-tight">Privacy Policy & Data Governance</h1>
        <p className="text-small font-bold text-ink-muted font-mono">Last Updated: July 2026 | Effective for Digital Personal Data Protection (DPDP) Act 2023</p>
      </div>

      <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-8 bg-surface-white border border-[#EADEC9] p-10 rounded-3xl shadow-level-2">
        <p>
          Clarity Voice Solutions ("Company," "we," "us," or "our") operates the enterprise AI voice automation platform located at https://www.insightclaritiysolution.com. This Privacy Policy governs our processing of personal data, call recordings, audio transcripts, and metadata in full compliance with the Digital Personal Data Protection (DPDP) Act 2023, EU General Data Protection Regulation (GDPR), and applicable international standards.
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">1. Data Minimization & Collection Scope</h2>
        <p>
          We strictly collect only data required for service execution: account registration details (email, company name, contact numbers), active call metadata (timestamps, duration, caller ID), and real-time audio streams.
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">2. Mandatory 30-Day Audio & Transcript Purge Policy</h2>
        <p>
          To maintain zero residual privacy liability, Clarity Voice enforces an automated <strong>30-Day Audio & Transcript Purge Policy</strong>. All raw audio recordings, PSTN packet buffers, and complete conversation transcripts are permanently hard-deleted from our primary and backup databases 30 calendar days after call completion, unless an Enterprise client explicitly configures custom retention schedules under a signed Data Processing Agreement (DPA).
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">3. Data Redaction at Edge</h2>
        <p>
          Before any audio transcript or log is committed to persistent storage, our real-time Edge Redaction Engine programmatically scrubs Personally Identifiable Information (PII), Protected Health Information (PHI), credit card credentials (PCI-DSS), and national ID numbers.
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">4. Rights Under the DPDP Act 2023 & GDPR</h2>
        <p>
          Data principals maintain explicit rights to request access, correction, erasure, or withdrawal of consent regarding their processed data. Data requests may be submitted directly to our Data Protection Officer (DPO) at <strong>support@claritiy.com</strong>.
        </p>
      </div>
    </div>
  );
}

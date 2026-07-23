export default function Terms() {
  return (
    <div className="pt-32 px-6 max-w-4xl mx-auto pb-32 bg-cream-bg min-h-screen">
      <div className="space-y-4 mb-12">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-3 py-1 rounded-full font-mono">
          ATTORNEY-GRADE TERMS & CONDITIONS
        </span>
        <h1 className="font-sora text-4xl md:text-5xl font-extrabold text-ink leading-tight">Terms of Service & Governing Law</h1>
        <p className="text-small font-bold text-ink-muted font-mono">Last Updated: July 2026 | Governing Jurisdiction: New Delhi, India</p>
      </div>

      <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-8 bg-surface-white border border-[#EADEC9] p-10 rounded-3xl shadow-level-2">
        <p>
          These Terms of Service ("Terms") govern access to and usage of the Clarity Voice platform, APIs, WebRTC telephony streams, and software services provided by Clarity Voice Solutions ("Company").
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">1. Service Level Agreements (SLAs)</h2>
        <p>
          Clarity Voice guarantees a <strong>99.99% Uptime SLA</strong> for Enterprise tier clients and 99.9% Uptime for Growth tier clients, excluding pre-announced scheduled maintenance windows. Service uptime is tracked via transparent edge monitoring endpoints.
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">2. Acceptable Usage & Robocall Prohibition</h2>
        <p>
          Users explicitly agree not to utilize the Services for unlawful telemarketing, fraudulent impersonation, harassment, unauthorized political robocalling, or campaigns violating TRAI, FCC, or local telecommunications regulations. Violation results in immediate account termination without refund.
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">3. Billing, Bundled Minutes & Overages</h2>
        <p>
          Bundled plan minutes (Startup 500 mins; Growth 1,500 mins) reset monthly. Standalone pay-as-you-go minutes are billed at flat ₹3.99 per minute. All invoices are billed in INR or USD as specified in the account portal.
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">4. Governing Law & Mandatory Arbitration in Delhi</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of India. Any legal dispute, controversy, or claim arising out of or relating to these Terms shall be referred to and finally resolved by mandatory binding arbitration in <strong>New Delhi, India</strong>, under the Arbitration and Conciliation Act, 1996.
        </p>
      </div>
    </div>
  );
}

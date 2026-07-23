export default function Privacy() {
  return (
    <div className="pt-32 px-6 max-w-4xl mx-auto pb-32 bg-cream-bg min-h-screen">
      <div className="space-y-4 mb-12">
        <h1 className="text-display text-ink leading-tight">Privacy Policy</h1>
        <p className="text-small font-bold text-ink-muted">Last Updated: June 1, 2026</p>
      </div>

      <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-loose">
        <p>
          Clarity Voice ("Company," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy outlines our practices regarding the collection, use, and disclosure of information when you use our AI voice automation platform, website, and associated services (collectively, the "Services").
        </p>
        
        <h2 className="text-h3 text-ink mt-8 mb-4">1. Information We Collect</h2>
        <p>
          <strong>Account Information:</strong> When you register for a Clarity Voice account, we collect your name, email address, company name, phone number, and payment information.
        </p>
        <p>
          <strong>Telephony and Audio Data:</strong> In the course of providing our core Services, we process audio streams, call metadata (caller ID, duration, timestamp), and generated transcripts. We implement Data Redaction at Edge to scrub Personally Identifiable Information (PII) before storage.
        </p>
        <p>
          <strong>Usage Data:</strong> We automatically collect information on how you interact with our Services, including IP addresses, browser types, and API request logs.
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">2. How We Use Your Information</h2>
        <p>We use the collected information for various purposes, including:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>To provide, maintain, and improve our Services.</li>
          <li>To process transactions and send related information, including confirmations and invoices.</li>
          <li>To train and improve our proprietary speech and language models (only using anonymized, non-PII data, and strictly opted-in).</li>
          <li>To detect, prevent, and address technical or security issues.</li>
        </ul>

        <h2 className="text-h3 text-ink mt-8 mb-4">3. Data Redaction at Edge</h2>
        <p>
          Clarity Voice prioritizes caller privacy by utilizing proprietary "Data Redaction at Edge" technology. Audio processing occurs in real-time, and sensitive data (such as credit card numbers or social security numbers) are programmatically redacted from both the audio recording and the text transcript before being committed to persistent storage.
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">4. Data Retention</h2>
        <p>
          We retain personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy. Call recordings and transcripts are retained based on your workspace configuration settings (default: 30 days) and are permanently deleted thereafter unless legally required otherwise.
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">5. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact our Data Protection Officer at <strong>privacy@claritiy.com</strong>.
        </p>
      </div>
    </div>
  );
}

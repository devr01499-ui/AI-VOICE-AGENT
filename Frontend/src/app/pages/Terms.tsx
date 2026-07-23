export default function Terms() {
  return (
    <div className="pt-32 px-6 max-w-4xl mx-auto pb-32 bg-cream-bg min-h-screen">
      <div className="space-y-4 mb-12">
        <h1 className="text-display text-ink leading-tight">Terms of Service</h1>
        <p className="text-small font-bold text-ink-muted">Last Updated: June 1, 2026</p>
      </div>

      <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-loose">
        <p>
          These Terms of Service ("Terms") govern your access to and use of the Clarity Voice platform, APIs, and associated services (the "Services"). By accessing or using the Services, you agree to be bound by these Terms.
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">1. Use of Services</h2>
        <p>
          You must be at least 18 years old and have the legal capacity to enter into a binding agreement to use our Services. You agree to use the Services only for lawful purposes and in compliance with all applicable local, national, and international laws, including telecommunications regulations (e.g., TCPA in the United States, TRAI regulations in India).
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">2. Prohibited Conduct</h2>
        <p>You agree not to use the Services to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Transmit any material that is abusive, harassing, tortious, defamatory, vulgar, or obscene.</li>
          <li>Impersonate any person or entity or misrepresent your affiliation.</li>
          <li>Conduct illegal robocalling, spamming, or phishing campaigns.</li>
          <li>Interfere with or disrupt the integrity or performance of the Services.</li>
        </ul>
        <p>
          Violation of these prohibited conduct rules will result in immediate termination of your account without a refund.
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">3. Fees and Payment</h2>
        <p>
          Our fees are based on usage (e.g., per minute) as specified on our Pricing page or in your Enterprise contract. You agree to pay all applicable fees related to your use of the Services. We reserve the right to suspend or terminate your account if payment is not received in a timely manner.
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">4. Intellectual Property</h2>
        <p>
          The Services and their original content (excluding User Content), features, and functionality are and will remain the exclusive property of Clarity Voice and its licensors. Our trademarks may not be used in connection with any product or service without our prior written consent.
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">5. Limitation of Liability</h2>
        <p>
          In no event shall Clarity Voice, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Services.
        </p>

        <h2 className="text-h3 text-ink mt-8 mb-4">6. Contact</h2>
        <p>
          For any legal inquiries or concerns regarding these Terms, please contact <strong>legal@claritiy.com</strong>.
        </p>
      </div>
    </div>
  );
}

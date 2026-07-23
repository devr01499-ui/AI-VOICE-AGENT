import { motion } from "motion/react";
import { Shield, Lock, FileText, CheckCircle } from "lucide-react";

export default function Security() {
  return (
    <div className="pt-32 px-6 max-w-5xl mx-auto pb-32 bg-cream-bg min-h-screen">
      <div className="text-center space-y-4 mb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Shield className="w-16 h-16 text-mint-primary mx-auto mb-6" />
          <h1 className="text-display text-ink leading-tight">Security & Compliance</h1>
          <p className="text-body text-ink-muted max-w-2xl mx-auto mt-4">
            Enterprise-grade security is built into the core of Clarity Voice. We protect your data with state-of-the-art encryption, proactive threat monitoring, and rigorous compliance standards.
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-surface-white border border-border-soft rounded-2xl p-8 shadow-level-1">
          <Lock className="w-8 h-8 text-mint-primary mb-4" />
          <h3 className="text-h3 text-ink mb-3">Data Redaction at Edge</h3>
          <p className="text-small text-ink-muted leading-relaxed">
            Protecting Personally Identifiable Information (PII) is paramount. Our proprietary Data Redaction at Edge technology automatically scrubs sensitive information—such as credit card numbers, social security numbers, and health records—from audio streams and transcripts in real-time, before it ever touches persistent storage.
          </p>
        </div>

        <div className="bg-surface-white border border-border-soft rounded-2xl p-8 shadow-level-1">
          <CheckCircle className="w-8 h-8 text-mint-primary mb-4" />
          <h3 className="text-h3 text-ink mb-3">SOC 2 Type II Compliance</h3>
          <p className="text-small text-ink-muted leading-relaxed">
            We maintain stringent, independently audited security controls. Clarity Voice is fully SOC 2 Type II compliant, ensuring continuous adherence to the highest standards of security, availability, processing integrity, confidentiality, and privacy for cloud service providers.
          </p>
        </div>

        <div className="bg-surface-white border border-border-soft rounded-2xl p-8 shadow-level-1">
          <FileText className="w-8 h-8 text-mint-primary mb-4" />
          <h3 className="text-h3 text-ink mb-3">HIPAA BAA Availability</h3>
          <p className="text-small text-ink-muted leading-relaxed">
            For healthcare organizations managing Protected Health Information (PHI), Clarity Voice offers Business Associate Agreements (BAAs). Our dedicated Enterprise infrastructure guarantees isolated processing environments and end-to-end encryption to meet full HIPAA regulatory requirements.
          </p>
        </div>

        <div className="bg-surface-white border border-border-soft rounded-2xl p-8 shadow-level-1">
          <Shield className="w-8 h-8 text-mint-primary mb-4" />
          <h3 className="text-h3 text-ink mb-3">End-to-End Encryption</h3>
          <p className="text-small text-ink-muted leading-relaxed">
            All data in transit is encrypted using TLS 1.2 or higher, and all data at rest is secured with AES-256 encryption. We utilize WebRTC over Secure SRTP for all SIP trunking connections to prevent eavesdropping and unauthorized access to voice streams.
          </p>
        </div>
      </div>

      <div className="bg-mint-soft/30 border border-mint-primary/20 rounded-3xl p-10 text-center space-y-6">
        <h2 className="text-h2 text-ink">Need a Security Questionnaire Completed?</h2>
        <p className="text-body text-ink-muted max-w-xl mx-auto">
          Our security team is ready to assist with vendor risk assessments and detailed compliance documentation.
        </p>
        <button onClick={() => window.location.href="mailto:security@claritiy.com"} className="btn-primary mt-4">
          Contact Security Team
        </button>
      </div>
    </div>
  );
}

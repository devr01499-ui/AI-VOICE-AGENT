import { motion } from "motion/react";
import { ShieldCheck, Lock, FileCheck, Server } from "lucide-react";

export default function Security() {
  return (
    <div className="pt-32 px-6 max-w-5xl mx-auto pb-32 bg-cream-bg min-h-screen">
      <div className="text-center space-y-4 mb-16">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
          ENTERPRISE SECURITY BLUEPRINT
        </span>
        <h1 className="font-sora text-4xl md:text-5xl font-extrabold text-ink leading-tight">Security Standards & Compliance Blueprint</h1>
        <p className="text-body text-ink-muted max-w-2xl mx-auto font-plus-jakarta mt-4">
          Architected from the ground up for strict data protection, edge redaction, and enterprise compliance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1">
          <ShieldCheck className="w-10 h-10 text-mint-primary mb-4" />
          <h3 className="font-sora text-xl font-bold text-ink mb-2">SOC 2 Type II Certified</h3>
          <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
            Independent third-party audits verify our security, operational availability, processing integrity, and privacy controls under SOC 2 Type II standards.
          </p>
        </div>

        <div className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1">
          <FileCheck className="w-10 h-10 text-amber-cta mb-4" />
          <h3 className="font-sora text-xl font-bold text-ink mb-2">HIPAA BAA Agreement Availability</h3>
          <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
            Healthcare providers can sign Business Associate Agreements (BAAs). Isolated processing nodes ensure PHI audio streams remain encrypted and compliant.
          </p>
        </div>

        <div className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1">
          <Lock className="w-10 h-10 text-mint-primary mb-4" />
          <h3 className="font-sora text-xl font-bold text-ink mb-2">TLS 1.3 & AES-256 Encryption</h3>
          <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
            All telephony audio streams in transit are encrypted via Secure SRTP and TLS 1.3. Persistent data at rest is encrypted using military-grade AES-256 keys.
          </p>
        </div>

        <div className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1">
          <Server className="w-10 h-10 text-amber-cta mb-4" />
          <h3 className="font-sora text-xl font-bold text-ink mb-2">ISO 27001 Infrastructure</h3>
          <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
            Our cloud nodes operate in Tier-4 ISO 27001 certified data centers featuring 24/7 biometric physical security and automated DDoS mitigation.
          </p>
        </div>
      </div>
    </div>
  );
}

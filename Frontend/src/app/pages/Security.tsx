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
          Architected from the ground up for strict data protection, edge redaction, and enterprise security.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1">
          <ShieldCheck className="w-10 h-10 text-mint-primary mb-4" />
          <h3 className="font-sora text-xl font-bold text-ink mb-2">MSME Registered Enterprise</h3>
          <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
            Claritiy Voice is a officially registered Micro, Small & Medium Enterprise (MSME) under the Ministry of MSME, Government of India.
          </p>
        </div>

        <div className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1">
          <FileCheck className="w-10 h-10 text-amber-cta mb-4" />
          <h3 className="font-sora text-xl font-bold text-ink mb-2">Aadhaar & DPDP Privacy Framework</h3>
          <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
            Built in alignment with Indian data protection standards, ensuring secure processing of customer identity records with explicit consent verification.
          </p>
        </div>

        <div className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1">
          <Lock className="w-10 h-10 text-mint-primary mb-4" />
          <h3 className="font-sora text-xl font-bold text-ink mb-2">TLS 1.3 & AES-256 Encryption</h3>
          <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
            All telephony audio streams in transit are encrypted via SRTP and TLS 1.3. Persistent data at rest is encrypted using military-grade AES-256 keys.
          </p>
        </div>

        <div className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1">
          <Server className="w-10 h-10 text-amber-cta mb-4" />
          <h3 className="font-sora text-xl font-bold text-ink mb-2">High Availability Cloud Nodes</h3>
          <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
            Our telephony and neural streaming nodes run on high-availability cloud infrastructure with automated failover and 24/7 DDoS mitigation.
          </p>
        </div>
      </div>
    </div>
  );
}


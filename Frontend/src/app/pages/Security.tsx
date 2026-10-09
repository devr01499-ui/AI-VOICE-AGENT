import { motion } from "motion/react";
import { ShieldCheck, Lock, FileCheck, Server, Key, EyeOff, CheckCircle2, Mail, ArrowRight } from "lucide-react";

export default function Security() {
  const securityPillars = [
    {
      icon: EyeOff,
      title: "Edge PII Pattern Redaction",
      desc: "Before any call transcript or telemetry event is persisted to storage, our edge redaction engine scrubs credit cards, bank account numbers, tax identifiers, and sensitive phone numbers."
    },
    {
      icon: Lock,
      title: "TLS 1.3 & SRTP Audio Encryption",
      desc: "All full-duplex telephony audio streams in transit are encrypted via SRTP and TLS 1.3. Persistent database records and audit trails are encrypted at rest with AES-256 keys."
    },
    {
      icon: Server,
      title: "Zero Audio Retention Architecture",
      desc: "Raw customer voice audio is processed in volatile memory buffers for real-time neural inference and discarded immediately upon utterance delivery. No unencrypted audio is ever retained."
    },
    {
      icon: Key,
      title: "Role-Based Access Control & Scoped Keys",
      desc: "Granular workspace permissions enforce Admin, Editor, and Viewer privileges. Live API keys can be scoped with IP allowlists, concurrency rate limits, and instant rotation."
    }
  ];

  const complianceStandards = [
    {
      title: "MSME Registered Enterprise",
      authority: "Ministry of MSME, Govt. of India",
      desc: "Officially registered Micro, Small & Medium Enterprise operating under Indian regulatory frameworks with certified corporate identification."
    },
    {
      title: "Digital Personal Data Protection (DPDP)",
      authority: "India DPDP Act 2023",
      desc: "Consent-first data processing models, transparent purpose limitation, and rapid data subject deletion protocols in full alignment with the DPDP framework."
    },
    {
      title: "RBI Fair Practices Code Aligned",
      authority: "Reserve Bank of India Guidelines",
      desc: "Pre-built debt recovery and EMI reminder templates strictly adhere to permitted calling hours (8 AM - 7 PM), identity verification gates, and zero-harassment rules."
    }
  ];

  return (
    <div className="pt-28 px-6 max-w-5xl mx-auto pb-32 bg-[#FFFDF9] min-h-screen font-plus-jakarta text-[#0D1117]">
      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <div className="text-center space-y-4 mb-16">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          ENTERPRISE SECURITY & COMPLIANCE BLUEPRINT
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-[#0D1117] tracking-tight leading-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Security Standards & Data Governance
        </h1>
        <p className="text-slate-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Architected from the ground up for strict privacy protection, edge-level PII redaction, and enterprise telecommunication compliance.
        </p>
      </div>

      {/* ── 4 Security Architecture Pillars ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {securityPillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          return (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white border border-[#E8E2D9] rounded-3xl p-8 shadow-sm hover:shadow-md transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#0D1117]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {pillar.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {pillar.desc}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* ── Verified Regulatory Compliance Standards ─────────────────────── */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 border border-slate-800 shadow-xl space-y-8 mb-16">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block">
            REGULATORY ALIGNMENT
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Compliance Standards & Frameworks
          </h2>
          <p className="text-slate-400 text-xs md:text-sm">
            All Claritiy Voice agent workflows and data pipelines are verified against statutory telecommunication requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {complianceStandards.map((std) => (
            <div key={std.title} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-2.5">
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 uppercase block w-fit">
                {std.authority}
              </span>
              <h4 className="font-bold text-base text-white">{std.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">{std.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Security Contacts & Vulnerability Disclosure ─────────────────── */}
      <div className="bg-white border border-[#E8E2D9] rounded-3xl p-8 text-center space-y-4 shadow-sm">
        <h3 className="text-2xl font-bold text-[#0D1117]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Security Audits & Vulnerability Reporting
        </h3>
        <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
          Need a copy of our security architecture questionnaire or need to report a responsible vulnerability disclosure? Our security team reviews all communications within 24 hours.
        </p>
        <div className="pt-2 flex justify-center">
          <a
            href="mailto:security@claritiyvoice.com"
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Mail className="w-4 h-4 text-emerald-400" />
            Contact Security Desk (security@claritiyvoice.com)
          </a>
        </div>
      </div>
    </div>
  );
}

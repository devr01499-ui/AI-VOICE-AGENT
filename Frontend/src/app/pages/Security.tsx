import { Lock, Server, Key, EyeOff, Mail } from "lucide-react";

export default function Security() {
  const securityPillars = [
    {
      icon: EyeOff,
      title: "PII Redaction in Transcripts",
      desc: "Switch on PII redaction for an agent and its transcripts are stored with card numbers, bank account numbers, tax identifiers and similar details masked. Agents can also be told never to ask for card numbers, CVVs or OTPs."
    },
    {
      icon: Lock,
      title: "Encrypted Audio Transport",
      desc: "Call audio between the carrier and our servers travels over an encrypted (TLS) WebSocket. Database records are encrypted at rest (AES-256), and sensitive fields such as calendar tokens are additionally encrypted by the application."
    },
    {
      icon: Server,
      title: "Recording Only When You Choose",
      desc: "Live call audio is processed in memory and not stored. Calls are recorded only for agents where you switch recording on: the caller hears a recording notice, playback links are private and short-lived, and recordings are deleted after the retention period (90 days by default)."
    },
    {
      icon: Key,
      title: "Role-Based Access Control & Scoped Keys",
      desc: "Team members get one of four roles: admin, developer, analyst or viewer; analysts and viewers can look but not change anything. API keys are shown only once and can be revoked at any time."
    }
  ];

  const complianceStandards = [
    {
      title: "TRAI Calling Hours & Opt-Outs",
      authority: "Telecom Regulatory Authority of India",
      desc: "Batch campaigns dial only between 9 am and 9 pm IST, skip everyone on your opt-out list and ask you to confirm consent before they start. DND (NCPR) scrubbing and DLT registration remain your responsibility."
    },
    {
      title: "Digital Personal Data Protection (DPDP)",
      authority: "India DPDP Act 2023",
      desc: "Built around the Act's principles: consent confirmed before every campaign, data used only to run your calls, recording off by default with a spoken notice, and call data deleted after the retention period you choose."
    },
    {
      title: "For Lenders: RBI Fair Practices",
      authority: "Reserve Bank of India Guidelines",
      desc: "EMI reminder templates confirm the borrower's identity before any detail and never use pressure or threats. RBI expects recovery calls between 8 am and 7 pm, so schedule lending campaigns inside those hours."
    }
  ];

  return (
    <div className="pt-28 px-6 max-w-5xl mx-auto pb-32 bg-[#E5E3DC] min-h-screen font-sans text-[#121212]">
      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <div className="hatched-strip h-10 w-full mb-8" />
      <div className="text-center space-y-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono uppercase tracking-wider">
          <span>|</span>
          <span>Security & Compliance</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-normal md:font-medium text-[#121212] tracking-tight leading-[1.08] font-sans">
          Security Standards & Data Governance
        </h1>
        <p className="text-[#262523] text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-sans">
          How we protect call data, what you control, and which responsibilities stay with you under Indian telecom and privacy rules.
        </p>
      </div>

      {/* ── 4 Security Architecture Pillars ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-14">
        {securityPillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div
              key={pillar.title}
              className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 hover:border-[#9C998F] transition-colors space-y-3"
            >
              <div className="w-10 h-10 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center text-[#121212]">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-medium text-[#121212] font-sans">
                {pillar.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#262523] leading-relaxed font-sans">
                {pillar.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Verified Regulatory Compliance Standards ─────────────────────── */}
      <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-8 md:p-10 border border-[#CBC8BE] space-y-6 mb-14">
        <div className="space-y-1">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-widest block">
            | REGULATORY ALIGNMENT
          </span>
          <h2 className="text-2xl md:text-3xl font-medium text-[#121212] font-sans tracking-tight">
            Compliance Standards & Frameworks
          </h2>
          <p className="text-[#262523] text-xs md:text-sm font-sans leading-relaxed">
            All Claritiy Voice agent workflows and data pipelines are verified against statutory telecommunication requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {complianceStandards.map((std) => (
            <div key={std.title} className="bg-[#DFDCD4] p-5 rounded-[2px] border border-[#CBC8BE] space-y-2">
              <span className="text-[10px] font-mono font-medium text-[#121212] bg-[#EBE9E2] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE] uppercase block w-fit">
                {std.authority}
              </span>
              <h4 className="font-medium text-sm text-[#121212] font-sans">{std.title}</h4>
              <p className="text-xs text-[#262523] leading-relaxed font-sans">{std.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Security Contacts & Vulnerability Disclosure ─────────────────── */}
      <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 text-center space-y-4">
        <h3 className="text-xl font-medium text-[#121212] font-sans">
          Security Audits & Vulnerability Reporting
        </h3>
        <p className="text-sm text-[#262523] max-w-xl mx-auto leading-relaxed font-sans">
          Need a copy of our security architecture questionnaire or need to report a responsible vulnerability disclosure? Our security team reviews all communications within 24 hours.
        </p>
        <div className="pt-2 flex justify-center">
          <a
            href="mailto:security@claritiy.com"
            className="px-6 py-3 bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider text-xs rounded-[2px] transition-colors inline-flex items-center gap-2 cursor-pointer font-medium"
          >
            <Mail className="w-4 h-4 text-white" />
            Contact Security Desk (security@claritiy.com)
          </a>
        </div>
      </div>
    </div>
  );
}

import { ArrowRight, Mail, MessageCircle, Globe2, Sparkles } from "lucide-react";

type Page = 
  | "home" 
  | "solutions" 
  | "how-it-works" 
  | "voices" 
  | "pricing" 
  | "blog" 
  | "blog-rto" 
  | "blog-healthcare" 
  | "blog-fintech" 
  | "docs" 
  | "privacy" 
  | "terms" 
  | "security" 
  | "dashboard" 
  | "industries" 
  | "use-cases"
  | "faq" 
  | "contact" 
  | "voice-ai-index";

interface FooterProps {
  setPage: (p: Page) => void;
}

export default function Footer({ setPage }: FooterProps) {
  const navigate = (p: Page, href?: string) => {
    if (href && href.startsWith("/")) {
      window.history.pushState(null, "", href);
    }
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t border-[#CBC8BE] bg-[#DFDCD4] pt-16 pb-12 px-6 relative z-10 text-[#262523] font-sans">
      {/* ── Top Enterprise Consultation Callout ─────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-16 pb-12 border-b border-[#CBC8BE]">
        <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-8 md:p-12 border border-[#CBC8BE] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 relative">
          <div className="space-y-3 max-w-2xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] font-mono text-[11px] font-bold tracking-wider uppercase">
              <Sparkles className="w-3 h-3 text-[#121212]" />
              PRODUCTION-GRADE TELEPHONY PILOT
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-[#121212] tracking-tight">
              Ready to automate 10,000+ monthly calls with zero human lag?
            </h3>
            <p className="text-[#262523] text-sm md:text-base leading-relaxed">
              Explore 15 pre-built production templates across BFSI, Healthcare, E-Commerce, Real Estate, and Front Desk operations. Deploy within 10 minutes or test live in sandbox.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto relative z-10">
            <button
              onClick={() => navigate("dashboard")}
              className="px-6 py-3.5 bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center gap-2"
            >
              Launch Free Sandbox <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("contact")}
              className="px-6 py-3.5 bg-[#DFDCD4] hover:bg-[#D5D2C9] text-[#121212] font-mono text-xs uppercase tracking-wider rounded-[2px] border border-[#CBC8BE] transition-colors flex items-center justify-center gap-2"
            >
              Talk to Voice Architect
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Footer Grid ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8">
        {/* Brand & Mission Column */}
        <div className="lg:col-span-2 space-y-5">
          <button
            onClick={() => navigate("home")}
            className="flex items-center gap-3 text-left group"
          >
            <img src="/logo.png" alt="Claritiy Voice Logo" className="h-9 w-auto object-contain" />
            <span className="font-extrabold text-xl tracking-tight text-[#121212]">
              Claritiy <span className="font-mono text-xs uppercase tracking-widest text-[#5E5D57]">Voice</span>
            </span>
          </button>
          
          <p className="text-sm text-[#262523] leading-relaxed max-w-sm">
            Autonomous conversational voice AI infrastructure designed for high-scale enterprise telephony. Sub-180ms latency, native regional accents, and deep bi-directional CRM execution.
          </p>

          {/* Live System Operational Status */}
          <div className="p-3.5 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] space-y-2 max-w-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#121212]" />
                <span className="text-xs font-bold text-[#121212] font-mono">ALL SYSTEMS OPERATIONAL</span>
              </div>
              <span className="text-[10px] font-mono text-[#121212] bg-[#DFDCD4] border border-[#CBC8BE] px-2 py-0.5 rounded-[2px] font-bold">174ms Latency</span>
            </div>
            <p className="text-[11px] text-[#5E5D57] leading-tight">
              Edge ingress controllers, WebRTC media relays, and SIP gateways functioning normally across all clusters.
            </p>
          </div>

          {/* Governance & Compliance Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-mono font-bold text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] px-2.5 py-1">MSME REGISTERED</span>
            <span className="text-[10px] font-mono font-bold text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] px-2.5 py-1">TLS 1.3 / AES-256</span>
            <span className="text-[10px] font-mono font-bold text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] px-2.5 py-1">DPDP ALIGNED</span>
            <span className="text-[10px] font-mono font-bold text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] px-2.5 py-1">RBI FAIR PRACTICES</span>
          </div>
        </div>

        {/* Column 1: Client Verticals */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#121212] font-mono tracking-wider uppercase">
            Client Solutions
          </p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                E-Commerce COD & RTO
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Healthcare Clinic Intake
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                BFSI & EMI Collections
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Real Estate Speed-to-Lead
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Home Services Dispatch
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                BPO & Overflow Deflection
              </button>
            </li>
          </ul>
        </div>

        {/* Column 2: Production Templates */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#121212] font-mono tracking-wider uppercase">
            Agent Templates
          </p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Front Desk Receptionist
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Dental Clinic Scheduler
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                B2B Lead Qualifier (SDR)
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Win-Back & Reactivation
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                EMI Pre-Due & Overdue
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                After-Hours P1 Triage
              </button>
            </li>
          </ul>
        </div>

        {/* Column 3: Platform Architecture */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#121212] font-mono tracking-wider uppercase">
            Platform & Tech
          </p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button onClick={() => navigate("how-it-works")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Sub-180ms WebRTC Engine
              </button>
            </li>
            <li>
              <button onClick={() => navigate("voices")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                HD Voices & 70+ Dialects
              </button>
            </li>
            <li>
              <button onClick={() => navigate("pricing")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Flat Rate Pricing (₹3.99/min)
              </button>
            </li>
            <li>
              <button onClick={() => navigate("docs")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Developer API & Webhooks
              </button>
            </li>
            <li>
              <button onClick={() => navigate("voice-ai-index")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Voice AI Index (Knowledge)
              </button>
            </li>
            <li>
              <button onClick={() => navigate("faq")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Enterprise FAQ
              </button>
            </li>
          </ul>
        </div>

        {/* Column 4: Contact & Direct Channels */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#121212] font-mono tracking-wider uppercase">
            Direct Channels
          </p>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href="https://wa.me/919707337259?text=Hello%20Claritiy%20Voice%20Team%2C%20I%20would%20like%20to%20learn%20more%20about%20enterprise%20voice%20agents"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#262523] hover:text-[#121212] hover:underline transition-colors font-medium"
              >
                <MessageCircle className="w-4 h-4 text-[#121212]" />
                <span>WhatsApp Enterprise</span>
              </a>
            </li>
            <li>
              <button
                onClick={() => navigate("contact")}
                className="inline-flex items-center gap-2 text-[#262523] hover:text-[#121212] hover:underline transition-colors font-medium text-left"
              >
                <Mail className="w-4 h-4 text-[#121212]" />
                <span>Contact Sales Desk</span>
              </button>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/company/claritiy/?viewAsMember=true"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#262523] hover:text-[#121212] hover:underline transition-colors font-medium"
              >
                <Globe2 className="w-4 h-4 text-[#121212]" />
                <span>LinkedIn Updates</span>
              </a>
            </li>
            <li className="pt-2">
              <span className="text-xs text-[#5E5D57] block font-mono">SUPPORT HOURS:</span>
              <span className="text-xs font-medium text-[#121212]">Mon – Sat: 9:00 AM – 8:00 PM IST</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Footer Bottom Bar ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-[#CBC8BE] flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#5E5D57]">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <p>&copy; 2026 Claritiy Voice. All rights reserved.</p>
          <span className="hidden sm:inline text-[#CBC8BE]">•</span>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("privacy", "/privacy")} className="hover:text-[#121212] hover:underline transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => navigate("terms", "/terms")} className="hover:text-[#121212] hover:underline transition-colors">
              Terms of Use
            </button>
            <button onClick={() => navigate("security", "/security")} className="hover:text-[#121212] hover:underline transition-colors">
              Security Architecture
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[#121212] font-bold bg-[#DFDCD4] px-2.5 py-1 rounded-[2px] border border-[#CBC8BE]">
            Pay-As-You-Go from ₹3.99/min
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-4 pt-2 text-center text-[11px] text-[#5E5D57] font-mono">
        Notice: Claritiy Voice agents declare their automated nature in compliance with telecommunication guidelines and DPDP standards.
      </div>
    </footer>
  );
}

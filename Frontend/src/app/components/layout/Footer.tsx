import { ArrowRight, Phone, Mail, MessageCircle, ShieldCheck, Cpu, CheckCircle2, Globe2, Sparkles } from "lucide-react";

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
    <footer className="border-t border-[#E8E2D9] bg-[#FFFDF9] pt-20 pb-12 px-6 relative z-10 text-slate-600 font-plus-jakarta">
      {/* ── Top Enterprise Consultation Callout ─────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-16 pb-12 border-b border-[#E8E2D9]/70">
        <div className="bg-[#0D1117] text-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[#059669]/15 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-3 max-w-2xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-emerald-400 font-mono text-[11px] font-bold tracking-wider uppercase">
              <Sparkles className="w-3 h-3" />
              PRODUCTION-GRADE TELEPHONY PILOT
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Ready to automate 10,000+ monthly calls with zero human lag?
            </h3>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Explore 15 pre-built production templates across BFSI, Healthcare, E-Commerce, Real Estate, and Front Desk operations. Deploy within 10 minutes or test live in sandbox.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto relative z-10">
            <button
              onClick={() => navigate("dashboard")}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              Launch Free Sandbox <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("contact")}
              className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2"
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
            <span className="font-extrabold text-xl tracking-tight text-[#0D1117]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Claritiy <span className="text-[#059669]">Voice</span>
            </span>
          </button>
          
          <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
            Autonomous conversational voice AI infrastructure designed for high-scale enterprise telephony. Sub-180ms latency, native regional accents, and deep bi-directional CRM execution.
          </p>

          {/* Live System Operational Status */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E8E2D9] shadow-sm space-y-2 max-w-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold text-slate-800 font-mono">ALL SYSTEMS OPERATIONAL</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">174ms Latency</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Edge ingress controllers, WebRTC media relays, and SIP gateways functioning normally across all clusters.
            </p>
          </div>

          {/* Governance & Compliance Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-[#E8E2D9] rounded-md px-2.5 py-1">MSME REGISTERED</span>
            <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-[#E8E2D9] rounded-md px-2.5 py-1">TLS 1.3 / AES-256</span>
            <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-[#E8E2D9] rounded-md px-2.5 py-1">DPDP ALIGNED</span>
            <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-[#E8E2D9] rounded-md px-2.5 py-1">RBI FAIR PRACTICES</span>
          </div>
        </div>

        {/* Column 1: Client Verticals */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#0D1117] font-mono tracking-wider uppercase">
            Client Solutions
          </p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                E-Commerce COD & RTO
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Healthcare Clinic Intake
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                BFSI & EMI Collections
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Real Estate Speed-to-Lead
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Home Services Dispatch
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                BPO & Overflow Deflection
              </button>
            </li>
          </ul>
        </div>

        {/* Column 2: Production Templates */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#0D1117] font-mono tracking-wider uppercase">
            Agent Templates
          </p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Front Desk Receptionist
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Dental Clinic Scheduler
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                B2B Lead Qualifier (SDR)
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Win-Back & Reactivation
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                EMI Pre-Due & Overdue
              </button>
            </li>
            <li>
              <button onClick={() => navigate("solutions")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                After-Hours P1 Triage
              </button>
            </li>
          </ul>
        </div>

        {/* Column 3: Platform Architecture */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#0D1117] font-mono tracking-wider uppercase">
            Platform & Tech
          </p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <button onClick={() => navigate("how-it-works")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Sub-180ms WebRTC Engine
              </button>
            </li>
            <li>
              <button onClick={() => navigate("voices")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                HD Voices & 70+ Dialects
              </button>
            </li>
            <li>
              <button onClick={() => navigate("pricing")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Flat Rate Pricing (₹3.99/min)
              </button>
            </li>
            <li>
              <button onClick={() => navigate("docs")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Developer API & Webhooks
              </button>
            </li>
            <li>
              <button onClick={() => navigate("voice-ai-index")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Voice AI Index (Knowledge)
              </button>
            </li>
            <li>
              <button onClick={() => navigate("faq")} className="text-slate-500 hover:text-[#059669] transition-colors text-left font-medium">
                Enterprise FAQ
              </button>
            </li>
          </ul>
        </div>

        {/* Column 4: Contact & Direct Channels */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#0D1117] font-mono tracking-wider uppercase">
            Direct Channels
          </p>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href="https://wa.me/919707337259?text=Hello%20Claritiy%20Voice%20Team%2C%20I%20would%20like%20to%20learn%20more%20about%20enterprise%20voice%20agents"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-slate-700 hover:text-emerald-600 transition-colors font-semibold"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Enterprise</span>
              </a>
            </li>
            <li>
              <button
                onClick={() => navigate("contact")}
                className="inline-flex items-center gap-2 text-slate-700 hover:text-emerald-600 transition-colors font-semibold text-left"
              >
                <Mail className="w-4 h-4 text-emerald-600" />
                <span>Contact Sales Desk</span>
              </button>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/company/claritiy/?viewAsMember=true"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-slate-700 hover:text-emerald-600 transition-colors font-semibold"
              >
                <Globe2 className="w-4 h-4 text-emerald-600" />
                <span>LinkedIn Updates</span>
              </a>
            </li>
            <li className="pt-2">
              <span className="text-xs text-slate-400 block font-mono">SUPPORT HOURS:</span>
              <span className="text-xs font-medium text-slate-700">Mon – Sat: 9:00 AM – 8:00 PM IST</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Footer Bottom Bar ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-[#E8E2D9] flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <p>&copy; 2026 Claritiy Voice. All rights reserved.</p>
          <span className="hidden sm:inline text-slate-300">•</span>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("privacy", "/privacy")} className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => navigate("terms", "/terms")} className="hover:text-slate-900 transition-colors">
              Terms of Use
            </button>
            <button onClick={() => navigate("security", "/security")} className="hover:text-slate-900 transition-colors">
              Security Architecture
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            Pay-As-You-Go from ₹3.99/min
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-4 pt-2 text-center text-[11px] text-slate-400 font-sans">
        Notice: Claritiy Voice agents declare their automated nature in compliance with telecommunication guidelines and DPDP standards.
      </div>
    </footer>
  );
}

import type React from "react";
import { ArrowRight, Mail, MessageCircle, Globe2, Sparkles } from "lucide-react";
import { pathForPage, type Page as RoutePage } from "../../lib/routes";

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
  | "guide"
  | "contact"
  | "voice-ai-index"
  | "ai-voice-agent-software";

interface FooterProps {
  setPage: (p: Page, extraId?: string) => void;
}

export default function Footer({ setPage }: FooterProps) {
  const navigate = (p: Page, href?: string) => {
    if (href && href.startsWith("/")) {
      window.history.pushState(null, "", href);
    }
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Real links (crawlable, open in a new tab) that navigate inside the app on a normal click. */
  const hrefFor = (p: Page, extraId?: string) => pathForPage(p as RoutePage, extraId);
  const go = (e: React.MouseEvent<HTMLAnchorElement>, p: Page, extraId?: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setPage(p, extraId);
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
              START FREE · NO CARD NEEDED TO BUILD
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-[#121212] tracking-tight">
              Ready to put your phone calls on autopilot?
            </h3>
            <p className="text-[#262523] text-sm md:text-base leading-relaxed">
              Pick a template for your clinic, store, lending desk or front office, adjust it in plain words, and chat with it before you pay anything. Real phone calls start with a plan from ₹3,799.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto relative z-10">
            <button
              onClick={() => navigate("dashboard")}
              className="px-6 py-3.5 bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center gap-2"
            >
              Create a Free Account <ArrowRight className="w-4 h-4" />
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
            AI voice agents that answer and place phone calls for Indian businesses: appointment booking, COD order confirmation, payment reminders and customer support, on your own +91 number.
          </p>

          {/* Languages */}
          <div className="p-3.5 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] space-y-2 max-w-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#121212]" />
                <span className="text-xs font-bold text-[#121212] font-mono">7 INDIAN LANGUAGES</span>
              </div>
              <span className="text-[10px] font-mono text-[#121212] bg-[#DFDCD4] border border-[#CBC8BE] px-2 py-0.5 rounded-[2px] font-bold">+ Auto-detect</span>
            </div>
            <p className="text-[11px] text-[#5E5D57] leading-tight">
              English, Hindi, Bengali, Kannada, Malayalam, Gujarati and Tamil, with natural Hinglish.
            </p>
          </div>

          {/* Trust facts (each one is how the product works today) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-mono font-bold text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] px-2.5 py-1">TLS ENCRYPTED</span>
            <span className="text-[10px] font-mono font-bold text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] px-2.5 py-1">SIGNED WEBHOOKS</span>
            <span className="text-[10px] font-mono font-bold text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] px-2.5 py-1">RECORDING OFF BY DEFAULT</span>
            <span className="text-[10px] font-mono font-bold text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] px-2.5 py-1">9 AM–9 PM IST CAMPAIGNS</span>
          </div>
        </div>

        {/* Column 1: Client Verticals */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-[#121212] font-mono tracking-wider uppercase">
            Client Solutions
          </p>
          <ul className="space-y-2.5 text-sm">
            <li>
              <a href={hrefFor("use-cases", "ecommerce")} onClick={(e) => go(e, "use-cases", "ecommerce")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                E-Commerce COD & RTO
              </a>
            </li>
            <li>
              <a href={hrefFor("use-cases", "healthcare")} onClick={(e) => go(e, "use-cases", "healthcare")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Healthcare Clinic Intake
              </a>
            </li>
            <li>
              <a href={hrefFor("use-cases", "finance")} onClick={(e) => go(e, "use-cases", "finance")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                BFSI & EMI Collections
              </a>
            </li>
            <li>
              <a href={hrefFor("use-cases", "realestate")} onClick={(e) => go(e, "use-cases", "realestate")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Real Estate Speed-to-Lead
              </a>
            </li>
            <li>
              <a href={hrefFor("use-cases", "logistics")} onClick={(e) => go(e, "use-cases", "logistics")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Home Services Dispatch
              </a>
            </li>
            <li>
              <a href={hrefFor("use-cases", "bpo")} onClick={(e) => go(e, "use-cases", "bpo")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                BPO & Overflow Deflection
              </a>
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
              <a href={hrefFor("use-cases", "healthcare")} onClick={(e) => go(e, "use-cases", "healthcare")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Front Desk Receptionist
              </a>
            </li>
            <li>
              <a href={hrefFor("blog-healthcare")} onClick={(e) => go(e, "blog-healthcare")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Dental Clinic Scheduler
              </a>
            </li>
            <li>
              <a href={hrefFor("use-cases", "saas")} onClick={(e) => go(e, "use-cases", "saas")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                B2B Lead Qualifier (SDR)
              </a>
            </li>
            <li>
              <a href={hrefFor("use-cases", "ecommerce")} onClick={(e) => go(e, "use-cases", "ecommerce")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Win-Back & Reactivation
              </a>
            </li>
            <li>
              <a href={hrefFor("blog-fintech")} onClick={(e) => go(e, "blog-fintech")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                EMI Pre-Due & Overdue
              </a>
            </li>
            <li>
              <a href={hrefFor("use-cases", "saas")} onClick={(e) => go(e, "use-cases", "saas")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                After-Hours P1 Triage
              </a>
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
              <a href={hrefFor("guide")} onClick={(e) => go(e, "guide")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Product Guide (Dashboard How-To)
              </a>
            </li>
            <li>
              <a href={hrefFor("how-it-works")} onClick={(e) => go(e, "how-it-works")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                How a Call Works
              </a>
            </li>
            <li>
              <a href={hrefFor("voices")} onClick={(e) => go(e, "voices")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                HD Voices & 7 Languages
              </a>
            </li>
            <li>
              <a href={hrefFor("pricing")} onClick={(e) => go(e, "pricing")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Pricing (plans from ₹3,799)
              </a>
            </li>
            <li>
              <a href={hrefFor("docs")} onClick={(e) => go(e, "docs")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Developer API & Webhooks
              </a>
            </li>
            <li>
              <a href={hrefFor("voice-ai-index")} onClick={(e) => go(e, "voice-ai-index")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Voice AI Index (Knowledge)
              </a>
            </li>
            <li>
              <a href={hrefFor("faq")} onClick={(e) => go(e, "faq")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                FAQ
              </a>
            </li>
            <li>
              <a href={hrefFor("ai-voice-agent-software")} onClick={(e) => go(e, "ai-voice-agent-software")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                AI Voice Agent Software
              </a>
            </li>
            <li>
              <a href={hrefFor("blog")} onClick={(e) => go(e, "blog")} className="text-[#262523] hover:text-[#121212] hover:underline transition-colors text-left font-medium">
                Blog & Guides
              </a>
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
                href="https://www.linkedin.com/company/claritiy/"
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
            <a href={hrefFor("privacy")} onClick={(e) => go(e, "privacy")} className="hover:text-[#121212] hover:underline transition-colors">
              Privacy Policy
            </a>
            <a href={hrefFor("terms")} onClick={(e) => go(e, "terms")} className="hover:text-[#121212] hover:underline transition-colors">
              Terms of Use
            </a>
            <a href={hrefFor("security")} onClick={(e) => go(e, "security")} className="hover:text-[#121212] hover:underline transition-colors">
              Security Architecture
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[#121212] font-bold bg-[#DFDCD4] px-2.5 py-1 rounded-[2px] border border-[#CBC8BE]">
            Plans from ₹3,799 · 750 minutes
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-4 pt-2 text-center text-[11px] text-[#5E5D57] font-mono">
        You decide how your agent introduces itself. We recommend that every agent tells callers they are speaking with an AI assistant; for many uses the law requires it.
      </div>
    </footer>
  );
}

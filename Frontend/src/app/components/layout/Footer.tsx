import { Mic } from "lucide-react";

type Page = 
  | "home" 
  | "solutions" 
  | "how-it-works" 
  | "voices" 
  | "pricing" 
  | "compare" 
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
  | "voice-ai-index";

interface FooterProps {
  setPage: (p: Page) => void;
}

export default function Footer({ setPage }: FooterProps) {
  return (
    <footer className="border-t border-[#EADEC9]/60 bg-[#FFFDF9] py-16 px-6 relative z-10 text-slate-600">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3 h-8">
            <img src="/logo.png" alt="Clarity Voice Logo" className="h-8 w-auto object-contain" />
            <span className="font-sora text-lg font-extrabold tracking-tight text-[#0F172A]">
              Clarity<span className="text-[#059669]">Voice</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-plus-jakarta">
            Enterprise-grade conversational voice AI automation. Built for high-volume order confirmation, customer qualification, and appointment scheduling.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-[10px] font-bold text-slate-500 border border-[#EADEC9] rounded px-2 py-0.5 bg-white font-mono">HIPAA COMPLIANT</span>
            <span className="text-[10px] font-bold text-slate-500 border border-[#EADEC9] rounded px-2 py-0.5 bg-white font-mono">SOC 2 TYPE II</span>
            <span className="text-[10px] font-bold text-slate-500 border border-[#EADEC9] rounded px-2 py-0.5 bg-white font-mono">GDPR AUDITED</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 w-full md:w-auto">
          {[
            {
              heading: "Solutions",
              links: [
                { label: "COD Confirmation", action: () => setPage("solutions") },
                { label: "Healthcare Receptionist", action: () => setPage("solutions") },
                { label: "Real Estate Qualification", action: () => setPage("solutions") },
                { label: "Debt Recovery", action: () => setPage("solutions") },
              ]
            },
            {
              heading: "Platform",
              links: [
                { label: "Features", action: () => setPage("how-it-works") },
                { label: "HD Voices Gallery", action: () => setPage("voices") },
                { label: "Pricing & ROI Calculator", action: () => setPage("pricing") },
                { label: "Comparison", action: () => setPage("compare") },
              ]
            },
            {
              heading: "Resources",
              links: [
                { label: "Voice AI Index (Book)", action: () => setPage("voice-ai-index") },
                { label: "Operational Blog", action: () => setPage("blog") },
                { label: "Developer Docs", action: () => setPage("docs") },
                { label: "WhatsApp Support", action: () => window.open("https://wa.me/919707337259?text=Hello%20Clarity%20Voice%20Team", "_blank") },
                { label: "LinkedIn", action: () => window.open("https://www.linkedin.com/company/clarity-voice", "_blank") },
              ]
            },
            {
              heading: "Legal",
              links: [
                { label: "Privacy Policy", action: () => setPage("privacy") },
                { label: "Terms of Use", action: () => setPage("terms") },
                { label: "Security & Standards", action: () => setPage("security") },
              ]
            },
          ].map((col) => (
            <div key={col.heading}>
              <p className="text-xs font-bold mb-4 text-[#0F172A] font-mono tracking-wider uppercase">
                {col.heading}
              </p>
              <div className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <button
                    key={l.label}
                    onClick={l.action}
                    className="block text-left text-sm text-slate-500 hover:text-[#059669] cursor-pointer transition-colors border-none bg-transparent p-0 w-fit font-semibold"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-[#EADEC9]/40 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-plus-jakarta">
        <p>&copy; 2026 Clarity Voice. All rights reserved.</p>
        <p className="font-mono text-[#059669] font-bold">Predictable Pay-As-You-Go from ₹3.99/min</p>
      </div>
    </footer>
  );
}

import { useState, useEffect } from "react";
import { Mic, X, Menu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
  | "dashboard" 
  | "industries";

interface NavbarProps {
  page: Page;
  setPage: (p: Page) => void;
}

export default function Navbar({ page, setPage }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links: { label: string; id: Page }[] = [
    { label: "Platform", id: "home" },
    { label: "Solutions", id: "solutions" },
    { label: "HD Voices", id: "voices" },
    { label: "Pricing", id: "pricing" },
    { label: "Comparison", id: "compare" },
    { label: "Blog", id: "blog" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-305 ${
        scrolled 
          ? "bg-white/80 backdrop-blur-md border-b border-[#EADEC9]/55 shadow-[0_4px_30px_rgba(5,150,105,0.03)]" 
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Brand logo & name */}
        <button
          onClick={() => setPage("home")}
          className="flex items-center gap-3 h-20 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#059669] to-[#10B981] flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Mic className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-sora text-xl font-extrabold tracking-tight text-[#0F172A] group-hover:text-[#059669] transition-colors">
            Clarity<span className="text-[#059669] group-hover:text-[#0F172A] transition-colors">Voice</span>
          </span>
        </button>

        {/* Live System Pill */}
        <div className="hidden lg:flex items-center gap-2 bg-white border border-[#EADEC9] rounded-full px-3 py-1 text-xs shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse shadow-[0_0_8px_#059669]" />
          <span className="text-slate-500 font-mono tracking-tight">
            API Uptime: <span className="text-slate-800 font-semibold">99.99%</span> · Latency: <span className="text-[#059669] font-semibold">&lt;180ms</span>
          </span>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => setPage(l.id)}
              className={`text-sm font-semibold transition-all relative py-1.5 ${
                page === l.id || (l.id === "blog" && (page === "blog-rto" || page === "blog-healthcare" || page === "blog-fintech"))
                  ? "text-[#059669] font-bold" 
                  : "text-slate-600 hover:text-[#059669]"
              }`}
            >
              {l.label}
              {(page === l.id || (l.id === "blog" && (page === "blog-rto" || page === "blog-healthcare" || page === "blog-fintech"))) && (
                <motion.div
                  layoutId="activeNavTab"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#059669] to-[#10B981] rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => setPage("dashboard")}
            className="text-sm font-semibold text-slate-700 hover:text-[#059669] transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => setPage("dashboard")}
            className="relative group overflow-hidden bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#10B981] hover:to-[#059669] text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300 active:scale-95"
          >
            Start Free Test Call
          </button>
        </div>

        {/* Mobile menu trigger */}
        <button className="md:hidden p-2 text-slate-600 hover:text-[#059669] transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-[#EADEC9] overflow-hidden"
          >
            <div className="px-6 py-5 flex flex-col gap-4">
              {links.map((l) => (
                <button
                  key={l.id}
                  onClick={() => { setPage(l.id); setMenuOpen(false); }}
                  className={`text-left text-sm font-bold py-1 ${page === l.id ? "text-[#059669]" : "text-slate-600 hover:text-[#059669]"}`}
                >
                  {l.label}
                </button>
              ))}
              <div className="w-full h-px bg-slate-100 my-1" />
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => { setPage("dashboard"); setMenuOpen(false); }}
                  className="text-sm font-bold text-slate-600 hover:text-[#059669]"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setPage("dashboard"); setMenuOpen(false); }}
                  className="bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-bold px-5 py-2 rounded-full"
                >
                  Start Free
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

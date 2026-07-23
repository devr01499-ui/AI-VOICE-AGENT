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
  | "privacy"
  | "terms"
  | "security"
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
    { label: "Platform & Features", id: "how-it-works" },
    { label: "Industry Solutions", id: "solutions" },
    { label: "HD Voices Gallery", id: "voices" },
    { label: "Pricing Plans", id: "pricing" },
    { label: "Comparison Guide", id: "compare" },
    { label: "Insights & Blog", id: "blog" },
  ];

  return (
    <nav
      className="fixed top-4 left-4 right-4 z-50 transition-all duration-300 rounded-2xl bg-white/85 border border-[#EADEC9]/80 px-10 py-5"
      style={{
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(5, 150, 105, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8), 0 1px 0 0 rgba(234, 222, 201, 0.6)",
        transform: "perspective(1000px) rotateX(1deg) translateY(0px)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)"
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand logo & name */}
        <button
          onClick={() => setPage("home")}
          className="flex items-center gap-3 group"
        >
          <img 
            src="/logo.png" 
            alt="Clarity Voice Logo" 
            className="h-10 w-auto object-contain group-hover:scale-105 transition-transform" 
          />
          <span className="font-sora text-xl font-extrabold tracking-tight text-[#0F172A] group-hover:text-[#059669] transition-colors">
            Clarity<span className="text-[#059669] group-hover:text-[#0F172A] transition-colors">Voice</span>
          </span>
        </button>

        {/* Navigation Links */}
        <div className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => setPage(l.id)}
              className={`text-sm font-semibold transition-all relative py-1.5 ${
                page === l.id || (l.id === "blog" && (page === "blog-rto" || page === "blog-healthcare" || page === "blog-fintech"))
                  ? "text-[#059669] font-bold" 
                  : "text-slate-700 hover:text-[#059669]"
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
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setPage("dashboard")}
            className="text-sm font-semibold text-slate-700 hover:text-[#059669] transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => setPage("dashboard")}
            className="relative group overflow-hidden bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#10B981] hover:to-[#059669] text-white font-bold text-sm px-6 py-3 rounded-full shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300 active:scale-95"
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

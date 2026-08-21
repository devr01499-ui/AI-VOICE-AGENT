import { useState } from "react";
import { X, Menu, ArrowRight, ChevronDown, Zap, Users, Globe2, BookOpen, Layers } from "lucide-react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "motion/react";

type Page =
  | "home" | "solutions" | "how-it-works" | "voices" | "pricing"
  | "blog" | "blog-rto" | "blog-healthcare" | "blog-fintech"
  | "docs" | "privacy" | "terms" | "security" | "dashboard" | "industries" | "voice-ai-index" | "faq" | "contact";

interface NavbarProps {
  page: Page;
  setPage: (p: Page) => void;
}

const PLATFORM_ITEMS = [
  { icon: Zap, label: "How Claritiy Works", desc: "Sub-180ms real-time audio engine", id: "how-it-works" as Page },
  { icon: Layers, label: "Enterprise Solutions", desc: "COD confirmation & clinic intake", id: "solutions" as Page },
  { icon: Globe2, label: "HD Voice Gallery", desc: "70+ languages & regional accents", id: "voices" as Page },
];

const RESOURCE_ITEMS = [
  { icon: BookOpen, label: "Developer Docs", desc: "API, SDK & integrations", id: "docs" as Page },
  { icon: Users, label: "Blog & Research", desc: "Industry insights & case studies", id: "blog" as Page },
];

export default function Navbar({ page, setPage }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => {
    setScrolled(v > 30);
  });

  const navigate = (id: Page) => {
    setPage(id);
    setActiveDropdown(null);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {/* ── Main Navbar ───────────────────────────────────────────────────── */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 pt-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="w-full max-w-7xl rounded-2xl flex items-center justify-between px-5 py-3 relative"
          animate={{
            background: scrolled ? "rgba(247,245,242,0.92)" : "rgba(247,245,242,0.75)",
            boxShadow: scrolled
              ? "0 8px 32px rgba(13,17,23,0.10), 0 1px 0 rgba(255,255,255,0.8) inset, 0 0 0 1px rgba(232,226,217,0.8)"
              : "0 2px 12px rgba(13,17,23,0.06), 0 1px 0 rgba(255,255,255,0.6) inset, 0 0 0 1px rgba(232,226,217,0.5)",
            backdropFilter: scrolled ? "blur(20px)" : "blur(12px)",
          }}
          transition={{ duration: 0.3 }}
          style={{ WebkitBackdropFilter: "blur(20px)" }}
        >
          {/* Brand */}
          <button
            onClick={() => navigate("home")}
            className="flex items-center gap-2.5 group flex-shrink-0"
          >
            <img src="/logo.png" alt="Claritiy Voice" className="h-8 w-auto object-contain" />
            <span className="font-extrabold text-[17px] tracking-tight text-[#0D1117]"
              style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Claritiy <span className="text-[#059669]">Voice</span>
            </span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {/* How It Works */}
            <button onClick={() => navigate("how-it-works")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${page === "how-it-works" ? "bg-[#D1FAE5] text-[#059669]" : "text-[#4B5563] hover:text-[#0D1117] hover:bg-black/[0.04]"}`}>
              How It Works
            </button>

            {/* Solutions */}
            <button onClick={() => navigate("solutions")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${page === "solutions" ? "bg-[#D1FAE5] text-[#059669]" : "text-[#4B5563] hover:text-[#0D1117] hover:bg-black/[0.04]"}`}>
              Solutions
            </button>

            {/* Voices */}
            <button onClick={() => navigate("voices")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${page === "voices" ? "bg-[#D1FAE5] text-[#059669]" : "text-[#4B5563] hover:text-[#0D1117] hover:bg-black/[0.04]"}`}>
              Voices
            </button>

            {/* Pricing */}
            <button onClick={() => navigate("pricing")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${page === "pricing" ? "bg-[#D1FAE5] text-[#059669]" : "text-[#4B5563] hover:text-[#0D1117] hover:bg-black/[0.04]"}`}>
              Pricing
            </button>

            {/* Resources dropdown */}
            <div className="relative"
              onMouseEnter={() => setActiveDropdown("resources")}
              onMouseLeave={() => setActiveDropdown(null)}>
              <button className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeDropdown === "resources" || page === "blog" || page === "docs" ? "bg-[#D1FAE5] text-[#059669]" : "text-[#4B5563] hover:text-[#0D1117] hover:bg-black/[0.04]"}`}>
                Resources <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {activeDropdown === "resources" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white border border-[#E8E2D9] p-3 z-50"
                    style={{ boxShadow: "0 20px 60px rgba(13,17,23,0.12), 0 4px 16px rgba(13,17,23,0.07)" }}
                  >
                    {RESOURCE_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button key={item.label} onClick={() => navigate(item.id)}
                          className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-[#F0FDF4] transition-colors text-left group">
                          <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-[#059669] transition-colors">
                            <Icon className="w-4 h-4 text-[#059669] group-hover:text-white transition-colors" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#0D1117]">{item.label}</p>
                            <p className="text-xs text-[#9CA3AF] mt-0.5">{item.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate("dashboard")}
              className="text-sm font-semibold text-[#4B5563] hover:text-[#059669] transition-colors px-3 py-2">
              Sign In
            </button>
            <button onClick={() => navigate("dashboard")}
              className="btn-primary text-sm py-2.5 px-5">
              Get Started
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-xl hover:bg-black/5 transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
            <AnimatePresence mode="wait">
              {menuOpen
                ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-5 h-5 text-[#0D1117]" /></motion.div>
                : <motion.div key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="w-5 h-5 text-[#0D1117]" /></motion.div>
              }
            </AnimatePresence>
          </button>
        </motion.div>
      </motion.nav>

      {/* ── Mobile Drawer ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute top-0 right-0 bottom-0 w-[300px] bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-[#E8E2D9]">
                <span className="font-extrabold text-[#0D1117]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  Claritiy<span className="text-[#059669]">Voice</span>
                </span>
                <button onClick={() => setMenuOpen(false)} className="p-2 rounded-xl hover:bg-black/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-1">
                {[
                  { label: "How It Works", id: "how-it-works" as Page },
                  { label: "Solutions", id: "solutions" as Page },
                  { label: "HD Voice Gallery", id: "voices" as Page },
                  { label: "Pricing Plans", id: "pricing" as Page },
                  { label: "Blog & Insights", id: "blog" as Page },
                  { label: "Developer Docs", id: "docs" as Page },
                ].map((l) => (
                  <button key={l.id} onClick={() => navigate(l.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all ${page === l.id ? "bg-[#D1FAE5] text-[#059669]" : "hover:bg-black/[0.04] text-[#4B5563]"}`}>
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="p-5 space-y-3 border-t border-[#E8E2D9]">
                <button onClick={() => navigate("dashboard")} className="w-full py-3 text-sm font-semibold text-[#4B5563] hover:text-[#059669] transition-colors">
                  Sign In
                </button>
                <button onClick={() => navigate("dashboard")} className="w-full btn-primary justify-center">
                  Get Started <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


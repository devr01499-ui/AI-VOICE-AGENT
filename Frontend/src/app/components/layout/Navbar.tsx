import { useState } from "react";
import { X, Menu, ArrowRight, ChevronDown, Zap, Users, Globe2, BookOpen, Layers, Workflow } from "lucide-react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "motion/react";

import { Session } from "@supabase/supabase-js";

type Page = any;

interface NavbarProps {
  page: Page;
  setPage: (p: Page) => void;
  session?: Session | null;
}

const PLATFORM_ITEMS = [
  { icon: Zap, label: "How Claritiy Works", desc: "Sub-180ms real-time audio engine", id: "how-it-works" as Page },
  { icon: Layers, label: "Enterprise Solutions", desc: "COD confirmation & clinic intake", id: "solutions" as Page },
  { icon: Workflow, label: "Use Case Blueprints", desc: "Industry diagrams & wiremaps", id: "use-cases" as Page },
  { icon: Globe2, label: "HD Voice Gallery", desc: "70+ languages & regional accents", id: "voices" as Page },
];

const RESOURCE_ITEMS = [
  { icon: BookOpen, label: "Developer Docs", desc: "API, SDK & integrations", id: "docs" as Page },
  { icon: Users, label: "Blog & Research", desc: "Industry insights & case studies", id: "blog" as Page },
];

export default function Navbar({ page, setPage, session }: NavbarProps) {
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
      {/* ── Main Navbar (EdgeSkool Wireframe Editorial Style) ────────────── */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 bg-[#E5E3DC]/95 backdrop-blur-md border-b border-[#CBC8BE]"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          {/* Brand */}
          <button
            onClick={() => navigate("home")}
            className="flex items-center gap-2.5 group flex-shrink-0"
          >
            <img src="/logo.png" alt="Claritiy Voice" className="h-7 w-auto object-contain" />
            <span className="font-semibold text-[15px] tracking-tight text-[#121212] font-mono">
              Claritiy <span className="text-[#5E5D57]">Voice</span>
            </span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-2">
            {/* How It Works */}
            <button onClick={() => navigate("how-it-works")}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${page === "how-it-works" ? "text-[#121212] font-bold border-b border-[#121212]" : "text-[#5E5D57] hover:text-[#121212]"}`}>
              How It Works
            </button>

            {/* Solutions */}
            <button onClick={() => navigate("solutions")}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${page === "solutions" ? "text-[#121212] font-bold border-b border-[#121212]" : "text-[#5E5D57] hover:text-[#121212]"}`}>
              Solutions
            </button>

            {/* Voices */}
            <button onClick={() => navigate("voices")}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${page === "voices" ? "text-[#121212] font-bold border-b border-[#121212]" : "text-[#5E5D57] hover:text-[#121212]"}`}>
              Voices
            </button>

            {/* Pricing */}
            <button onClick={() => navigate("pricing")}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${page === "pricing" ? "text-[#121212] font-bold border-b border-[#121212]" : "text-[#5E5D57] hover:text-[#121212]"}`}>
              Pricing
            </button>

            {/* Resources dropdown */}
            <div className="relative"
              onMouseEnter={() => setActiveDropdown("resources")}
              onMouseLeave={() => setActiveDropdown(null)}>
              <button className={`flex items-center gap-1 px-3 py-1.5 text-xs font-mono transition-colors ${activeDropdown === "resources" || page === "blog" || page === "docs" ? "text-[#121212] font-bold border-b border-[#121212]" : "text-[#5E5D57] hover:text-[#121212]"}`}>
                Resources <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {activeDropdown === "resources" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-64 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] p-2 z-50 shadow-md"
                  >
                    {RESOURCE_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button key={item.label} onClick={() => navigate(item.id)}
                          className="w-full flex items-start gap-2.5 p-2.5 rounded-[2px] hover:bg-[#E5E3DC] transition-colors text-left group">
                          <div className="w-7 h-7 rounded-[2px] bg-[#DFDCD4] flex items-center justify-center flex-shrink-0 mt-0.5 text-[#121212]">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-mono font-bold text-[#121212]">{item.label}</p>
                            <p className="text-[11px] text-[#66645E] mt-0.5">{item.desc}</p>
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
          <div className="hidden md:flex items-center gap-2.5">
            {session ? (
              <button onClick={() => navigate("dashboard")}
                className="bg-[#121212] text-white hover:bg-neutral-800 rounded-[2px] px-4 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-colors">
                Go to Dashboard
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <>
                <button onClick={() => navigate("how-it-works")}
                  className="border border-[#9C998F] text-[#121212] bg-transparent hover:border-[#121212] hover:bg-black/5 rounded-[2px] px-3.5 py-1.5 text-xs font-mono tracking-wider transition-colors">
                  How It Works
                </button>
                <button onClick={() => navigate("dashboard")}
                  className="bg-[#121212] text-white hover:bg-neutral-800 rounded-[2px] px-4 py-1.5 text-xs font-mono tracking-wider flex items-center gap-2 transition-colors">
                  Join Now
                </button>
              </>
            )}
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
        </div>
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
              className="absolute top-0 right-0 bottom-0 w-[300px] bg-[#EBE9E2] border-l border-[#CBC8BE] flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-[#CBC8BE]">
                <span className="font-semibold text-[#121212] font-mono text-sm">
                  Claritiy <span className="text-[#5E5D57]">Voice</span>
                </span>
                <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-black/5 rounded-[2px]">
                  <X className="w-5 h-5 text-[#121212]" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {[
                  { label: "How It Works", id: "how-it-works" as Page },
                  { label: "Solutions", id: "solutions" as Page },
                  { label: "HD Voice Gallery", id: "voices" as Page },
                  { label: "Pricing Plans", id: "pricing" as Page },
                  { label: "Blog & Insights", id: "blog" as Page },
                  { label: "Developer Docs", id: "docs" as Page },
                ].map((l) => (
                  <button key={l.id} onClick={() => navigate(l.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-[2px] font-mono text-xs transition-colors ${page === l.id ? "bg-[#DFDCD4] font-bold text-[#121212]" : "hover:bg-black/[0.04] text-[#5E5D57]"}`}>
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-2 border-t border-[#CBC8BE]">
                <button onClick={() => navigate("how-it-works")} className="w-full py-2.5 border border-[#9C998F] rounded-[2px] text-xs font-mono text-[#121212] hover:bg-black/5 transition-colors">
                  How It Works
                </button>
                <button onClick={() => navigate("dashboard")} className="w-full bg-[#121212] text-white py-2.5 rounded-[2px] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2">
                  Join Now <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


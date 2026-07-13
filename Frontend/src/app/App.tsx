import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import AuthGateway from "./components/auth/AuthGateway";
import { Session } from "@supabase/supabase-js";
import BillingGateway from "./components/settings/BillingGateway";
import AgentConfigPanel from "./components/agents/AgentConfigPanel";
import { AnalyticsOverview } from "./components/analytics/AnalyticsOverview";
import {
  fetchAgents, fetchCalls, fetchProfile, createAgent, updateAgent,
  initiateCall, getCallTranscript, getLiveTranscriptWsUrl,
  fetchKBList, uploadKBDocument, scrapeKBUrl, deleteKBDocument,
  DEV_USER_ID, DEFAULT_AGENT_ID,
  type ApiAgent, type ApiCall, type ApiProfile,
} from "./api";
import { motion, AnimatePresence } from "motion/react";
import {
  PhoneCall, PhoneOff, Mic, BarChart3, Settings, ChevronRight,
  Play, Pause, Check, ArrowRight, Globe, HeartPulse, ShoppingBag,
  Landmark, GraduationCap, Truck, Building2, Hotel, Activity,
  Clock, TrendingUp, Plus, Search, Bell, LayoutDashboard, Bot,
  PhoneIncoming, CircleDot, X, Menu, Zap, Shield, Volume2,
  Phone, Radio, BookOpen, Mic2, Network, FileText, Upload, Link,
  Cpu, MessageSquare, Eye, EyeOff, Copy, RefreshCw, Trash2,
  Edit3, Download, Send, PlayCircle, PauseCircle, StopCircle,
  CheckCircle2, AlertCircle, Info, Star, Headphones, Wand2,
  ChevronLeft, ChevronDown, Users, Key, Sliders,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Page = "home" | "industries" | "pricing" | "dashboard";

// ─── Sound Wave Component ─────────────────────────────────────────────────────
function SoundWave({ active = true, bars = 32, className = "" }: { active?: boolean; bars?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-[2px] ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="bg-foreground rounded-full"
          style={{
            width: "2px",
            height: active ? `${8 + Math.sin(i * 0.6) * 14 + Math.random() * 8}px` : "4px",
            animation: active ? `wave ${0.8 + (i % 5) * 0.15}s ease-in-out infinite alternate` : "none",
            animationDelay: `${i * 0.04}s`,
            opacity: 0.15 + (i % 4) * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = target / 60;
          const timer = setInterval(() => {
            start += step;
            if (start >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links: { label: string; id: Page }[] = [
    { label: "Home", id: "home" },
    { label: "Industries", id: "industries" },
    { label: "Pricing", id: "pricing" },
    { label: "Dashboard", id: "dashboard" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => setPage("home")}
          className="flex items-center h-8 group"
        >
          <img src="/logo.png" alt="Clarity Voice Logo" className="h-full w-auto object-contain" />
        </button>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => setPage(l.id)}
              className={`text-sm font-medium transition-colors ${
                page === l.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontFamily: "'Figtree', sans-serif" }}
          >
            Sign in
          </button>
          <button
            onClick={() => setPage("dashboard")}
            className="bg-foreground text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-foreground/90 transition-all"
            style={{ fontFamily: "'Figtree', sans-serif" }}
          >
            Start free
          </button>
        </div>

        <button className="md:hidden p-1" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-border overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {links.map((l) => (
                <button
                  key={l.id}
                  onClick={() => { setPage(l.id); setMenuOpen(false); }}
                  className={`text-left text-sm font-medium ${page === l.id ? "text-foreground" : "text-muted-foreground"}`}
                  style={{ fontFamily: "'Figtree', sans-serif" }}
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => { setPage("dashboard"); setMenuOpen(false); }}
                className="bg-foreground text-white text-sm font-medium px-4 py-2 rounded-full w-fit"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                Start free
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
function HomePage({ setPage }: { setPage: (p: Page) => void }) {
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 border border-border rounded-full px-3 py-1 mb-8">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                Trusted by 2,400+ enterprises worldwide
              </span>
            </div>

            <h1
              className="text-5xl lg:text-6xl xl:text-7xl font-normal leading-[1.08] tracking-tight mb-6 text-foreground"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Voice AI that sounds{" "}
              <span className="italic">genuinely</span>
              <br />human.
            </h1>

            <p
              className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-md"
              style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 400 }}
            >
              Clarity Voice deploys intelligent voice agents that handle calls with empathy, precision, and clarity — at any scale, in any industry, around the clock.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setPage("dashboard")}
                className="bg-foreground text-white font-medium px-6 py-3 rounded-full hover:bg-foreground/90 transition-all flex items-center gap-2 group"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                Deploy your first agent
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                className="border border-border font-medium px-6 py-3 rounded-full hover:bg-muted transition-all flex items-center gap-2"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                <Play className="w-4 h-4" />
                Hear a live demo
              </button>
            </div>
          </motion.div>

          {/* Hero visual — live call card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="relative bg-white border border-border rounded-2xl p-6 shadow-sm">
              {/* Call card header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>
                      LIVE CALL — 04:32
                    </span>
                  </div>
                  <p className="font-semibold text-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    Sarah Mitchell
                  </p>
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    +1 (555) 847-2291 · Insurance inquiry
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-8 h-8 border border-border rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button className="w-8 h-8 bg-red-50 border border-red-100 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors">
                    <PhoneOff className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Waveform */}
              <div className="bg-muted rounded-xl p-4 mb-4">
                <SoundWave active={isPlaying} bars={48} className="w-full justify-center" />
              </div>

              {/* Transcript */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-foreground rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-muted rounded-xl rounded-tl-none px-3 py-2 flex-1">
                    <p className="text-xs text-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                      "Hi Sarah! I can see your policy renewal is coming up on August 15th. Would you like me to walk you through your updated coverage options?"
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-foreground rounded-xl rounded-tr-none px-3 py-2 max-w-[75%]">
                    <p className="text-xs text-white" style={{ fontFamily: "'Figtree', sans-serif" }}>
                      "Yes please, I was just thinking about that."
                    </p>
                  </div>
                  <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-muted-foreground">S</span>
                  </div>
                </div>
              </div>

              {/* Intent badge */}
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                    INTENT
                  </span>
                  <span className="bg-foreground text-white text-xs px-2 py-0.5 rounded-full" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    Policy renewal
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                    SENTIMENT
                  </span>
                  <span className="text-xs font-medium text-emerald-600" style={{ fontFamily: "'Figtree', sans-serif" }}>Positive</span>
                </div>
              </div>
            </div>

            {/* Floating stat cards */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-8 top-1/4 bg-white border border-border rounded-xl px-4 py-3 shadow-sm hidden lg:block"
            >
              <p className="text-xs text-muted-foreground mb-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>AVG CSAT</p>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>4.8<span className="text-sm text-muted-foreground">/5</span></p>
            </motion.div>

            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute -right-4 bottom-1/4 bg-white border border-border rounded-xl px-4 py-3 shadow-sm hidden lg:block"
            >
              <p className="text-xs text-muted-foreground mb-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>CALLS TODAY</p>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>12,847</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x divide-border">
          {[
            { value: 98, suffix: "%", label: "Call completion rate", sub: "Industry avg. 71%" },
            { value: 2400, suffix: "+", label: "Enterprise customers", sub: "Across 38 countries" },
            { value: 50, suffix: "M+", label: "Calls handled monthly", sub: "At any scale" },
            { value: 99, suffix: ".9%", label: "Platform uptime SLA", sub: "With 24/7 support" },
          ].map((s) => (
            <div key={s.label} className="md:px-8 first:pl-0 last:pr-0">
              <p
                className="text-4xl font-bold text-foreground mb-1"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                <Counter target={s.value} suffix={s.suffix} />
              </p>
              <p className="text-sm font-medium text-foreground mb-0.5" style={{ fontFamily: "'Figtree', sans-serif" }}>
                {s.label}
              </p>
              <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features — asymmetric grid */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="mb-16">
          <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>
            Why Clarity Voice
          </p>
          <h2
            className="text-4xl lg:text-5xl font-normal leading-tight max-w-xl"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Built for the real-world complexity of{" "}
            <span className="italic">enterprise voice.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Large card */}
          <div className="md:col-span-2 border border-border rounded-2xl p-8 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 border border-border rounded-xl flex items-center justify-center mb-6">
              <Mic className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3
              className="text-2xl font-normal mb-3"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Ultra-low latency voice synthesis
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Our proprietary voice pipeline delivers sub-200ms response latency — the threshold below which humans perceive a conversation as natural. Callers never feel the pause. They feel heard.
            </p>
            <div className="bg-muted rounded-xl p-4">
              <SoundWave active={true} bars={64} />
            </div>
          </div>

          <div className="border border-border rounded-2xl p-8 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 border border-border rounded-xl flex items-center justify-center mb-6">
              <Globe className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3
              className="text-2xl font-normal mb-3"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              29 languages, native fluency
            </h3>
            <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: "'Figtree', sans-serif" }}>
              From US English to Mandarin, Brazilian Portuguese to Hindi — your agents speak with native-level idiom and cultural context, not translated scripts.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["EN", "ES", "FR", "DE", "ZH", "HI", "PT", "JA"].map((lang) => (
                <span key={lang} className="text-xs border border-border rounded px-2 py-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {lang}
                </span>
              ))}
              <span className="text-xs border border-border rounded px-2 py-1 text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>+21</span>
            </div>
          </div>

          <div className="border border-border rounded-2xl p-8 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 border border-border rounded-xl flex items-center justify-center mb-6">
              <Shield className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3
              className="text-2xl font-normal mb-3"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Enterprise-grade compliance
            </h3>
            <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: "'Figtree', sans-serif" }}>
              HIPAA, SOC 2 Type II, GDPR, PCI-DSS. Every call is encrypted end-to-end. Audit logs. Role-based access. Your legal team will sleep well.
            </p>
          </div>

          <div className="md:col-span-2 border border-border rounded-2xl p-8 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 border border-border rounded-xl flex items-center justify-center mb-6">
              <Zap className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3
              className="text-2xl font-normal mb-3"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Connect to every system your team already uses
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Native integrations with Salesforce, HubSpot, Epic, Zendesk, ServiceNow, Twilio, and 200+ more. Agents read and write to your CRM in real time — no post-call data entry.
            </p>
            <div className="flex flex-wrap gap-3">
              {["Salesforce", "HubSpot", "Epic EHR", "Zendesk", "ServiceNow", "Twilio", "Stripe", "SAP"].map((tool) => (
                <span
                  key={tool}
                  className="text-xs font-medium border border-border rounded-full px-3 py-1.5"
                  style={{ fontFamily: "'Figtree', sans-serif" }}
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-xs font-medium text-muted-foreground tracking-widest uppercase mb-12" style={{ fontFamily: "'DM Mono', monospace" }}>
            Trusted by teams at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50">
            {["Aetna", "JPMorgan", "Marriott", "CVS Health", "United Airlines", "Bank of America", "Stanford Health"].map((co) => (
              <span key={co} className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>
                {co}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              quote: "We replaced an entire 40-person inbound team over 6 months without a single customer complaint. The voice is indistinguishable from a skilled agent.",
              name: "Priya Chandrasekaran",
              role: "VP Operations, Aetna",
            },
            {
              quote: "Our appointment show rate went from 62% to 89% after deploying Clarity Voice for reminder calls. That's revenue we were literally leaving on the table.",
              name: "Dr. Michael Torres",
              role: "CMO, Lakeside Medical Group",
            },
            {
              quote: "The dashboard gives my team real visibility into every conversation. We caught a compliance issue in week one that would have been a major liability.",
              name: "Rachel Okonkwo",
              role: "Head of CX, Fidelity Direct",
            },
          ].map((t) => (
            <div key={t.name} className="border border-border rounded-2xl p-8">
              <p
                className="text-lg font-normal leading-relaxed text-foreground mb-6"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                "{t.quote}"
              </p>
              <div>
                <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  {t.name}
                </p>
                <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                  {t.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="bg-foreground rounded-3xl p-12 md:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 flex items-end justify-center opacity-10">
            <SoundWave active={true} bars={96} className="w-full" />
          </div>
          <div className="relative z-10">
            <h2
              className="text-4xl md:text-5xl font-normal leading-tight mb-4"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Ready to hear the <span className="italic">difference?</span>
            </h2>
            <p className="text-white/70 text-lg mb-8 max-w-md mx-auto" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Get your first AI voice agent live in under 15 minutes. No sales calls. No credit card.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => setPage("dashboard")}
                className="bg-white text-foreground font-medium px-6 py-3 rounded-full hover:bg-white/90 transition-all flex items-center gap-2"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                Start for free <ArrowRight className="w-4 h-4" />
              </button>
              <button
                className="border border-white/30 text-white font-medium px-6 py-3 rounded-full hover:bg-white/10 transition-all"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                Schedule a demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3 h-6">
              <img src="/logo.png" alt="Clarity Voice Logo" className="h-full w-auto object-contain" />
            </div>
            <p className="text-xs text-muted-foreground max-w-xs" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Intelligent voice agents for every industry. HIPAA · SOC 2 · GDPR · PCI-DSS certified.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-12">
            {[
              { heading: "Product", links: ["Features", "Industries", "Pricing", "API Docs"] },
              { heading: "Company", links: ["About", "Blog", "Careers", "Press"] },
              { heading: "Legal", links: ["Privacy", "Terms", "Security", "HIPAA"] },
            ].map((col) => (
              <div key={col.heading}>
                <p className="text-xs font-semibold mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {col.heading.toUpperCase()}
                </p>
                {col.links.map((l) => (
                  <p key={l} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-2 transition-colors" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    {l}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
            © 2025 CLARITY VOICE INC. — ALL RIGHTS RESERVED
          </p>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
            SOC 2 TYPE II · HIPAA · GDPR COMPLIANT
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Industries Page ──────────────────────────────────────────────────────────
function IndustriesPage({ setPage }: { setPage: (p: Page) => void }) {
  const [active, setActive] = useState<number | null>(null);

  const industries = [
    {
      icon: HeartPulse,
      name: "Healthcare",
      tagline: "Patient-first voice AI, built for compliance.",
      description:
        "From appointment scheduling and medication reminders to post-discharge follow-ups and prior authorization calls — Clarity Voice handles the full patient communication cycle while remaining HIPAA-compliant on every call.",
      useCases: ["Appointment reminders", "Prescription refill requests", "Insurance verification", "Discharge follow-up", "Chronic care check-ins"],
      stat: "89%",
      statLabel: "reduction in no-shows",
    },
    {
      icon: Landmark,
      name: "Financial Services",
      tagline: "Secure, compliant conversations at scale.",
      description:
        "Handle fraud alerts, loan inquiries, account servicing, and collections with voice agents that are PCI-DSS compliant, always consistent, and never rude — even on the toughest calls.",
      useCases: ["Fraud alert outreach", "Loan application follow-up", "Collections & payment plans", "KYC verification", "Card activation"],
      stat: "3.4\u00d7",
      statLabel: "collection rate improvement",
    },
    {
      icon: ShoppingBag,
      name: "Retail & E-Commerce",
      tagline: "Turn support calls into loyalty moments.",
      description:
        "Order status, returns, product availability, loyalty points — your customers want fast answers, not hold music. Clarity Voice resolves 94% of retail inquiries on the first call without human escalation.",
      useCases: ["Order tracking & updates", "Return & refund processing", "Loyalty program support", "Product recommendations", "Abandoned cart recovery"],
      stat: "94%",
      statLabel: "first-call resolution",
    },
    {
      icon: Hotel,
      name: "Hospitality & Travel",
      tagline: "Every guest feels like a priority.",
      description:
        "Reservation management, check-in instructions, flight status updates, and concierge requests — handled with warmth and accuracy across 29 languages, 24 hours a day.",
      useCases: ["Reservation confirmations", "Upsell & upgrade offers", "Cancellation handling", "Loyalty tier support", "Post-stay feedback"],
      stat: "4.9",
      statLabel: "avg guest satisfaction",
    },
    {
      icon: Truck,
      name: "Logistics & Supply Chain",
      tagline: "Proactive updates before customers ask.",
      description:
        "Delivery ETAs, exceptions, driver dispatch, and freight status — Clarity Voice eliminates the inbound call spike that hits every time a shipment is delayed.",
      useCases: ["Delivery notifications", "Exception management", "Driver coordination", "Freight status updates", "Returns scheduling"],
      stat: "62%",
      statLabel: "reduction in WISMO calls",
    },
    {
      icon: GraduationCap,
      name: "Education",
      tagline: "Connect with every student and family.",
      description:
        "Enrollment outreach, attendance alerts, financial aid follow-up, and admissions nurturing at scale — with the patience and clarity of your best counselor.",
      useCases: ["Enrollment campaigns", "Attendance notifications", "Financial aid outreach", "Admissions follow-up", "Event reminders"],
      stat: "41%",
      statLabel: "lift in enrollment rate",
    },
    {
      icon: Building2,
      name: "Real Estate",
      tagline: "Qualify leads before your agents call.",
      description:
        "Clarity Voice pre-qualifies inbound leads, schedules showings, follows up on listings, and nurtures long-cycle buyers — so your agents spend time closing, not chasing.",
      useCases: ["Lead qualification", "Showing scheduling", "Listing follow-up", "Mortgage inquiry routing", "Open house confirmation"],
      stat: "5\u00d7",
      statLabel: "more showings scheduled",
    },
    {
      icon: Activity,
      name: "Insurance",
      tagline: "Claims, renewals, and outreach — handled.",
      description:
        "From first notice of loss to renewal campaigns, Clarity Voice operates as a tireless extension of your contact center — with perfect recall of every policy detail.",
      useCases: ["FNOL intake", "Policy renewal outreach", "Claims status updates", "Coverage explanations", "Cross-sell campaigns"],
      stat: "78%",
      statLabel: "of renewals handled end-to-end",
    },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <section className="pt-32 pb-16 px-6 max-w-7xl mx-auto border-b border-border">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-4" style={{ fontFamily: "'DM Mono', monospace" }}>
            Industries
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <h1
              className="text-5xl lg:text-6xl font-normal leading-tight max-w-xl"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              One platform. Every industry that depends on{" "}
              <span className="italic">the phone.</span>
            </h1>
            <p className="text-muted-foreground max-w-sm" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Clarity Voice is purpose-built for eight verticals, with industry-specific language models, compliance profiles, and integrations pre-configured.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Industry list */}
      <section className="px-6 max-w-7xl mx-auto py-8">
        {industries.map((ind, i) => {
          const Icon = ind.icon;
          const isActive = active === i;
          return (
            <motion.div
              key={ind.name}
              className="border-b border-border last:border-b-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <button
                className="w-full py-6 flex items-center justify-between gap-4 text-left group"
                onClick={() => setActive(isActive ? null : i)}
              >
                <div className="flex items-center gap-6">
                  <div className="w-10 h-10 border border-border rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-muted transition-colors">
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p
                      className="text-xl font-normal text-foreground"
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                    >
                      {ind.name}
                    </p>
                    <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                      {ind.tagline}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden md:block text-right">
                    <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>
                      {ind.stat}
                    </p>
                    <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                      {ind.statLabel}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-muted-foreground transition-transform ${isActive ? "rotate-90" : ""}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-8 pl-16 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <p className="text-foreground leading-relaxed mb-6" style={{ fontFamily: "'Figtree', sans-serif" }}>
                          {ind.description}
                        </p>
                        <button
                          onClick={() => setPage("pricing")}
                          className="bg-foreground text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-foreground/90 transition-all flex items-center gap-2"
                          style={{ fontFamily: "'Figtree', sans-serif" }}
                        >
                          See {ind.name} pricing <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-3 tracking-wider uppercase" style={{ fontFamily: "'DM Mono', monospace" }}>
                          Common use cases
                        </p>
                        <ul className="space-y-2">
                          {ind.useCases.map((uc) => (
                            <li key={uc} className="flex items-center gap-2 text-sm text-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
                              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              {uc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </section>

      {/* CTA */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="bg-foreground rounded-3xl p-12 text-center text-white">
          <h2
            className="text-4xl font-normal mb-4"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Don&apos;t see your industry?
          </h2>
          <p className="text-white/70 mb-8 max-w-md mx-auto" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Clarity Voice is fully customizable. If your business runs on phone calls, we can build an agent for it.
          </p>
          <button
            className="bg-white text-foreground font-medium px-6 py-3 rounded-full hover:bg-white/90 transition-all"
            style={{ fontFamily: "'Figtree', sans-serif" }}
          >
            Talk to our team
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Pricing Page ─────────────────────────────────────────────────────────────
function PricingPage({ setPage }: { setPage: (p: Page) => void }) {
  const [annual, setAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      price: annual ? 99 : 129,
      desc: "For teams exploring AI voice for the first time.",
      minutes: "2,000",
      features: [
        "2,000 voice minutes/month",
        "1 active AI agent",
        "English only",
        "Basic call analytics",
        "Standard voice (3 options)",
        "Email support",
        "REST API access",
      ],
      cta: "Start free trial",
    },
    {
      name: "Growth",
      price: annual ? 399 : 499,
      desc: "For scaling teams with real call volume.",
      minutes: "12,000",
      features: [
        "12,000 voice minutes/month",
        "Up to 10 active AI agents",
        "8 languages",
        "Advanced analytics & transcripts",
        "Premium voice cloning",
        "CRM integrations (HubSpot, Salesforce)",
        "Priority chat support",
        "Webhooks & Zapier",
      ],
      cta: "Start free trial",
      highlight: true,
    },
    {
      name: "Enterprise",
      price: null,
      desc: "For organizations with complex compliance needs.",
      minutes: "Unlimited",
      features: [
        "Unlimited voice minutes",
        "Unlimited agents",
        "29 languages",
        "Custom voice cloning",
        "Dedicated infrastructure",
        "HIPAA / SOC 2 / PCI-DSS BAA",
        "Custom integrations & SLA",
        "24/7 dedicated support",
        "On-premise deployment option",
      ],
      cta: "Talk to sales",
    },
  ];

  return (
    <div className="bg-white min-h-screen">
      <section className="pt-32 pb-16 px-6 max-w-5xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-4" style={{ fontFamily: "'DM Mono', monospace" }}>
            Pricing
          </p>
          <h1
            className="text-5xl font-normal leading-tight mb-4"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Simple pricing. <span className="italic">No surprises.</span>
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-8" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Start with a free 14-day trial. No credit card required. Cancel any time.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center bg-muted rounded-full p-1 mb-12">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!annual ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${annual ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              Annual{" "}
              <span className="text-xs text-emerald-600 font-semibold">–20%</span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`rounded-2xl p-8 border ${
                plan.highlight
                  ? "bg-foreground text-white border-transparent"
                  : "border-border"
              }`}
            >
              <p
                className={`text-xs font-medium tracking-widest uppercase mb-3 ${plan.highlight ? "text-white/60" : "text-muted-foreground"}`}
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                {plan.name}
              </p>
              <div className="mb-4">
                {plan.price ? (
                  <p
                    className="text-5xl font-bold"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    ${plan.price}
                    <span className={`text-lg font-normal ${plan.highlight ? "text-white/60" : "text-muted-foreground"}`}>
                      /mo
                    </span>
                  </p>
                ) : (
                  <p
                    className="text-5xl font-bold"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    Custom
                  </p>
                )}
              </div>
              <p
                className={`text-sm mb-6 ${plan.highlight ? "text-white/70" : "text-muted-foreground"}`}
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                {plan.desc}
              </p>

              <button
                onClick={() => plan.price !== null ? setPage("dashboard") : undefined}
                className={`w-full py-2.5 rounded-full text-sm font-medium mb-8 transition-all ${
                  plan.highlight
                    ? "bg-white text-foreground hover:bg-white/90"
                    : "bg-foreground text-white hover:bg-foreground/90"
                }`}
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                {plan.cta}
              </button>

              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? "text-white/80" : "text-emerald-500"}`} />
                    <span className={plan.highlight ? "text-white/80" : "text-foreground"}>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 max-w-3xl mx-auto">
        <h2
          className="text-3xl font-normal mb-10 text-center"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Frequently asked questions
        </h2>
        {[
          {
            q: "What counts as a voice minute?",
            a: "A voice minute is one minute of active call time between your AI agent and a caller. Hold time and silence are not billed. Unused minutes do not roll over between billing periods.",
          },
          {
            q: "Can I try Clarity Voice before committing?",
            a: "Yes — every plan includes a 14-day free trial with 500 minutes included. No credit card is required to start. You can cancel or downgrade at any time, no questions asked.",
          },
          {
            q: "How does the Healthcare / HIPAA compliance work?",
            a: "Clarity Voice signs a Business Associate Agreement (BAA) with all Enterprise customers by default, and optionally for Growth plan customers in healthcare. All calls are encrypted in transit and at rest. PHI is never used for model training.",
          },
          {
            q: "Can I bring my own phone numbers?",
            a: "Yes. You can port existing numbers, provision new ones through our dashboard, or connect via SIP trunk. We support Twilio, Bandwidth, Vonage, and direct PSTN routing.",
          },
        ].map((faq, i) => (
          <FAQItem key={i} q={faq.q} a={faq.a} />
        ))}
      </section>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border py-5">
      <button
        className="flex items-center justify-between w-full text-left gap-4"
        onClick={() => setOpen(!open)}
      >
        <p className="font-medium text-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
          {q}
        </p>
        <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pt-3 text-muted-foreground text-sm leading-relaxed" style={{ fontFamily: "'Figtree', sans-serif" }}>
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
type DashSection = "overview"|"agents"|"batch"|"calls"|"numbers"|"knowledge"|"voices"|"analytics"|"settings";

// Shared tiny helpers
function DBadge({ children, v="neutral" }: { children: React.ReactNode; v?: "neutral"|"success"|"warning"|"error"|"info"|"dark" }) {
  const cls = { neutral:"bg-muted text-muted-foreground border border-border", success:"bg-emerald-50 text-emerald-700 border border-emerald-100", warning:"bg-amber-50 text-amber-700 border border-amber-100", error:"bg-red-50 text-red-600 border border-red-100", info:"bg-blue-50 text-blue-700 border border-blue-100", dark:"bg-foreground text-white" }[v];
  return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`} style={{fontFamily:"'Figtree',sans-serif"}}>{children}</span>;
}
function SDot({ status }: { status: string }) {
  const c = ["active","running","ready"].includes(status) ? "bg-emerald-500" : ["paused","indexing","pending"].includes(status) ? "bg-amber-500" : ["error","failed"].includes(status) ? "bg-red-500" : "bg-zinc-400";
  return <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${c} ${["active","running"].includes(status)?"animate-pulse":""}`}/>;
}
function MiniWave({ on=true, bars=14 }: { on?: boolean; bars?: number }) {
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({length:bars}).map((_,i)=>(
        <div key={i} className="bg-current rounded-full opacity-50" style={{width:"2px", height:`${4+Math.sin(i*0.8)*8+(i%3)*2}px`, animation:on?`wave ${0.7+(i%4)*0.2}s ease-in-out infinite alternate`:"none", animationDelay:`${i*0.05}s`}}/>
      ))}
    </div>
  );
}
function DProg({ v, max, className="" }: { v:number; max:number; className?:string }) {
  return <div className={`h-1.5 bg-muted rounded-full overflow-hidden ${className}`}><div className="h-full bg-foreground rounded-full transition-all" style={{width:`${Math.min(100,(v/max)*100)}%`}}/></div>;
}
function DToggle({ on, set }: { on:boolean; set:(v:boolean)=>void }) {
  return <button onClick={()=>set(!on)} className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${on?"bg-foreground":"bg-muted"}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${on?"left-4":"left-0.5"}`}/></button>;
}
function DInput({ className="", ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15 focus:border-foreground/30 transition-all ${className}`} style={{fontFamily:"'Figtree',sans-serif"}} {...p}/>;
}
function DSelect({ className="", children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15 transition-all ${className}`} style={{fontFamily:"'Figtree',sans-serif"}} {...p}>{children}</select>;
}
function DTextarea({ className="", ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15 transition-all resize-none ${className}`} style={{fontFamily:"'Figtree',sans-serif"}} {...p}/>;
}
function DBtn({ children, variant="primary", size="md", onClick, disabled, className="" }: { children:React.ReactNode; variant?:"primary"|"secondary"|"ghost"|"danger"; size?:"sm"|"md"; onClick?:()=>void; disabled?:boolean; className?:string }) {
  const s = size==="sm" ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2";
  const v = { primary:"bg-foreground text-white hover:bg-foreground/90", secondary:"border border-border text-foreground hover:bg-muted", ghost:"text-muted-foreground hover:text-foreground hover:bg-muted", danger:"bg-red-50 text-red-600 border border-red-100 hover:bg-red-100" }[variant];
  return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-all disabled:opacity-50 ${s} ${v} ${className}`} style={{fontFamily:"'Figtree',sans-serif"}}>{children}</button>;
}
function DField({ label, children, hint }: { label:string; children:React.ReactNode; hint?:string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block" style={{fontFamily:"'DM Mono',monospace"}}>{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{hint}</p>}
    </div>
  );
}
function DModal({ open, onClose, title, children, width="max-w-lg" }: { open:boolean; onClose:()=>void; title:string; children:React.ReactNode; width?:string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{opacity:0,scale:0.96,y:10}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.96}} transition={{duration:0.18}} className={`relative bg-white rounded-2xl border border-border shadow-xl w-full ${width} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <p className="font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{title}</p>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors"><X className="w-4 h-4 text-muted-foreground"/></button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

// ── seed data ──
const AGENTS_SEED = [
  {id:"a1",name:"Healthcare Scheduler",type:"conversational",status:"active",calls:2841,csat:4.9,lang:"EN, ES",voice:"Nova",model:"claude-sonnet-4-6",kb:["kb1","kb2"],numbers:["pn1"],created:"2025-03-01"},
  {id:"a2",name:"Finance Support Bot",type:"prompt",status:"active",calls:5124,csat:4.7,lang:"EN",voice:"Aria",model:"gpt-4o",kb:["kb3"],numbers:["pn2"],created:"2025-02-14"},
  {id:"a3",name:"Insurance Claims Rep",type:"prompt",status:"active",calls:1882,csat:4.8,lang:"EN, FR",voice:"James",model:"gpt-4o-mini",kb:["kb1"],numbers:["pn3"],created:"2025-04-07"},
  {id:"a4",name:"E-Commerce Support",type:"conversational",status:"paused",calls:913,csat:4.6,lang:"EN",voice:"Sophie",model:"gpt-4o",kb:[],numbers:[],created:"2025-05-12"},
  {id:"a5",name:"Sales Qualifier",type:"prompt",status:"draft",calls:0,csat:null,lang:"EN",voice:"Marcus",model:"claude-sonnet-4-6",kb:[],numbers:[],created:"2025-06-20"},
] as const;
type AgentRow = {
  id: string;
  name: string;
  type: "prompt" | "conversational";
  status: string;
  calls: number;
  csat: number | null;
  lang: string;
  voice: string;
  model: string;
  kb: string[];
  numbers: string[];
  created: string;
} & Record<string, unknown>;

const NUMBERS_SEED = [
  {id:"pn1",number:"+1 (312) 555-0198",label:"Healthcare Main",type:"local",agentId:"a1",region:"Chicago, IL",status:"active"},
  {id:"pn2",number:"+1 (800) 555-0842",label:"Finance Toll-Free",type:"tollfree",agentId:"a2",region:"National",status:"active"},
  {id:"pn3",number:"+1 (415) 555-1847",label:"Claims Line",type:"local",agentId:"a3",region:"San Francisco, CA",status:"active"},
  {id:"pn4",number:"sip:support@pbx.acmecorp.com",label:"SIP Trunk — Cisco",type:"sip",agentId:null,region:"On-premise",status:"active"},
  {id:"pn5",number:"+1 (929) 555-0044",label:"Unassigned",type:"local",agentId:null,region:"New York, NY",status:"active"},
];
const KB_SEED = [
  {id:"kb1",name:"Patient FAQ & Intake Forms.pdf",type:"pdf",size:"2.4 MB",status:"ready",chunks:284,uploaded:"2025-05-10",agents:["a1","a3"]},
  {id:"kb2",name:"Appointment Scheduling Policy.docx",type:"docx",size:"480 KB",status:"ready",chunks:97,uploaded:"2025-05-12",agents:["a1"]},
  {id:"kb3",name:"Product Pricing Sheet Q2.csv",type:"csv",size:"128 KB",status:"ready",chunks:44,uploaded:"2025-06-01",agents:["a2"]},
  {id:"kb4",name:"https://acmecorp.com/help-center",type:"url",size:"—",status:"indexing",chunks:0,uploaded:"2025-06-28",agents:[]},
  {id:"kb5",name:"Insurance Policy Handbook 2025.pdf",type:"pdf",size:"8.7 MB",status:"error",chunks:0,uploaded:"2025-06-15",agents:[]},
];
const VOICES_SEED = [
  {id:"Aoede",name:"Aoede",gender:"female",accent:"Clear/friendly female voice",provider:"builtin",lang:"EN"},
  {id:"Charon",name:"Charon",gender:"male",accent:"Warm/stable male voice",provider:"builtin",lang:"EN"},
  {id:"Fenrir",name:"Fenrir",gender:"male",accent:"Smooth/deep male voice",provider:"builtin",lang:"EN"},
  {id:"Kore",name:"Kore",gender:"female",accent:"Bright female voice",provider:"builtin",lang:"EN"},
  {id:"Puck",name:"Puck",gender:"male",accent:"Energetic male voice",provider:"builtin",lang:"EN"},
];
const CAMPAIGNS_SEED = [
  {id:"c1",name:"Insurance Renewal — June 2025",agentId:"a3",numberId:"pn3",status:"completed",total:4800,called:4800,connected:3912,converted:1240,created:"2025-05-28"},
  {id:"c2",name:"Appointment Reminder — Week 27",agentId:"a1",numberId:"pn1",status:"running",total:1200,called:847,connected:712,converted:598,created:"2025-06-30"},
  {id:"c3",name:"Q3 Loan Outreach",agentId:"a2",numberId:"pn2",status:"paused",total:2500,called:412,connected:344,converted:88,created:"2025-06-25"},
  {id:"c4",name:"Re-engagement — Inactive Accounts",agentId:"a2",numberId:"pn5",status:"draft",total:800,called:0,connected:0,converted:0,created:"2025-07-04"},
];

// ── Overview ──
function DashOverview() {
  const [apiAgents, setApiAgents] = useState<ApiAgent[]>([]);
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);

  useEffect(() => {
    fetchAgents().then(setApiAgents).catch(() => {});
    fetchCalls({ limit: 100 }).then(setApiCalls).catch(() => {});
  }, []);

  const activeAgentCount = apiAgents.length > 0
    ? apiAgents.filter(a => a.status === 'active').length
    : AGENTS_SEED.filter(a => a.status === 'active').length;
  const totalCallCount = apiCalls.length > 0
    ? apiCalls.length
    : AGENTS_SEED.reduce((s, a) => s + a.calls, 0);
  const activeAgentsForOverview = apiAgents.length > 0 ? apiAgents : (AGENTS_SEED as unknown as ApiAgent[]);
  const recentCallsForOverview = apiCalls.length > 0 ? apiCalls : null;
  void activeAgentCount; void totalCallCount; void activeAgentsForOverview; void recentCallsForOverview;

  const activeCalls = apiCalls.filter(c => c.status === 'active');
  const liveCalls = activeCalls.length > 0
    ? activeCalls.map(c => ({
        name: c.phoneNumber ?? 'Unknown caller',
        number: c.phoneNumber ?? '—',
        intent: 'Voice Call',
        dur: c.duration != null ? `${Math.floor(c.duration/60)}:${String(c.duration%60).padStart(2, '0')}` : '0:00',
        sent: 'Neutral',
        agent: c.agent?.name ?? '—',
      }))
    : [
        {name:"Marcus Johnson",number:"+1 (312) 555-0198",intent:"Billing inquiry",dur:"2:14",sent:"Neutral",agent:"Finance Support Bot"},
        {name:"Elena Vasquez",number:"+1 (213) 555-0847",intent:"Appointment booking",dur:"0:47",sent:"Positive",agent:"Healthcare Scheduler"},
        {name:"David Kim",number:"+1 (415) 555-1234",intent:"Technical support",dur:"5:02",sent:"Neutral",agent:"E-Commerce Support"},
        {name:"Aisha Okafor",number:"+1 (404) 555-9876",intent:"Policy renewal",dur:"1:33",sent:"Positive",agent:"Insurance Claims Rep"},
        {name:"Thomas Reed",number:"+1 (617) 555-2847",intent:"Refund request",dur:"3:21",sent:"Negative",agent:"Finance Support Bot"},
      ];
  const recent = [
    {name:"Sophia Hernandez",intent:"Claim status",dur:"6m 55s",result:"Resolved",ago:"2 min ago"},
    {name:"James Liu",intent:"Password reset",dur:"1m 44s",result:"Resolved",ago:"7 min ago"},
    {name:"Amara Diallo",intent:"Loan inquiry",dur:"8m 03s",result:"Transferred",ago:"11 min ago"},
    {name:"Peter Novak",intent:"Cancellation",dur:"3m 27s",result:"Retained",ago:"18 min ago"},
    {name:"Fatima Al-Rashid",intent:"Policy upgrade",dur:"4m 12s",result:"Converted",ago:"24 min ago"},
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {label:"Calls today",value:"1,284",delta:"+12% vs yesterday",icon:PhoneCall,live:false},
          {label:"Active now",value:"47",delta:"live calls",icon:CircleDot,live:true},
          {label:"Avg duration",value:"3m 42s",delta:"−8s vs yesterday",icon:Clock,live:false},
          {label:"CSAT",value:"4.8 / 5",delta:"+0.1 this week",icon:Star,live:false},
        ].map(s=>{
          const Icon=s.icon;
          return (
            <div key={s.label} className="bg-white border border-border rounded-xl p-4">
              <div className="flex justify-between items-center mb-3"><span className="text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{s.label.toUpperCase()}</span><Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5}/></div>
              <p className="text-2xl font-bold text-foreground mb-1" style={{fontFamily:"'Instrument Serif',serif"}}>{s.value}</p>
              <p className={`text-xs flex items-center gap-1 ${s.live?"text-emerald-600":"text-muted-foreground"}`} style={{fontFamily:"'Figtree',sans-serif"}}>{s.live&&<span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/>}{s.delta}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {AGENTS_SEED.map(a=>(
          <div key={a.id} className="bg-white border border-border rounded-xl px-3 py-2.5 flex items-center gap-2">
            <SDot status={a.status}/><div className="min-w-0"><p className="text-xs font-medium text-foreground truncate" style={{fontFamily:"'Figtree',sans-serif"}}>{a.name}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{a.calls.toLocaleString()} calls</p></div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <SDot status="active"/><p className="text-sm font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Live calls</p><DBadge>47</DBadge>
        </div>
        <div className="divide-y divide-border">
          {liveCalls.map(c=>(
            <div key={c.name} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
              <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center flex-shrink-0"><span className="text-xs font-bold text-muted-foreground">{c.name[0]}</span></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate" style={{fontFamily:"'Figtree',sans-serif"}}>{c.name}</p><p className="text-xs text-muted-foreground truncate" style={{fontFamily:"'Figtree',sans-serif"}}>{c.agent}</p></div>
              <span className="hidden md:block text-xs border border-border rounded px-2 py-0.5" style={{fontFamily:"'Figtree',sans-serif"}}>{c.intent}</span>
              <span className={`hidden lg:block text-xs font-medium ${c.sent==="Positive"?"text-emerald-600":c.sent==="Negative"?"text-red-500":"text-muted-foreground"}`} style={{fontFamily:"'Figtree',sans-serif"}}>{c.sent}</span>
              <span className="text-xs flex-shrink-0 text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{c.dur}</span>
              <div className="w-10 hidden sm:flex text-muted-foreground"><MiniWave bars={8}/></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><p className="text-sm font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Recent completed</p></div>
          <div className="divide-y divide-border">
            {recent.map(c=>(
              <div key={c.name} className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{c.name}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{c.intent} · {c.dur}</p></div>
                <DBadge v={c.result==="Resolved"||c.result==="Converted"?"success":c.result==="Transferred"?"warning":"info"}>{c.result}</DBadge>
                <span className="text-xs text-muted-foreground hidden sm:block" style={{fontFamily:"'DM Mono',monospace"}}>{c.ago}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><p className="text-sm font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Active batch campaigns</p></div>
          <div className="p-4 space-y-4">
            {CAMPAIGNS_SEED.filter(c=>c.status==="running"||c.status==="paused").map(c=>(
              <div key={c.id}>
                <div className="flex items-center justify-between mb-1.5"><p className="text-sm font-medium text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{c.name}</p><DBadge v={c.status==="running"?"success":"warning"}>{c.status}</DBadge></div>
                <DProg v={c.called} max={c.total} className="mb-1"/>
                <p className="text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{c.called.toLocaleString()} / {c.total.toLocaleString()} called · {c.connected.toLocaleString()} connected</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Web Audio Sandbox Conversion Helpers ──
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

// ── Agents ──
type AgentView = "list"|"create"|"detail";
function DashAgents() {
  const [agents, setAgents] = useState<AgentRow[]>([...AGENTS_SEED] as AgentRow[]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  const loadAgents = useCallback(() => {
    setAgentsLoading(true);
    setAgentsError(null);
    fetchAgents()
      .then((data) => {
        if (data.length > 0) {
          setAgents(data.map(a => ({
            id: a.id,
            name: a.name,
            type: (a.agentType === 'prompt' ? 'prompt' : 'conversational') as 'prompt' | 'conversational',
            status: (a.status as 'active' | 'paused' | 'draft') ?? 'draft',
            calls: 0,
            csat: null,
            lang: 'EN',
            voice: a.voiceName ?? 'Nova',
            model: a.model ?? 'gemini-2.5-flash',
            kb: [],
            numbers: [],
            isRecordingEnabled: a.isRecordingEnabled ?? false,
            isTranscriptionEnabled: a.isTranscriptionEnabled ?? false,
            created: a.createdAt?.slice(0, 10) ?? '',
          } as unknown as AgentRow)));
        }
      })
      .catch((err) => setAgentsError(err.message ?? 'Failed to load agents'))
      .finally(() => setAgentsLoading(false));
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);
  const [view, setView] = useState<AgentView>("list");
  const [selected, setSelected] = useState<AgentRow|null>(null);
  const [filter, setFilter] = useState<"all"|"prompt"|"conversational">("all");
  const [createType, setCreateType] = useState<"prompt"|"conversational">("prompt");
  const [detailTab, setDetailTab] = useState<"config"|"prompt"|"knowledge"|"calls">("config");
  const [form, setForm] = useState({name:"",lang:"EN",voice:"Aoede",model:"claude-sonnet-4-6",systemPrompt:"",welcomeMsg:"",endPhrase:"goodbye",temperature:"0.7",maxTurns:"20",kb:[] as string[],steps:[{id:"s1",label:"Greet caller",cond:""},{id:"s2",label:"Verify identity",cond:"if account found"},{id:"s3",label:"Handle intent",cond:""}]});
  const [testCallStatus, setTestCallStatus] = useState<'idle'|'calling'|'done'|'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'done'|'error'>('idle');

  const [showPicker, setShowPicker] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [numbersList, setNumbersList] = useState<any[]>([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [destinationPhone, setDestinationPhone] = useState('');
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxActive, setSandboxActive] = useState(false);
  const [sandboxTranscript, setSandboxTranscript] = useState<{ speaker: 'agent' | 'user'; text: string }[]>([]);
  const [sandboxLatency, setSandboxLatency] = useState<number | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastEmitTimeRef = useRef<number>(0);
  const nextPlaybackTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      // Disconnect and clean up resources on unmount (DISCONNECT LIFECYCLE MANAGEMENT)
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (processorNodeRef.current) {
        processorNodeRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (playbackContextRef.current) {
        playbackContextRef.current.close().catch(() => {});
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  async function fetchWorkspaceNumbers() {
    try {
      const token = session?.access_token;
      const res = await fetch("https://ai-voice-agent-backend-mv32.onrender.com/api/v2/numbers", {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : { "x-user-id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }),
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNumbersList(data.data);
        if (data.data.length > 0) {
          setSelectedNumber(data.data[0].phoneNumber);
        }
      } else {
        setNumbersList([]);
      }
    } catch (err: any) {
      setPickerError(err.message || 'Failed to retrieve workspace numbers.');
    }
  }

  async function startSandbox() {
    if (!selected) return;
    setSandboxTranscript([{ speaker: 'agent', text: 'Initializing browser sandbox audio pipeline...' }]);
    setSandboxOpen(true);
    setSandboxActive(true);
    setSandboxLatency(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      const playbackContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      playbackContextRef.current = playbackContext;
      nextPlaybackTimeRef.current = 0;

      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host === 'localhost:5173' || window.location.host === 'localhost:3000'
        ? 'localhost:3001'
        : 'ai-voice-agent-backend-mv32.onrender.com';
      const token = session?.access_token;
      const tokenParam = token ? `&token=${token}` : '';
      const wsUrl = `${wsProtocol}//${host}/api/v2/sandbox/test-stream?agentId=${selected.id}${tokenParam}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setSandboxTranscript(prev => [...prev, { speaker: 'agent', text: 'Connected to Gemini Live. Speak into your microphone.' }]);
        
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(2048, 1, 1);
        processorNodeRef.current = processor;

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          let isSpeaking = false;
          for (let i = 0; i < inputData.length; i++) {
            if (Math.abs(inputData[i]) > 0.01) {
              isSpeaking = true;
              break;
            }
          }
          if (isSpeaking) {
            lastEmitTimeRef.current = Date.now();
          }

          const pcmBuffer = floatTo16BitPCM(inputData);
          const base64 = arrayBufferToBase64(pcmBuffer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'audio', data: base64 }));
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'audio' && msg.data) {
            const floats = base64ToFloat32(msg.data);
            const audioBuffer = playbackContext.createBuffer(1, floats.length, 24000);
            audioBuffer.copyToChannel(floats, 0);

            const sourceNode = playbackContext.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(playbackContext.destination);

            const currentTime = playbackContext.currentTime;
            const startTime = Math.max(currentTime, nextPlaybackTimeRef.current);
            sourceNode.start(startTime);
            nextPlaybackTimeRef.current = startTime + audioBuffer.duration;
          } else if (msg.event === 'transcript' && msg.text) {
            if (lastEmitTimeRef.current > 0) {
              const delta = Date.now() - lastEmitTimeRef.current;
              setSandboxLatency(delta);
            }

            setSandboxTranscript(prev => {
              const last = prev[prev.length - 1];
              const speaker = msg.isUser ? 'user' : 'agent';
              if (last && last.speaker === speaker) {
                return [...prev.slice(0, -1), { speaker, text: last.text + msg.text }];
              } else {
                return [...prev, { speaker, text: msg.text }];
              }
            });
          } else if (msg.event === 'interrupted') {
            nextPlaybackTimeRef.current = 0;
            setSandboxTranscript(prev => [...prev, { speaker: 'agent', text: '*Interrupted*' }]);
          } else if (msg.event === 'error') {
            setSandboxTranscript(prev => [...prev, { speaker: 'agent', text: `[Error]: ${msg.message}` }]);
          }
        } catch (e: any) {
          console.error('Failed to parse sandbox event message', e);
        }
      };

      ws.onerror = (e) => {
        setSandboxTranscript(prev => [...prev, { speaker: 'agent', text: 'WebSocket error occurred during sandbox session.' }]);
        setSandboxActive(false);
      };

      ws.onclose = () => {
        setSandboxTranscript(prev => [...prev, { speaker: 'agent', text: 'Sandbox connection closed.' }]);
        setSandboxActive(false);
      };

    } catch (err: any) {
      setSandboxTranscript(prev => [...prev, { speaker: 'agent', text: `Initialization failed: ${err.message}` }]);
      setSandboxActive(false);
    }
  }

  function stopSandbox() {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    setSandboxActive(false);
    setSandboxOpen(false);
    setSandboxLatency(null);
  }

  function handleTestCall() {
    setShowPicker(true);
    fetchWorkspaceNumbers();
  }

  function handleLaunchLiveCall() {
    if (!selected || !destinationPhone) return;
    setTestCallStatus('calling');
    const token = session?.access_token;
    fetch("https://ai-voice-agent-backend-mv32.onrender.com/api/v2/calls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : { "x-user-id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }),
      },
      body: JSON.stringify({
        phoneNumber: destinationPhone,
        agentId: selected.id,
        userId: token ? undefined : "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        fromPhoneNumber: selectedNumber || undefined,
      }),
    })
    .then(async (res) => {
      if (res.status === 200 || res.status === 201) {
        setTestCallStatus('done');
      } else {
        setTestCallStatus('error');
      }
    })
    .catch(() => setTestCallStatus('error'))
    .finally(() => {
      setTimeout(() => setTestCallStatus('idle'), 3000);
      setShowPicker(false);
    });
  }

  function handleSaveAgent() {
    if (!selected) return;
    setSaveStatus('saving');
    updateAgent(selected.id as string, {
      name: selected.name as string,
      model: selected.model as string,
      voiceName: selected.voice as string,
      status: selected.status as string,
      isRecordingEnabled: !!selected.isRecordingEnabled,
      isTranscriptionEnabled: !!selected.isTranscriptionEnabled,
    }).then(() => { setSaveStatus('done'); loadAgents(); }).catch(() => setSaveStatus('error')).finally(() => setTimeout(() => setSaveStatus('idle'), 2000));
  }

  function handleDelete(agentId: string) {
    if (window.confirm("Are you sure you want to delete this agent? It will be deleted forever.")) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
      if (!isUuid) {
        setAgents(prev => prev.filter(x => x.id !== agentId));
        return;
      }

      fetch(`https://ai-voice-agent-backend-mv32.onrender.com/api/v2/agents/${agentId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": DEV_USER_ID,
        }
      })
      .then(async (res) => {
        if (res.status === 200 || res.status === 204) {
          setAgents(prev => prev.filter(x => x.id !== agentId));
        } else {
          const body = await res.json().catch(() => ({}));
          alert(`Failed to delete agent: ${body.error || res.statusText}`);
        }
      })
      .catch((err) => {
        alert(`Failed to delete agent: ${err.message}`);
      });
    }
  }

  function handleCreate() {
    const localAgent: AgentRow = {id:`a${Date.now()}`,name:form.name||"Untitled Agent",type:createType,status:"draft",calls:0,csat:null,lang:form.lang,voice:VOICES_SEED.find(v=>v.id===form.voice)?.name??"Nova",model:form.model,kb:form.kb,numbers:[],created:new Date().toISOString().slice(0,10)};
    // Optimistically update UI, then persist to API
    setAgents(p=>[...p, localAgent]);
    setView("list");
    createAgent({
      name: form.name || 'Untitled Agent',
      agentType: createType,
      status: 'draft',
      model: form.model,
      temperature: parseFloat(form.temperature),
      systemPrompt: form.systemPrompt || undefined,
    }).then(() => loadAgents()).catch(() => {/* keep optimistic update on fail */});
  }

  const filtered = filter==="all" ? agents : agents.filter(a=>a.type===filter);

  if (view==="detail" && selected) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DBtn variant="ghost" size="sm" onClick={()=>{setView("list");setSelected(null);}}><ChevronLeft className="w-4 h-4"/> Back</DBtn>
          <div><p className="text-sm font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{selected.name as string}</p><div className="flex items-center gap-2 mt-0.5"><SDot status={selected.status as string}/><DBadge>{selected.type==="prompt"?"Prompt-based":"Conversational"}</DBadge></div></div>
        </div>
        <div className="flex gap-2">
          <DBtn variant="secondary" size="sm" onClick={handleTestCall} disabled={testCallStatus==='calling'}><PlayCircle className="w-3.5 h-3.5"/> {testCallStatus==='calling'?'Calling…':testCallStatus==='done'?'Called!':testCallStatus==='error'?'Failed':'Test call'}</DBtn>
          <DBtn size="sm" onClick={handleSaveAgent} disabled={saveStatus==='saving'}><Check className="w-3.5 h-3.5"/> {saveStatus==='saving'?'Saving…':saveStatus==='done'?'Saved!':saveStatus==='error'?'Error':'Save'}</DBtn>
        </div>
      </div>
      <div className="flex gap-1 border-b border-border">
        {(["config","prompt","knowledge","calls"] as const).map(t=>(
          <button key={t} onClick={()=>setDetailTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${detailTab===t?"border-foreground text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`} style={{fontFamily:"'Figtree',sans-serif"}}>{t==="prompt"?(selected.type==="prompt"?"System Prompt":"Conv. Flow"):t==="knowledge"?"Knowledge Base":t==="calls"?"Recent Calls":"Configuration"}</button>
        ))}
      </div>
      {detailTab==="config" && (
        <AgentConfigPanel 
          agent={selected} 
          onUpdate={(fields) => setSelected(prev => prev ? { ...prev, ...fields } : null)} 
          onSaveStatus={setSaveStatus}
        />
      )}
      {detailTab==="prompt" && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-3">
          <DTextarea rows={16} defaultValue={selected.type==="prompt"?`You are a professional AI voice agent for Acme Corp specialising in ${(selected.name as string).toLowerCase()}.\n\nPersona:\n- Warm, clear, professional\n- Never rush the caller\n- Acknowledge concerns before responding\n\nRules:\n- Verify identity before accessing account data\n- Escalate to a human agent if the caller is distressed\n- Keep responses concise (2–3 sentences max)\n\nEscalation triggers:\n"frustrated", "manager", "cancel", "lawsuit" → offer immediate transfer`:"Step 1: Greet → Step 2: Verify → Step 3: Handle intent → Step 4: Confirm & close"}/>
          <p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Changes take effect on the next call.</p>
          <DBtn size="sm"><Check className="w-3.5 h-3.5"/> Save prompt</DBtn>
        </div>
      )}
      {detailTab==="knowledge" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full"><thead><tr className="border-b border-border bg-muted/30">{["Document","Type","Chunks","Status","Attached"].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{KB_SEED.map(k=><tr key={k.id} className="hover:bg-muted/20"><td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate" style={{fontFamily:"'Figtree',sans-serif"}}>{k.name}</td><td className="px-4 py-3"><DBadge>{k.type.toUpperCase()}</DBadge></td><td className="px-4 py-3 text-xs" style={{fontFamily:"'DM Mono',monospace"}}>{k.chunks||"—"}</td><td className="px-4 py-3"><DBadge v={k.status==="ready"?"success":k.status==="indexing"?"warning":"error"}><SDot status={k.status}/> {k.status}</DBadge></td><td className="px-4 py-3"><DToggle on={(selected.kb as string[]).includes(k.id)} set={()=>{}}/></td></tr>)}</tbody></table>
        </div>
      )}
      {detailTab==="calls" && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full"><thead><tr className="border-b border-border bg-muted/30">{["Caller","Duration","Result","Sentiment","Date",""].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {[{name:"Marcus Johnson",dur:"4m 12s",result:"Resolved",sent:"Positive",date:"Today 2:14 PM"},{name:"Elena Vasquez",dur:"2m 38s",result:"Scheduled",sent:"Positive",date:"Today 1:58 PM"},{name:"David Kim",dur:"7m 55s",result:"Transferred",sent:"Neutral",date:"Today 1:41 PM"},{name:"Aisha Okafor",dur:"3m 20s",result:"Resolved",sent:"Positive",date:"Today 1:22 PM"}].map(c=>(
              <tr key={c.name} className="hover:bg-muted/20">
                <td className="px-4 py-3 text-sm font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>{c.name}</td>
                <td className="px-4 py-3 text-xs" style={{fontFamily:"'DM Mono',monospace"}}>{c.dur}</td>
                <td className="px-4 py-3"><DBadge v={c.result==="Resolved"||c.result==="Scheduled"?"success":"warning"}>{c.result}</DBadge></td>
                <td className="px-4 py-3 text-xs" style={{fontFamily:"'Figtree',sans-serif"}}>{c.sent}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{c.date}</td>
                <td className="px-4 py-3"><DBtn size="sm" variant="ghost"><Eye className="w-3.5 h-3.5"/> Transcript</DBtn></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
      {/* ── Caller ID & Dialer Picker Modal ── */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2" style={{fontFamily:"'Figtree',sans-serif"}}>
                <PhoneCall className="w-5 h-5 text-muted-foreground"/> Test Voice Agent
              </h3>
              <button onClick={() => setShowPicker(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {pickerError ? (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"/>
                <p>{pickerError}</p>
              </div>
            ) : null}

            {/* Selection buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPicker(false);
                  startSandbox();
                }}
                className="border border-border rounded-xl p-4 text-center hover:border-foreground/30 hover:bg-muted/10 transition-all flex flex-col items-center gap-2"
              >
                <Headphones className="w-8 h-8 text-muted-foreground"/>
                <div>
                  <p className="text-xs font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>Desktop Browser</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Test instantly in-browser</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  // Allow clicking only if numbers list contains entries
                  if (numbersList.length > 0) {
                    // Handled conditionally below
                  }
                }}
                className={`border rounded-xl p-4 text-center transition-all flex flex-col items-center gap-2 ${
                  numbersList.length === 0 ? "opacity-50 cursor-not-allowed border-dashed border-border" : "border-border hover:border-foreground/30 hover:bg-muted/10"
                }`}
                disabled={numbersList.length === 0}
              >
                <Phone className="w-8 h-8 text-muted-foreground"/>
                <div>
                  <p className="text-xs font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>Live Phone Call</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Test on a mobile device</p>
                </div>
              </button>
            </div>

            {/* Live call dialer options */}
            {numbersList.length === 0 ? (
              <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"/>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>No Active Numbers Found</p>
                    <p className="text-amber-700/90 leading-relaxed">No active phone numbers found in this workspace. Please provision a business number under the 'Phone Numbers' tab or use Desktop Testing mode.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <DField label="Caller ID (Outgoing Number)">
                  <DSelect value={selectedNumber} onChange={(e) => setSelectedNumber(e.target.value)}>
                    {numbersList.map((num) => (
                      <option key={num.id} value={num.phoneNumber}>
                        {num.phoneNumber} {num.agent ? `(${num.agent.name})` : ''}
                      </option>
                    ))}
                  </DSelect>
                </DField>

                <DField label="Destination Phone Number">
                  <DInput
                    placeholder="e.g. +1234567890"
                    value={destinationPhone}
                    onChange={(e) => setDestinationPhone(e.target.value)}
                  />
                </DField>

                <DBtn
                  onClick={handleLaunchLiveCall}
                  className="w-full"
                  disabled={!destinationPhone || testCallStatus === 'calling'}
                >
                  {testCallStatus === 'calling' ? 'Launching...' : 'Launch Call'}
                </DBtn>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Persistent Right-Hand Audio Sandbox Drawer ── */}
      {sandboxOpen && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-40 flex justify-end">
          {/* Back click overlay to stop sandbox */}
          <div className="absolute inset-0" onClick={stopSandbox} />
          
          <div className="relative w-full max-w-md bg-white border-l border-border h-full shadow-2xl flex flex-col z-50">
            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                    <Headphones className="w-4 h-4 text-foreground"/>
                  </div>
                  {sandboxActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-ping"/>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Desktop Testing Sandbox</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${sandboxActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`}/>
                    <span className="text-[10px] text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>
                      {sandboxActive ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {sandboxLatency !== null && (
                  <div className="flex items-center gap-1 bg-foreground/[0.03] px-2 py-1 rounded-md text-[10px] text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>
                    <Activity className="w-3 h-3 text-muted-foreground"/> {sandboxLatency}ms latency
                  </div>
                )}
                <button onClick={stopSandbox} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/80 transition-colors">
                  <X className="w-5 h-5"/>
                </button>
              </div>
            </div>

            {/* Transcript scroll pane */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5">
              {sandboxTranscript.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                    msg.speaker === 'user'
                      ? 'bg-foreground text-white rounded-tr-none'
                      : 'bg-white border border-border text-foreground rounded-tl-none'
                  }`} style={{fontFamily:"'Figtree',sans-serif", lineHeight: 1.4}}>
                    <p className="font-semibold text-[9px] uppercase tracking-wider mb-1 opacity-70">
                      {msg.speaker === 'user' ? 'You' : 'Agent'}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Live telemetry VAD visualizer & controls footer */}
            <div className="p-4 border-t border-border bg-white space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold" style={{fontFamily:"'DM Mono',monospace"}}>Microphone Pipeline</span>
                <SoundWave active={sandboxActive} bars={16} className="h-4"/>
              </div>

              <div className="flex gap-2">
                {sandboxActive ? (
                  <button
                    onClick={stopSandbox}
                    className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                    style={{fontFamily:"'Figtree',sans-serif"}}
                  >
                    <StopCircle className="w-4 h-4"/> Stop Session
                  </button>
                ) : (
                  <button
                    onClick={startSandbox}
                    className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-foreground text-white hover:bg-foreground/90 transition-colors flex items-center justify-center gap-1.5"
                    style={{fontFamily:"'Figtree',sans-serif"}}
                  >
                    <Mic className="w-4 h-4"/> Restart Session
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (view==="create") return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <DBtn variant="ghost" size="sm" onClick={()=>setView("list")}><ChevronLeft className="w-4 h-4"/> Back</DBtn>
        <p className="text-sm font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Create new agent</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["prompt","conversational"] as const).map(t=>(
          <button key={t} onClick={()=>setCreateType(t)} className={`border-2 rounded-xl p-5 text-left transition-all ${createType===t?"border-foreground":"border-border hover:border-foreground/30"}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${createType===t?"bg-foreground":"bg-muted"}`}>{t==="prompt"?<Cpu className={`w-4 h-4 ${createType===t?"text-white":"text-muted-foreground"}`}/>:<MessageSquare className={`w-4 h-4 ${createType===t?"text-white":"text-muted-foreground"}`}/>}</div>
              <p className="font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{t==="prompt"?"Prompt-based":"Conversational Flow"}</p>
            </div>
            <p className="text-sm text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{t==="prompt"?"Define behavior with a system prompt. Best for flexible open-ended conversations.":"Design a step-by-step flow with conditions. Best for structured, scripted calls."}</p>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>Basic configuration</p>
            <DField label="Agent name"><DInput placeholder="e.g. Healthcare Scheduler" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></DField>
            <DField label="Language"><DSelect value={form.lang} onChange={e=>setForm(f=>({...f,lang:e.target.value}))}><option>EN</option><option>EN, ES</option><option>EN, FR</option><option>EN, DE</option><option>ZH</option><option>HI</option><option>JA</option></DSelect></DField>
            <DField label="Voice"><DSelect value={form.voice} onChange={e=>setForm(f=>({...f,voice:e.target.value}))}>{VOICES_SEED.map(v=><option key={v.id} value={v.id}>{v.name} ({v.accent}){v.provider==="clone"?" ★":""}</option>)}</DSelect></DField>
            <DField label="LLM Model"><DSelect value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}><option value="claude-sonnet-4-6">Claude Sonnet 4.6</option><option value="claude-opus-4-8">Claude Opus 4.8</option><option value="gpt-4o">GPT-4o</option><option value="gpt-4o-mini">GPT-4o mini</option><option value="gemini-1.5-pro">Gemini 1.5 Pro</option></DSelect></DField>
            <DField label="Welcome message"><DInput placeholder="Hi! Thanks for calling. How can I help?" value={form.welcomeMsg} onChange={e=>setForm(f=>({...f,welcomeMsg:e.target.value}))}/></DField>
            <DField label="End-call phrase" hint="Caller saying this gracefully ends the call."><DInput value={form.endPhrase} onChange={e=>setForm(f=>({...f,endPhrase:e.target.value}))}/></DField>
          </div>
          <div className="bg-white border border-border rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>LLM parameters</p>
            <DField label={`Temperature: ${form.temperature}`}><input type="range" min="0" max="1" step="0.1" value={form.temperature} onChange={e=>setForm(f=>({...f,temperature:e.target.value}))} className="w-full accent-foreground"/></DField>
            <DField label={`Max turns: ${form.maxTurns}`}><input type="range" min="5" max="50" value={form.maxTurns} onChange={e=>setForm(f=>({...f,maxTurns:e.target.value}))} className="w-full accent-foreground"/></DField>
          </div>
        </div>
        <div className="space-y-4">
          {createType==="prompt" ? (
            <div className="bg-white border border-border rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>System prompt</p>
              <DTextarea rows={14} placeholder={`You are a professional AI voice agent for Acme Corp.\n\nPersona:\n- Warm, clear, professional\n- Never rush the caller\n\nRules:\n- Verify identity before accessing account data\n- Escalate if caller is distressed\n- Keep responses concise\n\nEscalation triggers:\n"frustrated", "manager", "cancel" → offer transfer`} value={form.systemPrompt} onChange={e=>setForm(f=>({...f,systemPrompt:e.target.value}))}/>
              <p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{form.systemPrompt.length} chars</p>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>Conversation flow</p>
                <DBtn size="sm" variant="secondary" onClick={()=>setForm(f=>({...f,steps:[...f.steps,{id:`s${Date.now()}`,label:"New step",cond:""}]}))}><Plus className="w-3.5 h-3.5"/> Add step</DBtn>
              </div>
              <div className="space-y-2">
                {form.steps.map((step,i)=>(
                  <div key={step.id} className="flex items-start gap-2">
                    <div className="flex flex-col items-center gap-0.5 mt-2 flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-foreground text-white flex items-center justify-center"><span className="text-xs" style={{fontFamily:"'DM Mono',monospace"}}>{i+1}</span></div>
                      {i<form.steps.length-1&&<div className="w-px h-4 bg-border"/>}
                    </div>
                    <div className="flex-1 space-y-1">
                      <DInput placeholder="Step description" value={step.label} onChange={e=>setForm(f=>({...f,steps:f.steps.map(s=>s.id===step.id?{...s,label:e.target.value}:s)}))}/>
                      <DInput placeholder="Condition (optional)" value={step.cond} onChange={e=>setForm(f=>({...f,steps:f.steps.map(s=>s.id===step.id?{...s,cond:e.target.value}:s)}))} className="text-xs"/>
                    </div>
                    <button onClick={()=>setForm(f=>({...f,steps:f.steps.filter(s=>s.id!==step.id)}))} className="p-1 text-muted-foreground hover:text-red-500 mt-1"><X className="w-3.5 h-3.5"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white border border-border rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>Attach knowledge base</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">{KB_SEED.filter(k=>k.status==="ready").map(k=>(
              <label key={k.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.kb.includes(k.id)} onChange={e=>setForm(f=>({...f,kb:e.target.checked?[...f.kb,k.id]:f.kb.filter(id=>id!==k.id)}))} className="accent-foreground"/>
                <span className="text-sm" style={{fontFamily:"'Figtree',sans-serif"}}>{k.name}</span><DBadge>{k.chunks} chunks</DBadge>
              </label>
            ))}</div>
          </div>
        </div>
      </div>
      <div className="flex gap-3"><DBtn onClick={handleCreate}><Check className="w-4 h-4"/> Create agent</DBtn><DBtn variant="secondary" onClick={()=>setView("list")}>Cancel</DBtn></div>
    </div>
  );

  return (
    <div className="space-y-4">
      {agentsLoading && <div className="text-xs text-muted-foreground py-2" style={{fontFamily:"'Figtree',sans-serif"}}>Loading agents…</div>}
      {agentsError && <div className="text-xs text-red-500 py-2" style={{fontFamily:"'Figtree',sans-serif"}}>⚠ {agentsError} — showing demo data</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["all","prompt","conversational"] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${filter===f?"bg-foreground text-white":"border border-border text-muted-foreground hover:text-foreground"}`} style={{fontFamily:"'Figtree',sans-serif"}}>{f==="all"?"All agents":f==="prompt"?"Prompt-based":"Conversational"}</button>
          ))}
        </div>
        <DBtn onClick={()=>setView("create")}><Plus className="w-4 h-4"/> New agent</DBtn>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">{["Agent","Type","Status","Calls","CSAT","Voice","Model",""].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {filtered.map(a=>(
              <tr key={a.id as string} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">{a.type==="prompt"?<Cpu className="w-4 h-4 text-muted-foreground"/>:<MessageSquare className="w-4 h-4 text-muted-foreground"/>}</div><div><p className="text-sm font-medium text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{a.name as string}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{a.lang as string}</p></div></div></td>
                <td className="px-4 py-3"><DBadge>{a.type==="prompt"?"Prompt":"Conversational"}</DBadge></td>
                <td className="px-4 py-3"><div className="flex items-center gap-1.5"><SDot status={a.status as string}/><span className="text-xs capitalize" style={{fontFamily:"'Figtree',sans-serif"}}>{a.status as string}</span></div></td>
                <td className="px-4 py-3 text-sm" style={{fontFamily:"'DM Mono',monospace"}}>{(a.calls as number).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm" style={{fontFamily:"'DM Mono',monospace"}}>{a.csat??"—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{a.voice as string}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{a.model as string}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DBtn size="sm" variant="ghost" onClick={()=>{setSelected(a);setView("detail");setDetailTab("config");}}><Edit3 className="w-3.5 h-3.5"/> Configure</DBtn>
                    <DBtn size="sm" variant="danger" onClick={()=>handleDelete(a.id as string)}><Trash2 className="w-3.5 h-3.5"/> Delete</DBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Batch Calls ──
function DashBatch() {
  const [campaigns, setCampaigns] = useState([...CAMPAIGNS_SEED]);
  const [liveAgents, setLiveAgents] = useState<ApiAgent[]>([]);
  useEffect(() => { fetchAgents().then(setLiveAgents).catch(() => {}); }, []);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<typeof CAMPAIGNS_SEED[number]|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({name:"",agentId:"a1",numberId:"pn1",scheduleNow:true,scheduledAt:"",csvRows:0});

  function handleCreate() {
    setCampaigns(p=>[{id:`c${Date.now()}`,name:form.name||"Untitled Campaign",agentId:form.agentId,numberId:form.numberId,status:form.scheduleNow?"running":"draft",total:form.csvRows||500,called:form.scheduleNow?12:0,connected:form.scheduleNow?9:0,converted:form.scheduleNow?3:0,created:new Date().toISOString().slice(0,10)},...p]);
    setShowCreate(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{campaigns.length} campaigns</p>
        <DBtn onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4"/> New campaign</DBtn>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[{label:"Total contacts",value:campaigns.reduce((s,c)=>s+c.total,0).toLocaleString(),icon:Users},{label:"Connected",value:campaigns.reduce((s,c)=>s+c.connected,0).toLocaleString(),icon:CheckCircle2},{label:"Converted",value:campaigns.reduce((s,c)=>s+c.converted,0).toLocaleString(),icon:TrendingUp},{label:"Running now",value:campaigns.filter(c=>c.status==="running").length,icon:Activity}].map(s=>{
          const Icon=s.icon;
          return (<div key={s.label} className="bg-white border border-border rounded-xl p-4"><div className="flex justify-between mb-2"><span className="text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{s.label.toUpperCase()}</span><Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5}/></div><p className="text-2xl font-bold text-foreground" style={{fontFamily:"'Instrument Serif',serif"}}>{s.value}</p></div>);
        })}
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">{["Campaign","Status","Progress","Connected","Converted","Created",""].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {campaigns.map(c=>{
              const pct=c.total>0?Math.round((c.called/c.total)*100):0;
              return (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={()=>setSelected(c)}>
                  <td className="px-4 py-3"><p className="text-sm font-medium text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{c.name}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{AGENTS_SEED.find(a=>a.id===c.agentId)?.name}</p></td>
                  <td className="px-4 py-3"><DBadge v={c.status==="running"?"success":c.status==="paused"?"warning":c.status==="completed"?"info":c.status==="failed"?"error":"neutral"}><SDot status={c.status}/> {c.status}</DBadge></td>
                  <td className="px-4 py-3 w-36"><DProg v={c.called} max={c.total} className="mb-1"/><p className="text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{c.called.toLocaleString()} / {c.total.toLocaleString()} ({pct}%)</p></td>
                  <td className="px-4 py-3 text-sm" style={{fontFamily:"'DM Mono',monospace"}}>{c.connected.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm" style={{fontFamily:"'DM Mono',monospace"}}>{c.converted.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{c.created}</td>
                  <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                    <div className="flex gap-1">
                      {c.status==="running"&&<DBtn size="sm" variant="secondary"><PauseCircle className="w-3.5 h-3.5"/></DBtn>}
                      {c.status==="paused"&&<DBtn size="sm" variant="secondary"><PlayCircle className="w-3.5 h-3.5"/></DBtn>}
                      {(c.status==="draft"||c.status==="paused")&&<DBtn size="sm" variant="ghost"><StopCircle className="w-3.5 h-3.5"/></DBtn>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DModal open={showCreate} onClose={()=>setShowCreate(false)} title="Create batch campaign" width="max-w-xl">
        <div className="space-y-4">
          <DField label="Campaign name"><DInput placeholder="Q3 Insurance Renewal" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></DField>
          <DField label="AI Agent"><DSelect value={form.agentId} onChange={e=>setForm(f=>({...f,agentId:e.target.value}))}>{(liveAgents.length>0?liveAgents.filter(a=>a.status!=='draft'):AGENTS_SEED.filter(a=>a.status!=='draft')).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</DSelect></DField>
          <DField label="Outbound number"><DSelect value={form.numberId} onChange={e=>setForm(f=>({...f,numberId:e.target.value}))}>{NUMBERS_SEED.filter(n=>n.type!=="sip").map(n=><option key={n.id} value={n.id}>{n.number} — {n.label}</option>)}</DSelect></DField>
          <DField label="Contact list (CSV)" hint="Must include a 'phone' column. Max 50,000 rows.">
            <div className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:bg-muted/20 transition-colors" onClick={()=>fileRef.current?.click()}>
              <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-2"/>
              <p className="text-sm text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{form.csvRows>0?`${form.csvRows.toLocaleString()} contacts loaded`:"Click to upload CSV"}</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={()=>setForm(f=>({...f,csvRows:Math.floor(Math.random()*3000)+500}))}/>
            </div>
          </DField>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{fontFamily:"'DM Mono',monospace"}}>Schedule</p>
            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={form.scheduleNow} onChange={()=>setForm(f=>({...f,scheduleNow:true}))} className="accent-foreground"/><span className="text-sm" style={{fontFamily:"'Figtree',sans-serif"}}>Start immediately</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={!form.scheduleNow} onChange={()=>setForm(f=>({...f,scheduleNow:false}))} className="accent-foreground"/><span className="text-sm" style={{fontFamily:"'Figtree',sans-serif"}}>Schedule for later</span></label>
            {!form.scheduleNow&&<DInput type="datetime-local" value={form.scheduledAt} onChange={e=>setForm(f=>({...f,scheduledAt:e.target.value}))}/>}
          </div>
          <div className="flex gap-3 pt-2"><DBtn onClick={handleCreate}><Send className="w-4 h-4"/> Launch campaign</DBtn><DBtn variant="secondary" onClick={()=>setShowCreate(false)}>Cancel</DBtn></div>
        </div>
      </DModal>

      <DModal open={!!selected} onClose={()=>setSelected(null)} title={selected?.name??""} width="max-w-xl">
        {selected&&(
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[{label:"Total",value:selected.total.toLocaleString()},{label:"Called",value:selected.called.toLocaleString()},{label:"Connected",value:selected.connected.toLocaleString()},{label:"Converted",value:selected.converted.toLocaleString()}].map(s=>(
                <div key={s.label} className="bg-muted/30 rounded-xl p-3"><p className="text-xs text-muted-foreground mb-1" style={{fontFamily:"'DM Mono',monospace"}}>{s.label.toUpperCase()}</p><p className="text-xl font-bold" style={{fontFamily:"'Instrument Serif',serif"}}>{s.value}</p></div>
              ))}
            </div>
            <div><p className="text-xs text-muted-foreground mb-2" style={{fontFamily:"'DM Mono',monospace"}}>PROGRESS — {Math.round((selected.called/selected.total)*100)}%</p><DProg v={selected.called} max={selected.total}/></div>
            <div className="flex gap-2">
              {selected.status==="running"&&<DBtn variant="secondary"><PauseCircle className="w-4 h-4"/> Pause</DBtn>}
              {selected.status==="paused"&&<DBtn><PlayCircle className="w-4 h-4"/> Resume</DBtn>}
              <DBtn variant="secondary"><Download className="w-4 h-4"/> Export results</DBtn>
              {selected.status!=="completed"&&<DBtn variant="danger"><StopCircle className="w-4 h-4"/> Stop</DBtn>}
            </div>
          </div>
        )}
      </DModal>
    </div>
  );
}

// ── Call Logs ──
const STATIC_CALLS = [
  {id:"cl1",name:"Marcus Johnson",number:"+1 (312) 555-0198",agent:"Finance Support Bot",dur:"4m 12s",result:"Resolved",sent:"Positive",date:"Today 2:14 PM",rec:true},
  {id:"cl2",name:"Elena Vasquez",number:"+1 (213) 555-0847",agent:"Healthcare Scheduler",dur:"2m 38s",result:"Scheduled",sent:"Positive",date:"Today 1:58 PM",rec:true},
  {id:"cl3",name:"David Kim",number:"+1 (415) 555-1234",agent:"E-Commerce Support",dur:"7m 55s",result:"Transferred",sent:"Neutral",date:"Today 1:41 PM",rec:true},
  {id:"cl4",name:"Aisha Okafor",number:"+1 (404) 555-9876",agent:"Insurance Claims Rep",dur:"3m 20s",result:"Resolved",sent:"Positive",date:"Today 1:22 PM",rec:false},
  {id:"cl5",name:"Thomas Reed",number:"+1 (617) 555-2847",agent:"Finance Support Bot",dur:"6m 01s",result:"Voicemail",sent:"N/A",date:"Today 12:58 PM",rec:false},
  {id:"cl6",name:"Sophia Hernandez",number:"+1 (702) 555-0391",agent:"Insurance Claims Rep",dur:"5m 44s",result:"Resolved",sent:"Positive",date:"Today 12:33 PM",rec:true},
  {id:"cl7",name:"James Liu",number:"+1 (206) 555-7412",agent:"E-Commerce Support",dur:"1m 52s",result:"Resolved",sent:"Neutral",date:"Today 11:47 AM",rec:true},
  {id:"cl8",name:"Amara Diallo",number:"+1 (917) 555-8823",agent:"Finance Support Bot",dur:"8m 03s",result:"Transferred",sent:"Neutral",date:"Today 11:22 AM",rec:true},
];

function DashCallLogs() {
  const [transcriptOpen, setTranscriptOpen] = useState<string|null>(null);
  const [transcriptText, setTranscriptText] = useState<{role:string;text:string}[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [liveCalls, setLiveCalls] = useState<ApiCall[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);

  // Fallback static transcript
  const staticTranscript = [{role:"agent",text:"Thank you for calling. My name is Nova. How can I help you today?"},{role:"caller",text:"Hi, I wanted to check on my recent claim. The claim number is 847291."},{role:"agent",text:"Of course! To verify your identity, could you please confirm the last four digits of your Social Security number?"},{role:"caller",text:"Sure, it's 6284."},{role:"agent",text:"Thank you. I can see your claim 847291 is currently in review. The estimated completion date is July 14th. Would you like me to send you an email update when the status changes?"},{role:"caller",text:"Yes, please. That would be great."},{role:"agent",text:"I've set up email alerts for you. Is there anything else I can help you with today?"},{role:"caller",text:"No, that's everything. Thanks!"},{role:"agent",text:"You're welcome. Have a great day. Goodbye!"}];

  useEffect(() => {
    setCallsLoading(true);
    fetchCalls({ limit: 50 })
      .then(setLiveCalls)
      .catch(() => {})
      .finally(() => setCallsLoading(false));
  }, []);

  // Connect to live WebSocket transcript if the opened call is active
  useEffect(() => {
    if (!transcriptOpen || !/^[0-9a-f-]{36}$/.test(transcriptOpen)) return;

    // Check if the selected call is active
    const selectedCall = liveCalls.find(c => c.id === transcriptOpen);
    if (!selectedCall || selectedCall.status !== 'active') return;

    setTranscriptLoading(true);

    const wsUrl = getLiveTranscriptWsUrl(transcriptOpen);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setTranscriptLoading(false);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message && typeof message.transcript === 'string') {
          const lines = message.transcript.split('\n').filter(Boolean);
          setTranscriptText(lines.map(l => ({
            role: l.startsWith('Agent:') ? 'agent' : 'caller',
            text: l.replace(/^(Agent:|Caller:)\s*/, '')
          })));
        }
      } catch (e) {
        if (typeof event.data === 'string') {
          const lines = event.data.split('\n').filter(Boolean);
          setTranscriptText(lines.map(l => ({
            role: l.startsWith('Agent:') ? 'agent' : 'caller',
            text: l.replace(/^(Agent:|Caller:)\s*/, '')
          })));
        }
      }
    };

    ws.onerror = () => {
      setTranscriptLoading(false);
    };

    ws.onclose = () => {
      setTranscriptLoading(false);
    };

    return () => {
      ws.close();
    };
  }, [transcriptOpen, liveCalls]);

  function openTranscript(callId: string) {
    setTranscriptOpen(callId);
    // Only fetch from API if it looks like a real UUID
    if (/^[0-9a-f-]{36}$/.test(callId)) {
      setTranscriptLoading(true);
      setTranscriptText([]);
      getCallTranscript(callId)
        .then((data) => {
          if (typeof data.transcript === 'string' && data.transcript.length > 0) {
            // Parse the raw transcript string into turn objects
            const lines = data.transcript.split('\n').filter(Boolean);
            setTranscriptText(lines.map(l => ({ role: l.startsWith('Agent:') ? 'agent' : 'caller', text: l.replace(/^(Agent:|Caller:)\s*/, '') })));
          } else {
            setTranscriptText(staticTranscript);
          }
        })
        .catch(() => setTranscriptText(staticTranscript))
        .finally(() => setTranscriptLoading(false));
    } else {
      setTranscriptText(staticTranscript);
    }
  }

  // Normalise live calls to the display shape; fall back to static if empty
  const calls = liveCalls.length > 0
    ? liveCalls.map(c => ({
        id: c.id,
        name: c.phoneNumber ?? 'Unknown caller',
        number: c.phoneNumber ?? '—',
        agent: c.agent?.name ?? '—',
        dur: c.duration != null ? `${Math.floor(c.duration/60)}m ${c.duration%60}s` : '—',
        result: c.status === 'completed' ? 'Resolved' : c.status === 'failed' ? 'Failed' : c.status === 'active' ? 'Active' : c.status,
        sent: 'N/A',
        date: new Date(c.createdAt).toLocaleString(),
        rec: false,
      }))
    : STATIC_CALLS;
  void callsLoading;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"/><DInput className="pl-8 w-44" placeholder="Search caller…"/></div>
          <select className="bg-muted/40 border border-border rounded-lg px-2 py-1.5 text-xs outline-none" style={{fontFamily:"'Figtree',sans-serif"}}><option>All agents</option>{AGENTS_SEED.map(a=><option key={a.id}>{a.name}</option>)}</select>
          {/* Agent filter populated from seed; live agents loaded in DashAgents */}
          <select className="bg-muted/40 border border-border rounded-lg px-2 py-1.5 text-xs outline-none" style={{fontFamily:"'Figtree',sans-serif"}}><option>Today</option><option>Last 7 days</option><option>Last 30 days</option></select>
        </div>
        <DBtn size="sm" variant="secondary"><Download className="w-3.5 h-3.5"/> Export CSV</DBtn>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">{["Caller","Agent","Duration","Result","Sentiment","Recording","Time",""].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {calls.map(c=>(
              <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3"><p className="text-sm font-medium text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{c.name}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{c.number}</p></td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell" style={{fontFamily:"'Figtree',sans-serif"}}>{c.agent}</td>
                <td className="px-4 py-3 text-xs hidden lg:table-cell" style={{fontFamily:"'DM Mono',monospace"}}>{c.dur}</td>
                <td className="px-4 py-3"><DBadge v={c.result==="Resolved"||c.result==="Scheduled"?"success":c.result==="Transferred"?"warning":c.result==="Voicemail"?"neutral":"info"}>{c.result}</DBadge></td>
                <td className="px-4 py-3 text-xs hidden lg:table-cell"><span className={c.sent==="Positive"?"text-emerald-600":c.sent==="Negative"?"text-red-500":"text-muted-foreground"} style={{fontFamily:"'Figtree',sans-serif"}}>{c.sent}</span></td>
                <td className="px-4 py-3 hidden lg:table-cell">{c.rec?<DBtn size="sm" variant="ghost"><Play className="w-3.5 h-3.5"/></DBtn>:<span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell" style={{fontFamily:"'DM Mono',monospace"}}>{c.date}</td>
                <td className="px-4 py-3"><DBtn size="sm" variant="ghost" onClick={()=>openTranscript(c.id)}><Eye className="w-3.5 h-3.5"/> Transcript</DBtn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DModal open={!!transcriptOpen} onClose={()=>{setTranscriptOpen(null);setTranscriptText([]);}} title={"Call transcript — " + calls.find(c=>c.id===transcriptOpen)?.name}>
        <div className="space-y-3">
          <div className="p-3 bg-muted/30 rounded-xl text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{calls.find(c=>c.id===transcriptOpen)?.date} · {calls.find(c=>c.id===transcriptOpen)?.dur} · {calls.find(c=>c.id===transcriptOpen)?.result}</div>
          {transcriptLoading && <p className="text-xs text-muted-foreground text-center py-4" style={{fontFamily:"'Figtree',sans-serif"}}>Loading transcript…</p>}
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {(transcriptText.length > 0 ? transcriptText : staticTranscript).map((m,i)=>(
              <div key={i} className={`flex gap-2 ${m.role==="caller"?"justify-end":""}`}>
                {m.role==="agent"&&<div className="w-6 h-6 bg-foreground rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><Bot className="w-3 h-3 text-white"/></div>}
                <div className={`rounded-xl px-3 py-2 max-w-[80%] ${m.role==="agent"?"bg-muted rounded-tl-none":"bg-foreground text-white rounded-tr-none"}`}><p className="text-xs" style={{fontFamily:"'Figtree',sans-serif"}}>{m.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </DModal>
    </div>
  );
}

// ── Phone Numbers ──
function DashNumbers() {
  const [numbers, setNumbers] = useState([...NUMBERS_SEED]);
  const [showBuy, setShowBuy] = useState(false);
  const [showSip, setShowSip] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [sipForm, setSipForm] = useState({uri:"sip:pbx.acmecorp.com",user:"clarityvoice",pass:"",codec:"PCMU,PCMA,G722",transport:"TLS",dtmf:"RFC 2833",register:true});
  const buyResults = [
    {number:"+1 (212) 555-0182",region:"New York, NY",type:"local",mo:2.00},
    {number:"+1 (310) 555-0847",region:"Los Angeles, CA",type:"local",mo:2.00},
    {number:"+1 (800) 555-0293",region:"National",type:"tollfree",mo:3.50},
    {number:"+1 (888) 555-0741",region:"National",type:"tollfree",mo:3.50},
    {number:"+1 (512) 555-0038",region:"Austin, TX",type:"local",mo:2.00},
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{numbers.length} numbers provisioned</p>
        <div className="flex gap-2"><DBtn variant="secondary" onClick={()=>setShowSip(true)}><Network className="w-4 h-4"/> SIP config</DBtn><DBtn onClick={()=>setShowBuy(true)}><Plus className="w-4 h-4"/> Buy number</DBtn></div>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/30">{["Number","Label","Type","Region","Agent","Status",""].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {numbers.map(n=>(
              <tr key={n.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-sm font-medium" style={{fontFamily:"'DM Mono',monospace"}}>{n.number}</td>
                <td className="px-4 py-3 text-sm" style={{fontFamily:"'Figtree',sans-serif"}}>{n.label}</td>
                <td className="px-4 py-3"><DBadge v={n.type==="tollfree"?"info":"neutral"}>{n.type==="tollfree"?"Toll-free":n.type==="sip"?"SIP":"Local"}</DBadge></td>
                <td className="px-4 py-3 text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{n.region}</td>
                <td className="px-4 py-3">{n.agentId?<span className="text-xs border border-border rounded px-2 py-0.5" style={{fontFamily:"'Figtree',sans-serif"}}>{AGENTS_SEED.find(a=>a.id===n.agentId)?.name}</span>:<span className="text-xs text-muted-foreground">Unassigned</span>}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1.5"><SDot status={n.status}/><span className="text-xs capitalize" style={{fontFamily:"'Figtree',sans-serif"}}>{n.status}</span></div></td>
                <td className="px-4 py-3"><div className="flex gap-1"><DBtn size="sm" variant="ghost"><Edit3 className="w-3.5 h-3.5"/></DBtn><DBtn size="sm" variant="ghost"><Trash2 className="w-3.5 h-3.5 text-red-400"/></DBtn></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DModal open={showBuy} onClose={()=>setShowBuy(false)} title="Buy phone number">
        <div className="space-y-4">
          <DField label="Search by area code or city"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><DInput className="pl-9" placeholder="212, Austin, 800…"/></div></DField>
          <div className="space-y-2">{buyResults.map(r=>(
            <div key={r.number} className="flex items-center justify-between p-3 border border-border rounded-xl hover:bg-muted/20 transition-colors">
              <div><p className="text-sm font-medium" style={{fontFamily:"'DM Mono',monospace"}}>{r.number}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{r.region} · <DBadge>{r.type}</DBadge></p></div>
              <div className="flex items-center gap-3"><span className="text-sm font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>${r.mo}/mo</span><DBtn size="sm" onClick={()=>{setNumbers(p=>[...p,{id:`pn${Date.now()}`,number:r.number,label:"New number",type:r.type as "local"|"tollfree",agentId:null,region:r.region,status:"active"}]);setShowBuy(false);}}>Provision</DBtn></div>
            </div>
          ))}</div>
        </div>
      </DModal>

      <DModal open={showSip} onClose={()=>setShowSip(false)} title="SIP trunk configuration" width="max-w-xl">
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3"><Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5"/><p className="text-xs text-blue-700" style={{fontFamily:"'Figtree',sans-serif"}}>Connects Clarity Voice directly to your on-premise PBX or UCaaS (Cisco, Avaya, Asterisk, FreePBX, 3CX).</p></div>
          <DField label="SIP URI"><DInput value={sipForm.uri} onChange={e=>setSipForm(f=>({...f,uri:e.target.value}))}/></DField>
          <div className="grid grid-cols-2 gap-3">
            <DField label="Username"><DInput value={sipForm.user} onChange={e=>setSipForm(f=>({...f,user:e.target.value}))}/></DField>
            <DField label="Password"><div className="relative"><DInput type={showPass?"text":"password"} value={sipForm.pass} onChange={e=>setSipForm(f=>({...f,pass:e.target.value}))} placeholder="••••••••"/><button onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button></div></DField>
          </div>
          <DField label="Codecs" hint="Recommended: PCMU,PCMA for max compatibility. G722 for HD voice."><DInput value={sipForm.codec} onChange={e=>setSipForm(f=>({...f,codec:e.target.value}))}/></DField>
          <div className="grid grid-cols-2 gap-3">
            <DField label="Transport"><DSelect value={sipForm.transport} onChange={e=>setSipForm(f=>({...f,transport:e.target.value}))}><option>TLS</option><option>TCP</option><option>UDP</option></DSelect></DField>
            <DField label="DTMF mode"><DSelect value={sipForm.dtmf} onChange={e=>setSipForm(f=>({...f,dtmf:e.target.value}))}><option>RFC 2833</option><option>In-band</option><option>SIP INFO</option></DSelect></DField>
          </div>
          <div className="flex items-center justify-between"><div><p className="text-sm font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>SIP registration</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Register with your PBX for inbound routing</p></div><DToggle on={sipForm.register} set={v=>setSipForm(f=>({...f,register:v}))}/></div>
          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2" style={{fontFamily:"'DM Mono',monospace"}}>ADD THESE IPs TO YOUR PBX ALLOWLIST</p>
            {["34.120.88.42","34.102.147.9"].map(ip=><p key={ip} className="text-xs font-medium" style={{fontFamily:"'DM Mono',monospace"}}>{ip}</p>)}
            <p className="text-xs text-muted-foreground mt-1" style={{fontFamily:"'DM Mono',monospace"}}>SIP Port: 5061 (TLS) · RTP: 10000–60000</p>
          </div>
          <div className="flex gap-3"><DBtn><Check className="w-4 h-4"/> Save &amp; test connection</DBtn><DBtn variant="secondary" onClick={()=>setShowSip(false)}>Cancel</DBtn></div>
        </div>
      </DModal>
    </div>
  );
}

// ── Knowledge Base ──
function DashKnowledge({ apiAgents = [] }: { apiAgents?: ApiAgent[] }) {
  const [docs, setDocs] = useState<ApiKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState<"file"|"url">("file");
  const [url, setUrl] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    try {
      setLoading(true);
      const list = await fetchKBList();
      setDocs(list);
    } catch (err) {
      console.error("Failed to load knowledge base", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  useEffect(() => {
    if (apiAgents && apiAgents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(apiAgents[0].id);
    }
  }, [apiAgents]);

  async function addUrl() {
    if (!url || !selectedAgentId) return;
    try {
      setLoading(true);
      await scrapeKBUrl(url, selectedAgentId);
      setShowAdd(false);
      setUrl("");
      await loadDocs();
    } catch (err) {
      console.error("Failed to crawl URL", err);
    } finally {
      setLoading(false);
    }
  }

  function addFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedAgentId) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      const base64Data = result.split(',')[1];
      
      try {
        setLoading(true);
        await uploadKBDocument(file.name, selectedAgentId, base64Data);
        setShowAdd(false);
        await loadDocs();
      } catch (err) {
        console.error("Failed to upload document", err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      setLoading(true);
      await deleteKBDocument(id);
      await loadDocs();
    } catch (err) {
      console.error("Failed to delete document", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{docs.length} documents uploaded</p>
        <DBtn onClick={()=>setShowAdd(true)}><Plus className="w-4 h-4"/> Add document</DBtn>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{label:"Total documents",v:docs.length},{label:"Total characters",v:docs.reduce((s,d)=>s+d.sizeChars,0).toLocaleString()},{label:"Indexed sources",v:docs.length}].map(s=>(
          <div key={s.label} className="bg-white border border-border rounded-xl p-4"><p className="text-xs text-muted-foreground mb-2" style={{fontFamily:"'DM Mono',monospace"}}>{s.label.toUpperCase()}</p><p className="text-2xl font-bold" style={{fontFamily:"'Instrument Serif',serif"}}>{s.v}</p></div>
        ))}
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        {loading && docs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>LOADING DATASETS...</div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/30">{["Document / URL","Linked Agent","Size","Uploaded",""].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{h.toUpperCase()}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {docs.map(d=>(
                <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 max-w-[240px]"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground flex-shrink-0"/><p className="text-sm text-foreground truncate font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>{d.name}</p></div></td>
                  <td className="px-4 py-3"><span className="text-xs bg-muted rounded px-1.5 py-0.5 font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>{apiAgents.find(a=>a.id===d.agentId)?.name || "Default Agent"}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{(d.sizeChars / 1024).toFixed(1)} KB</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><DBtn size="sm" variant="ghost" onClick={() => handleDelete(d.id)}><Trash2 className="w-3.5 h-3.5 text-red-400"/></DBtn></td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>NO DOCUMENTS UPLOADED YET.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <DModal open={showAdd} onClose={()=>setShowAdd(false)} title="Add to knowledge base">
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-border pb-3">{(["file","url"] as const).map(t=><button key={t} onClick={()=>setAddTab(t)} className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${addTab===t?"bg-foreground text-white":"text-muted-foreground hover:text-foreground"}`} style={{fontFamily:"'Figtree',sans-serif"}}>{t==="file"?"Upload file":"Crawl URL"}</button>)}</div>
          
          <div className="mb-2">
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5" style={{fontFamily:"'DM Mono',monospace"}}>LINK TO AI AGENT</label>
            <select 
              value={selectedAgentId} 
              onChange={e => setSelectedAgentId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none"
            >
              <option value="">Select an Agent...</option>
              {apiAgents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {addTab==="file"?(
            <div className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:bg-muted/20 transition-colors" onClick={()=>fileRef.current?.click()}>
              <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-3"/>
              <p className="text-sm font-medium mb-1" style={{fontFamily:"'Figtree',sans-serif"}}>Drop file or click to browse</p>
              <p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>TXT, PDF, CSV, DOCX — max 500 KB text extraction</p>
              <input ref={fileRef} type="file" accept=".txt,.pdf,.csv,.docx" className="hidden" onChange={addFile}/>
            </div>
          ):(
            <div className="space-y-3">
              <DField label="URL to crawl" hint="Crawl target page source and extract raw text context."><DInput placeholder="https://example.com/help-center" value={url} onChange={e=>setUrl(e.target.value)}/></DField>
              <DBtn onClick={addUrl} disabled={!url || !selectedAgentId}><Link className="w-4 h-4"/> Start crawl</DBtn>
            </div>
          )}
        </div>
      </DModal>
    </div>
  );
}

// ── Voice Library ──
function DashVoices() {
  const [voices, setVoices] = useState([...VOICES_SEED]);
  const [playing, setPlaying] = useState<string|null>(null);
  const [showClone, setShowClone] = useState(false);
  const [cloneStep, setCloneStep] = useState<"form"|"processing"|"done">("form");
  const [cloneForm, setCloneForm] = useState({name:"",gender:"female",accent:"American",lang:"EN"});
  const [voiceFilter, setVoiceFilter] = useState<"all"|"builtin"|"clone">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  function submitClone() {
    setCloneStep("processing");
    setTimeout(()=>{setCloneStep("done"); setTimeout(()=>{setVoices(p=>[...p,{id:`vc${Date.now()}`,name:cloneForm.name||"Custom Clone",gender:cloneForm.gender,accent:cloneForm.accent,provider:"clone",lang:cloneForm.lang}]);setShowClone(false);setCloneStep("form");setCloneForm({name:"",gender:"female",accent:"American",lang:"EN"});},1500);},3000);
  }

  const filtered = voiceFilter==="all" ? voices : voices.filter(v=>v.provider===voiceFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">{(["all","builtin","clone"] as const).map(f=><button key={f} onClick={()=>setVoiceFilter(f)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${voiceFilter===f?"bg-foreground text-white":"border border-border text-muted-foreground hover:text-foreground"}`} style={{fontFamily:"'Figtree',sans-serif"}}>{f==="all"?"All voices":f==="builtin"?"Built-in":"Cloned"}</button>)}</div>
        <DBtn onClick={()=>setShowClone(true)}><Mic2 className="w-4 h-4"/> Clone a voice</DBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(v=>(
          <div key={v.id} className="bg-white border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${v.provider==="clone"?"bg-foreground":"bg-muted"}`}><Headphones className={`w-5 h-5 ${v.provider==="clone"?"text-white":"text-muted-foreground"}`}/></div>
                <div><p className="text-sm font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>{v.name}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{v.gender} · {v.accent}</p></div>
              </div>
              {v.provider==="clone"&&<DBadge v="dark">★ Clone</DBadge>}
            </div>
            <div className="flex flex-wrap gap-1 mb-3">{v.lang.split(", ").map(l=><DBadge key={l}>{l}</DBadge>)}</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-lg h-8 flex items-center px-2 text-muted-foreground"><MiniWave on={playing===v.id} bars={18}/></div>
              <button onClick={()=>setPlaying(playing===v.id?null:v.id)} className="w-8 h-8 border border-border rounded-full flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">{playing===v.id?<Pause className="w-3.5 h-3.5"/>:<Play className="w-3.5 h-3.5"/>}</button>
              {v.provider==="clone"&&<DBtn size="sm" variant="ghost"><Trash2 className="w-3.5 h-3.5 text-red-400"/></DBtn>}
            </div>
          </div>
        ))}
      </div>
      <DModal open={showClone} onClose={()=>{setShowClone(false);setCloneStep("form");}} title="Clone a voice" width="max-w-md">
        {cloneStep==="form"&&(
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3"><AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"/><p className="text-xs text-amber-700" style={{fontFamily:"'Figtree',sans-serif"}}>You must have explicit written consent from the voice owner before cloning.</p></div>
            <DField label="Voice name"><DInput placeholder="e.g. Sarah Mitchell" value={cloneForm.name} onChange={e=>setCloneForm(f=>({...f,name:e.target.value}))}/></DField>
            <div className="grid grid-cols-2 gap-3">
              <DField label="Gender"><DSelect value={cloneForm.gender} onChange={e=>setCloneForm(f=>({...f,gender:e.target.value}))}><option value="female">Female</option><option value="male">Male</option><option value="neutral">Neutral</option></DSelect></DField>
              <DField label="Language"><DSelect value={cloneForm.lang} onChange={e=>setCloneForm(f=>({...f,lang:e.target.value}))}><option>EN</option><option>ES</option><option>FR</option><option>DE</option><option>ZH</option><option>HI</option></DSelect></DField>
            </div>
            <DField label="Training audio" hint="1–10 min of clean speech. WAV or MP3, min 16kHz, no background noise.">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/20 transition-colors" onClick={()=>fileRef.current?.click()}>
                <Mic2 className="w-6 h-6 text-muted-foreground mx-auto mb-2"/>
                <p className="text-sm text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Click to upload audio sample</p>
                <p className="text-xs text-muted-foreground mt-1" style={{fontFamily:"'Figtree',sans-serif"}}>WAV, MP3 — max 100 MB</p>
                <input ref={fileRef} type="file" accept=".wav,.mp3" className="hidden" onChange={()=>{}}/>
              </div>
            </DField>
            <div className="flex gap-3"><DBtn onClick={submitClone}><Wand2 className="w-4 h-4"/> Clone voice</DBtn><DBtn variant="secondary" onClick={()=>setShowClone(false)}>Cancel</DBtn></div>
          </div>
        )}
        {cloneStep==="processing"&&<div className="py-12 text-center space-y-4"><div className="w-12 h-12 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto"/><p className="font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>Training voice model…</p><p className="text-sm text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>Takes 1–3 minutes. You can close this window.</p></div>}
        {cloneStep==="done"&&<div className="py-12 text-center space-y-4"><div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 className="w-6 h-6 text-emerald-500"/></div><p className="font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>Voice cloned successfully!</p></div>}
      </DModal>
    </div>
  );
}

// ── Analytics ──
function DashAnalytics() {
  return <AnalyticsOverview />;
}

// ── Settings ──
function DashSettings() {
  const [stab, setStab] = useState<"workspace"|"api"|"webhooks"|"billing"|"team">("workspace");
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  useEffect(() => { fetchProfile().then(setProfile).catch(() => {}); }, []);
  const [apiVis, setApiVis] = useState(false);
  const [webhook, setWebhook] = useState("https://hooks.acmecorp.com/aivoice");
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex gap-1 border-b border-border">
        {(["workspace","api","webhooks","billing","team"] as const).map(t=><button key={t} onClick={()=>setStab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${stab===t?"border-foreground text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`} style={{fontFamily:"'Figtree',sans-serif"}}>{t}</button>)}
      </div>
      {stab==="workspace"&&(
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <DField label="Workspace name"><DInput defaultValue={profile?.fullName ?? "Acme Corp"}/></DField>
          <DField label="Billing email"><DInput type="email" defaultValue={profile?.email ?? "billing@acmecorp.com"}/></DField>
          <DField label="Timezone"><DSelect><option>America/New_York (UTC−5)</option><option>America/Chicago (UTC−6)</option><option>America/Los_Angeles (UTC−8)</option><option>Europe/London (UTC+0)</option></DSelect></DField>
          <DField label="Default outbound number"><DSelect>{NUMBERS_SEED.filter(n=>n.type!=="sip").map(n=><option key={n.id}>{n.number} — {n.label}</option>)}</DSelect></DField>
          {[{l:"Call recording",d:"Record all calls for compliance"},{l:"Real-time transcription",d:"Stream live transcripts to the dashboard"},{l:"Sentiment analysis",d:"Analyse caller sentiment on every call"},{l:"Auto-summary",d:"Generate a summary after each call ends"}].map(s=>(
            <div key={s.l} className="flex items-center justify-between"><div><p className="text-sm font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>{s.l}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{s.d}</p></div><DToggle on={true} set={()=>{}}/></div>
          ))}
          <DBtn><Check className="w-4 h-4"/> Save settings</DBtn>
        </div>
      )}
      {stab==="api"&&(
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-5 space-y-5">
            <p className="text-sm font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>API keys</p>
            {[{label:"Production key",key:"cv_prod_sk_2x9mNpQrTvWx...3K8L",env:"production"},{label:"Test key",key:"cv_test_sk_8nBpQsRuVxZa...7M2N",env:"test"}].map(k=>(
              <div key={k.label} className="space-y-2">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground uppercase" style={{fontFamily:"'DM Mono',monospace"}}>{k.label}</span><DBadge v={k.env==="production"?"success":"info"}>{k.env}</DBadge></div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs overflow-hidden" style={{fontFamily:"'DM Mono',monospace"}}>{apiVis?k.key:"cv_"+k.env.slice(0,4)+"_sk_••••••••••••••••••••••••••••"}</div>
                  <button onClick={()=>setApiVis(!apiVis)} className="p-2 border border-border rounded-lg hover:bg-muted">{apiVis?<EyeOff className="w-4 h-4 text-muted-foreground"/>:<Eye className="w-4 h-4 text-muted-foreground"/>}</button>
                  <button className="p-2 border border-border rounded-lg hover:bg-muted"><Copy className="w-4 h-4 text-muted-foreground"/></button>
                </div>
              </div>
            ))}
            <DBtn variant="secondary"><RefreshCw className="w-4 h-4"/> Rotate keys</DBtn>
          </div>
          <div className="bg-white border border-border rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold" style={{fontFamily:"'Figtree',sans-serif"}}>Quick start</p>
            <div className="bg-muted/40 border border-border rounded-xl p-4 overflow-x-auto"><pre className="text-xs" style={{fontFamily:"'DM Mono',monospace"}}>{`curl -X POST https://api.clarityvoice.com/v1/calls \\\n  -H "Authorization: Bearer cv_prod_sk_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"agent_id":"a2","to":"+13125550198","from":"+18005550842"}'`}</pre></div>
          </div>
        </div>
      )}
      {stab==="webhooks"&&(
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <DField label="Webhook URL" hint="We POST events to this URL in real time."><DInput value={webhook} onChange={e=>setWebhook(e.target.value)}/></DField>
          <DField label="Events"><div className="space-y-2 mt-1">{["call.started","call.ended","call.transferred","call.recording_ready","campaign.completed","agent.error"].map(ev=><label key={ev} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" defaultChecked className="accent-foreground"/><span className="text-sm" style={{fontFamily:"'DM Mono',monospace"}}>{ev}</span></label>)}</div></DField>
          <DField label="Signing secret" hint="Verify payloads with HMAC-SHA256."><div className="flex gap-2"><DInput type="password" defaultValue="whsec_2xNpQrTvWxYzAbCdEfGh"/><button className="p-2 border border-border rounded-lg hover:bg-muted"><Copy className="w-4 h-4 text-muted-foreground"/></button></div></DField>
          <DBtn><Check className="w-4 h-4"/> Save &amp; test webhook</DBtn>
        </div>
      )}
      {stab==="billing"&&(
        <BillingGateway />
      )}
      {stab==="team"&&(
        <div className="space-y-3">
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full"><thead><tr className="border-b border-border bg-muted/30">{["Member","Role","Last active",""].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{h.toUpperCase()}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {[{name:"Jamie Chen",email:"jamie@acmecorp.com",role:"Admin",active:"Now"},{name:"Rachel Okonkwo",email:"rachel@acmecorp.com",role:"Manager",active:"2h ago"},{name:"Tomás Rivera",email:"tomas@acmecorp.com",role:"Analyst",active:"Yesterday"},{name:"Priya Sharma",email:"priya@acmecorp.com",role:"Viewer",active:"3d ago"}].map(m=>(
                <tr key={m.name} className="hover:bg-muted/20"><td className="px-4 py-3"><p className="text-sm font-medium" style={{fontFamily:"'Figtree',sans-serif"}}>{m.name}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{m.email}</p></td><td className="px-4 py-3"><DBadge>{m.role}</DBadge></td><td className="px-4 py-3 text-xs text-muted-foreground" style={{fontFamily:"'DM Mono',monospace"}}>{m.active}</td><td className="px-4 py-3"><DBtn size="sm" variant="ghost"><Edit3 className="w-3.5 h-3.5"/></DBtn></td></tr>
              ))}
            </tbody></table>
          </div>
          <DBtn variant="secondary"><Plus className="w-4 h-4"/> Invite team member</DBtn>
        </div>
      )}
    </div>
  );
}

// ── Main DashboardPage ──
function DashboardPage({ session }: { session: Session }) {
  const [section, setSection] = useState<DashSection>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [apiAgents, setApiAgents] = useState<ApiAgent[]>([]);
  
  useEffect(() => { 
    fetchProfile().then(setProfile).catch(() => {}); 
    fetchAgents().then(setApiAgents).catch(() => {});
  }, [session]);

  const navGroups = [
    {label:"Workspace",items:[{id:"overview",icon:LayoutDashboard,label:"Overview"},{id:"agents",icon:Bot,label:"Agents"},{id:"batch",icon:Radio,label:"Batch Calls"},{id:"calls",icon:PhoneIncoming,label:"Call Logs"}]},
    {label:"Resources",items:[{id:"numbers",icon:Phone,label:"Phone Numbers"},{id:"knowledge",icon:BookOpen,label:"Knowledge Base"},{id:"voices",icon:Mic2,label:"Voice Library"},{id:"analytics",icon:BarChart3,label:"Analytics"}]},
    {label:"Admin",items:[{id:"settings",icon:Settings,label:"Settings"}]},
  ] as const;

  const titles: Record<DashSection,string> = {overview:"Overview",agents:"Agents",batch:"Batch Calls",calls:"Call Logs",numbers:"Phone Numbers",knowledge:"Knowledge Base",voices:"Voice Library",analytics:"Analytics",settings:"Settings"};

  return (
    <div className="flex h-screen bg-muted/20 pt-16 overflow-hidden">
      <div className={`${sidebarOpen?"w-52":"w-12"} flex-shrink-0 bg-white border-r border-border flex flex-col transition-all duration-200 overflow-hidden`}>
        <div className="h-11 border-b border-border flex items-center px-2 justify-between">
          {sidebarOpen&&<span className="text-xs font-medium text-muted-foreground ml-1" style={{fontFamily:"'DM Mono',monospace"}}>DASHBOARD</span>}
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center ml-auto transition-colors"><Menu className="w-3.5 h-3.5 text-muted-foreground"/></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
          {navGroups.map(group=>(
            <div key={group.label}>
              {sidebarOpen&&<p className="text-xs font-medium text-muted-foreground px-2 mb-1" style={{fontFamily:"'DM Mono',monospace"}}>{group.label.toUpperCase()}</p>}
              <div className="space-y-0.5">
                {group.items.map(item=>{
                  const Icon=item.icon; const active=section===item.id;
                  return <button key={item.id} onClick={()=>setSection(item.id as DashSection)} title={!sidebarOpen?item.label:undefined} className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${active?"bg-foreground text-white":"text-muted-foreground hover:text-foreground hover:bg-muted"}`} style={{fontFamily:"'Figtree',sans-serif"}}><Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active?2:1.5}/>{sidebarOpen&&<span className="truncate">{item.label}</span>}</button>;
                })}
              </div>
            </div>
          ))}
        </nav>
        {sidebarOpen&&(
          <div className="p-2 border-t border-border flex flex-col gap-1">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-6 h-6 bg-foreground rounded-full flex items-center justify-center flex-shrink-0"><span className="text-xs text-white font-bold">{(profile?.fullName ?? profile?.email ?? 'U').charAt(0).toUpperCase()}</span></div>
              <div className="min-w-0 flex-1"><p className="text-xs font-medium truncate" style={{fontFamily:"'Figtree',sans-serif"}}>{profile?.fullName ?? profile?.email ?? 'User'}</p><p className="text-xs text-muted-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{profile?.billingBalance != null ? `Balance: $${profile.billingBalance}` : 'Growth plan'}</p></div>
            </div>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="text-left text-[10px] text-red-500 font-semibold px-2 py-1 hover:bg-red-50 rounded transition-all"
              style={{fontFamily:"'Figtree',sans-serif"}}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-border px-5 h-11 flex items-center justify-between flex-shrink-0">
          <p className="text-sm font-semibold text-foreground" style={{fontFamily:"'Figtree',sans-serif"}}>{titles[section]}</p>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:flex items-center"><Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground"/><input className="bg-muted rounded-lg pl-8 pr-3 py-1 text-xs outline-none w-40 focus:ring-1 focus:ring-foreground/20" placeholder="Search…" style={{fontFamily:"'Figtree',sans-serif"}}/></div>
            <button className="relative p-1.5 hover:bg-muted rounded-lg transition-colors"><Bell className="w-4 h-4 text-muted-foreground"/><span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            <motion.div key={section} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.18}}>
              {section==="overview"&&<DashOverview/>}
              {section==="agents"&&<DashAgents/>}
              {section==="batch"&&<DashBatch/>}
              {section==="calls"&&<DashCallLogs/>}
              {section==="numbers"&&<DashNumbers/>}
              {section==="knowledge"&&<DashKnowledge apiAgents={apiAgents}/>}
              {section==="voices"&&<DashVoices/>}
              {section==="analytics"&&<DashAnalytics/>}
              {section==="settings"&&<DashSettings/>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <style>{`
        @keyframes wave {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.22); }
        * { font-family: 'Figtree', sans-serif; }
      `}</style>

      <Nav page={page} setPage={setPage} />

      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {page === "home" && <HomePage setPage={setPage} />}
          {page === "industries" && <IndustriesPage setPage={setPage} />}
          {page === "pricing" && <PricingPage setPage={setPage} />}
          {page === "dashboard" && (
            session ? <DashboardPage session={session} /> : <AuthGateway />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

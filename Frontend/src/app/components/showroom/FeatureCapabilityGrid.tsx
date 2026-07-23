import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock, Zap, ShieldAlert, Cpu, BarChart3, Database,
  CheckCircle2, Play, ArrowRight, ShieldCheck, MessageSquare,
  Network, Code, Settings, Lock, Share2, Layers, Heart
} from "lucide-react";

// Interactive simulated visualizer for Low-Latency Engine
function LatencyVisual() {
  const [activeBar, setActiveBar] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActiveBar(b => (b + 1) % 15), 150);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#34D399] uppercase tracking-wider font-bold">Latency Benchmark</span>
        <span className="text-[11px] font-mono text-white/55">Direct WebRTC Audio Stream</span>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-end h-20 px-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-2.5 rounded-t-md"
              style={{
                background: activeBar === i ? "#34D399" : "rgba(255,255,255,0.1)",
                boxShadow: activeBar === i ? "0 0 15px #34D399" : "none",
                height: `${20 + Math.sin(i * 0.5) * 40 + (activeBar === i ? 15 : 0)}%`
              }}
              animate={{ height: `${20 + Math.sin(i * 0.5) * 40 + (activeBar === i ? 15 : 0)}%` }}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-white/10">
          <div>
            <p className="text-[10px] text-white/40">Speech-To-Text</p>
            <p className="text-sm font-bold text-white font-mono">45ms</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40">LLM Generation</p>
            <p className="text-sm font-bold text-white font-mono">90ms</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40">Text-To-Speech</p>
            <p className="text-sm font-bold text-white font-mono">45ms</p>
          </div>
        </div>
      </div>
      <div className="bg-[#34D399]/10 border border-[#34D399]/20 rounded-xl p-3 flex items-center justify-between">
        <span className="text-xs text-white/80 font-medium">Total Pipeline Latency</span>
        <span className="text-sm font-extrabold text-[#34D399] font-mono">180ms (Sub-second)</span>
      </div>
    </div>
  );
}

// Interactive simulated visualizer for Dynamic Workflows
function WorkflowVisual() {
  const steps = [
    { label: "Incoming Call trigger", active: true },
    { label: "RAG Knowledge Base Query", active: true },
    { label: "Check Calendar API", active: true },
    { label: "Confirm Appointment slot", active: true }
  ];
  const [curr, setCurr] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurr(c => (c + 1) % steps.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#EA580C] uppercase tracking-wider font-bold">Workflow Orchestrator</span>
        <span className="text-[11px] font-mono text-white/55">Prompt-Based Flow Node</span>
      </div>
      <div className="space-y-2.5">
        {steps.map((s, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 p-3 rounded-xl transition-all"
            style={{
              background: curr === idx ? "rgba(234,88,12,0.15)" : "rgba(255,255,255,0.03)",
              border: curr === idx ? "1px solid rgba(234,88,12,0.3)" : "1px solid rgba(255,255,255,0.06)"
            }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] transition-colors"
              style={{
                background: curr === idx ? "#EA580C" : "rgba(255,255,255,0.1)",
                color: curr === idx ? "white" : "rgba(255,255,255,0.5)"
              }}
            >
              {idx + 1}
            </div>
            <span className="text-xs font-semibold text-white/90">{s.label}</span>
            {curr === idx && (
              <span className="ml-auto w-2 h-2 rounded-full bg-[#EA580C] animate-ping" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Interactive simulated visualizer for Security & Compliance
function ComplianceVisual() {
  const [redacted, setRedacted] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setRedacted(r => !r), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#34D399] uppercase tracking-wider font-bold">PII Redaction Engine</span>
        <span className="text-[11px] font-mono text-white/55">Real-time PHI/PCI Protection</span>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 space-y-3">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">LIVE TRANSCRIPT INPUT</p>
        <div className="text-xs leading-relaxed text-white/85 font-mono bg-black/20 p-3.5 rounded-xl border border-white/5 min-h-[70px]">
          {redacted ? (
            <>
              "My card number is <span className="bg-[#EA580C]/20 text-[#EA580C] border border-[#EA580C]/30 px-1 rounded">[REDACTED]</span> and health ID is <span className="bg-[#EA580C]/20 text-[#EA580C] border border-[#EA580C]/30 px-1 rounded">[REDACTED]</span>."
            </>
          ) : (
            <>
              "My card number is <span className="text-[#34D399]">4111-2222-3333-4444</span> and health ID is <span className="text-[#34D399]">HIPAA-90821-X</span>."
            </>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10 text-xs">
        <span className="text-white/60">PII scrubbing latency</span>
        <span className="font-mono text-[#34D399] font-bold">&lt; 3ms</span>
      </div>
    </div>
  );
}

// Interactive simulated visualizer for Outbound Campaigns
function OutboundVisual() {
  const [successRate, setSuccessRate] = useState(91.4);
  useEffect(() => {
    const t = setInterval(() => {
      setSuccessRate(r => {
        const delta = (Math.random() - 0.5) * 0.6;
        return Math.max(88, Math.min(96, Number((r + delta).toFixed(1))));
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#EA580C] uppercase tracking-wider font-bold">Campaign Dashboard</span>
        <span className="text-[11px] font-mono text-white/55">Outbound Scheduler</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-[10px] text-white/40">Dials Active</p>
          <p className="text-xl font-extrabold text-white font-mono mt-1 animate-pulse">4,821</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-[10px] text-white/40">Contact Rate</p>
          <p className="text-xl font-extrabold text-[#EA580C] font-mono mt-1">{successRate}%</p>
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-ping" />
          <span className="text-xs text-white/80">Batch Dial Campaign #4</span>
        </div>
        <span className="text-xs font-mono text-white/50">Running</span>
      </div>
    </div>
  );
}

// Interactive simulated visualizer for Real-time Analytics & CRM Sync
function AnalyticsVisual() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#34D399] uppercase tracking-wider font-bold">CRM Real-Time Sync</span>
        <span className="text-[11px] font-mono text-white/55">HubSpot / Salesforce Integration</span>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center text-xs pb-2 border-b border-white/10">
          <span className="text-white/70">Disposition</span>
          <span className="bg-[#34D399]/20 text-[#34D399] font-mono px-2 py-0.5 rounded text-[10px]">Order Confirmed</span>
        </div>
        <div className="flex justify-between items-center text-xs pb-2 border-b border-white/10">
          <span className="text-white/70">Sentiment Score</span>
          <span className="font-mono text-[#34D399] font-bold">94% Positive</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-white/70">Warm Escalation</span>
          <span className="text-white/50">Not needed</span>
        </div>
      </div>
      <div className="bg-[#34D399]/10 border border-[#34D399]/20 rounded-xl p-3 flex items-center justify-between text-xs">
        <span className="text-white/80">Webhook Status</span>
        <span className="font-bold text-[#34D399]">Synced (0ms latency)</span>
      </div>
    </div>
  );
}

const PILLARS = [
  {
    id: "low-latency",
    title: "Low-Latency Engine",
    subtitle: "Under 180ms Response Latency",
    desc: "Achieve genuine sub-second latency and real-time conversation. Features natural-sounding voices, custom accent support, and advanced interruption handling or barge-in support.",
    icon: Clock,
    accent: "#059669",
    bg: "#D1FAE5",
    visual: LatencyVisual,
    keywords: ["real-time conversation", "sub-second latency", "low latency voice AI", "natural-sounding voices", "human-like phone conversations", "interruption handling", "barge-in support"]
  },
  {
    id: "workflows",
    title: "Dynamic Agent Workflows",
    subtitle: "Prompt-Based Calling Flow Node",
    desc: "Automate appointment booking, appointment scheduling, and lead qualification via calendar integration. Orchestrate complex calls with call routing and function tool calling.",
    icon: Cpu,
    accent: "#EA580C",
    bg: "#FEF3C7",
    visual: WorkflowVisual,
    keywords: ["appointment booking", "appointment scheduling", "lead qualification", "calendar integration", "call routing", "workflow automation", "function calling", "tool calling"]
  },
  {
    id: "security",
    title: "Compliance & Secure Voice AI",
    subtitle: "HIPAA & SOC 2 Ready",
    desc: "Rigorous compliance logging and audit logs. Built-in edge PII protection, GDPR compliance, PCI-DSS compliance, and secure ISO 27001 data redaction.",
    icon: ShieldCheck,
    accent: "#059669",
    bg: "#D1FAE5",
    visual: ComplianceVisual,
    keywords: ["compliance logging", "audit logs", "PII protection", "GDPR voice AI", "PCI compliant voice AI", "HIPAA compliant voice AI", "SOC 2 voice AI", "ISO 27001 voice AI", "data privacy voice automation"]
  },
  {
    id: "campaigns",
    title: "Outbound Campaign Engine",
    subtitle: "Launch Outbound Sales at Scale",
    desc: "Execute automated phone calling with intelligent retry logic and batch calling. Perfect for collections calls, renewal reminders, delivery notification calls, and no-show reduction.",
    icon: BarChart3,
    accent: "#EA580C",
    bg: "#FEF3C7",
    visual: OutboundVisual,
    keywords: ["automated phone calling", "retry logic", "batch calling", "collections calls", "renewal reminders", "delivery notification calls", "no-show reduction", "outbound sales calls"]
  },
  {
    id: "analytics",
    title: "Real-time Analytics & CRM Sync",
    subtitle: "Automate Call Logs & CRM Updates",
    desc: "Real-time call transcription, call summarization, sentiment analysis, and call scoring. Auto-disposition webhook integration & CRM integration.",
    icon: Database,
    accent: "#059669",
    bg: "#D1FAE5",
    visual: AnalyticsVisual,
    keywords: ["call transcription", "call summarization", "sentiment analysis", "call scoring", "CRM integration", "webhook integration", "API integration", "call disposition automation"]
  }
];

export default function FeatureCapabilityGrid() {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = PILLARS[activeIdx];
  const VisualComponent = current.visual;
  const isGreen = current.accent === "#059669";

  return (
    <div
      className="relative overflow-hidden rounded-[32px] border border-[#EADEC9]"
      style={{
        boxShadow: "0 24px 64px rgba(13,17,23,0.06), 0 0 0 1px rgba(234,222,201,0.4)"
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        {/* Left Side: Interactive Selector */}
        <div className="bg-[#FAF8F5] p-8 lg:p-12 space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Platform Core Modules</span>
            <h3 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Select Capability Pillar</h3>
          </div>
          <div className="space-y-3">
            {PILLARS.map((p, idx) => {
              const Icon = p.icon;
              const isActive = idx === activeIdx;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveIdx(idx)}
                  className="w-full text-left p-4.5 rounded-2xl transition-all flex items-start gap-4"
                  style={{
                    background: isActive ? "white" : "transparent",
                    border: isActive ? "1.5px solid #EADEC9" : "1.5px solid transparent",
                    boxShadow: isActive ? "0 4px 16px rgba(0,0,0,0.04)" : "none"
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isActive ? (p.accent === "#059669" ? "#D1FAE5" : "#FEF3C7") : "#F0ECE5"
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: isActive ? p.accent : "#9CA3AF" }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0D1117]">{p.title}</h4>
                    <p className="text-xs text-slate-500 mt-1">{p.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Showcase Preview Panel */}
        <div
          className="p-8 lg:p-12 text-white flex flex-col justify-between"
          style={{
            background: isGreen
              ? "linear-gradient(145deg, #0B1F14 0%, #112B1C 50%, #0A1F14 100%)"
              : "linear-gradient(145deg, #1C0D00 0%, #2D1200 50%, #150A00 100%)",
            borderLeft: "1px solid rgba(255,255,255,0.06)"
          }}
        >
          {/* Animated visual display */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIdx}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
              >
                <VisualComponent />
              </motion.div>
            </AnimatePresence>

            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="text-lg font-bold text-white font-sans">{current.title}</h3>
              <p className="text-xs text-white/60 leading-relaxed">{current.desc}</p>
            </div>
          </div>

          {/* Keywords covered banner */}
          <div className="pt-6">
            <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2 font-bold">Covered Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {current.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-[9px] font-mono uppercase font-semibold text-white/50 px-2 py-0.5 rounded border border-white/5 bg-white/5"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, Search, ChevronRight, Zap, Shield, Cpu, Phone,
  Bookmark, ArrowLeft, Clock, BarChart3, AlertCircle, Copy, Check
} from "lucide-react";

type Page = any;

interface VoiceAIIndexProps {
  setPage: (p: Page) => void;
}

// ── Categories & Article Topics list ──────────────────────────────────────────
const CATEGORIES = [
  {
    name: "Core Platforms",
    icon: Cpu,
    color: "#059669",
    topics: [
      { id: "ai-voice-calling-agents", title: "AI voice calling agents and robust AI voice agents" },
      { id: "high-performance-calling", title: "High-performance AI calling agents & voice AI agents" },
      { id: "scalable-phone-agents", title: "Scalable AI phone agents with conversational AI voice" },
      { id: "automated-phone-calling", title: "Fully automated phone calling & AI call automation" },
      { id: "professional-platform", title: "Professional voice automation platform" },
      { id: "smart-receptionist", title: "Smart AI receptionist & AI phone assistant" },
      { id: "integrated-calling", title: "Integrated AI outbound calling & AI inbound calling" },
      { id: "secure-contact-center", title: "Secure AI contact center automation" },
      { id: "custom-customer-calling", title: "Custom AI customer calling system" },
      { id: "robust-telephony", title: "Robust AI telephony automation" },
      { id: "natural-voice-bot", title: "Natural voice bot for calls" },
      { id: "high-fidelity-bot", title: "High-fidelity AI voice bot" },
      { id: "dedicated-call-agent", title: "Dedicated AI call center agent" },
      { id: "intelligent-call-handling", title: "Intelligent AI call handling" }
    ]
  },
  {
    name: "High-Intent Targets",
    icon: Zap,
    color: "#EA580C",
    topics: [
      { id: "best-voice-agents", title: "The best AI voice agents & best AI calling agents" },
      { id: "leading-platform", title: "Leading AI voice agent platform" },
      { id: "custom-voice-software", title: "Custom AI voice agent software" },
      { id: "enterprise-grade-agent", title: "Enterprise-grade enterprise AI voice agent" },
      { id: "developer-voice-platform", title: "Flexible developer voice AI platform" },
      { id: "no-code-voice-agent", title: "Easy-to-use no-code voice AI agent" },
      { id: "voice-agent-business", title: "Reliable AI voice agent for business" },
      { id: "voice-calling-software", title: "Powerful AI voice calling software" },
      { id: "voice-automation-software", title: "Complete AI voice automation software" },
      { id: "calling-platform", title: "Versatile AI calling platform" },
      { id: "outbound-voice-platform", title: "Complete outbound voice AI platform" },
      { id: "inbound-voice-platform", title: "Complete inbound voice AI platform" },
      { id: "voice-agent-api", title: "Developer AI voice agent API" },
      { id: "voice-ai-sdk", title: "Multi-platform voice AI SDK" },
      { id: "white-label-agent", title: "Deployable white-label AI voice agent" },
      { id: "custom-calling-agent", title: "Custom custom AI calling agent" },
      { id: "real-time-voice-ai", title: "Immersive real-time voice AI" },
      { id: "low-latency-voice-ai", title: "Ultra-low low-latency voice AI" },
      { id: "scalable-calling-platform", title: "Fully scalable voice calling platform" }
    ]
  },
  {
    name: "Compliance & Trust",
    icon: Shield,
    color: "#059669",
    topics: [
      { id: "voice-agent-compliance", title: "Strict AI voice agent compliance" },
      { id: "call-compliance-automation", title: "Secure call compliance automation" },
      { id: "secure-voice-ai", title: "Safe secure voice AI" },
      { id: "regulated-call-automation", title: "Secure regulated call automation" },
      { id: "pci-compliant-voice-ai", title: "Compliant PCI compliant voice AI" },
      { id: "hipaa-compliant-voice-ai", title: "Compliant HIPAA compliant voice AI" },
      { id: "soc2-voice-ai", title: "Compliant SOC 2 voice AI" },
      { id: "gdpr-voice-ai", title: "Audited GDPR voice AI" },
      { id: "iso27001-voice-ai", title: "Audited ISO 27001 voice AI" },
      { id: "data-privacy-automation", title: "Certified data privacy voice automation" },
      { id: "consent-based-calling", title: "Compliant consent-based calling" },
      { id: "audit-logs-redaction", title: "Clean audit logs & redaction" },
      { id: "pii-protection", title: "Safe PII protection" },
      { id: "escalation-logic", title: "Clear escalation logic" },
      { id: "human-handoff", title: "Seamless human handoff" },
      { id: "verified-call-scripts", title: "Safe verified call scripts" },
      { id: "compliance-ready-flows", title: "Compliant compliance-ready call flows" }
    ]
  },
  {
    name: "Technical Architecture",
    icon: Cpu,
    color: "#EA580C",
    topics: [
      { id: "telephony-voice-api", title: "Telephony voice AI API & telephony API" },
      { id: "built-in-asr", title: "Built-in speech-to-text (ASR)" },
      { id: "built-in-tts", title: "Built-in text-to-speech (TTS)" },
      { id: "llm-voice-agent", title: "High-performance LLM voice agent" },
      { id: "real-time-llm-calling", title: "Modern real-time LLM calling" },
      { id: "call-orchestration", title: "Precise AI call orchestration" },
      { id: "agent-workflow-engine", title: "Dynamic agent workflow engine" },
      { id: "prompt-based-flows", title: "Custom prompt-based call flows" },
      { id: "function-tool-calling", title: "Built-in function calling & tool calling" },
      { id: "rag-voice-agents", title: "Secure RAG for voice agents" },
      { id: "knowledge-base-calling", title: "Smart knowledge base calling" },
      { id: "crm-webhook-automation", title: "Direct CRM sync & webhook automation" },
      { id: "sip-twilio-integration", title: "Modern SIP trunking & Twilio integration" },
      { id: "contact-center-integration", title: "Secure contact center integration" },
      { id: "omnichannel-voice-stack", title: "Unified omnichannel voice stack" }
    ]
  },
  {
    name: "SEO Guides & Insights",
    icon: BookOpen,
    color: "#059669",
    topics: [
      { id: "how-voice-agents-work", title: "How AI voice agents work" },
      { id: "what-are-calling-agents", title: "What are AI voice calling agents?" },
      { id: "best-calling-agents-2026", title: "Best AI voice calling agents in 2026" },
      { id: "agents-outbound-sales", title: "AI voice agents for outbound sales" },
      { id: "agents-inbound-support", title: "AI voice agents for inbound support" },
      { id: "agents-appointment-booking", title: "AI voice agents for appointment booking" },
      { id: "agents-collections", title: "AI voice agents for collections" },
      { id: "agents-lead-qualification", title: "AI voice agents for lead qualification" },
      { id: "agents-healthcare", title: "AI voice agents for healthcare" },
      { id: "agents-banking-finance", title: "AI voice agents for banking and finance" },
      { id: "agents-real-estate", title: "AI voice agents for real estate teams" },
      { id: "agents-ecommerce", title: "AI voice agents for ecommerce brands" },
      { id: "agents-vs-ivr", title: "AI voice agents vs IVR systems" },
      { id: "agents-vs-human", title: "AI voice agents vs human call agents" },
      { id: "compliance-guide", title: "AI voice agent compliance guide" },
      { id: "reduce-handling-costs", title: "How to reduce call handling costs with voice AI" },
      { id: "set-up-phone-agent", title: "How to set up an AI phone agent" },
      { id: "integrate-crm", title: "How to integrate AI voice agents with CRM" },
      { id: "build-no-code-agent", title: "How to build a no-code voice agent" },
      { id: "latency-benchmarks", title: "Latency benchmarks for AI voice agents" },
      { id: "multilingual-use-cases", title: "Multilingual AI voice agent use cases" },
      { id: "white-label-model", title: "White-label AI voice agent business model" },
      { id: "pricing-explained", title: "AI voice agent pricing explained" },
      { id: "best-platforms", title: "Best platforms for voice automation" },
      { id: "improve-conversions", title: "How AI calling improves conversions" }
    ]
  }
];

// ── Dynamic Masterpiece Content Engine (500+ Words Generator) ──────────────────
function generateArticleContent(topicId: string, title: string, category: string) {
  // Extract key vocabulary terms based on the title
  const cleanTitle = title.replace(/[?&••]/g, "").trim();

  // Create highly realistic paragraphs
  const summary = `This detailed guide covers the strategic implementation, architecture, and business metrics for "${cleanTitle}". We explore how modern enterprises leverage this specific telephony capability to optimize customer communication pipelines, ensure high-fidelity call delivery, and maintain absolute compliance.`;

  const sections = [
    {
      subtitle: "1. Strategic Context & Market Positioning",
      paragraphs: [
        `In the rapidly evolving landscape of 2026, deploying a robust capability like "${cleanTitle}" has transitioned from a competitive advantage to an operational necessity. Legacy call center systems and traditional interactive voice response (IVR) setups have consistently failed to meet customer expectations, introducing latency, awkward pause loops, and rigid dial-tone scripts. By contrast, modern voice automation platform modules leverage state-of-the-art natural language processing (NLP) to converse fluently with users.`,
        `When enterprises evaluate the implementation of ${title.toLowerCase()}, they are not merely installing a software package; they are deploying an autonomous conversational AI voice system. This integration allows companies to scale inbound call handling capacity and outbound sales calls infinitely, bypassing the constraints of recruiting, training, and managing manual calling agents. Under this paradigm, operational costs plummet while customer satisfaction scores (CSAT) rise.`,
        `Furthermore, the strategic positioning of ${cleanTitle} within the broader AI customer calling system allows for precise data capture. Every interaction is transcribed with sub-second latency, structured into detailed summary fields, and fed directly back into operational workflows, ensuring a continuous loop of conversational intelligence and pipeline improvement.`
      ]
    },
    {
      subtitle: "2. Technical Implementation & Flow Architecture",
      paragraphs: [
        `From an engineering perspective, building an elite voice infrastructure for "${cleanTitle}" requires a vertically integrated pipeline. The voice stack is split into three core layers: Automatic Speech Recognition (ASR), Large Language Model orchestration (LLM), and Text-to-Speech synthesis (TTS). Chaining distinct API providers introduces a latency overhead of 800ms to 1.5s, which ruins conversational flow. Clarity Voice solves this by running a unified WebRTC audio pipeline directly connected to our agent workflow engine.`,
        `Below is a representative JSON configuration mapping the telephony API workflow parameters for deploying a custom voice AI agent:`
      ],
      code: `{
  "agent_id": "agent_clarity_voice_${topicId}",
  "voice_profile": {
    "provider": "clarity_native_multimodal",
    "voice_id": "premium_en_female_08",
    "pitch": 1.05,
    "cadence": 0.98,
    "languages": ["en-US", "hi-IN"]
  },
  "pipeline_settings": {
    "interruption_handling": {
      "enabled": true,
      "barge_in_threshold_ms": 150
    },
    "edge_pii_redaction": {
      "enabled": true,
      "scrub_rules": ["credit_card", "phone_number", "ssn", "phi"]
    }
  },
  "knowledge_base": {
    "retrieval_mode": "RAG_dense_vector",
    "kb_id": "kb_enterprise_profile_9021"
  }
}`
    },
    {
      subtitle: "3. Compliance, Security & Audit Logs",
      paragraphs: [
        `Regulated industries such as healthcare clinics, financial banking, and insurance carriers require absolute adherence to strict compliance guidelines. Deploying "${cleanTitle}" necessitates a security-first posture that integrates edge-based data redaction. Before any audio transcript or call recording is saved to a persistent database, the PII protection engine scrubs credit card numbers, personal health identifiers (PHI), and contact numbers.`,
        `This workflow maintains compatibility with SOC 2 Type II, HIPAA BAA, PCI-DSS compliance, and GDPR audit logging. Additionally, the system enforces consent-based calling protocols, matching contact records against National Do Not Call (DNC) registers and logging verified user consent signatures in real time, neutralizing legal risks before the call even initializes.`
      ]
    },
    {
      subtitle: "4. Business Impact & ROI Metrics",
      paragraphs: [
        `The operational return on investment for "${cleanTitle}" is measurable across multiple business dimensions. By automating outbound lead reactivation and inbound receptionist call workflows, businesses experience a substantial decrease in average handling cost (AHT) while driving down customer wait times to zero.`,
        `Typical metrics realized by enterprises utilizing this technology include:`
      ],
      bullets: [
        "First-Ring Response Rate: 100% call answering with 0s customer wait time.",
        "RTO Reduction: Up to 40% reduction in Cash-on-Delivery return-to-origin rates.",
        "No-Show Reduction: 89% lower appointment no-show rates via automated scheduling.",
        "Cost Deflection: 60% of tier-1 support queries handled without human escalation."
      ]
    }
  ];

  return { title: cleanTitle, category, readTime: "4 min read", summary, sections };
}

export default function VoiceAIIndex({ setPage }: VoiceAIIndexProps) {
  const [selectedTopicId, setSelectedTopicId] = useState("ai-voice-calling-agents");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Flatten topics for search and lookup
  const allTopics = useMemo(() => {
    return CATEGORIES.flatMap(cat =>
      cat.topics.map(t => ({
        ...t,
        category: cat.name,
        color: cat.color
      }))
    );
  }, []);

  const activeTopic = useMemo(() => {
    const found = allTopics.find(t => t.id === selectedTopicId) || allTopics[0];
    return generateArticleContent(found.id, found.title, found.category);
  }, [selectedTopicId, allTopics]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return CATEGORIES;
    return CATEGORIES.map(cat => ({
      ...cat,
      topics: cat.topics.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(cat => cat.topics.length > 0);
  }, [searchQuery]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-12" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Top Banner */}
      <div className="bg-[#1B4332] text-white py-12 px-6 border-b border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <button
              onClick={() => setPage("home")}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#34D399] uppercase tracking-widest mb-3 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </button>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Enterprise Voice AI Index & Book
            </h1>
            <p className="text-white/60 text-sm mt-1 max-w-xl">
              A comprehensive technical guide and glossary mapping the architecture, compliance, and deployment models of conversational voice AI agents in 2026.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Search 90 index topics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-[#34D399]/40 focus:border-[#34D399]/60 transition-all font-medium"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-10 items-start">
          
          {/* ── LEFT SIDEBAR: Table of Contents ── */}
          <div className="space-y-6 lg:sticky lg:top-24 max-h-[calc(100vh-140px)] overflow-y-auto pr-2 scrollbar-hide">
            <div className="bg-white border border-[#EADEC9] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-[#059669]">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs font-extrabold uppercase tracking-widest font-mono">Table of Contents</span>
              </div>
              <p className="text-[11px] text-slate-400">Select an index point below to read the detailed technical documentation.</p>
            </div>

            <div className="space-y-4">
              {filteredCategories.map((cat, idx) => {
                const Icon = cat.icon;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center gap-2 px-3 py-1">
                      <Icon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
                        {cat.name}
                      </span>
                      <span className="ml-auto text-[9px] font-mono font-bold bg-[#EADEC9]/30 text-slate-500 px-2 py-0.5 rounded-full">
                        {cat.topics.length}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {cat.topics.map(t => {
                        const isActive = t.id === selectedTopicId;
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setSelectedTopicId(t.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-3 ${
                              isActive
                                ? "bg-white border border-[#EADEC9] text-[#059669] shadow-sm font-bold"
                                : "text-slate-600 hover:bg-[#EADEC9]/20 hover:text-[#0D1117]"
                            }`}
                          >
                            <span className="truncate">{t.title}</span>
                            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isActive ? "translate-x-0.5 text-[#059669]" : "text-slate-400"}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT PANEL: Reading Pane ── */}
          <div className="space-y-8">
            <AnimatePresence mode="wait">
              <motion.article
                key={selectedTopicId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white border border-[#EADEC9] rounded-[32px] p-8 lg:p-12 shadow-sm space-y-8"
              >
                {/* Article Header info */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#D1FAE5] text-[#059669] border border-[#059669]/10 font-mono">
                      ✦ {activeTopic.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-mono">
                      <Clock className="w-3 h-3" /> {activeTopic.readTime}
                    </span>
                  </div>

                  <h2 className="text-[#0D1117] font-extrabold leading-tight text-3xl lg:text-4xl tracking-tight"
                    style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    {activeTopic.title}
                  </h2>
                </div>

                {/* Executive Summary Card */}
                <div className="bg-[#FAF8F5] border border-[#EADEC9] rounded-2xl p-5 flex items-start gap-4">
                  <AlertCircle className="w-5 h-5 text-[#059669] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-1">Executive Summary</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">{activeTopic.summary}</p>
                  </div>
                </div>

                {/* Sections loop */}
                <div className="space-y-8 text-sm text-slate-600 leading-relaxed font-light">
                  {activeTopic.sections.map((sec, sIdx) => (
                    <div key={sIdx} className="space-y-4">
                      <h3 className="text-base font-extrabold text-[#0D1117]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {sec.subtitle}
                      </h3>
                      {sec.paragraphs.map((p, pIdx) => (
                        <p key={pIdx}>{p}</p>
                      ))}

                      {/* Code Block if exists */}
                      {sec.code && (
                        <div className="relative rounded-2xl bg-[#0B1F14] border border-white/10 p-5 mt-4 font-mono text-[11px] text-[#A7F3D0] overflow-x-auto">
                          <button
                            onClick={() => copyToClipboard(sec.code)}
                            className="absolute right-4 top-4 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-colors"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Copy className="w-3.5 h-3.5 text-white/60" />}
                          </button>
                          <pre>{sec.code}</pre>
                        </div>
                      )}

                      {/* Bullets if exist */}
                      {sec.bullets && (
                        <ul className="space-y-3.5 pt-2 pl-2">
                          {sec.bullets.map((b, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-3 text-xs font-medium text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] mt-1.5 flex-shrink-0" />
                              <span className="leading-relaxed">{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {/* Article Footer CTA banner */}
                <div className="pt-8 border-t border-[#EADEC9] flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-[#0D1117]">Want to implement this voice workflow?</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Deploy this specific agent model on our no-code platform in under 10 minutes.</p>
                  </div>
                  <button
                    onClick={() => setPage("dashboard")}
                    className="btn-primary text-xs py-2.5 px-5 whitespace-nowrap flex items-center gap-2"
                  >
                    Deploy This Agent Now
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </motion.article>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
}

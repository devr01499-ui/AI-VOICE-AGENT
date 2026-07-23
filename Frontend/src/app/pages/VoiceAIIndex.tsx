import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, Search, ChevronRight, ChevronLeft, Bookmark, Clock, ArrowRight, ArrowLeft, Copy, Check
} from "lucide-react";

type Page = any;

interface VoiceAIIndexProps {
  setPage: (p: Page) => void;
}

// ── Categories & Article Topics list ──────────────────────────────────────────
const CATEGORIES = [
  {
    name: "Core Platforms",
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

// ── Flattening with Chapter and Topic Numbers ──────────────────────────────────
const ALL_TOPICS = CATEGORIES.flatMap((cat, cIdx) => 
  cat.topics.map((t, tIdx) => ({
    ...t,
    category: cat.name,
    chapterNumber: cIdx + 1,
    topicNumber: tIdx + 1,
    displayNumber: `${cIdx + 1}.${tIdx + 1}`,
    indexNumber: cIdx * 100 + tIdx // useful for previous/next sorting
  }))
);

// ── Dynamic Masterpiece Content Engine (500+ Words Generator) ──────────────────
function generateArticleContent(topicId: string, title: string, category: string, chapNum: number, topNum: number) {
  const cleanTitle = title.replace(/[?&]/g, "").trim();
  const summary = `This detailed guide covers the strategic implementation, architecture, and business metrics for "${cleanTitle}". We explore how modern enterprises leverage this capability to optimize customer pipelines, ensure high-fidelity delivery, and maintain compliance.`;

  const sections = [
    {
      subtitle: "Strategic Context & Market Positioning",
      paragraphs: [
        `In the rapidly evolving landscape of 2026, deploying a robust capability like "${cleanTitle}" has transitioned from a competitive advantage to an operational necessity. Legacy call center systems and traditional interactive voice response (IVR) setups have consistently failed to meet customer expectations, introducing latency, awkward pause loops, and rigid dial-tone scripts. By contrast, modern voice automation platform modules leverage state-of-the-art natural language processing (NLP) to converse fluently with users.`,
        `When enterprises evaluate the implementation of ${cleanTitle.toLowerCase()}, they are not merely installing a software package; they are deploying an autonomous conversational AI voice system. This integration allows companies to scale inbound call handling capacity and outbound sales calls infinitely, bypassing the constraints of recruiting, training, and managing manual calling agents. Under this paradigm, operational costs plummet while customer satisfaction scores (CSAT) rise.`,
        `Furthermore, the strategic positioning of this capability within the broader AI customer calling system allows for precise data capture. Every interaction is transcribed with sub-second latency, structured into detailed summary fields, and fed directly back into operational workflows, ensuring a continuous loop of conversational intelligence and pipeline improvement.`
      ]
    },
    {
      subtitle: "Technical Implementation & Flow Architecture",
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
      "scrub_rules": ["credit_card", "phone_number", "phi"]
    }
  }
}`
    },
    {
      subtitle: "Compliance, Security & Audit Logs",
      paragraphs: [
        `Regulated industries such as healthcare clinics, financial banking, and insurance carriers require absolute adherence to strict compliance guidelines. Deploying "${cleanTitle}" necessitates a security-first posture that integrates edge-based data redaction. Before any audio transcript or call recording is saved to a persistent database, the PII protection engine scrubs credit card numbers, personal health identifiers (PHI), and contact numbers.`,
        `This workflow maintains compatibility with SOC 2 Type II, HIPAA BAA, PCI-DSS compliance, and GDPR audit logging. Additionally, the system enforces consent-based calling protocols, matching contact records against National Do Not Call (DNC) registers and logging verified user consent signatures in real time, neutralizing legal risks before the call even initializes.`
      ]
    },
    {
      subtitle: "Business Impact & ROI Metrics",
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

  return { title: cleanTitle, category, chapNum, topNum, summary, sections };
}

export default function VoiceAIIndex({ setPage }: VoiceAIIndexProps) {
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [direction, setDirection] = useState(1);

  const activeTopicObj = ALL_TOPICS[currentTopicIndex];
  const activeTopic = useMemo(() => {
    return generateArticleContent(
      activeTopicObj.id, 
      activeTopicObj.title, 
      activeTopicObj.category, 
      activeTopicObj.chapterNumber, 
      activeTopicObj.topicNumber
    );
  }, [activeTopicObj]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = () => {
    if (currentTopicIndex < ALL_TOPICS.length - 1) {
      setDirection(1);
      setCurrentTopicIndex(prev => prev + 1);
      // scroll to top of reading pane
      const pane = document.getElementById("reading-pane");
      if (pane) pane.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrev = () => {
    if (currentTopicIndex > 0) {
      setDirection(-1);
      setCurrentTopicIndex(prev => prev - 1);
      const pane = document.getElementById("reading-pane");
      if (pane) pane.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToTopic = (index: number) => {
    setDirection(index > currentTopicIndex ? 1 : -1);
    setCurrentTopicIndex(index);
    const pane = document.getElementById("reading-pane");
    if (pane) pane.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#1E293B] relative overflow-hidden flex flex-col font-sans">
      {/* Dark background texture */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
      
      {/* Navbar overlay specifically for the book view */}
      <div className="relative z-20 flex justify-between items-center px-8 py-4 bg-black/20 backdrop-blur-md border-b border-white/10">
        <button
          onClick={() => setPage("home")}
          className="inline-flex items-center gap-2 text-xs font-bold text-white uppercase tracking-widest hover:text-[#34D399] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Book
        </button>
        <div className="text-white/60 text-xs font-mono tracking-widest uppercase">
          Clarity Voice Architecture Index (2026)
        </div>
      </div>

      {/* Book Container */}
      <div className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12 flex items-center justify-center">
        
        {/* The Open Book */}
        <div className="w-full h-[80vh] md:h-[85vh] bg-[#FDFBF7] rounded-sm md:rounded-lg shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5),inset_0_0_80px_rgba(0,0,0,0.05)] flex flex-col md:flex-row relative overflow-hidden">
          
          {/* Book Spine Shadow Overlay */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-12 -ml-6 bg-gradient-to-r from-transparent via-black/10 to-transparent pointer-events-none z-30" />
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-black/10 pointer-events-none z-30" />
          
          {/* ── LEFT PAGE: Table of Contents ── */}
          <div className="w-full md:w-1/2 h-full border-b md:border-b-0 md:border-r border-[#EADEC9] bg-[#FDFBF7] flex flex-col relative">
            {/* Paper Texture */}
            <div className="absolute inset-0 opacity-30 mix-blend-multiply pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cream-paper.png')" }} />
            
            <div className="px-8 py-10 border-b border-[#EADEC9] relative z-10 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-[#2A2A2A]" style={{ fontFamily: "'Playfair Display', serif" }}>
                Index
              </h2>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white/50 border border-[#EADEC9] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#2A2A2A] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#059669] transition-all font-sans"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 relative z-10 scrollbar-hide">
              <div className="space-y-10">
                {CATEGORIES.map((cat, cIdx) => {
                  const chapterNum = cIdx + 1;
                  const topics = cat.topics.filter(t => 
                    t.title.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (topics.length === 0) return null;

                  return (
                    <div key={cIdx} className="space-y-4">
                      <div className="flex items-baseline gap-3">
                        <span className="text-[#059669] font-bold font-sans text-xs uppercase tracking-widest">
                          Chapter {chapterNum}
                        </span>
                        <h3 className="text-xl font-bold text-[#2A2A2A] border-b border-[#EADEC9] flex-1 pb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                          {cat.name}
                        </h3>
                      </div>

                      <div className="space-y-2.5 pl-2">
                        {topics.map(t => {
                          const flatIndex = ALL_TOPICS.findIndex(x => x.id === t.id);
                          const isActive = flatIndex === currentTopicIndex;
                          const tIndex = cat.topics.findIndex(x => x.id === t.id) + 1;
                          
                          return (
                            <div 
                              key={t.id} 
                              onClick={() => goToTopic(flatIndex)}
                              className={`group flex items-end justify-between cursor-pointer ${isActive ? "text-[#059669]" : "text-[#4A4A4A] hover:text-[#059669]"}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`font-mono text-xs font-semibold ${isActive ? "text-[#059669]" : "text-slate-400"}`}>
                                  {chapterNum}.{tIndex}
                                </span>
                                <span className={`text-sm ${isActive ? "font-bold" : "font-medium"} transition-colors`} style={{ fontFamily: isActive ? "'Playfair Display', serif" : "sans-serif" }}>
                                  {t.title}
                                </span>
                              </div>
                              {/* Dotted line leader */}
                              <div className="flex-1 border-b-[1.5px] border-dotted border-[#EADEC9] mx-4 mb-1.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                              <span className="font-mono text-[10px] font-bold text-slate-400">P.{flatIndex + 1}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT PAGE: Reading Pane ── */}
          <div className="w-full md:w-1/2 h-full bg-[#FDFBF7] flex flex-col relative">
            {/* Paper Texture */}
            <div className="absolute inset-0 opacity-30 mix-blend-multiply pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cream-paper.png')" }} />
            
            {/* Top Page Header */}
            <div className="h-16 flex items-center justify-between px-10 relative z-10 border-b border-transparent">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                Chapter {activeTopic.chapNum} — {activeTopic.category}
              </span>
              <Bookmark className="w-4 h-4 text-[#059669] opacity-50" />
            </div>

            <div id="reading-pane" className="flex-1 overflow-y-auto px-10 pb-10 relative z-10 scrollbar-hide">
              <AnimatePresence mode="wait">
                <motion.article
                  key={activeTopic.topNum + "-" + activeTopic.chapNum}
                  initial={{ opacity: 0, x: direction * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -direction * 20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="space-y-6"
                >
                  <div className="space-y-4 mb-8">
                    <h1 className="text-4xl text-[#1A1A1A] font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                      <span className="block text-xl text-slate-400 font-normal mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Topic {activeTopic.chapNum}.{activeTopic.topNum}
                      </span>
                      {activeTopic.title}
                    </h1>
                    <p className="text-sm text-[#4A4A4A] italic leading-relaxed" style={{ fontFamily: "'Georgia', serif" }}>
                      {activeTopic.summary}
                    </p>
                  </div>

                  {activeTopic.sections.map((sec, sIdx) => (
                    <div key={sIdx} className="space-y-4 mb-8">
                      <h3 className="text-lg font-bold text-[#2A2A2A] border-b border-[#EADEC9] pb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {sec.subtitle}
                      </h3>
                      {sec.paragraphs.map((p, pIdx) => (
                        <p key={pIdx} className="text-[15px] text-[#333333] leading-[1.8] text-justify" style={{ fontFamily: "'Georgia', serif" }}>
                          {p}
                        </p>
                      ))}

                      {sec.code && (
                        <div className="relative rounded-md bg-[#F4F1EA] border border-[#EADEC9] p-5 my-4 font-mono text-[11px] text-[#2A2A2A] overflow-x-auto shadow-inner">
                          <button
                            onClick={() => copyToClipboard(sec.code)}
                            className="absolute right-3 top-3 w-6 h-6 rounded bg-white hover:bg-slate-50 flex items-center justify-center border border-[#EADEC9] transition-colors shadow-sm"
                          >
                            {copied ? <Check className="w-3 h-3 text-[#059669]" /> : <Copy className="w-3 h-3 text-slate-500" />}
                          </button>
                          <pre>{sec.code}</pre>
                        </div>
                      )}

                      {sec.bullets && (
                        <ul className="space-y-2.5 pt-2 pl-4">
                          {sec.bullets.map((b, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-3 text-[14px] text-[#333333] leading-[1.7]" style={{ fontFamily: "'Georgia', serif" }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] mt-2 flex-shrink-0 opacity-70" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {/* End of article marker */}
                  <div className="flex justify-center py-6 opacity-30">
                    <div className="flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    </div>
                  </div>
                </motion.article>
              </AnimatePresence>
            </div>

            {/* Bottom Page Footer with Navigation */}
            <div className="h-20 border-t border-[#EADEC9] flex flex-col justify-center px-10 relative z-10 bg-gradient-to-t from-[#FDFBF7] to-transparent">
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={handlePrev}
                  disabled={currentTopicIndex === 0}
                  className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${
                    currentTopicIndex === 0 ? "text-slate-300 cursor-not-allowed" : "text-[#059669] hover:text-[#047857]"
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" /> Prev Page
                </button>
                
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  PAGE {currentTopicIndex + 1} OF {ALL_TOPICS.length}
                </span>

                <button
                  onClick={handleNext}
                  disabled={currentTopicIndex === ALL_TOPICS.length - 1}
                  className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${
                    currentTopicIndex === ALL_TOPICS.length - 1 ? "text-slate-300 cursor-not-allowed" : "text-[#059669] hover:text-[#047857]"
                  }`}
                >
                  Next Page <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}


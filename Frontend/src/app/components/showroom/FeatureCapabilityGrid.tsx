import { motion } from "motion/react";
import { 
  Clock, 
  MessageSquareX, 
  PhoneForwarded, 
  Database, 
  BarChart3, 
  Cpu, 
  Radio, 
  Languages, 
  RotateCcw, 
  ShieldAlert, 
  Webhook, 
  Mic2 
} from "lucide-react";

export const FEATURE_CARDS = [
  {
    id: "low-latency",
    title: "Real-Time Conversation & Sub-180ms Latency",
    icon: Clock,
    badge: "Native Multimodal",
    description: "Sub-180ms response speed powered by vertically integrated audio models. Eliminates awkward pauses and robotic delays."
  },
  {
    id: "barge-in",
    title: "Interruption & Barge-In Support",
    icon: MessageSquareX,
    badge: "Full-Duplex Audio",
    description: "Callers can interrupt the AI mid-sentence naturally. The voice agent immediately stops speaking, processes the input, and responds seamlessly."
  },
  {
    id: "warm-transfer",
    title: "Call Transfer & Warm Handoff",
    icon: PhoneForwarded,
    badge: "Human Escalation",
    description: "Smart escalation logic that transfers calls to human operators or support desks along with live transcript context."
  },
  {
    id: "rag-kb",
    title: "RAG Knowledge Base Calling",
    icon: Database,
    badge: "Real-Time Retrieval",
    description: "Attach PDF manuals, product documentation, website URLs, and database queries for 100% accurate, hallucination-free answers."
  },
  {
    id: "summarization",
    title: "Call Summarization & Sentiment Analysis",
    icon: BarChart3,
    badge: "Automated Post-Call",
    description: "Automated post-call disposition logging, key phrase extraction, sentiment scoring, and instant transcription indexing."
  },
  {
    id: "workflow-engine",
    title: "Prompt-Based Agent Workflow Engine",
    icon: Cpu,
    badge: "Function Calling",
    description: "Custom tool calling, dynamic branching logic, and real-time execution of external APIs while live on the call."
  },
  {
    id: "omnichannel-telephony",
    title: "Omnichannel Telephony & SIP Trunking",
    icon: Radio,
    badge: "Twilio / Custom SIP",
    description: "Connect native PSTN numbers, Twilio trunks, or custom enterprise SIP endpoints with crystal-clear WebRTC audio streaming."
  },
  {
    id: "multilingual-dialects",
    title: "Multilingual & Accent Support",
    icon: Languages,
    badge: "70+ Dialects",
    description: "Native speech recognition and synthesis across 70+ languages, including Indian regional dialects (Hindi, Bengali, Gujarati, Marathi, Tamil)."
  },
  {
    id: "batch-calling",
    title: "Batch Calling & Smart Retry Logic",
    icon: RotateCcw,
    badge: "Automated Campaigns",
    description: "Launch 10,000+ simultaneous outbound call campaigns with intelligent retry schedules for busy lines or unanswered calls."
  },
  {
    id: "compliance-redaction",
    title: "Compliance & Audit Logging",
    icon: ShieldAlert,
    badge: "Data Redaction at Edge",
    description: "Edge-based PII/PHI redaction, PCI-DSS, SOC 2 Type II, HIPAA, and GDPR audit logging before transcript persistence."
  },
  {
    id: "crm-webhooks",
    title: "CRM & Webhook Automation",
    icon: Webhook,
    badge: "2-Way Real-Time Sync",
    description: "Bi-directional real-time sync with Salesforce, HubSpot, Shopify, Shiprocket, and custom backend REST webhooks."
  },
  {
    id: "voice-cloning",
    title: "Voice Cloning & Custom Personas",
    icon: Mic2,
    badge: "5-Second Clone",
    description: "Synthesize branded voice personas with 5-second audio samples. Customize pitch, emotion, cadence, and vocabulary."
  }
];

export default function FeatureCapabilityGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {FEATURE_CARDS.map((card, idx) => {
        const IconComponent = card.icon;
        const isGreen = idx % 2 === 0;
        const accent = isGreen ? "#059669" : "#EA580C";
        const bg = isGreen ? "#D1FAE5" : "#FEF3C7";
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: idx * 0.04 }}
            whileHover={{ y: -4 }}
            className="group relative bg-white border border-[#EADEC9] rounded-3xl p-7 flex flex-col justify-between overflow-hidden transition-all"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"
              style={{ background: `linear-gradient(135deg, ${isGreen ? "rgba(209,250,229,0.35)" : "rgba(254,243,199,0.45)"} 0%, transparent 60%)` }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110" style={{ background: bg }}>
                  <IconComponent className="w-6 h-6" style={{ color: accent }} />
                </div>
                <span
                  className="text-[9px] font-extrabold uppercase tracking-[0.15em] px-3 py-1 rounded-full font-mono"
                  style={{ background: bg, color: accent, border: `1px solid ${accent}30` }}
                >
                  {card.badge}
                </span>
              </div>
              <h3
                className="text-lg font-extrabold text-[#0F172A] mb-2.5 group-hover:text-[#059669] transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {card.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {card.description}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

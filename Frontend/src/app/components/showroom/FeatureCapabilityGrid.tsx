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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {FEATURE_CARDS.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.05 }}
            className="bg-surface-white border border border-[#EADEC9] rounded-2xl p-8 shadow-level-2 hover:shadow-level-4 hover:border-mint-primary/40 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-cta/10 flex items-center justify-center text-amber-cta group-hover:bg-amber-cta group-hover:text-white transition-colors">
                  <IconComponent className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-cta uppercase tracking-widest bg-amber-cta/10 border border-amber-cta/20 px-3 py-1 rounded-full">
                  {card.badge}
                </span>
              </div>
              <h3 className="font-sora text-xl font-bold text-ink mb-3 group-hover:text-amber-cta transition-colors">
                {card.title}
              </h3>
              <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">
                {card.description}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

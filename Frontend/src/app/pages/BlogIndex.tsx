import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Clock, User, Tag } from "lucide-react";

type Page = any;

interface BlogIndexProps {
  setPage: (p: Page) => void;
}

const ARTICLES = [
  {
    id: "buyer-guide-2026",
    title: "Best AI Voice Calling Agents in 2026: An Enterprise Buyer's Guide",
    date: "July 20, 2026",
    author: "Clarity Voice Research Team",
    category: "Buyer Guide",
    readTime: "12 min read",
    content: `Selecting an enterprise AI voice agent platform requires evaluating total cost of ownership, speech recognition accuracy across regional accents, response latency parameters, and telephony reliability.

This comprehensive guide compares leading voice AI platforms—including Clarity Voice, Retell AI, Vapi, ElevenLabs, Bland AI, and Bolna—across key architectural criteria.

### Key Evaluation Criteria
1. **Response Latency**: Human speech flow breaks down when system delay exceeds 300ms. Platforms utilizing native WebRTC multimodal streaming achieve sub-180ms responses, outperforming chained API architectures.
2. **Pricing Transparency**: Look out for hidden vendor fees. Platforms charging separate line items for ASR, LLM tokens, and neural TTS increase total cost per minute significantly compared to flat-rate bundled plans.
3. **Regional Dialect Support**: For global and Indian markets, native speech models comprehension across 70+ dialects (such as Hindi, Marathi, Gujarati, Bengali, and Kannada) is critical for high conversion.`
  },
  {
    id: "cod-rto-reduction",
    title: "How Indian D2C Brands Cut COD RTO Rates by 40% Using Automated AI Voice Calls",
    date: "July 18, 2026",
    author: "Logistics Engineering Dept",
    category: "E-Commerce",
    readTime: "10 min read",
    content: `Cash-on-Delivery (COD) accounts for up to 70% of e-commerce transactions in India, but unverified orders suffer from a 30% Return-to-Origin (RTO) rate.

Deploying automated AI voice confirmation calls within 60 seconds of checkout allows brands to verify delivery address landmarks, confirm buyer intent, and offer pre-dispatch prepaid conversion incentives. This single automated workflow cuts RTO rates by up to 40%.`
  },
  {
    id: "low-latency-multimodal",
    title: "Understanding Low-Latency Voice AI: Native Multimodal Audio vs. Chained API Pipelines",
    date: "July 15, 2026",
    author: "Infrastructure Core Team",
    category: "Engineering",
    readTime: "14 min read",
    content: `Chaining Speech-to-Text (STT) to large language models (LLM) and Text-to-Speech (TTS) introduces significant HTTP latency.

This deep technical guide explains how native WebRTC zero-copy audio pipelines eliminate intermediary text translations to deliver fluid sub-180ms conversational speech.`
  },
  {
    id: "clinic-patient-intake",
    title: "Automating Clinic Patient Intake: A HIPAA-Compliant Guide to AI Voice Receptionists",
    date: "July 12, 2026",
    author: "Dr. Elena Rostova",
    category: "Healthcare",
    readTime: "9 min read",
    content: `Healthcare clinic reception desks face constant phone call queues for scheduling, pre-procedure prep, and intake.

AI voice receptionists answer calls on the first ring, schedule appointments directly into EHR software (Epic, Cerner), and enforce strict HIPAA Data Redaction at Edge.`
  },
  {
    id: "real-estate-lead-qualification",
    title: "How Real Estate Teams Qualify 10,000+ Inbound Leads Monthly Without Scaling Call Centers",
    date: "July 08, 2026",
    author: "Real Estate Growth Group",
    category: "Real Estate",
    readTime: "8 min read",
    content: `Speed-to-lead dictates real estate conversion. Contacting web leads within 3 seconds yields a 94% contact rate.

AI voice agents place immediate qualification calls, check buyer budget criteria, and book site visits directly onto broker calendars.`
  },
  {
    id: "ethical-emi-collections",
    title: "Ethical EMI & Debt Collection: How Conversational AI Improves Recovery Rates While Preserving Trust",
    date: "July 05, 2026",
    author: "Fintech Risk Operations",
    category: "Finance",
    readTime: "11 min read",
    content: `Traditional debt recovery outreach causes high customer friction and regulatory risk.

Conversational AI voice agents maintain polite, non-judgmental dialogue, negotiate pre-approved EMI payment schedules, and send secure SMS payment links in real time.`
  },
  {
    id: "voice-ai-compliance-guide",
    title: "AI Voice Agent Compliance Guide: SOC 2, HIPAA, GDPR, and DPDP Act Standards Explained",
    date: "July 01, 2026",
    author: "Security & Legal Counsel",
    category: "Compliance",
    readTime: "13 min read",
    content: `Deploying AI voice agents in regulated industries demands robust data protection.

Learn how edge-based PII/PHI redaction, ISO 27001 protocols, and DPDP Act 2023 compliance safeguard customer audio logs.`
  },
  {
    id: "regional-dialect-ai",
    title: "Overcoming Language Barriers in Tier-2 and Tier-3 Indian Markets Using Regional Dialect AI",
    date: "June 25, 2026",
    author: "Linguistics Research Lab",
    category: "AI Models",
    readTime: "10 min read",
    content: `Reaching consumers across Tier-2 and Tier-3 Indian cities requires localized dialect comprehension.

Clarity Voice models natively process Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, and Kannada with zero translation loss.`
  },
  {
    id: "full-duplex-barge-in",
    title: "Why Full-Duplex Interruption Handling and Barge-In Support Are Mandatory for Voice AI",
    date: "June 20, 2026",
    author: "Telecom Stack Lead",
    category: "Technology",
    readTime: "7 min read",
    content: `Human conversations involve frequent interruptions. If a voice bot cannot handle barge-in, conversations breakdown into awkward collisions.

Explore full-duplex DSP audio processing for natural voice interruption handling.`
  },
  {
    id: "end-of-ivr-systems",
    title: "2026 Telephony Trends: Why Traditional IVR Systems Are Being Replaced by Conversational Voice Agents",
    date: "June 15, 2026",
    author: "CX Strategy Team",
    category: "Enterprise CX",
    readTime: "9 min read",
    content: `Push-button IVR phone menus generate high call abandonment and negative customer satisfaction.

Discover how conversational voice AI agents replace phone trees with immediate, natural dialogue.`
  }
];

export default function BlogIndex({ setPage }: BlogIndexProps) {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);

  const activeArticle = ARTICLES.find(a => a.id === activeArticleId);

  if (activeArticle) {
    return (
      <div className="pt-32 px-6 max-w-4xl mx-auto pb-32 min-h-screen bg-cream-bg">
        <button 
          onClick={() => setActiveArticleId(null)}
          className="flex items-center gap-2 text-small font-bold text-ink-muted hover:text-mint-primary mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Insights Hub
        </button>

        <motion.article 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 bg-surface-white border border-[#EADEC9] p-10 md:p-14 rounded-3xl shadow-level-2"
        >
          <div className="space-y-4">
            <span className="text-caption font-bold text-mint-primary tracking-widest uppercase bg-mint-soft px-3 py-1 rounded-full font-mono">
              {activeArticle.category}
            </span>
            <h1 className="font-sora text-3xl md:text-5xl font-extrabold text-ink leading-tight">{activeArticle.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-small font-bold text-ink-muted border-t border-b border-border-soft py-4 my-8 font-mono">
              <div className="flex items-center gap-2"><User className="w-4 h-4 text-mint-primary" /> {activeArticle.author}</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-cta" /> {activeArticle.date}</div>
              <div className="flex items-center gap-2"><Tag className="w-4 h-4 text-mint-primary" /> {activeArticle.readTime}</div>
            </div>
          </div>

          <div className="prose prose-lg text-ink-muted whitespace-pre-wrap font-plus-jakarta text-body leading-relaxed space-y-6">
            {activeArticle.content}
          </div>

          <div className="mt-16 bg-mint-soft/30 border border-mint-primary/20 rounded-2xl p-8 text-center space-y-4">
            <h3 className="font-sora text-2xl font-bold text-ink">Ready to automate your enterprise phone operations?</h3>
            <p className="text-body text-ink-muted mb-4">Deploy human-like voice AI agents in under 10 minutes.</p>
            <button onClick={() => setPage("dashboard")} className="btn-primary">
              Build Your Agent Now
            </button>
          </div>
        </motion.article>
      </div>
    );
  }

  return (
    <div className="pt-32 px-6 max-w-7xl mx-auto pb-32 min-h-screen bg-cream-bg space-y-16">
      <div className="text-center space-y-4">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
          ENTERPRISE KNOWLEDGE HUB
        </span>
        <h1 className="font-sora text-4xl md:text-6xl font-extrabold text-ink">Clarity Voice Insights & Research</h1>
        <p className="text-body text-ink-muted max-w-2xl mx-auto font-plus-jakarta">
          Deep-dive technical guides, buyer frameworks, and operational strategies for scaling voice AI automation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {ARTICLES.map((article, idx) => (
          <motion.div 
            key={article.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => setActiveArticleId(article.id)}
            className="bg-surface-white border border-[#EADEC9] rounded-2xl p-8 shadow-level-1 hover:shadow-level-3 hover:border-mint-primary/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <span className="text-[10px] font-mono font-bold text-mint-primary tracking-widest uppercase mb-4 block">
                {article.category}
              </span>
              <h3 className="font-sora text-xl font-bold text-ink group-hover:text-mint-primary transition-colors mb-4 line-clamp-2">
                {article.title}
              </h3>
              <p className="text-small text-ink-muted line-clamp-3 mb-6 font-plus-jakarta leading-relaxed">
                {article.content.substring(0, 140)}...
              </p>
            </div>
            <div className="flex items-center justify-between text-caption font-bold text-ink-muted pt-4 border-t border-border-soft font-mono">
              <span>{article.date}</span>
              <span>{article.readTime}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

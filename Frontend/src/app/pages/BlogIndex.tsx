import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, Clock, User, Tag, Sparkles, BookOpen, 
  ArrowRight, Search, CheckCircle2, Send
} from "lucide-react";

type Page = any;

interface BlogIndexProps {
  setPage: (p: Page) => void;
}

const CATEGORIES = ["All", "Buyer Guide", "E-Commerce", "Engineering", "Healthcare", "Real Estate", "Finance", "Compliance"];

const ARTICLES = [
  {
    id: "buyer-guide-2026",
    title: "Best AI Voice Calling Agents in 2026: An Enterprise Buyer's Guide",
    date: "July 20, 2026",
    author: "Claritiy Voice Research Team",
    category: "Buyer Guide",
    readTime: "12 min read",
    featured: true,
    excerpt: "Selecting an enterprise AI voice agent platform requires evaluating total cost of ownership, speech recognition accuracy across regional accents, response latency parameters, and telephony reliability.",
    content: `Selecting an enterprise AI voice agent platform requires evaluating total cost of ownership, speech recognition accuracy across regional accents, response latency parameters, and telephony reliability.

This comprehensive guide evaluates enterprise voice AI architectures, comparing native WebRTC zero-copy audio streaming against multi-vendor chained API pipelines across latency, cost transparency, and regional dialect comprehension.

### Key Evaluation Criteria

1. **Response Latency**: Human speech flow breaks down when system delay exceeds 300ms. Platforms utilizing native WebRTC multimodal streaming achieve sub-180ms responses, outperforming chained API architectures.
2. **Pricing Transparency**: Look out for hidden vendor fees. Platforms charging separate line items for ASR, LLM tokens, and neural TTS increase total cost per minute significantly compared to flat-rate bundled plans.
3. **Regional Dialect Support**: For global and Indian markets, native speech models comprehension across 70+ dialects (such as Hindi, Marathi, Gujarati, Bengali, and Kannada) is critical for high conversion.
4. **Barge-In & Interruption DSP**: Real-world phone calls involve frequent interruptions. Full-duplex DSP audio stack allows immediate cancellation of agent audio when callers speak.`
  },
  {
    id: "cod-rto-reduction",
    title: "How Indian D2C Brands Cut COD RTO Rates by 40% Using Automated AI Voice Calls",
    date: "July 18, 2026",
    author: "Logistics Engineering Dept",
    category: "E-Commerce",
    readTime: "10 min read",
    featured: false,
    excerpt: "Cash-on-Delivery (COD) accounts for up to 70% of e-commerce transactions in India, but unverified orders suffer from a 30% Return-to-Origin (RTO) rate.",
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
    featured: false,
    excerpt: "Chaining Speech-to-Text (STT) to large language models (LLM) and Text-to-Speech (TTS) introduces significant HTTP latency.",
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
    featured: false,
    excerpt: "Healthcare clinic reception desks face constant phone call queues for scheduling, pre-procedure prep, and intake.",
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
    featured: false,
    excerpt: "Speed-to-lead dictates real estate conversion. Contacting web leads within 3 seconds yields a 94% contact rate.",
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
    featured: false,
    excerpt: "Traditional debt recovery outreach causes high customer friction and regulatory risk.",
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
    featured: false,
    excerpt: "Deploying AI voice agents in regulated industries demands robust data protection.",
    content: `Deploying AI voice agents in regulated industries demands robust data protection.

Learn how edge-based PII/PHI redaction, ISO 27001 protocols, and DPDP Act 2023 compliance safeguard customer audio logs.`
  }
];

export default function BlogIndex({ setPage }: BlogIndexProps) {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const activeArticle = ARTICLES.find(a => a.id === activeArticleId);

  const filteredArticles = selectedCategory === "All" 
    ? ARTICLES 
    : ARTICLES.filter(a => a.category === selectedCategory);

  const featuredArticle = ARTICLES.find(a => a.featured) || ARTICLES[0];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail) {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 5000);
      setNewsletterEmail("");
    }
  };

  if (activeArticle) {
    return (
      <div className="pt-28 px-6 max-w-4xl mx-auto pb-32 min-h-screen bg-[#FFFDF9]">
        <button 
          onClick={() => setActiveArticleId(null)}
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 hover:text-emerald-700 mb-8 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Enterprise Knowledge Hub
        </button>

        <motion.article 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#EADEC9] p-8 md:p-14 rounded-3xl shadow-xl space-y-8"
        >
          <div className="space-y-4">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-mono font-bold border border-emerald-200 uppercase tracking-wider">
              {activeArticle.category}
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {activeArticle.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-slate-500 border-t border-b border-slate-100 py-4 my-6">
              <div className="flex items-center gap-2 text-slate-700 font-bold">
                <User className="w-4 h-4 text-emerald-600" /> {activeArticle.author}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" /> {activeArticle.date}
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" /> {activeArticle.readTime}
              </div>
            </div>
          </div>

          <div className="text-slate-700 whitespace-pre-wrap font-plus-jakarta text-base md:text-lg leading-relaxed space-y-6">
            {activeArticle.content}
          </div>

          <div className="mt-12 bg-slate-900 text-white rounded-2xl p-8 text-center space-y-4 border border-slate-800">
            <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Ready to automate your phone operations?
            </h3>
            <p className="text-slate-300 text-sm font-plus-jakarta max-w-lg mx-auto">
              Deploy human-like AI voice agents in under 10 minutes with zero developer code.
            </p>
            <button onClick={() => setPage("dashboard")} className="btn-primary py-3.5 px-8 text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-bold inline-flex items-center gap-2">
              Build Your Agent Now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.article>
      </div>
    );
  }

  return (
    <div className="pt-28 px-6 max-w-7xl mx-auto pb-32 min-h-screen bg-[#FFFDF9] space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase">
          <BookOpen className="w-3.5 h-3.5" />
          ENTERPRISE KNOWLEDGE HUB
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight" style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          Claritiy Voice Research & Insights
        </h1>
        <p className="text-slate-600 text-lg font-plus-jakarta leading-relaxed">
          Technical deep-dives, ROI benchmark studies, buyer guides, and operational strategies for scaling voice AI automation.
        </p>
      </div>

      {/* Featured Article Banner */}
      {selectedCategory === "All" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setActiveArticleId(featuredArticle.id)}
          className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center cursor-pointer group hover:border-emerald-500/50 transition-all"
        >
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-emerald-500 text-black font-mono text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                FEATURED RESEARCH
              </span>
              <span className="text-xs font-mono text-slate-400">{featuredArticle.readTime}</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-white group-hover:text-emerald-400 transition-colors" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {featuredArticle.title}
            </h2>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed font-plus-jakarta">
              {featuredArticle.excerpt}
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-2">
              <span>By {featuredArticle.author}</span>
              <span>•</span>
              <span>{featuredArticle.date}</span>
            </div>
          </div>
          <div className="lg:col-span-4 flex justify-end">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-black flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowRight className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 justify-start md:justify-center">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredArticles.map((article, idx) => (
          <motion.div 
            key={article.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => setActiveArticleId(article.id)}
            className="bg-white border border-[#EADEC9] rounded-3xl p-8 shadow-sm hover:shadow-xl hover:border-emerald-500/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block">
                {article.category}
              </span>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-2" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {article.title}
              </h3>
              <p className="text-slate-600 text-xs line-clamp-3 font-plus-jakarta leading-relaxed">
                {article.excerpt}
              </p>
            </div>
            
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-6 border-t border-slate-100 mt-6">
              <span>{article.date}</span>
              <span>{article.readTime}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Newsletter Subscription Box */}
      <section className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 border border-slate-800 text-center space-y-4">
        <h3 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Subscribe To Enterprise Voice AI Research
        </h3>
        <p className="text-slate-300 text-sm font-plus-jakarta max-w-xl mx-auto">
          Get weekly operational benchmarks, latency optimizations, and ROI case studies delivered straight to your inbox.
        </p>

        {subscribed ? (
          <div className="p-4 bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-xs font-bold rounded-2xl max-w-md mx-auto flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Thank you for subscribing to Claritiy Voice Insights!
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row max-w-md mx-auto gap-3 pt-2">
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Enter your work email..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              className="py-3 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-colors font-mono flex items-center justify-center gap-2"
            >
              Subscribe <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </section>

    </div>
  );
}


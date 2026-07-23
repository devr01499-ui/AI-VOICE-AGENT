import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Clock, User, Tag } from "lucide-react";

type Page = any;

interface BlogIndexProps {
  setPage: (p: Page) => void;
}

const ARTICLES = [
  {
    id: "cost-of-missed-cod",
    title: "The True Cost of Missed Cash-on-Delivery Confirmations",
    date: "July 15, 2026",
    author: "Clarity Logistics Team",
    category: "E-Commerce",
    readTime: "5 min read",
    content: `Cash-on-Delivery (COD) remains the dominant payment method in emerging markets, but it comes with a massive hidden cost: Return to Origin (RTO). When a customer changes their mind, enters a fake address, or simply forgets about the order, the merchant pays for shipping both ways. 
    
By deploying AI voice agents to call customers immediately after a COD order is placed, merchants can verify intent and correct addresses before a package ever leaves the warehouse. This simple automated step can reduce RTO rates by up to 40%, saving millions in logistics costs.`
  },
  {
    id: "fixing-india-rto",
    title: "How AI is Fixing India's E-Commerce RTO Problem",
    date: "July 10, 2026",
    author: "Rishabh Patel",
    category: "Logistics",
    readTime: "7 min read",
    content: `India's e-commerce ecosystem is booming, but Return to Origin (RTO) rates hover around 30% for COD orders. Traditional manual call centers are too slow and expensive to scale during peak sale seasons like Diwali. 
    
Enter Conversational AI. With native Hindi, Bengali, and Gujarati voice models, Clarity Voice agents are calling millions of customers to confirm orders with zero queue times. The result is a seamless customer experience and a massive boost to the bottom line.`
  },
  {
    id: "latency-ruins-voice",
    title: "Why 800ms Latency Ruins Voice AI (And How to Fix It)",
    date: "July 02, 2026",
    author: "Engineering Team",
    category: "Technology",
    readTime: "8 min read",
    content: `Human conversation relies on micro-pauses. If an AI takes longer than 500ms to respond, the human brain assumes the connection dropped or the AI didn't hear them, prompting them to repeat themselves. This causes the AI to overlap and interrupt, destroying trust.
    
We solved this by vertically integrating the WebRTC stack with the LLM reasoning engine, bypassing traditional HTTP hops. This allows Clarity Voice to achieve sub-180ms latency, making the AI feel indistinguishable from a human.`
  },
  {
    id: "real-estate-voice",
    title: "Real Estate Lead Qualification: Voice Agents vs SDRs",
    date: "June 28, 2026",
    author: "Sarah Jenkins",
    category: "Real Estate",
    readTime: "6 min read",
    content: `In real estate, speed to lead is everything. When a prospect fills out a form at 11 PM, waiting until 9 AM for an SDR to call means the lead is already cold. 
    
Voice AI agents can call the prospect within 3 seconds of form submission, qualify their budget, preferred location, and timeline, and instantly book a site visit on the broker's calendar. It's the ultimate unfair advantage in a competitive market.`
  },
  {
    id: "healthcare-intake",
    title: "Automating Healthcare Intake Without Losing Empathy",
    date: "June 20, 2026",
    author: "Dr. Elena Rostova",
    category: "Healthcare",
    readTime: "6 min read",
    content: `Medical receptionists are overwhelmed with administrative tasks, leading to long hold times for patients. But healthcare requires empathy—something rigid IVR menus lack.
    
Modern voice agents use warm, reassuring tones (like our "Fenrir" persona) to handle patient intake, appointment scheduling, and post-discharge follow-ups. They can detect anxiety in a patient's voice and adjust their pacing accordingly, all while remaining HIPAA compliant.`
  },
  {
    id: "debt-recovery-2026",
    title: "Debt Recovery in 2026: The Role of Voice Automation",
    date: "June 15, 2026",
    author: "Finance Operations",
    category: "Fintech",
    readTime: "7 min read",
    content: `Collections is a high-stress, low-margin operation. Human agents face burnout from constant rejection. Voice AI agents, however, never lose their patience.
    
They can gently remind borrowers of upcoming EMI payments, negotiate payment plans based on pre-approved parameters, and send secure payment links via SMS—all with a polite, non-judgmental tone that often yields higher recovery rates than human collectors.`
  },
  {
    id: "webrtc-sip-trunking",
    title: "Understanding WebRTC SIP Trunking for AI Voice",
    date: "June 05, 2026",
    author: "Telecom Team",
    category: "Infrastructure",
    readTime: "10 min read",
    content: `Integrating AI into legacy telephony systems is notoriously difficult. Traditional SIP trunks were not designed for the rapid bidirectional audio streaming required by large language models.
    
By utilizing WebRTC over UDP, we eliminate the packet-loss jitters common in standard VoIP, ensuring crystal-clear audio fidelity which is crucial for the AI's Speech-to-Text engine to transcribe accurately.`
  },
  {
    id: "70-languages",
    title: "70 Languages, 1 Voice: The Power of Native AI Dialects",
    date: "May 28, 2026",
    author: "Linguistics Dept",
    category: "AI Models",
    readTime: "5 min read",
    content: `Translation APIs pipe text through English first, losing the cultural nuance. A joke in Spanish doesn't translate literally to English. 
    
Our latest native multimodal models understand the semantic intent in the source language directly. This allows the AI to use regional slang and cultural idioms, creating a hyper-localized experience that builds immediate rapport with the caller.`
  },
  {
    id: "end-of-ivr",
    title: "The End of the IVR Menu: Why Conversational AI is Winning",
    date: "May 20, 2026",
    author: "CX Strategy",
    category: "Customer Experience",
    readTime: "6 min read",
    content: `"Press 1 for Sales, Press 2 for Support." We all hate it. IVR menus force the user to adapt to the machine. 
    
Conversational AI flips this dynamic. The caller simply states their problem: "Hi, my router is blinking red." The AI understands the intent, runs a diagnostic via API, and walks the customer through the reboot process. It's the death of the phone tree.`
  },
  {
    id: "hipaa-soc2-guide",
    title: "HIPAA & SOC2 Compliant Voice Agents: A Technical Guide",
    date: "May 12, 2026",
    author: "Security Team",
    category: "Security",
    readTime: "9 min read",
    content: `When dealing with PHI (Protected Health Information) or financial data, security is non-negotiable. 
    
This guide breaks down how Clarity Voice handles data redaction at the edge. Before any transcript is logged to the database, PII/PHI (like credit card numbers or medical conditions) is scrubbed. We also detail our dedicated IP infrastructure and how we sign BAAs for enterprise clients.`
  }
];

export default function BlogIndex({ setPage }: BlogIndexProps) {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);

  const activeArticle = ARTICLES.find(a => a.id === activeArticleId);

  if (activeArticle) {
    return (
      <div className="pt-32 px-6 max-w-3xl mx-auto pb-32 min-h-screen bg-cream-bg">
        <button 
          onClick={() => setActiveArticleId(null)}
          className="flex items-center gap-2 text-small font-bold text-ink-muted hover:text-mint-primary mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to all articles
        </button>

        <motion.article 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <span className="text-caption font-bold text-mint-primary tracking-widest uppercase bg-mint-soft px-3 py-1 rounded-full">
              {activeArticle.category}
            </span>
            <h1 className="text-display text-ink leading-tight">{activeArticle.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-small font-bold text-ink-muted border-t border-b border-border-soft py-4 my-8">
              <div className="flex items-center gap-2"><User className="w-4 h-4" /> {activeArticle.author}</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {activeArticle.date}</div>
              <div className="flex items-center gap-2"><Tag className="w-4 h-4" /> {activeArticle.readTime}</div>
            </div>
          </div>

          <div className="prose prose-lg text-ink-muted whitespace-pre-wrap font-plus-jakarta text-body leading-loose">
            {activeArticle.content}
          </div>

          <div className="mt-16 bg-mint-soft/30 border border-mint-primary/20 rounded-2xl p-8 text-center space-y-4">
            <h3 className="text-h3 text-ink">Ready to automate your conversations?</h3>
            <p className="text-body text-ink-muted mb-4">Join hundreds of companies scaling with Clarity Voice.</p>
            <button onClick={() => setPage("dashboard")} className="btn-primary">
              Build Your Agent Now
            </button>
          </div>
        </motion.article>
      </div>
    );
  }

  return (
    <div className="pt-32 px-6 max-w-7xl mx-auto pb-32 min-h-screen bg-cream-bg">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-display text-ink">Clarity Insights</h1>
        <p className="text-body text-ink-muted max-w-2xl mx-auto">
          Deep dives into voice AI infrastructure, conversational design, and enterprise automation strategies.
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
            className="bg-surface-white border border-border-soft rounded-2xl p-8 shadow-level-1 hover:shadow-level-3 hover:border-mint-primary/30 transition-all cursor-pointer flex flex-col h-full group"
          >
            <span className="text-[10px] font-bold text-mint-primary tracking-widest uppercase mb-4 font-mono">
              {article.category}
            </span>
            <h3 className="text-h3 text-ink group-hover:text-mint-primary transition-colors mb-4 line-clamp-2">
              {article.title}
            </h3>
            <p className="text-small text-ink-muted line-clamp-3 mb-6 flex-grow">
              {article.content.substring(0, 150)}...
            </p>
            <div className="flex items-center justify-between text-caption font-bold text-ink-muted pt-4 border-t border-border-soft">
              <span>{article.date}</span>
              <span>{article.readTime}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

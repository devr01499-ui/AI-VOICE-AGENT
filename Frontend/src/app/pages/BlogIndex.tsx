import { useState } from "react";
import { motion } from "motion/react";
import { 
  ArrowLeft, Clock, User, Tag, BookOpen, 
  ArrowRight, Send, Code2, Eye
} from "lucide-react";

type Page = any;

interface BlogIndexProps {
  setPage: (p: Page) => void;
}

// ── SVG Geometric Background Accent ─────────────────────────────────────────────
function GeometricGridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="grid-blog" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="2,2" />
            <circle cx="0" cy="0" r="1.5" fill="#059669" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-blog)" />
      </svg>
    </div>
  );
}

const CATEGORIES = ["All", "Buyer Guide", "E-Commerce", "Engineering", "Healthcare", "Real Estate", "Finance", "Compliance"];

// Articles written by the Claritiy Voice team. Every product statement must be true today
// (docs/COMPLIANCE_NOTES.md); industry context is described in general terms, without invented figures.
const ARTICLES = [
  {
    id: "buyer-guide-2026",
    title: "How to Choose an AI Voice Agent Platform in India: A 2026 Buyer's Checklist",
    date: "July 20, 2026",
    author: "Claritiy Voice Team",
    category: "Buyer Guide",
    readTime: "8 min read",
    featured: true,
    excerpt: "Before you sign up for any AI calling platform, check these seven things: languages, how replies are produced, pricing, phone numbers, compliance, integrations, and what you can test for free.",
    nonTechSummary: "If you run a clinic, a D2C brand or a lending desk, the right AI voice agent should speak your customers' language, cost a predictable amount, use an Indian number, and let you try it before you pay.",
    techSummary: "Technical buyers should check the audio path (one speech-to-speech model or chained services), webhook signing, API access, data retention controls and how calls are billed.",
    content: `Before you sign up for any AI calling platform, check these seven things. They decide whether your customers will enjoy talking to the agent, and whether the bill will surprise you.

### 1. Does it speak your customers' languages?
Most Indian callers mix languages. Ask which languages are supported and whether the agent can switch to the caller's language on its own. Claritiy Voice speaks English, Hindi, Bengali, Kannada, Malayalam, Gujarati and Tamil, with automatic detection that copes with Hinglish.

### 2. How does it produce a reply?
Some platforms chain three services: speech-to-text, a language model and text-to-speech. Every hand-off adds a pause. A single speech-to-speech model hears and answers in one step, which usually feels more natural. Ask the vendor which one they use, then test it yourself.

### 3. Can callers interrupt it?
Real people talk over each other. A good agent stops talking when the caller speaks and answers the new question.

### 4. Is the price predictable?
Watch for separate charges for speech, AI tokens and telephony. Claritiy Voice sells one-time minute packs that include all three, and bills each answered call per started minute. Unanswered calls cost nothing.

### 5. Do you get an Indian business number?
Check whether a +91 number is included and what KYC is needed. Every Claritiy Voice plan includes one local +91 number after KYC.

### 6. What about compliance?
Look for recording that is off by default with a spoken notice, data retention you control, an opt-out list, and campaigns that respect TRAI calling hours. DND scrubbing and DLT registration usually stay your responsibility.

### 7. Can you try it before paying?
You should be able to build an agent and talk to it before you commit. On Claritiy Voice, creating an account and chatting with your agent in Test LLM is free.`
  },
  {
    id: "cod-rto-reduction",
    // Has its own page: open it instead of an inline copy (audit #130: duplicate content).
    page: "blog-rto",
    title: "How Indian D2C Brands Can Cut COD RTO With Automated Confirmation Calls",
    date: "July 18, 2026",
    author: "Claritiy Voice Team",
    category: "E-Commerce",
    readTime: "7 min read",
    featured: false,
    excerpt: "Cash on delivery is popular in India, and so are COD orders that come back. A short confirmation call before dispatch catches wrong addresses and changed minds early.",
    nonTechSummary: "Before you ship a COD parcel, an AI agent calls the buyer, confirms they still want it and checks the address, so fewer parcels come back unopened.",
    techSummary: "Send each COD order to the agent through the REST API (or upload a daily CSV campaign) and receive confirmed, cancelled or unreachable results on a signed webhook.",
    content: `Cash on delivery is popular in India, and so are COD orders that come back. A short confirmation call before dispatch catches wrong addresses and changed minds early. Read the full guide for the step-by-step setup.`
  },
  {
    id: "low-latency-multimodal",
    title: "Why Some AI Voice Agents Pause Before Answering (and How to Avoid It)",
    date: "July 15, 2026",
    author: "Claritiy Voice Team",
    category: "Engineering",
    readTime: "6 min read",
    featured: false,
    excerpt: "That awkward silence before a voice bot answers usually comes from passing audio and text between several separate services. Here is what happens inside a call, step by step.",
    nonTechSummary: "Older voice bots turn your voice into text, send it to an AI, and turn the answer back into speech. Each step adds a pause. Newer systems hear and answer in one step.",
    techSummary: "Call audio streams over a TLS WebSocket to a single speech-to-speech model; voice activity detection lets the caller interrupt; knowledge lookups and function calls run during the conversation.",
    content: `That awkward silence before a voice bot answers usually comes from passing audio and text between several separate services.

### The chained approach
1. Speech-to-text turns the caller's words into text.
2. A language model writes a reply.
3. Text-to-speech turns the reply back into audio.
Each step waits for the previous one, and each hop across the internet adds time.

### The single-model approach
Claritiy Voice streams the call audio to one speech-to-speech model that hears and answers directly. Replies are streamed back to the caller as they are generated, not after the whole sentence is ready.

### Interruptions
Voice activity detection runs throughout the call. When the caller starts speaking, the agent's pending audio is dropped and it listens.

### Knowledge and tools
If the answer lives in your documents, the agent looks it up in your knowledge base during the call. If it needs your systems, Functions let it call your API.

### A note on numbers
We do not publish a latency figure yet. We will once we have measured it across a large number of real calls.`
  },
  {
    id: "clinic-patient-intake",
    title: "AI Receptionists for Clinics: What They Can (and Should Not) Do",
    date: "July 12, 2026",
    author: "Claritiy Voice Team",
    category: "Healthcare",
    readTime: "6 min read",
    featured: false,
    excerpt: "An AI receptionist can answer every call, book appointments and remind patients. It should never diagnose. Here is how to set one up safely.",
    nonTechSummary: "Your clinic's phone gets answered every time, appointments land on the doctor's calendar, and patients get a reminder call the day before, while your staff look after the people in front of them.",
    techSummary: "Inbound agent on the clinic's +91 number, Google Calendar booking with working hours and buffers, knowledge base for fees and timings, optional PII redaction, recording off by default.",
    content: `An AI receptionist can answer every call, book appointments and remind patients. It should never diagnose.

### What it does well
- Answers every call, including during the morning rush and after hours.
- Shares timings, fees and preparation instructions from your own documents.
- Books, moves and cancels appointments on the doctor's Google Calendar.
- Calls patients the day before to remind them.

### What it must not do
- Give medical advice or a diagnosis. Write this into the instructions, and offer a call-back from the doctor instead.
- Handle emergencies. For chest pain or other urgent symptoms, the agent should tell the caller to call 112 or go to the nearest hospital.

### Privacy
Recording is off by default. If you switch it on, callers hear a notice. You can mask personal details in transcripts and choose how long call data is kept.`
  },
  {
    id: "real-estate-lead-qualification",
    title: "Real Estate Lead Qualification With AI Calls: A Practical Playbook",
    date: "July 08, 2026",
    author: "Claritiy Voice Team",
    category: "Real Estate",
    readTime: "6 min read",
    featured: false,
    excerpt: "Property enquiries cool quickly. Here is how to call every enquiry back automatically, ask the right questions and hand your sales team only the serious buyers.",
    nonTechSummary: "When someone fills in your enquiry form, an AI agent calls them, asks about budget, location and timeline, and books a site visit, so your team spends its time with serious buyers.",
    techSummary: "Send each enquiry to an outbound agent through the REST API, book visits on Google Calendar, and receive budget, area and timeline fields on a signed webhook.",
    content: `Property enquiries cool quickly. Here is how to call every enquiry back automatically and hand your sales team only the serious buyers.

### The questions to ask
1. Which configuration (2BHK, 3BHK)?
2. Which area?
3. What budget?
4. When do they plan to buy?
5. Is a home loan already approved?

### How to set it up
1. Start from the Real Estate Enquiry Qualifier template and add your project details to the knowledge base.
2. Send each new enquiry to the agent through the REST API.
3. Connect Google Calendar so the agent can book site visits.
4. Add a webhook so the answers reach your CRM.

### What your team gets
Every enquiry has a transcript, a summary, an outcome label and the answers above as fields, so the best leads are called first.`
  },
  {
    id: "ethical-emi-collections",
    title: "Polite EMI Reminders With AI: A Guide for Lenders",
    date: "July 05, 2026",
    author: "Claritiy Voice Team",
    category: "Finance",
    readTime: "7 min read",
    featured: false,
    excerpt: "Most missed EMIs are forgotten, not refused. A courteous reminder a few days before the due date, with an identity check first, helps borrowers and protects your brand.",
    nonTechSummary: "An AI agent calls borrowers before their EMI is due, checks it is speaking to the right person, reminds them politely and records when they will pay.",
    techSummary: "Campaigns from a CSV or the REST API, identity check in the agent's instructions, promise-to-pay date as an extracted field on a signed webhook, opt-out list honoured.",
    content: `Most missed EMIs are forgotten, not refused. A courteous reminder before the due date helps borrowers and protects your brand.

### Rules every reminder call should follow
- Confirm identity first. Never mention an amount to anyone but the borrower.
- Say who is calling and why, and that it is an automated call.
- Never threaten, shame or pressure.
- Respect opt-outs, and keep recovery calls within the hours RBI expects (8 am to 7 pm). Claritiy Voice campaigns never dial outside 9 am to 9 pm IST.

### What to record
The promised payment date, any hardship mentioned, and whether a call-back from your team is needed. These come through as fields on a signed webhook, ready for your loan system.`
  },
  {
    id: "voice-ai-compliance-guide",
    title: "AI Calling and Compliance in India: DPDP, TRAI and Call Recording Explained",
    date: "July 01, 2026",
    author: "Claritiy Voice Team",
    category: "Compliance",
    readTime: "8 min read",
    featured: false,
    excerpt: "Using AI voice agents in India touches data protection, telecom rules and call recording. Here is a plain-language overview of what to think about. It is not legal advice.",
    nonTechSummary: "Before you start AI calls, think about consent, calling hours, recordings and how long you keep data. This guide explains each in plain language.",
    techSummary: "Recording off by default with a spoken notice, recordings deleted after 90 days at the latest, workspace retention settings, optional PII redaction, TLS transport and encrypted credentials.",
    content: `Using AI voice agents in India touches data protection, telecom rules and call recording. This is a plain-language overview, not legal advice. Talk to your lawyer about your specific use.

### Consent and purpose (DPDP Act)
Only call people who have agreed to hear from you, and use their data only for the purpose they agreed to. Claritiy Voice asks you to confirm consent before every campaign.

### Calling hours and DND (TRAI)
Commercial calls belong in permitted hours. Claritiy Voice campaigns dial only between 9 am and 9 pm IST and skip your opt-out list. Scrubbing against the national DND (NCPR) registry and DLT registration remain your responsibility.

### Call recording
Tell people when a call is recorded. In Claritiy Voice, recording is off by default; when you switch it on, the agent plays a notice at the start of the call. Recordings are deleted after 90 days at the latest.

### Keeping data only as long as needed
Set a retention period in Settings and call data is deleted automatically after it. You can also mask personal details in transcripts.

### Telling callers it is an AI
We recommend that every agent says it is an AI assistant. For many uses, the law expects it.`
  }
];

export default function BlogIndex({ setPage }: BlogIndexProps) {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const activeArticle = ARTICLES.find(a => a.id === activeArticleId);

  const filteredArticles = selectedCategory === "All" 
    ? ARTICLES 
    : ARTICLES.filter(a => a.category === selectedCategory);

  const featuredArticle = ARTICLES.find(a => a.featured) || ARTICLES[0];

  /** Articles with their own page open that page; the rest open here. */
  const openArticle = (a: { id: string; page?: string }) => {
    if (a.page) { setPage(a.page as Page); window.scrollTo({ top: 0 }); return; }
    setActiveArticleId(a.id);
  };

  if (activeArticle) {
    return (
      <div className="pt-28 px-6 max-w-4xl mx-auto pb-32 min-h-screen bg-[#E5E3DC] relative font-sans text-[#262523]">
        <GeometricGridBackground />
        
        <button 
          onClick={() => setActiveArticleId(null)}
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#121212] mb-8 px-4 py-2 bg-[#DFDCD4] rounded-[2px] border border-[#CBC8BE] hover:bg-[#D5D2C9] transition-colors relative z-10"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Knowledge Hub
        </button>

        <motion.article 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#EBE9E2] border border-[#CBC8BE] p-8 md:p-14 rounded-[2px] space-y-8 relative z-10 text-[#262523]"
        >
          <div className="space-y-4">
            <span className="px-3 py-1 bg-[#DFDCD4] text-[#121212] rounded-[2px] text-xs font-mono font-bold border border-[#CBC8BE] uppercase tracking-wider">
              {activeArticle.category}
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#121212] leading-tight">
              {activeArticle.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-[#5E5D57] border-t border-b border-[#CBC8BE] py-4 my-6">
              <div className="flex items-center gap-2 text-[#121212] font-bold">
                <User className="w-4 h-4 text-[#121212]" /> {activeArticle.author}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#121212]" /> {activeArticle.date}
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#121212]" /> {activeArticle.readTime}
              </div>
            </div>
          </div>

          {/* Dual Perspective Callout Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-[#DFDCD4] rounded-[2px] border border-[#CBC8BE] text-xs">
            <div className="space-y-1">
              <span className="font-mono font-bold text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> EXECUTIVE SUMMARY
              </span>
              <p className="text-[#262523] leading-relaxed">{activeArticle.nonTechSummary}</p>
            </div>
            <div className="space-y-1 md:border-l md:border-[#CBC8BE] md:pl-4">
              <span className="font-mono font-bold text-[#121212] uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#121212]" /> TECHNICAL DEEP-DIVE SUMMARY
              </span>
              <p className="text-[#262523] leading-relaxed">{activeArticle.techSummary}</p>
            </div>
          </div>

          <div className="text-[#262523] whitespace-pre-wrap text-base md:text-lg leading-relaxed space-y-6">
            {activeArticle.content}
          </div>

          <div className="mt-12 bg-[#DFDCD4] text-[#121212] rounded-[2px] p-8 text-center space-y-4 border border-[#CBC8BE]">
            <h3 className="text-2xl font-bold text-[#121212]">
              Ready to automate your phone operations?
            </h3>
            <p className="text-[#262523] text-sm max-w-lg mx-auto">
              Build your first AI voice agent from a template and chat with it for free. No code needed.
            </p>
            <button 
              onClick={() => setPage("dashboard")} 
              className="py-3.5 px-8 text-xs font-mono uppercase tracking-wider bg-[#121212] hover:bg-black text-white font-bold inline-flex items-center gap-2 rounded-[2px] transition-colors"
            >
              Build Your Agent Now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.article>
      </div>
    );
  }

  return (
    <div className="pt-28 px-6 max-w-7xl mx-auto pb-32 min-h-screen bg-[#E5E3DC] space-y-16 relative font-sans text-[#262523]">
      <GeometricGridBackground />
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono font-bold tracking-wider uppercase">
          <BookOpen className="w-3.5 h-3.5" />
          ENTERPRISE KNOWLEDGE HUB
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-[#121212] tracking-tight">
          Claritiy Voice Research & Insights
        </h1>
        <p className="text-[#262523] text-lg leading-relaxed">
          Technical deep-dives, ROI benchmark studies, buyer guides, and operational strategies for scaling voice AI automation.
        </p>
      </div>

      {/* Featured Article Banner */}
      {selectedCategory === "All" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => openArticle(featuredArticle)}
          className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-8 md:p-12 border border-[#CBC8BE] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center cursor-pointer group hover:border-[#121212] transition-colors relative z-10"
        >
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-[#121212] text-white font-mono text-[10px] font-bold rounded-[2px] uppercase tracking-wider">
                FEATURED RESEARCH
              </span>
              <span className="text-xs font-mono text-[#5E5D57]">{featuredArticle.readTime}</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-[#121212] group-hover:underline transition-colors">
              {featuredArticle.title}
            </h2>
            <p className="text-[#262523] text-sm md:text-base leading-relaxed">
              {featuredArticle.excerpt}
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-[#5E5D57] pt-2">
              <span>By {featuredArticle.author}</span>
              <span>•</span>
              <span>{featuredArticle.date}</span>
            </div>
          </div>
          <div className="lg:col-span-4 flex justify-end">
            <div className="w-14 h-14 rounded-[2px] bg-[#121212] text-white flex items-center justify-center group-hover:scale-105 transition-transform">
              <ArrowRight className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 justify-start md:justify-center relative z-10">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-[2px] text-xs font-mono font-bold transition-colors whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-[#121212] text-white"
                : "bg-[#DFDCD4] text-[#262523] border border-[#CBC8BE] hover:bg-[#D5D2C9]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
        {filteredArticles.map((article, idx) => (
          <motion.div 
            key={article.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => openArticle(article)}
            className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 hover:border-[#121212] transition-colors cursor-pointer flex flex-col justify-between group"
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono font-bold text-[#121212] uppercase tracking-widest block">
                {article.category}
              </span>
              <h3 className="text-xl font-bold text-[#121212] group-hover:underline transition-colors line-clamp-2">
                {article.title}
              </h3>
              <p className="text-[#262523] text-xs line-clamp-3 leading-relaxed">
                {article.excerpt}
              </p>
            </div>
            
            <div className="flex items-center justify-between text-[11px] font-mono text-[#5E5D57] pt-6 border-t border-[#CBC8BE] mt-6">
              <span>{article.date}</span>
              <span>{article.readTime}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* There is no newsletter: the old form sent the address nowhere and still said "subscribed"
          (audit #124). Readers who want to talk to us are pointed to the contact page instead. */}
      <section className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-8 md:p-12 border border-[#CBC8BE] text-center space-y-4 relative z-10">
        <h3 className="text-2xl md:text-3xl font-bold text-[#121212]">
          Have a question about your use case?
        </h3>
        <p className="text-[#262523] text-sm max-w-xl mx-auto">
          Tell us what you want to automate and we will show you how a Claritiy Voice agent would handle it.
        </p>
        <div className="pt-2">
          <button
            onClick={() => setPage("contact" as Page)}
            className="py-3 px-6 bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider font-bold rounded-[2px] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            Contact Us <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

    </div>
  );
}

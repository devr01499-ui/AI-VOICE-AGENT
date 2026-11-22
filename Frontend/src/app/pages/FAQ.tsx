import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search } from "lucide-react";

type Page = any;
interface FAQProps { setPage: (p: Page) => void; }

interface FAQItem {
  q: string;
  a: string;
  category: Category;
}

const CATEGORIES = ["Getting Started", "Calls & Languages", "Pricing & Plans", "Compliance & Data", "Integrations"] as const;
type Category = (typeof CATEGORIES)[number];

// Every answer must be true of the product today (docs/COMPLIANCE_NOTES.md); test:marketing-claims
// checks prices and blocks claims the code proved false. The /faq FAQPage schema is built from this list.
const FAQS: FAQItem[] = [
  {
    category: "Getting Started",
    q: "What is Claritiy Voice?",
    a: "Claritiy Voice is an AI voice agent platform for Indian businesses. You create an AI agent, tell it in plain words what to do, connect your own +91 number, and it answers and places phone calls for you: booking appointments, confirming cash-on-delivery orders, sending reminders and answering customer questions.",
  },
  {
    category: "Getting Started",
    q: "Can I try Claritiy Voice for free?",
    a: "Yes. Creating an account and building agents costs nothing, and Test LLM lets you chat with your agent straight away. Real phone calls, Test Lab practice callers and Prompt Coach start when you buy a plan, from ₹3,799 for 750 minutes.",
  },
  {
    category: "Getting Started",
    q: "How long does it take to set up an AI calling agent?",
    a: "Most teams have a working agent the same day. Pick one of 17 templates (clinic receptionist, COD confirmation, EMI reminder and more), adjust the instructions, upload your documents and test it in the browser. Real calls start once your plan, KYC and +91 number are in place; KYC usually takes the longest.",
  },
  {
    category: "Getting Started",
    q: "Do I need a developer to use it?",
    a: "No. Agents, knowledge, numbers and campaigns are all set up from the dashboard. Developers can add the REST API, signed webhooks and custom functions later when they want to connect your own systems. The product guide walks through every screen with screenshots.",
  },
  {
    category: "Calls & Languages",
    q: "Which languages can the AI agent speak?",
    a: "English, Hindi, Bengali, Kannada, Malayalam, Gujarati and Tamil. With automatic detection the agent replies in the caller's language and copes with Hinglish, the way most Indian callers actually speak.",
  },
  {
    category: "Calls & Languages",
    q: "Will callers know they are talking to an AI?",
    a: "You decide how your agent introduces itself in its instructions. We recommend that every agent says it is an AI assistant at the start of the call; for many uses, such as lending and telemarketing, the law expects it.",
  },
  {
    category: "Calls & Languages",
    q: "Can callers interrupt the agent?",
    a: "Yes. A single speech-to-speech model handles the call audio, so when a caller cuts in mid-sentence the agent stops talking, listens, and answers the new question.",
  },
  {
    category: "Calls & Languages",
    q: "How does the agent answer questions about my business?",
    a: "Upload your price list, policies or FAQ to the Knowledge Base as PDF, TXT, CSV or Markdown, or add a web page. During the call the agent looks up the matching passage and answers from it. You can check exactly what it would find with the Retrieval Inspector before going live.",
  },
  {
    category: "Calls & Languages",
    q: "Can the AI transfer a call to a person?",
    a: "Yes, on every paid plan. Add a transfer step with your team's mobile or landline number and describe when to use it, for example when the caller asks for a person or wants a refund. The agent tells the caller it is connecting them, then the call rings your team with your Claritiy number as caller ID. If nobody answers, the caller hears a short message and you get a call-back notification. You can also transfer any live call yourself from Live Monitoring. Minutes are charged for the whole call, including the time with your team.",
  },
  {
    category: "Calls & Languages",
    q: "Can one agent hand the call to another agent?",
    a: "Yes. Add a Transfer to Another Agent step, for example from a receptionist to a billing specialist. The call stays connected; the second agent gets a summary and the recent conversation, introduces itself and carries on, so the caller is not asked the same questions again.",
  },
  {
    category: "Calls & Languages",
    q: "Can my agent send WhatsApp messages?",
    a: "Yes, from your own WhatsApp Business number. Connect it in Integrations (Meta Cloud API) and choose which approved template a step may send, such as a booking confirmation or a brochure link. The agent always asks the caller first and sends only after a clear yes, only to the caller's own number. A reply of STOP opts that person out. Meta bills WhatsApp messages to your business directly. Claritiy does not send SMS.",
  },
  {
    category: "Calls & Languages",
    q: "How many calls can run at the same time?",
    a: "Up to 5 calls at once on Startup and Growth, and up to 15 on Enterprise. Batch campaigns of up to 5,000 contacts dial through that capacity within TRAI calling hours, with automatic retries for unanswered or busy lines.",
  },
  {
    category: "Pricing & Plans",
    q: "How much does Claritiy Voice cost?",
    a: "Plans are one-time minute packs valid 30 days: Startup ₹3,799 for 750 minutes, Growth ₹10,799 for 2,865 minutes and Enterprise ₹30,799 for 10,000 minutes. Each includes one local +91 number after KYC. Speech, AI and telephony are all in the minute price, and there is no subscription or overage.",
  },
  {
    category: "Pricing & Plans",
    q: "How are call minutes counted?",
    a: "Each answered call uses its started minutes, with a minimum of one minute: a 1 minute 35 second call uses 2 minutes. Calls that are never answered use nothing.",
  },
  {
    category: "Pricing & Plans",
    q: "What happens when my plan ends?",
    a: "A plan ends when its minutes are used up or after 30 days, whichever comes first. Calls stop until you buy another plan. Your +91 number is kept for 5 days after the plan ends, so renew within that time to keep it.",
  },
  {
    category: "Compliance & Data",
    q: "Why do I need KYC to get a phone number?",
    a: "Indian telecom rules require a verified identity before a business number can place calls. Individuals verify their PAN and complete Aadhaar verification through DigiLocker; companies verify a company PAN and GST certificate. It is all done in Settings, KYC & Compliance.",
  },
  {
    category: "Compliance & Data",
    q: "Are calls recorded?",
    a: "Only if you switch recording on for an agent; it is off by default. When it is on, callers hear a short notice at the start of the call, and recordings are deleted automatically after 90 days at the latest, or sooner if you set a shorter retention period in Settings.",
  },
  {
    category: "Compliance & Data",
    q: "Does Claritiy Voice follow TRAI calling hours and DND rules?",
    a: "Batch campaigns only dial between 9 am and 9 pm IST, skip everyone on your workspace's opt-out list, and ask you to confirm consent before they start. Checking your list against the national DND (NCPR) registry and DLT registration remain your responsibility under TRAI rules.",
  },
  {
    category: "Compliance & Data",
    q: "How is my data protected?",
    a: "Call audio streams over TLS-encrypted connections, sensitive credentials such as calendar tokens are stored encrypted, team members get roles (admin, developer, analyst or viewer), and transcripts can hide personal details. Call data is deleted after the retention period you set.",
  },
  {
    category: "Integrations",
    q: "Does it work with my CRM, store or booking system?",
    a: "Yes, through webhooks and the API. Every finished call (outcome, extracted details, transcript) can be sent to your system with an HMAC-signed webhook, and Functions let the agent call your own APIs during the call. Google Calendar booking is built in.",
  },
  {
    category: "Integrations",
    q: "Can I place calls from my own software?",
    a: "Yes. Generate an API key in Settings, API & Keys, and use the REST API to start a call, for example when a cash-on-delivery order is created. The developer docs have code samples.",
  },
  {
    category: "Integrations",
    q: "Can I use my own phone carrier or SIP trunk?",
    a: "Not yet. Every paid plan includes one local Indian (+91) business number on our integrated carrier network, set up in the dashboard after KYC. Bring-your-own carrier and SIP trunk connections are not available at the moment.",
  },
];

export default function FAQ({ setPage }: FAQProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory = selectedCategory === "All" || faq.category === selectedCategory;
      const matchesSearch = 
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
        faq.a.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="bg-[#E5E3DC] min-h-screen pt-28 pb-32 px-6 relative font-sans text-[#121212]">
      <section className="max-w-4xl mx-auto space-y-10">
        <div className="hatched-strip h-10 w-full mb-8" />
        
        {/* ── Title Header ────────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono uppercase tracking-wider">
            <span>|</span>
            <span>Straight answers</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-normal md:font-medium text-[#121212] tracking-tight font-sans">
            Frequently Asked Questions
          </h1>
          <p className="text-[#262523] text-base md:text-lg max-w-xl mx-auto leading-relaxed font-sans">
            What it costs, which languages it speaks, why KYC is needed, how recording and TRAI calling hours work, and how to connect your own systems.
          </p>
        </div>

        {/* ── Search & Filter Bar ──────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-[#262523] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search, e.g. pricing, Hindi, KYC, recording, API..."
              className="w-full bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] pl-12 pr-4 py-3 text-sm text-[#121212] placeholder-[#262523] focus:outline-none focus:border-[#121212] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {["All", ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-[2px] text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#121212] text-white border border-[#121212]"
                    : "bg-[#DFDCD4] text-[#121212] hover:bg-[#D5D1C7] border border-[#CBC8BE]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Accordion List ───────────────────────────────────────────── */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 bg-[#EBE9E2] rounded-[2px] border border-[#CBC8BE] p-6 text-[#262523] text-sm font-sans">
              No matching questions found for "{searchQuery}". Reach out to our solutions team directly on WhatsApp or Email.
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className={`bg-[#EBE9E2] border rounded-[2px] transition-colors overflow-hidden ${
                    isOpen ? "border-[#121212]" : "border-[#CBC8BE] hover:border-[#9C998F]"
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-medium text-[#121212] bg-[#DFDCD4] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE]">
                        {faq.category}
                      </span>
                      <h3 className="font-medium text-[#121212] text-base mt-1 font-sans">
                        {faq.q}
                      </h3>
                    </div>
                    <div className={`w-7 h-7 rounded-[2px] border border-[#CBC8BE] bg-[#DFDCD4] flex items-center justify-center flex-shrink-0 transition-transform ${
                      isOpen ? "rotate-180 text-[#121212]" : "text-[#262523]"
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="px-5 pb-5 pt-1 text-sm text-[#262523] leading-relaxed border-t border-[#CBC8BE] font-sans">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* ── Bottom Help Callout ──────────────────────────────────────── */}
        <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 text-center space-y-4">
          <h3 className="text-xl font-medium text-[#121212] font-sans">
            Still have a question?
          </h3>
          <p className="text-sm text-[#262523] max-w-md mx-auto font-sans">
            The product guide shows every dashboard screen step by step. For anything else, message us and a person will reply, Monday to Saturday, 9 am to 8 pm IST.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setPage("guide")}
              className="px-5 py-2.5 bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] font-mono text-xs uppercase tracking-wider rounded-[2px] border border-[#CBC8BE] transition-colors cursor-pointer font-medium"
            >
              Read the Product Guide
            </button>
            <button
              onClick={() => setPage("contact")}
              className="px-5 py-2.5 bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer font-medium"
            >
              Contact Solutions Desk
            </button>
            <a
              href="https://wa.me/919707337259?text=Hello%20Claritiy%20Voice%20Team%2C%20I%20have%20a%20question%20about%20your%20voice%20agent%20platform"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] font-mono text-xs uppercase tracking-wider rounded-[2px] border border-[#CBC8BE] transition-colors cursor-pointer font-medium"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

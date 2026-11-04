import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search, Sparkles, HelpCircle, ShieldCheck, Zap, Layers, DollarSign } from "lucide-react";

type Page = any;
interface FAQProps { setPage: (p: Page) => void; }

interface FAQItem {
  q: string;
  a: string;
  category: "BFSI & Compliance" | "Audio & Latency" | "Integrations & Setup" | "Pricing & Scale";
}

const FAQS: FAQItem[] = [
  {
    category: "Audio & Latency",
    q: "How does Claritiy Voice achieve sub-180ms turn-taking latency?",
    a: "Unlike legacy multi-vendor pipelines that serialize HTTP REST calls between separate STT, LLM, and TTS vendors (causing 1,200ms+ lag), Claritiy Voice streams raw uncompressed 16kHz PCM audio buffers over full-duplex WebRTC directly to native neural multimodal engines. With 20ms Voice Activity Detection (VAD) hardware interrupts, the AI pauses speaking the instant a customer barges in, creating fluid human turn-taking.",
  },
  {
    category: "Audio & Latency",
    q: "How does the agent handle background noise and regional Indian accents?",
    a: "Our speech models are trained natively across 70+ regional Indian and global dialects—including Hindi, Hinglish, Bengali, Kannada, Malayalam, Gujarati, Marathi, and Tamil. The acoustic DSP engine applies real-time noise suppression and echo cancellation directly to incoming telephony packets, accurately recognizing numbers, addresses, and pincodes even from noisy outdoor phone lines.",
  },
  {
    category: "BFSI & Compliance",
    q: "Is Claritiy Voice compliant with RBI Fair Practices Code for loan recovery?",
    a: "Yes. Our BFSI templates (such as Pre-Due Reminders and 1–30 DPD Early Delinquency) strictly adhere to RBI guidelines: calls are scheduled exclusively between 8:00 AM and 7:00 PM local time, automated disclosure is stated immediately, identity verification is gated before disclosing any financial details, and accounts are automatically escalated to human hardship officers if distress is reported.",
  },
  {
    category: "BFSI & Compliance",
    q: "How does Claritiy Voice comply with India's DPDP Act and data privacy standards?",
    a: "Claritiy Voice is an officially registered MSME with the Government of India. We enforce edge-level PII data redaction before telemetry logging, encrypt all telephony sessions with TLS 1.3 / AES-256, and adhere to zero-retention audio streaming policies. Customer financial identifiers and CVVs are strictly prohibited from voice collection.",
  },
  {
    category: "Integrations & Setup",
    q: "How do templates integrate with Shopify, Shiprocket, and CRMs?",
    a: "Every production template connects via bidirectional REST webhooks and JSON event payloads. For example, in our E-Commerce COD template, a new Shopify order webhook triggers an outbound verification call within 60 seconds. When the buyer confirms their delivery landmark or upgrades to prepaid UPI, Claritiy Voice updates the Shopify and Shiprocket order status automatically.",
  },
  {
    category: "Integrations & Setup",
    q: "Can we use our own telephony carrier (Twilio, Exotel, or SIP trunk)?",
    a: "Yes. You can purchase local Indian and international phone numbers directly in our dashboard with one click, or bring your existing Twilio, Exotel, or custom SIP trunk credentials. Our gateway manages call initiation, answer detection, and carrier signaling seamlessly.",
  },
  {
    category: "Pricing & Scale",
    q: "How is Claritiy Voice priced compared to building an in-house voice AI stack?",
    a: "Building an in-house stack requires paying separate per-minute or per-token fees to STT providers (Deepgram/Whisper), LLM providers (OpenAI/Anthropic), TTS providers (ElevenLabs/Cartesia), and telephony carriers (Twilio), often totaling ₹8–₹12/minute with unpredictable token surges. Claritiy Voice unifies the entire stack into a flat, predictable rate starting at ₹3.99/minute with zero hidden markups.",
  },
  {
    category: "Pricing & Scale",
    q: "Can Claritiy Voice launch 10,000+ simultaneous outbound calls?",
    a: "Yes. Our distributed edge infrastructure auto-scales telephony workers across concurrent SIP channels. You can upload contact CSV batches or trigger automated API campaigns to dial 10,000+ contacts simultaneously, complete with intelligent retry algorithms for unanswered or busy lines.",
  },
  {
    category: "Integrations & Setup",
    q: "How long does it take to deploy a custom agent into production?",
    a: "Less than 10 minutes. Select one of our 15 pre-built production templates (e.g., Medical Clinic Receptionist, Real Estate Qualifier, or EMI Reminder), adjust your business name and specific rules in our Visual Flow Studio or Single Prompt Studio, test live in our browser sandbox, connect a phone number, and go live.",
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
            <span>Knowledge Base & Architecture FAQs</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-normal md:font-medium text-[#121212] tracking-tight font-sans">
            Frequently Asked Questions
          </h1>
          <p className="text-[#262523] text-base md:text-lg max-w-xl mx-auto leading-relaxed font-sans">
            Detailed operational answers regarding real-time latency, telecommunication compliance, CRM webhooks, and predictable pricing.
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
              placeholder="Search by topic, e.g. latency, RBI, Shopify, pricing..."
              className="w-full bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] pl-12 pr-4 py-3 text-sm text-[#121212] placeholder-[#262523] focus:outline-none focus:border-[#121212] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {["All", "Audio & Latency", "BFSI & Compliance", "Integrations & Setup", "Pricing & Scale"].map((cat) => (
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
            Have a custom compliance or telephony question?
          </h3>
          <p className="text-sm text-[#262523] max-w-md mx-auto font-sans">
            Our engineering team will review your existing SIP trunks, CRM webhooks, and call flows.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
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

import { motion } from "motion/react";
import Hero from "../components/hero/Hero";
import SolutionsTab from "../components/solutions/SolutionsTab";
import RoiCalculator from "../components/calculator/RoiCalculator";
import { Zap, Mic, BookOpen, Network, Check } from "lucide-react";

type Page = 
  | "home" 
  | "solutions" 
  | "how-it-works" 
  | "voices" 
  | "pricing" 
  | "compare" 
  | "blog" 
  | "blog-rto" 
  | "blog-healthcare" 
  | "blog-fintech" 
  | "docs" 
  | "dashboard" 
  | "industries";

interface HomeProps {
  setPage: (p: Page) => void;
}

export default function Home({ setPage }: HomeProps) {
  return (
    <div className="space-y-20 pb-20">
      <Hero setPage={setPage} />

      {/* Metrics Trust Bar */}
      <section className="border-y border-[#EADEC9]/65 bg-[#FFFDF9] py-10 px-6 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:divide-x divide-[#EADEC9]/70">
          {[
            { value: "< 180ms", label: "Duplex Latency", sub: "Instant responses" },
            { value: "70+", label: "Vocal Dialects", sub: "Regional accents" },
            { value: "10M+", label: "Monthly API Calls", sub: "Scale with confidence" },
            { value: "₹3.99/min", label: "Flat-Rate Cost", sub: "No hidden API stacks" },
          ].map((s) => (
            <div key={s.label} className="md:px-8 text-center first:pl-0 last:pr-0">
              <p className="font-sora text-3xl font-extrabold text-slate-900 mb-1 tracking-tight">
                {s.value}
              </p>
              <p className="text-xs font-bold text-slate-700 mb-0.5 font-plus-jakarta">
                {s.label}
              </p>
              <p className="text-[10px] text-slate-500 font-semibold font-plus-jakarta">
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Solutions Showcase */}
      <section className="px-6 max-w-7xl mx-auto text-center space-y-12">
        <div className="max-w-xl mx-auto text-center space-y-3">
          <span className="text-[10px] font-mono tracking-widest text-[#059669] uppercase bg-[#059669]/10 border border-[#059669]/20 px-3 py-1 rounded-full font-bold">
            Multi-Industry Showcase
          </span>
          <h2 className="font-sora text-4xl font-extrabold text-slate-900 mt-4 tracking-tight">
            Specialized Voice Workflows Built for Your Industry's Exact Nuances
          </h2>
        </div>
        <SolutionsTab />
      </section>

      {/* Technical Capabilities Bento Grid */}
      <section className="py-12 px-6 max-w-7xl mx-auto relative z-10">
        <div className="mb-16 text-center max-w-xl mx-auto space-y-3">
          <span className="text-[10px] font-mono tracking-widest text-[#059669] uppercase bg-[#059669]/10 border border-[#059669]/20 px-3 py-1 rounded-full font-bold">
            Product Capabilities
          </span>
          <h2 className="font-sora text-4xl font-extrabold text-slate-900 mt-4 tracking-tight">
            Built for Enterprise Scale and Bulletproof Reliability
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 hover:border-[#059669]/20 hover:shadow-md transition-all duration-300 group text-left">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:border-emerald-300 transition-all">
              <Zap className="w-5 h-5 text-[#059669]" />
            </div>
            <h3 className="font-sora text-slate-900 text-xl font-bold mb-3 tracking-tight">
              Sub-Second Native Latency
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-plus-jakarta font-semibold">
              No awkward silences. Traditional platforms stitch together separate APIs, adding 2–3s of lag. Clarity Voice processes audio natively end-to-end under 180ms.
            </p>
          </div>

          <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 hover:border-[#059669]/20 hover:shadow-md transition-all duration-300 group text-left">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:border-emerald-300 transition-all">
              <Mic className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-sora text-slate-900 text-xl font-bold mb-3 tracking-tight">
              Full-Duplex Interruption
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-plus-jakarta font-semibold">
              Natural conversations aren't one-sided. If a customer interrupts the AI mid-sentence, the agent pauses instantly, listens, and adapts its response.
            </p>
          </div>

          <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 hover:border-[#059669]/20 hover:shadow-md transition-all duration-300 group text-left">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:border-emerald-300 transition-all">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-sora text-slate-900 text-xl font-bold mb-3 tracking-tight">
              RAG Knowledge Bases
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-plus-jakarta font-semibold">
              Feed your agent PDFs, Notion pages, or website URLs. It speaks strictly from your company's official documentation—never making up facts or straying off-script.
            </p>
          </div>
        </div>
      </section>

      {/* ROI Savings Section */}
      <section className="px-6 max-w-7xl mx-auto space-y-10">
        <RoiCalculator />
      </section>

      {/* SEO/AEO FAQ */}
      <section className="px-6 max-w-4xl mx-auto py-12 text-left">
        <h2 className="font-sora text-3xl font-extrabold text-slate-900 mb-8 tracking-tight text-center">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {[
            {
              q: "How does Clarity Voice reduce COD RTO?",
              a: "Clarity Voice places an automated confirmation call to every cash-on-delivery customer before their order is dispatched, verifying the order details and delivery address. This catches wrong numbers, changed minds, and unclear addresses before a courier is sent, which directly reduces return-to-origin (RTO) and failed delivery costs."
            },
            {
              q: "Do I need to hire a calling team to confirm COD orders?",
              a: "No. Clarity Voice replaces or scales alongside a manual calling team with AI voice agents that call every order automatically, at any volume, without additional hiring."
            },
            {
              q: "What languages does Clarity Voice support for COD confirmation calls?",
              a: "Clarity Voice supports English and Hindi today, with additional Indian languages including Bengali, Kannada, Malayalam, and Gujarati, plus Mandarin and Arabic for international sellers."
            }
          ].map((faq, idx) => (
            <div key={idx} className="bg-white border border-[#EADEC9]/60 rounded-2xl p-6 shadow-sm">
              <h4 className="font-sora font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Check className="w-4.5 h-4.5 text-[#059669] flex-shrink-0" />
                {faq.q}
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed font-plus-jakarta font-semibold pl-6">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

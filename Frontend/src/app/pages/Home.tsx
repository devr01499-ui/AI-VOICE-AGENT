import { motion, useScroll } from "motion/react";
import Hero from "../components/hero/Hero";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import {
  ArrowRight, ShieldCheck, Zap, Bot, CheckCircle2, Lock, Globe2,
  PhoneCall, TrendingUp, Clock, Headphones, Phone,
  BarChart3, Network, Database, MessageSquare,
  RefreshCw, Webhook, Languages, Activity
} from "lucide-react";
import LottieVoiceOrb from "../components/animation/LottieVoiceOrb";
import { concurrencyText, usePublicPlans } from "../lib/plans";

type Page = any;
interface HomeProps { setPage: (p: Page) => void; }

// ── Reusable section label (EdgeSkool Minimalist Style) ───────────────────────
function SectionLabel({ text }: { text: string; color?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#121212]">
      <span className="text-[#121212] font-semibold">|</span>
      <span className="uppercase tracking-wider">{text}</span>
    </div>
  );
}

// ── EdgeSkool wireframe card wrapper ──────────────────────────────────────────

// ── Scroll progress line ─────────────────────────────────────────────────────
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-[999] origin-left bg-[#121212]"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

// ── Example setups (how businesses use the product; clearly not customer quotes) ──
function TestimonialsSection() {
  const testimonials = [
    {
      title: "A clinic front desk that never misses a call",
      body: "A dental clinic points its +91 number at a receptionist agent. Callers ask about timings and fees, the agent answers from the clinic's price list and books the slot on Google Calendar.",
      author: "Example setup · Clinic receptionist"
    },
    {
      title: "COD orders confirmed before they ship",
      body: "A D2C brand uploads the day's cash-on-delivery orders as a batch campaign. The agent confirms each order and the delivery address in Hindi or English, and every answer lands in Call Reports.",
      author: "Example setup · D2C brand"
    },
    {
      title: "EMI reminders that check identity first",
      body: "A lender's agent confirms it is speaking to the borrower before it mentions any amount, reminds them of the due date politely, and records the reply.",
      author: "Example setup · Lender / NBFC"
    },
    {
      title: "New enquiries called back the same day",
      body: "A real estate team sends web enquiries to an outbound agent through the API. The agent asks about budget, location and timeline, and the answers reach the CRM by webhook.",
      author: "Example setup · Real estate"
    },
    {
      title: "Answers that come from your documents",
      body: "An insurance help desk uploads its policy FAQ. The agent answers from the document, and when a question is not covered it offers a call-back instead of guessing.",
      author: "Example setup · Insurance support"
    },
    {
      title: "Every call written down",
      body: "A support manager reads transcripts in Call History, sorts outcomes in Call Reports, and gets an email alert when failed calls go above the limit the team chose.",
      author: "Example setup · Support team"
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Signature EdgeSkool Diagonal Hatched Decorative Banner */}
      <div className="hatched-strip h-12 w-full mb-10" />

      {/* Header with Monospace Tag */}
      <div className="text-left mb-10 space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono text-[#121212]">
          <span className="text-[#121212] font-semibold">|</span>
          <span className="tracking-wider">Example setups</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          How businesses put their AI agent to work.
        </h2>
        <p className="text-xs sm:text-sm text-[#262523] font-sans">
          These are typical setups built with the product, not customer quotes.
        </p>
      </div>

      {/* 3-Column Wireframe Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((t, idx) => (
          <div
            key={idx}
            className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 flex flex-col justify-between hover:border-[#9C998F] transition-colors"
          >
            <div>
              <h3 className="text-sm sm:text-base font-medium text-[#121212] mb-3 leading-snug font-sans">
                {t.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#262523] leading-relaxed mb-6 font-sans">
                {t.body}
              </p>
            </div>
            <div className="pt-3 border-t border-[#CBC8BE]/60 text-xs font-mono text-[#262523]">
              {t.author}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Horizontal Banner Features Section ──────────────────────────────────────────
function BentoCapabilitySection({ setPage }: { setPage: (p: Page) => void }) {
  const items = [
    {
      title: "Real-Time Voice AI",
      desc: "One speech-to-speech model listens and speaks, so the conversation flows without the pauses of stitched-together speech services.",
      icon: Zap,
    },
    {
      title: "Natural Interruptions",
      desc: "Callers can cut in mid-sentence, the way people do. The agent stops, listens and answers the new question.",
      icon: MessageSquare,
    },
    {
      title: "7 Languages incl. Hindi & English",
      desc: "Native conversational AI in Hindi, Indian English, Hinglish, Bengali, Kannada, Malayalam, Gujarati and Tamil, with automatic language detection and no translation step.",
      icon: Languages,
    },
    {
      title: "Real-Time Telephony",
      desc: "Calls run on our carrier partners' phone networks with real-time audio streaming, on the local +91 number included with your plan.",
      icon: Phone,
    },
    {
      title: "Appointment Booking",
      desc: "Connect Google Calendar and the agent checks free slots and books appointments during the call, within the working hours and gaps you set.",
      icon: PhoneCall,
    },
    {
      title: "CRM & Webhook Automation",
      desc: "Signed post-call webhooks deliver call outcomes, extracted fields and transcripts to your CRM or backend; custom API tools let the agent look up and update your systems during the call.",
      icon: Webhook,
    },
    {
      title: "Batch Calling & Smart Retry",
      desc: "Upload up to 5,000 contacts per campaign. Calls go out at your plan's capacity between 9 am and 9 pm IST, and busy or unanswered numbers are retried automatically.",
      icon: RefreshCw,
    },
    {
      title: "Call Summaries & Outcomes",
      desc: "Every call gets a transcript, a summary, an outcome label, a sentiment and the details you asked the agent to collect. Recording is optional and off by default.",
      icon: BarChart3,
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="hatched-strip h-10 w-full mb-10" />
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <SectionLabel text="Platform Capabilities" />
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          Every Feature Your Enterprise AI Voice Platform Needs
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-5 flex flex-col justify-between hover:border-[#9C998F] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-[#262523] uppercase tracking-wider">
                    Feature 0{i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-[2px] bg-[#DFDCD4] flex items-center justify-center text-[#121212]">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm font-medium text-[#121212] mb-2 leading-snug font-sans">
                  {item.title}
                </h3>
                <p className="text-xs text-[#262523] leading-relaxed font-sans">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Technical Neo-Brutalist Use Cases Section ──────────────────────────────────
function UseCaseSection({ setPage }: { setPage: (p: Page) => void }) {
  const useCases = [
    { step: "FIRST USE CASE", num: "01", title: "APPOINTMENTS", desc: "Book, confirm and remind. The agent reads your Google Calendar, offers free slots and books them during the call.", icon: Clock, metric: "Google Calendar booking" },
    { step: "SECOND USE CASE", num: "02", title: "QUALIFICATION", desc: "Call new enquiries as soon as your system sends them through the API, ask your questions and label each lead.", icon: TrendingUp, metric: "Leads via API or campaigns" },
    { step: "THIRD USE CASE", num: "03", title: "INBOUND", desc: "Answer every call on your +91 number, answer FAQs from your documents and offer a call-back when needed.", icon: PhoneCall, metric: "Answers day and night" },
    { step: "FOURTH USE CASE", num: "04", title: "COLLECTIONS", desc: "Polite EMI due-date reminders that confirm who is on the line before mentioning any amount.", icon: Activity, metric: "Identity check first" },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="hatched-strip h-10 w-full mb-10" />
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <SectionLabel text="Use Cases" />
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          One Platform. Every High-Value Call Automation Use Case.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {useCases.map((uc, i) => {
          const Icon = uc.icon;
          return (
            <div
              key={i}
              className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 flex flex-col justify-between hover:border-[#9C998F] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[10px] font-mono text-[#262523] uppercase tracking-wider">
                    [ {uc.num} ] · {uc.step}
                  </span>
                  <div className="w-8 h-8 rounded-[2px] bg-[#DFDCD4] flex items-center justify-center text-[#121212]">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-base font-medium text-[#121212] mb-2 font-sans tracking-tight">
                  {uc.title}
                </h3>
                <p className="text-xs text-[#262523] leading-relaxed font-sans">
                  {uc.desc}
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#CBC8BE]/60 text-[11px] font-mono font-medium text-[#121212]">
                {uc.metric}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Comparison Table ──────────────────────────────────────────────────────────
function ComparisonSection({ setPage }: { setPage: (p: Page) => void }) {
  const plans = usePublicPlans();
  const rows = [
    { feature: "Native Audio Pipeline", claritiy: "✅ Vertically Integrated", vapi: "❌ Stacked STT+LLM+TTS", legacy: "❌ Human only" },
    { feature: "Multilingual Support", claritiy: "✅ 7 Languages + Auto-Detect", vapi: "✅ Limited", legacy: "⚠️ Per hire" },
    { feature: "Concurrent Calls", claritiy: `✅ ${concurrencyText(plans)}`, vapi: "⚠️ Rate limited", legacy: "❌ Team capacity" },
    { feature: "RAG Knowledge Base", claritiy: "✅ Built-in", vapi: "⚠️ Manual setup", legacy: "❌ Scripts only" },
    { feature: "Indian +91 Number", claritiy: "✅ Included after KYC", vapi: "⚠️ Bought separately", legacy: "⚠️ Your own lines" },
    { feature: "Pricing Model", claritiy: "✅ All-inclusive minute plans", vapi: "❌ Each service billed separately", legacy: "❌ Salary per caller" },
    { feature: "Setup Time", claritiy: "✅ Same day", vapi: "⚠️ Days of engineering", legacy: "❌ Weeks of hiring" },
  ];

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
        <SectionLabel text="Enterprise Architecture Comparison" />
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          Claritiy Voice vs Chained Multi-Vendor Stacks<br />& Legacy Call Centers
        </h2>
        <p className="text-[#262523] leading-relaxed font-sans text-sm sm:text-base">
          How one speech-to-speech platform compares with stitching several AI services together, or hiring a calling team.
        </p>
      </div>

      <div className="rounded-[2px] overflow-hidden border border-[#CBC8BE] bg-[#EBE9E2]">
        {/* Table header */}
        <div className="grid grid-cols-4 bg-[#DFDCD4] text-[#121212] border-b border-[#CBC8BE] text-xs font-mono uppercase tracking-wider">
          <div className="p-4 font-mono font-semibold">Feature</div>
          <div className="p-4 font-mono font-bold text-[#121212] border-l border-[#CBC8BE]">
            ✦ Claritiy Voice
          </div>
          <div className="p-4 font-mono text-[#262523] border-l border-[#CBC8BE]">Chained APIs</div>
          <div className="p-4 font-mono text-[#262523] border-l border-[#CBC8BE]">Human Centers</div>
        </div>
        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-4 border-t border-[#CBC8BE] ${i % 2 === 0 ? "bg-[#EBE9E2]" : "bg-[#E5E3DC]"} transition-colors hover:bg-[#DFDCD4]`}
          >
            <div className="p-3.5 text-xs font-medium text-[#121212]">{row.feature}</div>
            <div className="p-3.5 text-xs font-semibold text-[#121212] border-l border-[#CBC8BE]">{row.claritiy}</div>
            <div className="p-3.5 text-xs text-[#262523] border-l border-[#CBC8BE]">{row.vapi}</div>
            <div className="p-3.5 text-xs text-[#262523] border-l border-[#CBC8BE]">{row.legacy}</div>
          </div>
        ))}
        {/* CTA row */}
        <div className="grid grid-cols-4 border-t border-[#CBC8BE] bg-[#DFDCD4] p-3.5 items-center">
          <div className="col-span-1 text-xs font-mono font-bold text-[#121212]">Ready to switch?</div>
          <div className="col-span-3 border-l border-[#CBC8BE] pl-4">
            <button
              onClick={() => setPage("dashboard")}
              className="btn-primary text-xs font-mono uppercase tracking-wider px-5 py-2 cursor-pointer"
            >
              Start Building Now <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Full-bleed editorial CTA ──────────────────────────────────────────────────
function FinalCTA({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212]">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 items-center gap-10 p-10 lg:p-14">
            {/* Left */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 border border-[#CBC8BE] bg-[#DFDCD4] rounded-[2px] px-3 py-1 font-mono text-xs uppercase tracking-wider text-[#121212]">
                <span className="w-1.5 h-1.5 bg-[#121212] rounded-full animate-pulse" />
                <span>Free to Start</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] leading-tight font-sans tracking-tight">
                Build Your First AI Voice Agent Today
              </h2>
              <p className="text-[#262523] text-sm sm:text-base leading-relaxed font-sans">
                No engineering team and no calling floor. Pick a template, write what the agent should do, and chat with it before you pay. Real calls start with a plan from ₹3,799, with a +91 number included.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setPage("dashboard")}
                  className="bg-[#121212] text-white hover:bg-black rounded-[2px] font-mono text-xs uppercase tracking-wider px-6 py-3.5 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                >
                  Build Your Agent Now <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage("pricing")}
                  className="border border-[#CBC8BE] bg-[#DFDCD4] text-[#121212] hover:bg-[#D5D1C7] rounded-[2px] font-mono text-xs uppercase tracking-wider px-6 py-3.5 transition-colors cursor-pointer"
                >
                  View Pricing Plans
                </button>
              </div>
            </div>

            {/* Right: Feature checklist */}
            <div className="grid grid-cols-2 gap-3">
              {[
                "AI voice calling agents",
                "AI outbound calling",
                "AI inbound calling",
                "Appointment booking",
                "Lead qualification",
                "COD confirmation",
                "Payment reminders",
                "Google Calendar booking",
                "Hindi, English + 5 languages",
                "Your own +91 number",
                "CRM via webhooks & API",
                "Call reports & analytics",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-[#121212] font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main Home Page ──────────────────────────────────────────────────────────
export default function Home({ setPage }: HomeProps) {
  return (
    <div className="overflow-hidden" style={{ background: "#E5E3DC" }}>
      <ScrollProgress />

      {/* ── HERO ── */}
      <Hero setPage={setPage} />

      {/* ── TESTIMONIALS (EdgeSkool Reference) ── */}
      <TestimonialsSection />

      {/* ── INTERACTIVE LIVE VOICE AI LOTTIE SIMULATOR ── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <SectionLabel text="Interactive Voice Simulator" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
            Experience Real-Time Voice AI
          </h2>
          <p className="text-[#262523] text-sm sm:text-base leading-relaxed font-sans">
            Play through sample conversations and watch how an agent confirms an order, books an appointment and copes when the caller interrupts.
          </p>
        </div>

        <LottieVoiceOrb onExploreClick={() => setPage("solutions")} />
      </section>

      {/* ── HOW IT WORKS (Grid Steps) ── */}
      <GridSteps />

      {/* ── BENTO CAPABILITIES ── */}
      <BentoCapabilitySection setPage={setPage} />

      {/* ── INDUSTRY SHOWROOM ── */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <SectionLabel text="Industry Showroom" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
            AI Voice Agents for Every Enterprise Vertical
          </h2>
          <p className="text-[#262523] leading-relaxed font-sans text-sm sm:text-base">
            Starting points for healthcare, finance, real estate, e-commerce, logistics, insurance, BPO, SaaS, education, recruitment, telecom and travel. Pick the closest one and change it to fit your business.
          </p>
        </div>
        <IndustryShowroomGrid />
      </section>

      {/* ── INBOUND + OUTBOUND SPLIT (Technical Wireframe Style) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="hatched-strip h-10 w-full mb-10" />
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <SectionLabel text="Inbound & Outbound AI Calling" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
            One Unified Voice Automation Platform.<br />Two Powerful Directions.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inbound Technical Warm Stone Card */}
          <div className="rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] p-8 lg:p-10 space-y-6 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center text-[#121212] mb-4">
                <Headphones className="w-4 h-4" />
              </div>
              <p className="text-xs font-mono uppercase tracking-wider text-[#262523] mb-2">AI Inbound Calling</p>
              <h3 className="text-2xl font-medium text-[#121212] mb-3 font-sans">AI Receptionist & Inbound Call Automation</h3>
              <p className="text-[#262523] text-xs sm:text-sm leading-relaxed font-sans">
                Every call to your +91 number is answered, day and night, holidays included. The agent answers questions from your documents, books appointments and qualifies enquiries, and offers a call-back when a person should follow up. A friendlier replacement for "press 1, press 2" menus.
              </p>
            </div>
            <ul className="space-y-2 border-t border-[#CBC8BE]/60 pt-4">
              {["Answers every call, day and night", "Google Calendar appointment booking", "Answers from your own documents", "Call-back offered when unsure", "Templates for clinics, offices and help desks", "Transcript and summary for every call"].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs font-mono text-[#262523]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#121212] flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Outbound Technical Warm Stone Card */}
          <div className="rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] p-8 lg:p-10 space-y-6 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center text-[#121212] mb-4">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-xs font-mono uppercase tracking-wider text-[#262523] mb-2">AI Outbound Calling</p>
              <h3 className="text-2xl font-medium text-[#121212] mb-3 font-sans">Outbound AI Calling Campaign Engine</h3>
              <p className="text-[#262523] text-xs sm:text-sm leading-relaxed font-sans">
                Confirm COD orders before dispatch, remind customers about appointments and EMIs, and call new enquiries back, one at a time from the API or as campaigns from a CSV list.
              </p>
            </div>
            <ul className="space-y-2 border-t border-[#CBC8BE]/60 pt-4">
              {["Batch campaigns of up to 5,000 contacts", "Automatic retries for busy and unanswered numbers", "Calls only between 9 am and 9 pm IST", "Outcome label and score for every call", "COD order confirmation", "EMI and appointment reminders"].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs font-mono text-[#262523]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#121212] flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#CBC8BE]">
              {[{ v: "5,000", l: "Contacts per campaign" }, { v: "3", l: "Attempts per person" }, { v: "9–9", l: "IST calling hours" }].map((m, i) => (
                <div key={i} className="text-center p-3 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE]">
                  <p className="text-base font-bold font-mono text-[#121212]">{m.v}</p>
                  <p className="text-[10px] font-mono text-[#262523] mt-0.5">{m.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── USE CASES ── */}
      <UseCaseSection setPage={setPage} />

      {/* ── ABOUT / ARCHITECTURE (Wireframe Minimalist Style) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="hatched-strip h-10 w-full mb-10" />
        <div className="bg-[#EBE9E2] rounded-[2px] p-8 lg:p-12 border border-[#CBC8BE] relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left: Text Content */}
            <div className="space-y-4">
              <SectionLabel text="Architecture" />
              <h2 className="text-3xl sm:text-4xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
                Built Different — Not Just Another Stacked Voice API
              </h2>
              <p className="text-[#262523] text-sm sm:text-base leading-relaxed font-sans">
                Many AI calling tools chain separate speech-to-text, language-model and text-to-speech services, and every hand-off adds a pause the caller can hear. Claritiy Voice streams the call audio to one speech-to-speech model, so the agent hears and answers in a single step. That is the difference between a voice bot and an AI phone agent people are happy to talk to.
              </p>
            </div>

            {/* Right: 4 Wireframe Cards */}
            <div className="space-y-3">
              {[
                { icon: Zap, title: "Real-Time Replies", desc: "Call audio streams straight to the model" },
                { icon: Globe2, title: "7 Languages, No Translation Step", desc: "The model hears and speaks each language directly" },
                { icon: ShieldCheck, title: "Privacy Controls", desc: "TLS encryption, optional PII redaction, recording opt-in" },
                { icon: Network, title: "Functions During the Call", desc: "The agent can call your APIs while it talks" },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] px-5 py-4 hover:border-[#9C998F] transition-colors w-full"
                >
                  <div className="w-8 h-8 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] flex items-center justify-center flex-shrink-0 text-[#121212]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[#121212] text-sm font-sans">{title}</h4>
                    <p className="text-xs text-[#262523] mt-0.5 font-sans">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <ComparisonSection setPage={setPage} />

      {/* ── COMPLIANCE BADGE PANEL (Technical Wireframe Style) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] p-10 lg:p-14 text-center space-y-6 text-[#121212]">
            <div className="w-10 h-10 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center mx-auto text-[#121212]">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-2xl sm:text-4xl font-medium text-[#121212] tracking-tight font-sans">
              Security and Privacy, Built In
            </h2>
            <p className="text-[#262523] max-w-2xl mx-auto text-xs sm:text-sm leading-relaxed font-sans">
              Calls stream over encrypted connections. Recording is off until you switch it on, and then callers hear a notice. Transcripts can hide personal details, data is deleted after the retention period you choose, and every campaign asks you to confirm consent before it dials.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {["🔒 TLS ENCRYPTED", "🔑 ENCRYPTED CREDENTIALS", "🎙️ RECORDING OFF BY DEFAULT", "⏰ 9 AM–9 PM IST CAMPAIGNS", "📋 CONSENT CONFIRMED PER CAMPAIGN"].map((b, i) => (
                <span key={i} className="text-[11px] font-mono text-[#121212] bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] px-3 py-1.5 uppercase font-medium">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <FinalCTA setPage={setPage} />
    </div>
  );
}

// ── Interlocking Horizontal Steps Section ──────────────────────────────────────
function GridSteps() {
  const steps = [
    { n: "01", title: "Configure Your AI Agent", desc: "Name your agent, pick a voice persona, set language mode, and define the conversation goal.", icon: Bot },
    { n: "02", title: "Upload Knowledge Base", desc: "Add your FAQ, price list or policies as PDF, TXT, CSV or Markdown, or a web page. The agent answers from them instead of guessing.", icon: Database },
    { n: "03", title: "Connect Phone Number", desc: "Every plan includes a local +91 number after KYC. Choose which agent answers it and which one calls out.", icon: Phone },
    { n: "04", title: "Launch & Monitor", desc: "Go live. Follow calls as they happen, read transcripts, check outcomes and improve the agent from the dashboard.", icon: BarChart3 },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="hatched-strip h-10 w-full mb-10" />
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <SectionLabel text="From Sign-Up to First Call" />
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal sm:font-medium text-[#121212] tracking-tight leading-[1.1] font-sans">
          From Zero to Live AI Voice Agent
        </h2>
        <p className="text-[#262523] text-sm sm:text-base leading-relaxed font-sans">
          No code. No call center setup. No engineering team. Build and deploy your AI phone agent in minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 flex flex-col justify-between hover:border-[#9C998F] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-2xl font-bold text-[#121212]">
                    {step.n}
                  </span>
                  <div className="w-8 h-8 rounded-[2px] bg-[#DFDCD4] flex items-center justify-center text-[#121212]">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-sm sm:text-base font-medium text-[#121212] mb-2 leading-snug font-sans">
                  {step.title}
                </h3>
                <p className="text-xs text-[#262523] leading-relaxed font-sans">
                  {step.desc}
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#CBC8BE]/60 text-[10px] font-mono text-[#262523] uppercase tracking-wider">
                Phase {step.n}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

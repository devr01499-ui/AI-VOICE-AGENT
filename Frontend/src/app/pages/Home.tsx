import { motion } from "motion/react";
import Hero from "../components/hero/Hero";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import FeatureCapabilityGrid from "../components/showroom/FeatureCapabilityGrid";
import { ArrowRight, ShieldCheck, Zap, Bot, CheckCircle2, Lock, Cpu, Globe2, PhoneCall } from "lucide-react";

type Page = any;

interface HomeProps {
  setPage: (p: Page) => void;
}

export default function Home({ setPage }: HomeProps) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What are enterprise AI voice agents and how do they work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Enterprise AI voice agents are autonomous, conversational software programs that place and receive phone calls in natural human language. Using real-time speech recognition (ASR), large language models (LLM), and neural text-to-speech (TTS), Clarity Voice agents converse with callers under 180ms latency."
        }
      },
      {
        "@type": "Question",
        "name": "How does Clarity Voice handle interruptions during a call?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Clarity Voice utilizes full-duplex audio processing. If a caller speaks or interrupts mid-sentence, the AI voice agent instantly pauses audio playback, listens to the user's input, and dynamically adjusts its response without breaking conversation flow."
        }
      },
      {
        "@type": "Question",
        "name": "Is Clarity Voice compliant with HIPAA, SOC 2, and PCI-DSS?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Clarity Voice provides Data Redaction at Edge, automatically scrubbing PII, PHI, and payment credentials before storing call logs or transcripts. We maintain SOC 2 Type II compliance and offer HIPAA Business Associate Agreements (BAA)."
        }
      },
      {
        "@type": "Question",
        "name": "What is the pricing model for Clarity Voice AI calling agents?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Clarity Voice offers transparent bundled plans: Startup Plan at ₹1,799/month (500 minutes included), Growth Plan at ₹4,999/month (1,500 minutes included), and a pay-as-you-go rate of ₹3.99/minute with no hidden fees for STT, LLM, or TTS."
        }
      }
    ]
  };

  return (
    <div className="space-y-32 pb-32 overflow-hidden bg-cream-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Hero setPage={setPage} />

      {/* SECTION 1: The Evolution of Enterprise Telephony */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2">
          <div className="max-w-4xl mx-auto space-y-8">
            <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
              ENTERPRISE TELEPHONY REVOLUTION
            </span>
            <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-ink leading-tight">
              The Evolution of Enterprise Telephony & Conversational Voice AI
            </h2>
            <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
              <p>
                For decades, enterprise contact centers have been trapped between two costly extremes: hiring massive teams of human call center representatives or deploying rigid, frustrating Interactive Voice Response (IVR) phone trees. Traditional IVR menus force customers to navigate repetitive push-button prompts ("Press 1 for Sales, Press 2 for Support"), leading to high call abandonments, poor customer satisfaction scores, and negative brand perception.
              </p>
              <p>
                Simultaneously, manual call handling costs modern businesses millions annually in wages, onboarding overhead, turnover, and queue management. When peak call surges occur during product launches, open enrollment periods, or seasonal sales events, legacy call centers inevitably fail, resulting in missed sales leads, delayed customer service, and lost revenue.
              </p>
              <p>
                <strong>Clarity Voice represents the next evolution of voice automation.</strong> Powered by low-latency conversational AI voice technology, our voice calling agents handle thousands of simultaneous inbound and outbound calls with human-like empathy, precise intent comprehension, and zero queue delays. Whether confirming e-commerce Cash-on-Delivery (COD) orders to prevent Return-to-Origin (RTO) losses, qualifying high-intent real estate leads, scheduling patient appointments for medical clinics, or conducting ethical debt recovery outreach—Clarity Voice transforms phone calls from a cost center into a high-converting digital engine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Core Architecture — Native Multimodal Audio */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <span className="text-caption font-bold text-amber-cta uppercase tracking-widest bg-amber-cta/10 px-4 py-1.5 rounded-full font-mono">
              SUB-180MS ZERO-LAG PIPELINE
            </span>
            <h2 className="font-sora text-3xl md:text-4xl font-extrabold text-ink leading-tight">
              Native Multimodal Audio vs. Stacked API Pipelines
            </h2>
            <p className="text-body text-ink-muted leading-relaxed font-plus-jakarta">
              Most voice AI software vendors assemble piecemeal architectures: chaining third-party Speech-to-Text (ASR) providers to external LLM endpoints and routing output back through independent Text-to-Speech (TTS) vendors. Each hop adds latency, introducing 800ms to 1.5-second pauses that destroy human conversational flow.
            </p>
            <div className="space-y-4">
              <div className="bg-surface-white border border border-[#EADEC9] p-6 rounded-2xl flex items-start gap-4">
                <Cpu className="w-6 h-6 text-mint-primary mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-sora font-bold text-ink text-lg">Vertically Integrated Orchestration</h4>
                  <p className="text-small text-ink-muted mt-1">Direct WebRTC audio streaming bypasses unnecessary HTTP REST overhead to achieve sub-180ms response times.</p>
                </div>
              </div>
              <div className="bg-surface-white border border border-[#EADEC9] p-6 rounded-2xl flex items-start gap-4">
                <Globe2 className="w-6 h-6 text-amber-cta mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-sora font-bold text-ink text-lg">70+ Regional Dialects & Native Accents</h4>
                  <p className="text-small text-ink-muted mt-1">Native speech models comprehend regional Indian and global accents without relying on lossy intermediate text translation APIs.</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-surface-white border border border-[#EADEC9] rounded-3xl p-10 shadow-level-3 space-y-6"
          >
            <h3 className="font-sora text-2xl font-bold text-ink">Architecture Benchmarks</h3>
            <div className="space-y-6 font-mono text-xs">
              <div>
                <div className="flex justify-between font-bold mb-2">
                  <span>Clarity Native Multimodal</span>
                  <span className="text-mint-primary">180ms Latency</span>
                </div>
                <div className="w-full h-3 bg-mint-soft rounded-full overflow-hidden">
                  <div className="w-1/5 h-full bg-mint-primary rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-bold mb-2">
                  <span>Stacked API Competitors (Vapi, Retell)</span>
                  <span className="text-amber-cta">850ms Latency</span>
                </div>
                <div className="w-full h-3 bg-cream-bg border border-border-soft rounded-full overflow-hidden">
                  <div className="w-3/4 h-full bg-amber-cta rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-bold mb-2">
                  <span>Legacy Human Call Centers</span>
                  <span className="text-red-500">45-Minute Queue Time</span>
                </div>
                <div className="w-full h-3 bg-cream-bg border border-border-soft rounded-full overflow-hidden">
                  <div className="w-full h-full bg-red-500 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 3: Inbound Call Automation & AI Receptionists */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
            INBOUND VOICE AUTOMATION
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-ink">
            AI Receptionist & Inbound Contact Center Workflows
          </h2>
          <p className="text-body text-ink-muted">
            Turn inbound phone calls into instant customer resolutions, booked calendar appointments, and qualified sales leads 24 hours a day, 7 days a week.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-surface-white border border-[#EADEC9] p-8 rounded-2xl space-y-4">
            <Bot className="w-10 h-10 text-mint-primary" />
            <h3 className="font-sora text-xl font-bold text-ink">Zero-Wait Receptionist</h3>
            <p className="text-small text-ink-muted leading-relaxed">
              Instantly answer every incoming customer call on the first ring. Deflect routine questions regarding opening hours, service catalogs, or tracking info without human delay.
            </p>
          </div>
          <div className="bg-surface-white border border-[#EADEC9] p-8 rounded-2xl space-y-4">
            <PhoneCall className="w-10 h-10 text-amber-cta" />
            <h3 className="font-sora text-xl font-bold text-ink">Calendar & CRM Booking</h3>
            <p className="text-small text-ink-muted leading-relaxed">
              Connect directly with Google Calendar, Outlook, Salesforce, or HubSpot to schedule appointments, property viewings, or sales demos while live on the call.
            </p>
          </div>
          <div className="bg-surface-white border border-[#EADEC9] p-8 rounded-2xl space-y-4">
            <ShieldCheck className="w-10 h-10 text-mint-primary" />
            <h3 className="font-sora text-xl font-bold text-ink">Warm Human Escalation</h3>
            <p className="text-small text-ink-muted leading-relaxed">
              When complex edge cases arise, the AI voice agent executes a warm transfer to human operators, transferring live audio and conversation summaries in real time.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: Outbound Sales & Lead Qualification */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-caption font-bold text-amber-cta uppercase tracking-widest bg-amber-cta/10 px-4 py-1.5 rounded-full font-mono">
                OUTBOUND OUTREACH CAMPAIGNS
              </span>
              <h2 className="font-sora text-3xl md:text-4xl font-extrabold text-ink">
                Outbound Sales, Lead Qualification & Reactivation
              </h2>
              <p className="text-body text-ink-muted leading-relaxed">
                Contact thousands of leads within seconds of form submission. Our automated phone calling agents verify buyer intent, qualify budgets, send follow-up SMS links, and reactivate cold customer databases with personalized, natural-sounding voice calls.
              </p>
              <div className="space-y-3 font-semibold text-small text-ink">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-mint-primary" /> <span>3-Second Speed-to-Lead Response Times</span></div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-mint-primary" /> <span>Smart Batch Retry Schedules for Busy Lines</span></div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-mint-primary" /> <span>Dynamic Call Disposition & Sentiment Scoring</span></div>
              </div>
            </div>
            <div className="bg-cream-bg border border-[#EADEC9] rounded-2xl p-8 space-y-4">
              <h4 className="font-sora font-bold text-ink text-lg">Outbound Performance Metrics</h4>
              <div className="space-y-4 text-xs font-mono">
                <div className="bg-surface-white p-4 rounded-xl border border-border-soft flex justify-between items-center">
                  <span>Lead Contact Rate</span>
                  <span className="font-bold text-mint-primary text-base">94.2%</span>
                </div>
                <div className="bg-surface-white p-4 rounded-xl border border-border-soft flex justify-between items-center">
                  <span>Average Qualification Time</span>
                  <span className="font-bold text-amber-cta text-base">1m 45s</span>
                </div>
                <div className="bg-surface-white p-4 rounded-xl border border-border-soft flex justify-between items-center">
                  <span>Cost per Qualified Lead</span>
                  <span className="font-bold text-mint-primary text-base">₹6.98</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: Multi-Industry Showroom Cards (12 Verticals Grid) */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
            INDUSTRY SHOWROOM
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-ink">
            Tailored AI Voice Solutions for Every Enterprise Sector
          </h2>
          <p className="text-body text-ink-muted">
            Explore 12 specialized industry verticals optimized with verified workflows, compliance controls, and custom voice personas.
          </p>
        </div>

        <IndustryShowroomGrid />
      </section>

      {/* SECTION 6: Feature Capability Grid (12 Feature Cards) */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-caption font-bold text-amber-cta uppercase tracking-widest bg-amber-cta/10 px-4 py-1.5 rounded-full font-mono">
            PLATFORM CAPABILITIES
          </span>
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-ink">
            12 Enterprise Voice AI Modules Built for Scale
          </h2>
          <p className="text-body text-ink-muted">
            From low latency audio streaming to RAG knowledge bases and warm handoffs, inspect the complete voice AI technology stack.
          </p>
        </div>

        <FeatureCapabilityGrid />
      </section>

      {/* SECTION 7: Enterprise Compliance & Data Privacy */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2">
          <div className="max-w-4xl mx-auto space-y-8 text-center">
            <Lock className="w-16 h-16 text-mint-primary mx-auto" />
            <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-ink">
              Enterprise Compliance, HIPAA, SOC 2 & Data Privacy
            </h2>
            <p className="text-body text-ink-muted leading-relaxed font-plus-jakarta max-w-3xl mx-auto">
              Security is not an afterthought. Clarity Voice implements edge-based PII/PHI data redaction, ensuring payment info, health details, and personal identity credentials are automatically scrubbed before call logs or transcripts reach persistent databases.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <span className="bg-mint-soft border border-mint-primary/30 text-mint-primary font-mono text-xs font-bold px-4 py-2 rounded-full">
                🔒 SOC 2 TYPE II AUDITED
              </span>
              <span className="bg-mint-soft border border-mint-primary/30 text-mint-primary font-mono text-xs font-bold px-4 py-2 rounded-full">
                🏥 HIPAA BAA AVAILABLE
              </span>
              <span className="bg-mint-soft border border-mint-primary/30 text-mint-primary font-mono text-xs font-bold px-4 py-2 rounded-full">
                🛡️ ISO 27001 CERTIFIED
              </span>
              <span className="bg-mint-soft border border-mint-primary/30 text-mint-primary font-mono text-xs font-bold px-4 py-2 rounded-full">
                ⚖️ DPDP ACT & GDPR COMPLIANT
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: Frequently Asked Questions (AEO/GEO) */}
      <section className="px-6 max-w-5xl mx-auto relative z-10 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-ink">
            Frequently Asked Questions
          </h2>
          <p className="text-body text-ink-muted">Everything you need to know about deploying enterprise AI voice calling agents.</p>
        </div>

        <div className="space-y-6">
          {faqSchema.mainEntity.map((item, i) => (
            <div key={i} className="bg-surface-white border border-[#EADEC9] p-8 rounded-2xl space-y-3">
              <h3 className="font-sora text-xl font-bold text-ink">{item.name}</h3>
              <p className="text-small text-ink-muted leading-relaxed font-plus-jakarta">{item.acceptedAnswer.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 max-w-4xl mx-auto text-center py-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-sora text-3xl md:text-5xl font-extrabold text-ink mb-6">
            Transform Your Phone Call Operations Today
          </h2>
          <p className="text-body text-ink-muted mb-10">
            Deploy human-like conversational voice AI agents in under 10 minutes. No setup fees, no minimum contract.
          </p>
          <button onClick={() => setPage("dashboard")} className="btn-cta bg-amber-cta text-surface-white hover:bg-[#d4742e]">
            Build Your First Voice Agent (Free)
            <ArrowRight className="w-5 h-5 ml-2 inline" />
          </button>
        </motion.div>
      </section>
    </div>
  );
}

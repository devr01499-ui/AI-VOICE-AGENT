import { motion } from "motion/react";

type Page = any;
interface FAQProps { setPage: (p: Page) => void; }

const FAQS = [
  {
    q: "What are AI voice calling agents and how do they work?",
    a: "AI voice calling agents are autonomous, conversational software programs that place and receive phone calls using natural human language. Powered by real-time ASR (Automatic Speech Recognition), LLM (Large Language Model), and TTS (Text-to-Speech), Clarity Voice agents achieve sub-180ms latency — making them indistinguishable from human agents. Unlike legacy IVR systems, they understand intent, handle interruptions, and execute workflows dynamically.",
  },
  {
    q: "What is the difference between AI voice agents and IVR systems?",
    a: "Traditional IVR systems force callers through rigid press-key menus. AI voice agents like Clarity Voice converse naturally — they understand spoken language, answer complex questions, handle barge-in interruptions, route intelligently, and escalate with warm transfer. AI call automation replaces the frustrating experience of legacy phone trees.",
  },
  {
    q: "Can Clarity Voice handle outbound AI calling at scale?",
    a: "Yes. Clarity Voice's outbound voice AI platform can launch 10,000+ simultaneous outbound calls with smart retry logic for busy lines. Use cases include lead qualification, COD order verification, appointment reminders, payment collections, and reactivation campaigns — all automated without human agents.",
  },
  {
    q: "Is Clarity Voice HIPAA and PCI-DSS compliant?",
    a: "Yes. Clarity Voice implements edge-level PII/PHI data redaction before any log or transcript is stored. We are SOC 2 Type II audited, HIPAA BAA available on enterprise plans, and PCI-DSS compliant. Our compliance logging and audit trails meet GDPR, ISO 27001, and India's DPDP Act requirements.",
  },
  {
    q: "What languages does Clarity Voice AI phone agents support?",
    a: "Clarity Voice supports 70+ languages and regional dialects natively — including English, Hindi, Bengali, Kannada, Malayalam, Gujarati, Marathi, Tamil, Mandarin, Arabic, and more. Native accent support is built into the speech models, requiring no intermediate translation APIs.",
  },
  {
    q: "How is Clarity Voice priced compared to Vapi, Retell AI, or Bland AI?",
    a: "Clarity Voice offers transparent, flat-rate pricing: ₹3.99/minute pay-as-you-go or bundled plans starting at ₹1,799/month. Competitors like Vapi and Retell charge separately for STT, LLM, and TTS providers — which adds up. Our pricing includes everything in one bundled rate with no hidden costs.",
  },
  {
    q: "Can I integrate Clarity Voice with my CRM, Shopify, or HubSpot?",
    a: "Yes. Clarity Voice provides bi-directional CRM integration with Salesforce, HubSpot, Zoho, and Shopify via real-time REST webhooks. Call disposition, lead scores, appointment bookings, and transcripts sync automatically. We also support Twilio SIP trunking for enterprise telephony integration.",
  },
  {
    q: "What is the setup time for deploying an AI voice agent?",
    a: "Less than 10 minutes. Configure your agent's voice, language, and workflow through our no-code dashboard. Upload your knowledge base — FAQs, CRM data, or product docs. Connect a phone number. Launch. No engineering team required. Our white-label AI voice agent option is also available for agencies.",
  },
];

function SectionLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full font-mono bg-[#D1FAE5] text-[#059669] border border-[#059669]/20">
      <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
      {text}
    </span>
  );
}

export default function FAQ({ setPage }: FAQProps) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQS.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  return (
    <div className="overflow-hidden bg-[#FAF8F5] min-h-screen pt-24 pb-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <section className="px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <SectionLabel text="FAQ" />
          <h2 className="text-4xl font-extrabold text-[#0F172A]"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500">Everything you need to know about deploying enterprise AI voice calling agents, pricing, compliance, and integrations.</p>
        </div>
        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <motion.div key={i}
              className="bg-white border border-[#EADEC9] rounded-2xl p-7 space-y-3 hover:border-[#059669]/30 hover:shadow-md transition-all"
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}>
              <h3 className="font-extrabold text-[#0F172A] text-base">{faq.q}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

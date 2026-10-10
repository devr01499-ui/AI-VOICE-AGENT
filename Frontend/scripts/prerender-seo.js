import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const distDir = path.resolve(__dirname, '../dist');
const indexHtmlPath = path.resolve(distDir, 'index.html');
const topicsFilePath = path.resolve(__dirname, '../src/app/data/voiceAiTopics.ts');

if (!fs.existsSync(indexHtmlPath)) {
  console.error("❌ dist/index.html does not exist. Run vite build first.");
  process.exit(1);
}

const templateHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

// Parse topics from voiceAiTopics.ts
const tsContent = fs.readFileSync(topicsFilePath, 'utf-8');
const topicRegex = /{\s*id:\s*"([^"]+)",\s*title:\s*"([^"]+)"\s*}/g;
const topics = [];
let match;
while ((match = topicRegex.exec(tsContent)) !== null) {
  topics.push({ id: match[1], title: match[2] });
}

// ── Core Static Marketing Pages Metadata ──────────────────────────────────────
const corePages = [
  {
    path: '',
    title: 'Claritiy Voice — Automated AI Voice Calling Platform for Enterprise',
    description: 'Confirm cash-on-delivery (COD) orders before dispatch to reduce RTO and failed deliveries using automated, human-sounding AI voice calls.',
    h1: 'Autonomous Conversational Voice AI for Enterprise Telephony',
    summary: 'Claritiy Voice replaces manual calling queues with sub-180ms conversational AI voice agents across 70+ languages, verifying orders, booking appointments, and recovering revenues automatically.'
  },
  {
    path: 'pricing',
    title: 'Claritiy Voice Pricing — Transparent ₹3.99/min AI Voice Telephony',
    description: 'Predictable, all-inclusive AI voice agent pricing. No hidden fees or separate billing for STT, LLM, or TTS audio pipelines.',
    h1: 'Transparent Pay-As-You-Go & Enterprise Voice AI Pricing',
    summary: 'Deploy production AI voice agents with zero lock-in starting at ₹3.99 per minute. Volume-tiered subscriptions available for high-throughput contact centers.'
  },
  {
    path: 'how-it-works',
    title: 'How Claritiy Voice Works — Real-Time Sub-180ms Audio Telephony Architecture',
    description: 'Explore the full audio pipeline: Automatic Speech Recognition (ASR), LLM orchestration, and zero-latency Text-to-Speech (TTS) SIP streaming.',
    h1: 'Inside the Claritiy Voice Telephony & Speech Synthesis Engine',
    summary: 'Our vertically integrated stack connects SIP trunks directly to ultra-low latency WebRTC media relays, eliminating conversational pause loops.'
  },
  {
    path: 'solutions',
    title: 'Enterprise AI Voice Solutions — BFSI, Healthcare, E-Commerce & Logistics',
    description: 'Pre-built conversational AI workflows designed to eliminate RTO, qualify inbound leads, schedule medical clinic appointments, and collect debt.',
    h1: 'Proven Voice Automation Solutions Across High-Impact Industries',
    summary: 'Automate high-volume voice operations across e-commerce, banking, healthcare clinics, and logistics with deep bi-directional CRM integration.'
  },
  {
    path: 'use-cases',
    title: 'Production Use Case Blueprints & Telephony Architecture — Claritiy Voice',
    description: 'Detailed technical blueprints, call flows, latency metrics, and production templates for enterprise voice AI deployments.',
    h1: 'Production-Grade Voice AI Architecture & Industry Blueprints',
    summary: 'Explore interactive system blueprints, SIP telephony schemas, and pre-built templates for inbound receptionist and outbound outreach pipelines.'
  },
  {
    path: 'voices',
    title: 'HD AI Voice Gallery — 70+ Dialects & Regional Accents | Claritiy Voice',
    description: 'Sample natural, human-grade conversational voices in English, Hindi, and regional dialects with native conversational cadence and emotional tone.',
    h1: 'Hyper-Realistic Conversational AI Voices for Global Telephony',
    summary: 'Explore our studio-grade voice library engineered for real-time phone calls with native regional accents, low latency, and interruption handling.'
  },
  {
    path: 'docs',
    title: 'Developer Documentation & API Reference — Claritiy Voice',
    description: 'REST API, Webhooks, SIP trunking, and SDK reference for dispatching calls, extracting live transcripts, and configuring AI voice agents.',
    h1: 'Developer API, Webhooks & Telephony Integration Guides',
    summary: 'Integrate Claritiy Voice agents into your tech stack via robust REST APIs, real-time WebSocket transcript streams, and secure HMAC webhooks.'
  },
  {
    path: 'faq',
    title: 'Frequently Asked Questions — Claritiy Voice Enterprise Telephony',
    description: 'Answers to common questions about voice AI latency, telephony carrier integration, pricing, compliance, and multi-language support.',
    h1: 'Claritiy Voice Knowledge Base & Telephony FAQs',
    summary: 'Get answers to technical, operational, and billing questions regarding our conversational voice AI platform.'
  },
  {
    path: 'contact',
    title: 'Contact Claritiy Voice — Speak with an Enterprise Telephony Architect',
    description: 'Schedule a discovery call or test our custom sandbox for enterprise voice automation with 10,000+ monthly calls.',
    h1: 'Connect with Claritiy Voice Engineering & Solutions Team',
    summary: 'Speak directly with our voice architects to plan your enterprise rollout, custom telephony integrations, or sandbox trials.'
  },
  {
    path: 'privacy',
    title: 'Privacy Policy — Claritiy Voice Data Protection & DPDP Compliance',
    description: 'Understand how Claritiy Voice protects personal identifiable information (PII), encrypts call audio, and adheres to DPDP and GDPR standards.',
    h1: 'Claritiy Voice Data Privacy, Security & Compliance Policy',
    summary: 'We maintain bank-grade data security with edge PII redaction, TLS 1.3 in-transit encryption, and strict zero-audio-retention options.'
  },
  {
    path: 'terms',
    title: 'Terms of Service — Claritiy Voice Telephony Automation',
    description: 'Terms and conditions governing the use of Claritiy Voice automated calling systems, developer APIs, and software services.',
    h1: 'Claritiy Voice Terms of Service & Acceptable Use Policy',
    summary: 'Review our legal terms, acceptable use requirements, telecommunications compliance standards, and service level commitments.'
  },
  {
    path: 'security',
    title: 'Security Architecture & Compliance Standards — Claritiy Voice',
    description: 'Overview of our SOC2-aligned infrastructure, DPDP compliance, zero-trust network boundaries, and edge data scrubbing.',
    h1: 'Enterprise Security Architecture & Telephony Hardening',
    summary: 'Discover our defense-in-depth security model including edge data scrubbing, encrypted SIP signaling, and verifiable audit trails.'
  },
  {
    path: 'blog',
    title: 'Voice AI & Conversational Telephony Blog — Claritiy Voice',
    description: 'In-depth engineering articles, benchmarks, case studies, and practical guides on scaling conversational AI in production.',
    h1: 'Engineering Insights, Benchmarks & Industry Case Studies',
    summary: 'Read our latest research on voice latency optimization, RTO reduction strategies, and enterprise conversational design.'
  },
  {
    path: 'blog/how-to-reduce-cod-rto',
    title: 'How Indian D2C Brands Cut COD RTO Rates by 40% with AI Voice Calls',
    description: 'A complete operational guide for e-commerce brands on verifying cash-on-delivery orders before dispatch using automated phone calls.',
    h1: 'Reducing Cash-on-Delivery RTO by 40% Using Automated AI Voice Verification',
    summary: 'Learn how automated pre-dispatch confirmation calls identify uncontactable buyers, rectify incomplete delivery addresses, and slash reverse logistics expenses.'
  },
  {
    path: 'blog/healthcare-ai-calling',
    title: 'Automating Clinic Appointments & Patient Intake with AI Voice Agents',
    description: 'How outpatient medical centers and dental practices use conversational AI agents to reduce appointment no-shows and handle intake.',
    h1: 'Transforming Healthcare Clinic Intake with Conversational Voice AI',
    summary: 'Deploy HIPAA-aligned voice agents to confirm appointments, handle rescheduling requests, and streamline after-hours patient inquiries.'
  },
  {
    path: 'blog/fintech-collections-ai',
    title: 'Fintech EMI Pre-Due Reminders & Debt Recovery Automation — Claritiy Voice',
    description: 'How microfinance and NBFC lenders achieve higher recovery rates through empathetic, RBI-aligned conversational voice bots.',
    h1: 'Modernizing Fintech Collections and EMI Reminders with Voice AI',
    summary: 'Automate gentle pre-due reminders and payment coordination with high recovery rates and strict adherence to fair debt collection practices.'
  },
  {
    path: 'voice-ai-index',
    title: 'Voice AI Knowledge Index — 80+ Enterprise Capabilities & Benchmarks',
    description: 'Comprehensive directory of enterprise voice AI architectures, compliance frameworks, benchmarks, and deployment patterns.',
    h1: 'Claritiy Voice AI Index — Comprehensive Architectural Knowledge Base',
    summary: 'Browse all 80+ categorized guides detailing voice agent engineering, latency minimization, carrier integration, and compliance best practices.'
  }
];

// Helper to inject HTML into template
function injectMetadata(html, { url, title, description, h1, summary, bodyHtml, jsonLd }) {
  let updated = html;

  // Replace Title
  updated = updated.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);

  // Replace or Add Description
  if (/<meta name="description"[^>]*>/i.test(updated)) {
    updated = updated.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${description.replace(/"/g, '&quot;')}" />`);
  } else {
    updated = updated.replace('</head>', `  <meta name="description" content="${description.replace(/"/g, '&quot;')}" />\n</head>`);
  }

  // Remove old canonical and inject exact self-referencing canonical
  updated = updated.replace(/<link rel="canonical"[^>]*>/i, '');
  const canonicalTag = `  <link rel="canonical" href="${url}" />\n`;

  // Inject OpenGraph / Twitter tags & Canonical before </head>
  const ogTags = `
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Claritiy Voice" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
${canonicalTag}`;

  let schemaScript = '';
  if (jsonLd) {
    schemaScript = `  <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n  </script>\n`;
  }

  updated = updated.replace('</head>', `${ogTags}${schemaScript}</head>`);

  // Inject semantic crawlable SSR content inside <div id="root">
  const renderedContent = `
    <header style="padding: 1rem; border-bottom: 1px solid #E5E7EB; background: #FFFDF9;">
      <a href="/" style="font-weight: 800; font-size: 1.25rem; color: #0D1117; text-decoration: none;">Claritiy <span style="color: #059669;">Voice</span></a>
    </header>
    <main>
      ${bodyHtml}
    </main>
  `;

  updated = updated.replace('<div id="root"></div>', `<div id="root">${renderedContent}</div>`);

  return updated;
}

// ── 1. Pre-render Core Pages ──────────────────────────────────────────────────
console.log('🚀 Pre-rendering core marketing pages...');
for (const page of corePages) {
  const pageUrl = page.path ? `https://www.claritiy.com/${page.path}` : 'https://www.claritiy.com/';
  const targetDir = page.path ? path.resolve(distDir, page.path) : distDir;
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": page.path.startsWith('blog/') ? "BlogPosting" : (page.path === 'faq' ? "FAQPage" : "WebPage"),
    "name": page.h1,
    "description": page.description,
    "url": pageUrl,
    "publisher": {
      "@type": "Organization",
      "name": "Claritiy Voice",
      "url": "https://www.claritiy.com"
    }
  };

  const bodyHtml = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; font-family: system-ui, -apple-system, sans-serif;">
      <h1 style="font-size: 2.25rem; font-weight: 800; color: #0D1117; margin-bottom: 1rem;">${page.h1}</h1>
      <p style="font-size: 1.125rem; line-height: 1.7; color: #4B5563; margin-bottom: 2rem;">${page.summary}</p>
      <nav style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 2rem; border-top: 1px solid #E5E7EB; padding-top: 1.5rem;">
        <a href="/" style="color: #059669; text-decoration: underline; font-weight: 600;">Home</a>
        <a href="/pricing" style="color: #059669; text-decoration: underline; font-weight: 600;">Pricing</a>
        <a href="/how-it-works" style="color: #059669; text-decoration: underline; font-weight: 600;">How It Works</a>
        <a href="/solutions" style="color: #059669; text-decoration: underline; font-weight: 600;">Solutions</a>
        <a href="/use-cases" style="color: #059669; text-decoration: underline; font-weight: 600;">Use Cases</a>
        <a href="/voices" style="color: #059669; text-decoration: underline; font-weight: 600;">Voices</a>
        <a href="/docs" style="color: #059669; text-decoration: underline; font-weight: 600;">Docs</a>
        <a href="/voice-ai-index" style="color: #059669; text-decoration: underline; font-weight: 600;">Voice AI Index</a>
        <a href="/contact" style="color: #059669; text-decoration: underline; font-weight: 600;">Contact</a>
      </nav>
    </div>
  `;

  const html = injectMetadata(templateHtml, {
    url: pageUrl,
    title: page.title,
    description: page.description,
    h1: page.h1,
    summary: page.summary,
    bodyHtml,
    jsonLd
  });

  const destFile = path.resolve(targetDir, 'index.html');
  fs.writeFileSync(destFile, html, 'utf-8');
}
console.log(`✅ Pre-rendered ${corePages.length} core pages!`);

// ── 2. Pre-render Programmatic Voice AI Index Topics ──────────────────────────
console.log(`🚀 Pre-rendering ${topics.length} programmatic Voice AI Index topics...`);
for (let i = 0; i < topics.length; i++) {
  const topic = topics[i];
  const pageUrl = `https://www.claritiy.com/voice-ai-index/${topic.id}`;
  const targetDir = path.resolve(distDir, `voice-ai-index/${topic.id}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const cleanTitle = topic.title.replace(/[?&]/g, '').trim();
  const metaTitle = `${cleanTitle} | Claritiy Voice AI Index`;
  const metaDesc = `Detailed guide and architecture for ${cleanTitle}. Learn how modern enterprises deploy low-latency, compliant AI voice agents.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": cleanTitle,
    "description": metaDesc,
    "url": pageUrl,
    "inLanguage": "en-US",
    "author": {
      "@type": "Organization",
      "name": "Claritiy Voice Systems Engineering"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Claritiy Voice",
      "url": "https://www.claritiy.com"
    }
  };

  const bodyHtml = `
    <article style="max-width: 900px; margin: 0 auto; padding: 2.5rem 1rem; font-family: system-ui, -apple-system, sans-serif; color: #1F2937;">
      <nav style="margin-bottom: 1.5rem; font-size: 0.875rem;">
        <a href="/" style="color: #059669; text-decoration: none;">Home</a> &gt; 
        <a href="/voice-ai-index" style="color: #059669; text-decoration: none;">Voice AI Index</a> &gt; 
        <span style="color: #6B7280;">${cleanTitle}</span>
      </nav>
      
      <h1 style="font-size: 2.5rem; font-weight: 800; color: #111827; line-height: 1.2; margin-bottom: 1rem;">${cleanTitle}</h1>
      <p style="font-size: 1.125rem; line-height: 1.7; color: #4B5563; font-style: italic; margin-bottom: 2rem;">
        This detailed technical guide covers the strategic implementation, architecture, and business metrics for "${cleanTitle}". We explore how modern enterprises leverage this capability to optimize customer pipelines, ensure high-fidelity delivery, and maintain compliance.
      </p>

      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 0.75rem;">Strategic Context & Market Positioning</h2>
        <p style="line-height: 1.7; margin-bottom: 1rem; color: #374151;">
          In the rapidly evolving landscape of 2026, deploying a robust capability like "${cleanTitle}" has transitioned from a competitive advantage to an operational necessity. Legacy call center systems and traditional interactive voice response (IVR) setups have consistently failed to meet customer expectations, introducing latency, awkward pause loops, and rigid dial-tone scripts. By contrast, modern voice automation platform modules leverage state-of-the-art natural language processing (NLP) to converse fluently with users.
        </p>
        <p style="line-height: 1.7; margin-bottom: 1rem; color: #374151;">
          When enterprises evaluate the implementation of ${cleanTitle.toLowerCase()}, they are deploying an autonomous conversational AI voice system. This integration allows companies to scale inbound call handling capacity and outbound sales calls infinitely, bypassing the constraints of recruiting, training, and managing manual calling agents. Under this paradigm, operational costs plummet while customer satisfaction scores (CSAT) rise.
        </p>
      </section>

      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 0.75rem;">Technical Implementation & Flow Architecture</h2>
        <p style="line-height: 1.7; margin-bottom: 1rem; color: #374151;">
          From an engineering perspective, building an elite voice infrastructure for "${cleanTitle}" requires a vertically integrated pipeline. The voice stack is split into three core layers: Automatic Speech Recognition (ASR), Large Language Model orchestration (LLM), and Text-to-Speech synthesis (TTS). Claritiy Voice achieves sub-180ms latency by streaming audio packets over WebRTC directly connected to our agent workflow engine.
        </p>
        <pre style="background: #111827; color: #E5E7EB; padding: 1.25rem; border-radius: 0.75rem; overflow-x: auto; font-size: 0.875rem;"><code>{
  "agent_id": "agent_claritiy_voice_${topic.id}",
  "capabilities": ["sub_180ms_latency", "webrtc_media_relay", "pii_protection"],
  "telephony_pipeline": {
    "asr": "native_multilingual",
    "llm": "gemini_2_5_flash_audio",
    "tts": "claritiy_hd_cadence"
  }
}</code></pre>
      </section>

      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 0.75rem;">Compliance, Security & Audit Logs</h2>
        <p style="line-height: 1.7; margin-bottom: 1rem; color: #374151;">
          Regulated industries such as healthcare clinics, financial banking, and insurance carriers require absolute adherence to strict compliance guidelines. Deploying "${cleanTitle}" necessitates a security-first posture that integrates edge-based data redaction. Before any audio transcript or call recording is saved, the PII protection engine scrubs credit card numbers, personal health identifiers (PHI), and contact numbers.
        </p>
      </section>

      <section style="margin-bottom: 2.5rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 0.75rem;">Business Impact & ROI Metrics</h2>
        <ul style="padding-left: 1.5rem; line-height: 1.8; color: #374151;">
          <li>First-Ring Response Rate: 100% call answering with 0s customer wait time.</li>
          <li>RTO Reduction: Up to 40% reduction in Cash-on-Delivery return-to-origin rates.</li>
          <li>No-Show Reduction: 89% lower appointment no-show rates via automated scheduling.</li>
          <li>Cost Deflection: 60% of tier-1 support queries handled without human escalation.</li>
        </ul>
      </section>

      <footer style="border-top: 1px solid #E5E7EB; padding-top: 1.5rem; margin-top: 2rem;">
        <h3 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 1rem;">Explore Related Voice AI Index Topics</h3>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          ${topics.slice(Math.max(0, i - 2), Math.min(topics.length, i + 3)).map(t => 
            `<a href="/voice-ai-index/${t.id}" style="padding: 0.5rem 0.875rem; background: #F3F4F6; color: #059669; border-radius: 0.5rem; text-decoration: none; font-size: 0.875rem; font-weight: 500;">${t.title}</a>`
          ).join('\n          ')}
        </div>
      </footer>
    </article>
  `;

  const html = injectMetadata(templateHtml, {
    url: pageUrl,
    title: metaTitle,
    description: metaDesc,
    h1: cleanTitle,
    summary: metaDesc,
    bodyHtml,
    jsonLd
  });

  const destFile = path.resolve(targetDir, 'index.html');
  fs.writeFileSync(destFile, html, 'utf-8');
}

console.log(`🎉 Complete! All ${corePages.length} core pages and ${topics.length} programmatic topics pre-rendered successfully!`);

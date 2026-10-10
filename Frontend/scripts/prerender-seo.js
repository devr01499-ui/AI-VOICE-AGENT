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
  },
  {
    path: 'ai-voice-agent-software',
    title: 'AI Voice Agent Software — Deploy Human-Sounding Phone Agents | Claritiy Voice',
    description: 'Deploy autonomous conversational AI voice agent software with sub-180ms latency, native regional accents, and seamless CRM integrations. Flat ₹3.99/min.',
    h1: 'Enterprise AI Voice Agent Software Engineered for Real Conversations',
    summary: 'Claritiy Voice delivers production-grade conversational telephony agents that answer inbound calls, verify outbound cash-on-delivery orders, book clinic appointments, and collect payments with zero conversational lag.',
    customBody: `
      <div style="max-width: 1100px; margin: 0 auto; padding: 2.5rem 1rem; font-family: system-ui, -apple-system, sans-serif; color: #1F2937; line-height: 1.75;">
        <nav style="margin-bottom: 2rem; font-size: 0.875rem;">
          <a href="/" style="color: #059669; text-decoration: none; font-weight: 600;">Home</a> &gt; 
          <a href="/solutions" style="color: #059669; text-decoration: none; font-weight: 600;">Solutions</a> &gt; 
          <span style="color: #6B7280;">AI Voice Agent Software</span>
        </nav>

        <header style="margin-bottom: 3rem;">
          <span style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-family: monospace; font-weight: 700; text-transform: uppercase;">
            Enterprise Telephony Software
          </span>
          <h1 style="font-size: 2.75rem; font-weight: 800; color: #0D1117; margin-top: 1rem; margin-bottom: 1.25rem; line-height: 1.15;">
            Enterprise AI Voice Agent Software Engineered for Real Conversations
          </h1>
          <p style="font-size: 1.2rem; color: #4B5563; line-height: 1.7; max-width: 900px;">
            Replace outdated interactive voice response (IVR) phone trees and high-turnover manual call centers with autonomous conversational voice agents. Claritiy Voice delivers verified sub-180ms turn-taking latency, native regional dialect support across 70+ languages, and deterministic bi-directional CRM execution—at a predictable, transparent flat rate of ₹3.99 per minute.
          </p>
          <div style="display: flex; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap;">
            <a href="/dashboard" style="background: #059669; color: white; padding: 0.875rem 1.75rem; border-radius: 0.75rem; text-decoration: none; font-weight: 700; font-size: 1rem;">Launch Free Sandbox</a>
            <a href="/pricing" style="background: white; color: #0D1117; border: 1px solid #D1D5DB; padding: 0.875rem 1.75rem; border-radius: 0.75rem; text-decoration: none; font-weight: 600; font-size: 1rem;">View Flat ₹3.99/min Pricing</a>
          </div>
        </header>

        <section style="margin-bottom: 3.5rem; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 1rem; padding: 2rem;">
          <h2 style="font-size: 1.75rem; font-weight: 800; color: #111827; margin-bottom: 1rem;">What is AI Voice Agent Software?</h2>
          <p style="margin-bottom: 1rem;">
            <strong>AI Voice Agent Software</strong> is an enterprise software platform that enables computers to engage in natural, bi-directional spoken telephone conversations with human callers. Unlike legacy automated dialing tools or pre-recorded IVR phone trees ("Press 1 for Support, Press 2 for Billing"), an AI voice agent listens actively, comprehends spoken intent in real time, respects interruptions (barge-in), and retrieves or updates database records mid-call.
          </p>
          <p>
            By combining real-time Automatic Speech Recognition (ASR), multi-turn reasoning with Large Language Models (LLM), and low-latency Text-to-Speech (TTS) synthesis over WebRTC and SIP networks, organizations automate high-volume phone operations without recruiting, onboarding, or managing massive call center teams.
          </p>
        </section>

        <section style="margin-bottom: 3.5rem;">
          <h2 style="font-size: 2rem; font-weight: 800; color: #111827; margin-bottom: 1.25rem;">Why Traditional Call Centers and Legacy Bots Fail</h2>
          <p style="margin-bottom: 1.25rem;">
            For decades, customer-facing organizations have been trapped between two bad options: expensive, high-turnover human call centers or rigid, customer-hostile IVR dialers.
          </p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
            <div style="background: white; border: 1px solid #E5E7EB; border-radius: 0.75rem; padding: 1.5rem;">
              <h3 style="font-size: 1.125rem; font-weight: 700; color: #DC2626; margin-bottom: 0.5rem;">The Human BPO Bottleneck</h3>
              <p style="font-size: 0.95rem; color: #4B5563;">
                Human agents cost between ₹18.00 and ₹25.00 per productive minute. Industry attrition averages 45% annually, meaning your business is constantly retraining staff while dealing with inconsistent script adherence and zero after-hours coverage.
              </p>
            </div>
            <div style="background: white; border: 1px solid #E5E7EB; border-radius: 0.75rem; padding: 1.5rem;">
              <h3 style="font-size: 1.125rem; font-weight: 700; color: #DC2626; margin-bottom: 0.5rem;">The Awkward 1.5s API Latency Loop</h3>
              <p style="font-size: 0.95rem; color: #4B5563;">
                First-generation voice AI wrappers stitch together separate REST APIs (Twilio + Deepgram + OpenAI + ElevenLabs). Each roundtrip across distinct cloud providers introduces 800ms to 1,500ms of lag, resulting in unnatural pauses where callers talk over the bot.
              </p>
            </div>
          </div>
        </section>

        <section style="margin-bottom: 3.5rem;">
          <h2 style="font-size: 2rem; font-weight: 800; color: #111827; margin-bottom: 1.25rem;">The Claritiy Voice Architectural Engine: Sub-180ms Latency</h2>
          <p style="margin-bottom: 1.25rem;">
            Claritiy Voice eliminates the conversational delay problem through a vertically integrated speech-to-speech pipeline. By streaming zero-copy 16kHz audio directly over UDP WebRTC relays rather than HTTP REST hops, our system achieves turn-taking in under 180 milliseconds—matching native human conversational cadence.
          </p>
          <pre style="background: #111827; color: #E5E7EB; padding: 1.5rem; border-radius: 0.75rem; overflow-x: auto; font-family: monospace; font-size: 0.875rem;"><code>// Claritiy Voice Sub-180ms WebRTC Session Configuration
{
  "telephony_transport": "WebRTC_SRTP_UDP",
  "codec": "audio/x-l16; rate=16000",
  "turn_taking_latency_ms": 174,
  "barge_in_detection_window_ms": 20,
  "edge_pii_redaction": ["credit_card", "aadhaar_uid", "phi_records"],
  "pricing": {
    "currency": "INR",
    "rate_per_minute": 3.99,
    "model": "all_inclusive_no_token_markup"
  }
}</code></pre>
        </section>

        <section style="margin-bottom: 3.5rem;">
          <h2 style="font-size: 2rem; font-weight: 800; color: #111827; margin-bottom: 1.25rem;">High-Impact Enterprise Use Cases</h2>
          
          <div style="margin-bottom: 2rem; border-left: 4px solid #059669; padding-left: 1.5rem;">
            <h3 style="font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem;">1. E-Commerce Cash-on-Delivery (COD) Order Confirmation</h3>
            <p style="color: #4B5563; margin-bottom: 0.5rem;">
              In emerging markets like India, 60% of online purchases use cash-on-delivery, suffering Return-to-Origin (RTO) rates of 25% to 40%. Claritiy Voice calls customers within 60 seconds of checkout, verifies delivery addresses, confirms intent, and offers instant UPI pre-payment discounts via SMS link.
            </p>
            <p style="font-size: 0.9rem; font-weight: 600; color: #059669;">Typical Result: 35% to 42% reduction in RTO losses, saving lakhs in reverse courier fees.</p>
          </div>

          <div style="margin-bottom: 2rem; border-left: 4px solid #059669; padding-left: 1.5rem;">
            <h3 style="font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem;">2. Healthcare & Dental Clinic Patient Intake</h3>
            <p style="color: #4B5563; margin-bottom: 0.5rem;">
              Over 30% of incoming patient calls occur after clinic hours or during busy front-desk triage, resulting in missed appointments. Claritiy Voice acts as a 24/7 intelligent receptionist, booking appointments directly on Google Calendar or EHR systems and delivering automated confirmation calls.
            </p>
            <p style="font-size: 0.9rem; font-weight: 600; color: #059669;">Typical Result: 89% decrease in patient no-show rates with zero front-desk overtime.</p>
          </div>

          <div style="margin-bottom: 2rem; border-left: 4px solid #059669; padding-left: 1.5rem;">
            <h3 style="font-size: 1.35rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem;">3. BFSI & Fintech EMI Debt Collection</h3>
            <p style="color: #4B5563; margin-bottom: 0.5rem;">
              Recovering overdue microfinance installments requires strict compliance with RBI Fair Practices. Claritiy Voice delivers empathetic, polite reminders before due dates, logs Promise-to-Pay (PTP) commitments to the lending core, and sends instant payment links over WhatsApp.
            </p>
            <p style="font-size: 0.9rem; font-weight: 600; color: #059669;">Typical Result: 28% higher early-bucket resolution rates with zero compliance violations.</p>
          </div>
        </section>

        <section style="margin-bottom: 3.5rem; background: #F3F4F6; border-radius: 1rem; padding: 2rem;">
          <h2 style="font-size: 1.75rem; font-weight: 800; color: #111827; margin-bottom: 1rem;">Cost Analysis: Claritiy Voice vs. Traditional Calling</h2>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
            <thead>
              <tr style="border-bottom: 2px solid #D1D5DB;">
                <th style="padding: 0.75rem 0.5rem; font-weight: 700;">Dimension</th>
                <th style="padding: 0.75rem 0.5rem; font-weight: 700; color: #059669;">Claritiy Voice AI</th>
                <th style="padding: 0.75rem 0.5rem; font-weight: 700; color: #4B5563;">Human BPO Center</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #E5E7EB;">
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">Cost per Minute</td>
                <td style="padding: 0.75rem 0.5rem; color: #059669; font-weight: 700;">₹3.99 flat</td>
                <td style="padding: 0.75rem 0.5rem;">₹18.00 – ₹25.00</td>
              </tr>
              <tr style="border-bottom: 1px solid #E5E7EB;">
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">Concurrency Scale</td>
                <td style="padding: 0.75rem 0.5rem; color: #059669; font-weight: 700;">1,000+ simultaneous calls</td>
                <td style="padding: 0.75rem 0.5rem;">1 call per physical seat</td>
              </tr>
              <tr style="border-bottom: 1px solid #E5E7EB;">
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">Operating Hours</td>
                <td style="padding: 0.75rem 0.5rem; color: #059669; font-weight: 700;">24/7/365 uninterrupted</td>
                <td style="padding: 0.75rem 0.5rem;">8-9 hour shifts + shift churn</td>
              </tr>
              <tr>
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">Script Consistency</td>
                <td style="padding: 0.75rem 0.5rem; color: #059669; font-weight: 700;">100% deterministic adherence</td>
                <td style="padding: 0.75rem 0.5rem;">Variable / human fatigue</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style="margin-bottom: 3.5rem;">
          <h2 style="font-size: 2rem; font-weight: 800; color: #111827; margin-bottom: 1.25rem;">Frequently Asked Questions</h2>
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem;">How natural do Claritiy Voice agents sound?</h3>
            <p style="color: #4B5563;">Our voice agents leverage neural acoustic models trained specifically on Indian and global accents, reproducing natural conversational cadence, breathing pauses, and sub-20ms barge-in interruption handling.</p>
          </div>
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem;">Is the software compliant with data privacy regulations?</h3>
            <p style="color: #4B5563;">Yes. Claritiy Voice is aligned with India's DPDP Act and enterprise telecom standards. All sensitive identifiers (credit cards, Aadhaar numbers, health notes) are masked at the edge before audio or transcripts are logged.</p>
          </div>
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem;">How quickly can my team go live?</h3>
            <p style="color: #4B5563;">You can deploy a pre-built template from our library in under 10 minutes. Custom REST API and CRM webhook integrations take less than an afternoon using our standard JSON payload schemas.</p>
          </div>
        </section>

        <footer style="background: #0D1117; color: white; padding: 2.5rem; border-radius: 1rem; text-align: center;">
          <h2 style="font-size: 1.75rem; font-weight: 800; margin-bottom: 1rem;">Experience Autonomous Telephony in Our Free Sandbox</h2>
          <p style="color: #9CA3AF; margin-bottom: 1.5rem; max-width: 600px; margin-left: auto; margin-right: auto;">
            Test phone calls with sub-180ms latency today. No credit card required.
          </p>
          <a href="/dashboard" style="background: #10B981; color: #0D1117; padding: 0.875rem 2rem; border-radius: 0.75rem; text-decoration: none; font-weight: 800; font-size: 1rem;">
            Start Free in Sandbox &rarr;
          </a>
        </footer>
      </div>
    `
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

  const bodyHtml = page.customBody || `
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

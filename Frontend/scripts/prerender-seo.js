import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const distDir = path.resolve(__dirname, '../dist');
const indexHtmlPath = path.resolve(distDir, 'index.html');
const topicsFilePath = path.resolve(__dirname, '../src/app/data/voiceAiTopics.ts');
const SITE = 'https://www.claritiy.com';

if (!fs.existsSync(indexHtmlPath)) {
  console.error("❌ dist/index.html does not exist. Run vite build first.");
  process.exit(1);
}

const templateHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

// Titles, descriptions and H1s shared with App.tsx so crawlers and users see the same (audit #134).
const SEO_PAGES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/app/data/seoPages.json'), 'utf-8')).pages;

// The Voice AI Index article text, shared with pages/VoiceAIIndex.tsx so crawlers and users read the
// same words (audit #138: the old copy here had unverified claims and an internal model id, #137).
const ARTICLE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/app/data/voiceAiArticle.json'), 'utf-8'));
const escHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fillArticle = (text, topic, title) => String(text).split('{title}').join(title).split('{titleLower}').join(title.toLowerCase()).split('{id}').join(topic.id);

// The product guide (/guide), shared with pages/Guide.tsx.
const GUIDE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/app/data/guideContent.json'), 'utf-8'));

// Plan facts come from lib/plans.ts (checked against the server by test:marketing-claims), never typed here.
const PLANS_TS = fs.readFileSync(path.resolve(__dirname, '../src/app/lib/plans.ts'), 'utf-8');
const PLANS = [...PLANS_TS.matchAll(/name: '(\w+)', price: (\d+), minutes: (\d+), maxConcurrentCalls: (\d+),\s*kbDocuments: (\d+)/g)]
  .map((m) => ({ name: m[1], price: +m[2], minutes: +m[3], concurrency: +m[4], kbDocuments: +m[5] }));
/** Same wording as the app (lib/plans.ts concurrencyText). */
const callsAtOnce = (n) => (n <= 1 ? 'one call at a time' : `up to ${n} calls at once`);
const VALIDITY_DAYS = +((PLANS_TS.match(/PLAN_VALIDITY_DAYS = (\d+)/) || [])[1]);
const GRACE_DAYS = +((PLANS_TS.match(/NUMBER_RELEASE_GRACE_DAYS = (\d+)/) || [])[1]);
if (PLANS.length !== 3 || !VALIDITY_DAYS || !GRACE_DAYS) {
  throw new Error(`prerender-seo: could not read the plans from lib/plans.ts (found ${PLANS.length}); refusing to publish wrong prices.`);
}
const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const LOWEST = PLANS[0];
const FACTS = {
  plans: PLANS.map((p) => `${p.name} ${inr(p.price)} for ${p.minutes.toLocaleString('en-IN')} minutes`).join(', '),
  lowestPlan: `from ${inr(LOWEST.price)} for ${LOWEST.minutes.toLocaleString('en-IN')} minutes`,
  kbDocs: `${PLANS.map((p) => p.kbDocuments.toLocaleString('en-IN')).join(', ')} documents on ${PLANS.map((p) => p.name).join(', ')}`,
  validity: String(VALIDITY_DAYS),
  grace: String(GRACE_DAYS),
};
const fill = (text) => String(text).replace(/\{(\w+)\}/g, (m, key) => FACTS[key] ?? m);

// The FAQ page's questions and answers, read from pages/FAQ.tsx so the FAQPage schema lists exactly
// what the page shows (audit #122: the schema had no mainEntity, which makes it invalid).
const FAQ_ITEMS = [...fs.readFileSync(path.resolve(__dirname, '../src/app/pages/FAQ.tsx'), 'utf-8')
  .matchAll(/q:\s*"((?:[^"\\]|\\.)*)",\s*a:\s*"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => ({ q: JSON.parse('"' + m[1] + '"'), a: JSON.parse('"' + m[2] + '"') }));

// Parse topics from voiceAiTopics.ts
const tsContent = fs.readFileSync(topicsFilePath, 'utf-8');
const topicRegex = /{\s*id:\s*"([^"]+)",\s*title:\s*"([^"]+)"\s*}/g;
const topics = [];
let match;
while ((match = topicRegex.exec(tsContent)) !== null) {
  topics.push({ id: match[1], title: match[2] });
}

// ── Shared facts (one place, used on several pages) ──────────────────────────
const LANGUAGES = 'English, Hindi, Bengali, Kannada, Malayalam, Gujarati and Tamil, plus automatic language detection (Hinglish included)';
const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'Claritiy Voice',
  url: SITE,
  logo: `${SITE}/logo.png`,
  email: 'support@claritiy.com',
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', telephone: '+91-9707337259', email: 'support@claritiy.com', areaServed: 'IN', availableLanguage: ['English', 'Hindi'] }],
  sameAs: ['https://www.linkedin.com/company/claritiy/'],
};
const SOFTWARE = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE}/#software`,
  name: 'Claritiy Voice',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE,
  description: `AI voice agents that answer and place phone calls for Indian businesses in ${LANGUAGES}: appointment booking, COD order confirmation, payment reminders, lead qualification and customer support.`,
  publisher: { '@id': `${SITE}/#organization` },
  offers: PLANS.map((p) => ({ '@type': 'Offer', name: `${p.name} plan`, price: String(p.price), priceCurrency: 'INR', description: `${p.minutes.toLocaleString('en-IN')} calling minutes valid ${VALIDITY_DAYS} days, one-time payment, one local +91 number after KYC, ${callsAtOnce(p.concurrency)}` })),
};

const a = (href, text) => `<a href="${href}" style="color: #059669; font-weight: 600;">${text}</a>`;
const ul = (items) => `<ul style="padding-left: 1.25rem; line-height: 1.8; color: #374151;">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const h2 = (t) => `<h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin: 2rem 0 0.75rem;">${t}</h2>`;
const p = (t) => `<p style="font-size: 1.05rem; line-height: 1.75; color: #374151; margin-bottom: 1rem;">${t}</p>`;
const wrap = (inner) => `<div style="max-width: 1000px; margin: 0 auto; padding: 2rem 1rem; font-family: system-ui, -apple-system, sans-serif;">${inner}</div>`;
const NAV_LINKS = [['/', 'Home'], ['/guide', 'Product guide'], ['/pricing', 'Pricing'], ['/how-it-works', 'How it works'], ['/solutions', 'Solutions'], ['/use-cases', 'Use cases'], ['/voices', 'Voices'], ['/faq', 'FAQ'], ['/docs', 'Developer docs'], ['/blog', 'Blog'], ['/contact', 'Contact']];
const navLinks = () => `<nav style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 2rem; border-top: 1px solid #E5E7EB; padding-top: 1.5rem;">${NAV_LINKS.map(([href, text]) => a(href, text)).join('\n')}</nav>`;
const planList = () => ul(PLANS.map((pl) => `<strong>${pl.name}</strong>: ${inr(pl.price)} for ${pl.minutes.toLocaleString('en-IN')} minutes (${inr(Math.round((pl.price / pl.minutes) * 100) / 100)} per minute effective), ${callsAtOnce(pl.concurrency)}, ${pl.kbDocuments.toLocaleString('en-IN')} knowledge-base documents`));

// ── Core Static Marketing Pages ──────────────────────────────────────────────
// title / description / h1 always come from seoPages.json; `summary` is the crawlable intro.
const corePages = [
  {
    path: '',
    summary: `Claritiy Voice gives Indian businesses AI voice agents that pick up and place phone calls in ${LANGUAGES}. A clinic can have every call answered and appointments booked; a D2C brand can confirm cash-on-delivery orders before dispatch; a lender can send polite EMI reminders.`,
    customBody: () => wrap(`
      <h1 style="font-size: 2.25rem; font-weight: 800; color: #0D1117; margin-bottom: 1rem;">${escHtml(SEO_PAGES[''].h1)}</h1>
      ${p(`Claritiy Voice gives Indian businesses AI voice agents that pick up and place phone calls in ${LANGUAGES}. You describe the job in plain words, connect your own +91 number, and the agent talks to your customers, books appointments, confirms orders and writes everything down.`)}
      ${h2('What the agents do')}
      ${ul([
        'Answer inbound calls on your number, day and night, and book appointments on Google Calendar.',
        'Place outbound calls one by one or as batch campaigns of up to 5,000 contacts, only between 9 am and 9 pm IST.',
        'Answer questions from your own documents (price lists, policies, FAQs) through a built-in knowledge base.',
        'Send every finished call, with its outcome, extracted details and transcript, to your systems through signed webhooks.',
        'Label call outcomes, score call quality and alert you when something goes wrong.',
      ])}
      ${h2('Who uses it')}
      ${ul([
        `${a('/use-cases/healthcare', 'Clinics and hospitals')}: receptionist calls, appointment booking and reminders.`,
        `${a('/use-cases/ecommerce', 'D2C and e-commerce brands')}: cash-on-delivery order confirmation before dispatch.`,
        `${a('/use-cases/finance', 'Lenders and NBFCs')}: EMI due-date reminders with identity checks.`,
        `${a('/use-cases/realestate', 'Real estate')}: calling new enquiries and qualifying buyers.`,
      ])}
      ${h2('Pricing')}
      ${p(`One-time minute plans, valid ${VALIDITY_DAYS} days, with no subscription and no per-service fees. Each plan includes one local +91 number after KYC.`)}
      ${planList()}
      ${h2('Getting started')}
      ${p(`Creating an account and building agents is free, and you can chat with your agent before you pay. The ${a('/guide', 'product guide')} shows every step with screenshots.`)}
      ${navLinks()}
    `),
    jsonLd: () => [ORGANIZATION, { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'Claritiy Voice', url: SITE, publisher: { '@id': `${SITE}/#organization` }, inLanguage: 'en-IN' }, SOFTWARE],
  },
  {
    path: 'pricing',
    summary: `One-time minute plans valid ${VALIDITY_DAYS} days: ${FACTS.plans}. Each plan includes one local +91 number after KYC, speech, AI and telephony in the minute price, and no auto-renewal.`,
    customBody: () => wrap(`
      <h1 style="font-size: 2.25rem; font-weight: 800; color: #0D1117; margin-bottom: 1rem;">${escHtml(SEO_PAGES.pricing.h1)}</h1>
      ${p(`Every plan is a one-time pack of calling minutes, valid ${VALIDITY_DAYS} days. Speech, AI and telephony are all in the minute price, and there is no subscription, overage or separate per-service fee.`)}
      ${planList()}
      ${h2('How minutes are counted')}
      ${p('Each answered call uses its started minutes, with a minimum of one minute: a 1 minute 35 second call uses 2 minutes. Calls that are never answered use nothing.')}
      ${h2('What every plan includes')}
      ${ul(['One local +91 business number after KYC', `${LANGUAGES}`, 'Prompt studio, visual flow builder and 17 agent templates', 'Knowledge base, batch campaigns, call recording (off by default) and analytics', 'REST API, signed webhooks and Google Calendar booking'])}
      ${p(`A plan ends when its minutes are used up or after ${VALIDITY_DAYS} days, whichever comes first. Your number is kept for ${GRACE_DAYS} days after that so you can renew. GST is shown on your invoice.`)}
      ${h2('Pricing questions')}
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">Can I try Claritiy Voice before I pay?</h3>
      ${p('Yes. Creating an account, building agents and chatting with them in Test LLM is free. Real phone calls, Test Lab practice callers and Prompt Coach start when you buy a plan.')}
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">Which plan should I choose?</h3>
      ${p(`Start with ${PLANS[0].name} if you are testing one use case, such as a clinic receptionist. ${PLANS[1].name} suits teams running daily campaigns, and ${PLANS[2].name} suits high volumes${PLANS[2].concurrency > 1 ? ` or more calls at the same time (up to ${PLANS[2].concurrency})` : ''}.`)}
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">Is there a subscription or overage charge?</h3>
      ${p('No. Each plan is a one-time payment. When the minutes run out, calls stop until you buy another plan; nothing is charged automatically.')}
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">How do I pay?</h3>
      ${p('Choose a plan in the dashboard and pay securely through Razorpay. Minutes are added as soon as the payment is confirmed.')}
      ${navLinks()}
    `),
    jsonLd: () => [SOFTWARE],
  },
  { path: 'how-it-works', summary: 'During a call, the phone network streams the caller\'s audio to a speech-to-speech AI model, the agent follows your instructions and your knowledge base, and the finished call (transcript, outcome and extracted details) reaches your dashboard and your systems.' },
  { path: 'solutions', summary: 'Ready-made agent workflows for clinics, D2C brands, lenders, real estate, logistics and support teams: what the agent says, what it checks, and what it sends to your systems after the call.' },
  { path: 'use-cases', summary: 'Call flows and agent templates for healthcare, finance, e-commerce, real estate, insurance, logistics, BPO and SaaS teams, with the steps each call follows.' },
  { path: 'voices', summary: `30 AI voices, male and female, that speak ${LANGUAGES}. Pick a voice per agent in the agent editor and hear it before you choose.` },
  { path: 'docs', summary: 'Use the REST API to place calls and read transcripts, and receive every finished call on your server through webhooks signed with HMAC-SHA256 (X-Claritiy-Signature).' },
  { path: 'faq', summary: 'Answers about pricing and minutes, languages, KYC and phone numbers, call recording and consent, TRAI calling hours, integrations and how to get started.' },
  { path: 'contact', summary: 'Talk to the Claritiy Voice team on WhatsApp (+91 97073 37259) or by email (support@claritiy.com) about your calls, numbers and setup.' },
  { path: 'privacy', summary: 'How we handle personal data: TLS encryption in transit, encrypted storage of sensitive credentials, optional PII redaction in transcripts, and call recording only when you switch it on, with a spoken notice and a retention period.' },
  { path: 'terms', summary: 'The terms that govern use of the Claritiy Voice platform, its calling services and the one-time minute plans.' },
  { path: 'security', summary: 'How call data is protected: TLS encryption in transit, encrypted credentials, team roles and access control, audit logs, PII redaction options and automatic data retention.' },
  { path: 'blog', summary: 'Practical guides for Indian businesses on order confirmation calls, clinic scheduling and payment reminders with AI voice agents.' },
  { path: 'blog/how-to-reduce-cod-rto', summary: 'A practical guide to confirming cash-on-delivery orders with an automated call before dispatch: what to ask, when to call, and how to act on the answer.' },
  { path: 'blog/healthcare-ai-calling', summary: 'How clinics use AI voice agents to answer every call, book appointments on the clinic calendar and remind patients, without giving medical advice.' },
  { path: 'blog/fintech-collections-ai', summary: 'How lenders send polite EMI due-date reminders with AI voice agents: identity checks first, calls only in permitted hours, and a clear record of every call.' },
  { path: 'voice-ai-index', summary: 'Short guides to how AI voice agents handle calling, compliance, integrations and industry use cases.' },
  {
    path: 'ai-voice-agent-software',
    summary: `AI voice agent software for Indian businesses: natural phone conversations in ${LANGUAGES}, on your own +91 number, with plans ${FACTS.lowestPlan}.`,
    customBody: () => wrap(`
      <nav style="margin-bottom: 1.5rem; font-size: 0.875rem;">${a('/', 'Home')} &gt; ${a('/solutions', 'Solutions')} &gt; <span style="color: #6B7280;">AI Voice Agent Software</span></nav>
      <h1 style="font-size: 2.5rem; font-weight: 800; color: #0D1117; margin-bottom: 1rem; line-height: 1.15;">${escHtml(SEO_PAGES['ai-voice-agent-software'].h1)}</h1>
      ${p(`Claritiy Voice is AI voice agent software for Indian businesses. Your agent answers and places real phone calls in ${LANGUAGES}, follows the instructions you write in plain words, and answers from your own documents.`)}
      ${h2('What is an AI voice agent?')}
      ${p('An AI voice agent is software that holds a real phone conversation. Unlike an IVR menu ("press 1 for sales"), it listens to what the caller says, understands the request, lets the caller interrupt, and replies in natural speech. It can look up facts in your knowledge base, book a slot on your calendar, and record the outcome when the call ends.')}
      ${h2('How Claritiy Voice handles a call')}
      ${p('The phone network streams the call audio to a single speech-to-speech AI model, so the agent hears and answers without separate speech-to-text and text-to-speech steps. When the call ends, the transcript, the outcome and any details you asked it to collect appear in your dashboard and can be sent to your systems through a signed webhook.')}
      ${h2('What businesses use it for')}
      ${ul([
        '<strong>Cash-on-delivery confirmation</strong>: call each COD buyer before dispatch to confirm the order, the address and a good delivery time.',
        '<strong>Clinic receptionist</strong>: answer calls, share timings and fees from your documents, and book appointments on Google Calendar.',
        '<strong>EMI reminders</strong>: remind borrowers before the due date, after checking who is on the line.',
        '<strong>Lead qualification</strong>: call new enquiries, ask your qualifying questions and label the result.',
      ])}
      ${h2('Pricing')}
      ${p(`One-time minute plans valid ${VALIDITY_DAYS} days, each with a local +91 number after KYC:`)}
      ${planList()}
      ${h2('Questions')}
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">How long does it take to set up?</h3>
      ${p('Most teams have a working agent the same day: pick one of 17 templates, adjust the instructions, upload your documents and test it in the browser. Real calls start once your plan, KYC and number are in place.')}
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">Does it work with my CRM?</h3>
      ${p('Yes, through webhooks and custom API functions: the agent can call your APIs during a call, and every finished call can be sent to your system. Google Calendar is connected natively.')}
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">Is call recording on?</h3>
      ${p('Only if you switch it on for an agent. Callers then hear a short notice, and recordings are deleted after 90 days at the latest, or sooner if you set a shorter retention period.')}
      ${p(`${a('/dashboard', 'Create a free account')} or read the ${a('/guide', 'product guide')} first.`)}
      ${navLinks()}
    `),
    jsonLd: () => [SOFTWARE],
  },
  {
    path: 'guide',
    summary: GUIDE.intro[0],
    customBody: () => {
      const sections = GUIDE.groups.flatMap((g) => g.sections.map((id) => ({ id, group: g.title, ...GUIDE.sections[id] })));
      return wrap(`
        <nav style="margin-bottom: 1.5rem; font-size: 0.875rem;">${a('/', 'Home')} &gt; <span style="color: #6B7280;">Product guide</span></nav>
        <h1 style="font-size: 2.25rem; font-weight: 800; color: #0D1117; margin-bottom: 1rem;">${escHtml(SEO_PAGES.guide.h1)}</h1>
        ${GUIDE.intro.map((t) => p(escHtml(t))).join('')}
        ${h2(escHtml(GUIDE.quickStart.title))}
        ${p(escHtml(GUIDE.quickStart.lead))}
        <ol style="padding-left: 1.25rem; line-height: 1.8; color: #374151;">${GUIDE.quickStart.steps.map((s) => `<li><strong>${escHtml(s.name)}.</strong> ${escHtml(fill(s.text))}</li>`).join('')}</ol>
        ${sections.map((s) => `
        <section id="${s.id}">
          ${h2(escHtml(s.title))}
          <p style="font-size: 0.85rem; color: #6B7280;">${escHtml(s.where)}</p>
          ${p(escHtml(fill(s.lead)))}
          <ol style="padding-left: 1.25rem; line-height: 1.8; color: #374151;">${s.steps.map((st) => `<li>${escHtml(fill(st))}</li>`).join('')}</ol>
          ${s.images.map((img) => `<figure style="margin: 1rem 0;"><img src="${img.src}" alt="${escHtml(img.alt)}" width="1440" height="900" loading="lazy" style="max-width: 100%; height: auto;" /><figcaption style="font-size: 0.85rem; color: #6B7280;">${escHtml(img.caption)}</figcaption></figure>`).join('')}
          ${s.tips.length ? ul(s.tips.map((t) => escHtml(fill(t)))) : ''}
        </section>`).join('')}
        ${h2('Questions people ask while setting up')}
        ${GUIDE.faqs.map((f) => `<h3 style="font-size: 1.1rem; font-weight: 700; margin-top: 1rem;">${escHtml(f.q)}</h3>${p(escHtml(fill(f.a)))}`).join('')}
        ${navLinks()}
      `);
    },
    jsonLd: () => [
      {
        '@type': 'HowTo',
        name: GUIDE.quickStart.title,
        description: GUIDE.intro[0],
        totalTime: 'PT1H',
        step: GUIDE.quickStart.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: fill(s.text), url: `${SITE}/guide#${s.anchor}` })),
      },
      {
        '@type': 'TechArticle',
        headline: SEO_PAGES.guide.h1,
        description: SEO_PAGES.guide.description,
        dateModified: GUIDE.updated,
        inLanguage: 'en-IN',
        image: GUIDE.sections.agents.images.map((img) => `${SITE}${img.src}`),
        author: { '@id': `${SITE}/#organization` },
        publisher: { '@id': `${SITE}/#organization` },
      },
      { '@type': 'FAQPage', mainEntity: GUIDE.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: fill(f.a) } })) },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: 'Product guide', item: `${SITE}/guide` }] },
      ORGANIZATION,
    ],
  },
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
  <meta property="og:locale" content="en_IN" />
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

  // The template's #root already holds the first-paint splash (a fixed overlay, see index.html).
  // The crawlable content goes after it, in normal flow: same HTML for crawlers and visitors,
  // but visitors see the splash and then the real page, never this fallback layout.
  if (!updated.includes('<!--cv-prerender-->')) {
    throw new Error('prerender-seo: <!--cv-prerender--> marker missing from index.html; refusing to write pages without the splash.');
  }
  updated = updated.replace('<!--cv-prerender-->', `<div class="cv-prerender">${renderedContent}</div>`);

  return updated;
}

// ── 1. Pre-render Core Pages ──────────────────────────────────────────────────
console.log('🚀 Pre-rendering core marketing pages...');
for (const page of corePages) {
  const seo = SEO_PAGES[page.path];
  if (!seo) throw new Error(`prerender-seo: no seoPages.json entry for "/${page.path}"`);
  const pageUrl = page.path ? `${SITE}/${page.path}` : `${SITE}/`;
  const targetDir = page.path ? path.resolve(distDir, page.path) : distDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const type = page.path.startsWith('blog/') ? 'BlogPosting' : (page.path === 'faq' && FAQ_ITEMS.length ? 'FAQPage' : 'WebPage');
  const pageNode = {
    '@type': type,
    ...(page.path === 'faq' && FAQ_ITEMS.length ? {
      mainEntity: FAQ_ITEMS.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })),
    } : {}),
    name: seo.h1,
    description: seo.description,
    url: pageUrl,
    inLanguage: 'en-IN',
    publisher: { '@type': 'Organization', name: 'Claritiy Voice', url: SITE },
  };
  // Several schema.org nodes per page go in one @graph.
  const extra = page.jsonLd ? page.jsonLd() : [];
  const jsonLd = { '@context': 'https://schema.org', '@graph': [pageNode, ...extra] };

  const bodyHtml = page.customBody ? page.customBody() : wrap(`
      <h1 style="font-size: 2.25rem; font-weight: 800; color: #0D1117; margin-bottom: 1rem;">${escHtml(seo.h1)}</h1>
      ${p(escHtml(page.summary))}
      ${navLinks()}
  `);

  const html = injectMetadata(templateHtml, {
    url: pageUrl,
    title: seo.title,
    description: seo.description,
    h1: seo.h1,
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
  const pageUrl = `${SITE}/voice-ai-index/${topic.id}`;
  const targetDir = path.resolve(distDir, `voice-ai-index/${topic.id}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const cleanTitle = topic.title.replace(/[?&]/g, '').trim();
  // Same rule as pages/VoiceAIIndex.tsx (audit #139: titles over 65 characters).
  const metaTitle = (cleanTitle + ARTICLE.titleSuffix).length <= ARTICLE.maxTitleLength ? cleanTitle + ARTICLE.titleSuffix : cleanTitle;
  const metaDesc = fillArticle(ARTICLE.summary, topic, cleanTitle);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": cleanTitle,
    "description": metaDesc,
    "url": pageUrl,
    "inLanguage": "en-IN",
    "author": {
      "@type": "Organization",
      "name": "Claritiy Voice"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Claritiy Voice",
      "url": SITE
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
        ${escHtml(metaDesc)}
      </p>

${ARTICLE.sections.map((sec) => `      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 0.75rem;">${escHtml(sec.subtitle)}</h2>
${(sec.paragraphs || []).map((para) => `        <p style="line-height: 1.7; margin-bottom: 1rem; color: #374151;">${escHtml(fillArticle(para, topic, cleanTitle))}</p>`).join('\n')}
${sec.code ? `        <pre style="background: #111827; color: #E5E7EB; padding: 1.25rem; border-radius: 0.75rem; overflow-x: auto; font-size: 0.875rem;"><code>${escHtml(fillArticle(sec.code, topic, cleanTitle))}</code></pre>` : ''}
${sec.bullets ? `        <ul style="padding-left: 1.5rem; line-height: 1.8; color: #374151;">${sec.bullets.map((b) => `<li>${escHtml(fillArticle(b, topic, cleanTitle))}</li>`).join('')}</ul>` : ''}
      </section>`).join('\n\n')}

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

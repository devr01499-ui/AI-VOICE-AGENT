/**
 * Build gate for the crawler HTML written by prerender-seo.js (audit #120 #122 #134 #137 #138).
 *  - Every public page's <title> and description equal src/app/data/seoPages.json — the same file the
 *    app uses at runtime, so crawlers and users see the same metadata.
 *  - /faq carries a valid FAQPage (with its questions, from pages/FAQ.tsx).
 *  - The Voice AI Index hub is its own canonical page; topic pages use the shared article text and
 *    carry no internal model ids or the old unverified claims.
 * If any check fails, the build fails.
 *
 * Run: node scripts/verify-seo-output.js   (also runs automatically in "postbuild")
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '../dist');
const SEO = JSON.parse(fs.readFileSync(path.resolve(here, '../src/app/data/seoPages.json'), 'utf-8')).pages;
const ARTICLE = JSON.parse(fs.readFileSync(path.resolve(here, '../src/app/data/voiceAiArticle.json'), 'utf-8'));

const problems = [];
const read = (rel) => {
  const f = path.join(distDir, rel, 'index.html');
  if (!fs.existsSync(f)) { problems.push(`missing ${rel || '/'}`); return ''; }
  return fs.readFileSync(f, 'utf-8');
};
const attr = (s) => s.replace(/"/g, '&quot;');
// Every schema.org node on the page, including the ones inside an @graph.
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => { try { return JSON.parse(m[1]); } catch { problems.push('invalid JSON-LD'); return null; } })
  .filter(Boolean)
  .flatMap((j) => (Array.isArray(j['@graph']) ? j['@graph'] : [j]));
const GUIDE = JSON.parse(fs.readFileSync(path.resolve(here, '../src/app/data/guideContent.json'), 'utf-8'));
const publicDir = path.resolve(here, '../public');

// 1. Titles and descriptions match the shared source
for (const [rel, page] of Object.entries(SEO)) {
  const html = read(rel);
  if (!html) continue;
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  if (title !== page.title) problems.push(`/${rel}: title "${title}" != seoPages "${page.title}"`);
  if (!html.includes(`<meta name="description" content="${attr(page.description)}"`)) problems.push(`/${rel}: description differs from seoPages`);
  if (!html.includes(page.h1.replace(/&/g, '&amp;')) && !html.includes(page.h1)) problems.push(`/${rel}: H1 "${page.h1}" not in the pre-rendered HTML`);
}

// 2. /faq has a valid FAQPage
const faq = jsonLd(read('faq')).find((j) => j['@type'] === 'FAQPage');
if (!faq || !Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0) problems.push('/faq: FAQPage without questions (mainEntity)');
else if (faq.mainEntity.some((q) => !q.name || !q.acceptedAnswer || !q.acceptedAnswer.text)) problems.push('/faq: a FAQ entry has no question or answer');

// 2b. /guide: the whole guide is in the crawler HTML, with HowTo + FAQPage, and every screenshot exists
const guideHtml = read('guide');
const guideLd = jsonLd(guideHtml);
const howTo = guideLd.find((j) => j['@type'] === 'HowTo');
if (!howTo || !Array.isArray(howTo.step) || howTo.step.length !== GUIDE.quickStart.steps.length) problems.push('/guide: HowTo missing or without every quick-start step');
const guideFaq = guideLd.find((j) => j['@type'] === 'FAQPage');
if (!guideFaq || guideFaq.mainEntity.length !== GUIDE.faqs.length) problems.push('/guide: FAQPage missing or incomplete');
for (const [id, s] of Object.entries(GUIDE.sections)) {
  if (!guideHtml.includes(`id="${id}"`)) problems.push(`/guide: section #${id} not in the pre-rendered HTML`);
  for (const img of s.images) {
    if (!fs.existsSync(path.join(publicDir, img.src))) problems.push(`/guide: screenshot ${img.src} is missing from public/`);
    if (!guideHtml.includes(`src="${img.src}"`)) problems.push(`/guide: screenshot ${img.src} not in the pre-rendered HTML`);
  }
}
if (/\{(plans|lowestPlan|kbDocs|validity|grace)\}/.test(guideHtml)) problems.push('/guide: an unfilled {placeholder} reached the HTML');
// Crawlers and AI assistants read this HTML: it must carry the real content, not a stub.
for (const rel of ['', 'pricing', 'guide', 'ai-voice-agent-software']) {
  const text = read(rel).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const words = text.split(' ').length;
  if (words < (rel === 'guide' ? 2500 : 300)) problems.push(`/${rel}: only ${words} words of crawlable text`);
}

// 3. Voice AI Index hub and topics
const hub = read('voice-ai-index');
if (!hub.includes('<link rel="canonical" href="https://www.claritiy.com/voice-ai-index" />')) problems.push('/voice-ai-index: canonical is not the hub itself');
const topicDir = path.join(distDir, 'voice-ai-index');
const topics = fs.existsSync(topicDir) ? fs.readdirSync(topicDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
if (topics.length < 50) problems.push(`expected the Voice AI Index topic pages, found ${topics.length}`);
const BANNED = [/gemini[_-]\d/i, /89% lower/i, /scale [^.]{0,60}infinitely/i, /sub-second latency/i, /\b(Compliant|Audited|Certified) (PCI|HIPAA|SOC ?2|GDPR|ISO ?27001)\b/i, /PII protection engine scrubs/i];
const firstSubtitle = ARTICLE.sections[0].subtitle;
for (const t of topics) {
  const html = read(`voice-ai-index/${t}`);
  for (const re of BANNED) if (re.test(html)) problems.push(`/voice-ai-index/${t}: contains ${re}`);
  if (!html.includes(firstSubtitle)) problems.push(`/voice-ai-index/${t}: does not use the shared article text`);
}

// 4. Title and description lengths search engines show in full (audit #139)
(function walkLengths(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walkLengths(p); continue; }
    if (!e.name.endsWith('.html')) continue;
    const html = fs.readFileSync(p, 'utf-8');
    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const desc = ((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '').replace(/&quot;/g, '"');
    if (title.length > 65) problems.push(`${path.relative(distDir, p)}: title is ${title.length} characters (max 65)`);
    if (desc.length > 160) problems.push(`${path.relative(distDir, p)}: description is ${desc.length} characters (max 160)`);
  }
})(distDir);

// 5. No internal model ids anywhere in crawler HTML
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html') && /gemini_\d|gemini-\d\.\d-(flash|live)/i.test(fs.readFileSync(p, 'utf-8'))) problems.push(`${path.relative(distDir, p)}: internal model id in crawlable HTML`);
  }
})(distDir);

if (problems.length) {
  console.error(`❌ SEO output check failed (${problems.length}):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ SEO output: ${Object.keys(SEO).length} pages match seoPages.json, /faq FAQPage has ${faq.mainEntity.length} questions, /guide has ${Object.keys(GUIDE.sections).length} sections with HowTo + FAQPage, ${topics.length} index topics use the shared article.`);

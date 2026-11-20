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
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);

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

// 4. No internal model ids anywhere in crawler HTML
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
console.log(`✅ SEO output: ${Object.keys(SEO).length} pages match seoPages.json, /faq FAQPage has ${faq.mainEntity.length} questions, ${topics.length} index topics use the shared article.`);

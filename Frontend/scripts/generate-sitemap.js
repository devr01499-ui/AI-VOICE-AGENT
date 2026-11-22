import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const topicsFilePath = path.resolve(__dirname, '../src/app/data/voiceAiTopics.ts');
// The guide's screenshots are listed as images of /guide (image search).
const GUIDE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/app/data/guideContent.json'), 'utf-8'));
const GUIDE_IMAGES = Object.values(GUIDE.sections).flatMap((s) => s.images);
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sitemapOutputPath = path.resolve(__dirname, '../public/sitemap.xml');

// Read the TS file
const tsContent = fs.readFileSync(topicsFilePath, 'utf-8');

// Extremely simple parser: look for `id: "slug"`
const matches = [...tsContent.matchAll(/id:\s*"([^"]+)"/g)];
const slugs = matches.map(m => m[1]);

if (slugs.length === 0) {
  console.error("No topics found. Sitemap generation failed.");
  process.exit(1);
}

// Base canonical URLs for the website (strictly 200 OK canonical endpoints)
const baseUrls = [
  'https://www.claritiy.com/',
  'https://www.claritiy.com/guide',
  'https://www.claritiy.com/pricing',
  'https://www.claritiy.com/how-it-works',
  'https://www.claritiy.com/use-cases',
  'https://www.claritiy.com/solutions',
  'https://www.claritiy.com/voices',
  'https://www.claritiy.com/docs',
  'https://www.claritiy.com/blog',
  'https://www.claritiy.com/blog/how-to-reduce-cod-rto',
  'https://www.claritiy.com/blog/healthcare-ai-calling',
  'https://www.claritiy.com/blog/fintech-collections-ai',
  'https://www.claritiy.com/privacy',
  'https://www.claritiy.com/terms',
  'https://www.claritiy.com/security',
  'https://www.claritiy.com/faq',
  'https://www.claritiy.com/contact',
  'https://www.claritiy.com/voice-ai-index',
  'https://www.claritiy.com/ai-voice-agent-software',
];

// Combine all URLs
const allUrls = [
  ...baseUrls,
  ...slugs.map(slug => `https://www.claritiy.com/voice-ai-index/${slug}`)
];

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${allUrls.map(url => `  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${url === 'https://www.claritiy.com/' ? '1.0' : '0.8'}</priority>${url === 'https://www.claritiy.com/guide' ? GUIDE_IMAGES.map((img) => `
    <image:image><image:loc>https://www.claritiy.com${img.src}</image:loc><image:caption>${xmlEsc(img.caption)}</image:caption></image:image>`).join('') : ''}
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(sitemapOutputPath, sitemapContent, 'utf-8');
console.log(`✅ Successfully generated sitemap.xml with ${allUrls.length} URLs!`);

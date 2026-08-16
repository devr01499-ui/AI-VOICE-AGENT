import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const topicsFilePath = path.resolve(__dirname, '../src/app/data/voiceAiTopics.ts');
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

// Base URLs for the website
const baseUrls = [
  'https://www.claritiy.com/',
  'https://www.claritiy.com/pricing',
  'https://www.claritiy.com/how-it-works',
  'https://www.claritiy.com/industries',
  'https://www.claritiy.com/compare',
  'https://www.claritiy.com/solutions',
  'https://www.claritiy.com/voices',
  'https://www.claritiy.com/docs',
  'https://www.claritiy.com/privacy',
  'https://www.claritiy.com/terms',
  'https://www.claritiy.com/security',
  'https://www.claritiy.com/faq',
  'https://www.claritiy.com/contact',
  'https://www.claritiy.com/voice-ai-index',
];

// Combine all URLs
const allUrls = [
  ...baseUrls,
  ...slugs.map(slug => `https://www.claritiy.com/voice-ai-index/${slug}`)
];

const today = new Date().toISOString().split('T')[0];

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url === 'https://www.claritiy.com/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(sitemapOutputPath, sitemapContent, 'utf-8');
console.log(`✅ Successfully generated sitemap.xml with ${allUrls.length} URLs!`);

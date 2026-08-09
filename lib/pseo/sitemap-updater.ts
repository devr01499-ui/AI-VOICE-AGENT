import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma';

export async function updateSitemap() {
  const publishedPages = await prisma.programmaticPage.findMany({
    where: { status: 'published' },
    select: { category: true, slug: true, updatedAt: true }
  });

  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.claritiy.com';
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Add hub pages manually
  const hubs = ['solutions', 'vs', 'integrations', 'use-cases'];
  for (const hub of hubs) {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/${hub}</loc>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  // Add generated pages
  for (const page of publishedPages) {
    const pageUrl = `${baseUrl}/${page.category}/${page.slug}`;
    xml += `  <url>\n`;
    xml += `    <loc>${pageUrl}</loc>\n`;
    xml += `    <lastmod>${page.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.6</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log(`Updated sitemap at ${sitemapPath} with ${publishedPages.length} programmatic pages.`);
}

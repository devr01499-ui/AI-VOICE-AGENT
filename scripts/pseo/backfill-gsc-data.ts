import { fetchGscPerformanceData } from '../../lib/pseo/gsc-client';
import { prisma } from '../../lib/prisma';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('Starting GSC Data Backfill...');

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:claritiy.com';

  console.log(`Fetching data for ${siteUrl} from ${startDate} to ${endDate}...`);

  const rows = await fetchGscPerformanceData(siteUrl, startDate, endDate);
  
  if (rows.length === 0) {
    console.log('No data found in GSC for this period.');
    return;
  }

  const publishedPages = await prisma.programmaticPage.findMany({
    where: { status: 'published' }
  });

  for (const page of publishedPages) {
    const pagePath = `/${page.category}/${page.slug}`;
    const gscRow = rows.find(r => r.keys && r.keys[0] && r.keys[0].includes(pagePath));

    if (gscRow) {
      await prisma.programmaticPage.update({
        where: { id: page.id },
        data: {
          gscClicks: gscRow.clicks || 0,
          gscImpressions: gscRow.impressions || 0,
          gscAvgPosition: gscRow.position || 0,
          gscLastSynced: new Date()
        }
      });
      console.log(`Updated GSC stats for ${pagePath}: ${gscRow.clicks} clicks`);
    }
  }

  console.log('GSC Backfill complete.');
}

if (require.main === module) {
  main().catch(console.error);
}

import { getReviewedEntries, updateReviewEntryStatus } from '../../lib/pseo/notion-client';
import { prisma } from '../../lib/prisma';
import { generateSchemaMarkup } from '../../lib/pseo/schema-markup';
import { updateSitemap } from '../../lib/pseo/sitemap-updater';
import { submitToIndexingApi } from '../../lib/pseo/gsc-client';
import dotenv from 'dotenv';
dotenv.config();

const REVIEW_DB_ID = process.env.NOTION_REVIEW_DB_ID!;

function generateSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function main() {
  console.log('Starting Notion Review Sync...');

  if (!REVIEW_DB_ID) {
    console.error('Missing NOTION_REVIEW_DB_ID');
    process.exit(1);
  }

  const entries = await getReviewedEntries(REVIEW_DB_ID);
  console.log(`Found ${entries.length} reviewed entries.`);

  let sitemapNeedsUpdate = false;

  for (const entry of entries) {
    const status = entry.properties['Status']?.status?.name;
    const title = entry.properties['Page Title']?.title?.[0]?.plain_text || 'Unknown';
    const category = entry.properties['Template Type']?.select?.name || 'vs';

    if (status === 'Needs Changes') {
      console.log(`Entry "${title}" needs changes. Regenerating would happen via webhook or next cron...`);
      continue;
    }

    if (status === 'Approved') {
      console.log(`Entry "${title}" is Approved. Publishing to DB...`);

      const slug = generateSlug(title);
      const dummyFaq = [{ question: `What is ${title}?`, answer: `This is a page about ${title}.` }];
      
      const schema = generateSchemaMarkup({
        title,
        metaDescription: `Discover the best information about ${title}`,
        h1: title,
        bodyContent: `<p>Content for ${title}</p>`,
        faqItems: dummyFaq
      });

      await prisma.programmaticPage.create({
        data: {
          templateType: category,
          slug,
          category,
          title,
          h1: title,
          metaDescription: `Discover the best information about ${title}`,
          bodyContent: `<p>Content for ${title}</p>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          faqItems: dummyFaq as any,
          variableData: {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          schemaMarkup: schema as any,
          status: 'published',
          publishedAt: new Date(),
          notionPageId: entry.id,
        }
      });

      const fullUrl = `https://www.claritiy.com/${category}/${slug}`;
      
      await updateReviewEntryStatus(entry.id, 'Published', fullUrl);
      await submitToIndexingApi(fullUrl);
      
      sitemapNeedsUpdate = true;
      console.log(`Published ${fullUrl}`);
    }
  }

  if (sitemapNeedsUpdate) {
    await updateSitemap();
  }

  console.log('Sync complete.');
}

if (require.main === module) {
  main().catch(console.error);
}

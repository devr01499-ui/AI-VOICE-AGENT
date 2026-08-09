import { getPendingTopics, updateTopicStatus, createReviewEntry } from '../../lib/pseo/notion-client';
import { generateProgrammaticPage } from '../../lib/pseo/generator';
import dotenv from 'dotenv';
dotenv.config();

const INBOX_DB_ID = process.env.NOTION_INBOX_DB_ID!;
const REVIEW_DB_ID = process.env.NOTION_REVIEW_DB_ID!;

async function main() {
  console.log('Starting daily pSEO generation...');
  
  if (!INBOX_DB_ID || !REVIEW_DB_ID) {
    console.error('Missing NOTION_INBOX_DB_ID or NOTION_REVIEW_DB_ID');
    process.exit(1);
  }

  const topics = await getPendingTopics(INBOX_DB_ID, 3);
  console.log(`Found ${topics.length} pending topics.`);

  for (const topicPage of topics) {
    const topicValue = topicPage.properties['Topic']?.title?.[0]?.plain_text || 'Unknown Topic';
    const templateType = topicPage.properties['Category']?.select?.name || 'vs';

    console.log(`Generating content for topic: "${topicValue}" (Type: ${templateType})`);
    
    await updateTopicStatus(topicPage.id, 'In Progress');

    const result = await generateProgrammaticPage(topicValue, templateType);

    if (result.error || !result.content) {
      console.error(`Failed to generate topic "${topicValue}": ${result.error}`);
        await updateTopicStatus(topicPage.id, 'Failed');
      continue;
    }

    const preview = `H1: ${result.content.h1}\n\nTitle: ${result.content.title}\n\nMeta: ${result.content.metaDescription}\n\nContent:\n${result.content.bodyContent}`;
    
    await createReviewEntry(REVIEW_DB_ID, topicValue, templateType, preview);
    await updateTopicStatus(topicPage.id, 'Done');
    
    console.log(`Successfully generated and pushed "${topicValue}" to Review database.`);
  }

  console.log('Daily generation complete.');
}

if (require.main === module) {
  main().catch(console.error);
}

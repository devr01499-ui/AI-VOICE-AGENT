import { Client } from '@notionhq/client';
import { BlockObjectRequest, UpdatePageParameters } from '@notionhq/client/build/src/api-endpoints';

let notionInstance: Client | null = null;

export function getNotionClient(): Client {
  if (!process.env.NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY is not defined in the environment variables.');
  }
  if (!notionInstance) {
    notionInstance = new Client({ auth: process.env.NOTION_API_KEY });
  }
  return notionInstance;
}

// Simple sleep for rate limiting (Notion allows 3 req/sec average)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getPendingTopics(databaseId: string, limit: number = 3) {
  const notion = getNotionClient();
  await sleep(350); // defensive rate limiting
  
  // @ts-expect-error - upstream bug: Notion SDK's complex union types for database query filters often fail TypeScript type inference (https://github.com/makenotion/notion-sdk-js/issues/384)
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'Status',
      status: {
        equals: 'Not Started',
      },
    },
    page_size: limit,
  });
  
  return response.results;
}

export async function updateTopicStatus(pageId: string, status: string) {
  const notion = getNotionClient();
  await sleep(350);
  
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: {
        status: { name: status },
      },
    },
  });
}

export async function createReviewEntry(databaseId: string, title: string, templateType: string, contentPreview: string) {
  const notion = getNotionClient();
  await sleep(350);
  
  // Format the contentPreview as blocks. 
  // Notion blocks max 2000 chars per text block.
  const paragraphs = contentPreview.split('\n\n').map(p => p.trim()).filter(Boolean);
  
  const blocks = paragraphs.map(p => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: p.substring(0, 2000) } }],
    },
  })) as BlockObjectRequest[];

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      'Page Title': {
        title: [{ text: { content: title } }],
      },
      'Template Type': {
        select: { name: templateType },
      },
      'Status': {
        status: { name: 'Pending Review' },
      },
    },
    children: blocks,
  });
}

export async function getReviewedEntries(databaseId: string) {
  const notion = getNotionClient();
  await sleep(350);
  
  // @ts-expect-error - upstream bug: Notion SDK's complex union types for database query filters often fail TypeScript type inference (https://github.com/makenotion/notion-sdk-js/issues/384)
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      or: [
        {
          property: 'Status',
          status: { equals: 'Approved' },
        },
        {
          property: 'Status',
          status: { equals: 'Needs Changes' },
        }
      ]
    },
  });
  
  return response.results;
}

export async function updateReviewEntryStatus(pageId: string, status: string, url?: string) {
  const notion = getNotionClient();
  await sleep(350);
  
  const properties: UpdatePageParameters['properties'] = {
    Status: {
      status: { name: status },
    },
  };

  if (url) {
    properties['Page URL'] = {
      url: url,
    };
  }

  await notion.pages.update({
    page_id: pageId,
    properties,
  });
}

import { Client } from '@notionhq/client';

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
  
  // @ts-expect-error - Notion SDK typing mismatch
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
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = paragraphs.map(p => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: p.substring(0, 2000) } }],
    },
  }));

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
  
  // @ts-expect-error - Notion SDK typing mismatch
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
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
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

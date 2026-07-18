import { logger } from './logger';

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY / GOOGLE_API_KEY environment variable');
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-2:embedContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Embedding API error (status ${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const values = data.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Google Embedding API returned an empty or malformed embedding vector');
    }

    return values;
  } catch (err: any) {
    logger.error('getEmbedding: failed to generate embedding vector', { error: err.message });
    throw err;
  }
}

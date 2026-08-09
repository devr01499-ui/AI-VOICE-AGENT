import { GoogleGenerativeAI, ModelParams } from '@google/generative-ai';

// Singleton instance to prevent multiple client instantiations
let genAIInstance: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not defined in the environment variables.');
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAIInstance;
}

export async function generateContentWithGemini(prompt: string, useSearchGrounding = false): Promise<string> {
  const client = getGeminiClient();
  
  // Use a capable model.
  const modelOptions: ModelParams = {
    model: 'gemini-1.5-pro', 
  };

  if (useSearchGrounding) {
    // @ts-expect-error - googleSearch may not be in this version's Tool typing
    modelOptions.tools = [{ googleSearch: {} }];
  }

  const model = client.getGenerativeModel(modelOptions);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini generation failed. Error:', error);
    throw new Error('Failed to generate content with Gemini. No silent fallback allowed.');
  }
}

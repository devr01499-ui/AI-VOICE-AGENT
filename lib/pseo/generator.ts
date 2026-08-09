import { generateContentWithGemini } from './gemini-client';
import { getProductFacts } from './productFacts';
import { runQualityGate, GeneratedContent } from './qualityGate';

export async function generateProgrammaticPage(
  topicValue: string,
  templateType: string,
  feedback?: string
): Promise<{ content?: GeneratedContent; error?: string }> {
  const facts = getProductFacts();
  
  const systemPrompt = `
You are an expert SEO content writer and technical marketer for ${facts.brandName}.
Your goal is to write a highly useful, structured landing page about "${topicValue}" for the category "${templateType}".

FACTS YOU MUST STRICTLY ADHERE TO (DO NOT HALLUCINATE):
- Brand Name: ${facts.brandName}
- Tagline: ${facts.tagline}
- Pricing: ${facts.pricing.startingPrice}
- Core Problem Solved: ${facts.coreProblemSolved}
- Target Audience: ${facts.targetAudience.join(', ')}
- Languages Supported: ${facts.languagesSupported.join(', ')}

REQUIREMENTS:
1. Output MUST be valid JSON only, without any markdown formatting blocks like \`\`\`json.
2. The JSON schema must strictly match:
{
  "title": "SEO optimized meta title (under 60 chars)",
  "metaDescription": "SEO optimized meta description (under 160 chars)",
  "h1": "Main page heading referencing the topic",
  "bodyContent": "Substantive, answer-first content formatted in HTML. Write at least 600 words total across all sections. Use <h2> and <h3> tags for structure. Do NOT include <h1>.",
  "faqItems": [
    { "question": "Question referencing the topic directly", "answer": "Detailed answer" }
  ]
}
3. The content must read as genuinely useful to a human researching the topic.
4. Each section should be "answer-first" (start with a direct answer, then elaborate).
5. Address the specific topic explicitly in the FAQ section.

${feedback ? `\nPREVIOUS FEEDBACK TO INCORPORATE (NEEDS CHANGES):\n${feedback}` : ''}
`;

  try {
    const rawOutput = await generateContentWithGemini(systemPrompt, true);
    
    // Strip markdown formatting if Gemini included it despite instructions
    const cleanedOutput = rawOutput.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    
    let content: GeneratedContent;
    try {
      content = JSON.parse(cleanedOutput);
    } catch {
      return { error: 'Gemini failed to output valid JSON. Output was: ' + rawOutput };
    }

    const gateResult = await runQualityGate(content, topicValue);
    if (!gateResult.passed) {
      return { error: `Quality gate failed: ${gateResult.reason}` };
    }

    return { content };

  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Unknown error during generation' };
  }
}

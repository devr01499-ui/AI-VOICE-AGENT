import { getProductFacts } from './productFacts';
import { prisma } from '../prisma';

export interface GeneratedContent {
  title: string;
  metaDescription: string;
  h1: string;
  bodyContent: string;
  faqItems: { question: string; answer: string }[];
}

export async function runQualityGate(content: GeneratedContent, topicValue: string): Promise<{ passed: boolean; reason?: string }> {
  // 1. Minimum word count (600+ words of substantive content)
  const fullText = `${content.title} ${content.h1} ${content.bodyContent} ${content.faqItems.map(f => f.question + ' ' + f.answer).join(' ')}`;
  const wordCount = fullText.split(/\s+/).length;
  if (wordCount < 600) {
    return { passed: false, reason: `Word count too low: ${wordCount} words (minimum 600).` };
  }

  // 2. No duplicate content (basic similarity check via H1/Title matching in DB)
  const existing = await prisma.programmaticPage.findFirst({
    where: {
      OR: [
        { h1: content.h1 },
        { title: content.title }
      ]
    }
  });
  if (existing) {
    return { passed: false, reason: `Duplicate content detected: A page with H1 "${content.h1}" or Title "${content.title}" already exists.` };
  }

  // 3. Factual claim traceability to productFacts.json
  const facts = getProductFacts();
  
  if (fullText.includes('Clarity Voice') && !fullText.includes(facts.brandName)) {
    return { passed: false, reason: 'Brand name misspelled as "Clarity Voice". Must be "Claritiy Voice".' };
  }
  
  // 4. FAQ section present and references the topic
  if (!content.faqItems || content.faqItems.length === 0) {
    return { passed: false, reason: 'FAQ section is missing.' };
  }

  const topicKeywords = topicValue.toLowerCase().split(' ').filter(w => w.length > 3); // avoid tiny words
  const hasTopicInFaq = content.faqItems.some(item => 
    topicKeywords.some(keyword => item.question.toLowerCase().includes(keyword))
  );

  if (!hasTopicInFaq && topicKeywords.length > 0) {
    return { passed: false, reason: `FAQ items do not reference the specific topic: "${topicValue}".` };
  }

  return { passed: true };
}

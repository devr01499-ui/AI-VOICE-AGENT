import { GeneratedContent } from './qualityGate';

export function generateSchemaMarkup(content: GeneratedContent) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": content.faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Claritiy Voice",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "3.99",
      "priceCurrency": "INR"
    }
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Claritiy Voice",
    "url": "https://www.claritiy.com"
  };

  return {
    faqSchema,
    softwareSchema,
    orgSchema
  };
}

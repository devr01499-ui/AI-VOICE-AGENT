import { useEffect } from "react";

type Page = 
  | "home" 
  | "solutions" 
  | "how-it-works" 
  | "voices" 
  | "pricing" 
  | "compare" 
  | "blog" 
  | "blog-rto" 
  | "blog-healthcare" 
  | "blog-fintech" 
  | "docs" 
  | "dashboard" 
  | "industries";

interface SchemaInjectorProps {
  page: Page;
}

export default function SchemaInjector({ page }: SchemaInjectorProps) {
  useEffect(() => {
    // Clear old scripts
    document.querySelectorAll("script[data-schema]").forEach((el) => el.remove());

    if (page === "home") {
      // FAQ Page Schema
      const faqScript = document.createElement("script");
      faqScript.type = "application/ld+json";
      faqScript.setAttribute("data-schema", "faq");
      faqScript.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How does Claritiy Voice reduce COD RTO?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Claritiy Voice places an automated confirmation call to every cash-on-delivery customer before their order is dispatched, verifying the order details and delivery address. This catches wrong numbers, changed minds, and unclear addresses before a courier is sent, which directly reduces return-to-origin (RTO) and failed delivery costs."
            }
          },
          {
            "@type": "Question",
            "name": "Do I need to hire a calling team to confirm COD orders?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. Claritiy Voice replaces or scales alongside a manual calling team with AI voice agents that call every order automatically, at any volume, without additional hiring."
            }
          },
          {
            "@type": "Question",
            "name": "What languages does Claritiy Voice support for COD confirmation calls?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Claritiy Voice supports English and Hindi today, with additional Indian languages including Bengali, Kannada, Malayalam, and Gujarati, plus Mandarin and Arabic for international sellers."
            }
          },
          {
            "@type": "Question",
            "name": "How much does Claritiy Voice cost?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Claritiy Voice costs ₹3.99 per minute pay-as-you-go, or from ₹1,799 per month on a plan with bundled minutes included at a lower effective rate."
            }
          },
          {
            "@type": "Question",
            "name": "How is Claritiy Voice different from Bolna, Retell, or Vapi?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Claritiy Voice is built specifically around COD order confirmation and RTO reduction, with the workflow ready out of the box — general voice AI platforms require building that flow yourself, and typically charge separately for speech-to-text, the language model, and text-to-speech rather than one transparent per-minute price."
            }
          }
        ]
      });
      document.head.appendChild(faqScript);

      // SoftwareApplication Schema
      const appScript = document.createElement("script");
      appScript.type = "application/ld+json";
      appScript.setAttribute("data-schema", "app");
      appScript.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Claritiy Voice",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://www.claritiy.com",
        "description": "Claritiy Voice is an AI voice calling and automation platform that deploys human-sounding voice agents across 70+ languages and dialects.",
        "offers": {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": "3.99",
          "unitText": "per minute"
        }
      });
      document.head.appendChild(appScript);
    } else if (page === "blog-rto") {
      const blogScript = document.createElement("script");
      blogScript.type = "application/ld+json";
      blogScript.setAttribute("data-schema", "blog-rto");
      blogScript.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": "How Indian D2C Brands Cut COD RTO Rates by 40% Using Automated AI Voice Calls",
        "author": {
          "@type": "Organization",
          "name": "Claritiy Voice Logistics Team"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Claritiy Voice"
        },
        "url": "https://www.claritiy.com/blog/how-to-reduce-cod-rto",
        "datePublished": "2026-07-21"
      });
      document.head.appendChild(blogScript);
    }
  }, [page]);

  return null;
}

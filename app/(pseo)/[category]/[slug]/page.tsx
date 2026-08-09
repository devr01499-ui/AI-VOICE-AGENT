import { notFound } from 'next/navigation';
import { prisma } from '../../../../lib/prisma';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{
    category: string;
    slug: string;
  }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const page = await prisma.programmaticPage.findFirst({
    where: { 
      category: resolvedParams.category, 
      slug: resolvedParams.slug,
      status: 'published'
    }
  });

  if (!page) {
    return { title: 'Page Not Found' };
  }

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: {
      canonical: `https://www.claritiy.com/${resolvedParams.category}/${resolvedParams.slug}`,
    }
  };
}

export default async function PseoPage({ params }: Props) {
  const resolvedParams = await params;
  const page = await prisma.programmaticPage.findFirst({
    where: { 
      category: resolvedParams.category, 
      slug: resolvedParams.slug,
      status: 'published'
    }
  });

  if (!page) {
    notFound();
  }

  const schemaString = typeof page.schemaMarkup === 'string' 
    ? page.schemaMarkup 
    : JSON.stringify(page.schemaMarkup);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow rounded-lg p-8">
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schemaString }}
        />

        <header className="mb-8 border-b pb-6">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            {page.h1}
          </h1>
        </header>

        <article 
          className="prose prose-lg prose-blue max-w-none mb-12"
          dangerouslySetInnerHTML={{ __html: page.bodyContent }}
        />

        {page.faqItems && (Array.isArray(page.faqItems) ? page.faqItems.length > 0 : false) && (
          <section className="mt-12 border-t pt-10">
            <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(page.faqItems as any[]).map((faq, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{faq.question}</h3>
                  <p className="text-gray-700">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

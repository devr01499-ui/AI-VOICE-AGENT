import Link from 'next/link';
import { prisma } from '../../../lib/prisma';
import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Use Cases | Claritiy Voice',
  description: 'Explore the different ways you can use Claritiy Voice to automate your operations.',
  alternates: {
    canonical: 'https://www.claritiy.com/use-cases',
  }
};

export default async function UseCasesIndexPage() {
  const pages = await prisma.programmaticPage.findMany({
    where: { 
      category: 'use-cases', 
      status: 'published'
    },
    select: {
      slug: true,
      title: true,
      metaDescription: true
    },
    orderBy: {
      title: 'asc'
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b pb-6">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Use Cases
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Explore the different ways you can use Claritiy Voice to automate your operations.
          </p>
        </header>

        <div className="grid gap-6">
          {pages.length === 0 ? (
            <p className="text-gray-500">No use cases published yet.</p>
          ) : (
            pages.map((page) => (
              <Link 
                key={page.slug} 
                href={`/use-cases/${page.slug}`}
                className="block bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">{page.title}</h2>
                <p className="text-gray-700">{page.metaDescription}</p>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

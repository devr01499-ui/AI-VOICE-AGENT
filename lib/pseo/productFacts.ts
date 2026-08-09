import fs from 'fs';
import path from 'path';

export interface ProductFacts {
  brandName: string;
  tagline: string;
  coreProblemSolved: string;
  howItWorks: string;
  targetAudience: string[];
  pricing: {
    startingPrice: string;
    plans: string[];
  };
  languagesSupported: string[];
  coreUseCase: string;
  urls: Record<string, string>;
}

export function getProductFacts(): ProductFacts {
  const filePath = path.join(process.cwd(), 'data', 'productFacts.json');
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as ProductFacts;
  } catch (error) {
    console.error('Failed to load productFacts.json', error);
    throw new Error('Product facts could not be loaded. Please ensure data/productFacts.json exists.');
  }
}

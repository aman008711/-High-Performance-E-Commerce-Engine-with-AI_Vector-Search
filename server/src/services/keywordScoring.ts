import { ParsedQuery } from './queryUnderstanding';

export interface KeywordScoreBreakdown {
  total: number;
  title: number;
  brand: number;
  category: number;
  description: number;
  tags: number;
}

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[\s,./|-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

const stem = (word: string): string =>
  word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;

const wordMatches = (haystack: string, word: string): boolean => {
  const w = word.toLowerCase();
  const s = stem(w);
  const h = haystack.toLowerCase();
  return h.includes(w) || (s !== w && h.includes(s));
};

const scoreField = (fieldValue: string, words: string[]): number => {
  if (!fieldValue || words.length === 0) return 0;
  let hits = 0;
  for (const word of words) {
    if (wordMatches(fieldValue, word)) hits++;
  }
  return hits / words.length;
};

export const computeKeywordScore = (
  product: {
    name: string;
    description?: string;
    category?: string;
    subcategory?: string;
    brand?: string;
    tags?: string[];
  },
  parsed: ParsedQuery
): KeywordScoreBreakdown => {
  const searchWords = tokenize(parsed.rawQuery);
  const semanticWords = tokenize(parsed.semanticQuery);
  const words = Array.from(new Set([...searchWords, ...semanticWords]));

  const title = scoreField(product.name, words);
  const brand = parsed.brand
    ? (product.brand?.toLowerCase() === parsed.brand.toLowerCase() ? 1 : scoreField(product.brand || '', words))
    : scoreField(product.brand || '', words);
  const categoryText = `${product.category || ''} ${product.subcategory || ''}`;
  const category = scoreField(categoryText, words);
  const description = scoreField(product.description || '', words);
  const tagsText = (product.tags || []).join(' ');
  const tags = scoreField(tagsText, words);

  // Weighted exact keyword score across searchable fields
  const total =
    title * 0.35 +
    brand * 0.15 +
    category * 0.15 +
    description * 0.20 +
    tags * 0.15;

  // Exact full-query substring in title is a strong signal
  const fullQuery = parsed.rawQuery.toLowerCase();
  const nameLower = product.name.toLowerCase();
  let titleBoost = 0;
  if (nameLower === fullQuery) titleBoost = 1;
  else if (nameLower.includes(fullQuery)) titleBoost = 0.85;
  else if (words.every((w) => wordMatches(nameLower, w))) titleBoost = 0.65;

  return {
    total: Math.min(1, total + titleBoost * 0.25),
    title: Math.min(1, title + titleBoost * 0.25),
    brand,
    category,
    description,
    tags,
  };
};

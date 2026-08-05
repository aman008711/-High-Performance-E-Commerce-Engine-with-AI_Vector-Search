import { ParsedQuery } from './queryUnderstanding';
import { KeywordScoreBreakdown } from './keywordScoring';
import { resolveCategoryFilter } from './categoryAliases';

export interface HybridScoreBreakdown {
  final: number;
  keyword: number;
  vector: number;
  metadata: number;
  popularity: number;
}

const categoryMatches = (productCategory: string, parsedCategory?: string): boolean => {
  if (!parsedCategory) return false;
  return resolveCategoryFilter(parsedCategory).test(productCategory);
};

export const computeMetadataMatchScore = (
  product: {
    category?: string;
    subcategory?: string;
    brand?: string;
    color?: string;
    gender?: string;
    material?: string;
    size?: string;
    price?: number;
  },
  parsed: ParsedQuery
): number => {
  let score = 0;
  let checks = 0;

  if (parsed.category) {
    checks++;
    if (categoryMatches(product.category || '', parsed.category)) score += 1;
    else score -= 0.5; // Penalise wrong category
  }

  if (parsed.subcategory) {
    checks++;
    if (new RegExp(parsed.subcategory, 'i').test(product.subcategory || '')) score += 1;
    else score -= 0.25;
  }

  if (parsed.brand) {
    checks++;
    if ((product.brand || '').toLowerCase() === parsed.brand.toLowerCase()) score += 1;
    else score -= 0.25;
  }

  if (parsed.color) {
    checks++;
    const colorRe = new RegExp(parsed.color, 'i');
    const colorHit =
      colorRe.test(product.color || '') ||
      colorRe.test(product.subcategory || '') ||
      colorRe.test(product.material || '');
    score += colorHit ? 1 : -0.15;
    checks++;
  }

  if (parsed.gender) {
    checks++;
    if (product.gender === parsed.gender || product.gender === 'Unisex') score += 1;
    else score -= 0.25;
  }

  if (parsed.material) {
    checks++;
    if (new RegExp(parsed.material, 'i').test(product.material || '')) score += 1;
  }

  if (parsed.size) {
    checks++;
    const sizeRe = new RegExp(`\\b${parsed.size}\\b`, 'i');
    if (sizeRe.test(product.size || '')) score += 1;
  }

  if (parsed.maxPrice !== undefined && product.price !== undefined) {
    checks++;
    if (product.price <= parsed.maxPrice) score += 1;
    else score -= 0.5;
  }

  if (parsed.minPrice !== undefined && product.price !== undefined) {
    checks++;
    if (product.price >= parsed.minPrice) score += 1;
    else score -= 0.5;
  }

  if (checks === 0) return 0.5;
  return Math.max(0, Math.min(1, (score / checks + 1) / 2));
};

export const computeHybridScore = (
  product: {
    name: string;
    description?: string;
    category?: string;
    subcategory?: string;
    brand?: string;
    color?: string;
    gender?: string;
    material?: string;
    size?: string;
    price?: number;
    rating?: number;
    tags?: string[];
  },
  parsed: ParsedQuery,
  vectorScore: number,
  keywordBreakdown: KeywordScoreBreakdown
): HybridScoreBreakdown => {
  const metadata = computeMetadataMatchScore(product, parsed);
  const keyword = keywordBreakdown.total;
  const vector = Math.max(0, Math.min(1, vectorScore));
  const popularity = Math.max(0, Math.min(1, (product.rating ?? 4) / 5));

  // Production hybrid weights: keyword + vector + metadata + popularity
  const final =
    keyword * 0.30 +
    vector * 0.30 +
    metadata * 0.30 +
    popularity * 0.10;

  return {
    final: parseFloat(Math.min(0.99, final).toFixed(4)),
    keyword: parseFloat(keyword.toFixed(4)),
    vector: parseFloat(vector.toFixed(4)),
    metadata: parseFloat(metadata.toFixed(4)),
    popularity: parseFloat(popularity.toFixed(4)),
  };
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a.length || !b.length) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * (b[i] || 0);
  }
  return dot;
};

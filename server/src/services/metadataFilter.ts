import { ParsedQuery } from './queryUnderstanding';
import { resolveCategoryFilter } from './categoryAliases';

export type MetadataFilterStrictness = 'strict' | 'relaxed' | 'category-only';

export interface MetadataFilterResult {
  mongoFilter: Record<string, unknown>;
  strictness: MetadataFilterStrictness;
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build a MongoDB filter from parsed query metadata. */
export const buildMetadataFilter = (
  parsed: ParsedQuery,
  strictness: MetadataFilterStrictness = 'strict'
): MetadataFilterResult => {
  const filter: Record<string, unknown> = {
    vectorEmbedding: { $exists: true, $ne: null },
  };
  const andClauses: Record<string, unknown>[] = [];

  if (parsed.category) {
    andClauses.push({ category: { $regex: resolveCategoryFilter(parsed.category) } });
  }

  if (strictness !== 'category-only') {
    if (parsed.subcategory) {
      andClauses.push({
        subcategory: { $regex: new RegExp(escapeRegex(parsed.subcategory), 'i') },
      });
    }

    if (parsed.brand) {
      andClauses.push({
        brand: { $regex: new RegExp(`^${escapeRegex(parsed.brand)}$`, 'i') },
      });
    }

    if (parsed.gender) {
      andClauses.push({
        $or: [
          { gender: parsed.gender },
          { gender: 'Unisex' },
        ],
      });
    }

    if (parsed.material) {
      andClauses.push({
        material: { $regex: new RegExp(escapeRegex(parsed.material), 'i') },
      });
    }

    if (parsed.size) {
      andClauses.push({
        $or: [
          { size: { $regex: new RegExp(`\\b${escapeRegex(parsed.size)}\\b`, 'i') } },
          { description: { $regex: new RegExp(`size[:\\s]*${escapeRegex(parsed.size)}`, 'i') } },
          { tags: { $regex: new RegExp(`size[-\\s]*${escapeRegex(parsed.size)}`, 'i') } },
        ],
      });
    }

    if (parsed.color) {
      const colorPattern = new RegExp(escapeRegex(parsed.color), 'i');
      andClauses.push({
        $or: [
          { color: colorPattern },
          { name: colorPattern },
          { description: colorPattern },
          { tags: colorPattern },
        ],
      });
    }

    if (parsed.maxPrice !== undefined || parsed.minPrice !== undefined) {
      const price: Record<string, number> = {};
      if (parsed.maxPrice !== undefined) price.$lte = parsed.maxPrice;
      if (parsed.minPrice !== undefined) price.$gte = parsed.minPrice;
      andClauses.push({ price });
    }
  }

  if (andClauses.length > 0) {
    filter.$and = andClauses;
  }

  return { mongoFilter: filter, strictness };
};

/** Progressive relaxation order — never drops category when one was parsed. */
export const getFilterRelaxationOrder = (parsed: ParsedQuery): MetadataFilterStrictness[] => {
  if (!parsed.category && !parsed.brand && !parsed.color) {
    return ['relaxed'];
  }
  if (parsed.category) {
    return ['strict', 'relaxed', 'category-only'];
  }
  return ['strict', 'relaxed'];
};

export const hasMetadataFilters = (parsed: ParsedQuery): boolean =>
  Boolean(
    parsed.category ||
    parsed.subcategory ||
    parsed.brand ||
    parsed.color ||
    parsed.gender ||
    parsed.material ||
    parsed.size ||
    parsed.maxPrice !== undefined ||
    parsed.minPrice !== undefined
  );

/** Atlas pre-filter (exact fields where possible, regex not supported in all Atlas filter paths). */
export const buildAtlasPreFilter = (parsed: ParsedQuery): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};
  if (parsed.category) filter.category = { $regex: resolveCategoryFilter(parsed.category).source };
  if (parsed.brand) filter.brand = parsed.brand;
  if (parsed.gender) filter.gender = { $in: [parsed.gender, 'Unisex'] };
  if (parsed.maxPrice !== undefined || parsed.minPrice !== undefined) {
    const price: Record<string, number> = {};
    if (parsed.maxPrice !== undefined) price.$lte = parsed.maxPrice;
    if (parsed.minPrice !== undefined) price.$gte = parsed.minPrice;
    filter.price = price;
  }
  return filter;
};

export const PRODUCT_SEARCH_PROJECTION = {
  name: 1,
  description: 1,
  price: 1,
  stock: 1,
  category: 1,
  subcategory: 1,
  brand: 1,
  color: 1,
  gender: 1,
  material: 1,
  size: 1,
  rating: 1,
  tags: 1,
  imageUrl: 1,
  vectorEmbedding: 1,
  createdAt: 1,
} as const;

export const MAX_FILTERED_CANDIDATES = 500;

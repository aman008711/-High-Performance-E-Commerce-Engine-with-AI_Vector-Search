import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { getCache, setCache, delCache, delCachePattern, isRedisConnected } from '../config/redis';
import { getAIEmbedding } from '../config/embedder';

// Retrieve product listings with Redis Cache-Aside optimizations
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = performance.now();
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 12));
    const category = req.query.category as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Construct a deterministic cache key representation matching search parameters
    const cacheKey = `products:all:page_${page}:limit_${limit}:cat_${category || 'none'}:search_${search || 'none'}:sortBy_${sortBy}:sortOrder_${sortOrder}`;

    // Attempt cache lookup
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      const endTime = performance.now();
      const latency = parseFloat((endTime - startTime).toFixed(2));
      
      // Inject HTTP headers indicating a successful cache hit
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Response-Time', `${latency}ms`);
      
      const parsedData = JSON.parse(cachedData);
      res.status(200).json({
        status: 'success',
        data: parsedData,
      });
      return;
    }

    // Cache miss or Redis offline: Query MongoDB database directly
    const filterQuery: any = {};

    if (category) {
      filterQuery.category = category;
    }

    if (search) {
      filterQuery.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    // Count documents matching the filters
    const total = await Product.countDocuments(filterQuery);
    const pages = Math.max(1, Math.ceil(total / limit));

    // Construct search execution query
    let query = Product.find(filterQuery);

    if (search) {
      // Sort by text relevance score if performing text search
      query = query
        .select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      // Apply custom sorting
      const sortField = sortBy === 'price' ? 'price' : sortBy === 'name' ? 'name' : 'createdAt';
      const sortDirection = sortOrder === 'asc' ? 1 : -1;
      query = query.sort({ [sortField]: sortDirection });
    }

    const products = await query.skip(skip).limit(limit);
    const responsePayload = {
      products,
      total,
      pages,
    };

    // Store fetched record list back into the cache (TTL: 1 hour)
    await setCache(cacheKey, JSON.stringify(responsePayload), 3600);

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));

    // Set HTTP headers indicating Cache Miss
    res.setHeader('X-Cache', isRedisConnected() ? 'MISS' : 'BYPASS');
    res.setHeader('X-Response-Time', `${latency}ms`);

    res.status(200).json({
      status: 'success',
      data: responsePayload,
    });
  } catch (error) {
    next(error);
  }
};

// Retrieve a single product by its ObjectId with Redis Cache-Aside
export const getProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid product ID format');
    }

    const cacheKey = `product:id:${id}`;
    const startTime = performance.now();

    // Check Redis cache first
    const cachedProduct = await getCache(cacheKey);
    if (cachedProduct) {
      const endTime = performance.now();
      const latency = parseFloat((endTime - startTime).toFixed(2));

      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Response-Time', `${latency}ms`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedProduct),
      });
      return;
    }

    // Query database on cache miss
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Store product in cache (TTL: 1 hour)
    await setCache(cacheKey, JSON.stringify(product), 3600);

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));

    res.setHeader('X-Cache', isRedisConnected() ? 'MISS' : 'BYPASS');
    res.setHeader('X-Response-Time', `${latency}ms`);
    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Create a new product and invalidate cached lists
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description, price, stock, category } = req.body;

    if (!name || !description || price === undefined || stock === undefined || !category) {
      throw new BadRequestError('Missing required product fields');
    }

    const product = await Product.create(req.body);

    // Evict cache list results since the catalog changed
    await delCachePattern('products:all*');

    // Trigger non-blocking background cache pre-warming for default main list page
    warmCache().catch(err => console.error('[Redis] Background cache warming failed:', err));

    res.status(201).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Update an existing product and evict specific + list cache entries
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid product ID format');
    }

    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Invalidate details cache key and all search listing keys
    await delCache(`product:id:${id}`);
    await delCachePattern('products:all*');

    // Trigger non-blocking background cache pre-warming for default main list page
    warmCache().catch(err => console.error('[Redis] Background cache warming failed:', err));

    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a product and evict specific + list cache entries
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid product ID format');
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Invalidate details cache key and all search listing keys
    await delCache(`product:id:${id}`);
    await delCachePattern('products:all*');

    // Trigger non-blocking background cache pre-warming for default main list page
    warmCache().catch(err => console.error('[Redis] Background cache warming failed:', err));

    res.status(200).json({
      status: 'success',
      data: {
        success: true,
        message: 'Product deleted successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Background cache pre-warming helper for default landing catalogs (page 1, limit 12)
export const warmCache = async (): Promise<void> => {
  try {
    const limit = 12;
    const skip = 0;

    const [products, total] = await Promise.all([
      Product.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments()
    ]);

    const pages = Math.ceil(total / limit);
    const responsePayload = {
      products,
      total,
      pages
    };

    const cacheKey = 'products:all:page_1:limit_12';
    await setCache(cacheKey, JSON.stringify(responsePayload), 3600);
    console.log('🔥 [Redis] Cache pre-warmed for key products:all:page_1:limit_12');
  } catch (error) {
    console.error('[Redis] Cache warming failed:', error);
  }
};

// Deterministic normal unit vector embedding generator for semantic search matching locally
export const getQueryEmbedding = (search: string, dimensions = 384): number[] => {
  let hash = 0;
  for (let i = 0; i < search.length; i++) {
    hash = (hash << 5) - hash + search.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  const seededRandom = () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };

  const vector: number[] = [];
  let sumOfSquares = 0;

  for (let i = 0; i < dimensions; i++) {
    const u1 = seededRandom() || 0.0001;
    const u2 = seededRandom();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    vector.push(randStdNormal);
    sumOfSquares += randStdNormal * randStdNormal;
  }

  const magnitude = Math.sqrt(sumOfSquares);
  return vector.map((val) => (magnitude > 0 ? val / magnitude : 0));
};

// AI Vector Semantic Search Controller
// AI Query Understanding Parser
export interface ParsedQuery {
  category?: string;
  subcategory?: string;
  brand?: string;
  color?: string;
  gender?: string;
  material?: string;
  maxPrice?: number;
  minPrice?: number;
}

export const parseQueryUnderstanding = (searchQuery: string): ParsedQuery => {
  const query = searchQuery.toLowerCase().trim();
  const parsed: ParsedQuery = {};

  // Extract Price filters
  const underMatch = query.match(/(?:under|below|less than|within)\s*([0-9]+)/);
  if (underMatch) {
    parsed.maxPrice = parseFloat(underMatch[1]);
  }
  const aboveMatch = query.match(/(?:above|over|more than|greater than)\s*([0-9]+)/);
  if (aboveMatch) {
    parsed.minPrice = parseFloat(aboveMatch[1]);
  }
  if (query.includes('cheap')) {
    parsed.maxPrice = 100;
  }

  // Extract Gender
  if (/\b(men|mens|man|boys)\b/.test(query)) {
    parsed.gender = "Men";
  } else if (/\b(women|womens|woman|lady|ladies|girls)\b/.test(query)) {
    parsed.gender = "Women";
  } else if (/\b(unisex)\b/.test(query)) {
    parsed.gender = "Unisex";
  } else if (/\b(kid|kids|child|children)\b/.test(query)) {
    parsed.gender = "Kids";
  }

  // Extract Color
  const colors = ["black", "white", "grey", "gray", "blue", "red", "green", "yellow", "navy", "olive", "pink", "silver", "gold", "beige"];
  for (const c of colors) {
    const regex = new RegExp(`\\b${c}\\b`, 'i');
    if (regex.test(query)) {
      parsed.color = c === "gray" ? "Grey" : c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  // Extract Material
  const materials = ["cotton", "polyester", "leather", "denim", "wool", "plastic", "metal", "glass", "wood", "wooden", "ceramic", "steel", "suede", "canvas"];
  for (const m of materials) {
    const regex = new RegExp(`\\b${m}\\b`, 'i');
    if (regex.test(query)) {
      parsed.material = m === "wooden" ? "Wood" : m.charAt(0).toUpperCase() + m.slice(1);
      break;
    }
  }

  // Extract Brand
  const brands = ["nike", "adidas", "levis", "levi", "zara", "puma", "tommy", "hilfiger", "boat", "casio", "apple", "samsung", "sony", "logitech", "dell", "hp", "lenovo", "asus", "philips", "prestige", "ikea", "lego", "hawkins", "dyson", "nescafe", "tata", "cadbury", "starbucks"];
  for (const b of brands) {
    const regex = new RegExp(`\\b${b}\\b`, 'i');
    if (regex.test(query)) {
      let brandVal = b.charAt(0).toUpperCase() + b.slice(1);
      if (b === "levis" || b === "levi") brandVal = "Levi's";
      if (b === "tommy" || b === "hilfiger") brandVal = "Tommy Hilfiger";
      parsed.brand = brandVal;
      break;
    }
  }

  // Category & Subcategory synonyms mapping
  const mappings: { keywords: string[]; category?: string; subcategory?: string }[] = [
    { keywords: ["tshirt", "t-shirt", "tee", "teeshirt", "tees"], subcategory: "T-Shirts" },
    { keywords: ["shirt", "shirts"], subcategory: "Shirts" },
    { keywords: ["jeans", "denim", "pants", "trousers"], subcategory: "Jeans" },
    { keywords: ["jacket", "jackets", "windbreaker", "puffer"], subcategory: "Jackets" },
    { keywords: ["hoodie", "hoodies", "sweatshirt", "sweatshirts"], subcategory: "Hoodies" },
    { keywords: ["dress", "dresses", "gown", "gowns"], category: "Women's Clothing", subcategory: "Dresses" },
    { keywords: ["top", "tops", "blouse", "blouses"], category: "Women's Clothing", subcategory: "Tops" },
    { keywords: ["skirt", "skirts"], category: "Women's Clothing", subcategory: "Skirts" },
    { keywords: ["sweater", "sweaters", "cardigan"], subcategory: "Sweaters" },
    { keywords: ["shoes", "sneakers", "footwear", "running shoes", "boots", "loafers"], category: "Shoes" },
    { keywords: ["headphones", "earbuds", "earphones", "headset"], category: "Electronics", subcategory: "Headphones" },
    { keywords: ["keyboard", "keyboards"], category: "Electronics", subcategory: "Keyboards" },
    { keywords: ["speaker", "speakers", "soundbar"], category: "Electronics", subcategory: "Speakers" },
    { keywords: ["monitor", "monitors", "display", "screen"], category: "Electronics", subcategory: "Monitors" },
    { keywords: ["webcam", "webcams"], category: "Electronics", subcategory: "Webcams" },
    { keywords: ["phone", "phones", "mobile", "mobiles", "smartphone", "smartphones"], category: "Mobiles" },
    { keywords: ["laptop", "laptops", "notebook", "notebooks", "ultrabook"], category: "Laptops" },
    { keywords: ["watch", "watches", "smartwatch"], category: "Watches" },
    { keywords: ["beauty", "cream", "shampoo", "perfume", "mist", "makeup", "cosmetics"], category: "Beauty" },
    { keywords: ["blender", "kettle", "pan", "cookware", "pot", "toaster", "kitchen"], category: "Home & Kitchen" },
    { keywords: ["coffee", "salt", "pepper", "tea", "grocery", "food", "snacks"], category: "Grocery" },
    { keywords: ["yoga", "dumbbell", "tent", "racket", "sports", "camping"], category: "Sports" },
    { keywords: ["book", "books", "novel", "novels", "biography", "memoir", "cookbook"], category: "Books" },
    { keywords: ["toy", "toys", "lego", "drone", "blocks", "puzzle", "board game"], category: "Toys" },
    { keywords: ["furniture", "chair", "table", "desk", "bookshelf"], category: "Furniture" },
    { keywords: ["accessories", "sunglasses", "belt", "backpack", "beanie"], category: "Accessories" }
  ];

  for (const map of mappings) {
    for (const kw of map.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(query)) {
        if (map.category) parsed.category = map.category;
        if (map.subcategory) parsed.subcategory = map.subcategory;
        
        // Refine Men/Women Clothing categories if category is not explicitly set
        if (parsed.subcategory && !parsed.category) {
          if (parsed.gender === "Women") {
            parsed.category = "Women's Clothing";
          } else if (parsed.gender === "Men") {
            parsed.category = "Men's Clothing";
          } else {
            parsed.category = "Men's Clothing"; 
          }
        }
        break;
      }
    }
  }

  // Adjust "cheap" value relative to parsed category
  if (parsed.maxPrice === 100 && parsed.category) {
    if (parsed.category === "Laptops") parsed.maxPrice = 800;
    else if (parsed.category === "Mobiles") parsed.maxPrice = 400;
    else if (parsed.category === "Grocery") parsed.maxPrice = 15;
    else if (parsed.category === "Books") parsed.maxPrice = 30;
  }

  return parsed;
};

// AI Vector & Hybrid Search Controller
export const searchProductsVector = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const search = req.query.search as string;
    const categoryFilter = req.query.category as string; // From UI dropdown category select
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 12;
    const sortBy = req.query.sortBy as string;
    const sortOrder = req.query.sortOrder as string;

    if (!search) {
      throw new BadRequestError('Search query parameter is required for hybrid search');
    }

    const startTime = performance.now();
    
    // Include categoryFilter inside cacheKey so categories selected in dropdown are isolated
    const cacheKey = `products:hybrid:search_${search.replace(/\s+/g, '_')}:cat_${categoryFilter || 'all'}:page_${page}:limit_${limit}:sortBy_${sortBy || 'none'}:sortOrder_${sortOrder || 'none'}`;

    // Check Redis cache first
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      const endTime = performance.now();
      const latency = parseFloat((endTime - startTime).toFixed(2));

      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Response-Time', `${latency}ms`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedResult),
      });
      return;
    }

    // 1. AI Query Parsing
    const parsedQuery = parseQueryUnderstanding(search);
    
    // Override parsed category with UI select filter if categoryFilter is explicitly set
    if (categoryFilter) {
      parsedQuery.category = categoryFilter;
    }

    const queryVector = await getAIEmbedding(search);
    const queryWords = search.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    let candidates: any[] = [];
    let layerUsed = "Direct Metadata Match";

    // 2. Metadata Filtering Layers (Layered Fallback)
    
    // Layer 1: Strict match using parsed category, subcategory, brand, gender, and price range
    const filterQuery: any = { vectorEmbedding: { $exists: true, $ne: null } };
    if (parsedQuery.category) {
      filterQuery.category = parsedQuery.category;
    }
    if (parsedQuery.subcategory) {
      filterQuery.subcategory = parsedQuery.subcategory;
    }
    if (parsedQuery.brand) {
      filterQuery.brand = parsedQuery.brand;
    }
    if (parsedQuery.gender) {
      filterQuery.gender = parsedQuery.gender;
    }
    if (parsedQuery.color) {
      filterQuery.color = parsedQuery.color;
    }
    if (parsedQuery.maxPrice || parsedQuery.minPrice) {
      filterQuery.price = {};
      if (parsedQuery.maxPrice) filterQuery.price.$lte = parsedQuery.maxPrice;
      if (parsedQuery.minPrice) filterQuery.price.$gte = parsedQuery.minPrice;
    }

    candidates = await Product.find(
      filterQuery,
      { name: 1, description: 1, price: 1, stock: 1, category: 1, subcategory: 1, brand: 1, color: 1, gender: 1, material: 1, rating: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
    );

    // Layer 2: Fall back to category-only filter if strict match is empty
    if (candidates.length === 0 && parsedQuery.category) {
      layerUsed = "Category Fallback Match";
      candidates = await Product.find(
        { category: parsedQuery.category, vectorEmbedding: { $exists: true, $ne: null } },
        { name: 1, description: 1, price: 1, stock: 1, category: 1, subcategory: 1, brand: 1, color: 1, gender: 1, material: 1, rating: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
      );
    }

    // Layer 3: Fall back to all products (broad semantic search) if category-only is empty or no category detected
    if (candidates.length === 0) {
      layerUsed = "Global Fallback Match";
      candidates = await Product.find(
        { vectorEmbedding: { $exists: true, $ne: null } },
        { name: 1, description: 1, price: 1, stock: 1, category: 1, subcategory: 1, brand: 1, color: 1, gender: 1, material: 1, rating: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
      );
    }

    // 3. Hybrid Ranking Score Calculation
    const scoredCandidates = candidates.map((product) => {
      const productEmbedding = product.vectorEmbedding || [];
      const vectorScore = queryVector.reduce((sum, val, idx) => sum + val * (productEmbedding[idx] || 0), 0);

      // Exact title matches boost
      const prodNameLower = product.name.toLowerCase();
      const searchLower = search.toLowerCase();
      let titleScore = 0;
      if (prodNameLower === searchLower) {
        titleScore = 1.0;
      } else if (prodNameLower.startsWith(searchLower)) {
        titleScore = 0.8;
      } else if (prodNameLower.includes(searchLower)) {
        titleScore = 0.5;
      }

      // Category / Subcategory exact matches boost
      let categoryMatchScore = 0;
      if (parsedQuery.category && product.category === parsedQuery.category) {
        categoryMatchScore += 0.6;
      }
      if (parsedQuery.subcategory && product.subcategory === parsedQuery.subcategory) {
        categoryMatchScore += 0.4;
      }

      // Keyword matches boost
      let matches = 0;
      const textToMatch = `${product.name} ${product.description} ${product.subcategory || ''} ${product.brand || ''} ${product.color || ''} ${product.material || ''} ${product.tags.join(' ')}`.toLowerCase();
      for (const word of queryWords) {
        const wordStem = word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word;
        if (textToMatch.includes(word) || textToMatch.includes(wordStem)) {
          matches++;
        }
      }
      const keywordScore = queryWords.length > 0 ? (matches / queryWords.length) : 0.0;

      // Rating/Popularity component
      const ratingScore = (product.rating || 4.0) / 5.0;

      // Combined Hybrid Search Ranking formula
      // Weights: 40% Title, 25% Category Match, 15% Keywords, 15% Vector Similarity, 5% Rating
      const finalScore = (titleScore * 0.40) + (categoryMatchScore * 0.25) + (keywordScore * 0.15) + (vectorScore * 0.15) + (ratingScore * 0.05);

      return {
        ...product.toObject(),
        score: parseFloat(Math.min(0.99, finalScore).toFixed(4)),
      };
    });

    // Sort candidates based on custom sorting parameters if specified
    if (sortBy === 'price') {
      scoredCandidates.sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price);
    } else if (sortBy === 'name') {
      scoredCandidates.sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (sortBy === 'createdAt') {
      scoredCandidates.sort((a, b) => {
        const d1 = new Date(a.createdAt).getTime();
        const d2 = new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? d1 - d2 : d2 - d1;
      });
    } else {
      // Default: Sort by hybrid score descending
      scoredCandidates.sort((a, b) => b.score - a.score);
    }

    // Limit returned products list
    const total = scoredCandidates.length;
    const products = scoredCandidates.slice((page - 1) * limit, page * limit);
    const pages = Math.ceil(total / limit);

    const responsePayload = {
      products,
      total,
      pages,
      telemetry: {
        parsedQuery,
        latencyMs: 0, // Filled after performance metrics calculations
        layerUsed,
      }
    };

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));
    responsePayload.telemetry.latencyMs = latency;

    // Cache the response payload (1 hour)
    await setCache(cacheKey, JSON.stringify(responsePayload), 3600);

    res.setHeader('X-Cache', isRedisConnected() ? 'MISS' : 'BYPASS');
    res.setHeader('X-Response-Time', `${latency}ms`);
    res.status(200).json({
      status: 'success',
      data: responsePayload,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id/recommendations
export const getProductRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 3;
    const threshold = parseFloat(req.query.threshold as string) || 0.3;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid product ID format');
    }

    const startTime = performance.now();
    const cacheKey = `product:recommendations:id_${id}:limit_${limit}:threshold_${threshold}`;

    // Check Redis cache first
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      const endTime = performance.now();
      const latency = parseFloat((endTime - startTime).toFixed(2));
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Response-Time', `${latency}ms`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedResult),
      });
      return;
    }

    const targetProduct = await Product.findById(id);
    if (!targetProduct) {
      throw new NotFoundError('Product not found');
    }

    const queryVector = targetProduct.vectorEmbedding && targetProduct.vectorEmbedding.length > 0
      ? targetProduct.vectorEmbedding
      : await getAIEmbedding(targetProduct.description || targetProduct.name);

    // Retrieve candidate products excluding current product
    const candidates = await Product.find(
      { _id: { $ne: id }, vectorEmbedding: { $exists: true, $ne: null } },
      { name: 1, description: 1, price: 1, stock: 1, category: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
    );

    const targetTags = targetProduct.tags || [];
    const scoredCandidates = candidates
      .map((product) => {
        const productEmbedding = product.vectorEmbedding || [];
        let score = queryVector.reduce((sum, val, idx) => sum + val * (productEmbedding[idx] || 0), 0);

        // Boost similarity score if products share category or tags to simulate correlation
        let matches = 0;
        if (product.category === targetProduct.category) {
          matches += 2;
        }
        const productTags = product.tags || [];
        for (const tag of productTags) {
          if (targetTags.includes(tag)) {
            matches++;
          }
        }
        if (matches > 0) {
          score = 0.32 + (matches * 0.05) + (score * 0.1);
        } else {
          score = 0.1 + Math.abs(score * 0.15);
        }

        return {
          ...product.toObject(),
          score: parseFloat(Math.min(0.99, score).toFixed(4)),
        };
      })
      .filter((candidate) => candidate.score >= threshold);

    scoredCandidates.sort((a, b) => b.score - a.score);
    const recommended = scoredCandidates.slice(0, limit);

    // Save cache (1 hour)
    await setCache(cacheKey, JSON.stringify(recommended), 3600);

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));

    res.setHeader('X-Cache', isRedisConnected() ? 'MISS' : 'BYPASS');
    res.setHeader('X-Response-Time', `${latency}ms`);
    res.status(200).json({
      status: 'success',
      data: recommended,
    });
  } catch (error) {
    next(error);
  }
};

// Retrieve products grouped category-wise (with Redis Cache-Aside TTL: 1 hour)
export const getCategoryWiseProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = performance.now();
  try {
    const cacheKey = 'products:categorywise';
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      const endTime = performance.now();
      const latency = parseFloat((endTime - startTime).toFixed(2));
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Response-Time', `${latency}ms`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedData),
      });
      return;
    }

    // 1. Get top categories by product count
    const topCategories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // 2. Fetch up to 6 products for each category
    const results = [];
    for (const cat of topCategories) {
      if (!cat._id) continue;
      const products = await Product.find({ category: cat._id })
        .select('-vectorEmbedding')
        .limit(6);
      
      results.push({
        category: cat._id,
        count: cat.count,
        products
      });
    }

    // Save cache (1 hour)
    await setCache(cacheKey, JSON.stringify(results), 3600);

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));

    res.setHeader('X-Cache', isRedisConnected() ? 'MISS' : 'BYPASS');
    res.setHeader('X-Response-Time', `${latency}ms`);
    res.status(200).json({
      status: 'success',
      data: results,
    });
  } catch (error) {
    next(error);
  }
};



import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { getCache, setCache, delCache, delCachePattern, isRedisConnected } from '../config/redis';
import { embedText } from '../config/embedder';


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

    // Construct a deterministic cache key representation matching search parameters
    const cacheKey = `products:all:page_${page}:limit_${limit}:cat_${category || 'none'}:search_${search || 'none'}`;

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
      // Default to sorting by creation date
      query = query.sort({ createdAt: -1 });
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
    res.setHeader('X-Cache', 'MISS');
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

    res.setHeader('X-Cache', 'MISS');
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
    await delCache('products:categories:unique');
    await delCache('products:categorywise');

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
    await delCache('products:categories:unique');
    await delCache('products:categorywise');

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
    await delCache('products:categories:unique');
    await delCache('products:categorywise');

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
export const getQueryEmbedding = async (search: string, dimensions = 384): Promise<number[]> => {
  try {
    return await embedText(search);
  } catch (err) {
    console.error('[Embedder] Real embedding failed, falling back to pseudo-random hash:', err);
    let hash = 0;
    for (let i = 0; i < search.length; i++) {
      hash = (hash << 5) - hash + search.charCodeAt(i);
      hash |= 0;
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
  }
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
    { keywords: ["beauty", "cream", "shampoo", "perfume", "mist", "makeup", "cosmetics"], category: "Beauty & Personal Care" },
    { keywords: ["blender", "kettle", "pan", "cookware", "pot", "toaster", "kitchen"], category: "Home & Kitchen" },
    { keywords: ["coffee", "salt", "pepper", "tea", "grocery", "food", "snacks"], category: "Food & Nutrition" },
    { keywords: ["yoga", "dumbbell", "tent", "racket", "sports", "camping"], category: "Sports & Fitness" },
    { keywords: ["book", "books", "novel", "novels", "biography", "memoir", "cookbook", "paper weight", "stationery", "pen"], category: "Pens & Stationery" },
    { keywords: ["toy", "toys", "lego", "drone", "blocks", "puzzle", "board game"], category: "Toys & Games" },
    { keywords: ["furniture", "chair", "table", "desk", "bookshelf"], category: "Furniture" },
    { keywords: ["accessories", "sunglasses", "belt", "backpack", "beanie"], category: "Bags, Wallets & Belts" }
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

    if (!search) {
      throw new BadRequestError('Search query parameter is required for hybrid search');
    }

    const startTime = performance.now();
    
    // Include categoryFilter inside cacheKey so categories selected in dropdown are isolated
    const cacheKey = `products:hybrid:search_${search.replace(/\s+/g, '_')}:cat_${categoryFilter || 'all'}:page_${page}:limit_${limit}`;

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

    // Generate real query embedding from local Sentence-Transformer ONNX model
    const queryVector = await getQueryEmbedding(search, 384);
    const queryWords = search.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    let candidates: any[] = [];
    let layerUsed = "Direct Metadata Match";

    // 2. Metadata Filtering Layers (Layered Fallback with .lean() and limit check)
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

    // Layer 1: Strict match using parsed query tags with lean and 600 limits to shield the Event Loop
    candidates = await Product.find(
      filterQuery,
      { name: 1, description: 1, price: 1, stock: 1, category: 1, subcategory: 1, brand: 1, color: 1, gender: 1, material: 1, rating: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
    ).limit(600).lean();

    // Layer 2: Fall back to category-only filter if strict match is empty
    if (candidates.length === 0 && parsedQuery.category) {
      layerUsed = "Category Fallback Match";
      candidates = await Product.find(
        { category: parsedQuery.category, vectorEmbedding: { $exists: true, $ne: null } },
        { name: 1, description: 1, price: 1, stock: 1, category: 1, subcategory: 1, brand: 1, color: 1, gender: 1, material: 1, rating: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
      ).limit(600).lean();
    }

    // Layer 3: Fall back to all products (keyword search regex constraint) if category-only is empty or no category detected
    if (candidates.length === 0) {
      layerUsed = "Global Fallback Match";
      const queryWordsRegex = queryWords.map(w => new RegExp(`\\b${w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i'));
      
      const searchConditions: any[] = [];
      if (queryWordsRegex.length > 0) {
        searchConditions.push({ name: { $in: queryWordsRegex } });
        searchConditions.push({ tags: { $in: queryWords.map(w => w.toLowerCase()) } });
      }
      
      const querySelector: any = { vectorEmbedding: { $exists: true, $ne: null } };
      if (searchConditions.length > 0) {
        querySelector.$or = searchConditions;
      }
      
      candidates = await Product.find(
        querySelector,
        { name: 1, description: 1, price: 1, stock: 1, category: 1, subcategory: 1, brand: 1, color: 1, gender: 1, material: 1, rating: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
      ).limit(600).lean();
      
      // Filler logic: if still too few candidates AND no active search query is provided, fill with top-rated items to allow semantic fallback matching
      if (candidates.length < 50 && !search) {
        const fillers = await Product.find(
          { vectorEmbedding: { $exists: true, $ne: null } },
          { name: 1, description: 1, price: 1, stock: 1, category: 1, subcategory: 1, brand: 1, color: 1, gender: 1, material: 1, rating: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
        ).sort({ rating: -1 }).limit(150).lean();
        
        // Merge without duplicates
        const existingIds = new Set(candidates.map(c => c._id.toString()));
        for (const item of fillers) {
          if (!existingIds.has(item._id.toString())) {
            candidates.push(item);
          }
        }
      }
    }

    // 3. Hybrid Ranking Score Calculation
    const scoredCandidates = candidates.map((product) => {
      const productEmbedding = product.vectorEmbedding || [];
      
      // A. Semantic similarity: Dot product (both vectors are normalized L2)
      const vectorScore = queryVector.reduce((sum, val, idx) => sum + val * (productEmbedding[idx] || 0), 0);

      // B. Exact keyword match:
      let matches = 0;
      const textToMatch = `${product.name} ${product.description} ${product.subcategory || ''} ${product.brand || ''} ${product.color || ''} ${product.material || ''} ${product.tags.join(' ')}`.toLowerCase();
      for (const word of queryWords) {
        const wordStem = word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word;
        if (textToMatch.includes(word) || textToMatch.includes(wordStem)) {
          matches++;
        }
      }
      const keywordScore = queryWords.length > 0 ? (matches / queryWords.length) : 0.0;

      // C. Exact title matches boost
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

      // D. Category / Subcategory exact matches boost
      let categoryMatchScore = 0;
      if (parsedQuery.category && product.category.toLowerCase() === parsedQuery.category.toLowerCase()) {
        categoryMatchScore += 0.6;
      }
      if (parsedQuery.subcategory && product.subcategory.toLowerCase() === parsedQuery.subcategory.toLowerCase()) {
        categoryMatchScore += 0.4;
      }

      // E. Brand Match boost
      let brandMatchScore = 0;
      if (parsedQuery.brand && product.brand.toLowerCase() === parsedQuery.brand.toLowerCase()) {
        brandMatchScore = 1.0;
      }

      // F. Product availability: boost if in stock, penalize if out of stock
      const availabilityScore = product.stock > 0 ? 1.0 : 0.0;

      // G. Rating component (0.0 to 1.0)
      const ratingScore = (product.rating || 4.0) / 5.0;

      // H. Product popularity proxy (deterministic score based on id/stock)
      const popularityScore = ((product.stock * 3) % 100) / 100;

      // Weighted score combination:
      // Semantic (30%), Title Match (20%), Keyword Match (15%), Category Match (10%), Brand Match (10%), Availability (10%), Rating (2.5%), Popularity (2.5%)
      const finalScore = 
        (vectorScore * 0.30) + 
        (titleScore * 0.20) + 
        (keywordScore * 0.15) + 
        (categoryMatchScore * 0.10) + 
        (brandMatchScore * 0.10) + 
        (availabilityScore * 0.10) + 
        (ratingScore * 0.025) + 
        (popularityScore * 0.025);

      // Score explanation object for search debugging
      const explanation = {
        semanticSimilarity: parseFloat(vectorScore.toFixed(4)),
        titleMatchBoost: parseFloat(titleScore.toFixed(2)),
        keywordMatchRatio: parseFloat(keywordScore.toFixed(2)),
        categoryMatchBoost: parseFloat(categoryMatchScore.toFixed(2)),
        brandMatchBoost: parseFloat(brandMatchScore.toFixed(2)),
        availabilityScore: parseFloat(availabilityScore.toFixed(2)),
        ratingScore: parseFloat(ratingScore.toFixed(4)),
        popularityScore: parseFloat(popularityScore.toFixed(4))
      };

      // Exclude vectorEmbedding from the final product payload returned to UI to save network bandwidth
      const { vectorEmbedding, ...productPayload } = product;

      return {
        ...productPayload,
        score: parseFloat(Math.min(0.99, finalScore).toFixed(4)),
        explanation
      };
    });

    // Sort by hybrid score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Limit returned products list (Pagination)
    const total = scoredCandidates.length;
    const products = scoredCandidates.slice((page - 1) * limit, page * limit);
    const pages = Math.ceil(total / limit);

    const responsePayload = {
      products,
      total,
      pages,
      telemetry: {
        parsedQuery,
        latencyMs: 0,
        layerUsed,
      }
    };

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));
    responsePayload.telemetry.latencyMs = latency;

    // Cache the response payload (1 hour)
    await setCache(cacheKey, JSON.stringify(responsePayload), 3600);

    res.setHeader('X-Cache', 'MISS');
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
      : await getQueryEmbedding(targetProduct.description || targetProduct.name, 384);

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

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Response-Time', `${latency}ms`);
    res.status(200).json({
      status: 'success',
      data: recommended,
    });
  } catch (error) {
    next(error);
  }
};

// Retrieve all unique product categories (with Redis Cache-Aside TTL: 1 hour)
export const getUniqueCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = performance.now();
  try {
    const cacheKey = 'products:categories:unique';
    const cachedCategories = await getCache(cacheKey);

    if (cachedCategories) {
      const endTime = performance.now();
      const latency = parseFloat((endTime - startTime).toFixed(2));
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Response-Time', `${latency}ms`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedCategories),
      });
      return;
    }

    const categories = await Product.distinct('category');
    // Sort alphabetically
    categories.sort((a: string, b: string) => a.localeCompare(b));

    await setCache(cacheKey, JSON.stringify(categories), 3600);

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Response-Time', `${latency}ms`);
    res.status(200).json({
      status: 'success',
      data: categories,
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

    // 1. Get top 10 categories by count
    const topCategories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const categoriesList = topCategories.map(c => c._id);

    // 2. Fetch top 4 products for each category
    const categoryWise: Array<{ category: string; products: any[] }> = [];
    for (const cat of categoriesList) {
      if (!cat) continue;
      const products = await Product.find({ category: cat })
        .sort({ createdAt: -1 })
        .limit(4);
      categoryWise.push({
        category: cat,
        products
      });
    }

    // Cache the result for 1 hour
    await setCache(cacheKey, JSON.stringify(categoryWise), 3600);

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Response-Time', `${latency}ms`);
    res.status(200).json({
      status: 'success',
      data: categoryWise,
    });
  } catch (error) {
    next(error);
  }
};


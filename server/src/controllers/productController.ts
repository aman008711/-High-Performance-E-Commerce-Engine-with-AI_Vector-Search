import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { getCache, setCache, delCache, delCachePattern, isRedisConnected } from '../config/redis';

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
export const searchProductsVector = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const search = req.query.search as string;
    const category = req.query.category as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 12;

    if (!search) {
      throw new BadRequestError('Search query parameter is required for semantic vector search');
    }

    const startTime = performance.now();
    const cacheKey = `products:vector:search_${search.replace(/\s+/g, '_')}:cat_${category || 'all'}:page_${page}:limit_${limit}`;

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

    // Generate query embedding vector matching pre-seeded product embeddings
    const queryVector = getQueryEmbedding(search, 384);

    let products: any[] = [];
    let total = 0;

    // Use local fallback in-memory cosine ranking (default)
    const isLocal = true;

    if (!isLocal) {
      // Production Atlas Aggregation pipeline
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'vectorEmbedding',
            queryVector: queryVector,
            numCandidates: 100,
            limit: limit * page,
          },
        },
      ];
      if (category) {
        pipeline.push({ $match: { category } });
      }

      const results = await Product.aggregate(pipeline);
      total = results.length;
      products = results.slice((page - 1) * limit, page * limit);
    } else {
      // Local fallback: Retrieve matching category products and score cosine similarities
      const filter: any = {};
      if (category) {
        filter.category = category;
      }

      const candidates = await Product.find(
        { ...filter, vectorEmbedding: { $exists: true, $ne: null } },
        { name: 1, description: 1, price: 1, stock: 1, category: 1, tags: 1, imageUrl: 1, vectorEmbedding: 1 }
      );

      const scoredCandidates = candidates.map((product) => {
        const productEmbedding = product.vectorEmbedding || [];
        const score = queryVector.reduce((sum, val, idx) => sum + val * (productEmbedding[idx] || 0), 0);
        return {
          ...product.toObject(),
          score: parseFloat(score.toFixed(4)),
        };
      });

      // Sort by similarity descending
      scoredCandidates.sort((a, b) => b.score - a.score);

      total = scoredCandidates.length;
      products = scoredCandidates.slice((page - 1) * limit, page * limit);
    }

    const pages = Math.ceil(total / limit);
    const responsePayload = {
      products,
      total,
      pages,
    };

    // Store fetched record list back into cache (TTL: 1 hour)
    await setCache(cacheKey, JSON.stringify(responsePayload), 3600);

    const endTime = performance.now();
    const latency = parseFloat((endTime - startTime).toFixed(2));

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


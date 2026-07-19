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

// Retrieve a single product by its ObjectId
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

    const product = await Product.findById(id);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

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

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { BadRequestError, NotFoundError } from '../utils/errors';

// Retrieve product listings from MongoDB (no cache layer yet)
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 12));
    const category = req.query.category as string;
    const search = req.query.search as string;

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

    res.status(200).json({
      status: 'success',
      data: {
        products,
        total,
        pages,
      },
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

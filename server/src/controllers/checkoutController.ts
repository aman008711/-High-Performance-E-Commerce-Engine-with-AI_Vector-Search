import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { Product } from '../models/Product';
import { Discount } from '../models/Discount';
import { Order } from '../models/Order';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { getCache, setCache, delCache, delCachePattern } from '../config/redis';
import { warmCache } from './productController';


export interface CartItemInput {
  productId: string;
  quantity: number;
}

// Dynamic cart calculation using MongoDB Aggregation pipelines
export const calculateCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { items, discountCode } = req.body as {
      items: CartItemInput[];
      discountCode?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Cart items are required and must be a non-empty array');
    }

    // Validate request structure
    for (const item of items) {
      if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new BadRequestError('Each cart item must contain a valid productId and quantity greater than 0');
      }
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestError(`Invalid product ID format: ${item.productId}`);
      }
    }

    // Generate deterministic Redis cache key based on sorted input parameters
    const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
    const itemsKeyString = sortedItems.map((i) => `${i.productId}:${i.quantity}`).join(',');
    const rawKeyString = `cart:${itemsKeyString}:code:${discountCode || ''}`;
    const hash = crypto.createHash('sha256').update(rawKeyString).digest('hex');
    const cacheKey = `cart:calculate:${hash}`;

    // Query Redis cache
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedData),
      });
      return;
    }

    // Map input items list to Type ObjectIds and quantities
    const mappedItems = items.map((item) => ({
      productId: new mongoose.Types.ObjectId(item.productId),
      quantity: item.quantity,
    }));

    const productIds = mappedItems.map((item) => item.productId);

    // MongoDB Aggregation Pipeline: Lookup prices and calculate subtotals per product in-database
    const aggregatedProducts = await Product.aggregate([
      {
        $match: {
          _id: { $in: productIds },
        },
      },
      {
        $addFields: {
          inputQuantity: {
            $let: {
              vars: {
                matchedItem: {
                  $filter: {
                    input: mappedItems,
                    as: 'item',
                    cond: { $eq: ['$$item.productId', '$_id'] },
                  },
                },
              },
              in: { $arrayElemAt: ['$$matchedItem.quantity', 0] },
            },
          },
        },
      },
      {
        $project: {
          productId: '$_id',
          name: 1,
          price: 1,
          stock: 1,
          quantity: '$inputQuantity',
          itemSubtotal: { $multiply: ['$price', '$inputQuantity'] },
        },
      },
    ]);

    // Check if any product was not found
    if (aggregatedProducts.length !== items.length) {
      const foundIds = aggregatedProducts.map((p) => p.productId.toString());
      const missingIds = items
        .map((i) => i.productId)
        .filter((id) => !foundIds.includes(id));
      throw new NotFoundError(`Some products in the cart do not exist: ${missingIds.join(', ')}`);
    }

    // Sum product calculations
    const subtotal = aggregatedProducts.reduce((sum, item) => sum + item.itemSubtotal, 0);

    // Verify discount code if provided
    let discountPercent = 0;
    let verifiedDiscountCode: string | undefined = undefined;

    if (discountCode) {
      const discount = await Discount.findOne({
        code: discountCode.toUpperCase(),
        isActive: true,
      });

      if (!discount) {
        throw new BadRequestError(`Invalid or inactive discount code: ${discountCode}`);
      }

      // Check expiry if exists
      if (discount.expiresAt && new Date() > discount.expiresAt) {
        throw new BadRequestError(`Discount code "${discountCode}" has expired`);
      }

      discountPercent = discount.percent;
      verifiedDiscountCode = discount.code;
    }

    const discountApplied = parseFloat((subtotal * (discountPercent / 100)).toFixed(2));
    const total = parseFloat((subtotal - discountApplied).toFixed(2));

    const responseData = {
      items: aggregatedProducts.map((p) => ({
        productId: p.productId,
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        itemSubtotal: parseFloat(p.itemSubtotal.toFixed(2)),
        isStockAvailable: p.stock >= p.quantity,
        availableStock: p.stock,
      })),
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountCode: verifiedDiscountCode,
      discountPercent,
      discountApplied,
      total,
    };

    // Cache calculation result in Redis with a 1-minute TTL
    await setCache(cacheKey, JSON.stringify(responseData), 60);

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

let isReplicaSetCache: boolean | null = null;

const checkReplicaSet = async (): Promise<boolean> => {
  if (isReplicaSetCache !== null) return isReplicaSetCache;
  try {
    if (!mongoose.connection.db) return false;
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ isMaster: 1 });
    isReplicaSetCache = !!(info.setName || info.hosts);
  } catch (err) {
    isReplicaSetCache = false;
  }
  return isReplicaSetCache;
};

// ACID transaction-based checkout controller with atomic stock decrements
export const placeOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const isReplicaSet = await checkReplicaSet();
  let session: mongoose.ClientSession | null = null;

  if (isReplicaSet) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    const { items, discountCode } = req.body as {
      items: CartItemInput[];
      discountCode?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Cart items are required to place an order');
    }

    // Resolve products, calculate prices, apply discounts, verify stocks inside transaction if session active
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new BadRequestError('Each cart item must contain a valid productId and quantity greater than 0');
      }

      // Check stock availability atomically
      const productQuery = Product.findById(item.productId);
      const product = session ? await productQuery.session(session) : await productQuery;
      if (!product || product.isDeleted) {
        throw new NotFoundError(`Product not found: ${item.productId}`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestError(
          `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`
        );
      }

      // Decrement stock atomically
      product.stock -= item.quantity;
      if (session) {
        await product.save({ session });
      } else {
        await product.save();
      }

      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        productId: product._id as any,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        newStock: product.stock,
      });
    }

    // Verify discount code
    let discountPercent = 0;
    let verifiedDiscountCode: string | undefined = undefined;

    if (discountCode) {
      const discountQuery = Discount.findOne({
        code: discountCode.toUpperCase(),
        isActive: true,
      });
      const discount = session ? await discountQuery.session(session) : await discountQuery;

      if (!discount) {
        throw new BadRequestError(`Invalid or inactive discount code: ${discountCode}`);
      }

      if (discount.expiresAt && new Date() > discount.expiresAt) {
        throw new BadRequestError(`Discount code "${discountCode}" has expired`);
      }

      discountPercent = discount.percent;
      verifiedDiscountCode = discount.code;
    }

    const discountApplied = parseFloat((subtotal * (discountPercent / 100)).toFixed(2));
    const total = parseFloat((subtotal - discountApplied).toFixed(2));

    // Save final Order record
    const order = new Order({
      items: orderItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountCode: verifiedDiscountCode,
      discountApplied,
      total,
      status: 'completed',
    });

    if (session) {
      await order.save({ session });
    } else {
      await order.save();
    }

    // Commit Transaction if active
    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    // Broadcast updated inventory levels to all active clients via Socket.io
    const { getIO } = await import('../index');
    const io = getIO();
    if (io) {
      io.emit('inventoryUpdate', orderItems.map(item => ({
        productId: item.productId.toString(),
        newStock: item.newStock
      })));
      console.log('📡 [Socket] Broadcasted real-time stock levels:', orderItems.map(i => `${i.name}: ${i.newStock}`));
    }

    // Invalidate Redis caches for all purchased items & list catalog page views (post-commit)
    for (const item of orderItems) {
      await delCache(`product:id:${item.productId}`);
    }
    await delCachePattern('products:all*');
    await delCachePattern('cart:calculate:*');

    // Trigger non-blocking background cache warming
    warmCache().catch((err) => console.error('[Redis] Background cache warming failed:', err));

    res.status(201).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    // Abort Transaction on error if active
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    next(error);
  }
};

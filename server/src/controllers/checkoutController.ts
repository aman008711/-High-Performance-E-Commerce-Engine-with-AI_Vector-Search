import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Discount } from '../models/Discount';
import { BadRequestError, NotFoundError } from '../utils/errors';

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

    res.status(200).json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

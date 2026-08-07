import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Product } from '../models/Product';
import { Discount } from '../models/Discount';
import { Order } from '../models/Order';
import { calculateCart, placeOrder } from '../controllers/checkoutController';

const mockRequest = (body: any) => ({ body } as any);
const mockResponse = () => {
  const res: any = {};
  res.statusCode = 200;
  res.headers = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  res.setHeader = (name: string, val: string) => {
    res.headers = { ...res.headers, [name]: val };
    return res;
  };
  return res;
};

describe('Checkout Controller Integration Tests', () => {
  let p1: any;
  let p2: any;

  beforeAll(async () => {
    await connectDB();
    await Product.deleteMany({});
    await Discount.deleteMany({});
    await Order.deleteMany({});

    p1 = await Product.create({
      productId: new mongoose.Types.ObjectId().toString(),
      name: 'Test Laptop',
      description: 'A laptop for testing checkout subtotals',
      price: 1000,
      stock: 5,
      category: 'Electronics',
      tags: ['test', 'laptop'],
      vector: Array(384).fill(0.1),
    });

    p2 = await Product.create({
      productId: new mongoose.Types.ObjectId().toString(),
      name: 'Test Mouse',
      description: 'A mouse for testing checkout subtotals',
      price: 50,
      stock: 2,
      category: 'Electronics',
      tags: ['test', 'mouse'],
      vector: Array(384).fill(0.2),
    });

    await Discount.create({
      code: 'TEST20',
      percent: 20,
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('Test A: should dynamically calculate cart subtotal, discount, and total', async () => {
    const reqCalc = mockRequest({
      items: [
        { productId: p1._id.toString(), quantity: 2 },
        { productId: p2._id.toString(), quantity: 1 },
      ],
      discountCode: 'TEST20',
    });
    const resCalc = mockResponse();
    await calculateCart(reqCalc, resCalc, (err) => {
      if (err) throw err;
    });

    expect(resCalc.statusCode).toBe(200);
    expect(resCalc.body.status).toBe('success');
    expect(resCalc.body.data.subtotal).toBe(2050);
    expect(resCalc.body.data.discountApplied).toBe(410);
    expect(resCalc.body.data.total).toBe(1640);
  });

  it('Test B: should place order and decrement product stock levels', async () => {
    const reqOrder = mockRequest({
      items: [
        { productId: p1._id.toString(), quantity: 1 },
        { productId: p2._id.toString(), quantity: 1 },
      ],
    });
    const resOrder = mockResponse();
    await placeOrder(reqOrder, resOrder, (err) => {
      if (err) throw err;
    });

    expect(resOrder.statusCode).toBe(201);

    const updatedP1 = await Product.findById(p1._id);
    const updatedP2 = await Product.findById(p2._id);
    expect(updatedP1?.stock).toBe(4);
    expect(updatedP2?.stock).toBe(1);

    const savedOrder = await Order.findOne({ _id: resOrder.body.data._id });
    expect(savedOrder).not.toBeNull();
    expect(savedOrder?.total).toBe(1050);
  });

  it('Test C: should roll back transaction on insufficient stock (if replica set)', async () => {
    const reqFailedOrder = mockRequest({
      items: [
        { productId: p1._id.toString(), quantity: 2 },
        { productId: p2._id.toString(), quantity: 3 }, // insufficient stock (1 < 3)
      ],
    });
    const resFailedOrder = mockResponse();

    let isInsufficientStockErr = false;
    try {
      await placeOrder(reqFailedOrder, resFailedOrder, (err: any) => {
        if (err && err.message.includes('Insufficient stock')) {
          isInsufficientStockErr = true;
        }
      });
    } catch (txError: any) {
      if (txError.message && txError.message.includes('replica set')) {
        // Skip assertion on local standalone Mongo
        return;
      }
      throw txError;
    }

    const admin = mongoose.connection.db?.admin();
    const isMasterInfo = admin ? await admin.command({ isMaster: 1 }) : {};
    const isReplicaSet = !!(isMasterInfo.setName || isMasterInfo.hosts);

    if (!isReplicaSet) {
      // Skip rollback validation on local standalone Mongo
      return;
    }

    const rolledBackP1 = await Product.findById(p1._id);
    const rolledBackP2 = await Product.findById(p2._id);
    expect(rolledBackP1?.stock).toBe(4);
    expect(rolledBackP2?.stock).toBe(1);
    expect(isInsufficientStockErr).toBe(true);
  });
});

import { Schema, model, Document } from 'mongoose';

export interface IOrderItem {
  productId: Schema.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
}

export interface IOrder extends Document {
  items: IOrderItem[];
  subtotal: number;
  discountCode?: string;
  discountApplied: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Product name snapshot is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price snapshot is required'],
      min: [0, 'Price snapshot cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    items: {
      type: [orderItemSchema],
      validate: {
        validator: function (val: IOrderItem[]) {
          return val && val.length > 0;
        },
        message: 'Order must contain at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: [true, 'Order subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    discountCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    discountApplied: {
      type: Number,
      required: [true, 'Discount applied amount is required'],
      min: [0, 'Discount applied cannot be negative'],
      default: 0,
    },
    total: {
      type: Number,
      required: [true, 'Order total is required'],
      min: [0, 'Order total cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'completed',
    },
  },
  {
    timestamps: true,
  }
);

export const Order = model<IOrder>('Order', orderSchema);

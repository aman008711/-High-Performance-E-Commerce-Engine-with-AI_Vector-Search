import { Schema, model, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  tags: string[];
  imageUrl: string;
  vectorEmbedding?: number[]; // Vector coordinates array for AI semantic search
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
    },
    stock: {
      type: Number,
      required: [true, 'Product stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    vectorEmbedding: {
      type: [Number], // Float coordinates array
      default: undefined, // Let it be undefined unless populated during seeding
    },
  },
  {
    timestamps: true, // Auto-manage createdAt and updatedAt fields
  }
);

// Compound text index on name and description for standard search query fallbacks
productSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 5 }, name: 'TextIndex' }
);

// Automatically enforce validation checks on update mutations
productSchema.pre('findOneAndUpdate', function (next) {
  this.setOptions({ runValidators: true });
  next();
});

// Export Product Model
export const Product = model<IProduct>('Product', productSchema);

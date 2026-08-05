import { Schema, model, Document } from 'mongoose';

export interface ISearchLog extends Document {
  query: string;
  searchType: 'text' | 'vector' | 'image';
  resultsCount: number;
  timestamp: Date;
}

const searchLogSchema = new Schema<ISearchLog>(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    searchType: {
      type: String,
      enum: ['text', 'vector', 'image'],
      required: true,
      index: true,
    },
    resultsCount: {
      type: Number,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const SearchLog = model<ISearchLog>('SearchLog', searchLogSchema);

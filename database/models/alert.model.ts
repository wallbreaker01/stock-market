import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AlertItem extends Document {
  userId: string;
  symbol: string;
  company: string;
  createdAt: Date;
  lastSentAt?: Date | null;
}

const AlertSchema = new Schema<AlertItem>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: false }
);

// Prevent duplicate alerts per user and symbol
AlertSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const Alert: Model<AlertItem> =
  (models?.Alert as Model<AlertItem>) || model<AlertItem>('Alert', AlertSchema);

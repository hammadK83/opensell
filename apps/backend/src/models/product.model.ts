import mongoose, { Document, Schema, Types, Model } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description?: string;
  price?: number;
  images: string[] | null;
  sellerId: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IProductDocument extends IProduct, Document {
  _id: Types.ObjectId;
}

const productSchema = new mongoose.Schema<IProductDocument>(
  {
    name: { type: String, required: true, minlength: 1 },
    description: { type: String, required: false },
    price: { type: Number, required: false, min: 0 },
    images: {
      type: [String],
      default: null,
    },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true },
);

export const Product =
  (mongoose.models.Product as Model<IProductDocument>) ||
  mongoose.model<IProductDocument, Model<IProductDocument>>('Product', productSchema);

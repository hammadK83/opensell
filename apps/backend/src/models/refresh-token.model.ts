import mongoose, { Document, Model, Types, Schema } from 'mongoose';
import { hashToken } from '../utils/hash-token.js';

export interface IRefreshToken {
  refreshToken: string;
  ip: string;
  userAgent: string;
  isValid: boolean;
  user: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRefreshTokenDocument extends IRefreshToken, Document {
  _id: Types.ObjectId;
}

const refreshTokenSchema = new mongoose.Schema<IRefreshTokenDocument>(
  {
    refreshToken: { type: String, required: true },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    isValid: { type: Boolean, default: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

// Hash refresh token before saving
refreshTokenSchema.pre<IRefreshTokenDocument>('save', async function () {
  if (!this.isModified('refreshToken') || !this.refreshToken) return;

  this.refreshToken = hashToken(this.refreshToken);
});

export const RefreshToken =
  (mongoose.models.RefreshToken as Model<IRefreshTokenDocument>) ||
  mongoose.model<IRefreshTokenDocument, Model<IRefreshTokenDocument>>(
    'RefreshToken',
    refreshTokenSchema,
  );

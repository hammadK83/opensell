import mongoose, { type Model } from 'mongoose';

export interface IAuthRateLimit {
  _id: string;
  count: number;
  expiresAt: Date;
}

const authRateLimitSchema = new mongoose.Schema<IAuthRateLimit>({
  _id: { type: String, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
});

authRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthRateLimit =
  (mongoose.models.AuthRateLimit as Model<IAuthRateLimit>) ||
  mongoose.model<IAuthRateLimit, Model<IAuthRateLimit>>('AuthRateLimit', authRateLimitSchema);

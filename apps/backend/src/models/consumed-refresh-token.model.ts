import mongoose, { type Model, Schema, type Types } from 'mongoose';

export interface IConsumedRefreshToken {
  _id: string;
  session: Types.ObjectId;
  originalExpiresAt: Date;
  expiresAt: Date;
}

const consumedRefreshTokenSchema = new Schema<IConsumedRefreshToken>({
  _id: { type: String, required: true },
  session: { type: Schema.Types.ObjectId, ref: 'RefreshToken', required: true },
  originalExpiresAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

consumedRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ConsumedRefreshToken =
  (mongoose.models.ConsumedRefreshToken as Model<IConsumedRefreshToken>) ||
  mongoose.model<IConsumedRefreshToken, Model<IConsumedRefreshToken>>(
    'ConsumedRefreshToken', consumedRefreshTokenSchema,
  );

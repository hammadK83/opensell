import mongoose, { Document, Model, Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { AUTH_PROVIDER } from '@opensell/shared';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  profileImage?: string;
  verificationToken?: string;
  isVerified: boolean;
  verified?: Date;
  provider: (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === AUTH_PROVIDER.LOCAL;
      },
      select: false,
    },

    profileImage: {
      type: String,
      required: false,
    },

    provider: {
      type: String,
      enum: Object.values(AUTH_PROVIDER) as [string, ...string[]],
      default: AUTH_PROVIDER.LOCAL,
    },

    verificationToken: String,

    isVerified: {
      type: Boolean,
      default: false,
    },

    verified: Date,
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre<IUserDocument>('save', async function () {
  if (!this.isModified('password')) return;

  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User =
  (mongoose.models.User as Model<IUserDocument>) ||
  mongoose.model<IUserDocument, Model<IUserDocument>>('User', userSchema);

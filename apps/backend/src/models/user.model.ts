import mongoose, { Document, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { AUTH_PROVIDER } from '../constants/user.constants.js';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  profileImage?: string;
  provider: (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>(
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
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidate: string) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

import mongoose, { Document, Model, Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { AUTH_PROVIDER, MAX_PASSWORD_BYTES, utf8ByteLength } from '@opensell/shared';

export interface IVerificationEmailJob {
  encryptedToken: string;
  iv: string;
  tag: string;
  tokenHash: string;
  nextAttemptAt: Date;
  attempts: number;
  leaseId?: string;
  leaseUntil?: Date;
}

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  profileImage?: string;
  verificationToken?: string;
  pendingVerificationToken?: string;
  verificationEmailJob?: IVerificationEmailJob;
  verificationResendAfter?: Date;
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
      validate: {
        validator: (password?: string) =>
          password === undefined || utf8ByteLength(password) <= MAX_PASSWORD_BYTES,
        message: `Password must be ${MAX_PASSWORD_BYTES} UTF-8 bytes or fewer`,
      },
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
    pendingVerificationToken: String,
    verificationEmailJob: {
      type: new mongoose.Schema<IVerificationEmailJob>({
        encryptedToken: { type: String, required: true },
        iv: { type: String, required: true },
        tag: { type: String, required: true },
        tokenHash: { type: String, required: true },
        nextAttemptAt: { type: Date, required: true },
        attempts: { type: Number, required: true, default: 0 },
        leaseId: String,
        leaseUntil: Date,
      }, { _id: false }),
      required: false,
    },
    verificationResendAfter: Date,

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

userSchema.index({ 'verificationEmailJob.nextAttemptAt': 1 }, { sparse: true });

// Hash password before saving
userSchema.pre<IUserDocument>('save', async function () {
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User =
  (mongoose.models.User as Model<IUserDocument>) ||
  mongoose.model<IUserDocument, Model<IUserDocument>>('User', userSchema);

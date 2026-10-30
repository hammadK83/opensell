import ms, { StringValue } from 'ms';
import { IUserDocument, User, RefreshToken } from '../models/index.js';
import {
  AUTH_PROVIDER,
  type RegisterUserBody,
  type LoginBody,
  type LoginResponse,
  type RefreshTokenBody,
  type RefreshTokenResponse,
} from '@opensell/shared';
import {
  APP_ERROR_CODES,
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from '../errors/index.js';
import {
  hashToken,
  generateToken,
} from '../utils/index.js';
import { createJWTToken } from './token.service.js';
import { env } from '../config/env.js';
import { createVerificationEmailJob } from './verification-email.service.js';
import { decryptRefreshSuccessor, encryptRefreshSuccessor } from '../utils/refresh-retry-crypto.js';
import { ConsumedRefreshToken } from '../models/consumed-refresh-token.model.js';

export async function registerUser(data: RegisterUserBody): Promise<{
  user: IUserDocument;
  verificationEmailDelivery: 'queued';
}> {
  const { name, email, password, profileImage, provider } = data;
  const existingUser = await User.findOne({ email });
  // TODO: Implement google sign in
  if (provider === AUTH_PROVIDER.GOOGLE) {
    throw new BadRequestError();
  }
  if (existingUser) {
    let errMsg: string = 'User already exists with this email';
    if (existingUser.provider === AUTH_PROVIDER.GOOGLE) {
      errMsg = 'User already registered with Google. Please login with Google instead.';
    }
    throw new ConflictError(APP_ERROR_CODES.USER_ALREADY_EXISTS, errMsg);
  }
  const delivery = createVerificationEmailJob();
  const newUser = await User.create({
    name,
    email,
    password,
    profileImage,
    provider,
    ...delivery,
  });
  return { user: newUser, verificationEmailDelivery: 'queued' };
}

export async function verifyUserEmail(token: string): Promise<IUserDocument> {
  const tokenHash = hashToken(token);
  const user = await User.findOneAndUpdate(
    {
      isVerified: false,
      $or: [{ verificationToken: tokenHash }, { pendingVerificationToken: tokenHash }],
    },
    {
      $set: { isVerified: true, verified: new Date() },
      $unset: { verificationToken: 1, pendingVerificationToken: 1, verificationEmailJob: 1 },
    },
    { new: true },
  );
  if (!user) {
    throw new UnauthorizedError(
      APP_ERROR_CODES.INVALID_VERIFICATION_TOKEN,
      'Could not verify account. Invalid or expired token.',
    );
  }
  return user;
}

// TODO: Implement Google login flow
export async function loginUser(
  data: LoginBody & { ip?: string; userAgent?: string },
): Promise<LoginResponse> {
  const { email, password } = data;
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new UnauthorizedError(
      APP_ERROR_CODES.INVALID_LOGIN_CREDENTIALS,
      'Invalid email or password',
    );
  }

  if (!user.isVerified) {
    throw new UnauthorizedError(
      APP_ERROR_CODES.ACCOUNT_NOT_VERIFIED,
      'Account not verified. Please check your email to verify your account.',
    );
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new UnauthorizedError(
      APP_ERROR_CODES.INVALID_LOGIN_CREDENTIALS,
      'Invalid email or password',
    );
  }

  const accessToken = createJWTToken({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    profileImage: user.profileImage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  const refreshToken = generateToken();
  await RefreshToken.create({
    refreshToken: refreshToken,
    ip: data.ip,
    userAgent: data.userAgent,
    user: user._id,
    expiresAt: new Date(Date.now() + ms(env.REFRESH_TOKEN_TTL as StringValue)),
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

export async function refreshToken(
  data: RefreshTokenBody & { ip?: string; userAgent?: string },
): Promise<RefreshTokenResponse> {
  const { refreshToken: incomingToken } = data;
  const hashedToken = hashToken(incomingToken);
  const now = new Date();
  const invalid = () => new UnauthorizedError(
    APP_ERROR_CODES.INVALID_LOGIN_CREDENTIALS, 'Invalid or expired refresh token',
  );
  const responseFor = (user: IUserDocument, successor: string): RefreshTokenResponse => {
    const userDto = {
      id: user._id.toString(), name: user.name, email: user.email,
      profileImage: user.profileImage, createdAt: user.createdAt, updatedAt: user.updatedAt,
    };
    return { accessToken: createJWTToken(userDto), refreshToken: successor, user: userDto };
  };
  const recover = async (): Promise<RefreshTokenResponse> => {
    if (data.retryKey) {
      const record = await RefreshToken.findOne({
        previousTokenHash: hashedToken,
        retryKeyHash: hashToken(data.retryKey),
        retryUntil: { $gt: new Date() },
        isValid: true,
        expiresAt: { $gt: new Date() },
      }).populate('user');
      if (record?.user && record.encryptedSuccessor && record.retryIv && record.retryTag) {
        const successor = decryptRefreshSuccessor({
          encryptedSuccessor: record.encryptedSuccessor,
          retryIv: record.retryIv,
          retryTag: record.retryTag,
        });
        return responseFor(record.user as unknown as IUserDocument, successor);
      }
    }
    const consumed = await ConsumedRefreshToken.findById(hashedToken);
    if (consumed && consumed.expiresAt > new Date() && consumed.originalExpiresAt > new Date()) {
      // Both this revocation and rotation update the same session document. Whichever
      // wins, the final state cannot leave a usable successor after revocation.
      const revoked = await RefreshToken.findOneAndUpdate(
        {
          _id: consumed.session,
          isValid: true,
          expiresAt: { $gt: new Date() },
          refreshToken: { $ne: hashedToken },
        },
        {
          $set: { isValid: false, revokedAt: new Date() },
          $unset: { encryptedSuccessor: 1, retryIv: 1, retryTag: 1 },
        },
        { new: true },
      );
      if (revoked) {
        console.warn('Refresh token replay detected', {
          sessionId: revoked._id.toString(),
          at: revoked.revokedAt,
        });
      }
    }
    throw invalid();
  };

  const existing = await RefreshToken.findOne({
    refreshToken: hashedToken, isValid: true, expiresAt: { $gt: now },
  }).populate('user');
  if (!existing) return recover();
  if (!existing.user) throw new UnauthorizedError(APP_ERROR_CODES.INVALID_LOGIN_CREDENTIALS, 'Account not found');
  const user = existing.user as unknown as IUserDocument;
  const successor = generateToken();
  // Generate the access token before changing the only usable refresh credential.
  const response = responseFor(user, successor);
  const retryFields = data.retryKey ? {
    previousTokenHash: hashedToken,
    retryKeyHash: hashToken(data.retryKey),
    retryUntil: new Date(now.getTime() + 120_000),
    ...encryptRefreshSuccessor(successor),
  } : {};
  // Record the old fingerprint first. A failed rotation leaves the token active;
  // a successful rotation always has a durable replay record, even after a crash.
  try {
    await ConsumedRefreshToken.updateOne(
      { _id: hashedToken },
      { $set: {
        session: existing._id,
        originalExpiresAt: existing.expiresAt,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000),
      } },
      { upsert: true },
    );
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
  }
  const rotated = await RefreshToken.findOneAndUpdate(
    { _id: existing._id, refreshToken: hashedToken, isValid: true, expiresAt: { $gt: new Date() } },
    {
      $set: {
        refreshToken: hashToken(successor),
        lastUsedAt: now,
        ip: data.ip || existing.ip,
        userAgent: data.userAgent || existing.userAgent,
        expiresAt: new Date(now.getTime() + ms(env.REFRESH_TOKEN_TTL as StringValue)),
        ...retryFields,
      },
      $unset: data.retryKey ? {} : {
        previousTokenHash: 1, retryKeyHash: 1, retryUntil: 1,
        encryptedSuccessor: 1, retryIv: 1, retryTag: 1,
      },
      $inc: { usageCount: 1 },
    },
    { new: true },
  );
  return rotated ? response : recover();
}

export const logoutUser = async (refreshToken: string): Promise<void> => {
  const hashedToken = hashToken(refreshToken);
  await RefreshToken.deleteOne({ $or: [
    { refreshToken: hashedToken }, { previousTokenHash: hashedToken },
  ] });
};

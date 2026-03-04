import ms, { StringValue } from 'ms';
import { IUserDocument, User, RefreshToken } from '../models/index.js';
import {
  AUTH_PROVIDER,
  type RegisterUserBody,
  type LoginBody,
  type LoginResponse,
} from '@opensell/shared';
import {
  APP_ERROR_CODES,
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from '../errors/index.js';
import {
  generateVerificationToken,
  sendVerificationEmail,
  hashToken,
  generateToken,
} from '../utils/index.js';
import { createJWTToken } from './token.service.js';

export async function registerUser(data: RegisterUserBody): Promise<IUserDocument> {
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
  // Generate token for email verification
  const verificationToken = generateVerificationToken();
  const newUser = await User.create({
    name,
    email,
    password,
    profileImage,
    provider,
    verificationToken: verificationToken.tokenHash,
  });
  const origin = process.env.API_URL || 'http://localhost:5000/api/v1';
  await sendVerificationEmail({
    name: newUser.name,
    email: newUser.email,
    verificationToken: verificationToken.rawToken,
    origin,
  });
  return newUser;
}

export async function verifyUserEmail(token: string): Promise<IUserDocument> {
  const tokenHash = hashToken(token);
  const user = await User.findOne({ verificationToken: tokenHash, isVerified: false });
  if (!user) {
    throw new UnauthorizedError(
      APP_ERROR_CODES.INVALID_VERIFICATION_TOKEN,
      'Could not verify account. Invalid or expired token.',
    );
  }
  user.isVerified = true;
  user.verified = new Date();
  user.verificationToken = undefined;
  await user.save();
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
    expiresAt: new Date(Date.now() + ms((process.env.REFRESH_TOKEN_TTL || '30d') as StringValue)),
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

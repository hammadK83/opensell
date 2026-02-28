import { AUTH_PROVIDER } from '@opensell/shared';
import { IUserDocument, User } from '../models/user.model.js';
import type { RegisterUserBody } from '@opensell/shared';
import { BadRequestError, ConflictError, UnauthorizedError } from '../errors/index.js';
import { APP_ERROR_CODES } from '../errors/app-error-codes.js';
import { generateVerificationToken, sendVerificationEmail, hashToken } from '../utils/index.js';

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

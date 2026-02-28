import crypto from 'crypto';
import { AUTH_PROVIDER } from '@opensell/shared';
import { IUserDocument, User } from '../models/user.model.js';
import type { RegisterUserBody } from '@opensell/shared';
import { BadRequestError, ConflictError } from '../errors/index.js';
import { APP_ERROR_CODES } from '../errors/app-error-codes.js';
import { generateVerificationToken, sendVerificationEmail } from '../utils/index.js';

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
  const origin = process.env.CLIENT_URL || 'http://localhost:5000';
  await sendVerificationEmail({
    name: newUser.name,
    email: newUser.email,
    verificationToken: verificationToken.rawToken,
    origin,
  });
  return newUser;
}

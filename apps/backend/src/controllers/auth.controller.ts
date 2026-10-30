import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  registerUser,
  verifyUserEmail,
  loginUser,
  refreshToken,
  logoutUser,
} from '../services/index.js';
import { requestVerificationEmail, RESEND_CONFIRMATION } from '../services/verification-email.service.js';
import { mapUserToResponse, asyncHandler, sendSuccessResponse } from '../utils/index.js';
import { LoginResponse, VerifyEmailQuery, RefreshTokenResponse } from '@opensell/shared';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);
  sendSuccessResponse(res, {
    user: mapUserToResponse(result.user),
    verificationEmailDelivery: result.verificationEmailDelivery,
  }, StatusCodes.CREATED);
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  await requestVerificationEmail(req.body.email);
  sendSuccessResponse(res, { message: RESEND_CONFIRMATION });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query as unknown as VerifyEmailQuery;
  await verifyUserEmail(token);
  return res
    .status(200)
    .send('<h1>Email Verified Successfully!</h1><p>You can now return to the app.</p>');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const response: LoginResponse = await loginUser({
    ...req.body,
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  });
  sendSuccessResponse(res, response);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const response: RefreshTokenResponse = await refreshToken({
    ...req.body,
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  });
  sendSuccessResponse(res, response);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await logoutUser(req.body.refreshToken);
  sendSuccessResponse(res, null);
});

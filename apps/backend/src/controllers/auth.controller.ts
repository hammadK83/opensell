import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { IUserDocument } from '../models/index.js';
import { registerUser, verifyUserEmail, loginUser, logoutUser } from '../services/auth.service.js';
import { mapUserToResponse, asyncHandler } from '../utils/index.js';
import { ApiSuccessResponse, LoginResponse, VerifyEmailQuery } from '@opensell/shared';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user: IUserDocument = await registerUser(req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data: mapUserToResponse(user) });
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
  const apiSuccessResponse: ApiSuccessResponse = {
    data: response,
  };
  res.status(StatusCodes.OK).json(apiSuccessResponse);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await logoutUser(req.body.refreshToken);
  res.status(StatusCodes.OK).send();
});

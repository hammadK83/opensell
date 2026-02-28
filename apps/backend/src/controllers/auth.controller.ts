import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { IUserDocument } from '../models/user.model.js';
import { registerUser, verifyUserEmail } from '../services/user.service.js';
import { mapUserToResponse } from '../utils/index.js';
import { VerifyEmailQuery } from '@opensell/shared';

export const register = async (req: Request, res: Response) => {
  const user: IUserDocument = await registerUser(req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data: mapUserToResponse(user) });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.query as unknown as VerifyEmailQuery;
  await verifyUserEmail(token);
  return res
    .status(200)
    .send('<h1>Email Verified Successfully!</h1><p>You can now return to the app.</p>');
};

export const login = async (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ message: 'login route' });
};

export const logout = async (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ message: 'logout route' });
};

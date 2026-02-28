import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { IUserDocument } from '../models/user.model.js';
import { registerUser } from '../services/user.service.js';
import { mapUserToResponse } from '../utils/index.js';

export const register = async (req: Request, res: Response) => {
  const user: IUserDocument = await registerUser(req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data: mapUserToResponse(user) });
};

export const verifyEmail = async (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ message: 'verifyEmail route' });
};

export const login = async (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ message: 'login route' });
};

export const logout = async (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ message: 'logout route' });
};

import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const register = async (req: Request, res: Response) => {
  res.status(StatusCodes.CREATED).json({ message: 'register route' });
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

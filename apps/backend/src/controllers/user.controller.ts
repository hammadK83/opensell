import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { mapUserToResponse, sendSuccessResponse } from '../utils/index.js';
import { getAllUsers } from '../services/index.js';

export const showMe = asyncHandler(async (req: Request, res: Response) => {
  sendSuccessResponse(res, { user: req.user });
});

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const users = await getAllUsers();
  sendSuccessResponse(res, { users: users.map((user) => mapUserToResponse(user)) });
});

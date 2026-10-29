import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { mapPublicUserToResponse, sendSuccessResponse } from '../utils/index.js';
import { getUserById } from '../services/index.js';

export const showMeHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccessResponse(res, { user: req.user });
});

export const getUserByIdHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserById(req.params.id as string);
  sendSuccessResponse(res, { user: mapPublicUserToResponse(user) });
});

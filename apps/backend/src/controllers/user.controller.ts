import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { sendSuccessResponse } from '../utils/index.js';

export const showMe = asyncHandler(async (req: Request, res: Response) => {
  sendSuccessResponse(res, { user: req.user });
});

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiSuccessResponse } from '../../../../packages/shared/dist/schemas/api-success-response.js';

export const showMe = asyncHandler(async (req: Request, res: Response) => {
  const apiSuccessResponse: ApiSuccessResponse = {
    data: req.user,
  };
  res.json(apiSuccessResponse);
});

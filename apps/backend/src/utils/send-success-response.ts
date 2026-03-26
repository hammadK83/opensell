import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiSuccessResponse } from '@opensell/shared';

export const sendSuccessResponse = <T>(
  res: Response,
  data: T,
  statusCode: number = StatusCodes.OK,
) => {
  const apiSuccessResponse: ApiSuccessResponse = {
    success: true,
    data,
  };
  res.status(statusCode).json(apiSuccessResponse);
};

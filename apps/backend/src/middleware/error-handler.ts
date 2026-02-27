import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError.js';
import { API_ERROR_CODES, ApiErrorResponse } from '@opensell/shared';
import { AppToApiErrorMap } from '../errors/error-mapper.js';

const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;

  // Default values for error response
  const apiErrorResponse: ApiErrorResponse = {
    code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred',
  };

  if (err instanceof AppError) {
    // Custom application errors
    apiErrorResponse.message = err.message;
    apiErrorResponse.code = AppToApiErrorMap[err.code] || API_ERROR_CODES.INTERNAL_SERVER_ERROR;
    statusCode = err.statusCode;
  } else if (err instanceof ZodError) {
    // Zod validation error
    apiErrorResponse.message = 'Invalid input';
    apiErrorResponse.code = API_ERROR_CODES.VALIDATION_ERROR;
    apiErrorResponse.errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    statusCode = StatusCodes.BAD_REQUEST;
  } else if (err instanceof mongoose.Error.ValidationError) {
    // Mongoose validation error
    apiErrorResponse.message = 'Database validation failed';
    apiErrorResponse.code = API_ERROR_CODES.VALIDATION_ERROR;
    apiErrorResponse.errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    statusCode = StatusCodes.BAD_REQUEST;
  } else if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
    // Mongoose duplicate key error
    const mongoErr = err as { keyValue?: Record<string, unknown> };
    const field = mongoErr.keyValue ? Object.keys(mongoErr.keyValue)[0] : 'Field';
    apiErrorResponse.message = `${field} already exists`;
    apiErrorResponse.code = AppToApiErrorMap[err.code] || API_ERROR_CODES.INTERNAL_SERVER_ERROR;
    statusCode = StatusCodes.BAD_REQUEST;
  } else if (err instanceof jwt.JsonWebTokenError) {
    // JWT errors
    apiErrorResponse.message =
      err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
    apiErrorResponse.code = API_ERROR_CODES.UNAUTHORIZED;
    statusCode = StatusCodes.UNAUTHORIZED;
  } else {
    console.error('Unexpected Error:', err);
    if (err instanceof Error && process.env.NODE_ENV === 'development') {
      apiErrorResponse.message = err.message;
    }
  }

  return res.status(statusCode).json({
    ...apiErrorResponse,
    stack: process.env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined,
  });
};

export default errorHandler;

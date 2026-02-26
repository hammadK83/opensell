import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';

const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let type = 'ServerError';
  let message = 'Something went wrong';
  let errors: Array<{ field: string; message: string }> = [];

  if (err instanceof AppError) {
    // Custom application errors
    statusCode = err.statusCode;
    type = 'AppError';
    message = err.message;
  } else if (err instanceof ZodError) {
    // Zod validation error
    statusCode = StatusCodes.BAD_REQUEST;
    type = 'ValidationError';
    message = 'Input validation failed';
    errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    // Mongoose validation error
    statusCode = StatusCodes.BAD_REQUEST;
    type = 'DatabaseValidationError';
    message = 'Database validation failed';
    errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
  } else if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
    // Mongo duplicate key error
    statusCode = StatusCodes.CONFLICT;
    type = 'DuplicateFieldError';
    const mongoErr = err as { keyValue?: Record<string, unknown> };
    const field = mongoErr.keyValue ? Object.keys(mongoErr.keyValue)[0] : 'Field';
    message = `${field} already exists`;
  } else if (err instanceof jwt.JsonWebTokenError) {
    // JWT errors
    statusCode = StatusCodes.UNAUTHORIZED;
    type = 'AuthError';
    message = err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
  }

  if (statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
    console.error('Unexpected Error:', err);
    if (err instanceof Error && process.env.NODE_ENV === 'development') {
      message = err.message;
    }
  }

  return res.status(statusCode).json({
    success: false,
    type,
    message,
    errors,
    stack: process.env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined,
  });
};

export default errorHandler;

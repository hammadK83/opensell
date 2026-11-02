import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/AppError.js';
import { API_ERROR_CODES, ApiErrorResponse } from '@opensell/shared';
import { AppToApiErrorMap } from '../errors/error-mapper.js';

function isBodyParserError(err: unknown, type: string): err is Error & { type: string } {
  return err instanceof Error && 'type' in err && err.type === type;
}

function isDuplicateKeyError(err: unknown): err is Error & { code: number } {
  return err instanceof Error && err.name === 'MongoServerError' &&
    'code' in err && err.code === 11000;
}

const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  // Express identifies error middleware by its four-argument signature.
  void req;
  void next;
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;

  // Default values for error response
  const apiErrorResponse: ApiErrorResponse = {
    code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred',
  };

  if (err instanceof AppError) {
    // Custom application errors
    // Error objects can contain request URLs in their message or stack.
    console.error('AppError:', err.code);
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
    apiErrorResponse.message = 'Invalid input';
    apiErrorResponse.code = API_ERROR_CODES.VALIDATION_ERROR;
    apiErrorResponse.errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: 'Invalid value',
    }));
    statusCode = StatusCodes.BAD_REQUEST;
  } else if (isDuplicateKeyError(err)) {
    apiErrorResponse.message = 'Resource already exists';
    apiErrorResponse.code = API_ERROR_CODES.CONFLICT;
    statusCode = StatusCodes.CONFLICT;
  } else if (isBodyParserError(err, 'entity.parse.failed')) {
    apiErrorResponse.message = 'Malformed JSON request body';
    apiErrorResponse.code = API_ERROR_CODES.VALIDATION_ERROR;
    statusCode = StatusCodes.BAD_REQUEST;
  } else if (isBodyParserError(err, 'entity.too.large')) {
    apiErrorResponse.message = 'Request body is too large';
    apiErrorResponse.code = API_ERROR_CODES.VALIDATION_ERROR;
    statusCode = StatusCodes.REQUEST_TOO_LONG;
  } else if (err instanceof jwt.JsonWebTokenError) {
    // JWT errors
    apiErrorResponse.message =
      err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
    apiErrorResponse.code = API_ERROR_CODES.UNAUTHORIZED;
    statusCode = StatusCodes.UNAUTHORIZED;
  } else {
    console.error('Unexpected Error:', err instanceof Error ? err.name : typeof err);
  }

  return res.status(statusCode).json(apiErrorResponse);
};

export default errorHandler;

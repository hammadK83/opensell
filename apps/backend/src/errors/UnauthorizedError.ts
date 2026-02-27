import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError.js';

export class UnauthorizedError extends AppError {
  constructor(code: string = '', message: string = 'Not authorized to access this resource') {
    super(code, message, StatusCodes.UNAUTHORIZED);
  }
}

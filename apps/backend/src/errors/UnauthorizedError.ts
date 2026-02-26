import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError';

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Not authorized to access this resource') {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

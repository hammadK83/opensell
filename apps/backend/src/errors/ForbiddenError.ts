import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError';

export class ForbiddenError extends AppError {
  constructor(
    message: string = 'You do not have permission to perform this action',
  ) {
    super(message, StatusCodes.FORBIDDEN);
  }
}

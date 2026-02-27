import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError.js';

export class ForbiddenError extends AppError {
  constructor(
    code: string = '',
    message: string = 'You do not have permission to perform this action',
  ) {
    super(code, message, StatusCodes.FORBIDDEN);
  }
}

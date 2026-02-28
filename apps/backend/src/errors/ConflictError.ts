import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError.js';

export class ConflictError extends AppError {
  constructor(
    code: string = '',
    message: string = 'The request could not be completed due to a conflict.',
  ) {
    super(code, message, StatusCodes.CONFLICT);
  }
}

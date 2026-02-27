import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError.js';

export class NotFoundError extends AppError {
  constructor(code: string = '', resource: string = 'Resource') {
    super(code, `${resource} not found`, StatusCodes.NOT_FOUND);
  }
}

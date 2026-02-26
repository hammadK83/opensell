import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError';

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, StatusCodes.NOT_FOUND);
  }
}

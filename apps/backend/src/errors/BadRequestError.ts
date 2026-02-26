import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError';

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, StatusCodes.BAD_REQUEST);
  }
}

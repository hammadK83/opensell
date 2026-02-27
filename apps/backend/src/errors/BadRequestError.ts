import { StatusCodes } from 'http-status-codes';
import { AppError } from './AppError.js';

export class BadRequestError extends AppError {
  constructor(code: string = '', message: string = 'Bad Request') {
    super(code, message, StatusCodes.BAD_REQUEST);
  }
}

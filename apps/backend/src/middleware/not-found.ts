import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

/**
 * Middleware to handle 404 Not Found errors for undefined routes.
 */
const notFoundHandler = (req: Request, res: Response): void => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
  });
};

export default notFoundHandler;

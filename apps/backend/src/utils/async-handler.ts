import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express controller to catch rejections
 * and pass them to the global error handler middleware.
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

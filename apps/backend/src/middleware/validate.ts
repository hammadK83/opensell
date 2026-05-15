import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validate(schema: z.ZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body;
      next();
    } catch (error) {
      next(error);
    }
  };
}

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validate =
  <T extends z.ZodType>(schema: T) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      next(error);
    }
  };

import { UserResponse } from '@opensell/shared';

declare global {
  namespace Express {
    interface Request {
      user?: UserResponse;
    }
  }
}

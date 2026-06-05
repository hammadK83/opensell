import { UserDto } from '@opensell/shared';

declare global {
  namespace Express {
    interface Request {
      user?: UserDto;
    }
  }
}

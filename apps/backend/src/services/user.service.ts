import { IUserDocument, User } from '../models/index.js';
import { APP_ERROR_CODES, NotFoundError } from '../errors/index.js';

export async function getUserById(
  id: string,
): Promise<Pick<IUserDocument, '_id' | 'name' | 'profileImage' | 'createdAt'>> {
  const user = await User.findById(id).select('name profileImage createdAt');
  if (!user) {
    throw new NotFoundError(APP_ERROR_CODES.USER_NOT_FOUND, 'User');
  }
  return user;
}

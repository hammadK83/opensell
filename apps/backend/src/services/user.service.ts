import { IUserDocument, User } from '../models/index.js';
import { APP_ERROR_CODES, NotFoundError } from '../errors/index.js';

export async function getAllUsers(): Promise<IUserDocument[]> {
  const users = await User.find();
  return users;
}

export async function getUserById(id: string): Promise<IUserDocument> {
  const user = await User.findById(id);
  if (!user) {
    throw new NotFoundError(APP_ERROR_CODES.USER_NOT_FOUND, 'User');
  }
  return user;
}

import { IUserDocument, User } from '../models/index.js';

export async function getAllUsers(): Promise<IUserDocument[]> {
  const users = await User.find();
  return users;
}

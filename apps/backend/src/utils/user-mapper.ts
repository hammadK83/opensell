import { IUserDocument } from '../models/index.js';
import { UserResponse } from '@opensell/shared';

export const mapUserToResponse = (user: IUserDocument): UserResponse => {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    profileImage: user.profileImage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

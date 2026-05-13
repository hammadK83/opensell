import { IUserDocument, IProductDocument } from '../models/index.js';
import { type UserResponse, ProductResponse } from '@opensell/shared';

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

export const mapProductToResponse = (product: IProductDocument): ProductResponse => {
  return {
    id: product._id.toString(),
    name: product.name,
    description: product.description,
    price: product.price,
    images: product.images ?? undefined,
    sellerId: product.sellerId.toString(),
    createdAt: product.createdAt,
  };
};

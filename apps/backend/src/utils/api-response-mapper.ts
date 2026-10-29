import { IUserDocument, IProductDocument } from '../models/index.js';
import { type UserDto, type PublicUserDto, ProductDto } from '@opensell/shared';

export const mapUserToResponse = (user: IUserDocument): UserDto => {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    profileImage: user.profileImage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const mapPublicUserToResponse = (
  user: Pick<IUserDocument, '_id' | 'name' | 'profileImage' | 'createdAt'>,
): PublicUserDto => ({
  id: user._id.toString(),
  name: user.name,
  profileImage: user.profileImage,
  createdAt: user.createdAt,
});

export const mapProductToResponse = (product: IProductDocument): ProductDto => {
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

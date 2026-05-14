import { IProductDocument, Product } from '../models/index.js';
import { type CreateProductDto } from '@opensell/shared';

export async function getAllProducts(): Promise<IProductDocument[]> {
  const products = await Product.find();
  return products;
}

export async function createProduct(
  product: CreateProductDto & { sellerId: string },
): Promise<IProductDocument> {
  const { name, description, price, images, sellerId } = product;
  return await Product.create({
    name,
    description,
    price,
    images,
    sellerId,
  });
}

import { APP_ERROR_CODES } from '../errors/app-error-codes.js';
import { ForbiddenError } from '../errors/ForbiddenError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { IProductDocument, Product } from '../models/index.js';
import { type CreateProductDto, type UpdateProductDto } from '@opensell/shared';

export async function getAllProducts(): Promise<IProductDocument[]> {
  const products = await Product.find();
  return products;
}

export async function getProductById(id: string): Promise<IProductDocument> {
  const product = await Product.findOne({ _id: id });

  if (!product) {
    throw new NotFoundError(APP_ERROR_CODES.PRODUCT_NOT_FOUND, 'Product');
  }

  return product;
}

export async function getProductsBySeller(sellerId: string): Promise<IProductDocument[]> {
  return await Product.find({ sellerId });
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

export async function updateProduct(
  productId: string,
  userId: string,
  updates: UpdateProductDto,
): Promise<IProductDocument> {
  const updatedProduct = await Product.findOneAndUpdate(
    { _id: productId, sellerId: userId },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!updatedProduct) {
    throw new NotFoundError(APP_ERROR_CODES.PRODUCT_NOT_FOUND, 'Product');
  }

  return updatedProduct;
}

export async function deleteProduct(productId: string, userId: string): Promise<void> {
  const product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new NotFoundError(APP_ERROR_CODES.PRODUCT_NOT_FOUND, 'Product');
  }

  if (product.sellerId.toString() !== userId) {
    throw new ForbiddenError(APP_ERROR_CODES.PRODUCT_SELLER_ID_MISMATCH);
  }

  await product.deleteOne();
}

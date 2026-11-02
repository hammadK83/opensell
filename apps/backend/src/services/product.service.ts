import { APP_ERROR_CODES } from '../errors/app-error-codes.js';
import { ForbiddenError } from '../errors/ForbiddenError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { IProductDocument, Product } from '../models/index.js';
import { type CreateProductDto, type UpdateProductDto, type ProductListQuery } from '@opensell/shared';
import { type FilterQuery, Types } from 'mongoose';
import { decodeProductCursor, encodeProductCursor } from '../utils/product-cursor.js';

type ProductPage = {
  products: IProductDocument[];
  hasMore: boolean;
  nextCursor: string | null;
};

async function listProducts(query: ProductListQuery, sellerId?: string): Promise<ProductPage> {
  const scope = sellerId ? `seller:${sellerId.toLowerCase()}` : 'all';
  const filter: FilterQuery<IProductDocument> = sellerId ? { sellerId } : {};
  if (query.cursor) {
    const anchor = decodeProductCursor(query.cursor, scope);
    filter.$or = [
      { createdAt: { $lt: anchor.createdAt } },
      { createdAt: anchor.createdAt, _id: { $lt: new Types.ObjectId(anchor.id) } },
    ];
  }
  const found = await Product.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1);
  const hasMore = found.length > query.limit;
  const products = hasMore ? found.slice(0, query.limit) : found;
  const last = products.at(-1);
  return {
    products,
    hasMore,
    nextCursor: hasMore && last ? encodeProductCursor(scope, last.createdAt, last._id.toString()) : null,
  };
}

export async function getAllProducts(query: ProductListQuery): Promise<ProductPage> {
  return listProducts(query);
}

export async function getProductById(id: string): Promise<IProductDocument> {
  const product = await Product.findOne({ _id: id });

  if (!product) {
    throw new NotFoundError(APP_ERROR_CODES.PRODUCT_NOT_FOUND, 'Product');
  }

  return product;
}

export async function getProductsBySeller(sellerId: string, query: ProductListQuery): Promise<ProductPage> {
  return listProducts(query, sellerId);
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

import { IProductDocument, Product } from '../models/index.js';

export async function getAllProducts(): Promise<IProductDocument[]> {
  const products = await Product.find();
  return products;
}

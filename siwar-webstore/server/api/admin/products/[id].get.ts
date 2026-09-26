// server/api/admin/products/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'

/**
 * Route: GET /api/admin/products/:id
 * Access: Admin only (protected by middleware/admin-auth.ts)
 * 
 * Purpose:
 * Fetches a single product by its ObjectId to hydrate the admin edit form.
 */
export default defineEventHandler(async (event) => {
  // 1. Extract and validate route parameter ':id'
  const id = getRouterParam(event, 'id')

  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid product ID format',
    })
  }

  // 2. Query product from MongoDB
  const product = await Product.findById(id).lean()

  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  // 3. Return product payload for form pre-population
  return {
    id: String(product._id),
    name: product.name,
    description: product.description,
    ingredients: product.ingredients || { ar: '', sv: '', en: '' },
    brand: product.brand,
    category: String(product.category),
    price: product.price,
    discount: product.discount ?? 0,
    stockQuantity: product.stockQuantity,
    safetyBuffer: product.safetyBuffer,
    netQuantity: product.netQuantity,
    grossWeight: product.grossWeight,
    momsRate: product.momsRate,
    countryOfOrigin: product.countryOfOrigin || '',
    barcode: product.barcode || '',
    allergens: (product.allergens || []).map(String),
    images: product.images || [],
    isActive: product.isActive,
  }
})
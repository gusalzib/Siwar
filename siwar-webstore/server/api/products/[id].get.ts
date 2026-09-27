// server/api/products/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'
import { getProductAvailability } from '~/server/services/inventory.service'
import type { PopulatedCategory, StorefrontProduct, PopulatedAllergen } from '~/types/product'

export default defineEventHandler(async (event): Promise<StorefrontProduct> => {
  const id = getRouterParam(event, 'id')

  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid product ID format',
    })
  }

  // Fetch active product with lean hydration for fast TTFB (<300ms)
  const product = await Product.findOne({ _id: id, isActive: true })
    .populate<{ category: PopulatedCategory }>('category', 'name slug')
    .populate<{ allergens: PopulatedAllergen[] }>('allergens', 'code name')
    .lean()

  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  // Calculate live inventory status and online buffer thresholds
  const availability = getProductAvailability({
    _id: product._id,
    stockQuantity: product.stockQuantity,
    safetyBuffer: product.safetyBuffer,
  })

  return {
    ...product,
    _id: String(product._id),
    id: String(product._id),
    category: product.category as PopulatedCategory,
    availability,
  } as unknown as StorefrontProduct
})
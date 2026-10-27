// server/api/products/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'
import '~/server/models/Category'
import '~/server/models/Allergens'
import { getProductAvailability } from '~/server/services/inventory.service'
import { calculateDiscountedPrice, isDiscountActive } from '~/server/services/pricing.service'
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

  const now = new Date()
  const hasActiveDiscount = isDiscountActive(
    product.discount,
    product.discountStartsAt,
    product.discountExpiresAt,
    now
  )
  const discount = hasActiveDiscount ? (product.discount || 0) : 0
  const discountedPrice = hasActiveDiscount
    ? calculateDiscountedPrice(product.price, product.discount, product.discountStartsAt, product.discountExpiresAt, now)
    : null

  return {
    ...product,
    _id: String(product._id),
    id: String(product._id),
    category: product.category as PopulatedCategory,
    availability,
    discount,
    discountStartsAt: product.discountStartsAt || null,
    discountExpiresAt: product.discountExpiresAt || null,
    discountedPrice,
  } as unknown as StorefrontProduct
})
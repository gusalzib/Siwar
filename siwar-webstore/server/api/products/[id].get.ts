// server/api/products/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'
import '~/server/models/Category'
import '~/server/models/Allergens'
import { getProductAvailability } from '~/server/services/inventory.service'
import { resolveEffectiveProductDiscount, resolveEffectiveProductPrice } from '~/server/services/pricing.service'
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
    .populate<{ category: PopulatedCategory }>('category', 'name slug discountPercent discountStartsAt discountExpiresAt isActiveDiscount')
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
  const effectivePricing = resolveEffectiveProductPrice(product, product.category as any, now)
  const discount = effectivePricing.appliedDiscountPercent
  const hasActiveDiscount = discount > 0
  const discountedPrice = hasActiveDiscount ? effectivePricing.effectivePriceMinor : null

  // Suppress competing discount dates (AC-4: Never render two competing deadlines)
  let discountStartsAt: Date | string | null = null
  let discountExpiresAt: Date | string | null = null
  if (effectivePricing.activeDiscountType === 'ORDINARY') {
    discountStartsAt = product.discountStartsAt || null
    discountExpiresAt = product.discountExpiresAt || null
  } else if (effectivePricing.activeDiscountType === 'CATEGORY') {
    discountStartsAt = (product.category as any)?.discountStartsAt || null
    discountExpiresAt = (product.category as any)?.discountExpiresAt || null
  }

  return {
    ...product,
    _id: String(product._id),
    id: String(product._id),
    category: product.category as PopulatedCategory,
    availability,
    discount,
    discountStartsAt,
    discountExpiresAt,
    discountedPrice,
    discountSource: effectivePricing.activeDiscountType.toLowerCase(),
    activeDiscountType: effectivePricing.activeDiscountType,
    deadlineDate: effectivePricing.deadlineDate,
    kortdatum: (product.kortdatum?.isKortdatum && effectivePricing.isKortdatum)
      ? {
          isKortdatum: true,
          bestBeforeDate: product.kortdatum.bestBeforeDate || null,
          clearanceDiscount: product.kortdatum.clearanceDiscount || 0,
        }
      : null,
  } as unknown as StorefrontProduct
})
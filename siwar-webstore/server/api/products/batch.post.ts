// server/api/products/batch.post.ts
import { isValidObjectId, Types } from 'mongoose'
import { Product } from '~/server/models/Product'
import '~/server/models/Category'
import '~/server/models/Allergens'
import { calculateDiscountedPrice, isDiscountActive } from '~/server/services/pricing.service'
import type { PopulatedCategory, PopulatedAllergen } from '~/types/product'

interface BatchBody {
  ids?: string[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<BatchBody>(event).catch((): BatchBody => ({ ids: [] }))
  const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : []

  // Filter out any non-strings or invalid ObjectIDs
  const validIds: string[] = rawIds.filter(
    (id: unknown): id is string => typeof id === 'string' && isValidObjectId(id)
  )

  if (validIds.length === 0) {
    return []
  }

  const objectIds = validIds.map((id: string) => new Types.ObjectId(id))

  // Fetch only active products (AC-3: Gracefully omit archived or soft-deleted items)
  const rawProducts = await Product.find({
    _id: { $in: objectIds },
    isActive: true,
  })
    .populate<{ category: PopulatedCategory }>('category', 'name slug')
    .populate<{ allergens: PopulatedAllergen[] }>('allergens', 'code name')
    .lean()

  const now = new Date()

  // Format products with live stock calculation and active discount
  const productMap = new Map<string, any>()

  for (const p of rawProducts) {
    const buffer = p.safetyBuffer ?? 0
    const availableStock = Math.max(0, p.stockQuantity - buffer)
    const primaryImage = p.images?.find((img) => img.isPrimary) || p.images?.[0] || null

    let statusCode = 'IN_STOCK'
    if (p.stockQuantity <= 0) {
      statusCode = 'OUT_OF_STOCK'
    } else if (availableStock === 0) {
      statusCode = 'OUT_OF_STOCK_ONLINE'
    }

    const hasActiveDiscount = isDiscountActive(p.discount, p.discountStartsAt, p.discountExpiresAt, now)
    const discount = hasActiveDiscount ? (p.discount || 0) : 0
    const discountedPrice = hasActiveDiscount
      ? calculateDiscountedPrice(p.price, p.discount, p.discountStartsAt, p.discountExpiresAt, now)
      : null

    const formattedProduct = {
      id: String(p._id),
      _id: String(p._id),
      name: p.name,
      description: p.description,
      brand: p.brand,
      category: p.category,
      countryOfOrigin: p.countryOfOrigin,
      allergens: p.allergens,
      primaryImage,
      images: p.images,
      price: p.price,
      discount,
      discountStartsAt: p.discountStartsAt || null,
      discountExpiresAt: p.discountExpiresAt || null,
      discountedPrice,
      netQuantity: p.netQuantity,
      grossWeight: p.grossWeight ?? (p.netQuantity?.unit === 'g' ? p.netQuantity.value : 0),
      momsRate: p.momsRate,
      stockQuantity: p.stockQuantity,
      safetyBuffer: buffer,
      availableStock,
      statusCode,
      canAddToCart: availableStock > 0,
    }

    productMap.set(String(p._id), formattedProduct)
  }

  // Preserve the caller's ID order while omitting archived/missing items
  const result: any[] = []
  for (const id of validIds) {
    const item = productMap.get(id)
    if (item) {
      result.push(item)
    }
  }

  return result
})

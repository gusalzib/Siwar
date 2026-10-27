// server/api/products/deals.get.ts
import { Product } from '~/server/models/Product'
import '~/server/models/Category'
import { calculateDiscountedPrice, isDiscountActive } from '~/server/services/pricing.service'

/**
 * Route: GET /api/products/deals
 * Access: Public storefront endpoint
 * Purpose: Fetches active catalog products with active discounts (> 0%) for homepage promotional deals.
 * Strictly omits expired promotions per AC-4.
 */
export default defineEventHandler(async () => {
  const now = new Date()

  const rawProducts = await Product.find({
    isActive: true,
    discount: { $gt: 0 },
    $and: [
      { $or: [{ discountStartsAt: null }, { discountStartsAt: { $lte: now } }] },
      { $or: [{ discountExpiresAt: null }, { discountExpiresAt: { $gt: now } }] },
    ],
  })
    .populate('category', 'name slug')
    .sort({ discount: -1, createdAt: -1 })
    .limit(30)
    .lean()

  return rawProducts.map((p) => {
    const buffer = p.safetyBuffer ?? 0
    const availableStock = Math.max(0, p.stockQuantity - buffer)
    const primaryImage = p.images?.find((img) => img.isPrimary) || p.images?.[0] || null
    const hasActiveDiscount = isDiscountActive(p.discount, p.discountStartsAt, p.discountExpiresAt, now)
    const discount = hasActiveDiscount ? (p.discount || 0) : 0
    const discountedPrice = hasActiveDiscount ? calculateDiscountedPrice(p.price, p.discount, p.discountStartsAt, p.discountExpiresAt, now) : null

    let statusCode = 'IN_STOCK'
    if (p.stockQuantity <= 0) {
      statusCode = 'OUT_OF_STOCK'
    } else if (availableStock === 0) {
      statusCode = 'OUT_OF_STOCK_ONLINE'
    }

    return {
      id: String(p._id),
      name: p.name,
      description: p.description,
      brand: p.brand,
      category: p.category,
      countryOfOrigin: p.countryOfOrigin,
      primaryImage,
      price: p.price,
      discount,
      discountStartsAt: p.discountStartsAt || null,
      discountExpiresAt: p.discountExpiresAt || null,
      discountedPrice,
      netQuantity: p.netQuantity,
      grossWeight: p.grossWeight ?? (p.netQuantity?.unit === 'g' ? p.netQuantity.value : 0),
      momsRate: p.momsRate,
      stockQuantity: p.stockQuantity,
      availableStock,
      statusCode,
      canAddToCart: availableStock > 0,
    }
  })
})

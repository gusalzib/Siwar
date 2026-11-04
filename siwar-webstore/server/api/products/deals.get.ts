// server/api/products/deals.get.ts
import { Product } from '~/server/models/Product'
import { Category } from '~/server/models/Category'
import { resolveEffectiveProductPrice } from '~/server/services/pricing.service'

/**
 * Route: GET /api/products/deals
 * Access: Public storefront endpoint
 * Purpose: Fetches active catalog products with active discounts (> 0%), Kortdatum, or Category campaigns for homepage promotional deals.
 * Strictly omits expired promotions per AC-4.
 */
export default defineEventHandler(async () => {
  const now = new Date()

  // 1. Identify categories with active blanket campaigns
  const activePromoCategories = await Category.find({
    isActiveDiscount: true,
    discountPercent: { $gt: 0 },
    $and: [
      { $or: [{ discountStartsAt: null }, { discountStartsAt: { $lte: now } }] },
      { $or: [{ discountExpiresAt: null }, { discountExpiresAt: { $gt: now } }] },
    ],
  }).select('_id').lean()

  const activeCatIds = activePromoCategories.map((c) => c._id)

  // 2. Query products that qualify for promotional deals
  const dealConditions: Array<Record<string, any>> = [
    {
      discount: { $gt: 0 },
      $and: [
        { $or: [{ discountStartsAt: null }, { discountStartsAt: { $lte: now } }] },
        { $or: [{ discountExpiresAt: null }, { discountExpiresAt: { $gt: now } }] },
      ],
    },
    { 'kortdatum.isKortdatum': true },
  ]

  if (activeCatIds.length > 0) {
    dealConditions.push({ category: { $in: activeCatIds } })
  }

  const rawProducts = await Product.find({
    isActive: true,
    $or: dealConditions,
  })
    .populate('category', 'name slug discountPercent discountStartsAt discountExpiresAt isActiveDiscount')
    .sort({ discount: -1, createdAt: -1 })
    .limit(50)
    .lean()

  // 3. Resolve effective pricing deterministically
  const deals = rawProducts
    .map((p: any) => {
      const buffer = p.safetyBuffer ?? 0
      const availableStock = Math.max(0, p.stockQuantity - buffer)
      const primaryImage = p.images?.find((img: any) => img.isPrimary) || p.images?.[0] || null

      const effectivePricing = resolveEffectiveProductPrice(p, p.category as any, now)
      const discount = effectivePricing.appliedDiscountPercent
      const hasActiveDiscount = discount > 0
      const discountedPrice = hasActiveDiscount ? effectivePricing.effectivePriceMinor : null

      // Suppress products that ended up having 0% effective discount and no active Kortdatum
      if (!hasActiveDiscount && !effectivePricing.isKortdatum) {
        return null
      }

      let discountStartsAt: Date | string | null = null
      let discountExpiresAt: Date | string | null = null
      if (effectivePricing.activeDiscountType === 'ORDINARY') {
        discountStartsAt = p.discountStartsAt || null
        discountExpiresAt = p.discountExpiresAt || null
      } else if (effectivePricing.activeDiscountType === 'CATEGORY') {
        discountStartsAt = (p.category as any)?.discountStartsAt || null
        discountExpiresAt = (p.category as any)?.discountExpiresAt || null
      }

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
        discountStartsAt,
        discountExpiresAt,
        discountedPrice,
        discountSource: effectivePricing.activeDiscountType.toLowerCase(),
        activeDiscountType: effectivePricing.activeDiscountType,
        deadlineDate: effectivePricing.deadlineDate,
        kortdatum: (p.kortdatum?.isKortdatum && effectivePricing.isKortdatum)
          ? {
              isKortdatum: true,
              bestBeforeDate: p.kortdatum.bestBeforeDate || null,
              clearanceDiscount: p.kortdatum.clearanceDiscount || 0,
            }
          : null,
        netQuantity: p.netQuantity,
        grossWeight: p.grossWeight ?? (p.netQuantity?.unit === 'g' ? p.netQuantity.value : 0),
        momsRate: p.momsRate,
        stockQuantity: p.stockQuantity,
        availableStock,
        freeShipping: Boolean(p.freeShipping),
        statusCode,
        canAddToCart: availableStock > 0,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 30)

  return deals
})

// server/api/products/deals.get.ts
import { Product } from '~/server/models/Product'

/**
 * Route: GET /api/products/deals
 * Access: Public storefront endpoint
 * Purpose: Fetches active catalog products with active discounts (> 0%) for homepage promotional deals.
 */
export default defineEventHandler(async () => {
  const rawProducts = await Product.find({
    isActive: true,
    discount: { $gt: 0 },
  })
    .populate('category', 'name slug')
    .sort({ discount: -1, createdAt: -1 })
    .limit(30)
    .lean()

  return rawProducts.map((p) => {
    const buffer = p.safetyBuffer ?? 0
    const availableStock = Math.max(0, p.stockQuantity - buffer)
    const primaryImage = p.images?.find((img) => img.isPrimary) || p.images?.[0] || null
    const discount = p.discount || 0

    const discountedPrice = {
      SEK: Math.round((p.price?.SEK || 0) * (1 - discount / 100)),
      EUR: Math.round((p.price?.EUR || 0) * (1 - discount / 100)),
      USD: Math.round((p.price?.USD || 0) * (1 - discount / 100)),
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

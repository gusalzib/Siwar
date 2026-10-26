// server/api/products/batch.get.ts
import { isValidObjectId, Types } from 'mongoose'
import { Product } from '~/server/models/Product'
import type { PopulatedCategory, PopulatedAllergen } from '~/types/product'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rawList: string[] = Array.isArray(query.ids)
    ? (query.ids as string[])
    : typeof query.ids === 'string'
      ? query.ids.split(',')
      : []

  const validIds: string[] = rawList
    .map((id: string) => String(id).trim())
    .filter((id: string): id is string => isValidObjectId(id))

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

    const discount = p.discount || 0
    const discountedPrice = discount > 0 ? {
      SEK: Math.round((p.price?.SEK || 0) * (1 - discount / 100)),
      EUR: Math.round((p.price?.EUR || 0) * (1 - discount / 100)),
      USD: Math.round((p.price?.USD || 0) * (1 - discount / 100)),
    } : null

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

  const result: any[] = []
  for (const id of validIds) {
    const item = productMap.get(id)
    if (item) {
      result.push(item)
    }
  }

  return result
})

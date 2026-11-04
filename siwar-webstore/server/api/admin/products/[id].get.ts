// server/api/admin/products/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'
import '~/server/models/Category'
import { resolveEffectiveProductPrice } from '~/server/services/pricing.service'

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

  // 2. Query product from MongoDB with populated category promotion fields
  let queryBuilder: any = Product.findById(id)
  if (typeof queryBuilder?.populate === 'function') {
    queryBuilder = queryBuilder.populate('category', 'name discountPercent discountStartsAt discountExpiresAt isActiveDiscount')
  }
  const product = await queryBuilder.lean()

  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  const cat = typeof product.category === 'object' && product.category !== null ? (product.category as any) : null
  const now = new Date()
  const effectivePricing = resolveEffectiveProductPrice(product, cat, now)

  // 3. Return product payload for form pre-population
  return {
    id: String(product._id),
    name: product.name,
    description: product.description,
    ingredients: product.ingredients || { ar: '', sv: '', en: '' },
    brand: product.brand,
    category: cat ? String(cat._id) : String(product.category || ''),
    categoryDetails: cat ? {
      id: String(cat._id),
      name: cat.name,
      discountPercent: cat.discountPercent ?? 0,
      discountStartsAt: cat.discountStartsAt || null,
      discountExpiresAt: cat.discountExpiresAt || null,
      isActiveDiscount: Boolean(cat.isActiveDiscount),
    } : null,
    price: product.price,
    discount: product.discount ?? 0,
    discountStartsAt: product.discountStartsAt || null,
    discountExpiresAt: product.discountExpiresAt || null,
    stockQuantity: product.stockQuantity,
    safetyBuffer: product.safetyBuffer,
    netQuantity: product.netQuantity,
    grossWeight: product.grossWeight,
    momsRate: product.momsRate,
    countryOfOrigin: product.countryOfOrigin || '',
    barcode: product.barcode || '',
    allergens: (product.allergens || []).map(String),
    images: product.images || [],
    nutritionTable: product.nutritionTable || undefined,
    isActive: product.isActive,
    freeShipping: Boolean(product.freeShipping),
    kortdatum: product.kortdatum ? {
      isKortdatum: Boolean(product.kortdatum.isKortdatum),
      bestBeforeDate: product.kortdatum.bestBeforeDate || null,
      clearanceDiscount: product.kortdatum.clearanceDiscount || 0,
    } : null,
    activeDiscountType: effectivePricing.activeDiscountType,
    appliedDiscountPercent: effectivePricing.appliedDiscountPercent,
    discountedPrice: effectivePricing.appliedDiscountPercent > 0 ? effectivePricing.effectivePriceMinor : null,
  }
})
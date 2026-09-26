// server/api/admin/products/index.post.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '../../../models/Product'
import { isValidMinorUnit } from '../../../../utils/currency'

/**
 * Route: POST /api/admin/products
 * Access: Admin / Staff (protected by server/middleware/admin-auth.ts)
 * 
 * Enforces AC-1 (independent minor unit pricing) and AC-3 (individual safety buffer).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Request body is required',
    })
  }

  // 1. Mandatory Multilingual Field Validation
  if (
    !body.name?.ar?.trim() ||
    !body.name?.sv?.trim() ||
    !body.name?.en?.trim() ||
    !body.description?.ar?.trim() ||
    !body.description?.sv?.trim() ||
    !body.description?.en?.trim()
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Product name and description are mandatory in Arabic, Swedish, and English',
    })
  }

  // 2. Category & Brand Validation
  if (!body.category || !isValidObjectId(body.category)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid category reference is required',
    })
  }

  if (!body.brand?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Brand name is required',
    })
  }

  // 3. Multi-Currency Minor Unit Contract Validation (AC-1)
  const { SEK, EUR, USD } = body.price || {}
  if (!isValidMinorUnit(SEK) || !isValidMinorUnit(EUR) || !isValidMinorUnit(USD)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'SEK, EUR, and USD prices must be non-negative integers in minor units (öre/cents)',
    })
  }

  // 4. Inventory & Buffer Validation (AC-3)
  const stockQuantity = Number(body.stockQuantity)
  const safetyBuffer = Number(body.safetyBuffer)

  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Stock quantity must be a non-negative integer',
    })
  }

  if (!Number.isInteger(safetyBuffer) || safetyBuffer < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Safety buffer must be a non-negative integer',
    })
  }

  // 5. Net Quantity & Moms Rate Validation
  if (!body.netQuantity?.value || body.netQuantity.value <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Net content value must be greater than zero',
    })
  }

  const validUnits = ['g', 'kg', 'ml', 'l', 'st', 'dl', 'cl', 'قطعة']
  if (!validUnits.includes(body.netQuantity?.unit)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Net content unit must be one of: g, kg, ml, l, st',
    })
  }

  if (![12, 25].includes(Number(body.momsRate))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Moms rate must be 12 (food) or 25 (non-food)',
    })
  }

  // 6. Persist to MongoDB Atlas
  const product = new Product({
    name: {
      ar: body.name.ar.trim(),
      sv: body.name.sv.trim(),
      en: body.name.en.trim(),
    },
    description: {
      ar: body.description.ar.trim(),
      sv: body.description.sv.trim(),
      en: body.description.en.trim(),
    },
    ingredients: {
      ar: body.ingredients?.ar?.trim() || '',
      sv: body.ingredients?.sv?.trim() || '',
      en: body.ingredients?.en?.trim() || '',
    },
    brand: body.brand.trim(),
    category: body.category,
    price: {
      SEK,
      EUR,
      USD,
    },
    discount: Number(body.discount) || 0,
    stockQuantity,
    safetyBuffer,
    netQuantity: {
      value: Number(body.netQuantity.value),
      unit: body.netQuantity.unit,
    },
    grossWeight: Number(body.grossWeight) || 0,
    momsRate: Number(body.momsRate),
    countryOfOrigin: body.countryOfOrigin?.trim() || '',
    allergens: Array.isArray(body.allergens) ? body.allergens.filter(isValidObjectId) : [],
    barcode: body.barcode?.trim() || undefined,
    images: Array.isArray(body.images) ? body.images : [],
    isActive: body.isActive !== false,
  })

  await product.save()

  setResponseStatus(event, 201)
  return {
    statusCode: 201,
    id: String(product._id),
    message: 'Product created successfully',
  }
})
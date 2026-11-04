// server/api/admin/products/[id].put.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'
import { isValidMinorUnit } from '~/utils/currency'

/**
 * Route: PUT /api/admin/products/:id
 * Access: Admin only (protected by middleware/admin-auth.ts)
 * 
 * Purpose:
 * Fully updates an existing product document in MongoDB Atlas.
 */
export default defineEventHandler(async (event) => {
  // 1. Validate route ID
  const id = getRouterParam(event, 'id')
  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid product ID format',
    })
  }

  // 2. Parse request body
  const body = await readBody(event)
  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Request body is required',
    })
  }

  // 3. Mandatory Multilingual Field Validation
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

  // 4. Category & Brand Validation
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

  // 5. Minor Unit Validation (Integer öre/cents)
  const { SEK, EUR, USD } = body.price || {}
  if (!isValidMinorUnit(SEK) || !isValidMinorUnit(EUR) || !isValidMinorUnit(USD)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'SEK, EUR, and USD prices must be non-negative integers in minor units',
    })
  }

  // 6. Inventory & Buffer Validation
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

  // 6.5. Discount & Kortdatum Mutual Exclusion Validation
  const isKortdatumEnabled = Boolean(body.kortdatum?.isKortdatum)
  const ordinaryDiscount = Number(body.discount) || 0
  if (isKortdatumEnabled && ordinaryDiscount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kortdatum clearance and ordinary discount are mutually exclusive',
    })
  }

  // 7. Update document in MongoDB Atlas
  const updatedProduct = await Product.findByIdAndUpdate(
    id,
    {
      $set: {
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
        price: { SEK, EUR, USD },
        discount: isKortdatumEnabled ? 0 : ordinaryDiscount,
        discountStartsAt: isKortdatumEnabled
          ? null
          : (body.discountStartsAt && !Number.isNaN(new Date(body.discountStartsAt).getTime())
            ? new Date(body.discountStartsAt)
            : null),
        discountExpiresAt: isKortdatumEnabled
          ? null
          : (body.discountExpiresAt && !Number.isNaN(new Date(body.discountExpiresAt).getTime())
            ? new Date(body.discountExpiresAt)
            : null),
        kortdatum: body.kortdatum ? {
          isKortdatum: Boolean(body.kortdatum.isKortdatum),
          bestBeforeDate: body.kortdatum.bestBeforeDate && !Number.isNaN(new Date(body.kortdatum.bestBeforeDate).getTime())
            ? new Date(body.kortdatum.bestBeforeDate)
            : null,
          clearanceDiscount: Number(body.kortdatum.clearanceDiscount) || 0,
        } : undefined,
        stockQuantity,
        safetyBuffer,
        netQuantity: {
          value: Number(body.netQuantity?.value),
          unit: body.netQuantity?.unit,
        },
        grossWeight: Number(body.grossWeight) || 0,
        momsRate: Number(body.momsRate),
        countryOfOrigin: body.countryOfOrigin?.trim() || '',
        barcode: body.barcode?.trim() || undefined,
        allergens: Array.isArray(body.allergens) ? body.allergens.filter(isValidObjectId) : [],
        images: Array.isArray(body.images) ? body.images : [],
        nutritionTable: body.nutritionTable || undefined,
        isActive: body.isActive !== false,
        freeShipping: Boolean(body.freeShipping),
      },
    },
    { returnDocument: 'after', runValidators: true } // non-deprecated syntax the { new: true } will be deprecated
  )

  if (!updatedProduct) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  return {
    statusCode: 200,
    id: String(updatedProduct._id),
    message: 'Product updated successfully',
  }
})
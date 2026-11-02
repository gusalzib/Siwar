// server/api/admin/products/[id]/discount.patch.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'

/**
 * Dedicated fast-path PATCH endpoint to adjust product discount and campaign schedule
 * without hydrating or mutating full product catalogs, multilingual texts, or media arrays.
 */
export default defineEventHandler(async (event) => {
  // 1. Extract and validate ObjectId parameter
  const id = getRouterParam(event, 'id')
  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid product ID format',
    })
  }

  // 2. Read request body
  const body = await readBody<{
    discount: number
    discountStartsAt?: string | Date | null
    discountExpiresAt?: string | Date | null
  }>(event)

  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Request body must be a valid JSON object',
    })
  }

  // 3. Validate discount boundary [0, 90]
  if (
    typeof body.discount !== 'number' ||
    Number.isNaN(body.discount) ||
    body.discount < 0 ||
    body.discount > 90
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'discount must be between 0 and 90',
    })
  }

  // 4. Find current product
  const product = await Product.findById(id).select('discount discountStartsAt discountExpiresAt updatedAt')
  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  // 5. Parse and validate dates
  let startsAt: Date | null = null
  let expiresAt: Date | null = null

  if (body.discount > 0) {
    if (body.discountStartsAt) {
      const parsedStarts = new Date(body.discountStartsAt)
      if (!Number.isNaN(parsedStarts.getTime())) {
        startsAt = parsedStarts
      }
    }

    if (body.discountExpiresAt) {
      const parsedExpires = new Date(body.discountExpiresAt)
      if (!Number.isNaN(parsedExpires.getTime())) {
        expiresAt = parsedExpires
      }
    }

    if (startsAt && expiresAt && expiresAt.getTime() <= startsAt.getTime()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'discountExpiresAt must be after discountStartsAt',
      })
    }
  }

  // 6. Build atomic update operations
  const updateOp: any = {
    $set: {
      discount: body.discount,
      discountStartsAt: body.discount === 0 ? null : startsAt,
      discountExpiresAt: body.discount === 0 ? null : expiresAt,
      updatedAt: new Date(),
    },
  }

  // 7. Persist atomically
  const updatedProduct = await Product.findByIdAndUpdate(id, updateOp, {
    returnDocument: 'after',
  }).select('discount discountStartsAt discountExpiresAt updatedAt')

  if (!updatedProduct) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found after update',
    })
  }

  // 8. Compute live discount campaign schedule status
  const now = new Date()
  let discountStatus: 'active' | 'scheduled' | 'expired' | 'none' = 'none'
  const discount = updatedProduct.discount ?? 0

  if (discount > 0) {
    const isExpired = Boolean(
      updatedProduct.discountExpiresAt &&
      new Date(updatedProduct.discountExpiresAt).getTime() <= now.getTime()
    )
    const isScheduled = Boolean(
      !isExpired &&
      updatedProduct.discountStartsAt &&
      new Date(updatedProduct.discountStartsAt).getTime() > now.getTime()
    )

    if (isExpired) {
      discountStatus = 'expired'
    } else if (isScheduled) {
      discountStatus = 'scheduled'
    } else {
      discountStatus = 'active'
    }
  }

  const showDiscountBadge = discountStatus === 'active' || discountStatus === 'scheduled'

  return {
    statusCode: 200,
    id: String(updatedProduct._id),
    discount,
    discountStartsAt: updatedProduct.discountStartsAt ?? null,
    discountExpiresAt: updatedProduct.discountExpiresAt ?? null,
    discountStatus,
    showDiscountBadge,
    updatedAt: updatedProduct.updatedAt,
  }
})

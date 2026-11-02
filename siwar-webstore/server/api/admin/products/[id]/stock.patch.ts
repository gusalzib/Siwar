// server/api/admin/products/[id]/stock.patch.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'
import { StoreSettings } from '~/server/models/StoreSettings'
import { resolveEffectiveBuffer } from '~/server/services/inventory.service'

/**
 * Dedicated fast-path PATCH endpoint to adjust product stockQuantity and safetyBuffer
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
    stockQuantity?: number
    delta?: number
    safetyBuffer?: number
  }>(event)

  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Request body must be a valid JSON object',
    })
  }

  // 3. Find current product
  const product = await Product.findById(id).select('stockQuantity safetyBuffer updatedAt')
  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  // 4. Calculate and validate target stockQuantity
  let targetStock: number | undefined

  if (body.delta !== undefined) {
    if (typeof body.delta !== 'number' || !Number.isInteger(body.delta)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Delta must be an integer',
      })
    }
    targetStock = product.stockQuantity + body.delta
  } else if (body.stockQuantity !== undefined) {
    if (typeof body.stockQuantity !== 'number' || !Number.isInteger(body.stockQuantity)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'stockQuantity must be an integer',
      })
    }
    targetStock = body.stockQuantity
  }

  if (targetStock !== undefined && targetStock < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'stockQuantity cannot be negative',
    })
  }

  // 5. Validate safetyBuffer
  if (body.safetyBuffer !== undefined) {
    if (typeof body.safetyBuffer !== 'number' || !Number.isInteger(body.safetyBuffer) || body.safetyBuffer < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'safetyBuffer must be a non-negative integer',
      })
    }
  }

  if (targetStock === undefined && body.safetyBuffer === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No stock or safety buffer adjustments provided',
    })
  }

  // 6. Build atomic update operations
  const updateOp: any = {
    $set: {
      updatedAt: new Date(),
    },
  }

  if (targetStock !== undefined) {
    updateOp.$set.stockQuantity = targetStock
  }

  if (typeof body.safetyBuffer === 'number') {
    updateOp.$set.safetyBuffer = body.safetyBuffer
  }

  // 7. Persist atomically
  const updatedProduct = await Product.findByIdAndUpdate(id, updateOp, {
    returnDocument: 'after',
  }).select('stockQuantity safetyBuffer updatedAt')

  if (!updatedProduct) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found after update',
    })
  }

  // 8. Resolve effective online stock
  let globalBuffer = 3
  try {
    const settings = await StoreSettings.findOne().select('inventory').lean()
    if (typeof settings?.inventory?.defaultGlobalSafetyBuffer === 'number') {
      globalBuffer = settings.inventory.defaultGlobalSafetyBuffer
    }
  } catch {
    // Use fallback 3
  }

  const effectiveBuffer = resolveEffectiveBuffer(
    { stockQuantity: updatedProduct.stockQuantity, safetyBuffer: updatedProduct.safetyBuffer },
    globalBuffer
  )
  const availableStock = Math.max(0, updatedProduct.stockQuantity - effectiveBuffer)

  return {
    statusCode: 200,
    id: String(updatedProduct._id),
    stockQuantity: updatedProduct.stockQuantity,
    safetyBuffer: updatedProduct.safetyBuffer,
    effectiveBuffer,
    availableStock,
    updatedAt: updatedProduct.updatedAt,
  }
})

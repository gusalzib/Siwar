// server/api/admin/products/[id]/free-shipping.patch.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'

/**
 * Fast-path PATCH endpoint to toggle or explicitly set the freeShipping flag
 * on a product without mutating or hydrating the entire document.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid product ID format',
    })
  }

  const body = await readBody<{ freeShipping?: boolean }>(event).catch(() => null)

  const product = await Product.findById(id)
  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  if (body && typeof body.freeShipping === 'boolean') {
    product.freeShipping = body.freeShipping
  } else {
    product.freeShipping = !product.freeShipping
  }

  await product.save()

  return {
    statusCode: 200,
    id: String(product._id),
    freeShipping: product.freeShipping,
    updatedAt: product.updatedAt,
  }
})

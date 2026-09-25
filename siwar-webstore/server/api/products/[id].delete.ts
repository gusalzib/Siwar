// server/api/admin/products/[id].delete.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid product ID',
    })
  }

  const result = await Product.findByIdAndDelete(id)
  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  return {
    statusCode: 200,
    message: 'Product deleted successfully',
  }
})
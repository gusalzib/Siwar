// server/api/admin/products/[id]/toggle-active.patch.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '~/server/models/Product'

/**
 * In e-commerce management, staff frequently need to hide products from public storefront discovery without deleting them.
 * This endpoint achieves that.
 * 
 * HTTP PATCH Semantics: Rather than using PUT (which replaces the entire resource) or DELETE (which destroys the record), 
 * HTTP PATCH is the standard REST method for mutating a single attribute on an existing resource.
 */

export default defineEventHandler(async (event) => {
  // 1. Extract dynamic route parameter ':id' from the request URL
  const id = getRouterParam(event, 'id')

  // 2. Validate route parameter format
  // Mongoose throws an unhandled CastError if given a malformed 24-char hex string.
  // We check for existence and valid MongoDB ObjectId structure upfront.
  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid product ID format',
    })
  }

  // 3. Retrieve the target product from MongoDB
  // We load the full Mongoose document (no .lean()) because we need the .save() method
  const product = await Product.findById(id)

  // 4. Guard: Ensure product exists in database
  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  // 5. Toggle the boolean flag (true becomes false; false becomes true)
  product.isActive = !product.isActive

  // 6. Persist changes to MongoDB Atlas
  // This automatically updates the 'updatedAt' timestamp defined in the schema
  await product.save()

  // 7. Return confirmation payload
  // Informs the client UI of the new state so it can update table badges reactively
  return {
    statusCode: 200,
    id: String(product._id),
    isActive: product.isActive,
  }
})
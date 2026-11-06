// server/api/admin/categories/[id].delete.ts
import { isValidObjectId, Types } from 'mongoose'
import { Category } from '~/server/models/Category'
import { Product } from '~/server/models/Product'

/**
 * DELETE /api/admin/categories/:id
 *
 * Safe category deletion workflow with mandatory product reassignment:
 *
 * 1. Validates that the category exists and is not the protected `isSystemDefault: true` fallback.
 * 2. Counts how many products are currently assigned to this category.
 * 3. Case A (count > 0):
 *    - Requires a valid, distinct `replacementCategoryId` (e.g. another active category or "Övrigt").
 *    - Validates that the replacement category exists in the database.
 *    - Atomically migrates all linked products via `Product.updateMany`.
 *    - Removes the category document permanently.
 *    - Returns `{ success: true, migratedCount: count, replacementCategoryId }`.
 * 4. Case B (count === 0):
 *    - Deletes the category immediately without prompting for or requiring reassignment.
 *    - Returns `{ success: true, migratedCount: 0 }`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid category ID provided.',
    })
  }

  // 1. Locate the category to be deleted
  const targetCategory = await Category.findById(id)
  if (!targetCategory) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found.',
    })
  }

  // 2. Protect the system fallback category from deletion
  if (targetCategory.isSystemDefault) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The system default category is protected and cannot be deleted.',
    })
  }

  // Parse optional JSON request body safely (DELETE requests may omit body)
  let body: { replacementCategoryId?: string } = {}
  try {
    body = (await readBody(event)) || {}
  } catch {
    body = {}
  }

  const { replacementCategoryId } = body

  // 3. Count products associated with this category
  const productCount = await Product.countDocuments({ category: new Types.ObjectId(id) })

  // ---------------------------------------------------------------------------
  // Case A: Category contains products -> Migration is mandatory
  // ---------------------------------------------------------------------------
  if (productCount > 0) {
    if (!replacementCategoryId) {
      throw createError({
        statusCode: 400,
        statusMessage: `Category contains ${productCount} product(s). A replacementCategoryId is required for migration.`,
      })
    }

    if (!isValidObjectId(replacementCategoryId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid replacement category ID format.',
      })
    }

    if (String(replacementCategoryId) === String(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Replacement category must be different from the category being deleted.',
      })
    }

    // Verify replacement category exists
    const replacementExists = await Category.findById(replacementCategoryId).select('_id').lean()
    if (!replacementExists) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Replacement category does not exist.',
      })
    }

    // Atomically reassign all connected products
    await Product.updateMany(
      { category: new Types.ObjectId(id) },
      { $set: { category: new Types.ObjectId(replacementCategoryId) } }
    )

    // Delete the original category document
    await Category.findByIdAndDelete(id)

    return {
      success: true,
      migratedCount: productCount,
      replacementCategoryId: String(replacementCategoryId),
    }
  }

  // ---------------------------------------------------------------------------
  // Case B: Category contains 0 products -> Direct deletion
  // ---------------------------------------------------------------------------
  await Category.findByIdAndDelete(id)

  return {
    success: true,
    migratedCount: 0,
  }
})

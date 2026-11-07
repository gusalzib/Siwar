// server/utils/defaultCategory.ts
import { Category, type ICategory } from '../models/Category'

/**
 * System fallback category configuration.
 *
 * This category serves as the permanent fallback destination when migrating products
 * away from deleted categories. It is localized across Swedish, Arabic, and English
 * and protected via `isSystemDefault: true` to prevent renaming, editing, or deletion.
 */
export const DEFAULT_CATEGORY_DATA = {
  name: {
    sv: 'Övrigt',
    ar: 'أخرى',
    en: 'other',
  },
  slug: {
    sv: 'ovrigt',
    ar: 'other',
    en: 'other',
  },
  isActive: true,
  isSystemDefault: true,
  sortOrder: 9999,
  discountPercent: 0,
  isActiveDiscount: false,
  parentId: null,
}

/**
 * Automatically ensures that the system fallback "Övrigt" / "Other" category exists in MongoDB.
 *
 * Checks if a system default category already exists. If not found, checks whether an
 * existing category with matching slugs/names exists and upgrades it. Otherwise, creates it.
 *
 * @returns {Promise<ICategory>} The system default category document
 */
export async function ensureDefaultCategory(): Promise<ICategory> {
  // 1. Look for category already flagged as system default
  let category = await Category.findOne({ isSystemDefault: true })
  if (category) {
    return category
  }

  // 2. Check if a category matching fallback slug or Swedish name exists to migrate safely
  category = await Category.findOne({
    $or: [
      { 'slug.sv': DEFAULT_CATEGORY_DATA.slug.sv },
      { 'slug.en': DEFAULT_CATEGORY_DATA.slug.en },
      { 'name.sv': DEFAULT_CATEGORY_DATA.name.sv },
    ],
  })

  if (category) {
    category.isSystemDefault = true
    if (!category.isActive) {
      category.isActive = true
    }
    await category.save()
    return category
  }

  // 3. Create fresh system fallback category
  category = await Category.create(DEFAULT_CATEGORY_DATA)
  return category
}


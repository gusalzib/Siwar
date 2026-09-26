// server/api/catalog/filters.get.ts
import { Category } from '~/server/models/Category'
import { Allergen } from '~/server/models/Allergens'
import { Product } from '~/server/models/Product'

// Provides the active taxonomy used to populate the faceted filter sidebar

export default defineEventHandler(async () => {
  const [categories, allergens, distinctBrands, distinctOrigins] = await Promise.all([
    Category.find({ isActive: true }).select('_id name slug').lean(),
    Allergen.find({ isActive: true }).select('_id name code').lean(),
    Product.distinct('brand', { isActive: true }),
    Product.distinct('countryOfOrigin', { isActive: true, countryOfOrigin: { $ne: '' } }),
  ])

  return {
    categories: categories.map((c: any) => ({
      id: String(c._id),
      name: c.name as Record<string, string>,
      slug: c.slug as Record<string, string>,
    })),
    allergens: allergens.map((a: any) => ({
      id: String(a._id),
      code: String(a.code),
      name: a.name as Record<string, string>,
    })),
    brands: (distinctBrands as string[]).filter(Boolean).sort(),
    origins: (distinctOrigins as string[]).filter(Boolean).sort(),
  }
})
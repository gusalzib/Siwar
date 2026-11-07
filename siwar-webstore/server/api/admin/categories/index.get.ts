// server/api/admin/categories/index.get.ts
import { Category } from '~/server/models/Category'
import { Product } from '~/server/models/Product'

export default defineEventHandler(async () => {
  // Query both categories and aggregated product counts in parallel for high performance
  const [categories, productCounts] = await Promise.all([
    Category.find()
      .select('_id name slug sortOrder isActive isSystemDefault discountPercent discountStartsAt discountExpiresAt isActiveDiscount')
      .sort({ sortOrder: 1, 'name.sv': 1 })
      .lean(),
    Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ])

  // Build a lookup map of category ID -> product count
  const countMap = new Map<string, number>()
  for (const item of productCounts) {
    if (item._id) {
      countMap.set(String(item._id), item.count)
    }
  }

  return categories.map((c: any) => ({
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder ?? 0,
    isActive: c.isActive !== false,
    isSystemDefault: Boolean(c.isSystemDefault),
    discountPercent: c.discountPercent ?? 0,
    discountStartsAt: c.discountStartsAt || null,
    discountExpiresAt: c.discountExpiresAt || null,
    isActiveDiscount: Boolean(c.isActiveDiscount),
    productCount: countMap.get(String(c._id)) || 0,
  }))
})
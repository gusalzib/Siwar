// server/api/admin/categories/index.get.ts
import { Category } from '~/server/models/Category'

export default defineEventHandler(async () => {
  const categories = await Category.find()
    .select('_id name slug sortOrder isActive discountPercent discountStartsAt discountExpiresAt isActiveDiscount')
    .sort({ sortOrder: 1, 'name.sv': 1 })
    .lean()

  return categories.map((c: any) => ({
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder ?? 0,
    isActive: c.isActive !== false,
    discountPercent: c.discountPercent ?? 0,
    discountStartsAt: c.discountStartsAt || null,
    discountExpiresAt: c.discountExpiresAt || null,
    isActiveDiscount: Boolean(c.isActiveDiscount),
  }))
})
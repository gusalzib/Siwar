// server/api/admin/categories/index.get.ts
import { Category } from '~/server/models/Category'

export default defineEventHandler(async () => {
  const categories = await Category.find()
    .select('_id name')
    .sort({ sortOrder: 1, 'name.sv': 1 })
    .lean()

    /**
     * Expected Response Shape (HTTP 200 OK):
     * [
     *   {
     *     "id": "65fa2c9e83b1d2001e4a9f10",
     *     "name": {
     *       "ar": "حلويات شرقية",
     *       "sv": "Österländska sötsaker",
     *       "en": "Middle Eastern Sweets"
     *     }
     *   },
     *   {
     *     "id": "65fa2c9e83b1d2001e4a9f11",
     *     "name": {
     *       "ar": "بهارات وتوابل",
     *       "sv": "Kryddor & Örter",
     *       "en": "Spices & Herbs"
     *     }
     *   }
     * ]
     */
  return categories.map((c) => ({
    id: String(c._id),
    name: c.name,
  }))
})
// server/api/admin/allergens/index.get.ts
import { Allergen } from '../../../models/Allergens'

/**
 * Route: GET /api/admin/allergens
 * Access: Admin / Staff (protected by server/middleware/admin-auth.ts)
 * Purpose: Provides pre-populated allergen options for the product entry form.
 */
export default defineEventHandler(async () => {
  const allergens = await Allergen.find({ isActive: true })
    .select('_id code name')
    .sort({ code: 1 })
    .lean()

  return allergens.map((a) => ({
    id: String(a._id),
    code: a.code,
    name: a.name,
  }))
})
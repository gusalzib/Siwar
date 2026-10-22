// server/api/admin/settings/banners.get.ts
import { StoreSettings, type IBanner } from '~/server/models/StoreSettings'

/**
 * Route: GET /api/admin/settings/banners
 * Access: Admin only (protected by server/middleware/admin-auth.ts)
 * Purpose: Retrieves all configured promotional banners sorted by sortOrder.
 */
export default defineEventHandler(async () => {
  let settings = await StoreSettings.findOne().select('banners').lean()

  if (!settings) {
    settings = await StoreSettings.create({ banners: [] })
  }

  const banners = (settings.banners || []).slice().sort((a: IBanner, b: IBanner) => {
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })

  return banners.map((b: any) => ({
    ...b,
    id: b._id ? String(b._id) : b.id,
  }))
})

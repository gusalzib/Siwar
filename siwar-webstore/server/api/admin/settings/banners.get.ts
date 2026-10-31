// server/api/admin/settings/banners.get.ts
import { StoreSettings, type IBanner } from '~/server/models/StoreSettings'

/**
 * Route: GET /api/admin/settings/banners
 * Access: Admin only (protected by server/middleware/admin-auth.ts)
 * Purpose: Retrieves all configured promotional banners sorted by sortOrder.
 */
export default defineEventHandler(async () => {
  let settings = await StoreSettings.findOne().select('banners carouselIntervalMs').lean()

  if (!settings) {
    settings = await StoreSettings.create({ banners: [], carouselIntervalMs: 5000 })
  }

  const banners = (settings.banners || []).slice().sort((a: IBanner, b: IBanner) => {
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })

  const result = banners.map((b: any) => ({
    ...b,
    id: b._id ? String(b._id) : b.id,
  }))

  const interval = (settings as any)?.carouselIntervalMs ?? (settings as any)?.general?.carouselIntervalMs ?? 5000
  ;(result as any).carouselIntervalMs = interval

  return result
})

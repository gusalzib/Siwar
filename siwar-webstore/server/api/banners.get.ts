// server/api/banners.get.ts
import { StoreSettings, type IBanner } from '~/server/models/StoreSettings'

/**
 * Route: GET /api/banners
 * Access: Public storefront endpoint
 * Purpose: Returns currently active and scheduled promotional banners sorted by sortOrder.
 */
export default defineEventHandler(async () => {
  const settings = await StoreSettings.findOne().select('banners').lean()
  if (!settings || !settings.banners || !Array.isArray(settings.banners)) {
    return []
  }

  const now = new Date()

  // Filter for active banners within valid scheduling window
  const activeBanners = settings.banners.filter((banner: IBanner) => {
    if (banner.isActive === false) return false

    if (banner.startsAt && new Date(banner.startsAt) > now) {
      return false
    }

    if (banner.expiresAt && new Date(banner.expiresAt) <= now) {
      return false
    }

    return true
  })

  // Sort ascending by sortOrder
  activeBanners.sort((a: IBanner, b: IBanner) => {
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })

  // Return public sanitized representation
  return activeBanners.map((b: any) => ({
    id: b._id ? String(b._id) : b.id,
    title: b.title,
    subtitle: b.subtitle,
    badge: b.badge,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl,
    linkUrl: b.linkUrl || '/catalog',
    sortOrder: b.sortOrder ?? 0,
  }))
})

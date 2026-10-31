// server/api/admin/settings/banners.put.ts
import { StoreSettings, clearGeneralSettingsCache } from '~/server/models/StoreSettings'

/**
 * Route: PUT /api/admin/settings/banners
 * Access: Admin only (protected by server/middleware/admin-auth.ts)
 * Purpose: Persists updated promotional banners array and carousel interval with payload validation.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // 1. Fetch or initialize the StoreSettings singleton
  let settings = await StoreSettings.findOne()
  if (!settings) {
    settings = new StoreSettings()
  }

  // Update carousel interval if provided
  if (body.carouselIntervalMs !== undefined) {
    let ms = Number(body.carouselIntervalMs)
    if (ms >= 2 && ms <= 30) {
      ms = ms * 1000
    }
    ms = Math.max(2000, Math.min(30000, ms || 5000))
    settings.carouselIntervalMs = ms
    if (settings.general) {
      settings.general.carouselIntervalMs = ms
    }
  }

  // If this request is only updating the carousel interval
  if (!body.banners && body.carouselIntervalMs !== undefined) {
    await settings.save()
    clearGeneralSettingsCache()
    return {
      statusCode: 200,
      carouselIntervalMs: settings.carouselIntervalMs,
    }
  }

  if (!body.banners || !Array.isArray(body.banners)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid banners array payload' })
  }

  // Validate each banner
  for (let i = 0; i < body.banners.length; i++) {
    const banner = body.banners[i]
    if (!banner.title?.ar?.trim() || !banner.title?.sv?.trim() || !banner.title?.en?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: `Banner at position ${i + 1} is missing required title translations (Arabic, Swedish, English)`,
      })
    }
    if (!banner.subtitle?.ar?.trim() || !banner.subtitle?.sv?.trim() || !banner.subtitle?.en?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: `Banner at position ${i + 1} is missing required subtitle translations (Arabic, Swedish, English)`,
      })
    }
    if (!banner.imageUrl?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: `Banner at position ${i + 1} is missing required desktop image URL`,
      })
    }
    if (!banner.linkUrl?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: `Banner at position ${i + 1} is missing required link destination URL`,
      })
    }
  }

  // 2. Map and sanitize banners
  settings.banners = body.banners.map((b: any, index: number) => ({
    _id: b._id || b.id || undefined,
    title: {
      ar: b.title.ar.trim(),
      sv: b.title.sv.trim(),
      en: b.title.en.trim(),
    },
    subtitle: {
      ar: (b.subtitle?.ar || '').trim(),
      sv: (b.subtitle?.sv || '').trim(),
      en: (b.subtitle?.en || '').trim(),
    },
    badge: {
      ar: (b.badge?.ar || '').trim(),
      sv: (b.badge?.sv || '').trim(),
      en: (b.badge?.en || '').trim(),
    },
    imageUrl: b.imageUrl.trim(),
    mobileImageUrl: (b.mobileImageUrl || '').trim(),
    linkUrl: b.linkUrl.trim(),
    sortOrder: typeof b.sortOrder === 'number' ? b.sortOrder : index,
    isActive: b.isActive !== false,
    startsAt: b.startsAt ? new Date(b.startsAt) : null,
    expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
  }))

  // 3. Persist to MongoDB
  await settings.save()
  clearGeneralSettingsCache()

  // 4. Return formatted response
  const updatedBanners = (settings.banners || []).map((b: any) => ({
    ...b.toObject ? b.toObject() : b,
    id: b._id ? String(b._id) : b.id,
  }))

  return {
    statusCode: 200,
    banners: updatedBanners,
    carouselIntervalMs: settings.carouselIntervalMs ?? 5000,
  }
})

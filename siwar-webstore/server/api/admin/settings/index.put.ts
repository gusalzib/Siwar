// server/api/admin/settings/index.put.ts
import {
  StoreSettings,
  clearGeneralSettingsCache,
  clearPickupSettingsCache,
  DEFAULT_GENERAL_CONFIG,
  normalizeSchedule,
  formatWeeklySchedule,
  type ISocialLink,
} from '~/server/models/StoreSettings'

const VALID_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'whatsapp', 'youtube', 'x']

/**
 * Route: PUT /api/admin/settings
 * Access: Admin only (protected by server/middleware/admin-auth.ts)
 * Purpose: Persists top-level store settings including socialLinks and general settings.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let settings = await StoreSettings.findOne()
  if (!settings) {
    settings = new StoreSettings()
  }

  // 1. Process and persist socialLinks if provided directly or within general
  const incomingSocial = body.socialLinks !== undefined ? body.socialLinks : body.general?.socialLinks
  if (incomingSocial !== undefined) {
    const sanitizedSocial: ISocialLink[] = Array.isArray(incomingSocial)
      ? incomingSocial
          .filter((item: any) => item && VALID_PLATFORMS.includes(item.platform) && typeof item.url === 'string')
          .map((item: any, idx: number) => ({
            platform: item.platform,
            url: item.url.trim(),
            isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx,
          }))
      : []

    settings.socialLinks = sanitizedSocial
    if (settings.general) {
      settings.general.socialLinks = sanitizedSocial
    }
  }

  // 2. Process general settings if provided directly or nested
  const genPayload = body.general || (body.storeName ? body : null)
  if (genPayload) {
    const schedule = normalizeSchedule(genPayload.schedule || settings.general?.schedule)
    const openingHours = {
      ar: genPayload.openingHours?.ar || formatWeeklySchedule(schedule, 'ar'),
      sv: genPayload.openingHours?.sv || formatWeeklySchedule(schedule, 'sv'),
      en: genPayload.openingHours?.en || formatWeeklySchedule(schedule, 'en'),
    }

    settings.general = {
      storeName: {
        ar: genPayload.storeName?.ar?.trim() || settings.general?.storeName?.ar || DEFAULT_GENERAL_CONFIG.storeName.ar,
        sv: genPayload.storeName?.sv?.trim() || settings.general?.storeName?.sv || DEFAULT_GENERAL_CONFIG.storeName.sv,
        en: genPayload.storeName?.en?.trim() || settings.general?.storeName?.en || DEFAULT_GENERAL_CONFIG.storeName.en,
      },
      tagline: {
        ar: genPayload.tagline?.ar?.trim() ?? settings.general?.tagline?.ar ?? DEFAULT_GENERAL_CONFIG.tagline?.ar,
        sv: genPayload.tagline?.sv?.trim() ?? settings.general?.tagline?.sv ?? DEFAULT_GENERAL_CONFIG.tagline?.sv,
        en: genPayload.tagline?.en?.trim() ?? settings.general?.tagline?.en ?? DEFAULT_GENERAL_CONFIG.tagline?.en,
      },
      company: {
        name: genPayload.company?.name?.trim() || settings.general?.company?.name || DEFAULT_GENERAL_CONFIG.company.name,
        orgNumber: genPayload.company?.orgNumber?.trim() || settings.general?.company?.orgNumber || DEFAULT_GENERAL_CONFIG.company.orgNumber,
        vatNumber: genPayload.company?.vatNumber?.trim() || settings.general?.company?.vatNumber || DEFAULT_GENERAL_CONFIG.company.vatNumber,
      },
      contact: {
        email: genPayload.contact?.email?.trim() || settings.general?.contact?.email || DEFAULT_GENERAL_CONFIG.contact.email,
        phone: genPayload.contact?.phone?.trim() || settings.general?.contact?.phone || DEFAULT_GENERAL_CONFIG.contact.phone,
      },
      address: {
        street: genPayload.address?.street?.trim() || settings.general?.address?.street || DEFAULT_GENERAL_CONFIG.address.street,
        postalCode: genPayload.address?.postalCode?.trim() || settings.general?.address?.postalCode || DEFAULT_GENERAL_CONFIG.address.postalCode,
        city: genPayload.address?.city?.trim() || settings.general?.address?.city || DEFAULT_GENERAL_CONFIG.address.city,
        country: genPayload.address?.country?.trim() || settings.general?.address?.country || DEFAULT_GENERAL_CONFIG.address.country,
      },
      schedule,
      openingHours,
      socialLinks: settings.socialLinks || [],
    }

    if (body.syncPickup !== false && settings.pickup) {
      settings.pickup.address = { ...settings.general.address }
      settings.pickup.schedule = schedule.map((d) => ({ ...d }))
      settings.pickup.pickupHours = { ...openingHours }
    }
  }

  await settings.save()
  clearGeneralSettingsCache()
  clearPickupSettingsCache()

  return {
    statusCode: 200,
    socialLinks: settings.socialLinks || [],
    general: settings.general,
  }
})

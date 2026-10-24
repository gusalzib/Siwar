// server/api/admin/settings/general.put.ts
import {
  StoreSettings,
  clearGeneralSettingsCache,
  clearPickupSettingsCache,
  DEFAULT_GENERAL_CONFIG,
  normalizeSchedule,
  formatWeeklySchedule,
} from '~/server/models/StoreSettings'

/**
 * Route: PUT /api/admin/settings/general
 * Access: Admin only
 * Purpose: Updates the general store configuration (company, contact, address, schedule, identity).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let settings = await StoreSettings.findOne()
  if (!settings) {
    settings = new StoreSettings()
  }

  // 1. Process weekly schedule with strict normalization
  const schedule = normalizeSchedule(body.schedule || settings.general?.schedule)

  // 2. Format opening hours
  const openingHours = {
    ar: body.openingHours?.ar || formatWeeklySchedule(schedule, 'ar'),
    sv: body.openingHours?.sv || formatWeeklySchedule(schedule, 'sv'),
    en: body.openingHours?.en || formatWeeklySchedule(schedule, 'en'),
  }

  // 3. Assemble general settings
  settings.general = {
    storeName: {
      ar: body.storeName?.ar?.trim() || settings.general?.storeName?.ar || DEFAULT_GENERAL_CONFIG.storeName.ar,
      sv: body.storeName?.sv?.trim() || settings.general?.storeName?.sv || DEFAULT_GENERAL_CONFIG.storeName.sv,
      en: body.storeName?.en?.trim() || settings.general?.storeName?.en || DEFAULT_GENERAL_CONFIG.storeName.en,
    },
    tagline: {
      ar: body.tagline?.ar?.trim() ?? settings.general?.tagline?.ar ?? DEFAULT_GENERAL_CONFIG.tagline?.ar,
      sv: body.tagline?.sv?.trim() ?? settings.general?.tagline?.sv ?? DEFAULT_GENERAL_CONFIG.tagline?.sv,
      en: body.tagline?.en?.trim() ?? settings.general?.tagline?.en ?? DEFAULT_GENERAL_CONFIG.tagline?.en,
    },
    company: {
      name: body.company?.name?.trim() || settings.general?.company?.name || DEFAULT_GENERAL_CONFIG.company.name,
      orgNumber: body.company?.orgNumber?.trim() || settings.general?.company?.orgNumber || DEFAULT_GENERAL_CONFIG.company.orgNumber,
      vatNumber: body.company?.vatNumber?.trim() || settings.general?.company?.vatNumber || DEFAULT_GENERAL_CONFIG.company.vatNumber,
    },
    contact: {
      email: body.contact?.email?.trim() || settings.general?.contact?.email || DEFAULT_GENERAL_CONFIG.contact.email,
      phone: body.contact?.phone?.trim() || settings.general?.contact?.phone || DEFAULT_GENERAL_CONFIG.contact.phone,
    },
    address: {
      street: body.address?.street?.trim() || settings.general?.address?.street || DEFAULT_GENERAL_CONFIG.address.street,
      postalCode: body.address?.postalCode?.trim() || settings.general?.address?.postalCode || DEFAULT_GENERAL_CONFIG.address.postalCode,
      city: body.address?.city?.trim() || settings.general?.address?.city || DEFAULT_GENERAL_CONFIG.address.city,
      country: body.address?.country?.trim() || settings.general?.address?.country || DEFAULT_GENERAL_CONFIG.address.country,
    },
    schedule,
    openingHours,
  }

  // 4. Keep pickup address & schedule aligned with physical store location if sync requested or default
  if (body.syncPickup !== false && settings.pickup) {
    settings.pickup.address = { ...settings.general.address }
    settings.pickup.schedule = schedule.map((d) => ({ ...d }))
    settings.pickup.pickupHours = { ...openingHours }
  }

  await settings.save()
  clearGeneralSettingsCache()
  clearPickupSettingsCache()

  return {
    statusCode: 200,
    general: settings.general,
  }
})

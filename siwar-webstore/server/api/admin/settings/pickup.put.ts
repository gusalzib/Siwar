// server/api/admin/settings/pickup.put.ts
import {
  StoreSettings,
  clearPickupSettingsCache,
  DEFAULT_PICKUP_CONFIG,
  normalizeSchedule,
  formatWeeklySchedule,
} from '~/server/models/StoreSettings'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let settings = await StoreSettings.findOne()
  if (!settings) {
    settings = new StoreSettings()
  }

  // 1. Process granular week schedule if provided, or fallback to existing/default
  const schedule = normalizeSchedule(body.schedule || settings.pickup?.schedule)

  // 2. Compute formatted hours from granular schedule or use manual overrides if explicitly sent
  const pickupHours = {
    ar: body.pickupHours?.ar || formatWeeklySchedule(schedule, 'ar'),
    sv: body.pickupHours?.sv || formatWeeklySchedule(schedule, 'sv'),
    en: body.pickupHours?.en || formatWeeklySchedule(schedule, 'en'),
  }

  // 3. Update pickup configuration
  settings.pickup = {
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : (settings.pickup?.enabled ?? true),
    address: {
      street: body.address?.street || settings.pickup?.address?.street || DEFAULT_PICKUP_CONFIG.address.street,
      postalCode: body.address?.postalCode || settings.pickup?.address?.postalCode || DEFAULT_PICKUP_CONFIG.address.postalCode,
      city: body.address?.city || settings.pickup?.address?.city || DEFAULT_PICKUP_CONFIG.address.city,
      country: body.address?.country || settings.pickup?.address?.country || DEFAULT_PICKUP_CONFIG.address.country,
    },
    schedule,
    pickupHours,
    instructions: {
      ar: body.instructions?.ar || settings.pickup?.instructions?.ar || DEFAULT_PICKUP_CONFIG.instructions.ar,
      sv: body.instructions?.sv || settings.pickup?.instructions?.sv || DEFAULT_PICKUP_CONFIG.instructions.sv,
      en: body.instructions?.en || settings.pickup?.instructions?.en || DEFAULT_PICKUP_CONFIG.instructions.en,
    },
  }

  await settings.save()
  clearPickupSettingsCache()

  return {
    statusCode: 200,
    pickup: settings.pickup,
  }
})

// server/api/admin/settings/shipping.get.ts
import { StoreSettings } from '~/server/models/StoreSettings'
import { DEFAULT_SHIPPING_CONFIG } from '~/utils/shipping'

export default defineEventHandler(async () => {
  let settings = await StoreSettings.findOne().select('shipping').lean()

  if (!settings) {
    /**
     * Lazy initialization / database seeding:
     * If no store settings exist yet (e.g., fresh install or first run),
     * automatically create the initial record with baseline shipping configurations
     * instead of returning null or throwing an error. Subsequent requests will
     * fetch this newly created record.
     */
    settings = await StoreSettings.create({ shipping: DEFAULT_SHIPPING_CONFIG })
  }

  return settings.shipping
})
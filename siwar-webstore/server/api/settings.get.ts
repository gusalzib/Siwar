// server/api/settings.get.ts
import { getStoreGeneralSettings, getStorePickupSettings } from '~/server/models/StoreSettings'

/**
 * Route: GET /api/settings
 * Access: Public storefront endpoint
 * Purpose: Returns general store settings for footer, contact details, physical address, pickup configuration, and opening hours.
 */
export default defineEventHandler(async () => {
  const general = await getStoreGeneralSettings()
  const pickup = await getStorePickupSettings()

  return {
    storeName: general.storeName,
    tagline: general.tagline,
    company: general.company,
    contact: general.contact,
    address: general.address,
    schedule: general.schedule,
    openingHours: general.openingHours,
    carouselIntervalMs: general.carouselIntervalMs ?? 5000,
    pickup: {
      enabled: pickup.enabled,
      address: pickup.address,
      schedule: pickup.schedule,
      pickupHours: pickup.pickupHours,
      instructions: pickup.instructions,
    },
    socialLinks: (general.socialLinks || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    paymentMethods: ['swish', 'visa', 'mastercard'],
  }
})

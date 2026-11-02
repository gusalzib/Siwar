// server/api/settings.get.ts
import { getStoreGeneralSettings, getStorePickupSettings } from '~/server/models/StoreSettings'
import { getCachedShippingSettings } from '~/server/services/shipping.service'

/**
 * Route: GET /api/settings
 * Access: Public storefront endpoint
 * Purpose: Returns general store settings for footer, contact details, physical address, pickup configuration, shipping rules, and opening hours.
 */
export default defineEventHandler(async () => {
  const general = await getStoreGeneralSettings()
  const pickup = await getStorePickupSettings()
  const shipping = await getCachedShippingSettings()

  return {
    storeName: general.storeName,
    tagline: general.tagline,
    company: general.company,
    companyName: general.company?.name || 'Siwar Butik AB',
    orgNumber: general.company?.orgNumber || '559123-4567',
    momsNumber: general.company?.vatNumber || 'SE559123456701',
    vatNumber: general.company?.vatNumber || 'SE559123456701',
    contact: general.contact,
    contactEmail: general.contact?.email || 'order@siwar.se',
    contactPhone: general.contact?.phone || '+46 35 123 456',
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
    shipping: {
      freeShippingThresholdMinorSEK: (shipping as any).freeShippingThresholdMinorSEK ?? 89900,
      freeShippingItemGrantsEntireOrder: Boolean((shipping as any).freeShippingItemGrantsEntireOrder),
      deliveryDays: (shipping as any).deliveryDays || { min: 1, max: 3 },
      tiers: (shipping as any).tiers || [],
    },
    paymentMethods: ['swish', 'visa', 'mastercard'],
  }
})

// server/api/settings.get.ts
import { getStoreGeneralSettings } from '~/server/models/StoreSettings'

/**
 * Route: GET /api/settings
 * Access: Public storefront endpoint
 * Purpose: Returns general store settings for footer, contact details, physical address, and opening hours.
 */
export default defineEventHandler(async () => {
  const general = await getStoreGeneralSettings()

  return {
    storeName: general.storeName,
    tagline: general.tagline,
    company: general.company,
    contact: general.contact,
    address: general.address,
    schedule: general.schedule,
    openingHours: general.openingHours,
    paymentMethods: ['swish', 'visa', 'mastercard'],
  }
})

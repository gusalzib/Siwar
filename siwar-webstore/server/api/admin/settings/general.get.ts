// server/api/admin/settings/general.get.ts
import { getStoreGeneralSettings } from '~/server/models/StoreSettings'

/**
 * Route: GET /api/admin/settings/general
 * Access: Admin only
 * Purpose: Fetches the store general configuration.
 */
export default defineEventHandler(async () => {
  return await getStoreGeneralSettings()
})

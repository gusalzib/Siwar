// server/api/admin/settings/pickup.get.ts
import { getStorePickupSettings } from '~/server/models/StoreSettings'

export default defineEventHandler(async () => {
  return await getStorePickupSettings()
})

// server/api/admin/settings/shipping.put.ts
import { StoreSettings } from '~/server/models/StoreSettings'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.tiers || !Array.isArray(body.tiers)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tiers array' })
  }

  // 1. Fetch the existing singleton settings document (or create an instance if none exists)
  let settings = await StoreSettings.findOne()

  if (!settings) {
    settings = new StoreSettings()
  }

  // 2. Mutate the shipping configuration
  settings.shipping = {
    freeShippingThresholdMinorSEK: Math.round(Number(body.freeShippingThresholdMinorSEK)),
    deliveryDays: {
      min: Number(body.deliveryDays?.min ?? 1),
      max: Number(body.deliveryDays?.max ?? 3),
    },
    tiers: body.tiers.map((t: any) => ({
      maxWeightGrams: Number(t.maxWeightGrams),
      feeMinorSEK: Math.round(Number(t.feeMinorSEK)),
    })),
  }

  // 3. Persist to MongoDB Atlas
  await settings.save()

  // 4. Return the updated shipping configuration directly
  return {
    statusCode: 200,
    shipping: settings.shipping,
  }
})
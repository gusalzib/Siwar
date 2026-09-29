// server/services/shipping.service.ts
import { StoreSettings, type IShippingTier } from '~/server/models/StoreSettings'

import { DEFAULT_SHIPPING_CONFIG } from '~/utils/shipping'

/**
 * Cached loader for StoreSettings.
 * Keeps configuration in-memory and revalidates every 10 minutes,
 * or immediately when invalidated by the admin endpoint.
 */
export const getCachedShippingSettings = defineCachedFunction(
  async () => {
    const settings = await StoreSettings.findOne().lean()
    return settings?.shipping || DEFAULT_SHIPPING_CONFIG
  },
  {
    maxAge: 60 * 10, // 10 minutes
    name: 'shippingSettings',
    getKey: () => 'default',
  }
)

/**
 * Calculates shipping fee in minor units (SEK) based on total gross weight
 * and subtotal against active admin settings.
 */
export async function calculateShippingFee(
  grossWeightGrams: number,
  subtotalMinorSEK: number
): Promise<{ feeMinorSEK: number; isFreeShipping: boolean }> {
  const config = await getCachedShippingSettings()

  // 1. Free Shipping Check
  if (subtotalMinorSEK >= config.freeShippingThresholdMinorSEK) {
    return { feeMinorSEK: 0, isFreeShipping: true }
  }

  // 2. Sort tiers ascending by maxWeightGrams
  const sortedTiers = [...config.tiers].sort((a, b) => a.maxWeightGrams - b.maxWeightGrams)

  // 3. Find matching tier
  const matchedTier = sortedTiers.find((t) => grossWeightGrams <= t.maxWeightGrams)

  // Fallback to highest tier if weight exceeds all configured thresholds
  const feeMinorSEK = matchedTier
    ? matchedTier.feeMinorSEK
    : sortedTiers[sortedTiers.length - 1]?.feeMinorSEK || 10900

  return { feeMinorSEK, isFreeShipping: false }
}
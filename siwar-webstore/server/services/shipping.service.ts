// server/services/shipping.service.ts
import { StoreSettings, type IShippingTier } from '~/server/models/StoreSettings'

import { DEFAULT_SHIPPING_CONFIG, type ShippingConfig } from '~/utils/shipping'

export interface ShippingItemInput {
  grossWeight?: number
  freeShipping?: boolean
  quantity?: number
}

export interface ServerShippingConfig {
  freeShippingThresholdMinorSEK?: number
  freeShippingItemGrantsEntireOrder?: boolean
  deliveryDays?: { min: number; max: number }
  tiers?: IShippingTier[]
}

let cachedShipping: ServerShippingConfig | null = null
let shippingCacheExpiry = 0

/**
 * In-memory cached loader for StoreSettings shipping configuration.
 * Revalidates every 60 seconds or immediately when cleared.
 * Compatible with Vitest unit tests (no Nitro runtime dependency).
 */
export async function getCachedShippingSettings(): Promise<ServerShippingConfig> {
  const now = Date.now()
  if (cachedShipping && now < shippingCacheExpiry) {
    return cachedShipping
  }

  try {
    const settings = await StoreSettings.findOne().lean()
    cachedShipping = (settings?.shipping as ServerShippingConfig) || (DEFAULT_SHIPPING_CONFIG as unknown as ServerShippingConfig)
  } catch {
    cachedShipping = DEFAULT_SHIPPING_CONFIG as unknown as ServerShippingConfig
  }

  shippingCacheExpiry = now + 60 * 1000 // 60 seconds
  return cachedShipping
}

export function clearShippingSettingsCache() {
  cachedShipping = null
  shippingCacheExpiry = 0
}

/**
 * Calculates shipping fee in minor units (SEK) based on total gross weight
 * or line items and subtotal against active admin settings.
 *
 * Rules:
 * 1. If subtotalMinorSEK >= freeShippingThresholdMinorSEK, free shipping (0 SEK).
 * 2. If line items are provided:
 *    - If all items have freeShipping === true, or if freeShippingItemGrantsEntireOrder is true
 *      and at least one item has freeShipping === true, fee is 0 SEK.
 *    - Free shipping items are excluded from total gross parcel weight.
 * 3. Chargeable weight is mapped to active weight tiers.
 */
export async function calculateShippingFee(
  weightOrItems: number | ShippingItemInput[],
  subtotalMinorSEK: number,
  itemsParam?: ShippingItemInput[],
  configOverride?: ServerShippingConfig
): Promise<{ feeMinorSEK: number; isFreeShipping: boolean; chargeableWeightGrams: number }> {
  const config = configOverride || (await getCachedShippingSettings()) as ServerShippingConfig
  const threshold = config?.freeShippingThresholdMinorSEK ?? 89900
  const freeShippingItemGrantsEntireOrder = Boolean(config?.freeShippingItemGrantsEntireOrder)

  // 1. Free Shipping Threshold Check
  if (subtotalMinorSEK >= threshold) {
    return { feeMinorSEK: 0, isFreeShipping: true, chargeableWeightGrams: 0 }
  }

  const items: ShippingItemInput[] = Array.isArray(weightOrItems)
    ? weightOrItems
    : (itemsParam || [])

  let grossWeightGrams = typeof weightOrItems === 'number' ? weightOrItems : 0

  if (items.length > 0) {
    const hasFreeShippingItem = items.some((i) => Boolean(i.freeShipping))
    const allFreeShipping = items.every((i) => Boolean(i.freeShipping))

    // Promotional item-level free shipping rules
    if (allFreeShipping || (freeShippingItemGrantsEntireOrder && hasFreeShippingItem)) {
      return { feeMinorSEK: 0, isFreeShipping: true, chargeableWeightGrams: 0 }
    }

    // Exclude free shipping items from parcel weight
    grossWeightGrams = items.reduce((sum, item) => {
      if (item.freeShipping) return sum
      const weight = Number(item.grossWeight) || 0
      const qty = Number(item.quantity) || 1
      return sum + weight * qty
    }, 0)

    if (grossWeightGrams <= 0) {
      return { feeMinorSEK: 0, isFreeShipping: true, chargeableWeightGrams: 0 }
    }
  }

  // 2. Sort tiers ascending by maxWeightGrams
  const sortedTiers = [...((config as any).tiers || [])].sort((a, b) => a.maxWeightGrams - b.maxWeightGrams)

  // 3. Find matching tier
  const matchedTier = sortedTiers.find((t) => grossWeightGrams <= t.maxWeightGrams)

  // Fallback to highest tier if weight exceeds all configured thresholds
  const feeMinorSEK = matchedTier
    ? matchedTier.feeMinorSEK
    : sortedTiers[sortedTiers.length - 1]?.feeMinorSEK || 10900

  return { feeMinorSEK, isFreeShipping: false, chargeableWeightGrams: grossWeightGrams }
}
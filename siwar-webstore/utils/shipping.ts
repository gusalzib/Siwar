// utils/shipping.ts
import type { MultiCurrencyPrice } from '~/stores/cart'

export interface ShippingTier {
  maxWeightGrams: number
  price: MultiCurrencyPrice
}

export interface ShippingConfig {
  freeShippingThreshold: MultiCurrencyPrice
  freeShippingItemGrantsEntireOrder?: boolean
  tiers: ShippingTier[]
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  freeShippingThreshold: {
    SEK: 89900, // 899.00 SEK
    EUR: 8500,  // 85.00 EUR
    USD: 9000,  // 90.00 USD
  },
  freeShippingItemGrantsEntireOrder: false,
  tiers: [
    {
      maxWeightGrams: 3000,
      price: { SEK: 7700, EUR: 750, USD: 800 },
    },
    {
      maxWeightGrams: 7000,
      price: { SEK: 8900, EUR: 850, USD: 900 },
    },
    {
      maxWeightGrams: Infinity,
      price: { SEK: 10900, EUR: 1050, USD: 1100 },
    },
  ],
}

/**
 * Resolves a product's weight in grams from `grossWeight`, falling back to
 * `netQuantity` (`g` or `kg`) if `grossWeight` is missing or non-positive.
 */
export function resolveProductGrossWeightGrams(product?: {
  grossWeight?: number | null
  netQuantity?: { value?: number; unit?: string } | null
} | null): number {
  if (!product) return 0
  const rawGross = Number(product.grossWeight)
  if (Number.isFinite(rawGross) && rawGross > 0) {
    return rawGross
  }
  const netVal = Number(product.netQuantity?.value)
  if (Number.isFinite(netVal) && netVal > 0) {
    if (product.netQuantity?.unit === 'g') return netVal
    if (product.netQuantity?.unit === 'kg') return Math.round(netVal * 1000)
  }
  return 0
}
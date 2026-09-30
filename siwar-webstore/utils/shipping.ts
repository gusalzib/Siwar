// utils/shipping.ts
import type { MultiCurrencyPrice } from '~/stores/cart'

export interface ShippingTier {
  maxWeightGrams: number
  price: MultiCurrencyPrice
}

export interface ShippingConfig {
  freeShippingThreshold: MultiCurrencyPrice
  tiers: ShippingTier[]
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  freeShippingThreshold: {
    SEK: 89900, // 899.00 SEK
    EUR: 8500,  // 85.00 EUR
    USD: 9000,  // 90.00 USD
  },
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
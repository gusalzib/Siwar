export const DEFAULT_SHIPPING_CONFIG = {
  freeShippingThresholdMinorSEK: 89900,
  deliveryDays: { min: 1, max: 3 },
  tiers: [
    { maxWeightGrams: 3000, feeMinorSEK: 7700 },
    { maxWeightGrams: 7000, feeMinorSEK: 8900 },
    { maxWeightGrams: 9999999, feeMinorSEK: 10900 },
  ],
}

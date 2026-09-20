// tests/unit/pricing.service.spec.ts
import { describe, it, expect } from 'vitest'
import {
  calculateJamforpris,
  calculateMomsSplit,
  type LineItemInput,
} from '../../server/services/pricing.service'

describe('Pricing Service - calculateJamforpris', () => {
  // --- Standard Unit Normalization ---
  it('converts grams (g) to standard price per kilogram (kg)', () => {
    // 250g jar of spices priced at 45.00 SEK (4,500 öre) -> 180.00 SEK/kg (18,000 öre/kg)
    const result = calculateJamforpris(4500, 250, 'g')
    expect(result).toBe(18000)
  })

  it('handles kilogram (kg) content without unit conversion scaling', () => {
    // 1.5 kg bag of bulgur priced at 30.00 SEK (3,000 öre) -> 20.00 SEK/kg (2,000 öre/kg)
    const result = calculateJamforpris(3000, 1.5, 'kg')
    expect(result).toBe(2000)
  })

  it('converts milliliters (ml) to standard price per liter (l)', () => {
    // 250 ml pomegranate molasses priced at 60.00 SEK (6,000 öre) -> 240.00 SEK/L (24,000 öre/L)
    const result = calculateJamforpris(6000, 250, 'ml')
    expect(result).toBe(24000)
  })

  it('handles liter (l) content without unit conversion scaling', () => {
    // 2.5 L olive oil tin priced at 250.00 SEK (25,000 öre) -> 100.00 SEK/L (10,000 öre/L)
    const result = calculateJamforpris(25000, 2.5, 'l')
    expect(result).toBe(10000)
  })

  // --- Rounding and Edge Cases ---
  it('deterministically rounds fractional minor units half-up', () => {
    // 330 ml drink priced at 15.00 SEK (1,500 öre)
    // Exact math: (1500 * 1000) / 330 = 4,545.4545... -> rounds to 4,545 öre/L
    expect(calculateJamforpris(1500, 330, 'ml')).toBe(4545)

    // 700g jar priced at 39.00 SEK (3,900 öre)
    // Exact math: (3900 * 1000) / 700 = 5,571.4285... -> rounds to 5,571 öre/kg
    expect(calculateJamforpris(3900, 700, 'g')).toBe(5571)

    // Exact 0.5 half-up tie breaker: (1 * 1) / 2 = 0.5 -> rounds to 1
    expect(calculateJamforpris(1, 2, 'kg')).toBe(1)
  })

  it('returns 0 when price is 0 (promotional or free item)', () => {
    expect(calculateJamforpris(0, 500, 'g')).toBe(0)
  })

  // --- Input Validation Guards ---
  it('throws an error when netQuantity is 0 or negative', () => {
    expect(() => calculateJamforpris(4500, 0, 'g')).toThrowError(
      'Quantity must be greater than zero'
    )
    expect(() => calculateJamforpris(4500, -100, 'g')).toThrowError(
      'Quantity must be greater than zero'
    )
  })

  it('throws an error if an invalid unit is passed', () => {
    // TypeScript prevents this at compile time, but we test runtime safety
    expect(() => calculateJamforpris(4500, 500, 'oz' as any)).toThrowError(
      'Invalid unit'
    )
  })
})

describe('Pricing Service - calculateMomsSplit', () => {
  // --- Boundary: Empty Cart Scenarios ---
  it('handles an empty cart with zero shipping', () => {
    const result = calculateMomsSplit([], 0)

    expect(result).toEqual({
      totalGrossMinor: 0,
      totalNetMinor: 0,
      totalMomsMinor: 0,
      moms12: { taxableGrossMinor: 0, taxableNetMinor: 0, momsAmountMinor: 0 },
      moms25: { taxableGrossMinor: 0, taxableNetMinor: 0, momsAmountMinor: 0 },
    })
  })

  it('handles an empty cart with only shipping fee', () => {
    // Shipping fee: 49.00 SEK (4,900 öre) assessed at 25% moms
    // Tax: 4900 * 25 / 125 = 980 öre. Net: 4900 - 980 = 3,920 öre
    const result = calculateMomsSplit([], 4900)

    expect(result.totalGrossMinor).toBe(4900)
    expect(result.totalMomsMinor).toBe(980)
    expect(result.totalNetMinor).toBe(3920)
    expect(result.moms12.taxableGrossMinor).toBe(0)
    expect(result.moms25.taxableGrossMinor).toBe(4900)
    expect(result.moms25.momsAmountMinor).toBe(980)
  })

  // --- Single-Rate Carts ---
  it('correctly calculates a cart containing only 12% food items', () => {
    const items: LineItemInput[] = [
      // 100.00 SEK net equivalent = 112.00 SEK gross (11,200 öre)
      { unitPriceMinor: 11200, quantity: 1, momsRate: 12 },
    ]

    const result = calculateMomsSplit(items, 0)

    // Tax: round(11200 * 12 / 112) = 1,200 öre
    expect(result.moms12.taxableGrossMinor).toBe(11200)
    expect(result.moms12.taxableNetMinor).toBe(10000)
    expect(result.moms12.momsAmountMinor).toBe(1200)

    // Ensure 25% tier remains completely zero
    expect(result.moms25.taxableGrossMinor).toBe(0)
    expect(result.totalGrossMinor).toBe(11200)
    expect(result.totalMomsMinor).toBe(1200)
    expect(result.totalNetMinor).toBe(10000)
  })

  it('correctly calculates a cart containing only 25% non-food items', () => {
    const items: LineItemInput[] = [
      // 100.00 SEK gross (10,000 öre)
      { unitPriceMinor: 10000, quantity: 2, momsRate: 25 },
    ]

    const result = calculateMomsSplit(items, 0)

    // Gross: 2 * 10,000 = 20,000 öre
    // Tax: round(20000 * 25 / 125) = 4,000 öre. Net: 16,000 öre
    expect(result.moms25.taxableGrossMinor).toBe(20000)
    expect(result.moms25.taxableNetMinor).toBe(16000)
    expect(result.moms25.momsAmountMinor).toBe(4000)
    expect(result.moms12.taxableGrossMinor).toBe(0)
    expect(result.totalGrossMinor).toBe(20000)
  })

  // --- Line-Item Deterministic Half-Up Rounding Verification ---
  it('applies half-up rounding strictly per line-item rather than on cart aggregates', () => {
    // A gross line of 14 öre has exact fractional 12% moms: (14 * 12) / 112 = 1.5 öre
    // Line-item Math.round(1.5) rounds UP to 2 öre per line.
    // If rounded per line across 2 items: Total Tax = 2 + 2 = 4 öre.
    // (If calculated on aggregated gross of 28 öre, tax would have been round(28 * 12 / 112) = 3 öre)
    const items: LineItemInput[] = [
      { unitPriceMinor: 14, quantity: 1, momsRate: 12 },
      { unitPriceMinor: 14, quantity: 1, momsRate: 12 },
    ]

    const result = calculateMomsSplit(items, 0)

    expect(result.moms12.taxableGrossMinor).toBe(28)
    expect(result.moms12.momsAmountMinor).toBe(4) // Verifies line-item rounding: 2 + 2
    expect(result.moms12.taxableNetMinor).toBe(24) // 28 - 4
  })

  // --- Mixed Cart with Shipping (Real-World Swedish Checkout) ---
  it('correctly audits a mixed cart with 12% food, 25% non-food, and shipping fee', () => {
    const items: LineItemInput[] = [
      // Line 1: 3x Tahini at 45.00 SEK gross each (4,500 öre) -> Line Gross: 13,500 öre
      // Tax: round(13500 * 12 / 112) = round(1446.428) = 1,446 öre. Net: 12,054 öre
      { unitPriceMinor: 4500, quantity: 3, momsRate: 12 },

      // Line 2: 1x Halva at 39.50 SEK gross (3,950 öre) -> Line Gross: 3,950 öre
      // Tax: round(3950 * 12 / 112) = round(423.214) = 423 öre. Net: 3,527 öre
      { unitPriceMinor: 3950, quantity: 1, momsRate: 12 },

      // Line 3: 2x Incense burner at 120.00 SEK gross each (12,000 öre) -> Line Gross: 24,000 öre
      // Tax: round(24000 * 25 / 125) = 4,800 öre. Net: 19,200 öre
      { unitPriceMinor: 12000, quantity: 2, momsRate: 25 },
    ]

    // Shipping fee: 59.00 SEK (5,900 öre) at 25%
    // Tax: round(5900 * 25 / 125) = 1,180 öre. Net: 4,720 öre
    const shippingFeeMinor = 5900

    const result = calculateMomsSplit(items, shippingFeeMinor)

    // Check 12% food breakdown
    // Gross: 13,500 + 3,950 = 17,450 öre
    // Tax: 1,446 + 423 = 1,869 öre
    // Net: 12,054 + 3,527 = 15,581 öre
    expect(result.moms12.taxableGrossMinor).toBe(17450)
    expect(result.moms12.momsAmountMinor).toBe(1869)
    expect(result.moms12.taxableNetMinor).toBe(15581)

    // Check 25% non-food + shipping breakdown
    // Gross: 24,000 (burner) + 5,900 (shipping) = 29,900 öre
    // Tax: 4,800 + 1,180 = 5,980 öre
    // Net: 19,200 + 4,720 = 23,920 öre
    expect(result.moms25.taxableGrossMinor).toBe(29900)
    expect(result.moms25.momsAmountMinor).toBe(5980)
    expect(result.moms25.taxableNetMinor).toBe(23920)

    // Check consolidated totals
    expect(result.totalGrossMinor).toBe(17450 + 29900) // 47,350 öre (473.50 SEK)
    expect(result.totalMomsMinor).toBe(1869 + 5980)   // 7,849 öre (78.49 SEK)
    expect(result.totalNetMinor).toBe(15581 + 23920)   // 39,501 öre (395.01 SEK)

    // Invariant: Gross must equal Net + Moms down to the exact öre
    expect(result.totalGrossMinor).toBe(
      result.totalNetMinor + result.totalMomsMinor
    )
  })

  // --- Strict Statutory Accounting Invariant ---
  it('maintains mathematical balance across randomized mixed quantities', () => {
    const items: LineItemInput[] = [
      { unitPriceMinor: 1990, quantity: 3, momsRate: 12 },
      { unitPriceMinor: 3495, quantity: 7, momsRate: 25 },
      { unitPriceMinor: 1050, quantity: 1, momsRate: 12 },
      { unitPriceMinor: 8900, quantity: 2, momsRate: 25 },
    ]

    const result = calculateMomsSplit(items, 6900)

    // 1. Bracket identities
    expect(result.moms12.taxableGrossMinor).toBe(
      result.moms12.taxableNetMinor + result.moms12.momsAmountMinor
    )
    expect(result.moms25.taxableGrossMinor).toBe(
      result.moms25.taxableNetMinor + result.moms25.momsAmountMinor
    )

    // 2. Global order identities
    expect(result.totalGrossMinor).toBe(
      result.totalNetMinor + result.totalMomsMinor
    )
    expect(result.totalGrossMinor).toBe(
      result.moms12.taxableGrossMinor + result.moms25.taxableGrossMinor
    )
  })
})
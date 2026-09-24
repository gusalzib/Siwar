/**
 * utils/currency.ts
 *
 * Shared currency utilities for the Siwar webstore.
 *
 * Enforces the minor-unit integer contract (e.g., 4500 öre = 45.00 SEK)
 * across both the frontend Vue forms and the Nitro backend validators.
 */

// ---------------------------------------------------------------------------
// 1. Supported Currency Types
// ---------------------------------------------------------------------------

/**
 * The three distinct currencies supported across Siwar's catalog and checkout.
 */
export type SupportedCurrency = 'SEK' | 'EUR' | 'USD'

/**
 * Multi-currency price object stored in the database.
 * Every amount MUST be a positive integer in minor units (öre / cents).
 */
export interface MultiCurrencyPrices {
  SEK: number
  EUR: number
  USD: number
}

// ---------------------------------------------------------------------------
// 2. Conversion Functions
// ---------------------------------------------------------------------------

/**
 * Converts a decimal user input (from an <input> field) to integer minor units.
 *
 * Example:
 *   toMinorUnits(45.50)   => 4550
 *   toMinorUnits("45.50") => 4550
 *   toMinorUnits("45,50") => 4550 (handles Swedish comma separator)
 *
 * Why Math.round is necessary:
 * In JavaScript, binary floating-point math can introduce small precision errors
 * (e.g., 45.55 * 100 = 4555.000000000001). Math.round eliminates this drift.
 *
 * @param amount - Decimal number or string entered by the user
 * @returns Non-negative integer in minor units (öre/cents)
 */
export function toMinorUnits(amount: number | string): number {
  if (typeof amount === 'string') {
    // Replace comma with dot to support Scandinavian keyboard input (e.g., "45,50")
    amount = amount.trim().replace(',', '.')
  }

  // Convert the string to a numeric value
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount

  // Guard against invalid inputs (empty string, letters, negative numbers)
  if (isNaN(numeric) || numeric < 0 || !isFinite(numeric)) {
    return 0
  }

  return Math.round(numeric * 100)
}

/**
 * Formats an integer minor unit amount back to a 2-decimal string for form inputs.
 *
 * Example:
 *   toMajorUnits(4550) => "45.50"
 *   toMajorUnits(500)  => "5.00"
 *   toMajorUnits(0)    => "0.00"
 *
 * @param minorAmount - Minor unit integer (e.g., 4550)
 * @returns 2-decimal string suitable for HTML number inputs
 */
export function toMajorUnits(minorAmount: number): string {
  if (
    typeof minorAmount !== 'number' ||
    isNaN(minorAmount) ||
    !Number.isInteger(minorAmount) ||
    minorAmount < 0
  ) {
    return '0.00'
  }

  return (minorAmount / 100).toFixed(2)
}

/**
 * Validates whether a value is a strict minor-unit integer.
 * Useful for backend Nitro API route validation before saving to MongoDB.
 *
 * @param value - Any value received from an HTTP request body
 * @returns True if the value is an integer >= 0
 */
export function isValidMinorUnit(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    Number.isSafeInteger(value)
  )
}
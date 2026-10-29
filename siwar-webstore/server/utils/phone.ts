/**
 * server/utils/phone.ts
 * Utilities for normalizing and matching phone numbers for guest order lookup.
 */

/**
 * Normalizes a phone number by stripping whitespace, hyphens, formatting characters,
 * and standardizing Swedish prefix conventions (+46 / 0046 / leading 0).
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') return ''
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\./]/g, '')
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1)
  }
  if (cleaned.startsWith('0046')) {
    cleaned = '0' + cleaned.slice(4)
  } else if (cleaned.startsWith('46') && cleaned.length >= 9) {
    cleaned = '0' + cleaned.slice(2)
  }
  return cleaned
}

/**
 * Extracts the significant digits of a phone number (without country code and leading zeros)
 * for high-tolerance comparison.
 */
export function getSignificantDigits(rawPhone: string): string {
  const norm = normalizePhone(rawPhone)
  return norm.replace(/^0+/, '')
}

/**
 * Compares two phone numbers to verify if they point to the same destination,
 * handling Swedish local (070...) vs international (+4670... / 004670...) formats.
 */
export function phonesMatch(phoneA: string, phoneB: string): boolean {
  if (!phoneA || !phoneB) return false
  const normA = normalizePhone(phoneA)
  const normB = normalizePhone(phoneB)
  if (normA && normB && normA === normB) return true

  const sigA = getSignificantDigits(phoneA)
  const sigB = getSignificantDigits(phoneB)
  if (sigA && sigB && sigA === sigB) return true

  const rawA = phoneA.replace(/\D/g, '')
  const rawB = phoneB.replace(/\D/g, '')
  if (rawA && rawB && rawA === rawB) return true

  return false
}

/**
 * Quick heuristic to determine if user input is an email address.
 */
export function isLikelyEmail(input: string): boolean {
  return typeof input === 'string' && input.includes('@')
}

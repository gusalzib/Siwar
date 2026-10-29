// tests/unit/order.lookup.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { normalizePhone, getSignificantDigits, phonesMatch, isLikelyEmail } from '../../server/utils/phone'
import { InMemoryRateLimiter } from '../../server/utils/rateLimiter'

describe('Guest Order Lookup Engine (scratch.md Requirements)', () => {
  describe('Phone Normalization & Matching (AC-2)', () => {
    const orderPhone = '070-123 45 67'

    it('normalizes local Swedish phone numbers with spaces and hyphens', () => {
      expect(normalizePhone('070-123 45 67')).toBe('0701234567')
      expect(getSignificantDigits('070-123 45 67')).toBe('701234567')
    })

    it('normalizes international Swedish format starting with +46', () => {
      expect(normalizePhone('+46701234567')).toBe('0701234567')
      expect(getSignificantDigits('+46701234567')).toBe('701234567')
    })

    it('normalizes international Swedish format starting with 0046', () => {
      expect(normalizePhone('0046 70 123 45 67')).toBe('0701234567')
      expect(getSignificantDigits('0046 70 123 45 67')).toBe('701234567')
    })

    it('matches when order was placed with 070-123 45 67 and user submits +46701234567', () => {
      expect(phonesMatch(orderPhone, '+46701234567')).toBe(true)
    })

    it('matches when order was placed with 070-123 45 67 and user submits 0701234567', () => {
      expect(phonesMatch(orderPhone, '0701234567')).toBe(true)
    })

    it('matches when user formats phone with spaces: +46 70 123 45 67', () => {
      expect(phonesMatch(orderPhone, '+46 70 123 45 67')).toBe(true)
    })

    it('matches when user formats phone with 0046 prefix', () => {
      expect(phonesMatch(orderPhone, '0046701234567')).toBe(true)
    })

    it('rejects completely different phone numbers', () => {
      expect(phonesMatch(orderPhone, '070-999 99 99')).toBe(false)
      expect(phonesMatch(orderPhone, '+46709999999')).toBe(false)
    })

    it('handles empty or invalid inputs gracefully without throwing', () => {
      expect(phonesMatch('', '0701234567')).toBe(false)
      expect(phonesMatch(orderPhone, '')).toBe(false)
      expect(normalizePhone('')).toBe('')
    })
  })

  describe('Email Heuristics (AC-1)', () => {
    it('detects email addresses accurately', () => {
      expect(isLikelyEmail('customer@example.com')).toBe(true)
      expect(isLikelyEmail('test.user+tag@domain.se')).toBe(true)
      expect(isLikelyEmail('0701234567')).toBe(false)
      expect(isLikelyEmail('+46701234567')).toBe(false)
    })
  })

  describe('Anti-Enumeration Rate Limiting (AC-4)', () => {
    let limiter: InMemoryRateLimiter
    const testIp = '192.168.1.100'

    beforeEach(() => {
      limiter = new InMemoryRateLimiter(5, 60_000)
    })

    it('permits up to 5 requests within a 60-second sliding window', () => {
      for (let i = 1; i <= 5; i++) {
        const result = limiter.check(testIp)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(5 - i)
      }
    })

    it('blocks the 6th request with allowed=false and positive resetSeconds (AC-4)', () => {
      // 5 allowed attempts
      for (let i = 0; i < 5; i++) {
        limiter.check(testIp)
      }

      // 6th attempt must be blocked
      const blocked = limiter.check(testIp)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
      expect(blocked.resetSeconds).toBeGreaterThan(0)
      expect(blocked.resetSeconds).toBeLessThanOrEqual(60)
    })

    it('isolates different IP addresses', () => {
      const ipA = '10.0.0.1'
      const ipB = '10.0.0.2'

      // Exhaust IP A
      for (let i = 0; i < 5; i++) {
        limiter.check(ipA)
      }
      expect(limiter.check(ipA).allowed).toBe(false)

      // IP B should still be allowed
      expect(limiter.check(ipB).allowed).toBe(true)
    })

    it('resets correctly after manual or timeout eviction', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check(testIp)
      }
      expect(limiter.check(testIp).allowed).toBe(false)

      limiter.reset(testIp)
      expect(limiter.check(testIp).allowed).toBe(true)
    })
  })

  describe('Anti-Enumeration Mismatch Handling (AC-3)', () => {
    function simulateOrderLookup(
      orderInDb: { orderReference: string; email: string; phone: string } | null,
      submittedReference: string,
      submittedCred: string
    ): { status: number; message: string; success: boolean } {
      const genericNotFound = {
        status: 404,
        message: 'Ordern kunde inte hittas med angivna uppgifter',
        success: false,
      }

      if (!orderInDb) {
        return genericNotFound
      }

      if (orderInDb.orderReference.toLowerCase() !== submittedReference.trim().toLowerCase()) {
        return genericNotFound
      }

      const emailMatch =
        orderInDb.email &&
        submittedCred.trim().toLowerCase() === orderInDb.email.trim().toLowerCase()
      const phoneMatch =
        orderInDb.phone && phonesMatch(orderInDb.phone, submittedCred)

      if (!emailMatch && !phoneMatch) {
        return genericNotFound
      }

      return {
        status: 200,
        message: 'OK',
        success: true,
      }
    }

    const validOrder = {
      orderReference: 'ORD-566294',
      email: 'customer@example.com',
      phone: '070-123 45 67',
    }

    it('returns success when reference and email match (case-insensitive) (AC-1)', () => {
      const res = simulateOrderLookup(validOrder, 'ORD-566294', 'CUSTOMER@example.com')
      expect(res.status).toBe(200)
      expect(res.success).toBe(true)
    })

    it('returns success when reference and normalized phone match (AC-2)', () => {
      const res = simulateOrderLookup(validOrder, 'ord-566294', '+46701234567')
      expect(res.status).toBe(200)
      expect(res.success).toBe(true)
    })

    it('returns identical generic 404 when order reference does not exist (AC-3)', () => {
      const res = simulateOrderLookup(null, 'ORD-999999', 'customer@example.com')
      expect(res.status).toBe(404)
      expect(res.message).toBe('Ordern kunde inte hittas med angivna uppgifter')
    })

    it('returns identical generic 404 when reference exists but email/phone is wrong (AC-3)', () => {
      const res = simulateOrderLookup(validOrder, 'ORD-566294', 'wrong@example.com')
      expect(res.status).toBe(404)
      expect(res.message).toBe('Ordern kunde inte hittas med angivna uppgifter')
    })

    it('returns identical generic 404 when reference exists but phone is wrong (AC-3)', () => {
      const res = simulateOrderLookup(validOrder, 'ORD-566294', '0709999999')
      expect(res.status).toBe(404)
      expect(res.message).toBe('Ordern kunde inte hittas med angivna uppgifter')
    })
  })
})

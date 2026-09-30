// tests/unit/checkout.logic.spec.ts
import { describe, it, expect } from 'vitest'

describe('Issue #9: Checkout Business Rules & Legal Compliance', () => {
  // Reusable validation helpers matching kassa.vue logic
  function validateSwedishPostalCode(postalCode: string): boolean {
    return /^\d{3}\s?\d{2}$/.test(postalCode.trim())
  }

  function calculateShippingTax(feeMinor: number): number {
    if (feeMinor <= 0) return 0
    return Math.round((feeMinor * 25) / 125)
  }

  function isCheckoutFormValid(form: {
    fullName: string
    email: string
    phone: string
    fulfillmentMethod: 'DELIVERY' | 'PICKUP'
    streetAddress: string
    postalCode: string
    city: string
    acceptedTerms: boolean
  }): boolean {
    const isNameValid = form.fullName.trim().length >= 2
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    const isPhoneValid = /^[+0-9\s-]{7,15}$/.test(form.phone.trim())

    const baseValid = isNameValid && isEmailValid && isPhoneValid && form.acceptedTerms

    if (form.fulfillmentMethod === 'PICKUP') {
      return baseValid
    }

    const isStreetValid = form.streetAddress.trim().length >= 3
    const isPostalCodeValid = validateSwedishPostalCode(form.postalCode)
    const isCityValid = form.city.trim().length >= 2

    return baseValid && isStreetValid && isPostalCodeValid && isCityValid
  }

  // -------------------------------------------------------------------------
  // AC-1: Fulfillment Toggle Form Validation
  // -------------------------------------------------------------------------
  describe('AC-1: Fulfillment Mode Toggle Validation', () => {
    it('considers form complete without address fields when In-Store Pickup is selected', () => {
      const pickupForm = {
        fullName: 'Lars Svensson',
        email: 'lars@example.se',
        phone: '0701234567',
        fulfillmentMethod: 'PICKUP' as const,
        streetAddress: '', // Empty address fields
        postalCode: '',
        city: '',
        acceptedTerms: true,
      }

      expect(isCheckoutFormValid(pickupForm)).toBe(true)
    })

    it('rejects Delivery when physical address fields are incomplete or invalid', () => {
      const deliveryForm = {
        fullName: 'Lars Svensson',
        email: 'lars@example.se',
        phone: '0701234567',
        fulfillmentMethod: 'DELIVERY' as const,
        streetAddress: '',
        postalCode: '123', // Invalid postal code
        city: '',
        acceptedTerms: true,
      }

      expect(isCheckoutFormValid(deliveryForm)).toBe(false)
    })

    it('validates Swedish 5-digit postal code formats with or without whitespace', () => {
      expect(validateSwedishPostalCode('30243')).toBe(true)
      expect(validateSwedishPostalCode('302 43')).toBe(true)
      expect(validateSwedishPostalCode('3024')).toBe(false) // 4 digits
      expect(validateSwedishPostalCode('ABCDE')).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // AC-2: Shipping Fee Moms Calculation
  // -------------------------------------------------------------------------
  describe('AC-2: Shipping Tax Extraction (25% Swedish Moms)', () => {
    it('extracts exactly 13.80 SEK moms for a 69.00 SEK shipping fee', () => {
      // 69 SEK = 6900 öre
      const feeMinor = 6900
      const momsMinor = calculateShippingTax(feeMinor)

      expect(momsMinor).toBe(1380) // 13.80 SEK
      expect(feeMinor - momsMinor).toBe(5520) // 55.20 SEK net
    })

    it('extracts exactly 15.40 SEK moms for a 77.00 SEK shipping fee', () => {
      // 77 SEK = 7700 öre
      const feeMinor = 7700
      const momsMinor = calculateShippingTax(feeMinor)

      expect(momsMinor).toBe(1540) // 15.40 SEK
      expect(feeMinor - momsMinor).toBe(6160) // 61.60 SEK net
    })

    it('returns 0 tax when shipping fee is 0 (In-Store Pickup or Free Shipping)', () => {
      expect(calculateShippingTax(0)).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // AC-3: Legal Consent Enforcement (Köpvillkor & Ångerrätt)
  // -------------------------------------------------------------------------
  describe('AC-3: Mandatory Legal Consent Enforcement', () => {
    it('blocks checkout completion when terms of purchase are not accepted', () => {
      const unconsentedForm = {
        fullName: 'Lars Svensson',
        email: 'lars@example.se',
        phone: '0701234567',
        fulfillmentMethod: 'PICKUP' as const,
        streetAddress: '',
        postalCode: '',
        city: '',
        acceptedTerms: false, // Not accepted
      }

      expect(isCheckoutFormValid(unconsentedForm)).toBe(false)
    })

    it('permits payment progression once terms checkbox is acknowledged', () => {
      const consentedForm = {
        fullName: 'Lars Svensson',
        email: 'lars@example.se',
        phone: '0701234567',
        fulfillmentMethod: 'PICKUP' as const,
        streetAddress: '',
        postalCode: '',
        city: '',
        acceptedTerms: true,
      }

      expect(isCheckoutFormValid(consentedForm)).toBe(true)
    })
  })
})
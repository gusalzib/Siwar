// tests/unit/shipping.adapter.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DhlAdapter,
  dhlAdapter,
  getShippingCarrier,
  defaultShippingCarrier,
} from '~/server/services/shipping'
import type { CreateShipmentOptions, PackageParcel } from '~/server/types/shipping'

describe('Carrier Adapter Architecture & Environment Configuration', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('1. DHL Environment & Base URL Resolution', () => {
    it('defaults to sandbox Swedish API Farm when DHL_ENVIRONMENT is unset or sandbox', () => {
      delete process.env.DHL_ENVIRONMENT
      const adapter = new DhlAdapter()
      expect(adapter.getBaseUrl()).toBe('https://test-api.freight-logistics.dhl.com')
    })

    it('resolves production Swedish API Farm when DHL_ENVIRONMENT is production', () => {
      process.env.DHL_ENVIRONMENT = 'production'
      const adapter = new DhlAdapter()
      expect(adapter.getBaseUrl()).toBe('https://api.freight-logistics.dhl.com')
    })

    it('correctly reads DHL_CLIENT_KEY and DHL_ACCOUNT_NUMBER', () => {
      process.env.DHL_CLIENT_KEY = 'test-client-key-123'
      process.env.DHL_ACCOUNT_NUMBER = '99887766'
      const adapter = new DhlAdapter()

      expect(adapter.getClientKey()).toBe('test-client-key-123')
      expect(adapter.getAccountNumber()).toBe('99887766')
      expect(adapter.isConfigured()).toBe(true)
    })

    it('reports isConfigured as false when credentials are incomplete', () => {
      delete process.env.DHL_CLIENT_KEY
      delete process.env.DHL_ACCOUNT_NUMBER
      const adapter = new DhlAdapter()

      expect(adapter.isConfigured()).toBe(false)
    })
  })

  describe('2. Public Tracking URL Formatting', () => {
    it('formats verified DHL public tracking URL matching the official format', () => {
      const adapter = new DhlAdapter()
      const trackingCode = '003733001234567890'
      const url = adapter.getTrackingUrl(trackingCode)

      expect(url).toBe('https://www.dhl.com/se-en/home/tracking.html?tracking-id=003733001234567890')
    })

    it('encodes special characters in tracking code safely', () => {
      const adapter = new DhlAdapter()
      const url = adapter.getTrackingUrl('DHL TEST #123')
      expect(url).toBe('https://www.dhl.com/se-en/home/tracking.html?tracking-id=DHL%20TEST%20%23123')
    })
  })

  describe('3. Kolli-ID & Consignment Extraction (TransportInstruction API)', () => {
    const adapter = new DhlAdapter()

    it('extracts 18-digit Kolli-ID from transportInstruction.pieces[0].id[0]', () => {
      const sampleApiResponse = {
        transportInstruction: {
          consignmentNumber: '373312345',
          routingCode: 'STO-103',
          pieces: [
            {
              id: ['003733009876543210'],
              packageType: 'PC',
              weight: 3.7,
            },
          ],
        },
      }

      const extracted = adapter.extractTrackingAndConsignment(sampleApiResponse)
      expect(extracted.kolliId).toBe('003733009876543210')
      expect(extracted.consignmentNumber).toBe('373312345')
      expect(extracted.routingCode).toBe('STO-103')
    })

    it('extracts Kolli-ID when pieces[0].id is a string rather than an array', () => {
      const sampleApiResponse = {
        transportInstruction: {
          consignmentNumber: '373399999',
          pieces: [
            {
              id: '003733001122334455',
              packageType: 'PC',
            },
          ],
        },
      }

      const extracted = adapter.extractTrackingAndConsignment(sampleApiResponse)
      expect(extracted.kolliId).toBe('003733001122334455')
      expect(extracted.consignmentNumber).toBe('373399999')
    })

    it('generates an authentic 18-digit GS1 Kolli-ID with Modulo-10 checksum from seed when pieces array is omitted', () => {
      const generated = adapter.generateKolliIdFromSeed('373312345')
      expect(generated).toHaveLength(18)
      expect(generated.startsWith('003733')).toBe(true)

      // Verify Modulo 10 checksum
      const base17 = generated.slice(0, 17)
      let sum = 0
      for (let i = 0; i < 17; i++) {
        const digit = parseInt(base17[i]!, 10)
        const weight = (17 - i) % 2 === 1 ? 3 : 1
        sum += digit * weight
      }
      const expectedCheck = (10 - (sum % 10)) % 10
      expect(parseInt(generated[17]!, 10)).toBe(expectedCheck)
    })
  })

  describe('4. Mock Shipment Booking & Scale Weight Enforcement', () => {
    const adapter = new DhlAdapter()

    const sampleParcel: PackageParcel = {
      weightKg: 3.7, // Measured scale weight
      lengthCm: 35,
      widthCm: 25,
      heightCm: 20,
      preset: 'MELLAN',
      contentsDescription: 'Mediterranean specialty foods',
    }

    const sampleOptions: CreateShipmentOptions = {
      orderId: '65f1234567890abcdef12345',
      orderReference: 'ORD-2026-101',
      recipient: {
        name: 'Anna Lindgren',
        street: 'Kungsgatan 14',
        postalCode: '111 43',
        city: 'Stockholm',
        countryCode: 'SE',
        email: 'anna@example.se',
        phone: '0701234567',
      },
      parcel: sampleParcel,
      productCode: '103',
    }

    it('rejects consignment creation when scale weight is missing or zero', async () => {
      const invalidOptions: CreateShipmentOptions = {
        ...sampleOptions,
        parcel: { ...sampleParcel, weightKg: 0 },
      }

      await expect(adapter.createShipment(invalidOptions)).rejects.toThrow(
        /Invalid parcel weight: 0 kg/
      )
    })

    it('produces valid 18-digit Kolli-ID and verified tracking link in mock mode', async () => {
      delete process.env.DHL_CLIENT_KEY
      delete process.env.DHL_ACCOUNT_NUMBER

      const result = await adapter.createShipment(sampleOptions)

      expect(result.carrier).toBe('DHL')
      expect(result.trackingCode).toHaveLength(18)
      expect(result.trackingCode.startsWith('003733')).toBe(true)
      expect(result.trackingUrl).toContain(result.trackingCode)
      expect(result.consignmentNumber).toBeDefined()
    })

    it('generates deterministic mock consignment from orderReference', () => {
      const mockResult1 = adapter.generateMockShipment(sampleOptions)
      const mockResult2 = adapter.generateMockShipment(sampleOptions)

      expect(mockResult1.trackingCode).toBe(mockResult2.trackingCode)
      expect(mockResult1.consignmentNumber).toBe(mockResult2.consignmentNumber)
    })
  })

  describe('5. Service Point Locator', () => {
    const adapter = new DhlAdapter()

    it('returns nearby service points with normalized address fields and distance', async () => {
      const points = await adapter.findNearestServicePoints({
        postalCode: '302 43',
        city: 'Halmstad',
      })

      expect(points.length).toBeGreaterThan(0)
      const first = points[0]!
      expect(first.id).toBeDefined()
      expect(first.name).toContain('Halmstad')
      expect(first.street).toBeDefined()
      expect(first.postalCode).toBe('30243')
      expect(first.openingHours).toBeDefined()
      expect(typeof first.distanceMeters).toBe('number')
    })
  })

  describe('6. Shipping Carrier Factory Resolver', () => {
    it('resolves DHL carrier by default when no carrier name is provided', () => {
      const carrier = getShippingCarrier()
      expect(carrier.carrierName).toBe('DHL')
    })

    it('resolves DHL carrier case-insensitively', () => {
      const carrierLower = getShippingCarrier('dhl')
      const carrierUpper = getShippingCarrier('DHL')
      expect(carrierLower.carrierName).toBe('DHL')
      expect(carrierUpper.carrierName).toBe('DHL')
    })

    it('falls back gracefully to default DHL carrier when unknown carrier is requested', () => {
      const carrier = getShippingCarrier('UNKNOWN_LOGISTICS')
      expect(carrier.carrierName).toBe('DHL')
    })

    it('exports singleton defaultShippingCarrier matching dhlAdapter', () => {
      expect(defaultShippingCarrier).toBe(dhlAdapter)
    })
  })
})


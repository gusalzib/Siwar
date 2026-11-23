// tests/unit/dhl.dispatch.spec.ts

import { describe, it, expect, vi } from 'vitest'
import { getShippingCarrier } from '~/server/services/shipping'
import { mailService } from '~/server/services/mail.service'
import type { IOrder } from '~/server/models/Order'

describe('Section 3: Backend Dispatch & Transactional Communication Pipeline', () => {
  it('creates consignment and returns 18-digit Kolli-ID with tracking URL', async () => {
    const adapter = getShippingCarrier('DHL')

    const bookingResult = await adapter.createShipment({
      orderId: '6af2e0e9cb82dc735b5e3ca7',
      orderReference: 'ORD-185501',
      recipient: {
        name: 'Test Customer',
        street: 'Storgatan 1',
        postalCode: '30243',
        city: 'Halmstad',
        countryCode: 'SE',
        email: 'customer@example.com',
        phone: '0701234567',
      },
      parcel: {
        weightKg: 3.7,
        lengthCm: 35,
        widthCm: 25,
        heightCm: 20,
        preset: 'MELLAN',
      },
      productCode: '103',
    })

    expect(bookingResult.carrier).toBe('DHL')
    expect(bookingResult.trackingCode).toBeDefined()
    expect(bookingResult.trackingCode).toHaveLength(18)
    expect(bookingResult.trackingCode.startsWith('003733')).toBe(true)
    expect(bookingResult.consignmentNumber).toBeDefined()
    expect(bookingResult.trackingUrl).toContain('https://www.dhl.com/se-en/home/tracking.html?tracking-id=')
  })

  it('formats verified DHL public tracking URL in customer dispatch emails', () => {
    const mockOrder = {
      _id: '6af2e0e9cb82dc735b5e3ca7',
      orderReference: 'ORD-185501',
      currency: 'SEK',
      customerLocale: 'en',
      customer: {
        fullName: 'Test Customer',
        email: 'customer@example.com',
        phone: '0701234567',
        fulfillmentMethod: 'DELIVERY',
        address: {
          street: 'Storgatan 1',
          postalCode: '30243',
          city: 'Halmstad',
        },
      },
      items: [],
      pricing: {
        itemsTotalMinor: 70990,
        shippingFeeMinor: 7700,
        grandTotalMinor: 78690,
        authorizedTotalMinor: 78690,
        capturedTotalMinor: 78690,
        releasedOrRefundedMinor: 0,
        taxSplit: {
          totalMomsMinor: 13707,
        },
      },
    } as unknown as IOrder

    const html = mailService.generateDispatchedReceiptHtml(
      mockOrder,
      '003733001855010007',
      'DHL',
      'en'
    )

    expect(html).toContain('003733001855010007')
    expect(html).toContain('https://www.dhl.com/se-en/home/tracking.html?tracking-id=003733001855010007')
    expect(html).toContain('Track Package on DHL')
  })
})


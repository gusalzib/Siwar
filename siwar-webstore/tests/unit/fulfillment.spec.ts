// tests/unit/fulfillment.spec.ts
import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import {
  recalculateOrderShortage,
  computeOrderPricing,
} from '~/server/services/fulfillment.service'
import type { IOrder, IOrderItem } from '~/server/models/Order'

describe('Issue #12: Order Fulfillment & Shortage Engine', () => {
  const itemA_Id = new Types.ObjectId()
  const itemB_Id = new Types.ObjectId()
  const subProduct_Id = new Types.ObjectId()

  function createMockOrder(overrides: Partial<IOrder> = {}): IOrder {
    const items: IOrderItem[] = [
      {
        productId: itemA_Id,
        sku: 'DELIGHT-01',
        name: { ar: 'حلقوم', sv: 'Turkisk Konfekt', en: 'Turkish Delight' },
        quantity: 2,
        fulfilledQuantity: 2,
        unitPriceMinor: 5000, // 50.00 SEK each (100.00 SEK total)
        momsRate: 12,
        shortageStatus: 'NONE',
        isPacked: false,
      },
      {
        productId: itemB_Id,
        sku: 'OIL-01',
        name: { ar: 'زيت', sv: 'Olivolja', en: 'Olive Oil' },
        quantity: 1,
        fulfilledQuantity: 1,
        unitPriceMinor: 8000, // 80.00 SEK
        momsRate: 25,
        shortageStatus: 'NONE',
        isPacked: false,
      },
    ]

    return {
      orderReference: 'ORD-TEST-12',
      customer: {
        fullName: 'Test Customer',
        email: 'test@siwar.se',
        phone: '0701234567',
        fulfillmentMethod: 'DELIVERY',
        address: { street: 'Storgatan 1', postalCode: '30243', city: 'Halmstad' },
      },
      items,
      shortageAdjustments: [],
      pricing: {
        itemsTotalMinor: 18000,
        shippingFeeMinor: 7700,
        grandTotalMinor: 25700,
        authorizedTotalMinor: 25700,
        taxSplit: {} as any,
      },
      ...overrides,
    } as unknown as IOrder
  }

  // -------------------------------------------------------------------------
  // AC-1: Shortage Removal & Dynamic Tax Recalculation
  // -------------------------------------------------------------------------
  describe('AC-1: Shortage Removal & Total Recalculation', () => {
    it('correctly reduces quantity, re-audits moms, and generates adjustment record', () => {
      const order = createMockOrder()

      // Reduce Item A from 2 to 1 (50 SEK dropped)
      const { updatedItems, shortageAdjustments, newPricing } = recalculateOrderShortage(
        order,
        [
          {
            productId: itemA_Id.toString(),
            action: 'REDUCE_QUANTITY',
            adjustedQuantity: 1,
            note: '1 box was crushed',
          },
        ],
        'Admin'
      )

      expect(updatedItems[0]?.fulfilledQuantity).toBe(1)
      expect(updatedItems[0]?.shortageStatus).toBe('REDUCED')

      // Pricing check: 1x50 SEK + 1x80 SEK = 130 SEK items + 77 SEK shipping = 207 SEK
      expect(newPricing.itemsTotalMinor).toBe(13000)
      expect(newPricing.grandTotalMinor).toBe(20700)
      expect(newPricing.releasedOrRefundedMinor).toBe(5000) // 50 SEK released

      // Audit check
      expect(shortageAdjustments).toHaveLength(1)
      expect(shortageAdjustments[0]?.action).toBe('REDUCE_QUANTITY')
      expect(shortageAdjustments[0]?.originalQuantity).toBe(2)
      expect(shortageAdjustments[0]?.adjustedQuantity).toBe(1)
      expect(shortageAdjustments[0]?.note).toBe('1 box was crushed')
    })
  })

  // -------------------------------------------------------------------------
  // Dynamic Shipping Threshold (899 SEK Boundary)
  // -------------------------------------------------------------------------
  describe('Dynamic Free Shipping Threshold Recalculation', () => {
    it('assesses 77 SEK shipping when subtotal drops below 899 SEK', () => {
      // Order with 1000 SEK subtotal (Qualifies for Free Shipping)
      const items: IOrderItem[] = [
        {
          productId: itemA_Id,
          sku: 'EXP-01',
          name: { ar: 'منتج', sv: 'Produkt', en: 'Product' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 60000, // 600 SEK (dropped below 899)
          momsRate: 12,
          shortageStatus: 'NONE',
        },
      ]

      const pricing = computeOrderPricing(items, 'DELIVERY', 0, 100000)

      expect(pricing.itemsTotalMinor).toBe(60000)
      expect(pricing.shippingFeeMinor).toBe(7700)
      expect(pricing.grandTotalMinor).toBe(67700)
    })

    it('sets shipping back to 0 SEK when subtotal is restored to >= 899 SEK', () => {
      const items: IOrderItem[] = [
        {
          productId: itemA_Id,
          sku: 'EXP-01',
          name: { ar: 'منتج', sv: 'Produkt', en: 'Product' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 112700, // 1127.00 SEK
          momsRate: 12,
          shortageStatus: 'NONE',
        },
      ]

      const pricing = computeOrderPricing(items, 'DELIVERY', 7700, 112700)

      expect(pricing.itemsTotalMinor).toBe(112700)
      expect(pricing.shippingFeeMinor).toBe(0) // Free shipping restored!
      expect(pricing.grandTotalMinor).toBe(112700)
      expect(pricing.releasedOrRefundedMinor).toBe(0)
    })

    it('grants free shipping for USD orders >= 90.00 USD (9000 cents)', () => {
      const items: IOrderItem[] = [
        {
          productId: itemA_Id,
          sku: 'USD-01',
          name: { ar: 'منتج', sv: 'Produkt', en: 'Product' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 11150, // 111.50 USD
          momsRate: 12,
          shortageStatus: 'NONE',
        },
      ]

      const pricing = computeOrderPricing(items, 'DELIVERY', 0, 11150, 'USD')

      expect(pricing.itemsTotalMinor).toBe(11150)
      expect(pricing.shippingFeeMinor).toBe(0) // Free shipping!
      expect(pricing.grandTotalMinor).toBe(11150)
    })

    it('assesses 8.00 USD shipping when USD subtotal drops below 90.00 USD', () => {
      const items: IOrderItem[] = [
        {
          productId: itemA_Id,
          sku: 'USD-02',
          name: { ar: 'منتج', sv: 'Produkt', en: 'Product' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 5000, // 50.00 USD (< 90.00 threshold)
          momsRate: 12,
          shortageStatus: 'NONE',
        },
      ]

      const pricing = computeOrderPricing(items, 'DELIVERY', 0, 9500, 'USD')

      expect(pricing.itemsTotalMinor).toBe(5000)
      expect(pricing.shippingFeeMinor).toBe(800) // Fallback tier 1: 8.00 USD
      expect(pricing.grandTotalMinor).toBe(5800)
    })

    it('grants free shipping for EUR orders >= 85.00 EUR (8500 cents)', () => {
      const items: IOrderItem[] = [
        {
          productId: itemA_Id,
          sku: 'EUR-01',
          name: { ar: 'منتج', sv: 'Produkt', en: 'Product' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 9500, // 95.00 EUR
          momsRate: 12,
          shortageStatus: 'NONE',
        },
      ]

      const pricing = computeOrderPricing(items, 'DELIVERY', 0, 9500, 'EUR')

      expect(pricing.itemsTotalMinor).toBe(9500)
      expect(pricing.shippingFeeMinor).toBe(0) // Free shipping!
      expect(pricing.grandTotalMinor).toBe(9500)
    })
  })

  // -------------------------------------------------------------------------
  // Product Substitution Integrity
  // -------------------------------------------------------------------------
  describe('Product Substitution & originalProductId Persistence', () => {
    it('swaps active line item details while recording original identity snapshot', () => {
      const order = createMockOrder()

      const { updatedItems, shortageAdjustments } = recalculateOrderShortage(
        order,
        [
          {
            productId: itemA_Id.toString(),
            action: 'SUBSTITUTE_ITEM',
            adjustedQuantity: 1,
            substitutedProduct: {
              _id: subProduct_Id.toString(),
              sku: 'SUB-COOKIES',
              name: { ar: 'بسكويت', sv: 'Kakor', en: 'Cookies' },
              priceMinor: 4000, // 40 SEK
              momsRate: 12,
            },
            note: 'Replaced with brand B',
          },
        ],
        'Admin'
      )

      // Active line checks
      expect(updatedItems[0]?.productId.toString()).toBe(subProduct_Id.toString())
      expect(updatedItems[0]?.originalProductId?.toString()).toBe(itemA_Id.toString())
      expect(updatedItems[0]?.sku).toBe('SUB-COOKIES')
      expect(updatedItems[0]?.shortageStatus).toBe('SUBSTITUTED')

      // Audit trail checks
      expect(shortageAdjustments).toHaveLength(1)
      expect(shortageAdjustments[0]?.action).toBe('SUBSTITUTE_ITEM')
      expect(shortageAdjustments[0]?.originalSku).toBe('DELIGHT-01')
      expect(shortageAdjustments[0]?.substitutedSku).toBe('SUB-COOKIES')
      expect(shortageAdjustments[0]?.substitutedUnitPriceMinor).toBe(4000)
    })
  })
})
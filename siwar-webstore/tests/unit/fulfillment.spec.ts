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

    it('respects dynamic free shipping threshold override (e.g. 2000 SEK)', () => {
      const item: IOrderItem = {
        productId: itemA_Id,
        sku: 'EXP-01',
        name: { ar: 'منتج', sv: 'Produkt', en: 'Product' },
        quantity: 1,
        fulfilledQuantity: 1,
        unitPriceMinor: 195000, // 1950.00 SEK (< 2000 SEK threshold override)
        momsRate: 12,
        shortageStatus: 'NONE',
      }
      const items = [item]

      // 1950 SEK subtotal with 2000 SEK threshold: retains shipping fee (89 SEK)
      const pricingBelow = computeOrderPricing(items, 'DELIVERY', 8900, 203900, 'SEK', 200000)
      expect(pricingBelow.itemsTotalMinor).toBe(195000)
      expect(pricingBelow.shippingFeeMinor).toBe(8900)
      expect(pricingBelow.grandTotalMinor).toBe(203900)
      expect(pricingBelow.releasedOrRefundedMinor).toBe(0)

      // When items total reaches or exceeds 2000 SEK (200000 minor): free shipping
      item.unitPriceMinor = 205000
      const pricingAbove = computeOrderPricing(items, 'DELIVERY', 8900, 213900, 'SEK', 200000)
      expect(pricingAbove.itemsTotalMinor).toBe(205000)
      expect(pricingAbove.shippingFeeMinor).toBe(0)
      expect(pricingAbove.grandTotalMinor).toBe(205000)
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

  // -------------------------------------------------------------------------
  // Dynamic Shipping & Fee Release on Order Shortage (Issue #42 / Free Shipping)
  // -------------------------------------------------------------------------
  describe('Dynamic Shipping & Fee Release on Order Shortage', () => {
    const itemFreeA_Id = new Types.ObjectId()
    const itemFreeB_Id = new Types.ObjectId()
    const itemNormalC_Id = new Types.ObjectId()

    function createMixedOrder(): IOrder {
      const items: IOrderItem[] = [
        {
          productId: itemFreeA_Id,
          sku: 'FREE-A',
          name: { ar: 'منتج أ', sv: 'Produkt A (Fri frakt)', en: 'Product A' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 5000, // 50 SEK
          momsRate: 12,
          freeShipping: true,
          shortageStatus: 'NONE',
          isPacked: false,
        },
        {
          productId: itemFreeB_Id,
          sku: 'FREE-B',
          name: { ar: 'منتج ب', sv: 'Produkt B (Fri frakt)', en: 'Product B' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 8000, // 80 SEK
          momsRate: 25,
          freeShipping: true,
          shortageStatus: 'NONE',
          isPacked: false,
        },
        {
          productId: itemNormalC_Id,
          sku: 'NORMAL-C',
          name: { ar: 'منتج ج', sv: 'Produkt C (Vanlig frakt)', en: 'Product C' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 6000, // 60 SEK
          momsRate: 25,
          freeShipping: false,
          shortageStatus: 'NONE',
          isPacked: false,
        },
      ]

      // Items total: 50 + 80 + 60 = 190 SEK (19000 minor)
      // Shipping fee: 77 SEK (7700 minor)
      // Grand/authorized total: 267 SEK (26700 minor)
      return {
        orderReference: 'ORD-SHORTAGE-FREE-SHIPPING',
        currency: 'SEK',
        customer: {
          fullName: 'Free Shipping Customer',
          email: 'customer@siwar.se',
          phone: '0700000000',
          fulfillmentMethod: 'DELIVERY',
          address: { street: 'Fraktgatan 1', postalCode: '11122', city: 'Stockholm' },
        },
        items,
        shortageAdjustments: [],
        pricing: {
          itemsTotalMinor: 19000,
          shippingFeeMinor: 7700,
          grandTotalMinor: 26700,
          authorizedTotalMinor: 26700,
          taxSplit: {} as any,
        },
      } as unknown as IOrder
    }

    it('waives shipping fee and releases item price + freight when non-free-shipping item is REMOVED', () => {
      const order = createMixedOrder()

      // REMOVE_LINE on Product C (the only non-free-shipping item)
      const { updatedItems, newPricing } = recalculateOrderShortage(
        order,
        [
          {
            productId: itemNormalC_Id.toString(),
            action: 'REMOVE_LINE',
            adjustedQuantity: 0,
            note: 'Out of stock in warehouse',
          },
        ],
        'Admin',
        89900, // freeShippingThreshold
        7700,  // fallbackFee
        false  // freeShippingItemGrantsEntireOrder
      )

      // Only Product A and Product B remain fulfilled (both freeShipping: true)
      expect(updatedItems.find((i) => i.productId.toString() === itemNormalC_Id.toString())?.fulfilledQuantity).toBe(0)
      expect(newPricing.itemsTotalMinor).toBe(13000) // 50 + 80 SEK

      // Shipping fee must drop to 0!
      expect(newPricing.shippingFeeMinor).toBe(0)
      expect(newPricing.grandTotalMinor).toBe(13000)

      // Released amount must include Product C (60 SEK) + shipping fee (77 SEK) = 137 SEK (13700 minor)
      expect(newPricing.releasedOrRefundedMinor).toBe(13700)
      expect(newPricing.capturedTotalMinor).toBe(13000)
    })

    it('retains shipping fee when non-free-shipping item is only REDUCED and still active', () => {
      const order = createMixedOrder()
      // Give normal item quantity 2 initially
      order.items[2]!.quantity = 2
      order.items[2]!.fulfilledQuantity = 2
      order.pricing.itemsTotalMinor = 25000 // 50 + 80 + 120
      order.pricing.grandTotalMinor = 32700
      order.pricing.authorizedTotalMinor = 32700

      // REDUCE_QUANTITY on Product C from 2 to 1 (Product C is still fulfilled with qty 1)
      const { updatedItems, newPricing } = recalculateOrderShortage(
        order,
        [
          {
            productId: itemNormalC_Id.toString(),
            action: 'REDUCE_QUANTITY',
            adjustedQuantity: 1,
            note: 'Only 1 in stock',
          },
        ],
        'Admin',
        89900,
        7700,
        false
      )

      expect(updatedItems.find((i) => i.productId.toString() === itemNormalC_Id.toString())?.fulfilledQuantity).toBe(1)
      expect(newPricing.itemsTotalMinor).toBe(19000) // 50 + 80 + 60 SEK

      // Shipping fee must NOT drop because normal item is still fulfilled and threshold not reached
      expect(newPricing.shippingFeeMinor).toBe(7700)
      expect(newPricing.grandTotalMinor).toBe(26700)

      // Released amount only accounts for 1 dropped unit of Product C (6000 minor)
      expect(newPricing.releasedOrRefundedMinor).toBe(6000)
    })

    it('waives shipping fee when freeShippingItemGrantsEntireOrder is true even if normal items remain', () => {
      const order = createMixedOrder()

      // Calculate with freeShippingItemGrantsEntireOrder = true
      const newPricing = computeOrderPricing(
        order.items,
        'DELIVERY',
        7700,
        26700,
        'SEK',
        89900,
        7700,
        true // freeShippingItemGrantsEntireOrder = true
      )

      expect(newPricing.shippingFeeMinor).toBe(0)
      expect(newPricing.grandTotalMinor).toBe(19000)
      expect(newPricing.releasedOrRefundedMinor).toBe(7700)
    })
  })
})
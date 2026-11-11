// tests/unit/order.grossWeight.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { Types } from 'mongoose'
import { resolveProductGrossWeightGrams } from '~/utils/shipping'

const {
  mockState,
  mockOrderModel,
  mockProductModel,
  mockPaymentGateway,
  mockShippingCarrier,
  mockFetch,
} = vi.hoisted(() => {
  const mockState = {
    params: {} as Record<string, string>,
    body: {} as any,
    orderDoc: null as any,
    createdOrderPayload: null as any,
    productsList: [] as any[],
  }

  const mockFetch = vi.fn(async () => ({ success: true }))

  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readBody', vi.fn(async () => mockState.body))
  vi.stubGlobal('getRouterParam', vi.fn((_event: any, name: string) => mockState.params[name]))
  vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))
  vi.stubGlobal('useLocalePath', () => (p: string) => p)
  vi.stubGlobal('useAsyncData', vi.fn((_k: string, _fn: any) => ({ data: ref(null) })))
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { stripePublishableKey: 'pk_test_mock' },
  }))
  vi.stubGlobal('$fetch', mockFetch)
  vi.stubGlobal('createError', (err: { statusCode: number; statusMessage: string }) => {
    const error: any = new Error(err.statusMessage)
    error.statusCode = err.statusCode
    error.statusMessage = err.statusMessage
    return error
  })

  const mockOrderModel: any = {
    findById: vi.fn((_id: string) => {
      const lean = vi.fn(async () =>
        mockState.orderDoc ? JSON.parse(JSON.stringify(mockState.orderDoc)) : null
      )
      const docWithLean: any = mockState.orderDoc
      if (docWithLean && typeof docWithLean.then !== 'function') {
        docWithLean.lean = lean
        return docWithLean
      }
      return Promise.resolve(mockState.orderDoc)
    }),
    create: vi.fn(async (payload: any) => {
      mockState.createdOrderPayload = payload
      return { _id: new Types.ObjectId(), ...payload }
    }),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
  }

  const makeProductQuery = () => {
    const queryObj: any = {
      select: vi.fn(() => queryObj),
      populate: vi.fn(() => queryObj),
      lean: vi.fn(async () => mockState.productsList),
    }
    return queryObj
  }

  const mockProductModel: any = {
    find: vi.fn(() => makeProductQuery()),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
  }

  const mockPaymentGateway = {
    createSession: vi.fn(async () => ({ paymentId: 'pi_test_1', clientSecret: 'sec_test_1' })),
    captureFunds: vi.fn(async () => true),
    cancelAuthorization: vi.fn(async () => true),
    refundPayment: vi.fn(async () => true),
  }

  const mockShippingCarrier = {
    createShipment: vi.fn(async () => ({
      carrier: 'DHL',
      trackingCode: '003733001234567890',
      consignmentNumber: '3733001234',
      trackingUrl: 'https://www.dhl.com/se-en/home/tracking.html?tracking-id=003733001234567890',
    })),
    generateMockShipment: vi.fn(() => ({
      carrier: 'DHL',
      trackingCode: '003733001234567890',
      consignmentNumber: '3733001234',
    })),
    getTrackingUrl: vi.fn((code: string) => `https://www.dhl.com/se-en/home/tracking.html?tracking-id=${code}`),
  }

  return {
    mockState,
    mockOrderModel,
    mockProductModel,
    mockPaymentGateway,
    mockShippingCarrier,
    mockFetch,
  }
})

vi.mock('~/server/models/Order', () => ({ Order: mockOrderModel }))
vi.mock('~/server/models/Product', () => ({ Product: mockProductModel }))
vi.mock('~/server/utils/orderAuthorization', () => ({
  syncOrderPaymentWithStripe: vi.fn(async (o: any) => o),
}))
vi.mock('~/server/services/shipping.service', () => ({
  getCachedShippingSettings: vi.fn(async () => ({
    freeShippingThresholdMinorSEK: 89900,
    tiers: [{ feeMinorSEK: 7700 }],
    freeShippingItemGrantsEntireOrder: false,
  })),
}))
vi.mock('~/server/services/payments', () => ({
  getPaymentGateway: vi.fn(() => mockPaymentGateway),
}))
vi.mock('~/server/services/shipping', () => ({
  getShippingCarrier: vi.fn(() => mockShippingCarrier),
}))

import getAdminOrderHandler from '~/server/api/admin/orders/[id].get'
import createSessionHandler from '~/server/api/checkout/create-session.post'
import packOrderHandler from '~/server/api/admin/orders/[id]/pack.post'
import { useOrderPacking } from '~/composables/useOrderPacking'

describe('Order Item grossWeight Persistence, Backfill & Packing Modal Calculation', () => {
  const dummyEvent = {} as any

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.params = {}
    mockState.body = {}
    mockState.orderDoc = null
    mockState.createdOrderPayload = null
    mockState.productsList = []
  })

  it('resolveProductGrossWeightGrams resolves explicit grossWeight or gram/kg netQuantity fallback', () => {
    expect(resolveProductGrossWeightGrams({ grossWeight: 1250, netQuantity: { value: 1, unit: 'kg' } })).toBe(1250)
    expect(resolveProductGrossWeightGrams({ grossWeight: 0, netQuantity: { value: 450, unit: 'g' } })).toBe(450)
    expect(resolveProductGrossWeightGrams({ grossWeight: 0, netQuantity: { value: 1.5, unit: 'kg' } })).toBe(1500)
    expect(resolveProductGrossWeightGrams({ grossWeight: 0, netQuantity: { value: 500, unit: 'ml' } })).toBe(0)
  })

  it('GET /api/admin/orders/[id] backfills grossWeight from Product even when DB item has default grossWeight: 0', async () => {
    const orderId = new Types.ObjectId()
    const prodA = new Types.ObjectId()
    const prodB = new Types.ObjectId()
    const prodC = new Types.ObjectId()

    mockState.params = { id: String(orderId) }
    mockState.orderDoc = {
      _id: orderId,
      orderReference: 'ORD-WEIGHT-1',
      paymentProvider: 'STRIPE',
      paymentStatus: 'AUTHORIZED',
      fulfillmentStatus: 'PENDING_PACKING',
      currency: 'SEK',
      items: [
        {
          productId: prodA,
          name: { sv: 'Olivolja 1L', en: 'Olive Oil 1L', ar: 'زيت زيتون' },
          quantity: 2,
          fulfilledQuantity: 2,
          unitPriceMinor: 12000,
          momsRate: 12,
          imageUrl: 'https://img/a.jpg',
          freeShipping: false,
          grossWeight: 0, // Persisted default 0 from schema before fix
        },
        {
          productId: prodB,
          name: { sv: 'Krydda', en: 'Spice', ar: 'بهارات' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 3500,
          momsRate: 12,
          imageUrl: 'https://img/b.jpg',
          freeShipping: false,
          grossWeight: 0, // Legacy product without grossWeight, but netQuantity 250g
        },
        {
          productId: prodC,
          name: { sv: 'Honung', en: 'Honey', ar: 'عسل' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 8900,
          momsRate: 12,
          imageUrl: 'https://img/c.jpg',
          freeShipping: false,
          grossWeight: 850, // Already populated positive weight
        },
      ],
    }

    mockState.productsList = [
      { _id: prodA, grossWeight: 1200, freeShipping: false, images: [] },
      { _id: prodB, grossWeight: 0, netQuantity: { value: 250, unit: 'g' }, freeShipping: false, images: [] },
    ]

    const res: any = await getAdminOrderHandler(dummyEvent)

    expect(res.items[0].grossWeight).toBe(1200)
    expect(res.items[1].grossWeight).toBe(250)
    expect(res.items[2].grossWeight).toBe(850)
  })

  it('POST /api/checkout/create-session snapshots grossWeight onto newly created order items', async () => {
    const prodA = new Types.ObjectId()
    const prodB = new Types.ObjectId()

    mockState.productsList = [
      {
        _id: prodA,
        barcode: 'SKU-A',
        name: { sv: 'Dadlar', en: 'Dates', ar: 'تمر' },
        price: { SEK: 6500, EUR: 600, USD: 650 },
        stockQuantity: 20,
        safetyBuffer: 0,
        momsRate: 12,
        freeShipping: false,
        grossWeight: 950,
        images: [{ url: 'https://img/a.jpg', isPrimary: true }],
      },
      {
        _id: prodB,
        barcode: 'SKU-B',
        name: { sv: 'Sumak', en: 'Sumac', ar: 'سماق' },
        price: { SEK: 3900, EUR: 350, USD: 400 },
        stockQuantity: 20,
        safetyBuffer: 0,
        momsRate: 12,
        freeShipping: false,
        grossWeight: 0,
        netQuantity: { value: 200, unit: 'g' },
        images: [{ url: 'https://img/b.jpg', isPrimary: true }],
      },
    ]

    mockState.body = {
      provider: 'STRIPE',
      currency: 'SEK',
      shippingFeeMinor: 7700,
      items: [
        { productId: String(prodA), quantity: 2 },
        { productId: String(prodB), quantity: 1 },
      ],
      customer: {
        fullName: 'Nadia Karim',
        email: 'nadia@example.com',
        phone: '0701112233',
        fulfillmentMethod: 'DELIVERY',
        address: { street: 'Kungsgatan 5', postalCode: '30245', city: 'Halmstad' },
      },
    }

    await createSessionHandler(dummyEvent)

    expect(mockState.createdOrderPayload).toBeTruthy()
    expect(mockState.createdOrderPayload.items[0].grossWeight).toBe(950)
    expect(mockState.createdOrderPayload.items[1].grossWeight).toBe(200)
  })

  it('useOrderPacking updates grossWeight on substitution, restores it on reset, and submits it in pack payload', async () => {
    const orderId = new Types.ObjectId()
    const origId = new Types.ObjectId()
    const subId = new Types.ObjectId()

    const orderRef = ref<any>({
      _id: String(orderId),
      orderReference: 'ORD-PACK-WT',
      fulfillmentStatus: 'PENDING_PACKING',
      paymentStatus: 'AUTHORIZED',
      currency: 'SEK',
      customer: { fulfillmentMethod: 'DELIVERY' },
      pricing: { authorizedTotalMinor: 20000, shippingFeeMinor: 7700 },
      items: [
        {
          productId: String(origId),
          sku: 'ORIG-SKU',
          name: { sv: 'Originalolja', en: 'Original Oil', ar: 'زيت أصلي' },
          quantity: 2,
          fulfilledQuantity: 2,
          unitPriceMinor: 6000,
          momsRate: 12,
          freeShipping: false,
          grossWeight: 1100,
          shortageStatus: 'NONE',
          isPacked: false,
        },
      ],
      shortageAdjustments: [],
    })

    const refreshOrder = vi.fn(async () => {})
    const { localItems, applyShortageAction, resetLineItem, submitPacking } = useOrderPacking(orderRef, refreshOrder)

    expect(localItems.value[0]?.grossWeight).toBe(1100)

    // Substitute with a 350g product
    applyShortageAction({
      productId: String(origId),
      action: 'SUBSTITUTE_ITEM',
      adjustedQuantity: 2,
      substitutedProduct: {
        _id: String(subId),
        sku: 'SUB-SKU',
        name: { sv: 'Ersättningsburk', en: 'Sub Jar', ar: 'بديل' },
        priceMinor: 5000,
        momsRate: 12,
        freeShipping: false,
        grossWeight: 350,
      },
    })

    expect(localItems.value[0]?.grossWeight).toBe(350)

    // Submit includes substituted grossWeight
    await submitPacking(false)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const sentBody = (mockFetch.mock.calls[0] as any)?.[1]?.body
    expect(sentBody.items[0].grossWeight).toBe(350)

    // Reset restores original grossWeight (1100g)
    resetLineItem(String(origId))
    expect(localItems.value[0]?.grossWeight).toBe(1100)
  })

  it('POST /api/admin/orders/[id]/pack persists substituted grossWeight without overwriting backfilled weight', async () => {
    const orderId = new Types.ObjectId()
    const origId = new Types.ObjectId()
    const subId = new Types.ObjectId()

    const doc: any = {
      _id: orderId,
      orderReference: 'ORD-PACK-API-WT',
      paymentProvider: 'STRIPE',
      paymentId: 'pi_wt_1',
      paymentStatus: 'AUTHORIZED',
      fulfillmentStatus: 'PENDING_PACKING',
      currency: 'SEK',
      customerLocale: 'sv',
      inventoryDecremented: true,
      customer: {
        fullName: 'Sara Berg',
        email: 'sara@example.com',
        phone: '0705556677',
        fulfillmentMethod: 'DELIVERY',
        address: { street: 'Drottninggatan 1', postalCode: '30244', city: 'Halmstad' },
      },
      items: [
        {
          productId: origId,
          sku: 'ORIG-1',
          name: { sv: 'Varugrupp 1', en: 'Item 1', ar: 'صنف 1' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 8000,
          momsRate: 12,
          freeShipping: false,
          grossWeight: 0, // DB had default 0
          shortageStatus: 'NONE',
          isPacked: false,
        },
      ],
      shortageAdjustments: [],
      pricing: {
        itemsTotalMinor: 8000,
        shippingFeeMinor: 7700,
        grandTotalMinor: 15700,
        authorizedTotalMinor: 15700,
        taxSplit: { totalMomsMinor: 2397, moms12: { momsAmountMinor: 857 }, moms25: { momsAmountMinor: 1540 } },
      },
      markModified: vi.fn(),
      save: vi.fn(async function (this: any) { return this }),
    }

    mockState.orderDoc = doc
    mockState.params = { id: String(orderId) }
    mockState.productsList = [
      { _id: origId, freeShipping: false, grossWeight: 1400 },
    ]
    mockState.body = {
      markDispatched: false,
      items: [
        {
          index: 0,
          productId: String(subId),
          originalProductId: String(origId),
          fulfilledQuantity: 1,
          shortageStatus: 'SUBSTITUTED',
          unitPriceMinor: 7000,
          momsRate: 12,
          freeShipping: false,
          grossWeight: 620,
          isPacked: false,
        },
      ],
      actions: [
        {
          productId: String(origId),
          action: 'SUBSTITUTE_ITEM',
          adjustedQuantity: 1,
          substitutedProduct: {
            _id: String(subId),
            sku: 'SUB-1',
            name: { sv: 'Ersättning', en: 'Substitute', ar: 'بديل' },
            priceMinor: 7000,
            momsRate: 12,
            freeShipping: false,
            grossWeight: 620,
          },
        },
      ],
    }

    await packOrderHandler(dummyEvent)

    expect(doc.items[0].grossWeight).toBe(620)
    expect(doc.shortageAdjustments[0].originalGrossWeight).toBe(1400)
  })
})


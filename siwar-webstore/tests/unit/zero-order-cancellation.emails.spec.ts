// tests/unit/zero-order-cancellation.emails.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Types } from 'mongoose'
import { mount } from '@vue/test-utils'

// ---------------------------------------------------------------------------
// 1. Hoisted Mocks & Nitro Globals
// ---------------------------------------------------------------------------
const {
  mockState,
  mockResendSend,
  mockOrderModel,
  mockProductModel,
  mockPaymentGateway,
  mockShippingCarrier,
} = vi.hoisted(() => {
  const mockState = {
    params: {} as Record<string, string>,
    body: {} as any,
    orderDoc: null as any,
  }

  const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'resend-email-id-1' } })

  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readBody', vi.fn(async () => mockState.body))
  vi.stubGlobal('getRouterParam', vi.fn((_event: any, name: string) => mockState.params[name]))
  vi.stubGlobal('useLocalePath', () => (p: string) => p)
  vi.stubGlobal('createError', (err: { statusCode: number; statusMessage: string }) => {
    const error: any = new Error(err.statusMessage)
    error.statusCode = err.statusCode
    error.statusMessage = err.statusMessage
    return error
  })

  const mockOrderModel: any = {
    findById: vi.fn(async () => mockState.orderDoc),
    updateOne: vi.fn(async (_filter: any, update: any) => {
      if (mockState.orderDoc && update?.$set) {
        Object.assign(mockState.orderDoc, update.$set)
      }
      return { modifiedCount: 1 }
    }),
  }

  const mockProductModel: any = {
    find: vi.fn(() => ({
      lean: vi.fn(async () => []),
    })),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
  }

  const mockPaymentGateway = {
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
    mockResendSend,
    mockOrderModel,
    mockProductModel,
    mockPaymentGateway,
    mockShippingCarrier,
  }
})

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mockResendSend,
    }
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (_key: string, paramOrFallback?: any, fallback?: string) => {
      if (typeof fallback === 'string') return fallback
      if (typeof paramOrFallback === 'string') return paramOrFallback
      return _key
    },
    locale: { value: 'sv' },
  }),
}))

vi.mock('~/server/models/Order', () => ({ Order: mockOrderModel }))
vi.mock('~/server/models/Product', () => ({ Product: mockProductModel }))
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

import packOrderHandler from '~/server/api/admin/orders/[id]/pack.post'
import cancelOrderHandler from '~/server/api/admin/orders/[id]/cancel.post'
import {
  mailService,
  generateCancelledHtml,
  isZeroTotalOrder,
} from '~/server/services/mail.service'
import type { IOrder } from '~/server/models/Order'
import OrderPackHeader from '~/components/OrderPackHeader.vue'

describe('Zero-Sum / All-Unavailable Order Email & Cancellation Bug Fix', () => {
  const dummyEvent = {} as any
  const originalResendKey = process.env.RESEND_API_KEY

  function createOrderDoc(overrides: Partial<any> = {}) {
    const orderId = new Types.ObjectId()
    const prodAId = new Types.ObjectId()
    const prodBId = new Types.ObjectId()

    const doc: any = {
      _id: orderId,
      orderReference: 'ORD-ZERO-001',
      paymentProvider: 'STRIPE',
      paymentId: 'pi_test_zero_1',
      paymentStatus: 'AUTHORIZED',
      fulfillmentStatus: 'PENDING_PACKING',
      currency: 'SEK',
      customerLocale: 'sv',
      inventoryDecremented: true,
      confirmationEmailSent: true,
      cancellationEmailSent: false,
      customer: {
        fullName: 'Layla Hassan',
        email: 'layla@example.com',
        phone: '0701234567',
        fulfillmentMethod: 'DELIVERY',
        address: {
          street: 'Storgatan 10',
          postalCode: '30243',
          city: 'Halmstad',
        },
      },
      items: [
        {
          productId: prodAId,
          sku: 'SKU-A',
          name: { sv: 'Olivolja', en: 'Olive Oil', ar: 'زيت زيتون' },
          quantity: 1,
          fulfilledQuantity: 1,
          unitPriceMinor: 12000,
          momsRate: 12,
          freeShipping: false,
          shortageStatus: 'NONE',
          isPacked: false,
        },
        {
          productId: prodBId,
          sku: 'SKU-B',
          name: { sv: 'Dadlar', en: 'Dates', ar: 'تمر' },
          quantity: 2,
          fulfilledQuantity: 2,
          unitPriceMinor: 5000,
          momsRate: 12,
          freeShipping: false,
          shortageStatus: 'NONE',
          isPacked: false,
        },
      ],
      shortageAdjustments: [],
      pricing: {
        itemsTotalMinor: 22000,
        shippingFeeMinor: 7700,
        grandTotalMinor: 29700,
        authorizedTotalMinor: 29700,
        taxSplit: {
          totalMomsMinor: 3900,
          moms6: { netAmountMinor: 0, momsAmountMinor: 0 },
          moms12: { netAmountMinor: 19643, momsAmountMinor: 2357 },
          moms25: { netAmountMinor: 6160, momsAmountMinor: 1540 },
        },
      },
      markModified: vi.fn(),
      save: vi.fn(async function (this: any) {
        return this
      }),
      ...overrides,
    }

    return { doc, orderId, prodAId, prodBId }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 're_test_mock_key'
    mockState.params = {}
    mockState.body = {}
    mockState.orderDoc = null
  })

  afterEach(() => {
    if (originalResendKey === undefined) {
      delete process.env.RESEND_API_KEY
    } else {
      process.env.RESEND_API_KEY = originalResendKey
    }
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. MailService Defense-in-Depth Guards & Cancellation Email Template
  // -------------------------------------------------------------------------
  describe('MailService Zero-Total Guards & Cancellation Template', () => {
    it('identifies zero-total orders via isZeroTotalOrder helper', () => {
      const { doc: zeroItemsOrder } = createOrderDoc()
      zeroItemsOrder.items.forEach((i: any) => {
        i.fulfilledQuantity = 0
        i.shortageStatus = 'REMOVED'
      })
      zeroItemsOrder.pricing.grandTotalMinor = 0
      zeroItemsOrder.pricing.capturedTotalMinor = 0

      expect(isZeroTotalOrder(zeroItemsOrder as IOrder)).toBe(true)

      const { doc: normalOrder } = createOrderDoc()
      expect(isZeroTotalOrder(normalOrder as IOrder)).toBe(false)
    })

    it('refuses to send packing or dispatch emails when order final sum is ZERO', async () => {
      const { doc } = createOrderDoc()
      doc.items.forEach((i: any) => {
        i.fulfilledQuantity = 0
        i.shortageStatus = 'REMOVED'
      })
      doc.pricing.itemsTotalMinor = 0
      doc.pricing.shippingFeeMinor = 0
      doc.pricing.grandTotalMinor = 0
      doc.pricing.capturedTotalMinor = 0

      const packedRes = await mailService.sendOrderPackedNotice(doc as IOrder, 'sv')
      const dispatchedRes = await mailService.sendOrderDispatched(
        { order: doc as IOrder, trackingCode: '003733001234567890', carrier: 'DHL' },
        'sv'
      )

      expect(packedRes).toEqual({ id: 'skipped-zero-or-cancelled' })
      expect(dispatchedRes).toEqual({ id: 'skipped-zero-or-cancelled' })
      expect(mockResendSend).not.toHaveBeenCalled()
    })

    it('renders localized cancellation emails in SV, EN, and AR (dir="rtl")', () => {
      const { doc } = createOrderDoc()
      doc.fulfillmentStatus = 'CANCELLED'
      doc.paymentStatus = 'CANCELLED'

      const svHtml = generateCancelledHtml(doc as IOrder, 'sv')
      expect(svHtml).toContain('dir="ltr"')
      expect(svHtml).toContain('Din order har avbrutits')
      expect(svHtml).toContain('0.00 SEK')
      expect(svHtml).toContain('297.00 SEK')
      expect(svHtml).toContain('Kortreservationen har släppts')
      expect(svHtml).toContain('Olivolja')
      expect(svHtml).not.toContain('/order/confirmation/')
      expect(svHtml).not.toContain('Visa orderdetaljer')

      const enHtml = generateCancelledHtml(doc as IOrder, 'en', 'All items out of stock')
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Your order has been cancelled')
      expect(enHtml).toContain('All items out of stock')
      expect(enHtml).toContain('authorization hold on your card has been released')
      expect(enHtml).not.toContain('/order/confirmation/')
      expect(enHtml).not.toContain('View Order Details')

      const arHtml = generateCancelledHtml(
        { ...doc, paymentProvider: 'SWISH' } as IOrder,
        'ar'
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('تم إلغاء طلبك')
      expect(arHtml).toContain('تم إرجاع كامل المبلغ المدفوع عبر Swish')
      expect(arHtml).not.toContain('/order/confirmation/')
      expect(arHtml).not.toContain('عرض تفاصيل الطلب')
    })

    it('blocks duplicate cancellation emails when cancellationEmailSent is already true', async () => {
      const { doc } = createOrderDoc({ cancellationEmailSent: true })
      const res = await mailService.sendOrderCancelled(doc as IOrder, 'sv')

      expect(res).toEqual({ id: 'skipped-already-sent' })
      expect(mockResendSend).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // 2. Backend Fulfillment Flow (pack.post.ts & cancel.post.ts)
  // -------------------------------------------------------------------------
  describe('Backend Pack & Cancel Endpoints when All Items Unavailable (Final Sum = 0)', () => {
    it('sends ZERO emails on Save Pack Status (markDispatched: false) and ONLY ONE cancellation email on Cancel Empty Order (markDispatched: true)', async () => {
      const { doc, orderId, prodAId, prodBId } = createOrderDoc()
      mockState.orderDoc = doc
      mockState.params = { id: String(orderId) }

      const packedSpy = vi.spyOn(mailService, 'sendOrderPackedNotice')
      const dispatchedSpy = vi.spyOn(mailService, 'sendOrderDispatched')
      const cancelledSpy = vi.spyOn(mailService, 'sendOrderCancelled')

      // Step 1: Staff marks ALL items unavailable and clicks "Spara packstatus" (markDispatched: false)
      mockState.body = {
        markDispatched: false,
        items: [
          {
            index: 0,
            productId: String(prodAId),
            fulfilledQuantity: 0,
            shortageStatus: 'REMOVED',
            isPacked: true,
          },
          {
            index: 1,
            productId: String(prodBId),
            fulfilledQuantity: 0,
            shortageStatus: 'REMOVED',
            isPacked: true,
          },
        ],
        actions: [
          { productId: String(prodAId), action: 'REMOVE_LINE', adjustedQuantity: 0 },
          { productId: String(prodBId), action: 'REMOVE_LINE', adjustedQuantity: 0 },
        ],
      }

      const saveRes = await packOrderHandler(dummyEvent)

      expect(saveRes.fulfillmentStatus).toBe('PENDING_PACKING') // Must NOT mark PACKED
      expect(saveRes.capturedTotalMinor).toBe(0)
      expect(packedSpy).not.toHaveBeenCalled()
      expect(dispatchedSpy).not.toHaveBeenCalled()
      expect(cancelledSpy).not.toHaveBeenCalled()
      expect(mockResendSend).not.toHaveBeenCalled()

      // Step 2: Staff clicks "Avbryt order (Hela ordern saknas)" (markDispatched: true)
      mockState.body = {
        markDispatched: true,
        items: [
          {
            index: 0,
            productId: String(prodAId),
            fulfilledQuantity: 0,
            shortageStatus: 'REMOVED',
            isPacked: true,
          },
          {
            index: 1,
            productId: String(prodBId),
            fulfilledQuantity: 0,
            shortageStatus: 'REMOVED',
            isPacked: true,
          },
        ],
        actions: [],
      }

      const cancelEmptyRes = await packOrderHandler(dummyEvent)

      expect(cancelEmptyRes.fulfillmentStatus).toBe('CANCELLED')
      expect(cancelEmptyRes.paymentStatus).toBe('CANCELLED')
      expect(cancelEmptyRes.capturedTotalMinor).toBe(0)
      expect(mockPaymentGateway.cancelAuthorization).toHaveBeenCalledWith('pi_test_zero_1')
      expect(mockPaymentGateway.captureFunds).not.toHaveBeenCalled()
      expect(mockShippingCarrier.createShipment).not.toHaveBeenCalled()

      // Inventory restored for both original items
      expect(mockProductModel.updateOne).toHaveBeenCalledWith(
        { _id: prodAId },
        { $inc: { stockQuantity: 1 } }
      )
      expect(mockProductModel.updateOne).toHaveBeenCalledWith(
        { _id: prodBId },
        { $inc: { stockQuantity: 2 } }
      )
      expect(doc.inventoryDecremented).toBe(false)
      expect(doc.cancellationEmailSent).toBe(true)

      // Exactly ONE email sent across the entire flow: the cancellation confirmation email
      expect(packedSpy).not.toHaveBeenCalled()
      expect(dispatchedSpy).not.toHaveBeenCalled()
      expect(cancelledSpy).toHaveBeenCalledTimes(1)
      expect(mockResendSend).toHaveBeenCalledTimes(1)
      expect(mockResendSend.mock.calls[0]?.[0]).toMatchObject({
        to: 'layla@example.com',
        subject: 'Order avbruten #ORD-ZERO-001 - Siwar',
      })
    })

    it('sends exactly ONE cancellation email for PICKUP Swish orders when all items are unavailable', async () => {
      const { doc, orderId, prodAId, prodBId } = createOrderDoc({
        paymentProvider: 'SWISH',
        paymentId: 'SWISH-UUID-123',
        paymentStatus: 'PAID',
        customerLocale: 'en',
        customer: {
          fullName: 'Omar Ali',
          email: 'omar@example.com',
          phone: '0709876543',
          fulfillmentMethod: 'PICKUP',
        },
        pricing: {
          itemsTotalMinor: 22000,
          shippingFeeMinor: 0,
          grandTotalMinor: 22000,
          authorizedTotalMinor: 22000,
          taxSplit: { totalMomsMinor: 2357, moms12: { netAmountMinor: 19643, momsAmountMinor: 2357 }, moms25: { netAmountMinor: 0, momsAmountMinor: 0 } },
        },
      })
      mockState.orderDoc = doc
      mockState.params = { id: String(orderId) }

      mockState.body = {
        markDispatched: true,
        items: [
          { index: 0, productId: String(prodAId), fulfilledQuantity: 0, shortageStatus: 'REMOVED', isPacked: true },
          { index: 1, productId: String(prodBId), fulfilledQuantity: 0, shortageStatus: 'REMOVED', isPacked: true },
        ],
        actions: [
          { productId: String(prodAId), action: 'REMOVE_LINE', adjustedQuantity: 0 },
          { productId: String(prodBId), action: 'REMOVE_LINE', adjustedQuantity: 0 },
        ],
      }

      const res = await packOrderHandler(dummyEvent)

      expect(res.fulfillmentStatus).toBe('CANCELLED')
      expect(mockPaymentGateway.refundPayment).toHaveBeenCalledTimes(1)
      expect(mockResendSend).toHaveBeenCalledTimes(1)
      expect(mockResendSend.mock.calls[0]?.[0]).toMatchObject({
        to: 'omar@example.com',
        subject: 'Order Cancelled #ORD-ZERO-001 - Siwar Store',
      })
    })

    it('sends exactly ONE cancellation email when admin cancels via manual cancel endpoint (/cancel)', async () => {
      const { doc, orderId } = createOrderDoc({ customerLocale: 'ar' })
      mockState.orderDoc = doc
      mockState.params = { id: String(orderId) }
      mockState.body = { reason: 'جميع المنتجات غير متوفرة' }

      const res = await cancelOrderHandler(dummyEvent)

      expect(res.fulfillmentStatus).toBe('CANCELLED')
      expect(res.paymentStatus).toBe('CANCELLED')
      expect(doc.pricing.capturedTotalMinor).toBe(0)
      expect(doc.cancellationEmailSent).toBe(true)
      expect(mockPaymentGateway.cancelAuthorization).toHaveBeenCalledTimes(1)
      expect(mockResendSend).toHaveBeenCalledTimes(1)
      expect(mockResendSend.mock.calls[0]?.[0]).toMatchObject({
        to: 'layla@example.com',
        subject: 'تم إلغاء الطلب #ORD-ZERO-001 - متجر سوار',
      })
      expect(mockResendSend.mock.calls[0]?.[0]?.html).toContain('جميع المنتجات غير متوفرة')

      // Subsequent pack calls must reject with 400 and send no extra email
      await expect(packOrderHandler(dummyEvent)).rejects.toMatchObject({ statusCode: 400 })
      expect(mockResendSend).toHaveBeenCalledTimes(1)
    })

    it('still sends normal packed and dispatched emails for non-zero partial shortage orders', async () => {
      const { doc, orderId, prodAId, prodBId } = createOrderDoc()
      mockState.orderDoc = doc
      mockState.params = { id: String(orderId) }

      // Step 1: Mark item B unavailable, keep item A packed -> non-zero sum
      mockState.body = {
        markDispatched: false,
        items: [
          { index: 0, productId: String(prodAId), fulfilledQuantity: 1, shortageStatus: 'NONE', isPacked: true },
          { index: 1, productId: String(prodBId), fulfilledQuantity: 0, shortageStatus: 'REMOVED', isPacked: true },
        ],
        actions: [{ productId: String(prodBId), action: 'REMOVE_LINE', adjustedQuantity: 0 }],
      }

      const packRes = await packOrderHandler(dummyEvent)
      expect(packRes.fulfillmentStatus).toBe('PACKED')
      expect(packRes.capturedTotalMinor).toBe(19700) // 120 SEK item + 77 SEK shipping
      expect(mockResendSend).toHaveBeenCalledTimes(1)
      expect(mockResendSend.mock.calls[0]?.[0]?.subject).toContain('färdigpackad')

      // Step 2: Dispatch non-zero order
      mockState.body.markDispatched = true
      mockState.body.actions = []
      const dispatchRes = await packOrderHandler(dummyEvent)
      expect(dispatchRes.fulfillmentStatus).toBe('DISPATCHED')
      expect(mockResendSend).toHaveBeenCalledTimes(2)
      expect(mockResendSend.mock.calls[1]?.[0]?.subject).toContain('har skickats')
    })
  })

  // -------------------------------------------------------------------------
  // 3. Admin UI Guards (OrderPackHeader.vue)
  // -------------------------------------------------------------------------
  describe('OrderPackHeader UI Guards for Zero-Sum Orders', () => {
    const mountHeader = (props: any) =>
      mount(OrderPackHeader, {
        props,
        global: {
          stubs: {
            NuxtLink: { template: '<a><slot /></a>' },
            Icon: { template: '<span class="icon-stub"></span>' },
            ClientOnly: { template: '<slot />' },
          },
        },
      })

    it('disables Mark All Packed and Save Pack Status buttons when all items are unavailable or final sum is 0', () => {
      const wrapper = mountHeader({
        order: {
          orderReference: 'ORD-ZERO-001',
          fulfillmentStatus: 'PENDING_PACKING',
          paymentStatus: 'AUTHORIZED',
          paymentProvider: 'STRIPE',
          createdAt: new Date().toISOString(),
        },
        isSubmitting: false,
        totalFulfilledUnits: 0,
        finalTotalMinor: 0,
        canDispatch: false,
        isUnpackable: false,
      })

      const buttons = wrapper.findAll('button')
      const packAllBtn = buttons.find((b) => b.text().includes('Markera alla som packade'))
      const saveBtn = buttons.find((b) => b.text().includes('Spara packstatus'))
      const cancelEmptyBtn = buttons.find((b) => b.text().includes('Avbryt order (Hela ordern saknas)'))
      const dispatchBtn = buttons.find((b) => b.text().includes('Slutför och Skicka'))

      expect(packAllBtn?.attributes('disabled')).toBeDefined()
      expect(saveBtn?.attributes('disabled')).toBeDefined()
      expect(cancelEmptyBtn).toBeDefined()
      expect(cancelEmptyBtn?.attributes('disabled')).toBeUndefined()
      expect(dispatchBtn).toBeUndefined()
    })

    it('keeps Mark All Packed and Save Pack Status enabled when items remain and final sum > 0', () => {
      const wrapper = mountHeader({
        order: {
          orderReference: 'ORD-ACTIVE-001',
          fulfillmentStatus: 'PENDING_PACKING',
          paymentStatus: 'AUTHORIZED',
          paymentProvider: 'STRIPE',
          createdAt: new Date().toISOString(),
        },
        isSubmitting: false,
        totalFulfilledUnits: 2,
        finalTotalMinor: 19700,
        canDispatch: true,
        isUnpackable: false,
      })

      const buttons = wrapper.findAll('button')
      const packAllBtn = buttons.find((b) => b.text().includes('Markera alla som packade'))
      const saveBtn = buttons.find((b) => b.text().includes('Spara packstatus'))
      const dispatchBtn = buttons.find((b) => b.text().includes('Slutför och Skicka'))

      expect(packAllBtn?.attributes('disabled')).toBeUndefined()
      expect(saveBtn?.attributes('disabled')).toBeUndefined()
      expect(dispatchBtn).toBeDefined()
      expect(dispatchBtn?.attributes('disabled')).toBeUndefined()
    })
  })
})

